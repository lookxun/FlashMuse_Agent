# Current Status

> 本批交接文档 2026-07-21 重建。更早的详细流水在 `historical-handover-docs-last-used-2026-07-21/`（尤其 `CHANGELOG.md` 580KB、`01-current-status.md`、`05-next-actions.md`）。遇到需要历史上下文的难题再翻归档。

## 当前状态（2026-07-29 第十四次会话更新：✅ 四方同步 v1.0.0.53，已部署两服）

### ✅ 版本与部署状态（接手第一眼看这里）

| 位置 | 版本 | 说明 |
|---|---|---|
| 本地 | `v1.0.0.53` | 工作树干净、已 push |
| 测试服 | `v1.0.0.53` | 已部署 + 实机验收全过 |
| 正式服 | `v1.0.0.53` | 已部署，四域名全 200，备份 `/opt/flashmuse/app-backups/20260729-123320-presync-v53` |
| GitHub | `v1.0.0.53` | commit `ab6e223` |

**无 Prisma 迁移**（两服 `No pending migrations to apply.`）。**无待部署、无未推。**

### 第十四次会话做的（2026-07-29）：撤掉对话流/资产库的 AI 改写 + 红字统一

起因：用户报「d37 这个对话用了 AI 改写，出了非常多的问题」。查正式服实测出**极严重的丢图 + 白烧钱**：

⭐ **11 分钟内：发起 23 次生图、成功 17 张（资产库里 `image_19_d37`~`image_36_d37` 全在）、对话里只剩 2 张、扣 197 积分。**

**两条根因**（细节与其余 6 个问题见 CHANGELOG 顶条）：

1. ⭐⭐ `message.requestId` 是**单值**，而改写的并发锁按**槽位**（`${message.id}:${failedIndex}`）→ 同一条消息多条改写链互抢 requestId → 先完成的成功图 append 匹配不上、**被静默丢弃**。
2. ⭐⭐ 成功判定读 `sessionsRef.current`，而它在 **useEffect 里赋值** → `await` 回来是旧值 → **成功被判成失败、继续下一轮改写白烧积分**。

**用户拍板：不修，直接撤。** 对话流 + 资产库的 AI 改写整体删掉、恢复只有「重新生成」；**工作流那套一行未动**（只有两个 gpt 图片模型因提示词被拒时触发）。

红字按用户要求**三类合并成唯一一句**：
`模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“xxxxx…”`
删掉「模型拒绝了本次生成请求…平台安全策略」和「生成结果可能涉及版权限制…」两句。
⭐ **`MODEL_REFUSED_PREFIX` 一字未改** → 工作流按钮判定 + 后台 `FAILURE_REASON_SQL` 归一化都不受影响。

⭐ **白捡**：历史数据里残留的 `gptImageOptimizationRetryingIndexes`（那两个永久转圈的失败卡）**不再被读 → 自动自愈**，不用洗 DB。

### ⭐⭐ 用户明确交代（产品决策，别自己改回去）

> **对话流的设计不适合 AI 改写** —— 它是"一条提示词出多图"，每张独立改提示词，上面显示的提示词就不对了。
> **这也是一个问题，以后想好再做。**

即：**要重做对话流的 AI 改写，必须先解决"一条提示词多图"的展示模型问题**，别直接把删掉的代码捡回来。

### ⛔ 第十四次会话必须传下去的操作记忆

1. ⭐ **查线上 DB 不用落文件**：node 脚本 base64 后 `sudo docker exec <容器> sh -c 'echo <b64> | base64 -d | node'` —— 绕开 PowerShell 吃 `$`/中文/引号的全部坑。
2. ⛔ **列名坑**：`GenerationEvent` 没有 `surface`；`MediaAsset` 没有 `name`（是 `displayName`/`systemName`）；积分表叫 **`CreditLedger`**、字段是 `credits`（不是 `amount`）。先查 `information_schema.columns`。
3. ⭐ **对话编号 `d37` 的来源**：前端自增的 `d{n}`，存在 `WorkspaceSession.summaryJson->>'conversationCode'`，**不是 id 截取**（工作流是 `w{n}`）。
4. ⛔ **PowerShell 没有 heredoc** → git commit 信息写成文件再 `git commit -F <file>`。
5. ⚠️ `npx eslint` 本项目本来就有 22 个 error（`react-hooks/immutability` 等历史遗留），**不是新引入的**。
6. ⭐ **老数据的红字不会随代码改动而变**（红字是持久化字符串）。验证文案必须看**新发起**的那一次。

### ⭐⭐ 给下一个 AI：接手要做的事（按优先级）

1. ⭐ **继续排查剩余红字**：`/admin?tab=failures`。⚠️ 去后台看实时数字（上批快照是 199 条）。审核类按铁律不归档；可查的：`empty image result` / `InvalidParameter.UnsupportedImageFormat` / `API Key 无效`（查哪个渠道）/ DB 事务超时。
2. ⭐ **可以考虑归档**：`B_622~657` 那批「模型拒绝」的**旧四分叉文案**（v53 起已统一）。⚠️ 按铁律，**统一后的新文案不归档**（修不了、就该一直亮着），要归档就必须给规则配 `before = v53 上线时刻`。
3. **Gemini 4K** 仍没单独实跑；**工作流侧 Kling 参考图拦截**仍没人工点过。
4. 方法论全在 **`07-red-error-triage-and-archive.md`（必读）**。

### 次要待办（沿用）

- ⚠️ 小问题（未修）：被发送前拦截后再点一次发送 → `POST /api/asset-upload-temp 500`（临时上传凭证被第一次尝试消耗），见 `05-next-actions.md`。
- ⭐ **待观察**：本地 `.next` 反复损坏是否已断根，见 `05-next-actions.md`「待观察」。
- ⭐ 用户习惯：**叫你测试才测试**；**动代码前先评估对其它功能的影响并先报影响范围**；**默认只改本地不部署**。

## 此前状态（2026-07-29 第十三次会话：✅ 四方同步 v1.0.0.52，已部署两服）

### ✅ 版本与部署状态（接手第一眼看这里）

| 位置 | 版本 | 说明 |
|---|---|---|
| 本地 | `v1.0.0.52` | 工作树干净、已 push |
| 测试服 | `v1.0.0.52` | 已部署 + 实机验收全过 |
| 正式服 | `v1.0.0.52` | 已部署，四域名全 200，备份 `/opt/flashmuse/app-backups/20260728-214222-presync-v52` |
| GitHub | `v1.0.0.52` | 已推 |

**无 Prisma 迁移**（两服 `No pending migrations to apply.`）。**无待部署、无未推。**

### 第十三次会话做的（2026-07-29）

1. ⭐ **归档了「图片平台没有返回图片」这一桶：正式服 120 条（319 → 199 待排查）**、测试服 3 条。
   ⚠️ **实际是 120 条不是文档里记的 101 条** —— 07-29 后同类又新长了约 19 条。**跑归档前必须重新 dry-run 看真实数字。**
2. ⛔⭐ **顺手堵掉一个会污染生产数据的归档 bug**：旧规则 `provider-insufficient-credits` 又命中 11 条**上次归档之后新发生**的事件。
   按铁律 ④ 这 11 条（已是明确文案「提供商余额不足！请联系管理员充值。」）**必须继续亮着**。
   → 归档脚本新增可选 **`before` 日期下限** + `ruleAllowsEvents()`，该规则设 `before = 2026-07-27T18:19:00Z`（v47 上正式服时刻）。
   ⭐ **凡是 note 里写「以后新发生的不再归档」的规则，都必须配 `before`**，否则它会一直吃新数据。
3. ⭐ **工作流「高清」改成四选项下拉**：GPT 2K / GPT 4K / Gemini 2K / Gemini 4K
   （GPT = **直连版** `openai/gpt-5.4-image-2`，Gemini = `google/gemini-3.1-flash-image-preview`）。
   **提示词与功能一字未改**；比例仍贴源图；**用户选了模型就不再自动换模型**（原来是三级候选链）。
   后台开关按模型：关一个 → 它的 2K/4K 一起隐藏；两个都关 → 高清按钮整个消失。
4. ⭐ **把「高清」和「橡皮」共用的那条候选链拆开了**（以前 `EDIT_FUNCTION_KEYS = ["hd","eraser"]` 共用一条链，
   改高清会连带改橡皮）→ 新增 `HD_FUNCTION_MODEL_CHAIN` / `HD_FUNCTION_KEYS`，**橡皮的三级链行为一字未变**。
5. ⭐ **白捡：v51 遗留"没测到"的两项补上一项** —— 直连版安全拒绝红字 + 三颗 AI 改写按钮**完整跑通**，
   文案与预测逐字一致（附「sexu…」）。⭐ **技巧：触发直连版拒绝不用改提示词硬碰，拿一张擦边源图走高清（img2img）一次就中。**

### ⛔⛔ 第十三次会话必须传下去的硬记忆

