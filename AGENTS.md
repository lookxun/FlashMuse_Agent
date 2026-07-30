<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 铁律：查"慢/卡"这类性能问题，先分层掐表 + 逐层量字节，禁止看代码猜（2026-07-30 加）

排查「某个接口慢」时，**先量再说**，顺序固定：

1. **分层掐表**把范围缩到一层：容器内直打 app → 宿主打 nginx → 本机走 TLS → 跨境。
   本次实测 39ms / 2ms / 20ms / 0.43s，**四层都快 = 问题在"响应体大小"而不是"处理慢"**。
2. **nginx 日志按 body 字节排序**（`awk` 取第 10 段），一眼看出哪个接口最大、多大。
   ⭐ nginx 会自己把病因写在 warn 里：`an upstream response is buffered to a temporary file`
   = **响应撑爆了 `proxy_buffers`（默认才 8×4k=32KB），被落盘到磁盘再转发** —— 这就是本次那 17~30 秒。
3. **逐层量字节**：顶层各字段 → 钻进最大那个 → 再钻一层。本次钻了三层才发现"同一份提示词存了 4 份"。
   ⛔ **别在第一层就下结论**：我第一次判断"消息一次全发"就是错的（消息早就有分页），**是用户纠正的**。
4. **改完必须再量一次**（拿真实重度用户数据跑，见 `.runtime/verify-gain.js`），否则不知道有没有效果、还剩多少。
5. ⭐⭐ **要不要"为了省字节改代码"，必须先量 gzip 后的大小，别拿未压缩字节做决策**（2026-07-30 加）。
   本次实测：工作流 canvas 未压缩 **655KB**，gzip 后只有 **105KB（16%）** ——
   因为 `data.prompt` 是纯中文提示词文本还大量重复，**正好是 gzip 最擅长的东西**。
   于是那个"看起来能省 655KB"的优化（M025）**收益只剩 ~31KB，被直接否掉了**。
   姿势：`zlib.gzipSync(Buffer.from(JSON.stringify(x)), { level: 5 }).length`（模板 `.runtime/m025.js`）。
   ⭐ 顺序永远是「**先上 gzip + 放大缓冲，再谈剥字段**」—— 前者零风险，后者要动前端读写链路、改错就删用户数据。
6. ⭐ **怀疑"新版本变慢/报错"，先拿还没升级的那台做对照** ——
   本次靠"部署前的 v54 也有 30.8s 的 401"排除了"是新代码引起的"。
   ⭐ 同理，**怀疑"数据被自己弄丢了"时，先找一个"这次没被碰过"的行/用户做对照**
   （2026-07-30：查库发现 `feedbackLogs` 是 0，差点以为被自己的 PUT 洗了；
   靠另一个没登录过的用户那行 `updatedAt` 还是部署前的时间、也是 0，才确认本来就是空的）。
7. ⭐ **502 `connect() failed (111: Connection refused)` 基本都是部署窗口**（容器没在监听），不是 bug；
   判据 = 时间戳全挤在 `up -d --build` / `force-recreate` 那几秒。⛔ 别和"慢"混成一个问题查。
8. ⭐ **覆盖服务器上的 nginx conf 前，先看 diff 里有没有 `<` 行**（2026-07-30 加）：
   全是 `>`（纯新增）= 仓库那份是服务器的严格超集、期间没人手改过，才敢覆盖；
   出现 `<` = 服务器被手改过，**先搞清楚再动**。

**配套的代码铁律：下行做了"投影/瘦身"，就必须配一个 PUT 侧的"字段恢复"。**
因为 `messageJson` / `canvasJson` 这类都是**整体覆盖**保存的，前端把瘦身版存回来就等于**删库**。
现成的成对实现照抄：`workspace-sessions.ts` 的 `projectWorkspaceMessageForClient()` ↔ `restoreProjectedMessageFields()`、
`workspace-workflows.ts` 的 `mergeWorkflowCanvasMedia()`。
⛔ 投影只能"**整体相等才省**"，逐项省会让按下标取的数组（`itemPrompts`）错位、或回落到另一条数据上。
⛔ **别在会被回写数据库的对象上剥字段**（`route.ts` 的 `baseState` 就会回写，剥了等于真删用户数据）。

# 铁律：nginx 配置以仓库为准，禁止只在服务器手改（2026-07-30 加）

nginx 配置在仓库里有副本（`nginx/flashmuse.conf`、`deploy/staging/*.conf`、`deploy/ali/`）。
**先改仓库、再部署过去**；2026-07-30 发现仓库那份已经和服务器漂移了（服务器多了 443 server 块和 CORS 头）。
⛔ **阿里正式那份 `flashmuse-static-ip` 不许整份覆盖** —— 它里面还有**别的项目**的配置（`/tiantangqiyuan/`），
整份覆盖会违反下面"绝不能影响其它项目"的约定。要改就用幂等增量脚本
（`deploy/ali/ali-add-proxy-buffers.sh` 是模板：备份 → 只插需要的几行 → `nginx -t` → 失败自动回滚 → 可重复跑）。

