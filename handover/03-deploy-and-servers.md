# Deploy And Servers（2026-07-21 重建，改代码/部署必读）

## 🗄️🗄️ 数据库备份（2026-08-02 建立）—— 部署前必看

**完整用法 / 紧急恢复步骤 / 9 条踩过的坑 → `deploy/backup/README.md`。**

- 每天**北京时间 03:30** 自动备份正式服 + 测试服（含各自 `.env.local`）→
  腾讯 `/opt/flashmuse/backups/` + **异地阿里 `/opt/flashmuse-backups/`**。
  正式 8.2MB / 测试 0.33MB，全程约 36 秒。cron 在 `/etc/cron.d/flashmuse-db-backup`。
- **每周一北京时间 04:10 自动做一次恢复演练**（恢复到临时库比对行数再删掉，**不碰正式库**）。
- 日常只看：`sudo cat /opt/flashmuse/backups/last-status.txt`（`OK` / `OK_LOCAL_ONLY` / `FAILED`）。
  ⚠️ **本机没装 MTA，cron 发不出邮件** → 不会有失败通知，只能靠这个文件和 `backup.log`。
- ⛔ **媒体（`generated`，21GB）还没纳入备份**（2026-08-02 用户说"单独议"）。

### ⭐⭐ 部署前必做（任何带新 Prisma 迁移的批次）

`docker-entrypoint.sh` 在容器启动时会自动 `prisma migrate deploy`，**而迁移是单向的** ——
代码能回滚，库迁上去了回不来；而本文档下面写的回滚办法（还原旧 `app/` + 重建）
**对带迁移的批次其实是不安全的**（代码退回旧版、库还停在新 schema）。所以动手前先跑一次：

```bash
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh --stack prod --label pre-deploy
```

（判断有没有新迁移：比对 `prisma/migrations/` 目录数与服务器上 `_prisma_migrations` 表行数。）

## 服务器全景（当前）

- **腾讯云新加坡 `119.28.116.16`（主服务器，跑 app）**：Ubuntu 24.04，用户 `ubuntu`（免密 sudo）。Docker 栈。**真正跑 FlashMuse app 的就是这台。**
  - ⚠️ 这台是**多项目共宿主机**（还有 CinematicFlow `/opt/PS-`、VibeSocial `/home/ubuntu/VibeSocial`），**绝不能影响其它项目**。宿主 80(vibesocial-nginx)/3000/5432/8000/8001 已被占。FlashMuse 用宿主 **5000**（正式）、**5001**（测试），独立 docker 网络。没有腾讯云 API 密钥（安全组只能用已开端口）。
  - ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（源 pem `E:\project\【2】server\腾讯云_新加坡服务器\CinematicFlow.pem`；权限太开放要先复制到 temp + `icacls` 收紧再用）。docker 命令一律加 `sudo`。
- **阿里 `101.37.129.164`（国内入口 + 静态镜像 + 反代回腾讯）**：nginx。`/_next/static`、`/home-assets`、`/generated` 走阿里本地镜像；动态/API 全 `proxy_pass → 119.28.116.16:5000`。**架构认知**：走 ali 的动态请求要多一跳跨境回腾讯新加坡；对直连新加坡线路好的用户，ali 反而更慢。ali 不是国内 app 服务器。
- **马来西亚 `101.47.19.109`**：已彻底退出链路（app 早停、DNS 不指它）。归档文档里的"马来 PM2 部署流程"全部过时，别用。

- **DNS**：`main`/`api`.venusface.com → 腾讯 119.28.116.16（腾讯 nginx 443 直接 SSL 终止）；`ali`/`static` → 阿里。
- **公网域名**：`https://main.venusface.com`、`https://api.venusface.com`、`https://ali.venusface.com`、`https://static.venusface.com`。

## ⭐⭐ 入口架构：测试服和正式服**不一样**（2026-08-01 实测核实，用户专门问过）

🗣️ 用户问：「难道测试服和正式服不一样吗？正式服是直连腾讯的？」→ **是的。**

