# 红字失败原因排查 & 归档（2026-07-27 新建，2026-07-29 补第十七节；排查线上报错必读）

> ## 🆕 2026-08-05（第四十一次会话）新增案例：**B_92~B_98「参考视频涉及版权」= 用户侧问题，⛔ 不归档**
>
> 🗣️ 用户问「正式服 B_92 是什么问题」。**完整查法与结论见本文最后的「第十八节」**，这里只留三条最要紧的：
>
> 1. **`B_xxx` 怎么查**：它存在 `GenerationEvent.failureCode`（也内嵌在 `failureReason` 里）——
>    `WHERE "failureCode" = 'B_92'`。⚠️ **计数器会被 `--reset-all` 归零，所以同一个编号在不同轮次会重复出现**
>    （本次日志里就有两条 B_92，一条是今天的视频版权、一条是上一轮的"请先登录"）→ **必须用时间 + DB 一起定位**。
> 2. **根因**：BytePlus 拒了用户上传的那个**参考视频**，原文
>    `The request failed because the input video may be related to copyright restrictions.`
>    **不是我们的 bug、没扣钱**（`CreditLedger` 0 行、`GenerationJob` 都没建成，创建阶段就被拒）。
> 3. ⛔⛔ **不归档**：它**从来没落进兜底桶**（一直有明确文案），属于铁律里的第 ④ 类
>    「映射出去后新形成的那条明确原因本身 → 修不了就该一直亮着」。
>    ⭐ 但顺手修掉了 3 个**我们自己的**毛病（userId 没记、日志不记参考视频、同一素材反复送审），见第十八节。


> ## 🛑 先读这段（2026-07-29 第十七次会话）：**红字已整轮清零，新一轮刚开始**
>
> v1.0.0.54 部署完成后，按用户要求跑了 **`--reset-all` 整轮清零**：
> **正式服归档 221 条、测试服归档 46 条，两服「待排查」= 0**，`B_xxx` 计数器也归 0（下一条报错是 `B_1`）。
>
> 用户的话：**「现在从部署完开始看后面新出现的红字，新一轮开始。等红字多了以后再排查问题。」**
>
> 所以接手的 AI 该做的是：
> 1. 去 `/admin?tab=failures` 看**新一轮攒了多少条**；
> 2. **量还很少 → 直说"还没攒够，建议再等等"**，别硬查（历史数据已经归档，查不出东西）；
> 3. 量够了 → 才按下面的方法论开工。
>
> ⛔ **别再翻第十三节的 A 表**（9 条已全部收口，相关事件也已归档）。下面全部内容 = **方法论 + 历史案例库**，
> 遇到新红字时当"以前踩过什么坑/怎么查"的参考书用。
>
> ⭐ **`--reset-all` 用法与边界见本文最后的「第十七节」。** 日常排查仍走 `RESOLVED_RULES` 逐条归档，两者别混。



> 这份文档专门管一件事：**后台「运营概览 → 失败原因」里那些红字，逐个查清真实根因 → 修掉/堵上 → 归档划掉**。
> 用户的要求很明确：**"排查掉一批就自动去归档"**，所以每次修完必须走本文最后的归档流程，否则后台数字永远不降、下一个人没法判断哪些还没查。
>
> **速查目录**：铁律（归档判什么）→ 一（后台看的是什么，⭐**两个兜底桶**）→ 二（怎么查真根因）→ 三/三·B/三·C/三·D（已查清的四批，含完整数据与修法）→ 四（归档操作）→ 五（⭐一根因多措辞的坑）→ 五·B（⭐日志行数≠事件数）→ 六（正式服红字全貌）→ 七（下一批查什么）→ 八（等拍板的改进）→ 九（40 条轮询 failed）→ 十（⭐后台「失败排查」页怎么用）→ 十一（验收拦截类功能的操作要点）→ 十二（101 条「没有返回图片」）→ 十三（红字全量归纳成 A/B 两张表 + 归档脚本全局护栏）→ 十四/十五/十六（A5/A3/A7/A1 等逐条收口）→ **十七（⭐⭐ `--reset-all` 整轮清零：用法、与日常归档的区别、2026-07-29 实际数字）**。
>
> ⚠️ **第六节那份"正式服红字全貌"、第七节"下一批查什么"里的条数都是历史快照**，
> 且相关事件已在 2026-07-29 整轮清零里全部归档 → **别拿它们当当前待办**，只当"以前长什么样"的参考。

>
> ⚠️ **下面这句已过期，留着只为对照**：~~接手排红字的 AI：直接跳到第十三节，A 表就是待办清单，建议从 A5 开始~~
> —— **A 表 9 条已于第十六次会话全部收口，相关事件已在第十七次会话整轮清零里归档**。
> 现在正确的入口是**文件顶部那段红框**（先看新一轮攒了多少条）。第十三节从此只当历史案例库看。

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

## 十三、⭐⭐ 从「某个对话出了问题」反查到根因的完整姿势（2026-07-29 第十四次会话，d37 事件）

前面十二节都是**从后台红字往下查**。这一节是另一个方向：**用户报"某个对话/某个功能出问题了"，怎么把它查穿。**
本次靠这套姿势，在没有任何日志线索的情况下，从一句「d37 这个对话用了 ai 改写出了非常多的问题」查出
**17 张成功图只剩 2 张进对话、白烧 197 积分**，并定位到两行代码。

### A. 第一步：把"用户说的编号"翻译成数据库主键

⭐ **对话编号 `d37` 不是 id、不是 hash，是前端自增的序号**：

| 东西 | 位置 |
|---|---|
| 生成 | `chat-workbench.tsx` `createSession()`，`d${n}`（工作流是 `w${n}`），删除后号码不复用 |
| 存哪 | **`WorkspaceSession.summaryJson->>'conversationCode'`**（⛔ 没有独立列，schema 里也没有 `Conversation` 表，对话表叫 `WorkspaceSession`） |
| 解析 | `getConversationNumber()`，正则 `^d(\d+)$` |
| 衍生 | 媒体系统名 `image_36_d37` / `video_1_d37`（`buildConversationMediaSystemName`）——⭐ **看到 `_d37` 后缀就能反推是哪个对话** |

查法（**同一个编号会有多个用户各自的对话，必须按 updatedAt 挑最近那条**）：

```sql
select ws.id, ws."sessionId", ws."userId", ws.title, ws."updatedAt",
       ws."summaryJson"->>'conversationCode' as code,
       length(ws."messagesJson"::text) as msglen
from "WorkspaceSession" ws
where ws."summaryJson"->>'conversationCode' = 'd37'
order by ws."updatedAt" desc;
```

本次三条命中（`ID_636611` / `ID_955937` / `ID_294338`），只有第一条的 `updatedAt` 是事发时间。

### B. 第二步：把消息 JSON 摊开，先只看"有哪些字段"

⭐ **别一上来 dump 全文**（`messagesJson` 45KB）。先每条只打 `role/mode/content 前 160 字/failedImageCount/Object.keys`，
**从 keys 里找出带可疑字段的那几条**（本次是 `gptImageOptimizationAttemptPrompts` 等），再对这几条 dump 全文。
一眼就能看到 `attemptPrompts` 有 9 条、`retryingIndexes: [0,1]` 残留、`content` 与 `imagePrompts` 不一致。

### C. 第三步（⭐⭐ 本次最关键）：拿 GenerationEvent / CreditLedger / MediaAsset **三方交叉核对**

只看消息 JSON 只能看到"3 个失败卡 + 1 张图"，**看不出丢了 15 张**。真相是这样出来的：

| 表 | 查什么 | 本次结果 |
|---|---|---|
| `GenerationEvent` | 按 `userId` + 事发时间窗列出 status/failureCode/model/requestId | **23 条，16 条 success** |
| `MediaAsset` | 同一时间窗，看 `systemName`/`url` | **17 张全部入库**（`image_19_d37`~`image_36_d37`） |
| `CreditLedger` | 同一时间窗，按 requestId 里的 `:image:` / `:rewrite:` 分组求 `credits` | 生图 173 + 改写 24 = **197** |
| 消息 JSON | `images` 数组长度 | **1**（每条消息） |

**「事件成功 16 / 资产入库 17 / 消息里只有 2」= 前端把成功图丢了。** 这个结论只能靠交叉核对得出。
⭐ 反过来说：**只要"资产库有、对话里没有"，就一定是前端 append 环节丢的，不用去查上游。**

再看 requestId 时间线就能锤死机制：`02:08:48 success (cee7aea9)` → `02:08:51 failed (45a4eec6)`，
后者抢走了 `message.requestId`，前者的图无处可归 → 静默丢弃。

### D. 本次查到的两条前端硬 bug（以后写"多轮自动重试"一律先想这两点）

1. ⛔⛔ **`message.requestId` 是单值，不能承载并发**：`appendImagesToAssistantMessage` 靠
   `message.requestId === requestId` 找消息。任何"同一条消息上并发跑多条重试链"的设计都会互相覆盖 →
   先完成的结果被丢弃。**要么串行化（锁到 message 粒度），要么把 requestId 改成集合。**
2. ⛔⛔ **`sessionsRef.current` 在 `useEffect` 里赋值（`chat-workbench.tsx:9574`）**，
   所以 **`await` 之后立刻读它拿到的是旧值**。本次编排就是用
   `getMessageImageCount()`（读 sessionsRef）判断"图片数有没有变多"来判定成功 → **成功被判成失败、继续下一轮**。
   **别用 ref 快照做"刚刚那次异步操作成功了吗"的判定**，让被调用方直接返回结果。

### E. 操作层面的坑（都实际踩过）

1. ⭐⭐ **查线上 DB 不用往服务器写文件**：node 脚本本地 base64 后
   `sudo docker exec <容器> sh -c 'echo <b64> | base64 -d | node'` ——
   一次绕开 PowerShell 吃 `$`（`p.$queryRawUnsafe` 变 `p.()`）、吃中文、吃嵌套引号的**全部**坑。
   （PowerShell 侧：`[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($js))`，`$js` 用 `@'...'@` 单引号 here-string。）
