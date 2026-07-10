# 迁移：马来 BytePlus → 腾讯云新加坡（进行中）

Last updated: 2026-07-10 China time.
状态：**阶段1 已完成（腾讯独立 Docker 部署 + IP 测试，用户已测 OK、实例已清空为全新态）；阶段2/3/4 未开始。**

> 本文件曾因写入编码损坏变成乱码，已于 2026-07-10 用干净 UTF-8 重写。本文件是本次迁移的**权威可读记录**；同类信息也同步在 `01-current-status.md` + `05-next-actions.md` 顶部 + `CHANGELOG.md` 顶部。回复风格：简洁直接中文。

---

## 一、为什么迁移

- 现主服务器在**马来 BytePlus `101.47.19.109`**（main.venusface.com），跑 Next.js / API / PostgreSQL / 媒体。用户全走阿里入口 `ali.venusface.com` 反代马来。
- **马来↔阿里跨境公网链路长期 20~50% 丢包**，是全站慢、上传慢、灰屏的总根源（BBR / nginx 调优只治标）。
- 实测下载速度：马来 `101.47.19.109` ~0.07 MB/s、延迟 351ms；腾讯云新加坡 `119.28.116.16` ~2.27 MB/s，**快约 32 倍**。
- **用户决定**：主服务器从马来迁到腾讯云新加坡 `119.28.116.16`，马来弃用；阿里保留，由"阿里镜像马来"改成"阿里镜像腾讯"。

## 二、硬约束（务必遵守）

- 腾讯这台**还跑着其它项目，绝不能影响**：
  - `/opt/PS-`（CinematicFlow）：容器 `ps--frontend`(宿主 3000)、`ps--backend`(8001)、`ps--db`(postgres 5432)。
  - `/home/ubuntu/VibeSocial`：`vibesocial-nginx`(宿主 **80**)、`vibesocial-backend`(8000)、minio、postgres。
  - 各有独立 docker 网络 `ps-_default`、`vibesocial_default`。
- 宿主机上**没有** nginx/node/pm2/ffmpeg/psql（全在各自容器里）。80/3000/5432/8000/8001 端口已被占用。
- **FlashMuse 专门用宿主端口 5000**，独立 docker 网络 `flashmuse_default`，与其它项目完全隔离。腾讯安全组已放行 22/80/3000/8001，另为本项目开了 5000。ufw 未启用。
- 我们**没有腾讯云 API 密钥**（安全组改不了、只能用已开端口）。

## 三、阶段划分 + 进度

1. **阶段1｜在腾讯独立部署 + IP+端口测试**（不碰域名/阿里/马来）。重点：模型无 403 + 生成/上传/登录全跑通。→ **已完成，用户测 OK，实例已清空为全新态。**
2. **阶段2｜夜里接阿里 + 停服**：连通腾讯↔阿里，挂维护/停服（用户暂不可访问）。→ 未开始。
3. **阶段3｜数据迁移**：马来 PostgreSQL + `/generated` 媒体迁到腾讯；阿里反代目标从马来 IP 改腾讯 IP；验收后放开访问。→ 未开始。
4. **阶段4｜收尾**：观察几天，调整/开启 ali-sync 方向，稳定后正式弃用马来。→ 未开始。

## 四、腾讯服务器信息

- IP `119.28.116.16`，Ubuntu 24.04，用户 `ubuntu`（免密 sudo）。
- 密钥 `E:\project\【2】server\腾讯云_新加坡服务器\CinematicFlow.pem`；同目录有地址文件 `腾讯云_新加坡服务器地址.txt`。
- **Windows 权限坑**：pem 权限太开放，ssh 会拒用。先复制到临时目录再锁权限：
  - `Copy-Item` 到 `C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem`
  - `icacls <copy> /inheritance:r`；`icacls <copy> /grant:r "ASUS:(R)"`
  - 之后用这个副本 ssh/scp：`ssh -i "<临时副本>" ubuntu@119.28.116.16`
- 资源：4 核 / 7.4G 内存 / 磁盘 197G。
- **国内→新加坡上传很慢（实测 ~68KB/s），大文件 scp 会超时**。对策：源码包排除大目录（node_modules/.next/public/generated/public/home-assets 大视频），压到 <1MB；或走马来→新加坡直传（马来↔新加坡数据中心快）。

## 五、栈结构（含 nginx）+ 已做的事