1. ⭐⭐ **往 `WorkflowSelectedNodeOverlay` 里加 Hook 会把整个 tldraw 画布搞崩**：该组件在 `:2493` 有
   `if (!selected) return null;`，我把一个 `useMemo` 加在它**之后** → **React #310（Rendered more hooks than during the previous render）**
   → 点任意节点画布整个变成「Something went wrong / Please refresh your browser」。
   **修法：加在提前 return 之前，或干脆别用 Hook。** 本次改成直接计算（只有 4 个元素）。
2. ⭐ **新增高清模型要同步改三处配置表**：`system-settings.ts` 的 `HD_FUNCTION_MODEL_CHAIN`、
   `workflow-tldraw-canvas-inner.tsx` 的 `HD_MODEL_OPTIONS`、`admin-system-settings-panel.tsx` 的 `HD_MODEL_CHAIN`。
3. ⚠️ **模型开关改完要刷新前台页面才生效**（`editModelToggles` 随 `/api/model-availability` 在页面加载时取一次），
   与其它模型开关一致，**不是 bug**（我一度以为高清没了，其实是那个标签页是开关关闭时加载的）。

### ⭐⭐ 给下一个 AI：接手要做的事（按优先级）

1. ⭐ **继续排查剩余红字**：正式服现在 **199 条待排查**，用 `/admin?tab=failures` 开始。
   其中审核类按铁律不归档，真正可查的：`empty image result` 7 条 / `InvalidParameter.UnsupportedImageFormat` 4 条 /
   `API Key 无效` 4 条（查是哪个渠道）/ DB 事务超时 2 条 —— ⚠️ 这些条数也是快照，**去后台看实时数字**。
2. **补测**仍未实机测到的：**资产库「拒绝类」失败卡的三颗 AI 改写按钮**（唯一剩下的一项）。
   ⭐ 用本次学到的技巧：拿擦边**源图**走 img2img，比改提示词靠谱得多。
3. **Gemini 4K** 没单独实跑（与 Gemini 2K 同一条路径、只差 `resolution` 字符串），有机会点一下。
4. ⚠️ **仍没人工点过**：工作流侧 Kling 参考图拦截（tldraw 连线不好自动化）。
5. 方法论全在 **`07-red-error-triage-and-archive.md`（必读）**。

### ⭐ 测试服上留下的东西（用户交代"测试内容不要删"，已保留）

- `工作流_01` 里多了 3 个本次测试的节点：Gemini 2K 成功图、GPT 2K 成功图（悟空）、
  **GPT 4K 的失败卡**（模型安全拒绝 + 三颗 AI 改写按钮）。
  ⭐ **那张失败卡是"拒绝类失败卡"的活样本**，以后验这类 UI 直接拿它看，别删。
- 测试服后台的高清 GPT / Gemini 开关**已恢复成 ON 并验证持久化**（我测隐藏时关过）。
- ✅ **测试服后台能用 `lookxun@163.com` / `dragonstar` 登录**（`/admin` 邮箱+密码）。
  ⚠️ `01`/`03` 里说的"该账号没有可用密码"指**本地库**，测试服上是能登的。
- ⚠️ **`createImageEditNode` 的 `highDef` 入参现在是死代码**（只在候选链分支里被读，而唯一还用候选链的橡皮从不传它）。
  **故意留着没删** —— 那是共享函数的通用入参，删它要动签名、收益为零。

### 次要待办（沿用）

- ⚠️ 小问题（未修）：被发送前拦截后再点一次发送 → `POST /api/asset-upload-temp 500`（临时上传凭证被第一次尝试消耗），见 `05-next-actions.md`。
- ⭐ **待观察**：本地 `.next` 反复损坏是否已断根，见 `05-next-actions.md`「待观察」。
- ⭐ 用户习惯：**叫你测试才测试**；**动代码前先评估对其它功能的影响并先报影响范围**；**默认只改本地不部署**。

## 此前状态（2026-07-29 第十二次会话：测试服 v1.0.0.51 / 正式服 v1.0.0.50）

### ⚠️ 版本与部署状态（⚠️ 已过时，本批已随 v52 全部部署完成）

| 位置 | 版本 | 说明 |
|---|---|---|
| 本地 | `v1.0.0.51` | **有未 commit 改动**（10 个文件），`npx tsc --noEmit` 全绿，无 Prisma 迁移 |
| 测试服 | `v1.0.0.51` | 已部署验证过。⚠️ **但"限流文案"那一行是部署之后才改的，还没上测试服** |
| 正式服 | `v1.0.0.50` | **一行没动**（用户没说部署正式服） |
| GitHub | `v1.0.0.50` | 本次改动未 push |

→ 也就是说：**本地比测试服多一行文案改动，测试服比正式服多这一整批。** 要上正式服必须按铁律：先把这行文案补上测试服（跑 `bump-version.mjs` → v52）→ 验 → 再原样同步正式服（不再 bump）。

### 第十二次会话做的（2026-07-29）：红字排查主线 + 模型拒绝文案彻底重做

**主线目标 = 后台「图片平台没有返回图片（模型未产出或拒绝生成）」101 条。全部查清。**

1. **101 条的真实构成**：92 条 = **模型明文拒绝**（我们把模型那段 500 字小作文当报错原样贴给用户）；7 条 = **模型把提示词原样复读回来**（红字变成用户自己的提示词）；2 条 = **`error code: 520` / `Provider returned an empty response` 被伪装成"没有返回图片"**。全部来自 `openrouter.ts` 老 `/chat/completions` 的同一个打点，没有代码分叉。
2. ⛔⛔ **后台"集中在一个入口 = 该统一却分叉了"这次是假信号**：显示「工作流 88 / 对话流 11」，实查 **101 条里 76 条是同一个用户 ID_868181** 三天内刷出来的（07-23 一天 41 条），17 条来自 ID_686996。**以后看到入口集中，先去「失败最多的用户」卡对一下是不是一个人刷的。**
3. ⭐⭐ **两个 gpt image2 是两条完全不同的接口**（用户当场质疑我没分清，核实后用户对）：
   - **GPT版 `-agent`** = 老 `/chat/completions` → 中间那层语言模型把拒绝**翻成中文人话**（小作文，⭐ 信息量最大、常直接给出可用改法）。**它至今没变，随时会再犯。**
   - **直连版 `gpt-5.4-image-2`** = 新 `/api/v1/images`（07-19 迁的）→ OpenAI 直接 400 `rejected by the safety system`，**有时**附 `safety_violations=[sexu…]`、有时连这个都没有。
   - 61 条挂在直连版名下的小作文**全在 07-17 及之前**（迁走前它也走老接口）。
4. **用户线上那两批错误码已核实**：`B_622~625` = GPT版小作文（v50 把原文整段扔了）；`B_626~629` = 直连版 400 且**这次 OpenAI 没给 safety_violations** → 落到"可能是提示词内容不符合平台安全策略"（所以用户说"也没有【sexu…】"）。
5. **用户拍板的最终产品要求 → 已全部实现**：两种接口都**尽量显示上游原文**；小作文和【sexu…】**都启动 AI 改写**；红字与 AI 改写**成套出现**；**资产库也覆盖**；对话流+资产库**有 AI 改写就不显示「重新生成」**；三颗按钮**上下居中 + 14px**；兜底统一用「模型拒绝了本次生成请求，可能是提示词内容不符合平台安全策略！…」；**工作流不改，保持现状**。
6. ⭐ 新增唯一权威 **`models.ts` 的 `modelSupportsPromptSafetyRewrite()`** —— 红字文案与按钮显示**共用同一个模型判定**，从此"红字承诺可AI改写"与"按钮真的出现"永远一致（以前 `toUserErrorMessage` 不知道模型，视频碰到拒绝语也会被写上"可点AI改写"，而视频没这个按钮）。
7. ⭐ 顺带查清并按用户要求改掉**「图片服务当前繁忙（限流）」** → **「当前模型繁忙或被限流，请稍候再重试！」**。真实原文 `OpenAI was rate limited by Cloudflare (error code: 1015)`：**限速发生在 OpenRouter→OpenAI 那一跳**，跟我们配额、用户点太快都无关。我们已自动重试 4 次约 70 秒才放弃（行为正确）。**用户明确只改文案，不动退避、不做限流降级。**
8. **第十次会话留的「新接口 upstream.body 待跟踪」口子可以撤了**：正式服日志里带 body 的一条都没有，因为直连版的拒绝走 400 分支、根本不会走到"200 但没图"。

改了 9 个文件（`models.ts` / `error-message.ts` / `error-code.ts` / `api/image/route.ts` / `generation-jobs.ts` / `gpt-image-safety-retry.ts` / `openrouter.ts` / `chat-workbench.tsx` / `admin-failure-triage.ts`）+ `app-version.ts`。**全部只动失败分支，成功路径零改动。** 细节见 CHANGELOG 顶条。

### ⛔⛔ 第十二次会话必须传下去的 5 条硬记忆

