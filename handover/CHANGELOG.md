# Current Handover Changelog（2026-07-21 重建起）

> 本批 CHANGELOG 从 2026-07-21 交接文档重建开始记。**此前的全部历史流水**（约 580KB，含 2026-06 起到 07-21 每一次改动/部署细节）在 `historical-handover-docs-last-used-2026-07-21/CHANGELOG.md`，遇到需要历史上下文的难题再翻。

## 2026-07-27（视频卡下载僵尸根治 + 恢复乐观显示 + 工作流生成动画）—— ✅ 已整份部署正式服 `v1.0.0.43` + push GitHub。四方同步（正式=测试=本地=GitHub=v1.0.0.43），四域名 200，无 Prisma 迁移

**起因**：用户报 ID_686996（`312876953@qq.com`）一条 seedance-2-0 视频生了 40 多分钟才显示失败、无错误码。查正式服 DB+诊断日志定位：火山其实 5 分钟就出片（远程 volces mp4），但**本地下载 `saveRemoteAsset` 的 fetch 没超时、跨境下载假死**（只有 `media-save-download-start attempt=1`、之后无 saved/failed/expired），`processMediaSaveJob` 的 `inFlight` 锁又只在 `finally` 释放→假死永不释放→卡死回收(30min stale)/24h 过期判失败全被这把锁挡死→job 永远 running=僵尸；前端自己超时显示"失败"但后端从没判失败（所以无错误码）。

**① 可靠性层（根治僵尸）**
- `local-assets.ts saveRemoteAsset`：加 `REMOTE_DOWNLOAD_TIMEOUT_MS=3min` AbortController，覆盖 fetch/arrayBuffer/curl 兜底（curl 加 `--max-time`）；到点 abort→抛错→上层按失败重试。
- `video-poster.ts`：封面(×2)/尺寸探测 ffmpeg 各加 `timeout:60_000`。
- `media-save-queue.ts`：`STALE_DOWNLOADING_MS` 30min→8min；`inFlight` 从 `Set` 改 `Map<id,上锁时刻>`，持锁超 8min 视为假死可强夺重跑；`enqueueRemoteAssetSave` 也会踢"downloading 超 8min"的假死任务（原来它只踢 pending/failed，回收逻辑等于没人调）。→ 四层防线：3min 下载超时 / 60s ffmpeg / 8min 锁自愈 / 24h 远程过期。

**② 恢复乐观显示（用户最初设计，07-08/07-14 为修资产库 bug 时被改成"必须先下本地才交付"，牺牲了展示速度）**
- `generation-jobs.ts runVideoJob`：拿到"浏览器可直接播"的远程地址（非 OpenRouter 需密钥）就写 `extraJson.preview.videoUrl`（写一次），job 保持 running；本地存好才转 succeeded、写资产库（**只本地 url、带全参数，零改动**）。
- 对话流 `chat-workbench.tsx`：Message 加 `videoPreviewUrls`(展示专用，不进 videos/资产库)+`videoSavedFlashAt`；`applyVideoPreviewToMessage`（幂等、无变化返回原 state 防 effect 死循环）；reconcile + createAndPollVideo 见 running+preview 即展示；成功 append 本地时撤一条 preview+打 flash；`InlineVideoResult` 左上角"转圈+资产保存中..."/成功"✓保存成功"(2s 后 1s 渐隐)。
- 工作流 `workflow-tldraw-canvas-inner.tsx`：node.data 加 `videoPreviewUrl`/`videoSavedFlashAt`；pollVideoNode/applyVideoNodeJobResult 同理；`WorkflowVideoSaveBadge` 同款角标；预览阶段 `WorkflowInlineVideo` 跳过 onGeneratedMedia（远程绝不进库）。
- OpenRouter 需密钥视频：不做预览、保持等本地（按用户定）。只做视频、图片维持现状。

**③ 工作流生成动画（对齐对话流/资产库）**
- `chat-workbench.tsx` 侧栏：工作流历史条目（收起弹窗+展开两处）在 `node.data.isRunning` 时右侧显示 `HaloPulseIndicator`（盖住⋯菜单）；"工作流模式"入口在 `activePanel!=="workflow" && hasAnyWorkflowGenerating` 时右侧显示动画（与对话/资产入口对称）。数据经 `updateWorkflowCanvas` 实时同步进 `workflowItems`。

**部署**：本地 tsc 全绿→测试服 v42→v43 验证→整份 rsync 测试服→正式服（备份 `20260725044123-presync-v43`）→重建（No pending migrations）→同步阿里正式镜像→四域名 200→PUBLISHED_APP_VERSION v41→v43 force-recreate→commit `58b38eb` push。**那条正式服僵尸 job（requestId `d049d7ad...`）按用户交代未清。**

## 2026-07-26（工作流重试秒跳失败卡根治 + gpt版安全改写 + 橡皮防双击 + 新版本提示条整套 + 提示条右侧居中 + 工作流菜单空白关闭）—— ✅ 已整份部署正式服 `v1.0.0.41` + push GitHub。四方同步（正式=测试=本地=GitHub=v1.0.0.41）

**背景**：接上一批（07-22~25 编辑菜单批，仍未部署，基线 v1.0.0.36）。本对话先修 bug + 加功能，分多次部署测试服（v37→v41），最后用户拍板整份部署正式服 + push。全程 `npx tsc --noEmit` 全绿，无 Prisma 迁移。

### 已做（本对话，按时间）

1. **工作流图片/视频节点「重试成功却秒跳失败卡→多次重试多图覆盖」根治**（`workflow-tldraw-canvas-inner.tsx`）。根因：后端 `getActiveGenerationJobs`（`generation-jobs.ts:386`）会返回近 6h 内的**旧 failed 任务**；用户点重试后节点清 error、切等待卡，`reconcileImageJobsFromBackend`(4424)/`reconcileVideoJobsFromBackend`(4481) 被 `pendingRecoverySignature` 触发重跑，按 `workflowNodeId` 匹配到**上一次旧失败任务**，又把正在转的等待卡打回失败卡 → 用户以为失败反复点，多次重试都成功→多张图互相覆盖（旧的进被删节点）。之前只有「AI改写重试」路径有 `optimizingImageNodesRef` 保护，普通重试/视频重试没有。**修法**：每次重试都会立即写入新 `imageRequestId`/`videoRequestId`，失败分支加守卫——`if (node.data.isRunning && node.data.<x>RequestId && node.data.<x>RequestId !== job.requestId) continue;`（旧请求的过期失败结果直接跳过）。不影响刷新恢复（那时节点无 requestId，照常显示失败）。

