# Next Actions（2026-07-21 重建）

> 历史 END-OF-SESSION 记录都在 `historical-handover-docs-last-used-2026-07-21/05-next-actions.md`（很长）。这里只留当前有效待办。

## 当前状态

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.48`（commit `389ad87`，2026-07-28 第九次会话）。无待部署、无未推。**

- 第九次会话：参考素材 url 归一化根治（新增 `src/lib/reference-asset-url.ts`，8 处接入）。无 Prisma 迁移。正式服备份 `20260728-030655-presync-v48`。
- **v47 那批的实机回归已补做完并全过**（对话流生图/生视频带参考图、工作流快捷编辑、401 跳首页 + 不记事件）。
- 归档现状：测试服剩 **36** 待排查、正式服剩 **308** 待排查（缩略图那条规则命中 0，原因见下）。

### ⭐⭐ 一条必须记住的教训（第九次会话踩到）

**从日志 `grep -c` 数出来的条数 ≠ 待排查的失败事件数。** 「平台拉缩略图超时 18 条」实际是**同一个 requestId 的 18 行日志**，该请求最终 `image-route-success`、GenerationEvent 的 `status = success` → 后台「失败原因」里根本不占位。**以后拿到日志计数必须回 DB 按 requestId 核对 `status`。**

## ⚠️ 仍待做：v46 那批的实机点测（v47 已验完）

**本次会话改动的文件清单**（`git status` 里未提交的那些）：
- 新增：`src/lib/session-expired-redirect.ts`、`src/lib/video-reference-image-rules.ts`、`scripts/archive-resolved-generation-failures.mjs`、`handover/07-red-error-triage-and-archive.md`、`prisma/migrations/20260727154203_generation_event_resolved/`
- 修改：`src/lib/error-message.ts`、`src/lib/transient-error.ts`、`src/lib/credits.ts`、`src/lib/openrouter-video.ts`、`src/lib/admin-overview.ts`、`src/app/admin/admin-overview-2.tsx`、`src/app/api/{image,video,chat,agent-plan,conversation-memory}/route.ts`、`src/app/api/workflow-prompt-optimization/rewrite/route.ts`、`src/components/chat-workbench.tsx`、`src/components/workflow-tldraw-canvas-inner.tsx`、`prisma/schema.prisma`、`AGENTS.md` + handover 文档

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