2. ⛔ **列名坑，先查 `information_schema.columns` 再写 SQL**（本次连撞三次 `42703`）：
   - `GenerationEvent` **没有 `surface`**（入口字段叫 `source`）
   - `MediaAsset` **没有 `name`**（是 `displayName` / `systemName`）
   - 积分表叫 **`CreditLedger`**（不是 CreditTransaction），金额字段是 **`credits`**（不是 `amount`）
   - 全表清单：`CreditLedger, CreditSetting, EmailVerificationCode, GenerationEvent, GenerationJob,
     GptImagePromptOptimizationCase, MediaAsset, Session, UploadEvent, User, UserAssetState,
     UserWorkspaceState, WorkspaceMessage, WorkspaceSession, WorkspaceWorkflow`
3. ⛔ **`CreditLedger.requestId` 自带后缀**：`<clientId>:image:0` / `<clientId>:rewrite:2`。
   ⭐ 拿它分组就能算出"这次到底调了几次生图、几次改写"，比翻日志快得多。
   `:rewrite:1` 出现 N 次 = **起了 N 条改写链**（attemptIndex 从 1 开始）→ 一眼看出用户点了几下、有没有并发。
4. ⛔ **老数据的红字不会随代码改动而变**（`failureReason` / `imageResultSlots[].reason` 是**持久化的字符串**）。
   改完文案去线上验证，**必须看新发起的那一次**，别对着历史卡说"没生效"。

### F. 验收「撤掉一个前端功能」的最小实测套路（本次照此跑完，全过）

| 类型 | 做法 |
|---|---|
| 正例 | 真触发一次拒绝：图片模式 + `openai/gpt-5.4-image-2` + 1 张 + 露骨提示词 → **秒回 400**，比 img2img 更快更省 |
| 断言 | `page.locator('.flashmuse-failed-media-card').last().innerText()` 应只有「图片生成失败\n重新生成」；`getByText('AI改写重试').count()` 应为 **0** |
| 反例 1 | 正常提示词生图必须仍然成功（确认没搞坏成功路径）。⭐ 判据：消息底部反馈项是「要图给视频或要视频给图」= 成功卡；「回答不对」= 失败卡 |
| 反例 2 | **没被撤掉的那一处必须还在**：工作流失败卡三颗「AI改写重试 3/5/10 次」+ 说明文字，且画布无 `Something went wrong` |
| 反例 3 | 资产库失败卡（`查看失败` 展开）也只有「重新生成」 |
| 纯函数 | 把上游 4 类原文喂给 `toUserErrorMessage` + `isGptImageSafetyFailure`，验"文案统一 / 工作流按钮仍 true / 视频模型 false / 兜底桶不误判"。⭐ 临时脚本放 `.runtime/*.ts` 用 `npx tsx` 跑完就删 |

⛔ **`page.waitForTimeout` 循环轮询超过 ~2 分钟会撞 MCP 工具 30s/请求超时** → 拆成多次短轮询调用，
每次只等 30~60s，靠 `document.body.innerText` 里有没有「生成中」判断要不要再等一轮。

---

## 十三、⭐⭐ 红字全量归纳成 A/B 两张表（2026-07-29 第十五次会话，B 类已全部处理完，**A 类留给下一个 AI**）

> ⭐ **接手的 AI 看这一节就够开工了：下面 A 表 9 条就是待办清单，带样本 requestId 和已查到的证据。**

### 十三·0 归纳口径（做同类表格时照抄，别再走一次弯路）

我第一版是**直接把 DB 里 `failureReason` 的分布贴给用户** → **被否了**，理由完全正确：
DB 里那些是**历史字符串**（当时写死进去的），混着大量"已被新代码取代、以后再也不会产生"的老文案。
用户要的是「**以后还会发生的根因 → 它现在会映射成哪句红字**」。

**正确做法两步，缺一不可**：
1. DB 分组拿"有哪些根因" → 逐个回 `.runtime/*-diagnostics-log.jsonl` 捞**上游原文**定根因；
2. **拿根因去读现在的 `src/lib/error-message.ts`**，表格里填**它今天会映射成的那句**，不是 DB 里那句。

剔除标准四种：① 根因已修；② 文案已被取代（换成接班人那句）；③ 从未发生过（纯预防规则）；④ 被自动重试/自愈消化、到不了用户面前。

### 十三·A ⭐⭐ A 表：我们自己的原因（9 条根因 / 42 条事件）

> ⚠️ **2026-07-29 第十六次会话更新：A 表 9 条全部处理完毕**（A5 修好；A1/A2/A4 加了明确映射脱离兜底桶；
> A3/A7 查清后证明原表述已过期；A6/A8 本来就有明确文案；A9 数据缺失不可查）。
> **剩下 2 个"能修但要你拍板"的行为变更，见第十六节·C。** 下面表格保留原样便于对照，处理结果见每行开头标记。

| # | 真实原因（已查到的证据） | 现在给用户看的红字 | 样本 / 定位 |
|---|---|---|---|
| **~~A1~~** ✅ **已真修 + 已换文案（第十六次会话）** | ⭐⭐ **根因不是"图坏了"，是我们该压没压**：`jpegNeedsReencode()` 只判**格式兼容性**（分量数 + 4:2:0 采样因子）、**完全不看体积** → 格式本来就兼容的手机原图走"原样写盘"分支，**4.24MB 一个字节没压就存了下来**，再原样发给 OpenAI → 400 `Invalid image file or mode for image 1`。⭐ 实测同图以 90% 质量重压：**4444000 → 约 985KB，尺寸一点没变** | ~~服务器繁忙~~ → **参考图不符合平台要求，模型读不出这张图。请换一张体积更小的参考图（建议 2MB 以内）后重试。**（句式对齐 B13/B15） | 同一用户 ID_545925 在 2 分钟内连点 6 次（`b8232225`/`34baf202`/`1776c413`/`8bc00914`/`2eb59c7a`/`e4c4338f`），同一张 `ID_545925/upload_image/0ceec45f5c8798fce40babf4.jpg`（baseline / 8bit / 3 分量 YCbCr / 3072×4096）。**修法见第十六·A** |
| **~~A2~~** ✅ **已加映射（第十六次会话）** | ⭐⭐ **模型 200 但只回了一段文字，不给图** —— 112 条 `image-provider-empty-result` 里 **101 条**是这个形态（最常见是把**改写后的提示词**原样复读）。**红字以前把模型那一大段中文提示词原样吐给用户**（末尾透传最多 500 字） | ~~服务器繁忙／模型的提示词原文~~ → **模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。以下是模型返回的内容：“…”** | 还在发生（07-29 x5）。全在 GPT 版老 `/chat/completions` 接口。另 2 条是明文拒绝（走"模型拒绝"那句）、9 条其它 |
| **~~A4~~** ✅ **已加映射（第十六次会话）** | **我们自己的 DB 连接池被占满**：`Transaction API error: Unable to start a transaction in the given time`。⭐ 查到 `DATABASE_URL` **没配 `connection_limit`** → Prisma 默认 = 8 核×2+1 = **17 连接 / pool_timeout 10s** | ~~服务器繁忙~~ → **服务端数据库繁忙（连接池已满），请稍后重试。** | 日志共 6 行、**最后一次 2026-07-17，之后零复发**。⚠️ 已被判为可重试（自动退避重试过）。**若再变多，解法 = 给 DATABASE_URL 加 `connection_limit`** |
| **~~A3~~** ✅ **已查清（原表述是错的，见十四节）** | ~~BytePlus 视频轮询阶段的失败零日志~~ → **实际有近 4 万条轮询日志**，只是①老数据只记了 `hasError` 布尔、没记原文；②事件名一律叫 `poll-success`（把人带偏）。真实根因经今天新数据证实 = **BytePlus 输出音频版权风控**（属 B 类）。**剩下 10 条原文永久丢失、不可查** | 服务器繁忙，请稍候再试..... ／ API Key 无效或已过期 | 全过程 + 数据 → **第十四节** |
| **~~A5~~** ✅ **已修（第十六次会话）** | **参考图是 `data:` base64，给不出公网地址 → 送审直接放弃 → 整单毙**。根因 = 对话流"发送那一刻才转正"，转正失败时静默退回 dataURL 直发。**已两层修**：服务端落盘兜底 + 前端"上传完当场转正" | 参考素材不是可审核的公网地址。 | `966d223a-...`、`c01baba2-...`、`06f4a10b-...`、`e03305e1-...`（实为 2 起 × 各重试 1 次）。⚠️ **部署后要把它从 `NEVER_ARCHIVE_REASON_PATTERNS` 摘掉再归档那 4 条** |
| **~~A6~~** ✅ **本来就有明确文案，不用动** | 我们的图片请求 5 分钟 fetch 超时（`image-provider-fetch-error`）。工作流 2K + 4 张参考图 | 图片生成超时，请稍后再试。（已经是明确文案、不在兜底桶） | **全站只有 1 行，2026-07-23，零复发。** 改不了（没法让模型更快）；调大超时属于猜测，没做 |
| **~~A7~~** ✅ **已查清：两半都早修好了（第十六次会话）** | ~~容器里没装 curl~~ → 线上容器 **curl 7.88.1 装着的**，`Dockerfile:7` 早就装了。`spawn curl ENOENT` 全站**只有 4 条、全在 2026-07-14 11:12~11:15 三分钟内、之后零复发**；模型键 `seedream-5-0-pro` 也已在 `byteplus-provider-key.ts:50` 映射好。⭐ **真正没修的是"它说假话"** → 已修（见十五节） | 网络连接异常，请稍后重试。→ 改成「服务端环境异常，请联系管理员处理。」 | ⛔ **排查陷阱**：07-14 之后仍有大量 `image-provider-curl-fallback-failed`（07-15/16/24/28 各 9~13 条），**但根因全是"提供商余额不足"** —— 事件名带 curl，锅不在 curl |
| **~~A8~~** ✅ **本来就有明确文案 + 会自动重试，不用动** | 上游返回非 JSON。**两种形态**：11 条是**老 `/chat/completions` 接口 HTTP 200 但 body 被截断**（`Unexpected end of JSON input`）、3 条是新 `/api/v1/images` 的 **502** | 平台服务临时异常（返回了非预期内容），请稍后重试。（且 `isTransientServerError` = **true**，服务端会自动退避重试，多数根本到不了用户面前） | 14 行，仍在发生（07-29 x2）。上游抖动，我们修不了 |
| **~~A9~~** ⛔ **改不了：数据不足** | 链路更早处就断了，**连 requestId / model 都没有** → 无法定位是哪个用户、哪次请求、走的哪条路 | 请求超时，请稍后重试。 | 07-14 04:03 那一条，`requestId` 为 `-`。**全站仅此 1 条、零复发。** 没有任何可追的线索，只能等它复发时靠现在补的日志抓 |