2. **gpt版 gpt5.4image2 版权红字进入安全改写页**（`workflow-tldraw-canvas-inner.tsx:1607`）。根因：`isWorkflowGptImageSafetyFailure` 把 model 写死 `"openai/gpt-5.4-image-2"`（只认直连新接口），GPT版老接口内部 id 是 `...-agent` 被挡外。两接口后端红字文本本就一致。**修法**（贯彻"能统一一律统一"）：改用 `models.ts` 已有 `isGptImage2Model(m) || isGptImage2AgentModel(m)`（新增 import `isGptImage2AgentModel`）。仅影响工作流失败卡是否显示「AI改写重试」（对话流/资产库/Agent 没这套 UI）。注：这套安全改写**目前只在工作流**，对话流没有。

3. **橡皮工具「立即使用」防双击**（`workflow-tldraw-canvas-inner.tsx` 约 2597–2630）。根因：`onClick` 里源图 `img.onload` 是异步，关弹窗 `setEraserOpen(false)` 写在 onload 回调里 → 加载慢时弹窗/按钮还在，用户再点一次 → 生成两张（且第一次 onload 结尾清了涂抹层，第二张无紫蒙版=出原图）。**修法**：点第一下就**同步**上锁 `eraserSubmittingRef`(新增)+ 立刻关弹窗清状态（按钮当场消失），异步合成用已捕获的 canvas 引用（React 卸载后位图仍在），onload/onerror 结束解锁。

4. **新版本提示条整套**（新增 `src/middleware.ts` + `src/components/version-update-notifier.tsx`，挂进 `src/app/layout.tsx`）。方案：middleware 给所有 `/api/*` 响应带 `x-app-version` 头；前端组件拦截自己发出的 `window.fetch`（**搭在已有请求流量上，不专门轮询、不开长连接**），读头与自己 bundle 打死的 `APP_VERSION` 数值比较，**服务端更高才弹**顶部提示条（白底 360×60、黑色「刷新」按钮=时间戳强制刷新绕 HTML 缓存 `location.replace(?_v=Date.now())`、放大的「×」=忽略当前版本、下方灰字「或 CTRL+F5(蓝) 强制刷新即可加载新版本！」）。
   - ⭐⭐ **部署时机门控（关键，解决"部署中途就弹→点刷新白屏"）**：middleware 发的版本 = **运行时环境变量 `PUBLISHED_APP_VERSION`**（非直接 APP_VERSION，因新容器一起来就是新版但阿里静态还没同步完）。部署顺序：①`up --build`（PUBLISHED 仍上一版/空→不发新版头→不误弹）→ ②同步阿里静态 → ③sed 改 compose `PUBLISHED_APP_VERSION` 为新版 + `docker compose up -d --force-recreate <app>`（此刻才发新版头，静态已就绪）。**保证"提示条弹出=静态就绪=刷新必正常"**。本地开发（非 production）无该 env 时 middleware 回退 APP_VERSION（保留本地即时可见）。测试服 + 正式服 compose 都已加 `PUBLISHED_APP_VERSION: ""` 环境变量行（在 DATABASE_URL 行后），部署脚本见 `03-deploy-and-servers.md` 更新后的流程。

5. **提示条只在右侧内容区左右居中**（`version-update-notifier.tsx`）：动态量 `.flashmuse-sidebar` 实际宽度（展开 262/收起 80/隐藏 0，ResizeObserver+resize+1s 兜底轮询），`left: calc(50% + 菜单宽/2)`，不算左侧主菜单。无 sidebar 的页面 = 整屏居中。

6. **用户信息菜单：工作流里点任意空白也能关**（`chat-workbench.tsx` 约 10566）。根因：原来靠 `window` 冒泡阶段监听 click 关菜单，但工作流 tldraw 画布在冒泡阶段 `stopPropagation` 吞掉 click → 收不到 → 关不掉（对话流没画布所以正常）。**修法**：改**捕获阶段** `addEventListener("click", closeMenu, true)` + 新增 `userMenuRef`/`userMenuButtonRef` 判断点击是否在菜单/头像按钮内（内则不关）。监听器只在菜单打开时存在、单次 click 判断、不吞事件 → **不影响工作流性能/行为**。三处（对话流/工作流/资产库）共用同一份逻辑，一处改全生效。

### 部署（测试服 v37→v41 多次；正式服一次整份对齐 v41）
- 打包踩坑：首个 tgz 含 `public/`（home-assets 图片）达 150MB、跨境 scp 反复断 → 之后一律 `--exclude=./public`（本批没动 public，服务器已有），降到 ~26MB。scp 加 `-o ServerAliveInterval=15 -o ServerAliveCountMax=8` 抗断。
- **正式服部署**（本次）：备份 `/opt/flashmuse/app-backups/20260724-215621-presync-v41` → rsync staging→prod（不再 bump，带 v41）→ 加 compose `PUBLISHED_APP_VERSION` 行 → `up -d --build`（无 pending 迁移）→ `/tmp/syncali.sh`（阿里正式镜像）→ 发布 `PUBLISHED_APP_VERSION=v1.0.0.41 + force-recreate` → `/tmp/health.sh` 四域名 200、公网 main = v1.0.0.41。
- 本批带上正式服的完整内容 = 07-22~25 编辑菜单整套（去背景/橡皮/多模型候选链/下载/后台编辑开关，**首次上正式服**，含新依赖 `@imgly/background-removal-node` + 脚本 `scripts/remove-background-worker.mjs`）+ 本对话 6 项。commit+push GitHub。

