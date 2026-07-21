# Next Actions

## ⭐⭐ 最新 END-OF-SESSION（2026-07-21 later 测试服迭代）—— 先读这条：用户要求【下一个 AI 直接部署正式服】

**状态**：测试服 = **v1.0.0.34**；正式服仍 **v1.0.0.25**（`c19ecca`）；GitHub 仍 `c19ecca`；本地代码 = v1.0.0.34 **未 commit**。`tsc` 通过。**有 1 个新 Prisma 迁移 `20260721000000_media_asset_duration_float`**（durationSeconds Int→Float，测试服已 apply）。本 session 全部工作详见 CHANGELOG 顶条（B_232 时长精度 / B_252 音频误入图片槽 / 资产库等待卡恢复 / 预览缩略图从DB读 / 道具风格·印刷品 / 道具@名脱钩根治+回填）。

**下一个 AI 必做（按序）**：
1. **整份对齐部署正式服**（铁律）：`sudo rsync -a --delete --exclude node_modules --exclude .next --exclude tmp --exclude '*.log' --exclude .git --exclude .env.local --exclude .runtime /opt/flashmuse-staging/app/ /opt/flashmuse/app/` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（entrypoint 自动 apply 新迁移）→ 同步 `.next/static` 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/`（`bash /tmp/syncali.sh` 或正式同步脚本，**不是** test 那个）→ 四域名(main/api/ali/static) 200。正式服**原样带 v1.0.0.34、绝不自增版本**。
2. **正式服 DB 回填历史坏数据**（sourcePrompt @名脱钩）：把 `C:\Users\ASUS\AppData\Local\Temp\opencode\backfill-prompt-mentions.js` scp 上去 → `docker cp` 进 **正式 app 容器 `flashmuse-flashmuse-app-1`** 的 `/app/backfill.js` → `sudo docker exec -w /app flashmuse-flashmuse-app-1 node backfill.js`（脚本自带"仅 1:1 才改、否则跳过"的安全逻辑；若临时目录已清，可按 CHANGELOG 描述重写）。
3. **commit + push GitHub**：本对话全部源码 + handover + **更早那批未 commit 的道具图片 prop_image + 工作流用量计数修复**（都在工作树里，一起 commit，以 `git status` 为准）。
4. **正式服抽验**：道具三档比例 / 写实出手办 / "美女照片"出实体相片；融合生视频参考视频总时长>15s 弹"当前视频加起来是 XX.X 秒…"；@引用 .bin 音频不再报 not an image；资产库生成刷新等待卡续跑；预览页图/视频/音频缩略图 + @名蓝色（含回填的 asset_12/14_prop）。
5. **测试服账号**（模拟真实用户，见 03）：`12424740@qq.com`/`dragonstar`（ID_535317）。
6. 非紧急历史待办不变：对话流"最多4张"改原生 n（暂缓）、清理旧 mention 死常量、M018/M019、复查 GenerationEvent"服务器繁忙"。

**关键操作记忆**：腾讯 ssh `ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）；测试服容器 `flashmuse-staging-staging-{app,db}-1`、正式服 `flashmuse-flashmuse-{app,db}-1`（`psql -U flashmuse -d flashmuse`）；PowerShell 里 ssh 内联含中文/引号/`$()` 会被解析坏 → 用 `[Convert]::ToBase64String(...)` 传或写 .sql/.js scp+`docker cp`+`psql -f`/`node`；改中文源码只用 edit/write 工具、禁 Set-Content；node 一次性脚本必须放进容器 `/app` 里跑（`docker exec -w /app ...`）才找得到 `@prisma/client`。测试服部署=本地 `node scripts/bump-version.mjs`→打改动源码 tgz→scp→`sudo tar -xzf -C /opt/flashmuse-staging/app`→`nohup docker compose up -d --build staging-app`（后台轮询）→`sudo bash /opt/flashmuse-staging/sync-ali-test.sh`。

---

## ⭐⭐ END-OF-SESSION（2026-07-21 本地 session：工作流用量计数修复 + 资产库"道具图片"）—— （已随上面测试服迭代一起上测试服）

**状态**：承接线上 v1.0.0.25（`c19ecca` 未动）。本对话所有改动**只在本地**，`npx tsc --noEmit` 通过，无 Prisma 迁移。用户在本地 dev 测试中。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. 工作流用量面板视频计数虚高修复（`countedGeneratedUrls` 持久去重 + 函数式更新内判断 + 旧数据自愈）。
2. 资产库新增"道具图片"`prop_image`（第1组场景后分镜前，图标 `RiBellLine`，三档比例含新增 `grid-square` 四宫格1:1，propify 道具化转换）。约 10 个前后端文件，无迁移。
3. 本地 DB：10 张误分类道具图已修回 `prop_image`；已删本地 `.next` 供干净重启。

**下一个 AI / 用户 待办**：
1. **用户干净重启 dev（已替删 `.next`）+ 浏览器 Ctrl+Shift+R 硬刷**，本地验收：
   - 道具生成三档比例（单道具9:16/多角度16:9/四宫格1:1）出图正确；四宫格=四面 2×2。
   - "生成美女"等非道具提示词 → 出**手办/摆件**（propify 生效），不是真人四面。
   - 刷新后道具图仍在"道具图片"tab（落 `prop_image` 不丢）。
   - @引用资产/从资产库导入/后台用户明细统计都含道具类目。
2. 验收 OK → 走部署铁律：**测试服 `node scripts/bump-version.mjs` → 部署验证 → 整份同步正式服**（无 Prisma 迁移）→ commit+push GitHub（本批含工作流计数修复 + 道具全套）。
3. **若干净重启 + 硬刷后仍落 `conversation_images` 或仍出真人**（排除 stale 后），才是真 bug，再查 `/api/media-assets` 写入路径与客户端 POST 时序 / propify 提示词是否真进了 `/api/image`。
4. 非紧急历史待办（对话流"最多4张"改原生 n、清理旧 mention 死常量、M018/M019、复查 GenerationEvent"服务器繁忙"）不变。

**关键记忆（本 session 踩坑）**：本地 dev 改了 API route / 被其引入的 lib 后，**必须删 `.next` 干净重启**，否则单个路由模块跑旧编译产物会静默把 `prop_image` 兜底成 `conversation_images`（症状：名字带 `prop` 后缀对、但分类落 conversation）。本地库=docker `flashmuse-postgres`，`DATABASE_URL` 见根目录 `.env`；一次性 SQL 写 .sql → `docker cp` → `psql -f`。

---

## ⭐⭐ END-OF-SESSION（2026-07-20 收尾：v1.0.0.25 已部署正式服+测试服 + push GitHub）

**状态**：正式服 = 测试服 = 本地 = GitHub = **v1.0.0.25** / `c19ecca`，四域名 200，无 Prisma 迁移，工作树干净。**四方已同步，无遗留待推/待部署。** 详见 CHANGELOG / 01 顶条（含本对话全部工作的完整记忆）。

**下一个 AI 待办（都非紧急）**：
1. 对话流"最多4张"改原生 n（暂缓，风险高）。
2. 清理旧 mention 死常量（`mentionAssetTypes` 等，无引用）。
3. M018（对话流统一单轮询器）、M019（工作流 canvasJson 大字段重构）押后。
4. 回头复查 `GenerationEvent` "服务器繁忙"占比是否下降、有无新可恢复错误要补进 `isTransientServerError`。
5. **架构认知（排查"某些用户 ali 比 main 慢"用得上）**：`ali`/`static.venusface.com` = 阿里 nginx **静态镜像 + 反代回腾讯新加坡**，动态/API 全 `proxy_pass → 119.28.116.16:5000`；对直连新加坡线路好的用户，走 ali 反而多一跳跨境更慢。ali 不是国内 app 服务器。

**测试服账号（明文，供 AI 登录测试，见 03）**：主测试号 `12424740@qq.com` / `dragonstar`（普通用户 ID_535317，模拟真实用户优先用它）；`lookxun@163.com` / `dragonstar`（白名单 ID_176407，不做真实模拟测试）。**测试内容不要删。**

**部署记忆**：正式服整份对齐 = `sudo rsync -a --delete --exclude node_modules --exclude .next --exclude tmp --exclude '*.log' --exclude .git --exclude .env.local --exclude .runtime /opt/flashmuse-staging/app/ /opt/flashmuse/app/` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app` → docker cp `.next/static` + rsync 到阿里正式镜像 `/var/www/flashmuse-static/_next/static/`（**不是** test 那个）→ 四域名 200。ssh `ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`；PowerShell 里 curl 是别名、含中文/引号的 bash/psql 会坏 → 写 .sh scp + `sed -i 's/\r$//'` 再跑；改中文源码只用 edit 工具（禁 Set-Content）。

---

## ⭐⭐ 最新 END-OF-SESSION（2026-07-20 later：工作流 @引用三修 + 使用提示词媒体替换；已部署测试服 v1.0.0.24）—— 先读这条

**状态**：已部署【测试服 `v1.0.0.24`】，`tsc` 过、无 Prisma 迁移。**未 commit/push、未同步正式服（正式服仍 v1.0.0.19）。** 详见 CHANGELOG 顶条。

**做完**：修工作流"断线后输入框永久转圈'加载引用资产...'"——① 断线/删节点/删缩略图统一自愈删 @名（新增 effect，治本，贯彻"没缩略图=没@名"）；② @名有效性改为"只认当前缩略图"(`validReferenceNames`=`visibleUploads`)，裸/粘贴 @名无效不变蓝不加载；③ 死循环兜底（去掉读整库机制+转圈；`loadMentionAssetFilters` missingFilters 修）。附带：对话流"使用提示词"媒体由累加改为整体替换。改动文件：`workflow-tldraw-canvas-inner.tsx`、`chat-workbench.tsx`、`app-version.ts`。已登录测试服 `12424740@qq.com` 实测 3 项通过。

**下一个 AI / 用户待办**：
1. 用户在测试服（`https://staging-static.venusface.com/`，账号见 `03-deploy-and-servers.md`）继续验，尤其**真·断线**：连线两个节点 → 点缩略图下 @名插入 → 断掉连线 → @名应立即消失、不转圈、不请求风暴。
2. 验完 `git commit`（含 v1.0.0.20~24 全部积压源码 + `deploy/staging/*` + handover），攒够一起 push。
3. 是否上正式服由用户拍板（先测试服→再把测试服 `/app` 整份 rsync 同步正式服，无 Prisma 迁移）。

**测试服部署流程**：`node scripts/bump-version.mjs` → `tsc` → 打改动源码 tgz → scp `/tmp` → `sudo tar -xzf -C /opt/flashmuse-staging/app` → `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台轮询）→ `sudo bash /opt/flashmuse-staging/sync-ali-test.sh` → 浏览器验版本号+功能。ssh `ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）。改中文源码只用 edit 工具、禁 Set-Content；PowerShell 里 curl 是别名会坏、含中文/引号的 psql 写成 .sql scp+`docker cp`+`psql -f`。

---

## ⭐⭐ 最新 END-OF-SESSION（2026-07-20：测试服 HTTPS 域名 + 参考图失败分流 + 音视频组合校验统一 + 使用提示词只读自己那份）—— 先读这条

**状态**：全部只到【测试服 `v1.0.0.23`】，`tsc` 通过、无 Prisma 迁移。**未 commit/push GitHub、未同步正式服（正式服仍 `v1.0.0.19`）。** 本地工作树领先。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. 测试服 HTTPS 域名 `staging-static.venusface.com`（阿里 DNS + Let's Encrypt + nginx 443）；测试服 env `PRIMARY`+`UPLOAD` base 都改它 → img2img 实测走 https URL 分支成功。
2. gpt-5.4-image-2 参考图失败分流：瞬时错误(5xx/429/408)不切 base64 走服务端重连重试 URL；安全审核拒绝秒失败不切 base64。
3. 症状B：音视频参考组合校验抽唯一 `upload-rules.ts`，对话流/工作流/服务端三处统一文案（发送时 v22 + 附加/上传时 v23）。
4. 症状A：使用提示词/显示只读自己那份引用包（删 4 处翻上一条兜底 + 还原不拿@文字重造卡）。

**下一个 AI / 用户 待办**：
1. **用户在测试服验收**（`https://staging-static.venusface.com/`）：① img2img 参考图走 URL、瞬时错误自动重试、安全拒绝秒失败；② 首帧/首尾帧挂音视频→"只有融合模式才支持上传视频和音频"、融合只挂音频→"音频不能单独上传，必须带图片或视频"（@引用/+上传/发送 各入口）；③ 使用提示词只还原该图/视频自己那份、删了不复活、Agent 批量各自独立、引用没了显示裂开。
2. **验完 commit**：本 session 源码（`openrouter.ts`/`transient-error.ts`/`upload-rules.ts`/`video/route.ts`/`chat-workbench.tsx`/`workflow-tldraw-canvas-inner.tsx`/`app-version.ts`）+ `deploy/staging/*`（含新增 `flashmuse-staging-static-ssl.conf`）+ handover。攒到一定程度一次性 push。
3. **是否上正式服由用户拍板**：走"先测试服→验证→再把测试服 `/app` 整份 rsync 同步正式服"铁律，无 Prisma 迁移。正式服本来就在走 https URL（PRIMARY=main.venusface.com），env 无需额外改。
4. 非紧急历史待办：对话流"最多4张"改原生 n（暂缓）；清理旧 mention 死常量；M018/M019 押后；回头复查 GenerationEvent"服务器繁忙"是否下降。

### 关键操作记忆（本 session 已验证）
- **腾讯 ssh**：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）。**从腾讯跳阿里**：`sudo ssh -o StrictHostKeyChecking=no -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 root@101.37.129.164 '...'`。
- **PowerShell 坑**：ssh 内联含中文/`$()`/引号会被 PS 解析坏 → 一律把命令写成本地 .sh，`[Convert]::ToBase64String(...)` 传过去 `echo <b64> | base64 -d | sudo bash`（本 session 全程这么干）。psql 查询同理写脚本。
- **测试服部署**：本地 `node scripts/bump-version.mjs` → 打 tgz（改动源码+app-version.ts）→ scp `/tmp` → `sudo tar -xzf -C /opt/flashmuse-staging/app` → `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/xx.log 2>&1 &`（后台轮询防 120s 超时，build~3min）→ `sudo bash /opt/flashmuse-staging/sync-ali-test.sh` → `curl http://127.0.0.1:5001/` 验版本号 + 外网 200。
- **测试服 DB**：容器 `flashmuse-flashmuse-db-1`（正式）/ `flashmuse-staging-staging-db-1`（测试），`psql -U flashmuse -d flashmuse`。User.id 就是 `ID_xxxxx`（没有 userCode 列）。诊断日志 `data/runtime/generation-diagnostics-log.jsonl`（事件 `image-provider-request-start/url-fallback-base64/success/reference-sizes`，含 `refMode`/`host`）。
- **改中文源码只用 edit/write 工具，禁 `Set-Content`（乱码）。**

---

## （历史）⭐⭐ END-OF-SESSION（2026-07-19：GPT版并存 + 预览页 + 测试服封面修复 + 整份对齐部署正式服 v1.0.0.19 + push）

**状态**：✅ **已整份对齐部署正式服 `v1.0.0.19`**（四域名 200、无 Prisma 迁移）+ **已 push GitHub `d85fa92`**。三方同步：正式服=测试服=本地=GitHub。改动文件：`src/lib/{models,openrouter,media-asset-record,app-version}.ts`、`src/components/{chat-workbench,workflow-tldraw-canvas-inner}.tsx`、`Dockerfile`、`deploy/staging/docker-compose.yml`、`.gitignore`。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. GPT-5.4 Image 2（GPT版）`openai/gpt-5.4-image-2-agent` 走老接口并存（映射回真实名，无4K/画质/16图/金色/Agent）。
2. 三处弹窗小灰字（仅对话流+工作流）。
3. 对话流优化提示词加"不改原意+纠错"规则。
4. 预览页顶部 80×80 参考缩略图（图/视频/音频）+ @名蓝色 + 使用提示词统一 copyPrompt（跨 session）。
5. 测试服视频封面根因（NEXT_PUBLIC_UPLOAD_BASE_URL 构建注入）修复。
6. 扣费实测正常（GPT版9积分/张、新接口~10积分/张）。
7. 正式服 UPLOAD_RULE_OVERRIDES gpt-5.4-image-2 改 16。

**下一个 AI / 用户 待办**：
1. **正式服抽测（用户/下一个 AI）**：GPT版出图+扣费、新接口 img2img/画质/4K、预览页缩略图（图/视频/音频）+ 使用提示词带全素材、对话流重试卡槽/红字。
2. **测试服配真 https 仍未做（历史待办，非阻塞）**：阿里云 DNS 加 `staging-static.venusface.com`→`101.37.129.164` + Let's Encrypt，让测试服 img2img 真实走 URL 分支（当前测试服走 base64 回退，功能正常）。加好后设测试服 env + nginx 443。
3. 非紧急：对话流"最多4张"改原生 n（暂缓，风险高）；清理旧 mention 死常量；M018/M019 押后。
4. **备份**：本次正式服部署前备份在 `/opt/flashmuse/app-backups/20260719-presync-v19`。

### 关键操作记忆（本 session 已验证）
- 正式服整份对齐：`sudo rsync -a --delete --exclude node_modules --exclude .next --exclude tmp --exclude '*.log' --exclude .git --exclude .env.local --exclude .runtime /opt/flashmuse-staging/app/ /opt/flashmuse/app/` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app` → 改 `/opt/flashmuse/data/.env.local` UPLOAD_RULE_OVERRIDES + `docker compose up -d --force-recreate flashmuse-app` → `bash /tmp/syncali.sh`（阿里正式镜像 flashmuse-static）→ 四域名 200。
- 正式服 compose（`/opt/flashmuse/docker-compose.yml`）只传 `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED`，**不传** IS_TEST/UPLOAD_BASE_URL（正确：无(t)、upload base 回退 api.venusface.com=真实主源）。
- ssh 内联禁 `$(...)`（PS 会解释）；含 `/`/中文/引号的 sed/grep/psql 写成 .py/.sh scp 上去跑；改中文源码用 edit 工具。
- 测试服部署=bump→tgz→scp→`tar -xzf -C /opt/flashmuse-staging/app`→`docker compose up -d --build staging-app`(后台轮询)→`sync-ali-test.sh`。

---

## （历史）END-OF-SESSION（later 2026-07-19：gpt-5.4-image-2 img2img 修复 + 对话流重试大修 + 免费HTTPS验证）

**状态**：测试服 `v1.0.0.13`（已被 v1.0.0.19 整份对齐覆盖上线）。

### ⭐ 正式服整份对齐流程（用户明确"部署正式服"才执行；已核实无需跑迁移）
1. 备份：`sudo cp -r /opt/flashmuse/app /opt/flashmuse/app-backups/<ts>-presync-v13`。
2. 本地 rsync（同机，测试服→正式服）：`/opt/flashmuse-staging/app/` → `/opt/flashmuse/app/`，排除 `node_modules`/`.next`/`tmp`/`*.log`/`.git`/`.env.local`（`docker-compose.yml`/`Dockerfile`/`entrypoint` 两服一致、真正区分两服的 compose 在父目录 `/opt/flashmuse` vs `/opt/flashmuse-staging`，不在 `/app`；正式服 `/app` 无 `.env.local`，env 挂载自 `data/`）。同步后正式服自动 = v1.0.0.13。
3. 重建：`cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询；entrypoint `migrate deploy` 因迁移一致=空操作）。
4. **改正式服 env**：`/opt/flashmuse/data/.env.local` 的 `UPLOAD_RULE_OVERRIDES` gpt-5.4-image-2 `maxCount:5`→`16`，`docker compose up -d --force-recreate flashmuse-app` 重载。
5. 同步 `.next/static` 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/`（key `/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519`，root@101.37.129.164）——**不是**测试服的 `flashmuse-static-test`。
6. 验证：四域名(main/api/ali/static) 200；正式服 footer 版本号 v1.0.0.13(无 `(t)`)；抽测 gpt-5.4-image-2 img2img(URL分支)、画质档、重试卡槽定位、红字。
- 风险：一次性上线 v3→v13 全部改动（都在测试服验过），最大变化=gpt-5.4-image-2 换接口；部署窗口老标签 ChunkLoadError 硬刷即可；无 DB 迁移。

### 关键操作记忆（本 session 踩坑）
- ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）。
- 测试服部署=本地 `node scripts/bump-version.mjs` → 打 tgz(改动源码+app-version.ts) → scp `/tmp` → `sudo tar -xzf -C /opt/flashmuse-staging/app` → `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台轮询防 120s 超时）→ `bash /opt/flashmuse-staging/sync-ali-test.sh` → `curl http://127.0.0.1:5001/` 验版本号 + 外网 `http://101.37.129.164:8080/` 200。
- 测试服 DB：容器 `flashmuse-staging-staging-db-1`，`psql -U flashmuse -d flashmuse`（**不是 postgres 用户**）。OpenRouter key 在 `/opt/flashmuse-staging/data/.env.local`（sudo 读）。
- 诊断日志：`/opt/flashmuse-staging/data/runtime/generation-diagnostics-log.jsonl`（事件 `image-provider-non-ok`/`image-provider-url-fallback-base64`/`image-provider-success`/`image-provider-reference-sizes`，含 `refMode`）。
- ⚠️ PowerShell 里 ssh 内联命令**禁用** `\"`、中文、`$()`——会被 PS 解析坏。复杂命令写成本地 .sh scp 上去 `sed -i 's/\r$//'` 再 `sudo bash`；grep 正则用 `.` 代替 `"`、避免反斜杠。改中文源码只用 edit 工具。

---

## ⭐⭐ 上一 END-OF-SESSION（gpt-5.4-image-2 迁 OpenRouter 新图片接口 + 4K + 画质档三处 + 输入框/资产库 UI + 后台上传规则清理）

**状态**：本 session 只改 **gpt-5.4-image-2**（其它模型零改动），**已部署测试服 `v1.0.0.8`**（外网 `http://101.37.129.164:8080/` 200、阿里测试镜像已同步、`tsc` 过、无迁移）。**未同步正式服、未 commit/push**。详见 CHANGELOG / 01-current-status 顶条。改动文件：`src/lib/{models,openrouter,upload-rules,generation-jobs,app-version}.ts`、`src/components/{chat-workbench,workflow-tldraw-canvas-inner}.tsx`、`src/app/admin/{page.tsx,admin-upload-rules-panel.tsx}`；另本地 `.env.local`（override 5→16，env 数据不进 git）。

**本 session 做完**：
1. gpt-5.4-image-2 走新 `POST /api/v1/images`（size 精确像素/智能比例不传 size/quality/原生 n/参考图公网 URL/`usage.cost→usd`）+ 4K 尺寸表 + `classifyImageResolutionByModel` 修 4K 显示。
2. 画质档三处（对话流/资产库/工作流，默认**高**，仅该模型显示）；对话流按钮标题显示"画质X"；资产库 K数/画质等宽下拉、选模型按钮让宽。
3. 对话流输入框撑宽逻辑重写（ResizeObserver 实测 offsetWidth，发送按钮不出框、点菜单不抖）。
4. 工作流比例弹窗内部点击不关、点外部才关。
5. 后台上传规则面板过滤弃用的 3 个 OpenRouter 重复款（不动共享数组，服务端传可用 ID）。
6. gpt-5.4-image-2 上传默认 16/开启（代码 + 测试服 env 都改，正式服 env 待改）。

**下一个 AI 待办**：
1. **浏览器验证测试服（ali 硬刷）**：三处画质档显示+默认高；gpt-5.4-image-2 各比例×1K/2K/4K 出图尺寸对（4K 用 size 精确像素、参数框显 4K 不是 3K）；智能比例=模型自动尺寸；参考图 img2img（URL 模式）；n 多图；扣费随档位/尺寸；后台上传规则页看不到 3 个弃用款、GPT-5.4 Image 2 显 16/开启；对话流输入框选画质/模型时发送按钮不被顶出、点菜单间距不抖；资产库 K数/画质等宽不换行。回归：Gemini/BytePlus 出图、视频、其它模式不受影响。
2. **⚠️ 暂缓项：对话流"最多4张"改原生 n=1请求**——多图 orchestration 与 Agent 共用、`appendImagesToAssistantMessage` 单槽位/失败索引重试，改成一次返回多图需重写放置逻辑，风险高。当前申请4次(每次n=1)功能正常。要做需单独改+验证。
3. **参考图真实上限**：跑一阵后看日志 `image-provider-reference-sizes`，把 gpt-5.4-image-2 参考图单张/总量上限从 10MB/16张 改成 provider 真实支持值（`upload-rules.ts`）。
4. **等用户说"部署正式服"才同步**（详见下方"部署正式服流程"）。
5. **push GitHub**：本 session + 之前 staging 那几批全部未 push。
6. Gemini 两个图片模型本次**故意没动**（用户只让改 gpt-5.4-image-2）。