# 铁律：排查掉一批红字失败原因，就必须去后台归档（2026-07-27 加）

后台「运营概览 → 失败原因」里的红字，每查清一类根因并修掉/堵上后，**必须把这批历史失败事件归档**：

- 归档 = 给 `GenerationEvent` 打 `resolvedAt` + `resolvedNote`；后台那条原因**文字保留但划掉**（灰色 line-through），并从上方"待排查"数量里扣掉。
- 操作只有一步：往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加一条规则（`match` 匹配的是**诊断日志里的真实原文**，不是 failureReason），然后跑 `--apply`。⭐ **跑之前必须先 dry-run 看真实数字**（交接文档里的条数只是快照：2026-07-29 记的 101 条，实跑是 120 条）。
- ⭐⭐ **写归档规则时先问「这个根因以后还会不会再发生」**：修好了、此后零复发 → 不用管；**修不了、只是从兜底桶映射成了明确文案**（余额不足 / 模型拒绝 / 平台审核）→ **必须给规则配 `before` 日期下限**（= 映射上线的时刻，脚本已支持），否则以后每次跑归档都会把「本该一直亮着」的新事件偷偷抹掉、后台再也看不见这个问题（2026-07-29 差点误吃 11 条新的「提供商余额不足」）。
- **`B_xxx` 错误编号计数器**：日常按规则归档时**与归档无关，继续自增**；⭐ 只有用户明确要求「整轮清零 / 重新开始一轮」时才重置（`--reset-all` 会把 `.runtime/error-code-counter.txt` 写回 0，下一条报错从 `B_1` 开始）。
- ⭐⭐ **「整轮清零」模式（2026-07-29 用户拍板，新增 `--reset-all`）**：`node scripts/archive-resolved-generation-failures.mjs --reset-all --apply` 会把**当前全部**待排查失败事件一次性归档（不看 `RESOLVED_RULES`、不看全局护栏）+ 把 B_xxx 计数器归 0，从此只看**新长出来**的红字。⛔ 与下面的日常按规则归档是两回事，别混用；只在用户明确说"全部归档/清零/重新开始"时跑。**2026-07-29 v1.0.0.54 部署后已执行过一次（正式服 + 测试服）。**
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
- ⭐⭐ **每部署完一台就必须真上号点一遍看有没有崩（2026-07-29 用户加）**：**curl 200 / 版本号头对了 ≠ 没崩**。测试服部署完上号、正式服部署完**也要上号**，**崩了立刻修**（修不了就回滚 `app-backups`，保证用户还能用）。最小巡检 6 项（登录 / 对话模式 / 工作流画布点节点不崩 / 资产库 / 真跑一次生图（动过视频链路再跑生视频）/ 后台 `/admin` 且控制台 0 error）写在 `handover/03-deploy-and-servers.md`「部署铁律」节。

# 铁律：能统一的一律统一，禁止复制多份各走各的

本项目功能不多、各模式本质相同（对话流 / 工作流 / 资产库 / Agent 模式 / 通用模式）。写代码或改东西前，**必须先查是否已有统一的公共路径/函数**，有就复用、没有就抽一个，**绝不允许把同一段逻辑复制成多份各自演化**。

