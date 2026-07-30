# Next Actions（2026-07-21 重建）

> 历史 END-OF-SESSION 记录都在 `historical-handover-docs-last-used-2026-07-21/05-next-actions.md`（很长）。这里只留当前有效待办。

## ✅ 当前状态：**无待部署、无未推**（2026-07-30 第二十次会话末）

**四方同步 = `v1.0.0.56`**（正式服 = 测试服 = 本地 = GitHub），四域名全 200，无 Prisma 迁移。
本次做完的事、实测数据、M025 的最终结论 → **`01-current-status.md` 顶部**。

### ⭐ 接手可以做的事（按优先级，都不急）

1. **红字排查**：仍是 v54 那一轮，**用户交代攒多了再查、别主动查、⛔ 别跑归档脚本**。
   去 `/admin?tab=failures` 看实时数字（上次快照：正式服待排查 9 条 / 全是审核类 / 兜底桶 0 条）。
   方法论在 `07-red-error-triage-and-archive.md`。
2. ⛔ **M025 已判定不做**（②工作流 canvas 瘦身）—— 收益被 gzip 吃掉了，
   **别再翻出来做**，理由和实测数据在 `06-memo-tasks.md` 的 M025。
3. **[已拍板不主动做] M023**：给 `DATABASE_URL` 显式配 `connection_limit`，等它下次真犯病再取现场数据。
4. 存量小问题见本文件下方「存量待办」。

### ⭐ 本批留下的可复用工具（都在 `.runtime/`，不进 git）

| 文件 | 干什么 |
|---|---|
| `m025.js` | 量每个用户 canvas 的**未压缩 vs gzip** 字节 + 模拟瘦身后能再省多少（docker cp 进容器跑） |
| `baseline-prod.sh` / `after-prod.sh` | nginx 日志按响应体字节排序 Top10 + 数「落盘临时文件」告警条数 + 查 5xx |
| `check-feedback.sh` | 查某用户 `UserWorkspaceState.state->'feedbackLogs'` 条数（验 PUT 合并有没有抹数据） |
| `push-staging-nginx.sh` / `push-ali-test-nginx.sh` / `push-prod-nginx.sh` | 三处 nginx 的部署脚本（**自带备份 + `nginx -t` + 失败自动回滚 + 先打 diff**） |
| `prodsync56.sh` / `syncali56.sh` / `pub56prod.sh` / `pub56.sh` | 正式服备份+对齐 / 静态同步阿里 / 发布版本信号+健康检查 / 测试服发布信号 |

⭐ **`.runtime/m025.js` 那个"顺手量 gzip"的姿势值得记住**：
以后判断"要不要为了省字节改代码"，**先用 `zlib.gzipSync` 量一遍压缩后的大小**，
别拿未压缩字节做决策 —— 本次就是这一步把一个"看起来省 655KB"的优化否掉了。

---

## 历史：第十九次会话攒的那批部署清单（已于第二十次会话执行完毕，留档备查）

> ✅ **本节已全部执行完毕**（v1.0.0.56 两服上线 + nginx 4 处 + 11 项验收 + M025 判定）。
> 下面原文只作为「一次含 nginx 的完整部署交接长什么样」的模板留档，**不要再照着跑一遍**。

## 🚀🚀 （已完成）接手第一件事：**直接部署这两批**（2026-07-30 第十九次会话末，用户已明确授权）

> ✅ **不用再问用户要不要部署。** 用户 2026-07-30 明确交代「保证无缝接让下个 AI 部署」+ 确认「下个 AI 可以直接部署」。
> 已授权：**先测试服 → 实机验收 → 再原样同步正式服**（铁律顺序不能跳）。
> ⭐ 本批**比平常多一步**：除了代码，还要**部署 4 处 nginx 配置**（第 2 步，命令可直接抄）。
> ⛔ **只部署"已做完的"那些**（批次 A + B 的 ①③④）。**② 工作流 canvas 瘦身没做**（= M025，等用户拍板），
> 别顺手去动它。
> 服务器信息 / 命令模板照抄 **`03-deploy-and-servers.md`**；两批改动的文件清单在 `01-current-status.md` 顶部；
> 做了什么在 `CHANGELOG.md` 顶部。

### 第 0 步：确认起点

| 位置 | 版本 | 状态 |
|---|---|---|
| 线上（正式服 = 测试服 = GitHub） | `v1.0.0.55` | 三者一致 |
| 本地 | `v1.0.0.55` + **两批未提交** | **没 bump**；`npx tsc --noEmit` 全绿；**无 Prisma 迁移** |

```
git status --short
```
应看到（17 改 + 3 新增）：
```
 M AGENTS.md                                      本次新增两条铁律
 M deploy/staging/flashmuse-staging.conf          ④ nginx（腾讯测试服）
 M deploy/staging/flashmuse-test-8080.conf        ④ nginx（阿里测试服入口）
 M nginx/flashmuse.conf                           ④ nginx（腾讯正式）+ 顺手对齐了仓库漂移
 M handover/00-README.md
 M handover/01-current-status.md
 M handover/05-next-actions.md
 M handover/06-memo-tasks.md
 M handover/CHANGELOG.md
 M src/app/admin/admin-account-features-panel.tsx A 白名单开关置灰
 M src/app/admin/api/users/admin-whitelist/route.ts A 拒绝关闭永久管理员
 M src/app/admin/api/users/feature-bulk/route.ts   A 一键全关时保留永久管理员
 M src/app/admin/page.tsx                          A 传 adminWhitelistLocked
 M src/app/api/workspace-state/route.ts            B ① feedbackLogs 不下发 + PUT 合并
 M src/lib/admin.ts                                A getAdminEmails 并入永久管理员
 M src/lib/system-settings.ts                      A 落盘时补回永久管理员
 M src/lib/workspace-sessions.ts                   B ③ 投影 + PUT 恢复 + 上限 50→30
?? deploy/ali/ali-add-proxy-buffers.sh             ④ 阿里正式的幂等增量脚本
?? scripts/measure-workspace-state-size.mjs        量响应体大小/验证收益的工具
?? src/lib/permanent-admins.ts                     A 唯一来源常量
```

⚠️⚠️ **打 tgz 时别漏这三个新文件**（尤其 `src/lib/permanent-admins.ts`，漏了 build 直接失败）。
⚠️ `nginx/` 和 `deploy/` 里那几个 conf **不在 app 的 tgz 里**，是**第 2 步单独部署**的，别混在一起。

### 第 1 步：部署测试服（代码）
照 `03-deploy-and-servers.md`「测试服部署流程」。要点：
1. `node scripts/bump-version.mjs` → **v1.0.0.55 → v1.0.0.56**（⚠️ 只在这一步 bump）
2. `npx tsc --noEmit` 必须全绿
3. 打 tgz（**含 `src/lib/permanent-admins.ts`**）→ scp → 解到 `/opt/flashmuse-staging/app`
4. `nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台跑 + 轮询 tail）
   - **无迁移**，entrypoint 应输出 "No pending migrations"
5. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`
6. sed 改 `PUBLISHED_APP_VERSION: "v1.0.0.56"` + `force-recreate staging-app`

### 第 2 步：⭐ 部署 nginx（本批特有，**代码部署完再做**；下面命令可直接抄）

> 统一前置（下文 `$PEM` 就指它）：
> `$PEM = "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem"`
> ⚠️ 4 处都要做：腾讯测试 / 阿里测试 / 腾讯正式 / 阿里正式。**测试服那两处先做、验证完再做正式那两处。**

**2.1 腾讯测试服（容器 `flashmuse-staging-staging-nginx-1`）**
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "deploy\staging\flashmuse-staging.conf" ubuntu@119.28.116.16:/tmp/
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 @'
set -e
sudo cp /opt/flashmuse-staging/data/nginx/flashmuse-staging.conf /opt/flashmuse-staging/data/nginx/flashmuse-staging.conf.bak.$(date +%Y%m%d-%H%M%S)
sudo sed -i "s/\r$//" /tmp/flashmuse-staging.conf
sudo cp /tmp/flashmuse-staging.conf /opt/flashmuse-staging/data/nginx/flashmuse-staging.conf
sudo docker exec flashmuse-staging-staging-nginx-1 nginx -t
sudo docker exec flashmuse-staging-staging-nginx-1 nginx -s reload
echo STAGING_NGINX_OK
'@
```
⚠️ `nginx -t` 不过就把 `.bak` 拷回去再 reload。

**2.2 阿里测试服入口（阿里主机 `/etc/nginx/sites-enabled/flashmuse-test-8080`，走腾讯跳板）**
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "deploy\staging\flashmuse-test-8080.conf" ubuntu@119.28.116.16:/tmp/
```
然后把下面存成本地 `.runtime/push-ali-test-nginx.sh`，scp 到腾讯 `/tmp` 再 `sudo bash`（⛔ 别用 ssh 内联，PowerShell 会吃掉引号）：
```bash
#!/bin/bash
set -e
KEY=/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519
ALI="ssh -o StrictHostKeyChecking=no -i $KEY root@101.37.129.164"
sed -i 's/\r$//' /tmp/flashmuse-test-8080.conf
scp -o StrictHostKeyChecking=no -i $KEY /tmp/flashmuse-test-8080.conf root@101.37.129.164:/tmp/
$ALI 'set -e
  mkdir -p /root/nginx-backups
  cp /etc/nginx/sites-enabled/flashmuse-test-8080 /root/nginx-backups/flashmuse-test-8080.$(date +%Y%m%d-%H%M%S).bak
  cp /tmp/flashmuse-test-8080.conf /etc/nginx/sites-enabled/flashmuse-test-8080
  nginx -t && nginx -s reload && echo ALI_TEST_NGINX_OK'
curl -s -o /dev/null -w "8080=%{http_code}\n" http://101.37.129.164:8080/
```

**2.3 腾讯正式服（容器 `flashmuse-flashmuse-nginx-1`）**
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "nginx\flashmuse.conf" ubuntu@119.28.116.16:/tmp/
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 @'
set -e
sudo sed -i "s/\r$//" /tmp/flashmuse.conf
echo "===== diff（只该看到本次新增的 proxy_buffer*/gzip 那几行）====="
sudo diff /opt/flashmuse/data/nginx/flashmuse.conf /tmp/flashmuse.conf || true
'@
```
⭐ **先看 diff**：仓库这份已按服务器实际内容对齐过（含 443 server 块 + `/generated` 的 CORS 头），
所以 diff 里**只应该出现 `proxy_buffer*` / `proxy_max_temp_file_size` / `gzip*` / `Accept-Encoding` / 注释**这些新增行。
若出现别的差异 = 期间有人手改过服务器，**先搞清楚再覆盖**。确认后：
```powershell
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 @'
set -e
sudo cp /opt/flashmuse/data/nginx/flashmuse.conf /opt/flashmuse/data/nginx/flashmuse.conf.bak.$(date +%Y%m%d-%H%M%S)
sudo cp /tmp/flashmuse.conf /opt/flashmuse/data/nginx/flashmuse.conf
sudo docker exec flashmuse-flashmuse-nginx-1 nginx -t
sudo docker exec flashmuse-flashmuse-nginx-1 nginx -s reload
echo PROD_NGINX_OK
'@
```

**2.4 阿里正式（ali/static）**：⛔ **绝对不要整份覆盖** ——
那份 `flashmuse-static-ip` 里还有**别的项目**的配置（`/tiantangqiyuan/`），整份覆盖会违反「绝不影响其它项目」铁律。
跑仓库里的幂等增量脚本（自带备份 + `nginx -t` + 失败自动回滚 + 跑完打四域名状态码，可重复跑）：
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "deploy\ali\ali-add-proxy-buffers.sh" ubuntu@119.28.116.16:/tmp/
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 "sed -i 's/\r$//' /tmp/ali-add-proxy-buffers.sh && sudo bash /tmp/ali-add-proxy-buffers.sh"
```
期望输出里有 `插入了 2 处`（正式那份有两个 server 块）+ `nginx -t 通过并已 reload` + 四域名 200。
⭐ 若输出 `已经加过了（找到 marker），幂等跳过` = 之前跑过，正常。