| 域名 | DNS 实测指向 | 是谁 |
|---|---|---|
| `main.venusface.com` | `119.28.116.16` | **腾讯新加坡直连**（443 在腾讯终止 SSL） |
| `api.venusface.com` | `119.28.116.16` | **腾讯新加坡直连** |
| `ali.venusface.com` | `101.37.129.164` | 阿里 → 反代回腾讯:5000 |
| `static.venusface.com` | `101.37.129.164` | 阿里静态镜像 |
| `staging-static.venusface.com` / `:8080` | `101.37.129.164` | **阿里** → 反代回腾讯:5001（**测试服只有这一个入口**） |

- ⭐ `next.config.ts` **没有 `assetPrefix`**，且 `main.venusface.com` 的 HTML 里 `_next/static` **全是相对路径**
  （0 处指向 `static.venusface.com`）→ **正式服主入口连静态资源都是腾讯直发**；阿里那份静态镜像只服务走 ali/static 的人。
- ✅✅ **2026-08-01 已修：阿里那两个入口都加了「回源长连接复用（upstream keepalive）」**（原 M027，已完成）。
  改前 ali 中位 1.64s → 改后 **0.37s**；测试服 1.62s → **0.30s**。`connect` 从 1.3s → 0.00008s。
  **仓库权威副本**：`deploy/staging/flashmuse-test-8080.conf`、`deploy/staging/flashmuse-staging-static-ssl.conf`、
  `deploy/ali/ali-add-upstream-keepalive.py`（正式服那份混着别的项目，只能用这个增量脚本）。
  ⭐ 完整原理 / 踩坑 / 备份位置 → `06-memo-tasks.md` 的 **M027**。
- ⭐⭐ **「走阿里为什么曾经比直连腾讯慢 10 倍」的正确解释**（🗣️ 用户追问过两轮，别再答错）：
  **不是"多一跳"**，是三条叠加 —— ① 换了一条更烂的跨境路（阿里→腾讯 RTT 255ms、**丢包 33.3%**，
  而正常国内到新加坡只需 50~80ms）；② ⭐ **连接复用**（浏览器直连会自己复用、一个页面只握手 1 次，
  而阿里回源那段当时每请求都重新握手）；③ **SYN 阶段没有快速重传**，丢包只能 RTO 翻倍等
  （0.25→1.27→3.2→11.4s）= "忽快忽慢、偶尔卡死几十秒"的来源。
- ⛔⛔ **量这类性能必须站在「阿里本机」测，别站在腾讯 curl 阿里**（那等于跨境跑两趟、数字全污染，踩过）。
  用户→阿里那段本来就快（本地静态实测 0.005s），**唯一变量是"阿里→腾讯"这一跳**。
- ⛔⛔ **「测试服和正式服关键的东西必须一样」（🗣️ 2026-08-01 用户拍板）**：
  曾提过"测试服入口绕开阿里直连 `119.28.116.16:5001`"的方案，**已被用户否掉、以后别再提** ——
  那会让两服入口架构不一致，**测试服测好的东西到正式服就不作数了**。
  ⭐ 一切基础设施优化都要**两服都做**。（`http://119.28.116.16:5001/` 仍可用于**临时排查**、排除链路噪声，但不能当入口。）

- ⚠️⚠️ **所以「测试服慢」不代表「正式服慢」**：同一个 `/api/models` 从国内实测 4 次 ——
  `main` **614 / 210 / 216 / 211ms（稳）**；`ali.venusface.com` 687 / 652 / **1685** / 597ms；
  测试服 `:8080` 1740 / 582 / **4739** / 1475ms；**测试服绕开阿里直连 `119.28.116.16:5001` = 385 / 166 / 330ms**。
