# 红字失败原因排查 & 归档（2026-07-27 新建，2026-07-29 补第十二节；排查线上报错必读）

> 这份文档专门管一件事：**后台「运营概览 → 失败原因」里那些红字，逐个查清真实根因 → 修掉/堵上 → 归档划掉**。
> 用户的要求很明确：**"排查掉一批就自动去归档"**，所以每次修完必须走本文最后的归档流程，否则后台数字永远不降、下一个人没法判断哪些还没查。
>
> **速查目录**：铁律（归档判什么）→ 一（后台看的是什么，⭐**两个兜底桶**）→ 二（怎么查真根因）→ 三/三·B/三·C/三·D（已查清的四批，含完整数据与修法）→ 四（归档操作）→ 五（⭐一根因多措辞的坑）→ 五·B（⭐日志行数≠事件数）→ 六（正式服红字全貌）→ 七（下一批查什么）→ 八（等拍板的改进）→ 九（40 条轮询 failed）→ 十（⭐后台「失败排查」页怎么用）→ 十一（验收拦截类功能的操作要点）→ **十二（⭐ 101 条「没有返回图片」+ 3 条新方法论 + 一次误报纠正，2026-07-29 新增）**。
>
> ⭐ **只看三条也够用的**：① `failureReason` 是给用户看的文案，从它查不出根因，真实原因只在 `.runtime/*-diagnostics-log.jsonl`。② 兜底桶有**两个**，同一根因会同时污染两个。③ 日志 `grep -c` 的**行数 ≠ 待排查事件数**，必须回 DB 按 requestId 核对 `status`。
>
> **已查清并归档的五批（累计约 360 条）**：①参考图尺寸/比例 191（两种措辞）②审核凭证失效 11 ③OpenRouter 余额不足 53+13 ④「当前模型不支持这组参数」51 ⑤登录失效 17 ⑥07-10 前永久不可追溯 24。
>
> **⭐ 第十次会话（2026-07-28）新增的第四条方法论 —— 同一个 event 可能有多个打点、各自读取程度不同**：
> 查「gpt-5.4-image-2 明文拒绝」时发现 `image-provider-empty-result` 在 `src/lib/openrouter.ts` 里有 **3 个打点**（BytePlus `/images` `:1388` / OpenRouter 新 `/api/v1/images` `:1679` / OpenRouter 老 `/chat/completions` `:1911`），**三份对"上游失败原因"的读取程度完全不同**：老接口读了 `choices[0].message.content|refusal`，新接口**一个字都没读、连 `responseText` 都没进日志**。
> 结论：**查一类红字前，先 `grep` 清楚这个 event 名一共有几处打点、每处分别服务哪些模型**，否则会像这次一样把"两个完全不同的问题"当成一条来判断（一个是"原文被扔了查不到"，另一个是"原文有但前端没入口"）。

## ⭐ 铁律：修完就归档

### 先想清楚归档到底在归什么（2026-07-28 用户澄清，最重要的一段）

**归档的对象本质上是「服务器繁忙，请稍候再试.....」这个兜底桶。**
所有没被明确识别的错误都会落进这一条，所以它不是一个"原因"，而是一堆互不相干的根因混在一起的垃圾桶。归档存在的唯一意义就是：**把已经处理过的根因从这个桶里拆出去，让桶里剩下的数字 = 真正还没查清的量。**

由此得出判定标准（照这个判，别自己发挥）：

| 情况 | 归档？ |
|---|---|
| 某根因**代码修好了** | ✅ 归档 |
| 某根因**没修**，但已经**映射成明确文案**（不再落进兜底桶） | ✅ 归档（例：OpenRouter 余额不足 → "提供商余额不足！请联系管理员充值。"） |
| 某根因**还没查清 / 修不了**，仍落在"服务器繁忙"里 | ❌ 留着亮 |
| 映射出去后形成的**新的明确失败原因**本身 | ❌ **不归档**（它修不了，就该一直亮着提醒；而且它已经不污染兜底桶了，目的已达成） |

也就是说：**"服务器繁忙"下降 = 有进展；新原因单独亮出来 = 正常且期望的结果，不要试图把它也归档掉。**

### 操作铁律

1. 查清一类根因 → 修代码 / 或至少给它一条明确文案 → **必须把这类历史失败事件归档**（打 `resolvedAt` + `resolvedNote`）。
2. 归档 = 后台那条原因**文字保留但划掉**（灰色 `line-through`），并从上方"待排查"数量里扣掉。
3. **错误编号 `B_xxx` 计数器与归档无关，继续自增**（`.runtime/error-code-counter.txt`），不要重置。
4. 判归档还是不归档，回到上面那张表：问一句"**它还落在'服务器繁忙'这个桶里吗？**"——不落了就归档，还落着就留。

## 一、后台看到的是什么

- 位置：后台 `/admin` → 运营概览 → 卡片「**失败原因**」。⭐ **2026-07-28 新增专用页 `/admin?tab=failures`「失败排查」（左侧导航"生成记录"下面），信息比概览那个小卡全得多，排查请优先用它 —— 详见第十节。**
- ⭐ **有两个兜底桶，都要查**：「服务器繁忙，请稍候再试.....」（调用处显式传 `GENERIC_MEDIA_ERROR_MESSAGE`）和「请求失败，请稍后再试。」（`toUserErrorMessage` 的**默认** fallback）。同一个根因会因为调用处传不传 fallback 而分别落进两个桶（余额不足就同时污染了两个）。详见第三·D 节。
- 数据来源：`GenerationEvent` 表（`status='failed'`，按 `failureReason` 分组，去掉 `(B_xxx)` 前缀后聚合）。
- 代码：`src/lib/admin-overview.ts`
  - `failureTop` = **`resolvedAt IS NULL`**（待排查，正常显示）
  - `failureResolvedTop` = **`resolvedAt IS NOT NULL`**（已归档，按「原因 + resolvedNote」分组）
  - `moderationBreakdown` 同样只统计未归档
- UI：`src/app/admin/admin-overview-2.tsx` 的「失败原因」卡片；`RankTable` 加了 `strikethrough` 参数，已归档区块传 `strikethrough` → 划掉展示 + 下面小字显示 `resolvedNote`。
- DB 列：`GenerationEvent.resolvedAt` / `resolvedNote`（迁移 `20260727154203_generation_event_resolved`）。

## 二、⭐ 怎么查真实根因（关键：别信 failureReason）

**最大的坑**：`failureReason` 存的是**给用户看的文案**。像「服务器繁忙，请稍候再试.....」是 `GENERIC_MEDIA_ERROR_MESSAGE` 兜底，凡是 `toUserErrorMessage()` 没匹配上的错误全落到它头上 → **从这句话本身查不出任何东西**。

真实原因在两个地方：

1. **诊断日志（主力）**：容器 `/app/.runtime/`（宿主 `/opt/flashmuse/data/runtime/`）
   - `generation-diagnostics-log.jsonl`（约 40MB+，图片/视频通用链路）
   - `video-diagnostics-log.jsonl`（视频专用：送审、byteplus 创建/轮询）
   - `upload-diagnostics-log.jsonl`（上传）
   - 每行一个 JSON，关键字段：`event`、`requestId`、`taskId`、`error`、`upstream`、`extra`
2. **容器 stdout**：`createCodedApiError` 会 `console.error("[B_xxx] scope", 原文)`，但 `docker logs` 会随容器重建丢失，**不可靠**，别指望它。

### 排查步骤（照抄即可）

1. 从 DB 取出这条红字的所有事件 + `requestId`：
   ```sql
   SELECT "requestId","kind","source","model","provider","createdAt" FROM "GenerationEvent"
   WHERE "status"='failed' AND "failureReason" LIKE '%服务器繁忙%' AND "resolvedAt" IS NULL;
   ```