## 2026-07-25（去背景等待卡尺寸修复 + 橡皮工具全套根治 + 菜单精简+下载原图 + 后台编辑功能设置/模型三档开关）—— ⚠️ 仅本地，未 commit 未部署；⭐ 下一个 AI 要直接部署（先测试服再正式服）

**背景**：接 2026-07-24 那批继续。全程本地 `npx tsc --noEmit` 全绿。基线仍 `v1.0.0.36` / `dd37a78`（GitHub/正式服/测试服都还在这，本地累积了 07-22~07-25 一大批未提交改动）。**用户新交代两条：① 以后"叫你测试才测试"，用户会自己测很多东西，不要每次自动跑 Playwright；② 这批要求下一个 AI 直接部署服务器（走 03 的 测试服→正式服 流程）。**

### 已做（本对话）

1. **去背景「等待卡尺寸不对」根治**：`generateImageForNode`（`workflow-tldraw-canvas-inner.tsx` 约 3971 / 3992）发起时无条件 `visualSize: undefined`，把 `createImageEditNode` 刚锁好的源图显示尺寸清掉了 → 等待卡回落默认 16:9；结果卡因 `applyImageNodeResult` 用捕获的旧 node 恢复了 visualSize 所以正常，导致"只有第2步等待卡尺寸错"。修法：初始 `updateNode` 对 `node.data.transparentImage` 节点**保留 visualSize**（与 `applyImageNodeResult:3922` 同条件）。→ 原图→等待卡→结果卡三步尺寸一致。

2. **橡皮工具（局部消除）全套根治**——之前根本没做成，实测只是整图重绘/换人：
   - **查明本质**：两家（OpenRouter Image API `/api/v1/images`、BytePlus `/images/generations`）**都没有 mask/inpaint 蒙版通道**，只有"参考图+提示词"的整图 img2img。seedream 这类是重绘模型，涂个紫圈让它"移除"→它会重画整张（换人/皮肤变白）。Lovart/LibTV 登录墙+Cloudflare 进不去、抓不到它们接口，但业界这类"消除"靠 mask-inpaint 或指令式编辑模型（nano-banana/Gemini flash image）。
   - **模型**：橡皮从 `seedream-5-0-pro` 换成 **`google/gemini-3.1-flash-image-preview`**（指令式局部编辑、擅长"改指定处、其余保留"）。
   - **实心灰蒙版是关键**：用户涂的仍是**半透明紫**（canvas 存纯不透明色 `rgb(168,85,247)` + CSS `opacity-50` 显示；避免重叠叠加变深），但**导出给模型的参考图里，用涂抹区当蒙版把该区填成完全不透明中性灰 `#808080`**（`source-in` 合成），彻底盖住底下主体 → 模型看不见原物、才肯"当没东西补背景"。提示词改成"移除灰色遮挡区域内物体并自然补全、不保留被遮挡物"。→ 实测涂整个人也能删干净并补花园背景，其余不变。
   - **橡皮尺寸/比例贴源图**：用 `getWorkflowNodeNaturalSize(node)` 取源图尺寸（不要用 display 图，会被压成小尺寸误判 1K），按每个候选模型算最接近的 ratio+resolution。
   - 半透明修复涉及：arc/stroke 改纯色、canvas 加 `opacity-50`、导出蒙版填灰。

3. **高清 + 橡皮 = 多模型候选链（首选失败自动降级）**：新增模块常量 `EDIT_MODEL_CANDIDATES = [gemini-3.1-flash-image-preview, gemini-3-pro-image-preview, byteplus:conversation-image.seedream-4-5]`。`createImageEditNode` 加 `modelCandidates?/highDef?` 选项：按序尝试，前一个抛错自动换下一个（换模型时同步节点显示的 model/比例/分辨率），**三个都失败才显示失败卡**。高清=highDef(4K)、橡皮=贴源图尺寸。

4. **快捷菜单精简**：删掉 编辑元素 / 编辑文字 / 多角度 / 移动对象 四个按钮（用户以后要加别的）。菜单现只剩 快捷编辑 / 高清 / 去背景 / 橡皮工具 + 下载。（`createImageElementSplitNodes` 及相关 import 变成未引用但保留，无害。）

5. **下载按钮实现**：菜单最后的下载键 = 下载**原图**到本地（`getStaticMediaUrl(url) ?? url`，**不要用 `getImageDisplayUrl`——那是缩略图**，最初错用缩略图已修）。fetch→blob→a[download]，文件名跟随资产名补 .png，失败兜底 `window.open`。

6. **后台「工作流·图片编辑功能」设置（放进模型开关页新板块）**：
   - 只读**规则说明表**：快捷编辑/高清/去背景/橡皮 各一行写清逻辑与尺寸策略。
   - **高清+橡皮各一组"首选/次选/三选"模型开关**，关掉首选自动用次选三选、全关回落完整链。
   - 全链路：新增 settings 字段 `editModelToggles: Record<"<func>:<modelId>", boolean>`（默认全 true，`func` ∈ {hd, eraser}），存 `.env.local` 的 `EDIT_MODEL_TOGGLES`（`system-settings.ts`：`AdminSystemSettings` 字段 + `EDIT_FUNCTION_MODEL_CHAIN`/`EDIT_FUNCTION_KEYS`/`DEFAULT_EDIT_MODEL_TOGGLES` + getter/updater）→ `/admin/api/system-settings` 合并式读写 → `/api/model-availability` 下发 → `chat-workbench` 存 state 传 `editModelToggles` 给 `WorkflowCanvas` → 前端 `getEditCandidates(func, toggles)` 按开关过滤 `EDIT_MODEL_CANDIDATES`（保序，全关回落完整链）。前端候选链顺序 = system-settings 的 `EDIT_FUNCTION_MODEL_CHAIN` = admin 面板 `EDIT_MODEL_CHAIN`，三处必须一致。

