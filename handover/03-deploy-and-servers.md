# Deploy And Servers（2026-07-21 重建，改代码/部署必读）

## 服务器全景（当前）

- **腾讯云新加坡 `119.28.116.16`（主服务器，跑 app）**：Ubuntu 24.04，用户 `ubuntu`（免密 sudo）。Docker 栈。**真正跑 FlashMuse app 的就是这台。**
  - ⚠️ 这台是**多项目共宿主机**（还有 CinematicFlow `/opt/PS-`、VibeSocial `/home/ubuntu/VibeSocial`），**绝不能影响其它项目**。宿主 80(vibesocial-nginx)/3000/5432/8000/8001 已被占。FlashMuse 用宿主 **5000**（正式）、**5001**（测试），独立 docker 网络。没有腾讯云 API 密钥（安全组只能用已开端口）。
  - ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（源 pem `E:\project\【2】server\腾讯云_新加坡服务器\CinematicFlow.pem`；权限太开放要先复制到 temp + `icacls` 收紧再用）。docker 命令一律加 `sudo`。
- **阿里 `101.37.129.164`（国内入口 + 静态镜像 + 反代回腾讯）**：nginx。`/_next/static`、`/home-assets`、`/generated` 走阿里本地镜像；动态/API 全 `proxy_pass → 119.28.116.16:5000`。**架构认知**：走 ali 的动态请求要多一跳跨境回腾讯新加坡；对直连新加坡线路好的用户，ali 反而更慢。ali 不是国内 app 服务器。
- **马来西亚 `101.47.19.109`**：已彻底退出链路（app 早停、DNS 不指它）。归档文档里的"马来 PM2 部署流程"全部过时，别用。

- **DNS**：`main`/`api`.venusface.com → 腾讯 119.28.116.16（腾讯 nginx 443 直接 SSL 终止）；`ali`/`static` → 阿里。
- **公网域名**：`https://main.venusface.com`、`https://api.venusface.com`、`https://ali.venusface.com`、`https://static.venusface.com`。

## 正式服（腾讯）目录与容器

- 部署位置 `/opt/flashmuse/`：`app/`（源码含 Dockerfile）+ `docker-compose.yml` + `data/{.env.local, generated, runtime(=.runtime), pgdata, home-assets, nginx/flashmuse.conf}`。独立网络 `flashmuse_default`。
- 容器：`flashmuse-flashmuse-app-1`（build ./app，expose 3000，entrypoint=`prisma migrate deploy` + `npm run start`）、`flashmuse-flashmuse-db-1`（postgres，不暴露宿主端口，`psql -U flashmuse -d flashmuse`）、`flashmuse-flashmuse-nginx-1`（宿主 443:443 + 5000:80，SSL 终止 main/api + serve `/generated`、`/home-assets` + 反代 app:3000）。
- ⚠️ **为什么必须有 nginx 容器**：`next start` 只服务构建时已存在于 `public/` 的静态文件，`/generated/*` 会 404，必须 nginx 服务。
- `.env.local` 是**可写状态文件**（后台"模型开关/系统设置/上传规则"保存会改写它、API key 运行时从它读），bind-mount、重启不丢。**env 是每台服务器独立数据、不随代码同步**（如 `UPLOAD_RULE_OVERRIDES`）。
- 阿里同步密钥：`/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519`（**root 属主，一切到阿里的 ssh/rsync 必须 sudo**）。

---

## ⭐⭐ 部署铁律（每次动手前必读，见 00-README/AGENTS.md）

- 用户说 **"部署掉/部署一下"= 只部署测试服**，绝不动正式服。
- 只有用户明确说 **"部署正式服/更新正式服/上线正式服"** 才走：**先部署测试服（含 `node scripts/bump-version.mjs` 版本号+1）→ 验证 → 再把测试服那份代码原样同步正式服（不再自增、原样带版本号）**。不跳过测试服、不直接改正式服代码。目标：版本号一样=代码一样。
- ⭐⭐ **每部署完一台，必须真上号点一遍看有没有崩（2026-07-29 用户加的硬性要求）**：
  **curl 200 / 版本号头对了 ≠ 没崩**。测试服部署完要上号，正式服部署完**也要上号**，**发现崩了立刻修**（能回滚就先回滚，保证用户还能用）。
  最小巡检 6 项（每台都做，用 Playwright 或手点都行）：
  1. 登录能进（**三个环境一律 `12424740@qq.com`/`dragonstar`**，见本文件末尾「巡检/测试用哪个号」）
  2. **对话模式**列表 + 历史消息渲染正常
  3. **工作流模式** tldraw 画布能打开、**点一下任意节点不变「Something went wrong」**（React #310 老坑）
  4. **资产库**能开、缩略图出得来
  5. **真跑一次生图**（成功出图 + 积分扣掉）；改过视频链路时**再真跑一次生视频**
     ⭐ 会留痕的实验**新建一个工作流**来做（用户交代"测试内容不要删"）
  6. **后台 `/admin`** 能进、`browser_console_messages` 里 **0 error**（hydration mismatch #418 老坑）
     ⭐ 后台是唯一允许用 `lookxun@163.com` 的地方（要管理员权限），**只看页面、别在上面生成东西**

