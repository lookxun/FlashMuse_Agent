# 红字失败原因排查 & 归档（2026-07-27 新建，2026-07-28 大幅补充；排查线上报错必读）

> 这份文档专门管一件事：**后台「运营概览 → 失败原因」里那些红字，逐个查清真实根因 → 修掉/堵上 → 归档划掉**。
> 用户的要求很明确：**"排查掉一批就自动去归档"**，所以每次修完必须走本文最后的归档流程，否则后台数字永远不降、下一个人没法判断哪些还没查。
>
> **速查目录**：铁律（归档判什么）→ 一（后台看的是什么，⭐**两个兜底桶**）→ 二（怎么查真根因）→ 三/三·B/三·C/三·D（已查清的四批，含完整数据与修法）→ 四（归档操作）→ 五（⭐一根因多措辞的坑）→ 六（正式服红字全貌）→ 七（下一批查什么）→ 八（等拍板的改进）。
>
> **已查清并归档的五批（累计约 360 条）**：①参考图尺寸/比例 191（两种措辞）②审核凭证失效 11 ③OpenRouter 余额不足 53+13 ④「当前模型不支持这组参数」51 ⑤登录失效 17 ⑥07-10 前永久不可追溯 24。

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

- 位置：后台 `/admin` → 运营概览 → 卡片「**失败原因**」。
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
| `Timeout while downloading url: http://<ip>/api/media-thumbnail?...` | 17 | ❓ 未查（平台拉我们的缩略图超时，应改用直链而非 media-thumbnail） |
| `the parameter video total duration (seconds) …` | 12 | ✅ 已查（= C 类 = B_232），已修已归档 |
| `expected the width to be at least Npx …` | 6 | ✅ 同第一条 |
| `InvalidParameter.UnsupportedImageFormat` | 4 | ❓ 未查（图片格式不支持） |
| `Error while downloading: http://<ip>/api/media-thumbnail?...` | 1 | ❓ 同 Timeout 那条 |

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
| 图片平台没有返回图片：抱歉，我不能…（中文明文拒绝，多条各 1~5） | ~20 | ❓ 就是第三节那类 gpt-5.4-image-2 拒绝，应识别成"模型拒绝"并接 AI 改写重试 |
| 网络连接异常 5 / API Key 无效 4 / 图片格式不支持 4 | 13 | ❓ API Key 那 4 条要查是哪个渠道 |

## 七、下一批要排查什么（按性价比排序）

1. ~~**OpenRouter 余额不足 53 条**~~ ✅ **2026-07-28 已做**：映射成「提供商余额不足！请联系管理员充值。」+ 不再自动重试 + 历史 53 条已加归档规则。**剩下可选增强**：后台把这类单列一栏并给运营告警（现在只能靠用户反馈才知道掉单）。
1b. ~~**「当前模型不支持这组参数」54 条**~~ ✅ **2026-07-28 已查完**（第三·B 节）：51 条归档，另修掉一个误映射。
1c. ~~**「请先登录后再使用模型」17 条**~~ ✅ **2026-07-28 已查完并修复**（第三·C 节）：状态码 500→401 + 不再记事件 + 前端统一跳首页，17 条归档。
1d. ~~**「请求失败，请稍后再试。」33 条**~~ ✅ **2026-07-28 已查完**（第三·D 节）：13 余额不足 + 20 永久不可追溯，全部归档。
1e. ⭐ **平台拉我们缩略图超时 18 条 —— 下一个优先查这个**（`Timeout/Error while downloading url: http://<ip>/api/media-thumbnail?...`）：送审/建任务时给平台的是**动态接口**地址，平台拉超时。应改成给静态直链。
1e. **平台拉我们缩略图超时 18 条**（`Timeout/Error while downloading url: http://<ip>/api/media-thumbnail?...`）—— 送审/建任务时给的是 `media-thumbnail` 动态接口，平台拉超时。应改成给静态直链。
2. **那 40 条轮询 failed**：现在日志已经会记原文了，**等新数据攒几天再查一次**，大概率是输出侧内容审核（`OutputVideoSensitiveContentDetected` 之类）。
3. **gpt-5.4-image-2 中文明文拒绝（4 条 + 未来会更多）**：现在走 `image-provider-empty-result` 分支 → 落到"服务器繁忙"。应识别成"模型拒绝生成"并接上已有的「AI 改写重试」入口。
4. **`empty image result` 7 条**：OpenRouter 说成功但没图，需要看是不是特定 model/参数组合。
5. **其它未归档的红字**（后台上面那份列表里除"服务器繁忙"之外的条目）：同一套方法逐条查。
6. **DB 事务超时 2 条**：并发上来后如果变多，要查 Prisma 连接池配置。

## 八、还没做的相关改进（用户已知，等拍板）

- **参考图尺寸自动修正**：那 82 次不合规，现在只是"拦住 + 说清"。要真正救回来得在送审前用 sharp **自动缩放/补边**到 300–6000px、0.4–2.5 比例再上传。服务器已有 sharp，可做。
- **`getVideoErrorMessage` 有两份复制**（`src/app/api/video/route.ts` 与 `src/lib/generation-jobs.ts`），而且都**只取 `error.message`、把 `error.code` 丢了** —— 这是"真人/敏感类错误被降级成服务器繁忙"的第二个原因（关键字往往只在 code 里）。收敛成一份并保留 code 是下一步该做的（影响面：所有模式的视频错误文案）。