- ⭐ 根因（跨境丢包 25~37% + 阿里 nginx 缺 upstream keepalive）→ **`06-memo-tasks.md` 的 M027（2026-08-01 已修完）**。
  ✅ 修完后的实测：`ali` 中位 **0.37s**、测试服 **0.30s**。⛔ 残留偶发 1.0~1.5s 毛刺（丢包 33% 导致的数据重传），属方案 C（花钱）。
- ⭐ **调试建议**：要排除链路噪声地验测试服，可直接打 **`http://119.28.116.16:5001/`**（端口已开、实测 200）。
  ⛔ **但它只能用于临时排查，不能当测试服入口**（见上面那条「两服必须一样」的铁律）。


## 正式服（腾讯）目录与容器

- 部署位置 `/opt/flashmuse/`：`app/`（源码含 Dockerfile）+ `docker-compose.yml` + `data/{.env.local, generated, runtime(=.runtime), pgdata, home-assets, nginx/flashmuse.conf}`。独立网络 `flashmuse_default`。
- 容器：`flashmuse-flashmuse-app-1`（build ./app，expose 3000，entrypoint=`prisma migrate deploy` + `npm run start`）、`flashmuse-flashmuse-db-1`（postgres，不暴露宿主端口，`psql -U flashmuse -d flashmuse`）、`flashmuse-flashmuse-nginx-1`（宿主 443:443 + 5000:80，SSL 终止 main/api + serve `/generated`、`/home-assets` + 反代 app:3000）。
- ⚠️ **为什么必须有 nginx 容器**：`next start` 只服务构建时已存在于 `public/` 的静态文件，`/generated/*` 会 404，必须 nginx 服务。
- `.env.local` 是**可写状态文件**（后台"模型开关/系统设置/上传规则"保存会改写它、API key 运行时从它读），bind-mount、重启不丢。**env 是每台服务器独立数据、不随代码同步**（如 `UPLOAD_RULE_OVERRIDES`）。
- 阿里同步密钥：`/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519`（**root 属主，一切到阿里的 ssh/rsync 必须 sudo**）。
- ⭐ **DB 密码 2026-08-02 已轮换**（旧串已失效，历史文档里的 `REMOVED_PROD_DB_PASSWORD` 就是它）。
  连接姿势：`docker exec -e PGPASSWORD=<新串> flashmuse-flashmuse-db-1 psql -U flashmuse -d flashmuse`。
  ⚠️ **容器内 local/127.0.0.1 是 pg_hba `trust`，任何密码都能连** —— 验证密码对不对必须走 TCP
  （`psql -h <容器IP>`，走 `scram-sha-256`）；容器内直连"能连上"不能证明密码正确。

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

## ⭐⭐ 部署前「自己审自己」清单（2026-08-02 建立，**动手部署前逐条走一遍**）

> 背景：2026-08-02 用户临时试过一轮「双 AI」（一个写代码、一个只做审计），
> 那一轮**审计方在已经"自查通过"的代码里又挑出 6 个问题**（含 1 个会让验收结果失真的漏项、
> 1 个名字写错会静默无效的配置、2 次错误的根因归因）。
> 🗣️ 用户之后决定**回到单 AI**（`09-ai-review-channel.md` 已归纳进各文档并删除），
> 所以**这份清单就是那套审计手法的留存** —— 现在由你一个人扮演两个角色：
> **写完之后，换个身份把自己的改动当成"别人交上来的东西"再审一遍。**

### 一、先把"改了什么"摊开（别凭记忆）

- `git status --short` + `git diff --stat`：⭐ **把文档/nginx 和业务代码分开算**。
  （那轮 18 个文件听起来吓人，其实 `src` 只占 9 个约 200 行 —— 分开算才知道审多久。）
- ⛔ **"我动过哪些文件"一律以 `git status` 实际输出为准**，别凭记忆列。
  踩过：测试截图 png 落在**项目根目录**（`.gitignore` 只忽略 `.runtime/`，不忽略根目录 png）→
  差点被 `git add -A` 提进仓库，还一直干扰 `git status` 的判读。
  ⭐ 一次性产物一律放 `.runtime/` 下（已被忽略）。