**⭐ 部署正式服流程（用户明确要求"部署正式服"才执行）**：
- **不 bump 版本号、不从本地重新传**（可以，但没必要）：把**测试服 `/opt/flashmuse-staging/app` 那份源码原样复制到正式服 `/opt/flashmuse/app`**（服务器到服务器），保持 v1.0.0.8 → "版本号一样=代码一样"。
- 正式服 `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`。
- 同步 `.next/static` 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/`（**不是**测试服的 `flashmuse-static-test`）。
- 四域名 200。
- **⚠️ 正式服 env 数据**：`UPLOAD_RULE_OVERRIDES` 是每台服务器独立的 env 数据（不随代码同步）。正式服若也存了 gpt-5.4-image-2 maxCount:5（早前线上后台保存过），部署后仍显示 5，需在正式服的 env 文件（对照测试服是 `/opt/flashmuse-staging/data/.env.local` 挂载 `/app/.env.local`；正式服对应 `/opt/flashmuse/data/.env.local`）把 `:5}}}` 改成 `:16}}}` 并重建/重启容器，或到正式服后台面板把它改 16 保存一次。部署前可先只读查一下正式服该值。

**部署/踩坑记忆**：ssh `ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）；测试服部署=bump→打 tgz→scp /tmp→`sudo tar -xzf -C /opt/flashmuse-staging/app`→`cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台+轮询防 120s 超时）→`bash /opt/flashmuse-staging/sync-ali-test.sh`→curl 验版本号；改中文源码用 edit/write 工具禁 `Set-Content`；PowerShell 里 grep 用不了、含中文/`$()`的内联命令会坏，写 .sh/.mjs scp 或用 Grep/Read 工具。测试服 `UPLOAD_RULE_OVERRIDES` 在 `/opt/flashmuse-staging/data/.env.local`（挂载进容器 `/app/.env.local`），改后 `docker compose up -d --force-recreate staging-app` 重载。

---

## ⭐⭐ 上一 END-OF-SESSION（上传规则校正 + 文案通用化 + 资产库拖拽 + 音频回填 + 浏览器读网站）

**状态**：本 session 代码改动**全部已部署测试服 `v1.0.0.5`**（外网 `http://101.37.129.164:8080/` 200、阿里测试镜像已同步、`tsc` 过、无迁移）；**未同步正式服、未 commit/push**。正式服仅"17 音频回填"这条线上数据已改。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. 17 音频 `durationSeconds` 回填（正式服 DB）——修 3 账号生视频"音频时长读取失败"。
2. 视频上传规则按当前官网校正为 ≤200MB / 像素 ≤8295044（含4k），改掉 3 处过时 50MB/2086876。
3. 上传格式拦截文案通用化（"仅支持 X 格式的Y"，不再说"当前模型"）。
4. 资产库拖拽上传（三个上传标签各自路由+校验，遮罩只在这三标签弹、文案按标签）。
5. 删除 Byteplus 文件夹网站复制文档；`00-README` 顶条记录"AI 可用浏览器工具直读全网站"。

**下一个 AI 待办**：
1. **等用户验收测试服后同步正式服**（用户说"部署正式服"才做）：不跑 bump 脚本，把测试服 `/opt/flashmuse-staging/app` 那份源码（本 session 6 个改动文件 + `src/lib/app-version.ts` 版本号 v1.0.0.5）原样 scp 到正式服 `/opt/flashmuse/app` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app` → 同步 `.next/static` 到阿里正式镜像 `/var/www/flashmuse-static/_next/static/` → 四域名 200。改动文件清单见 CHANGELOG §6。
2. **push GitHub**：本 session + 之前 staging 那批全部改动仍未 push（GitHub 落后）。
3. **原始需求仍未做**：OpenRouter 新图片接口迁移（见下方"测试服搭建"那条 END-OF-SESSION 的待办①），在测试服里做。
4. 非紧急：清理旧 mention 死常量；M018/M019 押后。

**部署/踩坑记忆**：ssh `ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）；测试服部署=打 tgz→scp /tmp→`sudo tar -xzf -C /opt/flashmuse-staging/app`→`cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台+轮询防 120s 超时）→`bash /opt/flashmuse-staging/sync-ali-test.sh`→curl 验版本号；阿里 key root 属主一切到阿里 ssh/rsync 加 sudo；改中文源码用 edit/write 工具禁 `Set-Content`；PowerShell 内联含 `$()`/中文的 psql/bash 会被搅坏，写成 .sh/.sql/.mjs scp 后 `sed -i 's/\r$//'` 再跑；容器内跑一次性脚本 `sudo docker cp x.mjs 容器:/app/ && sudo docker exec -w /app 容器 node x.mjs`。

---

## ⭐⭐ 2026-07-18（测试服搭建 + 版本号体系 + 部署铁律）END-OF-SESSION —— 先读这条

**状态**：测试服已上线；版本号功能已按铁律部署测试服+正式服（两边 `v1.0.0.2`）；**全部未 commit/未 push GitHub**。详见 CHANGELOG / 01-current-status 顶条。

### 🔒 部署铁律（每次动手前必读，已在 AGENTS.md 顶部）
- 用户说 **"部署掉/部署一下"** = **只部署测试服**，绝不动正式服。
- 只有用户明确说 **"部署正式服/更新正式服/上线正式服"** 才走：**先跑 `node scripts/bump-version.mjs` 自增 → 部署测试服 → 验证 → 再把测试服那份代码原样同步正式服（不再自增）**。永不跳过测试服、永不直接改正式服代码。
- 目标：版本号一样=代码一样。

### 测试服部署流程（"部署掉"走这个）
1. 本地 `node scripts/bump-version.mjs`（版本号+1）+ `npx tsc --noEmit`。
2. 打包改动源码 scp 到腾讯 `/tmp` → `sudo tar -xzf` 到 `/opt/flashmuse-staging/app`。
3. `cd /opt/flashmuse-staging && nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台+轮询防超时）。
4. `bash /opt/flashmuse-staging/sync-ali-test.sh`（同步阿里测试镜像，否则 chunk 404）。
5. 验证：`curl http://127.0.0.1:5001/`、外网 `http://101.37.129.164:8080/`（含底部版本号已 +1）。

### 正式服部署流程（仅当用户明确要求）
1. **先**完整部署测试服（含自增）并验证。
2. **不跑 bump 脚本**，把测试服 `/opt/flashmuse-staging/app` 那份源码（含已定版本号）原样 scp 到正式服 `/opt/flashmuse/app`（本 session 用的是同一份本地源码 + `app-backups/verbadge-*` 备份）。
3. `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app` → 同步 `.next/static` 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/` → 四域名 200 验证。

### 下一个 AI 待办（按优先级）
1. **⭐ OpenRouter 新图片接口迁移（本 session 原始需求，重点）**：把 `src/lib/openrouter.ts` 的生图从 `chat/completions`+`modalities` 老写法迁到新专用接口 `POST /api/v1/images`（`input_references`/原生 `n`/`resolution`/`aspect_ratio`/定价发现/provider 路由）。**必须先在测试服反复验证，OK 后经用户同意才同步正式服。** 建议低风险策略：新旧并存、按模型路由（新模型/gpt-5.4-image-2 走新接口，老模型可先留旧接口或加自动回退）。受影响模型见 CHANGELOG 顶条 §1。用户强调 gpt-5.4-image-2 必接（当前最强图片模型）。
2. **push GitHub**：本 session 全部改动未推。文件清单见 CHANGELOG 顶条 §0。
3. **服务器升级**（用户下周做）：桌面 `服务器升级建议.md`，升 8核/16G 后测试服/正式服部署互不影响。
4. 非紧急：清理旧 mention 死常量；M018/M019 押后。

### 关键操作记忆（防踩坑）
- 改中文源码只用 edit/write 工具，**禁 PowerShell Set-Content/`(gc)|sc`**（mojibake）。
- ssh 内联含 `$(...)`/`$VAR`/`%{}`/嵌套引号/中文 → 写成本地 .sh/.sql，scp + `sed -i 's/\r$//'` 再跑。
- 阿里 key `root` 属主，一切到阿里 ssh/rsync 加 `sudo`。
- 仓库 `deploy/staging/` 有测试服全套基础设施文件 + README，可重建。

---

## ✅ 2026-07-22（延续 session）视频/音频上传全链路修复 + 体验优化 END-OF-SESSION

**状态**：✅ 全部已部署腾讯 + 同步阿里、main/api/ali/static 四域名 200、`npx tsc --noEmit` 通过、无 Prisma 迁移。**⚠️ 未 commit / 未 push；本地工作树 = 线上最终代码；GitHub 落后。部署是打单文件 tgz scp 覆盖 `/opt/flashmuse/app` + `docker compose build/up`，不是走 git。** 详见 CHANGELOG 顶条。

**本 session 做完**：
1. 修视频/音频上传线上 500（`Cannot read 'split'`）：MIME 空值安全 + `File` 展开丢 `name/type` 根因（改显式传字段）。三条链路（对话流/资产库/工作流）共用 `/api/upload-file`，一处修全好。
2. 三体验问题：工作流进度起步 + 内容哈希秒回预检（新 `upload-content-hash.ts` + GET 预检 handler）；对话流视频封面（服务端 `createUploadedVideoPoster` 生成 `.poster.jpg` + 写 `posterUrl`）；资产库上传临时卡（`AssetMediaUploadCard` + `UploadProgressOverlay`）。
3. 修回归：旧上传视频封面丢失 → 撤 `/files/` 封面推算，只用真实 `asset.posterUrl`（新上传服务端生成）。
4. 时长阈值放宽 15.05→16.01（刚好 15 秒可传）。
5. 方案 A：同步阿里改回后台异步（不卡 91%）+ `recent-upload-origin.ts`（本会话读腾讯、刷新走阿里）+ 前端预热。
6. 音频跨域：腾讯 nginx `/generated` 加 CORS 头（wavesurfer 需要），已 reload。

**下次若要 push GitHub**：把本地未提交改动 commit（应与线上一致）再推。涉及文件见 CHANGELOG 顶条第 0 条。

**未决待办**：M018（06-memo-tasks.md）——刚上传媒体不刷新不会自动切阿里镜像，用户暂时保持现状。

**若继续做上传相关**：工作流的 `getStaticMediaUrl`（`workflow-tldraw-canvas-inner.tsx:1625`）是另一套（直接同源、不走阿里 static base），本 session 未动；若工作流上传的音视频也需要「本会话读腾讯」处理，需另行统一。

## 🚀 最新：用户要求下一个 AI 直接部署视频/音频上传改造

**当前状态**：仅本地，`npx tsc --noEmit` 已通过；未 build / 部署 / commit / push；无 Prisma 迁移。新增文件：`src/lib/media-upload-validation.ts`、`src/lib/media-upload-probe.ts`、`src/components/video-upload-thumbnail.tsx`。改动同时包含统一服务端上传限制、资产库音视频直传、工作流归属、音频扩展名 `.bin` 修复、对话流/工作流输入框视频封面与图标兜底。

**部署前必须做**：
1. 检查 `git status` 与 diff，不要带 `.playwright-mcp/`。
2. 生产 Nginx 的 `client_max_body_size` 从历史20MB提高到至少**200MB**，并增加客户端请求/代理上传读取超时；否则 MP4/MOV 200MB 规则不能在线上工作。
3. 运行 `npx tsc --noEmit`；用户已明确要求部署，随后按 `03-deploy-and-servers.md` 的腾讯构建、阿里 `.next/static` 同步、四域名健康检查流程执行。无 Prisma 迁移。

**部署后立即验证，不可跳过**：
1. 资产库上传 MP4/MOV 和 MP3/WAV：成功入库、分类及左侧计数正确、视频显示封面/首帧，加载失败显示视频图标。
2. 对话流和工作流上传同样四种文件：服务端返回权威名；工作流归入 workflow 分类；重复文件复用而不重复入库。
3. 验证拒绝：错误格式、视频>200MB、音频>15MB、时长不在2-15秒、视频尺寸/FPS/编码不合规。
4. Seedance 2.0/Fast/Mini 融合模式可引用合规视频/音频；首帧/首尾帧和其它模型仍拒绝。
5. 若资产库仍显示“文件上传失败”，在浏览器 Network 保存 `POST /api/upload-file` 的状态码和 response，并查看应用容器日志后再改代码，禁止猜测修复。

## ⚠️ 2026-07-22 视频/音频上传限制统一 + 资产库直传入口 END-OF-SESSION

**状态**：仅本地，`npx tsc --noEmit` 通过；未 build / 部署 / commit / push；无 Prisma 迁移。完成：BytePlus 官方融合模式视频/音频规则统一、真实文件 ffmpeg 校验、`upload-file` token/登录鉴权、工作流归属首次写入、`/api/video` 用户资产复验、资产库上传视频/音频按钮。

**下次优先验证**：本地浏览器测试资产库 MP4/MOV/MP3/WAV 直传、格式/200MB/15MB/时长/视频尺寸提示、重复文件复用、对话流/工作流融合模式上传、首帧/首尾帧拒绝音视频、工作流上传后归入工作流分类。未部署前不要改 Nginx；若用户要求部署，先说明200MB视频必须同步调整网关 body size/timeout。

## ⚠️ 2026-07-22 本地资产库直传 + 实时计数 + 图片上传限制统一 END-OF-SESSION —— 先读这条：未部署、下一个 AI 继续视频/音频/文档

**状态**：全部仅本地，`npx tsc --noEmit` 已通过；**未 build / 未部署 / 未 commit / 未 push**；无 Prisma 迁移。代码改动=新增 `src/lib/image-upload-validation.ts`，改 `chat-workbench.tsx`、`workflow-tldraw-canvas-inner.tsx`、`api/asset-upload-temp/route.ts`、`lib/upload-rules.ts`；另有本次 handover。禁止把本批当成线上已生效。

**本 session 做完**：
1. 资产库「上传图片」改成右侧网格内直传：无上传弹窗、选图即显进度卡、完成自动入库、软删除不变、去掉上传前改名；一次最多10张。
2. 资产库数字实时同步：新增/删除/恢复/移动、对话流上传/生成、工作流生成均即时更新左侧与 `@引用资产`；服务端读数仍最终校准。
3. 图片格式/大小统一：只允许 JPG/JPEG/PNG/WebP，原始单图 ≤10MB；后端强制+资产库/对话流/工作流前端即时校验；模型只控制图片是否可用与数量；PNG/WebP 和异常 JPEG 仍转 JPG 落盘。

**下一个 AI 优先待办（用户点名）**：统一视频、音频、文档上传。必须先做影响排查并向用户确认，禁止直接猜规则：
1. 列出资产库、对话流、工作流三端和 `/api/upload-file` 等服务端入口当前的格式、单文件大小、时长/分辨率、总时长、数量、内容哈希去重、命名、入库分类差异。
2. 与用户确认视频/音频/文档分别允许哪些格式和大小，以及是否保留视频/音频的模型相关时长、尺寸、数量限制。不要把图片 10MB 机械套到其它媒体。
3. 用户确认后抽统一纯校验模块，后端为唯一强制入口，三前端提前提示并复用；所有模式同规则，保留既有 `uploadRule` 的模型 enabled/数量及视频音频时长/尺寸语义。
4. 浏览器验证本批图片：资产库直传1张/10张/第11张提示、PNG/WebP/JPG、GIF/HEIC/AVIF拒绝、10MB临界与超限、对话流/工作流同规则、上传成功/删除/恢复/移动分类时左侧与@引用数字立即变化。

## ✅ 2026-07-22 (部署 07-20+07-21 全部上线 + 一批工作流/UI 小改动 session) END-OF-SESSION —— 先读这条：三方已同步，无待部署

**状态**：全部已部署腾讯 + 同步阿里、四域名 200、`tsc`+`build` 通过、无 Prisma 迁移、**已 push GitHub（三方同步 `ac4c38f`）**。`wavesurfer.js` 已随镜像 build 装入。工作树应干净（除本次 handover 提交）。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. 部署 07-20（资产库改造 + wavesurfer.js）+ 07-21（@引用迷你资产库 + 从资产库导入音视频 + 视频卡@图标）两批全部上线。
2. 工作流空生成节点删除确认弹窗（输入框有内容才弹，三删除入口全覆盖）。
3. 图层面板右键不出菜单。
4. @引用弹窗视频无封面用首帧（上传视频不再只显图标）。
5. @引用音频卡时间改"倒计时秒/总秒数"两位数、移右上（仅 @引用弹窗，加 `secondsCountdown` prop 隔离）。
6. 从资产库导入弹窗选中蓝框/勾层级修复（z-50 + DOM 末尾，盖住渐变黑）。
7. 核查这些改动不影响生成主链路/扣积分。

**下一个 AI 待办 / 可优化（都非紧急）**：
1. **浏览器全面验证（ali 硬刷，本 session 未逐项跑 dev）**：
   - 从资产库导入：上传视频（缩略图+播放键/无封面首帧）、上传音频（波形）显示、能导入工作流（音频进音频节点）。
   - @引用弹窗三处（对话流/资产库生成/工作流）：迷你资产库左右结构、首次只转圈一下、切标签转圈、下拉流式；三处大小一致。
   - Seedance 2.0 融合模式 @引用视频/音频进杠（@名变蓝/可删/能生成）、超时长/超尺寸被拦、不支持的模型提示。
   - 视频卡提示词 @视频封面+播放键、@音频深灰声纹图标（纯展示不可点）。
   - **本 session 新增**：工作流空图片/视频节点（输入框有字）删除弹确认框、确定按钮黑色宽度对齐导入弹窗；输入框空直接删；图层面板右键不出菜单；@引用上传视频显首帧封面；@引用音频卡右上"倒计时/总秒数"；从资产库导入选中蓝框/勾不被渐变挡。
2. **清理旧 mention 死常量**（`mentionAssetTypes`/`isMentionGroupAsset`/`mentionGroupToAssetCountKey`/`mentionAssetTypeLabels`/`MentionAssetGroupType`，已无引用、保留无害）。
3. M018（对话流统一单轮询器）、M019（工作流 canvasJson 大字段重构）仍押后。

**部署流程 & 踩坑（下个 AI 改代码必读）**：
- ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`。
- scp 源码到 `/opt/flashmuse/app/`（新文件也要，先 /tmp 再 `sudo cp`；改 package.json/lock 也 scp）→ `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app > /tmp/build.log 2>&1 &`（后台+轮询防 120s 超时；Dockerfile 内会 `npm install`，新增 npm 依赖随 build 自动装，无需宿主 npm install）→ `bash /tmp/syncali.sh`（同步 `.next/static` 到阿里，否则全站 404）→ `bash /tmp/health.sh`（四域名 200）。
- **`/tmp/syncali.sh`、`/tmp/health.sh` 重启后会清，需重建**（内容见 CHANGELOG 顶条 §1）。
- **Ali 同步 key 属主 root，一切 ssh/rsync 到阿里都要 `sudo`**（非 sudo `Permission denied`）。
- **改中文源码一律用 edit 工具，禁 `Set-Content`（整文件 mojibake）**；PowerShell 内联含 `$(...)`/`%{}`/引号/中文的 bash/curl/psql 会被本地 PS 先解释坏 → 一律 scp .sh/.sql/.mjs 再 `sed -i 's/\r$//'` + 跑。
- **部署窗口旧标签会报 ChunkLoadError**，硬刷即可，非 bug。

---

## ⚠️ 2026-07-21 (从资产库导入音视频 + @引用资产弹窗大改造 session) END-OF-SESSION —— 先读这条：**全部仅本地，用户要求下一个 AI 全部部署上线**

**状态**：本 session 全部改动**只在本地**，`npx tsc --noEmit` 通过，**未 build / 未部署 / 未 commit / 未 push**。无 Prisma 迁移。无新增依赖。详见 CHANGELOG / 01-current-status 顶条。

**⚠️ 关键：07-20 那批（资产库改造 + 新依赖 `wavesurfer.js`）也从未部署**，本 session 建立在其之上。所以要**一次性部署 07-20 + 07-21 两批全部改动**。

**本 session 做完**：
1. 「从资产库导入」补 上传视频/上传音频两分类（视频小缩略图+播放键、无封面首帧兜底、音频波形卡）；导入支持建音频节点；音频波形卡时间移左上。
2. ⭐「@引用资产」弹窗三处统一改成迷你资产库（共享组件 `AssetMentionPicker`，左标签+右 5 列 80×80 小缩略图）；显示全部分类（资产库生成弹窗隐藏视频/音频）；视频/音频可引用（方案A，复用 + 号上传 `uploadRule` 校验，从 url 读元数据，不重新上传）；按标签懒加载（首次只加载当前标签 30+全部计数，切标签转圈、下拉流式）。
3. 视频卡提示词 @媒体小图标：视频封面+播放键、音频统一深灰 `RiVoiceprintLine`，纯展示不可点。