2. 拿这批 `requestId` 去两个 jsonl 里捞同 requestId 的行，**优先看"失败类事件"**（event 名含 `fail`/`non-ok`/`error`/`empty`/`expired`）。
3. **看最终抛出的那条**（`video-route-failed` / `video-request-error` / `image-job-failed`）的 `error.message`，这才是根因；不要拿早期的 `create-non-ok` body 当结论（会把"送审阶段被拒"误判成"风控拦截"，本次踩过这个坑）。
4. 视频轮询阶段的失败**没有 requestId**，要先从 create 事件拿 `taskId`，再按 taskId 捞日志。
5. 脚本一律写成一次性 `.js`，`docker cp` 进容器 `/app` 用 `node` 跑（容器里才有 `@prisma/client`），跑完删掉。模板见 `scripts/archive-resolved-generation-failures.mjs`（它就是这套扫描逻辑的成品版）。

## 三、已查清 + 已修 + 已归档（2026-07-27）

排查对象：正式服「服务器繁忙，请稍候再试.....」共 **212 条**（视频 147 / 图片 65；全部发生在 2026-07；provider BytePlus 114 / OpenRouter 98；日志能对上 208 条）。

| 根因 | 条数 | 修法 | 归档 |
|---|---|---|---|
| 参考图**尺寸/比例不合规** ——⭐**上游有两种措辞，都是同一根因**：<br>· 送审阶段 `Height must be between 300px and 6000px` 56 / `Aspect ratio must be between 0.4 and 2.5` 23 / `Width…` 3 = **82**<br>· 建任务阶段 `expected the height/width to be at least 300px, but received a 338x194px image instead` = **109**（全在 2026-07-27 一天，`seedance-2-0-mini`，日志 `code=InvalidParameter, param=image_url`） | **191** | 新增 `src/lib/video-reference-image-rules.ts`，**发送前**拦截并弹黑底说明；对话流/工作流/服务端三处共用（两种措辞都被这一道拦截挡住） | ✅ 已归档 |
| **审核凭证失效**（`The specified asset asset-xxx is not found`） | **11** | 自动清理库里死凭证 + 重新送审（`clearStaleBytePlusAssetCards`） | ✅ 已归档 |
| **已过审素材没被复用就放弃重试**（`!triggered` bug） | 若干 | `autoReviewBytePlusVideoReferences` 改判 `convertedCount`；并新增 `reuseOnly` 预检（有旧证就当场无感重试、不弹蓝字） | ✅ 已归档 |
| **OpenRouter 余额不足**（402 `Insufficient credits`） | **53** | ⭐ v1.0.0.47 新增映射：用户直接看到「(B_xxx) 提供商余额不足！请联系管理员充值。」；同时列入 `isPermanentError` 不再自动重试白烧时间 | ✅ 已归档（根因修不了，但**已从"服务器繁忙"兜底桶里拆出去**，所以历史这批归档；以后新发生的会以那条明确文案单独亮着，**那条不归档**） |
| OpenRouter 返回 200 但 `empty image result` | 7 | 未修 | ❌ |
| gpt-5.4-image-2 **用中文明文拒绝**（"抱歉，我不能生成…"），走的是"空结果"分支所以没被识别成审核 | 4 | 未修 | ❌ |
| 我方 **DB 事务超时**（`Transaction API error: Unable to start a transaction in the given time`） | 2 | 未修（量小，观察） | ❌ |
| 视频轮询到 `status: failed` 但**上游原因没落盘** | 40 | 已补日志（见下），**下次发生就能查了** | ❌（原因仍未知） |

### 顺带修掉的"查不出原因"根子
`video-provider-poll-success` / `video-provider-create-success` 两处日志以前**只记 `hasError: true` 布尔**，上游 `error.code/message` 一个字都不落 → 那 40 条永远查不出。已新增 `summarizeVideoTaskError()`（`src/lib/openrouter-video.ts` 唯一实现），4 个日志点全部带上 code + message（截断 600 字）。**以后再出现这类失败，直接在日志里就能看到原文。**

### 错误文案不再骗人（`src/lib/error-message.ts` 唯一入口，全模式生效）
新增 5 条判定（放在最前面，避免被 timeout/network/quota/`not valid` 通用规则抢走）：
- `(height|width) must be between \d+px and \d+px` / `expected the (height|width) to be at least \d+px` → 参考图尺寸不符合平台要求（宽和高都需在 300–6000 像素之间）…
- `failed to download media from the provided url|fetch-object` → 平台读取参考图失败（素材地址临时不可用）…
- `specified asset .* is not found` → 参考图在平台上的审核凭证已失效，系统已自动清理并重新送审，请再点一次生成。
- ⭐ `402|insufficient credits|insufficient_quota|exceeded your current quota|…` → **提供商余额不足！请联系管理员充值。**（同步加进 `transient-error.ts` 的 `isPermanentError`，不再自动重试）
- ⭐ `Unexpected token '<'|is not valid JSON|<!doctype html` → **平台服务临时异常（返回了非预期内容），请稍后重试。**（2026-07-28 加，见第四节 D 类）

## 三·B、「当前模型不支持这组参数」54 条排查（2026-07-28）

⭐ 这一条红字**不在"服务器繁忙"里、有自己的文案**，但量高达 54 条 → 一查全是**我们自己的 bug**，而且三类都已经修过了（所以后台看到的是历史存量）。

| 根因（上游原文） | 条数 | 最后一次发生 | 修复 | 归档 |
|---|---|---|---|---|
| A) `` `sequential_image_generation` … is not supported by the current model``（`seedream-5-0-pro`，端点 `ep-20260713101732-q5zvf`，image/asset） | **13** | 07-16 **06:21** | commit `08aa548`（07-16 **18:03**）给 `"disabled"` 那个分支补上 `supportsSequentialBatch &&` 守卫。**根因**：Seedream 5.0 Pro 连 `sequential_image_generation:"disabled"` 都不接受，而旧代码只要参考图 >1 张就发它 | ✅ 归档 |
| B) `` The parameter `content[N].image_url.url` … the specified asset is not an image``（`seedance-2-0`，video/conversation） | **26** | 07-21 **07:45** | **B_252**，v1.0.0.34（07-21 **19:21**）按 `asset.kind` 正确路由，非图片不再进参考图槽 | ✅ 归档 |
| C) `` the parameter video total duration (seconds) … must be less than or equal to 15.2``（`seedance-2-0`/`-fast`） | **12** | 07-21 **05:57** | **B_232**，v1.0.0.34（同上）`durationSeconds` Int→Float + 统一 `validateReferenceTotalDuration` | ✅ 归档 |
| D) ⭐**误映射**：`gpt-5.4-image-2` 平台返回 HTML 错误页 → `Unexpected token '<' … is not valid JSON` | **2**（07-24、07-27） | 仍在发生 | ⚠️ 这是**两个 bug**：①`is not valid JSON` 被 `not valid` 规则抢走 → 报"当前模型不支持这组参数，请换比例/分辨率"，用户按提示改参数完全没用；②`isPermanentError` 也因 `not valid` 判成永久失败 → **网关抖动本该自动重连却直接放弃**。v1.0.0.47 两处都修（新增判定 + `isPermanentError` 例外先行 + 列入瞬时可重试） | ❌ 不归档（新文案「平台服务临时异常…」会单独亮，且根因在平台侧） |
| E) 无日志（07-09，日志已轮转） | 1 | 07-09 | 查不出 | ❌ 留着 |

**判断"是否真的修好了"的方法（照抄）**：拿到根因后，`git log -S "<关键代码片段>" --date=iso` 找到修复 commit 的**精确时间**，再对比该根因**最后一次发生时间**。A/B/C 三类的最后一次都在修复上线**之前**、此后 7~12 天零复发 → 确认已修。别只看"代码里现在有守卫"就下结论（守卫可能是后来加的）。

## 三·C、「请先登录后再使用模型。」17 条排查（2026-07-28）

**数据**：17 条全部 `userId=NULL`、`image/conversation`、model 恒为默认 `seedream-4-5`、参考图 0 张；requestId 是我们前端生成的 `id_<base36时间>_<随机>` 格式（**不是脚本/爬虫，是真实浏览器**）；时间呈 **3~5 次连击**（07-17 07:26 五连、07-21 06:50 三连、07-25 三连…），换算北京时间都在白天。