⚠️ **A1/A2/A3/A4 单纯改文案没意义** —— 它们落在兜底桶（"我们没识别出根因"的混合体）。
要做的是**给它们各自加明确映射**（A3 还要先补日志落盘）。

### 十三·B B 表：提供商/模型端（14 条根因 / 178 条事件，**本次已全部处理完**）

保留不动的（提供商侧真实原因，我们修不了，按铁律该一直亮着）：
成品视频/音频输出审核被拒 63 ／ 模型明文拒绝出图（v53 统一句）11 ／ 上游限流 13 ／ OpenRouter 余额不足 402 11 ／
参考素材送审未过 5 ／ 参考图判定含真人 4 ／ 模型只回文字没出图 1 ／ 以及 413 请求过大、地区不可用、参数不支持、
Veo 带参考图时长、参考图比例越界、网关抖动 520/空响应 等结构性存在的几条。

本次**处理掉**的：

| 原编号 | 处理 | 关键结论（别重复走） |
|---|---|---|
| B5 + B6 | **合并成一句** `参考素材未能通过平台审核（可能涉及真人、隐私或版权），可以重试，但建议更换参考素材后再重试成功率更高。` | 同一根因（平台内容安全检测拒素材），一条精确规则一条兜底规则。⭐ 措辞「参考图」→「**参考素材**」：真实原文有 `InputVideoSensitiveContentDetected param: content[3]`，被判敏感的是**参考视频** |
| 新增一句 | `成品图片被平台判定含敏感内容而拒绝交付（不是参考素材的问题，换图没用）。可直接重试或修改提示词后重试。` | `OutputImageSensitiveContentDetected` 以前掉进宽松 sensitive 兜底 → 红字说"参考图可能包含真人" = **错怪，用户换一万张图都没用**。代码里输出侧原来只写了视频/音频，图片这一路是漏的 |
| B7 图片格式不支持 | **归档 4 条，不加映射** | 根因跟格式无关 = 音频 `.bin` 混进图片槽（v34 已修）。详见 CHANGELOG 第十五次会话第 7 条 |
| B9 请求太频繁或额度不足 | **拆掉，这条文案消失** | 裸 `429`→限流句；裸 `quota`→充值句。⛔ **不能整条并进"余额不足"**：429 时钱是够的，会让用户白催充值 |
| B10 输出视频被平台过滤 | 划掉（**不并进** B1） | DB 0 条、日志 0 行 = 从未发生。原文只说 `completed with no output`，并进 B1 等于替平台编"因版权敏感"的理由 |
| B11 平台读取参考图失败 | 划掉 | DB 0 条红字。日志 20 行但**全被 `transient-error` 判可重试、服务端自动重试消化**，用户没见过。指向的 url 全是**正确的静态直链** → 说明 v48 `normalizeReferenceAssetUrl` 那个锅修干净了（media-thumbnail 命中 0） |
| B12 审核凭证已失效 | 划掉 + 补最后一步 | v47 起零复发（日志最后一次 07-15）、DB 0 条。本次补"凭证过期不问用户、当场重新送审"，见 CHANGELOG 第 8 条 |

### 十三·C ⭐⭐ 跑归档脚本前必读：新增了全局护栏（本次差点误吃 6 条）

给脚本加了 **dry-run 明细输出**（以前只有数字），第一次试跑就抓到两条老规则在吃不该归档的：

- `gpt-image-empty-result-legacy-form`（match `图片平台没有返回图片：`）差点吃掉 **4 条 failureReason 已是 v53 新统一文案「模型因色情/暴力/隐私安全等原因拒绝出图」、07-29 刚发生**的事件。
  ⭐ 根因：**haystack = 日志原文 + failureReason**，而 `图片平台没有返回图片：` 只是我们**内部的包壳**、还留在日志里。按铁律④这类该一直亮着。
- `approved-card-not-reused`（靠"走了送审复用、没新建素材"的**事件序列特征**）差点吃掉 **2 条「参考素材不是可审核的公网地址」**（= A5，还没修）。

**修法**：`NEVER_ARCHIVE_REASON_PATTERNS` + `isNeverArchiveEvent()`，在规则匹配**之前**先判，命中就**任何规则都不许归档**。
比给每条规则配 `before` 更准（不受部署时刻/时区影响）。⛔ **某条根因真修好之后**才可以从这个名单里删掉。

⭐ **所以从今往后：`--apply` 之前必须把 dry-run 明细逐条扫一眼 failureReason**，别只看数字。

### 十三·D 本次的操作记忆（省时间）

- ⛔⛔ **`generation-diagnostics-log.jsonl` 里也有 `video-route-failed`** —— 视频失败**双写两个日志**。
  本次差点据此误报"图片路径也有凭证失效、存在分叉"。⭐ **按日志文件名判断"图片还是视频路径"是错的**，要看行里的 `event` 和 `model`。
- ⭐ **捞原文写 node 脚本按 requestId 过滤、只打 `error.message`/`extra.body`/`upstream.body`**，`docker cp` 进 app 容器跑。
  ⛔ **别用 `grep | cut`**：一行 JSON 几千字，`cut -c1-700` 正好把 `error` 字段切没了（白跑一轮）。
- ⛔ **psql 查 `failureReason` 必须 `left(...,90)`**：有条红字是模型 500 字小作文，不截断直接冲爆工具输出。
- ⭐ **查官网规格用 playwright 的 `browser_find`（正则）**，别读整页。
- ⭐ **验错误映射用 `npx tsx` 直接 import `src/lib/error-message.ts` 跑真实上游原文**（本次两轮各 10/10），比起服/部署快得多；临时脚本放 `.runtime/` 跑完删。

## 十四、⭐⭐ A5 修完 + A3 查清（2026-07-29 第十六次会话）

> 本节两件事：**A5 已两层修好**、**A3 的原表述是错的**（"零日志"不存在）。
> A 表待办从 9 条降到 **7 条**（剩 A1 / A2 / A4 / A6 / A7 / A8 / A9）。

### 十四·A A5「参考素材不是可审核的公网地址」= base64 参考图

**根因链（4 条日志实为 2 起事件 × 各重试 1 次）**：

1. 用户发起 BytePlus 生视频，参考图混着 `/generated/...`（正常）+ **`data:image/...;base64`**（1.37MB / 1.42MB）。
2. 直发 BytePlus → 平台回 `input image 'content[4]' 'content[5]' may contain real person`，
   `content[4]/[5]` 正好是那两张 base64（1-based，+1）。
3. 触发自动送审兜底 → `/generated` 那 3 张都成功 reuse 到 Active 凭证 →
   走到 base64 那张，**`toPublicAssetUrl()` 对 `data:` 返回空串** → 抛错 → **整单毙**。
4. 用户看到 `(B_613/B_614/B_650/B_651) 参考素材不是可审核的公网地址。`

**base64 从哪来**（前端全链路调研结论）：正常流程是"上传拿 token → 发送那一刻 PATCH 转正"。
`chat-workbench.tsx` 发送处有个 catch 兜底：**转正失败就静默退回原始 dataURL 直接发出去**
（而且 `Promise.all` 一失败是**整批**退回，所以已经拿到正式地址的也被拖回去）。
只有**对话流**有这条路；**工作流的 `uploadWorkflowImageOnce` 一直是 POST+PATCH 一次做完，从没出过这个红字**
→ 典型的"该统一却分叉"。

**两层修**：

| 层 | 改哪 | 内容 |
|---|---|---|
| 服务端兜底 | `src/app/api/video/route.ts` `toReviewablePublicAssetUrl` | `data:` 先落盘成正常上传图（复用 `saveUploadedImageAsset`，同 `users/<uid>/upload_image/` 目录、**文件名内容 hash → 同图幂等、重试不堆文件**），再拼公网 base 送审 |
| 前端根治 | `chat-workbench.tsx` 新增 `uploadTemporaryAssetImageAndCommit` | **上传完当场转正**（跟工作流统一）。两个调用点（选/拖/粘贴 + 重试上传）都换成它，`tempToken` 一律清空 → 发送那一刻只读字段、**零网络请求可失败** |

⭐ **顺手堵的漏子**：落盘失败（base64 损坏 / ffmpeg 转码失败 / 磁盘满）原来会把**一整行 ffmpeg 命令 + 服务器路径**
当红字漏给用户。现在换成「参考图数据已损坏，无法送审。请删除该参考图后重新上传再试。」，原始错误进
`byteplus-auto-review-data-url-save-failed` 日志。

⭐ **为什么改 `url` 不会让预览闪**：输入框缩略图读的是 `image.previewUrl`（`readFileAsUploadedImage` 创建时写死成 dataURL、之后从不覆盖），只改 `image.url` 不影响它。

⚠️ **接受的代价**：用户上传完又不发送 → 正式目录留孤儿文件。可接受（内容 hash 命名 → 同图只一份；**不建 MediaAsset → 不进资产库、用户看不到**）。要清另写"无 MediaAsset 引用且超过 N 天"的脚本。

**⭐ 落地了 4 个跟踪点**（用户要求"日志跟踪住"）。`/api/client-error` 原来只 `console.error`（docker logs 会滚掉），已改成**落盘**到 `.runtime/upload-diagnostics-log.jsonl`。**正常情况这四条一条都不该出现**：