**下一个 AI 待办（用户明确：全部部署）**：
1. **部署（07-20 + 07-21 一起）**：`git status`/`diff` 确认改动文件（07-20：新增 `audio-waveform-player.tsx`、改 `workflow-tldraw-canvas-inner.tsx`/`chat-workbench.tsx`/`api/workspace-state/route.ts`/`api/media-assets/route.ts`/`lib/generation-jobs.ts`/`package.json`+`package-lock.json`；07-21：新增 `asset-mention-picker.tsx`、改 `chat-workbench.tsx`/`workflow-tldraw-canvas-inner.tsx`/`workflow-tldraw-canvas.tsx`/`audio-waveform-player.tsx`）→ `npm run build` 本地过 → scp 源码到 `/opt/flashmuse/app/src/...`（`package.json`/`package-lock.json` 也要 scp）→ **服务器 `cd /opt/flashmuse/app && npm install`（装 wavesurfer.js）** → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log`）→ **必须同步 `.next/static` 到阿里**（`bash /tmp/syncali.sh`，否则全站 404）→ 四域名 200 → commit+push GitHub。无 Prisma 迁移。
2. **浏览器验证（ali 硬刷）**：
   - 从资产库导入：上传视频（小缩略图+播放键）、上传音频（波形）能显示、能导入工作流（音频进音频节点）。
   - @引用弹窗三处：迷你资产库左右结构、首次打开只转圈一下就出（加载量小）、切标签转圈、下拉"正在加载中..."流式加载；三处弹窗大小一致。
   - Seedance 2.0 融合模式：@引用视频/音频**能进杠**（@名变蓝、可删、能生成）；超时长/超尺寸被拦并提示；不支持视频/音频的模型 @引用它们时提示"当前模型不支持…"。
   - 视频卡提示词里 @视频显封面+播放键、@音频深灰声纹图标，都点不出预览（纯展示）。
3. 非紧急：清理旧 mention 死常量（`mentionAssetTypes` 等）；M018/M019 仍押后。

**部署流程细节**同下方 07-19/07-18 条（scp→docker compose up -d --build→syncali→四域名 200；改中文源码用 edit 工具禁 `Set-Content`；一次性脚本走 scp+`docker exec`）。

---


## ⚠️ 2026-07-20 (资产库改造 session) END-OF-SESSION —— 先读这条：**全部仅本地，未部署/未 commit**

**状态**：本 session 全部改动**只在本地**，`npx tsc --noEmit` 通过，**未 build / 未部署腾讯 / 未同步阿里 / 未 commit / 未 push**。无 Prisma 迁移。**新增 npm 依赖 `wavesurfer.js`（v7）**。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：资产库改造（上传的资产分组=上传图片/视频/音频，对话流+工作流合并；上传视频 video-row+首帧封面、从生成视频移出；上传音频波形卡悬停播放）+ 抽共享音频波形播放器 `src/components/audio-waveform-player.tsx`（wavesurfer.js，工作流音频节点也改用）+ 图片生成"存盘慢就重排队绝不丢库"改造(`runImageJob`) + 手动补一张本地漏掉的分镜图。新增两条铁律进 `AGENTS.md`/`00-README.md`。

**改动文件（均仅本地）**：新增 `src/components/audio-waveform-player.tsx`；改 `src/components/workflow-tldraw-canvas-inner.tsx`、`src/components/chat-workbench.tsx`、`src/app/api/workspace-state/route.ts`、`src/app/api/media-assets/route.ts`、`src/lib/generation-jobs.ts`、`package.json`/`package-lock.json`、`AGENTS.md`、`handover/*`。

**下一个 AI 待办**：
1. **⭐（用户点名，接着做）改造 `@引用资产` + `从资产库导入`**：目前 @提及弹窗（对话流+工作流输入框）和工作流"从资产库导入"弹窗（`ASSET_IMPORT_CATEGORIES`，`chat-workbench.tsx:~1109`；`mentionAssetTypeLabels`/`mentionGroupToAssetCountKey` 等）**只显示图+视频**，要让**音频（和视频）也显示出来**，和资产库这次改造对齐。⚠️ 交互需先和用户确认：音频卡在资产库已去掉"@到对话框"（大部分模型不支持音频/视频参考），那 @引用弹窗里音频要不要能选？导入弹窗里音频能否拖进工作流音频节点？动代码前先按铁律评估+问用户。
2. **部署（用户说部署时才做）**：`npm run build`（本地先过）→ 服务器 **`npm install`（装 wavesurfer.js 原生依赖）** → scp 源码到 `/opt/flashmuse/app/src/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log`）→ **必须**同步 `.next/static` 到阿里（否则全站 404）→ 四域名 200。无 Prisma 迁移。commit+push（git 攒够一起推）。
3. **浏览器验证**（本 session 未跑 dev 全验）：上传的资产分组三类显示；音频卡悬停自动播放/移开停/拖红线无滞后/时间右上/纯文件名；上传视频首帧封面+一行4；切页面来回音频 4 个都在；上传图片滚到底加载补齐(计数=显示)；新生成分镜图 1~2 分钟后自动进库（本地跨境慢）。

**关键记忆**：资产库过滤/计数在**服务端** `workspace-state` 路由（`getAssetPageWhere`/`getAssetCounts`），前端 `isAssetInFilter` 只做本地保留/计数——**改分类必须两处同步**否则计数/显示对不齐。`.bin` 存储的上传音频靠扩展名认不出，必须靠 `MediaAsset.mediaType`（两个资产接口 workspace-state + media-assets GET 都已透传）。本地 DB=docker `flashmuse-postgres`；一次性脚本复制进项目根再 `node`+设 `DATABASE_URL`。

---

## ⚠️ 2026-07-19 (服务端断线重连改造 session) END-OF-SESSION —— 先读这条：**代码已上线腾讯，未 push GitHub**

**状态**：全部已部署腾讯 + 同步阿里、四域名 200、`tsc` 通过、无 Prisma 迁移、**已 push GitHub**。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. ⭐ **生成链路服务端断线重连**：`isTransientServerError` 统一判定 + 图片任务重试 + 视频创建重试 + BytePlus 建素材重试。
2. B_146（Pro 多参考图 sequential 参数）、B_144（宽高比映射）修复。
3. 后台失败原因聚合（剥 B_xx + 归一族、按量降序）。
4. 运维：腾讯 BBR、阿里视频补同步、同步脚本嵌套 bug 修。
5. 已 commit+push GitHub（本 session 7 文件 + 07-18 遗留 chat-workbench.tsx + handover）。

**下一个 AI 待办**：
1. **过段时间回来复查失败原因（用户明确交代，重点）**：断线重连/BBR/映射上线跑一阵后，再查 `GenerationEvent` 失败原因聚合 + `/opt/flashmuse/data/runtime/*-diagnostics-log.jsonl`，确认：①"服务器繁忙"占比是否大幅下降；②"真人检测→服务器繁忙"是否消失；③有没有**新的可恢复错误**没被 `isTransientServerError` 覆盖（有就补进去，它是唯一权威判定）。
2. 非紧急：M018（对话流统一单轮询器）、M019（工作流 canvasJson 大字段重构）押后。

**同步脚本注意**：`/tmp/syncali.sh` 已修（先 `rm -rf /tmp/next-static` 再 `docker cp`，避免嵌套 `static/static` 把旧 chunk 推上阿里）。部署后务必同步 `.next/static` 到阿里、验证首页+工作台 chunk 都 200（工作台是独立路由 chunk，别只测首页）。

**部署流程**（腾讯）：scp 源码到 `/opt/flashmuse/app/src/...`（先 /tmp 再 `sudo cp`）→ `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log`）→ `bash /tmp/syncali.sh` 同步阿里 → `bash /tmp/health.sh` 四域名 200。改中文源码用 edit 工具，禁 `Set-Content`。

---

## ⚠️ 2026-07-18 (视频三处根治 + 回填 session) END-OF-SESSION —— 先读这条：**代码已上线腾讯，但未 push GitHub**

**状态**：三处代码修复 + 历史回填**全部已部署腾讯 + 同步阿里、四域名 200、`tsc` 通过、无 Prisma 迁移**。**代码未 commit/未 push GitHub**（腾讯线上领先）。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. B_122：`waitForBytePlusAssetActive` 加瞬态容错（只 Failed/超时才失败）。
2. B_135：新增 `isBytePlusRecoverableReferenceError`，参考音频/视频版权/敏感错误也走 Skip 素材 `asset://` 重试（实测验证有效）。
3. 对话流去掉 `ensureMediaFileMentions` 强制补媒体 @名（根治"@音频名删不掉"）。
4. 历史回填 4 用户 50 视频 job 的强制 @名（4 张表，已备份）。

**下一个 AI 待办**：
1. **push GitHub（重点）**：改动文件仅 2 个——`src/app/api/video/route.ts`、`src/components/chat-workbench.tsx` + 本次 handover。`git status`/`diff` 确认只带这些，别混入无关改动。push 后三方同步。
2. **可选浏览器验证**（ali 硬刷）：① 带参考音频的 Seedance 2.0 视频能正常生成（首次可能返回 reviewing、客户端自动带 autoBytePlusAssetReview 重试）；② 对话流旧视频卡"使用提示词"提示词前不再有 @音频名、音频缩略图仍在、用户手打的图片 @名完整；③ 新生成视频删掉手动@的音频名、发送后等待卡不再自动冒出。
3. **非紧急**：M018（对话流统一单轮询器）、M019（工作流 canvasJson 大字段重构）仍押后。

**关键记忆（排查 BytePlus 错误码/视频问题必读）**：
- B_xxx 是运行时自增码，查真因去：`sudo docker logs flashmuse-flashmuse-app-1 | grep 'B_xxx'`、`GenerationEvent.failureCode`、`/opt/flashmuse/data/runtime/{video,generation,upload}-diagnostics-log.jsonl`。
- BytePlus 参考素材（图/视频/音频）要绕过版权/敏感/真人检测，必须"上传成 Moderation=Skip 素材 → `asset://<id>` 引用"，不能直传原始 url。图片/音频/视频同理，走统一 `autoReviewBytePlusVideoReferences`。
- 素材库 API=AK/SK HMAC 签名（`byteplus-assets.ts`，host `ark.ap-southeast-1.byteplusapi.com`）；视频创建=Bearer key（`ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`）；`BYTEPLUS_UNLOCK_LIMITS=true` 时 seedance-2-0 模型名=端点 id `ep-20260521133841-nn8bg`。
- 账号 id 形如 `ID_xxxxxx`，用户说的数字/邮箱前缀是 nickname/email，先查 `User` 表转换。
- 在腾讯容器里跑一次性脚本：`sudo docker cp x.mjs flashmuse-flashmuse-app-1:/app/ && sudo docker exec -w /app flashmuse-flashmuse-app-1 node x.mjs`（`@prisma/client` 可用、DATABASE_URL 已在 env）。

**部署流程**（腾讯，改代码必读）：scp 改动源码到 `/opt/flashmuse/app/src/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log` 防 120s 超时）→ **必须**同步 `.next/static` 到阿里（否则全站 404）：`sudo docker cp flashmuse-flashmuse-app-1:/app/.next/static /tmp/next-static && sudo rsync -a --delete -e 'ssh -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519 -o StrictHostKeyChecking=no' /tmp/next-static/ root@101.37.129.164:/var/www/flashmuse-static/_next/static/` → 四域名 200。改源码用 edit 工具，禁 `Set-Content` 改中文文件。PowerShell 内联含引号/中文的 psql/bash 会被搅坏，一律 scp .sql/.sh/.mjs 再跑。

---

## ✅ 2026-07-17 (上传命名统一 + 资产库排序 session) END-OF-SESSION —— 先读这条：三方已同步，无待部署

**状态**：本 session 改动（上传文件命名全平台统一 `src/lib/upload-name.ts` + 资产库右侧按入库时间稳定排序）连同 07-16 输入框统一那批一起：`tsc`+`build` 通过、**已部署腾讯 flashmuse-app、已同步 `.next/static` 到阿里、四域名 200、已 push GitHub**。无 Prisma 迁移。工作树应干净（除本次 handover 提交）。详见 CHANGELOG / 01-current-status 顶条。

**部署后浏览器验证（ali 硬刷，下一个 AI 可跟进用户反馈）**：
1. 同一张图在资产库/对话流/工作流显示同名（去扩展名、无 `_2`）；异图同原名任一处上传即显示 `名_2`。
2. 视频/音频/文档：对话流+工作流同样走服务端权威名（去扩展名、唯一）；图标/下载后缀正常。
3. 资产库右侧：别处上传/生成后顺序不再跳；最新入库在最上；刷新前后一致；移动分类不再把老图顶到最前。

**下一个 AI 待办 / 可优化（非紧急）**：
1. 老数据名字分叉**不回填**（用户拍板）；如日后要统一历史，写只读脚本按 contentHash 分组归一名，风险自估。
2. 同批并发上传多个不同内容同原名文件的预览名短暂重复：如要根治，把 media-assets/upload-file 的命名与写入完全合并进单一持锁事务并让前端顺序化上传。
3. M018（对话流统一单轮询器）、M019（工作流 canvasJson 大字段重构）仍押后。

**部署流程**（腾讯，改代码必读）：scp 改动源码到 `/opt/flashmuse/app/src/...`（先 scp 到 /tmp 再 `sudo cp` 就位，root 属主）→ `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log`）→ **必须**同步 `.next/static` 到阿里镜像（否则全站 404）：把 rsync 写进 .sh scp 上去跑，别在 PowerShell 内联（PS 会吃掉 `-e "ssh -i ..."` 的引号导致 rsync 走密码认证失败）；Ali 同步 key=`/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519`（`root@101.37.129.164`）→ 四域名 200。**改源码用 edit 工具，禁 `Set-Content` 改中文文件。**

---

## 🚀 2026-07-16 (输入框统一 session) —— 已随 07-17 一起部署+推送（保留作历史）

**状态**：本 session 全部改动**只在本地**，`npx tsc --noEmit` 全程通过（未跑 build，项目惯例以 tsc 为准），**未 commit / 未 push / 未部署**。无 Prisma 迁移。详见 CHANGELOG / 01-current-status 顶条。

**用户明确指令：下一个 AI 直接把这批部署上线。**

**改动文件（5 个）**：
- 新增 `src/lib/mention-text.ts`
- 改 `src/components/chat-workbench.tsx`、`src/components/workflow-tldraw-canvas-inner.tsx`、`src/app/admin/admin-users-panel.tsx`、`src/app/api/media-assets/route.ts`

**部署步骤（腾讯，无 Prisma 迁移）**：
1. `git status --short` / `git diff` 确认只有上述 5 文件 + 本次 handover（别带无关改动）。
2. `npx tsc --noEmit` 再确认；可选 `npm run build`。
3. `git commit` + `git push`（GitHub）。
4. 腾讯部署：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`；scp 改动源码到 `/opt/flashmuse/app/src/...`（`media-assets/route.ts` 也在 src 下）→ `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log` 防 120s 超时）→ **必须**同步 `.next/static` 到阿里镜像（否则 chunk 哈希不匹配全站 404）：`sudo docker cp flashmuse-flashmuse-app-1:/app/.next/static /tmp/next-static && sudo rsync -a --delete -e "ssh -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519" /tmp/next-static/ root@101.37.129.164:/var/www/flashmuse-static/_next/static/` → 四域名 200。
5. **改源码一律用 edit 工具，禁止 `Set-Content` 改带中文文件（整文件 mojibake）。**

**部署后浏览器验证（ali 硬刷）**：
1. 对话流/工作流/资产库 输入框：@文件名 蓝色统一（#367cee）；选中一段文字点 @文件名 → 覆盖选中区；不选中→插到光标处。
2. 资产库生成弹窗：@菜单选图出缩略图+@名；删 @文本缩略图还在；点缩略图 X 清净所有 @名；点缩略图下 @名 → 插入输入框；"清空输入框"连缩略图一起清。
3. 对话流上传：文档在上排、图片/视频/音频 80×80 混排在下排（视频有封面+播放键）、换行、X 在外角。
4. 同名不同内容两张图（对话流+工作流）→ 显示 `@名` 与 `@名_2`，各自对应正确的图、都能发模型。
5. 视频模式传视频+音频→切图片模式→发送 → `当前模型不支持视频/音频`。
6. 传一个之前传过的视频/音频/文档 → `XX已存在，无需重复上传！`。
7. 资产库传一张库里已有内容的图（如某工作流生成图另存）→ `图片已存在，无需重复上传！`（不再假报成功）；传全新图 → `成功上传1张图片` 并出现在上传库。

**可优化（非必须）**：资产库命中已存在但那张其实被软删的情况，POST 会 un-delete 但前端未 reload、需刷新才见（罕见，文案已诚实）。

---

## ✅ 2026-07-15 (后台/工作流统一读取根治 session) END-OF-SESSION —— 先读这条

**状态**：本 session 一连串改动**全部 tsc 过、已部署腾讯 + 同步阿里、并已 push GitHub**（连同 07-14 统一根治大 session 未推的那批一起推）。无 Prisma 迁移。服务器 /tmp 临时文件已清。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. 对话流视频历史双卡 7 例手修（两表同步）。
2. 后台弹窗参考素材匹配改多口径健壮化 + 抽唯一 `buildJobReferenceItems`（后台+工作流接口共用）。
3. `asset://` 参考在建 job 时统一解析成真实 url（`resolveReferenceUrls`，前向）+ 回填 256 条老 job。
4. 视频尺寸用 ffmpeg 真实量取（`getLocalVideoDimensions`，前向）+ 回填 238 条。
5. 回填剥离 190 条 sourcePrompt 里的 hint。
6. 后台 @文件名去后缀容错匹配。
7. 导入资产「使用提示词」按 mediaUrl 回溯原始 job（`getGenerationJobByMediaUrl`）+ 回填 291 条对话流图 requestId（精确 `:image:序号`）。

**下一个 AI 待办 / 可优化（都非紧急）**：
1. **后台弹窗对话流老图参考**：约 1500 条 job 化（7-7/7-8）前的对话流老图无 GenerationJob，无参考数据可恢复——**不是 bug，别重查**。
2. **6 月老远程媒体**（243 视频+378 图 url 仍是远程 volces、文件已丢）无法补尺寸/参考——**历史遗留、别重查**。
3. 若要把「@变蓝」逻辑在对话流前端与后台弹窗之间也统一（目前后台 `AdminPromptWithMentions` 是独立实现），可考虑抽共享；当前非必要。
4. M018（对话流统一单轮询器）、M019（工作流 canvasJson 大字段重构）仍押后。

**部署流程**（腾讯，改代码必读）：scp 改动源码到 `/opt/flashmuse/app/src/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log` 防 120s 超时）→ **必须**同步 `.next/static` 到阿里镜像（否则 chunk 哈希不匹配全 404）→ 四域名 200。**改源码一律用 edit 工具，禁止用 `Set-Content` 改带中文的文件（会整文件 mojibake）。** DB 用 scp .sql/.sh + `docker exec -i psql`；**PowerShell here-string 管道 psql 若 SQL 含中文，先设 `$OutputEncoding`/`[Console]::OutputEncoding` 为 UTF8**；账号 id 形如 `ID_xxxxxx`，用户说的数字是 nickname，先查 User 表转换。容器内跑 node 脚本要放 `/app` 且 `-w /app`（否则 import 解析不到 node_modules）。

---

## ✅ 2026-07-14 (统一根治大 session) END-OF-SESSION —— 先读这条

**状态**：本 session 一连串改动**全部 tsc 过、已部署腾讯**（模型路由统一 / 干净 prompt 存读 / 后台弹窗参考素材+@蓝字 / 资产库去规则 / 视频本地存盘不限时根治 / 多批历史回填）。**代码未 push GitHub（用户要求测完一起推）。无 Prisma 迁移。** 详见 CHANGELOG 顶条 + 01-current-status 顶条。

**下一个 AI 待办**：
1. **push GitHub**：用户测完这批后一起推。改动文件：新增 `src/lib/byteplus-provider-key.ts`；改 `src/lib/system-settings.ts`、`src/lib/generation-jobs.ts`、`src/lib/openrouter.ts`、`src/app/api/image/route.ts`、`src/app/api/video/route.ts`、`src/app/api/workflow-generation-references/route.ts`、`src/components/workflow-tldraw-canvas-inner.tsx`、`src/components/chat-workbench.tsx`、`src/app/admin/admin-users-panel.tsx`、`src/app/admin/api/records/user-detail/route.ts`、`Dockerfile`、`AGENTS.md`、`handover/*`。push 前 `git status`/`diff` 确认，别带入无关改动。
2. **（可选）后台展示扩展**：目前只在"所有生成图片/视频"弹窗加了参考素材+@蓝字；如需在积分明细等其它弹窗也显示，复用同思路。
3. **老数据别再查**：见下"现状记录"。

**⚠️ 现状记录（重要，避免以后 AI 重复排查/误判为 bug）**：
- 线上 `MediaAsset` 有 **243 生成视频 + 378 生成图 url 仍是远程 volces 地址**，**全是 2026-06-19~21（job 化之前）老数据**，远程 24h 签名早过期、媒体已丢、**无法恢复**——**不是 bug、不用重查**。
- **90 条生成媒体参数(model/比例等)为空**：无 GenerationJob、消息 JSON 也查不到，无权威来源，**按"不猜"保留空**——不是 bug。
- **`systemName` 非唯一**（会被不同批次重名占用，如 `video_51_d1` 有多条）；unique 的是 `userId+normalizedUrl`。回填/排查别只按 systemName 认定同一个东西。
- **"出生即冻结"范围**（用户澄清）：冻结=用户提示词(工作流含连线文本节点)+上传参考图/视频/音频+名字+参数；**不含内部强制规则/参考 hint**。生成参数属系统该正确写入的事实，允许权威 finalize 补写空值。

**部署流程**（腾讯，改代码必读）：scp 改动源码到 `/opt/flashmuse/app/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询 `/tmp/build*.log` 防 120s 超时）→ **必须**同步 `.next/static` 到阿里镜像（否则 chunk 哈希不匹配全 404）→ 域名 200。改源码用 edit 工具；DB 用 scp .sql/.sh + `sed -i 's/\r$//'` + `docker exec -i psql`（PowerShell 内联 SQL/bash 引号会被搅坏）；账号 id 形如 `ID_xxxxxx`，用户说的数字是 nickname 要先查 User 表转换。

---

## ✅ 2026-07-14 (later session) END-OF-SESSION —— 先读这条

**状态**：工作流"使用提示词"根治 + 等待卡计时 + 830 条历史 job 名字回填，**全部 tsc 通过、已部署腾讯、并已 push GitHub**（连同上一 session 另一 AI 未推的 handover commit `84582e5` 一起推）。有 Prisma 迁移 `20260714100000_generation_job_reference_names`（腾讯 entrypoint 容器启动自动 apply，已确认 applied）。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. 工作流"使用提示词"改读后端 `GenerationJob`（新接口 `/api/workflow-generation-references`），彻底摆脱"双重收尾把画布内 `generationUploads` 快照冲空"的 bug。
2. `GenerationJob` 加 `referenceNames` 列，建任务时反查名字写库；去掉画布里 `generationUploads` 冗余写入（瘦身）。
3. 工作流等待卡"已等待/渲染%"每秒平滑刷新。
4. 回填 830 条历史 job 的 referenceNames（老视频 @ 也蓝）。

**下一个 AI 待办 / 可优化（都非紧急）**：
1. **M019（重点记忆）**：工作流整张画布存单个 `canvasJson` 大字段的结构隐患（整块读写慢、整块覆盖竞态、前端临时态污染）——用户要求以后重构（拆表/字段级 patch/媒体只存引用）。本 session 只去 generationUploads 减轻，根本未动。
2. **M018**：对话流统一单轮询器（另一 AI 上一 session 留）。
3. 老 job 名字回填只做了"能反查到 MediaAsset 名字的"；个别参考 url 在库里查不到名字的 job，其 @ 仍可能不蓝（图仍能带回，url 有）。极少，按需再处理。
4. `addNodeFromPrompt` 现为点击时异步查接口再建节点（有几十 ms 延迟），如觉得慢可改成先建节点占位、拿到再补 uploads。

**部署流程**（腾讯，改代码必读）：scp 改动源码到 `/opt/flashmuse/app/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询日志防 120s 超时；entrypoint 自动 `prisma migrate deploy`，有迁移无需手动跑）→ **必须**同步 `.next/static` 到阿里镜像（否则 chunk 哈希不匹配全 404）→ 四域名 200。改源码用 edit 工具；DB 操作用 scp .sql + `docker exec -i psql`；PowerShell 内联复杂 SQL/bash 引号会被搅坏，一律走 scp 的 .sh/.sql + `sed -i 's/\r$//'`。

---

## ✅ 2026-07-14 (earlier) END-OF-SESSION —— 对话流 3 bug（已完成，保留作历史）

**状态**：本 session 修的 3 个对话流 bug 代码全部 tsc+build 过、部署腾讯、push GitHub（`2db526b`/`e9ee160`/`04dafb0`）。handover 文档改动=本地 commit `84582e5`（本 later session 已随一起 push）。详见 CHANGELOG / 01-current-status。

**本 session 做完**：
1. 错误码红字误映射修复（Request id 数字子串命中 HTTP 码 → 剥 Request id + 词边界）。
2. 对话流视频双失败卡（恢复 effect 加 `runningRequestIdsRef` 守卫）。
3. 对话流视频等待卡关浏览器重登录后消失（改按持久化 `videoPendingCount` 渲染 + `needsLiveTimer` 加 `hasRecoveringMedia`）。
4. 对话流图片同款双卡隐患（图片恢复 effect 加同款守卫）。

**下一个 AI 待办 / 注意**：
1. **⚠️ 工作树两个别的 AI 未完成文件勿误提交/部署**：`src/components/workflow-tldraw-canvas-inner.tsx`（工作流等待卡每秒计时器 + generationUploads spread）、`src/lib/workspace-workflows.ts`（从 job references 重建 generationUploads 自愈）。这是另一个 AI 干了一半的活，用户明确"不要动"。`git status` 会看到它们 modified，**提交本 session 改动时只 add 你自己改的文件**，别 `git add -A`/`git add .`。
2. **M018 统一单轮询器**（押后，见 06-memo-tasks）：把对话流前台轮询 while 循环砍掉、统一由数据驱动 reconcile 做唯一轮询器，根除双轮询器撞车。中等重构、要仔细测。
3. 本次 handover 文档 commit 未推，下次推 GitHub 时一起带上。

**部署流程**（腾讯，改代码必读）：scp 改动源码到 `/opt/flashmuse/app/src/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询日志防 120s 超时）→ **必须**同步 `.next/static` 到阿里镜像（否则 chunk 哈希不匹配全 404）→ 四域名 200。改源码用 edit 工具。

---

## ✅ 2026-07-13 (deploy session) END-OF-SESSION —— 先读这条：三方已同步，无待部署

**状态**：本 session 所有代码已部署腾讯 + push GitHub，**腾讯=GitHub=本地 三方同步于 `b94c3ea`**（+ 本次 handover 提交）。工作树干净。无 Prisma 迁移。详见 CHANGELOG / 01-current-status 顶条。

**本 session 做完**：
1. 部署前两批仅本地的模型改动（`7c66f85`）。
2. Seedream 5.0 Pro 像素分档扣费修复（`b94c3ea`）。
3. 工作流节点成功/失败都不返回 → 周期性兜底 reconcile（`b94c3ea`）。
4. 统一读取的洞（校准 effect 只纠正已有名、不补全空名）→ 已修补全缺失名（`b94c3ea`）。
5. 线上 DB 回填 workflow_02（ID_636611）三张历史空名图 → image_2/3/4_w2。
6. 后台上传规则面板 Pro/Mini 标签（`b94c3ea`）。

**下一个 AI 待办 / 仍可优化（都非紧急，用户未催）**：
1. **Seedance 2.0 4K**：官方支持、计费函数已有 4K 档，但 UI 选不到（`videoModelRules["byteplus:video.seedance-2-0"].resolutions` 只到 1080p、缺 4K 尺寸表）。用户"先不接"。要接需加 `"4K"` 到 resolutions + 4K 尺寸表（各比例宽高，官网参考像素表；文档那几页是图片无文字表，需用户给值或按标准 3840×2160 推算）。
2. **对话流是否也加周期性兜底 reconcile**：本 session 只修了工作流。对话流恢复同样是"一次性(sessions变化)+可见性"触发、理论同样有"一次性错过就卡住"的风险，但用户没报对话流卡死、也没要求，先观察。
3. **历史其它空名图**：本次只回填了 workflow_02 那 3 张（用户点名）。ID_636611 还有一张 7-07 的 `workflow_generation` 空名图（`3307-fd4393d8...994.jpg`，17:20）**不在任何 canvas 节点**（已删节点的孤儿），未回填；如需全库扫描历史空名 workflow 图批量回填，可写只读脚本按 workflowId 分组用 nextImageNumber 补（不猜、只补确定属于某工作流的）。
4. **BytePlus 调价风险**：单价硬编码在 `models.ts getBytePlusVideoPricePerMillionUsd` 和 `openrouter.ts` 的 Pro 常量里；BytePlus 若调价需人工改代码。可考虑做后台"单价可配置"页（用户暂缓）。

**部署流程**（腾讯，改代码必读）：scp 改动源码到 `/opt/flashmuse/app/src/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询日志防120s超时）→ **必须**同步 `.next/static` 到阿里镜像（否则 chunk 哈希不匹配全 404）→ 四域名 200。改源码用 edit 工具；DB 操作用 scp .sql + `docker exec -i psql`（PowerShell 内联 SQL 引号会被搅坏）；账号 id 形如 `ID_xxxxxx`，用户说的"12424740"是 nickname/邮箱要先查 User 表转换。

---

## 🚀 2026-07-13 (later session) END-OF-SESSION —— 先读这条：**下一个 AI 直接部署**

**状态**：两批改动全部只在本地，`npx tsc --noEmit` 全程通过、`npm run build` 通过，**未 commit / 未推 / 未部署**。
- 批1（同日上午/早）：后台模型开关 7→5 组大简化 + GPT-5.6 Terra/Terra Pro + Agent 改造。
- 批2（本 session）：新增 Seedream 5.0 Pro（图片）+ Seedance 2.0 Mini（视频）+ 全量按官网校准计费/尺寸/多图 + 修前端 1 秒定时器卡顿 bug。
- 详见 CHANGELOG 顶部两条 + 01-current-status 顶部。

**用户明确指令：模型加完了，下一个 AI 直接把这两批一起部署。**

**部署步骤（腾讯，无 Prisma 迁移）：**
1. `git status --short` / `git diff` 确认（基线 `f14a6c5`，两批约 14~15 个文件，见 CHANGELOG 两条的"文件清单"；确保不带入无关改动）。
2. `npx tsc --noEmit` + `npm run build` 再确认。
3. `git commit` + `git push`（GitHub）。
4. 腾讯部署：scp 改动源码到 `/opt/flashmuse/app/src/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app` → **必须**同步 `.next/static` 到阿里镜像（否则 chunk 哈希不匹配全站 404），命令见本文件"腾讯部署新流程"节 / 03-deploy 顶部。
5. **部署后浏览器验证（ali 硬刷）**：见下方"验证清单"。

**⚠️ 部署注意**：
- 本批**无数据库迁移**（`ImageResolution` 加 "3K" 是 TS 类型，不是 DB）。
- 生产 `.env.local` 的 `BYTEPLUS_MODEL_SELECTIONS`/`MODEL_PROVIDER_PREFERENCES` 里**没有** pro/mini 条目，靠代码 `DEFAULT_*` 兜底（已含 pro/mini 端点与偏好），部署即生效；等管理员在后台保存一次设置才会把这两条写进 env（无碍）。
- 生产 `BYTEPLUS_API_KEY_ENABLED` 本就 true，新模型默认开。
- **改路由/模型判定后，dev 必须停 node + 删 `.next` + 重启**，否则跑旧编译代码（本 session 踩过：Pro 一直报 "not a valid model ID" 就是 dev 缓存）。

**验证清单（部署后 ali 硬刷）：**
1. 后台"模型开关"：图片生成组有 Seedream 5.0 Pro；视频生成组 Mini 显示在 Fast **上面**；都默认开。
2. Seedream 5.0 Pro 出图正常（走 BytePlus、名字 `dola-seedream-5-0-pro-260628`）；分辨率只有 1K/2K；生成 4 张 = 申请 4 次（4 张独立图）。
3. Seedream 5.0 Lite 出现 **3K** 档，选 3K 出图后参数框显示 **3K**（不再显示成 2K）；4.5/Lite 选多张仍是"一次出多张"。
4. Seedance 2.0 Mini 能生成、时长菜单正常、参考图/首尾帧模式正常。
5. 扣费抽查：Pro 1K≈0.045、2K≈0.09（+参考图第2张起 0.003）；视频 Mini 无参考视频≈3.5、带参考视频≈2.1 单价档（后台生成记录/积分看金额合理）。
6. 空闲时前端不再持续卡（1 秒定时器已按需开启）。

---

## 🔜 2026-07-13 (上一 session) —— 已并入上面一起部署

**状态**：本 session 做的**后台模型开关大简化 + GPT-5.6 Terra 新模型 + Agent 改造**全部**只在本地**，`npx tsc --noEmit` + `npm run build` 都过，但**未 commit / 未推 GitHub / 未部署腾讯**。唯一上线的是后台白名单加 `176107103@qq.com`（腾讯 env 改动+重启，非代码）。详见 CHANGELOG 顶条 + 01-current-status 顶条。

**用户明确指令**：**下个 AI 还要继续加模型，加完后再一起部署。** 所以先别急着部署，先接着加用户要的模型。

**下个 AI 待办**：
1. 按用户要求继续加/调模型（延续本次的 additive 规则：同名模型只留 BytePlus 版、OpenRouter 留独有；新对话模型加进 `models.ts models[]`；金色用 `isGoldConversationModel`/`isGoldGenerationModel`）。加 OpenRouter 模型先查官网 API 拿准确 ID：`Invoke-RestMethod https://openrouter.ai/api/v1/models`。
2. 加完后**一起部署**：`git status`/`diff` 确认（本批在 `f14a6c5` 之上，8 个文件：system-settings.ts、models.ts、openrouter.ts、chat-workbench.tsx、admin-system-settings-panel.tsx、api/model-availability|image|video/route.ts）→ `npx tsc --noEmit`+`npm run build` → commit+push → 腾讯部署（scp 源码→`docker compose up -d --build flashmuse-app`→**必须同步 `.next/static` 到阿里**，见 03-deploy 顶部）。
3. **部署后浏览器验证**（ali 硬刷）：后台模型开关 5 组显示正常、功能模块/作用位置列对；三个模块 OpenRouter 不再有 seedream/seedance/seed-2.0-lite；通用模式能选 GPT-5.6 Terra/Terra Pro（Terra Pro 金色，GPT-5.5 不再金色）；Agent 生成正常、首选关掉时能随机兜底用图片/视频生成里的模型；反推/优化按 5.5→5.4→Pro→Lite 兜底。
4. ⚠️ 提醒：`BYTEPLUS_API_KEY_ENABLED` 默认已改 true；生产 .env.local 本就 true，无碍。去掉 OR 兜底后 BytePlus 全局必须开着这些模型才可用（生产已开）。

---

## 🔜 2026-07-12 (later session) END-OF-SESSION —— 先读这条

**状态**：本 session 全部改动**已部署腾讯 + 已 commit+push GitHub（连同上午"资产入库/显示统一大改造"那批一起推）→ 腾讯=GitHub=本地 三方同步**。工作树干净（除后续 handover 提交）。详见 CHANGELOG 顶条 + 01-current-status 顶条。

**本 session 做完的事**：① 生成图统一出生根治（异步存盘图先等本地存盘再由 finalize 权威出生，解决资产库图 model/参数全空）；② 资产→节点读取统一 model（导入/恢复/GET 接口都带真实 model）；③ 从资产库导入弹窗刷新修复；④ **阶段3b 全量完成**——对话流+工作流(画布/输入框)+资产库全平台内容哈希去重、跨平台判重、去掉资产库旧 url 判重、两处提示位置按要求分开；⑤ 历史 model 回填 7 张（12424740）。

**下一个 AI 待办 / 仍可优化**：
1. **验证面扩大**：本次 dedup + 统一出生只在 12424740 账号验证过。可跑全库只读扫描看"生成图空 model"在其它用户的规模（图片统一出生 bug 是全平台的，7-12 之前所有 byteplus 异步图都可能 model 空）——需要的话我可写脚本按 GenerationJob/creditLedger 批量精确回填（不猜）。
2. **5 张无来源空 model 老图**（asset_1_role、Anima_00001_、hero-mecha-robot-reference、aaa、1779127299645-…）保持留空。
3. dedup 局限：只对"本次接线之后传过、已记 contentHash"的图生效；老图无 hash 不会被判重（预期）。png 另存 jpg 字节不同=不同图（预期）。
4. `waitForMediaSaveJob` 每张图最多阻塞 worker 60s（与视频同）；byteplus 异步图现在 success 会稍慢（等本地存盘），但保证参数齐全。

**部署流程**：腾讯 scp→`docker compose up -d --build flashmuse-app`→**必须同步 `.next/static` 到阿里**；改源码用 edit 工具；PowerShell 内联复杂 bash 会被引号搅乱，用 scp .sh + `sed -i 's/\r$//'`；DB 用 `docker exec -i`。

---

## 🔜 2026-07-12 (上午) —— 资产统一改造（已随上面一起三方同步）

**状态**：资产入库/显示统一大改造 阶段1/2/3a/4 **已部署腾讯线上**、验证通过；**GitHub 未推、本地未 commit**（腾讯=本地）。详见 CHANGELOG 顶条 + 01-current-status 顶条 + 06-memo-tasks M016/M017。

**下一个 AI 待办（按优先级）：**

1. **（可选）三方同步**：用户说"推"时 commit+push 本次改动。文件：新增 `src/lib/media-asset-record.ts`、`scripts/audit-asset-consistency.mjs`、`prisma/migrations/20260712000000_media_asset_content_hash/`；改动 `prisma/schema.prisma`、`src/lib/generation-jobs.ts`、`src/lib/workspace-sessions.ts`、`src/app/api/media-assets/route.ts`、`src/app/api/upload-file/route.ts`、`src/app/api/asset-upload-temp/route.ts`、`src/app/api/workspace-state/route.ts`、`handover/*`。先 `git status`/`diff`、`npx tsc --noEmit`。

2. **⚠️ 阶段3b（用户点名下一次做）——图片上传去重的客户端接线**（风险高、需浏览器验证，单独一批）：
   - **服务端已就绪**（`asset-upload-temp` 会算 contentHash+判重返回 duplicate/url、`media-assets` POST 能存 contentHash）。缺客户端接线，且现状"休眠安全"（老图无 hash、客户端没传 hash 也没处理 duplicate → 永不触发）。
   - **要改**（`chat-workbench.tsx` + `workflow-tldraw-canvas-inner.tsx`）：
     a. `uploadTemporaryAssetImageOnce`(chat~4332)/`uploadWorkflowImageOnce`(workflow~647) 返回值从只有 token 改为 `{token?, contentHash?, duplicate?, url?}`。
     b. 各上传调用点（chat~8407 资产库 slots、~13435 对话流输入框；workflow~647/741）：命中 duplicate 就跳过 commit、直接用返回 url；把 contentHash 透传进 `POST /api/media-assets` 的 body。
     c. 注意 reencode 探测重试包装 `uploadTemporaryAssetImage` + 多处独立状态机（tempToken/slots/sessions），逐处小心。
   - **浏览器验证**：传没传过的图=正常；传已传过的同一文件=秒复用同一张、资产库不新增、输入框直接出缩略图；png另存jpg 应判为不同（字节不同）。

3. **（可选）验证本批效果**（ali 硬刷）：新生成图/视频参数是否齐全一致（含视频尺寸）；上传同一视频/音频/文档是否秒复用不重复入库；工作流资产参数显示的模型名不再是原始 id 一长串。

**教训/注意**：改源码用 edit 工具；腾讯部署流程见 03-deploy 顶部（scp→`docker compose up -d --build`→**必须同步 `.next/static` 到阿里**）；prisma generate 在 Windows 会因引擎锁失败，先 `Stop-Process node` 再 generate；PowerShell 内联复杂 SQL/bash 会被引号搅乱，用 scp .sh + `sed -i 's/\r$//'`。

---

## ✅ 迁移阶段4 已完成（2026-07-11）—— main/api 已直连腾讯 443，马来出链路

**用户做的**：DNS `main`/`api`.venusface.com A 记录已改指腾讯 `119.28.116.16`；安全组放行 `TCP 443`。
**AI 做的**：
- 宿主 80 被 vibesocial-nginx 占用 → certbot HTTP-01 走不通，改**复制马来现有有效证书**到腾讯（一张 `main.venusface.com` cert，SAN 覆盖 main+api，有效期到 **2026-09-06**）。位置 `/opt/flashmuse/data/letsencrypt/live/main.venusface.com/{fullchain,privkey}.pem`。
- `docker-compose.yml` flashmuse-nginx 加 `443:443` 端口 + 挂载 `/opt/flashmuse/data/letsencrypt:/etc/letsencrypt:ro`。
- `flashmuse.conf` 加 443 server 块（server_name main/api，反代 flashmuse-app:3000，本地服务 /generated + /home-assets，X-Forwarded-Proto https）。备份 `docker-compose.yml.bak.20260711190655`、`flashmuse.conf.bak.20260711190655`。
- 验证：`--resolve` 直连腾讯 443 → https main/api = 200 证书有效；公网 DNS 路径 main/api/ali 全 200。

**现在架构**：`main`/`api` DNS→腾讯 119.28.116.16:443（腾讯 nginx 直接 SSL 终止）；`ali`/`static`→阿里 101.37.129.164（阿里入口，反代腾讯 5000 + 本地镜像 _next/static、generated）。**马来已彻底不在链路里。**

### 阶段4 遗留（下一个 AI 跟进）
1. **马来退役**：DNS 已不指马来、马来 app 早已 pm2 stop，马来壳成死重。用户观察几天无异常后可退租。**AI 未停马来**，等用户决定。
2. **✅ 证书自动续期已配好（2026-07-11）**：宿主 80 被 vibesocial 占（certbot standalone 又不支持 tls-alpn-01），改用 **acme.sh + tls-alpn-01（走 443）**。当前证书 = Let's Encrypt ECC，SAN main+api，到 **2026-10-09**。acme.sh 自带 cron（每天 4 次 `--cron`），ARI 窗口约 **2026-09-10** 自动续。续期链：`Le_PreHook=docker stop flashmuse-flashmuse-nginx-1`（释放 443 给 alpn 验证）→ 签发 → `Le_PostHook=docker start ...` → `Le_ReloadCmd=docker restart flashmuse-flashmuse-nginx-1`（加载新证书）。证书装到 `/opt/flashmuse/data/letsencrypt/live/main.venusface.com/{privkey,fullchain}.pem`（nginx 已挂载读取）。**续期时 nginx 会短暂重启（几秒~1分钟），影响 main/api（ali 走 5000 不受影响）。** 手动续期：`sudo /root/.acme.sh/acme.sh --renew -d main.venusface.com --ecc --force`（注意 LE 每周 5 张同域名 duplicate 限额）。
3. **HTTP(80) 无重定向**：用户敲 `http://main...` 会落到宿主 80 的 vibesocial-nginx（拿不到 flashmuse），实际都走 https 无影响；无法给 flashmuse 绑 80（被占）。

**⚠️ 腾讯部署新流程（每次改代码必读）**：scp 改动源码到 `/opt/flashmuse/app/src/...` → `cd /opt/flashmuse && nohup sudo docker compose up -d --build flashmuse-app`（后台+轮询日志防 120s 超时）→ **必须**把腾讯 `.next/static` 同步到阿里镜像（否则 chunk 哈希不匹配全 404）：`sudo docker cp flashmuse-flashmuse-app-1:/app/.next/static /tmp/next-static && sudo rsync -a --delete -e "ssh -i /opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519" /tmp/next-static/ root@101.37.129.164:/var/www/flashmuse-static/_next/static/`。详见 03-deploy-and-servers。

---

## Highest Priority

### 2026-07-10 (最新) 迁移 马来→腾讯新加坡 —— 先读这条 + `09-migration-to-tencent.md`

**状态：阶段1(在腾讯独立部署+IP测试)已完成，用户正在测试 `http://119.28.116.16:5000`。等用户测试结论，再做阶段2/3。**

**2026-07-10 补：阶段1 补齐了漏掉的 nginx 层（图片/视频原来显示不出来，已修）。** 详见 01-current-status 顶部对应条目。要点：
- 根因：Next `next start` 只服务构建时已存在的 `public/` 文件，`public/generated` 被 dockerignore 排除→Next 对 `/generated/*` 返回 404。马来/阿里靠 nginx 服务 /generated 从不经 Next，腾讯阶段1 栈缺 nginx 才暴露。
- 修复：flashmuse 栈加 `flashmuse-nginx`(nginx:alpine) 容器，对外 5000、服务 `/generated`+`/home-assets` 静态 + 反代 `flashmuse-app:3000`；app 改内部 3000。只用 flashmuse_default 网络与原 5000 端口，未动其它项目。
- **已同步（2026-07-10 续 session）**：`docker-compose.yml`(含 nginx service) + `nginx/flashmuse.conf` 已补进本地仓库并 commit+push GitHub。同批还提交了：EXDEV 修复(`local-assets.ts`)、资产生成转圈(`chat-workbench.tsx`)、signup=0(`credits.ts` + schema + 迁移 `20260710010000_signup_credits_default_0`)、Intl 标识(`page.tsx`)、名称预约那批、Dockerfile 系列、cases/route.ts(UTC)。**GitHub=本地一致**。服务器旧 compose 备份 `/opt/flashmuse/docker-compose.yml.bak.*`。
- **腾讯已清空为全新部署状态**（用户测试完成后）：DB 空、generated 空、signup=0、三容器在跑、home 200。可直接进阶段2/3。

- **下一步 = 阶段2/3（用户测试已 OK，可推进）**：
  1. **阶段2**：夜里接阿里 + 挂停服/维护页。阿里改用独立 conf 反代腾讯（阿里安全组/腾讯安全组已开 5000）。别动阿里上其它项目。阿里登录信息见 `E:\project\【2】server\阿里服务器\`。
  2. **阶段3（数据迁移，重头）**：
     - DB：马来 `pg_dump` → 腾讯 `flashmuse-db`（`docker exec` psql 灌入；马来 `.env.local` 有两个 DATABASE_URL 用第一个、去掉 `?schema=`）。
     - 媒体：马来 `/var/www/flashmuse/public/generated` rsync → 腾讯 `/opt/flashmuse/data/generated`（量大，可走马来→腾讯直传）。
     - 阿里反代目标：马来 IP → 腾讯 IP。
     - `NEXT_PUBLIC_*` / 硬编码 IP（`page.tsx` 的 Intl 判断、`chat-workbench.tsx`/其它 IP·venusface 判断、`NEXT_PUBLIC_PRIMARY_BASE_URL` 等）改成正式域名并**重 build**（见 09 文档第六节清单）。
     - 关 `FORCE_INSECURE_AUTH_COOKIE`、设 `AUTH_COOKIE_DOMAIN`、开 `ALI_SYNC_GENERATED_ENABLED`（方向腾讯→阿里）。
     - ⚠️ pg_dump 会带来马来的 `CreditSetting.signupCredits`，覆盖腾讯的 0；若正式要 0，迁移后再确认/再置 0。
     - 用 `.runtime/deploy-checks/prod-deploy-snapshot.mjs` 对数据完整性做前后对比。
  3. **阶段4**：观察几天，弃用马来。
- **`09-migration-to-tencent.md` 内容乱码**（编码损坏），需要时重写。

- 全部细节、原因、服务器信息、踩坑、下一步 → 看 `09-migration-to-tencent.md`（本次迁移权威文档）。
- **下一个 AI 待办**：
  1. 收用户测试反馈；测出的功能异常先判断是不是"阶段1有意保留的环境差异"(NEXT_PUBLIC 留空/ali-sync关/insecure cookie/空库)导致，见 09 文档第六节。
  2. 用户测 OK → 阶段2(夜里接阿里+停服) → 阶段3(pg_dump+媒体 rsync 迁数据、阿里反代切到腾讯、NEXT_PUBLIC 改域名重 build、开 ali-sync、关 insecure cookie)。步骤见 09 文档第七节。
- **本地未 commit 的迁移相关改动**：`Dockerfile`、`.dockerignore`、`docker-entrypoint.sh`(新增)、`next.config.ts`(加静态缓存头)。加上之前 2026-07-10 名称预约那批(9文件+迁移目录)仍未 commit/push。

### 2026-07-10 END-OF-SESSION STATE — 先读这条

**状态：本次"生成媒体名称提交时原子预约"改动已部署 prod+Ali（含 Prisma 迁移），但 GitHub 未推、本地未 commit。目前 prod 领先 GitHub/本地。**

**本 session 做了什么(细节见 CHANGELOG 顶条 + 01-current-status 顶条)：**
1. 生成媒体命名从"完成时推名"改成"**提交任务时同一事务原子预约**"(`GenerationJob.reservedNames` + advisory lock)。覆盖对话流/工作流 图片·视频 + 资产库图片(资产库图片改成 async job 化 + 轮询)。成功用预约名、失败 `reservedNames=NULL` 释放复用；资产写入合并进一个事务。worker `ensureJobReservedNames` 兼容旧在途 job。前端全部优先用服务端名、旧 job 无名才回退。
2. 部署了本次 9 个路径(schema/迁移/generation-status/image/video/chat-workbench/两个 canvas/generation-jobs)，迁移 `20260710000000_generation_job_name_reservations` 已 apply。
3. 修了生产历史撞名视频：第二条 `video_3_w6`→`video_4_w6`(资产三处 + 工作流 canvas 一处，一事务)。

**下一个 AI 待办：**
1. **若要三方同步：commit+push 本次 9 路径 + `prisma/migrations/20260710000000_generation_job_name_reservations/`。** 注意工作树里还有一处**无关**改动 `src/app/api/workflow-prompt-optimization/cases/route.ts`(写死 UTC 日期)——**勿一起提交、勿覆盖**，按用户历史意图保留。
2. **BROWSER-VERIFY(ali 硬刷)** 跟进：
   - 同一工作流并发生成多个图片/视频，名字不再撞(`image_N_wX`/`video_N_wX` 唯一)。
   - 生成失败后再生成，号码能复用(不因失败永久跳号)。
   - 关浏览器/刷新后恢复，界面名字与资产库 systemName 一致。
   - 资产库角色/场景/分镜图连续生成，`asset_N_{role|scene|storyboard}` 连续不撞。
3. 手工修复脚本临时留在服务器 `/var/www/flashmuse/.runtime/*.cjs`(inspect/repair/verify-duplicate-video/inspect-duplicate-workspace-state 等)，非仓库代码，可择机清理。

**局限/注意：**
- 资产库图片生成前端从"同步返回图"改成"提交+每 3s 轮询"，交互路径变长(与对话流/工作流一致)，但更可靠(断开也不丢)。
- 预约扫描每次查该用户所有 MediaAsset 的 name + 在途 job 名；用户资产极多时是一次全表按 userId 查，量级可接受，若日后变慢可加索引/收窄。

---

### 2026-07-09 (later session) END-OF-SESSION STATE — （已完成，保留作历史）

**状态：全部已部署 prod+Ali 且已推 GitHub，prod=GitHub=本地 三方同步于 commit `ca28540`。工作树干净(除本次 handover 提交)。** 下方旧的"直接部署生成压缩"指令已完成，保留仅作历史。

**本 session 做了什么(细节见 CHANGELOG 顶部两条 + 01-current-status 顶条)：**
1. **一次性全量部署**了之前积压未部署/未推的整批(生成压缩 sharp/ffmpeg、备案 footer/法务页、上传链路重构、上传进度条、网络诊断 logo)——commit `ef33f0f`。服务器跑了 `npm install` 装 sharp。
2. **右上角使用量媒体计数修复**：
   - 对话流(方案A)：面板改用实时数 `getSessionMediaCounts`(不再用会虚高的累计 `generatedMediaCounts`)。对话流无删除→实时=只增不减。
   - 工作流(B1)：累计 `generatedMediaCounts` 原来**从没被持久化**(服务器 normalizeWorkflowItems 丢弃)，刷新丢、删节点变小。改为存进 `canvas.generatedMediaCounts`(随 canvasJson 存/读回、`updateWorkflowCanvas` 保留、`addWorkflowGeneratedAssets` 写它)→真·只增不减。
3. **工作流 @文件名 卡加载修复**：连线引用点 `@文件名` 不再读资产库转圈(只有本地解析不了的库资产 mention 才读库)。
4. **工作流 @文件名 光标修复**(3 次迭代，最终 `ca28540` 对齐对话流：实时 DOM 光标 + rAF focusEditorAt)。

**BROWSER-VERIFY(ali 硬刷 Ctrl+Shift+R)——用户尚未回报最终测试结果，下一个 AI 可跟进：**
1. 对话流右上角图片数=当前实际张数(prod `12424740` 的 d35「生成美女」应显示 6，不再 9)。
2. 工作流：生成→累加；刷新后不变；删生成节点数字不减；再刷新仍不减。
3. 工作流连线图点 `@文件名`：秒变蓝字、无转圈；连点多次不卡。
4. 工作流 @文件名 光标：光标点在提示词中间任意处→连点几个缩略图 `@文件名`→都插在光标处、依次追加、光标始终停在最后一个 `@文件名` 后。
5. 生成压缩：后台"系统设置"tab 图片/视频压缩开关+质量档；生成图落盘 JPEG(默认标准80%)、视频 ffmpeg 转码(变小才替换)。**⚠️ 视频压缩默认开→留意马来 worker CPU**。

**仍可优化/局限：**
- 生成压缩：视频转码增加马来 worker CPU 开销；押后项 M015(阿里端上传压缩转发小服务，用户"以后再说")。
- 计数：对话流已放弃累计口径(用实时数)，若未来对话流加删除功能且要"删不减"，需重新引入持久化累计(参考工作流 B1 做法)。旧的 `addSessionGeneratedMediaCount` 累加代码仍在(写 summaryJson.generatedMediaCounts)但已不被面板读取，可择机清理。
- 工作流累计的历史基线：首次生成时 seed=当前节点数，本次改动前已删除的历史节点无法追回(不可避免，同对话流 seed)。

---

### 2026-07-09 (earlier) END-OF-SESSION STATE — （已完成，保留作历史）下一个 AI 先读这条（用户要求直接部署）

**用户明确指令：下一个 AI 直接部署本 session 做好的"生成压缩"功能，并把这一长串未推改动一起推 GitHub。**

**当前状态分两块：**
- **(A) 已 DEPLOYED prod+Ali 但未推 GitHub**：上传卡95%根治(Ali nginx)、上传进度条真实化、上传节点显示文件名、工作流上传节点刷新卡99%修复。
- **(B) 本地 only、未部署**：生成压缩功能（后台可控 + sharp 图片 + ffmpeg 视频）。`tsc`+`build` 通过。

**改动文件清单（本 session）：**
- 新增：`src/lib/upload-progress.ts`、`src/app/admin/admin-generation-settings-panel.tsx`
- 改：`src/components/chat-workbench.tsx`、`src/components/workflow-tldraw-canvas-inner.tsx`、`src/lib/system-settings.ts`、`src/app/admin/page.tsx`、`src/app/admin/admin-system-settings-panel.tsx`、`src/app/admin/api/system-settings/route.ts`、`src/lib/local-assets.ts`、`src/lib/media-save-queue.ts`、`next.config.ts`、`package.json`/`package-lock.json`(sharp)
- Ali nginx(服务器配置，已 live)：`sites-enabled/flashmuse-static-ip` 两个 `location /` 加 `proxy_request_buffering off;`

**部署步骤（有新 npm 依赖 sharp，无 Prisma 迁移）：**
1. `git status --short`/`diff`/`log`；`npx tsc --noEmit`+`npm run build` 本地再确认。
2. 全量源码快照部署（改了多文件+新文件），流程见 03-deploy "HOW TO DEPLOY"。
3. **服务器必须 `npm install`**（`sharp` 要拉 Linux x64 原生二进制；也确认 `next.config.ts` serverExternalPackages 含 sharp 已同步）。可在解压源码后、build 前执行 `npm install`。
4. `/usr/local/bin/deploy-flashmuse-production.sh`（build+PM2+Ali同步）。
5. **部署后验证**：
   - 后台 `ali.venusface.com/admin` 硬刷：导航"模型开关"(开关图标)+"系统设置"(齿轮图标)两个 tab；系统设置里图片/视频两行 压缩开关+三档质量(高95/标准80/低60)、关则质量置灰；改动能保存且不清空"模型开关"里的 API key(字段合并式)。
   - 生成一张图 → 落盘应是 sharp 转的 JPEG(默认标准80%)；关掉图片压缩再生成 → 应保留原图格式。
   - 生成一个视频 → media-save 后应被 ffmpeg 转码(变小才替换)；**留意马来 worker CPU**（视频压缩默认开）。
   - 上传图片/视频：进度条从 0 慢爬到 60~70 随机值再慢爬到99、成功跳100(不再秒到95干等)；工作流上传节点左上角显示"上传XX 文件名"；上传成功刷新不再卡99%。
6. **推 GitHub**：本次连同 8866940 之上所有未推(备案footer/法务页、上传大改造B1-B8、网络诊断logo、本session全部)一起 commit+push。推完 prod=GitHub=本地。
7. 风险：生成压缩改了落盘链路(图片扩展名在"关压缩"时会变、视频转码)。建议部署前后跑 `prod-deploy-snapshot` 对比(见 03-deploy)。默认图片开+标准、视频开+标准；如担心 CPU 可先把视频压缩在后台关掉再逐步观察。

**押后（已写 06-memo-tasks M015）**：阿里端上传压缩转发小服务——用户"以后再说"。阿里 2核/3.4G/全闲/已装 ffmpeg，可行；成本是维护一个阿里小 Node 服务(接收→压缩→转发马来)。

**教训**：sharp 要进 serverExternalPackages + 服务器 npm install；nginx 只转发不能压缩；进度条 xhr.upload 只测到最近一跳；工作流运行时临时态别存库(存库边界剥离，别动 normalizeState)。

### 2026-07-08 (网络诊断 session) END-OF-SESSION STATE — 先读这条

- **本 session 以诊断/运维为主，代码只改了首页 logo 一处。GitHub 仍未推**(在 `8866940` 之上，连同前几个 session 的本地改动一起未提交)。
- **上传卡95%只修了一半，下一个 AI 要根治**：
  - 已确认 B7(二进制 multipart 上传)没问题。真根因在 nginx：Ali 默认 `proxy_request_buffering on` 双重缓冲 + 马来默认 `client_body_timeout 60s` 太短 → 大视频 nginx 层 408。
  - 已做：马来 `conf.d/flashmuse-ip.conf`+`flashmuse.conf` 加 `client_body_timeout 300s`(保留)。
  - **未做/被回滚**：Ali `sites-enabled/flashmuse-static-ip` 两个 `location /` 的 `proxy_request_buffering off`(当时误判它导致全站卡，回滚了；实际全站卡是丢包)。**根治步骤：重新给这两个 `location /` 只加 `proxy_request_buffering off;`(不要加 `proxy_max_temp_file_size 0`)，`nginx -t`+reload，再传大视频复测。** Ali 备份在 `/etc/nginx/flashmuse-static-ip.bak.20260708164344`。
- **全站卡=马来↔阿里 50% 丢包**(架构固有，非 bug)。已开 **BBR** 缓解(两台 sysctl 持久化，A/B 快6~10倍)。回退：`sysctl -w net.ipv4.tcp_congestion_control=cubic`+删 `/etc/sysctl.conf` 两行。
- **首页 logo 去提示语已 DEPLOYED prod**(未推 GitHub)。备份 `.deploy-backups/20260708-logo-no-tooltip/`。

### 长期优化方向：双服务器跨境链路治本(2026-07-08 与用户讨论定调)

**问题本质**：现在马来(BytePlus)↔阿里(国内)走**公网跨境**，随机丢包 20~50%，是全站卡顿/上传慢/灰屏的总根源。BBR、nginx 调优、分片上传都只是治标。

**用户认可的治本方向**：把马来 BytePlus 那台**换成阿里海外(新加坡)**，使两台都在阿里 → 可用**阿里私有骨干**(CEN 云企业网 / GA 全球加速)连成稳定内网，跨境速度有保证。海外那台照常调 OpenRouter/BytePlus(二者自带全球 CDN，不必非用 BytePlus 主机)。

**已定的约束/结论(别重复讨论)**：
- **香港排除**：用户实测香港被当国内、模型返回"当前地区不可用"(403)。境外节点必须用新加坡这类真境外。
- **跨境带宽费躲不掉**：任何中国云(腾讯/华为/阿里)的"国内↔境外私有链路"都要买跨境带宽——是受管制跨境电路的本质，**换腾讯云也省不掉**。合规由云厂商持牌处理，用户只付费。
- **第三方隧道(GlobalSSH 类)不建议**：多走公网、稳定性存疑；公司已 ICP 备案，用非持牌跨境隧道跑生产有合规风险。
- **CDN 之前已因费用放弃。**

**两种买链路方案 + 价格**(详见桌面文件 `C:\Users\ASUS\Desktop\跨境加速方案对比_GA_vs_CEN.md`，价格均估算以阿里控制台/销售为准)：
- **GA 全球加速(按量)**：实例费 0.137元/时≈99元/月 + CU费 0.386元/GB + 跨境流量费。以 100GB/月≈**220~270元/月**，随数据量线性涨。起步便宜、可随时停/调、适合先试。
- **CEN 云企业网+跨境带宽包**：按带宽(Mbps)包月、带宽内流量免费。5Mbps≈**550~1400元/月**，与数据量无关。最稳、包月不看量，数据量大时更划算。
- **交叉点约 300~500GB/月**：低于用 GA，高于用 CEN。

**建议执行顺序**：
1. **先花小钱验证**(方案成立的前提)：开一台阿里新加坡按量 ECS，实测 ① OpenRouter/BytePlus 那几个模型能不能正常调、会不会 403；② 开 GA 小带宽包实测新加坡↔国内那台的丢包/吞吐(对比现在马来的 ~40KB/s)。这两项过了方案才真成立。
2. 验证通过 → 规划正式迁移：Next.js 应用、PostgreSQL 数据 + `/generated` 全部媒体、`.env.local`、nginx、PM2、Prisma、tldraw patch、cron、SSL、ali-sync 方向调整。数据/媒体迁移是重头。
3. 迁完架构变成:阿里新加坡=源站/模型/API/DB/媒体，阿里国内=入口/镜像/反代，两者走 CEN/GA 私网。此时旧想的 Option B(Ali 本地落盘+单向同步)也顺理成章。

### 2026-07-08 (备案+上传大改造 session) END-OF-SESSION STATE — 先读这条

- **状态**：本 session 全部改动 **DEPLOYED prod+Ali 但未推 GitHub**(在 `8866940` 之上未提交)。做了两大块：(1) 国内备案 footer + `/terms` `/privacy` 法务页；(2) **上传链路重构**(核心)。细节见 CHANGELOG 顶部 A/B1-B8 + "⭐当前上传链路全景"。
- **改动文件清单**：`src/app/page.tsx`、`src/app/terms/page.tsx`(新)、`src/app/privacy/page.tsx`(新)、`src/components/legal-tabs.tsx`(新)、`src/app/api/asset-upload-temp/route.ts`、`src/app/api/upload-file/route.ts`、`src/lib/local-assets.ts`、`src/components/chat-workbench.tsx`、`src/components/workflow-tldraw-canvas-inner.tsx`、`public/home-assets/beian-police.png`(新)、`public/home-assets/business-license.jpg`(新)。
- **下一个 AI 若继续改造上传：务必先读 CHANGELOG 顶部"⭐当前上传链路全景"**，那里把两个后端接口、客户端函数、上传/读取两条路由、body 上限、ali-sync 都写清楚了。

- **BROWSER-VERIFY(ali 硬刷 Ctrl+Shift+R)**：
  1. 首页底部黑条备案信息齐全、公安号前有图标、链接新窗口开、营业执照打开水印图。
  2. 登录框 50px高/5px圆角；《用户协议》《隐私政策》新窗口开，顶部可切换。
  3. 工作流上传图片/视频：圆环进度(最窄边30%)、首帧+黑层、传完显示原图秒开(不再灰屏/不再卡1%或95%)。
  4. 上传视频几秒完成(不再 base64 卡死)。上传 JPEG 一趟完成(不再探测重传停顿)。

- **上传链路后续(下一个 AI 可继续，按价值排序)**：
  1. **根治幽灵节点**：上传失败/中断的节点应自动清除、且任何时候都能删掉(本 session 只手工清了一个)。现在删除逻辑 `deleteNode`/键盘删除把节点移进历史；带 `uploadProgress` 的中断节点会与上传回调打架被写回。建议：上传 promise reject/abort 时把该节点 `uploadProgress` 清掉并标 error 或直接移除；`updateNode` 对已删除节点不要重新插入。
  2. **Ali 上传端点 `proxy_request_buffering off`**：让 Ali 边收边转发马来(不先缓冲整包)，进一步降大文件延迟。改 Ali nginx(备份+`nginx -t`+reload)。
  3. **大视频分片/断点续传**：目前一个 XHR 传完整文件(180s 超时)。超大视频或弱网仍可能超时。
  4. **Option B(用户理想架构，大工程)**：在 Ali 跑上传服务，本地落盘+转码+连马来 DB，改成 Ali→马来单向同步，彻底免"马来→Ali 回传"。需要在 Ali 部署应用、开 Ali→马来 Postgres 通道、迁移转码逻辑。当前是 Option A(nginx 反代)+回传同步。
  5. 清理冗余：B6 内联转码后，前端 forceReencode 自动重试、B1 的 reencode 埋点判断都成了兜底，可择机删。

- **教训**：home-assets 新图要同时放主服务器 public 和 Ali 镜像；上传"走哪"≠"存哪"；base64+JSON 传大文件是万恶之源用二进制 multipart；改 JSON 数据用 prisma 脚本要 export DATABASE_URL；服务器脚本 scp .sh + `sed -i 's/\r$//'`。


### 2026-07-08 (later session) END-OF-SESSION STATE — 先读这条

- **状态**:全部同步。工作流恢复时序 bug 已修并 DEPLOYED prod+Ali，且**已 PUSHED GitHub `8866940`**。现在 **prod=GitHub=本地** 三方一致，工作树干净(除后续 handover 提交)。
- **本 session 做了什么**:修工作流断线重连恢复的时序竞态(图片恢复慢1分钟)。根因是 4 个恢复 effect 用"挂载后固定延时跑一次"赌节点是否已加载，图片扑空即弃。改成数据驱动:新增 `pendingRecoverySignature`(从 `value.nodes` 里仍在转圈的节点派生)，恢复 effect 依赖它触发。单文件 `workflow-tldraw-canvas-inner.tsx`。详见 CHANGELOG 顶部 + 01-current-status。
- **BROWSER-VERIFY**(ali 硬刷):工作流生成图/视频转圈时关浏览器，几分钟回来→两者都应几秒内恢复。**这条待用户实测确认**(修复已上线但用户尚未回报测试结果)。
- **下一个 AI 若继续**:见下方"仍可优化/局限"。改动先 `git status`/`diff`，`tsc`+`build`，窄部署，风险高的先跟用户说。
- **仍可优化/局限**(沿用上个 session，仍适用):
  - 视频 poll 恢复后重问间隔是 10s(`videoPollIntervalMs`)、图片 3s(`imagePollIntervalMs`);用户确认无需改短。
  - 视频 job 无超时(用户要求);provider 永不返回会一直轮询。
  - `waitForMediaSaveJob` 每条视频最多阻塞 worker 60s。
  - 多实例部署时 GenerationJob 用 DB lease 已安全，但 media-save-queue 仍是本地 JSON(见 M008)。
- **教训**:恢复逻辑要数据驱动(依赖加载出的状态签名)，别用固定延时赌数据到没到;改源码用 edit 工具;服务器脚本用 scp 的 .sh + `sed -i 's/\r$//'`;上线以 `tsc --noEmit`+`npm run build` 为准。

### 2026-07-08 (最新 session) END-OF-SESSION STATE — (superseded by above，已随本次一起推 GitHub)

- **状态**：图片 job 化已上线;视频(对话流+工作流) job 化已完成并上线;生成恢复的多层兜底 + 工作流 2000 字修复全部 DEPLOYED prod+Ali。**GitHub 仍未推**(prod 领先 GitHub，本地有未提交改动)。
- **下一个 AI 首要**：
  1. 用户说"推 GitHub"时才推:先 `git status --short`/`diff`/`log`，`npx tsc --noEmit`+`npm run build`，再 commit+push。当前有 schema 变更(GenerationJob，生产已迁移)、新文件(generation-jobs/worker/instrumentation/generation-status)、以及本 session 的 workspace-workflows / video / chat-workbench / workflow-inner 改动。
  2. 若继续做:见下"仍可优化/局限"。
- **本 session 已做(细节见 CHANGELOG 顶部 8 条)**：图片 job 部署;工作流2000字只算文本节点;视频 job 化(createVideoJob/runVideoJob/claimVideoJobs/finalizeVideoJobAsset);视频等本地存盘再落库(修过期URL+资产库);对话流图片/视频消息级 reconcile;工作流图片/视频 reconcile;服务端保存自愈 mergeWorkflowCanvasMedia+getSucceededWorkflowJobResults;visibilitychange/focus 恢复。
- **BROWSER-VERIFY(ali 硬刷新 Ctrl+Shift+R 先加载新JS)**：
  1. 对话流/工作流生成图片或视频，转圈时关浏览器/切走，几分钟后回来→自动出结果(不用手刷)。
  2. 工作流连很多图不影响 2000 字额度;2000 字只算输入框+文本节点+手写@。
  3. 视频生成后进资产库(video_N_wX / video_N_d0)，URL 是本地 /generated/ 不是 volces 远程。
  4. 旧标签页发"生成中"不会覆盖已成功结果(服务端自愈)。
- **仍可优化/局限**：
  - 视频 job 无超时(用户要求);provider 永不返回会一直轮询。
  - `waitForMediaSaveJob` 每条视频最多阻塞 worker 60s。
  - 视频创建极端(pendingRequests 丢失)可能重建一次 provider 任务(不重复扣费)。
  - 多实例部署时 GenerationJob 用 DB lease 已安全,但 media-save-queue 仍是本地 JSON(见 M008)。
- **教训**：改源码用 edit 工具;服务器脚本用 scp 的 .sh + `sed -i 's/\r$//'`,别 PowerShell 内联 `$()`/`grep`;`psql` URL 去 `?schema=`(`${val%%\?*}`);上线以 `tsc --noEmit`+`npm run build` 为准(eslint 不 gate)。

### 2026-07-07 (最新 session) END-OF-SESSION STATE — 下一个 AI 上来直接按顺序做，别问

**用户指令(原话意图)：下次上来先把本地未部署的改动部署掉，然后把视频的对话流+工作流也做成 job 化。读完交接文档必须完全接上、直接做。**

**当前状态：本 session 全部改动都在本地，未部署 prod/Ali、未推 GitHub。** `tsc`+`build` 通过，用户本地已自测图片 OK(见 CHANGELOG 顶部"已验证")。改动文件清单：
- 新增：`prisma/migrations/20260707000000_generation_jobs/migration.sql`、`src/lib/generation-jobs.ts`、`src/lib/generation-worker.ts`、`instrumentation.ts`、`src/app/api/generation-status/route.ts`
- 改动：`prisma/schema.prisma`(加 GenerationJob model)、`src/app/api/image/route.ts`(加 async 分支)、`src/components/chat-workbench.tsx`(对话流图片 job 化 + flushNextWorkspaceSaveRef 发送即保存)、`src/components/workflow-tldraw-canvas-inner.tsx`(工作流图片 job 化 + resume + reconcile#2 + imageRequestId + imagePollIntervalMs + 类型)

**第一步：部署本 session 图片 job 改造(有 schema 变更!)**
1. `git status --short`/`diff`/`log`，本地 `npx tsc --noEmit` + `npm run build` 再确认。
2. 部署流程见 03-deploy-and-servers "HOW TO DEPLOY"。**这次有 Prisma 迁移** `20260707000000_generation_jobs`，服务器上必须先 `npx prisma migrate deploy`(DATABASE_URL 取 .env.local 第一行)再 build。用全量源码快照部署(新增了多个文件)。
3. **instrumentation.ts 会在服务器启动时拉起常驻 worker**——部署后确认 PM2 里 worker 起来了(日志 `[generation-worker] started`)、且不影响登录/workspace。生产是单 PID PM2，setInterval worker 可用。
4. 部署前后跑 prod-deploy-snapshot 对比(assetListHash 等)，三域名 200。
5. 部署后浏览器验证：对话流+工作流生成图片，**在图片还在转圈时**退出/刷新/关标签，回来应秒出(取已完成 job)或继续等待卡，明确失败才失败卡；永不回来图也进资产库。

**第二步：视频 job 化(对话流+工作流)——用户点名要做**
- 目标同图片：`/api/video` 创建任务后建 GenerationJob(kind=video, providerTaskId)，worker 持续轮询到 succeeded/failed→`enqueueRemoteAssetSave`存盘+`chargeCredits`扣费+写资产库(conversation_videos/workflow_videos)，退出/重启/永不回来都推进。
- 前端两处(`chat-workbench.tsx createAndPollVideo`、`workflow-tldraw-canvas-inner.tsx pollVideoNode/resumeInterruptedVideoNodes`)改为提交拿 jobId + 订阅 `/api/generation-status` + 加载对齐(工作流按 workflowNodeId 用 reconcile 兜底、对话流按 requestId)。
- **⚠️ 最大风险**：`/api/video` 创建分支里的 **BytePlus 真人审核往返**(`autoReviewBytePlusVideoReferences`、`status:"reviewing"` 重试、asset:// 替换)极其缠绕。方案：保留创建分支原逻辑，拿到 providerTaskId 后建/更新 job，让 worker 只负责**轮询→完成**；或把整套创建搬进 worker(更彻底但风险高)。务必先读 `src/app/api/video/route.ts` 全文再动。
- 视频 `finalizeImageJobAsset` 的对应版本(写 conversation_videos/workflow_videos + poster)要补；命名 video_N_wX / video_N_d0。
- 参考图片实现：worker 的 `claimVideoJobs`(status running + providerTaskId + nextRunAt 到期才轮询，间隔~5-10s，无上限时间)、`pollVideoJobOnce`(把 video/route.ts 轮询成功分支的 save+charge+manifest 抽成可复用函数，路由和 worker 共用避免两份逻辑)。

**其它细节记忆(发送即保存)**：见 CHANGELOG。防抖 500ms→提交时 `flushNextWorkspaceSaveRef` 改 0ms；工作流靠 reconcile#2 兜底不依赖保存。

**已验证/别重复踩**：图片 job 化本地测通(4 条 conversation image job 全 succeeded)。视频这次没动(靠既有 taskId+resume)。本地登录"请求失败"=dev 运行时 `.next` 被破坏，停 node+删 `.next`+start-project.bat。


### 2026-07-06 (最新 session) END-OF-SESSION STATE (read this first)

- **DEPLOYED prod+Ali AND PUSHED GitHub**。本 session 结束时按用户要求把攒的批次一起推了(包含上一个 later session 未推的 `video/route.ts` 去掉审核上限、命名统一等所有本地改动 + 本 session 5 项)。推送后 prod=GitHub=本地。下一个 AI：若继续改，先 `git status --short`/`diff`，`npx tsc --noEmit`+`npm run build`，再窄部署。
- 本 session 5 项(详见 CHANGELOG 顶部 + 01-current-status)：
  1. **B_373 文案**：`toUserErrorMessage` 幂等化(Case3 正则补中文自匹配)，修复输出音频审核被误判成"参考图未过审"。
  2. **对话流"使用提示词"**：按 `message.imageReferences`+`message.uploadedFiles` 真实还原图/视频/音频/文档卡(不再只靠@提及)。
  3. **工作流"使用提示词"**：新增 `generationUploads` 快照(生成成功时存 uploads+连线引用)，`addNodeFromPrompt` 还原它+`videoReferenceMode`。
  4. **工作流视频 prompt**：成功回写干净 `prompt`(非带 hint 的 modelPrompt)。仅新生成生效，老节点历史未回改。
  5. **参考 hint 统一+意图化**：`src/lib/reference-hint.ts` `buildReferenceHint`，逐张按"@图前是否有参考词"判绝对/松参考。
- **BROWSER-VERIFY(ali 硬刷新 Ctrl+Shift+R)**：
  1. B_373 那类(输出音频审核失败)：红字应是 Case3"参考图已过审、成品视频/音频被拒…去除背景音乐/不要原声"，**不是** Case2 换参考图。
  2. 对话流：找含引用图+上传视频/音频/文档的生成消息，点"使用提示词"→ 提示词+图+视频/音频/文档缩略图全回输入框。
  3. 工作流：连图/视频/音频到节点→生成成功(边自动断)→ 右键"使用提示词"→新节点带回提示词+所有连线参考卡且能再生成；Seedance 首帧/首尾帧模式也带回。
  4. 工作流视频节点"使用提示词"不再出现"参考图顺序：…必须分别保留…"那段(新生成的视频)。
  5. 意图 hint：`功夫大师@角色图 跳舞，动作运镜参考@某视频` 生成时——角色图应被保留、视频只作动作运镜参考(观察是否更贴合意图)。
- **KNOWN/局限**：意图 hint 是启发式(基于@提及前的关键词)，没被@提及的上传参考图无法判意图默认绝对；如需更准可升级为显式"参考图用途"菜单(方案C，之前讨论过，契合团队弃用关键词推断 Seedance 的先例)。工作流视频老节点的 data.prompt 仍含旧 hint(未回改历史)。

### 2026-07-06 (later session) END-OF-SESSION STATE (superseded above — 已随本 session 一起推 GitHub)

- **DEPLOYED prod+Ali, GitHub 未推(攒批次)**。改了 `error-message.ts`、`app/api/video/route.ts`、`components/chat-workbench.tsx`、`components/workflow-tldraw-canvas-inner.tsx`。备份：`.deploy-backups/20260706-review-error-message`、`-review-lock-message`、`-review-lock-names`、`-remove-review-limit`、`-asset-naming`、`-unified-naming`。DB 补了 2 行(见下)。
- **下一个 AI 首要：GitHub 尚未推送**。本 session + 上一 session(aad3461 之后)的所有本地改动都还没推。等用户说"推"时：`git status --short`/`diff`/`log`，`npx tsc --noEmit`，再 commit+push。prod 领先 GitHub。
- **火山审核报错**：`error-message.ts` 按 input/output 关键字分流成 Case2(输入/参考图未过审→建议换图) 和 Case3(输出视频/音频未过审→可重试/改词、音频去背景音乐)。
- **审核次数上限已彻底去掉(A)**：`video/route.ts` 删了 `getBytePlusReferenceFailure` 短路 + auto-review 的 `attempts>=MAX` throw + 该函数本身。同一参考图**每次重试都重新送审、无上限**。对话流+工作流共用后端，两流都覆盖。前端 `runVideoNode` 仍发 `referenceImageNames`(后端现忽略，无害)。
- **命名统一规则(务必遵守)**：终身ID=`MediaAsset.initialName`(出生写库永不变)；改名=`UserAssetState.currentName`；显示 `改名||终身ID`，同一图按URL处处同名；后台两名 `/` 隔开。资产库新生成图 = `asset_N_role/scene/storyboard`(每用户全局计数，`getNextAssetGenerationName`)。`applyAssetGenerationSystemNames` 已改 no-op(禁止再按下标重排)。工作流有校准 effect 按URL把节点 `mediaSystemNames` 对齐库名(含改名)。
- **⚠️ 血泪教训**：工作流命名校准 effect 初版依赖了父组件 inline `.map` 新建数组派生的 useMemo(Map) → 每渲染新引用 → effect 无限循环 → 工作流页崩溃("This page couldn't load")。已用**稳定内容签名字符串 + 差异守卫**修复。**任何 workflow effect 的依赖都不要用 `workflowAssets`/`referenceAssets` 等 inline prop 数组或其派生引用。**
- **DB 补数据**：仅 2 张 character_image(initialName/currentName 全空)补为 `asset_legacy_<mediaId8>_role`。老图其余未动(数字可能从"当前排位"变"存库终身ID值"，用户接受"数字不重要统一才重要")。
- **③ 已验证无泄漏**(removeUpload/disconnectNodes 都正确)，无需改。
- **BROWSER-VERIFY(ali 硬刷新 Ctrl+Shift+R)**：(1) 工作流能正常打开(不再崩)。(2) 同一张图在 资产库/对话流预览/输入框缩略图/画布节点/后台 名字一致；资产库改名后各处同步。(3) 新生成的角色/场景/分镜图显示 `asset_N_role/scene/storyboard`。(4) 视频参考图审核失败后可无限重试(每次重新送审)，红字 Case2；输出审核失败红字 Case3。

### ④ 待办(用户押后，下次谈) — 对话流"让它动起来"自动带最近图
- `chat-workbench.tsx` `getRecentReferenceImages`(约4903) + `isReferencingRecentImage`(约4898)：提示词含 `这张图/让它动起来/参考图/首帧` 等词且无@无上传时，**自动带上最近消息的图**去生成(无缩略图、无@)。用户要求先做完命名再谈：保留此隐式行为，还是要求必须有@/缩略图才带图。工作流无此逻辑。

### 2026-07-06 END-OF-SESSION STATE (earlier session — superseded above, kept for context)

- DEPLOYED to prod+Ali AND PUSHED to GitHub. 最新 commit `aad3461`。全部为**工作流**功能/修复，仅改 3 个文件(`workflow-tldraw-canvas-inner.tsx`, `workflow-tldraw-canvas.tsx`, `chat-workbench.tsx`)，无 schema 变更。备份 `.deploy-backups/20260706-workflow-asset-import/`；快照 `20260706-workflow-asset-import-before/after.json` compare `ok:true`。详见 CHANGELOG 顶部条目。
- BROWSER-VERIFY(ali.venusface.com 硬刷新 Ctrl+Shift+R，工作流入口已开放):
  1. **从资产库导入**：dock「从本地上传」后有「从资产库导入」按钮；空白右键菜单、空工作流按钮组也有。点开→弹窗左分类tab带图标(角色/场景/分镜/上传/对话流生成图片视频/工作流生成图片视频)、右侧五列直角缩略图、下拉流式加载、勾选多选(蓝描边和勾选同时出现)。多选含图片+视频确定→画布一行五张不重叠、聚焦；导入的**生成**类显示"图片/视频生成+文件名"、右键使用提示词可用；**上传**类显示"上传图片/视频"、只显示尺寸、使用提示词置灰；显示完整原图+真实原图尺寸(不裁切)；重复导入同图出现多个节点。
  2. **视频轮询恢复**：工作流生成视频拿到 taskId 后刷新页面→节点恢复等待卡并继续轮询、最终出视频(不再永久卡等待)。
  3. **不置顶**：打开含视频的工作流(02/04)不置顶；刷新后顺序不变；做一次真实编辑(移动/改文本/生成/连线)才置顶。
  4. **视频时长**：video_2_d0 加载后右上角显示真实"5秒"(不再 8秒)。
- KNOWN/未做(低优先)：(a) 导入弹窗视频缩略图依赖 poster/`getLocalVideoPosterUrl`，个别无 poster 的视频格子显示"无预览"(可点选仍能导入)。(b) 导入的生成类节点因资产库无 model id，右上角参数不含模型名(只有比例/分辨率/时长/尺寸)——与图层恢复行为一致，如需模型名要另存 model。(c) 之前遗留：积分弹窗首开仍走 `mode=full`(见更早条目)、客户端 `isConversationUploadedAsset` 与服务器 conversation_uploads 口径统一 仍未做。
- 教训：改源码一律用 edit 工具；上线以 `tsc --noEmit`+`npm run build` 为准(eslint 不 gate)；工作流"有意义快照"新增字段时，凡是**自动回填/派生**的字段务必加进 `getWorkflowMeaningfulSnapshot` 的剔除列表，否则会导致打开即置顶。

## Do First

1. Use `E:\project\FlashMuse_Agent` as the only current local project root. It is the original `AI-Video-Assistant` directory renamed on 2026-06-26, not the smaller temporary copy.
2. The old path `E:\project\AI-Video-Assistant` should no longer exist. If it reappears, treat it as stale/backup until verified.
3. Run `git status --short` and inspect diffs before editing.
4. Current GitHub repository is `https://github.com/lookxun/FlashMuse_Agent`; local `origin` should be `https://github.com/lookxun/FlashMuse_Agent.git`.
5. Do not revert unrelated local/user changes.
6. Run `npx tsc --noEmit` before committing or deploying code changes.
7. For deployment, use the current risk-based rule: low-impact deploys may be done directly; anything that may affect active frontend users or running tasks must be explained to the user first and approved before deployment.
8. For risky workspace/asset deploys, first run production snapshot `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot BEFORE_LABEL`, deploy, run another snapshot, then compare. If compare fails, stop and fix or roll back.

## Highest Priority

### 2026-07-05 (最新 session) END-OF-SESSION STATE (read this first)

- DEPLOYED to prod+Ali AND PUSHED to GitHub. 最新 commit `f5bc38b`。内容：后台三大表(用户管理/生成记录/积分管理)的"点开详情"媒体弹窗做了 **按类分页 + 下拉流式加载** 性能优化(点哪个只读哪个、先读少量、滚动加载)。全部 admin-only，未动用户端 workspace/资产数据。GitHub 与 prod 同步。
- FILES: `src/app/admin/api/records/user-detail/route.ts`(新 `mode=media-page` 分页 + 轻量 `mode=uploads` + 共享 `getAssetScope` 分类器)、`src/app/admin/admin-users-panel.tsx`(`AdminMediaDialog` 自加载分页，props 改为 userId/userLabel/mediaType)、`src/app/admin/admin-records-panel.tsx`(改用 uploads 模式、传 label)、`src/app/admin/admin-credits-panel.tsx`(`useRevealOnScroll` + 两表格弹窗分批渲染)。详见 CHANGELOG 顶部条目。
- BROWSER-VERIFY(后台 ali.venusface.com，Ctrl+Shift+R 硬刷新): (1) 用户管理展开→点「所有生成图片」只加载图片、先 12 张、下拉流式加载；关掉点「所有生成视频」只加载视频，互不干扰；数量(标题旁)与折叠行计数一致。(2) 生成记录 对话流/工作流/资产 图片视频 + 上传记录 弹窗同样分批加载。(3) 积分管理各明细弹窗缩略图不再一次性全加载，下拉出现"下拉加载更多(剩余数)"。缩略图缺失应自动回退原图，视频用封面。
- 若某类分页列表**数量对不上**折叠行显示的计数：口径在 `getAssetScope`(route.ts)与 `matchesMediaType`；分页 total 用轻扫全行同一分类器算，理论与计数一致；折叠行计数来自 `getFastMediaSummary`(workflow 优先 asset)——两者已对齐，若不一致先查这两处口径。
- KNOWN/未做: 积分弹窗**首次打开**仍走 `mode=full`(读全量 workspaceMessages)，首开可能偏慢；本次没动其取数(积分"最重要别弄坏"，改口径有丢"无 ledger 记录媒体行"风险)。若用户实测首开仍慢，再单独做 credits 专用轻量接口(只读 ledger + 轻量资产富化)并仔细验证 totals/明细不变。
- 教训(务必遵守): (a) **改源码一律用 edit 工具**，不要用 PowerShell `Get-Content -Raw|Set-Content` 之类文本替换写回——本次它破坏了 credits 文件编码(变 binary/中文乱码)，靠 `git checkout --` 才救回。(b) 本仓库 `npx eslint` 会报大量 `no-explicit-any`(历史写法) 和 `react-hooks/set-state-in-effect` 的 **error，但不 gate `next build`**；能否上线以 `npx tsc --noEmit` + `npm run build` 为准。

### 2026-07-05 (asset-mention session) END-OF-SESSION STATE

- DEPLOYED to prod + Ali AND PUSHED to GitHub. Latest commit `55d427d`. Work: asset-library ↔ @引用资产 popup alignment (real counts, scroll-load, correct upload label) + FIX for uploaded audio (.bin) wrongly rendered as broken image cards in 上传图片. GitHub in sync with prod.
- FILES this session: `src/components/chat-workbench.tsx` (mentionGroupToAssetCountKey, loadMoreMentionGroup + onScroll, group-label sub-title, `isUnhostedRemoteAssetUrl`, `isNonDisplayableFileAsset`), `src/components/workflow-tldraw-canvas-inner.tsx` + `workflow-tldraw-canvas.tsx` (referenceAssetCounts / onLoadMoreReferenceAssets). `src/app/api/workspace-state/route.ts` was touched then REVERTED (see correction below) — it is back to its pre-session state.
- ⚠️ CORRECTION baked in: an early attempt to relax `isVisiblePersistedMediaUrl` (skip local existsSync) was WRONG and reverted (commit 847aaa7). Keep the existsSync gate + mediaExistsCache. And LOCAL dev DB user `ID_779117` ≠ PROD user `ID_636611` for `12424740@qq.com` — use prod userId when querying prod.
- BROWSER-VERIFY on ali.venusface.com (hard-refresh Ctrl+Shift+R, then switch to workflow and back to 资产库): (1) the 3 blank cards (demo audio) are GONE from 上传图片; (2) 上传图片 count (23) unchanged; (3) @引用资产 popup (conversation AND workflow) counts+content match the four library categories, scroll loads more; (4) 上传图片 gray sub-label shows "上传图片" not "待分类".
- IF another "broken card" is reported: get the real `<img>` src via Console `document.querySelectorAll('img').forEach(i=>{if(!i.complete||i.naturalWidth===0)console.log(i.currentSrc||i.src)})` (user must type `allow pasting` first). Then check: is it a `/files/` non-video (audio/doc → should be excluded by `isNonDisplayableFileAsset`), an expired remote URL (excluded by `isUnhostedRemoteAssetUrl`), or a real `/generated/` file missing on Ali (check curl on ali vs main)?
- NOT done (low impact): unify client `isConversationUploadedAsset` vs server conversation_uploads predicate (edge: promptSource=upload but non-/upload_image/). Counts use server truth so numbers already match.

### 2026-07-05 (later session) END-OF-SESSION STATE (superseded by the entry above; kept for context)

- DEPLOYED to prod + Ali AND PUSHED to GitHub: asset-library + admin-detail performance optimizations (compute-only, no functional/content change). This same commit ALSO pushed the earlier 2026-07-05 admin-overview/analytics work that was previously live-but-unpushed. So GitHub is now in sync with prod.
- FILES this session: `src/app/api/workspace-state/route.ts` (cachedFileExists + lightweight getAssetCounts), `src/components/chat-workbench.tsx` (AssetThumbnailImage fallback), `src/app/admin/api/records/user-detail/route.ts` (include→select, drop big JSON columns). See CHANGELOG top entry + 01-current-status for full root-cause detail.
- BROWSER-VERIFY (the reported symptoms should be gone): (1) 资产库打开应明显变快、不再卡半天、不再莫名显示0/反复刷新，尤其是资产多的用户(如 ID_686996 有571个); (2) 个别缩略图/视频封面缺失时应自动回退显示原图而不是破图; (3) 后台大表(生成记录/用户管理/积分管理)展开行详情应明显变快。
- IF asset library shows WRONG content after this change: the cache assumes files are never physically deleted (product rule). If a file is ever truly removed, it may still show for up to 1h (positive TTL). Adjust `MEDIA_EXISTS_POSITIVE_TTL_MS` in `workspace-state/route.ts` if needed. Counts and list now share the cache so they stay consistent.
- FURTHER perf ideas NOT done (only if still slow after this): real DB pagination in workspace-state (careful: sortOrder overrides firstSeenAt ordering); serve `/generated/image-thumbnails` statically via Nginx instead of Node `/api/media-thumbnail`; pre-generate thumbnails at asset creation so CDN static thumbnail URLs never 404; DB indexes if EXPLAIN shows scans.

### 2026-07-05 END-OF-SESSION STATE (earlier session — now superseded, kept for context)

- DEPLOYED to prod + Ali this session (full-source-snapshot deploy, migration applied on server): (1) admin 概览 fully rebuilt with REAL data + new analytics埋点 tables, (2) conversation top-right usage media counts made cumulative. See CHANGELOG top + 01-current-status for full detail, and 03-deploy-and-servers "HOW TO DEPLOY" for the exact commands.
- NOW pushed to GitHub (in the 2026-07-05 later-session perf commit). GitHub is in sync with prod. Run `npx tsc --noEmit` before any future commit.
- Browser-verify (admin login) that the new 概览 renders and numbers look sane. Historical-capable cards (累计生成图片/视频 + 对话流/工作流 split, 生成趋势, 对话/工作流总数, 积分健康度, 留存, 漏斗, Top用户, 模型调用占比, 功能使用) should have data immediately. New-埋点 cards (生成成功率, 上传成功率, 生成平均时长, 审核拦截细分, 失败原因, 模型调用次数的失败列, 参考素材使用) will read 0/"暂无数据" until events from 2026-07-05+ accumulate — generate a few images/videos and re-check that GenerationEvent/UploadEvent fill in.
- KNOWN by-design limits of the埋点: video SUCCESS rows do not carry reference counts (poll body lacks them) so 参考素材使用 is image-dominant; failure/latency/upload/moderation metrics are post-2026-07-05 only. If the user wants video reference-usage or true end-to-end video latency, that needs create→poll correlation (persist ref counts + create time keyed by requestId) — not built yet.
- If admin 概览 ever errors: `getAdminOverviewData` in `src/lib/admin-overview.ts`; new-table queries are wrapped in `safeRows()` (return [] on missing table), existing-table queries are not — check those first.


### 2026-07-04 END-OF-SESSION STATE (read this first)

- PRODUCTION NOW: workflow entry is OPEN and WORKING (`NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=true`). The "nodes appear then vanish after 5s" blocker is FIXED. Latest commit pushed to GitHub: `65737fa`. Everything from this session is deployed to Malaysia prod + Ali AND pushed.
- THE FIX was a tldraw 5.1.1 LICENSE GATE bypass via `patch-package` (`patches/@tldraw+editor+5.1.1.patch` sets `shouldHideEditorAfterDelay` → `return false`; `postinstall: patch-package` auto-reapplies). NO license was purchased. User decision: internal-only tool, technical bypass is acceptable. See CHANGELOG top + 01-current-status for the full root-cause writeup.
- IF YOU RUN `npm install` / clone fresh: the `postinstall` hook applies the patch automatically. If you UPGRADE tldraw past 5.1.1, the patch will fail to apply — regenerate it (edit `node_modules/@tldraw/editor/**/LicenseProvider.*` `shouldHideEditorAfterDelay` to `return false`, then `npx patch-package @tldraw/editor`).
- FOR FUTURE PUBLIC/COMMERCIAL launch (not internal): the license bypass is a licensing violation for commercial use. Revisit then — buy a tldraw license (`<Tldraw licenseKey>` or `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`) or migrate to React Flow. The React Flow evaluation/perf-spike notes from 2026-07-03 (below) still apply if you migrate.
- Browser-retest the 2026-07-04 workflow fixes online (entry is OPEN now): (1) open a workflow with generated media, wait >5s — canvas stays visible, nodes don't vanish; (2) upload an image node — while the loading bar shows, clicking the node does NOT open the bottom input box; (3) new empty workflow shows the 4-button start UI (文字输入/图片节点/视频节点/上传节点); (4) just selecting/opening a workflow does NOT bump it to the top of the list — only real edits do; (5) top-right usage panel image/video counts exclude uploads, match the generation credits, and do NOT decrease when you delete a generated node (cumulative). Regenerate to confirm counts increment.
- KNOWN/BY-DESIGN: conversation-flow usage counts (`getSessionMediaCounts`) are still message-derived (not cumulative) — only workflow counts were made cumulative this session. Revisit only if the user asks.

### 2026-07-03 STATE (superseded by 2026-07-04 above; kept for context)


- PRODUCTION NOW: full source deployed + pushed to GitHub (commits `8fc55c4` then handover `f85e258`). LIVE in prod: flat 24h session timeout (auth + admin), all admin 生成记录/积分管理/用户管理 changes, `/api/video` MISSING_REQUEST_ID guard, recycle-bin trash count fix, `/workspace` client-only render (no chat flash), workflow preview thumbnail filter, and the workflow code itself. Production `.env.local` `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED=false` — workflow ENTRY is CLOSED (built JS contains `暂未开放`).
- WHY workflow closed: on first real production run, tldraw with NO commercial license degraded — nodes appear then disappear, console spams "No tldraw license key provided! A license is required for production deployments." Re-disabled via flag + rebuild. See CHANGELOG top entry.
- DECISION PENDING (user thinking): (1) buy tldraw license (incl. cheaper hobby/startup tiers) → add `licenseKey` to `<Tldraw>` + flip flag `true` + rebuild = reopen; OR (2) migrate canvas to license-free React Flow (`@xyflow/react`, MIT). Do NOT act until user decides.
- If user picks React Flow: FIRST build a PERFORMANCE SPIKE — load ~150-300 REAL ORIGINAL images (the canvas uses ORIGINAL full-res images via `getStaticMediaUrl`, NOT thumbnails; user requires zoom-to-sharp) with `onlyRenderVisibleElements` + memoized node components, benchmark drag/zoom/pan FPS vs tldraw before committing. tldraw's edge is viewport culling + signals; React Flow can approximate but is unproven for this heavy original-image case. Migration est. 3-5 focused days; business logic (upload rules/generation/prompts/credits/persistence/`WorkflowCanvasState`) is reusable, only the canvas layer (~30-40% of `workflow-tldraw-canvas-inner.tsx`) is rewritten.
- Browser-retest the DEPLOYED-and-LIVE items below (workflow entry is closed so its features can't be retested online until reopened):

### Browser-retest (LIVE in production now)

- 2026-07-03 session: user said "下次部署" — a batch of LOCAL changes is pending deploy. Before deploying, inspect `git status --short`, `git diff`, `git log --oneline -10`, run `npx tsc --noEmit`. The ONLY thing already deployed this session is the image rate-limit hotfix (`src/lib/openrouter.ts` + `src/lib/error-message.ts`), which is NOT committed to GitHub. Local-undeployed files: `src/app/api/video/route.ts`, `src/app/admin/page.tsx`, `src/app/admin/admin-records-panel.tsx`, `src/app/admin/admin-users-panel.tsx`, `src/app/admin/admin-credits-panel.tsx`, `src/app/admin/api/records/user-detail/route.ts`, `src/app/admin/admin-detail-cache.ts`. When deploying, either deploy the full current source snapshot or at least these files; production workflow entry must stay disabled.
- ACTION for user: verify the OpenRouter/OpenAI dashboard for the org's `gpt-5.4-image` (`openai/gpt-5.4-image-2`) rate limit / quota / billing. `B_296/B_308/B_315` were upstream `Request too large ... TPM` throttling (68 hits), NOT our bug. The deployed retry only mitigates transient spikes; if it is a persistent account cap, retries will not help.
- Browser-retest after deploy — 生成记录: 工作流 count column + combined image/video totals; expand shows 上传图片/视频/音频/文档 dialogs (deduped across conversation+workflow+asset) and 工作流图片/视频 open real media lists. If 工作流图片/视频 show 0 for a user who clearly has workflow-generated media, query that user's `MediaAsset` (`workspaceKind` / `currentCategory`) — counting now keys on `workspaceKind === "workflow"`.
- Browser-retest after deploy — 积分管理 (MOST IMPORTANT, do NOT let it break): totals still include workflow; expand shows separate "对话流消耗积分详细" and "工作流消耗积分详细" rows that (with 资产库 + 反推/优化) sum to 已消耗积分; workflow dialog lists per-workflow image/video charges; balance-change reasons show 工作流图片/视频生成.
- Browser-retest after deploy — 用户管理: third column = 历史对话 / 历史工作流(count) / 所有生成图片 / 所有生成视频; the two "所有生成" dialogs merge conversation+workflow+asset media newest-first; 资产库图片 + 工作区保存 gone.
- Browser-retest the video billing guard: normal conversation + workflow video generation still works (both send requestId); any future/third-party caller omitting requestId now gets 400 `MISSING_REQUEST_ID` instead of risking a double charge.
- Perf sanity check after deploy: expanding rows and opening media/credit dialogs in 生成记录/用户管理/积分管理 should be noticeably faster (light `media`/`credits` modes; `records` mode no longer reads `workspace.state`).


- 2026-07-03 layer/menu/drag/tooltip/shortcut session is local-only, uncommitted, unpushed, undeployed (all in `src/components/workflow-tldraw-canvas-inner.tsx`). Before any commit/deploy, inspect `git status --short`, `git diff`, `git log --oneline -10`, then run `npx tsc --noEmit`. Production workflow entry stays disabled.
- Browser-retest this session: (1) layer panel header reads `已删除的节点`; (2) three-dot row menus are horizontal, close on outside click, and opening one closes any other workflow menu; (3) drag a `画布上的节点` row onto canvas = one duplicate at drop point (NOT two — verify the 200ms drop guard holds), source node kept; (4) drag any `已删除的节点` row (image/video/text/persisted asset) onto canvas = restore, row leaves the deleted list and appears as the first `画布上的节点` row; (5) in-panel row reorder still works and does not duplicate/restore; (6) single-click a layer row pans-to-center at current zoom (no zoom change), double-click still zoom-focuses; (7) tool menu has no persistent gray highlight; (8) toolbar + bottom-left tooltips show name + lighter shortcut, disappear on click until pointer re-enters, rightmost 选择 has none; (9) `V` selects tool, `D` inserts video node (dock tooltip + right-click menu show D); (10) tldraw space-pan / arrow-nudge / Escape still work while draw/eraser/undo/copy/paste stay disabled.
- PARKED (user decided NOT to build now) — layer-panel redesign into "left = master node list, canvas-delete = hide-from-canvas (keep in left), new left-side red delete button with confirm dialog". If revisited, first resolve these decision points the user must answer: (a) text nodes have no MediaAsset, so their "delete" is permanent — is that acceptable vs must-be-recoverable? (b) audio should likely go to the recycle bin like image/video, not "disappear"; confirm only text disappears; (c) there is currently NO 30-day auto-clean job (rule is never physically delete) — decide whether "30天" means only "send to recycle bin now" or actually build a scheduled cleanup; (d) with left dedup + canvas duplicates, one left row maps to multiple canvas copies — define whether left delete removes all copies. The accepted takeaway was that "hide" cannot truly disappear; it becomes a "not on canvas" state that must still be stored and shown.
- KNOWN: the layer-panel canvas `drop` handler fires twice per physical drop (root cause unidentified). Currently masked by a 200ms `lastHandledDropStampRef` guard and, for asset restore, by same-URL dedup in `restoreWorkflowAssetToCanvas`. If duplicate/restore ever double again, investigate why `drop` dispatches twice before touching the guard.
- Do NOT re-add a blanket capture-phase keyboard suppressor on the workflow shell: it was tried this session and removed because it also disabled tldraw space-pan. tldraw tool/edit shortcuts are already disabled by `hideUi`; only keep the editor-core canvas controls.

- 2026-07-03: The full workflow-code deploy is DONE and on GitHub (commit `3455532`); production workflow entry remains disabled. Do NOT re-deploy just to pick up the two later local-only changes below unless the user asks.
- Current newest local-only changes (after the deploy) are uncommitted, unpushed, and undeployed: (1) workflow generation green success toast in `chat-workbench.tsx` (`addWorkflowGeneratedAssets` -> `notifyGenerationCompleteOnce`), and (2) deleted workflow image/video nodes now go to layer-panel `历史记录` via new `historicalMediaNodes` in `workflow-tldraw-canvas-inner.tsx`. Before any commit/deploy, inspect `git status --short`, `git diff`, `git log --oneline -10`, then run `npx tsc --noEmit`.
- Browser-retest the new deleted-media history: delete an uploaded / non-persisted image node (fallback label like `[Image 1]`) and confirm it moves into `历史记录` with working 恢复进画布 / 删除 (delete removes only the local history record, no DB delete). Confirm generated persisted media still appears once (no duplicate between `historicalMediaNodes` and `workflowAssets`-based history), that restored media disappears from history, and that it survives refresh. Audio upload nodes are intentionally not captured yet.
- Browser-retest the workflow green success toast: generating an image or video node should show the same green top-center `图片生成已完成` / `视频生成已完成` toast as conversation flow, and it must respect the user `notifyOnGenerationComplete` setting (off = no toast).
- Current newest 2026-07-03 local workflow/input changes are still uncommitted, unpushed, and not deployed. Before any commit/deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`. Production workflow entry remains disabled.
- Browser-retest workflow connection highlighting and selection. Selecting one or more nodes should highlight all directly connected lines blue without selecting those line shapes or showing a large selection box. Drag-box selecting nodes should not keep lines selected. Single-clicking a line should still select that one line and show the center scissors disconnect button. Moving/zooming canvas should not offset or hide highlighted lines.
- Browser-retest workflow connected-input thumbnails. Connecting image/video/audio nodes into an empty image/video target should show read-only thumbnail cards in the target prompt box, count against the target model upload rules, hide relevant upload buttons when limits are reached, and send the references to the model. Closing a connected thumbnail should remove the matching `@文件名` from the prompt box and disconnect the corresponding edge. Successful target generation should remove all incoming edges automatically.
- Browser-retest prompt-box local upload behavior. Uploading from a generation node input box should create or restore an upload node to the left of the target node, avoid overlap, connect it to the target, and show as a connected thumbnail. Re-uploading a same-name file should reuse an existing upload node if present, or restore a matching historical image/video asset, then connect it. Bottom-dock `上传节点` should remain standalone and not auto-connect.
- Browser-retest workflow text connections. Text -> image/video should package target prompt text first and connected text-node content after. If the combined prompt would exceed `2000` chars, connection should be blocked; if text is already connected, the target input should allow only remaining characters and show `输入框和连接文本合计最多2000字`. A target send button should be clickable when connected text exists even if the target prompt box itself is empty. Generated node `data.prompt`, asset `sourcePrompt`, and future `使用提示词` should contain the full combined prompt.
- Browser-retest conversation and workflow mention behavior. Deleting the trailing space after a complete `@文件名` should not open an empty reference asset popup. In workflow, connected-thumbnail `@文件名` should render blue in the editor like normal uploaded/reference mentions. In conversation flow, using `使用提示词` from message, Agent media prompt panel, or preview should restore matching image/video/audio/document cards for any `@文件名` in the prompt.
- Local `B_177` from workflow video reference can be ignored locally: BytePlus could not access a local/generated reference video URL (`content[4].video_url resource not found`). Retest real workflow reference video/audio generation only after deployment with provider-accessible media.