- 反例（已踩坑，2026-07-14）：`getBytePlusProviderKey`（模型→BytePlus 端点映射）被复制到 `image/route`、`video/route`、`generation-jobs` 三份，各改各的 → 只修了对话流那份，Agent/通用模式漏修 → 线上 Agent/通用生图/生视频用新模型直接失败。已收敛为唯一实现 `src/lib/byteplus-provider-key.ts`。
- 判断标准：**理论上"生图在一个地方能用，其它地方都应该能用"**（生视频、上传、进库、读取、命名、扣费、参考图……同理），因为它们本就该走同一套。若出现"对话流可以、工作流/Agent 不行"，几乎一定是某处该统一却分叉了——先找分叉点收敛，别再打局部补丁。
- 已有的统一入口举例（改相关功能务必复用，勿另起炉灶）：进库 `src/lib/media-asset-record.ts`(`buildMediaAssetRecord`/`classifyAsset`)、生成任务与读取 `src/lib/generation-jobs.ts`、扣费 `src/lib/credits.ts`(`chargeCredits`)、模型→端点键 `src/lib/byteplus-provider-key.ts`、**模型拒绝文案 `src/lib/error-message.ts`(`MODEL_REFUSED_PREFIX` + `isModelRefusedMessage` + `buildModelRefusedMessage`：⭐ 2026-07-29 起「模型拒绝 / 平台安全策略 / 版权限制」**三类合并成唯一一句**「模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“…”」，不再按模型分"能不能AI改写"。⛔ 改这句必须同步改三处：`gpt-image-safety-retry.ts` 的**前缀**判定、`admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 归一化、`error-message.ts` 顶部的幂等保护；`LEGACY_MODEL_REFUSED_MESSAGES` 里的老文案只用于判定/后台归一化，禁止拿来生成新文案)**、**AI 安全改写 `src/lib/gpt-image-safety-retry.ts`(`isGptImageSafetyFailure`/`runPromptSafetyRetry`/`ensureMentionNamesPreserved`：⛔⭐ **2026-07-29 起只有工作流用它** —— 对话流与资产库那两套已按用户拍板整体撤掉（对话流"一条提示词出多图"，每张独立改写会让显示的提示词对不上；且并发多链会互抢 `message.requestId` 导致成功图被静默丢弃，正式服实测 17 张成功只剩 2 张、白烧 197 积分）。⭐ **2026-07-30 用户拍板：对话流的 AI 改写彻底不做了（原 M021 已取消），别把删掉的代码捡回来、也别再提重做。**)**、**参考素材 url 归一化 `src/lib/reference-asset-url.ts`(`normalizeReferenceAssetUrl`/`normalizeReferenceAssetUrls`：进模型/送审前必过。把「给人看的动态缩略图接口地址 `/api/media-thumbnail?url=`」和「自家主机绝对前缀（含已退役马来 IP）」一律还原成文件静态直链 —— 平台是来"上门自取"的，给它动态接口它会现场等我们生成缩略图然后超时。8 处咽喉共用：image/video/byteplus-assets 三个 route 入口 + `generation-jobs.resolveReferenceUrls` + openrouter/openrouter-video/seedance/video-route 的底层拼址，禁止再在别处自己判 `startsWith("/generated/")`)**、参考图 hint `src/lib/reference-hint.ts`、错误文案 `src/lib/error-message.ts`、登录失效跳转 `src/lib/session-expired-redirect.ts`、@提及匹配/删除 `src/lib/mention-text.ts`、上传文件命名 `src/lib/upload-name.ts`(`resolveUploadName`：同图复用名/异名错开_2/去扩展名/改名跟随；对话流·工作流·资产库 图·视频·音频·文档统一走它，前端只显示服务端返回的 `name`，禁止再在前端各写一套取名/版本化逻辑)、音频波形播放器 `src/components/audio-waveform-player.tsx`(`AudioWaveformPlayer`：wavesurfer.js，`variant="node"` 工作流画布音频节点 / `variant="card"` 资产库上传音频方卡；工作流·资产库统一走它，禁止再各写一套音频播放 UI)、视频播放按钮角标 `src/components/video-play-badge.tsx`(`VideoPlayBadge`：全平台所有视频缩略图中间的播放标记，5 档 size；对话流·工作流·资产库·@引用·图层·后台·上传缩略图统一走它)、**媒体时长校验 `src/lib/media-upload-validation.ts`(`MEDIA_DURATION_EPSILON_SECONDS` 唯一容差常量 + `validateReferenceMediaDurationRange` 单条时长校验唯一实现；对话流·工作流·服务端三处共用，禁止再在组件里写本地副本——历史上就是各写一份导致 15.35/15.35/16.01 三个数都错)**、**参考素材总时长 `src/lib/upload-rules.ts`(`validateReferenceTotalDuration`)**、**工作流节点下载 `downloadWorkflowNode()`(`workflow-tldraw-canvas-inner.tsx`，图片/视频/文本通用；右键菜单与快捷菜单共用，禁止再内联写一份)**。
- ⛔⛔ **往 `WorkflowSelectedNodeOverlay`（工作流选中节点浮层、含图片/视频快捷菜单）里加 Hook 会把整个 tldraw 画布搞崩**（2026-07-29 踩过）：它在 `workflow-tldraw-canvas-inner.tsx:2493` 有 `if (!selected) return null;`，在其**之后**加 `useMemo`/`useState` 等 → **React #310「Rendered more hooks than during the previous render」** → 点任意节点，画布整个变成「Something went wrong / Please refresh your browser」。**加在提前 return 之前，或干脆别用 Hook。**
- ⛔⛔ **排查对话流失败卡时必读（2026-07-29 踩过、误报过一次）**：失败卡包在 **`<LazyMediaMount height={250}>`**（`chat-workbench.tsx:16531`）里 —— **滚进视口才挂载**，没进视口时 DOM 里根本没有卡；而红字**不在**这个组件里、一直显示。所以**「红字在、卡不在」是正常现象，不是数据丢了**。用 `querySelectorAll('.flashmuse-failed-media-card')` 统计失败卡不可靠，必须先 `scrollIntoView` 再断言。
- ⛔ **"某条原因高度集中在一个入口"不一定是分叉**（2026-07-29 踩过）：后台「失败排查」页那条设计意图会给假信号 —— 先去看「失败最多的用户」卡，如果也集中在一个人，那是用户行为不是代码分叉（101 条里 76 条是同一个人三天刷出来的）。
- 新增模式/模型时：只改统一函数 + 配置表（`system-settings.ts` 的偏好/端点表要**对称补齐所有前缀** conversation-image / asset-image / agent-image / video / agent-video），改完所有模式自动一致。
