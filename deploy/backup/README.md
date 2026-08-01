# 数据库备份与恢复（2026-08-02 建立）

> ⭐ **出事的时候先看这里的「紧急恢复」一节。**

## 为什么会有这一套

在 2026-08-02 之前，**这个项目没有任何数据库备份**：没有 `pg_dump`、没有 cron、没有 WAL 归档。
数据在单盘单实例的 `/opt/flashmuse/data/pgdata` 上，而 `/opt/flashmuse/app-backups/` 里备份的
只是**应用代码**（那个 git 里本来就有，是最不值钱的东西）。
盘一坏或者手一抖（`prisma migrate deploy` 是容器启动时自动跑的，跑之前也没有备份），
用户、积分、账单流水就一起没了。

## 现在的样子

| 项 | 值 |
|---|---|
| 备份内容 | **正式服 + 测试服**两个库全量 + 各自的 `.env.local` |
| 存放位置 | 腾讯 `/opt/flashmuse/backups/{prod,staging}/` |
| 异地一份 | 阿里 `101.37.129.164:/opt/flashmuse-backups/`（rsync，同一把已有的 SSH key） |
| 频率 | **每天北京时间 03:30**（`/etc/cron.d/flashmuse-db-backup`） |
| 自动演练 | **每周一北京时间 04:10** 自动恢复到临时库验证一次 |
| 保留 | 本机 14 天内全部 + 每月 1 号那份留 12 个月；**异地不删**（本机清了异地还在） |
| 体积 | 正式 **8.2MB** / 测试 **0.33MB**（原库 164MB / 14MB） |
| 耗时 | 约 36 秒（dump+xz 25s，跨境同步 11s） |
| 脚本 | `/opt/flashmuse/scripts/flashmuse-db-backup.sh`、`flashmuse-db-restore.sh` |
| 仓库权威副本 | `deploy/backup/`（**先改仓库、再部署过去**，别只在服务器上手改） |

## 日常怎么看它有没有在跑

```bash
ssh -i <pem> ubuntu@119.28.116.16
sudo cat /opt/flashmuse/backups/last-status.txt     # OK / OK_LOCAL_ONLY / FAILED
sudo tail -20 /opt/flashmuse/backups/backup.log     # 详细日志
sudo tail -30 /opt/flashmuse/backups/drill.log      # 每周恢复演练的结果
sudo find /opt/flashmuse/backups -name '*.dump.xz' -printf '%TY-%Tm-%Td %10s %f\n' | sort
```

`last-status.txt` 的四种值：

| 值 | 含义 | 要不要管 |
|---|---|---|
| `OK` | 本机 + 异地都成了 | 不用管 |
| `OK_NO_ALI` | 手动带了 `--no-ali` | 不用管 |
| `OK_LOCAL_ONLY` | **本机备份是好的**，但异地没传完（跨境链路丢包 30~40%，会自己续传） | 连续几天都这样才需要看 |
| `FAILED` | 备份本身失败了 | **立刻查** `backup.log` 里的 ❌ |

⚠️ **这台机器没装 MTA，cron 发不出邮件** —— 所以不会有失败通知，只能靠上面这些文件。

## 手动跑

```bash
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh                     # 两服 + 异地
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh --stack prod        # 只正式服
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh --no-ali            # 不传异地
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh --label pre-deploy  # 打个标签
```

## ⭐⭐ 部署前必做（尤其是带 Prisma 迁移的批次）

`docker-entrypoint.sh` 在容器启动时会自动 `prisma migrate deploy`，**而迁移是单向的**：
代码可以回滚，库迁上去了就回不来。所以**任何带新迁移的部署，动手前先跑一次**：

```bash
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh --stack prod --label pre-deploy
```

这样万一迁移把数据搞坏，有一个"迁移前那一刻"的精确还原点。
（判断有没有新迁移：比对 `prisma/migrations/` 的目录数和服务器上 `_prisma_migrations` 表的行数。）

## 🚨 紧急恢复

### 第一步：永远先演练，别直接覆盖

```bash
# 恢复到一个临时库、比对行数、然后自动删掉临时库 —— 全程不碰正式库
sudo /opt/flashmuse/scripts/flashmuse-db-restore.sh drill prod
```

### 第二步：确认要覆盖了再来

```bash
# 会先自动做一份 before-restore 备份，然后停 app、重建 schema、恢复、起 app
sudo /opt/flashmuse/scripts/flashmuse-db-restore.sh restore prod \
     /opt/flashmuse/backups/prod/flashmuse-prod-YYYYMMDD-HHMMSS.dump.xz \
     --i-know-this-overwrites-data
```

不加最后那个长参数它会拒绝执行。恢复完**立刻上号验证**（登录 / 对话 / 工作流 / 资产库）。

### 如果腾讯整台机器没了

备份在阿里那台：

```bash
ssh root@101.37.129.164
ls -la /opt/flashmuse-backups/prod/
# 把需要的那份 scp 到新机器，再按上面的 restore 流程走
```

### 手工恢复（不用脚本，比如在一台全新机器上）

```bash
xz -dc flashmuse-prod-xxx.dump.xz > /tmp/x.dump
docker cp /tmp/x.dump <db容器>:/tmp/x.dump
docker exec <db容器> pg_restore -U flashmuse -d flashmuse --no-owner --no-privileges -j 4 /tmp/x.dump
```

⛔ **绝对不要用 `pg_restore < file` 这种管道写法** —— 见下面的坑。

---

## 改这套东西之前必读的几个坑（都是 2026-08-02 实际踩到的）