- Current newest local workflow connection changes are still uncommitted, unpushed, and not deployed. Before any commit/deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`. Production workflow entry remains disabled.
- Browser-retest the local workflow connection implementation before any further feature work. It now uses a tldraw custom `workflow_connection` shape plus `workflow_connection` bindings rebuilt from `WorkflowCanvasState.edges`. Confirm stored lines follow moved/resized nodes, refresh/switch workflow rebuilds connections, delete source/target nodes removes connections, and binding changes still persist as `edges`.
- Retest right-output drag first because it is the baseline and was accidentally disturbed while experimenting with left-input dragging. Expected right-drag behavior: output handle appears only on hover/selection for output-capable nodes, dragging from it hides the source handle, temporary line is dashed/curved with two white endpoints and one endpoint following the mouse, input handles appear on valid empty image/video targets, releasing on a valid target creates one business edge, and invalid target/self/duplicate/cycle/type errors show black toast.
- Retest left-input drag separately. It should use the same dashed temporary visual as right-drag, but with the fixed end at the left input port and the mouse-following end seeking a source/output node. Dropping on a valid source should create the same direction business edge `source -> target`. If left-drag breaks right-drag visuals again, revert/disable left-drag and preserve right-drag first.
- Retest current connection styling. Final connection line endpoints should attach to node edges, not to visible handle circles. Normal line: `5px #6f7782`; hover: `10px #6f7788`; selected: `10px #454e5a`; tldraw blue selection indicator should be hidden. Transparent `28px` hit path should make hover easy. Center disconnect button should appear only on line hover/selection, fixed at the curve midpoint, black `100px` round button with horizontally flipped white scissors, and clicking it should remove both tldraw connection and business edge.
- Retest node port handles. Visible handle circles are only drag affordances: `60px` blue/white concentric circles, `10px` away from node, shown on node hover/selection, output handle disappears after dragging starts, and input handles show as targets while dragging. The short hover bridge should prevent the handle disappearing while moving the mouse from node to handle; port hit/absorb range is about `40px`.
- The production stale media error hotfix is deployed. Retest online with a media failure then successful retry: after success, no old `(B_xxx)` red text should remain below a success card. This was fixed only in conversation flow `src/components/chat-workbench.tsx`; workflow already cleared `error` on success.
- `B_246` root cause was BytePlus `InputTextSensitiveContentDetected` with no reference images, but the displayed message incorrectly said reference image/privacy. Add a later narrow mapping fix so BytePlus image `InputTextSensitiveContentDetected` maps to a prompt-text sensitive message, while reference-image/privacy messages remain only for input image/reference errors.
- `B_257` root cause was BytePlus generated-output audio moderation `OutputAudioSensitiveContentDetected` after successful video reference auto-review. Do not tell users it means they uploaded audio. If this recurs, advise removing `保留原音乐`, asking for no original audio, or disabling generated audio if available.