### 为什么"明明登录了"却说没登录（大白话）
登录 = 房卡（浏览器 cookie）+ 前台记录（DB 的 `Session` 行）。服务器只认前台记录。
本项目是**单会话策略**：`createSession` 里 `session.deleteMany({ where: { userId } })` —— **新设备登录会删掉该用户所有旧会话**。于是电脑上那个开着的工作台，房卡还在、页面看起来完全正常（头像/积分是加载时取好的），但前台记录已经没了 → 点生成就被拒。另外两种也会作废：24h 未活动过期（`sessionMaxAgeSeconds = 24*60*60`）、账号被停用。
⭐ **单会话策略是有意设计**（用户 2026-07-28 确认：多会话会导致两端同时生成等更多错误），**不要改**。

### 真正的 bug：状态码错了，导致所有保护失效
1. `credits.ts` 的 `assertUserCanUseCredits` 里 `if (!user) throw new Error(...)` —— 一个**普通 Error**
2. 掉进各 route 的**通用 catch** → `createCodedApiError` 给了 B_xxx → **返回 500**，并 `recordGenerationEvent(status:"failed")` 记红字
3. ⛔ 前端所有"未登录自动跳首页"的保护（chat-workbench 里 5 处）**只认 401** → 全部不触发
4. 用户只看到红字失败卡、毫无登录引导 → 连点 3~5 次；后台失败统计被污染 17 条
5. 讽刺的是 `/api/image` 里那句 `if (!user) return ...401` 写在 `assertUserCanUseCredits` **后面**，永远执行不到

同样写法共 **6 个 route**：`image` / `video` / `chat` / `agent-plan` / `conversation-memory` / `workflow-prompt-optimization/rewrite` → 所有模式都会中。

### v1.0.0.47 的修法（产品约定：**不给任何提示，一操作就跳首页**）
- `src/lib/credits.ts`：新增唯一权威 `UNAUTHENTICATED_ERROR_MESSAGE` / `createUnauthenticatedError()` / **`isUnauthenticatedError()`**；`assertUserCanUseCredits` 改抛带 `code:"UNAUTHENTICATED"` 的错误。
- 6 个 route 的 catch **第一句**统一判 `isUnauthenticatedError(error)` → 回 **401** 且**不记 GenerationEvent**（这不是生成失败，不该进失败统计）。
- 新增唯一权威 `src/lib/session-expired-redirect.ts`：`handleSessionExpiredResponse(response)`（401 → `window.location.replace("/")`）+ 哨兵 `SESSION_EXPIRED_SILENT_ERROR`。
- 两处 `readJson`（`chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx`，**43 处调用的咽喉**）开头各插一行守卫 → 对话流/工作流所有请求收到 401 都直接跳首页。
- `isAbortLikeError` 认哨兵错误 → 跳转瞬间不会闪红字卡。
- chat-workbench 里原有 4 处手写的 `status === 401 → replace("/")` 收敛成调用共享函数。
- 归档规则 `session-expired-recorded-as-failure`（match `请先登录后再使用模型`，不误伤「积分不足…」与新文案）。

⚠️ **遗留分叉（未处理，评估后再动）**：`readJson` 在 chat-workbench 与 workflow 各有一份，两者**错误文案构建方式不同**（前者 `toUserErrorMessage`，后者 `getWorkflowApiErrorMessage` 会补 `errorCode` 前缀）。本次只把 401 守卫统一了，没合并整个函数（合并会改动错误文案行为，风险高）。

## 三·D、「请求失败，请稍后再试。」33 条排查（2026-07-28）—— 第二个兜底桶

**数据**：33 条全是 `image` + `provider=openrouter` + 模型 `openai/gpt-5.4-image-2`(20) / `-agent`(13)；日期只有三天 **07-24（13）、07-06（12）、07-09（8）**。

| 分类 | 条数 | 结论 | 归档 |
|---|---|---|---|
| 07-24 那批：日志里全是 `Insufficient credits` | **13** | 就是 OpenRouter 余额不足，**已被现有 `provider-insufficient-credits` 规则覆盖，不用加新规则** | ✅ |
| 07-06 / 07-09 那批：日志里**一行都没有** | **20** | ⭐ **永久不可追溯**：诊断日志文件最早一行是 `2026-07-10T19:56`（正式服 07-11 从马来迁腾讯云，旧日志没带过来）。且**确认不是余额不足** —— 那两天 OpenRouter 图片成功 188 / 111 条（账户有钱），日志里 `Insufficient credits` 只出现在 07-21 和 07-24 | ✅ 用户 2026-07-28 拍板归档（见下） |

### ⭐⭐ 最重要的发现：**有两个兜底桶，而且同一个根因会同时污染两个**

`toUserErrorMessage(value, fallback = "请求失败，请稍后再试。")` —— fallback 是**默认参数**：
- 调用处**显式传** `GENERIC_MEDIA_ERROR_MESSAGE` → 落进「**服务器繁忙，请稍候再试.....**」
- 调用处**不传** → 落进「**请求失败，请稍后再试。**」（gpt-image 走的 `getOpenRouterError`（`openrouter.ts:772`）就是这种）

所以"余额不足"这一个根因同时污染了两个桶：**53 条进了"服务器繁忙"、13 条进了"请求失败"**。
⛔ **排查任何一类之前，先确认这两个桶都查过了**，别以为查完"服务器繁忙"就完事。

### ⭐ 另一个结构性事实：`toUserErrorMessage` 被套了两层，原文会被吃掉

`getOpenRouterError` 内层就调了一次 `toUserErrorMessage`，把上游原文压成了兜底文案（结果形如 `图片生成失败：请求失败，请稍后再试。`）；到 route 外层再调一次时，**原文已经没了**，任何规则都不可能再匹配到。
→ **这个桶天生就"从 DB 里绝对查不出根因"，只能靠诊断日志。** 这正是 07-10 之前那 20 条无解的原因。
✅ 好消息：新加的 402 规则在**内层**就会命中（内层拿的是原文），所以余额不足以后两个桶都不会再进。
📌 结论：**不用改代码**（诊断日志已经记了上游 body，机制够用；缺的只是 07-10 之前那段历史）。

### 「永久不可追溯」归档规则（用户拍板 B 方案）
理由：留着它对排查没有任何帮助，只会让人反复来查同一批查不动的东西；归档后「待排查」的数字才真正代表**还有希望查的**。

规则 `pre-diagnostics-log-unknowable`，**三个条件必须同时成立**（别放宽）：
1. `createdAt < 2026-07-10`（`DIAGNOSTICS_LOG_START`，诊断日志启用日）
2. 两个日志文件里**一行都搜不到**这个 requestId
3. `failureReason` 命中兜底文案（`GENERIC_FALLBACK_PATTERN` = 服务器繁忙 / 请求失败）

正式服实测（dry-run 验证脚本）：命中 **24 条** = 20 条「请求失败」+ 4 条「服务器繁忙」（07-05 2 / 07-06 13 / 07-09 9；模型 `gpt-5.4-image-2` 21 + `seedance-2-0` 3）；**07-10 之后的 221 条兜底桶事件一条都没碰**。

## 四、⭐ 归档怎么操作


脚本：`scripts/archive-resolved-generation-failures.mjs`

```bash
# 服务器：进容器 /app 跑（本地在项目根目录跑）
node scripts/archive-resolved-generation-failures.mjs          # 试跑，只统计不写
node scripts/archive-resolved-generation-failures.mjs --apply  # 真正归档
node scripts/archive-resolved-generation-failures.mjs --undo --apply   # 撤销全部归档
```

**加新规则只改一处**：脚本里的 `RESOLVED_RULES` 数组（`key` / `match` 正则 / `note` 说明）。
- `match` 匹配的是**诊断日志里的失败原文**（`error` + `upstream` + `extra` 拼起来），不是 failureReason。
- 没有独立原文特征的（比如那个 `!triggered` bug），在脚本里用**事件序列特征**判定（示例：有 `byteplus-auto-review-reuse-active-asset` 且没有 `auto-review-asset-created/active`）。
- `note` 要写清"根因 + 哪个版本修的"，因为它会显示在后台划掉那行的下面。

**流程**：修完代码 → 部署 → 在**测试服和正式服各自**容器里跑 dry-run 看条数 → `--apply` → 刷新后台确认上面数量下降、下面出现划掉的那条。

