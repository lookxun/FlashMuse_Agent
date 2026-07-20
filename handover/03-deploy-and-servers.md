# Deploy And Servers

## ⭐⭐ 2026-07-18 起：测试服（staging）+ 部署铁律（所有 AI 必读，已同步进 AGENTS.md 顶部）

有一套**独立测试服**，和正式服跑同一份代码、但数据/环境/端口完全隔离，用来在**不影响正式服真实用户**的前提下做线上验证（尤其换接口这类高风险改动）。

### 部署语义铁律（务必遵守）
- **用户说"部署掉 / 部署一下"等，默认只部署【测试服】，绝不动正式服。**
- **只有用户明确说"把正式服部署掉 / 更新正式服 / 上线正式服"这类话**，才执行完整顺序：**先一次性部署测试服 → 验证 OK → 再把测试服那份代码原样同步到正式服**。任何情况都**不跳过测试服**、**不直接改正式服代码**。
- **版本号自增只在"部署测试服"这一步**：部署测试服前先 `node scripts/bump-version.mjs`（四段 100 进制 `vAA.BB.CC.DD` 最右段 +1、满 100 进位，写回 `src/lib/app-version.ts`）。**正式服部署绝不跑自增脚本**，只把测试服代码（含已写好的版本号）原样带过去 → 保证"**版本号一样 = 代码一样**"。

### 测试服架构（完整模拟正式服连阿里）
```
你的浏览器 → http://101.37.129.164:8080/  (阿里, 测试服前端)
             http://101.37.129.164:8080/admin (测试服后台)
  → 阿里 nginx 测试块(listen 8080, /etc/nginx/sites-enabled/flashmuse-test-8080)
     ├ /home-assets /_next/static /generated → 阿里测试镜像 /var/www/flashmuse-static-test/
     └ 其余反代 → 腾讯 119.28.116.16:5001
腾讯: /opt/flashmuse-staging/ 独立 Docker 栈(compose name=flashmuse-staging, 网络 flashmuse_staging_default)
      staging-nginx(host 5001→容器80) + staging-app(容器3000) + staging-db(独立库, 内部5432)
      数据卷 /opt/flashmuse-staging/data/{pgdata,generated,runtime,home-assets,nginx}
腾讯测试生成的图 → 自动 ali-sync 到 /var/www/flashmuse-static-test/generated (独立目录, 不碰正式服镜像)
```
- **端口**：腾讯安全组放行 **5001**（阿里→腾讯）、阿里安全组放行 **8080**（浏览器→阿里）。两个端口专供测试服。
- **⭐ 测试服登录账号（明文，供 AI 直接登录测试；密码都是 `dragonstar`；登录页选"密码登录"、先填邮箱点"提交邮箱"再填密码）**：
  - **`12424740@qq.com`（主测试号，普通用户，`ID_535317`，昵称"测试服龙星"）—— 优先用这个模拟真实用户测试**，有资产（角色图 2、上传图 34、对话流生成图 76 等）。
  - `lookxun@163.com`（白名单/管理员，`ID_176407`，昵称"测试服空空希洛"）——白名单号一般**不**用来做真实模拟测试。
  - 另 `176107103@qq.com` 也是白名单（env `ADMIN_EMAILS`）。
  - 用浏览器工具（playwright）登录：入口 `https://staging-static.venusface.com/`；切账号先 `context.clearCookies()` 再重登。**测试内容不要删除**（用户交代）。
- **数据**：测试服是**独立空库**（`staging-db`，POSTGRES_PASSWORD=`stg_5k2p9v7q3xz8`）。首次曾导入本地库，后按用户要求清空（`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + 重启 app 触发 entrypoint migrate deploy 重建空表）。白名单 `lookxun@163.com`/`176107103@qq.com` 走 env `ADMIN_EMAILS`，与清库无关，注册即管理员。
- **测试服环境差异**（`/opt/flashmuse-staging/data/.env.local`，从正式服 .env.local 派生）：`FORCE_INSECURE_AUTH_COOKIE=true`（http/IP 访问，cookie 不能 Secure）、`AUTH_COOKIE_DOMAIN=`（空，IP 无域名）、`NEXT_PUBLIC_PRIMARY_BASE_URL=http://101.37.129.164:8080`、`NEXT_PUBLIC_STATIC_BASE_URL=`（空=同源）、`ALI_SYNC_DEST_ROOT=/var/www/flashmuse-static-test/generated`、`UPLOAD_CORS_ORIGINS=http://101.37.129.164:8080`、`NEXT_PUBLIC_IS_TEST=true`。DATABASE_URL 由 compose environment 指向 staging-db。
- **测试服标识**：`NEXT_PUBLIC_IS_TEST=true` 作为 **compose build arg**（Dockerfile `ARG NEXT_PUBLIC_IS_TEST`）bake 进客户端 → 首页/工作台/后台 logo 后显示"测试服"、版本号显示 `版本号(t):vX`、浏览器标签标题前缀 `(测试服)`。正式服不传此 arg → 不显示这些。
- **版本号显示位置**：首页底部 footer（`本站内容均由AI生成 | 版本号:vX`）、工作台设置→版本信息、后台左侧"当前管理员"上面。代码在 `src/lib/app-version.ts`（`APP_VERSION`/`IS_TEST_SERVER`/`versionLabel()`）。

