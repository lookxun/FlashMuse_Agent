# Memo Tasks（2026-07-21 重建）

> 备忘任务 = 用户说现在不做、以后可能要做的事。每条有 ID、押后原因、以后怎么做。用户说完成就打 `[x]`。历史完整版在 `historical-handover-docs-last-used-2026-07-21/06-memo-tasks.md`。

## 已完成 / 已过时（一行留档）

- **[x] M002** 静态域名公网访问（2026-06-26 完成）。**[x] M004** commit 已部署改动（已成常态）。**[x] M006** 阿里证书自动续期（webroot 已配）。
- **[进行中→基本完成] M016** 资产入库/显示统一大改造：`media-asset-record.ts` 唯一权威入库、显示统一投影已上线。**M017** 上传按内容 SHA-256 去重：服务端+客户端均已上线（`upload-content-hash.ts`+`contentHash`）。历史数据不回填不删不改。
- **[取消] M021** 对话流的 AI 改写重做 —— **2026-07-30 用户明确说不做了**。对话流「一条提示词出多图」的展示模型与 AI 改写天然冲突，不再考虑重做。⛔ 别再把 v1.0.0.53 撤掉的那批代码捡回来（工作流那份 `gpt-image-safety-retry.ts` 保留不动、继续用）。
- **[取消] M022** 给 `ID_636611` 补积分（d37 丢图事件）—— **2026-07-30 用户明确说不做了**。丢掉的 15 张图本来就都在他资产库里（`image_19_d37`~`image_36_d37`），属"出了但没在对话里显示"，不是白扣，不补。**任何人都没动过他的积分。**

## 已查清 / 无需再查（留档防重复劳动）

### 2026-06-19~21 的一批远端媒体**已正式核销，别再查**（2026-08-02 从归档补记）

- **243 个视频 + 378 张图**持有已过期的 volces 签名 URL，**文件不可恢复**，全部集中在 2026-06-19~21。
- 成因：那是"任务化（job 化）"之前的老实现，远端签名 URL 只有 24 小时有效期、当时没有及时本地化。
- **当年已经和用户确认过"不追了"**（`historical-handover-docs-last-used-2026-07-21/CHANGELOG.md:951`、
  `05-next-actions.md:498`）。往后的实现已经修好（job 化 + 先本地化再 finalize）。
- ⭐ **为什么要补记这条**：现行交接文档里没有它 → 以后有人查资产库死链，会把它当成一个新 bug 重新查一遍。

### 首页 hero 视频在正式服是黑色占位（2026-08-02 从归档补记）

`public/home-assets` 里的真视频**从未上传到正式服**，所以首页那几个 hero 视频是黑的
（`historical-handover-docs-last-used-2026-06-20/03-progress.md:471`）。属已知、非 bug。

### 502（`connect() failed (111: Connection refused)`）= **部署窗口现象，不是 bug**（2026-07-30 查清）

- **证据**：正式服今天 24 条 502 **全部挤在 `10:02:35~10:02:40` 和 `10:05:39~10:05:41` 两个时刻**，
  正是那次 `up -d --build flashmuse-app` 和 `force-recreate` 的容器重启窗口；
  nginx error log 里全是 `connect() failed (111: Connection refused) while connecting to upstream`
  = **app 容器当时根本没在监听**（不是超时、不是代码报错）。
  测试服那 54 条同理，分布在 07/21、07/24、07/27、07/28 各次部署窗口。
- ⚠️ **但它确实会打到真实用户**：今天那两个窗口里，3 个不同客户端（`104.249.174.135` / `122.225.228.122` / `60.186.53.107`）
  的 `/api/auth/me`、`/api/auth/workspace-instance`、`/api/generation-status`、**`PUT /api/workspace-state`** 都吃了 502
  （最后那条 = **那一次工作区保存丢了**）。
- **想彻底消除需要零停机切换**（蓝绿/双容器 + nginx upstream 切换 + 健康检查），属架构改动，**用户没要求过、先不做**。
  现实缓解：**别在高峰部署、`up -d --build` 窗口尽量短、别反复 recreate**（`03` 里已有这条）。

## 活跃备忘

> ⛔⛔ **新增备忘前，先 `grep '### \[.\] M' 06-memo-tasks.md` 确认现存最大编号，不许凭印象取号。**
> 2026-08-02 踩过：新加的待办取了 `M031`，而 `M031` 早就被「数据保留 / 清理策略」占了（本文件 208 行左右），
> 撞号后 `01`/`05`/`CHANGELOG` 里的 "M031" 会**指向两个不同的东西**。已改成 `M032`。
> ⭐ 同理适用于任何**共享命名空间**里新增标识符（M 编号、`B_xxx` 错误码、Prisma 迁移名）：
> **先枚举现存全部取值，再取新值。**

### [ ] M040 ⭐ 把「红字映射幂等」固化成 `npm test` 用例（2026-08-06 第四十四次会话立项，**推荐优先做，成本几乎为零**）

**来源**：修正式服 **B_123**「审核视频的问题被拼进了拒绝出图的文案里」时暴露出来的**系统性隐患**。

**问题的根子（不是那一句文案的事）**：`toUserErrorMessage()` 在
「**服务端 route 映射一次 → 客户端 `src/lib/chat/chat-workbench-core.tsx:6168`
`throw new Error(toUserErrorMessage(text))` 再映射一次 → 工作流节点 catch
`workflow-tldraw-canvas-inner.tsx:4707` 还会再来一次**」这条链路上**必然被跑多遍**。
而我们自己的成品中文文案里往往带着**会被下面兜底规则命中的关键词**（本次是「版权」两个字命中裸
`copyright|版权` 兜底）→ 第二遍就被重新包了一层，**用户被指向完全错误的排查方向**。

**现在唯一的防线是"白名单式幂等保护"**（`error-message.ts` 第 217 行列举我们自己的成品文案：
`isModelRefusedMessage` / `^模型这次没有出图…` / `isReferenceReviewRejectedMessage`）——
⛔ **每加一句新红字文案就得记得往那个白名单加一条，漏了就串**。**本次就是漏了**，
而且漏了整整一年多没人发现（因为「参考图片」那一路**侥幸**没串 —— 精确规则里认「参考图」三个字，
「参考图片」正好含它，**纯属巧合**）。

**要做的事（很小）**：把本次那个回归脚本固化成 `npm test` 里的一个用例：

> **对每一条红字，`toUserErrorMessage` 连跑 3 遍，`a === b && b === c` 才算过。**

- ⭐ **用例清单直接抄 `CHANGELOG_2.md` 第四十四次会话那条的第二节**：**37 条正向**（每条一段真实上游原文）
  + **8 条反向**（上游英文原文照样要被映射；「任务失败：参考视频没能通过…」这种**句中假冒**要被重新映射；
  「参考视频**通过了**版权检测」这种近似句不许被放过；4 条真成品必须原样放过）。
- ⭐ `npm test` 现在只有 **15 个用例 / 跑 1.16 秒**，加进去几乎不增加成本。
- ⭐ **收益**：以后谁加新文案、漏了幂等保护，**当场被测试抓住**，不用再等用户来报一次线上 bug。

**🗳️ 更彻底但影响面大的方向（⛔ 动前必须问用户）**：给映射结果打一个不可见标记，
或统一约定「已映射过的文案一律带某个固定前缀」→ 第二遍见到就直接原样返回，不再靠白名单穷举。
⚠️ 但这会动**全站所有红字的最终字符串**（后台 `FAILURE_REASON_SQL` 归一化、历史数据比对全受影响），
所以**先做上面那个测试用例，别急着改架构**。

### [ ] M038 `mention-text.ts` 的「删 @名」和「解析 @名」两个正则不对称（2026-08-06 第四十三次会话立项，⛔ 未修，要修先确认口径）

**来源**：查用户 ID_947011「换了参考图还是老图」时顺带实测出来的（**不是那个 bug 的根因**，是一条独立缺陷）。

**事实（`npx tsx` 直接 import 真实模块，7 条用例实跑）**：
- `removeMentionName`（`src/lib/mention-text.ts:91`）的 lookahead `(?=$|[\s，。！？；;、])` **不含 `@`**
- `getMentionNames`（同文件 83 行）的 `[^@\s，。！？；;、]+` **把 `@` 当终止符**
- → `"@000@A_old 把图2放进图1"` 删「000」**一个字都删不掉**，而发送时**照样解析出 `["000","A_old"]`**

**为什么危险**：`removeActiveUploadedImage` 删缩略图时靠它清 @名；清不掉 → 发送时
`getOrderedExplicitImageReferences`（`chat-workbench.tsx:6210`）拿这个残留 @名去**整个资产库**反查、
把用户已经删掉的老图**捞回来并排在最前面** → 参考图顺序整体错位。
⭐ 这就是 ID_868181「参考音频 @名永远删不掉、每次都带上老音频」的**同一个病理**（那次的 `ensureMediaFileMentions` 已删）。

⚠️ **注释在骗人**：那行注释写着「可紧贴中文、可相邻」，**注释声称支持、正则做不到**
（`@000这张图` 也删不掉，只是解析成 `000这张图`、匹配不上，歪打正着安全）。

**押后原因**：🗣️ 2026-08-06 用户拍板「不确定不要乱动代码」，且这条**不是**用户报的那个现象的根因
（那次是**零上传**，@ 这条路解释不了）。已在 `input-image-removed` 日志里加了 `mentionStillThere` 探针，
**线上一出现 `true` 就是现场铁证**，到时候再修。

**以后怎么做**：把两个字符类改成同一个（`@` 要么两边都当终止符、要么两边都不当）。
⭐ 回归**必须带反向用例**：`@000_2` 不许被删「000」误伤、`@000abc` 不许误删。
⛔ 这个函数是**对话流 + 工作流共用的唯一权威**，改它两边都受影响。

### [ ] M039 `getOrderedExplicitImageReferences` 会从整个资产库把 @名对应的图捞回来并排最前面（2026-08-06 立项，⛔ 未修）

`chat-workbench.tsx:6210` 按提示词里的 @名依次去 **输入框 → 历史会话引用 → 整个资产库** 反查，
**命中的排在最前面**，未被 @ 的缩略图按原顺序补在后面。

**好处（当初的设计意图）**：@名管顺序/意图，用户可以用 @ 指定"参考图1 是哪张"。
**风险**：只要提示词里有一个"输入框里已经没有的" @名，就会从资产库把那张图拉进来 ——
用户视角就是"我明明删了，它还在，而且还排第一"。

**押后原因**：改它会动 @名的顺序/意图语义，**影响面大**，🗣️ 必须先跟用户确认产品口径
（"@ 了但缩略图不在"到底该"拉回来"还是"忽略"）。已在 `send-reference-snapshot` 日志的
`sent` 字段里给每张图打了来源标记，**出现 `[@/assetLibrary]` 就是抓到现场**。

### [ ] M037 把上传进度 `uploadProgress` 从画布状态里搬出去（2026-08-04 第四十次会话立项，🗣️ 用户说"单独排一次"）

**来源**：🗣️ 用户问「工作流上传为什么感觉比对话流慢」。查清了，**不是传得慢、也不是服务端慢**
（两边走**同一个接口**，正式服日志 `asset-upload-temp-post-success` 1597 条 p50 **1073ms**、
`patch-success` p50 23ms，是两边共享的），**是上传期间前端把自己刷爆了**：