### 当前规则表（截至 2026-07-28，共 7 条）
| key | 认什么 | 覆盖条数（正式服） |
|---|---|---|
| `reference-image-size` | 参考图宽/高/比例不合规（**两种上游措辞**） | 191 |
| `stale-asset-card` | 审核凭证在平台侧失效 | 11 |
| `approved-card-not-reused` | `!triggered` bug（靠事件序列判定，无原文特征） | 若干 |
| `provider-insufficient-credits` | OpenRouter 402 余额不足（**两个兜底桶里都有**） | 53 + 13 |
| `seedream-pro-sequential-param` | Seedream 5.0 Pro 不接受 `sequential_image_generation` | 13 |
| `reference-slot-not-an-image` | 非图片素材进了参考图槽（B_252） | 26 |
| `reference-video-total-duration` | 参考视频总时长超限（B_232） | 12 |
| `session-expired-recorded-as-failure` | 登录失效被当成生成失败（回 500 而非 401） | 17 |
| `pre-diagnostics-log-unknowable` | 07-10 前 + 日志零记录 + 落兜底桶 = 永久不可追溯 | 24 |
| `platform-download-our-thumbnail-endpoint` | 平台拉我们的动态缩略图接口超时（v48 已修） | **0**（该请求最终成功、不占后台位，见第五·B 节） |

> **实际归档结果（2026-07-28 v47 部署后已 `--apply`）**：正式服 675 → 归档 **367** → 剩 **308** 待排查；测试服 46 → 归档 **10** → 剩 **36**。

## 五、⭐ 同一根因常有多种上游措辞（2026-07-28 踩坑，必看）

**教训**：以为"参考图尺寸"那类已经归档完了，结果后台还有 109 条红字 `expected the height to be at least 300px…` —— 那是**同一个根因在另一个阶段的另一种措辞**（送审阶段说 `Height must be between 300px and 6000px`，建任务阶段说 `expected the height to be at least 300px`）。我们的正则只写了前者，两条正则（`error-message.ts` 的文案映射 + 归档脚本的 `match`）**都漏了后者**。

所以每查一类，务必去正式服把该根因的**全部措辞**捞一遍再写正则：
```bash
# 归一化去重看 BytePlus 的所有 InvalidParameter 措辞（数字/尺寸/Request id 全抹掉）
grep -ho 'InvalidParameter[^}]*' /opt/flashmuse/data/runtime/*.jsonl \
  | sed -E 's/[0-9]+x[0-9]+px/NxNpx/g; s/Request id: *[0-9a-f]*//g; s/[0-9]+/N/g' \
  | cut -c1-160 | sort | uniq -c | sort -rn
```
2026-07-28 跑出来的完整清单（正式服）：

| 上游 message（归一化） | 次数 | 状态 |
|---|---|---|
| `expected the height to be at least Npx, but received a NxNpx image instead` | 103 | ✅ v47 发送前拦截，已加归档规则 |
| `The parameter \`sequential_image_generation\` … not valid` | 39 | ✅ 已查（= 第三·B 节 A 类 13 个事件），已修已归档 |
| `The parameter \`content[N].image_url.url\` … the specified asset is not an image` | 26 | ✅ 已查（= B 类 26 条 = B_252），已修已归档 |
| `Timeout while downloading url: http://<ip>/api/media-thumbnail?...` | 17（**日志行数，非事件数**） | ✅ **已修（v48）**：动态缩略图接口 + 退役马来 IP 被当参考图发给平台。⚠️ 全属同一 requestId 且**最终成功**，后台不占位 → 归档命中 0 属正常，详见第五·B 节 |
| `the parameter video total duration (seconds) …` | 12 | ✅ 已查（= C 类 = B_232），已修已归档 |
| `expected the width to be at least Npx …` | 6 | ✅ 同第一条 |
| `InvalidParameter.UnsupportedImageFormat` | 4 | ❓ 未查（图片格式不支持） |
| `Error while downloading: http://<ip>/api/media-thumbnail?...` | 1 | ✅ 同上一条，已修（v48） |

## 五·B ⭐⭐ 日志里 grep 出来的条数 ≠ 待排查的失败事件数（2026-07-28 第九次会话踩坑，必看）

**教训**：待查清单里写着「平台拉我们缩略图超时 **18 条**」，实际去查发现那 18 行日志**全属同一个 requestId**，而且该请求**最终重试成功了**（`image-route-success`，GenerationEvent 的 `status='success'`）—— 后台「失败原因」只统计 `status='failed'`，所以它**从来没在待排查列表里占过位**。上一任把 `grep -c` 数出来的**日志行数**当成了失败事件数。

**所以每次从日志起手排查，必须做这两步核对**：

```bash
# 1) 先看这批日志涉及几个 distinct requestId（不是几行）
sudo grep '<特征>' /opt/flashmuse/data/runtime/*.jsonl | grep -o '"requestId":"[^"]*"' | sort -u | wc -l

# 2) 再看这些 requestId 的最终事件构成（有没有 *-success 收尾）
for rid in $(sudo grep '<特征>' <日志> | grep -o '"requestId":"[^"]*"' | sed 's/.*:"//;s/"//' | sort -u); do
  echo "--- $rid"; sudo grep -F "\"requestId\":\"$rid\"" <日志> | grep -o '"event":"[^"]*"' | sort | uniq -c
done
```
然后回 DB 用 requestId 核对 `status`（`docker exec <app容器> node -e` + `$queryRawUnsafe`）：

```sql
SELECT "requestId","status","failureReason","resolvedAt" FROM "GenerationEvent" WHERE "requestId" = ANY($1::text[])
```

**判定**：`status='success'` = 中间失败/已重试成功 → **不占后台位、不用归档**（但如果它让用户白等很久，仍然值得修）。只有 `status='failed'` 且 `resolvedAt IS NULL` 的才是真正的"待排查红字"。

## 六、⭐ 正式服未归档红字全貌（2026-07-28 实测，212 之外的都在这）

| 红字 | 条数 | 判断 |
|---|---|---|
| 服务器繁忙，请稍候再试..... | 212 | 兜底桶，v47 归档后预计降到 ~66 |
| 视频任务创建失败：expected the height/width… | 103 + 6 | ✅ 已修，v47 归档 |
| 参考图已过审、视频也已生成，但成品视频/音频因版权或敏感内容被平台拒绝交付 | 56 | ❌ 不归档（平台审核，修不了） |
| **当前模型不支持这组参数，请换比例、分辨率或模型后重试** | **54** | ✅ **2026-07-28 查完**：51 条是我们自己的 bug 且都已修（A 13 / B 26 / C 12，见第三·B 节）→ 归档；D 2 条是误映射（已修文案+重试判定，不归档）；E 1 条无日志 |
| 请求失败，请稍后再试。 | 33 | ✅ **2026-07-28 查完**（第三·D 节）：13 条余额不足（现有规则覆盖）+ 20 条 07-10 前永久不可追溯 → **全部归档，33 → 0** |
| 模型拒绝了本次生成请求…【sexu…】/【viol…】 | 28 + 12 | ❌ 不归档（提示词内容，用户侧） |
| **请先登录后再使用模型。** | **17** | ✅ **2026-07-28 查完并修复**（见第三·C 节）→ 归档 |
| 生成结果可能涉及版权限制 | 16 | ❌ 不归档 |
| 参考图可能包含真人或隐私敏感信息 | 13 + 6 + 1 | ❌ 不归档 |
| 图片平台没有返回图片：抱歉，我不能…（中文明文拒绝，多条各 1~5） | ~20 | ✅ **2026-07-28 已查清**（第七节第 3 条）：这批走的是老 `-agent` 接口、原文已透出、**没落兜底桶**；缺口是"对话流没有 AI 改写重试入口"，已补。**红字本身不归档**（模型拒绝＝提示词内容/平台策略，修不了） |
| 网络连接异常 5 / API Key 无效 4 / 图片格式不支持 4 | 13 | ❓ API Key 那 4 条要查是哪个渠道 |

## 七、下一批要排查什么（按性价比排序）