### 测试服部署流程（"部署掉"默认走这个）
1. 本地 `node scripts/bump-version.mjs`（版本号 +1，改中文源码只用 edit 工具，禁 Set-Content）。
2. 本地 `npx tsc --noEmit` 通过。
3. 打包改动源码 scp 到腾讯 `/tmp` → `sudo tar -xzf` 到 `/opt/flashmuse-staging/app`。
4. `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台+轮询防 120s 超时；entrypoint 自动 migrate deploy）。
5. 同步测试服静态到阿里镜像：`bash /opt/flashmuse-staging/sync-ali-test.sh`（同步 `_next/static`+`home-assets`+`generated` 到 `/var/www/flashmuse-static-test/`，否则 chunk 404）。
6. 验证：`curl http://127.0.0.1:5001/`(200)、外网 `http://101.37.129.164:8080/`(200) + 底部版本号变了。
- ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`。阿里 key（root 属主，一切到阿里的 ssh/rsync 要 sudo）：`/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519`（正式服的，测试服同步脚本也用它）。
- **PowerShell 坑**：ssh 内联 `\$VAR`/`%{...}`/嵌套引号会被本地 PS 搅坏 → 一律 scp .sh/.sql 再 `sed -i 's/\r$//'` + 跑。改中文源码禁 Set-Content（会 mojibake，本次踩过）。

### 正式服部署流程（仅当用户明确说"部署正式服"）
1. **先**完整部署测试服（含版本号自增）并验证 OK。
2. **不再跑 bump 脚本**，把测试服 `/opt/flashmuse-staging/app` 里那份源码（含已定版本号）原样同步到正式服 `/opt/flashmuse/app`（或用同一份本地源码），保证与测试服一字不差。
3. 走下面正式服（腾讯）Docker 部署流程。

---

## ⭐ 2026-07-11 起：主服务器 = 腾讯云新加坡（马来已停 app，仅当反代壳）

**现在真正跑 app 的是腾讯 `119.28.116.16`（Docker 栈）。下面"HOW TO DEPLOY（马来 PM2）"已过时——马来 app 已停。除非只改 nginx，否则部署要走腾讯 Docker 流程。**

### 腾讯部署流程（改代码必读）
1. 本地 `npx tsc --noEmit` 通过（改源码一律用 edit 工具，别用 PowerShell Set-Content 会毁中文编码）。
2. 打包改动源码：`tar -czf namefix.tgz src/...`（保留相对路径），scp 到腾讯 `/tmp/`，md5 两端核对。
3. 腾讯上：备份原文件到 `/opt/flashmuse/app-backups/<ts>/`，`sudo tar -xzf /tmp/xxx.tgz -C /opt/flashmuse/app`。
4. 重建：`cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app > /tmp/build.log 2>&1 &`（后台+轮询 `tail /tmp/build.log` 防 120s 超时）。有 Prisma 迁移时 entrypoint 会自动 `migrate deploy`。
5. **必须：同步腾讯 `.next/static` 到阿里镜像**（否则 chunk 哈希不匹配、`/_next/static` 全 404、页面样式崩）：
   `sudo docker cp flashmuse-flashmuse-app-1:/app/.next/static /tmp/next-static && sudo rsync -a --delete -e "ssh -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519" /tmp/next-static/ root@101.37.129.164:/var/www/flashmuse-static/_next/static/`
6. 验证：`sudo docker compose logs --tail flashmuse-app`(Ready+worker started)；ali/main/api/static.venusface.com 全 200。

### 连接与密钥
- 腾讯：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（pem 副本已收紧权限；源 `E:\project\【2】server\腾讯云_新加坡服务器\CinematicFlow.pem`）。docker 命令加 `sudo`。
- 马来→腾讯 免密：马来上 `/root/.ssh/flashmuse_to_tencent_ed25519`（公钥已在腾讯 ubuntu authorized_keys）。
- 腾讯→阿里 ali-sync 密钥：`/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519`（容器内 `/app/.runtime/...`，env `ALI_SYNC_SSH_KEY` 指它）。
- DB（腾讯）：容器 `flashmuse-flashmuse-db-1`，`docker exec -e PGPASSWORD=qky9brw3fp5cojhdv80lamtn7ug1 ... psql -U flashmuse -d flashmuse`。**heredoc SQL 必须 `docker exec -i`**（否则 stdin 不进、SQL 静默不执行）。

### 当前流量架构
- DNS：`main`/`api`.venusface.com→**腾讯 119.28.116.16**（阶段4已切）；`ali`/`static`→阿里 101.37.129.164。
- **腾讯 flashmuse-nginx 直接 SSL 终止 main/api（443）**：`/opt/flashmuse/data/nginx/flashmuse.conf` 有 443 server 块（server_name main/api，证书 `/etc/letsencrypt/live/main.venusface.com/`，反代 flashmuse-app:3000 + 本地 /generated、/home-assets）。宿主 443:443、5000:80。证书从马来复制（SAN main+api，到 2026-09-06）。
- 阿里 nginx `/etc/nginx/sites-enabled/flashmuse-static-ip`：动态 `proxy_pass → 119.28.116.16:5000`；`/generated`+`/_next/static`+`/home-assets` 走阿里本地镜像。
- **马来已彻底出链路**（DNS 不再指它，app 早已 pm2 stop）。马来壳/退租见 05-next-actions 遗留项。
- ⚠️ 宿主 80 被 vibesocial-nginx 占用（腾讯是多项目共宿主机），flashmuse 拿不到 80。证书续期用 **acme.sh tls-alpn-01（走 443）**：cert=Let's Encrypt ECC(main+api，到 2026-10-09)，acme.sh cron 自动续（约 9-10），续期 hook 停/起 flashmuse-nginx 释放 443、装到 `/opt/flashmuse/data/letsencrypt/live/main.venusface.com/`。详见 05 遗留项②。

### 只改 nginx / 服务器配置
- 马来/阿里 nginx 仍可按需改（备份→`nginx -t`→reload）。腾讯 nginx 配置在 `/opt/flashmuse/data/nginx/flashmuse.conf`（容器 flashmuse-nginx）。

---

## HOW TO DEPLOY — FOLLOW THIS, DO NOT ASK THE USER
（⚠️ 以下为马来 PM2 老流程，app 已停，仅历史参考 / 改马来 nginx 时用）

You already have everything needed to deploy. Do not tell the user you "can't deploy" or ask how — the SSH key, server IP, and process are all here.

- SSH key: `E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem`. Server: `root@101.47.19.109`. Project: `/var/www/flashmuse`. PM2 app: `flashmuse`. Deploy script: `/usr/local/bin/deploy-flashmuse-production.sh` (runs build + PM2 restart + PM2 save + Ali `_next/static` sync).
- First-connection host key: this machine may not have the server in known_hosts. Use `-o StrictHostKeyChecking=accept-new` on the first ssh/scp (do NOT ssh to `main.venusface.com` — that is the web domain, the DEPLOY host is the IP `101.47.19.109`).

CRITICAL Windows/PowerShell rule (this is what trips you up):
- Do NOT inline complex bash (nested quotes, `sed`, `$'...'`, `${var%...}`) through a PowerShell here-string into `ssh`. PowerShell + ssh mangles the quoting and bash dies with `unexpected EOF` / `unknown option to s`.
- INSTEAD: write the server-side bash to a local `.sh` file (use the Write tool), `scp` it to `/tmp/xxx.sh`, then run `ssh ... "sed -i 's/\r$//' /tmp/xxx.sh && bash /tmp/xxx.sh"`. The `sed 's/\r$//'` strips Windows CRLF (otherwise bash fails on `$'\r'`). This ALWAYS works. Simple one-liners (curl, pm2 status, ls, md5sum) are fine inline.

DATABASE_URL on the server (needed only for schema changes). `.env.local` has TWO `DATABASE_URL` lines; the SECOND is malformed. Extract the FIRST with cut+tr (NO sed — sed quoting breaks over ssh):
```bash
val=$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r')
export DATABASE_URL="$val"
```

Full deploy sequence (verified working 2026-07-05):
1. LOCAL: `git status --short` (confirm only intended files changed); `npx tsc --noEmit` and `npm run build` must pass.
2. LOCAL: make source tarball (exclude heavy/secret dirs):
   `tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=.runtime --exclude=.deploy-backups --exclude=./public --exclude=.env --exclude=.env.local --exclude="*.pem" -czf <tmp>\flashmuse-deploy.tgz .`
   then `scp -i <key> -o StrictHostKeyChecking=accept-new <tmp>\flashmuse-deploy.tgz root@101.47.19.109:/tmp/flashmuse-deploy.tgz` and verify with `ssh ... "md5sum /tmp/flashmuse-deploy.tgz"`.
3. SERVER (inline is OK for these): backup + before-snapshot:
   `cd /var/www/flashmuse && mkdir -p .deploy-backups/<LABEL> && tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=.runtime --exclude=.deploy-backups --exclude=./public -czf .deploy-backups/<LABEL>/source-before-deploy.tgz . && node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot <LABEL>-before`
4. SERVER: extract: `cd /var/www/flashmuse && tar -xzf /tmp/flashmuse-deploy.tgz`.
5. SERVER (ONLY if prisma schema changed): via a scp'd `.sh` file — set DATABASE_URL (above), then `npx prisma migrate deploy` then `npx prisma generate`. Migration MUST run BEFORE the build.
6. SERVER: `/usr/local/bin/deploy-flashmuse-production.sh` (via scp'd `.sh` file, since it is long-running and you want clean output).
7. SERVER: after-snapshot + compare + HTTP checks:
   `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot <LABEL>-after`
   `node .runtime/deploy-checks/prod-deploy-snapshot.mjs compare .runtime/deploy-checks/<LABEL>-before.json .runtime/deploy-checks/<LABEL>-after.json` (expect `ok:true`; `stableMissing`/`fallbackUsers` must stay 0)
   `curl -s -o /dev/null -w "%{http_code}" https://main.venusface.com/workspace` (200), same for `/admin` and `https://api.venusface.com/api/model-availability`.
