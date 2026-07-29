<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 铁律：排查掉一批红字失败原因，就必须去后台归档（2026-07-27 加）

后台「运营概览 → 失败原因」里的红字，每查清一类根因并修掉/堵上后，**必须把这批历史失败事件归档**：

- 归档 = 给 `GenerationEvent` 打 `resolvedAt` + `resolvedNote`；后台那条原因**文字保留但划掉**（灰色 line-through），并从上方"待排查"数量里扣掉。
- 操作只有一步：往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加一条规则（`match` 匹配的是**诊断日志里的真实原文**，不是 failureReason），然后跑 `--apply`。⭐ **跑之前必须先 dry-run 看真实数字**（交接文档里的条数只是快照：2026-07-29 记的 101 条，实跑是 120 条）。
- ⭐⭐ **写归档规则时先问「这个根因以后还会不会再发生」**：修好了、此后零复发 → 不用管；**修不了、只是从兜底桶映射成了明确文案**（余额不足 / 模型拒绝 / 平台审核）→ **必须给规则配 `before` 日期下限**（= 映射上线的时刻，脚本已支持），否则以后每次跑归档都会把「本该一直亮着」的新事件偷偷抹掉、后台再也看不见这个问题（2026-07-29 差点误吃 11 条新的「提供商余额不足」）。
- **`B_xxx` 错误编号计数器与归档无关，继续自增，永不重置。**
- **归档的对象本质是「服务器繁忙，请稍候再试.....」这个兜底桶**（所有没被明确识别的错误都落进它，它是一堆无关根因的混合体）。⭐ **其实有两个兜底桶**：`toUserErrorMessage` 的 fallback 是默认参数 —— 显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 落进「服务器繁忙」，不传落进「**请求失败，请稍后再试。**」，**同一个根因会同时污染两个**（余额不足就是 53 + 13），排查时两个桶都要查。判定只问一句：**这个根因还落在兜底桶里吗？** ①修好了 → 归档；②没修但**已映射成明确文案**（不再落进兜底桶）→ 归档；③还没查清/修不了、仍落在桶里 → 留着亮；④**映射出去后新形成的那条明确原因本身 → 不归档**（修不了就该一直亮着，且它已不污染兜底桶）。例：OpenRouter 余额不足历史 53 条已归档，但新出现的「提供商余额不足！请联系管理员充值。」不归档。
- 排查方法论 / 已修清单 / 待查清单 / 常见误区 → **`handover/07-red-error-triage-and-archive.md`（排查线上报错必读）**。两条核心：**① `failureReason` 是给用户看的文案（"服务器繁忙"是兜底），从它本身查不出根因，真实原因只在 `.runtime/*-diagnostics-log.jsonl` 里。② ⭐ 日志里 `grep -c` 数出来的行数 ≠ 待排查的失败事件数** —— 必须回 DB 按 requestId 核对 `GenerationEvent.status`：`status='success'` 的是"中间失败/已重试成功"，**后台里根本不占位、不用归档**（2026-07-28 踩坑：「缩略图超时 18 条」实际是同一个 requestId 的 18 行日志、该请求最终成功）。

# 铁律：动代码前先评估对既有功能的影响 + 默认只改本地不部署（2026-07-19 加，所有 AI 必须遵守）

用户提需求时，**动代码之前必须先排查：本次需求会不会影响 / 破坏其它已有功能**（尤其对话流 / 工作流 / 资产库 / Agent / 通用模式这几套本质相同、常共用同一份代码的功能）。

- **有影响就先别动代码**：先把**影响范围**告诉用户，等用户确认后再改。目标是新写代码时最大限度不把其它功能搞坏。
- **默认只做本地、不部署**：用户没明确说"部署"，就只在本地改（改完 `npx tsc --noEmit` 自查即可），**不要 build / 不要上腾讯 / 不要同步阿里 / 不要 push**。用户说"要部署"时才走部署流程。
- 与下面"能统一一律统一"配合：改统一函数时尤其要评估它被哪些模式共用，别只顾眼前这条需求。

# 铁律：测试服→正式服部署顺序 + 版本号自增（2026-07-18 加，所有 AI 必须遵守）

有一套**测试服**（腾讯 `/opt/flashmuse-staging/` + 阿里镜像，入口 `http://101.37.129.164:8080/`、后台 `/admin`），和正式服代码一致、数据/环境独立。用来在不影响正式服用户的前提下线上验证。