---

## 测试服（staging）

- **入口**：`http://101.37.129.164:8080/`（阿里，IP）或 `https://staging-static.venusface.com/`（阿里 DNS + Let's Encrypt 443）；后台 `/admin`。
- **架构**：腾讯 `/opt/flashmuse-staging/` 独立 Docker 栈（容器 `flashmuse-staging-staging-{app,db,nginx}-1`，宿主 5001）+ 阿里 `/var/www/flashmuse-static-test/` 独立镜像（nginx 8080）+ 独立 ali-sync（`sync-ali-test.sh`）。测试库独立、`staging-db`，`psql -U flashmuse -d flashmuse`。
- **测试账号（明文；密码都 `dragonstar`；登录页选"密码登录"→填邮箱点"提交邮箱"→填密码）**：
  - ⭐⭐ **`12424740@qq.com`（主测试号，普通用户 ID_535317）—— 一切测试只用它**（本地/测试服/正式服都有这个号）。
  - `lookxun@163.com`（白名单/管理员 ID_176407）、`176107103@qq.com`（白名单）——
    ⛔ **只用于登后台 `/admin`**，禁止在上面做前台测试/生成（`lookxun@163.com` 是**用户自己的号**）。
  - 白名单走 env `ADMIN_EMAILS`。**测试内容不要删**（用户交代）。
- 测试服 env 差异（`/opt/flashmuse-staging/data/.env.local`）：`NEXT_PUBLIC_IS_TEST=true`（build arg，显示测试服标识）、`FORCE_INSECURE_AUTH_COOKIE=true`、`NEXT_PUBLIC_PRIMARY_BASE_URL`+`NEXT_PUBLIC_UPLOAD_BASE_URL`=`https://staging-static.venusface.com`、`ALI_SYNC_DEST_ROOT=/var/www/flashmuse-static-test/generated`。⚠️ 拼参考图 URL 的 base 优先用 `NEXT_PUBLIC_PRIMARY_BASE_URL`。

### 测试服部署流程（"部署掉"走这个）
1. 本地 `node scripts/bump-version.mjs`（版本号+1，改中文源码用 edit 工具）；`npx tsc --noEmit` 通过。
2. 打**改动源码** tgz（含 `src/lib/app-version.ts`），scp 到腾讯 `/tmp` → `sudo tar -xzf -C /opt/flashmuse-staging/app`。
3. `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（**后台+轮询 `tail /tmp/sb.log` 防 120s 工具超时**，build~2.5min；entrypoint 自动 migrate deploy）。此时 compose 里 `PUBLISHED_APP_VERSION` 仍是上一版（或空）→ 新版本提示条**不会**中途误弹。
4. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`（同步 `_next/static`+`home-assets`+`generated` 到阿里测试镜像，否则 chunk 404）。
5. ⭐ **发布版本信号（提示条门控，静态同步完成后才做）**：sed 改 `/opt/flashmuse-staging/docker-compose.yml` 的 `PUBLISHED_APP_VERSION: "vX"` 为本次新版 + `sudo docker compose up -d --force-recreate staging-app`（复用镜像、快）。这样"提示条弹出=静态已就绪"，用户点刷新必正常、不白屏。（sed 含引号→写 .sh scp + `sed -i 's/\r$//'` 再 bash。）
6. 验证：`curl -D - http://127.0.0.1:5001/api/models | grep x-app-version`（=新版）+ `curl http://127.0.0.1:5001/`（版本号变了）+ 外网 `http://101.37.129.164:8080/` 200。
7. ⭐⭐ **必做：上号跑一遍上面「部署铁律」里的最小巡检 6 项**。崩了立刻修，别往正式服推。

