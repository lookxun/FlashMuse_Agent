# Memo Tasks

Last synced: 2026-06-26

Definition: memo tasks are things the user says not to do now but may want later. Each item must include why it is not being done now and what to do later. When the user asks to see memo tasks, show all items in this file.

Historical docs were checked on 2026-06-21. Old items that are already done or clearly obsolete were not migrated here.

## Active Memo Tasks

### [待办] M018 刚上传媒体不刷新自动切阿里镜像（2026-07-22 定，用户说保持现状以后再说）

**背景**：视频/音频上传后采用「方案 A」——同步阿里是后台异步；本会话刚上传的 `/generated` 路径由 `src/lib/recent-upload-origin.ts` 记录，前端 `chat-workbench` 的 `getStaticMediaUrl` 一律读腾讯主源（保证成功即可播放/看封面）。
**为什么现在不做**：没有轮询，所以阿里同步完成后，本会话内这几个刚上传的媒体不会自动切到阿里镜像，**除非用户刷新页面**。用户确认功能无碍（腾讯兜底一直能读），只是本会话内这几个加载稍慢，决定保持现状。
**以后要做（二选一）**：
- 轻量（推荐）：上传成功后起一个定时器（约 10~20 秒）把该 url 从 recent 集合移除，之后自然回到读阿里。简单、无需后端；缺点时间是估的。
- 精确（方案 B）：加「阿里同步状态」接口，前端轮询到已同步再把地址切到阿里。最准但要写后端状态 + 前端轮询，参照生成视频「先远程 URL、落盘后替换」模式。
**相关文件**：`src/lib/recent-upload-origin.ts`、`src/components/chat-workbench.tsx`(`getStaticMediaUrl`/`preloadUploadedMedia`/`selectAssetMediaUploadFiles`)、`src/app/api/upload-file/route.ts`(同步阿里已改回 `void`)。

### [进行中] M016 资产入库/显示统一大改造（2026-07-11 定调，2026-07-12 阶段1/2/3a/4 已部署腾讯）

**进度（2026-07-12）**：阶段 1/2/3a/4 已完成并部署腾讯线上（GitHub 未推/本地未 commit）。**剩阶段3b（图片上传去重客户端接线，见 M017）待做**。详见 CHANGELOG 2026-07-12 顶条。
- ✅ 阶段1 统一模块 `src/lib/media-asset-record.ts`（classifyAsset/buildMediaAssetRecord/resolveAssetPreviewMeta/normalizeLegacySourceKind）。
- ✅ 阶段2 写入点全切 builder + 关掉 #3/#4/#5 出生后覆盖 + 视频存尺寸 + 补 mimeType/fileSize。
- ✅ 阶段3a contentHash 列+迁移 + 视频/音频/文档上传去重（服务端闭环）。
- ✅ 阶段4 库/工作流资产显示统一到共享投影 + 修工作流显示模型原始 id bug。
- ⏸ 阶段3b 图片上传去重客户端接线（见 M017，下一次做）。
- 历史数据**不回填、不删、不改**（用户定调，风险规避）。

原始需求/背景（保留）：

用户盘点资产库发现历史数据乱：生成的显示成"上传"、参数不全（缺模型/缺尺寸比例K数）、疑似被兜底覆盖。根因=**入库没有单一权威、显示没有单一投影、且出生后还被反复覆盖**。已与用户达成的方案（**下面全部要做，按顺序**）：

**核心原则（用户确认）**：生成/上传的图和视频，**数据在出生那一刻定死、永久冻结**；之后唯一变化是用户改名/移动/删除，只写 `UserAssetState`，**绝不碰 `MediaAsset` 原始数据**。合理的出生后写入白名单只有 3 种：①视频封面 poster 晚到回填 ②用户加 reversePrompt ③远程URL换本地URL的规整（canonicalizeSavedMediaUrl）。

