# Memo Tasks

Last synced: 2026-06-26

Definition: memo tasks are things the user says not to do now but may want later. Each item must include why it is not being done now and what to do later. When the user asks to see memo tasks, show all items in this file.

Historical docs were checked on 2026-06-21. Old items that are already done or clearly obsolete were not migrated here.

## Active Memo Tasks

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
