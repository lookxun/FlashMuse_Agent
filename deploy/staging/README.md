# 测试服（staging）基础设施文件

这套文件对应线上测试服。测试服 = 和正式服同一份代码、数据/环境/端口完全隔离，用于不影响真实用户的线上验证。
完整说明见 `handover/03-deploy-and-servers.md` 顶部「测试服（staging）+ 部署铁律」一节。

## 部署语义铁律
- 用户说「部署掉 / 部署一下」= **只部署测试服**，绝不动正式服。
- 只有用户明确说「把正式服部署掉 / 更新正式服 / 上线正式服」= 先一次性部署测试服 → 验证 → 再把测试服代码原样同步到正式服。永不跳过测试服、永不直接改正式服代码。
- 版本号自增只在「部署测试服」这步：先 `node scripts/bump-version.mjs`（`src/lib/app-version.ts` 的 `APP_VERSION` 四段 100 进制最右段 +1）。正式服部署绝不自增，原样带走号 → 「版本号一样 = 代码一样」。

## 入口地址
- HTTPS（推荐，2026-07-20 加）：https://staging-static.venusface.com/ 、后台 /admin
- IP（旧，仍可用）：http://101.37.129.164:8080/ 、后台 /admin
- 端口：腾讯安全组放行 5001（阿里→腾讯）、阿里安全组放行 8080（浏览器→阿里）、443（HTTPS）。

## HTTPS 域名（staging-static.venusface.com）
- 用途：给测试服上传/静态/generated 一个可信 https 地址，让 gpt-5.4-image-2 img2img 参考图走真实 URL 分支（OpenRouter 新接口只认 https，否则回退 base64）。
- DNS：`staging-static.venusface.com` → `101.37.129.164`（阿里，阿里云 DNS A 记录）。
- 证书：阿里 Let's Encrypt `/etc/letsencrypt/live/staging-static.venusface.com/`（certbot --nginx 签发，自动续期）。
- nginx：`flashmuse-staging-static-ssl.conf` → 阿里 `/etc/nginx/sites-enabled/flashmuse-staging-static-ssl`（443 SSL，克隆 8080 行为：本地静态镜像 + 反代腾讯 :5001；80→443 跳转 + acme-challenge）。
- env（已写进 `make-staging-env.sh`）：`NEXT_PUBLIC_PRIMARY_BASE_URL` 与 `NEXT_PUBLIC_UPLOAD_BASE_URL` 都设为 `https://staging-static.venusface.com`（⚠️ PRIMARY 优先级最高，只改 UPLOAD 无效，参考图 base 用的是 PRIMARY）；`UPLOAD_CORS_ORIGINS` 含该域名。改 `.env.local` 后 `docker compose up -d --force-recreate staging-app` 即生效（服务端读，无需重新 build）。

## 文件说明
- `docker-compose.yml` → 腾讯 `/opt/flashmuse-staging/docker-compose.yml`。独立栈 flashmuse-staging（staging-app/db/nginx，网络 flashmuse_staging_default，宿主端口 5001）。build arg `NEXT_PUBLIC_IS_TEST: "true"` 打测试服标识。
- `flashmuse-staging.conf` → 腾讯 `/opt/flashmuse-staging/data/nginx/flashmuse-staging.conf`。容器内 nginx，服务 /generated、/home-assets，其余反代 staging-app:3000。
- `flashmuse-test-8080.conf` → 阿里 `/etc/nginx/sites-enabled/flashmuse-test-8080`。listen 8080，静态从 `/var/www/flashmuse-static-test/` 读，其余反代腾讯 119.28.116.16:5001。
- `flashmuse-staging-static-ssl.conf` → 阿里 `/etc/nginx/sites-enabled/flashmuse-staging-static-ssl`。listen 443 SSL（server_name staging-static.venusface.com），与 8080 同行为 + 挂 Let's Encrypt 证书 + 80→443 跳转。
- `sync-ali-test.sh` → 腾讯 `/opt/flashmuse-staging/sync-ali-test.sh`。把测试服 `_next/static`+`home-assets`+`generated` 同步到阿里测试镜像。每次部署测试服后必跑（否则 chunk 404）。
- `make-staging-env.sh` → 从正式服 `.env.local` 派生测试服 `.env.local`（改 cookie/同步目录/地址/加 NEXT_PUBLIC_IS_TEST）。仅首次搭建或需重建 env 时用。

## 首次搭建 / 重建步骤（摘要）
1. `sudo mkdir -p /opt/flashmuse-staging/data/{pgdata,generated,runtime,home-assets,nginx}`
2. `sudo cp -a /opt/flashmuse/app /opt/flashmuse-staging/`；`cp -a` home-assets；`cp` ali-sync key 到 data/runtime。
3. 放 `docker-compose.yml`、`data/nginx/flashmuse-staging.conf`。
4. 跑 `make-staging-env.sh` 生成 `data/.env.local`。
5. `docker compose up -d staging-db` → 导数据（可选）→ `docker compose up -d --build staging-app staging-nginx`。
6. 阿里：放 `flashmuse-test-8080.conf`，`mkdir -p /var/www/flashmuse-static-test/{_next/static,home-assets,generated}`，`nginx -t && systemctl reload nginx`。
7. `bash sync-ali-test.sh`。
8. 腾讯放行 5001、阿里放行 8080（云控制台安全组）。

## 清空测试库（重新注册用）
`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO flashmuse;` 后重启 staging-app（entrypoint 自动 migrate deploy 重建空表）。白名单走 env `ADMIN_EMAILS`，不受影响。
