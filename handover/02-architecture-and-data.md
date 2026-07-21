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

**数据权威**：媒体固定事实→`MediaAsset`；用户可变状态→`UserAssetState`；对话→`WorkspaceSession+Message`；计费→`CreditLedger`。新生成/上传媒体统一走 `src/lib/media-asset-record.ts`（`buildMediaAssetRecord`/`classifyAsset`）入库；出生即冻结，之后只有改名/移动/删除（只写 `UserAssetState`）。

## 核心媒体生成链路（图/视频统一，工作流复用同一套）

- 生成由服务端 `GenerationJob` worker 唯一权威 finalize 出生；provider 临时 URL 可先给前端显示提速，但**绝不能存进 `MediaAsset.url`**。
- 后台存盘（`.runtime/media-save-jobs.json` 跟踪）；存好后前端轮询 `/api/media-save-status` 把临时 URL 换成本地 `/generated/...`。
- **图片存盘不丢改造**（`runImageJob`）：本地没存好就把交付快照重排队等到存好再落库（扣费幂等、只 finalize 扣一次），不再回退远程 url → 国内跨境慢也不丢库。
- **断线重连**（`src/lib/transient-error.ts` `isTransientServerError`）：网络/超时/5xx/平台临时/限流=可恢复重试；真人/版权/参数/审核拒绝=永久不重试。图片任务退避重排队、视频创建重试、BytePlus 建素材重试。
- 生成参数与真实媒体属性分开：`ratio`(如16:9)是生成设置；真实像素在 `imageDimensions`/`videoDimensions`/`width/height`；视频真实时长 `durationSeconds`(Float)，请求时长 `videoDuration`(如8秒)。

## 上传链路

- **图片** → `POST /api/asset-upload-temp`(multipart, field `image`)存临时区返 token → `PATCH`({token}) commit 到 `/generated/users/<uid>/upload_image/<hash>.jpg`。服务端 ffmpeg 统一转 JPG。校验唯一权威 `src/lib/image-upload-validation.ts`（只 JPG/JPEG/PNG/WebP、原始单图 ≤10MB）。
- **视频/音频/文档** → `POST /api/upload-file`(multipart, field `file`)。服务端 `saveUploadedFileBufferAsset` 写 `/generated/users/<uid>/files/<hash>.<ext>` + MediaAsset/UserAssetState。校验/探测：`src/lib/media-upload-validation.ts` + `src/lib/media-upload-probe.ts`(ffmpeg 真实属性)。视频上传即时生成 `.poster.jpg`。
- **命名唯一权威** `src/lib/upload-name.ts`（`resolveUploadName`：contentHash 命中复用旧名；否则去扩展名+sanitize+全局唯一 base/base_2）。三条上传接口都返回权威 `name`，前端只显示服务端返回名。
- **内容去重**：按原始字节 SHA-256（`src/lib/upload-content-hash.ts`）+ `MediaAsset.contentHash`，命中直接复用不重传。
- **读取要快必须回传阿里**：`syncGeneratedFilesToAli`（`src/lib/ali-sync.ts`，rsync 到阿里镜像）。"上传走哪≠存哪"，文件始终在腾讯生成，读取快靠阿里本地镜像。`src/lib/recent-upload-origin.ts`：本会话刚上传的读腾讯主源，刷新后走阿里（见 M018）。

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