### 二、逐条自问（这几问每次都能抓到东西）

1. **新加的校验/白名单，会不会误伤别的调用方？**
   ⛔ 别只读被改的那个函数，**去 grep 全部调用点**。
   例：给"文档上传"加后缀白名单时，必须确认视频/音频/图片走的是别的分支或别的接口
   （靠 `grep uploadDocumentFileAsset(` 找到 3 个调用点、逐个确认 `mediaKind` 必传才敢放行）。
2. **接口新加了 401/403，前端拿到之后会不会把用户踢下线？**
   本项目有统一的 `handleSessionExpiredResponse`（`src/lib/session-expired-redirect.ts`）——
   **调它 = 直接跳首页；不调 = 静默忽略**。去看那个调用方到底调没调。
3. **新加的 `throw` 最终落进哪个 `catch`？会不会变成静默成功、或多出一句新文案？**
   例：给 curl 兜底加"空 body 当失败"时，要确认那个 `throw` 落进**原有**的 catch
   并复用**现成**文案（`保存${图片/视频}失败：${status}`），而不是新造一条错误路径。
4. **这个改动在"下行瘦身/整体覆盖"的链路上吗？** 是就必须配字段恢复（见 AGENTS.md 那条铁律）。
5. **配置项的名字，是我从错误信息里抄的，还是从随包文档里查的？**（见 AGENTS.md 的 Next 配置铁律。）
6. **我报的"根因"，判据条件抄出来逐项验过了吗？**（见 AGENTS.md 那条最贵的铁律。）

### 三、验证要挑"没有解释空间"的做法

- ⭐ **优先测编译产物 / 数据库真值，而不是"curl 几个接口看着对"**。
  例：改 middleware matcher → 去读 `.next/server/middleware-manifest.json` 里的正则，
  用 node 批量跑十几个路径（**必须含嵌套多段路由**）。
- ⭐ **设计成二值判断**。例：验"60 秒节流生效了吗" → 换到不发心跳的 `/terms` 页连打 15 次，
  看 `lastSeenAt` 变没变（变/不变，没有中间态）。
- ⭐ **验"上限终于生效"要用"超上限被明确拒"来证**，而不是"没超的能过"。
  例：Next body 上限修好后，传 206MB 视频拿到 **400 `视频不能超过 200MB`**（不是 500）——
  这一条同时证明了 body 完整穿过、应用校验拿到了完整 body、且不是 nginx 拦的。
- ⚠️ **用 curl 测 multipart 上传必须显式写 `type=`**（如 `-F "file=@x.mp4;type=video/mp4"`），
  否则 part 的 MIME 是 `application/octet-stream`，会被"后缀 + MIME 双判"的校验拒掉
  （`media-upload-validation.ts:33`）→ **测出来是假失败**。浏览器永远带真实 MIME。
- ⚠️ **在服务器本机自测带登录态的接口，用公网 IP/域名，别用 `127.0.0.1`**（会话校验对 Host 敏感，见下节）。

### 四、留痕与账目（每次部署都要记）

- 正式服/测试服**各自**留下了什么（新建的工作流名、生成物系统名、扣了多少积分）→ 写进 `01` 和 `CHANGELOG`。
  ⭐ 用户交代**测试内容不要删**，所以要留痕就得记清楚，否则下一个人会把它当成用户数据。
- 一次性探针（如为验 `attachment` 头临时放的 `.html`）**验完就删**，别留在 `/generated/` 里。

---

## 测试服（staging）