**2.5 ⭐ 验证 gzip 真的生效了**（4 处都验，`Content-Encoding: gzip` 必须出现）
```powershell
"测试服(阿里8080)"; curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" http://101.37.129.164:8080/api/models | Select-String "content-encoding|HTTP/"
"正式(腾讯main)";   curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" https://main.venusface.com/api/models | Select-String "content-encoding|HTTP/"
"正式(阿里ali)";    curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" https://ali.venusface.com/api/models | Select-String "content-encoding|HTTP/"
```
⚠️ `/api/models` 响应可能小于 `gzip_min_length 1024` 而不压 —— 那就换成登录后打
`/api/workspace-state?summary=1&panel=chat`（浏览器 Network 里看最直观，同时能验响应体变小）。

### 第 3 步：测试服实机验收（⭐ 是必须点到的）

测试账号 `12424740@qq.com` / `dragonstar`。

| # | 怎么测 | 期望 |
|---|---|---|
| ⭐1 | 后台 `/admin?tab=account-features` 看 `lookxun@163.com` 那行 | 「后台白名单」开关**蓝色但点不动**，hover 提示「该账号是永久管理员…」 |
| ⭐2 | 直接打接口试着关它（绕过前端）：`POST /admin/api/users/admin-whitelist {userId, whitelisted:false}` | 返回 **400**「该账号是永久管理员，后台白名单不可关闭」 |
| 3 | 别的账号的白名单开关 | 照旧可开可关 |
| ⭐4 | **打开工作台，Network 看 `/api/workspace-state?summary=1&panel=chat`** | ① 响应**明显变小**；② 响应头有 **`Content-Encoding: gzip`**；③ **响应里没有 `feedbackLogs`** |
| ⭐5 | 对话流：滚到底看历史 | 首屏 **30 条**（原 50），往上有「加载更早的消息」且能正常加载出来 |
| ⭐6 | **随便点一条历史图片/视频消息的「使用提示词」** | 提示词**正常显示、和原来一致**（这是验③投影没把提示词弄丢，**最关键的一条**） |
| ⭐7 | 点几个「喜欢/不喜欢/回答不对」，刷新页面，再点一次 | 不报错；**去 DB 查 `UserWorkspaceState.state->'feedbackLogs'` 条数应该在增长、不能被清零**（验 ① 的 PUT 合并） |
| ⭐8 | 发一条新消息 + 生成一张图，刷新 | 消息、图、提示词全在（验 ③ 的 PUT 恢复没把库里字段删掉） |
| 9 | 工作流模式：点节点、拖节点、切换工作流 | 一切照旧（本批**没动** canvas，②还没做） |
| 10 | 资产库 / 后台各页 | 正常，0 控制台 error |
| ⭐11 | 跑一次生图 + 一次生视频 | 成功 |

⚠️ **#6/#7/#8 是本批风险最集中的三条**（投影 + PUT 恢复），务必实测。
⭐ **最好拿"聊得多、有很多图文消息"的号验**（测试服 `12424740@qq.com` 有资产）。

### 第 4 步：同步正式服
照 `03`「正式服部署流程」（备份 → rsync 对齐 → build → 同步 `.next/static` 到阿里**正式**镜像 → 发布信号 → 四域名健康检查）。
⚠️ **不再 bump**。⚠️ **正式服的 nginx（2.3 / 2.4）也要做**。

### 第 5 步：两台都真上号巡检（铁律，`03` 的「最小巡检 6 项」）
⭐ 本批动了工作区读写链路 → **除 6 项之外，正式服也要再验一遍上面的 #4/#6/#8**。

### 第 6 步：⭐ 量一下实际收益（本批特有，值得做）
部署后重跑一次 nginx 日志排序，确认那个接口的响应体真的下来了：
```
sudo docker logs --tail 50000 flashmuse-flashmuse-nginx-1 2>&1 | grep 'workspace-state' \
 | awk '{for(i=1;i<=NF;i++) if($i ~ /^"(GET|PUT|POST)$/){print $(i+4)"\t"$(i+1); break}}' | sort -rn | head -10
```
- 改动前：Top 是 **1,188,114 字节**
- 期望：明显变小（②还没做的用户仍可能有几百 KB，见 M025）
- ⭐ 也可以把 `scripts/measure-workspace-state-size.mjs` 拷进容器再跑一次对比

### 第 7 步：收尾
- `git add` 全部（含 2 个新增）→ commit → push
- 更新 `00-README.md` / `01-current-status.md` / 本文件顶部为"四方同步 v1.0.0.56"
- ⛔ **不要跑归档脚本**（红字仍是新一轮，攒够再说）
- ⭐ **回头问用户 M025（②工作流 canvas 瘦身）要不要做** —— 那是剩下最大的一块（单用户 655KB）

### ⚠️ 回滚
- **代码**：按 `03` 用 `/opt/flashmuse/app-backups/<时间戳>` 复原。
- **nginx**：正式/测试的 conf 覆盖前都要留 `.bak`；阿里正式那个脚本自动备份到 `/root/nginx-backups/`。
- ⭐ **本批无迁移**，数据库不用动。
- ⚠️ **③ 的投影若真出问题**（提示词显示不对），最快的止血是把 `workspaceMessageRowsToMessages` 里
  `projectWorkspaceMessageForClient(...)` 这层调用去掉（一行），立刻恢复原样 ——
  **库里的数据一直是完整的**，投影只影响下行。

## 📌 其它状态（部署完之后看这里）

### 红字：仍是 v54 那一轮，**别主动查、别跑归档脚本**
用户 2026-07-29 交代：「从 v54 部署完开始看后面新出现的红字，**等红字多了以后再排查**」。
第十九次会话末快照：正式服 **待排查 9 条 / 2 种、兜底桶 0 条、已归档 745**，
9 条**全是「审核 / 内容策略类」**（平台或模型拒绝，我们改不了 → 按铁律不归档、就该一直亮着）。
→ 量还很少就直接跟用户说"红字还没攒够，建议再等等"；量够了按 `07-red-error-triage-and-archive.md` 排。

### ⚠️ 运营上要留心的一点（v55 的既定副作用，不是 bug）
v55 那条迁移让「解除限制」**全站默认关**，正式服目前**只有 `lookxun@163.com` 开着**，其余 36 个账号都是关的。
原来靠全局开关吃专属 Endpoint ID 的用户，从 v55 起内容敏感的提示词会开始被平台拒。
→ **有人反馈"以前能出图现在被拒"，去 `/admin?tab=account-features` 把他的「解除限制」打开即可。**

### 存量待办
- **[⛔ 已判定不做] M025**：② 工作流 canvas 瘦身 —— **2026-07-30 第二十次会话按实测数据否掉**：
  gzip 上线后最大用户的 canvas 只有 105KB（未压缩 655KB），M025 还能省的只有 ~31KB，
  而病根（撑爆 32KB 缓冲被落盘）已被 `proxy_buffers 32 32k` 堵死、告警归 0。
  **别再翻出来做**，理由全文在 `06-memo-tasks.md` 的 M025。
- **[已拍板不主动做] M023**：给 `DATABASE_URL` 显式配 `connection_limit`，留 v54 那句红字当哨兵，等它下次真犯病再取现场数据。
  ⛔ 别照抄"25~30"（病因 A/B 解法相反）、别改 `.env.local`（会被 compose 覆盖）、别想在测试服压测求这个数。

---

## 历史：第十八次会话的部署清单（已于第十九次会话全部执行完，留档备查）

> ✅ **本节已于 2026-07-30 第十九次会话全部执行完毕**（v1.0.0.55 两服上线 + 14 项验收 + 两件手工事 + 收尾提交）。
> 下面内容只作为模板留档，**不要再照着跑一遍**。

## 🚀🚀 （已完成）接手第一件事：**直接部署**（2026-07-30 第十八次会话末，用户明确交代"下一个 AI 直接部署掉"）

> ⚠️ **不用再问用户要不要部署。** 已授权：**先测试服 → 实机验证 → 再整份同步正式服**（铁律顺序不能跳）。
> 服务器信息 / 命令模板照抄 **`03-deploy-and-servers.md`**。本节只列**本批特有**的东西。
> 本批做了什么，看 `CHANGELOG.md` 顶部「2026-07-30（第十八次会话）」那条（很详细）。

### 第 0 步：确认起点

| 位置 | 版本 | 状态 |
|---|---|---|
| 线上（正式服 = 测试服 = GitHub） | `v1.0.0.54` | 三者一致 |
| 本地 | `v1.0.0.54` + **24 改 + 7 新增未提交** | **没 bump**；`npx tsc --noEmit` 全绿；⭐ **有 1 个 Prisma 迁移** |

```
git status --short    # 应看到 24 个 M + 7 个 ??，清单原样列在 CHANGELOG 第 0 节
```

⚠️⚠️ **打 tgz 时务必带上这两个新目录，漏了会当场炸**：
- `prisma/migrations/20260730000000_user_unlock_limits_enabled/`（漏了 → 新列不存在 → 后台新页和所有生成链路查 `unlockLimitsEnabled` 全崩）
- `src/app/admin/api/users/{unlock-limits,admin-whitelist,feature-bulk}/`（漏了 → 后台开关点了 404）

### 第 1 步：部署测试服
照 `03-deploy-and-servers.md`「测试服部署流程」。要点：
1. `node scripts/bump-version.mjs` → **v1.0.0.54 → v1.0.0.55**（⚠️ 只在这一步 bump，正式服不再 bump）
2. `npx tsc --noEmit` 必须全绿
3. 打 tgz（**含 `src/lib/app-version.ts` + 上面那两个新目录**）→ scp → 解到 `/opt/flashmuse-staging/app`
4. `nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（**后台跑 + 轮询 tail**，防 120s 工具超时）
5. ⭐ **这次 entrypoint 的 `migrate deploy` 会真的跑一条迁移**（不再是 "No pending migrations"）→
   **去 tail 里确认它输出了 `20260730000000_user_unlock_limits_enabled` 且成功**
6. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`
7. sed 改 `PUBLISHED_APP_VERSION: "v1.0.0.55"` + `force-recreate staging-app`
8. 验证 `x-app-version` = v1.0.0.55，外网 `http://101.37.129.164:8080/` 200

### 第 2 步：⭐⭐ 部署后**必须手工做**的两件事（每台服务器都要，别漏）