### 本对话改动文件（都未 commit）
- `src/components/workflow-tldraw-canvas-inner.tsx`（去背景 visualSize 保留、橡皮换 Gemini+实心灰蒙版+半透明显示、`EDIT_MODEL_CANDIDATES`/`getEditCandidates`、`createImageEditNode` 候选链+highDef、菜单删4键、下载原图、`editModelToggles` 传入 runtime + 高清/橡皮按钮用 getEditCandidates；`WorkflowCanvasProps` 加 `editModelToggles`）
- `src/components/workflow-tldraw-canvas.tsx`（wrapper props 加 `editModelToggles`）
- `src/components/chat-workbench.tsx`（`editModelToggles` state + 从 `/api/model-availability` 读 + 传给 WorkflowCanvas）
- `src/lib/system-settings.ts`（`editModelToggles` 字段 + 常量 + get/update 持久化）
- `src/app/api/model-availability/route.ts`（下发 `editModelToggles`）
- `src/app/admin/api/system-settings/route.ts`（合并式接收 `editModelToggles`）
- `src/app/admin/admin-system-settings-panel.tsx`（编辑功能规则表 + 三档开关 UI/保存）

### ⚠️ 下一个 AI（重点）
- **直接部署**：这批（含 07-22~07-25 全部本地改动）走 03 的部署流程——**先测试服（`node scripts/bump-version.mjs` 版本+1）→ 验证 → 再原样同步正式服**。注意 07-22 那批新增依赖 `@imgly/background-removal-node` + `scripts/remove-background-worker.mjs` 要一并带上部署（接手环境先 `npm install`）。
- **测试习惯**：用户会自己测，**别每次自动开 Playwright**，等用户说"测试"再测。
- 未做/待定：编辑类定价（去背景/橡皮本地或云成本差异是否调价，待用户定）；去背景资产库 model 标签是否清（待用户定）；候选链"失败自动降级"只在真有模型报错时触发，本地只验证过首选成功路径。

## 2026-07-24（快捷编辑输入框样式统一 + 全平台弹窗层级统一 + 高清换 Gemini + 去背景显示/尺寸/参数收尾）—— ⚠️ 仍在 2026-07-23 那批之上继续，仅本地，未 commit 未部署

**背景**：接 2026-07-23 那批继续。本对话都是在已有编辑类功能上的**打磨/修正**，无新功能。全程本地 `npx tsc --noEmit` 全绿，仅本地未 commit 未部署。基线仍 `v1.0.0.36` / `dd37a78`。

### 已做

1. **快捷编辑输入框样式对齐工作流其它输入框**（`workflow-tldraw-canvas-inner.tsx` 约 2415-2453 那个 `quickEditOpen` 浮层）：
   - 容器改磨砂玻璃质感（`border-2 border-[#f1f2f2] bg-white/78 backdrop-blur-[18px]` + focus 态白边/阴影），底框圆角 `rounded-[22px]`→`rounded-[16px]`。
   - 发送按钮统一成和生成按钮一致（`h-9 w-9 rounded-[10px] bg-[#111111]`，disabled 变灰）。
   - textarea 加 class **`workflow-prompt-textarea`**，字号/行高由 `globals.css:115` 那条全局 `font-size:14px!important; line-height:24px!important` 统一控制 → 和图片/视频节点输入框完全一致；以后要整体调大只改 globals.css 一处。（中途一度加到 16/18px，用户最终要求"统一成节点输入框大小"=14px。）

2. **全平台弹窗层级统一**（用户规则：用户中心这类弹窗永远最上层、黑遮罩在其下、其它内容都在遮罩下）：
   - 根因：这类居中弹窗遮罩原是 `z-50`，但工作流画布里的工具栏菜单/提示/右键菜单/快捷编辑框是 `z-[9999]~z-[10000]`，所以在工作流里打开用户中心，工作流 UI 会盖在弹窗上。
   - 改法：把主端全部全屏居中弹窗遮罩 `z-50`→**`z-[11000]`**（高于一切页面内浮层）。涉及 `chat-workbench.tsx`（用户中心 / 生图弹窗 / 资产预览 / 3 个确认框，共 6 处）、`app/page.tsx`（登录面板）、`admin` 三面板（积分/用户/记录的详情弹窗+加载弹窗，共 8 处）。
   - 保持不动：工作流内部资产导入（`z-[10050]`）、删除确认（`z-[10002]`）本就在工作流浮层之上、彼此不冲突；admin-credits 那个无黑底的隐形 popover 关闭遮罩也没动。
   - ⚠️ 踩坑：改 admin 三文件时一度用 PowerShell `Set-Content -Encoding utf8` 批量替换，把中文全变乱码（铁律明确禁过），已 `git checkout` 回滚、全部改用 edit 工具重做。**再次强调：改任何含中文的源码只用 edit 工具。**

3. **高清模型 Seedream 4.5 → Gemini 3.1 Flash**（用户实测 Seedream 4.5 不听话、会改内容）：
   - 高清按钮 `createImageEditNode(node, { model: "google/gemini-3.1-flash-image-preview", resolution:"4K", ratioFromSourceImage:true })`。其它不变（4K、比例贴合原图、上传图取最接近比例）。用户实测效果不错。
   - Gemini 3.1 Flash 是 `models.ts:88` 的正式前端图片模型，支持 4K。⚠️ `createImageEditNode` 只在该 model 属于**当前启用的 imageModels** 时才用它，否则静默回落源模型——如发现高清没用 Gemini，去 admin 确认它已启用。