```
client-send-time-commit-still-needed             还有图没转正就走到发送了
client-send-time-data-url-fallback               发送时还在拿 base64 补救
client-send-time-data-url-fallback-failed        补救也失败 = A5 直接现场
client-send-time-persist-uploaded-images-failed  整批退回 base64
```

**实机验收（本地真登录 + 真上传 + 真发送，全过）**：POST+PATCH 上传当下就都打了 ／ PATCH 回 `/generated/...` ／
预览仍是 `data:`（1152271 字符，不闪）／ 点发送后**没有**再打 PATCH、没有 `/api/upload-image` ／
`/api/image` 请求体 `referenceImages` 是 `/generated/...` ／ 服务端日志 `kind:"generated"` ／
4 个跟踪点一条没触发 ／ 同图重复上传走去重分支、返回 `duplicate:true` 且**不多打 PATCH**。

### 十四·B ⛔⛔ A3：文档说的"BytePlus 轮询零日志"是错的（别再照着查）

**实测线上**：`video-provider-poll-success` **39,270 条（byteplus）+ 483 条（openrouter）**。轮询一直有日志。

真正的两个问题：

1. **只记了 `hasError: true` 布尔值、不记原文** —— 记原文的 `summarizeVideoTaskError` 是后来才加的，
   **只有 2026-07-29 起的新数据才有 `errorCode`/`errorMessage`**。所以「必须先补落盘」这件事**其实早做完了，只是没人验证过**。
2. ⛔ **事件名骗人**：`poll-success` 里的 "success" 指**这次 HTTP 查询通了**，任务 `status:"failed"` 的失败**也叫 success**。
   我就是被这个名字带偏、差点跟着文档去"补落盘"。**已改**：任务真失败时改叫 `video-provider-poll-failed`。

**把 107 条未归档视频失败逐条跟轮询日志对上的结果**：

| 情况 | 条数 | 含义 |
|---|---|---|
| 能拿到平台原文 | **8** | 全是 07-29 新数据，全部 `OutputAudioSensitiveContentDetected.PolicyViolation` |
| 轮询到了、只有 `hasError` 布尔 | **42** | 07-27 及以前，原文**永久丢失** |
| 找不到 taskId | 55 | **创建阶段**就失败的，不属于 A3 |
| 有 taskId 无轮询记录 | 2 | |

⭐ **关键推论**：那 42 条里绝大多数红字已经是「成品视频/音频因版权或敏感内容被拒绝交付」，
拿今天 8 条有原文的一对照 —— **映射是对的**，根因就是 BytePlus 输出音频版权风控 = **B 类，我们修不了**。
**A3 真正剩下的未知只有 10 条**：6 条「服务器繁忙」（B_195/237/246/247/248/249/256，07-20~21）+
4 条「API Key 无效」（B_60/62/66/67，**全在 2026-07-14 一天，之后零复发**）。**原文已丢，不可查，别再花时间。**

### 十四·C 本次修掉的两个真问题（都是排 A3 时顺出来的）

**① 「API Key 无效」正则误伤面极大**（`error-message.ts`）
原来是 `/\b401\b|unauthorized|user not found|invalid api key|api key/` —— **裸的 `api key`**：
上游任何提到 "api key" 的文字都判成"密钥失效"；而我们自己抛的 `缺少 BytePlus API Key`
（= 服务端**根本没配**环境变量）也命中它，文案说"请更新密钥后重试"**把人往错方向带**。
已拆成两条：先认"我们没配"→ 新文案「服务端没有配置该模型的接口密钥，请联系管理员处理。」；
再用精确特征（`invalid_api_key`/`incorrect api key`/`api key expired`/`401`…）判"平台说密钥无效"。
⭐ **用 `npx tsx` 拿 12 条真实上游原文验过映射，12/12 通过**（含 6 条回归：输出音频版权 / 1015 限流 / 402 / 超时 / 真人参考图 / 格式不支持，都没被 API Key 那条抢走）。

**② 视频任务没有重试上限、失败只写 console.warn**（`generation-jobs.ts` `runVideoJob`）

- 图片任务有 `MAX_IMAGE_JOB_ATTEMPTS = 6` + `image-job-transient-retry` 日志；视频任务
  catch 里**只有 `console.warn` + 每 10 秒无限重试、永不放弃、永不留痕**；另两个失败分支
  （`videoError` / `完成但没有视频地址`）也是**零诊断日志**。
- ⭐ 已修：三个分支都补 `appendGenerationDiagnosticsLog`（带**上游原文** + `upstreamRaw` 截 1500 字 + attempts），
  新事件 `video-job-poll-failed` / `video-job-completed-without-url` / `video-job-poll-error` / `video-job-poll-error-streak-exceeded`。
- ⛔⛔ **上限绝不能用 `attempts`**：视频是轮询式的，**正常成功的任务本来就要轮几十次**（线上实测最大 `attempts=208` 且是成功的长视频），拿 attempts 设限会把正常长视频掐死。
  改成数**连续**失败 `extraJson.pollErrorStreak`（只在 catch +1，任何一次查询成功归零），
  `MAX_VIDEO_POLL_ERROR_STREAK = 30` ≈ 连续 5 分钟查不动才判失败。
  ⚠️ 等本地存盘那条路走的是正常 return，**不经过 catch**，所以"只要平台给了 url 就一直等到存好"的老行为没变。
- ✅ **线上核实过：实际没有僵尸任务**（当前 0 个 running；历史最大 attempts=208 是成功的）。所以这是**隐患不是事故**。

### 十四·D 本次的操作记忆

- ⭐ **查线上日志用 python3 直接读宿主机 `/opt/flashmuse/data/runtime/*.jsonl`**（那目录是挂载出来的，不用进容器）；
  **要连 DB 就写 node 脚本 `docker cp` 进 `/app` 再 `docker exec -w /app node`**（否则找不到 `@prisma/client`）。
- ⭐ **把 DB 失败事件和日志对起来的姿势**：日志里 `requestId` 和 `taskId` 同时出现的行 → 建 `requestId→taskId` 映射，
  再用 taskId 找"最后一条 poll 记录"。⛔ **注意 poll 日志行里没有 requestId**，只按 requestId grep 会以为"没日志"。
- ⛔⛔ **PowerShell 里 `cd` 对 .NET 的 `[System.IO.File]` 无效，但对 `Remove-Item` 有效** ——
  本次踩坑：同一条命令里 `cd handover; [IO.File]::ReadAllText("x.md")` 读的是**项目根**（失败），
  而后面的 `Remove-Item "x.md.new"` 却在 handover 下**真把文件删了** → 刚写好的一整节内容没拼进去就消失。
  ⭐ **拼接文件一律只用绝对路径，别混用 cd + 相对路径。**
- ⛔ **edit 时别把 `export` 或换行吃掉**：本次两次手误（`deleteTemporaryAssetImages` 少了换行、
  `getOpenRouterHeaders` 的 `export` 被挪到注释前面去了）。tsc 都抓到了 —— **每改完立刻 `npx tsc --noEmit`**。
