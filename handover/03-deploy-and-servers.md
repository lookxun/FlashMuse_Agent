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

---

## 测试服（staging）

- **入口**：`http://101.37.129.164:8080/`（阿里，IP）或 `https://staging-static.venusface.com/`（阿里 DNS + Let's Encrypt 443）；后台 `/admin`。
- **架构**：腾讯 `/opt/flashmuse-staging/` 独立 Docker 栈（容器 `flashmuse-staging-staging-{app,db,nginx}-1`，宿主 5001）+ 阿里 `/var/www/flashmuse-static-test/` 独立镜像（nginx 8080）+ 独立 ali-sync（`sync-ali-test.sh`）。测试库独立、`staging-db`，`psql -U flashmuse -d flashmuse`。
- **测试账号（明文；密码都 `dragonstar`；登录页选"密码登录"→填邮箱点"提交邮箱"→填密码）**：
  - **`12424740@qq.com`（主测试号，普通用户 ID_535317）—— 模拟真实用户优先用它**，有资产。
  - `lookxun@163.com`（白名单/管理员 ID_176407）、`176107103@qq.com`（白名单）——**不**用来做真实模拟。
  - 白名单走 env `ADMIN_EMAILS`。**测试内容不要删**（用户交代）。
- 测试服 env 差异（`/opt/flashmuse-staging/data/.env.local`）：`NEXT_PUBLIC_IS_TEST=true`（build arg，显示测试服标识）、`FORCE_INSECURE_AUTH_COOKIE=true`、`NEXT_PUBLIC_PRIMARY_BASE_URL`+`NEXT_PUBLIC_UPLOAD_BASE_URL`=`https://staging-static.venusface.com`、`ALI_SYNC_DEST_ROOT=/var/www/flashmuse-static-test/generated`。⚠️ 拼参考图 URL 的 base 优先用 `NEXT_PUBLIC_PRIMARY_BASE_URL`。

### 测试服部署流程（"部署掉"走这个）
1. 本地 `node scripts/bump-version.mjs`（版本号+1，改中文源码用 edit 工具）；`npx tsc --noEmit` 通过。
2. 打**改动源码** tgz（含 `src/lib/app-version.ts`），scp 到腾讯 `/tmp` → `sudo tar -xzf -C /opt/flashmuse-staging/app`。
3. `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（**后台+轮询 `tail /tmp/sb.log` 防 120s 工具超时**，build~2.5min；entrypoint 自动 migrate deploy）。
4. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`（同步 `_next/static`+`home-assets`+`generated` 到阿里测试镜像，否则 chunk 404）。
5. 验证：`curl http://127.0.0.1:5001/`（版本号变了）+ 外网 `http://101.37.129.164:8080/` 200。

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
7. **env 数据**：`UPLOAD_RULE_OVERRIDES` 等是正式服独立 env（`/opt/flashmuse/data/.env.local`），不随代码同步；需要时手改 + `docker compose up -d --force-recreate flashmuse-app`。
8. commit + push GitHub（保持四方同步）。

## 关键踩坑与记忆

- **PowerShell 坑**：ssh 内联含 `$(...)`/`%{}`/中文/嵌套引号会被本地 PS 先解释坏（备份目录名丢时间戳=踩过）→ 一律写本地 `.sh`/`.sql`/`.js`，scp `/tmp`，`sed -i 's/\r$//'` 后 `bash`/`psql -f`/`node`。改中文源码禁 `Set-Content`（mojibake）。
- **一次性 node 脚本**必须放进容器 `/app` 里跑（`sudo docker cp x.js 容器:/app/ && sudo docker exec -w /app 容器 node x.js`）才找得到 `@prisma/client`。
- **DB heredoc SQL 用 `docker exec -i`**；含中文 SQL 写 .sql scp + `docker cp` + `psql -f`。腾讯→阿里跳板：`sudo ssh -o StrictHostKeyChecking=no -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 root@101.37.129.164 '...'`。
- **部署窗口旧标签 ChunkLoadError** 是固有现象（跨部署窗口），硬刷即可，非 bug。
- 备份都在 `/opt/flashmuse/app-backups/<ts>-...`。
- **只改 nginx**：腾讯 nginx 配置在 `/opt/flashmuse/data/nginx/flashmuse.conf`（容器 flashmuse-nginx）；阿里 `/etc/nginx/sites-enabled/`。改前备份→`nginx -t`→reload。腾讯 main/api 证书走 acme.sh tls-alpn-01（443），cron 自动续。当前正式 nginx `client_max_body_size` 历史为 20m；上传大视频（200MB 规则）若上线需先调网关 body size + 超时（用户交代部署前评估）。

## GitHub

- 仓库 `https://github.com/lookxun/FlashMuse_Agent`，本地 origin 已指向它，identity `lookxun <lookxun@users.noreply.github.com>`。`gh` CLI 未安装。
- `.env`/`.env.local`/密钥/密码/签名 URL **绝不进 Git 和交接文档**。