- Current newest local workflow changes after the deployed `B_254` hotfix are still uncommitted, unpushed, and not deployed. They include workflow upload-node multi-file/drag-drop/batch-focus, blank-canvas context-menu upload entry, and unfinished workflow connection/edge UI work in `src/components/workflow-tldraw-canvas-inner.tsx` and `src/components/chat-workbench.tsx`. Before any commit/deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`.
- Treat the current local workflow connection implementation as unfinished. User wants visible blue circular handles on node hover/selection, right-side output handles for content/result/upload nodes, left-side input handles for empty image/video nodes, drag-to-connect with a curved temporary line, and final connection visually matching the earlier handle-to-handle curved line. Current local code has partial tldraw native arrow integration and a temporary SVG drag line, but user said the latest result still does not match. Do not deploy this until browser-tested and accepted.
- Retest workflow upload-node multi-file behavior locally. Dock upload and canvas drag/drop should both accept multiple files, create one node per file, select the whole newly uploaded batch, and focus the viewport to all new nodes. Drag overlay copy should list the fixed upload-node rules: image `jpg/jpeg/png/webp <=5MB`, video `mp4/mov <=50MB 2-15s`, audio `mp3/wav <=15MB 2-15s`, text `.txt <=2000` chars. Blank-canvas right-click `上传文件` must use the same path as the dock upload.
- Production `B_254` hotfix is deployed but should be retested with a BytePlus Seedance request that includes a真人/隐私-triggering reference video or audio. Expected behavior: first `/api/video` returns `status="reviewing"` with `autoBytePlusAssetReview.triggered`, frontend retries with `autoBytePlusAssetReview=true`, backend creates BytePlus assets using `AssetType: Video` or `Audio` as needed, waits until Active, then retries generation with `asset://...` for all reviewed references. If it still fails, inspect `.runtime/video-diagnostics-log.jsonl` and `.runtime/generation-diagnostics-log.jsonl` by `requestId`.
- Do not redeploy broad local workflow/GPT changes just because `src/app/api/video/route.ts` was hotfixed. The only 2026-07-02 production deployment after this handover was the narrow `B_254` video/audio auto-review fix for `src/app/api/video/route.ts`.