- ⭐ **Playwright 实测上传**：文件必须放在**允许的根目录内**（`E:\project\FlashMuse_Agent\.playwright-mcp\`），
  放 temp 目录会被拒（`outside allowed roots`）。`showInputTip` 的黑底提示是**瞬时**的，`innerText` 抓不到 → 改看**网络请求**更可靠。

## 十五、⭐ A7 查清：curl / ffmpeg 都早就好了，真问题是「错误映射在说假话」（2026-07-29 第十六次会话）

> ⚠️ **A7 的原表述"容器里没装 curl、这条路永远失败"也是过期的**（跟 A3 一样）。
> A 表待办 7 条 → **6 条**（剩 A1 / A2 / A4 / A6 / A8 / A9）。

### 十五·A 两半根因的真实状态（都不用修了）

| 项 | 是我们的问题吗 | 线上实测 | 结论 |
|---|---|---|---|
| **容器少装 curl** | 是 | 容器里 **curl 7.88.1 装着的**（正式服 + 测试服，Debian 12）；`Dockerfile:4-7` 早就装了，注释还写着 *"without it the fallback throws spawn curl ENOENT"*。`spawn curl ENOENT` 全站**只有 4 条，全在 2026-07-14 11:12~11:15 三分钟内，之后零复发**；07-29 还有 `provider-curl-success` = 兜底在正常工作 | **已修，无事可做** |
| **ffmpeg 转码失败** | 是 | `upload-image-reencode-start` **1097** = `upload-image-reencode-success` **1097**，`upload-image-reencode-failed` **0 条**（这个事件是存在的，见 `local-assets.ts:172`，所以 0 条是真的零失败）；`upload-image-ffmpeg-missing-raw-write` 也 **0 条** = 二进制在 | **线上从未发生过** |
| **模型键没映射**（`seedream-5-0-pro is not a valid model ID`） | 是 | `byteplus-provider-key.ts:50` 已有映射，`models.ts:105` 也在 | **已修**（原文档"疑随 byteplus-provider-key.ts 收敛修掉"的猜测是对的） |

⛔⛔ **排查陷阱（差点误判"curl 又坏了"）**：07-14 之后仍有大量 `image-provider-curl-fallback-failed`
（07-15 九条 / 07-16 十条 / 07-24 十三条 / 07-28 十一条 + 两条 `text-provider-curl-fallback-failed`），
**但把原文捞出来看，根因全是「提供商余额不足！请联系管理员充值。」** ——
**事件名里带 curl，锅完全不在 curl**（curl 跑通了，是上游返回失败）。⭐ **别用事件名推根因，必须捞 `error.message`。**

### 十五·B ⭐ 真正修掉的：错误映射把"我们自己的环境问题"说成"网络问题"

`error-message.ts` 的网络规则里塞了 **`curl`** 和 **`command failed`** 两个太宽的词，后果：

- `spawn curl ENOENT`（= 容器根本没装 curl）→ 用户看到「网络连接异常，请稍后重试」
  → **用户白等白重试；我们在后台也只看到"网络问题"，完全发现不了是部署少装了个程序**。
  这个坑一直埋到 2026-07-29 翻日志才被发现 —— **这就是"说假话的映射"的真实代价**。
- `Command failed: /app/node_modules/ffmpeg-static/ffmpeg …`（转码失败）→ 同样被说成网络问题。

**已修**：在网络规则**之前**加一条：

```ts
const missingBinary = /\bspawn\s+\S+\s+enoent|\benoent\b/.test(lower);
const subprocessFailed = /command failed/.test(lower) && !/curl:\s*\(\d+\)/.test(lower);
if (missingBinary || subprocessFailed) return withErrorCode("服务端环境异常，请联系管理员处理。");
```

并从网络正则里**删掉 `command failed`**（`curl` 保留，真网络失败照旧命中）。

⭐ **关键设计点**：`Command failed: curl … curl: (7) Failed to connect` 这种**子进程跑起来了、失败在网络**的，
必须放给网络规则 —— 靠 **`curl: (数字)`（curl 自己的错误码格式）** 排除，别误报成环境问题。

⭐ **回归测试 22/22 通过**（`npx tsx` 直接 import 跑真实原文）：6 条环境类 → 新文案；
2 条"curl 跑起来但网络失败" → 仍是网络；7 条纯网络/超时 → **一个字没变**；
7 条其它高频原文（输出音频版权 / 1015 限流 / 402 余额 / 缺少 API Key / API Key 无效 / 真人参考图 / DB 事务超时）→ 没被抢走。

### 十五·C ⚠️ 给下一个 AI 的提醒（本次最大的教训）

**A3 和 A7 的原描述都过期了**，我都是先照文档去"修"，实测才发现根因早已不存在。
⭐ **动手前先花 5 分钟用数据验一遍文档里的前提**（进容器 `command -v xxx`、日志里数一下"最后一次发生是什么时候"），
比直接照着文档改代码省得多。

⭐ **判断"该不该修"的三问**：① 根因现在还在吗（进容器/查配置实证）；② 最后一次发生是什么时候（日志按天计数）；
③ 如果已经不发生了，那**还剩什么没修**？—— A7 的答案是"剩下的是它当时给用户看了一句假话、还把根因埋进了错误的桶"，那个才是真该修的。

## 十六、⭐⭐ A 表剩下 6 条全部收口（2026-07-29 第十六次会话，A 表清零）

> 用户要求"6 条全查一下，能改的改掉，改不了的说明"。结论：**A1/A2/A4 加了明确映射（脱离兜底桶）；
> A6/A8 本来就有明确文案不用动；A9 数据不足不可查**。另有 **2 个"能修但属于行为变更"的项等你拍板**（本节 C）。

### 十六·A ⭐⭐ A1 的真根因：**我们该压没压**（已真修，不是只改文案）

**⛔ 我第一版的判断是错的**，写进文档的第一稿说"图太大、官方没写上限、只能改文案"。用户一句
「如果是体积大可以压缩一下保存好，质量保证在 90%」直接点破 —— 去实测才发现根因完全不同：

**用容器自带的 ffmpeg 对那张线上真实的 4.24MB 图重压一遍（同尺寸）**：

```
源文件                     4444000 字节
-q:v 2（约95%质量）        1682393
-q:v 3（约90%质量）         985381   ← 只有源文件的 22%！
-q:v 5（约80%质量）         586398
（另：保持 q3 但缩最长边到 2048 → 459978）
```

⭐⭐ **说明这张图从来没被我们压过** —— 如果压过，存下来的就该是 ~985KB 而不是 4.24MB。

**根因（`local-assets.ts`）**：`saveTemporaryUploadedImageBuffer()` 的分支是

```
forceReencode 或 不是 jpeg  → writeGeneratedImageAsJpeg（压）
是 jpeg + jpegNeedsReencode() → writeGeneratedImageAsJpeg（压）
是 jpeg + 不需要重编码        → writeFile(原始 buffer)   ⛔ 一个字节都不压！
```

而 `jpegNeedsReencode()` **只检查格式兼容性**（分量数必须是 3、采样因子必须是 `0x22/0x11/0x11`），
**完全不看体积**。手机原图正好是标准 baseline 4:2:0 → 判定"不用重编码" → **原样存盘 → 原样发给模型 → 被拒**。

**修法（按用户要求：不动像素尺寸，只把质量压到 90%）**：

- 新常量（放在上传规则的唯一来源 `image-upload-validation.ts`）：
  `IMAGE_UPLOAD_RECOMPRESS_OVER_BYTES = 2MB`、`IMAGE_UPLOAD_RECOMPRESS_QUALITY = 90`。
- 新函数 `compressOversizedUploadJpeg()`（`local-assets.ts`）：超阈值就用 sharp
  `.rotate().jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:2:0" })` 重压，接在那条"原样写盘"分支上。
- ⭐ **`.rotate()` 是必须的**：sharp 默认**丢掉 EXIF**，手机照片带 `Orientation` 时不先转正，压完会显示成横躺。
  `.rotate()` 把方向**烧进像素**，之后不再需要 EXIF。
- ⚠️ **压不动/压完更大/sharp 报错 → 一律保留原文件，绝不让上传失败**（压缩是优化不是必要条件），
  三种情况各有独立日志：`upload-image-oversized-recompressed` /
  `-recompress-skipped` / `-recompress-failed`。
- ⚠️ 与后台那套"生成图片压缩"（high95/standard80/low60）**是两件事**：那套管**我们生成的图**，这里管**用户上传的参考图**。

**本地实测（走真实上传链路 `saveTemporaryUploadedImageBuffer` → `commitTemporaryUploadedImage`）**：

| 用例 | 源 | 存盘后 | 结果 |
|---|---|---|---|
| 真实照片放大到手机原图规格 | 3.59MB / 3072×4096 | **0.76MB / 3072×4096** | 体积 **-78.7%**、**尺寸未动** ✅ |
| 带 EXIF `Orientation=6` 的大图 | 10.58MB / 4000×3000 / orientation=6 | 6.82MB / **3000×4000** / 无 orientation | **已按 EXIF 转正、方向烧进像素**（不会横躺）✅ |
| 小图（3118 字节） | 800×600 | 3118 字节 / 800×600 | **字节完全一致 = 没被碰** ✅ |

⚠️ **文案仍然保留**（不是只靠压缩兜）：历史已存的大图、以及**第三方 https 参考图**（不经过我们的上传压缩）还会触发。
句式按用户要求对齐 **B13/B15**（都是"参考图不合平台要求 + 该怎么换"）。

### 十六·B 另外两条加了明确映射

| # | 上游真实原文 | 以前 | 现在 |
|---|---|---|---|
| **A2** | `图片平台没有返回图片：可直接用这版优化后的文生图提示词：…` | ⛔ **末尾兜底透传把模型那一大段中文提示词原样当红字贴给用户**（最多 500 字） | **模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。以下是模型返回的内容：“…”** |
| **A4** | `Transaction API error: Unable to start a transaction in the given time.` | 落兜底桶「服务器繁忙」，与"上游抖动"混在一起，后台看不出是我们自家 DB | **服务端数据库繁忙（连接池已满），请稍后重试。** |

⭐ **A2 的关键点**：新文案**故意复用了已有的那句**（分支 C 的 `模型这次没有出图，只回了一段文字…`），
抽成唯一函数 `buildModelTextInsteadOfImageMessage()`（`error-message.ts`）。好处是
**后台归一化 SQL 里那条前缀规则已经存在、不用改**（`admin-failure-triage.ts` 的第 4 个 `regexp_replace`）——
要是自己另造一句，后台会立刻炸成几十条各 1 条。**这就是"能统一一律统一"的现成收益。**

**A2 的数据**：112 条 `image-provider-empty-result` 里 **101 条**是"模型回文字不给图"（还在发生，07-29 x5），
2 条明文拒绝，9 条其它。全在 GPT 版老 `/chat/completions` 接口。

**A4 查到的池子现状**：`DATABASE_URL = postgresql://***@flashmuse-db:5432/flashmuse?schema=public`，
**没有 `connection_limit` / `pool_timeout`** → Prisma 默认 `连接数 = CPU核数×2+1`（容器 8 核 → **17**）、`pool_timeout = 10s`。
日志共 6 行、**最后一次 2026-07-17、之后零复发**，且已被判可重试（自动退避重试过）。


### 十六·C 三条不用动 / 动不了

| # | 结论 |
|---|---|
| **A6** 图片 5 分钟 fetch 超时 | **全站只有 1 行（2026-07-23），零复发**，且已经是明确文案「图片生成超时，请稍后再试。」不在兜底桶。**没法让模型更快**；调大超时属于拍脑袋，没做 |
| **A8** 上游返回非 JSON | 14 行、仍在发生（07-29 x2）。**已经有明确文案** +（关键）`isTransientServerError = true` → **服务端会自动退避重试，多数根本到不了用户面前**。两种形态：11 条是老 `/chat/completions` **HTTP 200 但 body 被截断**、3 条是新 `/api/v1/images` 的 **502**。上游抖动，我们修不了 |
| **A9** 早期断链 | ⛔ **改不了：数据不足**。连 `requestId` / `model` 都没有（日志里是 `-`），无法定位用户/请求/链路。全站仅此 1 条、零复发。只能等它复发时靠现在补的日志抓 |

### 十六·D ⭐ 只剩一个「能修但要拍板」的项（A1 那条已经按用户要求真修掉了）

**A4 真修复：给 `DATABASE_URL` 加 `connection_limit`（例如 25~30）。**

- ⚠️ 这是**改环境变量 + 重新部署**，且 postgres 侧 `max_connections` 要跟着核对，不是纯代码改动。
- 目前**零复发**（最后一次 2026-07-17），所以不建议现在动；**等它再变多再说**（映射已经加好，后台能一眼看见）。