**A. 关掉"出生后覆盖"的元凶（查证结果，2026-07-11）** —— 全平台 8 个写 MediaAsset 的点里，真正在出生后还全覆盖内容的是 3 个：
- **#3（最严重）`workspace-sessions.ts:157` syncWorkspaceMessageMediaAssets**：每次保存对话流都拿 message JSON 把该资产**所有参数字段全覆盖一遍、连 initialName（终生ID）都覆盖**。→ 改成 create-only（记录已存在就完全不碰内容，只在库里没有时才建一条）。
- **#4 `media-assets/route.ts:237` POST 的 update 分支**：前端重复上报同一资产就全覆盖。→ 同样改 create-only。
- **#5 `upload-file/route.ts:80` 的 update 分支**：重复上传覆盖。→ 见 M017（改成"识别为同一文件直接复用"，就不会触发）。
- 保留：#1 图片落库(update 已空✅)、#2 视频 poster 回填、#6/#7 PATCH reversePrompt、#8 URL 规整。

**B. 入库统一（写侧）**：新建 `src/lib/media-asset-record.ts`：`buildMediaAssetRecord(input)`（一次填齐所有列，含全量 generationSettings、视频也存宽高/时长）+ `classifyAsset()`（promptSource/sourceKind/category 唯一规则，消灭"生成显示成上传"）+ 统一生成 previewMeta。现有所有写入点改调它。

**C. 显示统一（读侧）**：把 `workspace-state/route.ts:191` 的 `mediaStateToLegacyAsset` 抽成共享 `toAssetView()`，资产库/对话流内嵌卡/工作流节点参数(`workflow-tldraw-canvas-inner.tsx:1136`那套)/后台详情**全部改用同一投影**，同一资产哪里显示都一致。

**D. 历史数据回填**：写幂等脚本扫全部用户全部 MediaAsset，按最富来源（generationSettings→previewMeta→GenerationJob→message JSON→尺寸反推）补齐并纠正归类。先 dry-run 出"改多少条/明细"给用户看，确认再执行；只补不删、先备份。

落地顺序：阶段1 建三个函数（零风险纯新增）→ 阶段2 写入点切 builder + 关 #3/#4 覆盖（snapshot 前后对比）→ 阶段3 显示端切 DTO → 阶段4 回填脚本。

### [进行中] M017 上传同一文件按内容去重、直接复用已上传的（2026-07-11 定调；2026-07-12 服务端完成，客户端=阶段3b待做）

**进度（2026-07-12）**：视频/音频/文档=**服务端闭环已完成并上线**（`upload-file` 落盘前算 SHA-256、命中就复用旧 url）。图片=服务端已就绪（`asset-upload-temp` 判重、`media-assets` POST 存 contentHash）但**客户端接线未做（阶段3b），现状休眠安全不会触发**。下一次做客户端接线，详见 05-next-actions 顶部 #2 + CHANGELOG 2026-07-12 顶条末尾。

背景/口径（保留）：

用户想法：上传同一个文件时，**100% 判断是不是之前上传过**，若是，不重新落库、不提示，直接把之前那份"调出来"给用户用——对话流就把已上传那张的缩略图放进输入框；工作流本来就有"复制一张图"功能，等于给他复制一份。关键前提=**能否 100% 判断同一文件**。

**当前判断依据（已查证 2026-07-11）**：现在去重完全按 `normalizedUrl`。但上传落盘的文件名是 `local-assets.ts:124` 的 `${Date.now()}-${randomUUID()}.${ext}`（时间戳+随机UUID）→**同一文件每次上传都得到全新 URL**→现有去重对"重复上传"根本判不出来，永远认不出同一个。图片上传还会转码成 JPEG、视频会压缩，连落盘字节都可能不同。

**判定口径（用户已拍板 2026-07-11）**：只按"**同一个文件本身、字节完全一致**"算同一文件（原始文件 SHA-256）。用户明确：png 后来另存成 jpg 虽看着同一张，但字节不同，**不算**同一个（不做图像相似度/感知哈希，那不是 100%）。

**做法（已定）**：
1. 上传接口收到文件后，**对用户上传的原始字节先算 SHA-256**（必须在任何转码/压缩之前算，`createHash` 已在 local-assets.ts 引入）。
2. MediaAsset 新增列 `contentHash String?` + `@@index([userId, contentHash])`。
3. 上传接口先按 `(userId, contentHash)` 查：**命中**→不落盘、不新建记录、不提示，直接返回已存在那条的 `url/缩略图/名字`；前端拿去用（对话流：塞进输入框缩略图；工作流：复用同一 url = 等于复制一张）。**未命中**→走现有正常落盘流程，并把 contentHash 存进 MediaAsset。
4. 注意：软删除的资产命中时的处理（是否顺带恢复/取消 hidden）上手时再定；老数据无 contentHash，可在回填脚本 M016-D 里按现有本地文件补算。