- **入口**：`http://101.37.129.164:8080/`（阿里，IP）或 `https://staging-static.venusface.com/`（阿里 DNS + Let's Encrypt 443）；后台 `/admin`。
- **架构**：腾讯 `/opt/flashmuse-staging/` 独立 Docker 栈（容器 `flashmuse-staging-staging-{app,db,nginx}-1`，宿主 5001）+ 阿里 `/var/www/flashmuse-static-test/` 独立镜像（nginx 8080）+ 独立 ali-sync（2026-08-02 起统一为 `deploy/sync-ali.sh --stack=staging`）。测试库独立、`staging-db`，`psql -U flashmuse -d flashmuse`。
- **测试账号（明文；密码都 `dragonstar`；登录页选"密码登录"→填邮箱点"提交邮箱"→填密码）**：
  - ⭐⭐ **`12424740@qq.com`（主测试号，普通用户 ID_535317）—— 一切测试只用它**（本地/测试服/正式服都有这个号）。
  - `lookxun@163.com`（白名单/管理员 ID_176407）、`176107103@qq.com`（白名单）——
    ⛔ **只用于登后台 `/admin`**，禁止在上面做前台测试/生成（`lookxun@163.com` 是**用户自己的号**）。
  - 白名单走 env `ADMIN_EMAILS`。**测试内容不要删**（用户交代）。
- 测试服 env 差异（`/opt/flashmuse-staging/data/.env.local`）：`NEXT_PUBLIC_IS_TEST=true`（build arg，显示测试服标识）、`FORCE_INSECURE_AUTH_COOKIE=true`、`NEXT_PUBLIC_PRIMARY_BASE_URL`+`NEXT_PUBLIC_UPLOAD_BASE_URL`=`https://staging-static.venusface.com`、`ALI_SYNC_DEST_ROOT=/var/www/flashmuse-static-test/generated`。⚠️ 拼参考图 URL 的 base 优先用 `NEXT_PUBLIC_PRIMARY_BASE_URL`。

### 测试服部署流程（"部署掉"走这个）

> ⭐⭐ **2026-08-02（v63 批）起本流程有 5 处变化，先看这一节再照老步骤走**：
>
> 1. **compose 文件不在 tgz 覆盖范围**：源码解到 `/opt/flashmuse-staging/app/`，而 compose 在
>    `/opt/flashmuse-staging/docker-compose.yml`（引用 `./app` 为 build context）——
>    **改了 compose 的批次必须单独 `sudo cp app/deploy/staging/docker-compose.yml /opt/flashmuse-staging/`**
>    （正式服同理：`app/docker-compose.yml` → `/opt/flashmuse/`）。v63 第一次忘 cp，app 拿旧密码连库 P1000。
> 2. **数据库密码已从 compose 挪到 `.env`**（不进 git）：compose 里是 `${FLASHMUSE_DB_PASSWORD:?}` /
>    `${FLASHMUSE_STAGING_DB_PASSWORD:?}`，**服务器上 `/opt/flashmuse/.env` 与 `/opt/flashmuse-staging/.env`
>    必须有对应变量**（compose 自动读项目目录 `.env`）。v63 测试服已换新密码（ALTER USER + .env）。
>    ⛔ 换密码的顺序：先 `ALTER USER` → 写 `.env` → `docker compose up -d`。
> 3. **Dockerfile 改非 root（node uid 1000）运行**：部署前必须
>    `sudo chown -R 1000:1000 data/{generated,runtime,home-assets}` + `chown 1000:1000 data/.env.local`
>    （⛔ pgdata 不动，那是 postgres 容器自己的）。healthcheck 用 **curl**（bookworm-slim 没有 wget）。
> 4. **阿里同步脚本统一为 `deploy/sync-ali.sh`**（在 `/opt/flashmuse*/app/deploy/` 下，
>    替代了 sync-ali-test.sh / sync-flashmuse-next-static.sh / 手写 /tmp/syncali.sh）：
>    测试服 `sudo bash /opt/flashmuse-staging/app/deploy/sync-ali.sh --stack=staging --with-generated`；
>    正式服 `--stack=prod`（⛔ 不带 --with-generated，21GB 走应用 ali-sync）。
>    ⚠️ scp/tar 上去的 shell 脚本先 `sed -i 's/\r$//'`（Windows 行尾，`set: pipefail: invalid option` 就是这事）。
> 5. ⭐ **阿里 nginx 的备份文件别放 `/etc/nginx/sites-enabled/`**（`.bak` 也会被 include →
>    `duplicate upstream` 整台起不来），备份放 `/root/`。
>
> 另：`PUBLISHED_APP_VERSION` 现在从 `.env` 读（compose 里 `${PUBLISHED_APP_VERSION:-}`），
> 发版本信号 = 往 `.env` 追加/改 `PUBLISHED_APP_VERSION=vX` + `up -d --force-recreate staging-app`。
> 还有 `GET /api/health`（无登录、查库）可给 compose healthcheck / 外部拨测用。