1. ⭐⭐ **对话流失败卡是懒挂载的（`<LazyMediaMount height={250}>`，`chat-workbench.tsx:16531`）**：没滚进视口就只是 250px 占位、DOM 里没有卡；而红字**不在**这个组件里、一直显示。
   ⛔ **我因此误报过一个不存在的 bug**（"刷新后 AI 改写按钮丢了"）—— 实际数据（DB + API 返回的 `mode`/`failedImageCount`/`imageResultSlots`/`generationMeta`）一个字段都没丢，把消息 `scrollIntoView` 后按钮立刻出现。
   **教训：用 `querySelectorAll('.flashmuse-failed-media-card')` 统计对话流失败卡不可靠，先滚进视口再断言；别看到"红字在、卡不在"就说数据丢了。**
2. ⭐ **改「模型拒绝」那句文案要连带改三处**（都写了注释）：① `gpt-image-safety-retry.ts` 的判定（认前缀 `模型因色情/暴力/隐私安全等原因拒绝出图`，⛔ 绝不能改回整句比对，否则**所有 AI 改写按钮全部不亮**）② `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 前缀归一化（不然后台炸成几十条各 1 条）③ `error-message.ts` 顶部的幂等保护。
3. ⭐ **`toUserErrorMessage` 有幂等保护**：认出是自己映射好的成品文案就原样返回。**因为它在"服务端映射→前端再映射"链路上可能被调两次**，而末尾兜底透传会截到 180 字、会把刚附上的模型原文砍掉。
4. ⭐ **资产库的角色生成很难触发拒绝**：`ruleText` 会把提示词包装成"角色设定图"，中间那层语言模型就不拒绝了（试过"全裸/露骨""极度血腥断肢""1:1 复刻明星脸"，5 次全部照样出图，烧了约 96 积分）。**要测资产库的拒绝路径，别再靠改提示词硬碰。**
5. ⚠️ **测试服的 OpenRouter key 对新 `/api/v1/images` 接口一直在撞 1015 限流**（本次连撞 B_48/49/50/51），**直连版的安全拒绝红字因此没能实机跑通**。

### ⚠️ 本次两项没测到（别当成已验证）

1. **直连版的安全拒绝红字**（限流 4 次拿不到样本）—— 已用真实原文做过纯函数验证（13/13 通过），但没实机跑通。
2. **资产库"拒绝类"失败卡的三颗按钮** —— 资产库失败卡本体渲染正常（限流那次验过、且正确只显示「重新生成」），判定也是同一个共享函数，但"拒绝类文案 → 三颗按钮"这一步资产库侧没实际触发过。

### ⭐⭐ 给下一个 AI：接手要做的事（按优先级）

1. ⭐ **先问用户要不要把这批上正式服**（本地那行限流文案还没上测试服）。走法：`bump-version.mjs` → v52 → 测试服 → 验限流文案 → 原样同步正式服。
2. ⭐ **这 101 条要不要归档，用户还没拍板**。我的建议与理由见 `05-next-actions.md`。⚠️ 按铁律"模型拒绝"本身不归档，但这批的**旧形态**（500 字小作文 / 提示词复读 / 520 伪装）已被本次改动取代 → 倾向归档。**必须用户点头才跑归档脚本。**
3. **继续排查剩余红字**（正式服 286 条待排查中，扣掉这 101 条还有 ~185，其中审核类 166 条按铁律不归档）：`empty image result` 7 条、`InvalidParameter.UnsupportedImageFormat` 4 条、`API Key 无效` 4 条（查是哪个渠道）、DB 事务超时 2 条。
4. **补测**上面那两项没测到的。
5. 方法论全在 **`07-red-error-triage-and-archive.md`（必读，第十二节是本次新增）**。

### 次要待办（沿用）

- ⚠️ **仍未点测**：第十次会话那批「模型明文拒绝 + AI 改写补给对话流」的部分反例（视频失败卡不能出现 AI 改写按钮 —— 本次已由纯函数验证覆盖但没实机点）；**工作流侧 Kling 参考图拦截**仍没人工点过一次。
- ⚠️ 小问题（未修）：被发送前拦截后再点一次发送 → `POST /api/asset-upload-temp 500`（临时上传凭证被第一次尝试消耗），见 `05-next-actions.md`。
- ⭐ **待观察**：本地 `.next` 反复损坏是否已断根，见 `05-next-actions.md`「待观察」。
- ⭐ 用户习惯：**叫你测试才测试**；**动代码前先评估对其它功能的影响并先报影响范围**；**默认只改本地不部署**。

## 此前状态（2026-07-28 第十一次会话：✅ 四方同步 v1.0.0.50，已部署两服）

### ✅ 四方同步：正式服 = 测试服 = 本地 = GitHub = **`v1.0.0.50`**（commit `1fd1ef3`）

- 本次一次性把**积压的两批**（第十次 + 第十一次会话）全部部署上线。**无 Prisma 迁移**（两服 entrypoint 均 `No pending migrations`）。
- 正式服备份：`/opt/flashmuse/app-backups/20260728-140839-presync-v50`。四域名 main/api/ali/static 全 **200**，两服 `x-app-version: v1.0.0.50`。
- ⚠️ **为什么是 v50 而不是 v49**：v49 上测试服后发现新页有 **hydration mismatch（React #418）** ——
  日期在客户端 `Intl.format` 会因为服务器/浏览器时区不同而两次渲染结果不一致。
  修法：**所有日期一律在服务端预格式化成 `*Label` 字符串再传给客户端组件**。
  修完按铁律重新 bump 才上（所以 v49 只在测试服活了几分钟）。
  ⛔ **以后后台新页面（客户端组件）里绝对不要在浏览器端格式化日期**，一律服务端算好传字符串。
- 归档已跑：**正式服 33 条**（`kling-reference-image-pixel-invalid` 32 + `veo-r2v-duration` 1）→ **308 降到 286**；
  测试服命中 0（正常，它没有这批数据），仍 36。
  ⭐ 效果直观：兜底桶「服务器繁忙」从 **60 降到 28**（占待排查 9.8%）。

### 测试服实机验收（全过，用户要求"测过再上正式服"）

| 项 | 结果 |
|---|---|
| Kling v3.0 Standard + 200×120 参考图 | ✅ 发送前拦下：「参考图「small-200x120」太小了（200×120）。生视频要求参考图宽和高都不小于 300 像素…」 |
| Veo 3.1 + 参考图 + 4 秒 | ✅ 发送前拦下：「当前模型在使用参考图时只支持 8 秒的视频时长（你选的是 4 秒）…」 |
| **反例**：Veo 3.1 + 4 秒 + **不带参考图** | ✅ 不被拦、正常生成成功（纯文生视频没被误伤） |
| **反例**：Kling + 1280×720 合规参考图 | ✅ 不被拦、正常生成成功 |
| 后台新页 `/admin?tab=failures` | ✅ 数据正确（测试服 36 待排查 / 兜底桶 15 / 已归档 10），筛选·搜索·展开样本·复制均可用，**0 控制台错误** |
| 后台概览页「失败原因」卡片 | ✅ 未坏（本次改了它的归一化 SQL 为共享常量） |
| 工作流画布 | ✅ 正常加载、节点工具齐全（拦截逻辑与对话流是同一个共享函数 + 服务端还有一道兜底） |

⚠️ **工作流侧的 Kling 拦截没有做到"点击生成看提示"这一步**（tldraw 画布连线在自动化里不好操作）。
它调的是同一个共享函数、且 `api/video/route.ts` 服务端还有一道 400 兜底，风险很低，但**下次有机会人工点一次**。

### ⭐⭐ 给下一个 AI：接手第一件事 = 继续排查红字

**用新页 `/admin?tab=failures` 开始**（左侧"生成记录"下面）。正式服现在 **286 条待排查 / 18 种原因 / 还在流血 10 种**。

⭐ **新页第一眼就给出了下一个目标**：
「图片平台没有返回图片（模型未产出或拒绝生成）」**101 条**，其中
**工作流 88 / 对话流 11 / 资产库 1 / Agent 1** —— 高度集中在工作流一个入口，
按本页的设计意图这就是**"该统一却分叉了"的强信号**，值得优先查。
（另：审核类待排查 166 条按铁律不归档，别去动它们。）

方法论 / 已修清单 / 待查清单 / 归档流程全在 **`07-red-error-triage-and-archive.md`（必读，第九、十节是本次新增）**。

### 次要待办

- ⭐ **待跟踪（第十次会话故意留的口子，现已上线，可以开始等）**：新接口空结果已落盘响应体原文，
  **过几天去正式服日志捞 `image-provider-empty-result` 的 `upstream.body`**，看模型拒绝文字在哪个字段，再写读取逻辑（**别猜字段名**）。
- ⭐ **待观察**：本地 `.next` 反复损坏（登录报「请求失败」）是否已断根，见 `05-next-actions.md`「待观察」。
- ⭐ 用户习惯：**叫你测试才测试**；**动代码前先评估对其它功能的影响并先报影响范围**；**默认只改本地不部署**。

### 第十一次会话做的（2026-07-28）：40 条轮询 failed 查清并修 + 后台「失败排查」页

1. **75 条 distinct poll-failed taskId 的真实构成**：26 条已是明确文案「成品被平台拒绝交付」/ 4 条「API Key 无效」/
   **33 条 OpenRouter 落兜底桶（本次全部查清）** / **6 条 BytePlus 落兜底桶且仍不可考**（原文当时没落盘 + 平台任务无法事后回查）。
2. **根因 A（32 条）`Image pixel is invalid`**：Kling 全系，参考图 **338×191**（高 < 300）。
   ⭐ 和第七次会话归档的 191 条 BytePlus「参考图尺寸不合规」**同一个根因**，
   漏出来是因为 v47 那道发送前拦截被写死「只对 BytePlus 生效」（三处都是）→ **Kling 路径裸奔**，
   而 Kling 官方规则和 BytePlus 一模一样。典型的「该统一却分叉了」。
3. **根因 B（1 条）**：`google/veo-3.1` 带参考图（r2v）**只允许 8 秒**，我们的时长表 `[4,6,8]` 没有这个维度。
4. **修法**（用户拍板 1+2+3 一起做）：新增唯一权威 `videoModelEnforcesReferenceImageSizeRules()`（BytePlus+Kling）
   三处咽喉共用；`error-message.ts` 加两条映射并列入 `isPermanentError`；
   新增唯一权威 `models.ts` 的 `VIDEO_REFERENCE_DURATION_LIMITS` + `validateVideoDurationWithReferences()` 三处拦截
   （⭐ 故意不静默改时长——直接影响计费）；归档脚本加两条规则 + `taskId→requestId` 桥（因为这批日志里没原文，靠 match 匹配不上）。
5. ⭐ 顺手消掉一处「抄三遍」：失败原因归一化 SQL 抽成 `FAILURE_REASON_SQL`，概览页与新页共用。
6. ⛔ 新认知：`api/video/route.ts` 那道服务端尺寸兜底靠 `MediaAsset.width/height` 查库，**历史资产这两列常是 null**
   → 服务端拦不住，真正拦得住的是前端「现场量图」那道。两道都得在，别以为有服务端就够了。

### ⛔⭐ 第十一次会话的操作记忆与踩坑（省下一个人的时间，全都实际踩过）

**排查侧**

1. ⭐⭐ **OpenRouter 的视频任务事后可回查原文** —— `taskId` 就是 `https://openrouter.ai/api/v1/videos/<id>`，
   带 key `curl` 就能拿到当时的 `error`。**别再说"等新数据攒几天"**。命令见 `07` 文档第九节。BytePlus 的 `cgt-xxx` 不行。