1. ~~**OpenRouter 余额不足 53 条**~~ ✅ **2026-07-28 已做**：映射成「提供商余额不足！请联系管理员充值。」+ 不再自动重试 + 历史 53 条已加归档规则。**剩下可选增强**：后台把这类单列一栏并给运营告警（现在只能靠用户反馈才知道掉单）。
1b. ~~**「当前模型不支持这组参数」54 条**~~ ✅ **2026-07-28 已查完**（第三·B 节）：51 条归档，另修掉一个误映射。
1c. ~~**「请先登录后再使用模型」17 条**~~ ✅ **2026-07-28 已查完并修复**（第三·C 节）：状态码 500→401 + 不再记事件 + 前端统一跳首页，17 条归档。
1d. ~~**「请求失败，请稍后再试。」33 条**~~ ✅ **2026-07-28 已查完**（第三·D 节）：13 余额不足 + 20 永久不可追溯，全部归档。
1e. ✅ **平台拉我们缩略图超时 —— 2026-07-28 第九次会话已查完并修掉（v1.0.0.48）**：真因=把「给人看的动态缩略图接口」`/api/media-thumbnail?url=` + 已退役马来 IP `101.47.19.109` 当参考图地址发给平台，平台来拉要我们现场生成缩略图 → 超时。修法=新增唯一权威 `src/lib/reference-asset-url.ts` 的 `normalizeReferenceAssetUrl()`（幂等：剥自家主机前缀 + 还原缩略图接口为原图 + 去缓存版本号），8 处咽喉接入（image/video/byteplus-assets 三入口 + `generation-jobs.resolveReferenceUrls` + openrouter/openrouter-video/seedance/video-route 底层拼址）。
    ⚠️⚠️ **但"18 条"是数错的**：那 18 行日志全属**同一个 requestId**（`id_mq4osh4b_j0yyiyq5:image:0`），事件构成 `image-provider-non-ok ×6` + `provider-curl-non-ok ×6` + `curl-fallback-failed ×6` + `image-route-failed ×7`，**最终 `image-route-success ×3`**，GenerationEvent 的 `status = success` → **后台「失败原因」里根本不占位**，所以归档规则 `platform-download-our-thumbnail-endpoint` 命中 0 条是**正确结果**（规则保留，以后真造成失败会自动认出来）。Bug 本身仍值得修：每次超时白等 10 秒 + 触发 curl 兜底重试链，用户端表现为"转很久"。
1f. ~~平台拉缩略图超时~~（重复条目，已并入 1e）
2. ~~**那 40 条轮询 failed**~~ ⭐⭐ **2026-07-28 第十一次会话已全部查清并修（本地未部署，随 v1.0.0.49 上）**，详见第九节。
3. ~~**gpt-5.4-image-2 中文明文拒绝（4 条 + 未来会更多）**~~ ⭐ **2026-07-28 第十次会话已查清并修（本地未部署）**：其实是**两个问题混成一条**。
   - **问题 A**：`openrouter.ts` 有 3 个 `image-provider-empty-result` 打点，**新接口 `/api/v1/images`（gpt-5.4-image-2 走这条，`:1679`）把上游拒绝文字整个扔了**（响应类型 `:1483` 只声明 `data[].b64_json`；日志 `upstream` 写死 `reason:"empty image result"`，连 `responseText` 都没带）→ 抛「没有返回可用原因」→ 被 `error-message.ts:69` **精准打回兜底桶**。**连它说了什么都查不到**，所以先只加日志落盘原文（⭐ 待跟踪：过几天回正式服捞 `upstream.body` 看拒绝文字在哪个字段，**别猜字段名**，详见 `05-next-actions.md` 顶部「待跟踪」）。
   - **问题 B**：后台那 ~20 条「图片平台没有返回图片：抱歉，我不能…」是**老 `-agent` 接口**路径，原文本来就读到了、红字也透出了（`error-message.ts:73-74` 中文原文透出），**根本没落兜底桶**。真正缺口是 **UI：「AI 改写重试」只存在于工作流**，对话流/资产库/Agent 没有这个入口。
   - 已修：`error-message.ts` 新增 `MODEL_REFUSED_MESSAGE` + `isModelRefusalText()`（补上以前**完全没有**的英文拒绝语规则，位置在版权/隐私规则**之前**，否则拒绝原文里的"版权/隐私"字样会被抢走误报成"参考图有问题"）；新增唯一权威 `src/lib/gpt-image-safety-retry.ts` 收敛判定+编排，**对话流补上「AI改写重试 3/5/10 次」**。
   - ⭐ 归档判断：**"模型拒绝"本身不归档**（提示词内容/平台策略，我们修不了，该一直亮着）；但**因为问题 A 而落进兜底桶的那批，等修完读取逻辑后可以归档**（理由="已从兜底桶拆出、现在有明确文案"）。
4. **`empty image result` 7 条**：OpenRouter 说成功但没图，需要看是不是特定 model/参数组合。
5. **其它未归档的红字**（后台上面那份列表里除"服务器繁忙"之外的条目）：同一套方法逐条查。
6. **DB 事务超时 2 条**：并发上来后如果变多，要查 Prisma 连接池配置。

## 八、还没做的相关改进（用户已知，等拍板）

- **参考图尺寸自动修正**：那 82 次不合规，现在只是"拦住 + 说清"。要真正救回来得在送审前用 sharp **自动缩放/补边**到 300–6000px、0.4–2.5 比例再上传。服务器已有 sharp，可做。
- **`getVideoErrorMessage` 有两份复制**（`src/app/api/video/route.ts` 与 `src/lib/generation-jobs.ts`），而且都**只取 `error.message`、把 `error.code` 丢了** —— 这是"真人/敏感类错误被降级成服务器繁忙"的第二个原因（关键字往往只在 code 里）。收敛成一份并保留 code 是下一步该做的（影响面：所有模式的视频错误文案）。

## 九、⭐⭐「40 条轮询 failed」排查全过程（2026-07-28 第十一次会话，已修）

### ⭐⭐⭐ 方法论上的重大突破：**OpenRouter 的视频任务事后仍可回查**

以前的结论是"上游原文没落盘 → 只能等新数据攒几天"。**错了 —— 不用等。**
`video-provider-poll-success` 日志里的 `taskId` 对 OpenRouter 来说就是完整的轮询 URL
（`https://openrouter.ai/api/v1/videos/<id>`），**带 API Key 直接 GET 就能把当时的 `error` 原文取回来**，
本次把 07-27 的任务全都捞到了（一个多月前的也在）。

```bash
# 在腾讯正式服上（key 从 .env.local 读，别打印出来）
KEY=$(sudo grep -m1 '^OPENROUTER_API_KEY=' /opt/flashmuse/data/.env.local | sed 's/^OPENROUTER_API_KEY=//' | tr -d '"'"'"'\r')
curl -s -H "Authorization: Bearer $KEY" https://openrouter.ai/api/v1/videos/<taskId>
# → {"id":"...","status":"failed","error":"task failed with status: FAIL, message: Image pixel is invalid"}
```

**以后遇到任何"OpenRouter 侧原因不明"的失败，第一件事就是拿 taskId 去回查，别再等。**
（⚠️ BytePlus 的 `cgt-xxx` 任务**没有**这个待遇，事后查不到 → BytePlus 那几条仍不可考。）

### 轮询失败 75 条的真实构成（不是 40，40 只是落在兜底桶里的那部分）

先用 `taskId → requestId`（桥来自 `video-provider-create-success`，它两个字段都有）把日志和
`GenerationEvent` 对上，75 条 distinct taskId 全部映射成功：

| 构成 | 条数 | 结论 |
|---|---|---|
| 已是明确文案「成品被平台拒绝交付」（BytePlus） | 26 | ❌ 不归档（平台审核） |
| 「API Key 无效或已过期」 | 4 | 已有明确文案，另案 |
| ⭐ **落在兜底桶「服务器繁忙」的 OpenRouter 任务** | **33** | ✅ 本次全部查清并修 |
| BytePlus 落在兜底桶（B_195/237/246-249/256，07-20~21） | 6 | ❓ **仍不可考**（原文当时没落盘 + BytePlus 任务无法事后回查）→ 留着亮 |

### 那 33 条的两个根因（回查 OpenRouter 拿到的原文）

**根因 A：`Image pixel is invalid` —— 32 条（Kling 全系）**