- 工作流的进度回调是 `updateNode(nodeId, { uploadProgress })` → `updateState()`，而它**每调一次**要：
  ① `exportStateFromEditor(editor)` 导出整张画布 ② `stateKey()` = **`JSON.stringify(整张画布)`**
  （重度用户实测 **655KB**）③ 对**所有**节点 `editor.updateShape`（不是只更新那一个）
  ④ `syncWorkflowConnectionShapes` = **O(边×节点)** ⑤ `setEditorTick(+1)` 整画布 React 重渲染
  ⑥ `onChange` 抛给父级 `updateWorkflowCanvas`，父级再算 **3 个快照 × 新旧两份 = 6 次全画布遍历**，
  并排一次防抖 PUT。
- 而进度事件一次上传约 **70~100 次**（`upload-progress.ts`：字节阶段按整数变化触发、cap 随机 60~70，
  之后还有**每 450ms 爬一格**的定时器直到响应回来）。
- ⭐ **所以是 O(进度次数 × 节点数 × 画布大小)：工作流节点越多越卡。** 对话流那边同一个 `onProgress`
  只更新一个小对象，没有画布、没有 tldraw、没有 655KB 的 stringify。

**本次已做的止血（已上代码）**：`throttleUploadProgress()`（`upload-progress.ts`）——
100 一定放行，其余要么涨够 5%、要么隔了 300ms 才放行；只在工作流那 4 个调用点用（对话流保持顺滑）。
→ 把 70~100 次降到 ~20 次。

**以后怎么根治（本条待办）**：把 `uploadProgress` 挪进一个**独立的轻量 state**
（`Record<nodeId, number>`，或 ref + 只重渲染那一个 shape），**完全不进 `canvasJson`、不触发 `onChange`、
不触发防抖 PUT**。估计 60~80 行。
⭐ **白捡的好处**：`uploadProgress` / `uploadPreviewUrl` 这两个"临时态必须在存库边界剥掉"的老坑
（`AGENTS.md` 有专门一条铁律，历史上真踩过"刷新后永久卡住"）**从根上消失** —— 它们再也不在画布状态里，
就不可能被存进库。
⚠️ 要一起想清楚的：节点被删/工作流被切走时那份 map 要清理；上传中切走工作流回来后进度条怎么显示。

### [ ] M036 🗳️ 阿里侧「多出来的」媒体要不要清理（等用户拍板，⛔ 别自己删）

**来源**：2026-08-04 第三十九次会话跑完媒体对齐后，`scripts/backfill-ali-media.sh` 报
**「阿里多出 225 个条目」**（腾讯没有、阿里有）。脚本**故意只报数不删**。

**推测成因（⚠️ 假设，未逐个验证）**：`compressGeneratedVideoInPlace` 是**原地替换**，
早期同步过去的是**压缩前**那一份（文件名相同但字节不同），后来腾讯侧被压缩替换、
而阿里那份没被覆盖 → 也可能是腾讯侧清理过、阿里没跟着删。

**要做的话怎么做（⛔ 删除是不可逆的，务必先只读核对）**：
1. `--dry-run` 拿到那份"多出来"的清单（脚本里是 `comm -13`，即 `$WORK/extra.list`）；
2. **逐类看它们是什么**（是不是都在 `videos/`？是不是都能在数据库 `MediaAsset.url` 里找到？）——
   ⭐ **凡是数据库里还有引用的，绝对不能删**（用户点开就是死链）；
3. 只删「数据库无引用 + 腾讯侧也没有」的，删前先在阿里侧 `mv` 到暂存目录观察几天，别直接 `rm`。

**为什么不急**：225 个文件对 21GB 来说占比极小，留着只浪费一点磁盘，**删错则是用户看到死链**。
⭐ 判据：先问用户「阿里磁盘紧不紧张」，不紧张就一直留着。

### [x] M035 工作流 / Agent 接入 MiniMax H3 —— ✅ **工作流已完成（第三十六次会话）；Agent 按用户要求不接**

**背景**：2026-08-03 把 `minimax/hailuo-3`（MiniMax H3）接进**对话流**（第三十四次会话）后，
第三十六次会话又把它**接进了工作流**，并顺手收掉了工作流那份平行的参考模式实现。

**工作流（✅ 已完成）**：
- `workflow-tldraw-canvas-inner.tsx:383` 的 `workflowVideoModels = [...videoGenerationModels, ...bytePlusVideoGenerationModels]`
  **已不再排除 H3**（原来的 filter 已删）。
- 工作流那套**只认 BytePlus、张数写死的平行实现**（`isWorkflowBytePlusSeedanceVideoModel` /
  `getWorkflowEffectiveBytePlusVideoReferenceItems` / `getWorkflowBytePlusVideoReferenceLimitHint`）
  **已收敛到 `upload-rules.supportsVideoReferenceMode` / `getEffectiveVideoReferenceItems` /
  `getVideoReferenceImageMaxCount`**（对话流·工作流·服务端唯一权威）。
  见 `:499~504` 的注释（⛔ 禁止再把本地副本写回来）。
- 测试服 v68/v69 已实测：工作流 H3 的 NEW 徽标 / 2K only / 四参考模式（含尾帧单槽）全过。

**Agent（⛔ 按用户要求不接）**：`system-settings.ts:isAgentVideoModelEnabled` 现在非 BytePlus 一律 `false`。
要接才改它 —— 🗣️ **用户明确不接 Agent，别自作主张开。** 此条留档。

**⚠️ 唯一遗留：H3 从来没被真正跑过一次（🗣️ 2026-08-05 用户指定"下次测试就跑它"）**

H3 接进来之后，**扣费只用"GET 上游历史任务 + 回库对账本"坐实过，没有走过一次真实的后台队列**。
所以 `video-job-charged` 这条日志（v69 专门为"扣费成功却零日志"补的）**一次都没被触发过**。

🗣️ **用户 2026-08-05 原话意思**：「下次测试时就跑 h3 生视频，顺带就把第 2 条验证掉。」
→ ⛔ 不是马上去跑，而是**下次一旦要做测试/巡检，就把这一跑排进去**（顶掉/追加巡检第 5 项的"真跑生视频"）。

- 模型 `minimax/hailuo-3`；约 **47 积分**、**10~16 分钟**（H3 比 Seedance 慢很多，⛔ 别当卡死）。
- 号 `12424740@qq.com`，**新建**对话或工作流留痕（用户交代测试内容不要删）。
- **一跑收 4 个二值结果**：
  1. `.runtime/generation-diagnostics-log.jsonl` 出现 **`video-job-charged`**；
     回库看 `CreditLedger` 那行 `usd`/`credits` 与上游 `usage.cost` 对得上。
  2. **不该**出现 `usdFromFallbackPricing`（出现 = 上游这次没给 cost，要单独记）。
  3. **台账迁移在测试服被触发**（正式服已实测生效，测试服一直没触发过）。
  4. `.runtime/transfer-diagnostics-log.jsonl` 最新一条的 `kbps`/`concurrency`/`chunks`/`retries`/`via`
     —— ⛔ `via:"rsync"` = `ALI_SYNC_PULL_BASE_URL` 没配、退回单流（大视频必失败）。
- ⚠️ 分析 jsonl **一律用 node**（`ConvertFrom-Json` 遇中文整行报错）。


### [ ] M032 工作流节点传参考图偶发"静默挂不上" —— ⛔ **根因未知，严谨复现之前不许动代码**（2026-08-02 记）

**现象（客观描述，不带因果）**：工作流画布里，给图片/视频生成节点点「上传图片 → 从本地上传」选文件，
上传接口全部 200（服务端已落盘），但节点上**有时**什么都不出现（无缩略图、无连线、无报错），
看起来就像"静默挂不上"。2026-08-02 在测试服 v61 观察到 1 次（文件名 `ref-r1.jpg`）。
⭐ 同一份代码下，全新内容 + 全新文件名的图（`ref2-r1.jpg`、`ref6-r2.jpg`）在测试服和正式服都**正常挂上**。

⛔⛔ **已被证伪的三个归因（都别再往这三个方向改）**：

1. ~~"服务端 dedup（`duplicate:true`）导致挂不上"~~ —— **错**。
   反例：挂上的 ref2，它的 POST 实际**也返回了 `duplicate:true`**（内容早被传过），照样挂上了。
2. ~~"`workflow-tldraw-canvas-inner.tsx:3761` 的 by-name 历史资产恢复分支"~~ —— **错**。
   那行判据是 `asset.name === file.name`，而 `asset.name` 是服务端权威名，
   `upload-name.ts:26` 的 `sanitizeUploadBaseName()` **已经去掉扩展名**（`replace(/\.[^.]+$/, "")`）。
   所以 `"ref-r1"` 永远不等于 `"ref-r1.jpg"` —— 对任何带扩展名的文件，**这条分支根本进不去**。
3. ~~"B 的假设：`findExistingUploadNodeForFile(file)` 命中后只连线不建节点"~~ ——
   **错，2026-08-04 第四十次会话证伪**。它的判据是 `mediaSystemNames` 里的名字 `=== file.name`，
   而 `mediaSystemNames` 存的**永远是去扩展名的名字**（服务端 `sanitizeUploadBaseName()`、
   客户端 `sanitizeWorkflowReferenceName()` 第一步都是 `replace(/\.[^.]+$/, "")`；
   **铁证**是同文件 `:1891` 下载文件名要自己补 `.${扩展名}`）→ 和第 2 条**同一个原因**，也永远进不去。
   ⭐ **三次归因错误，三次都是"从现象反推分支"而没有先读判据条件** —— 见 `AGENTS.md` 那条最贵的铁律。

⭐⭐ **2026-08-04 用正式服数据查过一轮：历史上零条"节点建了但图没挂上"**（唯一能留痕的判据）。
拿 `MediaAsset.workflowNodeId` / `MediaAsset.url` 去比对该工作流的 `canvasJson`（354 条工作流上传）：

| 情况 | 条数 | 说明 |
|---|---|---|
| 节点在 + url 在 | 334 | 正常 |
| 节点不在 + url 还在别处 | 10 | 用户删了上传节点、图还连着生成节点 = 正常 |
| 节点不在 + url 也不在 | 10 | 用户把节点删了 = 正常 |
| **节点在 + url 不在** | **0** | ⭐ 这才是"节点建了图没上去"的指纹，**一条都没有** |

顺带：`同一用户同一 contentHash 有多条 MediaAsset` = **0** → **服务端去重完全正常**，没有重复落盘。
⛔ **注意这个判据的局限**：用户事后删节点会产生和"静默失败"一样的痕迹，所以只有"节点在+url不在=0"这一格是硬结论。

🟡 **剩下两个假设（仍未验证，⛔ 不许据此改代码）**：

1. **新节点被放到视口外**（当前最可能）：从提示词框上传走 `uploadFilesAsConnectedNodes`，它**故意只聚焦目标生成节点、不聚焦新上传的节点**（`selectAndFocusUploadedNodes([targetNodeId], false)`），
   而新节点放在目标节点**左边**、为了不重叠还会继续往左挪 → 画布放大时完全看不见 = "什么都没发生"。
2. **前端校验拒掉了**：`return onShowTip?.(validationError)` —— 节点压根不建，只有一个一闪而过的 toast；
   且 `onShowTip` 万一没传就是**彻底静默**（这个写法本身也值得改成必传/兜底）。