8. Risk rule (see Deployment Rules below): low-impact = deploy directly then report; risky (migrations / user-facing generation / auth / credits / media persistence) = the user's standing instruction is that deploying is fine after local verification + snapshot guard; still back up first and run the snapshot compare.


## Tencent Singapore Server (迁移目标, 2026-07-10 起) — 详见 09-migration-to-tencent.md

- 用途：主服务器迁移目标，将替代马来。当前跑着 FlashMuse 独立 Docker 栈(阶段1)。
- IP `119.28.116.16`，Ubuntu 24.04，用户 `ubuntu`(免密 sudo)。密钥 `E:\project\【2】server\腾讯云_新加坡服务器\CinematicFlow.pem`。
- ⚠️ pem 权限太开放 ssh 会拒用：先 `Copy-Item` 到 `C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem` 再 `icacls <copy> /inheritance:r; icacls <copy> /grant:r "ASUS:(R)"`，用副本登录。
- **纯 Docker 主机，上面还有其它项目(CinematicFlow `/opt/PS-`、VibeSocial `/home/ubuntu/VibeSocial`)，绝不能影响**。宿主 80/3000/5432/8000/8001 被占；安全组只放行 22/80/3000/8001 + 为本项目新开的 **5000**(控制台层，SSH 改不了，无腾讯 API 密钥)。
- FlashMuse 部署在 `/opt/flashmuse/`：`app/`+`docker-compose.yml`+`data/{.env.local,generated,runtime,pgdata,home-assets}`。独立网络 `flashmuse_default`。app 宿主端口 5000→容器 3000；postgres 不暴露宿主。
- 常用：`sudo docker compose` (v5.1.1)。重建 app：scp 改动文件到 `/opt/flashmuse/app/` → `cd /opt/flashmuse && sudo docker compose up -d --build flashmuse-app`(后台 nohup+轮询日志避免 120s 超时)。DB 密码在 `docker-compose.yml` 与 `data/.env.local`。
- China→新加坡上传慢(~68KB/s)，大文件 scp 会超时；源码包排除大目录压到 <1MB，或走马来中转。