- 全部来自**同一个用户 ID_664169、同一个会话、同两张参考图**，07-27 连续失败 32 次
  （01:53–02:42 + 07:31–07:35），模型 `kwaivgi/kling-v3.0-std/pro`、`kling-video-o1`。
- 参考图实测 **338×191**（高 191 < 300）。⭐ **和第七次会话归档的那 191 条 BytePlus「参考图尺寸不合规」是同一个根因**
  （文档里那句原文正是 `received a 338x194px image`）—— 同一批用户习惯：拿小截图当参考图。
- **为什么漏出来**：v47 的发送前尺寸拦截被写死「只对 BytePlus 生效」，三处都是
  （`chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx` / `api/video/route.ts`），
  注释里还明写"别的模型不能拿它拦人" → **Kling 路径完全裸奔**。
  而 Kling 官方规则和 BytePlus **一模一样**（≥300×300px、宽高比 1:2.5~2.5:1）。
  典型的「该统一却分叉了」。
- 而且它是**异步**失败：任务先被平台收下（`202`），一两分钟后才 `failed` → 用户白等一两分钟只换来"服务器繁忙"。

**根因 B：`Unsupported output video duration 4 seconds, supported durations are [8] for feature reference_to_video.` —— 1 条**

- `google/veo-3.1`：纯文生视频支持 4/6/8 秒，但**带参考图（r2v）只允许 8 秒**，
  我们的时长表（`models.ts` / `openrouter-video.ts` 都是 `[4,6,8]`）没有"带参考图时收窄"这个维度。

### 本次的修法（用户拍板 1+2+3 一起做）

1. **`video-reference-image-rules.ts` 新增唯一权威 `videoModelEnforcesReferenceImageSizeRules(modelId)`**
   （模型集合 = BytePlus Seedance 3 个 + Kling 3 个），三处咽喉全部改用它，
   不再各自写 `isBytePlusXxxVideoModel`。⚠️ 往集合里加模型必须有依据（官方文档或线上原文）。
2. **`error-message.ts`** 新增两条映射（放在最前面的那个块里）：
   `image pixel is invalid` → 参考图尺寸不符合平台要求（≥300px、比例 0.4–2.5）；
   `unsupported output video duration` → 读出上游给的 `supported durations are [...]` 原样告诉用户。
   同时 **`transient-error.ts` 把这两类列入 `isPermanentError`**（换图换参数才行，重试白烧时间）。
3. **`models.ts` 新增唯一权威 `VIDEO_REFERENCE_DURATION_LIMITS` + `validateVideoDurationWithReferences()`**
   （目前只有 `google/veo-3.1: [8]`），三处咽喉发送前拦截。
   ⭐ **故意不做静默改写**（不悄悄把 4 秒改成 8 秒）—— 时长直接决定计费，悄悄改会让用户多花钱且莫名其妙。
4. **归档脚本新增两条规则** `kling-reference-image-pixel-invalid` / `veo-r2v-duration`，
   并做了一处**结构性增强**：因为这批的日志里根本没有原文（v47 前只记 `hasError` 布尔），
   靠 `match` 永远匹配不上 → 新增 `taskId → requestId` 桥 + `pollFailedTaskIds` 集合，
   命中后**按模型**分派根因（Kling → A，veo-3.1 → B；依据是上面那次回查，不是猜）。
   ⚠️ BytePlus 的轮询失败不在这个分派里，仍不归档。

### 预期归档效果（部署后在正式服跑 `--apply`）

33 条从兜底桶拆出 → 归档；「服务器繁忙」桶应再降 32 左右。那 6 条 BytePlus 仍留着亮。

## 十、⭐ 后台新页面「失败排查」（2026-07-28 第十一次会话新增）

位置：`/admin?tab=failures`，左侧导航「生成记录」下面一条。以后排查红字**先来这页**，不用再手写 SQL。

- 数据层：**唯一权威 `src/lib/admin-failure-triage.ts`**（`getAdminFailureTriageData()`，只读、不写库）。
  原因归一化的 SQL 表达式抽成 `FAILURE_REASON_SQL` 并**被概览页复用**（`admin-overview.ts` 已改为 import 它，
  以前那三段一样的 `regexp_replace` 是抄三遍的，现在只有一份）。
- UI：`src/app/admin/admin-failure-triage-panel.tsx`。
- 这页比概览那个小卡多给的东西（都是实际排查时反复要手查的）：
  1. ⭐ 每条原因标 **「近 7 天仍在发生」/「已停止发生」** —— 还在流血=没修好；已停止=大概率修好了、**可以去归档**。
     列表排序刻意**先按"还在流血"、再按条数**。
  2. ⭐ 每条原因标 **「兜底桶 · 需回日志捞原文」**，并单独做了「两个兜底桶」卡片（含"grep -c 行数 ≠ 事件数"的警告）。
  3. 展开任意一行 → **最近 6 条样本 requestId（可一键复制）** + 涉及的类型/模型/入口明细。
  4. 「按入口」卡片：⭐ 只在某一个入口出 = 大概率"该统一却分叉了"。
  5. 「按模型」带**失败率**（有分母，避免把"用得多"当成"有问题"）。
  6. 「失败最多的用户」：同一个人连续踩同一个坑 = 可复现场景，最容易查清（本次那 32 条就是这么定位到的）。
  7. 近 30 天失败趋势（图片/视频堆叠）+ 今日/昨日/近 7 天与上一个 7 天的对比。
  8. 已归档区：原因划掉 + 归档说明 + 归档时间。
- ⚠️ **归档动作仍然只由 `scripts/archive-resolved-generation-failures.mjs` 执行**（唯一入口），这页纯只读。

### 这页怎么用（一次排查的完整动线）

1. 开 `/admin?tab=failures`，先看顶部四张卡：**待排查总数 / 兜底桶（盲区）大小 / 今日新增 / 已归档**。
   ⭐ **「兜底桶」那个数就是我们的盲区大小** —— 它降下来才叫真的有进展。
   （2026-07-28 归档 33 条后，正式服兜底桶从 60 → 28、占待排查 9.8%。）
2. 点筛选「**近 7 天仍在发生**」→ 这些是**现在还在坑用户**的，优先。
   点「**已停止发生（可考虑归档）**」→ 这些大概率已经修好了，去核对修复 commit 时间就能归档。
3. 看「**按入口**」卡：⭐ 某条原因高度集中在**一个入口**（如工作流 88 / 对话流 11）几乎一定是"该统一却分叉了"。
4. 看「**失败最多的用户**」：同一个人连续踩同一个坑 = 可复现场景，最容易查清。
   （2026-07-28 那 32 条 Kling 就是这么定位到的 —— 一个用户、一个会话、同两张图。）
5. 展开那条原因 → **复制样本 requestId** → 去服务器 `grep` 诊断日志拿原文：
   ```bash
   sudo grep '<requestId>' /opt/flashmuse/data/runtime/generation-diagnostics-log.jsonl | cut -c1-1200
   ```
   ⭐ 如果是 OpenRouter 视频且日志里没原文 → 走第九节那招**直接回查任务**。
6. 修完 → 往归档脚本 `RESOLVED_RULES` 加规则 → 容器里先 `dry-run` 核对条数、再 `--apply`。

### ⚠️ 这页的两个已知限制

- **趋势图统计的是"真实发生过多少次"（含已归档）**，而上面 KPI 与列表只算未归档 —— 两个口径不一样，是故意的。
- 「按模型 / 按入口 / 按用户」都只统计**未归档**部分，归档后这些图会随之变化（不是数据丢了）。

## 十一、⭐ 实机验收这类"发送前拦截"功能的操作要点（2026-07-28 实测总结）

下次测同类功能（拦截 / 黑底提示）直接照抄，能省很多时间：

1. ⛔ **黑底提示是瞬时的**，`browser_snapshot` 之后再看就没了 → 点发送后**立刻轮询** `body.innerText`
   （实测 15 × 120ms 的循环足够抓到）。