1. 本地 `node scripts/bump-version.mjs`（版本号+1，改中文源码用 edit 工具）；`npx tsc --noEmit` 通过。
2. 打**改动源码** tgz（含 `src/lib/app-version.ts`），scp 到腾讯 `/tmp` → `sudo tar -xzf -C /opt/flashmuse-staging/app`。
3. `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（**后台+轮询 `tail /tmp/sb.log` 防 120s 工具超时**，build~2.5min；entrypoint 自动 migrate deploy）。此时 compose 里 `PUBLISHED_APP_VERSION` 仍是上一版（或空）→ 新版本提示条**不会**中途误弹。
4. `sudo bash /opt/flashmuse-staging/app/deploy/sync-ali.sh --stack=staging --with-generated`（同步 `_next/static`+`home-assets`+`generated` 到阿里测试镜像，否则 chunk 404）。
   - ⛔ **这一步可能超过工具 120s（甚至 180s）**：⭐ 用 `nohup ... > /tmp/syncaliXX.log 2>&1 &` 后台跑 + 另起 ssh 轮询 `tail`，**别同步等**。同步等会让本地 ssh 超时断开、把远端进程 SIGHUP 掉，还**留下一个 `/tmp/flashmuse-sync-ali-staging.lock` 死锁**（下次跑会报 `another sync ... is running`）→ 先 `sudo rm -f /tmp/flashmuse-sync-ali-staging.lock` 再重跑。
5. ⭐ **发布版本信号（提示条门控，静态同步完成后才做）**：往 `/opt/flashmuse-staging/.env` 追加/改 `PUBLISHED_APP_VERSION=vX` + `sudo docker compose up -d --force-recreate staging-app`（复用镜像、快）。这样"提示条弹出=静态已就绪"，用户点刷新必正常、不白屏。
   - ⛔ **`.env` 是 root 属主**：`grep`/`sed` 都要 `sudo`，否则 `Permission denied`。用 `grep -q ... || echo >> ` 这种「查不到就追加」的写法时，**非 sudo 的 grep 会因权限失败而误触发追加分支** → 每次部署都多写一行。
   - ⛔ **实测发现 `.env` 里已累积了 4 行 `PUBLISHED_APP_VERSION=`（v66/67/68/69）**：compose 读 `.env` 是**最后一行生效**，所以功能没坏，但很脏。⭐ 正确写法一步到位：`sudo sed -i '/^PUBLISHED_APP_VERSION=/d' .env && echo 'PUBLISHED_APP_VERSION=vX' | sudo tee -a .env`（先删光同名行再追加一行）。改完 `sudo grep -n PUBLISHED_APP_VERSION .env` 确认只剩 1 行。
6. 验证：`curl -D - http://127.0.0.1:5001/api/models | grep x-app-version`（=新版）+ `curl http://127.0.0.1:5001/api/health`（`{"ok":true,...}`）+ 外网 `http://101.37.129.164:8080/` 200。
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

- ⭐⭐ **在服务器本机自测接口"莫名 401"，先换 Host 再怀疑代码**（2026-08-02 实测）：
  `curl 127.0.0.1:5001/api/auth/me` 带有效 session cookie 返回 `{"user":null}`（未登录），
  而 `curl 119.28.116.16:5001/api/auth/me` 带同一个 cookie 就正常返回用户 ——
  **本项目的会话校验对 Host 敏感**。在服务器本机自测带登录态的接口，一律用公网 IP/域名，别用 127.0.0.1。