⛔ **已被用户否掉、别再提**：原来我提的"发给模型前把参考图**缩尺寸**（最长边 2048）"——
用户明确说「**图片过大不要动**（不动尺寸）……如果是体积大可以压缩一下保存好，质量保证在 90%」。
所以走的是**只降质量、保尺寸**那条路，实测 -78.7% 就够用了，尺寸一律不碰。

### 十六·E 本次取证的操作记忆

- ⭐⭐ **"图太大被拒"这类问题，先问一句"我们到底压过没压过"** —— 本次最大的教训：
  我第一版查完就下结论"图太大、官方没写上限、只能改文案"，**漏了最关键的一步**：
  **拿源文件重压一遍对比体积**。一压才发现 4444000 → 985381，即"这张图从没被我们压过"，
  根因立刻从"模型限制"变成"我们自己漏了压缩"。⭐ **判断"该压没压"的最快办法就是重压一次比大小。**
- ⭐ **判"是不是图太大/参数越界"这类问题，用 `image-provider-reference-sizes` 事件做成败相关性统计** ——
  它记了 `maxSingleBytes` / `perImageBytes`（⛔ **没有宽高**，别去找 width/height，会白跑一轮）。
  本次统计结果：`<1MB` 成功 388/失败 114（别的原因）、`1-2MB` 成功 37/失败 1、`2-3MB` 成功 3/失败 0、`>=4MB` **成功 0/失败 6**。
- ⭐ **容器里没有 ffprobe/PIL，但可以用 `python3` 直接解析 JPEG 的 SOF 段**拿宽高/位深/分量数
  （分量数 3 = YCbCr、4 = CMYK；marker `0xc2` = 渐进式），足够判断"图是不是真的坏"。
- ⭐ **容器里可以直接用 `/app/node_modules/ffmpeg-static/ffmpeg` 做压缩实验**（输出到 `/tmp`、跑完删），
  不用把用户的图拉到本地。`-q:v` 与质量的粗略对应：`2≈95% / 3≈90% / 5≈80%`。
- ⛔ **sharp 压缩默认会丢 EXIF** → 手机照片必须先 `.rotate()` 把方向烧进像素，否则压完显示成横躺。
  测这一项要**自己造带 `withMetadata({ orientation: 6 })` 的图**，且**体积必须超过阈值**才会走到压缩分支
  （我第一版测试的图只有 1.39MB，压根没进分支，白测一轮）。
- ⛔ **查文件时 `find` 会先命中缩略图副本**（`image-thumbnails/...`），必须把所有匹配路径都列出来、跳过缩略图。
- ⛔ **写 python 探测脚本时中文里别用半角双引号**（`print("…"服务端"…")` 直接 `SyntaxError`），用「」。
- ⛔ **PowerShell 内联 ssh 里带 `count(*)`、`"..."` 之类会被本地 PS 当通配符/字符串解释** → 一律写成 `.sh` scp 上去跑。
- ⭐ **改带"可变尾巴"的红字文案时，先看 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 有没有对应前缀规则**；
  能复用已有文案就复用（本次 A2 因此一行 SQL 都没改）。

---

## 十七、⭐⭐ 整轮清零 `--reset-all`（2026-07-29 第十七次会话，用户拍板新增）

### 这是什么

用户的原话：**「你部署完以后把红字失败全部归档掉，bxxx 数字也重新计数从 1 开始。现在从部署完开始看后面新出现的红字，新一轮开始。等红字多了以后再排查问题。」**

所以在归档脚本里加了一个**独立模式**：

```bash
# 铁律：先 dry-run 看真实数字，再 apply
node scripts/archive-resolved-generation-failures.mjs --reset-all
node scripts/archive-resolved-generation-failures.mjs --reset-all --apply
```

它做两件事：
1. 把**当前所有** `status='failed' AND failureReason IS NOT NULL AND resolvedAt IS NULL` 的事件
   一次性打上 `resolvedAt` + 一句说明清楚"这是整轮清零"的 `resolvedNote`；
2. 把 `.runtime/error-code-counter.txt` 写回 `0` → 下一条线上报错从 **`B_1`** 开始。

### ⛔ 与日常归档的区别（别混用）

| | 日常按规则归档（默认模式） | 整轮清零 `--reset-all` |
|---|---|---|
| 依据 | `RESOLVED_RULES`，逐个根因查清才归 | **不看规则**，全归 |
| 全局护栏 `NEVER_ARCHIVE_REASON_PATTERNS` | 生效 | **不生效** |
| B_xxx 计数器 | 不动，继续自增 | **归 0** |
| 什么时候跑 | 每查清修掉一批就跑（铁律 0） | **只在用户明确说"全部归档/清零/重新开始"时** |

### 2026-07-29 那次的实际数字（留档）

| | 正式服 | 测试服 |
|---|---|---|
| 归档条数 | **221** | 46 |
| B_xxx 计数器 | `675` → **0** | `59` → **0** |
| 归档后待排查 | **0** | 0 |

后台复核：待排查 0 / 原因 0 种 / 兜底桶 0，已归档累计 **745**。

### ⚠️ 三个必须记住的点

1. **归档 ≠ 根因都修好了**。B 表那些提供商侧的问题（余额、审核、平台拒绝）依然存在，
   只是这批**历史数据**不再计入待排查。`resolvedNote` 里已写明是整轮清零，可追溯。
2. **计数器文件是 bind-mount 的**（容器 `/app/.runtime/error-code-counter.txt` ↔ 宿主
   `/opt/flashmuse/data/runtime/error-code-counter.txt`），**容器重建不丢**，所以归 0 之后不会被回滚。
   源码里的路径常量在 `src/lib/error-code.ts`（`ERROR_COUNTER_PATH`），**脚本里那份必须跟它一致**。
3. **两台都要跑**（正式服 + 测试服），否则测试服后台还挂着一堆老红字，下次排查会被误导。



## 十八、⭐ 输入文本敏感被错怪成"参考素材没过审"（2026-07-30 第十八次会话，本地实测捞到）

**触发**：用户在本地 workflow_04 生图（提示词含"除去衣服，裸体展示"）。真实上游原文（`.runtime/generation-diagnostics-log.jsonl`）：

```
{"error":{"code":"InputTextSensitiveContentDetected",
 "message":"The request failed because the input text may contain sensitive information. Request id: ..."}}
```

**= 输入的「提示词文字」被判敏感。** 但红字显示成
`(B_238) 参考素材未能通过平台审核（可能涉及真人、隐私或版权）…建议更换参考素材` → **完全指错方向**，
用户会去反复换参考图，而参考图根本没问题。

**根因**：`error-message.ts` 最下面那条**宽松兜底**（原文含 `sensitive` 就说参考素材没过审）把它抓走了。
⭐⭐ **这与第十四/十六节修过的「成品图片被判敏感」是同一类病**：
**缺一条精确规则 → 掉进宽松兜底 → 错怪参考素材。**
→ ⛔ **以后凡是新出现的 `*SensitiveContentDetected` 变体，第一反应就是"兜底又错怪参考图了"，先去兜底之前补精确规则。**