## Malaysia Main Server

- Role: main Next.js app, API, PostgreSQL, generated media source.
- IP: `101.47.19.109`.
- Project path: `/var/www/flashmuse`.
- PM2 process: `flashmuse`.
- Standard deploy script: `/usr/local/bin/deploy-flashmuse-production.sh`.
- Login key path on local machine: `E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem`.
- Safe login command: `ssh -i "E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem" root@101.47.19.109`.

Current notes:

- 2026-07-10 deploy (生成媒体名称原子预约): narrow multi-file deploy of ONLY the name-reservation change — 9 paths: `prisma/schema.prisma`, `prisma/migrations/20260710000000_generation_job_name_reservations/`, `src/app/api/generation-status/route.ts`, `src/app/api/image/route.ts`, `src/app/api/video/route.ts`, `src/components/chat-workbench.tsx`, `src/components/workflow-tldraw-canvas.tsx`, `src/components/workflow-tldraw-canvas-inner.tsx`, `src/lib/generation-jobs.ts`. Deliberately EXCLUDED the unrelated dirty `src/app/api/workflow-prompt-optimization/cases/route.ts`. Tarball md5 `5842220a52931db1095334d238bf3f57` (verified both sides). Backup `.deploy-backups/20260710-name-reservations/source-before-deploy.tgz`. Prisma migration `20260710000000_generation_job_name_reservations` (`ALTER TABLE "GenerationJob" ADD COLUMN "reservedNames" JSONB;`) applied via scp'd `.sh` (migrate deploy → generate → deploy script). Confirmed with psql: migration `applied`, `reservedNames:jsonb`. **psql gotcha**: the first `DATABASE_URL` has a Prisma-only `?schema=` query param that psql rejects (`invalid URI query parameter: "schema"`) — strip it with `psql_url="${DATABASE_URL%%\?*}"`. Guard snapshots `.runtime/deploy-checks/20260710-name-reservations-before.json` (assetListHash `bd431b01a976b013`) / `-after.json` (`f4d171aa4e28ec46`); compare `ok:false` ONLY because live user ID_271898 generated 1 new conversation video during the window (conversation_videos 1039→1040); `stableMissingInNewTable`/`fallbackUsers` stayed 0 before+after. build only existing Turbopack/NFT warnings, PM2 online, Ali `_next/static` synced; `/workspace`,`/admin`,`/api/model-availability` all 200. Also manually repaired historical duplicate video name via a `prisma.$transaction` (`video_3_w6`→`video_4_w6` for user ID_636611 workflow db0a1ac5-caf6-4cf3-a21e-96d2eb2c7548 asset cmrec5oyoxjjtnun1d24od361: MediaAsset systemName/initialName + UserAssetState.currentName + workflow canvasJson node mediaSystemNames), backup `.runtime/manual-fixes/20260710-repair-video-4-w6-before.json`. One-off inspect/repair/verify scripts left under `/var/www/flashmuse/.runtime/*.cjs` (not repo code). **NOT pushed to GitHub, NOT committed locally** — prod is ahead of GitHub/local.
- 2026-07-08 (网络诊断 session) 服务器运维改动(非应用部署)：
  - **BBR 已开(两台，持久化)**：马来+阿里都 `net.ipv4.tcp_congestion_control=bbr` + `net.core.default_qdisc=fq`，写进 `/etc/sysctl.conf`。目的：马来↔阿里国际链路当前 50% 丢包，cubic 吞吐崩，BBR 扛丢包(A/B 实测快6~10倍：cubic~6KB/s→BBR~40KB/s)。回退：`sysctl -w net.ipv4.tcp_congestion_control=cubic` 并删 sysctl.conf 两行。
  - **马来 nginx**：`conf.d/flashmuse-ip.conf`(接收 Ali 反代的默认块) + `conf.d/flashmuse.conf`(main/api) 都加了 `client_body_timeout 300s`(原默认 60s，大视频上传 body 传输被掐返回 408)。备份 `conf.d/flashmuse-ip.conf.bak.20260708164430`、`conf.d/flashmuse.conf.bak.20260708164430`。**保留未回滚。**
  - **Ali nginx**：`sites-enabled/flashmuse-static-ip` 两个 `location /` 曾加 `proxy_request_buffering off; proxy_max_temp_file_size 0; client_body_timeout 300s;` 后**整体回滚到备份**(误判它导致全站卡)。备份 `/etc/nginx/flashmuse-static-ip.bak.20260708164344`。**当前 Ali=原样。** 上传卡95%的真根因(Ali 默认双重缓冲)因此仍未修——根治见 05-next-actions：重新只加 `proxy_request_buffering off`(别加 `proxy_max_temp_file_size 0`)。
  - 从马来 ssh 跳 Ali 用 `ssh -i /root/.ssh/flashmuse_to_ali_ed25519 root@101.37.129.164`。Ali flashmuse nginx 配置在 `/etc/nginx/sites-enabled/flashmuse-static-ip`(不在 conf.d)。诊断丢包：从 Ali `ping 101.47.19.109`。