2. ⛔ **`find <文件名> | head -1` 会先命中缩略图副本**：本次查那两张参考图尺寸时，
   `find` 先返回了 `image-thumbnails/upload_image/xxx.jpg`（**256×145**），差点把它当成原图下结论；
   原图在 `upload_image/xxx.jpg`（**338×191**）。**查资产真实尺寸必须把所有匹配路径都列出来看清楚**。
3. 量 jpg 宽高不需要装依赖：服务器上直接 `python3` 读 SOF 段（脚本见本次会话，几行就够），
   容器里**没有 ffmpeg/ffprobe**（`sh: ffmpeg: not found`）。
4. ⛔ **PowerShell 里 `node -e "...$..."` 的 `$` 会被本地 shell 吃掉** → `p.$disconnect()` 变成 `p.()` 直接语法错。
   一次性脚本**一律写成 `.js`/`.sh` 文件再传**，别内联。
5. 归档脚本先 `dry-run` 再 `--apply`：本次 dry-run 报 `toArchive: 33`（Kling 32 + veo 1），与排查结论完全一致才敢 apply。

**验收侧（下次实机测同类功能直接照抄）**

6. ⭐ **本地进不了后台的解法**：`.env` 的 `ADMIN_EMAILS=lookxun@163.com` 但该账号在**本地库**没有可用密码。
   本次做法 = **临时把主测试号 `12424740@qq.com` 加进 `.env` 的 ADMIN_EMAILS**（逗号分隔）→ 验完**已还原**。
   （测试服/正式服后台用 `lookxun@163.com` / `dragonstar` 正常登录。）
7. ⛔ **发送前拦截的黑底提示是"瞬时"的**，`browser_snapshot` 之后再看就没了 →
   必须**点发送后立刻轮询** `body.innerText`（本次用 15×120ms 循环抓到）。
   另一个判据：**被拦时输入框里的提示词和参考图不会被清空**。
8. ⛔ **Playwright MCP 的文件选择器不能在 `run_code` 里自己 `waitForEvent('filechooser')`** ——
   会和 MCP 的 modal 跟踪打架、卡住。正确姿势：用 `browser_click` 点上传按钮 → 用 `browser_file_upload` 传文件 →
   再用 `run_code` 做后续（填提示词、点发送、抓提示）。
9. 造测试图不用找素材：项目已装 `sharp`，几行就能生成 200×120（触发拦截）和 1280×720（合规反例）两张 jpg。
10. ⚠️ **观察到一个小问题（未修，已记进 `05-next-actions.md`）**：被拦截后**再点一次发送**会报
    `POST /api/asset-upload-temp 500`，容器日志是 `上传文件不存在或已过期` —— 临时上传凭证像是被第一次尝试消耗掉了。
    重新上传即可，不影响首次拦截行为，但**用户连点两次会看到一个没用的报错**。
11. ⛔ 工作流画布（tldraw）**连线不适合自动化**：8% 缩放下节点分散，本次没能自动完成"图片节点连到视频节点再点生成"。
    工作流侧那一项验收因此留给人工。

### 次要待办（历史，已随 v50 全部上线）

- ✅ 上面提到的"本地积压两批未部署改动"**已于 2026-07-28 随 v1.0.0.50 全部部署两服**。

## 此前状态（2026-07-28 第十次会话：⚠️ 本地有一批未部署改动，线上仍是 v1.0.0.48）

### ⭐⭐ 给下一个 AI：**接手第一件事 = 继续排查红字**（用户 2026-07-28 第十次会话末明确交代）

**不用先部署、不用问要不要部署** —— 直接接着排查后台「运营概览 → 失败原因」的红字。方法论 / 已修清单 / 待查清单 / 归档流程全在 **`07-red-error-triage-and-archive.md`（必读）**，照着做即可无缝衔接。

- **正式服剩 308 条待排查**（测试服剩 36）。按性价比排的下一批：
  1. ⭐ **40 条「轮询 failed」** —— 第六次会话已把上游原文落盘（以前只记 `hasError` 布尔），**数据已攒够，可以去捞了**，大概率是输出侧内容审核（`OutputVideoSensitiveContentDetected` 之类）。
  2. `empty image result` 7 条（OpenRouter 说成功但没图，看是不是特定 model/参数组合）。
  3. `InvalidParameter.UnsupportedImageFormat` 4 条 / `API Key 无效` 4 条（查是哪个渠道）/ DB 事务超时 2 条。
  4. 后台列表里其它未归档条目，同一套方法逐条查。
- **不要归档的**（平台审核/用户提示词内容，我们修不了，就该一直亮着）：成品被平台拒绝交付 56、模型拒绝 sexu/viol 28+12、版权限制 16、真人隐私敏感 13+6+1、「提供商余额不足」、以及本次新映射出的 `MODEL_REFUSED_MESSAGE`（模型明文拒绝）。
- ⛔ 排查前必读三条硬教训（详见 `05-next-actions.md`）：**①兜底桶有两个**（「服务器繁忙，请稍候再试.....」和「请求失败，请稍后再试。」），同一根因会同时污染两个，两个桶都要查；**②日志 `grep -c` 的行数 ≠ 待排查事件数**，必须回 DB 按 requestId 核对 `GenerationEvent.status`；**③同一根因常有多种上游措辞**，写正则前先把措辞捞全。

### 次要待办（不阻塞红字排查，等用户发话再做）

- ⚠️ **本地有未部署改动**（本次会话的模型明文拒绝识别 + AI 改写重试收敛并补给对话流，详见 CHANGELOG 顶条）。**无 Prisma 迁移**，`npx tsc --noEmit` 中 `src/` 全绿。线上（正式服 = 测试服 = GitHub）仍是 `v1.0.0.48`。部署要走铁律：**先测试服（跑 `bump-version.mjs` → v49）→ 实机验 → 再同步正式服（不再 bump）**；验收清单在 `05-next-actions.md`。
- ⭐ **待跟踪（本次故意留的口子）**：新接口空结果已开始落盘响应体原文，**部署后过几天去正式服日志捞 `image-provider-empty-result` 的 `upstream.body`**，看模型拒绝文字落在响应哪个字段，再写读取逻辑（**别猜字段名**）。捞法与后续动作见 `05-next-actions.md` 顶部「待跟踪」。
- ⭐ **待观察**：本地 `.next` 反复损坏（登录报「请求失败」）是否已断根，见 `05-next-actions.md`「待观察」。
- ✅ **v46 那批功能用户已自测通过**（资产库时长角标 / hover 放大 / 工作流视频截图 / 用户中心计数 / 我的积分工作流图标），此项待办**结掉**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright；**动代码前先评估对其它功能的影响**；**默认只改本地不部署**。

