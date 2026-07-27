# Architecture And Data（2026-07-21 重建）

> 详细历史在 `historical-handover-docs-last-used-2026-07-21/02-architecture-and-data.md`。这里保留仍有效的核心。

## 数据表（核心）

- `User`：账号、积分、登录审计。`Session`：登录会话 + 活动 workspace 实例。
- `CreditLedger`：计费记录（text/image/video/prompt 工具 + 媒体成本 metadata）=**计费唯一来源**。
- `WorkspaceSession`（一行=一个对话）+ `WorkspaceMessage`（一行=一条消息，分页/媒体提取用）=对话结构来源。
- `WorkspaceWorkflow`（一行=一个工作流，`canvasJson` 大字段存整张画布 + `workflowCode`/`nextImageNumber`/`nextVideoNumber`）=工作流历史来源。
- `MediaAsset`：**媒体固定事实**（url、归一化 url、类型、来源、prompt、model、尺寸、poster、成本、conversation/message/workflow id、`contentHash`、`durationSeconds`(Float)、archive 状态）。
- `UserAssetState`：**每用户可变状态**（当前名、分类、排序、软删、hidden、BytePlus 审核态）。
- `GenerationJob`：生成任务（worker 驱动真正生成/挑图/扣费/落库），存 `referenceImages`/`referenceNames`/`extraJson.cleanPrompt` 等。
- `UserWorkspaceState`：仅存 shell 字段（`activeWorkflowId`/`nextWorkflowNumber` 等），**`state.assets` 不再是权威来源**。
- `GptImagePromptOptimizationCase`：GPT 生图安全改写成功案例（见归档 08）。
- `GenerationEvent`：**每次生成的埋点事件**（kind/source/model/provider/status/`failureReason`/`failureCode`/moderation/durationMs/参考素材数量）= 后台运营概览的数据源。⭐ 2026-07-27 新增 `resolvedAt` + `resolvedNote`：**失败原因「已归档」标记**（根因查清并修掉后打上，后台把那条原因划掉且不再计入待排查数量）。归档流程见 `07-red-error-triage-and-archive.md`。⚠️ **`failureReason` 存的是给用户看的文案，不是根因**（"服务器繁忙"是兜底），真实原因只在 `.runtime/*-diagnostics-log.jsonl`。
- `UploadEvent`：上传埋点（status/reason/bytes）。

**数据权威**：媒体固定事实→`MediaAsset`；用户可变状态→`UserAssetState`；对话→`WorkspaceSession+Message`；计费→`CreditLedger`。新生成/上传媒体统一走 `src/lib/media-asset-record.ts`（`buildMediaAssetRecord`/`classifyAsset`）入库；出生即冻结，之后只有改名/移动/删除（只写 `UserAssetState`）。

## 核心媒体生成链路（图/视频统一，工作流复用同一套）