4. **去背景显示收尾**（用户报"去背景不是真透明、只是变灰"）：
   - 真因不是抠图坏了，而是**显示容器底色写死灰 `#e6e6e6`**（`ImageDisplayCard`）：透明 PNG 透出这层灰 → 看着像变灰。服务端抠图链路本身是对的（真 alpha）。
   - 改：`ImageDisplayCard` 图片容器底色改为——**去背景/抠图产出的透明图透明、其它生图仍灰底占位**（远程 url 慢加载期要灰底）。判定用**"创建时标记 + 运行时真实 alpha 检测"兼用**：
     - 新增 `WorkflowNodeData.transparentImage`，`createImageEditNode` 里 `bgRemove||transparent` 时置 true（即时透明、无灰闪）。
     - 新增 `useImageHasAlpha(url)` + `detectImageHasAlpha` + `imageAlphaCache`（模块级缓存）：只对**同源本地 `/generated` 相对路径**图片做 canvas 采样（≤64×64、透明像素>8 判透明），远程 http/blob/data 一律不检测（保持灰底）。各入口(腾讯/阿里)都用相对 `/generated` 同源检测、不会被 CDN 跨域污染。→ **自愈本次更新前已存在的去背景图**（它们没标记，靠检测恢复透明）。
     - 容器底色 = `transparentImage || hasAlpha ? "transparent" : "#e6e6e6"`。
   - （中途试过棋盘格底，用户否了——他要纯透明，"移动图片和其它图叠加就能看出是不是透明"。）

5. **去背景参数/尺寸收尾**（用户："去背景不调模型，参数不该有模型；尺寸该和原图一样；等待/生成/失败三卡同图尺寸必须一致"）：
   - `createImageEditNode` 里 `bgRemove` 节点的 `node.data.model/ratio/resolution` 全置 `undefined`（节点头只剩尺寸；仍传个 model 给 API，服务端 bgRemove 分支忽略）。
   - 三卡尺寸一致 = 用**源节点当前实际显示尺寸** `getWorkflowNodeVisualSize(sourceNode)` 作 `visualSize`（尊重源图被缩放过的情况），且 `applyImageNodeResult` 对 `transparentImage` 节点**保留 visualSize**（普通生图仍清空回落自然尺寸）。这样等待卡(无图走 visualSize)=生成卡(有图 clamp 回 visualSize)=失败卡，都=源图显示尺寸。

### 本对话改动文件（都在 2026-07-23 那批之上，均未 commit）
- `src/components/workflow-tldraw-canvas-inner.tsx`（快捷编辑框样式、`transparentImage` 字段、`useImageHasAlpha`/`detectImageHasAlpha`/`imageAlphaCache`、`ImageDisplayCard` 底色、`createImageEditNode` 高清换 Gemini + bgRemove 清参数/锁 visualSize、`applyImageNodeResult` 保留 visualSize）
- `src/components/chat-workbench.tsx`（6 处弹窗 `z-50`→`z-[11000]`）
- `src/app/page.tsx`（登录面板 `z-[11000]`）
- `src/app/admin/admin-credits-panel.tsx`、`admin-users-panel.tsx`、`admin-records-panel.tsx`（弹窗 `z-[11000]`，共 8 处）

### ⚠️ 下一个 AI 注意 / 未做
- 用户指定的**编辑文字 / 多角度 / 移动对象**三个按钮仍未做（见 2026-07-23 条目，`workflow-tldraw-canvas-inner.tsx:2398-2400` 目前是无 onClick 的占位按钮）。
- 去背景生成的**资产进资产库**时，`onGeneratedMedia`/`applyImageNodeResult` 那条仍带着计算出的 `input.model`（类型强制 ModelName），所以资产库预览里可能仍显示模型标签。工作流节点本身已干净。用户问过是否也清掉资产那条的 model，**尚未定**。
- 去背景尺寸一致的边界情况（源图特殊 clamp）若仍有偏差，让用户报"源图显示尺寸 vs 等待卡尺寸"具体差值再精调。

## 2026-07-23（编辑类五功能：透明抠图根治 + 快捷编辑/高清重做 + 轮询不刷新根治 + 错误中文透出）—— ⚠️ 仅本地，未 commit 未部署

**背景**：接上一批（2026-07-22）本地开发的"编辑类快捷菜单"。本对话把去背景/编辑元素/橡皮三个未跑通的功能测通并根治，重做了快捷编辑/高清，并修了两个真 bug。全程本地 dev + Playwright 实测，`npx tsc --noEmit` 全绿。**未 commit、未部署**。

### 关键认知（务必记住，别再走弯路）
- **两家出图 provider 在本环境都产不出真透明 PNG**：
  - `openai/gpt-5.4-image-2` 经 OpenRouter → **拒绝** `background:"transparent"`（上游 400，只接受 `auto`/`opaque`；`auto` 出的图 `channels:3` 无 alpha）。2026-07-22 交接里"gpt 直连支持 transparent"的假设是**错的**。
  - BytePlus Seedream 5.0 Pro → 能出 `.png` 但 `channels:3` 无 alpha（背景没被抠掉）。
  - 结论：靠"模型 prompt 出透明底"这条路走不通 → **去背景/编辑元素透明主体层改为服务端本地抠图**（方案 A，用户拍板）。

### 已做（全部本地实测通过）

1. **去背景 = 本地抠图**（`@imgly/background-removal-node`，自带 onnx 分割模型，产真 alpha PNG，约 1~3s/张）。
   - 新增 `src/lib/background-removal.ts` + `scripts/remove-background-worker.mjs`。**推理跑在独立 node 子进程**里（onnxruntime 原生库在 Next 主进程内跑会整进程崩溃，实测崩过；子进程隔离后稳）。
   - `next.config.ts`：`serverExternalPackages` 加 `@imgly/background-removal-node`、`onnxruntime-node`（否则被 Turbopack 打包，wasm/onnx 资源路径失效报 `Unsupported format`）。
   - `generation-jobs.ts`：`CreateImageJobInput` 加 `bgRemove`；`runImageJob` 里 `extraJson.bgRemove` 为 true 时**跳过出图 provider**，对 `referenceImages[0]` 跑本地抠图→存透明 PNG（`saveDataUrlAsset(...,{keepTransparent:true})`）→走统一 `localizeAndFinalizeImages`（落库/扣费一致）。
   - UI 端到端实测：右侧新节点、落库 `.png`、`hasAlpha:true channels:4`（alpha 17~249，主体不透明背景透明）。