## 正式服（腾讯）部署流程（仅当用户明确说"部署正式服"）

1. **先**完整部署测试服（含版本号自增）并验证 OK。确认测试服/正式服版本差、是否有新迁移。
2. **备份**：`sudo cp -r /opt/flashmuse/app /opt/flashmuse/app-backups/<ts>-presync-vXX`（⚠️ ssh 内联里的 `$(date ...)` 会被 PowerShell 吃掉→写进 .sh 里跑）。
3. **整份对齐**（测试服→正式服，服务器到服务器 rsync，**不再 bump**）：
   ```
   sudo rsync -a --delete --exclude node_modules --exclude .next --exclude tmp --exclude '*.log' --exclude .git --exclude .env.local --exclude .runtime /opt/flashmuse-staging/app/ /opt/flashmuse/app/
   ```
   （排除 .env.local 因两服 env 独立；docker-compose.yml/Dockerfile 两服在各自父目录，`/app` 内一致。）
4. **重建**：`cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app > /tmp/prodbuild.log 2>&1 &`（后台+轮询；有新迁移时 entrypoint 自动 `migrate deploy`，可 `docker logs` 查 "migrations have been applied"）。
5. **必须：同步 `.next/static` 到阿里正式镜像**（否则 chunk 哈希不匹配、`/_next/static` 全 404、页面崩）——写成 `/tmp/syncali.sh`（重启会清、需重建）：
   ```
   sudo rm -rf /tmp/next-static
   sudo docker cp flashmuse-flashmuse-app-1:/app/.next/static /tmp/next-static
   sudo rsync -a --delete -e 'ssh -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 -o StrictHostKeyChecking=no' /tmp/next-static/ root@101.37.129.164:/var/www/flashmuse-static/_next/static/
   ```
   （目标是**正式**镜像 `flashmuse-static`，**不是** test 那个 `flashmuse-static-test`。曾有 `docker cp` 到已存在目录嵌套 `static/static` 的 bug → 已用 `rm -rf` 前置修掉。）
6. **健康检查**：四域名 200。写成 `/tmp/health.sh`：循环 `curl -s -o /dev/null -w '%{http_code}' https://{main,api,ali,static}.venusface.com/`。
6.5. ⭐ **发布版本信号（提示条门控，同测试服）**：正式 compose `/opt/flashmuse/docker-compose.yml` 也需有 `PUBLISHED_APP_VERSION: ""` 环境变量行（首次上此功能要手动加，位置同测试服 DATABASE_URL 行后）。**静态同步阿里正式镜像（第5步）完成后**，sed 改成本次新版 + `sudo docker compose up -d --force-recreate flashmuse-app`。保证正式服提示条弹出时静态已就绪、刷新不白屏。
7. **env 数据**：`UPLOAD_RULE_OVERRIDES` 等是正式服独立 env（`/opt/flashmuse/data/.env.local`），不随代码同步；需要时手改 + `docker compose up -d --force-recreate flashmuse-app`。
8. commit + push GitHub（保持四方同步）。
9. ⭐⭐ **必做：正式服也要上号跑一遍最小巡检 6 项**（正式服崩了直接影响真实用户）。
   **崩了立刻修**：能马上改就改（走"先测试服再正式服"顺序），修不了就用 `/opt/flashmuse/app-backups/<ts>-presync-vXX`
   回滚 `/opt/flashmuse/app` → `up -d --build flashmuse-app` → 重新同步 `.next/static` 到阿里正式镜像 → `PUBLISHED_APP_VERSION` 改回旧版。

### ⭐ v1.0.0.55（2026-07-30 第十九次会话）新增的三条部署经验

1. ⭐⭐ **带 Prisma 迁移的批次怎么确认迁移真跑了**：`up -d --build` 之后去
   `sudo docker logs --tail 30 <app容器>` 看 entrypoint 那段，必须出现
   `Applying migration \`xxx\`` + `All migrations have been successfully applied.`
   （没迁移的批次只会输出 "No pending migrations"）。**两台都要看。**
2. ⛔ **`ssh "... nohup ... &"` 这种内联后台命令会把 ssh 会话挂住** → 工具 120s 超时（本次踩过）。
   正确姿势：`ssh "... & sleep 3; echo started"` 起完就断开，**然后另起一条 ssh 去 `tail` 日志轮询**。