部署位置 `/opt/flashmuse/`：
- `app/`（源码，含 Dockerfile）
- `docker-compose.yml`
- `data/{.env.local, generated, runtime, pgdata, home-assets, nginx/flashmuse.conf}`

**方案 A：完全隔离的独立 Docker 栈**，三个容器（都在 `flashmuse_default` 网络）：
- `flashmuse-db`：`postgres:16-alpine`，**不暴露宿主端口**（只在 compose 内网，避开已占用的 5432），数据卷 `data/pgdata`。DB 密码随机生成，写在 `docker-compose.yml` 与 `data/.env.local` 的 DATABASE_URL。
- `flashmuse-app`：build `./app`，只 `expose 3000`（内部），挂载 `.env.local`(可写)、`generated`、`runtime`(=.runtime)、`home-assets`。`docker-entrypoint.sh` = `npx prisma migrate deploy` + `npm run start`。
- `flashmuse-nginx`：`nginx:alpine`，**对外 `5000:80`**，服务 `/generated`+`/home-assets` 静态（bind-mount 只读 `data/generated`→`/srv/generated`、`home-assets`→`/srv/home-assets`）+ 反代其余到 `flashmuse-app:3000`。配置 `data/nginx/flashmuse.conf`。
  - ⚠️ **为什么必须有 nginx**：Next `next start` 只服务**构建时已存在**于 `public/` 的静态文件，而 `.dockerignore` 排除了 `public/generated` → Next 对 `/generated/*` 一律 404。马来/阿里一直由各自 nginx 服务 `/generated`、从不经 Next；纯 Docker 栈缺这层就图片/视频全裂。

**仓库文件**（都已 commit）：`Dockerfile`、`.dockerignore`、`docker-entrypoint.sh`、`docker-compose.yml`（含 nginx service）、`nginx/flashmuse.conf`、`next.config.ts`（给 `/generated`+`/home-assets` 加长缓存头，修首页切视频黑闪）。

**代码一致性**：部署时对马来 `/var/www/flashmuse` 与本地做过 md5 核对，194 个源码文件逐字节一致，仅 `next.config.ts` 不同（缓存改进）。**腾讯平台代码 = 马来线上，无代码漂移。**

- home-assets：只传了 lite 套 + logo + 备案图（约 7MB）；大的原始 hero 视频（~110MB）按用户要求不传。
- DB：**全新空库**，所有 Prisma 迁移已 apply（含 `20260710000000_generation_job_name_reservations`、`20260710010000_signup_credits_default_0`）。worker 已启动。

## 六、阶段1 有意保留的环境差异（阶段2/3 切换时要改回）

1. `NEXT_PUBLIC_*` 构建时留空（仅 build arg 传了 `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=true`）→ 客户端走同源，适合 IP 测试。**切域名时要用 venusface 值重 build**，并处理硬编码的 IP/域名判断：`src/app/page.tsx`（`getCurrentHomeSite` 里加了腾讯 IP `119.28.116.16` 判国际服/Intl 标识）、`src/components/chat-workbench.tsx` 及其它文件里的马来 IP `101.47.19.109`/阿里 IP `101.37.129.164`/venusface 域名判断、`NEXT_PUBLIC_PRIMARY_BASE_URL` 等——都要改成腾讯正式域名/host。
2. `ALI_SYNC_GENERATED_ENABLED=false`（阶段3 接阿里再开；镜像已装 rsync/ssh，key 需挂进容器）。
3. `FORCE_INSECURE_AUTH_COOKIE=true` + 无 `AUTH_COOKIE_DOMAIN`（因现在是 IP+HTTP）。上 HTTPS/域名时改回。
4. 后台"服务器信息"页 `server-info/route.ts` 硬编码马来/阿里 SSH，在这台会失效（非核心），切换后再改。
5. 首页大尺寸 hero 视频未传（不影响功能）。
6. `.env.local` 由马来 prod 派生（API key/模型偏好一致），改动：DATABASE_URL→容器库、删 `AUTH_COOKIE_DOMAIN`、加上第2/3 条开关。**AUTH_SECRET 保持与马来一致**（阶段3 迁数据后老会话仍有效）。⚠️ `.env.local` 是可写状态文件：后台"模型开关/系统设置/上传规则"保存会改写它，API key 运行时也从它读（`getLocalEnvValue`），所以它是 bind-mount 的可写文件、重启/重建不丢。
7. 注册送积分：本 session 改成默认 0（schema `@default(0)` + 迁移 `20260710010000_signup_credits_default_0`）。⚠️ 阶段3 pg_dump 会带来马来的 CreditSetting 值覆盖它，正式若要 0 需迁移后再确认。