2. **编辑元素**（两重叠节点）：背景层 = gpt 内容感知补全（移除主体+补全，不透明 `.jpg`）；主体层 = 本地抠图透明 PNG（`bgRemove:true`）。两节点同坐标重叠、可拖开。实测通过。
3. **橡皮工具**：修了**真 bug**——涂抹 div 的 `onPointerDownCapture={stopCanvasPointer}`（捕获阶段 `stopPropagation`）会把同元素冒泡阶段的绘制 `onPointerDown` 一起跳过，导致**根本涂不上**（真人也涂不了，这就是它一直没验证通过的根因）。改成绘制逻辑放捕获阶段（`onPointerDownCapture/MoveCapture/UpCapture` 里做绘制+stopPropagation）。实测：涂抹正常→"立即使用"合成紫标 dataURL→Seedream 5.0 Pro 内容感知补全→出图。
4. **错误真实原因中文透出**（用户要求）：`generation-jobs.ts` 编辑类任务(`editFunction:true`)失败时不再套通用"服务器繁忙"，改用 `editErrorFallback` 透出真实原因；`error-message.ts` 加"不支持所请求参数(no provider/not supported.accepted)"→中文映射。之前 gpt 400 被吞成"服务器繁忙"、B_ 码只是全局自增序号（不是上游码），坑了很久。
5. **轮询成功后不刷新不显示 = 根治**（用户报的第一个问题）：`pollMountedRef` 被一个"只有 cleanup 没有 setup"的 effect（`useEffect(() => () => {...}, [])`）在 React 严格模式（Next dev 默认开）mount→cleanup→mount 时置成 `false` 且**再没置回 true** → `pollImageNode` 等所有轮询守卫直接 return → 前端完全不轮询（实测发起后 `/api/generation-status` 请求数=0）→ 节点一直转等待卡、成功后不显示、必须刷新（刷新靠后端已落库结果重建）。改成正常 mount effect（setup 置 true、cleanup 置 false）。修后轮询恢复、节点不刷新自动出图。**注意：这是严格模式(dev)专属，生产不双跑 effect 不受影响，但本地 dev 测试必踩。**
6. **快捷编辑重做**（用户要求：和原图同模型/尺寸/比例，保证输出尺寸一致）：`createImageEditNode` 加 `matchSourceImage`。判断"源模型+源参数能否重现源图实际尺寸"（生成图天然一致→直接沿用源 model+ratio+resolution；**上传图/对不上→统一用 Seedream 4.5，比例+分辨率取最接近原图实际尺寸的档**）。不再写死 gpt。实测 gpt 源图→快捷编辑用 gpt 16:9 2K→输出 2560×1440=源图一致。
7. **高清重做**（用户要求）：改成**统一 Seedream 4.5 + 4K + 贴合原图比例**（`ratioFromSourceImage`）。实测输出 5504×3040（源 2K→真 4K）。之前是 gpt 固定 2K（源已 2K 时等于没变高）。
8. 新增工具 `closestWorkflowRatioLabel`(真·最接近比例,无容差)、`closestResolutionForImageDimensions`(按像素挑最接近分辨率档)；`createImageEditNode` 分辨率统一 `normalizeImageResolutionForModel` 归一化到实际 model（修了"model 切走但 resolution 没跟着归一化"的不一致）。

### 本对话改动文件（在 2026-07-22 那批基础上继续，均未 commit）
- 新增：`src/lib/background-removal.ts`、`scripts/remove-background-worker.mjs`
- 改：`src/components/workflow-tldraw-canvas-inner.tsx`（bgRemove/matchSourceImage/ratioFromSourceImage、橡皮涂抹修复、pollMountedRef 修复、快捷编辑/高清按钮、两个 ratio/resolution 工具）、`src/lib/generation-jobs.ts`（bgRemove 分支+editFunction 错误透出）、`src/app/api/image/route.ts`（透传 bgRemove/editFunction）、`src/lib/error-message.ts`、`next.config.ts`、`package.json`/`package-lock.json`（新依赖 `@imgly/background-removal-node`）
- 沿用 2026-07-22 的 `local-assets.ts`/`media-save-queue.ts`/`openrouter.ts` 的 `keepTransparent` 落库旁路（本地抠图 png 靠它不被转 jpg；gpt `background:transparent` 那段现已成死代码但无害，未触发）

### ⚠️ 下一个 AI 注意 / 未做
- **扣费与正常生图完全同一套**（`workflow_image_generation`，按 model+分辨率算）。去背景/编辑元素本地抠图几乎零成本但仍按图片计费——**定价是否要调，用户还没定**。
- **上传图源的快捷编辑兜底**（→Seedream 4.5 最接近尺寸）逻辑已写好+tsc 过，但**只在生成图源上跑通了端到端**，上传图源没在浏览器实测。
- **橡皮小体验**：节点在画布上很小时，280px 的橡皮设置面板会盖住涂抹区（缩放正常时不会）。
- 用户说**下一个 AI 继续改另三个功能**：编辑菜单里还有 **编辑文字 / 多角度 / 移动对象** 三个按钮（目前实现/是否跑通未知，需先排查现状）。
- 本地 dev 登录会话会过期，重登：首页"登录"→"密码登录"→邮箱 `12424740@qq.com`→密码 `dragonstar`；工作流 `工作流_04` 有多个图片节点可测；低缩放下自动化选节点不稳。改中文源码只用 edit 工具（禁 PowerShell Set-Content，会乱码，本次又踩了一次已回滚）。

## 2026-07-22（本地开发：工作流图片节点「编辑类快捷菜单」五功能）—— ⚠️ 仅本地未部署，部分未跑通验证

**背景/参考**：对标 lovart.ai 画布，为工作流图片节点做一排"编辑快捷菜单"。查了 OpenRouter + BytePlus 两家官网能力（用 Playwright MCP 读渲染后的 BytePlus 文档）。结论：`gpt-5.4-image-2` 直连支持 `background:transparent`+`output_format:png`（真透明抠图）；BytePlus `dola-seedream-5-0-pro-260628` 支持"交互式编辑"（`<point>`/`<bbox>` 坐标、自由涂抹标记局部重绘）与"多层图像生成"；两家都**没有真超分/mask inpaint 专用端点**。