### 第十次会话做的（2026-07-28）：gpt-5.4-image-2「中文明文拒绝」查清并修

查出是**两个问题被混成一条**：

1. **问题 A（落兜底桶那批）**：`openrouter.ts` 有 **3 个** `image-provider-empty-result` 打点，**新接口 `/api/v1/images`（gpt-5.4-image-2 走这条）那个把上游拒绝文字整个扔了**，日志里连 `responseText` 都没带 → 抛「没有返回可用原因」→ 被 `error-message.ts:69` 精准打回「服务器繁忙」。**连它说了什么都查不到。**
2. **问题 B（那 ~20 条）**：老 `-agent` 接口路径原文是读到的、红字也透出了（**没落兜底桶**），真正缺口是 **UI：「AI 改写重试」只存在于工作流**，对话流/资产库/Agent 完全没这个入口。
3. 改动：①新接口空结果**落盘响应体原文**（`redactBase64ForLog` 防刷日志）—— 按用户决定**只加日志、不猜字段**；②`error-message.ts` 新增唯一权威 `MODEL_REFUSED_MESSAGE` + `isModelRefusalText()`（补上以前**完全没有**的英文拒绝语规则），插在版权/隐私规则**之前**；③新增唯一权威 **`src/lib/gpt-image-safety-retry.ts`**（`isGptImageSafetyFailure` + `runPromptSafetyRetry` 编排），工作流那份 60 行循环删掉改调它，**对话流补上「AI改写重试 3/5/10 次」入口**（`Message` 加 3 个字段、新增 `patchMessageById`、`retryFailedMedia` 加 `promptOverride` 并可 await、按 `canOptimizationRetry` 收窄不让视频/其它模型误亮）。后端 rewrite 接口零改动。
4. ⚠️ **一个待实机确认的观感问题**：改写全败后消息内容会被替换成最后一次的改写提示词（`finalizeAssistantImageFailures` 的 `content: prompt`，原本就是这套逻辑）。
5. ⛔ `npx tsc --noEmit` 会报 `.next/dev/types/*` 一堆语法错 —— **Next 生成的陈旧产物，非本次引入**，删 `.next` 即消失；自查时用 `Select-String -NotMatch "^\.next"` 过滤。

### ⭐⭐ 同一会话补做：「本地登录报请求失败」根治（`start-project.bat` 自愈）

用户反馈"本地又登录不了、昨天也这样、是不是修不好了"。**与业务代码无关**，三层原因（完整记录见 CHANGELOG 顶条）：

1. **表层**：`.next` 缓存损坏 → **所有 `/api/*` 404/500** → 前端落兜底文案「请求失败」。⚠️ 我一开始把因果讲错了：`routes.d.ts` 是**纯类型文件、运行时被剥掉，不可能导致 404**，它只是同一次写坏的症状；真正 404 的是路由清单（`dev/server/app-paths-manifest.json` 这类）。
2. **复发原因（嫌疑锁定，尚无铁证）**：已排除磁盘满 / 多开 dev / 异常关机 / OneDrive。**头号嫌疑＝腾讯电脑管家实时防护 `QQPCRTP.exe`**（写坏时间＝dev 启动后 45 秒、正在生成路由清单时）。用户已把项目目录 + `node.exe` 加进管家信任区。**要观察次日是否复发才能结案。**
3. ⭐⭐ **真答案：双击 `start-project.bat` 根本没机会自愈** —— `start-project.log` 被 `npm run dev >> start-project.log` 的重定向**独占文件句柄**，脚本一进来就 `Set-Content` 写它 → **IOException → 整个脚本当场终止**。**只要 dev server 还活着（哪怕是坏的僵尸），双击就必然毫无反应。** 另外还查出 `Test-TcpPort 127.0.0.1 3000` 判定失效（Next 绑 IPv6 `::` + 500ms 超时）导致新 dev 被挤到 3001 后死等 5 分钟超时，以及互斥锁被卡死实例持有时新双击静默退出。

**`scripts/start-project.ps1` 已改**（用户只会双击 bat，所以自愈必须做进去）：健康判定改成"`/api/auth/me` 必须 200"（首页 200 骗不过它）；所有日志写入 try/catch 兜住绝不中断；新增 `Write-Trace` + 独立追踪日志 `.runtime/start-project-trace.log`（npm stdout 污染不了它，排查一看就知道走哪条分支）；新增 `Stop-NodeOnPort`（按端口杀且只杀 node.exe）/ `Repair-NextCache`（**先把坏掉的清单备份到 `.runtime/next-broken/<时间戳>/` 再删** `.next`）/ `Test-DevPortBusy`。

**实测**：故障态（3000 被僵尸占 + 接口 500）下双击 → **15 秒自愈成功**；正常冷启动与健康态下再双击都不误伤（`.next` 不被误删）。

⛔ 排查踩坑：写"清理 start-project 进程"的命令时用 `CommandLine -like "*start-project*"` 会**把自己的 shell 一起杀掉**（自己的命令行里也含这个串），表现为命令"无输出"。以后这类命令必须排除 `$PID`。

## 此前状态（2026-07-28 第九次会话：v1.0.0.48 已部署两服）

### ⭐⭐ 给下一个 AI：**接手第一件事 = 继续排查红字**（用户 2026-07-28 明确交代）

- **不用部署、不用问要不要部署**：本地工作树干净、四方同步 `v1.0.0.48`、无待推、`npx tsc --noEmit` 全绿。
- 直接按 **`05-next-actions.md` 顶部**的接手指引开始（方法论全在 **`07-red-error-triage-and-archive.md`，必读**）。**正式服剩 308 条待排查。**
- 下一批最值得查的两个（缩略图那条已确认不占位）：① **40 条「轮询 failed」**（日志已在第六次会话修好会记原文，现在有新数据可捞了）② **gpt-5.4-image-2 中文明文拒绝 ~20 条**（应识别成"模型拒绝"接上已有的 AI 改写重试）。

### ✅ 四方同步：正式服 = 测试服 = 本地 = GitHub = **`v1.0.0.48`**（commit `93252e8`，代码 commit `389ad87`）

- 第九次会话做的：⭐ **参考素材 url 归一化根治**（详见 CHANGELOG 顶条）。新增唯一权威 `src/lib/reference-asset-url.ts`（`normalizeReferenceAssetUrl`，幂等）：把「给人看的动态缩略图接口地址 `/api/media-thumbnail?url=`」和「自家主机绝对前缀（含已退役马来 IP `101.47.19.109`）」一律还原成**文件静态直链**，8 处咽喉全部接入（`api/image`、`api/video`、`api/byteplus-assets` 三个 route 入口 + `generation-jobs.resolveReferenceUrls` + `openrouter.ts`(3)/`openrouter-video.ts`(2)/`seedance.ts`(1)/`video/route.ts` 的底层拼址）。无 Prisma 迁移。
- 部署：测试服 v48 → **实机回归全过** → 正式服 v48（备份 `20260728-030655-presync-v48`）→ 四域名全 200 → push。
- **测试服实机回归全过**（用户要求"测过再上正式服"）：对话流生图（带参考图 Seedream 4.5，4/4 成功，日志参考图=`kind:"data"`）、对话流生视频（带参考图 Mini 5秒，参考图=`kind:"generated"` 原图路径）、工作流快捷编辑（async job 路径 `image-job-success`）、**v47 的 401 跳首页 + 不记事件**（清 cookie 后点生成 → 直接跳 `/`、零提示、DB 里「请先登录」失败事件 0 条）、两个日志 `media-thumbnail` 计数 0。
- ⭐⭐ **重要认知修正：「平台拉缩略图超时 18 条」不是 18 个失败事件，而是日志出现次数**。那 18 行全属同一个 requestId（`id_mq4osh4b_j0yyiyq5:image:0`），最终 `image-route-success`、GenerationEvent 的 `status = success` → **后台「失败原因」里根本不占位**，所以归档脚本命中 0 属正确结果（规则 `platform-download-our-thumbnail-endpoint` 保留备用）。**教训：以后从日志 `grep -c` 得到的数字必须回 DB 按 requestId 核对 `status`**，否则会把"中间失败/已重试成功"当成待排查红字。（Bug 本身仍是真的：每次超时白等 10 秒 + 触发 curl 兜底重试链，用户端表现为"转很久"。）
- 归档现状（v47 那批已跑完，本次无新增）：测试服剩 **36** 待排查，正式服剩 **308** 待排查。
- ⚠️ 观察到一次 `PUT /api/workspace-state` 瞬时 **502**（前后同接口都 200，`workspace-state` 本次没被碰过）。反复出现再查阿里 nginx 超时/腾讯回源。
- ⚠️ **v46 那批功能仍未实机点测**（资产库时长角标 / hover 放大 / 工作流视频截图 / 用户中心计数 / 我的积分工作流图标），清单见 `05-next-actions.md`。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。