### [ ] M015 阿里端上传压缩转发小服务（2026-07-09 与用户讨论，押后）

临时不做原因：用户认可思路但决定"以后再说"，先不做。目标是让**上传更快**——上传慢在"阿里→马来"跨境这段，要减小过境体积就得在"过境前"压缩。浏览器端压图片可行但压不了视频；服务端（马来）压缩发生在过境后，对上传提速无用。

关键结论（已查证）：
- 阿里那台现在**只有 nginx（纯反代，只转发字节，不能调用 sharp/ffmpeg 压缩 body）**。要在阿里压缩，必须跑一个**应用进程**接收→压缩→转发马来。不是"装不装库"的问题，是"谁来调用"。
- 阿里机器：**2 核 Xeon 6982P-C + 3.4G 内存，长期几乎全闲（load 0.2），系统已装 ffmpeg（/usr/bin/ffmpeg）**。CPU 层面扛得住：图片 sharp 压缩零压力；视频 ffmpeg 转码 2 核偏紧但**限制同时最多 1 个转码 + 用 veryfast preset** 即可，以内部工具的上传频率碰不到瓶颈。
- 真正的成本不是 CPU，而是要**部署并长期维护一个阿里小 Node 服务**（鉴权 token、大文件流式、错误重试、和马来代码别版本脱节）。它比 Option B（阿里跑整套 App）轻很多，只干"接收→压缩→转发"一件事。

三方案对比：浏览器端压缩（图片✅/视频❌，工作量小）；阿里小服务压缩转发（图片✅/视频✅，工作量中）；Option B 阿里跑整套 App（工作量大）。

以后要做时：先定选哪个方案。若做阿里小服务，先设计结构（接口、鉴权 token 怎么透传、和马来 upload-file 怎么衔接、落盘/回传怎么处理、部署方式），确认后再动手。注意视频转码要限并发+快 preset。

### [ ] M001 Server-To-Provider Public Reference URLs

Temporary reason: do not change now because the user may change domains later, and the public URL base must be stable before changing provider request behavior.

What to do later: after domain changes are settled, change server-to-model-provider reference media handling so local `/generated/...` media is sent to BytePlus/OpenRouter as public HTTPS URLs instead of being converted back to base64 data URLs. Verify the chosen public domain is reachable by provider servers, not 403, not login-gated, and not expired. Relevant current code: `src/lib/openrouter.ts`, `src/lib/openrouter-video.ts`, and `src/lib/seedance.ts` functions named `toDataUrlIfLocalPublicAsset()`.

### [x] M002 Static Domain Public Access

Temporary reason: completed on 2026-06-26 after domain review passed and public HTTP/HTTPS access was verified.

What to do later: no action unless public access regresses. Current `ali.venusface.com` and `static.venusface.com` HTTP redirect to HTTPS, HTTPS returns 200, and static/generated media paths are verified.

### [ ] M003 Production Workflow Mode

Temporary reason: workflow code exists but production workflow mode must stay disabled until the user explicitly approves opening it.

What to do later: when approved, enable production workflow entry, retest workflow uploads/generation/media persistence, and make workflow media categories (`workflow_uploads`, `workflow_images`, `workflow_videos`) visible where needed.

### [x] M004 Commit Deployed Local Changes

Temporary reason: completed on 2026-06-23 after the user asked to do a GitHub sync. Future local workflow/repo-rename changes were also committed and pushed on 2026-06-26.

What to do later: no action unless future deployed local changes accumulate again. Current GitHub repository is `https://github.com/lookxun/FlashMuse_Agent`; latest pushed sync commit is `1c9211d Sync local workflow updates and repo rename`.

### [ ] M005 Input Mention Refactor

Temporary reason: current `@` mention behavior is acceptable after recent fixes; refactor risk is higher than benefit unless bugs resurface.

What to do later: if input `@` editing bugs resurface, do a focused contenteditable mention refactor for atomic mention deletion, cursor behavior, typed mention resolution, and blue inline rendering.

### [x] M006 Ali Static Certificate Renewal Automation

Temporary reason: completed on 2026-06-26. The `flashmuse-ali-static` certificate was reissued through HTTP-01 webroot after domain review passed.