## 七、阶段2/3/4 下一步（用户测试已 OK，可推进）

**阶段2（夜里）**：接阿里 + 停服。阿里加一个**独立 conf** 反代 FlashMuse 到腾讯 5000（别动阿里上其它项目）。或先挂维护页。阿里登录信息 `E:\project\【2】server\阿里服务器\`；从马来跳阿里用 `/root/.ssh/flashmuse_to_ali_ed25519`。

**阶段3（数据迁移，重头）**：
- PostgreSQL：马来 `pg_dump` → 灌入腾讯 `flashmuse-db`（`docker exec` psql 或临时暴露端口）。注意马来 `.env.local` 有两个 DATABASE_URL，用第一个；psql 要去掉 `?schema=`。
- 媒体：马来 `/var/www/flashmuse/public/generated` rsync → 腾讯 `/opt/flashmuse/data/generated`（量大，走马来→新加坡）。
- 完整 home-assets（含大视频，如需）补传。
- 阿里反代目标：马来 IP → 腾讯 IP。
- 改 `NEXT_PUBLIC_*` / 硬编码 IP 为域名并重 build（见第六节）；关 insecure cookie、设 cookie domain；开 ali-sync（方向：腾讯→阿里）。
- 用 `.runtime/deploy-checks/prod-deploy-snapshot.mjs` 对数据完整性做前后对比。

**阶段4**：马来保留热备，稳定几天后弃用。

## 八、操作忌讳（踩过的坑）

- Tencent pem 权限：先 `icacls` 锁权限副本再用（见第四节）。
- **PowerShell 不能 heredoc / 内联复杂 bash（sed/awk/嵌套引号会崩）**：把脚本写成本地 `.sh` → `scp` → `ssh "sed -i 's/\r$//' /tmp/x.sh && bash /tmp/x.sh"`。psql/SQL 同理：写本地 `.sql` → scp → `docker cp` 进 db 容器 → `psql -f`。
- 服务器改 compose / 配置：本地改临时副本重传，别用 ssh 内联 sed（PowerShell 转义会坏）。
- **改文件一律用 edit 工具/写本地文件再传**，别用 PowerShell `Set-Content`/`Out-File` 直接写中文——本文件当初就是这么写坏成乱码的。
- docker 命令用 `sudo docker ...`。compose 用 `sudo docker compose ...`。
- 重建 app：scp 改动文件到 `/opt/flashmuse/app/...` → `cd /opt/flashmuse && sudo docker compose up -d --build flashmuse-app`（npm 层有缓存，只重跑 COPY 之后）。后台跑 `nohup ... >/home/ubuntu/log 2>&1 &` 再轮询，避免工具 120s 超时。
- 曾把 CinematicFlow.pem 临时推到马来做中转，用完已删。

## 九、2026-07-10（续 session）本对话做的事

阶段1 测试中暴露并修复的迁移专属问题 + 产品微调（细节见 CHANGELOG 顶条）：
1. **补 nginx 容器**（根治 `/generated` 404，见第五节）。
2. **修资产库上传"保存失败"**：EXDEV 跨设备 rename（`.runtime` 与 `public/generated` 是两个 bind-mount/设备），`src/lib/local-assets.ts` `commitTemporaryUploadedImage` 改 writeFile+unlink。
3. **资产生成弹窗加"正在加载中"转圈**（远程 url 加载空白期；**未动**远程→本地替换流程，那是刻意设计）。
4. **注册送积分默认 0**（schema + 迁移，见第六节第7条）。
5. **首页 logo 后 "Intl." 国际服标识**（`page.tsx` 腾讯 IP 归国际主站分支）。
6. **用户测完 → 清空腾讯为全新部署状态**：`compose down` + 删空 pgdata/generated/runtime + `up -d`（重建空库 + migrate deploy）。两个测试账号(admin `lookxun@163.com` + `ID_822874`)及全部媒体清除。验证 User/MediaAsset/WorkspaceSession=0、generated 0 文件、signup=0、三容器 Up、home 200。

**三方状态**：本地 = GitHub = 交接文档（commit `c46df4c`）。腾讯 = 干净全新独立实例（含 nginx）在跑。马来/阿里 = 线上照常、只有名称预约那批，未部署本 session 的腾讯专属改动。