- ⭐ **部署里要推测试服 nginx 时，是 3 份不是 2 份**（2026-08-02 踩过）：
  ① 阿里 `flashmuse-test-8080` ② 阿里 `flashmuse-staging-static-ssl`（写 `sites-available` 那端）
  ③ **腾讯容器内** `/opt/flashmuse-staging/data/nginx/flashmuse-staging.conf`（bind-mount 进 staging-nginx）。
  漏了 ③ = 容器层没生效，而测试服恰恰是验收的地方 → 会验出假结果。
- **PowerShell 坑**：ssh 内联含 `$(...)`/`%{}`/中文/嵌套引号会被本地 PS 先解释坏（备份目录名丢时间戳=踩过）→ 一律写本地 `.sh`/`.sql`/`.js`，scp `/tmp`，`sed -i 's/\r$//'` 后 `bash`/`psql -f`/`node`。改中文源码禁 `Set-Content`（mojibake）。
- **一次性 node 脚本**必须放进容器 `/app` 里跑（`sudo docker cp x.js 容器:/app/ && sudo docker exec -w /app 容器 node x.js`）才找得到 `@prisma/client`。
- **DB heredoc SQL 用 `docker exec -i`**；含中文 SQL 写 .sql scp + `docker cp` + `psql -f`。腾讯→阿里跳板：`sudo ssh -o StrictHostKeyChecking=no -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 root@101.37.129.164 '...'`。
- **部署窗口旧标签 ChunkLoadError** 是固有现象（跨部署窗口），硬刷即可，非 bug。
- 备份都在 `/opt/flashmuse/app-backups/<ts>-...`。
- **只改 nginx**：腾讯 nginx 配置在 `/opt/flashmuse/data/nginx/flashmuse.conf`（容器 flashmuse-nginx）；阿里 `/etc/nginx/sites-enabled/`。改前备份→`nginx -t`→reload。腾讯 main/api 证书走 acme.sh tls-alpn-01（443），cron 自动续。当前正式 nginx `client_max_body_size` 历史为 20m；上传大视频（200MB 规则）若上线需先调网关 body size + 超时（用户交代部署前评估）。

### ⭐⭐ 改阿里 nginx 的完整套路（2026-08-01 加 upstream keepalive 时总结，下次照抄）

⛔ **前提认知：阿里那台 nginx 上还有三个别的项目**（`tiantangqiyuan` / `venusai` / `video-downloader`）
+ FlashMuse 正式服入口 `flashmuse-static-ip`（**它自己内部就混着 `/tiantangqiyuan/`**）。
**配置写坏会连带把别人搞死**，所以：

| 文件 | 能不能整份覆盖 | 怎么改 |
|---|---|---|
| `flashmuse-test-8080` | ✅ 能（测试服独占、不含别的项目） | 仓库 `deploy/staging/flashmuse-test-8080.conf` 整份 scp 过去 |
| `flashmuse-staging-static-ssl`（**符号链接 → `sites-available/`**） | ✅ 能 | 仓库 `deploy/staging/flashmuse-staging-static-ssl.conf`；⚠️ **必须写 `sites-available` 那一端** |
| `flashmuse-static-ip`（正式服） | ⛔⛔ **绝对不能** | 只能用幂等增量脚本：`deploy/ali/ali-add-proxy-buffers.sh`、`ali-add-upstream-keepalive.py` |

**六步固定流程**：
1. ⭐ **先只读勘察**：`cat` 出服务器上那份，**和仓库那份 diff** ——
   全是 `>`（纯新增）= 服务器是仓库的严格超集、没人手改过，才敢覆盖；出现 `<` = 被手改过，先搞清楚。
   顺便 `grep -rn "upstream \|map \$http_upgrade" /etc/nginx/` **确认新加的名字不会重名**（重名会 `duplicate` 直接起不来）。