**修法**：在兜底之前加精确规则（匹配 `inputtextsensitive` / `input text.*sensitive`），
映射到**统一那句「模型拒绝」** `buildModelRefusedMessage()`（用户拍板就用这句）。
⭐ 因为**复用现成文案**，后台 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` **一行都不用改**
（第三次吃到"能统一一律统一"的现成收益，前两次是 A2、B5+B6）。

### ⭐ 顺带：给「模型返回的拒绝原因」加了中文映射

`buildModelRefusedMessage` 尾巴上原来贴的是平台原始英文 JSON（用户看不懂，等于噪音）。
新增 `UPSTREAM_REFUSAL_DETAIL_DICTIONARY` + `describeUpstreamRefusalDetail`：

- 认识的 code 翻中文：Input/Output × Text/Image/Video/Audio Sensitive、`content_policy_violation`、
  `safety system`、`moderation_blocked`、`copyright`（**泛化关键词必须排最后**，否则会抢走带具体 code 的）；
- ⛔ **不认识的一律原样保留** —— 宁可英文难看，也绝不丢信息（否则以后出新错误码，我们在后台就成瞎子）；
- ⛔ **模型自己说的话不会被字典吃掉**（"抱歉，我不能…" 原样显示；字典只认平台错误码）；
- ⭐ `MODEL_REFUSED_PREFIX` **一个字没动** → 后台归一化不受影响、老数据不裂成一堆各 1 条。

**效果**：那条红字 219 字 → 78 字：
`模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“输入的提示词文字被平台判定含敏感信息”`

**回归脚本**（都在 `.runtime/`，不进 git）：`check-refusal-detail-dictionary.mjs`（5/5）、
`check-input-text-sensitive-mapping.mjs`（4/4）。
⚠️ 中途有一条 FAIL 是**测试用例写错**（不认识的错误码根本走不到"模型拒绝"那条路，落的是最终兜底）—— 不是代码问题。

### ⭐⭐ 一条新的排查经验：**"红字不对"有可能是我们自己刚改的开关引起的**

本次用户其实是在**测试新做的「解除限制」按账号开关**，把某账号关掉后生图才失败的。
「解除限制」关掉 = 发公开模型名 = **平台审核变严** → 原来能过的敏感提示词开始被拒。
⛔ 所以看到"某个用户突然开始出现内容审核类红字"，除了看提示词，**还要去 `/admin?tab=account-features`
看他的「解除限制」是不是被关了**（这是 2026-07-30 起新增的变量，以前不存在）。

## 二十、⭐⭐ B_123「审核视频的问题被拼进了拒绝出图的文案里」= **红字被 `toUserErrorMessage` 跑了两遍**（2026-08-06 第四十四次会话，🗣️ 用户点名问）

> 一句话结论：**上游那句和服务端映射都是对的，是"客户端又映射了一遍"把我们自己的成品文案重新包了一层。**
> 已修（`error-message.ts` 幂等保护补一条），两服上线 `v1.0.0.76`。⛔ **B_123 本身不归档**（用户侧问题，同 B_92 那类）。

### 二十·A 现场事实（三方对齐，都是硬证据）

🗣️ 用户原话：「你看一下正式服 b123 的红字。。。**为什么审核视频的问题拼到了拒绝出图的文案里呢？**」

正式服 `.runtime/generation-diagnostics-log.jsonl`，`event:"video-route-failed"`，
`requestId=workflow_video_862a28ac-16b3-4fc5-9649-0ec5c54292de`，工作流_11，
用户 **ID_636611**（= 正式服测试号 `12424740@qq.com`，也是 B_92 那个用户），2026-08-06T04:01:03Z，
`byteplus:video.seedance-2-0-mini`，9:16 / 720p / 10 秒，1 张参考图 + 1 个参考视频：

```
The request failed because the input video may be related to copyright restrictions. Request ID: 202608060400564875970F0BCF9518C5AF_asset-20260806120057-vcj8t
```

⭐⭐ **`extra.userError` 里存的是【正确】的那句**：
`(B_123) 参考视频没能通过平台的版权检测（可能涉及真人、隐私或版权），重试可能通过，…`
→ **说明服务端映射没问题，问题在服务端之后。**

### 二十·B 根因（已用真模块实跑坐实，不是猜的）

`toUserErrorMessage()` 在这条链路上**必然被跑多遍**：

1. **服务端 route** 映射一次 → 「参考视频没能通过平台的**版权**检测…」✅ 正确
2. **客户端** `src/lib/chat/chat-workbench-core.tsx:6168` `throw new Error(toUserErrorMessage(text))` **又映射一次**
   （工作流节点 catch `workflow-tldraw-canvas-inner.tsx:4707` 还会再来一次）
   → 这句**中文成品文案里带着「版权」两个字** → 命中 `error-message.ts:352` 那条
   **裸 `copyright|版权` 兜底** → `buildModelRefusedMessage(text)` 把它当成"上游拒绝原文"包起来：

```
1st: (B_123) 参考视频没能通过平台的版权检测…
2nd: (B_123) 模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“参考视频没能通过平台的版权检测…”
```

⭐⭐ **为什么只有参考视频/参考音频会串、参考图片没事？**
第 348 行那条精确规则的第二个分支里认「**参考图**」三个字，而「参考**图片**」正好含它 →
二次映射还能回到自己身上。**这纯属巧合，不是设计。**
⭐ **同源判据（写进 `AGENTS.md` 了）**：发现"同一类里有的坏有的不坏"，
**先去证明那个"不坏"是不是巧合**，别当成"规则是对的"。

病根 = 文件顶部第 217 行那道**幂等保护白名单只列了两句**
（`isModelRefusedMessage` + `^模型这次没有出图，只回了一段文字`），**漏了「参考X没能通过平台的版权检测」**。

### 二十·C 修法（只动一个文件，+24 行，大部分是注释）

`src/lib/error-message.ts`：
1. 新增 `REFERENCE_REVIEW_REJECTED_PATTERN = /^参考(?:图片|视频|音频|素材)没能通过平台的版权检测/`
   + `export function isReferenceReviewRejectedMessage()`。
   ⭐ **只认「开头 + 前半句」**（措辞会被用户改 —— 这句 2026-08-05 才刚改过一次）；⛔ 别拿整句去比。
2. 幂等保护那一行补上它，并加注释：**这里每加一句都必须是「我们自己映射出来的成品文案」，⛔ 别把上游原文塞进来。**

⭐ **不用改 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`** —— 本次没动任何文案措辞，
只是不再让它被二次加工。

### 二十·D 回归（全绿，都是二值判据；⭐ 这套跑法以后照抄）

用 `npx tsx` 直接 import 真实模块（脚本放 `.runtime/` 跑完即删）：

| 项 | 结果 |
|---|---|
| **37 种红字**一次映射 + **连跑 3 遍**幂等（`a===b && b===c`）| **BREAK 0**（改动前 **2**：参考视频 + 参考音频）|
| 另 35 条非目标文案 | **逐条打印比对，一个字都没变** |
| **反向用例 8 条** | **8/8**：上游英文原文照样被映射；「任务失败：参考视频没能通过…」这种**句中假冒**被重新映射；「参考视频**通过了**版权检测」这种近似句不许被放过；4 条真成品（图片/视频/音频/素材）必须原样放过 |
| B_123 真实原文（带 `(B_123)` 前缀）双重映射 | 服务端 = 客户端**完全一致**，错误码前缀也保住 |
| `tsc` / `npm test` | exit 0 / 15 passed |

⭐⭐ **那张「37 种情况分别显示什么红字」的大白话对照表**（🗣️ 用户当场要的）在
**`CHANGELOG_2.md` 第四十四次会话那条的第二节** —— **是实跑产出的、不是手写的**，
以后要给用户看红字口径、或者要给测试用例找清单，**直接用那张表**。

### 二十·E ⚠️ 老数据是脏的（已知，⛔ 不建议回填）

历史上被串成"拒绝出图"的那些条，`failureReason` 存的是**客户端映射后**的文案 →
在后台被记在「**模型拒绝**」那一行里，**混进了本该属于「参考视频/音频没过审」的条数**。

- ⛔ **不建议回填**：改历史 `failureReason` 会动用户数据，且**分不清哪些是"真·模型拒绝"**
  （两者最终文案都以同一个前缀开头，只能靠尾巴那段原文里有没有「参考X没能通过」来分）。
- ⭐ **要看准确规模就查 `.runtime/generation-diagnostics-log.jsonl` 的 `extra.userError`**
  —— 那里存的是**服务端映射的正确文案**，从来没被污染。
  ⭐ **这条判据可推广**：凡是怀疑"后台某条原因的条数不准"，就拿诊断日志的 `extra.userError` 当权威去对。
- ⛔ **B_123 本身不归档**：它从来没落进兜底桶，且「参考素材没过审」属于**该一直亮着**的（同十九·C）。

### 二十·F 🎯 由此开出的待办 **M040**（推荐优先做）

现在的防线是**白名单式幂等保护** → **每加一句新文案就得记得往白名单加一条，漏了就串**（本次就是漏了）。
→ **把「任意一条红字映射结果连跑 3 遍必须完全一致」固化成 `npm test` 用例**
（清单抄二十·D 那 37 + 8 条）。详见 `06-memo-tasks.md` 的 **M040**。

## 十九、⭐⭐ B_92~B_98「参考视频涉及版权」（2026-08-05 第四十一次会话，🗣️ 用户点名问 B_92）

> 一句话结论：**用户拿去当参考的那个视频被 BytePlus 判定"可能涉及版权"，不是我们的 bug、没扣钱、⛔ 不归档。**
> 但顺着它查出了 **3 个我们自己的毛病并全部修掉**（用户拍板「全都做掉」）。

### 十九·A 怎么定位一个 `B_xxx`（照抄这个顺序）

1. **DB 先定位**（`failureCode` 是独立列，别只 LIKE failureReason）：
   ```sql
   SELECT * FROM "GenerationEvent" WHERE "failureCode" = 'B_92';
   ```
2. ⚠️⚠️ **同一个编号会在不同轮次重复出现**：计数器 `.runtime/error-code-counter.txt` 会被
   `--reset-all` 归零 → 本次 grep 日志时 **B_92 有两条**（今天的"视频版权" + 上一轮的"请先登录后再使用模型"）。
   → **必须拿 DB 里那条的时间戳去对日志**，别看到一条就下结论。
3. **上游原文只在诊断日志里**：`generation-diagnostics-log.jsonl` 的 `video-route-failed`
   → `error.message`。⚠️ 视频还**双写** `video-diagnostics-log.jsonl`，那份才有完整的送审过程
   （`byteplus-auto-review-*` 一串），**"到底哪个素材被拒"要看那份**。
4. **确认有没有扣钱**：`CreditLedger WHERE "requestId" = …`（本次 0 行）+ `GenerationJob`（本次也 0 行 →
   创建阶段就被拒、任务压根没建）。

### 十九·B 本次的事实

- **时间** 2026-08-05 07:23~07:28（UTC），**用户** ID_636611，**工作流**生视频、融合模式、9:16 / 720p / 10 秒。
- **参考素材** = 1 张上传图 `ce4cbc79…jpg` + 1 个上传视频 `a09837351da5f669c9e65ab2-video-1785913684561.mp4`。
- **上游原文**：`The request failed because the input video may be related to copyright restrictions.`
  ⭐ 注意它的 Request ID 结尾是 `_asset-20260805152311-5hfl9` —— **是我们送审那个素材的 id**，
  说明拒绝发生在**素材审核**这一步（`byteplus-auto-review-asset-failed`），不是生成那一步。
- **B_92 只是一串里的第一条**：`B_92→B_98` 共 **7 次**，5 分钟内连点，**中间还换了模型**
  （`seedance-2-0` → `seedance-2-0-mini`）—— 都一样被拒，因为判定是对**视频内容本身**下的。
- 该用户 07:28:28 / 07:29:19 有成功的视频（对话流），说明他自己换做法绕过去了，没被卡死。

### 十九·C ⛔ 为什么不归档

它**从来没落进兜底桶**（一直有明确文案「参考素材未能通过平台审核…」），属于本文顶部铁律的第 ④ 类：
**"映射出去后新形成的那条明确原因本身 → 不归档"**（修不了就该一直亮着，且它不污染兜底桶）。

### 十九·D ⭐ 顺手修掉的 3 个我们自己的毛病

1. **`GenerationEvent.userId` 没记** → 这 7 条真实失败在库里 `userId` 全空，
   后台「失败最多的用户」**整批统计不到**（我只能靠诊断日志里的 `userId` 反查是谁）。
   根因：`api/video/route.ts` 最外层 `catch` 里的 `recordGenerationEvent` **没传 userId** ——
   因为 `const user` 是在 `try` 里面拿的、catch 看不见它。
   ⭐ 修法：在 `try` 外面加 `let currentUserId`，拿到 user 后立刻赋值，catch 里用它。
   ⚠️ **这类"catch 里少了个字段"的坑，判据是"库里这一列是不是整批为空"**，光看代码很容易滑过去。