## 此前状态（2026-07-28 第八次会话：部署 v1.0.0.47）

### ✅ 四方同步：正式服 = 测试服 = 本地 = GitHub = **`v1.0.0.47`**（commit `9268dab`）

- 第八次会话只做了一件事：**把积压的第六 + 第七次会话改动完整部署到测试服和正式服**（用户明确要求两服都部署）。
- 迁移 `20260727154203_generation_event_resolved` **两服 entrypoint 均已 applied**（日志确认 31 migrations found / applied）。
- 验证：测试服 `x-app-version: v1.0.0.47` + `http://101.37.129.164:8080/` 200；正式服 `x-app-version: v1.0.0.47` + 四域名 main/api/ali/static 全 **200**；两服 `PUBLISHED_APP_VERSION` 已 sed 成 `v1.0.0.47` 并 force-recreate。
- 正式服备份：`/opt/flashmuse/app-backups/20260728-021857-presync-v47`。
- **归档脚本两服都已 `--apply` 跑完**：测试服归档 10 条（剩 36 待排查）；**正式服归档 367 条**（`reference-image-size` 191 / `provider-insufficient-credits` 66 / `reference-slot-not-an-image` 26 / `pre-diagnostics-log-unknowable` 24 / `session-expired-recorded-as-failure` 17 / `seedream-pro-sequential-param` 13 / `reference-video-total-duration` 12 / `stale-asset-card` 10 / `approved-card-not-reused` 8），**剩余未归档 308 条**。
- ✅ **v47 的实机回归已在第九次会话补做**（对话流生图/生视频、工作流、401 跳首页全过）。v46 那批（资产库时长角标 / hover 放大 / 工作流视频截图等）**仍未点测**，清单见 `05-next-actions.md`。
- ⭐ 下一步主线仍是**继续排查红字**（缩略图那条已查清=不占位，见本文件顶部）。

## 此前状态（2026-07-28 第七次会话）：红字排查第 2~5 批，四类红字全部查清

### 第七次会话做完的事

主线是**继续排查后台「运营概览 → 失败原因」的红字**（方法论全在 `07-red-error-triage-and-archive.md`）。本次查掉四类、共可归档约 200 条：

| 红字 | 条数 | 结论 | 归档后 |
|---|---|---|---|
| OpenRouter 余额不足（混在两个兜底桶里） | 53 + 13 | 映射成「提供商余额不足！请联系管理员充值。」+ 不再自动重试 | 拆出兜底桶 |
| 视频任务创建失败：`expected the height/width…` | 109 | **同一根因的第二种上游措辞**，v47 发送前拦截本来就挡得住，只是正则漏了 | 109 → **0** |
| 当前模型不支持这组参数 | 54 | 51 条是我们自己的 bug 且都早已修掉；另修一个误映射 | 54 → **3** |
| 请先登录后再使用模型 | 17 | **状态码错了**（500 该是 401），前端所有跳登录保护全失效 | 17 → **0** |
| 请求失败，请稍后再试。 | 33 | 13 余额不足 + 20 条 07-10 前永久不可追溯 | 33 → **0** |

### 本次改动的代码（全部只动错误分支，成功路径零改动）

1. **`src/lib/error-message.ts`**（唯一入口，全模式生效）新增 3 类判定：
   - 供应商余额不足（`402` / `insufficient credits` / `insufficient_quota` / `exceeded your current quota` …）→ 「提供商余额不足！请联系管理员充值。」**位置必须在限流/`quota` 规则之前**，否则被抢走。
   - 参考图尺寸的**第二种措辞** `expected the (height|width) to be at least \d+px`（原来只认 `must be between \d+px and \d+px`）。
   - 平台返回 HTML 错误页 `Unexpected token '<' | is not valid JSON | <!doctype html` → 「平台服务临时异常（返回了非预期内容），请稍后重试。」**必须放在 `not valid` 规则之前**。
2. **`src/lib/transient-error.ts`**：余额不足列入 `isPermanentError`（不再白烧重试）；HTML/非 JSON 响应做**例外先行 return false** + 列入可重试（以前被 `not valid` 误判成永久失败，网关抖动直接放弃）。
3. **`src/lib/credits.ts`**：新增唯一权威 `UNAUTHENTICATED_ERROR_MESSAGE` / `createUnauthenticatedError()` / **`isUnauthenticatedError()`**；`assertUserCanUseCredits` 改抛带 `code:"UNAUTHENTICATED"` 的错误。
4. **6 个 route 的 catch 第一句**统一判 `isUnauthenticatedError` → 回 **401 且不记 GenerationEvent**：`image` / `video` / `chat` / `agent-plan` / `conversation-memory` / `workflow-prompt-optimization/rewrite`。
5. **新增 `src/lib/session-expired-redirect.ts`**（唯一权威）：`handleSessionExpiredResponse()`（401 → `window.location.replace("/")`）+ 哨兵 `SESSION_EXPIRED_SILENT_ERROR`。插在**两处 `readJson`**（`chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx`，**43 处调用的咽喉**）开头 → 一行覆盖全部生成请求，不用改 12 个 fetch 站点；`isAbortLikeError` 认哨兵 → 跳转瞬间不闪红字；chat-workbench 原有 4 处手写 401 跳转收敛成调共享函数。
6. **`scripts/archive-resolved-generation-failures.mjs`** 新增 5 条规则（`provider-insufficient-credits` / `seedream-pro-sequential-param` / `reference-slot-not-an-image` / `reference-video-total-duration` / `session-expired-recorded-as-failure` / `pre-diagnostics-log-unknowable`）+ 两处结构性增强：**匹配文本 = 日志原文 + `failureReason`**（有些错误原文直接进了 failureReason，日志会轮转）、去掉 `requestId IS NOT NULL` 过滤；select 补 `createdAt`。

### ⭐⭐ 本次沉淀的三条重要认知（下一个 AI 必须知道）

1. **兜底桶有两个，同一个根因会同时污染两个**：`toUserErrorMessage` 的 fallback 是**默认参数** —— 显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 落进「服务器繁忙，请稍候再试.....」，不传落进「**请求失败，请稍后再试。**」。余额不足就是 53 + 13 同时污染。**排查任何一类，两个桶都要查。**
2. **同一根因常有多种上游措辞**：写正则前必须先把该根因在正式服的**全部措辞捞全**（归一化去重命令在 07 文档第五节）。参考图尺寸就因为只写了一种措辞，漏了 109 条。
3. **判断"是否真的修好了"不能只看代码里现在有守卫**（守卫可能是后来才加的）：必须 `git log -S "<关键代码片段>" --date=iso` 拿到**修复 commit 的精确时间**，再对比该根因**最后一次发生的时间**。

### ⚠️ 遗留 / 未做

- **`readJson` 两份分叉**（chat-workbench / workflow）**错误文案构建方式不同**（`toUserErrorMessage` vs `getWorkflowApiErrorMessage` 会补 `errorCode` 前缀）。本次只统一了 401 守卫，**没合并整个函数**（合并会改错误文案的实际显示，风险高，要先做影响评估）。
- **单会话策略一行没动** —— 用户 2026-07-28 明确：**是有意设计**（多会话会导致两端同时生成等更多错误），不要改。
- 下一批还有查的价值的：⭐**平台拉我们缩略图超时 18 条**（`Timeout while downloading url: http://<ip>/api/media-thumbnail?...`，送审给的是动态接口，应改静态直链）、`UnsupportedImageFormat` 4 条、gpt 中文明文拒绝约 20 条（应识别成"模型拒绝"接上已有的 AI 改写重试）。

### ⛔ 查正式服的踩坑记忆（省下一个人的时间）

- app 容器叫 **`flashmuse-flashmuse-app-1`**（不是 `flashmuse-app`）；测试服是 `flashmuse-staging-staging-app-1`。
- db 容器**不能** `psql -U postgres`（role 不存在）→ 查库一律 `sudo docker exec <app容器> node -e "..."` 走 Prisma `$queryRawUnsafe`。
- **正式服现在还没有 `resolvedAt` 列**（随 v47 才上），部署前查询别带 `resolvedAt` 过滤，否则报 `42703`。
- **诊断日志最早一行是 `2026-07-10T19:56`**（正式服 07-11 才从马来迁腾讯云）→ 更早的失败永久查不出。
- 一次性脚本：`scp` 到 `/tmp` → `docker cp` 进容器 `/app` → `node` 跑 → 删掉。PowerShell 里内联双引号/`$()`/中文会坏，写 `.sh` 再 `sed -i 's/\r$//'`。

## 此前状态（2026-07-27 第六次会话）