- Current newest local changes are still uncommitted, unpushed, and not deployed. They include GPT image optimization follow-ups, admin `GPT生图优化` layout/hover preview changes, workflow failed-card responsive layout, workflow upload nodes, and `/api/media-assets` workflow upload metadata/category support. Before any commit/deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit` again.
- Retest admin `GPT生图优化`. Confirm cumulative attempt counting across multiple user-clicked retry rounds: first `AI改写重试3次` fails and second `AI改写重试3次` succeeds on first try should save/show `4 次`. Confirm the corrected local case for `12424740@qq.com / ID_779117` shows `4 次`. Confirm columns are `尝试次数 / 原提示词 / AI成功提示词 / 信息 / 缩略图`, table min width matches other admin tables (`1180px`), info contains media name/parameters/time/user/optimizer, and hover large image stays within browser bounds without covering the thumbnail.
- Retest workflow failed-card layout at different canvas zoom levels and node sizes. Full-size should show top-left failure title, middle retry or AI rewrite controls, and bottom red error. As the card shrinks, middle controls should disappear first, then red error, leaving only the top-left title without text overlap.
- Retest workflow upload nodes from the bottom dock `上传节点` button. Upload image/video/audio/txt should create an in-canvas semi-transparent uploading node with fixed-size progress bar/percent, then replace it with `上传图片`, `上传视频`, `上传音频`, or `上传文本`. Uploaded image/video should show true dimensions and resize proportionally like generated media; uploaded text should behave like the text node; uploaded audio should be `500x200`, text-node-style border/radius, and play through the native audio control.
- Retest upload-node validation. Images should allow only `jpg/jpeg/png/webp` and max `5MB`; text should be decoded correctly for UTF-8 and GBK/GB18030 Chinese TXT and block over `2000` characters; video should allow `mp4/mov`, max `50MB`, `2-15s`, and Seedance-style dimension/aspect/pixel rules; audio should allow `mp3/wav`, max `15MB`, `2-15s`. Video/audio upload progress is not continuous yet because the existing `/api/upload-file` call uses fetch rather than XHR.
- Retest upload-node persistence. Uploaded image should be written through `/api/media-assets` with `currentCategory="conversation_uploads"` and appear in asset library `上传图片`. Uploaded video/audio/txt should be written through `/api/media-assets` with `workflow_upload_videos`, `workflow_upload_audios`, and `workflow_upload_documents`, including `originalFileName`, `mimeType`, `fileSize`, workflow IDs, node ID, source prompt, dimensions/duration where applicable, and sourceDetail metadata, but should not appear in the upload-image asset category.

- Local first version of workflow `GPT-5.4 Image 2` safety rewrite retry is implemented but not deployed or committed. Test locally in workflow mode: create a `GPT-5.4 Image 2` image node with a person reference that triggers a safety/no-image failure, verify failed card keeps red text and shows `AI改写重试3次/5次/10次`, verify the node enters waiting state, attempts unique rewritten prompts, stops on first success, saves the successful prompt as the real image prompt, and records a row in admin `GPT生图优化`.
- Highest rule for this mini project: AI prompt rewriting must be minimal-patch editing, not broad prompt optimization. First attempt should change only a few words when possible, e.g. adding `穿日常连衣裙` to the original prompt. Preserve reference image face and clothing; do not replace the user's outfit, scene, action, or subject with a new safe version unless later attempts must gradually strengthen wording.
- Retest the stuck waiting-card fix. Previous local issue: after a failed attempt, `attemptedPrompts.push(...)` tried to mutate a frozen workflow array and threw `TypeError: Cannot add property 4, object is not extensible`, leaving the node at `97%生成中`. This was fixed with immutable array replacement and outer error handling.
- Local China testing may show OpenRouter `403 This model is not available in your region` and Windows curl `schannel` TLS fallback failures. Do not misdiagnose this as prompt failure. Production Malaysia should be tested before judging online behavior.
- Before deploying this mini project, stop local Node/Next processes if needed and run `npx prisma generate` again; it previously failed because `node_modules/.prisma/client/query_engine-windows.dll.node` was locked. The local DB migration `npx prisma migrate deploy` already applied `20260701043000_gpt_image_prompt_optimization_cases` successfully. Production deployment will need `npx prisma migrate deploy` before build/restart.
- Do not frame GPT Image optimization as bypassing safety review. Keep wording as compliant safety rewriting that may or may not succeed.
- See `handover/08-gpt-image-prompt-optimization.md` for the mini-project details and second-phase plan. Second phase should add automatic success-case analysis, rolling analysis storage, analytics/cost reporting, and later conversation-flow replication after workflow testing.

- Current local worktree has deployed but uncommitted upload/video-poll recovery changes in `src/app/api/asset-upload-temp/route.ts`, `src/app/api/upload-image/route.ts`, `src/components/chat-workbench.tsx`, and `src/components/workflow-tldraw-canvas-inner.tsx`, plus this handover update. Before any commit/GitHub sync/further deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`. Production workflow entry remains disabled.
- Retest the deployed upload reliability changes online. From `https://ali.venusface.com/workspace`, upload JPEGs that previously triggered `图片编码需要转码`; the first failure should auto retry with `forceReencode=1` and end as a ready upload without the user manually clicking retry. Also verify uploads use `https://api.venusface.com/api/asset-upload-temp` and CORS/token auth works.
- Retest video poll recovery online. Start a Seedance video, then refresh or briefly interrupt polling after the task id exists; the UI should keep the waiting card and eventually show the video. It should not show a failed card for transient network/502 errors. Failed cards should appear only for explicit provider failure/expired/completed-without-url or unrecoverable create-stage errors, and Bxx codes should be visible when the backend returns `errorCode`.
- The manually recovered video for `ID_636611` / conversation `bd20879c-44b4-4760-91a8-83c4b0441ce3` / message `fdb7d980-c06d-4ac9-af30-6473003d222e` should now show a video and poster after browser refresh. If it regresses, check `videoPosters` in `WorkspaceMessage.messageJson`, `MediaAsset.posterUrl`, and the public poster URL `/generated/users/ID_636611/video-posters/1782829256422-78469703-e341-4bd2-b59d-c7bcaf44ce0b.jpg` on both main and Ali.
- Latest 2026-06-30 full deploy is complete and should be treated as the current production baseline once the GitHub sync commit is present. It deployed all current local code including backend/admin/workflow code, but production workflow entry remains disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false. Do not enable workflow entry unless user explicitly asks.
- Highest browser test now: conversation video mode with `Seedance 2.0` and `Seedance 2.0 Fast`. Confirm the input toolbar shows `参考模式` only for those two models, default is `融合模式`, menu descriptions display fully, selecting other video models restores the old input width and hides the menu, and requests send the selected `referenceMode` rather than inferring from prompt text.
- Retest conversation Seedance upload behavior by selected mode. `融合模式` should allow image/video/audio according to rules; `首帧模式` should allow only one image and block sending without an image; `首尾帧模式` should allow only two images and block sending with fewer than two images; switching modes should update upload support/counts. Also confirm reference video/audio cards are hidden/rejected in first-frame and first-last-frame modes.
- Retest online BytePlus human-reference review after deployment with real online-accessible media. Local `B_162` was caused by BytePlus auto-review trying to download a local image through `main.venusface.com` where the object did not exist; this is expected to be local-only and must be rechecked online.
- Latest 2026-06-30 workflow/admin/backend work has been deployed as code, but production workflow mode remains disabled. It includes workflow upload validation parity, local 24-hour vs production 1-hour auth timeout split, editable admin upload rule overrides, backend upload-rule enforcement, BytePlus Seedance three-mode upload rules, workflow BytePlus video reference-mode menu, and workflow input-menu close behavior.
- Retest admin `上传规则` editable table locally. Confirm top editable table saves to `.env.local` `UPLOAD_RULE_OVERRIDES` through `/admin/api/upload-rules`, supported cells show count input plus switch, unsupported cells show `不支持`, GPT-5.4 Image 2 file stays unsupported, and the old lower table remains fallback/reference only.
- Retest upload-rule propagation after admin changes. After changing a count, refresh `/workspace` and verify conversation input, asset-generation input, and workflow input all show the new effective counts. Also verify `/api/chat`, `/api/image`, and `/api/video` reject over-limit requests according to the same admin override values.
- Retest BytePlus Seedance upload-rule rows. The admin table should show one shared `Seedance 2.0 / Fast` set split into `融合模式`, `首帧模式`, and `首尾帧模式`, rather than separate rows for Fast and non-Fast. Default/fallback image counts should be `9`, `1`, and `2` before overrides.
- Retest workflow BytePlus video reference-mode menu. For workflow video nodes using `byteplus:video.seedance-2-0` or `byteplus:video.seedance-2-0-fast`, the menu should appear before the send button with `融合模式 / 首帧模式 / 首尾帧模式`; for other video models it should not appear. `融合模式` should show image/video/audio uploads; `首帧模式` should show image only with max 1; `首尾帧模式` should show image only with max 2. Changing mode should immediately change upload button visibility/count labels, prune excess or unsupported uploads, remove pruned `@文件名` mentions, persist through workflow save/refresh, and send the selected mode as `/api/video` `referenceMode`.
- Retest workflow input-box menu close behavior. Open model/settings/duration/reference/mode menus, then click or focus another non-menu area inside the same prompt box such as the text editor or upload area; the menu should close. Clicking inside a menu should still allow the menu action to run.
- Retest workflow upload validation parity. Invalid video/audio duration, total duration, video dimensions/aspect ratio/pixels, uploading files, failed upload cards, unsupported formats, too many files, and audio-only video references should be blocked in workflow before generation with black toast/node error, matching conversation behavior.