2. **失败现场日志不记参考视频/音频**：`video-route-failed` 与 `video-request-error` 的 `references`
   原来**只映射 `body.referenceImages`** → "哪个视频被拒"看不到，只能回头翻
   `video-route-create-start`。已补上 `reference_video` / `reference_audio`（角色标签沿用送审那套），
   并把 `referenceVideoCount`/`referenceAudioCount` 也写进 `extra`。
3. ⭐⭐ **同一个素材被反复送审** —— ⛔⛔ **这一项我做了，当天又撤了，别再做第二遍**：
   我原本改成「上次审核被拒过就不再送审、直接抛上次的错」（省约 14 秒 + 不在平台上堆 Failed 素材）。
   **但它和用户定的红字口径「重试可能通过」直接矛盾** —— 缓存上次的否决 = 重试**永远**不可能通过 =
   红字变成骗人的话。🗣️ 用户明确说平台这个检测会误判、重试是可能过的，**每次重新送审都是重新过一次审**。
   → 已撤回原样，并在 `api/video/route.ts` 那段 `if (status === "Failed")` 上面写了 ⛔ 注释钉住。
   ⭐ 教训：**"减少无用重试"这类优化，动手前先问"用户看到的文案是不是承诺了这次重试有意义"** ——
   文案和链路行为必须一致，不一致时**改链路去迁就文案**（文案是产品口径），别反过来。

### 十九·E ⛔ 我一开始的归因是错的（留档，别重犯）

我第一版判断是「**送审绕过只给图片建 asset 卡、视频始终是裸 url**，所以对视频版权永远救不回来」——
**错的**。`video-diagnostics-log.jsonl` 里清清楚楚有
`byteplus-auto-review-public-url-resolved` → `byteplus-auto-review-asset-created`（视频拿到了
`asset-20260805152311-5hfl9`）→ `byteplus-auto-review-asset-failed`：
**视频确实送审了，是平台在审核里拒了它。**
⭐ 我当时只看了 `generation-diagnostics-log` 里那条 create 请求的 references（视频那项还是 url，
因为送审失败后整体 throw、根本没走到"换成 asset://"那一步），就反推了机制 ——
正是 `AGENTS.md` 那条最贵的铁律：**判据条件要抄出来逐项验证，别从现象反推。**
⭐ 教训具体化：**视频链路有两份日志，`video-diagnostics-log.jsonl` 才是送审过程的权威**，查"素材为什么被拒"必须看它。

### 十九·F 顺带修的第 4 处：后台「审核类」分类漏了"版权"

`analytics-events.ts` 的 `isModerationReason` 正则里**没有 `版权|copyright`** →
凡是文案只提"版权"、不带"审核/敏感/隐私"字样的失败会被**静默漏算**成非审核类。
新加的那句「参考视频被平台判定可能涉及版权限制…」正好命中这个洞（它一个关键词都不占）→ 已补上。
⚠️ 只影响此后新写入行的 `moderation` 标记，不动历史数据。

### 十九·G 新增/改动的文案

新增 `REFERENCE_VIDEO_COPYRIGHT_REJECTED_MESSAGE`（`error-message.ts`）：
**「参考{图片|视频|音频|素材}没能通过平台的版权检测（可能涉及真人、隐私或版权），重试可能通过，但建议更换参考素材后再重试成功率更高。」**

🗣️ **这句话被用户改了三轮**，三轮的教训都要记住（我三次都是自作聪明写多了）：

1. 我原写「请换一个**自己拍摄或自己生成**的视频」→ 用户改成「换成 **AI生成** 的视频」
   （我们本来就是 AI 生成平台，"自己拍摄"是给用户出难题）。
2. ⛔ 我写过「（例如**影视剧、动漫、综艺**等片段）」→ 用户当场否掉：
   🗣️「其实送审的也不是影视剧，也不是动漫，就是一个普通的视频。」
   我回头查了那个被拒素材的权威信息，**用户是对的**：`MediaAsset` = **576×1024 / 10.3 秒 / 753KB / mp4**、
   `originalFileName` = `video-1785913684561.mp4`（自动生成的通用名）——
   **没有任何一处能支撑"影视剧"这个说法。**
   ⭐⭐ **通用规矩：凡是我们拿不到证据的原因，红字里只许说"平台判定/检测"，⛔ 不许替平台编理由。**
   编理由有两重伤害：① 用户觉得被冤枉 ② 把他往错误的排查方向带。
3. ⭐⭐ **最终版（用户给的原句）**：🗣️「**图片 视频和音频准确对应就行了。是什么没过就显示什么**」——
   上游原文里本来就写明了是 `input image` / `input video` / `input audio`
   （或 `InputVideoSensitiveContentDetected` 这种带类型的错误码），所以红字**直接说是哪一类**，
   别笼统说"参考素材"让用户猜该换哪个。判不出类型时才回落"参考素材"。
   ⛔ 同时用户把结论改回了「**重试可能通过**」（不是我写的"重试和换模型都不会有帮助"）——
   平台这个检测会误判，每次重新送审都是重新过一次审。**这一句直接决定了链路上不能做缓存**，见下面 D-3。

### 十九·G-2 实现要点（改这句话前必看）

- **唯一实现** = `error-message.ts` 的 `buildReferenceReviewRejectedMessage(kind)` +
  `detectReferenceReviewMediaKind(lower, text)`；**两条规则共用它**（精确规则 + 宽松 sensitive 兜底）。
  ⭐ 顺带**删掉**了我上一版加的那条单独的"input video 版权"规则 —— 它做的事现在由类型识别统一完成，
  **少一条规则就少一个抢匹配的坑**。
- ⚠️ 类型识别**只认 input/参考 语境**，绝不能把 `output image/video` 认成参考素材
  （成品那几路在前面已各自 return，但顺序一旦被人调整就会出事）。
- ⛔⛔ **一个根因裂成 4 种措辞 → 后台会炸成 4 行、条数被摊薄**（正是第五节那个坑）。
  已在 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 里加了归一化收敛回"参考素材"一行，
  **改文案措辞必须同步改那条正则**。⭐ 已在正式服库上用 7 条样本实跑验证：4 种措辞并成 1 行（条数 4），
  老文案、成品被拒、兜底桶三条**都没被误碰**。
- ⭐ **回归必须跑 11 条**（`npx tsx` 直接 import，几秒钟，本次 11/11）：
  8 条正向（图片/视频/音频 × 版权/敏感/真人 + 两条"判不出类型→回落素材"）
  + **3 条反向**（`output` video 版权 → 仍是"成品被拒交付"；`OutputImageSensitive` → 仍是"成品图片"；
  `input text` 敏感 → 仍是"模型拒绝"）。**反向那 3 条是最容易被新规则抢走的，绝不能省。**
- ⚠️ 一个纯语法坑（我连踩两次）：**块注释里别让连续星号紧邻斜杠** ——
  在注释里写 Markdown 粗体再跟个斜杠分隔（`…图片…/…`）会拼出块注释结束符、把注释提前闭合，
  `tsc` 报一片莫名其妙的 TS1109 / TS1127 / TS1443，看错误信息完全想不到是注释的问题。

- ⭐ 为什么值得单开一句：泛化那句里的**"可以重试"会主动把用户往坑里带**（实测连点 7 次 + 换模型）。
- ⚠️⚠️ **规则必须插在原有那条精确规则之前**，否则会被 `input\s+(?:image|video).*copyright` 抢走。
- ⭐ **回归必须验 5 条真实原文**（`npx tsx` 直接 import 跑，几秒钟）：
  ① `input video … copyright` → 新句 ② `input **image** … copyright` → 仍走老句（没被抢）
  ③ `InputVideoSensitiveContentDetected` → 仍走老句（敏感≠版权）
  ④ **`output` video … copyright → 仍走"成品被拒交付"那句（最关键的回归点，绝不能被新规则抢走）**
  ⑤ `input text … sensitive` → 仍走"模型拒绝"。本次 5/5 全对。

## 二十、B_141 / B_142「模型拒绝出图」（2026-08-06 第四十五次会话，顺带留档）

> 一句话：**用户侧内容问题（上游原文 `sexu…`），不是我们的 bug，⛔ 不归档**（它从来没落进兜底桶）。
> 本次是为了查「失败卡消失」才翻到它们，**红字本身完全正确**。

- 现场：用户 ID_636611（= 测试号 `12424740@qq.com`），**资产库角色图片生成**，
  `openai/gpt-5.4-image-2` / 3840×2160，2026-08-06 09:33~09:34 连点 5 次 → **3 成 2 败**：
  B_141 = `0efb52fb-179e-4efa-9f46-9cefccf49240`、B_142 = `d6014c71-8f20-4d46-b7ee-ce38e7937851`；
  事件链 `image-provider-non-ok` → `image-job-failed`，映射成「模型因色情/暴力/隐私安全等原因拒绝出图…」。
- ⭐⭐ **顺带查出的真 bug 与红字无关，在前端**：成功回调会把同类型的其它失败卡 `filter` 掉、
  以及 jobId 复用会顶掉上一条失败记录 → 用户「少看到一个失败卡」。已修（测试服 `v1.0.0.78`），
  细节见 `CHANGELOG_2.md` 第四十五次会话那条 + `AGENTS.md` 顶部那条新铁律。
- ⭐ **留一个很好用的二值判据**：DB 里 `UserWorkspaceState.state->'assetGenerateJobs'` 存的就是
  **用户界面上还挂着的资产库生成卡**（只持久化非 succeeded、最多 30 条）→ 拿它和 `GenerationEvent`
  里 failed 的条数对比，**对不上就说明前端把失败卡弄没了**。
- ⚠️ 查正式服时的三个坑（都踩过）：诊断日志字段名是 **`time` 不是 `ts`**；宿主机**没有 node**
  （要 `docker exec -i flashmuse-flashmuse-app-1 node -e`，容器内路径 `/app/.runtime/`）；
  psql 用户是 **`flashmuse`**、表名是 **`UserWorkspaceState`**、`User.id` 本身就是 `ID_xxxxxx`（**没有 `displayId` 列**）。