**复现设计（动代码前必须先做）**：
用**全新内容 + 全新文件名**的图，在**干净的新工作流**里传；若这样也挂不上，才是 attach 链路本身的问题；
若挂上了，分别构造**同名文件 / 同内容文件 / 全新文件**三种情况，**看 tip 原文**判断走了
`:3754` / `:3761` / `:3768` 哪条分支（不许靠回忆 tip，两条 tip 文案很像：
`已存在，已直接连接` vs `已在历史记录中，已恢复并连接`）。

⭐ **连带小瑕疵（同一条待办里一起评估，别单独立项）**：前端校验拒掉的文件（比如尾部带垃圾字节的"JPEG"），
服务端却已经落盘 → 产生孤儿文件；且拒绝 tip 一闪而过，用户可能看不到。
（2026-08-02 实测：前端 validate 拒收的文件，`asset-upload-temp` POST/PATCH 全 200。）

⛔ **硬约束：在有一次严谨复现之前，不许动这段代码。**
（本条由 B 定稿：A 连续两次归因错误（先说 dedup、再说 by-name 分支），均被 B 用判据条件证伪。
教训同源：先读判据，再谈因果。⭐ 2026-08-04 第四十次会话又证伪了 B 自己的第三个假设，同一个原因。）

⭐⭐ **2026-08-04 顺带修掉的一个"确定的真 bug"（不是 M032，已单独改掉，别混淆）**：
既然那两条 by-name 分支永远进不去，就意味着：
① 提示 `xxx 已存在，已直接连接` / `已在历史记录中，已恢复并连接` **用户永远看不到**（写了但触发不了）；
② 同一张图在同一个工作流里传两次会**建出两个重复节点**（服务端不会重复落盘）。
→ 已新增 `matchesWorkflowUploadFileName()`（去扩展名 + 客户端兜底名两种口径），两处判据统一走它。
⚠️ **仍会漏判且刻意不修**：服务端权威名还会去标点并**截断到 24 字**
（`hero-mecha-robot-reference (2).jpg` → `hero-mecha-robot-referen`），按名字比就是不可靠；
真正稳的判据是 contentHash（服务端已经在用），前端要做等有必要时再说。

### [x] M027 阿里入口没有 upstream keepalive，跨境每请求重建连接 —— **2026-08-01 已做完（方案 B，测试服 + 正式服都改了）**

> ✅ **结论：做的是方案 B（加 upstream keepalive），⛔ 方案 A 被否掉。**
> 🗣️ 用户否 A 的理由（原话意思）：「我做测试服就是为了提前测试，测试服和正式服关键的东西一定要一样，
> 这样在测试服测好的东西到正式服才最大限度不出问题。」→ **A 会让两服入口架构不一致，测出来的不作数。**
>
> **实测收益（都在阿里本机测，隔离出「阿里→腾讯」这唯一慢的一跳）**：
>
> | 入口 | 改前中位数 | 改后中位数 | 倍数 |
> |---|---|---|---|
> | 测试服 `:8080` | **1.62s** | **0.30s** | 5.4× |
> | 测试服 `staging-static`（HTTPS） | — | **0.36s** | — |
> | **正式服 `ali.venusface.com`** | **1.64s** | **0.37s** | 4.4× |
>
> `connect` 耗时从 **1.26~1.33s → 0.00008s**（复用现成连接，压根不用握手）—— 这一列最能说明问题。
> **0.30s 已基本触到物理下限**（其中 255ms 是 RTT，应用本身只占 40ms）。
>
> ⛔ **没解决的残留**：偶发 1.0~1.5s 毛刺还在，因为那条线 **实测丢包 33.3%**，
> 握手不用了但传数据时丢包照样要重传。**这属方案 C（花钱）**，配置层面到顶了。
>
> ### ⭐⭐ 改的时候踩到/学到的（下次改 nginx 必看）
>
> 1. ⛔⛔ **量性能必须站在「阿里本机」测，不能站在腾讯 curl 阿里** ——
>    后者等于跨境跑两趟（腾讯→阿里→腾讯），数字全被污染。我第一轮就是这么测的，
>    看到 `connect=0.25~1.37s` 差点以为 keepalive 没生效，其实那是腾讯到阿里的那一跳。
> 2. ⭐ **keepalive 三件套缺一不可**：`upstream` + `keepalive N`、`proxy_http_version 1.1`、
>    `Connection` 头置空。**只加 upstream 不改后两个 = 完全没效果**（默认 HTTP/1.0 + `Connection: close`）。
>    正式服那 6 个 location 原本连 `proxy_http_version 1.1` 都没有。
> 3. ⭐ **`Connection` 用 map 变量而不是写死**：`map $http_upgrade $xxx_conn_upgrade { default upgrade; '' ''; }`
>    → 普通请求为空（长连接）、WebSocket 才是 upgrade。原来写死 `"upgrade"` = 每个请求都被当成升级请求。
> 4. ⛔ **命名必须带项目前缀**（`fm_test_app` / `fm_prod_app` / `$fm_prod_conn_upgrade`）：
>    那台 nginx 还 include 着 `tiantangqiyuan` / `venusai` / `video-downloader` 三个别的项目，
>    upstream 名或 map 变量名重名会 `duplicate` 直接起不来、把别人也搞死。改前先
>    `grep -rn "upstream \|map \$http_upgrade" /etc/nginx/` 确认没撞（本次实测全站一个都没有）。
> 5. ⭐⭐ **改混着别的项目的文件用「精确替换 + 计数断言」**（脚本 `deploy/ali/ali-add-upstream-keepalive.py`）：
>    先勘察出两类特征（正式服那份：6 处「proxy_pass 紧跟 `Host 101.47.19.109`」缺 1.1，
>    2 处 `location /`「紧跟 `proxy_request_buffering off`」已有 Connection），
>    替换后**断言条数必须等于 (6, 2, 2)**、断言 `tiantangqiyuan` 条数没变，不符就一个字都不改直接退出。
>    ⛔ 比 `sed` 全局替换安全得多，也比整份覆盖安全得多。
> 6. ⛔ **`set -e` + `curl` 会把验证脚本掐断**：curl 超时返回非 0 → 后面的复测全不跑了（本次踩过一次）。
>    纯验证脚本别开 `set -e`。
> 7. ⭐ **顺手补掉一个漏项**：`staging-static.venusface.com` 那份 conf **压根没有 M024 那批的
>    `proxy_buffers` 和 `gzip`**（当时只加到了 8080 那份）→ 走 HTTPS 访问测试服时，
>    大响应一直在写磁盘临时文件、JSON 从来没被压缩过。已补齐，实测 `Content-Encoding: gzip` 生效。
>    ⭐ **教训：同一个功能有多个入口 conf 时，改一个必须把兄弟们都 grep 一遍**（这正是"能统一一律统一"）。
>
> **备份**（要回滚就用这些）：
> - 测试服两份：阿里 `/root/nginx-backups/{flashmuse-test-8080,flashmuse-staging-static-ssl}.20260731-171942.bak`
> - 正式服：阿里 `/root/nginx-backups/flashmuse-static-ip.20260731-173554.bak`
>
> **仓库里的权威副本**（铁律：以仓库为准，先改仓库再部署）：
> `deploy/staging/flashmuse-test-8080.conf`、`deploy/staging/flashmuse-staging-static-ssl.conf`、
> `deploy/ali/ali-add-upstream-keepalive.py`（正式服那份混着别的项目，只能用这个增量脚本，幂等可重复跑）。

<details>
<summary>以下是当初的排查记录（保留备查）</summary>

**起因**：用户报「测试服读取慢、一开始加载整个工作流画布也非常慢」。查清了 —— **不是代码问题**。

**已量到的硬数据**（工具在 `.runtime/perf-staging.sh` / `perf-ali.sh` / `perf-ali2.sh`）：

| 层 | 耗时 |
|---|---|
| 腾讯宿主 → staging nginx `/api/models` | **48 ~ 65 ms**（应用一点不慢） |
| 阿里 → 腾讯:5001 `/` | 0.54s / 1.52s / **3.28s** / 0.54s / **3.17s** |
| 阿里 → 腾讯:5001 `/api/models` | 0.57s / 2.56s / **36.4 秒**（connect 就 11.4s） |