- ⚠️⭐ **本地有一批未部署的改动**（部署后是 `v1.0.0.47`，含 **1 个新 Prisma 迁移** `20260727154203_generation_event_resolved`）。**线上仍是 `v1.0.0.46`（正式服 = 测试服 = GitHub）**，本地版本号还没 bump（部署测试服那一步才 bump）。`npx tsc --noEmit` 全绿。
- **第六次会话做的**（详见 CHANGELOG 顶部 + ⭐ 新文档 `07-red-error-triage-and-archive.md`）：
  1. **正式服"资产是否都本地化"排查**：8181 条里远程 url 621（未归档仍显示的 97 条，签名全失效救不回来），全部是 2026-06 的历史遗留、现在链路正常。**用户拍板 C：先不管。**
  2. ⭐⭐ **红字「服务器繁忙」212 条深挖**：查出真实构成（参考图尺寸/比例不合规 82、OpenRouter 余额不足 53、轮询 failed 原因没落盘 40、审核凭证失效 11、empty image 7、gpt 中文拒绝 4、DB 事务超时 2），并修 4 处：**补上轮询/创建失败的上游原文日志**（原来只记 `hasError` 布尔）、**`!triggered` 真 bug**（已过审素材没被复用就放弃重试）、**已过审图第二次不再弹蓝字**（`reuseOnly` 预检 + 无感重试）、**死卡自愈**（凭证失效自动清理重送审）；错误文案新增 3 类真话。
  3. **参考图尺寸/比例发送前拦截 + 黑底提示**：新增唯一规则 `src/lib/video-reference-image-rules.ts`（300–6000px、0.4–2.5），对话流 / 工作流 / 服务端三处共用，只对 BytePlus 视频模型生效。
  4. ⭐ **后台失败原因「归档」机制**（用户要求：排查掉一批就归档、划掉但保留文字）：DB 加 `resolvedAt`/`resolvedNote`；后台上面只算未归档、下面新增划掉的「已排查并修复」区；新增 `scripts/archive-resolved-generation-failures.mjs`（规则表 `RESOLVED_RULES` 是唯一入口）。**`B_xxx` 编号继续自增，与归档无关。**
- ⭐ **下一个 AI 的主线任务 = 继续排查红字并修复**，方法论 / 已修清单 / 待查清单 / 归档流程全在 **`handover/07-red-error-triage-and-archive.md`**，照着做即可无缝衔接。
- ⚠️ v46 里第二~五次会话的功能**多数仍没实机点测过**（清单见 `05-next-actions.md`）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。
- ⛔ **改中文文档/源码只能用 edit/write 工具**（PowerShell `Set-Content` 会把 UTF-8 中文按 GBK 写回、文件报废）。
- ⛔ **Turbopack 不重编 `globals.css`**：本地改样式没反应时删掉整个 `.next` 再重启 dev（重启进程不够）。
- ⛔ 本地 `prisma generate` 会被 dev server 占用 dll 报 EPERM → 先停 dev server。

### 此前状态（2026-07-27 第五次会话，已部署两服 v1.0.0.46）