What to do later: no DNS API key is needed under the current setup. Certbot renewal config uses `authenticator = webroot` with `/var/www/letsencrypt`, `certbot.timer` exists, `certbot renew --dry-run --cert-name flashmuse-ali-static --no-random-sleep-on-renew` passed, and `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads Nginx after renewal.

### [ ] M007 Formal Frontend Monitoring

Temporary reason: current `/api/client-error` and browser global error capture are useful temporary diagnostics, and replacing them is not urgent.

What to do later: if the app enters more formal production operations, replace or supplement the temporary client-error endpoint with a proper frontend monitoring system, then remove redundant temporary logging if appropriate.

### [ ] M008 Media Save Queue For Multi-Instance Deployment

Temporary reason: current `.runtime/media-save-jobs.json` queue is sufficient for the current single production instance.

What to do later: before multi-instance deployment, move media save queue/status from local runtime JSON files into a database table or queue service so polling and duplicate canonicalization work across instances.

### [ ] M009 BytePlus Asset Review Asset-URL Flow

Temporary reason: current automatic review flow has working first-version behavior; a full `asset://assetId` flow depends on stable public HTTPS media URLs and BytePlus asset-library behavior.

What to do later: save upload/asset/generated images as provider-accessible HTTPS URLs, submit BytePlus asset creation/review, persist approved `assetId`, and send approved human reference images to video generation as `asset://assetId` when appropriate.

### [ ] M010 Migration And Audit Script Cleanup

Temporary reason: temporary migration/debug scripts have been useful during online fixes; cleaning them up is lower priority than feature stabilization.

What to do later: review useful scripts from `tmp/` and historical migration work, move stable ones into `scripts/`, document usage and dry-run behavior, and avoid deleting anything still needed for production audits.

### [ ] M011 Duplicate `.env.local` Cleanup

Temporary reason: production currently works, and editing environment files carries risk of exposing or breaking secrets.

What to do later: clean the duplicate `DATABASE_URL` lines in production `.env.local` carefully on the server, without exposing credentials in chat, commits, or handover docs. Verify Prisma commands still use the intended URL afterward.

### [ ] M012 Voice Clone / TTS For Consistent Character Voice

Temporary reason: current video reference audio is not a reliable voice-cloning solution, and the current MVP focuses on image/video generation.

What to do later: if the user wants consistent character voice, evaluate dedicated TTS or voice-cloning providers such as ElevenLabs, MiniMax Speech, Volcano/BytePlus speech, or Fish Audio instead of relying on video model reference audio.

### [ ] M013 Song-To-MV Workflow

Temporary reason: not part of the current MVP priority, and workflow mode remains disabled in production.

What to do later: design a workflow like song generation or upload -> Agent splits MV shots -> video models generate shots -> ffmpeg or equivalent combines video with audio.

### [ ] M014 GPT Image Prompt Optimization Phase 2

Temporary reason: first version is now local-only and should be tested online/local in workflow mode before expanding. The first version records successful GPT-5.4 Image 2 safety rewrite cases but does not yet analyze them automatically.

What to do later: after enough successful cases accumulate, add automatic success-case analysis, store a rolling analysis report, feed that report into future rewrite prompts, add success/cost/latency statistics, and consider copying the feature from workflow image nodes to conversation-flow image generation. See `handover/08-gpt-image-prompt-optimization.md`.

### [ ] M018 对话流生成统一单轮询器（2026-07-14 与用户讨论，押后）

临时不做原因：现在是**低风险即时修复**（给后台恢复 effect 加守卫、前台在跑时让路）已上线解决双失败卡；统一单轮询器是中等重构、要仔细测，用户决定以后再做。

**背景（务必看懂再动手）**：对话流图片/视频当前有**两个并行轮询器**，是历史分层长出来的：
1. **前台轮询器**（`chat-workbench.tsx` 的 `createAndPollVideo` / `pollConversationImageJob`，由 `runGeneration` 驱动）：用户当场生成时跑，负责即时状态文字、BytePlus 真人审核往返（reviewing→重试）、审核提示消息、用户点"停止"的 abort。缺点=内存里的 JS 循环，浏览器一关/刷新就死，后端 job 还在跑但 UI 不更新。
2. **后台恢复 effect**（durable reconcile，`chat-workbench.tsx:11650`(image)/`11717`(video)）：数据驱动，从持久化的 `pendingImageCount`/`pendingVideoCount` 出发，挂载/标签页可见时对齐后端 job 状态。这是"关浏览器再回来能恢复"的功臣。