- 生成由服务端 `GenerationJob` worker 唯一权威 finalize 出生；provider 临时 URL 可先给前端显示提速，但**绝不能存进 `MediaAsset.url`**。
- 后台存盘（`.runtime/media-save-jobs.json` 跟踪）；存好后前端轮询 `/api/media-save-status` 把临时 URL 换成本地 `/generated/...`。
- **图片存盘不丢改造**（`runImageJob`）：本地没存好就把交付快照重排队等到存好再落库（扣费幂等、只 finalize 扣一次），不再回退远程 url → 国内跨境慢也不丢库。
- ⭐ **视频交付 = 乐观显示 + 只本地落库（2026-07-27）**：`runVideoJob` 火山出片后把**可直接播的远程地址**（非 OpenRouter 需密钥）写进 `GenerationJob.extraJson.preview.videoUrl`（写一次）、job 保持 `running`；`/api/generation-status` 透传 `extra` 给前端。前端见 running+preview 就**先用远程地址展示**（对话流 `Message.videoPreviewUrls` 展示专用/不进 videos·资产库；工作流 `node.data.videoPreviewUrl`），左上角"资产保存中..."角标；本地存好后 job 转 succeeded、前端换成本地 url、角标变"✓保存成功"(2s 后 1s 渐隐；`videoSavedFlashAt`)。**资产库永远只写本地 url + 全参数**。⚠️ 已知：存盘快的视频（seedance-mini）"保存中"窗口短，会被前端 30s 慢轮询跳过而直接显示"保存成功"（见 05-next-actions 遗留项）。
- ⭐ **下载/存盘四层防假死（2026-07-27，`saveRemoteAsset`/`media-save-queue.ts`/`video-poster.ts`）**：① `REMOTE_DOWNLOAD_TIMEOUT_MS=3min` 单次下载超时（AbortController，含 curl 兜底 `--max-time`）；② ffmpeg 封面/探测 `timeout:60_000`；③ `inFlight` 改 `Map<id,上锁时刻>`，持锁超 `STALE_DOWNLOADING_MS`(8min) 视为假死可强夺重跑，`enqueueRemoteAssetSave` 也会踢 stale 的 downloading；④ 远程 24h 过期判失败。根治了"跨境下载 fetch 无超时假死→锁永不释放→job 永远 running=僵尸（前端超时显示失败但无错误码）"。
- **断线重连**（`src/lib/transient-error.ts` `isTransientServerError`）：网络/超时/5xx/平台临时/限流=可恢复重试；真人/版权/参数/审核拒绝=永久不重试。图片任务退避重排队、视频创建重试、BytePlus 建素材重试。
- 生成参数与真实媒体属性分开：`ratio`(如16:9)是生成设置；真实像素在 `imageDimensions`/`videoDimensions`/`width/height`；视频真实时长 `durationSeconds`(Float)，请求时长 `videoDuration`(如8秒)。

## 上传链路

- **图片** → `POST /api/asset-upload-temp`(multipart, field `image`)存临时区返 token → `PATCH`({token}) commit 到 `/generated/users/<uid>/upload_image/<hash>.jpg`。服务端 ffmpeg 统一转 JPG。校验唯一权威 `src/lib/image-upload-validation.ts`（只 JPG/JPEG/PNG/WebP、原始单图 ≤10MB）。
- **视频/音频/文档** → `POST /api/upload-file`(multipart, field `file`)。服务端 `saveUploadedFileBufferAsset` 写 `/generated/users/<uid>/files/<hash>.<ext>` + MediaAsset/UserAssetState。校验/探测：`src/lib/media-upload-validation.ts` + `src/lib/media-upload-probe.ts`(ffmpeg 真实属性)。视频上传即时生成 `.poster.jpg`。
- **命名唯一权威** `src/lib/upload-name.ts`（`resolveUploadName`：contentHash 命中复用旧名；否则去扩展名+sanitize+全局唯一 base/base_2）。三条上传接口都返回权威 `name`，前端只显示服务端返回名。
- **内容去重**：按原始字节 SHA-256（`src/lib/upload-content-hash.ts`）+ `MediaAsset.contentHash`，命中直接复用不重传。
- **读取要快必须回传阿里**：`syncGeneratedFilesToAli`（`src/lib/ali-sync.ts`，rsync 到阿里镜像）。"上传走哪≠存哪"，文件始终在腾讯生成，读取快靠阿里本地镜像。`src/lib/recent-upload-origin.ts`：本会话刚上传的读腾讯主源，刷新后走阿里（见 M018）。

## ⭐ 视频/音频时长限制（2026-07-27 实测 + 收敛，唯一权威）

- **平台真实硬上限（实测，别再猜）**：BytePlus Seedance 2.0 / Fast / Mini 三个模型的 **r2v 参考视频时长上限 = 15.2 秒（含）**，API 报错原文 `video duration (seconds) ... must be less than or equal to 15.2 ... in r2v`。另有 `video pixel count ≥ 409600`、宽高 300–6000px、宽高比 0.4–2.5、帧率 24–60、编码 H.264/H.265。
- **自家生成的「15秒」视频实际是 15.1 秒**（正式服库三个模型 min=max=avg=15.1）。所以 **15 秒生成视频可以当参考视频**（15.1 < 15.2）——但前提是校验带容差，否则会被自己拦死（曾经就是这个 bug）。
- **唯一权威实现**（`src/lib/media-upload-validation.ts`，三处共用、禁止再复制）：
  - `MEDIA_DURATION_EPSILON_SECONDS = 0.2` —— 唯一容差常量。对外宣传 `maxSeconds=15`，`15 + 0.2 = 15.2` 正好等于平台硬上限。
  - `validateReferenceMediaDurationRange(kindLabel, seconds, rule)` —— **单条**时长范围校验唯一实现。对话流（`chat-workbench.tsx`）与工作流（`workflow-tldraw-canvas-inner.tsx`）都是 import 它（用别名 `validateMediaDuration`/`validateWorkflowMediaDuration` 保持调用点不变），**不要再在组件里写本地副本**（历史上就是各写一份、数值分别是 15.35 / 15.35 / 16.01 三个都错）。
  - 服务端 `validateMediaUploadMetadata` 也用同一容差（`< 2 - EPS || > 15 + EPS`）。