2. 另一个更稳的判据：**被拦时输入框里的提示词和参考图不会被清空**（正常发出会清空）。
3. ⛔ **Playwright MCP 的文件选择器不要在 `run_code` 里自己 `waitForEvent('filechooser')`** —— 会和 MCP 的
   modal 跟踪打架卡住。正确姿势：`browser_click` 点上传 → `browser_file_upload` 传文件 → 再 `run_code` 做后续。
4. 造测试图不用找素材：项目已装 `sharp`，几行生成 200×120（触发拦截）+ 1280×720（合规反例）。
5. ⭐ **必须测反例**：本次就靠反例确认了"veo 4 秒**不带**参考图仍能正常出片""Kling 合规尺寸不被误拦"——
   拦截类功能最大的风险就是**拦多了**。
6. 本地进不了后台时：临时把主测试号加进 `.env` 的 `ADMIN_EMAILS`（逗号分隔），**验完记得还原**。
7. ⛔ 工作流画布（tldraw）**连线不适合自动化**（8% 缩放下节点分散），工作流侧这类验收留给人工。
   ⭐ **2026-07-29 修正：连线确实不好自动化，但"点节点 → 用快捷菜单"完全可以自动化**，方法见下面第十一·B 节。

## 十一·B、⭐⭐ Playwright 操作 tldraw 画布的可行姿势（2026-07-29 第十三次会话摸出来，验高清下拉时全程跑通）

上一节说"工作流留给人工"只对**连线**成立。**点节点、开快捷菜单、点下拉选项、跑生成、读结果标签，全都能自动化**：

1. ⛔ **`browser_click` 点不到画布里的节点**，会报
   `<img alt="生成图片" …> from <div class="tl-html-layer tl-shapes"> subtree intercepts pointer events` 然后超时。
   ✅ **必须用 `browser_run_code_unsafe` 里的 `page.mouse.click(x, y)`**，坐标从 `browser_take_screenshot` 上量。
2. ✅ **`Shift+1` = 缩放到适应全部节点**（tldraw 快捷键）。点开节点或生成出新节点后视口会变，
   **每次量坐标之前先 `Shift+1`**，否则上一次的坐标全失效。
3. ✅ **展开快捷菜单里的下拉**：`page.locator('button', { hasText: '高清' }).first().hover()` + 等 ~700ms，
   再 `page.getByRole('button', { name: 'GPT 2K', exact: true }).click()`。
   ⚠️ **`exact: true` 必须加**（`GPT 2K` 会同时匹配 `GPT 4K` 这类）。
4. ✅ **判断生成结束**：轮询 `document.body.innerText`，`!t.includes('生成中')` 即结束。
   ⚠️ 单次 `run_code` 有 30s 上限 → **长等待拆成多次调用**，别在一个 `run_code` 里循环 100 秒（本次超时过一次）。
5. ✅ ⭐ **验证"模型/分辨率有没有走对"不要看图，读节点标签**：节点右上角会打印
   `模型名 / 比例 / 分辨率 / 实际像素`（例 `Gemini 3.1 Flash Image Preview / 16:9 / 2K / 2752x1536`），
   直接从 `innerText` 取，既准确又能同时验证"比例贴源图"这类要求。
6. ⚠️ **`page.reload({ waitUntil: 'networkidle' })` 在本站会超时**（有长轮询）→ 用 `page.goto(url)` + 固定 `waitForTimeout`。
7. ⚠️ **测"后台开关 → 前台隐藏"必须重新加载前台页面**：`editModelToggles` 随 `/api/model-availability`
   **只在页面加载时取一次**。我一度以为按钮没恢复，其实那个标签页还是开关关闭时加载的。**不是 bug。**
8. ⭐ **工作流画布崩了长什么样**：整个画布变成「Something went wrong / Please refresh your browser」，
   控制台一条 `Minified React error #310`。看到这个先查**是不是往 `WorkflowSelectedNodeOverlay` 的提前 return 之后加了 Hook**。

## 十二、⭐⭐「图片平台没有返回图片」101 条排查全过程（2026-07-29 第十二次会话，已修）

### 结论：不是分叉、不是崩溃，是**我们把模型说的话当报错原样贴给用户**

| 实际根因 | 条数 | 改动前用户看到什么 |
|---|---|---|
| **模型明文拒绝** | **92** | 模型那段 **500 字小作文原样当红字**（还带 markdown 列表） |
| **模型把提示词/改写建议原样复读回来**（没出图、没拒绝语） | **7** | 红字 = **用户自己的提示词** |
| `error code: 520`（Cloudflare）、`Provider returned an empty response` | **2** | 「图片平台没有返回图片：error code: 520」 |

全部 101 条来自**同一个打点**（`openrouter.ts` 老 `/chat/completions` 的 `image-provider-empty-result`），**没有代码分叉**。

### ⛔⛔ 方法论第 7 条：「集中在一个入口」不一定是分叉，先排除"一个人刷出来的"

后台新页显示「工作流 88 / 对话流 11 / 资产库 1 / Agent 1」，按第十节的设计意图这是"该统一却分叉了"的强信号 —— **这次是假信号**。
实查：**101 条里 76 条来自同一个用户 ID_868181**（07-22~24 三天、同一个会话、反复试同一批擦边提示词，07-23 一天 41 条），另 17 条来自 ID_686996。入口集中只是**这个人爱用工作流**。

⭐ **以后看到"高度集中在一个入口"，第一步先看「失败最多的用户」那张卡**：如果也高度集中在一个人，那大概率是用户行为而不是代码分叉。两张卡要一起看。

### ⭐⭐ 方法论第 8 条：同一个"模型"在后台可能是两条完全不同的接口，别混着判

| 后台名字 | model id | 走哪个接口 | 上游给回来什么 |
|---|---|---|---|
| GPT-5.4 Image 2（**GPT版**） | `openai/gpt-5.4-image-2-agent` | **老** `/chat/completions` | 中间那层语言模型把图片模型的拒绝**翻成中文人话**（小作文）。⭐ **信息量最大**，常直接给出可用的安全改法 |
| GPT-5.4 Image 2（**直连版**） | `openai/gpt-5.4-image-2` | **新** `/api/v1/images`（07-19 commit `d85fa92` 迁的） | OpenAI 直接 **400** `rejected by the safety system`（**有时**附 `safety_violations=[sexu…]`，有时连这个都没有） |

- ⚠️ **同一个 model id 的历史含义会变**：61 条挂在"直连版"名下的小作文**全部发生在 07-17 及之前**（迁走前它也走老接口）。**按 model id 分组时一定要看日期分布**，否则会把"迁接口前的老数据"当成"新接口的行为"。
- ⛔ 我一开始就是没分清这两条链路，被用户当场质疑「小作文是不是 GPT 版的、【xxx】是不是直连版的」—— **核实后用户是对的**。判定入口：`models.ts` 的 `isGptImage2Model` / `isGptImage2AgentModel`，分流点 `openrouter.ts:1755`。
- ⛔ **另一个误判**：我一度说"07-24 起已停止发生，说明换新接口就好了"。**错** —— GPT版还在走老接口、机制一点没变，随时会再犯；07-24 之后没发生只是那位重灾用户不试了。**判"已停止发生"必须问一句：那条链路本身改过吗？**

### 排查用到的关键命令（照抄）

```bash
# 1) 按错误编号定位用户实测的那批（B_622~B_629 就是这么找到的）
#    在容器里跑，WHERE "failureReason" ~ '\(B_6(1[0-9]|2[0-9])\)'
sudo docker cp probe.js flashmuse-flashmuse-app-1:/app/probe.js
sudo docker exec -w /app flashmuse-flashmuse-app-1 node probe.js

# 2) 拿 requestId 去日志捞真实原文（失败类事件每种取一条）
sudo grep -F "<requestId>" /opt/flashmuse/data/runtime/generation-diagnostics-log.jsonl \
  | grep -F '"event":"image-provider-empty-result"' | head -1 | cut -c1-1400

# 3) 确认某个 event 到底还发不发生（按天计数）
sudo grep -h 'image-provider-empty-result' /opt/flashmuse/data/runtime/generation-diagnostics-log.jsonl \
  | grep -oE '"time":"2026-[0-9]{2}-[0-9]{2}' | sort | uniq -c
```