**铁律（用户强调，务必延续）**：所有编辑功能结果一律在**选中图片右侧新建节点**跑等待卡、成功显示图，**绝不覆盖原节点**；节点只有用户删除才消失。所有需要透明输出的图**禁止走 png→jpg 转换**。

### 已实现（`npx tsc --noEmit` 全绿，dev 正常；均本地，未部署）

**统一入口**：`workflow-tldraw-canvas-inner.tsx` 新增 `createImageEditNode(sourceNode, options)`（源图右侧建图片节点 + 走现有 `generateImageForNode → /api/image(async) → runImageJob` img2img 链路），options 支持 `prompt/model/ratio/resolution/transparent/position/referenceImageOverride/select`。另有 `createImageElementSplitNodes`（编辑元素两层）。都挂进 `WorkflowRuntime`。

1. **快捷编辑**（✅ 已完整跑通验证）：选中图片→顶部菜单点「快捷编辑」或按 **Tab**→图片下方出输入框（现有样式、同宽、1 行高可增到 3 行再滚动、2000 字、右侧发送按钮 `RiArrowUpLine`）。发送→右侧新节点用 **gpt-5.4-image-2 直连** img2img（源图当参考图+指令）。实测出图、扣 9 积分、不覆盖原节点。
2. **高清**（🟡 观察到 2K 任务在跑，未看到最终成图）：菜单「放大」已按用户要求改标签为**高清**。直接跑 `createImageEditNode(node,{prompt:保持内容不变提清晰, model:gpt直连, resolution:"2K"})`。⚠️ 无真超分，本质重绘，可能微改内容——用户已知悉、先接受，不行再换专用超分。
3. **去背景**（🟡 参数链路正确，但测试时 provider 返回 **B_211 服务器繁忙**，未在一次成功生成上确认 PNG 保留）：`createImageEditNode(node,{prompt:只留主体透明底, model:gpt直连, transparent:true})`。
4. **编辑元素**（🔲 未跑通验证）：`createImageElementSplitNodes` 固定两层——背景层(gpt,移除主体+内容感知补全)不透明 + 主体层(gpt,transparent)透明，两节点**同坐标重叠**（先建背景在下、后建主体在上）。多层输出的 Seedream 原生 API 未确认，先固定两层（符合用户"先固定两层"退路）。
5. **橡皮工具**（🔲 未跑通验证）：菜单「橡皮工具」→右侧出菜单盒（标题+`RiResetLeftLine`重置、滑块调笔刷 5~100、取消/立即使用）。鼠标变圆形笔刷在图上涂 `rgba(168,85,247,0.5)` 紫色（canvas 覆盖在节点图上，屏幕坐标）；立即使用→把原图+紫色涂抹合成 PNG dataURL 作为 `referenceImageOverride`，用 **Seedream 5.0 Pro**（`byteplus:conversation-image.seedream-5-0-pro`）跑"移除紫色标记区域+周围内容自然填补"。去除=内容感知填补（非留洞）。

### 后端改动（opt-in，默认路径零改动；影响共用链路，务必知悉）
沿 `/api/image` 共用链路（对话流/工作流/Agent/资产库共用）加了一个 `transparent` 透传，**只在编辑功能显式传 true 时生效**：
- `src/app/api/image/route.ts`：body 加 `transparent?`，async 分支传给 `createImageJob`。
- `src/lib/generation-jobs.ts`：`CreateImageJobInput` 加 `transparent`，写入 `extraJson.transparent`；`runImageJob` 读 `job.extraJson.transparent` 传给 `generateOpenRouterImage`。
- `src/lib/openrouter.ts`：`ImageGenerationOptions` 加 `transparent`；gpt `buildBody` 加 `background:"transparent"+output_format:"png"`；BytePlus body `output_format` 按 transparent 选 png/jpeg；`saveImageForDisplay(meta.transparent)` → `saveGeneratedAsset/enqueueRemoteAssetSave({keepTransparent})`。
- `src/lib/local-assets.ts`：`SaveAssetOptions` 加 `keepTransparent`；**`encodeGeneratedImageBuffer` 开头若 `keepTransparent` 则直接返回原 buffer（png），跳过 flatten+jpeg**（第 182 行附近，这步原本会把透明底填白转 jpg）。三处调用点透传。
- `src/lib/media-save-queue.ts`：`MediaSaveJob` + `enqueueRemoteAssetSave` 入参加 `keepTransparent`，`saveRemoteAsset` 调用透传（BytePlus 远程图走这条队列）。
- 前端 `generateImageForNode` 入参加 `transparent`，POST body 带上。

### ⚠️ 下一个 AI 必须继续测试/确认的（都没跑通一次成功）
1. **去背景**：provider 不忙时重试，确认结果是**真透明 PNG**（存的是 `.png`、透明底没被填白）。查落库文件扩展名 + 打开图看 alpha。
2. **编辑元素**：确认生成**两个重叠节点**、能拖开、主体层透明。
3. **橡皮工具**：确认①涂抹 UI/笔刷/滑块正常；②合成的紫色标记 dataURL 作为参考图**能正常传到 Seedream 并出图**（风险点：dataURL 作为 `referenceImages` 经 `createImageJob→resolveReferenceUrls` 是否被正确处理，需重点验证）；③结果是紫色区域被内容感知移除。
4. **共用链路回归**：确认加 `transparent` 后，**普通生图（对话流/工作流/Agent/资产库，transparent 未传）完全不受影响**（默认仍转 jpg、行为不变）。
5. 已知无关噪声：测试中 gpt 直连出现 `B_211 服务器繁忙`（上游临时错误，非本次代码问题）。