3. ⭐ **打 tgz 用文件清单法**，别手写一长串 tar 参数：把路径写进 `.runtime/vXX-files.txt`
   （每行一个，目录直接写目录名），然后 `tar -czf .runtime/vXX.tgz -T .runtime/vXX-files.txt`；
   打完必须 `tar -tzf` grep 一遍**新增目录**是否真在包里（漏了新目录 = 上线当场 404/崩）。

## 关键踩坑与记忆

- **PowerShell 坑**：ssh 内联含 `$(...)`/`%{}`/中文/嵌套引号会被本地 PS 先解释坏（备份目录名丢时间戳=踩过）→ 一律写本地 `.sh`/`.sql`/`.js`，scp `/tmp`，`sed -i 's/\r$//'` 后 `bash`/`psql -f`/`node`。改中文源码禁 `Set-Content`（mojibake）。
- **一次性 node 脚本**必须放进容器 `/app` 里跑（`sudo docker cp x.js 容器:/app/ && sudo docker exec -w /app 容器 node x.js`）才找得到 `@prisma/client`。
- **DB heredoc SQL 用 `docker exec -i`**；含中文 SQL 写 .sql scp + `docker cp` + `psql -f`。腾讯→阿里跳板：`sudo ssh -o StrictHostKeyChecking=no -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 root@101.37.129.164 '...'`。
- **部署窗口旧标签 ChunkLoadError** 是固有现象（跨部署窗口），硬刷即可，非 bug。
- 备份都在 `/opt/flashmuse/app-backups/<ts>-...`。
- **只改 nginx**：腾讯 nginx 配置在 `/opt/flashmuse/data/nginx/flashmuse.conf`（容器 flashmuse-nginx）；阿里 `/etc/nginx/sites-enabled/`。改前备份→`nginx -t`→reload。腾讯 main/api 证书走 acme.sh tls-alpn-01（443），cron 自动续。当前正式 nginx `client_max_body_size` 历史为 20m；上传大视频（200MB 规则）若上线需先调网关 body size + 超时（用户交代部署前评估）。

## ⭐ 部署辅助脚本套装（2026-07-29 v52 全程用这四个跑通，照抄即可）

⛔ **为什么必须写成 .sh**：PowerShell 会先解释掉 ssh 内联里的 `$(...)`、引号、中文 → 备份目录名丢时间戳这类坑踩过。
一律：本地写 `.sh` → `scp` 到 `/tmp` → `ssh "sed -i 's/\r$//' /tmp/x.sh && sudo bash /tmp/x.sh"`。

| 脚本（本次放在本地 `.runtime/`，不进 git） | 内容 |
|---|---|
| **测试服发布信号** | `sed -i 's/PUBLISHED_APP_VERSION: ".*"/…: "vX"/' /opt/flashmuse-staging/docker-compose.yml` → `cd … && docker compose up -d --force-recreate staging-app` → `curl -s -D - -o /dev/null http://127.0.0.1:5001/api/models \| grep -i x-app-version` |
| **正式服备份 + 对齐** | `TS=$(date +%Y%m%d-%H%M%S)`；`cp -r /opt/flashmuse/app "/opt/flashmuse/app-backups/${TS}-presync-vX"`；然后 staging→prod 的 rsync（参数见上一节第 3 步）；最后 `grep APP_VERSION` 确认 |
| **正式服静态同步阿里** | `rm -rf /tmp/next-static` → `docker cp flashmuse-flashmuse-app-1:/app/.next/static /tmp/next-static` → rsync 到 `root@101.37.129.164:/var/www/flashmuse-static/_next/static/`（⚠️ **正式**镜像，不是 `-test`） |
| **正式服发布信号 + 健康检查** | sed 改 `/opt/flashmuse/docker-compose.yml` → `force-recreate flashmuse-app` → 验版本头（端口 **5000**）→ 四域名 curl |

⭐ **服务器上 `/tmp/health.sh` 是上一批会话留的、还在**：`sudo bash /tmp/health.sh` 直接打四域名状态码，不用重写。
⭐ **build 要后台跑 + 轮询**（防 120s 工具超时）：`nohup sudo docker compose up -d --build <svc> > /tmp/xx.log 2>&1 &`，
然后 `Start-Sleep` + `tail /tmp/xx.log`。v52 实测：测试服/正式服各约 2 分钟（依赖层全 CACHED 时更快）。

### ⭐⭐ v1.0.0.54 实跑的那一整套（2026-07-29 第十七次会话，命令级留档，下次照抄）