- Latest 2026-07-08 app deploy (网络诊断 session): narrow single-file deploy of `src/app/page.tsx` (首页 logo 去掉悬停 `title`). Backup `.deploy-backups/20260708-logo-no-tooltip/page.tsx.before`. Build EXIT=0, PM2 online, Ali `_next/static` synced, homepage 200. NOT pushed to GitHub.
- Latest 2026-07-05 (later session) deploy: asset-library + admin-detail PERFORMANCE optimization (compute-only, no functional change). Full-source snapshot (tarball md5 `01164cebbfecbd725de12ac26f563dc9`; note the first scp truncated — always md5-verify both sides and re-scp on mismatch). NO new Prisma migration (schema already matched prod), so migrate/generate were skipped. Backup `.deploy-backups/20260705-perf-asset-admin/source-before-deploy.tgz`. Guard snapshots `.runtime/deploy-checks/20260705-perf-before.json` / `20260705-perf-after.json`, compare `ok:true` (assetListHash `0deb19ceea43c596` unchanged, stableMissing/fallbackUsers 0). Deploy script build OK, PM2 online, Ali synced. Post-deploy: `/workspace` `/admin` `/api/model-availability` `ali.venusface.com/workspace` all 200. Committed+pushed to GitHub (this commit also pushed the earlier-but-unpushed 2026-07-05 admin-overview/analytics work).
- Source file hashes for key local files matched the Malaysia server deployment during rebuild.
- PM2 was online during rebuild.
- Recent deployment backup names included `20260620202220-asset-dedupe-ui-fix`.
- Latest deployment backups from 2026-06-21 Seedance reference media work include `20260621053806-seedance-av-upload`, `20260621055453-media-mention-preview-fix`, `20260621060108-media-duration-epsilon`, `20260621061058-media-input-mention-click`, `20260621061807-media-prompt-inline-render`, `20260621062457-assistant-uploaded-files-fix`, `20260621063426-byteplus-review-notice-once`, `20260621064500-review-notice-per-request`, `20260621065215-replay-media-references`, `20260621065646-admin-upload-rules-text`, and `20260621065952-admin-upload-rules-columns`.
- Later 2026-06-21 deploy backups include `20260621-admin-credit-last-change-sort`, `20260621-admin-upload-rules-image-reference`, `20260621-asset-category-preserve`, `20260621-asset-sidebar-group-counts`, `20260621-asset-page-size-loading`, `20260621-asset-pagination-loop-fix`, `20260621-upload-image-fallback`, `20260621-upload-image-conversion-timeout`, `20260621-upload-diagnostics`, and `20260621-same-origin-image-upload`.
- BytePlus video diagnostics are under `/var/www/flashmuse/.runtime/video-diagnostics-log.jsonl`. Use this to verify whether requests include only `reference_image` or also `reference_video` / `reference_audio`.
- Latest 2026-06-23 deployment uploaded the full local source snapshot, backed up production source to `.deploy-backups/20260623-full-local-deploy/source-before-deploy.tgz`, then ran `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT warnings; PM2 stayed online; Ali `_next/static` synced and cache cleared. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was confirmed disabled/unset.
- Latest protected deployment after that used pre/post asset snapshots. Before deploy snapshot: `.runtime/deploy-checks/20260623-before-risk-deploy.json`; after deploy snapshot: `.runtime/deploy-checks/20260623-after-risk-deploy.json`; hotfix snapshot: `.runtime/deploy-checks/20260623-after-hotfix.json`. Snapshot comparison returned `ok: true` with unchanged totals, per-user assets, per-category assets, and `assetListHash=ff9ef4f9f85ff233`.
- Latest protected deployment backups: `.deploy-backups/20260623-risk-flow/source-before-deploy.tgz` and `.deploy-backups/20260623-workspace-crash-hotfix/source-before-hotfix.tgz`.
- Latest 2026-06-24 deploy uploaded local source archive `/tmp/flashmuse-20260624-workflow-input-deploy.tgz`, backed up production source to `.deploy-backups/20260624-workflow-input-deploy/source-before-deploy.tgz`, applied Prisma migration `20260624090000_workflow_media_names`, ran `npx prisma generate`, then `/usr/local/bin/deploy-flashmuse-production.sh`. Build passed with only existing Turbopack/NFT warnings, PM2 stayed online, and Ali `_next/static` synced. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was confirmed disabled/unset before deploy.
- Latest 2026-06-24 deploy guard files: before snapshot `.runtime/deploy-checks/20260624-before-workflow-input-deploy.json`, after snapshot `.runtime/deploy-checks/20260624-after-workflow-input-deploy.json`. Compare returned `ok: true`; `stableMissingInNewTable=0`, `fallbackUsers=0`, and `assetListHash=81ece40e2d3c6134` stayed unchanged.
- Latest 2026-06-26 app deploy was a narrow error-message-only deploy. Only `src/lib/error-message.ts` was copied to production, with backup `/var/www/flashmuse/.deploy-backups/20260626-error-message-audio-sensitive/error-message.ts.before`, then `/usr/local/bin/deploy-flashmuse-production.sh` ran. Build passed with existing Turbopack/NFT warnings; PM2 stayed online; Ali `_next/static` synced; `/workspace`, `/admin`, and `/api/model-availability` returned 200. Local tldraw/workflow work was intentionally not deployed.
- Latest 2026-06-28 deploys were narrow production diagnostics/upload UI deploys. They intentionally did not deploy local workflow/tldraw dirty work. Backups: `.deploy-backups/20260628162851-generation-diagnostics`, `.deploy-backups/20260628164248-upload-diagnostics`, `.deploy-backups/20260628170012-upload-timeout-label`, and `.deploy-backups/20260628171000-upload-timeout-90s`.
- New production diagnostic file `.runtime/generation-diagnostics-log.jsonl` records text/Agent/intent, image, video, and media-save main generation chain diagnostics. It is created on first relevant request.
- New production diagnostic file `.runtime/upload-diagnostics-log.jsonl` records `/api/asset-upload-temp` and image upload/re-encode/commit diagnostics. It is created on first relevant upload request.
- 2026-06-28 deployment verification passed after each narrow deploy: local and/or production `npx tsc --noEmit` passed, production build passed with only existing Turbopack/NFT broad-file warnings, PM2 stayed online, Ali `_next/static` synced, and `/workspace`, `/admin` when checked, `/api/model-availability`, and `/api/asset-upload-temp` OPTIONS when checked returned 200/204.
- Latest 2026-06-30 full deploy uploaded the current local source snapshot including conversation Seedance `参考模式`, admin upload-rule overrides, backend upload-rule enforcement, and workflow code. Production workflow entry remained disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` was still unset/false. Backup: `.deploy-backups/20260630-full-seedance-upload-rules/source-before-deploy.tgz`. Source archive: `/tmp/flashmuse-20260630-full-seedance-upload-rules.tgz`. Server needed `npm install` first because `tldraw` was missing from old production `node_modules`; after that production `npx tsc --noEmit` and `npm run build` passed with existing Turbopack/NFT warnings, PM2 restarted online, and Ali `_next/static` synced. Guard snapshots: `.runtime/deploy-checks/20260630-before-full-seedance-upload-rules.json` and `.runtime/deploy-checks/20260630-after-full-seedance-upload-rules.json`; compare changed because live users generated 2 new messages/assets during deploy, but `stableMissingInNewTable=0` and `fallbackUsers=0` stayed safe. `/workspace`, `/admin`, `/api/model-availability`, and `/api/asset-upload-temp` OPTIONS returned 200/204 after deploy.
- Later 2026-06-30 narrow deploys improved upload reliability and video poll recovery. Backups: `.deploy-backups/20260630-upload-retry-api-base` and `.deploy-backups/20260630-video-poll-recovery-upload-base`. Deployed files were `src/app/api/asset-upload-temp/route.ts`, `src/app/api/upload-image/route.ts`, `src/components/chat-workbench.tsx`, and `src/components/workflow-tldraw-canvas-inner.tsx`. Changes: auto `forceReencode=1` retry for JPEGs requiring transcode; production uploads default to `https://api.venusface.com` with token auth and CORS for the VenusFace domains; conversation/workflow video polling keeps waiting on transient poll/network/502 errors once a `taskId` exists. Production `npx tsc --noEmit` and build passed with existing Turbopack/NFT warnings, PM2 restarted online, Ali `_next/static` synced, `/workspace` and `/api/model-availability` returned 200, and upload CORS preflight returned 204.
- Latest 2026-07-02 narrow deploy fixed BytePlus reference auto-review for `B_254`. Only `src/app/api/video/route.ts` was uploaded. Backup: `.deploy-backups/20260702-b254-video-audio-review/route.ts.before`. The fix expands auto review from images only to images, videos, and audios, creating BytePlus assets with `AssetType: Image | Video | Audio` and retrying with reviewed `asset://...` references. Production `npx tsc --noEmit` passed, build passed with existing Turbopack/NFT warnings, PM2 `flashmuse` restarted online, PM2 state saved, Ali `_next/static` synced, `/workspace` and `/api/model-availability` returned 200. No local workflow/GPT/upload-node changes were deployed in this hotfix.
- Later 2026-07-02 narrow deploy fixed stale conversation media red-error text after successful retry. Only production `src/components/chat-workbench.tsx` was patched manually, not broad local dirty source. Backup: `.deploy-backups/20260702-clear-media-error-on-retry-success/chat-workbench.tsx.before`. The fix clears matching `mediaErrorReasons` / `error` after image/video failed-slot retry succeeds and hides media red text when no visible failed card remains. Production `npx tsc --noEmit` passed, `/usr/local/bin/deploy-flashmuse-production.sh` passed with existing Turbopack/NFT broad-file warnings, PM2 restarted/saved, Ali `_next/static` synced, `/workspace` and `/api/model-availability` returned 200.
- Manual production recovery on 2026-06-30: BytePlus task `cgt-20260630212727-nnttf` for user `ID_636611`, conversation `bd20879c-44b4-4760-91a8-83c4b0441ce3`, message `fdb7d980-c06d-4ac9-af30-6473003d222e`, request `2538a032-2874-4f6c-b51c-299e056dbdbc` was interrupted by the deploy restart but later queried as `succeeded`. Recovered video `/generated/users/ID_636611/videos/1782829256422-78469703-e341-4bd2-b59d-c7bcaf44ce0b.mp4` and poster `/generated/users/ID_636611/video-posters/1782829256422-78469703-e341-4bd2-b59d-c7bcaf44ce0b.jpg`, synced to Ali, updated message/session JSON, and upserted `conversation_videos` asset `video_142059`. Backup before recovery is under `.runtime/manual-fixes/*-recover-video-cgt-20260630212727-nnttf-before.json`.
- Latest 2026-07-03 full deploy shipped all previously-undeployed local source (workflow connections/uploads/GPT-optimization code, backend BytePlus video/audio auto-review, admin GPT tab) with the production workflow entry still disabled. Steps used (done over SSH from the local Windows machine): create source tarball excluding `public` (unchanged home-assets already on server), `node_modules`, `.next`, `.git`, `.runtime`, `.deploy-backups`, `.env*`; scp to `/tmp/flashmuse-deploy.tgz` (md5 verified); back up current source to `.deploy-backups/20260703-workflow-code-full/source-before-deploy.tgz`; before snapshot `before-20260703-workflow-code-full.json`; extract source; `npx prisma migrate deploy` (applied `20260701043000_gpt_image_prompt_optimization_cases`) + `npx prisma generate`; `/usr/local/bin/deploy-flashmuse-production.sh` (build + PM2 restart/save + Ali sync). IMPORTANT DATABASE_URL note: production `.env.local` has TWO `DATABASE_URL` lines and the SECOND is malformed (leading space); when setting it for prisma, use the FIRST line: `export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^\"//' -e 's/\"$//')"`. Also: when piping shell scripts to the server from Windows, strip CRLF first (`sed -i 's/\r$//' file`) or bash fails on `$'\r'`. Post-deploy: `/workspace` 200, `/admin` 200, `/api/model-availability` 200, `/api/asset-upload-temp` OPTIONS 204, new `/api/workflow-prompt-optimization/rewrite` POST 400 (missing-prompt validation) and `/cases` POST 401 (unauth). Snapshot compare showed only one live user soft-removing 13 uploads during the window (total unchanged), `stableMissing`/`fallbackUsers` 0 before+after. `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` confirmed absent before and after. Committed+pushed as `3455532`.
- `scripts/prod-deploy-snapshot.mjs` is the reusable deploy guard. Production copy: `.runtime/deploy-checks/prod-deploy-snapshot.mjs`. Use it before risky deploys: `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot LABEL`, then compare with `node .runtime/deploy-checks/prod-deploy-snapshot.mjs compare BEFORE.json AFTER.json`.
- For database changes on production, set `DATABASE_URL` from the running PM2 process if `.env.local` cannot be sourced directly. Working pattern used: `export DATABASE_URL="$(pm2 env 0 | grep ^DATABASE_URL | cut -c15-)"`, then run `npx prisma migrate deploy` and `npx prisma generate` before the standard deploy script.
- On 2026-06-21, upload failures around 1MB were traced to `/etc/nginx/conf.d/flashmuse.conf`: missing semicolons after `server_name main.venusface.com api.venusface.com` caused `client_max_body_size` to be parsed incorrectly. Fixed config backup: `/etc/nginx/conf.d/flashmuse.conf.bak.20260621025418-upload-size-fix`.
- Current intended upload limit for `main/api` HTTPS server block is `client_max_body_size 20m;`. Verify with `nginx -T | grep -n 'server_name main.venusface.com api.venusface.com\|client_max_body_size'` if upload 413 returns.
- Client-side upload diagnostics are logged through `/api/client-error` with `source="client-diagnostic"`. Use PM2 logs and Nginx access logs together when diagnosing upload failures. If users see only generic `上传失败`, check for nearby `client-diagnostic` entries first.