```
阿里 ping 腾讯：37.5% packet loss, RTT 255ms
腾讯 ping 阿里：25%   packet loss, RTT 255ms
```
`connect` 耗时 0.25/1.27/3.2/**11.4s** = **Linux SYN 重传的指数退避（1→2→4→8s）**，握手包被丢在重传。

**配置层面的两个问题**（`/etc/nginx/sites-enabled/flashmuse-test-8080` 的 `location /`）：
1. **没有 `upstream` 块、没有 `keepalive`** → 每个请求重做一次跨境 TCP 握手，37% 丢包下每次都有 1/3 概率 +1s/+3s/+11s。
2. 写死了 `proxy_set_header Connection "upgrade";`（不是 `$connection_upgrade` 映射）
   → **等于每个普通请求都告诉上游"这不是长连接"，连接永远不可能复用**。这是 bug。

⭐⭐ **顺带查清的架构事实（用户专门问了「难道测试服和正式服不一样吗」）**：

| 域名 | 指向 | 说明 |
|---|---|---|
| `main` / `api`.venusface.com | `119.28.116.16` | **腾讯新加坡直连**，443 在腾讯终止 SSL；`next.config.ts` 没 `assetPrefix`、HTML 里 `_next/static` 全是相对路径 → **静态也是腾讯直发** |
| `ali` / `static`.venusface.com | `101.37.129.164` | 阿里，反代回腾讯:5000 |
| `staging-static` / `:8080` | `101.37.129.164` | **测试服只有这一个入口** → 必然多一跳跨境 |

同一个 `/api/models` 从国内实测：main **210ms 稳** / ali 600~1685ms / 测试服 582~4739ms /
**测试服绕开阿里直连 `119.28.116.16:5001` = 166~385ms**。

**三个方案（一个都没做，等用户拍板）**：

| 方案 | 改什么 | 效果 | 风险 |
|---|---|---|---|
| **A（推荐）** | 测试服入口改用 `http://119.28.116.16:5001/` 直连腾讯 | 1.6~10.7s → 0.17~0.39s | **零风险**（端口已开、实测 200，不改任何服务器配置；但 `sync-ali-test.sh` 就不需要了） |
| B | 阿里那份 conf 加 `upstream` + `keepalive 32`，`Connection` 改成 `$connection_upgrade` 映射 | 复用连接、大幅减少 SYN 重传惩罚 | 中。`flashmuse-test-8080` 是测试服独占文件，可备份 + `nginx -t` + 失败回滚 |
| C（长期） | 丢包 25~37% 是公网路由本身的问题 → 专线/全球加速，或国内也部一份 app | 根治 | 要花钱 |

⚠️⚠️ **还没查、但很可能有同样问题的**：`ali.venusface.com`（**正式服的国内入口，有真实用户在走**）比 main 慢 3~8 倍。
它的配置在阿里的 `flashmuse-static-ip` 里 —— ⛔ **那个文件混着别的项目 `/tiantangqiyuan/`，禁止整份覆盖**
（见 `AGENTS.md` nginx 铁律），要改只能用幂等增量脚本（模板 `deploy/ali/ali-add-proxy-buffers.sh`）。
我提议"只读地看一眼那份配置再报结论"，🗣️ **用户也说以后再说**。

> ✅ **上面这段"还没查"的部分，2026-08-01 已经查了并且修了**（用户当天改口说「正式服照样做吧」）：
> 确认 `ali.venusface.com` 就是同一个毛病，8 处 `proxy_pass` 全部裸连、6 处连 `proxy_http_version 1.1` 都没有。
> 已用增量脚本修好，`tiantangqiyuan` 一个字没动。

</details>

### [ ] M029 对话流生成「统一单轮询器」—— ⚠️⚠️ **这条曾经因为编号撞车丢过一次，2026-08-02 从归档里捞回来重新登记**

- ⛔⛔ **为什么要特别说明**：归档里的 **M018** 原本就是这件事（`historical-handover-docs-last-used-2026-07-21/06-memo-tasks.md:165-177`，
  有完整方案），但 2026-07-22 有人把 M018 这个编号**复用给了另一件事**（"刚上传媒体不刷新自动切阿里镜像"）
  → 原任务在现行文档里**彻底消失**。2026-08-02 全项目审计时 grep 发现
  **"单轮询器"/"双轮询器" 在全部现行文档里零命中**，才把它捞回来。
  ⭐ **教训：复用 M 编号 = 静默删掉一个任务。以后只准往后取新号。**
- **押后原因**：当年只落地了"防重复"的 guard（`runningRequestIdsRef`），重构本身没做。用户当时同意以后做。
- **问题**：对话流的生成状态有**两个轮询器**——前端的 `while` 循环 + 数据驱动的后台 reconcile。
  两者都会 `+1` 失败计数器 → 历史上**出过两次"重复失败卡"**（先视频、后图片）。
- **重构方向**：干掉前端 `while` 轮询，让 reconcile 成为唯一轮询器，并把这 4 项职责搬进去：
  ① BytePlus 人工审核往返 ② 实时状态文案（排队中/渲染中）③ 停止/中断 ④ 超大参考图压缩重试。
- **做之前**：先把这 4 项的现有行为列成回归清单，否则很容易丢掉其中一项。

### [ ] M030 服务端文档解析（pdf/docx/xlsx/pptx → 文本分块入库）—— 2026-08-02 从归档捞回

- **押后原因**：整套计划在 2026-06 的归档里有（`historical-handover-docs-last-used-2026-06-20/03-progress.md:1455,1501`、
  `05-chat.md:1017`），但**在现行交接文档里零命中**，等于被遗忘了。
- **现状**：文档只是"挂上去 + 显示"，**没有任何服务端解析**。Agent 拿不到文档内容。
- **以后怎么做**：服务端解析 pdf/docx/xlsx/pptx → 文本 + 分块存库 → Agent 读分块而不是原文件。
- ⚠️ **注意本次（2026-08-02）新增的约束**：文档上传现在有**后缀白名单**
  （`media-upload-validation.ts` 的 `DOCUMENT_UPLOAD_FORMATS`）和 10MB 上限，
  做解析时如果要支持新格式，**必须同时加进那个唯一权威列表**。

### [x] M031 数据保留 / 清理策略 —— ✅ **2026-08-02 用户拍板：保留 1 周**，清理脚本已写（随正式服批挂 cron）

- **拍板结果（2026-08-02）**：保留窗口 = **7 天**。已新建 `scripts/cleanup-old-data.mjs`
  （默认 dry-run，`--apply` 真删，分批 5000）：清 GenerationEvent（7 天前且成功/已归档）、
  GenerationJob（7 天前且已结束）、UploadEvent（7 天前）。**cron 还没挂**，随正式服部署批挂上（每天备份后跑）。
- ⛔ 明确不碰：WorkspaceMessage / CreditLedger / 回收站软删（产品规则：回收站到期只是客户端隐藏）。
- ⚠️ 代价（用户已知）：7 天前的 GenerationJob 删掉后，老资产的「使用提示词/后台弹窗」参考图回溯会变少
  （MediaAsset.sourcePrompt 不受影响）。
- **背景**（2026-08-02 审计发现）：**全项目只有 4 处 `deleteMany`，全在 `auth.ts` 且全是 Session。**
  也就是说除了会话表，**这个应用从来不删任何一行**。
- 只增不减的表：`GenerationEvent`（每次生成尝试一行，归档脚本只打 `resolvedAt` 标记、**从不删行**）、
  `GenerationJob`（**9 个 jsonb 列，按字节算最大**）、`CreditLedger`、`UploadEvent`、
  `GptImagePromptOptimizationCase`、`WorkspaceMessage`。
- 软删除永不清除：`WorkspaceSession.deletedAt`、`WorkspaceWorkflow.deletedAt`
  （⚠️ 而且已删工作流的 `canvasJson` **每次 PUT 还在被读**，见 `08` 的 1.4）、
  **`UserAssetState.purgeAt`（这个列名是个承诺，但代码从不据它删任何东西）**、`MediaAsset.archivedAt`。
- 孤儿：DB 有行文件没了 = 永久隐形僵尸；文件有 DB 没行 = 永久占盘无人扫。
  `scripts/audit-asset-consistency.mjs` 是审计不是清理，且要手动跑。
- ⛔ **为什么押后**：用户长期交代过「**测试内容不要删**」，而且用户明确定过"真删除一律禁止、只软删"。
  → **保留天数必须他本人定**，任何自动删除都要他签字。
- 做的时候：先 dry-run 报数量、先备份（备份体系已经有了）、分批删、每步打印影响行数。

### [x] M028 侧边栏三态要不要持久化（记到 localStorage）—— ✅ 2026-08-01 用户拍板：保持现状，不做

2026-08-01 侧边栏改成一个按钮循环三态后，**状态没做持久化**（原本也没有），刷新回常规态。
（2026-08-02 v65 起点 logo = 切换线路 = 整页跳转，跳转后当然也是常规态。）
🗣️ **2026-08-01 用户已拍板：「保持现状吧，刷新回常规态挺好」** → ⛔ 别再当待办捡起来，此条留档。

真要做：往 `chat-workbench.tsx` 的 `StoredWorkspaceUiState` 加
`sidebarState?: "normal" | "collapsed" | "hidden"`，在 `getStoredWorkspaceUiState` 里校验，
`useState` 从 `initialWorkspaceUiStateRef.current` 取初值，`cycleSidebarState` 里 `setStoredWorkspaceUiState`。
（`WORKSPACE_UI_STATE_STORAGE_KEY = "flashmuse-workspace-ui-state-v1"`）

### [ ] M026 单个工作流内部的节点也要分页（一次读 10~20 个，读完再读下面的）

> 🗣️ **用户 2026-07-30 原话意思**：「比如他一个工作流里生成了几百上千个节点图片和视频，那光一个工作流就很大了，
> 所以也要改成一次读 10 条或 20 条，读完再读下面 10 条或 20 条」。
> **但紧接着说「第二层先不做，我只是提了一下，可以以后做」** → ⛔ **别自己开工，等用户再提。**

**为什么比 M025 难得多（接手前先知道）**：
- 对话流能分页是因为**消息一条一行**（`WorkspaceMessage` 表），天然能 `take 30`。
- 工作流的**所有节点挤在一个 `canvasJson` 字段里**，是一坨 JSON → 数据库层面没法"取 20 个节点"，
  **必须先把节点也拆成一张表**（如 `WorkspaceWorkflowNode`，一个节点一行）→ **要写 Prisma 迁移 + 迁移存量数据**。
- 而且画布是 tldraw：节点有位置、有连线。"只加载 20 个节点"意味着**画布上会缺东西**
  （连线连到没加载的节点上怎么画？缩小看全局怎么办？）→ **得先定产品行为**，不能照抄对话流的"往上翻页"。

**上一任给用户提过三个方案，用户还没选**：
- a) **按视口加载**：看到哪儿就加载哪儿（最符合画布直觉，改动最大）
- b) **按时间倒序**：先给最近 20 个，像对话流那样翻（实现简单，但画布会"缺一块"很怪）
- c) ⭐ **只加载轻量骨架**（位置/连线/缩略图），点开某个节点才拉它的提示词等重内容
  （折中：画布完整不缺东西、不用改产品行为，而且与 M025 是同一套"剥字段 + 服务端权威"的做法，能复用）
  —— 上一任倾向 c。

### [x] M025 ②「工作流列表不带完整画布」—— **✅ 两阶段全部做完并随 `v1.0.0.57` 上线（2026-07-31）**

> 🗣️ **用户拍板的理由（原话意思）**：「如果只是算眼前的账那当然没必要做，没多少大。
> 但是我们的项目还要一直运行的，以后如果一个人 100 多个工作流 1000 个工作流难道还一次性下发吗？那不卡才怪呢。」
> → **不是为了省当下那 31KB，是为了不让它随工作流数量线性膨胀。**

- **第一阶段（第二十一次会话做的，骨架版）**：非活跃工作流去掉 `data.prompt` / `data.uploads` /
  `historicalMediaNodes` / `historicalTextNodes`，节点连线一个不少。
- **第二阶段（第二十二次会话做的，`v1.0.0.57` 上线）**：**其余工作流连 `canvas` 键都不下发、数据库也不读 `canvasJson`**，
  只发标题等元数据 + `canvasTrimmed: true`；切过去时 `GET /api/workspace-state?workflowCanvasId=xxx` 补拉。
  ⭐ 正式服实测：全站 `workflowItems` gzip 后 **399.8KB → 100.1KB（省 74.9%）**，
  最重用户 ID_868181 **108.5KB → 15.0KB（省 86.2%）**。

⭐⭐ **能做成的前提是三处"跨工作流遍历"全部搬到了服务端**（也是继续往下做的地基）：
| 原来前端怎么做 | 改成 | 顺带修掉的问题 |
|---|---|---|
| 扫所有工作流找 `isRunning` 判断"有没有在生成" | 服务端查 `GenerationJob`（`getRunningWorkflowIds`） | `isRunning` 是持久化标记，后台跑完不会清 → 跳动点一直亮 |
| 扫所有工作流用 URL 反查"这张图是哪个节点的"（取名字/提示词） | `/api/media-save-status` 返回 `origin`（来源 `MediaAsset`） | 服务端数据比画布副本更全更准 |
| 扫所有工作流找还挂着远端地址的节点、在前端换成本地地址 | 落地成功时服务端直接改画布（`applyWorkflowJobResultToCanvas`） | ⭐ **原来只在用户开着页面时才换 → 关了页面画布里就留着会过期的远端地址 = 死链**（正式服实测：关了浏览器视频跑完，地址仍是本地的 ✓） |

⛔⛔ **改这块前必读**：`workspace-workflows.ts` 的 `upsertWorkspaceWorkflows` 有**四道防删数据的防线**
（`canvasTrimmed` 标记 / **"库里有内容而客户端这份连 `nodes` 数组都没有就不写"** / "与库里骨架版逐字段相等就不写" /
`prompt` 字段级恢复），因为画布是**整体覆盖**保存的，缺字段存回去就等于**真删用户提示词**。
⛔ 取"库里现有画布"那次查询**不许加 `deletedAt: null`** —— 加了会让"删掉一个没打开过的工作流"把它的画布洗成 `{}`
（这个 bug 真实存在过，第二十二次会话本地复现并修掉，详见 `CHANGELOG.md` 顶条）。
⛔ **别把任何一处遍历改回"扫所有工作流"**（代码里都写了警告注释）。

⚠️ **还能再往下做的只剩 M026**（单个工作流内部的节点分页）—— 用户已明确说"先不做，以后再说"。

### [ ] M025-旧 上一任（第二十次会话）的评估留档 —— 结论已被用户否决，只作方法论参考

> 🗣️🗣️ **给下一个 AI 的交代（2026-07-30 第二十次会话末，用户原话意思）**：
> 「**把 M025 记录清楚，我跟下一个 AI 讨论一下**」。
> → 所以：**这条是"待讨论"，不是"已否决"，也不是"直接开做"**。
> **先把下面这四块念给用户听，再等他拍板**：① 它是干什么的 ② 值多少（含压缩后的真实数字）
> ③ 我上一任的建议和理由 ④ 真要做的话怎么做、风险在哪、怎么测。
> ⛔ **别在用户没拍板前动代码**（`AGENTS.md` 第一条铁律：有影响先报影响范围、等确认）。

#### 一、它是干什么的（一句话）

打开工作台时，接口会把**你所有工作流的完整画布**一次性发下来。
M025 = **只把"当前正在用的那一个工作流"发完整，其余工作流只发个骨架**（去掉最占地方的
`data.prompt` / `data.uploads`），等你**真的切到某个工作流时再单独去拉它的完整画布**。

#### 二、值多少 —— ⭐ 关键：必须看**压缩后**的数字

**背景**：v1.0.0.56（2026-07-30）已经给 API 开了 JSON gzip + 把 nginx 缓冲放大到 1MB。
所以现在再评估 M025，**必须用压缩后的字节，用未压缩字节会得出完全相反的结论**。

实测（正式服真实数据，脚本 `.runtime/m025.js`，v56 上线后跑的）：

| 用户 | canvas 未压缩 | **gzip 后（= 真实传输量）** | 压缩率 | **M025 做完还能再省** |
|---|---|---|---|---|
| ID_868181（9 工作流 / 429 节点，最重） | 655.4KB | **105.1KB** | 16.0% | **31.0KB**（29.5%） |
| ID_686996（18 工作流 / 103 节点） | 447.6KB | 111.3KB | 24.9% | 17.9KB（16.1%） |
| ID_708423（4 工作流 / 92 节点） | 325.9KB | 64.2KB | 19.7% | 14.0KB（21.7%） |
| ID_636611（7 工作流 / 135 节点） | 159.9KB | 29.2KB | 18.3% | 2.4KB（8.3%） |
| ID_673536 / ID_193006 | 79.2KB / 58.5KB | 14.0KB / 12.5KB | ~18-21% | 0.6KB / 2.0KB |

⭐ **为什么压缩率这么高（16%）**：canvas 里最大的一块是 `data.prompt`（占 43.7%），
它是**纯中文提示词文本、而且大量重复** —— 正好是 gzip 最擅长压的东西。

**canvas 内部构成明细**（ID_868181，9 个工作流 429 个节点，未压缩字节）：
`data.prompt` **229.3 KB（43.7%）** / `data.uploads` 47.9 KB / `data.imageDimensions` 47.2 KB /
`data.mediaSystemNames` 41.3 KB / `data.images` 35.4 KB。
→ M025 只打算剥前两项（`prompt` + `uploads`）＝ 未压缩约 277KB，**但压缩后只值 31KB**。

⚠️ **顺便记下另一件事**：v56 的 ①③④ 对 ID_868181 这个用户**一点用都没有**（省 0.0%），
因为他的响应 **98.7% 都在 canvas 里**。所以"总省 45.2%"那个数字是全体平均，落到最重的用户头上是 0
—— 这也是当初想做 M025 的原因。**但压缩之后，他的绝对值也只有 105KB 了。**

#### 三、⭐ 我（上一任 AI）的建议：**倾向不做**，但**这只是建议，请用户拍板**

三条理由：

1. ⭐⭐ **原来那个病根已经被堵死了，不靠 M025**。
   「打开工作台转圈 17~30 秒」的真正原因是：响应撑爆 nginx 的 `proxy_buffers`（默认才 32KB）
   → nginx 把整个响应**先写到磁盘临时文件**再转发（它自己在 warn 日志里写了）。
   v56 已把缓冲区放大到 **32×32k = 1MB**，而最重用户压缩后才 ~105KB → **10 倍余量，物理上不会再落盘**。
   **实测：`buffered to a temporary file` 告警 8 条 → 0 条。**
2. **M025 剩下能省的只有 ~31KB**，而且只有最重的那一个用户这么大（第二名 18KB，多数用户只有几 KB）
   → 对打开速度基本无感。
3. ⛔ **风险与收益不成比例**。它必须改**前端工作流加载路径** + 新增"按需拉单个 canvas"的接口；
   而 `workflowItems` 是**整体覆盖回写**数据库的（`chat-workbench.tsx:10329`
   `workflowItems: getPersistableWorkflowItems(...)`）→ **下行剥掉的字段只要有一处在 PUT 侧没恢复上，
   就是真把用户的画布内容删了**（不可逆）。为 31KB 冒这个险，性价比很低。

#### 四、⭐ 如果用户拍板"要做" —— 完整方案（照这个做，别另起炉灶）

**⛔ 为什么不能简单地"列表就不发 canvas"**（这是最容易踩的地方）：

1. 前端有 **8 处跨工作流全量遍历 canvas**（`chat-workbench.tsx`）：
   `980` / `1076~1092` / `2212` / `2226` / `5196` / `8374` / `8487`（判断有没有节点在生成中）/ `10398`（按 URL 反查节点）。
   canvas 一空，这些逻辑全部失效（比如"有工作流正在生成"的全局提示会消失）。
2. ⚠️⚠️ **更危险**：前端局部更新节点时是 `{ ...node.data, ... }` 展开回写（`12277` / `12303` / `10441` 等），
   PUT 上来的 canvas 若缺字段，**会把库里的画布内容真删掉**。

**分三步（服务端那半有现成模式可复用，最省力）**：

1. **只给"活跃的那一个工作流"下发完整 canvas**，其余工作流下发**瘦身版**
   （去掉 `data.prompt` / `data.uploads` 这两个最大且列表用不到的字段，
   **保留** `id/kind/x/y/images/videoUrl/isRunning/mediaSystemNames/imageDimensions` —— 上面那 8 处遍历只用这些）。
   → 改 `workspace-workflows.ts` 的 `workspaceWorkflowRowToPayload()` / `getWorkspaceWorkflowPayloads()`。
2. **PUT 侧配对恢复**：`workspace-workflows.ts` 的 **`mergeWorkflowCanvasMedia()`（:106）已经在做这件事了**
   （客户端缺 `images`/`videoUrl`/`imageDimensions`/`mediaSystemNames`/`posterUrl` 就从库里补回来）
   → **只需把 `data.prompt` / `data.uploads` 加进它的恢复清单**，不用新写函数。
   ⭐ 这与 v56 那个 ③ 的做法**完全同构**：`workspace-sessions.ts` 的
   `projectWorkspaceMessageForClient()`（下行投影）+ `restoreProjectedMessageFields()`（PUT 恢复）。
   **照抄那对函数的写法，它们已经在线上跑通并验证过了。**
3. **前端按需补拉**：切换/打开某个工作流时，若发现该工作流是瘦身版（加个 `canvasTrimmed: true` 标记），
   就调一次"拉单个工作流完整 canvas"的接口再渲染。
   → 需要新增 `GET /api/workspace-state?workflowId=xxx`（或独立 route），返回单个完整 canvas。

**必测清单（做完必须逐条实测，测试服 `12424740@qq.com`）**：
- 打开工作流 A（非活跃）→ **节点上的提示词要正常显示**（这是最容易破的一条）
- 在 A 里拖一个节点 / 改提示词 → 切到工作流 B → 再切回 A → **提示词和画布内容都不能丢**
- 在 A 里生成一张图 → 切走再回来 → 图还在、名字还在
- 工作流列表**顺序不能乱**（"只打开不置顶"那个修复别回归）
- 点任意节点**不能崩**（React #310 老坑，见 `AGENTS.md` 里 `WorkflowSelectedNodeOverlay` 那条）
- 后台 `/admin?tab=records` 里那次生成记录正常
- ⭐ **最后必须去库里核对**：`canvasJson` 里 `data.prompt` 的条数**改动前后要一样**（证明没删数据）
- ⭐ **拿 ID_868181 这种"多工作流大画布"的号验**，否则测不出效果

**量收益的现成工具**：
- `scripts/measure-workspace-state-size.mjs`（已进 git）：挑出重度用户、打印改动前后字节数。
- ⭐ `.runtime/m025.js`（本次新写）：**直接打印每个用户 canvas 的未压缩 / gzip 后字节 + 模拟瘦身后能再省多少**。
  做完 M025 拿它再跑一次就知道真实收益。


### [x] M024 `/api/workspace-state` 响应体过大 —— **①③④ 已随 v1.0.0.56 上线并实测生效（2026-07-30）**，② 见上面 M025

> ✅ **上线后实测**：「`buffered to a temporary file`」告警 **8 条 → 0 条**，四处 gzip 均生效，部署后无 5xx。
>   ⭐ 也就是说**这条的病根已经治好了**（②做不做已不影响这个结论，见 M025）。

> ⭐ 根因排查全文见本条下方「排查实录」，**别重复排查**。也**别把它和 502 混在一起**（两件不同的事，见下面「已查清/无需再查」）。

- **现象**：浏览器里打开工作台 `/api/workspace-state` 偶发 **17~30 秒**。
- ⭐⭐ **根因（nginx 自己写在 warn 日志里）**：
  `an upstream response is buffered to a temporary file /var/cache/nginx/proxy_temp/... while reading upstream,
   request: "GET /api/workspace-state?summary=1&panel=chat"`
  → **响应体超过 nginx 的 `proxy_buffers`（默认 8×4k=32KB），nginx 先落盘到磁盘临时文件再转发**，
  叠加跨境传输 → 十几~三十秒。
- **实测量级**：该接口响应最大 **1,188,114 字节（1.19MB）**，是全站所有 `/api/` 里最大的（Top-25 全是它）。

#### ⭐ 三个真正的大头（逐层量出来的，不是推测）

⛔ **先纠正一个容易走偏的判断**：「消息一次全发」是**错的** ——
消息早就有分页（`DEFAULT_WORKSPACE_MESSAGE_LIMIT`、`hasMore`/`nextBefore`，会话列表也有 10 条上限）。
真正的原因是下面三个：

| # | 大头 | 实测最大 | 内部构成 |
|---|---|---|---|
| 1 | `workflowItems[].canvas` | **655.4 KB**（ID_868181，占其响应 98.7%） | `data.prompt` 43.7% / `data.uploads` 9.1% / `data.imageDimensions` 9.0% |
| 2 | 活跃会话的消息（50 条） | **785.6 KB**（ID_686996，平均 8~18 KB/条） | `generationMeta` 45.7% / `content` 21.9% / `videoPrompts` 21.9% |
| 3 | `feedbackLogs` | **727.8 KB**（ID_332396，占其响应 93%） | `context` **79.7%** / `message` 15.4% |

⭐⭐ **第 2 项的关键洞察（最有价值的一条）**：`generationMeta.itemPrompts`(138.6KB) +
`generationMeta.originalPrompt`(138.5KB) + `videoPrompts` 的值(134.2KB) + `content`(138.8KB)
**装的基本是同一批提示词** —— 550KB 里约 **415KB 是同一份提示词的重复副本**。
而前端读取本来就是**层层回落**：
`videoPrompts?.[url] ?? generationMeta?.itemPrompts?.[i] ?? generationMeta?.originalPrompt ?? content`
→ 所以「值相同就少发一层」**语义完全不变、前端一行都不用改**。

#### ✅ 已做（2026-07-30 本地，未部署）

| 项 | 改了什么 | 文件 |
|---|---|---|
| ① | **`feedbackLogs` 下行不再发**（前端确认不读它：`getAgentGenerationModel(..., { feedbackLogs })` 是**死参数**，函数体没引用）；PUT 侧用 `mergeFeedbackLogs()` 按 id 去重合并、留最近 300 条 → **数据一条不丢** | `src/app/api/workspace-state/route.ts` |
| ③a | **重复提示词副本不下发**：`projectWorkspaceMessageForClient()`；配对的 `restoreProjectedMessageFields()` 在 PUT 时把字段补回库（否则前端回写会真删库） | `src/lib/workspace-sessions.ts` |
| ③b | `DEFAULT_WORKSPACE_MESSAGE_LIMIT` **50 → 30** | `src/lib/workspace-sessions.ts` |
| ④ | **nginx 大响应不落盘 + JSON gzip**（腾讯正式/测试 + 阿里测试整份改好；阿里正式用幂等增量脚本） | `nginx/flashmuse.conf`、`deploy/staging/*.conf`、`deploy/ali/ali-add-proxy-buffers.sh` |

⭐ **实测收益（`scripts/measure-workspace-state-size.mjs`，8 个重度用户，真实数据）：合计 4905 KB → 2688 KB，总省 45.2%**
- ID_332396 **省 94.7%**（772→41 KB，feedbackLogs 那 727KB 全省）
- ID_271898 **省 70.9%**（473→138 KB，消息 415→80 KB）
- ID_673536 省 57.8%、ID_686996 省 44.0%、ID_315163 省 42.4%
- ⚠️ **ID_868181 省 0.0%** ← 它 98.7% 是 canvas，**正好是没做的 ②**（见 M025）
- ⭐ 叠加 ④ 的 gzip 后，实际下行还能再压到这个数的 15%~30%

#### ⛔ 三个"改的时候差点踩、以后别踩"的坑

1. **`feedbackLogs` 不能在 `baseState` 上剥** —— `baseState` 在 `route.ts` 里会被**回写数据库**
   （`hasJsonChanged` → `update`），在它身上剥等于**真删用户数据**。只能在往 `Response.json` 塞的那一刻剥（已加注释）。
2. **下行投影必须配一个 PUT 侧恢复** —— `upsertWorkspaceMessages` 是 `messageJson: message` **整体覆盖**，
   前端把瘦身版存回来就等于删字段。这也是 `mergeWorkflowCanvasMedia` 早就在用的既有模式。
3. **投影只能"整体相等才省"，绝不能逐项省** —— `itemPrompts` 是**按下标**取的、`videoPrompts` 的回落目标又是
   `itemPrompts[i]`，逐项删会下标错位或回落到**另一条**提示词上，那才是真 bug。

#### 已排除的方向（别再花时间）

- **不是 app 慢**：容器内直打 `127.0.0.1:3000` 稳定 **39~44ms**（8 次）。
- **不是 nginx / TLS 本身慢**：宿主打 `:5000` **1.5~3.7ms**；本机走 443+TLS **20ms**。
- **不是阿里反代**：阿里 `proxy_read/send_timeout` 都是 600s。
- **不是 DB 连接池（M023）**：这条链路没有慢查询证据，纯粹是响应体大。
- ⚠️ **另一个独立现象，别混淆**：本地 `curl` 打 **401（无 body）也偶发 30s** ——
  那是**纯跨境网络抖动**（基线 0.43~0.55s，TLS 握手占 0.29s）。
  ⭐ 判据：**部署前的 v54 一样有**（5 次里一次 30.8s）→ 跟版本、跟这次优化都无关。


### [ ] M020 视频「高清」（真·超分/放大）—— 押后，**等有免费方案再做**（2026-07-27 用户交代）
- **押后原因**：现有所有可行方案都要花钱（第三方托管 API 按秒计费），用户说"如果没有免费版以后再做这个功能"。自建开源方案没 GPU（我们腾讯那台是共享 CPU 机器）。
- **调查结论（2026-07-27 用浏览器实读官网/文档，别再重复查）**：
  - **BytePlus 没有任何视频超分/放大/画质增强接口**。模型目录只有 Seed(LLM)/Seedream(图)/Seedance(视频生成)/Seed Speech/Omnihuman/DreamActor；ModelArk API 参考里也只有 chat/文件/视频生成任务/图片生成/向量化/缓存/Bot/Batch/Token 这些，**无独立 upscale 端点**。
  - ⭐ **Seedance 2.0 现已支持 `resolution: "4k"`**（仅 `seedance-2-0`，Fast/Mini 连 1080p 都不支持）。4K 尺寸：16:9 `3840×2160`、4:3 `3326×2494`、1:1 `2880×2880`、3:4 `2494×3326`、9:16 `2160×3840`、21:9 `4398×1886`。⚠️ **4K 是 10-bit H.265(HEVC)**，官方明示部分播放器/浏览器无法直接播放。**价格 $0.78/秒**（1080p $0.37、720p $0.15、480p $0.07）。**用户交代：4K 档先不接。**
  - 但"用 Seedance 重生成 4K"**不是超分**——内容会变，且贵约 10 倍，语义上不该叫"高清"。
  - **真·超分只能走第三方**（效果最好的是 Topaz Video AI，两家托管同一引擎 Proteus v4 + Apollo v8 插帧）：
    - `replicate.com/topazlabs/video-upscale`：参数 `target_resolution`(720p/1080p/4k) + `target_fps`(15–60)。价：→1080p/30fps **$0.093/5s**、→4K/30fps **$0.373/5s**，60fps 翻倍。信用点折算、**价格是估算区间**。可 pin 版本号（行为稳定）。
    - `fal.ai/models/fal-ai/topaz/upscale/video`：说明写**最高 8x、120fps**，另有 Gaia 2 半价档。价：≤720p **$0.01/s**、→1080p **$0.02/s**、>1080p **$0.08/s**，60fps 翻倍。**按秒线性计价 → 好精确预扣积分**。
    - 备选：`runwayml/upscale-v1`（4x 到 4K，限 ≤40s/≤16MB）、`bria/video-increase-resolution`（2x/4x 最高 8K、全授权数据、保留音轨、限 60s/条）、`philz1337x/crystal-video-upscaler`（人脸/产品向、不丢身份）。便宜老一代：Real-ESRGAN Video / AnimeSR / RealBasicVSR / STAR / VEnhancer（Replicate 都有，真人脸易糊或过锐）。
  - **开源最强 = `github.com/ByteDance-Seed/SeedVR`（SeedVR2，ICLR2026 / SeedVR CVPR2025 Highlight，Apache-2.0，3B/7B 权重在 HF，有社区 ComfyUI 插件）**，但官方 readme 写 **1×H100-80G 只够 720p，1080p/2K 要 4×H100-80G** → 我们无 GPU，自建不可行。
- **以后做的话（当时的技术选型倾向）**：优先 **fal 的 Topaz**（线性计价好对齐 `chargeCredits` 先估后核；能力上限更高），若更看重"线上行为永不变"则选 Replicate（可 pin 版本、略便宜 5–10%）。工程上要：新增第三方 env/密钥 + 预充值；输入用已有的公网 URL 路子（同喂 BytePlus 参考视频，走阿里静态镜像）；异步走 queue + 轮询/webhook，产物下载复用现成的 `saveRemoteAsset` + `media-save-queue`（跨境下载已有 3min 超时保护）；入库走 `media-asset-record.ts`；开关进后台「工作流 · 视频编辑功能」表；**语义要改成"提升清晰度/分辨率（内容不变）"**，不要沿用"重生成"。
- 相关：工作流视频节点快捷菜单（`workflow-tldraw-canvas-inner.tsx` 的 `createVideoEditNode` 旁边就是「高清」该放的位置）、`models.ts` 视频分辨率档、`system-settings.ts` 的 `VIDEO_EDIT_FUNCTION_KEYS`。

### [ ] M018 刚上传媒体不刷新自动切阿里镜像（用户说保持现状）
- 背景：视频/音频上传"方案 A"——同步阿里后台异步；本会话刚上传的 `/generated` 由 `src/lib/recent-upload-origin.ts` 记录、前端 `getStaticMediaUrl` 读腾讯主源。
- 现状问题：无轮询，阿里同步完后本会话这几个媒体不会自动切阿里镜像（除非刷新）。功能无碍（腾讯兜底能读），只是稍慢，用户决定保持。
- 以后做（二选一）：轻量=上传成功后起 10~20s 定时器把 url 从 recent 集合移除；精确=加"阿里同步状态"接口前端轮询到已同步再切。相关：`recent-upload-origin.ts`、`chat-workbench.tsx`(`getStaticMediaUrl`)、`api/upload-file/route.ts`。

### [ ] M019 工作流整张画布存单个 canvasJson 大字段——架构隐患，以后重构
- 押后原因：架构级重构、风险高、要大量回归测；当前功能可用。已顺手减轻（去掉画布内 `generationUploads` 冗余、改点"使用提示词"读后端 GenerationJob）。
- 隐患：① 整块读写，节点越多越慢/越占内存；② 整块覆盖=竞态/旧标签页覆盖风险（历史踩坑：靠服务端 `mergeWorkflowCanvasMedia` 打补丁）；③ 前端临时态靠 `getPersistableWorkflowItems`/`stripKeys` 手工剥离易漏。
- 重构方向：节点/连线拆行（`WorkflowNode`/`WorkflowEdge`），按需读写/局部 patch，成品媒体只存引用（指向 MediaAsset/GenerationJob）；迁移历史 canvasJson 需 dry-run+备份+前后快照。

### [ ] M001 Server-To-Provider Public Reference URLs
- 押后：域名可能再变，公网 URL base 要稳定后再改 provider 请求行为。
- 以后：把本地 `/generated/...` 参考媒体以公网 HTTPS URL 发 BytePlus/OpenRouter（而非转回 base64），先验证域名 provider 可达。相关 `openrouter.ts`/`openrouter-video.ts`/`seedance.ts` 的 `toDataUrlIfLocalPublicAsset()`。
- ⚠️⚠️ **2026-08-02 更新（做这条之前必读）**：`toDataUrlIfLocalPublicAsset()` 原本在
  `openrouter.ts` / `openrouter-video.ts` / `seedance.ts` **一字不差地存了三份**（连 `getMimeType` 都一样），
  而且三份**都带同一个路径穿越漏洞**（只判 `startsWith("/generated/")`，能读到 `.env.local`）。
  → 现在已收敛成**唯一一份**：`src/lib/generated-asset-path.ts` 的 `toDataUrlIfLocalPublicAsset()`。
  **做 M001 时只改那一个文件即可，⛔ 别再往三个地方各写一份。**


### [ ] M005 输入框 @mention 重构
- 押后：当前 @mention 行为可接受，重构风险 > 收益。逻辑已收敛 `src/lib/mention-text.ts`。
- 以后：若 @ 编辑 bug 复现，做聚焦的 contenteditable mention 重构（原子删除/光标/蓝色渲染）。

### [ ] M007 正式前端监控
- 押后：当前 `/api/client-error` + 浏览器全局捕获够用。以后进正式运营再上正式前端监控系统。

### [ ] M008 媒体存盘队列支持多实例
- 押后：当前 `.runtime/media-save-jobs.json` 单实例够用。多实例部署前移到 DB 表/队列服务。

### [ ] M009 BytePlus 审核 asset-url 流程完善
- 押后：现自动审核首版可用。以后存 provider 可达 HTTPS URL、持久化 approved `assetId`、以 `asset://assetId` 发视频生成。

### [x] M010 迁移/审计脚本清理 —— ✅ 2026-08-02 评估完毕：不搬，可关
- 结论：`tmp/` 27 个脚本全是 2026-06 那批**一次性事故排查脚本**（按具体用户 ID/事故命名），
  没有"稳定可复用工具"够格升进 `scripts/`（能复用的早已在 scripts/）。保持原样当历史档案，不再推进。

### [ ] M011 清理重复 `.env.local`
- 押后：正式服现在能用，改 env 有风险。以后在服务器上小心清理重复 `DATABASE_URL` 行（第一个是对的，psql 要去 `?schema=`），别暴露密钥。

### [ ] M012 声音克隆 / TTS
- 押后：当前视频参考音频不是可靠人声克隆方案，MVP 聚焦图/视频。以后评估 ElevenLabs/MiniMax Speech/火山语音/Fish Audio。

### [ ] M013 歌曲→MV 工作流
- 押后：非当前 MVP 优先。以后设计"歌曲生成/上传→Agent 拆 MV 分镜→视频模型生成→ffmpeg 合成"。

### [ ] M014 GPT 生图优化 Phase 2
- 押后：首版记录成功案例但未自动分析。以后加成功案例自动分析、滚动分析报告喂回改写、成功率/成本/延迟统计、考虑复制到对话流生图。详见归档 `08-gpt-image-prompt-optimization.md`。

### [ ] M015 阿里端上传压缩转发小服务
- 押后：用户认可思路但"以后再说"。目标让上传更快（压缩发生在跨境前）。阿里那台只有 nginx（纯反代不能调 sharp/ffmpeg），要压缩需跑一个应用进程。阿里机器 2 核/3.4G 几乎全闲、已装 ffmpeg，CPU 扛得住（视频限并发1+veryfast）。成本是部署维护一个阿里小服务。三方案：浏览器端压缩(图✅视频❌)/阿里小服务(图✅视频✅)/阿里跑整套 App。做时先定方案再设计。
- ⭐ **2026-07-29 更新**：v1.0.0.54 已在**腾讯服务端**做了"超 2MB 按 quality 90 原地压缩"（`local-assets.ts`，
  实测 -78.5%）。所以本条的价值只剩「**把压缩挪到跨境之前，省上传时间**」，
  "文件太大发给模型被拒"那个动机**已经不存在了**。以后要做时按这个新前提重新评估收益。
- ⭐⭐ **2026-08-02 更新（用实测数据重新评估，见 M034 那份数据，⛔ 别重新查）**：
  1. ✅ **覆盖面比想象的大**：图片上传 **89.7% 走 `ali.venusface.com`**（1703 / 1898），
     所以"在阿里压"能覆盖九成上传。
  2. ⛔ **但收益比想象的小**：慢的成因是**跨境丢包**（同样 2.40MB 可以是 3.5s 也可以是 145.1s，
     0.13MB 也能卡 12.1s），不是带宽。压缩只能把"坏运气窗口里要传的字节"变少，
     **治不了根**，而且 **93% 的上传本来就在 10 秒内完成、用户感知不到**。
  3. 🗣️ **用户 2026-08-02 问过一个关键问题**：「是不是阿里域名上传就在阿里压、腾讯域名就在腾讯压？」
     ⭐ **答案：前半句对，后半句不成立** —— 走 `main/api.venusface.com` 的用户，
     字节是**从他家直接跨境到腾讯新加坡**的，**中间没有我们的机器**，
     没有任何"境前"位置可以放压缩；在腾讯压是**过境之后**了，对上传速度**零帮助**
     （而"在腾讯压"这件事 v54 已经在做，目的是省磁盘 + 保证发给模型的图不超限，不是提速）。
     → 那 10% 的用户想快，**只能浏览器里压**（见下）或者动线路（方案 C）。
  4. ⛔⛔ **浏览器端压缩这条支路：不建议做，而且它是删掉过的东西**（2026-08-02 逐条评估）：
     - **历史**：2026-06-20 对话流上传本来就是"前端 canvas 转 JPG（q0.95、不缩尺寸、透明铺白底）"；
       2026-06-21 加了"转换失败或超时 5 秒 → 传原文件"的兜底；
       **2026-06-22 被删掉**（原因：前端预转过一遍，服务端的"快写路径"探测不到原始格式、根本没生效）。
       残留函数 `convertImageFileToJpeg` / `canvasToJpegBlob` / `withImageConversionTimeout`
       **已在 v66 当死代码删除**（要做就是把它捡回来）。
     - 🔴 **透明通道会被永久毁掉**：项目**明确支持透明图**（工作流「去背景」+ `transparentImage` 字段
       + `useImageHasAlpha` 决定卡片底色）。用户抠完图存 PNG 再上传 → 铺白底 = 抠图白干。
       → 必须先检测 alpha，有透明一律不压。
     - 🔴 **iOS Safari canvas 有总像素上限（约 1670 万）**，超限**不报错、`toBlob` 给一张空白图**
       → **静默上传一张白图并进资产库、还发给模型**。这是最恶劣的失败模式，必须校验输出后回退原文件。
     - 🟠 **EXIF 方向**：浏览器 `drawImage` 是否应用 Orientation 各版本不一致 → 照片可能倒置。
       服务端是用 sharp `.rotate()` 把方向烧进像素解决的，浏览器没有同等保障
       （要 `createImageBitmap(file,{imageOrientation:'from-image'})` + 老浏览器回退）。
     - 🟠 **和内容哈希去重/秒回冲突**：不同浏览器/版本压出的字节不同 →
       同一张图在手机和电脑上算出两个哈希 → 去重失效、重复落库。
     - 🟡 二次有损（浏览器压 + 服务端超 2MB 再压）；且历史那版**限制最长边 2048 = 缩尺寸**，
       **违反你定过的「图片过大不要动、只降质量、质量保 90%」**。
     - 🟡 低端机内存（4000×3000 的 canvas ≈ 48MB，一次拖 6 张就 300MB）；压缩要 1~3 秒，
       期间进度条是 0，得先给「正在准备图片…」的反馈（否则又是"点了没反应"）。
     - 🟢 动态 webp 会被压成单帧（白名单里有 webp）；
       🟢 **客户端压缩绝不能当防线** —— 服务端后缀白名单/体积上限/MIME 校验一条都不能省。
  5. ⭐ **上面 5 个"浏览器专属"的坑（透明/Safari 上限/EXIF/内存/哈希不确定）在阿里端压全都不存在**
     （sharp 处理，行为和现有服务端一致），而且**视频也能受益**。
     所以真要做压缩，**做阿里端这条、别做浏览器那条**。
- 📌 **和 M033 / M034 的关系**：三条是同一个调查的产物。**优先级建议 M033 > M034 > M015 > 方案 C（线路，要花钱）**。
- ⭐⭐ **2026-08-04 重要更新（M015 的前提变了，重新评估前必读）**：
  「方案 C = 线路要花钱」这个判断**只对一半**。当天查「视频同步失败」时发现，
  **跨境慢的真凶是丢包（20~25%）而不是带宽**，而**多流并发是免费解药**：
  单流 15~30 KB/s → **16 并发 461 KB/s**（真实文件实测 571~606 KB/s，**约 38 倍**）。
  → 已在 `deploy/ali-parallel-pull.sh` + `ali-sync.ts` 落地（详见 `AGENTS.md` 同名铁律）。
  ⭐ **所以 M015（阿里端压缩）的收益进一步下降**：传输瓶颈已经用并发解决了，
  压缩剩下的价值只有「省存储」和「省阿里端出流量」，**不再是"为了传得动"**。
  🗳️ **要不要做，等用户看传输日志的实际数据后再定**（`transfer-diagnostics-log.jsonl` 已在记速度）。
  ⛔ 若真要做，仍然只做阿里端、别做浏览器端（上面 9 条理由不变）。

### [x] M033 ⭐ 图片上传补「秒回预检」—— ✅ **2026-08-03 第三十七次会话已完成并部署测试服 v69**

> ✅ **已完成**：`asset-upload-temp` 加 GET 预检 handler（复用既有 `findDedupImage`，带 `mediaType:"image"`）
> + CORS `Access-Control-Allow-Methods` 加 `GET`；客户端三处图片上传（对话流 `uploadTemporaryAssetImageOnce`、
> 工作流 `uploadWorkflowImageOnce`）在上传前 `computeFileContentHashHex` + `precheckUploadedFileDedup`，
> 门控 `dedup && !forceReencode`（与服务端 POST 的 dedup 判重口径一致）。
> **测试服 HTTPS 实测**：第三次上传同一文件 → 预检 GET 返回 `{url,name}` 命中 → **零 chunk 请求、整包传输全免**。
> ⚠️ **HTTP 入口（8080）不是安全上下文 → `crypto.subtle` 不可用 → 预检自动跳过**（与既有文档预检同一限制，非 bug）。

> 🗣️ **2026-08-02 用户拍板：本条 + M034 + M015 都记进备忘，下个 AI 再做。**
> ⭐ **这三条是同一个调查的产物，动手前先看下面 M034 里那份「上传耗时实测数据」**，别重新查一遍。

- **问题**：2026-07-22 加的「秒回」（客户端先算 SHA-256 → `GET /api/upload-file?contentHash=` 预检 →
  命中就免整包重传）**只接在 `/api/upload-file`（视频/音频/文档）上**。
  ⛔ **图片走的是另一条路 `/api/asset-upload-temp`，压根没有这个预检** ——
  典型的"该统一却分叉"（`precheckUploadedFileDedup` 全项目只有 2 个调用点，都在 `uploadWorkflowFile` /
  对话流的非图片分支）。
- **代价（正式服实测证据）**：`保守秘密1a.png`（3.9MB）用户传第二次，日志里
  `asset-upload-temp-post-dedup-hit` **命中了去重，但仍然花了 8020ms** ——
  因为**去重判断在服务端，必须先把整个 3.9MB body 收完才能算哈希**。
  跨境慢的时候这就是 8~205 秒的纯浪费。
- **怎么做**：给 `asset-upload-temp` 加 GET 预检 handler（照抄 `upload-file` 那份）+ CORS 放行 GET；
  客户端三处图片上传（对话流 / 工作流 / 资产库）在上传前先 `computeFileContentHashHex` + 预检。
- ⚠️ **必须先定哈希口径**（见 M034 的警告）：预检用的是**原始文件**哈希，
  而服务端 `contentHash` 存的是**收到的字节**的哈希。今天两者相同所以没事；
  **一旦以后做了压缩（M015）或分片（M034），必须让原始哈希单独带过去**，否则预检永远命中不了、去重整套失效。
- **风险**：极小（纯新增一条快路径，命中不了就走原流程）。**收益**：命中即 100% 省掉整包传输。
- ⭐ 我（第三十三次会话）**建议先做这条**，零风险、当天能完。

### [x] M034 ⭐⭐ 上传分片 + 单片重传 —— ✅ **2026-08-03 第三十七次会话已完成并部署测试服 v69**

> ✅ **已完成**。实现：
> - 服务端新增 `src/app/api/upload-chunk/route.ts`：POST 传单片（`?uploadId&index&total`，body=原始字节）→
>   落 `.runtime/upload-chunks/<userId>/<uploadId>/<index>.part`；POST `?assemble=1`（JSON）→ 收齐拼接、
>   **校验整体哈希**、重建成等价 multipart 请求 **直接调既有 `upload-file`/`asset-upload-temp` 的 POST**
>   （零逻辑复制：校验/去重/落库/命名/阿里同步全复用；跨路由 import handler 在 `next build` 已验证可编译）。
> - 服务端 `src/lib/upload-chunks.ts`：分片存取 + `clearUploadChunks`（处理完必清）+ `sweepStaleUploadChunks`
>   （每次操作机会性清 6 小时以上的孤儿目录，避免"只增不减"）+ uploadId `[A-Za-z0-9_-]` 白名单防路径穿越
>   + 单片 4MB / 单上传 250 片上限。
> - 客户端统一入口 `src/lib/chunked-upload.ts`：`shouldChunkUpload`（>1MB 才分片）+ `uploadFileInChunks`
>   （1MB/片、每片独立 XHR、**失败自动重试 3 次只重传该片**、真实字节进度 2~96、assemble 带 `originalContentHash`）。
>   对话流 `uploadDocumentFileAsset`/`uploadTemporaryAssetImageOnce`、工作流 `uploadWorkflowFile`/`uploadWorkflowImageOnce`
>   四处大文件都走它，小文件保持原单发路径。
> - `src/proxy.ts` matcher 排除名单加了 `upload-chunk`（否则被 Next body 缓冲截断）。
> - **哈希口径**：分片不改字节，assemble 用拼接结果哈希和客户端原始文件哈希比对；对话流图片 forceReencode 重试路径不带原始哈希。
> **测试服 HTTPS 实测**（7.5MB 噪声图 → 8 片）：GET 预检 miss → 8 片全 200 → `assemble=1` 200（哈希校验通过）→
> PATCH 转正 200；`upload-chunk-assemble-success`（8 片 / 7,541,512 字节）；**分片临时目录处理后 0 残留（清理生效）**。

#### ⭐⭐ 2026-08-02 正式服实测数据（下个 AI 直接用，别重新查）

用户问「工作流上传图片卡在 91% 是在干什么」，查 `/opt/flashmuse/data/runtime/upload-diagnostics-log.jsonl` 得出：

1. **91% 本身不代表任何真实进度** —— `upload-progress.ts` 的设计：真字节进度只映射到 `0~cap`
   （`cap` 每次随机 60~70），**cap 之后是定时器自己衰减慢爬到 99 的假动画**，收到响应才跳 100。
   （而且 `UploadingNodeOverlay` 把数字 clamp 在 1~99，所以永远看不到 100。）
   所以"卡在 91%"= **字节已全部离开浏览器，正在等 `POST /api/asset-upload-temp` 的响应**。
2. **服务端处理快得可以忽略**：sharp 转码 `93~109ms`、写临时文件合计 `111ms`、
   POST 总耗时 ≈ body 收完 + `~130ms`、PATCH（提交 + 触发阿里同步）`7~15ms`。
   **服务端占总耗时不到 1%。**
3. **慢的 100% 是 body 传输那段（跨境）**。最近 200 次图片上传：
   平均吞吐 **460 KB/s**，**超 10 秒的只有 14 条 = 7%**，超 30 秒 6 条 = 3%。
   即 **93% 的上传其实是快的**，但那 7% 很惨：`2.45MB / 205.5s（12KB/s）`、`2.40MB / 145.1s`、`2.45MB / 99.4s`。
4. ⭐⭐ **病因是丢包/线路抖动，不是"体积 ÷ 带宽"**，判据（这条最重要）：
   - **同样 2.40MB**，有时 `3.5s（694KB/s）`，有时 `145.1s（17KB/s）` —— **差 40 倍**；
   - **`0.13MB` 的小文件也能卡 `12.1s`（11KB/s）** ← 体积说无法解释这条。
5. **origin 分布**：图片上传 `ali.venusface.com` **1703 次（89.7%）** vs `main.venusface.com` 195 次（10.3%）；
   最近 500 次是 458 : 42（**91.6% 走阿里**）。

#### 由这些数据得出的结论（⛔ 别再走弯路）

- ⛔ **"压缩能按比例省时间"这个推论对这批数据是错的** —— 它只在带宽受限时成立，在丢包受限时不成立。
  把 2.4MB 压到 1MB，坏运气下还是会从 145s 变成 ~60s，仍然很惨；而那 93% 本来就快的上传**用户毫无感知**。
  （我一开始就是这么估的，被数据打回来了，记在这里免得下一个人重犯。）
- ⭐ **分片 + 单片重传才是对症药**：丢包时只重传卡住的那一片，不用整包重来，
  也不会"一卡就 205 秒"。同时天然带来断点续传（大视频受益更大）。
- **怎么做（大致）**：客户端按固定大小切片 + 每片独立请求 + 服务端按 `uploadId` 落临时片再拼接 +
  失败只重发该片 + 并发度限制。⚠️ 要考虑：临时片的清理（别又造一个"只增不减"的目录）、
  拼接完的整体哈希校验、`src/proxy.ts` matcher 排除名单要加上新路由（否则被 Next 的 body 缓冲截断）。
- ⚠️ **哈希口径**：拼接后才能算整体哈希 → 客户端必须把**原始文件哈希**随第一片带上来，
  服务端存它（否则 M033 的预检和现有去重全部失效）。

### [x] M023 给 `DATABASE_URL` 显式配 `connection_limit` —— ✅ **2026-08-02 用户拍板"一起修"，已落地**

> ✅ **已完成（第二十八次会话）**：两份 compose 的 `DATABASE_URL` 都加了
> `connection_limit=25&pool_timeout=20`（25 = 多项目共用机器的保守值），`.env.example` 同步。
> 测试服 v63 已带此配置运行。同时本批修掉了两个加压来源（1.2 持锁全表扫、1.4 保存读全量）。

> ⚠️⚠️ **2026-08-02 更新：全项目审计独立又撞上了这条，而且发现了两个「当年不知道」的加压来源
> → 建议把它重新拿给用户拍板一次**（⛔ 但在他重新拍板前，仍按 2026-07-30 的决定不动）：
>
> 1. **`generation-jobs.ts:99-144`（`reserveJobNames`）**：**每次生成**都在
>    「持着 `pg_advisory_xact_lock` 的事务里」把该用户**历史上全部 MediaAsset** 捞出来
>    （只为给新文件起名字）→ 长时间占用连接 + 串行化该用户的生成。
>    ⭐ 而 `WorkspaceWorkflow.nextImageNumber`/`nextVideoNumber` 两列**早就存在**就是为了免掉这个扫表。
> 2. **`workspace-workflows.ts:301`**：保存工作流时用 `Promise.all` 发**每个工作流一条 upsert**
>    → 一千个工作流 = 一千条并发查询，**直接打穿 17 连接的池子**。
>
> → 也就是说 A4 那个"连接池打满"很可能**不是随机的**，而是这两处在特定数据量下必然触发。
> 细节见 `08-full-audit-2026-08-02.md` 的 1.2 / 1.4 / 1.6。

- **来历**：A4「数据库连接池被打满」的**真修复**（第十六次会话查清）。当前靠 v54 加的明确错误文案兜着 ——
  即 `src/lib/error-message.ts:244` 那句 **「服务端数据库繁忙（连接池已满），请稍后重试。」**
  （命中 `unable to start a transaction` / `transaction api error` / `transaction already closed`；
  典型原文 `Transaction API error: Unable to start a transaction in the given time.`）。
  **用户能看懂了，但根因没动。这句红字现在的作用 = 哨兵。**

- ⛔⛔ **押后的真正理由（2026-07-30 想清楚的，别再拿"25~30"闭眼去改）**：
  **正确数值取决于病因是 A 还是 B，而这两者方向完全相反：**
  | 病因 | 含义 | 解法 |
  |---|---|---|
  | **A. 池子太小** | 并发请求多，17 条不够，排队 10s（`pool_timeout`）超时 | 调**大** `connection_limit` |
  | **B. 连接被占住不还** | 有慢查询/长事务霸占连接（`idle in transaction`），池子多大都会被吃干 | **调大没用**，得去找那个慢的 |
  原备忘写的"加到 25~30"是**按 A 猜的**；若真因是 B，调大只是把爆炸推迟几分钟，还更接近把 postgres 的 100 打满。

- ⚠️⚠️ **原备忘写错了改的地方**（2026-07-30 核实）：写的是改 `/opt/flashmuse/data/.env.local` 的 `DATABASE_URL`，
  但 **`DATABASE_URL` 在 `docker-compose.yml` 的 `environment:` 里也定义了**（正式服第 24 行 / 测试服 `deploy/staging/docker-compose.yml` 第 26 行），
  **真实环境变量优先级高于 `.env.local`** → **只改 `.env.local` 大概率无效、白折腾。要改必须改 compose。**
  ⭐ 好处：两个 compose 都在 git 里 → 这件事其实**能走正常的"改代码 → 测试服 → 正式服"部署流程**，不是纯手工运维。

- **两台的现状（2026-07-30 核实，隔离但配置"碰巧一致"）**：
  正式服 `flashmuse-db` / 测试服 `staging-db` 是**两个独立 postgres 容器**（独立 pgdata、独立密码、独立 docker 网络），
  但**跑在同一台腾讯机器上**。两边都没写 `command:` 覆盖 `max_connections` → 都吃默认 **100**；
  两边 `DATABASE_URL` 都没写 `connection_limit` → 都吃 Prisma 默认（按宿主机核数 `cpu*2+1`，8 核 = **17**、`pool_timeout=10s`）。
  ⭐ **注意这个"一致"是靠"两边都没配"碰巧撞上的，不是被设定的** —— M023 做完才会变成有保证的一致。
  ⭐ 连接数**按进程算不按机器算**，真实占用 = 进程数 × `connection_limit`；以后上多实例要重算。

- ⛔ **为什么"在测试服测出并发数再同步正式服"不成立**（2026-07-30 用户问过，结论要记住）：
  ① 测试服**没有真实负载**（只有我们俩在点），空载环境永远测不出"多少才够"；
  ② 两个库**共享同一台物理机的 CPU/内存**，在测试服猛压会**拖慢正式服**，等于拿正式服用户陪葬；
  ③ 若真因是 B，测试服上**没有那个慢查询**，压出来的数会**骗你**说 17 够用。
  ⭐ **测试服的正确作用 = 验证"改动本身安全、配置生效、站点没崩"，不是求那个数值。数值只能从正式服真实现场取。**

- **以后真动手的顺序（等下次犯病时趁热做，⭐ 前 3 步必须在"正在发生"时做，事后查不到）**：
  1. `psql -c 'show max_connections'` —— 看数据库那头的天花板（预期 100）；
  2. ⭐ 查 `pg_stat_activity` 里 `state='idle in transaction'` 的连接数 —— **这一步就是分辨 A 还是 B 的关键**，堆了一片就是 B；
  3. 按 `now() - xact_start` 排序找长事务 —— 有就是 B，去修那个查询，**别调池子**；
  4. 确认是 A 之后，才改 **两个 compose 的 `DATABASE_URL`** 追加 `?connection_limit=<按实测定>&pool_timeout=20`
     （⚠️ 注意保留原有的 `?schema=public`，要拼成 `&`）；
  5. 走正常部署流程：测试服 → 实机巡检 6 项 → 正式服 → 观察一周。
- **状态**：最后一次发生 **2026-07-17**，之后零复发。**不主动做。**

### [ ] M003 正式服工作流模式
- 注：工作流模式当前已在正式服开启（历史 feature-gate 已放开）。此条保留仅作历史参照，无待办。