**问题根源**：标签页开着、前台正轮询时，两个轮询器**同时轮询同一个 job**；它俩都调 `markAssistantImageFailure`/`markAssistantVideoFailure`（都无脑 `failedXxxCount + 1`），撞在同一个 3s 窗口就双重计数 → **两个失败卡**。

**当前修复（2026-07-14 已上线，见 CHANGELOG）**：恢复 effect 的 jobsToCheck 过滤里加 `if (runningRequestIdsRef.current.has(message.requestId)) return [];`，前台还活着（requestId 在 `runningRequestIdsRef`）就让路，只在孤儿 job（前台没了）才接管。视频 + 图片两处都加了。

**以后统一单轮询器要做的**：既然图片/视频都已 **job 化**（后端 worker 负责真正生成/挑图/扣费/写库），前台轮询其实只是"读状态"。可以砍掉前台 while 循环，**统一由数据驱动的 reconcile 做唯一轮询器**（单一真相来源、彻底无撞车可能）。代价=要把前台那些额外职责搬进 reconcile：① BytePlus 真人审核往返（reviewing→autoBytePlusAssetReview 重试）② 即时状态文字（排队中/渲染中）③ 停止 abort ④ 压缩重试（`createImageWithRetry` 的参考图过大压缩）。搬完后前台 submit 只建 job，其余全靠 reconcile。务必回归测：正常生成、失败单卡、审核往返、停止、关浏览器恢复、多图并发命名不撞。工作流不涉及（节点失败是单个 `error` 字段、一节点一卡，天然无双卡问题）。

### [ ] M019 工作流整张画布存一个 canvasJson 大字段——太大、有隐患，以后重构（2026-07-14 与用户讨论，押后）

临时不做原因：这是**架构级重构、风险高、要大量回归测**，且当前功能可用；用户决定以后再改。本 session 已经**顺手减轻**了一部分（去掉了往画布里塞 `generationUploads` 冗余副本，改成"使用提示词"点击时读后端 `GenerationJob`，见 CHANGELOG 2026-07-14 顶条），但根本结构没动。

**问题本质**：一个工作流的**整张画布**（所有节点、所有连线、每个节点 data 里的图 url / 视频 url / mediaSystemNames / 各种运行时派生字段…）被序列化成**一整块 JSON**，存进 `WorkspaceWorkflow.canvasJson` **单个 jsonb 列**。

**由此带来的隐患（务必让下一个 AI 心里有数）**：
1. **整块读写**：每次读工作流 = 读整块 JSON；每次存 = 整块重写。节点越多、画布越复杂，这块 JSON 越大，读写越慢、越占内存/带宽。用户明确担心"以后越来越大，一次性读取很久"。
2. **整块覆盖 = 竞态/旧标签页覆盖风险**：谁后保存谁盖整块。历史上已多次踩坑（旧标签页发空图覆盖已成功结果 → 才有服务端自愈 `mergeWorkflowCanvasMedia` 打补丁；`generationUploads` 被空快照冲掉 → 本 session 才根治）。只要还是"整块 JSON 前端整体保存"，这类"某字段被另一次保存意外抹掉"的坑就一直潜伏。
3. **前端临时态混进持久数据**：靠 `getPersistableWorkflowItems`/`stripKeys` 在存库边界手工剥离 uploadProgress 等运行时字段，容易漏、容易再长出新字段污染库。

**以后重构方向（供参考，未定案）**：
- 把画布拆成更细的持久化粒度：节点/连线独立成行（如 `WorkflowNode`/`WorkflowEdge` 表），按需读写、局部更新，避免整块重写；成品媒体只存引用（指向 `MediaAsset`/`GenerationJob`）而不是在画布里存副本。
- 或至少：保存改成**增量/字段级 patch**（只写变化的节点），配服务端合并，杜绝整块覆盖。
- 迁移历史 canvasJson 数据是重头，需 dry-run + 备份 + 前后快照对比。
- 参考对话流的思路（消息分行 `WorkspaceMessage`、媒体/参考各有权威来源），工作流也往"权威数据分表、画布只存布局与引用"靠拢。