本地脚本都放在 `.runtime/`（不进 git）。**顺序不能乱**，尤其"静态同步完才发布版本信号"。

| # | 本地文件 | 干什么 |
|---|---|---|
| 0 | — | `node scripts/bump-version.mjs`（v53→v54）+ `npx tsc --noEmit` |
| 1 | `v54.tgz` | `tar -czf` 打**改动的源码 + `src/lib/app-version.ts` + `scripts/*`** → scp `/tmp` → `sudo tar -xzf /tmp/v54.tgz -C /opt/flashmuse-staging/app` |
| 2 | — | `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（本次约 90 秒） |
| 3 | — | `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`（打印 `staging ali sync done`） |
| 4 | `pub54.sh` | 测试服发布信号：sed `PUBLISHED_APP_VERSION` → `up -d --force-recreate staging-app` → 验 `x-app-version` |
| 5 | — | **上号巡检 6 项**（见上面「部署铁律」） |
| 6 | `prodsync54.sh` | 正式服：`cp -r` 备份到 `app-backups/${TS}-presync-vX` → staging→prod rsync → `grep APP_VERSION` 复核 |
| 7 | — | `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app > /tmp/prodbuild54.log 2>&1 &` |
| 8 | `syncali54.sh` | `docker cp .next/static` → rsync 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/` |
| 9 | `pub54prod.sh` | 正式服发布信号 + 验版本头（端口 **5000**）+ 四域名 curl |
| 10 | — | **正式服也上号巡检 6 项** |
| 11 | `checktrack.sh` | grep 部署后要观察的跟踪点事件计数（本批是上传即转正 4 条 + 压缩 3 条 + 视频轮询 2 条） |

**本次实测耗时**：测试服 build ~90s、正式服 build ~100s，全程（含两轮实机巡检 + 真跑生图生视频）约 1 小时。

⭐ **部署是热的、线上有真实用户在跑任务**：本次正式服刚起来时 `docker logs` 里就有别的用户
（`ID_315163`）的视频在存盘。所以 **`up -d --build` 的窗口要尽量短、别在高峰反复 recreate**。

⭐ **验"新代码到底上去没有"的两个不同判据**（别搞混）：
- `up --build` 之后 → 看 **HTML 里的版本号**（`curl -s http://127.0.0.1:5001/ | grep -o 'v1\.0\.0\.[0-9]*'`）；
- 最后一步 sed + force-recreate 之后 → 才看 **`x-app-version` 响应头**（它发的是运行时 env `PUBLISHED_APP_VERSION`）。

### ⭐⭐ 巡检/测试用哪个号（2026-07-31 用户拍板，⛔ 别再看旧口径）

🗣️ **用户原话意思**：「以后本地，测试服和正式服都用 `12424740@qq.com` 这个号测试，这个记录清楚让后面的 AI 不要弄错。」

- **本地 / 测试服 / 正式服，一律用 `12424740@qq.com`**（密码 `dragonstar`，三个库里都有这个号；
  测试服 ID_535317）。它是**普通用户**，正好也最接近真实用户视角。
- ⛔⛔ **禁止再用 `lookxun@163.com` 做前台巡检 / 真跑生图生视频** —— 那是**用户自己的号**，
  在上面加节点、烧积分 = 动用户的数据和钱。它**只**用于"必须管理员权限"的场合（登后台 `/admin` 看页面）。
- ⭐ **测试内容不要删**（用户长期交代）→ 要做会留痕的实验，**新建一个工作流/对话**来做，别动现有的。
- ⚠️ 正式服真跑生成会花真钱，这是"部署完必须真上号验一遍"的必要成本（用户已认可），
  但**必须花在测试号上、且在交接文档里写清留下了什么痕迹**。

**已知留在正式服 `lookxun@163.com` 上的测试痕迹（2026-07-31，下一任别当成用户自己的数据）**：
`工作流_01` 从 3 个节点变成 5 个（多了 `image_3_w1` 一杯咖啡 + `video_1_w1` 白猫打滚），共扣 47 积分。
用户没让删，先留着；要删只删这两个节点。


## GitHub

- 仓库 `https://github.com/lookxun/FlashMuse_Agent`，本地 origin 已指向它，identity `lookxun <lookxun@users.noreply.github.com>`。`gh` CLI 未安装。
- `.env`/`.env.local`/密钥/密码/签名 URL **绝不进 Git 和交接文档**。