**2.1 迁移把 `unlockLimitsEnabled` 默认设成 `false` = 全站解除限制"当场全关"。**
用户就是要这个（"所有开关默认关闭"），但**后果要知道**：原来靠全局开关吃着专属 Endpoint ID 的用户，
部署那刻起改发公开模型名 → **平台审核变严，内容敏感的提示词会开始被拒**。
→ **部署完立刻去 `/admin?tab=account-features`，把该给的账号手工打开「解除限制」**
（至少建议：正式服 `lookxun@163.com`、测试服 `12424740@qq.com`，否则你自己实机验生图就可能被拦）。

**2.2 把服务器 `.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS` 改成 `false`。**
它现在只是"拿不到 userId 时"的回落。留着 `true` 会造成语义矛盾（所有账号都关、边角调用却仍解除限制）。
- 正式服：`/opt/flashmuse/data/.env.local`；测试服：`/opt/flashmuse-staging/data/.env.local`
- 改完 `force-recreate` 对应 app 容器（env 变化必须重建）
- ⚠️ 先 `grep BYTEPLUS_UNLOCK_LIMITS` 看当前值，若本来就是 false 就不用动

### 第 3 步：测试服实机验收清单（⭐ 是必须点到的）

测试账号：`12424740@qq.com` / `dragonstar`。

| # | 怎么测 | 期望 |
|---|---|---|
| ⭐1 | 后台左侧出现「帐号功能管理」，点进去 | 4 张卡片 + 表格正常，0 控制台 error |
| ⭐2 | 点某账号的「解除限制」开关 | 状态能存下来（页面会 reload） |
| ⭐3 | 点表头「通用模式」总开关 | 弹**项目样式的白色确认框**（不是"localhost 显示"那种），确认后卡片数字变 |
| 4 | 「后台白名单」列表头 | **没有**总开关（按要求隐藏） |
| ⭐5 | 试着把**自己**的白名单开关关掉 | 弹出错框「不能把自己移出后台白名单」 |
| 6 | 「模型开关」页 BytePlus 那行 | 「解除限制」已消失、排版没错乱 |
| 7 | 「用户管理」页 | 卡片是 `正常用户/禁用用户 95/7`（**只有禁用数字红色**）+ 「在线用户」；表格**没有**通用模式列 |
| ⭐8 | 另开一个前台标签页登录着，回后台用户管理看自己 | 头像下沿有绿色「在线」胶囊，**横排**、**行高没变** |
| ⭐9 | **给自己开着解除限制**，真跑一次生图 + 一次生视频 | 成功（验三条链路 unlockLimits 透传没改坏） |
| ⭐10 | **把解除限制关掉**，用敏感提示词跑一次生图 | 失败，且红字是「模型因色情/暴力/隐私安全等原因拒绝出图…以下是模型返回的拒绝原因：“**输入的提示词文字被平台判定含敏感信息**”」（**不是**"更换参考素材"） |
| ⭐11 | 工作流：点一个图片节点/视频节点 | 快捷菜单出现「使用提示词」，点了在右侧生成带提示词+参考图的新节点；**画布不崩** |
| ⭐12 | 工作流：点开 02/04/08 什么都不做，切走再回来 | 左侧列表**顺序不动**（多切几次；第一次打开会存一次洗干净的数据） |
| ⭐13 | 工作流：拖一下节点 / 生成一张图 | **会置顶** |
| 14 | 对话流发一条消息、Agent 模式问一句 | 正常（验文本链路 unlockLimits 没改坏） |

⚠️ **#12/#13 是本批唯一"改完没被用户复验"的功能**（用户当时转去做后台了），务必实测。

### 第 4 步：同步正式服
照 `03-deploy-and-servers.md`「正式服部署流程」1~8 步（备份 → rsync 对齐 → build → 同步 `.next/static`
到阿里**正式**镜像 `flashmuse-static`（**不是** `-test`）→ 发布信号 → 四域名健康检查）。
⚠️ **不再 bump**，原样带 v1.0.0.55。⚠️ **正式服也要做第 2 步那两件手工事**。
⚠️ 正式服 entrypoint 同样会跑那条迁移 → 确认成功。

### 第 5 步：部署完两台都真上号巡检（铁律，`03` 的「最小巡检 6 项」）
curl 200 ≠ 没崩。登录 / 对话模式 / 工作流点节点不崩 / 资产库 / 真跑生图（动过视频链路 → **也要跑生视频**）/ 后台 `/admin` 0 error。
⭐ 本批动了图片·视频·文本**全部三条**生成链路，**生图和生视频都必须真跑**。

### 第 6 步：收尾
- `git add` 全部（含 7 个新增）→ commit → push（GitHub 同步）
- 更新 `00-README.md` / `01-current-status.md` / 本文件顶部为"四方同步 v1.0.0.55"
- ⛔ **不要跑归档脚本**（红字是新一轮，攒够再说，见 `07` 顶部红框）

### ⚠️ 回滚
出问题按 `03` 的回滚指引用 `/opt/flashmuse/app-backups/<时间戳>` 复原。
⭐ **注意迁移不会自动回滚** —— 但新列是"多一列、默认 false"，**旧代码不读它、完全兼容**，所以代码回滚即可，不用动数据库。

---

## 历史：第十七次会话的状态（已被上面这批取代，留档备查）