- **部署顺序永远是：先测试服，再正式服。** 哪怕用户说"直接部署正式服"，也必须先部署测试服、验证 OK 后，再把**测试服那份代码原样同步到正式服**。禁止跳过测试服、禁止直接改正式服代码。
- **"部署掉 / 部署一下"等默认只部署测试服，绝不动正式服。** 只有用户明确说"把正式服部署掉 / 更新正式服 / 上线正式服"这类话，才执行"先一次性部署测试服、再同步到正式服"的完整顺序。默认永远只到测试服为止。
- **版本号自增只发生在"部署测试服"这一步**：部署测试服前先跑 `node scripts/bump-version.mjs`（四段 100 进制 vAA.BB.CC.DD 最右段 +1、满 100 进位，写回 `src/lib/app-version.ts`）。**正式服部署绝不跑自增脚本**，只把测试服的代码（含已写好的版本号）原样带过去。
- 由此保证"**版本号一样 = 测试服和正式服代码一样；不一样 = 代码不一样**"。破坏此保证的操作（正式服再自增、正式服独立改代码、跳过测试服）一律禁止。
- 版本号是 `src/lib/app-version.ts` 里的 `APP_VERSION` 常量；`NEXT_PUBLIC_IS_TEST=true`（测试服构建 arg）控制显示 `(t)` 后缀与 logo"测试服"标识。改中文源码用 edit 工具，**禁止 PowerShell `Set-Content`**（会把中文注释变乱码，本次已踩坑）。

# 铁律：能统一的一律统一，禁止复制多份各走各的

本项目功能不多、各模式本质相同（对话流 / 工作流 / 资产库 / Agent 模式 / 通用模式）。写代码或改东西前，**必须先查是否已有统一的公共路径/函数**，有就复用、没有就抽一个，**绝不允许把同一段逻辑复制成多份各自演化**。