- Latest 2026-06-29 local workflow UI iteration is uncommitted, unpushed, and not deployed. Files touched include `src/components/workflow-tldraw-canvas-inner.tsx`, `src/components/workflow-tldraw-canvas.tsx`, and `src/components/chat-workbench.tsx`, plus handover docs after this update. Production workflow mode must remain disabled. Before commit/deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`.
- Latest follow-up in this same 2026-06-29 local workflow session added prompt-box coordinate/bottom-dock fixes, upload-card polish, conversation-style workflow image upload retry/progress, external drag/drop overlay cleanup, reference-popup card insertion and ordering fixes, asset-library order stability fixes, and layer-panel selection/control sync. Browser retest these before any commit/deploy. `npx tsc --noEmit` passed after the changes.
- Retest workflow prompt-box placement: sidebar expanded/collapsed should not change the box's distance to canvas edges, left/right should clamp to the workflow canvas, bottom should stay 8px above the dock at all heights, the box should grow down when possible then up when dock-bound, and it should not jump above the selected node.
- Retest workflow uploads: image/video/audio/file cards should be `64x70`; audio/file use white/gray cards with larger icons; video upload cards show a center play indicator; remove `X` is black and outside the clipped card; removing a card removes its prompt mention; refresh should not show broken `blob:` thumbnails; image JPEGs needing re-encode should auto-retry; circular upload progress should match conversation mode.
- Retest model-aware upload behavior: upload buttons should show count ranges from upload rules; switching image/video models should remove unsupported current uploads and their mentions; video duration menu should show highest seconds at the top and lowest at the bottom.
- Retest external workflow drag/drop: dragging files from the OS into workflow should route to the outer upload path and the `在此处拖放文件` overlay must disappear on drop or drag end even if tldraw handles the drop.
- Retest reference popup and asset ordering: opening `@引用资产` from conversation or workflow must not reorder the asset library; moving/generated assets should remain newest-first; selecting a workflow reference image should add both an upload card and `@文件名`; ordering in the popup should match asset-library filter order for `角色图片 / 场景图片 / 分镜图片 / 上传图片`.
- Retest layer-panel selection sync: selecting a node on canvas should highlight the matching row in `画布上的节点`; clicking a row should select the canvas node; non-empty text rows should show lock/eye controls on hover and preserve locked/hidden behavior.
- Retest the latest workflow custom right-click menu. Empty canvas should show insert text/image/video, zoom in/out, show all nodes, paste, and select all only when valid; disabled actions should not appear. `T/I/V`, `Ctrl +`, `Ctrl -`, and `Shift 1` shortcuts should work outside input/editing contexts. Node menus should show `锁定/解锁` first. Empty nodes should not show export/download. Non-empty text nodes should show copy text/download. Generated image nodes should show `使用提示词`, `导出 > SVG/PNG/JPG`, and download. Generated video nodes should show `使用提示词`, `导出 > 首帧/尾帧/当前帧`, and download.
- Retest workflow `使用提示词`: for generated image/video nodes it should create a new same-kind node near the source and preserve prompt text, `@` mentions, uploads, model, ratio, resolution, and video duration, but not generated media/result state, lock state, hidden state, errors, dimensions, or visual size.
- Retest the updated workflow `图层` panel. It should close only through the top-right `X`, not outside clicks. The `历史记录`/`画布上的节点` divider should drag smoothly in real time and leave no white gap; the visible line should be the boundary. Section headers and rows should match styling and indentation. Historical rows should use the three-dot menu with `恢复进画布` and red `删除`.
- Retest workflow history delete semantics. Deleting historical text should remove only that history item from `historicalTextNodes`; generated image/video history delete should call `/api/media-assets` soft delete and move the item into the normal recycle-bin behavior. No workflow history delete should physically delete files or DB rows. Duplicate historical text content should collapse to one entry after normalization/save.
- Retest layer row lock/hide controls. Non-empty text and generated image/video rows should show lock/eye controls only on row hover unless locked/hidden. Locked rows show only lock/unlock; hidden rows show only show/hide. Lock should use tldraw locked shape behavior and persist through refresh. Hide should use tldraw `getShapeVisibility`, keep the row visible in the layer panel, hide the canvas shape, and persist through refresh.
- Retest first workflow entry sidebar behavior. In a fresh login/session, the first switch to workflow should force the left sidebar visible and collapsed. If the user expands/collapses after that, later workflow entries in the same login should respect that choice. Logout should clear the marker so the next login's first workflow entry collapses again.
- Retest workflow prompt box boundary handling with long text. The selected image/video node input box should stay within the browser, avoid the bottom dock with about 8px visual gap, not show an outer panel scrollbar, and allow only the central prompt editor to scroll. The workflow black toast should appear for `最多输入2000字` and upload/type/limit messages instead of inline red text.
- Latest 2026-06-29 workflow right-click work replaced tldraw default `DefaultContextMenu` with a workflow-owned `180px` custom context menu because the default Radix/tldraw menu failed to reopen after blank-click close with complex HTML workflow nodes. A remount workaround was tried and rejected because it caused visible canvas lag. The final code uses `ContextMenu: null`, workflow shell `onContextMenu`, `WorkflowCustomContextMenu`, `data-workflow-node-id`, tldraw `useActions()`, direct editor APIs for delete/select-all/download, and keeps `rightClickPanning: false`. This source-code work was committed and pushed to GitHub as `0f4c97c Implement workflow canvas updates and diagnostics`, but it has not been deployed to production.
- Latest 2026-06-29 workflow snapping work enabled tldraw default snapping/reference lines with `editor.user.updateUserPreferences({ isSnapMode: true })`. Retest dragging workflow nodes for bounds/center snap lines. No custom snap geometry was added. This source-code work is included in `0f4c97c` and is not deployed to production.
- Specifically retest the new custom workflow context menu: right-click text/image/video nodes and blank canvas repeatedly; blank-click close should be immediate and should not break the next right-click; no browser native menu should overlap; menu width should be about `180px`; node right-click should select that node; cut/copy/paste/duplicate/delete/layer order/copy SVG/copy PNG/export SVG/export PNG/download/select all should work; copied/pasted/deleted/reordered workflow nodes should persist after refresh through existing `editor.sideEffects` sync. Do not reintroduce tldraw `DefaultContextMenu` for workflow unless the underlying conflict is fully solved.
- Latest 2026-06-29 workflow fixes are included in pushed source-code commit `0f4c97c` and are not deployed to production. They disable tldraw multi-page `移动到页面 / 新页面`, repair local `ID_779117 / 工作流_04`, add fast text-node persistence, add non-empty text disappearance history fallback, fix video disabled cursor, normalize restored image ratios, and improve workflow media metadata persistence including video `loadedmetadata` backfill. Production workflow mode must remain disabled. Before any future deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`.
- Current local `工作流_04` state to preserve: `WorkspaceWorkflow` row id `cmqutwz2b03r9w6q8lw94v1t4`, workflow id `7677e646-d066-43a8-8de9-78e2006965c9`, code `w4`; nodes include `image_1_w4` node `workflow_node_df3c4dea-c1fc-44e1-b1ee-6bdaea15a744`, `video_1_w4` node `workflow_node_f1eeb05c-6876-4e88-9343-7ff257b40474`, and text node `workflow_node_ef89108c-9916-4454-967a-6b6be641fd7f`. `image_1_w4` should have `ratio=16:9`, `resolution=2K`, dimensions `2848x1600`. `video_1_w4` currently has generation parameters but may still need browser-loaded true `width/height/durationSeconds` backfill.
- Latest 2026-06-28/29 workflow layer/history/right-click fixes are included in pushed source-code commit `0f4c97c` and are not deployed to production. They add real workflow asset loading through `GET /api/media-assets?workflowId=...`, rework the `图层` panel, add history restore, layer drag-reorder, and replace the fragile default right-click menu with the custom workflow menu. Production workflow mode must remain disabled.
- Latest 2026-06-28 production diagnostics/upload work has been deployed through narrow file uploads. Do not assume the local worktree equals production, because local workflow/tldraw changes from 2026-06-26/27 remain dirty and were intentionally not broadly deployed. If future production fixes are needed before committing, either patch only the necessary files or first reconcile local-vs-production diffs carefully.
- Latest 2026-06-28 local workflow work changed text nodes into pure `文本输入` nodes and added workflow media resizing, export, right-click-menu sync, and context-menu download. This work is local-only, uncommitted, unpushed, and not deployed. Production workflow mode must remain disabled. Before any commit/deploy, inspect `git status --short`, `git diff`, `git log --oneline -10`, and run `npx tsc --noEmit`.
- When diagnosing future image/video generation failures such as `B_###`, first check PM2 error logs for `[B_###]`, then `.runtime/generation-diagnostics-log.jsonl` by `requestId`, then `WorkspaceMessage.messageJson` if the error persisted to a message. Use the new generation log to distinguish app route failure, OpenRouter/BytePlus HTTP non-2xx, fetch/timeout, empty provider response, media-save/download failure, and Ali sync failure.
- When diagnosing future conversation image upload failures, check `.runtime/upload-diagnostics-log.jsonl` and Nginx access logs together. `temporary-upload-jpeg-needs-reencode` means the first attempt rejected a JPEG that needs `forceReencode`; `upload-image-reencode-failed` indicates ffmpeg/server conversion failure; Nginx `408` means request timeout; Nginx `499` means client closed/aborted before the app finished; a logged `asset-upload-temp-post-success` means the app upload itself succeeded even if the user later removed/retried.
- Current conversation-flow image upload UX: upload progress can sit at 95 while waiting for server response; XHR timeout is 90 seconds. If timeout happens, the card white overlay shows `上传超时`. Other upload failures still show `上传失败` on the card. Detailed reason is in client/server diagnostics.
- Latest check for `12424740@qq.com / ID_636611`: `2026-06-28T09:13:39Z` failure for `微信图片_20260621163713_225_428.jpg` was JPEG re-encode-needed, not network. A later Nginx-only `408` at local time `17:15:05` for the same user/session area was upload timeout/network and did not enter app logging.
- Local workflow/tldraw work has now been committed and pushed to GitHub in commit `1c9211d Sync local workflow updates and repo rename`, but it has still not been deployed to production. Do not deploy this tldraw workflow work to production yet. Before any future commit, deploy, or GitHub sync, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit`.
- Local root cleanup is complete: the smaller copied `FlashMuse_Agent` folder was deleted, the original `AI-Video-Assistant` folder was renamed to `FlashMuse_Agent`, `.runtime/` was preserved, and `npx tsc --noEmit` passed after the rename.
- The 2026-06-24 workflow/input-scroll work has been deployed with production workflow entry still disabled. Later local-only tldraw work has not been deployed. Important workflow files now include `src/components/workflow-tldraw-canvas.tsx`, `src/components/workflow-tldraw-canvas-inner.tsx`, `src/components/workflow-tldraw-minimal-canvas.tsx`, `src/app/dev/tldraw-test/`, `open-tldraw-test.bat`, `src/components/chat-workbench.tsx`, `src/lib/workspace-workflows.ts`, `src/app/api/media-assets/route.ts`, `src/app/api/workspace-state/route.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json`, and `package-lock.json`.
- Latest 2026-06-25 local-only changes added workflow real-size nodes, square card styling, selected-node overlay outside the shape body, mutually exclusive input menus, default image/video settings, non-overlap node creation near the last operated node, dock icon clarity fixes, 1% minimum zoom, text-node native resizing, node geometry persistence, and continued video-node playback experiments. These are now GitHub-synced in `1c9211d` but still not deployed to production.
- Latest 2026-06-26 and 2026-06-27 local-only workflow changes after `1c9211d` are not committed, not pushed, and not deployed. They include workflow credit display fixes, workflow usage reload from `CreditLedger`, contenteditable prompt editor, workflow `@` asset popup/loading/caret fixes, upload card UI/progress/type filtering, text-node `md/txt/csv` document reading, old workflow text-node backend model-control/formatted-output work, and tldraw text-selection experiments. The newest 2026-06-28 local work supersedes the old text-generation node behavior: text nodes are now text-input boxes, not Agent text-generation nodes. Before any commit/deploy, inspect `git status --short`, `git diff`, and `git log --oneline -10`, then run `npx tsc --noEmit` again.
- Latest follow-up in the same 2026-06-25 local session fixed workflow video native controls using tldraw official clickable-shape guidance. If tldraw custom-shape interactions break again, check `https://tldraw.dev/` first, especially `Clickable custom shape`: use `pointer-events: all`, stop event propagation on interactive children, and use `editor.markEventAsHandled()` if canvas pointer handling still interferes.
- Continue workflow tldraw integration carefully. Current stable path uses `<Tldraw hideUi shapeUtils={[WorkflowNodeShapeUtil]}>` with client-only dynamic import. Do not reintroduce full `editor.store.listen -> onChange -> ChatWorkbench/workspace autosave` syncing; it previously froze the browser. Current allowed persistence is limited to explicit business changes plus lightweight geometry sync for `nodes[].x/y` and text-node `data.visualSize`; do not save camera/viewport unless the user explicitly reopens that decision.
- Browser-test the current tldraw workflow UI after each change: open `/workspace`, switch to workflow, verify no freeze, add text/image/video nodes, confirm default image is `Seedream 4.5 / 16:9 / 2K` and default video is `Seedance 2.0 / 16:9 / 720p / 8秒`, drag nodes and confirm position persists after switching/refreshing, resize text nodes and confirm `visualSize` persists, select/delete selected nodes with `Delete/Backspace`, switch between workflows and confirm canvas content changes and auto-focuses all nodes, edit input, open model/settings/duration menus and confirm only one menu opens at a time, open left-bottom background/layers/minimap/zoom popovers, generate one image, generate one video and confirm native video controls are clickable, and confirm the bottom dock focus button zooms to selected node(s) when selected and all nodes when nothing is selected.
- Specifically retest the newest `文本输入` workflow node behavior: default size `720x480`, title `文本输入（双击进入编辑模式）`, `RiTextBlock` icon in header and bottom toolbar, white rounded card with `5px #b8b8b8` border, persistent internal scrollbar only when overflow exists, single click/drag moves node, double-click enters editing and focuses/zooms the node, typing/paste/delete/select/copy work, Escape/canvas click exits editing, refresh preserves text and size, and connected image/video nodes read the text as upstream prompt.
- Specifically retest workflow text persistence: type into a text node, wait at least 250ms, query/reload and confirm `WorkspaceWorkflow.canvasJson.nodes[].data.text` and `data.prompt` contain the text before deletion. Then delete a non-empty text node and confirm it appears in `canvasJson.historicalTextNodes` / history panel; empty text nodes should not.
- Retest generated image/video node resizing: before generation they should not resize; after generation they should resize proportionally only, max at real/natural size, min at longest edge `256px`, top-right size label should update live during resize, refresh should preserve `visualSize`, and regeneration should clear old `visualSize`.
- Retest workflow video behavior: node video controls remain clickable, playback does not loop, local saved videos record `videoCurrentTime`, remote temporary video export uses poster only, and local `/generated/...` video export uses the recorded current frame with fallback to poster/placeholders.
- Retest workflow media metadata persistence after a new generation and after restoring from history. Image nodes should keep generation parameter `ratio` as a supported option like `16:9`, with actual pixels in `imageDimensions` / `visualSize`. Video nodes should save generation parameters plus `videoDimensions` and `durationSeconds` after browser metadata loads; `/api/media-assets` should persist `width`, `height`, and `durationSeconds` where available without renaming the existing URL to a new `video_N_wX`.
- Retest workflow custom context-menu behavior repeatedly. It should open every time, not only once. Test actions: cut/copy/paste/delete/duplicate, bring forward/backward, send to front/back, export/copy PNG/SVG, custom `下载`, and select all. Confirm copied/pasted workflow nodes get unique internal node IDs and refresh persists right-click changes. Do not reintroduce full `editor.store.listen` autosave; use narrow `editor.sideEffects` handlers.
- Specifically retest the latest custom context-menu fix: right-click image, video, text nodes, and blank canvas repeatedly; blank-click close must be instant; confirm `下载` exists and works; confirm `flatten-to-image` / `展平` and `移动到页面` / `新页面` are not present; confirm right-click still works after clicking native video controls; confirm video hover cursor is normal and not disabled.
- Specifically retest tldraw page/menu safety: right-click workflow nodes and confirm `移动到页面` / `新页面` no longer appears. Workflow `Tldraw` should stay `maxPages: 1`; do not re-enable tldraw multi-page actions.
- Retest workflow export/download: text/input nodes export non-empty SVG/PNG and download `.txt`; image nodes export visible images and download source files; video nodes export poster/current local frame according to URL state and download source video. If image/video export is still empty, inspect `WorkflowNodeShapeUtil.toSvg()` data URL conversion and browser CORS behavior.
- Retest the latest `图层` panel. `历史记录` should collapse/expand; collapsed history should let `画布上的节点` move up. Empty history shows three small node icons, `暂无历史记录`, and `删除后的节点在这里`. `画布上的节点` uses `RiNodeTree`, lists topmost canvas layer first, shows empty nodes as icon + small label, shows text-node content with ellipsis when present, and replaces generated image/video nodes with thumbnail + file name. Clicking any row selects the node; double-clicking focuses it.
- Retest workflow history rules. Deleting empty text/image/video nodes should not add history. Deleting generated image/video nodes should put them in `历史记录` after current workflow assets load, including after refresh. Deleting non-empty text nodes should add them to `WorkflowCanvasState.historicalTextNodes`; empty text nodes should not. `移入` should restore text/image/video history entries to the canvas, and image/video history entries should also restore when dragged to the canvas.
- Retest workflow layer drag-reorder. Drag rows in `画布上的节点`; a black horizontal line should show exact insertion position. Dropping should update real tldraw z-order via built-in `bringToFront`, and after refresh the list and canvas layer order should stay consistent.
- Specifically retest the latest workflow input work before continuing: type normal text and select text with the mouse when blue `@资产名` already exists; manually type `@` and confirm the reference popup opens and filters without turning arbitrary text blue; click an asset and confirm it replaces the typed `@query` and the popup closes; click elsewhere after a mention and confirm the cursor stays where clicked; refresh and confirm existing real `@资产名` mentions render blue after reference assets load, without visible one-by-one recoloring; verify long text scroll only follows bottom if already at bottom; verify `Enter` sends and `Shift+Enter` inserts newline.
- Retest workflow upload chips/cards: upload buttons should only appear for actually supported kinds by current node/model/mode. Text nodes should show image and readable file (`md/txt/csv`) support. Image nodes should show image only. BytePlus Seedance video nodes should show image/video/audio only in `融合模式`; `首帧模式` and `首尾帧模式` should show image only. Unsupported models/modes should hide unsupported buttons. File choosers should filter to supported extensions/MIME types. Image uploads use `/api/asset-upload-temp`; video/audio uploads use `/api/upload-file`; text-node readable files use client `FileReader` text extraction rather than provider file upload. Uploaded cards should appear above the prompt with image/video thumbnails, black gradient `@文件名`, audio/file icons, progress bars, top-right remove `X`, click-to-insert `@文件名`, error state, and persistence through workflow save/refresh via `WorkflowNodeData.uploads`.
- Old workflow text-generation node model-menu/document-output tests are superseded by the 2026-06-28 text-input decision unless the user explicitly asks to restore AI text-generation nodes. Text input nodes no longer call `/api/chat`, have no model menu, and do not read `md/txt/csv` documents as uploads.
- Keep `/dev/tldraw-test` and `open-tldraw-test.bat` as diagnostics. `/dev/tldraw-test` is a default tldraw UI page with no workspace coupling; if it freezes, the issue is tldraw/Next/Turbopack/environment. If it is smooth but workflow freezes, the issue is our custom shape/state integration.
- Remember tldraw production licensing. `tldraw@5.1.1` works locally without a key, but production/commercial use requires a valid tldraw license key. Do not open production workflow mode with tldraw until licensing and build behavior are resolved.
- Browser-retest the deployed conversation input box: with long text, scroll upward inside the input, then type, paste, press `Shift+Enter`, delete `@` spans, and insert `@` assets. The view and caret should stay near the user's current scroll area; only bottom-position typing should auto-follow the bottom.
- Retest local workflow generation end-to-end before any deploy: create multiple image nodes in the same workflow, generate from each, verify each node keeps its own result, names increment independently (`image_1_w2`, `image_2_w2`, etc.), failures do not consume numbers, refresh preserves node names/dimensions, and right-side preview thumbnails show only current workflow canvas media.
- Retest workflow remote-to-local media replacement: temporary provider URL should display immediately; when saved local `/generated/...` appears, node `images/videoUrl`, node `mediaSystemNames`, node dimensions/poster, preview asset, and `MediaAsset + UserAssetState` should all remain consistent and should not overwrite system names with `图片生成` / `视频生成`.
- Local data for `12424740@qq.com / ID_779117` was manually repaired during workflow debugging. If results look inconsistent, query `WorkspaceWorkflow.workflowCode in ('w1','w2')`, `canvasJson.nodes[].data.mediaSystemNames`, and `UserAssetState + MediaAsset` workflow rows before making more code changes.
- Hydration warning can still appear when SSR renders chat mode but stored client UI starts in workflow mode. It is recoverable, but future cleanup should make initial client render match SSR or delay active-panel restoration until after hydration.
- If local homepage flashes after folder/cache changes, check `start-project.log` for Turbopack `Failed to write app endpoint /page` and `Next.js package not found`. The known fix is to stop local project Node processes, delete generated `.next`, and restart dev; this fixed the 2026-06-26 post-rename issue.