### 测试环境备忘（给下个 AI）
- 本地 dev：`npm run dev`（端口 3000）。改中文源码**只用 edit 工具，禁止 PowerShell Set-Content**（本次两次踩坑：Set-Content 把 openrouter.ts/workflow 文件中文变乱码，已 `git checkout` 回滚重做）。
- 若 dev 报 `Code generation for chunk item errored`（Turbopack 缓存了坏模块），停 dev + `Remove-Item .next` + 重启。
- 本地登录=测试服账号：登录页选"密码登录"，邮箱 `12424740@qq.com`，密码 `dragonstar`（提交邮箱→输密码→登录）。工作流 `工作流_04` 有多个图片节点可测。6% 缩放下 tldraw 虚拟化离屏节点、自动化选节点很不稳，建议先「定位节点」或手动缩放。
- 工作树尚未 commit；本批改动文件：`workflow-tldraw-canvas-inner.tsx`、`api/image/route.ts`、`generation-jobs.ts`、`openrouter.ts`、`local-assets.ts`、`media-save-queue.ts`。

## 2026-07-21（交接文档归档重建）

- 用户指出交接文档已超 1.2MB（CHANGELOG 580KB / 01 276KB / 05 200KB）。按"交接文档维护规则"把整批当前文档归档进 `handover/historical-handover-docs-last-used-2026-07-21/`（11 个 .md，只读），重写一批精简的新当前文档：`00-README`/`01-current-status`/`02-architecture-and-data`/`03-deploy-and-servers`/`04-product-rules`/`05-next-actions`/`06-memo-tasks`/`CHANGELOG`。
- 新文档保留所有仍有效的关键内容：三条铁律、腾讯 Docker 部署流程（正式服+测试服）、服务器全景/密钥/踩坑、数据表/媒体链路/上传链路/资产分类、`getAssetIdentityKey` 去重规则、产品规则、活跃备忘 M001~M019。删去了已过时的马来 PM2 流程细节、逐条历史部署备份名、腾讯迁移过程流水（这些在归档里）。
- 归档文件夹 `historical-handover-docs-last-used-*` 只读，勿改勿删。更早还有 `historical-handover-docs-last-used-2026-06-20/`。

## 2026-07-21（部署 session：部署正式服 v1.0.0.34 + @引用资产滚动条常驻 + 修@引用资产重复视频/资产）—— ✅ 四方同步 v1.0.0.36 / `dd37a78`

**状态**：本对话按用户指令先把上一 session 的 v1.0.0.34 部署上正式服，又做两个 @引用资产弹窗改动并再次部署，最终四方同步 **v1.0.0.36 / commit `dd37a78`**（+ handover doc commit），四域名 200，无遗留。无本对话新增 Prisma 迁移。

### 1. 部署正式服 v1.0.0.34（上一 session 积压）
- 确认测试服=v34/正式服=v25/仅差迁移 `20260721000000_media_asset_duration_float` → 备份 → `rsync` staging→prod → `docker compose up -d --build flashmuse-app`（entrypoint 自动 apply 迁移，核验 `MediaAsset.durationSeconds`=double precision）→ 同步阿里正式镜像 → 四域名 200、公网 v1.0.0.34。正式服原样带 v34、未自增。
- 正式服 DB 跑 `scripts/backfill-prompt-mentions.js`（docker cp 进容器 `/app` 跑）：fixed=0 / alreadyOk=84 / skipped=3 / total=262（数据本就基本干净；3 个@名与参考图数量不匹配被安全跳过）。
- commit+push GitHub `8986fe1..5bb0fc2`（29 文件，含道具 prop_image 全套 + 工作流用量计数修复 + B_232/B_252 + 迁移 + `/api/generation-references`）。

### 2. @引用资产弹窗左侧分类"滚动条常驻"（v1.0.0.35，`asset-mention-picker.tsx`）
- 需求：新增道具分类后左侧显示不全，用户不想加高弹窗，要溢出时滚动条常显可下拉。
- 改：左侧分类 div 加类 `mention-cat-scroll` + 注入 `<style>`（`scrollbar-width:thin` + `::-webkit-scrollbar{width:8px}` thumb `#c7c7c7`）。用 `overflow-y-auto`（非 scroll，避免无溢出时占 gutter）——定义了 `::-webkit-scrollbar` 后浏览器改用非叠加式滚动条，溢出常驻可见、无溢出（如资产库生成弹窗 6 个图片分类）不显示。三处 @引用资产共用此组件=一处改全覆盖。

### 3. 修「@引用资产同一上传视频/资产显示成两个」（v1.0.0.36，`chat-workbench.tsx`）
- 现象（测试号 12424740 浏览器复现）：上传视频实际 2 个，点开 @引用资产 → `@1784181320556-1d99e327-c` 变两个共 3 个；回资产库刷新即恢复。
- 定位：服务端 `workspace-state?assetFilter=upload_videos` 只返回 2 条（干净）→ 前端 `assets` 里同一文件存了两份（一份 `<video>` 首帧无 posterUrl、一份 `<img>` poster，底层 url 相同）。
- 根因：`getAssetIdentityKey`(`chat-workbench.tsx:2617`) 原 `mediaId||归一化url||id`（mediaId 优先）。同一文件"消息内嵌引用(无 mediaId,key=url)"与"资产库懒加载权威记录(有 mediaId,key=mediaId)"两份 key 不同 → `loadMentionFilterPage` 合并时漏判成两条。
- 修：改成 **`归一化url||mediaId||id`（url 优先）**。url 是文件唯一身份 → 两份必合并（用带 posterUrl 权威版覆盖）。三处 @引用资产共用同一 `assets`+此函数+`isAssetInFilter`=一处改全覆盖所有分类（"上传图片"等同类隐患一并根治）。
- 验证：上传视频恢复 2 条无重复、上传图片首屏 30 无重复。

### 4. 部署正式服 v1.0.0.36 + push
- v35/v36 各 bump+打 patch 部署测试服验证 → 用户拍板部署正式服：备份 `/opt/flashmuse/app-backups/20260721-201737-presync-v36` → rsync→build→同步阿里正式镜像→四域名 200、公网 v1.0.0.36。commit+push `5bb0fc2..dd37a78`（3 文件：`asset-mention-picker.tsx`/`chat-workbench.tsx`/`app-version.ts`）。无 Prisma 迁移。