- ⭐ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.46`**。测试服入口全 200、正式服四域名 main/api/ali/static 全 200、两服 `x-app-version: v1.0.0.46`、无未应用迁移、`npx tsc --noEmit` 全绿。**无待部署。**
- **第五次会话做的**（详见 CHANGELOG 顶部）：
  1. 资产库右侧**视频卡左上角显示时长**（新增唯一权威 `src/lib/media-duration-format.ts` + 共享 `MediaDurationBadge`；音频播放器的时间格式化收敛进来）。角标尺寸同音频、但**深底白字**（用户拍板，浅底深字在封面上看不清）。
  2. **图片/视频缩略图 hover 放大**：统一 CSS 工具类 `.media-thumb-zoom`（scale 1.06 / .26s，触屏与 reduced-motion 不放大）。按用户选择**只套资产库右侧网格**。
  3. 收敛分叉：`workspace-state` / `media-assets` 两处调 `resolveAssetPreviewMeta` 都硬写 `durationSeconds: null`（漏传），现在真实传了并在资产 payload 直出 `durationSeconds`。副作用：预览页参数卡里上传视频现在也会显示「XX秒」。
  4. **时长/封面全量回填**：新增 `scripts/backfill-media-asset-durations.mjs`（ffmpeg 解析 `Duration:`，无 ffprobe）。本地 28 条 / 测试服 5 条 / **正式服 2059 条**补齐；正式服另用 poster 脚本**新建 29 个封面**并 rsync 到阿里正式镜像。
  5. ⛔ **踩坑：Turbopack 不重编 globals.css** → 改 CSS 看不到效果（同批 JS 改动却生效）。**必须删掉整个 `.next` 再重启 dev**，重启进程不够。以后"样式改了没反应"先查这个。
- ⚠️ **v46 里第二~四次会话那批功能仍然没有实机点测过**（视频截图/快捷编辑/积分页/用户中心等，清单见 `05-next-actions.md`），本次只实测了本会话这两项（时长角标 15/15、7/7；hover computed transform = matrix(1.06...)）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。
- ⚠️ **本地后台进不去**：`.env` 的 `ADMIN_EMAILS=lookxun@163.com` 是管理员白名单，但该账号在**本地库**里的密码不是 `dragonstar`（测试服那套账号只对测试服有效）。**但主测试号 `12424740@qq.com` / `dragonstar` 在本地库可以登录**（本次已用它实测）。
- ⛔ **教训**：改中文文档/源码**只能用 edit/write 工具**，用 PowerShell `Set-Content` 做正则替换会把 UTF-8 中文按 GBK 写回 → 文件报废。

### 此前状态（2026-07-27 第四次会话，测试服 v1.0.0.45）

- ⭐ **测试服 = `v1.0.0.45`（已部署，含第二/三/四次会话全部改动）；正式服 = `v1.0.0.43`；GitHub = v43**（本地工作树未 commit，基线 commit `03b21b5`）。测试服入口全 200、`x-app-version: v1.0.0.45`、无未应用迁移、`npx tsc --noEmit` 全绿。
- ⚠️ **本批功能全部未实机点测**（用户习惯：叫测才测）。验收清单见 `05-next-actions.md`。
- **第四次会话做的**（详见 CHANGELOG 顶部两条）：
  1. 工作流视频节点快捷菜单加 **「视频截图 ▾」**（悬停展开：截取首帧/尾帧/当前帧），截出的图直接作为图片节点出现在源视频右侧；截帧与右键导出共用唯一实现；节点标题显示「视频截图 xxx」。
  2. ⭐ **上传视频没封面根治**：去重早返回会继承历史空 posterUrl → 新增 `ensureDedupPosterUrl` 现场补 + 写回库；新增 `scripts/backfill-uploaded-video-posters.mjs`（本地已 apply 补 6 条；测试服 dry-run=0 条，无需补）。
  3. ⭐ **资产库上传类不再分对话流/工作流**：新增 `UPLOAD_IMAGE_CATEGORIES`（视频/音频早就不分流，图片是唯一漏做的），三处上传 + 视频截图统一显示在「上传的资产 · 上传图片」；顺手修掉工作流上传图片被写成 `conversation_uploads` 的分叉（读取已统一 → 老数据免 backfill）。
  4. **用户中心「生成图片/生成视频」显示 0 修复**：`User.generatedImageCount/VideoCount` 两个列从来没被任何代码 +1 → 改为现算（`getUserGeneratedMediaCounts`，只数 `sourceKind` 不含 upload 的），`/api/auth/me` 与 `/api/user-profile` 的 GET+PUT 都走它。
  5. **「我的积分」工作流行用工作流图标**（`/api/credits/me` 新增 `workflow` 来源、每个工作流一行；前端 `RiGitPullRequestLine`）。
  6. **工作流上传/截图后资产库右侧列表不刷新根治**（v45）：新增 `onUploadedAsset` 回调 → 父级 force 刷新对应上传分类；工作流拖拽/粘贴上传的图片/视频/音频以前同样有这问题，一并解决。
  7. 后台编辑功能表"内容行不是白色"一项，用户口头结掉（保持现状，不再处理）。
  8. **调研（无代码）**：视频「高清/超分」方案全面调查 → **BytePlus 无超分接口**；Seedance 2.0 已有 4K 档但那是重生成不是超分、且 $0.78/秒（**用户交代 4K 先不接**）；真超分只能走 Topaz（Replicate/fal）等第三方，开源最强 SeedVR2 需 4×H100。**用户决定先不做，记为备忘 `M020`**（数据/选型/接入要点全在 `06-memo-tasks.md` M020，别再重复调研）。
- **第三次会话做的**（已随 v44 上测试服，细节见 CHANGELOG）：对话流提示词里视频缩略图悬停显示封面（`HoverVideoPreview`）；⭐ 实测 Seedance 参考视频真实上限 **15.2 秒**、正式服生成的"15 秒"视频实际 **15.1 秒**；时长校验三处分叉收敛到 `media-upload-validation.ts`（容差 0.2）；修「自家 15 秒视频当参考被自己拦死」；工作流视频节点快捷菜单（快捷编辑 + 下载，模型链 Mini→Fast→2.0，参数按源视频真实尺寸/时长反推）；后台新增「工作流 · 视频编辑功能」表；图片快捷菜单下载收敛到共享 `downloadWorkflowNode`。**「高清」按用户交代先不做**。
- **第二次会话做的**（已随 v44 上测试服）：视频封面/播放按钮全平台统一（新增 `src/components/video-play-badge.tsx`，收敛 6 处重复 overlay）；上传视频归类分叉根治（`upload-file` 的 `getFileCategory` 改走权威 `classifyAsset(flow)`、`workspace-state` 的 `isWorkflowCategory` 补 `workflow_upload_*`）。原计划的 `currentCategory` backfill **已不必须**（第四次会话把上传类读取统一了）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。
- ⚠️ **本地后台进不去**：`.env` 的 `ADMIN_EMAILS=lookxun@163.com` 是管理员白名单，但该账号在**本地库**里的密码不是 `dragonstar`（测试服那套账号只对测试服有效）。
- ⛔ **教训（本次踩坑）**：改中文文档/源码**只能用 edit/write 工具**，用 PowerShell `Get-Content -Raw` + `Set-Content` 做正则替换会把整份 UTF-8 中文按 GBK 解码写回 → 文件报废且不可完全还原（本次 01/05 两份被毁，已用 `git checkout` + 重写恢复）。

### 关键实测数据（第三次会话新增，以后别再猜）
- **Seedance 2.0 / Fast / Mini 参考视频时长上限 = 15.2 秒（含）**，API 原文 `must be less than or equal to 15.2 ... in r2v`。另有 `video pixel count ≥ 409600`、宽高 300–6000px、宽高比 0.4–2.5。
- **正式服生成的「15 秒」视频实际统一 = 15.1 秒** → 当参考视频安全（15.1 < 15.2）。
- **视频模型分辨率天花板**：`seedance-2-0` 有 480p/720p/1080p；`-fast` 和 `-mini` 只有 480p/720p（`models.ts:415-446`）。

### 此前状态（2026-07-27 第一次会话，已部署正式服 v1.0.0.43）

  1. **视频"卡下载→僵尸任务"根治**：`saveRemoteAsset` 下载加 3min 超时、ffmpeg 加 60s 超时、`media-save-queue` 锁(inFlight)改成假死可自愈(8min)+stale 阈值 30min→8min。根因=跨境下载 fetch 无超时假死、锁只在 finally 释放→回收/过期全被挡死→job 永远 running。
  2. **恢复乐观显示**（用户最初设计）：视频出结果先用远程地址展示（角标"资产保存中..."），后台下本地后无感替换成本地("✓保存成功"2s 后渐隐)。资产库仍只写本地 url+全参数、零改动。对话流+工作流统一；OpenRouter 需密钥视频不预览；只做视频。
  3. **工作流生成动画**：侧栏工作流历史条目 + "工作流模式"入口在有节点 `isRunning` 时显示 `HaloPulseIndicator`（对齐对话流/资产库）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**（先改问题）。以后可手动标 failed。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。

### 此前状态（2026-07-26）

- ⭐ **四方同步**：正式服 = 测试服 = 本地 = GitHub = **`v1.0.0.41`**。四域名 main/api/ali/static.venusface.com 全 200，公网正式服 = v1.0.0.41。**无待部署、无未推**（本对话结束时）。无新增 Prisma 迁移（正式服 entrypoint 报 "No pending migrations"）。
- **本对话（2026-07-26）做的**（本地 tsc 全绿，详见 CHANGELOG 2026-07-26）：
  1. 工作流图片/视频节点「重试成功却秒跳失败卡→多次重试多图覆盖」根治（失败分支按 requestId 忽略旧任务）。
  2. gpt版 gpt5.4image2 版权红字也能进「AI改写重试」安全改写页（判定改用 `isGptImage2Model||isGptImage2AgentModel`）。
  3. 橡皮工具「立即使用」防双击（点一次同步上锁+关弹窗）。
  4. **新版本提示条整套**（`middleware.ts` 发 `x-app-version` 头 + `version-update-notifier.tsx` 搭便车检测；`PUBLISHED_APP_VERSION` env 门控保证"弹出=静态就绪=刷新不白屏"）。
  5. 提示条只在右侧内容区居中（动态量 sidebar 宽）。
  6. 用户信息菜单工作流里点任意空白也能关（捕获阶段监听绕过 tldraw 吞事件）。
- ⭐ **同时首次把 07-22~25 编辑菜单整套推上正式服**（去背景/橡皮/多模型候选链/下载/后台编辑开关；新依赖 `@imgly/background-removal-node` + `scripts/remove-background-worker.mjs`，正式服 docker build 已装）。
- ⭐ **新增部署环节记忆**：测试服 + 正式服 compose 都已加 `PUBLISHED_APP_VERSION: ""` 环境变量；每次部署最后一步（静态同步后）要 sed 改成新版 + `force-recreate`（详见 `03-deploy-and-servers.md`）。**版本号自增仍只在部署测试服跑 bump，正式服原样带号**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。

### 此前状态（2026-07-21）

- **四方同步**：正式服 = 测试服 = 本地基线 = GitHub = **`v1.0.0.36`**（源码 commit `dd37a78`）。四域名 200，**无待部署、无未推**（在本批本地开发之前）。
- 最近一个 Prisma 迁移是 `20260721000000_media_asset_duration_float`（`MediaAsset.durationSeconds` Int→Float/double precision），已在正式服+测试服 apply。当前无未应用迁移。
- 主服务器=腾讯云新加坡，阿里=国内入口/镜像。测试账号见 `03-deploy-and-servers.md`。

## 最近几批做了什么（倒序，细节见 CHANGELOG）

### 2026-07-21 部署 session（本批文档重建前最后一次工作）
1. **部署正式服 v1.0.0.34**（上一 session 积压的一大批）：道具图片 `prop_image` 整套类目（propify 道具化、三档比例含四宫格）、工作流用量视频计数虚高修复、B_232 参考视频总时长精度（Int→Float 迁移）、B_252 音频(.bin)误入图片槽修复、资产库生成等待卡刷新恢复、预览页参考缩略图从 DB 读（新增 `/api/generation-references`）、道具生成@名与参考图脱钩根治。正式服 DB 跑了 `scripts/backfill-prompt-mentions.js`（fixed0/ok84/skip3，数据本就基本干净）。
2. **@引用资产弹窗左侧分类"滚动条常驻"（v35）**：共享组件 `src/components/asset-mention-picker.tsx` 左侧列表加 `mention-cat-scroll` + `<style>`（`overflow-y-auto` + `scrollbar-width:thin` + `::-webkit-scrollbar` 非叠加式）→ 分类溢出时滚动条常显可下拉、无溢出不显示、不加高弹窗（378px）。三处 @引用资产（对话流/资产库生成/工作流）共用此组件=一处改全覆盖。
3. **修「@引用资产同一上传视频/资产显示成两个」（v36）**：根因=`getAssetIdentityKey`(`chat-workbench.tsx:2617`) 原 `mediaId||url||id`（mediaId 优先），同一文件"消息内嵌引用(无 mediaId,key=url)"与"资产库权威记录(有 mediaId,key=mediaId)"两份 key 不同 → 懒加载合并时漏判成两条。**改成 `归一化url||mediaId||id`（url 优先）**，url 是文件唯一身份 → 两份必合并（并用带 posterUrl 的权威版覆盖）。三处弹窗共用同一 `assets`+此函数+`isAssetInFilter`，一处改全覆盖所有分类。用测试号浏览器复现+验证通过。
4. 部署正式服 v1.0.0.36 + push。

### 更早（都已上线，细节在归档 CHANGELOG）
- **2026-07-21 测试服迭代**：B_232/B_252、资产库等待卡恢复、预览缩略图从 DB 读、道具风格(写实=手办不出真人)/印刷品 propify、道具@名脱钩+回填。
- **2026-07-20**：工作流断线漏删@名→死循环卡死输入框根治（"有缩略图才有效变蓝"）、B_42（工作流@引用的视频/音频被当参考图发 BytePlus→按 asset.kind 路由）、使用提示词只读自己那份引用包。
- **2026-07-19**：gpt-5.4-image-2 迁 OpenRouter 新图片接口（4K/画质档/16 参考图）+ GPT版老接口并存、img2img 修复、对话流重试卡槽/红字修复、预览页参考缩略图、生成链路服务端断线重连（`isTransientServerError`）。
- **2026-07-18**：搭独立测试服 staging + 版本号体系 + 部署铁律；视频三处根治（真人审核轮询/音频版权 Skip 素材/@音频名删不掉）。
- **2026-07-12~17**：资产入库/显示统一大改造（`media-asset-record.ts` 唯一权威入库）、上传内容哈希去重、上传命名全平台统一（`upload-name.ts`）、后台/工作流参考素材统一读取。
- **2026-07-11**：主服务器从马来完整迁到腾讯云新加坡。

## 下一个 AI

- **无遗留待推/待部署。** 非紧急待办见 `05-next-actions.md`（对话流"最多4张"改原生 n、清理旧 mention 死常量、复查 GenerationEvent"服务器繁忙"、M018/M019）。
- 改代码前记住三条铁律（见 00-README）；部署走 03 的腾讯 Docker 流程。