- 反例（已踩坑，2026-07-14）：`getBytePlusProviderKey`（模型→BytePlus 端点映射）被复制到 `image/route`、`video/route`、`generation-jobs` 三份，各改各的 → 只修了对话流那份，Agent/通用模式漏修 → 线上 Agent/通用生图/生视频用新模型直接失败。已收敛为唯一实现 `src/lib/byteplus-provider-key.ts`。
- 判断标准：**理论上"生图在一个地方能用，其它地方都应该能用"**（生视频、上传、进库、读取、命名、扣费、参考图……同理），因为它们本就该走同一套。若出现"对话流可以、工作流/Agent 不行"，几乎一定是某处该统一却分叉了——先找分叉点收敛，别再打局部补丁。
- 已有的统一入口举例（改相关功能务必复用，勿另起炉灶）：进库 `src/lib/media-asset-record.ts`(`buildMediaAssetRecord`/`classifyAsset`)、生成任务与读取 `src/lib/generation-jobs.ts`、扣费 `src/lib/credits.ts`(`chargeCredits`)、模型→端点键 `src/lib/byteplus-provider-key.ts`、**模型拒绝文案 `src/lib/error-message.ts`(`MODEL_REFUSED_PREFIX` + `isModelRefusedMessage` + `buildModelRefusedMessage`：⭐ 2026-07-29 起「模型拒绝 / 平台安全策略 / 版权限制」**三类合并成唯一一句**「模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“…”」，不再按模型分"能不能AI改写"。⛔ 改这句必须同步改三处：`gpt-image-safety-retry.ts` 的**前缀**判定、`admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 归一化、`error-message.ts` 顶部的幂等保护；`LEGACY_MODEL_REFUSED_MESSAGES` 里的老文案只用于判定/后台归一化，禁止拿来生成新文案)**、**AI 安全改写 `src/lib/gpt-image-safety-retry.ts`(`isGptImageSafetyFailure`/`runPromptSafetyRetry`/`ensureMentionNamesPreserved`：⛔⭐ **2026-07-29 起只有工作流用它** —— 对话流与资产库那两套已按用户拍板整体撤掉（对话流"一条提示词出多图"，每张独立改写会让显示的提示词对不上；且并发多链会互抢 `message.requestId` 导致成功图被静默丢弃，正式服实测 17 张成功只剩 2 张、白烧 197 积分）。**要重做必须先解决"一条提示词多图"的展示模型问题，别把删掉的代码捡回来。**)**、**参考素材 url 归一化 `src/lib/reference-asset-url.ts`(`normalizeReferenceAssetUrl`/`normalizeReferenceAssetUrls`：进模型/送审前必过。把「给人看的动态缩略图接口地址 `/api/media-thumbnail?url=`」和「自家主机绝对前缀（含已退役马来 IP）」一律还原成文件静态直链 —— 平台是来"上门自取"的，给它动态接口它会现场等我们生成缩略图然后超时。8 处咽喉共用：image/video/byteplus-assets 三个 route 入口 + `generation-jobs.resolveReferenceUrls` + openrouter/openrouter-video/seedance/video-route 的底层拼址，禁止再在别处自己判 `startsWith("/generated/")`)**、参考图 hint `src/lib/reference-hint.ts`、错误文案 `src/lib/error-message.ts`、登录失效跳转 `src/lib/session-expired-redirect.ts`、@提及匹配/删除 `src/lib/mention-text.ts`、上传文件命名 `src/lib/upload-name.ts`(`resolveUploadName`：同图复用名/异名错开_2/去扩展名/改名跟随；对话流·工作流·资产库 图·视频·音频·文档统一走它，前端只显示服务端返回的 `name`，禁止再在前端各写一套取名/版本化逻辑)、音频波形播放器 `src/components/audio-waveform-player.tsx`(`AudioWaveformPlayer`：wavesurfer.js，`variant="node"` 工作流画布音频节点 / `variant="card"` 资产库上传音频方卡；工作流·资产库统一走它，禁止再各写一套音频播放 UI)、视频播放按钮角标 `src/components/video-play-badge.tsx`(`VideoPlayBadge`：全平台所有视频缩略图中间的播放标记，5 档 size；对话流·工作流·资产库·@引用·图层·后台·上传缩略图统一走它)、**媒体时长校验 `src/lib/media-upload-validation.ts`(`MEDIA_DURATION_EPSILON_SECONDS` 唯一容差常量 + `validateReferenceMediaDurationRange` 单条时长校验唯一实现；对话流·工作流·服务端三处共用，禁止再在组件里写本地副本——历史上就是各写一份导致 15.35/15.35/16.01 三个数都错)**、**参考素材总时长 `src/lib/upload-rules.ts`(`validateReferenceTotalDuration`)**、**工作流节点下载 `downloadWorkflowNode()`(`workflow-tldraw-canvas-inner.tsx`，图片/视频/文本通用；右键菜单与快捷菜单共用，禁止再内联写一份)**。
- ⛔⛔ **往 `WorkflowSelectedNodeOverlay`（工作流选中节点浮层、含图片/视频快捷菜单）里加 Hook 会把整个 tldraw 画布搞崩**（2026-07-29 踩过）：它在 `workflow-tldraw-canvas-inner.tsx:2493` 有 `if (!selected) return null;`，在其**之后**加 `useMemo`/`useState` 等 → **React #310「Rendered more hooks than during the previous render」** → 点任意节点，画布整个变成「Something went wrong / Please refresh your browser」。**加在提前 return 之前，或干脆别用 Hook。**
- ⛔⛔ **排查对话流失败卡时必读（2026-07-29 踩过、误报过一次）**：失败卡包在 **`<LazyMediaMount height={250}>`**（`chat-workbench.tsx:16531`）里 —— **滚进视口才挂载**，没进视口时 DOM 里根本没有卡；而红字**不在**这个组件里、一直显示。所以**「红字在、卡不在」是正常现象，不是数据丢了**。用 `querySelectorAll('.flashmuse-failed-media-card')` 统计失败卡不可靠，必须先 `scrollIntoView` 再断言。
- ⛔ **"某条原因高度集中在一个入口"不一定是分叉**（2026-07-29 踩过）：后台「失败排查」页那条设计意图会给假信号 —— 先去看「失败最多的用户」卡，如果也集中在一个人，那是用户行为不是代码分叉（101 条里 76 条是同一个人三天刷出来的）。
- 新增模式/模型时：只改统一函数 + 配置表（`system-settings.ts` 的偏好/端点表要**对称补齐所有前缀** conversation-image / asset-image / agent-image / video / agent-video），改完所有模式自动一致。