- Admin navigation split, server-info, workflow foundation code, workflow table persistence, new-table-only asset work, admin idle-timeout, and Agent prompt-detail persistence were deployed on 2026-06-23. Production workflow entry remains disabled because `NEXT_PUBLIC_WORKFLOW_MODE_ENABLED` is unset/false.
- Test `服务器信息` with an authenticated production admin browser session. Local Windows Node can fail to SSH to Malaysia even when manual PowerShell SSH works; production is the intended environment because the Malaysia app can read itself and jump to Ali with `/root/.ssh/flashmuse_to_ali_ed25519`.
- Retest deployed auth idle behavior in production: user action extends session; no action expires after 1 hour even if browser is closed; routine auth/workspace polling does not extend it; active generation keepalive prevents logout during long waits.
- Stabilize and verify the new media table flow end-to-end.
- Confirm asset library category loading, pagination, moving, rename, delete, restore, and `@` reference behavior.
- Specifically retest `上传图片`: asset-library upload, conversation upload, moving generated images into upload category, reference images from `imageReferences`, thumbnail fallback, count/grid consistency, same-origin temporary upload, and fallback upload of unusual JPEG files.
- Retest admin expansion UX on the real heavy account: user management, credits management, generation records, category switching cache, and on-demand dialogs.
- If future BytePlus video errors say `output audio may contain sensitive information`, treat them as generated-output audio moderation failures, not proof that the user uploaded audio. Check `.runtime/video-diagnostics-log.jsonl` `references[]` for `reference_audio` before saying audio was uploaded. Current user-facing text should be `生成结果中的音频可能触发平台敏感内容审核，平台拒绝输出。请调整提示词后重试。`
- Confirm runtime remote/local duplicate canonicalization after new image and video generations.
- Retest the core media chain for both image and video: temporary provider URL displays immediately, preview opens, download button works on the temporary URL, local `/generated/...` save completes, chat/preview/download/assets replace to the local URL, and `MediaAsset.url` stores only the local URL.
- Retest the same remote-to-local replacement after refresh/reopen. If a browser saved a temporary URL before replacement, `/api/media-save-status` should still find the saved job and replace/persist the local URL later.
- When workflow mode is eventually enabled, retest workflow node image/video URLs specifically. Workflow node `images` and `videoUrl` are now included in the same media-save-status polling/replacement path and should persist as `workflow_images` / `workflow_videos`.
- Retest workflow basics locally or in a controlled production session only after workflow entry is explicitly enabled: default `新工作流`, new-workflow reuse, first action renaming to `工作流_01`, non-reuse of deleted numbers, delete-last-workflow fallback, 10-item list limit and 5-item load-more, rename/delete/pin behavior, and persistence after refresh.
- Retest workflow node UI and generation: current tldraw/Lovart-style UI has pure `#cccccc` default background, top-left sidebar toggle + workflow title, bottom dock with text/image/video/zoom/focus controls plus select/hand on the far right, left-bottom background/layers/minimap/zoom controls, no node shadows, and no left/right `+` ports. Nodes are real-size canvas cards; selected-node title/parameters sit above the card; input appears below only before generation. Text/image/video node input should still match conversation generation behavior, menus should remain usable, model menus should show icons, and image/video model lists should honor `/api/model-availability` backend switches.
- Workflow focus control rule: the bottom dock focus icon zooms selected workflow node(s) if any are selected, otherwise all nodes. The left-bottom zoom menu `显示画布所有元素` should continue to zoom all nodes regardless of selection.
- Retest workflow generation chain: text node `/api/chat`, image node `/api/image`, video node `/api/video` create/poll, usage counter update, waiting/failure/success cards, reference text/images from upstream nodes, workflow asset persistence, and remote-to-local replacement.
- Retest workflow reference generation after the latest input work: text nodes should send uploaded/mentioned images through `/api/chat messages[].images`; image nodes should send upstream images plus `@`/uploaded images as `/api/image referenceImages`; video nodes should send upstream images plus `@`/uploaded images as `referenceImages`, uploaded videos as `referenceVideos`, and uploaded audios as `referenceAudios`. Audio-only video requests should still block with the existing API error unless paired with image/video reference.
- Retest deployed login idle behavior: user action extends session; no action expires after 1 hour even if browser is closed; routine auth/workspace polling does not extend it; active generation keepalive prevents logout during long waits.
- Retest BytePlus Seedance 2.0 / Fast video mode with uploaded reference video and audio: fresh send, replay/regenerate, failed-card retry, audio-only blocking, duration tolerance around 15s, input-card `@` insertion, sent prompt inline icons, and preview playback.
- Retest BytePlus automatic human-reference review UI. Each new image review should show the blue system notice once per request, even if the same conversation had previous review notices.
- Retest `video_5_d24` scenario by regenerating a new video with a reference image, `abbbbbb.mp4`-style reference video, and `demo_chinese.mp3`-style audio. Old `video_5_d24` was already generated without video/audio references and cannot be fixed retroactively.
- Latest deployed changes still include the 2026-06-24 workflow/input-scroll deploy and the 2026-06-26 narrow `src/lib/error-message.ts` production deploy. Later tldraw workflow work is committed to GitHub but not deployed. If future deployed local changes accumulate and the user asks for GitHub sync, inspect status/diff/log, run `npx tsc --noEmit`, then commit and push.
- Before any future commit or GitHub sync, remember the repository-level Git identity is already set locally to `lookxun <lookxun@users.noreply.github.com>`. Push still requires valid GitHub credentials; GitHub CLI `gh` is not installed on this machine.
- Retest local workflow persistence after browser refresh with `12424740@qq.com` and `lookxun@163.com`. Expected local data: `12424740@qq.com / ID_779117` has `工作流_01` and `工作流_02`; `lookxun@163.com / ID_113219` has `工作流_06` and `工作流_04`.
- Retest production asset library with authenticated real accounts after the new-table-only deploy. Latest snapshot says visible asset counts stayed unchanged and `fallbackUsers=0`, but browser-level category actions still need human validation.
- Retest upload-file paths: uploaded video should write `sourcePrompt="上传视频"`, uploaded audio should write `sourcePrompt="上传音频"`, and uploaded document should write `sourcePrompt="上传文档"` into `MediaAsset + UserAssetState`. These categories are internal for now and not shown in the asset sidebar yet.
- Retest Agent-generated image/video prompt display in admin. Main prompts should be black; Agent hard constraints from `MediaAsset.sourceDetail.agentConstraints` should be gray; multi-image/multi-video prompt-to-asset mapping should not be mixed.

## Specific Checks To Run When Needed

- `npx tsc --noEmit`.
- `npx prisma generate` after applying local migrations or after stopping `next dev` if Prisma engine files are locked on Windows.
- `node scripts/audit-visible-duplicate-media.mjs --user=USER_ID`.
- `node scripts/audit-user-media-cost-gaps.mjs --user=USER_ID`.
- Open production `/workspace` and test asset library actions with a real user account.
- Check PM2 logs and `.runtime/video-diagnostics-log.jsonl` for BytePlus video issues.
- When diagnosing Seedance reference media, check both `WorkspaceMessage.messageJson.uploadedFiles` and `.runtime/video-diagnostics-log.jsonl`; before the replay fix, diagnostics showed only `reference_image` even though the message had uploaded video/audio files.
- Check `.runtime/media-save-jobs.json` when remote/local media duplication appears.
- Check `.runtime/media-url-map.md` when diagnosing a generated item that displayed with a temporary URL but should have replaced to `/generated/...`. Do not commit or paste signed remote URLs from this runtime file into docs.
- For deployment safety, run `node .runtime/deploy-checks/prod-deploy-snapshot.mjs snapshot LABEL` and compare pre/post snapshots. Current baseline files are `20260623-before-risk-deploy.json`, `20260623-after-risk-deploy.json`, and `20260623-after-hotfix.json`.
- Check Nginx access/error logs for upload failures. `413` means body size/config issue; current intended limit is `20m`.
- For upload failures, also check PM2 logs for `[client-error]` entries with `source="client-diagnostic"`. User-facing upload cards intentionally show only generic `上传失败`.

## Known Follow-Ups

- Static domain public access and Ali certificate automation were completed on 2026-06-26. If this regresses, check Ali Nginx `/etc/nginx/sites-available/flashmuse-static-ip`, ACME webroot `/var/www/letsencrypt`, certbot renewal config `flashmuse-ali-static`, and renewal hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`.
- GitHub repository rename is complete. If clone instructions or remotes regress, use `https://github.com/lookxun/FlashMuse_Agent.git`.
- Keep production workflow mode disabled until user explicitly approves opening it.
- If input `@` editing bugs resurface, consider whether the contenteditable mention implementation needs a focused refactor.
- Do not remove `src/app/dev/tldraw-test/` or `open-tldraw-test.bat` until tldraw workflow integration is stable; they are the current minimal tldraw baseline.
- Before production deploy with tldraw, resolve `npm run build` reliability. Earlier local build failed due Google Geist font/Turbopack internal font resolution while `npx tsc --noEmit` passed.
- Before any production workflow rollout, resolve tldraw licensing. The local workflow canvas currently hides the tldraw watermark for internal testing, but this is not a substitute for a production/commercial license decision.
- Upload-rule table is now deployed as standalone backend tab `上传规则` via `src/app/admin/admin-upload-rules-panel.tsx`. Keep it synchronized with `src/lib/upload-rules.ts` when upload limits change.
- Memo tasks are in `handover/06-memo-tasks.md`; update that file, not historical docs, when the user says something is a deferred memo task.

## Avoid

- Do not run broad migrations without dry-run and logs.
- Do not use old handover docs as current truth without checking against code/server state.
- Do not hard-delete generated media or database records under current product rules.
- Do not expose `.env`, API keys, server passwords, SMTP credentials, or private keys in docs or commits.