2. ⭐ **量基线**（站在阿里本机！见上面那条铁律），否则改完不知道有没有效果。
3. **备份**到 `/root/nginx-backups/<文件名>.<时间戳>.bak`。
4. **改**（整份覆盖 or 增量脚本）。增量脚本必须有：幂等 marker、**替换条数断言**、**"别的项目条数没变"断言**，
   任一不符就**一个字都不改**直接退出。
5. **`nginx -t` → 失败自动 `cp` 备份回去再 `nginx -t` 确认恢复**；通过才 `nginx -s reload`（⛔ 不要 `restart`）。
6. **验证**：复测性能 + **FlashMuse 四域名 + 测试服两入口 + 三个别的项目全部 curl 一遍**。

⭐ **keepalive 三件套缺一不可**（只做第一个等于没做）：
`upstream` + `keepalive N` ／ **`proxy_http_version 1.1`** ／ **`Connection` 头置空**（用 map 变量）。
默认是 HTTP/1.0 + `Connection: close`，keepalive 池根本用不上。
命名带项目前缀（`fm_test_app` / `fm_prod_app` / `$fm_prod_conn_upgrade`）。

⛔ **纯验证脚本别开 `set -e`**：`curl` 超时返回非 0 会把脚本整段掐断、后面的复测全不跑（踩过）。
⛔ **别用 `grep -o 'v[0-9.]*'` 抓版本号**：会抓到 `app-version.ts` **注释里的示例 `v1.0.0.1`**，
看着像"版本没更新"、虚惊一场。要 `grep 'APP_VERSION ='`。


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

**已知留在测试服 `12424740@qq.com` 上的测试痕迹（2026-08-01 v58 巡检，别当用户数据）**：
新建了 **`工作流_03`**，里面 5 个节点 ——
真生成的 `image_1_w3`（宇航员橘猫，扣 3 积分）、一个连着 edge 的「@image_1_w3 把这只猫改成戴墨镜」图片节点、
一个空视频节点、一个 Ctrl+V 粘贴测试建的「上传图片」节点（蓝底 `PASTE TEST`）、一个 Ctrl+C/V 复制出来的节点。
按用户交代「测试内容不要删」全留着。

### ⭐ v1.0.0.58~60（2026-08-01 第二十四次会话）新增的三条部署/验收经验

1. ⭐⭐ **验"新代码到底进构建产物没有"，比看版本号更硬的姿势**：
   `sudo docker exec <app容器> sh -lc 'grep -rl "从当前画布选择" /app/.next/static | head -3'`
   —— 直接在**构建产物**里 grep 本次新加的中文字符串，命中就是真编译进去了。
   ⛔ 别写成 `ssh "... sh -c '...中文...'"` 这种多层嵌套引号（PowerShell + sh 一起搞坏，报
   `Unterminated quoted string`）→ 一律写本地 `.sh` scp 过去跑。
2. ⭐ **HTML 里 grep 版本号不一定有**：`curl http://127.0.0.1:5001/ | grep 'v1\.0\.0\.'` 在首页会**抓不到**
   （版本号是客户端渲染的）。用 `x-app-version` 响应头（sed + force-recreate 之后才准），
   或者上号看页脚 `版本号(t):vX`。
3. ⭐ **本地写 `pubXX.sh` 的省事姿势**：把上一版那个直接 `-replace` 版本号另存
   （`(Get-Content .runtime/pub58.sh) -replace 'v1\.0\.0\.58','v1.0.0.60' | Set-Content -Encoding ascii .runtime/pub60.sh`），
   ⚠️ 必须 `-Encoding ascii`（脚本里没中文），再 scp + `sed -i 's/\r$//'`。



## GitHub

- 仓库 `https://github.com/lookxun/FlashMuse_Agent`，本地 origin 已指向它，identity `lookxun <lookxun@users.noreply.github.com>`。`gh` CLI 未安装。
- `.env`/`.env.local`/密钥/密码/签名 URL **绝不进 Git 和交接文档**。
