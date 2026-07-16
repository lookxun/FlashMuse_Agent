# FlashMuse Handover

Last rebuilt: 2026-06-20

> **✅ 2026-07-22（部署 07-20+07-21 全部上线 + 一批工作流/UI 小改动 session）：把积压的 07-20（资产库改造 + 新依赖 `wavesurfer.js`）+ 07-21（@引用资产迷你资产库 + 从资产库导入音视频 + 视频卡@图标）两批一次性部署上线，并顺带做了几处小改。全部已部署腾讯 + 同步阿里、四域名 200、`tsc`+`build` 通过、无 Prisma 迁移、已 push GitHub（三方同步 `ac4c38f`）。`wavesurfer.js` 随镜像 build 自动装入（Dockerfile 内 npm install，无需宿主单独装）。本 session 新增小改动：① 工作流空图片/视频生成节点（无结果）输入框有提示词时删除弹通用确认框（为空直接删；覆盖键盘 Del/右键菜单/runtime.deleteNode 三入口；弹窗 z-[10002] 高于节点输入框浮层 z-[9999]；确定按钮黑色 bg-[#111] px-12 对齐导入弹窗）；② 图层面板右键不出菜单；③ @引用弹窗视频无封面（上传视频）用 `<video #t=0.1>` 首帧作封面、不再只显图标；④ @引用弹窗音频卡时间改"倒计时秒/总秒数"两位数（15/15→00/15）、移右上（加 `secondsCountdown` prop 隔离，其它地方不变）；⑤ 从资产库导入弹窗选中蓝框/勾移 DOM 末尾+z-50、盖住底部渐变黑。**已核查这些+07-20/07-21 改动不影响生成主链路/扣积分**（图片存盘重排队扣费仍幂等/只 finalize 扣一次；服务端只改资产库过滤展示；前端没动生成提交/扣费）。**下一个 AI**：可做浏览器全面验证 + 清理旧 mention 死常量；M018/M019 押后。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**部署踩坑记：Ali 同步 key 属主 root 一切到阿里的 ssh/rsync 都要 sudo；`/tmp/syncali.sh`+`/tmp/health.sh` 重启会清需重建；部署窗口旧标签报 ChunkLoadError 是固有现象、硬刷即可。**

> **🔒 铁律（2026-07-19 加，所有 AI 必须遵守，已同步进 `AGENTS.md` 顶部）：** ① 用户提需求时，**动代码前必须先排查本次需求会不会影响/破坏其它已有功能**（对话流/工作流/资产库/Agent/通用模式本质相同、常共用同一份代码）；**有影响先别动代码，先把影响范围告诉用户、等确认再改**，最大限度不把其它功能搞坏。② **默认只做本地、不部署**：用户没明确说"部署"，就只在本地改（`npx tsc --noEmit` 自查即可），不要 build / 不上腾讯 / 不同步阿里 / 不 push；用户说"要部署"才走部署流程。git 攒到一定程度再一次性推。

> **⚠️ 2026-07-20（资产库改造 session）：全部仅本地、未 build/未部署/未 commit；`tsc` 过；无 Prisma 迁移；新增 npm 依赖 `wavesurfer.js`（部署时服务器要 `npm install`）。** 主线=**资产库改造**：侧栏"上传图片"移到横线下、新建 `上传的资产`(圆点)分组含 上传图片/上传视频/上传音频（对话流+工作流所有上传合并）；上传视频=一行4+无 poster 用视频首帧封面、从"生成视频"移出；上传音频=波形播放器方卡(一行5，悬停播放、纯文件名无@)。服务端(`workspace-state` 过滤/计数)+前端(`isAssetInFilter`)同步改、`MediaAsset.mediaType` 透传前端(含 `media-assets` GET)、`conversation_uploads` 分页收窄到=计数(39)。附带：抽共享音频波形播放器 `src/components/audio-waveform-player.tsx`(wavesurfer.js，工作流音频节点改用它)、图片生成"存盘慢就重排队绝不丢库"改造(`runImageJob`，不再 60s 回退远程 url→国内本地跨境慢必现的"成功却不进库"根治，线上更稳)、手动补一张本地漏掉的分镜图。**下一个 AI 接着改造 `@引用资产` + `从资产库导入`（目前只图+视频，要让音频/视频也显示，交互先问用户）。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **✅ 2026-07-19（生成链路服务端断线重连改造 session）：从后台失败原因排查入手，做了一批修复 + 一个重要改造，全部已部署腾讯+同步阿里、四域名 200、tsc 过、无 Prisma 迁移，并已 push GitHub。① ⭐生成链路服务端断线重连：新增统一判定 `src/lib/transient-error.ts` `isTransientServerError`（网络/超时/5xx/Bad Gateway/平台临时[抓我们素材失败·事务超时·asset not found]/限流=可恢复重试；真人·版权·参数·审核拒绝·未知=永久不重试），接上三处缺口——图片任务 `runImageJob` 可恢复错误退避重排队（不再一次异常就毙）、视频创建 `createVideoTaskWithTransientRetry` 重试 3 次、`createBytePlusAsset`(auto-review 建素材)重试 3 次。**"真人检测→服务器繁忙"真因=送审重试时 BytePlus 抓我们参考图 url 撞我们瞬时 502→抓图失败→兜底，不是真人逻辑坏；用户定调不补映射、服务端自愈。** ② B_146=Seedream 5.0 Pro+多参考图报"当前模型不支持这组参数"（`openrouter.ts` disabled 分支漏 gate，给 Pro 发了它不支持的 `sequential_image_generation`）→ 加 `supportsSequentialBatch` gate。③ B_144=参考图宽高比越界(仅视频模型)→ `error-message.ts` 映射成"参考图太窄或太长…换 16:9/9:16/1:1/4:3"。④ 后台"失败原因"聚合：`admin-overview.ts` SQL 剥 `(B_xx)` 前缀 + 归一"图片平台没有返回图片"族 → 同原因合并一条、按量降序。⑤ 运维：腾讯宿主开 BBR(迁移漏了→跨境大文件传输崩溃致视频 aliSyncError 根因，6.8MB 视频 5 分钟传不完→4 秒)、阿里补同步 92 视频(现超集、走本地镜像不回源)、同步脚本修 `docker cp` 嵌套 bug(曾致工作台 ChunkLoadError)。**用户交代：过段时间回来复查 GenerationEvent 失败原因，看"服务器繁忙"是否下降、有无新可恢复错误要补进 `isTransientServerError`。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**

> **⚠️ 2026-07-18（视频三处根治 + 回填 session）：排查线上错误码牵出 3 个视频真问题全部根治 + 历史回填。① B_122=真人审核 `waitForBytePlusAssetActive` 在 CreateAsset 刚返回、GetAsset 未同步时第一次查 "asset not found" 就整单毙 → 改成只 Failed/超180s 才失败、瞬态继续轮询（历史 10 例全 ID_315163）；② B_135=参考音频以原始链接直传被 BytePlus 版权拦（图片走"Skip免审素材→asset://"能过、音频没走）→ 新增 `isBytePlusRecoverableReferenceError` 让音频/视频版权敏感也走 Skip 素材重试（实测：原始链接复现失败、Skip素材成功出片）；③ 对话流"@音频名删不掉"=`ensureMediaFileMentions` 强制把媒体@名拼进提示词最前（污染 prompt/content/cleanPrompt/等待卡、删了发送又补回），音频视频本靠附件数组送达与@名无关 → 去掉强制补名（是"存"的问题非读）。④ 历史回填 4 用户 50 视频 job 的强制@名（GenerationJob/WorkspaceSession/WorkspaceMessage/MediaAsset 四表，只剥"开头带音视频扩展名的@名"、备份在 runtime）。改动文件仅 `src/app/api/video/route.ts`+`src/components/chat-workbench.tsx`；已部署腾讯+同步阿里、四域名 200、tsc 过、无 Prisma 迁移；⚠️代码未 push GitHub，下一个 AI 需 commit+push。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**

> **✅ 2026-07-17（上传命名统一 + 资产库排序 session）：上传文件命名全平台统一（服务端唯一权威 `src/lib/upload-name.ts`，同图复用同名/异名即时错开 名_2/去扩展名/改名跟随，覆盖对话流·工作流·资产库的 图·视频·音频·文档）+ 资产库右侧按入库时间(firstSeenAt)稳定降序排序（修「别处上传后顺序跳、刷新才复原」）。连同 07-16 输入框统一那批一起：`tsc`+`build` 通过、已部署腾讯 flashmuse-app、已同步 `.next/static` 到阿里、四域名 200、已 push GitHub。无 Prisma 迁移。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**

> **⚠️ 2026-07-16（输入框统一 session）：@mention 逻辑全平台收敛为唯一 `src/lib/mention-text.ts` + 上传缩略图/资产库输入框对齐 + 选中覆盖 + 全平台唯一引用名 + 视频/音频/文档判重提示 + 资产库"上传成功却不显示"根治。（已随 07-17 session 一起部署+推送）**

> **✅ 2026-07-15（后台/工作流统一读取根治 session）：后台弹窗+工作流「使用提示词」的参考素材缩略图/@蓝字/干净提示词/视频尺寸全根治，全部已部署腾讯+同步阿里+push GitHub（连同 07-14 统一根治大 session 那批一起推）。** 要点：①后台参考素材匹配从「仅精确 requestId」改多口径（requestId→裸id前缀→workflowNodeId→messageId+kind），抽唯一 `buildJobReferenceItems` 后台+工作流共用；②参考图破图真因=对话流 `asset://<bytePlusAssetId>` 引用建 job 时没解析成真实 url，新增唯一 `resolveReferenceUrls` 前向修+回填 256 条；③视频没尺寸真因=从没量过视频宽高（`media-save-queue` 只量图片），新增 `getLocalVideoDimensions`（ffmpeg 解析，**不能用被降采样的封面**）前向修+回填 238 条；④sourcePrompt 混入 `参考图顺序:` hint 的历史数据回填剥离 190 条；⑤后台@不蓝=后缀不一致，`AdminPromptWithMentions` 加去后缀容错；⑥导入资产「使用提示词」无缩略图=只按工作流节点查，新增 `getGenerationJobByMediaUrl` 按媒体 url 回溯原始 job，对话流图回填 291 条 requestId（精确 `:image:序号`）；⑦对话流视频历史双卡 7 例手修。**前向保证：新生成天然带全 requestId/cleanPrompt/refs(asset:// 已解析)/尺寸，工作流「使用提示词」+后台弹窗都能带回——别再当 bug 查历史。** **⚠️ 教训：禁止用 `Set-Content` 改带中文源码（整文件 mojibake）；PowerShell 管道 psql 含中文 SQL 要先设 UTF8 编码。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **✅ 2026-07-14（统一根治大 session）：Agent/通用模型路由统一根治 + 工作流"使用提示词"存读用户真实干净prompt + 后台媒体弹窗参考素材缩略图/@蓝字 + 资产库生图去内部强制规则 + 视频本地存盘不限时根治 + 多批历史回填。（已随 2026-07-15 session 一起 push GitHub）**

> **✅ 2026-07-14（later session）最新：工作流"使用提示词"带图/@变蓝根治 + 等待卡计时平滑 + 回填 830 条历史 job，全部已部署腾讯 + push GitHub（含上一 session 另一 AI 的 handover commit `84582e5` 一起推）。** 现象=工作流视频右键"使用提示词"只回文字、无图、@不蓝。真根因=上次部署新加的"每8秒兜底reconcile"+实时轮询+resume **双重收尾同一视频**，先收尾者删入边、后收尾者拍到空快照并用 `undefined` 把好快照冲空。根治=弃脆弱的画布内 `generationUploads` 快照，改成**点"使用提示词"时读后端权威 `GenerationJob`**（新接口 `/api/workflow-generation-references`）；`GenerationJob` 加 `referenceNames` 列、建任务时反查名字写库；去掉画布 `generationUploads` 冗余写入（瘦身）；工作流等待卡加每秒 tick 平滑走秒；回填 830 条历史 job 名字（老视频也带图+蓝@）。对话流不涉及（它读消息里提交时就存的 imageReferences/uploadedFiles，天然稳）。有 Prisma 迁移 `20260714100000`（腾讯 entrypoint 自动 apply）。**新增备忘 M019：工作流整张画布存单个 canvasJson 大字段的结构隐患，以后重构。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条 + 06-memo-tasks M019。**用户铁律不变：资产原始数据出生即冻结永不变。**

> **✅ 2026-07-14 最新：修对话流视频/图片 3 个 bug（新模型 Seedance 2.0 Mini 触发暴露）——① 错误码红字误映射（Request id 数字子串如 401 被 HTTP 码正则命中，显示成"API Key 无效"）② 视频双失败卡（前台+后台两轮询器都无脑 +1 计数）③ 视频等待卡关浏览器重登录后消失（渲染依赖内存 pending，改按持久化状态）。均已部署腾讯 + push GitHub（`2db526b`/`e9ee160`/`04dafb0`）。图片同款双卡隐患也一并修。四路径×两问题已核查（工作流本来无此问题）。押后 M018 统一单轮询器重构。详见 CHANGELOG / 01-current-status 顶条 + 06-memo-tasks M018。**


> **✅ 2026-07-13（deploy session）最新：把前两批新模型改动部署上线（`7c66f85`）+ 修 3 个 bug 并部署（`b94c3ea`）+ 回填一批历史图名。腾讯=GitHub=本地 三方同步于 `b94c3ea`。** 本 session：①部署"模型开关5组+Terra + Seedream 5.0 Pro/Seedance 2.0 Mini + 校准计费/尺寸/多图 + 前端卡顿修复"；②修 Seedream 5.0 Pro 像素分档扣费（异步图拿不到实测尺寸→永远算高档，改用已知 targetDimensions 判档，1K=0.045/2K=0.09）；③修工作流节点成功/失败都不返回（恢复只在挂载/可见/聚焦触发、无周期兜底 → 加"有进行中节点就每8s重跑reconcile"）；④修统一读取的洞（工作流校准 effect 只纠正已有名、不补全空名 → 改为从库按url补全缺失名）；⑤线上DB事务回填 workflow_02（账号12424740=真实id **ID_636611**）三张7-07遗留空名图→image_2/3/4_w2；⑥后台上传规则面板补 Pro/Mini 标签。Seedance 2.0 的 4K **用户决定先不接**。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**用户铁律不变：资产原始数据出生即冻结永不变。**

> **⚠️ 2026-07-13 最新（later session）：新增 2 个 BytePlus 模型（Seedream 5.0 Pro 图片 / Seedance 2.0 Mini 视频）+ 全量按官网校准计费·尺寸·多图 + 修一个全局前端卡顿 bug。（已由上面 deploy session 部署上线）** 要点：Pro 调用名带 `dola-` 前缀、只支持 1K/2K/单图；计费 token×单价自算（图片像素分档+参考图、视频有无视频输入分档）；4.5/Lite 保留"一次出多张"、Pro/OpenRouter 走"申请N次"；Lite 补 3K；改路由后 dev 必须停 node+删 `.next` 重启。参考文档存 `E:\project\【1】Api key\Byteplus\`（api key/模型价格/tutorial）。详见 CHANGELOG / 01-current-status / 05-next-actions。

> **⚠️ 2026-07-13（earlier）：后台"模型开关"大简化 + 新增 GPT-5.6 Terra/Terra Pro + Agent 模式改造（全部仅本地，未 commit/未推/未部署）。** 7 组→5 组（图片/视频/通用/Agent/反推优化），取消 OpenRouter↔BytePlus 互斥改"相加"（去掉重复的 OR seedream-4.5/seedance/seed-2.0-lite，只留 BytePlus 版），表头"使用位置"→"功能模块"+新增"作用位置"列。反推/优化固定顺序 GPT-5.5→5.4→Seed2.0Pro→Seed2.0Lite。通用模式加 GPT-5.6 Terra/Terra Pro（金色改到 Terra Pro）。Agent 合并成一组、去掉备选、首选不可用随机兜底用「图片生成/视频生成」。默认全开（含 BYTEPLUS_API_KEY_ENABLED 默认→true）。`tsc`+`build` 通过。**已与上面 later session 那批合并，一起部署。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。另：后台白名单已加 `176107103@qq.com`（腾讯 env，已上线）。**用户铁律不变：资产原始数据出生即冻结永不变。**

> **✅ 2026-07-12 (later session) 最新：生成图统一出生根治 + 资产→节点读取统一(model) + 全平台上传内容哈希去重(阶段3b全量) 已部署腾讯并 commit+push GitHub（腾讯=GitHub=本地 三方同步）。** 所有生成由服务端 finalize 唯一权威出生（异步存盘图先等本地存盘再落库，修复资产库图 model/参数全空）；从资产库导入/图层恢复/GET 接口都带真实 model（修导入节点显示默认模型）；对话流+工作流(画布/输入框)+资产库三处上传统一内容哈希去重（跨平台判重、提示「图片已存在，无需重复上传！」按位置分开弹、去掉资产库旧 url 判重）。历史空 model 老图从 GenerationJob/ledger 精确回填 7 张（12424740）、5 张无来源留空不猜。详见 `CHANGELOG.md` / `01-current-status.md` / `05-next-actions.md` 顶条。**用户铁律不变：资产原始数据出生即冻结永不变，之后只有改名/移动/删除（只写 UserAssetState）；新口子必须走统一存/读模块。**

> **✅ 2026-07-12 (上午)：资产入库/显示统一大改造 阶段1/2/3a/4** 已部署腾讯（统一入库 `src/lib/media-asset-record.ts`、关掉出生后覆盖、视频存尺寸、上传按内容哈希去重、库/工作流显示统一）。历史数据不删不改。

> **✅ 2026-07-11 大事进度：主服务器已从马来完整迁到腾讯云新加坡**，迁移阶段4也完成 —— main/api DNS 已直指腾讯、腾讯 nginx 443 SSL 直连，马来已彻底出链路。证书自动续期已配好（acme.sh tls-alpn-01 走443，Let's Encrypt ECC 到 2026-10-09，cron 自动续）。唯一遗留：马来退役待用户决定（AI 未停）。当前架构/部署见 `03-deploy-and-servers.md` 顶部。

This folder is the current handover entry. The previous long handover set was moved to `historical-handover-docs-last-used-2026-06-20/` because it mixed current facts with outdated May and early June decisions.

Read in this order:

1. `01-current-status.md`
2. `02-architecture-and-data.md`
3. `03-deploy-and-servers.md`
4. `04-product-rules.md`
5. `05-next-actions.md`
6. `06-memo-tasks.md`
7. `07-remote-video-url-debug.md`
8. `08-gpt-image-prompt-optimization.md`
9. `09-migration-to-tencent.md`（马来→腾讯迁移，进行中）
10. `CHANGELOG.md`

Project path: `E:\project\FlashMuse_Agent`

GitHub repository: `https://github.com/lookxun/FlashMuse_Agent`

Local root note, 2026-06-26:

- The temporary copied folder `E:\project\FlashMuse_Agent` was removed after comparing it with the original `E:\project\AI-Video-Assistant` folder.
- The original `E:\project\AI-Video-Assistant` folder, which had the larger and more complete local state including `.runtime/`, was renamed to `E:\project\FlashMuse_Agent`.
- The old path `E:\project\AI-Video-Assistant` should no longer exist. Continue from `E:\project\FlashMuse_Agent`.
- The internal planning folder was renamed from `AI-Video-Assistant_Project Planning` to `FlashMuse_Agent_Project Planning`.
- Final local validation after the rename: `npx tsc --noEmit` passed.

Product name: `闪念 / FlashMuse`

Stack: `Next.js 16.2.4`, `React 19.2.4`, `Prisma 6.19.3`, `PostgreSQL`, `Tailwind CSS 4`.

Default rule for future handover maintenance:

1. When the current handover docs become too long or start mixing old and current facts, archive the whole current set into a new English folder named like `historical-handover-docs-last-used-YYYY-MM-DD`.
2. Write a new smaller current set by extracting only important, still-valid content.
3. Treat archived docs as backup only. Use them when current docs are insufficient or a difficult bug needs historical context.
4. Do not delete archived handover folders.
5. Archived folders named `historical-handover-docs-last-used-*` are read-only. Do not modify, overwrite, or move files inside them unless the user explicitly asks to reorganize historical backups.
6. Future handover updates must be written to the current files directly under `handover/`, not into archived folders.

Important local state on 2026-06-20 rebuild:

- At that time, local key source files matched the currently deployed Malaysia server source hashes for `src/lib/media-assets.ts`, `src/app/api/media-assets/route.ts`, `src/app/api/workspace-state/route.ts`, and `src/components/chat-workbench.tsx`.
- At that time, local Git still had uncommitted deployed changes; this was later superseded by 2026-06-23 and 2026-06-26 GitHub syncs.
- Latest local commit seen during that rebuild: `508008e Add media asset migration tooling`.

Important local state after 2026-06-26 repo rename/GitHub sync:

- GitHub repository was renamed from `lookxun/AI-Video-Assistant` to `lookxun/FlashMuse_Agent`.
- Local `origin` now points to `https://github.com/lookxun/FlashMuse_Agent.git`.
- Latest pushed source-code sync commit after local workflow/custom context-menu/snapping and diagnostics work: `0f4c97c Implement workflow canvas updates and diagnostics`.
- Later handover-only commits may follow this source-code sync commit.
- Local repository-level Git identity was set to `lookxun <lookxun@users.noreply.github.com>` so future local commits do not fail with `Author identity unknown`.
- After the local folder rename, if homepage flashes or Turbopack reports `Next.js package not found`, stop local Next Node processes and delete `.next`; this fixed the issue once on 2026-06-26.