- **总时长**（多个参考视频/音频相加）：`src/lib/upload-rules.ts` 的 `REFERENCE_TOTAL_SECONDS_LIMIT = 15` + `validateReferenceTotalDuration()`，**同样带 `+ MEDIA_DURATION_EPSILON_SECONDS`**（=15.2）。这条本来就只有一份实现（服务端+两客户端共用），只是数值以前没带容差。
- 客户端增量校验用的 `maxTotalSeconds`（`upload-rules.ts` kindRule，值 15）也是 `+ EPSILON` → 同为 15.2。**改一个 epsilon 三类判断一起变，不会再出现各处不一致。**
- ⚠️ 文案仍写死"2-15秒"（`chat-workbench.tsx` 的 `workflowUploadNodeTypeLabel`/`assetsUploadTypeLabel`、后台 `admin-upload-rules-panel.tsx`），改规则数值时记得手动同步。

## ⭐ 视频「参考图」尺寸/比例限制（2026-07-27 新增，唯一权威）

- 平台硬规则（BytePlus）：参考图**宽和高都必须 300–6000px、宽高比 0.4–2.5**。不合规时**不是生成阶段报错，而是"素材送审"阶段就被拒**（原文 `Height must be between 300px and 6000px.` / `Aspect ratio must be between 0.4 and 2.5.`），历史上这类失败全被降级成"服务器繁忙"（正式服 7 月 82 次）。
- **唯一权威实现 `src/lib/video-reference-image-rules.ts`**：常量 + `validateVideoReferenceImageDimensions` / `validateVideoReferenceImages` / `validateVideoReferenceImagesBeforeSend`（会现场量图）+ `measureImageDimensions`。
- 三处共用、禁止再写一套：**对话流** `sendMessage`（黑底 `showInputTip` + 中止发送）、**工作流** `runVideoNode`（抛同文案）、**服务端** `api/video/route`（从 `MediaAsset.width/height` 读，400 + 同文案，兜住 Agent/资产库/任何入口）。
- 只对 **BytePlus 视频模型**生效（别拿它拦 kling/veo）；`asset://` 引用跳过；**量不到宽高时不拦**（宁可让平台判，不能把用户挡死）。

## ⭐ BytePlus 真人/敏感参考素材「送审通行证」机制（2026-07-27 修 + 补齐）

- 记忆载体：`UserAssetState.bytePlusAssetId` / `bytePlusAssetGroupId` / `bytePlusAssetStatus`（Active/Processing/Failed）/ `bytePlusAssetError`。**同一张图过审一次，以后一直用这张"通行证"**。
- 第一道：`resolveBytePlusReviewedReferences()` 在**创建任务前**就把已 Active 的 url 换成 `asset://<id>` → 已过审的图第二次根本不会被拦。
- 第二道：被拦后 `autoReviewBytePlusVideoReferences()`
  - `reuseOnly: true` 预检（**只查库、不上传不等待**）→ 有现成通行证就**当场无感重试，不弹「检测到真人图片，需要审核」蓝字**（用户当初的设计）。
  - 否则完整送审（`createBytePlusAsset` moderationStrategy=Skip → 等 Active → 写回库）→ 重试。
  - ⛔ 历史 bug（已修）：原来用 `triggered` 判断"送审有没有干活"，**全是复用旧证时 triggered 恒 false → 把拼好的 `asset://` 全丢掉、直接放弃重试**。现在看 `convertedCount`。