## Ali Static Server

- Role: static mirror for `_next/static`, generated files, and home assets.
- IP: `101.37.129.164`.
- Static root: `/var/www/flashmuse-static`.
- Local server info file exists outside the repo under `E:\project\【2】server\阿里服务器\阿里服务器.txt`. Do not copy passwords into Git or handover docs.
- Malaysia deploy script uses `/root/.ssh/flashmuse_to_ali_ed25519` internally to sync Ali static assets.

Observed during rebuild:

- Nginx service on Ali was active.
- `/var/www/flashmuse-static/_next/static` had timestamp `2026-06-20 20:22`, matching the latest deploy window.
- Ali local SNI checks returned 200 for one real `_next/static` file.
- 2026-06-26 after domain review passed, public HTTP/HTTPS access for `ali.venusface.com` and `static.venusface.com` was fixed and verified. HTTP now redirects to HTTPS for those hosts while `/.well-known/acme-challenge/` is served from `/var/www/letsencrypt`. HTTPS returns 200 for `https://ali.venusface.com/`, `https://static.venusface.com/flashmuse-cache-health`, a real `_next/static` file, and a known generated video.
- Ali certificate `flashmuse-ali-static` was reissued via HTTP-01 webroot and expires on `2026-09-24`. Renewal config uses `authenticator = webroot`; `certbot.timer` exists; deploy hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` runs `nginx -t` and reloads Nginx after renewal; `certbot renew --dry-run --cert-name flashmuse-ali-static --no-random-sleep-on-renew` passed.

## Public Domains

- Main app: `https://main.venusface.com`.
- API: `https://api.venusface.com`.
- Ali fast entry and static domains: `https://ali.venusface.com`, `https://static.venusface.com`.