## ⭐ 当前状态（2026-07-29 第十七次会话更新）

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.54`**，四域名全 200，无待部署、无未推、无 Prisma 迁移。
✅ **两台都实机巡检过、0 控制台 error**（登录/对话/工作流点节点/资产库/真跑生图/真跑生视频/后台）。
✅ **红字整轮清零**：正式服归档 221 条、测试服 46 条，两服待排查 = 0，`B_xxx` 计数器归 0（下一条报错是 `B_1`）。

## 🎯 接手第一件事：**什么都别急着改**

用户 2026-07-29 明确交代：**「从部署完开始看后面新出现的红字，新一轮开始。等红字多了以后再排查问题。」**

所以现在**不要主动去排红字**（后台此刻是干净的 0 条，查不出东西）。正确动作：

1. 先去后台 `/admin?tab=failures` 看一眼**新一轮攒了多少条**（`待排查失败事件` 那个数字）。
2. **量还很少（比如 10 条以内）→ 直接跟用户说"红字还没攒够，建议再等等"**，然后等用户派新活。
3. **量够了 → 按 `07-red-error-triage-and-archive.md` 的方法论排查**（先用 `/admin?tab=failures` 这页，
   别手写 SQL；铁律：`failureReason` 是给用户看的文案，真实根因只在 `.runtime/*-diagnostics-log.jsonl` 里）。

⛔ **别再去翻 A 表**：A 表 9 条已在第十六次会话全部收口，且相关历史事件已在本次整轮清零里归档掉了。

### 唯一一个存量项（已拍板：不主动做，等它下次犯病）

**A4 真修复：给 `DATABASE_URL` 显式配 `connection_limit`** → 备忘 **M023**（`06-memo-tasks.md`，2026-07-30 已重写）。
⭐ **2026-07-30 用户拍板：现在不动，留 v54 那句红字当哨兵，等它下次真发生时趁热取现场数据再改。**
⛔ **别照着"25~30"闭眼改**：正确数值取决于病因是「池子太小」还是「慢查询占住连接不还」，**两者解法方向相反**；
⚠️ 也**别去改 `.env.local`**（compose 的 `environment:` 会覆盖它，改了无效）—— 要改**两个 `docker-compose.yml`**。
⛔ **别想"在测试服压测出并发数再同步正式服"**：测试服空载测不出、且与正式服共享同一台物理机（压测会拖慢正式服）。
详细的病因判别法（`pg_stat_activity` 那三步）+ 正确改法都写在 M023 里。目前**零复发**（最后一次 07-17）。

⛔ **已被用户否掉、别再提**：把参考图**缩尺寸**（最长边 2048）——
用户明确要求「**图片过大不要动**（不动尺寸）……如果是体积大可以压缩一下保存好，质量保证在 90%」。
v54 走的就是**只降质量、保尺寸**那条路，线上实测 -78.5%，够用。

---

## 历史：第十六次会话留下的部署清单（已于第十七次会话全部执行完，留档备查）


## 🚀🚀 （已完成）接手第一件事：**直接部署**（用户 2026-07-29 第十六次会话末明确交代"下一个 AI 直接部署"）

> ✅ **本节已于 2026-07-29 第十七次会话全部执行完毕**（v1.0.0.54 两服上线 + 实机验收 + 收尾 4 件事 + 整轮清零）。
> 下面内容只作为「一次完整部署长什么样」的模板留档，**不要再照着跑一遍**。


> ⚠️ **不用再问用户要不要部署。** 用户已授权：**先测试服 → 验证 → 再同步正式服**（铁律顺序不能跳）。
> 详细服务器信息 / 命令模板见 **`03-deploy-and-servers.md`**（照抄那两节的流程即可）。本节只列本次特有的东西。

### 第 0 步：确认起点（应该和下面完全一致）

| 位置 | 版本 | 状态 |
|---|---|---|
| 线上（正式服 = 测试服 = GitHub） | `v1.0.0.53` | 三者一致 |
| 本地 | `v1.0.0.53` + **12 个文件未提交** | **没 bump**；`npx tsc --noEmit` 全绿；**无 Prisma 迁移** |

```
git status --short   # 应该看到下面这 12 个（5 个 handover + 7 个代码/脚本）
```

**代码/脚本（7 个 src + scripts，必须全部带上）**：

```
src/components/chat-workbench.tsx                 上传完当场转正（A5 前端根治）+ 4 个跟踪上报
src/app/api/client-error/route.ts                 上传链路客户端上报落盘到 upload-diagnostics-log
src/app/api/video/route.ts                        data: 参考图落盘后送审（A5）／凭证过期当场重送审
src/lib/local-assets.ts                           ⭐ 上传大图按 90% 质量原地压缩（A1 真修，不动尺寸）+ .rotate()
src/lib/generation-jobs.ts                        runVideoJob 三个失败分支补日志 + 连续失败上限
src/lib/openrouter-video.ts                       轮询失败改用 video-provider-poll-failed 事件名
src/lib/video-diagnostics-log.ts                  summarizeVideoReference 补 data 分支
src/lib/error-message.ts                          A1/A2/A4 明确映射 + api key 收紧 + 环境类单列 + B5/B6 合并
src/lib/image-upload-validation.ts                格式白名单唯一来源 + 压缩阈值/质量常量
src/lib/upload-rules.ts                           删掉 bytePlusImageFormats
scripts/archive-resolved-generation-failures.mjs  新归档规则 + dry-run 明细 + 全局护栏
```

⚠️⚠️ **`scripts/archive-resolved-generation-failures.mjs` 千万别 `git checkout` 掉** ——
**归档动作第十五次会话已经在正式服 DB 上跑过了**（224 → 220 条待排查），但脚本代码一直没提交。
丢了它，以后再跑归档会**误吃新数据**（那条新规则 + 全局护栏都在里面）。

### 第 1 步：部署测试服

按 `03-deploy-and-servers.md`「测试服部署流程」6 步走。要点：

1. `node scripts/bump-version.mjs` → **v1.0.0.53 → v1.0.0.54**（⚠️ 只在这一步 bump，正式服不再 bump）
2. `npx tsc --noEmit` 必须全绿
3. 打 tgz（**含 `src/lib/app-version.ts`**）→ scp → 解到 `/opt/flashmuse-staging/app`
4. `nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（**后台跑 + 轮询 tail**，防 120s 工具超时）
5. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`
6. sed 改 `PUBLISHED_APP_VERSION: "v1.0.0.54"` + `force-recreate staging-app`
7. 验证 `curl -D - http://127.0.0.1:5001/api/models | grep x-app-version` = v1.0.0.54，外网 `http://101.37.129.164:8080/` 200

**无 Prisma 迁移**，entrypoint 那句 `migrate deploy` 应该输出 "No pending migrations"。

### 第 2 步：测试服实机验收清单（本次改动的验收点，⭐ 是必须点到的）

测试账号：`12424740@qq.com` / `dragonstar`（登录页选"密码登录"→填邮箱→提交→填密码）。

| # | 怎么测 | 期望 |
|---|---|---|
| ⭐1 | **对话流上传一张图**，开浏览器 Network 看 | 上传当下就打了 `POST` **和** `PATCH /api/asset-upload-temp`（以前 PATCH 要等点发送） |
| ⭐2 | 接着点发送 | **不再有第二次 PATCH**、**没有** `/api/upload-image`；`/api/image` 请求体里 `referenceImages` 是 `/generated/...` 而**不是** `data:base64` |
| 3 | 输入框缩略图 | 正常显示、**不闪**（预览仍用本地 dataURL，只有 `url` 换成了正式地址） |
| 4 | **同一张图再传一次** | 提示"图片已存在，无需重复上传！"，且**不多打 PATCH** |
| ⭐5 | **传一张 >2MB 的手机照片**（最好带 EXIF 方向的竖拍照） | ①存下来的文件明显变小（看容器里 `ls -l`）②**像素尺寸没变** ③**方向正常、没横躺** ④日志出现 `upload-image-oversized-recompressed` |
| 6 | 传一张 <2MB 的小图 | 日志**不**出现 recompress 事件（字节不该被碰） |
| 7 | 正常生图 / 生视频各一次 | 成功，没被这批改动影响 |
| 8 | 工作流拖图进画布 + 跑一次生图 | 正常（工作流那条路本次没动，但 `local-assets` 是共用的） |
| 9 | 后台 `/admin?tab=failures` | 页面正常、0 控制台错误 |

⚠️ **老数据的红字不会变**（是持久化字符串）。要验新文案必须**新发起**一次并让它真失败，不方便造就跳过 —— 纯函数回归已经跑过 21/21。

### 第 3 步：同步正式服

按 `03-deploy-and-servers.md`「正式服部署流程」1~8 步（**备份 → rsync 对齐 → build → 同步 `.next/static` 到阿里正式镜像 → 发布信号 → 四域名健康检查**）。
⚠️ **不再 bump**，正式服原样带 v1.0.0.54（版本号一样 = 代码一样）。
⚠️ 静态一定要同步到**正式**镜像 `flashmuse-static`，**不是** `-test`。

### 第 4 步：部署完必须做的 4 件事（别忘，这是本次的收尾）

**4.1 ⭐ 归档 A5 那 4 条**（根因已修）。分两步改 `scripts/archive-resolved-generation-failures.mjs`：

① 从 `NEVER_ARCHIVE_REASON_PATTERNS`（约 63 行）里**删掉**这一行 + 它上面那句注释：

```js
  // 我们自己的 bug，2026-07-29 仍在发生、尚未修（某个参考素材解析不出公网直链就放弃送审）。
  /参考素材不是可审核的公网地址/,
```

② 往 `RESOLVED_RULES` 加一条（⚠️ **必须配 `before` = 你部署正式服的时刻**：修的是"base64 参考图"这一种成因，
以后若再出现同样红字必是**别的**成因、应该继续亮着）：

```js
  {
    key: "reference-not-public-url-data-base64",
    match: /参考素材不是可审核的公网地址/,
    before: new Date("2026-07-XXTXX:XX:00Z"),   // ← 填正式服部署完成时刻（UTC）
    note: "参考图是 data: base64 导致送审拿不到公网直链、整单被毙。v1.0.0.54 两层修：服务端把 data: 落盘后再送审 + 对话流改成上传完当场转正。以后新发生的同名红字必是别的成因，不再归档。",
  },
```

**4.2 ⭐ 归档 A7 那批「网络连接异常」**（curl 缺失已修、07-14 后零复发）。
⚠️ **不能按 failureReason 匹配**（「网络连接异常，请稍后重试。」是真网络错误共用的文案，会误吃）——
必须按**日志原文**匹配（脚本的 haystack 含日志原文）：

```js
  {
    key: "spawn-curl-enoent",
    match: /spawn curl ENOENT/,
    note: "容器里没装 curl，curl 兜底重试必然失败、还被通用规则误报成"网络连接异常"。Dockerfile 已装 curl，全站仅 4 条、全在 2026-07-14 11:12~11:15，之后零复发；v1.0.0.54 起这类错误改映射成「服务端环境异常」。",
  },
```

⭐ **跑之前先 dry-run，并逐条扫一眼明细里的 failureReason**（别只看数字，这是第十五次会话的血泪教训）。
⚠️ 本地 dry-run 永远是 0（本地库没线上数据）→ 必须 `docker cp` 进容器 `/app` 再 `docker exec -w /app node scripts/...`。
⚠️ 归档前的待排查条数是 **220 条（快照）**，跑之前重新数。

**4.3 ⭐ 观察新加的跟踪点**（`grep` 正式服 `/opt/flashmuse/data/runtime/upload-diagnostics-log.jsonl`）：

```
# 这 4 条正常应该是 0 条（出现 = 上传即转正还有漏网路径）
client-send-time-commit-still-needed
client-send-time-data-url-fallback
client-send-time-data-url-fallback-failed
client-send-time-persist-uploaded-images-failed

# 这 3 条是新压缩的：-recompressed 应大量出现（说明在干活），-failed 应为 0
upload-image-oversized-recompressed
upload-image-oversized-recompress-skipped
upload-image-oversized-recompress-failed
```

**4.4** 后台 `/admin?tab=failures` 抽查 A1/A2/A4 三条新文案**各自聚成一条**（尤其 A2 那句带模型原文的，
靠 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 前缀归一化）。

### 第 5 步：commit + push（保持四方同步）

⛔ PowerShell 没 heredoc → commit 信息写成文件再 `git commit -F <file>`。
建议 commit 信息主干：

```
修掉红字 A5(base64参考图毙整单)/A1(上传大图该压没压) + A2/A4 加明确映射 + 视频轮询失败补落盘与连续失败上限 + 错误映射三处说假话修正 (v1.0.0.54)
```

---

## 当前状态（2026-07-29 第十六次会话更新）

⚠️ **不是四方同步**：线上（正式服 = 测试服 = GitHub）仍 `v1.0.0.53`，**本地累计 12 个文件未部署未提交、没 bump**。
无 Prisma 迁移，`npx tsc --noEmit` 全绿。清单见上面第 0 步 / `01-current-status.md` 顶条。

本次做的：**A 表 9 条全部收口**。修掉 A5（base64 参考图毙整单，两层修）、**真修掉 A1**（上传大图该压没压）、
查清 A3 + A7（⛔ 两条**原表述都是错的**）、A2/A4 加明确映射、A6/A8 确认不用动、A9 数据不足改不了；
顺带修三个真问题（API Key 正则误伤 / 视频任务无重试上限且只写 console.warn / 环境错误被说成网络错误）。

### ⭐ 部署之后才轮到的：只剩一个「能修但要拍板」的项

**A4 真修复：给 `DATABASE_URL` 加 `connection_limit`（25~30）**。
⚠️ 改环境变量 + 重部署 + 核对 postgres `max_connections`，不是纯代码改动。目前**零复发**（最后一次 07-17）→ 不急。

⛔ **已被用户否掉、别再提**：我原来提的"发给模型前把参考图**缩尺寸**（最长边 2048）"——
用户明确要求「**图片过大不要动**（不动尺寸）……如果是体积大可以压缩一下保存好，质量保证在 90%」。
所以走的是**只降质量、保尺寸**那条路，实测 -78.7% 已经够用。

### 红字排查还想继续的话

A 表已清零。下一步只能等新数据：**用 `/admin?tab=failures`** 看有没有新的原因冒出来
（⚠️ 条数去后台看实时值）。B 表那些提供商侧的按铁律不归档、就该一直亮着。

### ⛔⛔ 本次新增的硬知识（别踩第二遍）

- ⭐⭐ **两个最大的教训**：
  ① **A 表里的描述可能已经过期**（A3、A7 都是）→ 动手前先用数据验前提；
  ② **遇到"图太大被拒"，先拿源文件重压一遍比大小**，确认"我们到底压过没压过" ——
  我漏了这一步，差点把"我们自己漏了压缩"误判成"模型限制、只能改文案"。
  一压才发现 `4444000 → 985381`（同尺寸、约 90% 质量），根因立刻翻转。
- **A1 根因**：`jpegNeedsReencode()` 只判**格式兼容性**（分量数 + 4:2:0 采样因子）、**完全不看体积**
  → 格式本来就兼容的手机原图走"原样写盘"分支，一个字节都不压。
- ⛔ **sharp 压缩默认丢 EXIF** → 手机照片必须先 `.rotate()` 把方向烧进像素，否则压完显示成横躺。
  测这一项要自己造带 `withMetadata({ orientation: 6 })` 的图，**且体积必须超过阈值**才会进压缩分支。
- ⭐ **容器里可直接用 `/app/node_modules/ffmpeg-static/ffmpeg` 做压缩实验**（输出 `/tmp`、跑完删）。
  `-q:v` 与质量粗略对应：`2≈95% / 3≈90% / 5≈80%`。
- **A3**：不存在"零日志"，线上有 39,270 条轮询日志；真问题是"只记 `hasError` 布尔"+"`poll-success` 把 `status:failed` 也叫 success"。
- **A7**：curl 早装进 Dockerfile（`spawn curl ENOENT` 只有 4 条、全在 07-14 三分钟内）；ffmpeg 转码 **1097/1097 全成功、零失败**。
- ⛔ **别用日志事件名推根因**：`image-provider-curl-fallback-failed` 07-15 起几十条，**根因全是"提供商余额不足"**，跟 curl 无关。
- ⭐ **改带"可变尾巴"的红字文案，必须同步 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`**（否则后台炸成几十条各 1 条）。
  ⭐ 本次 A2 因为**复用了已有文案**（抽成 `buildModelTextInsteadOfImageMessage`），一行 SQL 都没改。
- ⭐ **判"图太大/参数越界"类问题用 `image-provider-reference-sizes` 做成败相关性统计** ——
  它只记 `maxSingleBytes`/`perImageBytes`，⛔ **没有宽高**（别去找 width/height，会白跑一轮）。
- ⭐ **容器里没 ffprobe/PIL，但 `python3` 能直接解析 JPEG SOF 段**拿宽高/位深/分量数（3=YCbCr、4=CMYK；`0xc2`=渐进式）。
- ⛔ **视频任务的重试上限绝不能用 `attempts`** —— 正常成功的长视频轮询就要几十次（线上最大 208 次且成功）。
  要用"**连续**失败次数"（`extraJson.pollErrorStreak`）。
- ⛔⛔ **PowerShell `cd` 对 `[System.IO.File]` 无效、对 `Remove-Item` 有效** ——
  同一条命令里混用会出现"读错目录 + 真删对目录的文件"，本次因此丢了一整节刚写好的交接文档。**拼接文件只用绝对路径。**
- ⛔ **PowerShell 内联 ssh 里带 `count(*)`、嵌套引号会被本地 PS 解释坏** → 一律写成 `.sh` scp 上去跑。
- ⭐ **Playwright 上传的文件必须放在 `.playwright-mcp\` 等允许根目录内**，放系统 temp 会被拒（`outside allowed roots`）。
  `showInputTip` 是瞬时提示、`innerText` 抓不到 → **看网络请求更可靠**。
- ⛔ **写 python 探测脚本时中文里别用半角双引号**（直接 `SyntaxError`），用「」。

## 此前状态（2026-07-29 第十五次会话更新）

⚠️ **不是四方同步**：线上（正式服 = 测试服 = GitHub）仍 `v1.0.0.53`，**本地有 5 个文件未部署未提交、没 bump**。
无 Prisma 迁移，`npx tsc --noEmit` 全绿。清单与说明见 `01-current-status.md` 顶条。

本次做的：**把线上红字全量归纳成 A/B 两张表**（A = 我们自己的原因 9 条、B = 提供商端 14 条），
并把 **B 类全部处理完**；顺手统一了图片上传格式白名单、给归档脚本加了全局护栏。
正式服待排查 **224 → 220 条**（归档了 B7 那 4 条）。

### ⭐⭐ 接手第一件事：按 `07` 第十三节的 A 表继续（那 9 条全部未修）

**建议顺序**：

1. **A5「参考素材不是可审核的公网地址。」** —— A 表里**唯一还在流血**的（07-29 刚发生 4 条）。
   证据：`966d223a-f720-4c34-82f2-9e12c1b80ef0` 的 5 个参考图里 index 0/1/2 都成功 reuse 到 Active 凭证，
   **只有 index 3 是 `kind:"unknown"`** → `byteplus-auto-review-public-url-failed` → 整单毙。
   ⭐ 这条同时挡在归档脚本的 `NEVER_ARCHIVE_REASON_PATTERNS` 里，**修好后要记得把它从名单里删掉**再归档。
2. **A3「BytePlus 视频轮询失败零日志」** —— 15 条查不动的根源（11 条落兜底 + 4 条被判成"API Key 无效"）。
   **必须先补落盘**（OpenRouter 侧第十一次会话已补，BytePlus 侧还是盲区），补完攒几天新数据才可能查。
3. **A1**（OpenAI 说我们的参考图不合法，资产库角色生成，可复现）→ **A2**（模型 200 但空结果）。

⚠️ **A1/A2/A3/A4 单纯改文案没意义** —— 它们落在兜底桶「服务器繁忙」（= 我们没识别出根因的混合体），
要做的是**给它们各自加明确映射**（A3 还得先补日志）。

### ⛔ 本次新增的两条硬知识（别踩第二遍）

- **`generation-diagnostics-log.jsonl` 里也有 `video-route-failed`（视频失败双写两个日志）** →
  **按日志文件名判断"图片还是视频路径"是错的**，要看行里的 `event` 和 `model`。我差点据此误报"图片路径也有凭证失效、存在分叉"。
- **归档脚本 `--apply` 之前必须逐条扫 dry-run 明细的 failureReason**（本次新加了明细输出）。
  只看数字会误吃：`gpt-image-empty-result-legacy-form` 差点吃掉 4 条 failureReason 已是 v53 新文案的事件
  （因为 haystack = 日志原文 + failureReason，而日志里还留着 `图片平台没有返回图片：` 这层**内部包壳**）。

### ⚠️ 部署时注意

本次改动都在**服务端映射/校验层**，没有 UI 改动，实机验收要点：
① 工作流画布**拖** tiff/gif/heic 进去应被拦（提示"当前模型不支持该图片格式"）、jpg/png/webp 正常；
② 对话流/资产库上传行为**应完全不变**（数量与大小上限一个没动）；
③ 生成正常图/视频不受影响（成功路径没碰）。

## 此前状态（2026-07-29 第十四次会话更新）


✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.53`**（commit `ab6e223`）。无 Prisma 迁移，无待部署、无未推。

本次做的：**撤掉对话流 + 资产库的 AI 改写重试**（工作流那套一行未动）、**模型拒绝类红字三合一**。
起因是正式服 d37 对话实测出：11 分钟发起 23 次生图、成功 17 张、对话里只剩 2 张、扣 197 积分。
完整根因与验收见 CHANGELOG 顶条 + `01-current-status.md`。

### ⛔⭐ 产品决策（别自己改回去）

用户明确：**对话流的设计不适合 AI 改写** —— 一条提示词出多图，每张独立改提示词，上面显示的提示词就对不上了。
**要重做必须先解决"一条提示词多图"的展示模型问题**，别把删掉的代码捡回来。

### ⭐ 接手第一件事：继续排查红字

用 `/admin?tab=failures`（⚠️ 条数去后台看实时值）。审核类按铁律不归档。
⭐ **可以考虑归档**：`B_622~657` 那批「模型拒绝」的**旧四分叉文案**（v53 起已统一成一句）。
⚠️ 按铁律 ④，**统一后的新文案不归档**（修不了、该一直亮着）→ 归档规则**必须配 `before` = v53 上线时刻（2026-07-29T04:33Z 左右）**。

### ⛔ 第十四次会话的操作记忆（省时间）

- ⭐ **查线上 DB 不用落文件**：node 脚本 base64 → `sudo docker exec <容器> sh -c 'echo <b64> | base64 -d | node'`，绕开 PowerShell 吃 `$`/中文/引号的全部坑。
- ⛔ **列名坑**：`GenerationEvent` 无 `surface`；`MediaAsset` 无 `name`（用 `displayName`/`systemName`）；积分表 = **`CreditLedger`**、字段 `credits`。
- ⭐ **对话编号 `d37`** = 前端自增，存 `WorkspaceSession.summaryJson->>'conversationCode'`，**不是 id 截取**。
- ⛔ **PowerShell 没 heredoc** → commit 信息写成文件再 `git commit -F <file>`。
- ⭐ 删大段代码用 `[System.IO.File]::ReadAllLines` + 切片重写（UTF8 无 BOM）；**改中文字符串一律用 edit 工具**。
- ⚠️ `npx eslint` 本来就有 22 个 error（历史遗留），不是新引入的。
- ⭐ **老数据的红字不随代码改动而变**（是持久化字符串），验文案要看**新发起**的那次。

## 此前状态（2026-07-29 第十三次会话更新）

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.52`。** 无 Prisma 迁移，无待部署、无未推。

- 归档已跑：**正式服 120 条（319 → 199 待排查）**、测试服 3 条。
- 归档脚本新增 **`before` 日期下限**机制（`ruleAllowsEvents()`）。
  ⭐ **凡是 note 里写「以后新发生的不再归档」的规则都必须配 `before`**，否则会一直吃新数据
  （本次 `provider-insufficient-credits` 就差点误吃 11 条新事件）。
- 工作流「高清」已改成四选项下拉（GPT/Gemini × 2K/4K），后台按模型开关，橡皮的三级候选链未受影响。

### ⭐ 接手第一件事：继续排查红字

用 `/admin?tab=failures`。正式服 **199 条待排查**。审核类按铁律不归档；真正可查的（⚠️ 条数是快照，去后台看实时值）：
`empty image result` 7 条 / `InvalidParameter.UnsupportedImageFormat` 4 条 / `API Key 无效` 4 条（查是哪个渠道）/ DB 事务超时 2 条。

## ⭐ 仍未实机测到的（只剩一项了）

**资产库「拒绝类」失败卡的三颗 AI 改写按钮。**
⭐ **本次学到的触发技巧（比第十二次会话那套靠谱得多）：不要靠改提示词硬碰** ——
拿一张**擦边的源图**走 img2img（本次高清 GPT 4K 用沙滩排球比基尼源图，**一次就中**，
直连版立刻回 `safety_violations`）。第十二次会话在资产库改提示词试了 5 次全部照样出图、烧了约 96 积分。

另：**Gemini 4K** 没单独实跑（与 Gemini 2K 同一条代码路径、只差 `resolution` 字符串），有机会点一下。

## ⛔⛔ 加 Hook 会把 tldraw 画布搞崩（2026-07-29 踩过，v52 第一次上测试服白屏）

`WorkflowSelectedNodeOverlay` 在 **`workflow-tldraw-canvas-inner.tsx:2493` 有 `if (!selected) return null;`**。
在它**之后**加任何 Hook（我加了个 `useMemo`）→ **React #310「Rendered more hooks than during the previous render」**
→ 点任意节点，整个画布变成「Something went wrong / Please refresh your browser」。

**修法：加在提前 return 之前，或干脆别用 Hook**（本次改成直接计算，只有 4 个元素）。

## ⭐ 新增高清模型要同步改三处配置表

`system-settings.ts` 的 `HD_FUNCTION_MODEL_CHAIN` / `workflow-tldraw-canvas-inner.tsx` 的 `HD_MODEL_OPTIONS` /
`admin-system-settings-panel.tsx` 的 `HD_MODEL_CHAIN`。
⚠️ **高清和橡皮的链已拆开**（`HD_FUNCTION_KEYS` vs `EDIT_FUNCTION_KEYS`），改一个不会影响另一个 —— 别再合回去。

## ⭐ 自动化测工作流画布是可行的（别再默认"留给人工"）

上一批文档写了"tldraw 不适合自动化"，那只对**连线**成立。**点节点 / 开快捷菜单 / 点下拉 / 跑生成 / 读结果标签全都跑通了**，
完整姿势见 **`07` 第十一·B 节**（新增）。三个最关键的：

- `browser_click` 点不到画布节点（img 拦 pointer events）→ 用 `run_code` 里的 `page.mouse.click(x, y)`，坐标从截图量。
- 每次量坐标前先按 **`Shift+1`**（缩放到适应全部节点），否则上次的坐标全失效。
- 验"模型/分辨率走对没有"**读节点右上角标签**（`模型 / 比例 / 分辨率 / 实际像素`），别靠看图。

## ⭐ 归档脚本的两个操作前提（省时间）

- **本地 dry-run 永远是 0**（本地库没有线上失败数据）→ 要看真实数字必须
  `docker cp` 脚本进容器 `/app` 再 `docker exec -w /app … node scripts/…`（否则找不到 `@prisma/client`）。
- 改完先 `node --check scripts/archive-resolved-generation-failures.mjs`：
  ⛔ **中文 note 里不能用 ASCII 双引号**（会截断 JS 字符串，本次踩过 `SyntaxError`），一律用「」。

## 此前状态（2026-07-29 第十二次会话）

⚠️ **不是四方同步了**：本地 `v1.0.0.51`（有未 commit 改动）> 测试服 `v1.0.0.51` > 正式服 `v1.0.0.50` = GitHub `v1.0.0.50`。

- 本地比测试服多**一行改动**：限流文案改成「当前模型繁忙或被限流，请稍候再重试！」（部署完测试服之后才改的）。
- 测试服比正式服多**一整批**：模型拒绝红字改成「统一文案 + 附模型原话」+ 资产库补 AI 改写 + 一堆错误文案修正（详见 CHANGELOG 顶条）。
- `npx tsc --noEmit` 全绿，**无 Prisma 迁移**，**归档脚本本次没跑**。

### ⭐ 接手第一件事：问用户要不要上正式服

要上就按铁律走：`node scripts/bump-version.mjs`（v51→**v52**）→ 打 tgz 上测试服 → 验一眼限流文案 → 原样同步正式服（**不再 bump**）→ commit + push。
本次改动的 10 个文件：`src/lib/models.ts` / `error-message.ts` / `error-code.ts` / `gpt-image-safety-retry.ts` / `openrouter.ts` / `generation-jobs.ts` / `admin-failure-triage.ts` / `app-version.ts` / `src/app/api/image/route.ts` / `src/components/chat-workbench.tsx`。

## ⭐⭐ 等用户拍板：那 101 条「图片平台没有返回图片」要不要归档

**背景**（完整排查见 `07` 文档第十二节 + CHANGELOG 顶条）：这 101 条 = 92 条模型明文拒绝 + 7 条模型复读提示词 + 2 条 520/空响应被伪装。全部来自 GPT版老接口那一个打点。

**两种口径，必须用户点头才动**：

- **归档**（我倾向这个）：理由 = 它们**不在兜底桶里**，但**旧形态已被本次改动彻底取代**（以前是 500 字小作文/用户自己的提示词/520 伪装，现在是统一文案 + 附原文 + AI 改写入口）。归档后正式服待排查 286 → ~185。`note` 建议写「模型明文拒绝：v1.0.0.51 起统一映射为『模型因色情/暴力/隐私安全等原因拒绝出图 + 模型原话』并提供 AI 改写重试入口」。
- **不归档**：按铁律"模型拒绝属于提示词内容/平台策略、我们修不了 → 就该一直亮着"。

⚠️ 若归档，规则要能同时认出三种历史形态（`图片平台没有返回图片：` 开头的小作文 / 提示词复读 / `error code: 520`），别只写一条正则。

## ⭐ 本次没能实机测到的两项（下一个 AI 有机会补）

1. **直连版（`openai/gpt-5.4-image-2`）的安全拒绝红字**：试 4 次全撞 OpenRouter 限流（`error code: 1015`）。预期文案 = 「模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或由AI安全改写后重试…以下是模型返回的拒绝原因："Your request was rejected by the safety system."」（客服尾巴会被削掉）。已用真实原文做纯函数验证 13/13 通过。
2. **资产库「拒绝类」失败卡的三颗 AI 改写按钮**：⭐ **难点已查明** —— 角色生成的 `ruleText` 会把提示词包装成"角色设定图"，中间那层语言模型就不拒绝了（试过"全裸/露骨""极度血腥断肢""1:1 复刻明星脸"5 次全部出图，烧约 96 积分）。**别再靠改提示词硬碰**；更靠谱的路子是**在资产库选直连版**（OpenAI 硬拒、不会被中间层改写掉），等限流缓解时试。
   资产库失败卡本体渲染是正常的（限流那次验过，且正确地只显示「重新生成」、不显示 AI 改写）。

## ⛔⛔ 排查/测试对话流失败卡时必读（2026-07-29 我误报过一次）

**对话流的失败卡包在 `<LazyMediaMount height={250}>` 里（`chat-workbench.tsx:16531`）—— 滚进视口才挂载。** 而红字**不在**这个组件里、一直显示。

- 所以「红字在、卡不在」是**正常现象**，不是数据丢了。我据此误报了一个不存在的 bug（"刷新后 AI 改写按钮丢了"），逐层查完发现 DB 的 `messagesJson`、`GET /api/workspace-state` 返回的 `mode`/`failedImageCount`/`imageResultSlots`/`generationMeta` **一个字段都没丢**，把消息 `scrollIntoView({block:'center'})` + 等 2.5s 后按钮立刻出现。
- ⛔ **用 `document.querySelectorAll('.flashmuse-failed-media-card')` 统计对话流失败卡不可靠**，必须先把目标消息滚进视口再断言。

## ⭐ 改「模型拒绝」文案时必须连带改的三处（都写了注释，别漏）

1. `src/lib/gpt-image-safety-retry.ts` 的判定 —— 认前缀 `模型因色情/暴力/隐私安全等原因拒绝出图`（函数 `isModelRefusedMessage`）。⛔ **绝不能改回整句比对**，否则**对话流/工作流/资产库所有 AI 改写按钮全部不亮**。
2. `src/lib/admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` —— 按前缀归一化。不改的话后台「失败原因」会**炸成几十条各 1 条**（因为文案带可变原文）。
3. `src/lib/error-message.ts` 顶部的**幂等保护** —— 认出成品文案就原样返回。**因为这个函数在"服务端映射→前端再映射"链路上可能被调两次**，末尾兜底透传会截到 180 字、把刚附上的模型原文砍掉。

## ⭐ 已知但用户明确说不做的（别重复提）

- **限流（Cloudflare 1015）只改文案**：用户 2026-07-29 拍板。我提过的"对 1015 用更长退避 30/60/120s"和"限流时自动降级到 GPT版老接口"**都不做**（后者会改变计费/画质预期，直连版支持 4K/画质档、老接口不支持）。
- **工作流的失败卡不改**：用户 2026-07-29 明确"工作流不用改，当前的就行"。所以工作流失败卡仍是「重新生成 + AI改写」并存、旧字号，与对话流/资产库不一致，**这是有意的**。

## ⭐⭐ 待跟踪（已撤销，别再等）

~~新接口空结果落盘 `upstream.body`，过几天回正式服捞字段名~~ ❌ **2026-07-29 撤销**：正式服日志里 `image-provider-empty-result` **带 body 的一条都没有**，因为**直连版的拒绝走 400 `image-provider-non-ok` 分支，根本不会走到"200 但没图"**。`openrouter.ts` 那段注释已改成这个结论，body 继续留着做保险。

## 此前状态（2026-07-28 第十一次会话）

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.50`（2026-07-28 部署完成）。**

- 本次一次性上线了积压的两批（第十次 + 第十一次会话）。**无 Prisma 迁移**（两服 `No pending migrations`）。
- 正式服备份 `/opt/flashmuse/app-backups/20260728-140839-presync-v50`；四域名全 200；两服 `x-app-version: v1.0.0.50`。
- 归档已跑：**正式服 33 条 → 308 降到 286**；测试服命中 0、仍 36。兜底桶「服务器繁忙」**从 60 降到 28**。
- ⚠️ **为什么是 v50 不是 v49**：v49 上测试服后发现新页 **hydration mismatch（React #418）** ——
  日期在客户端 `Intl.format` 会因服务器/浏览器时区不同导致两次渲染不一致。
  已改成**服务端预格式化成 `*Label` 字符串再传给客户端组件**，然后按铁律重新 bump 才上正式服。
  ⛔ **以后后台新页（客户端组件）里绝对不要在浏览器端格式化日期。**
- ⚠️ **唯一没点到的一项**：**工作流侧**的 Kling 参考图拦截没做到"点生成看提示"（tldraw 画布连线不好自动化）。
  它走的是同一个共享函数、服务端还有一道 400 兜底，风险很低，**下次有机会人工点一次**。

## ✅ 已完成：v1.0.0.50 的测试服实机验收（2026-07-28，全过）

| 项 | 结果 |
|---|---|
| Kling v3.0 Standard + 200×120 参考图 | ✅ 发送前拦下并给出明确原因（含实际宽高） |
| Veo 3.1 + 参考图 + 4 秒 | ✅ 发送前拦下：「…只支持 8 秒（你选的是 4 秒）」 |
| **反例** Veo 3.1 + 4 秒 + 无参考图 | ✅ 不拦、正常生成成功 |
| **反例** Kling + 1280×720 合规参考图 | ✅ 不拦、正常生成成功 |
| 后台新页 `/admin?tab=failures` | ✅ 数据正确、交互可用、0 控制台错误 |
| 后台概览页「失败原因」卡片 | ✅ 未坏（本次改了它的归一化 SQL 为共享常量） |
| 工作流画布加载 | ✅ 正常 |

## ⭐⭐ 待跟踪（第十次会话故意留的口子，别忘）

**新接口空结果已开始落盘响应体原文，过几天回正式服日志捞真实字段。**

- 背景：`openai/gpt-5.4-image-2` 走 OpenRouter 新接口 `/api/v1/images`，返回 200 但没图时（模型明文拒绝），**拒绝文字落在响应哪个字段目前未知**（老 `/chat/completions` 接口在 `choices[0].message.content|refusal`，新接口是 `data[]` 形状，不是那个结构）。**不许凭猜测写字段名**，所以本次只在 `openrouter.ts` 的 `image-provider-empty-result` 分支加了 `upstream.body`（已 `redactBase64ForLog` 去 base64、截 1200 字）。
- 捞法（部署后攒几天再做）：正式服容器里 `grep image-provider-empty-result .runtime/*-diagnostics-log.jsonl`，看 `upstream.body` 的 JSON 结构。
- 捞到之后要做的：在 `generateGptImage2` 的空结果分支读出原文 → 抛 `图片平台没有返回图片：${原文}` → `error-message.ts` 的 `isModelRefusalText()` 会自动把它映射成 `MODEL_REFUSED_MESSAGE` → 对话流/工作流的失败卡自动亮「AI改写重试」（判定 `src/lib/gpt-image-safety-retry.ts` 已就绪，无需再改前端）。
- 顺手做的话：给 `scripts/archive-resolved-generation-failures.mjs` 加 `gpt-image-model-refusal` 规则时想清楚 —— **模型拒绝属于"提示词内容/平台策略、我们修不了"，按铁律不归档**；但**"因为读不到原文而落进兜底桶"这个 bug 修好后，历史那批落在兜底桶里的可以归档**（归档理由是"已从兜底桶拆出、现在有明确文案"）。

## ⚠️ 新发现的小问题（第十一次会话验收时观察到，未修）

**被发送前拦截后，再点一次发送会报 `POST /api/asset-upload-temp 500`。**

- 容器日志原文：`[upload] asset-upload-temp patch failed { ... error: Error: 上传文件不存在或已过期 }`
- 复现：对话流上传一张图 → 因参考图尺寸/时长被**发送前拦截** → **不改任何东西直接再点发送** → 500。
- 判断：临时上传凭证（token）像是被第一次尝试消耗/失效了；重新上传即可正常。
- 影响：**不影响首次拦截的正确行为**，但用户连点两次会看到一个没用的报错（而不是再看到那句明确的拦截原因）。
- 优先级低，但如果要修：查 `api/asset-upload-temp` 的 token 生命周期，
  被拦截（未真正发起生成）时不应该让 token 失效。

## ⭐ 待观察：本地 `.next` 反复损坏（登录报「请求失败」）是否已断根

- 症状识别口诀：**接口全 404/500、莫名"请求失败"，或 `tsc` 报 `.next/dev/types/*` 语法错 → 一定是 `.next` 坏了，跟业务代码无关，别去翻登录逻辑。**
- 现在**双击 `start-project.bat` 会自动修**（实测故障态 15 秒自愈）。修复过程与判定见 `.runtime/start-project-trace.log`。
- **次日要确认**：如果还复发，说明"腾讯电脑管家实时防护"这个头号嫌疑判断错了 → 去 **`.runtime/next-broken/<时间戳>/`** 拿自动备份的清单文件（types 目录 + 所有 `*manifest*.json`），比对到底是哪个文件、残在什么位置，那才是铁证。
- 已排除的嫌疑（别重复查）：磁盘满、多开 dev server、异常关机、OneDrive 同步。

## ⚠️⚠️ 仍未点测：第十次会话那批「模型明文拒绝 + AI 改写重试补给对话流」（**已随 v50 上线，但没验过**）

⭐ **这是目前唯一一批"已经在正式服跑着、却从来没有人实机点过"的功能**，下一个 AI 有空请补测（或提醒用户自测）。
本次会话只验了第十一次会话那批（Kling / veo 拦截 + 后台新页），**下面这 5 项一项都没点**：

1. 用 `gpt-5.4-image-2` 在**对话流**发一个会被模型拒绝的提示词 → 红字应显示「模型拒绝生成本次内容（可能涉及安全、隐私、版权或未成年人等限制）！…」，失败卡底部应出现「AI改写重试 3/5/10 次」三颗按钮。
2. 点其中一颗 → 应持续显示等待卡（**两次尝试之间不闪回失败卡**）→ 成功则出图；全败则显示最后一次的失败原因。连点两次应只跑一条链（防重锁）。
3. **工作流侧回归**（第十次会话重写了它的编排循环）：同一场景在工作流点「AI改写重试」，行为应与以前完全一致。
4. **反例检查**：视频失败卡、非 gpt5.4image2 模型的图片失败卡**不能**出现「AI改写重试」按钮。
5. ⚠️ 看一眼：改写全败后对话流那条消息的内容是否被替换成最后一次的改写提示词（已知行为，确认是否需要处理）。

**外加一项（第十一次会话遗留）**：**工作流侧的 Kling 参考图尺寸拦截**没做到"点生成看提示"
（tldraw 连线不好自动化）。走的是同一个共享函数 + 服务端 400 兜底，风险低，但有机会人工点一次。


## ⚠️（已过期，留档）第十次会话留的「接手第一件事：继续排查红字」

> ⛔ **别照这段做了**：红字已于 2026-07-29 第十七次会话**整轮清零**（待排查 = 0）。
> 里面的条数（286 条 / 101 条 / 166 条…）全是历史快照，方法论仍然有效、条数一律作废。
> 当前正确动作见本文件顶部：**先看新一轮攒了多少，不够就直说别硬查**。

**不用先部署、不用问要不要部署** —— 直接开始排查后台红字。（本地那批未部署改动是次要待办，见本文件下方。）

### 怎么开始（完整方法论在 `07-red-error-triage-and-archive.md`，必读）

一句话流程：**后台看红字 → 拿 requestId 去 `.runtime/*-diagnostics-log.jsonl` 捞真实原文（别信 `failureReason`，它是给用户看的兜底文案）→ 修/堵 → 往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加一条规则 → 跑 `--apply` 归档（后台那条文字保留但划掉）。**

**正式服现在剩 286 条待排查 / 18 种原因 / 还在流血 10 种**（2026-07-28 归档 33 条后）。⭐ **先开 `/admin?tab=failures`。**

⭐ **新页第一眼就给出了下一个目标**：「图片平台没有返回图片（模型未产出或拒绝生成）」**101 条**，
其中 **工作流 88 / 对话流 11 / 资产库 1 / Agent 1** —— 高度集中在工作流一个入口，
按本页的设计意图这是**"该统一却分叉了"的强信号**，值得优先查。
（审核类待排查 166 条按铁律**不归档**，别去动。）

按性价比排的其余条目（详见 07 文档第六、七节）：
1. ~~40 条「轮询 failed」~~ ✅ **第十一次会话已全部查清并修，v1.0.0.50 上线并归档 33 条**（Kling 参考图尺寸 32 + veo-3.1 r2v 时长 1；
   另 6 条 BytePlus 仍不可考、留着亮）。⭐ 顺带沉淀出「OpenRouter 任务事后可回查原文」这条方法论，见 07 文档第九节。
2. `empty image result` 7 条（OpenRouter 说成功但没图，看是不是特定 model/参数组合）。
3. `InvalidParameter.UnsupportedImageFormat` 4 条、DB 事务超时 2 条、`API Key 无效` 4 条（查是哪个渠道）。
4. 后台列表里其它未归档条目，同一套方法逐条查。

> ~~gpt-5.4-image-2 中文明文拒绝~~ ✅ **第十次会话已查清并修（本地未部署）**，见 07 文档第七节第 3 条 + 本文件「待跟踪」。

**不要归档的**（平台审核/用户提示词内容，我们修不了，就该一直亮着）：成品被平台拒绝交付 56、模型拒绝 sexu/viol 28+12、版权限制 16、真人隐私敏感 13+6+1、「提供商余额不足！请联系管理员充值。」、以及第十次会话新映射出的 `MODEL_REFUSED_MESSAGE`（模型明文拒绝）。

### ⛔ 排查前必读的三条硬教训

1. **兜底桶有两个，同一根因会同时污染两个**：`toUserErrorMessage` 的 fallback 是**默认参数** —— 显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 落进「服务器繁忙，请稍候再试.....」，不传落进「**请求失败，请稍后再试。**」。查任何一类**两个桶都要查**。
2. ⭐ **日志 `grep -c` 出来的条数 ≠ 待排查的失败事件数**（第九次会话踩坑）：「平台拉缩略图超时 18 条」实际是**同一个 requestId 的 18 行日志**，该请求最终 `image-route-success`、GenerationEvent 的 `status = 'success'` → **后台里根本不占位**，归档必然 0 条。**拿到日志计数必须回 DB 按 requestId 核对 `status`**（具体命令在 07 文档第五·B 节）。
3. **同一根因常有多种上游措辞**：写正则前先把该根因的全部措辞捞全（归一化去重命令在 07 文档第五节）。参考图尺寸就因为只写一种措辞漏了 109 条。
4. ⭐ **同一个"根因"可能是多个打点分叉**（第十次会话踩到）：`image-provider-empty-result` 有 **3 个打点**（BytePlus / OpenRouter 新 `/images` / OpenRouter 老 `/chat/completions`），三份对"上游原因"的读取程度完全不同 —— **查一类红字时先 grep 清楚这个 event 一共有几处打点**，别只看到一处就下结论。
5. ⭐⭐ **OpenRouter 的任务事后可以回查原文，别再"等新数据攒几天"**（第十一次会话）：`taskId` 就是
   `https://openrouter.ai/api/v1/videos/<id>`，带 key `curl` 就有 `error` 原文（命令见 07 文档第九节）。BytePlus 的 `cgt-xxx` 不行。
6. ⭐ **"某个防护只对某一家平台生效"是高发漏点**：本次 32 条就是因为 v47 的参考图尺寸拦截被写死"只对 BytePlus"，
   Kling 裸奔。以后写这类守卫，先问一句「别家平台是不是也有同样的规则？」——有就抽成模型集合统一判定。

## ✅ 已完成：v46 那批的实机点测（用户 2026-07-28 自测通过）

资产库视频时长角标 / 缩略图 hover 放大 / 工作流「视频截图 ▾」/ 截图后进上传图片分类 / 用户中心生成计数 / 我的积分工作流图标 —— **全部用户已自测通过，不用再测。**

## ✅ 已完成：v47 部署（2026-07-28 第八次会话）

按下面顺序已全部做完（步骤保留，作为以后部署的标准流程参考）：

### 部署步骤（细节照 `03-deploy-and-servers.md`）
1. `node scripts/bump-version.mjs`（v46 → **v47**，只在部署测试服这一步 bump）
2. tgz 打包改动文件（**必须含 `prisma/schema.prisma` + `prisma/migrations/20260727154203_generation_event_resolved/`**）→ 传测试服
3. 测试服 `docker compose up -d --build` → ⭐ **看 entrypoint 日志里那个迁移有没有 applied**
4. `sync-ali-test.sh`（阿里测试镜像）→ 改 `PUBLISHED_APP_VERSION` 发布版本信号 + `force-recreate` → 验证入口 200 / `x-app-version: v1.0.0.47`
5. 正式服：备份 → rsync staging→prod → build（entrypoint 自动 migrate）→ `/tmp/syncali.sh` → `/tmp/health.sh` 四域名 200 → commit + push。**正式服不再 bump 版本号。**
6. ⭐ **两服各自跑归档脚本**（见下）

### 待部署内容清单

**第六次会话那批**：
1. 视频轮询/创建失败**落上游原文日志**（原来只记 `hasError` 布尔）。
2. **`!triggered` 真 bug 修复** + **已过审图第二次不弹蓝字**（`reuseOnly` 预检 + 无感重试）。
3. **死卡自愈**（平台报 `asset ... is not found` 时清库里失效凭证并重新送审）。
4. **错误文案 3 类真话**（尺寸不合规 / 平台读不到参考图 / 凭证失效）。
5. **参考图尺寸/比例发送前拦截 + 黑底提示**（对话流 / 工作流 / 服务端三处，只对 BytePlus 视频模型）。
6. **后台失败原因归档机制**：⭐ **新 Prisma 迁移 `20260727154203_generation_event_resolved`** —— 两服 entrypoint 会自动 `migrate deploy`，但部署后要确认日志里有 applied。

**第七次会话那批（2026-07-28，红字排查第 2~5 批）**：
7. ⭐ **供应商余额不足映射**：`error-message.ts` 新增 402/`insufficient credits` 类 → 「提供商余额不足！请联系管理员充值。」（位置在限流/`quota` 规则**之前**）；`transient-error.ts` 列为永久错误不再自动重试；归档规则 `provider-insufficient-credits`。
8. ⭐ **参考图尺寸第二种措辞**：`expected the (height|width) to be at least \d+px` 补进 `error-message.ts` 与归档规则（正式服 109 条）；归档脚本改成**日志原文 + `failureReason` 一起匹配**、去掉 `requestId IS NOT NULL` 过滤。
9. ⭐ **「当前模型不支持这组参数」54 条**：归档脚本加 3 条规则（`seedream-pro-sequential-param` / `reference-slot-not-an-image` / `reference-video-total-duration`，共 51 条）；另修**误映射** —— 平台返回 HTML 的 `Unexpected token '<' … is not valid JSON` 以前被 `not valid` 抢走报成"换比例/分辨率"，且被 `isPermanentError` 判成永久失败不再重连 → 现改成「平台服务临时异常（返回了非预期内容），请稍后重试。」并列为**可自动重试**。
10. ⭐ **「请先登录后再使用模型」17 条**：`credits.ts` 新增 `isUnauthenticatedError()`；**6 个 route**（image/video/chat/agent-plan/conversation-memory/workflow-rewrite）catch 第一句回 **401 且不记 GenerationEvent**；新增 `src/lib/session-expired-redirect.ts` 并插在**两处 `readJson`** 开头 → 401 直接跳首页、不给提示。
11. ⭐ **「请求失败，请稍后再试。」33 条**（无代码改动）：归档脚本加 `pre-diagnostics-log-unknowable` 规则（三条件：早于 `DIAGNOSTICS_LOG_START`=2026-07-10 + 日志零记录 + 落在兜底文案桶；正式服 dry-run 实测命中 **24 条**，07-10 之后 221 条一条不碰），`findMany` select 补 `createdAt`。

### ⚠️ 部署后必须回归的（第七次会话动了共用错误路径）→ **仍未做，见文档顶部**

**归档已执行完毕（2026-07-28）**：两服容器 `/app` 各跑
```bash
node scripts/archive-resolved-generation-failures.mjs          # 先 dry-run 看条数
node scripts/archive-resolved-generation-failures.mjs --apply  # 再归档
```
实际结果：测试服 10 条（剩 36）；**正式服 367 条**（reference-image-size 191 / provider-insufficient-credits 66 / reference-slot-not-an-image 26 / pre-diagnostics-log-unknowable 24 / session-expired 17 / seedream-pro-sequential-param 13 / reference-video-total-duration 12 / stale-asset-card 10 / approved-card-not-reused 8），**剩余未归档 308 条**。
⛔ 查正式服记忆：app 容器 = `flashmuse-flashmuse-app-1`；db 容器不能 `psql -U postgres`（role 不存在），查库走 `docker exec <app容器> node -e` + Prisma `$queryRawUnsafe`。

## ⭐⭐ 接手主线任务：继续排查红字失败原因并修复

**完整方法论、已修清单、待查清单、归档规则 → `handover/07-red-error-triage-and-archive.md`（必读）。**
一句话流程：**后台看红字 → 拿 requestId 去 `.runtime/*-diagnostics-log.jsonl` 捞真实原文（别信 failureReason）→ 修/堵 → 往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加一条规则 → 跑 `--apply` 归档（划掉）。**

下一批按性价比排（详见 07 文档第六、七节）：
1. ✅ **OpenRouter 余额不足 53 条已做（2026-07-28）**：映射成「(B_xxx) 提供商余额不足！请联系管理员充值。」+ 列入 `isPermanentError` 不再自动重试 + 归档规则已加（用户拍板归档历史那批）。可选增强：后台单列一栏 + 运营告警。
1b. ✅ **「当前模型不支持这组参数」54 条已查完（2026-07-28）**：51 条归档 + 修掉一个误映射（详见 07 文档第三·B 节）。
1c. ✅ **「请先登录后再使用模型」17 条已查完并修复（2026-07-28）**：500→401 + 不记事件 + 前端统一跳首页，17 条归档。
1d. ✅ **「请求失败，请稍后再试。」33 条已查完（2026-07-28）**：13 余额不足 + 20 永久不可追溯，全部归档。
1e. ✅ **平台拉我们缩略图超时 —— 2026-07-28 第九次会话已查完并修掉**（`Timeout/Error while downloading url: http://<ip>/api/media-thumbnail?...`）：真因=把动态缩略图接口地址 + 已退役马来 IP 当参考图发给平台；修法=唯一权威 `normalizeReferenceAssetUrl()` 还原成静态直链，8 处接入。⚠️ 但那"18 条"是**同一 requestId 的日志行数**、该请求最终成功，**后台待排查里不占位**，所以归档 0 条属正常。
2. **那 40 条轮询 failed** —— 日志已修好，攒几天新数据再查（大概率输出侧审核）。
3. **gpt-5.4-image-2 中文明文拒绝** —— 现在走"空结果"分支落到"服务器繁忙"，应识别成"模型拒绝生成"并接上已有的 AI 改写重试。
4. `empty image result` 7 条、DB 事务超时 2 条、`the specified asset is not an image` 之外的其它 InvalidParameter（`UnsupportedImageFormat` 4 条）。

## ⭐ 已知但还没做（用户已知，等拍板）
- **参考图尺寸自动修正**：那 82 次现在只是"拦住 + 说清"，可用 sharp 自动缩放/补边到合规再送审（服务器已有 sharp）。
- **`getVideoErrorMessage` 有两份复制**（`api/video/route.ts` + `lib/generation-jobs.ts`）且都丢掉 `error.code` —— 这是"真人/敏感错误被降级成服务器繁忙"的第二个原因，收敛成一份并保留 code。影响面：所有模式的视频错误文案。
- **正式服 97 条远程 url 资产**（签名已失效、救不回来）：用户拍板 **C = 先不管**。

## 线上实机验收（v46/v47 的功能基本都没点测过）
测试服 `http://101.37.129.164:8080/`，正式服 `https://main.venusface.com/`，测试号 `12424740@qq.com` / `dragonstar`（本地库也能登）。建议验：
1. 资产库视频卡左上角时长（深底白字 mm:ss）、图片/视频缩略图 hover 轻微放大。
2. 工作流视频节点「视频截图 ▾」三项（图片出现在源视频右侧、标题「视频截图 xxx」、命名递增、同帧重复截提示"图片已存在"）。
3. 截图后**不刷新**进资产库「上传的资产 · 上传图片」应立刻有。
4. 用户中心「生成图片/生成视频」不再是 0；「我的积分」工作流行是工作流图标、每个工作流一行。
5. 上传视频（含重复上传老视频）有封面；正式服历史封面已回填 29 个。
6. **工作流普通生视频仍正常**（第三次会话改过 `runVideoNode` 主路径，第六次又在里面加了参考图尺寸校验）。
7. 工作流视频「快捷编辑」（会真花钱）+ 候选链降级仍未实机验证。
8. **本批新增**：拿一张 240×180 或极窄的图当参考去生视频 → 应在**点发送的瞬间**弹黑底提示并中止（不扣积分）；换合规图应正常生成。

## 回填脚本（都已跑完，不用再跑）
- `scripts/backfill-media-asset-durations.mjs`：本地 28 / 测试服 5 / 正式服 2059 条已 apply。
- `scripts/backfill-uploaded-video-posters.mjs`：正式服新建 29 个封面并已 rsync 到阿里正式镜像。
- ⭐ 记忆：脚本在服务器上现生成的媒体文件**不会自动同步阿里**（app 只在上传/生成时同步），要补一次 rsync（命令见 CHANGELOG 第五次会话）。

## 上传规则涉及 200MB 视频时
- 正式 nginx `client_max_body_size`（历史 20m）需先评估调整（用户交代，未批准前不改服务器）。

## ⭐ 用户明确押后的
- **视频「高清」= 备忘 `M020`（见 06-memo-tasks）**：用户 2026-07-27 交代"**如果没有免费版以后再做**"。已查清：BytePlus 无超分接口；Seedance 2.0 的 4K 档是重生成不是超分、$0.78/秒（**4K 档也先不接**）；真超分要 Topaz（fal/Replicate，约 $0.02~0.08/秒）等第三方付费；开源最强 SeedVR2 需 4×H100，我们无 GPU。**接手别重复调研，M020 里数据齐全。**
- **工作流视频快捷菜单的「高清」按钮**：同上押后。做的话语义要改成"提升清晰度/分辨率（内容不变）"。

## 第一次会话（已部署正式服 v1.0.0.43）遗留的待定项
1. **"资产保存中"角标对"存盘快的视频"会一闪而过/看不到**（用户 2026-07-27 反馈，后端验证过没问题）。根因=前端视频轮询前 2min 每 10s、之后每 **30s**（`chat-workbench.tsx` 的 `FAST_VIDEO_POLL_*`/`SLOW_VIDEO_POLL_INTERVAL_MS`）；seedance-mini 存盘只几十秒，"保存中窗口"夹在两次 30s 轮询之间被跳过。慢/跨境卡的视频窗口长、一定能显示（这才是功能目标）。**待用户拍板**是否把慢轮询 30s→15s（工作流侧 `videoPollIntervalMs` 要一起调）。
2. **正式服僵尸 video job 未清**：ID_686996（`312876953@qq.com`）requestId `d049d7ad-9819-4177-8dc4-bf270f4ea0e2:video:0`，status 仍 `running`（07-24 卡下载假死的历史遗留，代码已根治不再复发）。用户交代先不清，以后可手动 `UPDATE "GenerationJob" SET status='failed'...`。

## 本对话（2026-07-27 第一次会话）已完成（细节见 CHANGELOG）
- **视频"卡下载→僵尸任务"根治**（下载 3min 超时 + ffmpeg 60s 超时 + 存盘锁 inFlight 假死自愈 8min + stale 30min→8min）。
- **恢复乐观显示**：视频出结果先用远程地址展示（角标"资产保存中..."），本地存好后无感换本地。对话流+工作流统一；资产库仍只存本地 url+全参数；OpenRouter 需密钥视频不预览；只做视频。
- **工作流生成动画**：侧栏工作流历史条目 + "工作流模式"入口显示 `HaloPulseIndicator`。
- 已整份部署正式服 v1.0.0.43 + push。

## 编辑类收尾剩余小项（非阻塞，待用户定）
1. **编辑类定价**：去背景本地抠图零成本、橡皮/高清走云模型，是否按普通图片计费或调价——待用户定。**视频快捷编辑 = 一次完整视频生成计费，也待确认是否单独定价。**
2. **去背景资产库 model 标签**：进资产库那条仍带计算出的 `input.model`，预览可能仍显示模型标签；工作流节点本身已干净。待用户定是否清。
3. 候选链"失败自动降级"本地只验证过首选成功路径（图片/视频都是），真降级要线上某模型报错才触发。


## 更早的待办（都非紧急）

1. **验收（可选）**：用户可到正式服硬刷抽验 @引用资产三处（视频/资产不再重复、左侧分类溢出滚动条常驻可下拉）；道具生成三档比例/写实出手办；融合生视频参考视频总时长>15s 弹"当前视频加起来是 XX.X 秒…"。
2. **对话流"最多4张"改原生 n**（暂缓，风险高）：多图 orchestration 与 Agent 共用单槽位/重试结构，当前申请4次(每次n=1)功能正常。要做需单独改+验证。
3. **清理旧 mention 死常量**（`mentionAssetTypes`/`isMentionGroupAsset`/`mentionGroupToAssetCountKey`/`mentionAssetTypeLabels`/`MentionAssetGroupType`，已无引用、保留无害）。
4. **复查 `GenerationEvent` 失败原因**（用户交代）：断线重连/BBR 上线跑一阵后，查失败原因聚合 + `/opt/flashmuse/data/runtime/*-diagnostics-log.jsonl`，确认"服务器繁忙"占比是否下降、"真人检测→服务器繁忙"是否消失、有无**新的可恢复错误**要补进 `isTransientServerError`（唯一权威判定）。
5. **M018 / M019 押后**（见 06-memo-tasks）：M018 刚上传媒体不刷新自动切阿里镜像；M019 工作流 canvasJson 大字段重构。
6. **上传规则若上正式服**：视频 200MB 规则需先把正式 nginx `client_max_body_size`（历史 20m）调到 ≥200MB + 上传超时（用户交代部署前评估，未批准前不改服务器）。

## 部署记忆（速查，详见 03）

- ⛔ **Turbopack 不重编 `globals.css`**：本地改样式没反应时，**删掉整个 `.next` 再重启 dev**（重启进程不够）。验证：浏览器里搜 `document.styleSheets` 有没有新类名。
- ⚠️ 部署验证顺序坑：`up -d --build` 之后 `x-app-version` 仍是**上一版**是正常的（那个头发的是运行时 env `PUBLISHED_APP_VERSION`，最后一步才改）。此时判断新代码有没有上去要看 **HTML 里的版本号**。
- 腾讯 ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）。
- 正式服整份对齐 = 备份 → rsync staging→prod（排除 node_modules/.next/tmp/*.log/.git/.env.local/.runtime）→ `docker compose up -d --build flashmuse-app`（entrypoint 自动 migrate）→ `/tmp/syncali.sh`（阿里**正式**镜像）→ `/tmp/health.sh` 四域名 200 → commit+push。正式服不自增版本。
- `/tmp/syncali.sh`+`/tmp/health.sh` 重启清、需重建（内容见 03）；阿里 key root 属主必 sudo。
- PowerShell 内联 `$()`/中文/引号会坏 → 写 .sh scp + `sed -i 's/\r$//'` + bash；改中文源码用 edit 工具禁 Set-Content；一次性 node 脚本放进容器 `/app` 跑。