1. ⛔⛔ **`pg_restore` 不能用 stdin 管道喂。**
   自定义格式（`-Fc`）是可随机访问的归档，`-j`（并行恢复）**要求文件可 seek**；
   从管道读时不可 seek → **恢复出 0 张表，而且报错信息还看不见**。
   必须解压成宿主文件 → `docker cp` 进容器 → 按**路径**恢复。
   ⭐ 第一次演练就是这么失败的 —— 这也正说明"演练"这一步不可省。

2. ⛔ **`local a="$1" b="$X/$a"` 在 bash 里是错的。**
   `local` 是内建命令，**它的全部参数会在它执行之前就被展开**，所以那时 `$a` 还没赋值；
   配合 `set -u` 直接报 `unbound variable` 并中断整个脚本（当时 staging 和异地同步都没跑到）。
   必须先声明、再逐个赋值。

3. ⛔ **`--append-verify` 和 `--partial-dir` 互斥**（rsync 直接 rc=1 秒失败）。
   ⭐ 选 `--partial-dir` 而不是 `--append-verify`：后者会把没传完的文件**以最终文件名**
   留在目标端 —— 对备份系统来说，"一个看起来像完整备份的截断文件"比没有备份更危险。

4. ⛔ **别把 rsync 的 stderr 丢掉。** 第一版写了 `>/dev/null 2>&1`，失败了只能看到 rc=1，
   根本不知道为什么。现在失败时会把原文记进日志。

5. ⚠️ **cron 按系统本地时区跑，不是 UTC。** 这台是 `Asia/Shanghai (+0800)`。
   我第一版写 `30 19 * * *` 并注释成"UTC 19:30 = 北京 03:30"，
   实际会在**北京时间晚上 19:30（用户高峰）**跑 —— 跑反了。改这里前先 `timedatectl`。

6. ⚠️ **crontab 里 `%` 是特殊字符**（表示换行），命令含 `%` 必须写成 `\%`，
   否则命令被**从 `%` 处截断**。我的验证探针用了 `date '+%F'`，被截断成
   `echo "cron-fired-at $(date '+)`，一度让我误判"cron 没生效"。

7. ⭐ **xz 的 `-6` 和 `-9` 在这个库上差 40%，不是我以为的 4%。**
   实测同一份 140MB 归档：`-6 -T2` → 14.3MB，`-9 -T1` → **8.5MB**
   （字典 8MiB vs 64MiB，而这个库里有大量重复的中文提示词）。
   **别凭直觉调这个值。** 用 `-T 1` 而不是 `-T0` 是因为 `-9` 每线程要 ~674MB 内存，
   而这是**多项目共用的机器**（还有 CinematicFlow / VibeSocial），`-T0` 会吃到 3.8GB。

8. ⛔ **纯验证脚本别开 `set -e`**（`curl`/`ssh`/`rsync` 超时返回非 0 会把后面的检查全掐断）。
   这条 `AGENTS.md` 里早就写了，本次又踩了一次。

9. ⭐ **绝不碰 root 的 crontab。** 那台机器是多项目共用的：root crontab 里有腾讯云 stargate
   和 acme.sh 证书续期，`/etc/cron.d` 里还有 certbot / e2scrub_all / sgagenttask / sysstat / yunjing。
   我们只新增 `/etc/cron.d/flashmuse-db-backup` 这一个独立文件，
   安装脚本还会**断言 root crontab 条数改前改后不变**。

## 仓库 ↔ 服务器 的对应关系（仓库是权威）

| 仓库 | 服务器 |
|---|---|
| `deploy/backup/flashmuse-db-backup.sh` | `/opt/flashmuse/scripts/flashmuse-db-backup.sh` |
| `deploy/backup/flashmuse-db-restore.sh` | `/opt/flashmuse/scripts/flashmuse-db-restore.sh` |
| `deploy/backup/install-backup-cron.sh` | 只在安装时用一次（会顺带写 `/etc/cron.d/flashmuse-db-backup`） |

**2026-08-02 安装时已核对：服务器上那两个脚本的 sha256 与仓库这份（转成 LF 后）逐字节一致。**

### 改了脚本怎么重新部署上去

⛔ **先改仓库、再推服务器**，别只在服务器上手改（会漂移）。

```powershell
# 本地（PowerShell）：转成 LF 传上去 —— ⚠️ 别用 PowerShell 的 Set-Content 生成，会加 BOM
$work = "$env:TEMP\fmbash"; New-Item -ItemType Directory -Force -Path $work | Out-Null
Get-ChildItem deploy\backup\*.sh | ForEach-Object {
  $t = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($_.FullName)) -replace "`r`n","`n"
  [System.IO.File]::WriteAllBytes("$work\$($_.Name)", [System.Text.Encoding]::UTF8.GetBytes($t))
}
ssh -i <pem> ubuntu@119.28.116.16 "rm -rf /tmp/fmbackup && mkdir -p /tmp/fmbackup"
scp -i <pem> "$work\*.sh" ubuntu@119.28.116.16:/tmp/fmbackup/
ssh -i <pem> ubuntu@119.28.116.16 "sudo bash /tmp/fmbackup/install-backup-cron.sh"
```

⚠️ **别把中文/引号直接塞进 PowerShell 的 ssh 命令行**（会乱码或引号打架，交接文档里记过多次）——
一律写成 `.sh` → `scp` → `sed -i 's/\r$//'` → `bash`。

## 还没做的（明确留给以后）


- ⛔ **媒体文件（`/opt/flashmuse/data/generated`，21GB）还没纳入备份。**
  2026-08-02 用户拍板"这批先只备数据库 + .env.local，媒体单独议"。
  现状是阿里镜像那边**碰巧**有一份（因为同步脚本没加 `--delete`），但那是巧合不是设计。
- 没有告警：磁盘满、cert 过期、备份连续失败，目前都只能靠人去看文件。
- 没有 WAL 归档 / PITR（当前只能恢复到最近一次每日备份那个点，最坏丢 24 小时）。