Verified during rebuild:

- `https://main.venusface.com/workspace` -> 200.
- `https://api.venusface.com/api/model-availability` -> 200.
- `https://main.venusface.com/admin` -> 200.

## GitHub Repository

- Current repository: `https://github.com/lookxun/FlashMuse_Agent`.
- Current local `origin`: `https://github.com/lookxun/FlashMuse_Agent.git`.
- Repository was renamed on 2026-06-26 from `lookxun/AI-Video-Assistant` to `lookxun/FlashMuse_Agent`.
- Latest pushed commit after the rename and local workflow sync: `1c9211d Sync local workflow updates and repo rename`.
- Repository-level Git identity is configured locally as `lookxun <lookxun@users.noreply.github.com>`. This only fixes local commits; pushing still requires valid GitHub credentials on the machine.
- GitHub CLI `gh` is not installed on this Windows machine. The 2026-06-26 repository rename used the GitHub REST API with the existing local Git credential; do not print or store credentials in docs.

## Deployment Rules

- Before deploying, inspect local `git status` and `git diff`.
- Do not overwrite unrelated local changes.
- For database changes, run Prisma migration deploy and generate on the server before app build when needed. Use the PM2 environment pattern above if direct env loading fails.
- Use the standard Malaysia deploy script unless there is a specific reason not to.
- The deploy script builds, restarts PM2, saves PM2 state, and syncs `_next/static` to Ali.
- Keep `.env`, `.env.local`, keys, SMTP credentials, and server passwords out of Git and handover docs.
- Deployment decision rule: if the change is low-risk and should not meaningfully affect current frontend users, the AI may deploy directly after local verification and then report the result.
- If deployment may interrupt active users, running generation tasks, database migrations, auth/session behavior, payment/credits, media persistence, or server availability, do not deploy first. Explain the risk to the user and ask for approval before deploying.
- Do not keep old blanket rules that say every deployment must be approved first. The current rule is risk-based: low-impact deploys can proceed; risky deploys require user confirmation.
- Nginx config changes are allowed when they fix a clear production issue, but always back up the config, run `nginx -t`, and reload rather than restart the server.
- For risky deploys that may affect workspace or asset display, run a before snapshot and after snapshot with `prod-deploy-snapshot.mjs`; do not rely only on HTTP 200 checks.

## Useful Production Checks

Run from local:

```powershell
ssh -i "E:\project\【2】server\马来西亚服务器\ByteplusVPS.pem" root@101.47.19.109
```

Run on Malaysia:

```bash
cd /var/www/flashmuse
pm2 status
curl -I https://main.venusface.com/workspace
curl -I https://api.venusface.com/api/model-availability
ls -1 .deploy-backups | tail
ls -1 .runtime/media-migration-logs | tail
node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot manual-check
```