- 死卡自愈：平台报 `The specified asset asset-xxx is not found` → `clearStaleBytePlusAssetCards()` 清空库里失效凭证 + 纳入"可恢复错误" → 重新送审拿新证。


## 资产分类（AssetFilter）

- 第 1 组（资产库生成，同组同款）：`character_image` / `scene_image` / `prop_image`（道具，2026-07-21 新增）/ `shot_image`。图标/比例/propify 见 04 + 代码。
- 对话流：`conversation_images` / `conversation_videos` / `conversation_uploads`(上传图片) / `upload_videos` / `upload_audios`。
- 工作流：`workflow_images` / `workflow_videos` / `workflow_uploads`（及 `workflow_upload_videos/audios/documents`）。
- `workspaceKind`=`conversation`/`workflow`/`asset_generation` + `workspaceId` 标记来源；工作流资产不混进对话流筛选。
- **资产分类过滤在服务端** `workspace-state` 路由（`getAssetPageWhere`/`getAssetCounts`），前端 `isAssetInFilter` 做本地保留/计数——**改分类必须两处同步**。`.bin` 存的上传音频靠扩展名认不出，必须靠 `MediaAsset.mediaType`（workspace-state + media-assets GET 都已透传）。

## ⭐ 关键去重规则：`getAssetIdentityKey`（2026-07-21 修）

- `chat-workbench.tsx:2617`：`getAssetIdentityKey = 归一化url || mediaId || id`（**url 优先**）。
- 原因：同一媒体文件在客户端可能同时来自"消息内嵌引用（只有 url、无 mediaId）"和"资产库懒加载权威记录（有 mediaId）"。若 mediaId 优先，两份 key 不同 → @引用资产弹窗把同一视频/资产显示成两个。url 才是文件唯一身份 → url 优先必合并。三处 @引用资产共用同一 `assets` + 此函数 + `isAssetInFilter`。

## @引用资产弹窗（三处统一）

- 共享组件 `src/components/asset-mention-picker.tsx`（左分类标签+右 5 列 80×80 缩略图，高 378px；左侧分类溢出时滚动条常驻=`mention-cat-scroll` 样式）。对话流输入框(chat-workbench)、资产库生成弹窗(chat-workbench)、工作流输入框(workflow-inner)三处共用。
- 懒加载：首次只加载当前标签 30 个 + 全部计数，切标签/下拉再各自加载（`loadMentionFilterPage`/`mentionFilterPaging`）。视频/音频可引用（复用 + 号上传的 uploadRule 校验，从 url 读元数据）。

## 跨境链路固有软肋

- 腾讯新加坡（源）↔ 阿里（国内入口）走公网跨境，有丢包/延迟。两台已开 BBR 缓解。这是双服务器方案固有痛点、非 bug。长期优化方向见归档。

## 迁移脚本 / 一次性脚本

- `scripts/` 下有 media 迁移/审计脚本（见 `scripts/README-media-assets.md`）。`scripts/backfill-prompt-mentions.js`=资产库生成图 sourcePrompt @名与参考图对齐回填（仅 1:1 才改）。**不跑广泛破坏性迁移**；先 dry-run + 备份 + 保留日志。
- 现有常用脚本（都默认 dry-run，`--apply` 才写）：
  - `scripts/backfill-media-asset-durations.mjs`：补 `MediaAsset.durationSeconds`（ffmpeg 解析 `Duration:`，项目没装 ffprobe）。**已在本地/测试服/正式服跑完。**
  - `scripts/backfill-uploaded-video-posters.mjs`：补上传视频封面 `.poster.jpg` + `posterUrl`。**已跑完**（正式服新建 29 个）。⚠️ 脚本现生成的媒体**不会自动同步阿里**，要补一次 `*.poster.jpg` 的 rsync。
  - ⭐ `scripts/archive-resolved-generation-failures.mjs`：**后台失败原因归档**（打 `GenerationEvent.resolvedAt/resolvedNote`）。规则表 `RESOLVED_RULES` 是唯一入口，按诊断日志真实原文匹配。支持 `--undo`。详见 `07-red-error-triage-and-archive.md`。
- ⚠️ 一次性脚本在服务器上必须 `docker cp` 进容器 `/app` 用 `node` 跑（容器里才有 `@prisma/client`），跑完删掉。