⚠️ `GenerationEvent` 表**没有 `prompt` 列**（写 SQL 别 select 它，会报 `42703`）；提示词只在诊断日志的 `promptPreview`/`promptHash` 里。

### 本次的修法（用户拍板：两种接口都尽量显示原文 + 两种都启动 AI 改写 + 红字与按钮成套 + 资产库覆盖）

1. ⭐ **新增唯一权威 `models.ts` 的 `modelSupportsPromptSafetyRewrite()`** —— **红字文案与按钮显示共用同一个模型判定**，从此"红字说可以AI改写"与"按钮真的出现"永远一致。
   （起因：`toUserErrorMessage` 只收到错误字符串、**不知道模型**，所以视频碰到拒绝语也会被写上"可点AI改写"，而视频没这个按钮。修法 = `toUserErrorMessage(value, fallback, { model })` + `createCodedApiError(..., { model })`，图片三处传、视频六处**故意不传**。）
2. **`error-message.ts` 把两条拒绝规则合并成一条**，输出 = 前缀 + （能改写才加的那半句）+ **`以下是模型返回的拒绝原因："<原文截 260 字>"`**；拿不到原文时用兜底句「模型拒绝了本次生成请求，可能是提示词内容不符合平台安全策略！…」。直连版优先取 `safety_violations`，没有就取英文并**削掉 `If you believe this is an error, contact us at …` 客服尾巴**。
3. **`openrouter.ts` 把"没出图"的三种情况彻底分开抛**：① `data.error.message` = **平台报错** → `图片生成失败：${原文}`（映射成"平台临时异常"且保持可自动重试）② `message.refusal|content` 且是拒绝语 = **模型不肯画** ③ 是文字但不是拒绝语 = **只回了一段文字**（不能把用户的提示词当报错贴出去）。
4. **资产库补齐整套 AI 改写**（此前唯一漏做的入口），含 **@名保护**（改写丢了 @名 = 参考图全丢 → 新增共享 `ensureMentionNamesPreserved()` 把缺失的 @名补回提示词最前面）。

### ⭐ 改这套文案时必须连带改的三处（否则会坏，都写了注释）

1. `gpt-image-safety-retry.ts` 的 `isModelRefusedMessage` —— **认前缀** `模型因色情/暴力/隐私安全等原因拒绝出图`。⛔ **绝不能改回整句比对**（文案后半段是可变原文），否则**所有 AI 改写按钮全部不亮**。
2. `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` —— **按前缀归一化**。不改的话后台「失败原因」会**炸成几十条各 1 条**。⭐ **这是"给用户看的文案里带可变原文"这类改动的通用副作用，以后再做类似改动一定要想到这里。**
3. `error-message.ts` 顶部的**幂等保护** —— 认出成品文案就原样返回。**因为这个函数在"服务端映射→前端再映射"链路上可能被调两次**，末尾兜底透传会截到 180 字、把刚附上的原文砍掉。

### ⛔⛔ 一次误报（下一个 AI 千万别再踩）：对话流失败卡是**懒挂载**的

我一度报告「刷新后历史消息的失败卡不再渲染，只剩红字，用户刷新一下 AI 改写按钮就没了」。**根本没这个 bug。**

- 逐层证明数据完好：DB 的 `messagesJson`、`GET /api/workspace-state` 返回，`mode:"image"` / `failedImageCount:1` / `imageResultSlots:[{type:"failed",…}]` / `generationMeta.model` / `settings.imageCount` **一个字段都没丢**；`sanitizeWorkspaceMessage` 也不删这些。
- ⭐ **真因：失败卡包在 `<LazyMediaMount height={250}>` 里**（`chat-workbench.tsx:16531`）—— **滚到视口附近才挂载**，没进视口只是 250px 占位。而红字**不在**这个组件里，所以红字一直显示 → "红字在、卡不在"被我误判成数据丢了。
- 验证：`scrollIntoView({block:'center'})` + 等 2.5s → 卡立刻出现，`图片生成失败|AI改写重试3次|AI改写重试5次|AI改写重试10次`。
- ⛔ **教训：`querySelectorAll('.flashmuse-failed-media-card')` 统计对话流失败卡不可靠**，先把目标消息滚进视口再断言。

### ⭐ 顺带查清：「限流」到底是什么（用户提问）

```
HTTP 429 { "error": { "message": "OpenAI was rate limited by Cloudflare (error code: 1015)",
                      "code": 429, "metadata": { "provider_name": "OpenAI" } } }
```

`1015` 是 **Cloudflare 的限速码** → **OpenRouter 去调 OpenAI 时被 OpenAI 的 Cloudflare 挡了**，限速在 **OpenRouter→OpenAI** 那一跳，**跟我们的配额、用户点太快都无关**（他们出口 IP 被限，我们改不了）。
我们的行为是对的：同一 requestId 自动重试 4 次、扛约 70 秒才 `image-job-failed`。正式服 07-28 有 7 条（都在资产库入口、都是直连版）。
**用户拍板：只改文案** → 「当前模型繁忙或被限流，请稍候再重试！」。**不动退避、不做限流自动降级。**

### 归档状态：✅ 2026-07-29 第十三次会话已归档（用户拍板）

- 规则 `gpt-image-empty-result-legacy-form`，`match: /图片平台没有返回图片：/`（**只认全角冒号**，一条正则覆盖三种旧形态）。
  ⛔ **绝不能放宽成裸串 `图片平台没有返回图片`** —— 会连带吃掉 `…，且没有返回可用原因。`（另一根因、仍在兜底桶）
  和 `…，模型只回了一段文字：`（v51 新形态），两者都不该归档。
- ⚠️ **实际归档 120 条，不是这里写的 101 条** —— 07-29 之后同类又新长了约 19 条（pending 总数 286 → 319）。
  **教训：文档里的条数是快照，跑归档前一定重新 dry-run 看真实数字。** 归档后正式服 **319 → 199**。

### ⛔⭐ 方法论第 9 条（2026-07-29 第十三次会话）：归档规则必须考虑「以后新发生的怎么办」

本次 dry-run 时旧规则 **`provider-insufficient-credits` 又命中了 11 条上次归档（07-28）之后新发生的事件**。
按铁律 ④，这 11 条已经是明确文案「提供商余额不足！请联系管理员充值。」、属于运营真没钱、我们修不了 → **必须继续亮着**。
但规则只有 `match` 没有时间维度，`--apply` 会年复一年地把新数据一起吃掉。

**修法（已进脚本）**：规则支持可选的 **`before` 日期下限** + `ruleAllowsEvents()`；
`provider-insufficient-credits` 设 `before = 2026-07-27T18:19:00Z`（= v1.0.0.47 上正式服的时刻，备份目录 `20260728-021857`）。
加了下限后 dry-run 从 131 变成干净的 120。

⭐⭐ **通用规则：写归档规则时先问一句「这个根因以后还会不会再发生？」**
- **修好了、此后零复发** → 不需要 `before`。
- **修不了、只是从兜底桶映射成了明确文案**（余额不足、模型拒绝、平台审核）→ **必须配 `before` = 映射上线的时刻**，
  否则以后每次跑归档都会把「本该一直亮着」的新事件偷偷抹掉，**后台就再也看不见这个问题了**。

### ⭐ 触发「模型安全拒绝」的可靠技巧（2026-07-29 白捡）

想实机验证拒绝类红字 / AI 改写按钮时，**不要靠改提示词硬碰**（第十二次会话在资产库试了 5 次全部照样出图、烧约 96 积分，
因为 `ruleText` 会把提示词包装成"角色设定图"，中间那层语言模型就不拒绝了）。

⭐ **改用「擦边的源图」走 img2img** —— 本次工作流高清选 GPT 4K、源图是沙滩排球比基尼，**一次就中**，
直连版立刻回 `safety_violations`，红字与三颗 AI 改写按钮全部正常出现。**图像内容比文字更难被中间层洗掉。**

### 剩余待查（正式服归档后剩 199 条，其中审核类按铁律不归档）

`empty image result` 7 条 / `InvalidParameter.UnsupportedImageFormat` 4 条 / `API Key 无效` 4 条（查是哪个渠道）/ DB 事务超时 2 条。
⚠️ **这些条数是快照，去 `/admin?tab=failures` 看实时值。**


