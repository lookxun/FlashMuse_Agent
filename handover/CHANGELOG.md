# Current Handover Changelog（2026-07-21 重建起）

> 本批 CHANGELOG 从 2026-07-21 交接文档重建开始记。**此前的全部历史流水**（约 580KB，含 2026-06 起到 07-21 每一次改动/部署细节）在 `historical-handover-docs-last-used-2026-07-21/CHANGELOG.md`，遇到需要历史上下文的难题再翻。

## 2026-07-31（第二十二次会话）🚀 **v1.0.0.57 两服上线：工作流「其余只发标题」（按需加载第二阶段）+ 修掉一个真删数据的 bug**

> ✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.57`**，四域名全 200，**无 Prisma 迁移**。
> 正式服备份：`/opt/flashmuse/app-backups/20260731-031125-presync-v57`。
> 本批 = 上一批（第二十一次会话的骨架版按需加载，从未部署）**加上本次的第二阶段**，一起上线。

### 一句话：打开工作台时，除了活跃工作流，其余工作流**连画布都不查数据库、不下发**，只发标题

用户拍板原话意思：「以后一个人 100 多个工作流 1000 个工作流难道还一次性下发吗？那不卡才怪呢。」
上一批做的骨架版仍然是"每个工作流都发"（每节点约 560 字节）→ 1000 个工作流还是几十 MB，**随数据量线性膨胀**。
本批断根：

| | 老口径（上一批的骨架版） | 新口径（本批） |
|---|---|---|
| 数据库读 | 所有未删工作流的 `canvasJson` 全读出来再在内存里裁剪 | **只读元数据列**（`workflowMetaRowSelect`，不含 `canvasJson`）；再按 id 单独读那一两个要发的画布 |
| 下发 | 每个工作流都带一份瘦身画布 | 活跃的那一个 + 后端还有生成任务在跑的 → 完整画布；**其余连 `canvas` 键都没有**，只有 `canvasTrimmed: true` |
| 上行（PUT） | 客户端把骨架版原样发回来 | `getPersistableWorkflowItems` 把 `canvasTrimmed` 的 `canvas` 键**整个删掉**，一个字节都不发 |
| 「哪个工作流在生成」 | 骨架版里靠 `isRunning` 判 | 统一到 `isWorkflowItemRunning()`：加载过的看自己节点，只发标题的看服务端 `runningWorkflowIds` |

### ⭐⭐ 实测收益（正式服真实数据，`.runtime/measure57.js` 量的，gzip level 5）

| 用户 | 工作流数 | 节点数 | 老口径 gzip | **新口径 gzip** | 省 |
|---|---|---|---|---|---|
| ID_868181（最重） | 9 | 429 | 108.5 KB | **15.0 KB** | **86.2%** |
| ID_686996 | 18 | 103 | 115.0 KB | 37.1 KB | 67.7% |
| ID_708423 | 4 | 92 | 66.2 KB | 2.3 KB | 96.5% |
| ID_636611 | 7 | 135 | 30.4 KB | 6.1 KB | 79.9% |
| **全站合计** | | | **399.8 KB** | **100.1 KB** | **74.9%** |

⭐ 对照：上一任评估 M025 时算出"只能再省 31KB"→ 那是**只剥字段**的算法；**只发标题**在最重用户上省了 93.5KB。
本地 8 工作流/162 节点那个号：接口总响应 **137KB → 40KB**、`workflowItems` **69KB → 16KB**。

### ⛔⛔ 修掉一个真会删用户数据的 bug（本批最重要的一条，本地实测复现过）

`upsertWorkspaceWorkflows` 里取"库里现有画布"的那次查询**带了 `deletedAt: null`**：

- 用户删掉一个"只发了标题"的工作流后，客户端仍会继续把它（带 `deletedAt`）PUT 上来；
- 这张表查不到已删工作流 → `existingCanvas === undefined` → **三道防线全部失效**（都以它不为 undefined 为前提）
- → 那条工作流的 `canvasJson` 被客户端手里的空对象覆盖成 `{}` = **回收站里的画布被真删掉**。

本地实测：删除 `工作流_05` 后它的 canvas 从 279 字节变成 2 字节。修法 = **那次查询去掉 `deletedAt: null`**
（`existingActionCount` 仍只算未删的行，口径不变）。修完再删一次 `工作流_06`（3269 字节 / 5 条提示词）→ **画布完好**。
⚠️ 这个洞在上一批（骨架版）就存在，只是骨架版还留着节点、破坏没这么彻底。

### ⭐⭐ 现在的四道「绝不覆盖」防线（改这块前必读 `workspace-workflows.ts` 里的注释）

1. 客户端回传 `canvasTrimmed: true` → 不写 `canvasJson`。
2. **不依赖客户端标记的结构性兜底**：库里有内容、而客户端这份画布里**连 `nodes` 数组都没有** → 不写。
   ⭐ 判据故意用"有没有 `nodes` 数组"而不是"nodes 是不是空"：
   前端只要加载过画布，存库前的 `stripWorkflowItemTransientUploadState` 一定会写 `nodes: [...]`（哪怕空数组）
   → **「用户真的清空画布」传 `nodes: []`（照常写、清空能生效）**，「没加载过」传 `{}`（拦住）。两者结构上天然可分。
3. 与"库里画布摘成【第一阶段骨架版】"逐字段相等 → 不写（防部署窗口里的老标签页原样回传）。
4. `mergeWorkflowCanvasMedia` 里的字段级恢复（`prompt` 严格 `undefined` 才从库里补，`""` 必须让它覆盖）。

⛔ 三道 skip 都**只跳过 `canvasJson`**，标题/编号/`deletedAt` 照常写 —— 否则重命名/删除没打开过的工作流会失效。

### 改动文件（4 个，加上一批的共 7 个）

| 文件 | 本批干了什么 |
|---|---|
| `src/lib/workspace-workflows.ts` | 元数据列查询 + 两步取画布 + 四道防线 + 修掉 `deletedAt: null` 那个洞 |
| `src/app/api/workspace-state/route.ts` | 4 个调用处都先算 `runningWorkflowIds` 再传进去；两条 legacy 全量分支也补上 `runningWorkflowIds` |
| `src/components/chat-workbench.tsx` | 新增统一判定 `isWorkflowItemRunning()`（3 处共用）+ `stripWorkflowItemTrimmedCanvas()`（PUT 前删 canvas 键） |
| `src/lib/app-version.ts` | v56 → v57 |

### ✅ 验收（测试服 + 正式服，两台都真上号，控制台 0 error）

**测试服**：切换/补拉（提示词一字不差）｜点节点不崩（React #310）｜**真跑生视频**（Seedance 2.0 8s，`video_10_w2`，
生成中切走到别的工作流 → 那个工作流仍发完整版、`runningWorkflowIds` 返回它、跑完自动清）｜
**真跑生图**（`image_14_w1`、提示词保留、扣费生效）｜资产库新图名字正确（不是"图片生成"兜底名）｜后台 `/admin` 各页正常｜
**核对测试库：提示词/uploads/历史节点条数只增不减，另一个用户从没打开过的工作流字节数和 `updatedAt` 纹丝不动**。

**正式服**：登录｜对话模式｜工作流点节点不崩｜资产库（26 张缩略图都出来了）｜
**真跑生图**（`image_3_w1`，扣 3 分）｜**真跑生视频**（`video_1_w1`，扣 44 分）｜后台各页 0 error｜四域名 200｜app 日志无新错误。

### ⛔⛔ 一条**我写错、被用户当场揪出来**的验收结论（教训比结论本身值钱）

我在这里原本写过：「正式服那次生视频跑完时**我已经把浏览器标签关掉**，画布里地址仍是本地的
→ 证明服务端落地那刻直接改画布」。**这句是错的，已删掉。**

🗣️ 用户质疑：「正式服这个视频是我每一次用工作流就生出来的视频，怎么会是你测试生的呢？」
→ 我去查库，**"视频是我生的"这半句是对的**（`GenerationJob` 07-30 19:17:12，kind=video，
`workflowId` 非空，prompt =「一只白色小猫在草地上打滚，阳光温暖」= 我当场打的字，`reservedNames=["video_1_w1"]`；
而且该账号**以前在工作流里从没生过视频**，历史视频全是 `video_1_d3`/`video_1_d4` = 对话流的，所以工作流编号才从 1 起头）。
→ **但"浏览器已关"这半句是我编的因果**：时间线是 19:17 起任务、视频文件时间戳约 19:20 落地，
而我的标签页是**又过了 6.5 小时（用户离开期间）**才失效的 —— 落地那一刻页面很可能还开着、还在轮询。

⭐⭐ **教训（下一任务必照做）**：
- **"我看到的结果" ≠ "造成这个结果的原因"**。要断言"是服务端做的"，必须**让前端在那一刻确实不存在**，
  而不是"我后来回来看还在"。
- **正确的实验设计**（还没跑，见下面待办）：起生成 → **立刻查库确认那个节点此刻是 `isRunning:true` 且 `images` 为空**
  → **立刻 `browser_close` 整个关掉浏览器**（不是切标签）→ 等 1~2 分钟 → **只查库**：
  若节点变成「本地 `/generated/...` 地址 + `mediaSystemNames` 有 `image_N_wM` + `isRunning` 已清」，
  前端已经不在了，就**只可能**是服务端改的。图片版只花 8~10 积分，走的是同一个函数
  （`localizeAndFinalizeImages` 和 `runVideoJob` 都调 `applyWorkflowJobResultToCanvas`）。
- ⭐ **写交接文档时，凡是"因为 A 所以 B"的结论，先自问"我有没有 A 的现场证据"**；
  没有就写成"结果符合预期，但因果未验证"。夸大的结论会被下一任当既成事实继承。

**正式服数据核对（87 行，部署前后逐行 diff）**：
- **81 行完全没变**（字节数 + `updatedAt` 都一模一样），包括 ID_868181 那个 429 节点的号 → 从没打开过的工作流不会被碰。
- 变化的 6 行：2 行是我自己加的节点、1 行是真实用户自己在加东西（43→47 节点，**增加**）、
  3 行是 `bytes -1/-2` 但 `nodes/prompts/uploads/hist_media/hist_text/counted` **全部一致**（数字序列化精度差）。
- `remote_imgs` / `remote_videos` / `stuck_running` **全部 0**。

### ⭐⭐ 用户当场定下的新规矩：**本地/测试服/正式服一律用 `12424740@qq.com` 测试**

🗣️ **用户原话意思（2026-07-31）**：「以后本地，测试服和正式服都用 `12424740@qq.com` 这个号测试，
这个记录清楚让后面的 AI 不要弄错。」

起因 = 我这次正式服巡检**用了用户自己的管理员号 `lookxun@163.com`**（照的是当时 `03-deploy-and-servers.md` 的旧口径），
在**他自己的 `工作流_01` 里**加了 2 个节点、花了 47 积分。
→ 已把 `03-deploy-and-servers.md`、`AGENTS.md`、本文件全部改成新口径。**详见 `AGENTS.md` 里那条铁律。**

**我在正式服 `lookxun@163.com` 上留下的痕迹（下一任别当成用户自己的数据）**：
`工作流_01` 从 3 个节点变成 5 个（多了 `image_3_w1` 一杯咖啡 + `video_1_w1` 白猫打滚），
共扣 47 积分（15,844 → 约 15,797）。⭐ **用户没让删，先留着**；要删只删这两个节点。

### ⚠️ 留给下一任的三件事

1. ⭐⭐ **「服务端落地那刻直接改画布」这条还没真验过**（上面那段说明了为什么，以及正确的实验怎么做）。
   **在测试服用 `12424740@qq.com` 跑图片版即可，约 8~10 积分。**
   ⭐ 用户交代"测试内容不要删" → **新建一个工作流**来做这个实验，别动现有工作流。
2. **多标签页那条只验到一半**：两个标签页同时开同一个号，**数据没丢**（提示词条数不变）已验；
   "一个编辑 A、另一个在 B 各自落盘"的完整时序因为工具超时没跑完。按设计它更安全了
   （B 标签页手里 A 是只发标题 → 根本不会回写 A），但没实测。
3. **本地测试残留**：本地库 `工作流_05` 的 canvas 被上面那个 bug 洗成了 2 字节（它原本只有 1 个空文本节点、279 字节），
   已修好代码但那条数据没法还原。**只影响本地，线上没有这个问题。**



## 2026-07-30（第二十一次会话）🚀 **工作流改成「点哪个读哪个」（M025 用户拍板要做）+ 三处跨工作流遍历全部搬到服务端｜本地未部署**

> ⚠️ **本批未部署、未 bump、未提交**；线上仍 `v1.0.0.56`。`npx tsc --noEmit` 全绿，**无 Prisma 迁移**。
> 🗣️ 用户交代：「等做完下一个 AI 一起部署吧」+「**详细测试等下个 AI 部署完再做**」→ 本次只做了简单测试（全过）。
> 接手照 `05-next-actions.md` 顶部走。

### 起因与用户拍板

上一任把 M025 评估为"倾向不做"（gzip 后只剩 31KB 收益）。**用户否掉了这个结论**，理由是：

> 「如果只是算眼前的账那当然没必要做，没多少大。但是我们的项目还要一直运行的，
> 以后如果一个人 100 多个工作流 1000 个工作流难道还一次性下发吗？那不卡才怪呢。」

⭐ **教训：评估"要不要做架构优化"时，只算当下字节数是不够的，必须算「随数据量怎么增长」。**
上一任把它当成"省流量"来算，用户看的是"线性增长会爆"。

用户还追问了两个问题，**两个质疑都是对的，纠正了上一任交接文档里的错误**：

1. **「资产库预览提示词跟工作流为什么会有关系？应该是从数据库直接读那张图和提示词」** → 对。
   上一任把 `8374` 那段说成"取提示词"是看错了，它其实是在拼**左右翻页的清单**；
   提示词本来就走 `MediaAsset.sourcePrompt`（`media-asset-record.ts:163`），节点 prompt 只是老数据兜底。
2. **「前端如果读是一个个读，那保存也是一个个保存吧？为什么一定要整份覆盖？」** → 对。
   服务端**早就是逐行 upsert**（`workspace-workflows.ts:213` 明确注释"客户端没带的工作流绝不删"），
   真正的问题只是**前端那个自动保存定时器把手里全部工作流打包发一遍**。
   → 因此上一任设计的"三道防线"里有两道是建立在**错误前提**上的，本次简化成了正确的形状。

### 做了什么

**A. 骨架版下发 + 按需补拉**（`workspace-workflows.ts` / `workspace-state/route.ts` / `chat-workbench.tsx`）

只有「活跃工作流」+「画布里有节点正在生成的工作流」发完整画布，其余发骨架版
（去掉 `data.prompt` / `data.uploads` / `historicalMediaNodes` / `historicalTextNodes`，**节点连线一个不少**），
带 `canvasTrimmed: true` 标记。切过去时调 `GET /api/workspace-state?workflowCanvasId=xxx` 补拉，
补拉完成前画布位置显示「工作流加载中…」（失败给「重新加载」按钮）。

⭐ 活跃 id 有兜底（空/指向已删的 → 取 `updatedAt` 最新那个），照抄对话流 `nextActiveSessionId` 的口径，
否则会一个完整画布都不发、用户看到空白画布。

⭐ **为什么连 `historicalMediaNodes` 一起剥**：实测它占骨架版 **40%**（46.9KB/116.6KB），
而全站只有 `workflow-tldraw-canvas-inner.tsx`（只渲染活跃工作流）真读它，
`chat-workbench.tsx` 那两处（`3406`/`3446`）只是原样搬运。
⛔ **`countedGeneratedUrls` 故意不剥**：媒体累计计数的自愈逻辑（`chat-workbench.tsx:12320`）
靠"它是否存在"判断要不要重新播种，剥掉会把累计数字重置；才 4KB，不值得冒险。

**B. 三处跨工作流遍历搬到服务端**（这是按需加载的真正阻力）

| 原来 | 改成 | 顺带修掉 |
|---|---|---|
| 扫所有工作流找 `isRunning` | `generation-jobs.ts` 的 `getRunningWorkflowIds()` 查 `GenerationJob`，响应给 `runningWorkflowIds` | `isRunning` 是持久化标记、后台跑完不清 → 跳动点一直亮 |
| 扫所有工作流用 URL 反查节点（取名字/提示词） | `media-assets.ts` 的 `getSavedMediaOrigins()`，`/api/media-save-status` 返回 `origin` | 服务端数据比画布副本更全更准 |
| 扫所有工作流找远端地址、前端换本地再整份存回 | `workspace-workflows.ts` 的 `applyWorkflowJobResultToCanvas()`，落地成功时服务端直接改那个节点 | ⭐⭐ **原来只在用户开着页面时才换 → 关了页面就留着会过期的远端地址 = 死链** |

⭐ 前端 `hasAnyWorkflowGenerating` 现在是**混合口径**：已加载完整画布的用它自己的 `isRunning`（最实时），
骨架版的用服务端 `runningWorkflowIds` —— 这样就不需要它们的画布，按需加载才成立。

⭐ `applyWorkflowJobResultToCanvas` 换地址时**同步换 `mediaSystemNames` / `imageDimensions` 的键**
（它们是以 url 为键的），否则名字和尺寸会对不上；并清掉 `isRunning`/`taskId` 等等待态。

⭐ 加了一道并发兜底：`mergeWorkflowCanvasMedia` 里，客户端还挂着 `http(s)://` 远端地址而后端 job 已落地
→ 一律用 job 的本地地址（防"服务端刚改好、客户端又把旧的存回来"）。

**C. 三道防删数据的防线**（唯一会造成不可逆损失的地方，`upsertWorkspaceWorkflows`）

1. 客户端回传 `canvasTrimmed: true` → 不写 `canvasJson`；
2. **不依赖客户端**：这份画布与「库里画布摘成骨架版」逐字段相等（`stableStringify`，键顺序无关）→ 不写；
3. 字段级恢复：客户端**整个 `prompt` 键都没带**（严格 `undefined`）而库里有 → 从库补回。
   ⭐ **只认 `undefined`**：用户真清空时传 `""`，那种必须让它覆盖，否则永远清不掉提示词。

⛔ 两道都**只跳过 `canvasJson`**，标题/编号/`deletedAt` 照常写 —— 否则列表里重命名/删除
一个没打开过的工作流会失效（两条都实测过）。

### ⭐ 纠正了一个传了两轮的错误认知

上一任交接文档说的"**6 处跨工作流遍历**"是**高估的**。逐处点开看，
`getWorkflowMediaCounts`(2213) / `getWorkflowGeneratedMediaUrls`(2228) /
`reserveWorkflowMediaSystemNamesForItems`(5172) / 大图预览翻页(8374) 这 **4 处第一行就
`find(id === workflowId)`，只用一个工作流**，根本不是阻力。**真正跨工作流的只有 3 处**（已全部搬走）。
⛔ 以后别再照抄"6 处"这个数字。

### 简单测试（本地真登录 `12424740@qq.com`，8 工作流/162 节点，0 控制台 error）

切工作流自动补拉（41 条提示词全在）｜来回切 4 个不丢/顺序不乱/**打开不置顶没回归**｜
**重命名没打开过的工作流**（标题生效、画布 3269 字节纹丝不动）｜**删除没打开过的工作流**（生效、内容还在）｜
真跑生图 4 次全成功（`image_11_w3`~`image_15_w3`，扣费正常）｜**生成中切走别的工作流 → 仍发完整版 → 切回来正确回填**｜
`runningWorkflowIds` 空闲 `[]`/生成中有值/跑完自动清｜对话流 35 个对话 + 资产库各分类计数正常。

⭐⭐ **最关键的库级核对**：提示词/uploads/`historicalMediaNodes` 条数**与基线一字不差**；
没打开过的工作流连**字节数和 `updatedAt` 都完全没变**（工作流_04 保持 94839 字节 / 08:52:50.26）；
**0 个残留远端地址、0 个卡在 `isRunning`**。

**收益**：接口响应 **233KB → 137KB（-41%）**，骨架版画布合计 **117KB → 69KB（-41%）**。

### ⚠️ 三个必须传下去的坑

1. **`③` 的 `origin` 本地没能实机跑通** —— 本地网络快，服务端落地完前端手里根本没有远端地址，
   `/api/media-save-status` 那条轮询不触发。只用 SQL 验了数据源字段齐全。
   **线上跨境慢会真的走到** → 部署后必须确认新生成的工作流图片名字/提示词正确。
2. **视频链路本地没跑**（动了 `runVideoJob` 成功分支）→ 部署后必须真跑一次生视频。
3. ⭐ **`image-job-awaiting-localize` 反复出现不是 bug** —— 服务端自己在跨境下载图片存盘，
   慢就每 15 秒重排队直到成功。本地历史上有 50 条、最早 2026-07-22。⛔ 别当成新故障（查了一轮才排除）。

### ⚠️ 仍未解决 / 用户未拍板

- 骨架版仍是"每个工作流都发"，每节点约 560 字节 → **1000 个工作流仍是几十 MB**。
  彻底断根 = 其余工作流只发标题，**三处遍历已搬走、地基已备好**，⛔ 但用户还没拍板要不要继续。
- **M026（单个工作流内的节点也分页）** —— 用户明确说「先不做，以后做」，方案与难点见 `06-memo-tasks.md`。

## 2026-07-30（第二十次会话）🚀 **v1.0.0.56 两服上线（含 4 处 nginx）+ 三条高危验收全过 + 🗣️ M025 量完数据、留给用户和下一个 AI 讨论**

> ✅ **四方同步 `v1.0.0.56`**（正式服 = 测试服 = 本地 = GitHub），四域名全 200，**无 Prisma 迁移**。
> 正式服备份 `/opt/flashmuse/app-backups/20260730-203104-presync-v56`。
> **本次没写新功能代码** —— 干的是：把第十九次会话攒的两批部署上线、真上号验收、然后用实测数据回答用户那个问题（M025 还值不值得做）。
> 🗣️🗣️ **会话末用户交代：「把 M025 记录清楚，我跟下一个 AI 讨论一下」**
> → **M025 是"待讨论"，不是"已否决"。⛔ 下一个 AI 在用户拍板前别动那块代码。**

### 0. 用户交代与执行顺序

用户拍板走「方案 A」：**先测试服 → 上号测试不崩 → 再正式服 → 上号测试不崩，崩了立刻修 → 最后回来判断 M025**。
全程按 `AGENTS.md` 铁律执行（测试服先行、只在测试服那步 bump、正式服原样同步不再 bump、每台部署完都真上号）。

### 1. 部署过程（命令级留档，下次照抄）

| # | 干什么 | 结果 |
|---|---|---|
| 0 | `node scripts/bump-version.mjs`（v55→**v56**）+ `npx tsc --noEmit` | 全绿 |
| 1 | 打 tgz（**11 个文件**，清单法 `.runtime/v56-files.txt`）→ scp → 解到 staging | ⭐ `tar -tzf` 复核过，新文件 `src/lib/permanent-admins.ts` 在包里 |
| 2 | 测试服 `up -d --build staging-app`（后台 + 轮询） | ~90s，entrypoint 输出 `No pending migrations to apply.` |
| 3 | `sync-ali-test.sh` → `pub56.sh`（发布版本信号） | `x-app-version: v1.0.0.56`、8080=200 |
| 4 | nginx 测试服两处（腾讯 staging + 阿里 8080） | **两处的 diff 都只有本次新增行**，`nginx -t` 通过 |
| 5 | **测试服 11 项实机验收** | 全过（见下节） |
| 6 | `prodsync56.sh`（备份 + staging→prod rsync） | 版本号复核 = v56 |
| 7 | 正式服 `up -d --build flashmuse-app` | ~110s，`No pending migrations` |
| 8 | `syncali56.sh`（`.next/static` → 阿里**正式**镜像） | OK |
| 9 | `pub56prod.sh`（发布信号 + 健康检查） | 四域名 main/api/ali/static **全 200** |
| 10 | nginx 正式两处 | 腾讯正式覆盖前 diff 全是新增行；阿里正式**跑幂等增量脚本**、插入 2 处 |
| 11 | **正式服实机巡检** | 全过、0 控制台 error、真跑生图成功 |

⭐ **腾讯正式 nginx 覆盖前那次 diff 很关键**：输出里**一行 `<` 都没有**（全是 `>` 新增）
→ 证明"仓库这份是服务器那份的严格超集"、期间没人手改过服务器，才敢覆盖。
**以后覆盖服务器 conf 前一定先看 diff 里有没有 `<`。**

### 2. ⭐⭐ 三条高危验收（都是"改错了会真删用户数据"的，全部实测通过）

1. **`feedbackLogs` 的 PUT 合并**（① 的风险点）
   库里 0 → 点「喜欢」→ **1** → 点「不喜欢」→ **2** → ⭐ **刷新页面**（此时前端手里根本没有 feedbackLogs）再点一次 → **3**。
   → 证明「下行不发 + PUT 只带新增 + 服务端按 id 合并」这条链路**不会抹掉历史，跨刷新也不会**。
   ⛔ **排查时差点误判**：一开始查库发现是 **0**，我以为被自己的 PUT 洗了。
   **靠"看另一个没登录过的用户 `lookxun` 那行的 `updatedAt` 是部署前的 10:00、也是 0"** 才确认**本来就是空的**。
   ⭐ **教训：怀疑"数据被自己弄丢了"时，先找一个"这次没被碰过"的行做对照。**
2. **消息投影的 PUT 恢复**（③ 的风险点）
   库里 82 条消息，被投影掉的字段 `originalPrompt` **44** / `itemPrompts` **11** / `videoPrompts` **9**、`content` 82 条全在
   → **一条都没丢**，`restoreProjectedMessageFields()` 确认有效。
3. **提示词 UI**：23 条历史消息的提示词全部正常显示（含一条 500+ 字超长提示词、@引用、参考图缩略图），
   点「使用提示词」正确回填到输入框。

### 3. 实机验收明细

**测试服（`12424740@qq.com`）11 项全过**：白名单开关置灰（`disabled=true`）/ 打接口关它返回 **400** /
别的账号照旧可开可关 / 响应带 `Content-Encoding: gzip` 且**不含 `feedbackLogs`** / 首屏 **30 条**消息 + 「加载更早消息」能加载 /
使用提示词正常 / 反馈合并 0→1→2→3 / 发新消息+生图后刷新数据全在 / 工作流点节点不崩 / 资产库+后台各页 0 error /
**真跑生图成功**（扣 8 分）+ **真跑生视频成功**（Kling v3.0 Standard 5s，扣 44 分）。

**正式服（`lookxun@163.com` = ID_415958）**：登录 / 对话模式 / 工作流点节点**不崩**（菜单齐全）/ 资产库缩略图 /
**真跑生图成功**（Gemini 3 Pro Image Preview，15,854→15,844 扣 10 分）/ 后台 10 个页签无 pageerror /
白名单开关 `disabled=true` + 打接口返回 400 / **0 控制台 error**。

### 4. nginx 生效验证

- **gzip 四处都验过**：阿里测试 8080、腾讯 main、阿里 ali 都返回 `Content-Encoding: gzip`。
- ⭐⭐ **落盘临时文件告警：部署前 8 条 → 部署后 0 条**（`buffered to a temporary file`），部署后无 5xx。
- ⛔ **别的项目没被影响**：阿里正式那份 conf 里还有 `/tiantangqiyuan/`，用的是幂等增量脚本（只插 4 行×2 处），
  部署后 `/tiantangqiyuan/` 仍 **200**。

### 5. 🗣️ M025（②工作流 canvas 瘦身）**量完了数据，但没拍板 —— 用户要和下一个 AI 讨论**

用户要求"部署完再判断还值不值得"。**我量完的数据 + 我的建议如下；最终由用户定。**
⭐ **完整讨论材料（是什么 / 值多少 / 建议理由 / 真要做的三步方案 + 必测清单）在 `06-memo-tasks.md` 的 M025。**

实测（脚本 `.runtime/m025.js`，正式服真实数据，v56 上线后跑）：

| 用户 | canvas 未压缩 | **gzip 后（真实传输量）** | 压缩率 | M025 做完还能再省 |
|---|---|---|---|---|
| ID_868181（9 工作流/429 节点，最重） | 655.4KB | **105.1KB** | 16.0% | **31.0KB**（29.5%） |
| ID_686996（18 工作流/103 节点） | 447.6KB | 111.3KB | 24.9% | 17.9KB（16.1%） |
| ID_708423 | 325.9KB | 64.2KB | 19.7% | 14.0KB（21.7%） |
| ID_636611 | 159.9KB | 29.2KB | 18.3% | 2.4KB（8.3%） |
| ID_673536 / ID_193006 | 79.2KB / 58.5KB | 14.0KB / 12.5KB | ~18-21% | 0.6KB / 2.0KB |

**我建议不做的三条理由**：
1. **病根已物理堵死**：缓冲区现在 32×32k = **1MB**，最重用户压缩后才 ~105KB → **10 倍余量**，
   不可能再落盘（`buffered to a temporary file` 告警实测已归 0）。
2. **剩余收益只有 ~31KB**，且只有最重那一个用户这么大（多数人只几 KB）→ 对耗时基本无感。
3. ⛔ **风险与收益不成比例**：要改前端工作流加载路径 + 新增按需拉取接口，
   而 `workflowItems` 是**整体覆盖回写**的（`chat-workbench.tsx:10329`），漏一处 PUT 恢复 = **真删用户画布**。

⚠️ **要摆给用户的反面论据（别只说好听的）**：v56 那批 ①③④ 对 ID_868181 **一点用都没有**（省 0.0%），
因为他响应的 **98.7% 都在 canvas 里** —— "总省 45.2%"是全体平均，落到最重的用户头上是 0。
**M025 是唯一能治他那一类用户的手段**（只是压缩之后他的绝对值也只有 105KB 了）。

⭐⭐ **本次最有价值的一条通用教训**：
**`data.prompt` 之所以能压到 16%，是因为它是纯中文提示词文本还大量重复 —— 正好是 gzip 最擅长的。
所以"要不要为了省字节改代码"这类决策，必须先 `zlib.gzipSync` 量一遍压缩后的大小，
别拿未压缩字节做决策。**（已写进 `AGENTS.md` 铁律）

### 6. 踩到的小坑（省下一个人的时间）

1. ⛔ **`grep -o 'v1\.0\.0\.[0-9]*' app-version.ts` 会先命中注释里的举例**（输出 `v1.0.0.1`）→
   验版本号必须 `grep 'export const APP_VERSION'`。
2. ⛔ **`WorkspaceMessage` 直接有 `userId`**，不用 join `WorkspaceSession`；`User` 表**没有 `userCode` 列**。
   先查 `information_schema.columns` 再写 SQL。
3. ⛔ **Playwright 点「使用提示词」会被那个 hover 提示浮层挡住**
   （`group-hover/prompt` 的 `absolute` 层 intercepts pointer events）→ 换一条**短提示词**的消息点就行。
4. ⛔ **登录面板的输入框要用面板作用域定位**：`page.locator('input').first()` 会打到**首页那个输入框**上（我踩了）。
5. ⭐ **`page.waitForTimeout` 循环等生成结果会超工具 120s** → 改成外面 `Start-Sleep` 再截图看。

---

## 2026-07-30（第十九次会话 · 后半）🔧 **永久后台白名单 + 工作区响应体瘦身（省 45.2%）+ 查清两个线上问题**

> ✅ **本批已随 v1.0.0.56 于第二十次会话全部上线**（原文下面那句"没部署没提交"已过时，留档备查）。
> 🗣️ **② 工作流 canvas 瘦身（M025）= 已量完数据、留给用户和下一个 AI 讨论**，见上面第二十次会话那条。

### 0. 本次做了什么（一句话）

① 把 `lookxun@163.com` 做成**永久管理员**（后台白名单开关锁死，保证后台永远有账号能进）；
② 顺着上一节部署时发现的「打开工作台偶发转圈 17~30 秒」一路查到底，**查清根因**并做掉了三分之二的优化
（实测总省 45.2%）；③ 顺手查清了那批 502 到底是什么。

---

### 1. 永久后台白名单（批次 A）

**为什么要做**：「后台白名单」存在 `.env.local` 的 `ADMIN_EMAILS`，而后台「帐号功能管理」页能改它
→ 存在"手滑把最后一个管理员也关掉 = **全世界都进不了后台**、只能 ssh 上服务器改文件才能救"的死局。

**唯一来源** `src/lib/permanent-admins.ts` 🆕（`PERMANENT_ADMIN_EMAILS` + `isPermanentAdminEmail()`），
⚠️ **故意零 import** —— `admin.ts` 依赖 `system-settings.ts`，常量放这两个里任何一个都会**循环依赖**。

**四个咽喉全部堵上**（`grep ADMIN_EMAILS` 复核过，没有任何地方绕过 `getAdminEmails()` 直读 env）：

| 咽喉 | 作用 |
|---|---|
| `lib/admin.ts` 的 `getAdminEmails()` | 无条件把永久管理员并进清单 → **即使 `.env.local` 被改坏/写没了也还是管理员**（最底层兜底） |
| `lib/system-settings.ts` 的 `updateAdminEmailWhitelist()` | 落盘时强制补回（第二道保险） |
| `admin/api/users/admin-whitelist/route.ts` | 单账号关闭时直接 **400** 拒绝（防绕过前端直接打接口） |
| `admin/api/users/feature-bulk/route.ts` | 「一键全关」时保留 `self + 永久管理员` |
| `admin/page.tsx` + `admin-account-features-panel.tsx` | 服务端算 `adminWhitelistLocked` 传给面板 → 那行开关 `disabled` + hover 说明。**前端不硬编码邮箱** |

---

### 2. ⭐⭐ 「打开工作台转圈 17~30 秒」：查清根因 + 做掉 ①③④（批次 B）

> 排查全过程、实测数据、坑、以及**还没做的那一半**，全部沉淀在 **`06-memo-tasks.md` 的 M024 / M025**。
> ⛔ **下一个 AI 别重复排查，先读那两条。**

#### 2.1 根因（nginx 自己写在 warn 日志里，不是推测）

```
an upstream response is buffered to a temporary file /var/cache/nginx/proxy_temp/... while reading upstream,
request: "GET /api/workspace-state?summary=1&panel=chat"
```
→ nginx 默认 `proxy_buffers` 只有 **8×4k=32KB**，而这个接口响应线上实测最大 **1,188,114 字节（1.19MB）**
→ nginx 只能**把整个响应先写磁盘临时文件再转发**，叠加跨境传输 = 那 17~30 秒。
**它也是全站所有 `/api/` 里最大的响应**（按 body 字节排序 Top-25 全是它）。

#### 2.2 ⛔ 一个走偏过的判断（留档警示）

我一开始判断是"**消息一次全发**"，**这是错的** —— 消息早就有分页
（`DEFAULT_WORKSPACE_MESSAGE_LIMIT`、`hasMore`/`nextBefore`，会话列表也有 10 条上限）。
**是用户提醒"我记得已经做了分页啊"才纠正的。**
⭐ 教训：**下结论前必须逐层量字节，不能看着代码"觉得"**。后面就是靠三层实测才找到真正的大头。

#### 2.3 三个真正的大头（逐层量出来的）

| # | 大头 | 实测最大 | 内部构成 |
|---|---|---|---|
| 1 | `workflowItems[].canvas` | **655.4 KB**（ID_868181，占其响应 **98.7%**） | `data.prompt` 43.7% / `data.uploads` 9.1% / `data.imageDimensions` 9.0% |
| 2 | 活跃会话的 50 条消息 | **785.6 KB**（ID_686996，平均 8~18 KB/条） | `generationMeta` 45.7% / `content` 21.9% / `videoPrompts` 21.9% |
| 3 | `feedbackLogs` | **727.8 KB**（ID_332396，占其响应 **93%**） | `context` **79.7%** / `message` 15.4% |

⭐⭐ **最有价值的一条洞察**：`generationMeta.itemPrompts`(138.6KB) + `generationMeta.originalPrompt`(138.5KB)
\+ `videoPrompts` 的值(134.2KB) + `content`(138.8KB) **装的基本是同一批提示词** ——
550KB 里约 **415KB 是同一份提示词的重复副本**。
而前端读取本来就是**层层回落**：
`videoPrompts?.[url] ?? generationMeta?.itemPrompts?.[i] ?? generationMeta?.originalPrompt ?? content`
→ 所以「值相同就少发一层」**语义完全不变、前端一行都不用改**。

#### 2.4 做了什么

| 项 | 改了什么 | 文件 |
|---|---|---|
| ① | **`feedbackLogs` 下行不再发**。⭐ 前端确认**根本不读它**：唯一看似在用的 `getAgentGenerationModel(..., { feedbackLogs })` 是**死参数**（函数体没引用），其余只是"从响应恢复→原样写回→追加"。PUT 侧用 `mergeFeedbackLogs()` 按 id 去重合并、留最近 300 条 → **一条不丢** | `api/workspace-state/route.ts` |
| ③a | **重复提示词副本不下发**：`projectWorkspaceMessageForClient()`；配对的 `restoreProjectedMessageFields()` 在 PUT 时把字段补回库 | `lib/workspace-sessions.ts` |
| ③b | `DEFAULT_WORKSPACE_MESSAGE_LIMIT` **50 → 30** | `lib/workspace-sessions.ts` |
| ④ | **nginx 大响应不落盘 + JSON gzip**（4 处：腾讯正式 / 腾讯测试 / 阿里测试 / 阿里正式） | `nginx/flashmuse.conf`、`deploy/staging/*.conf`、`deploy/ali/ali-add-proxy-buffers.sh` 🆕 |

⭐ **实测收益**（`scripts/measure-workspace-state-size.mjs`，8 个重度用户真实数据）：
**合计 4905 KB → 2688 KB，总省 45.2%**
- ID_332396 **省 94.7%**（772→41 KB）、ID_271898 **省 70.9%**（473→138 KB，消息 415→80 KB）
- ID_673536 省 57.8%、ID_686996 省 44.0%、ID_315163 省 42.4%
- ⚠️ **ID_868181 省 0.0%** ← 它 98.7% 是 canvas，正好是**没做的 ②**
- ⭐ 叠加 ④ 的 gzip 后，下行还能再压到这个数的 15%~30%

#### 2.5 ④ nginx 的两个额外发现

- ⚠️ **仓库里的 `nginx/flashmuse.conf` 和服务器上那份不一致**（服务器多了 443 server 块 + `/generated` 的 CORS 头，
  仓库还是旧的单 server 版）→ **已按服务器实际内容同步回仓库**。⭐ 以后改 nginx **先改仓库再部署**，别只在服务器手改。
- ⚠️ **阿里测试服（8080）那台 `nginx.conf` 里 `gzip_types` 整段是注释的** → 默认只压 `text/html`，
  **API 的 JSON 一直没被压过**。所以必须在 server 块里显式写 `gzip_types`。
- ⛔ **阿里正式（ali/static）那份 conf 里还有别的项目的配置（`/tiantangqiyuan/`）** →
  整份覆盖会违反「绝不能影响其它项目」铁律 → 改用**幂等增量脚本** `deploy/ali/ali-add-proxy-buffers.sh`
  （只在两个 server 块插 4 行，自带备份 + `nginx -t` + 失败自动回滚 + 可重复跑）。

#### 2.6 ⛔ 三个"差点踩、以后别踩"的坑

1. **`feedbackLogs` 不能在 `baseState` 上剥** —— `baseState` 在 `route.ts` 里会被**回写数据库**
   （`hasJsonChanged` → `update`），在它身上剥等于**真删用户数据**。只能在往 `Response.json` 塞的那一刻剥。
2. **下行投影必须配一个 PUT 侧恢复** —— `upsertWorkspaceMessages` 是 `messageJson: message` **整体覆盖**，
   前端把瘦身版存回来就等于删字段。（`workspace-workflows.ts` 的 `mergeWorkflowCanvasMedia` 早就是这个模式。）
3. **投影只能"整体相等才省"，绝不能逐项省** —— `itemPrompts` 是**按下标**取的、`videoPrompts` 的回落目标又是
   `itemPrompts[i]`，逐项删会下标错位或回落到**另一条**提示词上，那才是真 bug。

#### 2.7 ⭐ 没做的 ②（工作流 canvas 瘦身）→ 登记为 M025，等用户拍板

它是**剩下最大的一块**（ID_868181 有 655KB 全在这），但必须改前端工作流加载路径：
前端有 **8 处跨工作流全量遍历 canvas**，而且局部更新是 `{ ...node.data }` 展开回写 → **缺字段就会真删画布**。
`AGENTS.md` 铁律第一条要求「有影响先告诉用户、等确认再改」，且用户刚验收过工作流那两处修复
→ **方案 / 受影响的 8 个前端点 / 必测清单全写进 M025，等拍板。**

---

### 3. 502 查清了：**部署窗口现象，不是 bug**

- 正式服今天 24 条 502 **全部挤在 `10:02:35~40` 和 `10:05:39~41` 两个时刻**，正是那次
  `up -d --build` 和 `force-recreate` 的容器重启窗口；错误全是
  `connect() failed (111: Connection refused) while connecting to upstream` = **app 容器当时没在监听**
  （不是超时、不是代码报错）。测试服那 54 条同理，散在 07/21、07/24、07/27、07/28 各次部署窗口。
- ⚠️ **但它确实会打到真实用户**：那两个窗口里 3 个不同客户端
  （`104.249.174.135` / `122.225.228.122` / `60.186.53.107`）的 `/api/auth/me`、`workspace-instance`、
  `generation-status`、**`PUT /api/workspace-state`** 都吃了 502（最后那条 = **那一次工作区保存丢了**）。
- 想彻底消除需要**零停机切换**（蓝绿双容器 + upstream 切换 + 健康检查），属架构改动，用户没要求过 → 先不做。
  现实缓解：**别在高峰部署、build 窗口尽量短、别反复 recreate**。

### 4. ⭐ 排查方法论沉淀（下次遇到"某接口慢"照这个来）

1. **先分层掐表，把范围缩到一层**：容器内直打 app（39~44ms）→ 宿主打 nginx（1.5~3.7ms）→
   本机走 TLS（20ms）→ 跨境（0.43s 基线）。**四层都快 = 问题在"响应体大小"而不是"处理慢"。**
2. **去 nginx 日志按 body 字节排序**（`awk` 取第 10 段），一眼看出哪个接口最大、最大多少。
3. **然后逐层量字节**：先量顶层各字段 → 再钻进最大那个字段量它的子字段 → 再钻一层。
   本次钻了三层才找到"提示词存了 4 份"。⛔ **不要在第一层就下结论。**
4. **改完必须再量一次**（`scripts/measure-workspace-state-size.mjs` 那种脚本，跑在真实重度用户数据上），
   否则不知道到底有没有效果、也不知道还剩多少。
5. ⭐ **怀疑"新版本变慢/报错"时，先拿还没升级的那台做对照** ——
   本次就是靠"部署前的 v54 也有 30.8s 的 401"排除了"是新代码引起的"。

---

## 2026-07-30（第十九次会话 · 前半）🚀 **v1.0.0.55 两服部署上线 + 14 项验收全过 + 收尾四方同步**

> ✅ **结果：四方同步 `v1.0.0.55`**（commit `e6a66e0`），四域名全 200，两台都真上号巡检过、0 控制台 error。
> 本次**没写任何新功能代码**，就是把第十八次会话那批（下面那条）完整部署掉 + 实机验收 + 收尾。

### 0. 一句话

按铁律顺序 **先测试服 → 实机验收 → 再原样同步正式服**，把「帐号功能管理 + 解除限制按账号 + 工作流两处修复 + 红字映射修正」这批上线；
两台的 Prisma 迁移都成功、两件部署后手工事都做完、两台都真跑了生图和生视频。

### 1. 部署实跑记录（命令级，下次照抄）

| # | 干什么 | 结果 |
|---|---|---|
| 0 | `node scripts/bump-version.mjs`（v54→v55）+ `npx tsc --noEmit` | 全绿 |
| 1 | 打 `.runtime/v55.tgz`（29 条路径，**含迁移目录 + 3 个新 API 目录 + `app-version.ts`**）→ scp → 解到 `/opt/flashmuse-staging/app` | 落地后 `ls` 复核过迁移目录和 `admin/api/users/` 5 个子目录 |
| 2 | 测试服 `nohup sudo docker compose up -d --build staging-app` | build ~150s；⭐ **entrypoint 真跑了迁移**：`Applying migration 20260730000000_user_unlock_limits_enabled` → `All migrations have been successfully applied.` |
| 3 | `sudo bash /opt/flashmuse-staging/sync-ali-test.sh` | `staging ali sync done` |
| 4 | `.runtime/pub55.sh`：`.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS` 改 false + sed `PUBLISHED_APP_VERSION` + `force-recreate staging-app` | `x-app-version: v1.0.0.55`、HTML 版本号 v1.0.0.55、外网 `:8080` 200 |
| 5 | 测试服上号巡检 + 后台 14 项验收 | 全过（详见第 2 节） |
| 6 | `.runtime/prodsync55.sh`：备份 `app-backups/20260730-180159-presync-v55` → staging→prod rsync → `grep APP_VERSION` 复核 | v1.0.0.55、迁移目录与新 API 目录都在 |
| 7 | 正式服 `nohup sudo docker compose up -d --build flashmuse-app` | build ~90s；**迁移同样成功应用**；HTML 版本号 v1.0.0.55 |
| 8 | `.runtime/syncali55.sh`：`docker cp .next/static` → rsync 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/` | `ali static sync done` |
| 9 | `.runtime/pub55prod.sh`：正式服 `.env.local` 改 false + sed 版本 + `force-recreate` + 四域名 curl | `x-app-version: v1.0.0.55`；main/api/ali/static **全 200** |
| 10 | 正式服上号巡检（含真跑生图 + 生视频） | 全过 |
| 11 | `git add -A` → commit `e6a66e0` → `git push origin main` | 四方同步 |

⭐ **`.env.local` 两台原来都是 `BYTEPLUS_UNLOCK_LIMITS=true`，都改成了 `false`** 并随 `force-recreate` 生效。

### 2. 实机验收结果（14 项，⭐ 是必测项）

| # | 期望 | 结果 |
|---|---|---|
| ⭐1 | 后台出现「帐号功能管理」、4 卡片 + 表格、0 error | ✅ |
| ⭐2 | 单账号「解除限制」开关能存下来 | ✅ 卡片数字 0→1→2 |
| ⭐3 | 表头总开关弹**项目样式白色确认框** | ✅ 弹「关闭全部帐号的『通用模式』…」白色框（**不是**浏览器原生 alert）；点了取消，没真改 |
| 4 | 「后台白名单」列**没有**总开关 | ✅ |
| ⭐5 | 关自己的白名单 → 报错 | ✅ 弹「操作未完成 / 不能把自己移出后台白名单」（伴随一条**预期的** 400，不算 bug） |
| 6 | 「模型开关」页 BytePlus 那行「解除限制」已消失 | ✅ 全页搜不到「解除限制」，BytePlus 段落还在、排版正常 |
| 7 | 用户管理卡片 = `正常用户/禁用用户`、有「在线用户」、表格无通用模式列 | ✅（测试服 `2/0`、正式服 37 用户） |
| ⭐8 | 头像下沿绿色「在线」胶囊、横排、行高没变 | ✅ 前台开着 → 在线用户 0→1、胶囊出现 |
| ⭐9 | 开着解除限制真跑生图 + 生视频 | ✅ 测试服 Seedream 5.0 Pro 出图（扣 3）、Seedance 2.0 Mini 5s 出视频（扣 27）；正式服 Seedream 4.5 出图（扣 3）、Kling v3.0 Pro 5s 出视频（扣 59） |
| ⭐10 | 关着解除限制 + 敏感提示词 → 红字是"输入文本敏感"而**不是**"更换参考素材" | ✅ 红字：`(B_1) 模型因色情/暴力/隐私安全等原因拒绝出图…以下是模型返回的拒绝原因：“The request failed because the input text may contain sensitive information.”` |
| ⭐11 | 工作流点节点出「使用提示词」、点了生成带提示词+参考图的新节点、画布不崩 | ✅ 两台都验；正式服实测生成了带「一只橘猫坐在窗台上，阳光洒进来」+ 参考图的新节点，**并直接用它跑成功了生图** |
| ⭐12/⭐13 | 工作流列表"只打开不置顶 / 拖动或生成才置顶" | 用户已在本地复验过，本次不重复；测试服确认了点节点不崩 |
| 14 | 对话流发消息 / 文本链路 | ✅ 正常回答（验 unlockLimits 透传没改坏文本链路） |

### 3. ⭐⭐ 本次留下的两条硬知识

1. **「解除限制」的真实作用被实测印证了**：它**不跳过任何审核**，只是把发给 BytePlus 的 `model`
   从公开模型名换成专属 Endpoint ID（端点自带更宽策略）。同一条敏感提示词：开着能出图、关掉被
   `input text may contain sensitive information` 拦。第十八次会话写在 `01` 里的那条认知**得到线上验证**。
2. ⚠️ **`/api/workspace-state` 偶发 17~30s 甚至 502 是既有现象，别误报成本批 bug**。
   判据：**部署前的正式服 v54 实测 5 次里也有一次 30.8s**。属跨境 + 冷启 + 负载，不是 v55 引入的。
   （教训：怀疑"新版本变慢/报错"时，**先拿还没升级的那台做对照**，别直接归因给刚上的代码。）

### 4. ⚠️ 运营上必须知道的一件事（本批的既定副作用，不是 bug）

迁移让 `unlockLimitsEnabled` **默认 false = 全站「解除限制」当场全关**（用户就是要这个）。
**正式服目前只给 `lookxun@163.com` 开了**，其余 36 个账号都是关的。
→ 原来靠全局开关吃专属 Endpoint ID 的用户，从 v55 上线起内容敏感的提示词会开始被平台拒。
→ **有人反馈"以前能出图现在被拒"，去 `/admin?tab=account-features` 把他的「解除限制」打开即可。**

### 5. 红字状态

**没跑归档脚本**（按用户交代）。正式服此刻：**待排查 9 条 / 2 种、兜底桶 0 条、已归档 745**，
9 条全是「审核 / 内容策略类」= 我们改不了、按铁律就该一直亮着。**继续等攒。**

---

## 2026-07-30（第十八次会话）🧩 **纯本地开发批：后台「帐号功能管理」新页 + 解除限制改按账号 + 工作流两处修复 + 红字映射修正**

> ✅ **本批已于第十九次会话作为 `v1.0.0.55` 部署上线**（见上面那条）。下面的"未部署/未提交"描述是当时的状态，留档备查。

### 0. 本次会话在干什么（一句话）

先修了工作流两个问题（快捷菜单缺「使用提示词」、左侧列表"只打开就置顶"），
然后做了后台新页 **「帐号功能管理」**（把「通用模式」「解除限制」「后台白名单」三个开关按账号集中管理，
其中**「解除限制」从全局总开关改成按账号**，动到了图片/视频/文本三条生成链路），
最后修了一条红字映射错误（输入文本敏感被错怪成"参考素材没过审"）并给拒绝原因加了中文映射。

**改动文件：24 改 + 7 新增**（`git status --short` 原样）：

```
M AGENTS.md                                          M021 取消的说明
M handover/00-README.md · 05 · 06                    本次交接文档
M prisma/schema.prisma                               User.unlockLimitsEnabled
M src/app/admin/admin-system-settings-panel.tsx      移除「解除限制」总开关
M src/app/admin/admin-users-panel.tsx                去掉通用模式列 + 卡片合并 + 在线胶囊 + SmallStat 支持 ReactNode
M src/app/admin/page.tsx                             新 tab + 新数据分支 + 在线集合
M src/app/api/agent-plan/route.ts                    透传 unlockLimits
M src/app/api/chat/route.ts                          透传 unlockLimits
M src/app/api/conversation-memory/route.ts           透传 unlockLimits
M src/app/api/image/route.ts                         透传 unlockLimits
M src/app/api/intent/route.ts                        透传 unlockLimits
M src/app/api/video/route.ts                         透传 unlockLimits（5 处创建任务）
M src/components/chat-workbench.tsx                  置顶判定 + getWorkflowMediaSnapshot + onChange meta
M src/components/workflow-tldraw-canvas-inner.tsx    使用提示词 + userInteractedRef 全套
M src/components/workflow-tldraw-canvas.tsx          onChange 类型加 meta
M src/lib/admin-overview.ts                          在线判定改用公用口径
M src/lib/admin.ts                                   ADMIN_EMAILS 优先读 .env.local
M src/lib/error-message.ts                           输入文本敏感精确规则 + 拒绝原因中文字典
M src/lib/generation-jobs.ts                         异步 job 透传 unlockLimits
M src/lib/openrouter-video.ts                        视频两层透传 unlock
M src/lib/openrouter.ts                              图片/文本 unlock 参数 + ChatRequest 字段
M src/lib/system-settings.ts                         writeLocalEnvValues 抽出 + updateAdminEmailWhitelist + unlock 参数
?? prisma/migrations/20260730000000_user_unlock_limits_enabled/
?? src/app/admin/admin-account-features-panel.tsx    新页面
?? src/app/admin/api/users/admin-whitelist/          白名单开关
?? src/app/admin/api/users/feature-bulk/             三开关批量（一键全开）
?? src/app/admin/api/users/unlock-limits/            解除限制开关
?? src/lib/account-features.ts                       按账号开关的唯一读取入口
?? src/lib/online-users.ts                           「在线」判定唯一口径
```

`npx tsc --noEmit` 全绿。本地已跑 `prisma migrate deploy`（本地库已有新列）。

---

### 1. 工作流：图片/视频快捷菜单加「使用提示词」

- **做法 = 复用，没写第二套**：右键菜单那份真身是 `addNodeFromPrompt`（`workflow-tldraw-canvas-inner.tsx:3327`），
  原来只通过 props 给右键菜单组件；快捷菜单（`WorkflowSelectedNodeOverlay`）不接 props、靠 `runtime` context 拿能力
  → 把 `addNodeFromPrompt` 挂进 `WorkflowRuntime` 类型 + `useMemo`（含依赖数组），两处菜单调同一个函数。
- 按钮放在图片/视频**分支合流之后**（下载按钮之前），**一处代码两种节点都生效**。
- 上传素材节点与右键一致**置灰禁用**（`isWorkflowUploadLikeTitle`），带 title 说明原因。
- ⛔ **全程没加 Hook** —— 该组件 `if (!selected) return null;` 之后加 Hook 会触发 React #310 把画布搞崩（老坑）。
- ⚠️ **未实机验证**（没点过），部署前建议在测试服点一次。

### 2. ⭐⭐ 工作流左侧列表「只打开就置顶」修复（用户报的 bug）

**现象**：工作流 02/04/08 只要点开（什么都不做）就跳到列表最上面，其它工作流不会。

**根因（查了才知道，不是排序逻辑的问题）**：
- 排序按 `updatedAt` 倒序（后端 `workspace-workflows.ts:270` + 前端 `chat-workbench.tsx:8212` 各排一次）；
- **`WorkspaceWorkflow.updatedAt` 数据库不自动刷新**（schema 里没 `@updatedAt`，自动刷新的是没人排序用的 `storedAt`）→ 完全听前端；
- 前端唯一写它的地方是 `chat-workbench.tsx` 的 `updateWorkflowCanvas`：`meaningfulChanged ? Date.now() : 原值`；
- 而打开工作流时 `normalizeState()`（`workflow-tldraw-canvas-inner.tsx:1547`）会把旧数据**洗一遍**
  （补默认值 / 迁移 title / 改非白名单 `ratio` / 剔悬空连线 / 历史节点去重），洗完的结果被回传
  → **拿"脏的老数据"和"洗干净的新数据"比字符串，必然不等 → 被判成用户改了东西 → 置顶**。
- 所以"只有部分工作流置顶"= **只有那几条的 DB 数据里还残留未归一化的旧字段**。

**⛔ 上一个 AI 修错了方向**：`getWorkflowMeaningfulSnapshot` 里那串 `stripKeys`（`chat-workbench.tsx:3383`）就是上次的补丁，
注释里直接写了"工作流_02 / _04 jump to the top"。**这条路治不好**：剔不完，且再往下剔会把"用户改比例/换模型"这类真操作也屏蔽掉。

**本次修法（在源头标记"是不是用户干的"）**：
- 画布里加 `userInteractedRef` + `markUserInteracted`（`:2976`），**切换 workflowId 时清零**（`:3252`）；
- 标 true 的时机：**画布上 pointerdown**（`:3822`，拖节点必然先经过）、**keydown**（外壳 `onKeyDownCapture`）、
  **拖文件进画布**（`onDropCapture`）；
- `onChange` 签名加第二参 `{ userInitiated?: boolean }`（内层 + `workflow-tldraw-canvas.tsx` 壳层类型都改），
  **5 个出口全部带上**：`emitEditorState`、900ms 几何轮询、连线增删两处、`updateState`；
- 父级判定改成 `shouldBumpToTop = meaningfulChanged && (meta?.userInitiated !== false || mediaChanged)`；
- 新增 `getWorkflowMediaSnapshot`（`chat-workbench.tsx:3375`）作**兜底**：只看成品媒体 url（images/videoUrl/audioUrl），
  **生成出新图/新视频一律算变化**（用户明确要求"生成前后不一样也该置顶"），即使标记没打上；
- `meta` 缺省按 true（兼容其它调用方，宁可多置顶不漏用户真操作）。

**⛔⛔ 本次踩的坑（下一个 AI 必看）**：第一版我把 `updateState` 里硬编码成 `userInitiated: true`，
以为"走这个函数的都是用户操作" —— **错**。打开带媒体的工作流时有**媒体系统名回填**（`:4895`，`needsUpdate` 那段）
会自动走 `updateState`，回传的是**整份已归一化的 state** → 被标成用户操作 → 照样置顶。
用户刷新后反馈"还是一样"，就是这个洞。**已改成读 `userInteractedRef`**，并在该处写了 ⛔ 警告注释。
同类会在打开时自动跑的还有：生成任务恢复、视频尺寸补齐。

**遗留**：⚠️ **修完后用户没再复验**（他直接转去做后台了）。部署前建议实测：
①点开 02/04/08 什么都不做 → 顺序不动；②拖一下节点 → 置顶；③生成一张图 → 置顶。
⚠️ **已经被顶乱的历史顺序不会自己复原**（`updatedAt` 是持久化的历史值），本次只保证"以后不再乱顶"。

### 3. ⭐⭐⭐ 后台新页「帐号功能管理」+ 「解除限制」改按账号（本批最大改动）

#### 3.1 需求（用户原话拼起来）
左侧加一栏「帐号功能管理」，右侧布局照抄用户管理但**去掉积分/最近IP/最后登录时间/状态四列**；
保留通用模式开关 + 新增「解除限制」「白名单」两个开关；卡片显示总用户数/三个开关各自开启数；
**大表排序按"开着的开关越多越往上"**；三个总开关放**表头**、点了一键全开（**批量语义，不是全局覆盖**）；
后来追加：**白名单的一键全开隐藏**（太危险）；**所有开关默认关闭，只有 `lookxun@163.com` 的白名单默认开**。

#### 3.2 三个开关分别存在哪（⭐ 关键认知）
| 开关 | 存储 |
|---|---|
| 通用模式 | `User.generalModeEnabled`（老字段，本页只是多一个入口） |
| **解除限制** | **`User.unlockLimitsEnabled`（本批新增列 + 迁移）** |
| **后台白名单** | **`.env.local` 的 `ADMIN_EMAILS`，不在数据库里** |

**白名单为什么不能进 DB**：`ADMIN_EMAILS` 是全站唯一的管理员判定来源（`isAdminEmail`，15 处引用），
而那个判定函数是**同步**的、没法查库；改成查库要把所有后台鉴权染成 async，风险太大。
所以开关做的是"改邮箱清单"：写 `.env.local` + 同步 `process.env`，**当场生效不用重启**
（与「模型开关」页保存设置同一套机制）。为此把写 env 的合并逻辑抽成公用 `writeLocalEnvValues`
（`system-settings.ts`），`updateAdminSystemSettings` 和新增的 `updateAdminEmailWhitelist` 共用，没复制第二份。
`admin.ts` 的 `getAdminEmails()` 改成 **优先读 `.env.local`、再回落 `process.env`**（原来只读 process.env）。

#### 3.3 「解除限制」到底是什么（⭐ 之前所有人都容易误解）
它**不跳过任何审核或限制**。唯一作用（`system-settings.ts:280` `getBytePlusModelForRequest`）：
**开 = 发我们的专属 Endpoint ID（`ep-2026...`），关 = 发公开模型名（`seedream-4-5-251128`）** ——
靠端点自带的更宽平台策略生效，不是我们自己绕。本次实测印证：同一条敏感提示词，
开着能出图、关掉被 `InputTextSensitiveContentDetected` 拦住。

#### 3.4 改成按账号的做法（⭐ 设计决策，别推翻）
- `getBytePlusModelForRequest(key, unlock?)` 加**可选**参数，**故意保持同步**：
  一旦在里面查 DB，会把 `getBytePlusImageModelName` / `getTextProviderConfig` / `getBytePlusVideoModelName`
  全部染成 async。`unlock` 传 `undefined` 时回落全局 env → 向后兼容 + 兜住拿不到 userId 的调用点。
- 新增 **`src/lib/account-features.ts` 的 `resolveUnlockLimitsForUser(userId)` 作唯一读取入口**
  （查库失败/无 userId 一律回落全局，绝不因这个开关把生成弄挂）。⛔ 禁止各处自己 `prisma.user.findUnique`。
- 三条链路透传（都在 route/job 层先算好布尔值往下传）：
  - **图片**：`api/image/route.ts`（`user?.id`）+ `generation-jobs.ts`（**`job.userId`**，异步 job 脱离 session 也有）；
    `ImageGenerationOptions` 加 `unlockLimits?`，两个调用点 `openrouter.ts:1254 / 1759`。
  - **视频**：`openrouter-video.ts` 的 `createOpenRouterVideoTask` options 加 `unlockLimits` → 透传给
    `createBytePlusVideoTask`（两层）；`api/video/route.ts` 在 handler 顶部算一次 `const unlockLimits = ...`，
    **5 处创建任务共用**。
  - **文本**：`ChatRequest` 加 `unlockLimits?`；`getTextProviderConfig(model, mode, unlock?)`；
    四个 route 传值：`chat` / `agent-plan`（`planAgentTask`）/ `conversation-memory` / `intent`（`classifyOpenRouterIntent`）。
- ⭐ **有一处故意没改**：`rewriteGptImagePromptForSafety`（工作流 AI 安全改写）拿不到 userId，仍走全局回落。
  它优先用 OpenRouter 的 gpt-5.5，只在兜底时才碰 BytePlus，影响极小。

#### 3.5 迁移与"默认全关"（⚠️ 部署最关键的一段）
- 迁移 `prisma/migrations/20260730000000_user_unlock_limits_enabled/migration.sql`
  = **只有** `ALTER TABLE "User" ADD COLUMN "unlockLimitsEnabled" BOOLEAN NOT NULL DEFAULT false;`
- ⛔ **中途我写过一行 `UPDATE "User" SET "unlockLimitsEnabled" = true`（为了"保住改造前行为"），
  被用户否掉 —— 他要的是"所有开关默认关闭，需要谁用再单独开"。那行已删除，且在 migration.sql 里留了 ⛔ 注释，
  别再加回去。**
- **本地额外做的收尾**（服务器不用做、但要知道存在）：
  - 因为迁移已跑过又改了文件 → **checksum 会不一致**，所以先回退再重跑：
    `.runtime/rollback-unlock-limits-migration.sql`（DROP COLUMN + 删 `_prisma_migrations` 那行）→ `migrate deploy`。
  - 存量数据归零：`.runtime/reset-account-feature-flags.sql`（把 `generalModeEnabled` / `unlockLimitsEnabled`
    全置 false）。⭐ 原来有 2 个账号开着通用模式（`lookxun` 与 `12424740`），**一并关掉了**。
  - `.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS` 从 `true` 改成 **`false`**（否则"所有账号都关、但无 userId 的
    边角调用仍解除限制"语义矛盾）。改完重启了 dev（env 变化热更不生效）。
  - 白名单没动：`ADMIN_EMAILS=lookxun@163.com` 在 `.env` 里，本来就只有他一个，正好符合要求。

#### 3.6 新增的三个接口（都照抄 `users/general-mode` 那 22 行的模板，鉴权三行一模一样）
| 路径 | body | 说明 |
|---|---|---|
| `POST /admin/api/users/unlock-limits` | `{ userId, unlockLimitsEnabled }` | 改 `User.unlockLimitsEnabled` |
| `POST /admin/api/users/admin-whitelist` | `{ userId, whitelisted }` | 改 `ADMIN_EMAILS`。⛔ 两条护栏：**不许把自己移出白名单**（否则当场把自己锁在后台外，只能上服务器改文件才能救）、目标用户必须真实存在 |
| `POST /admin/api/users/feature-bulk` | `{ feature, enabled }` | 三开关**共用一个**批量接口（`generalMode` / `unlockLimits` / `adminWhitelist`）。⛔ 白名单批量关闭时**保留当前操作者** |

⭐ `feature-bulk` 的 `adminWhitelist` 分支**代码还在，但前端已无入口**（白名单总开关按用户要求隐藏了）。

#### 3.7 前端新页 `src/app/admin/admin-account-features-panel.tsx`
- 表格列：用户ID | 用户 | 通用模式 | 解除限制 | 后台白名单（**只有开关，没有展开详情/弹窗** —— 那些是用户管理的职责）。
- **排序：开着的开关数量多的靠前**，同数量按邮箱稳定排（避免刷新乱跳）。搜索 + 分页（15/页）照抄用户管理。
- 卡片 4 张：总用户数量 / 通用模式开启 / 解除限制开启 / 后台白名单。
- **总开关在表头、跟在列名后面**（和行内开关上下对齐，一眼看出"这列全开"），带悬停提示；
  `featureColumns` 里用 `bulk: boolean` 控制显示 → **白名单是 `bulk: false`**（不显示总开关）。
- **弹框用项目通用样式**（照抄工作流「删除节点」确认框：白卡片 + 右下"取消 / 黑底长按钮 `px-12` 确定"），
  ⛔ **不用 `window.confirm` / `window.alert`**（会显示"localhost:3000 显示"这种系统字样）。
  两个弹框：批量确认 + 出错提示（比如白名单护栏的报错）。
- 复用 `admin-users-panel.tsx` 导出的 `SmallStat` / `UserAvatar`；为此把 **`UserAvatar` 入参从 `AdminUserRow`
  收窄成 `Pick<AdminUserRow, "email"|"nickname"|"avatarUrl">`**（原来写死整行类型，精简行必须强转）。

#### 3.8 `page.tsx` 三处 + 其它页面清理
- 新 tab 要改**三处**（漏一处 tab 会被吞回 overview）：`AdminTab` 类型、`adminNavItems`（图标 `RiShieldKeyholeLine`）、
  `getAdminTab()` 白名单；再加 `if (activeTab === "account-features")` 数据分支。
- 「模型开关」页（`admin-system-settings-panel.tsx`）**移除了「解除限制」总开关**，原地留注释说明去哪了。
- 「用户管理」页**移除「通用模式」开关列**（8 列→7 列，两处 `colSpan` 8→7），删掉 `toggleUserGeneralMode`，
  原地留 ⛔ 注释"别再往用户管理表格里加功能开关列"。展开详情里那行**只读**文字「通用模式：已开启/未开启」保留。

### 4. 红字映射修正：`InputTextSensitiveContentDetected` 被错怪成"参考素材没过审"

**用户在本地 workflow_04 生图触发**（`.runtime/generation-diagnostics-log.jsonl` 捞到真实原文）：
```
{"error":{"code":"InputTextSensitiveContentDetected",
 "message":"The request failed because the input text may contain sensitive information..."}}
```
即**输入的提示词文字**被判敏感。但红字显示的是
`(B_238) 参考素材未能通过平台审核（可能涉及真人、隐私或版权）…建议更换参考素材` → **完全指错方向**，
用户会去反复换参考图，而参考图根本没问题。

**原因**：`error-message.ts` 最下面那条**宽松兜底**（原文含 `sensitive` 就说参考素材没过审）把它抓走了。
⭐ **这与 07-29 修过的「成品图片被判敏感」是同一类病**：缺精确规则 → 掉进兜底 → 错怪参考图。

**修法**：在兜底之前加精确规则（`error-message.ts:252` 附近），映射到**统一那句「模型拒绝」**
（`buildModelRefusedMessage`）—— 用户拍板就用这句。⭐ 因为复用现成文案，
**后台 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 一行都不用改**。
（中途我提议过单独一句更精确的文案、也写了 `INPUT_TEXT_SENSITIVE_MESSAGE` 常量，被用户否掉，**已删除**。）

**顺带按用户要求做了「拒绝原因中文映射」**：`buildModelRefusedMessage` 尾巴上原来贴的是平台原始英文 JSON
（用户看不懂），新增 `UPSTREAM_REFUSAL_DETAIL_DICTIONARY` + `describeUpstreamRefusalDetail`：
- 认识的 code 翻中文：Input/Output × Text/Image/Video/Audio Sensitive、`content_policy_violation`、
  `safety system`、`copyright`（泛化兜底**必须排最后**）；
- ⛔ **不认识的一律原样保留** —— 宁可英文难看，也绝不丢信息（否则以后出新错误码我们在后台就成瞎子）；
- ⛔ **模型自己说的话不会被字典吃掉**（"抱歉，我不能…"原样显示，字典只认平台错误码）。
- 效果：那条红字从 219 字降到 78 字 → `…以下是模型返回的拒绝原因：“输入的提示词文字被平台判定含敏感信息”`。
- ⭐ `MODEL_REFUSED_PREFIX` 一个字没动 → 后台归一化不受影响、老数据不裂。

**回归**：`.runtime/check-refusal-detail-dictionary.mjs`（5/5）+ `.runtime/check-input-text-sensitive-mapping.mjs`（4/4）。
⚠️ 中途有一条 FAIL 是**测试用例写错**（不认识的错误码根本走不到"模型拒绝"那条路，落的是最终兜底），不是代码问题。

### 5. 用户管理页卡片改造 + 「在线」标识

- 卡片仍 5 张：`总用户` / `今日新增` / **`正常用户/禁用用户 95/7`（合并）** / **`在线用户`（新增）** / `总积分余额`。
  ⭐ 合并那张卡**只有禁用的数字是红色**，正常数字和斜杠保持黑色 → 为此把 `SmallStat` 的 `value`
  从 `string` 放宽成 `ReactNode`。
- **「在线」判定复用项目已有口径**（概览页那个「当前在线用户」本来就在用），抽成
  **`src/lib/online-users.ts`**（`ONLINE_WINDOW_MS` / `getOnlineSessionWhere` / `getOnlineUserIds`），
  **概览页 `admin-overview.ts` 也改成用这一份**（原来内联，再复制一份就是"该统一却分叉"）。
  判定 = `activeWorkspaceSeenAt` 在 **1 分钟**内 + session 未过期 + 用户未禁用。
  ⭐ **用 `activeWorkspaceSeenAt` 不是 `lastSeenAt`**：后者任何带登录态的请求都会刷新（会虚高），
  前者只由前台工作台心跳更新（`/api/auth/workspace-instance`，`chat-workbench.tsx:10164` **每 2 秒**）。
  窗口取 1 分钟是因为浏览器对**后台标签页**会把定时器节流到约 1 分钟一次。
  ⚠️ 语义边界：**只有开着前台工作台才算在线**（只登录不开工作台、或只开后台，都不算）。
- **在线标识 = 头像下沿的绿色胶囊「在线」**（实心 `bg-emerald-500` 白字，11px + `font-medium`）。
  ⭐ **`absolute -bottom-3` + 父级 `relative`**：绝对定位不参与布局 → **永远不会把表格行撑高**
  （用户硬要求）。`-bottom-3`(12px) 是"尽量往下"的实际上限：头像下沿到行分隔线约 13.5px
  （文字块比头像高出的 ~1.5px + 单元格 `py-3` 的 12px）。
  ⛔ **必须带 `whitespace-nowrap`** —— 绝对定位的包含块是 36px 宽的头像容器，不加会让"在线"两个字**竖着断行**（踩过）。
  ⛔ 别改成 flex 竖排，那会真的撑高行。
- `AdminUserRow.isOnline` 做成**可选**字段：展开详情走 `/admin/api/records/user-detail`，那边不算在线，缺字段不该报错。

### 6. 备忘变更

- **M021（对话流 AI 改写重做）取消** —— 用户 2026-07-30 明确说不做了，`AGENTS.md` 里那句"要重做必须先解决展示模型"
  已改成"**彻底不做了，别再提**"。
- **M022（给 `ID_636611` 补 197 积分）取消** —— 图本来都在他资产库里，不是白扣，不补。**任何人都没动过他的积分。**
- **M023（`connection_limit`）重写**：从"加 25~30"改成"**等它下次真犯病、拿到 `pg_stat_activity` 现场数据再改**"。
  写清了三个坑：①病因 A（池子太小）/ B（慢查询占住连接）解法相反，别照抄 25~30；
  ②**改 `.env.local` 无效**（`docker-compose.yml` 的 `environment:` 会覆盖），要改两个 compose；
  ③别想在测试服压测求这个数（空载 + 与正式服共享同一台物理机）。

### 7. ⛔ 本次会话踩的坑（下一个 AI 省时间）

1. **⛔⛔ 我用 PowerShell `Set-Content` 改了 `src/lib/openrouter.ts` → 给文件加了 BOM**（第 1 行进了 diff）。
   中文没坏（控制台显示的乱码只是终端编码），但**违了 AGENTS 铁律**。已用 .NET `UTF8Encoding($false)` 清掉 BOM 并补回结尾换行。
   **教训：改源码只用 edit/write 工具，一次都别偷懒。**
2. **⛔ `updateState` 里不能硬编码 `userInitiated: true`**（详见第 2 节）—— 打开工作流时的自动回填也走它。
3. **⛔ 绝对定位元素在窄父容器里会让中文竖排** —— 记得 `whitespace-nowrap`。
4. **⛔ 改了已应用过的 migration 文件 → checksum 会不一致**，本地要"回退 + 重跑"才干净（见 3.5）。
5. **⛔ `npx prisma generate` 被 dev server 占着 dll 报 EPERM** —— 先停 dev server（老坑，又踩了一次）。
6. **⭐ 排查工作流列表排序时的正确姿势**：别猜排序函数，直接去查"谁写 `updatedAt`" ——
   数据库不自动刷新的字段，写入点一定在前端。

---


## 2026-07-29（第十七次会话）🚀 **v1.0.0.54 两服部署完成 + 实机巡检全绿 + 红字整轮清零（B_xxx 归 0，开新一轮）**

### 0. 本次会话在干什么（一句话）

把第十六次会话积压的 12 个文件作为 **v1.0.0.54** 部署上线（测试服 → 实机验收 → 正式服 → 实机验收），
然后按用户要求把**所有历史红字一次性归档、B_xxx 计数器归 0**，从 v54 上线时刻起重新开始一轮红字排查。

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.54`**。无 Prisma 迁移（两服 entrypoint 均 "No pending migrations"）。
📦 **commit `3d9f776`**（19 个文件：10 个 src + `scripts/archive-resolved-generation-failures.mjs` + `AGENTS.md` + 7 份 handover）。

**v1.0.0.54 实际带上线的代码文件（10 个 src + 1 个 script）**：

```
src/lib/app-version.ts                            v1.0.0.53 → v1.0.0.54
src/components/chat-workbench.tsx                 ⭐ 上传完当场转正（A5 前端根治）+ 4 个跟踪上报
src/app/api/client-error/route.ts                 上传链路客户端上报落盘到 upload-diagnostics-log
src/app/api/video/route.ts                        ⭐ data: 参考图落盘后送审（A5）／凭证过期当场重送审
src/lib/local-assets.ts                           ⭐ 上传大图按 90% 质量原地压缩（A1 真修，不动尺寸）+ .rotate()
src/lib/generation-jobs.ts                        runVideoJob 三个失败分支补日志 + 连续失败上限
src/lib/openrouter-video.ts                       轮询失败改用 video-provider-poll-failed 事件名
src/lib/video-diagnostics-log.ts                  summarizeVideoReference 补 data 分支
src/lib/error-message.ts                          A1/A2/A4 明确映射 + api key 收紧 + 环境类单列 + B5/B6 合并
src/lib/image-upload-validation.ts                格式白名单唯一来源 + 压缩阈值/质量常量
src/lib/upload-rules.ts                           删掉 bytePlusImageFormats
scripts/archive-resolved-generation-failures.mjs  ⭐ 新增 --reset-all 整轮清零 + 上一批的新规则/护栏/dry-run 明细
```


### 1. ⭐⭐ 用户本次新加的两条硬要求（已写进 `AGENTS.md` + `03-deploy-and-servers.md`）

| 要求 | 落地位置 |
|---|---|
| **每部署完一台就必须真上号点一遍看有没有崩**（curl 200 ≠ 没崩），测试服和正式服**都要**，崩了立刻修 | `AGENTS.md` 部署铁律节 + `03` 的「部署铁律」新增**最小巡检 6 项**；测试服流程加第 7 步、正式服流程加第 9 步（含回滚指引） |
| **红字全部归档掉、B_xxx 从 1 重新计数、只看新长出来的** | 归档脚本新增 `--reset-all` 模式；`AGENTS.md` 里原来那句"B 编号永不重置"已改写 |

⛔ **`--reset-all` 与日常按规则归档是两回事，别混用**：日常仍走 `RESOLVED_RULES`（逐个根因查清才归档），
`--reset-all` 不看规则也不看全局护栏，**只在用户明确说"全部归档/清零/重新开始"时跑**。

### 2. 部署过程（照抄可复现）

- 本地 `node scripts/bump-version.mjs` → **v1.0.0.53 → v1.0.0.54**；`npx tsc --noEmit` 全绿。
- **测试服**：12 文件 tgz（`.runtime/v54.tgz`）→ scp `/tmp` → `tar -xzf -C /opt/flashmuse-staging/app`
  → `up -d --build staging-app`（No pending migrations）→ `sync-ali-test.sh` → `PUBLISHED_APP_VERSION: "v1.0.0.54"` + force-recreate
  → `x-app-version: v1.0.0.54`、`101.37.129.164:8080` 200、`staging-static` 200。
- **正式服**：备份 `/opt/flashmuse/app-backups/20260729-214852-presync-v1.0.0.54` → staging→prod 整份 rsync（**不再 bump**）
  → `up -d --build flashmuse-app` → `.next/static` 同步阿里**正式**镜像 → `PUBLISHED_APP_VERSION` = v54 + force-recreate
  → `x-app-version: v1.0.0.54`、**四域名 main/api/ali/static 全 200**。
- ⚠️ 复习到的老坑：`up --build` 之后 `x-app-version` 仍是**上一版**是正常的（那个头发的是运行时 env，最后一步才改），
  这时判断新代码上没上去要看 **HTML 里的版本号**。

### 3. ⭐ 实机巡检结果（两台都过，0 控制台 error）

| 验收点 | 测试服 | 正式服 |
|---|---|---|
| 登录 | ✅ `12424740@qq.com` | ✅ `lookxun@163.com` |
| 对话模式渲染 / 历史消息 | ✅ | ✅（Agent 模式正常应答） |
| 工作流 tldraw 画布 + 点节点弹浮层 | ✅ **不崩**（React #310 老坑没复现） | ✅ **不崩** |
| 资产库 | ✅ | ✅ |
| 真跑生图 | ✅ 对话流 3 张参考图合成 + 工作流快捷编辑各一次 | ✅ 工作流 Seedream 4.5 2K 出图 |
| 真跑生视频 | ✅ Kling v3.0 Standard | ✅ Kling v3.0 Pro |
| 后台 `/admin?tab=failures` | ✅ | ✅ |

**A5 前端根治验证通过**：上传当下就打了 `POST` **和** `PATCH /api/asset-upload-temp`；
点发送后**没有第二次 PATCH、没有 `/api/upload-image`**，`/api/image` 请求体里 `referenceImages` 全是 `/generated/...`（**零 base64**）。

**A1 压缩验证通过（两台都实测）**：`5033630 → 1082578` 字节（**-78.5%**，quality 90）；
`3000x4000 orientation=6` 压完变成 `4000x3000 orientation=undefined` —— **`.rotate()` 把方向烧进像素了，像素总量没变、显示方向正确**。
小图（978B）**完全没被碰**，日志里不出现 recompress 事件。

⭐⭐ **造测试图的坑（下一个 AI 省半小时）**：拿 `Math.random()` 生成的**纯噪声大图压不下去**
（实测 3780661 → 4750606 反而变大），只会命中 `upload-image-oversized-recompress-skipped` 这条兜底分支，
**验不到真正的压缩路径**。要造"像真照片"的图：正弦/余弦渐变 + 少量噪声 + `.blur(1.1)` + `quality:99`，
配 `withMetadata({ orientation: 6 })` 才能同时验方向。

⭐ **同图去重是在服务端按 contentHash 做的**：重复上传同一张图**不会新建文件**
（日志 `asset-upload-temp-post-dedup-hit`，直接复用已压缩好的那个 url），
输入框里虽然多出一个缩略图，但 `/api/image` 的 `referenceImages` 里是**去重后的 3 个**。

### 4. ⭐⭐ 红字整轮清零（本次的收尾动作）

```
# 先 dry-run（铁律），再 apply；两台都做
sudo docker exec -w /app flashmuse-flashmuse-app-1        node scripts/archive-resolved-generation-failures.mjs --reset-all
sudo docker exec -w /app flashmuse-flashmuse-app-1        node scripts/archive-resolved-generation-failures.mjs --reset-all --apply
sudo docker exec -w /app flashmuse-staging-staging-app-1  node scripts/archive-resolved-generation-failures.mjs --reset-all --apply
```

| | 正式服 | 测试服 |
|---|---|---|
| 归档条数 | **221** | 46 |
| B_xxx 计数器 | `675` → **0** | `59` → **0** |
| 归档后待排查 | **0** | 0 |

后台 `/admin?tab=failures` 复核：**待排查 0 / 原因 0 种 / 兜底桶 0**，已归档累计 **745**。
下一条线上报错会是 **`B_1`**。计数器文件 = `.runtime/error-code-counter.txt`（bind-mount 到 `/opt/flashmuse/data/runtime/`，容器重建不丢）。

⚠️ **归档 ≠ 每条根因都修好了**（B 表那些提供商侧的问题依然存在），只代表"这批历史数据不再计入待排查"。
文字全部保留、后台里划掉可追溯，`resolvedNote` 里写明了是整轮清零。

### 5. ⭐ 部署后跟踪点巡检（全绿）

| 事件 | 期望 | 实际 |
|---|---|---|
| `client-send-time-commit-still-needed` 等 4 条 | 0 | **全 0**（= 上传即转正没有漏网路径） |
| `upload-image-oversized-recompressed` | 有量 | 1（刚实测那张） |
| `upload-image-oversized-recompress-failed` | 0 | 0 |
| `video-provider-poll-failed` / `video-job-poll-error-streak-exceeded` | 0 | 0 |

### 6. 本次踩到的操作坑

- ⛔ **PowerShell 内联 `node -e "...'...'..."` 里带引号/中文/`$` 一律炸**（本次 `docker exec node -e` 直接被本地 PS 解释坏）
  → 一次性脚本写成 `.js` 文件 → `scp` → `docker cp` 进容器 → `docker exec -w /app node x.js`。
- ⛔ **`page.locator('text=视频生成')` 在对话流里会命中 7 个元素**（历史消息里那句"当前已切换到视频生成模式"也含这四个字）
  → 用 `getByRole('button', { name: ... })` 或 `getByText(..., { exact: true })`；
  输入框用 `page.locator("div[contenteditable='true']").last()`（页面里有多个）。
- ⭐ 工作流画布节点里的输入框点不到时，用 `run_code` 的 `page.mouse.click(x, y)`（老经验，本次再次生效）。
- ⭐ **上号巡检要花真钱**：正式服这轮真跑掉 3 分（生图）+ 59 分（Kling Pro 5 秒视频）。用户已认可这是必要成本。
- ⭐ **部署是热的**：正式服容器刚起来，`docker logs` 里就有别的真实用户（`ID_315163`）的视频在存盘
  → `up -d --build` 窗口尽量短，别反复 force-recreate。

### 7. ⭐ 本次会话的决策脉络（下一个 AI 想知道"为什么这么做"看这里）

| 用户说了什么 | 我做了什么 |
|---|---|
| 「先看交接文档和更新日志，告诉我做到哪了、接下来做啥」 | 读 `00`/`05`/`03`，核对 `git status` + `APP_VERSION`，汇报"A 表已收口、12 文件待部署、下一步直接部署" |
| 「你全部部署掉到测试服，然后上测试服查下有没有出问题，如果没问题就部署到正式服，部署好正式服**也要上号查**一下…要保证部署完服务线上没有问题，用户还能用别崩掉。**这一条以后写到部署步骤里**」 | 走完整两服部署 + **两台都上号实机巡检**；把这条固化成**最小巡检 6 项**写进 `AGENTS.md` + `03`（测试服流程第 7 步 / 正式服流程第 9 步 + 回滚指引） |
| 「部署完以后把红字失败**全部归档掉**，bxxx 数字也**重新计数从 1 开始**。现在从部署完开始看后面新出现的红字，**新一轮开始**。等红字多了以后再排查问题」 | 给归档脚本加 `--reset-all` 独立模式（不看规则/不看护栏 + 计数器归 0），两服 dry-run → apply；同步改掉 `AGENTS.md` 里原来那句「B 编号永不重置」；`05` 顶部改成"别急着排红字，先看攒了多少" |
| 「把本对话框内所有做的内容更新到交接文档和更新日志」 | 本条 CHANGELOG + `00`/`01`/`02`/`03`/`05`/`07` 全部更新（含命令级部署留档、上传链路两处新行为、Playwright 选择器坑、造测试图配方） |

⭐ **注意用户这次主动改了一条既有铁律**（B_xxx 永不重置 → 允许整轮清零）。
以后再遇到"文档里的铁律和用户当下要求冲突"时：**按用户当下要求做，同时把铁律原文改掉并注明是谁、哪天改的**，
别留一份自相矛盾的文档给下一个人。


## 2026-07-29（第十六次会话）⭐⭐ **A 表 9 条全部收口**：修掉 A5 + 查清 A3/A7（原表述都是错的）+ A1/A2/A4 加明确映射 —— ⚠️ **本地改动未部署未 push（v1.0.0.53 不变，没 bump）**

### 0. 本次会话在干什么（一句话）

接着上一批的 **A 表**排红字。用户逐条点：先 A5 → 又批了前端根治 → A3 → A7 → 最后"剩下 6 条全查、能改的改掉、改不了的说明" → 再点破 A1 的真根因。
结果 **A 表 9 条全部处理完毕**：A5/A1 真修、A3/A7 查清（**两条的原描述都已过期**）、A2/A4 加明确映射、A6/A8 本来就不用动、A9 数据不足改不了。

⚠️ **无 Prisma 迁移。`npx tsc --noEmit` 全绿。12 个文件未部署未 push、版本号没 bump。**
🚀 **用户明确交代：下一个 AI 直接部署**（分步清单在 `05-next-actions.md` 顶部）。

### 0.5 ⭐ 本次会话的完整决策脉络（下一个 AI 想知道"为什么这么改"看这里）

| 用户说了什么 | 我做了什么 | 关键转折 |
|---|---|---|
| 「A5开始查」 | 查到根因 = 参考图混进 `data:` base64，送审给不出公网地址 → 整单毙 | 顺着查到源头是"发送那一刻才转正、失败就静默退回 dataURL" |
| 「那就做1+3」（服务端落盘兜底 + 日志统一） | 服务端 `data:` 落盘后送审 + `summarizeVideoReference` 补 `data` 分支 | — |
| 「这个你说提根因。。我没看懂」 | 用大白话把"上传→转正→发送"三步讲清 | — |
| 「那这个能不能改成不要发送那一刻转正？上传完了直接转正呢？」 | 去读代码发现**转正只是搬文件、不建 DB 记录**，而且**工作流本来就是上传完一次做完** | ⭐ 用户这一问直接指出了"该统一却分叉"，比我原方案（改报错提示）更正 |
| 「A吧，做了看看情况日志跟踪住」 | 前端改成上传完当场转正 + 4 个跟踪上报 + `/api/client-error` 改成落盘 | — |
| 「查a3」 | ⛔ 实测发现文档里"轮询零日志"**是错的**（线上 39,270 条）；真问题是只记 `hasError` 布尔 + 事件名骗人 | 顺出两个真问题（视频任务无重试上限、只写 console.warn） |
| 「a7也是带星号的。。你也查一下」 | ⛔ 又是过期描述：curl 早装了、ffmpeg 1097/1097 零失败 | 真问题是"错误映射说假话"（环境问题被说成网络问题） |
| 「服务端少了个程序和ffmpeg转码失败这不都是我们的问题吗？直接修掉啊」 | 老实说明：**根因层面确实没得修了**（一个早修好、一个从没坏过），只把"说假话"修掉 | ⭐ 我上一条回复没说清状态、让用户误以为正在坏，已致歉更正 |
| 「A表还有6条全都查一下…改不了的跟我说一下」 | A1/A2/A4 加明确映射；A6/A8 确认不用动；A9 说明改不了。**当时我对 A1 的结论是"只能改文案"** | — |
| 「A1 图片过大不要动。。应该显示成B15或B13这类差不多的文字。。如果是体积大可以压缩一下保存好，质量保证在90%」 | ⭐⭐ **实测重压 → 4444000 变 985381 → 发现这张图从没被我们压过 → 根因翻转成"我们该压没压"**，按用户要求"只压质量不动尺寸"真修掉；文案对齐 B13/B15 | ⭐ **本次最大的翻转**。我漏了"重压一次比大小"这一步 |
| 「把本对话框内所有做的内容更新到交接文档…下一个ai要直接部署」 | 写了第十四/十五/十六节 + 本条 CHANGELOG + `05` 顶部的分步部署清单 | — |

### 1. A5：红字「参考素材不是可审核的公网地址」

**根因**：参考图里混进了 `data:` base64（1.37MB/1.42MB），BytePlus 送审是"平台上门自取"、只认公网直链，
`toPublicAssetUrl()` 对 `data:` 返回空串 → 抛错 → **整单毙**（同一单里另外 3 张 `/generated` 明明都拿到 Active 凭证了）。

**base64 从哪来**：对话流是"上传拿 token → **发送那一刻**才 PATCH 转正"，
`chat-workbench.tsx` 发送处的 catch 兜底会**静默退回原始 dataURL 直发**（`Promise.all` 一失败还是**整批**退回）。
⭐ **工作流一直是"上传完一次做完 POST+PATCH"、从没出过这个红字** → 典型"该统一却分叉"。

**修了两层**（用户先批 1+3，验证后又批前端 A 版）：

1. **服务端兜底** `src/app/api/video/route.ts`：`data:` 先落盘成正常上传图（复用统一函数 `saveUploadedImageAsset`，
   同 `users/<uid>/upload_image/` 目录、**内容 hash 命名 → 同图幂等、重试不堆文件**），再拼公网 base 送审。
2. **前端根治** `chat-workbench.tsx`：新增 `uploadTemporaryAssetImageAndCommit()`，**上传完当场转正**，
   收敛到工作流那套。两个调用点（选/拖/粘贴 + 重试上传）都换掉，`tempToken` 一律清空
   → **发送那一刻只读字段、零网络请求可失败**。

⭐ **顺手堵的漏子**：落盘失败原来会把**一整行 ffmpeg 命令 + 服务器路径**当红字漏给用户，
现在换成「参考图数据已损坏，无法送审。请删除该参考图后重新上传再试。」，原始错误进新日志
`byteplus-auto-review-data-url-save-failed`。

⭐ **预览不会闪**：输入框缩略图读 `image.previewUrl`（创建时写死 dataURL、从不覆盖），只改 `image.url` 不影响它。

⚠️ **接受的代价**：上传完又不发送 → 正式目录留孤儿文件。内容 hash 命名（同图一份）+ 不建 MediaAsset（不进资产库），
可接受；要清另写"无 MediaAsset 引用且超 N 天"的脚本。

### 2. ⭐ 日志跟踪住（用户明确要求）

`/api/client-error` 原来只 `console.error`（docker logs 会滚掉、事后查不到），已改成**落盘**
到 `.runtime/upload-diagnostics-log.jsonl`（带 userId）。4 个跟踪点，**正常情况一条都不该出现**：

```
client-send-time-commit-still-needed             还有图没转正就走到发送了
client-send-time-data-url-fallback               发送时还在拿 base64 补救
client-send-time-data-url-fallback-failed        补救也失败 = A5 直接现场
client-send-time-persist-uploaded-images-failed  整批退回 base64
```

### 3. A5 实机验收（本地真登录 + 真上传 + 真发送，全过）

| 项 | 结果 |
|---|---|
| 上传时机 | POST + PATCH **上传当下就都打了**（以前 PATCH 要等点发送） |
| PATCH 返回 | `/generated/users/ID_779117/upload_image/e380f0d8b4e60fbd4f8370ee.jpg` |
| 预览 src | 仍是 `data:...(1152271 字符)` = 不闪 |
| 点发送后 | **没有**再打 PATCH、**没有** `/api/upload-image` 兜底 |
| `/api/image` 请求体 | `referenceImages: ["/generated/users/.../e380f0d8....jpg"]`，不是 base64 |
| 服务端诊断日志 | 参考图 `kind:"generated"` |
| 4 个跟踪点 | 一条都没触发 |
| 同图重复上传（去重分支） | 返回 `duplicate:true` + 正式地址，**不多打 PATCH** |

⚠️ 那次生成本身失败（`(B_237) 网络连接异常`），原因是**本地机器连不上 OpenRouter**（`curl: (55) Send failure`），与改动无关。

### 4. ⛔⛔ A3：文档里的前提是错的 —— "BytePlus 轮询零日志"不存在

**实测线上有 `video-provider-poll-success` 39,270 条（byteplus）+ 483 条（openrouter）。**

真正的两个问题：

1. **只记 `hasError: true` 布尔、不记原文**。记原文的 `summarizeVideoTaskError` 后来才加，
   **只有 07-29 起的新数据才有 `errorCode`/`errorMessage`** → 所以「必须先补落盘」**其实早做完了，只是没人验证过**。
2. ⛔ **事件名骗人**：`poll-success` 的 "success" 指"这次 HTTP 查询通了"，任务 `status:"failed"` 的失败**也叫 success**。
   我差点被它带着去"补落盘"。**已改成任务真失败时叫 `video-provider-poll-failed`。**

**107 条未归档视频失败逐条对账**：能拿到原文 **8**（全 07-29、全 `OutputAudioSensitiveContentDetected.PolicyViolation`）／
只有 `hasError` 布尔 **42**（07-27 及以前，原文永久丢失）／ 找不到 taskId **55**（创建阶段就失败、不属 A3）／ 有 taskId 无轮询记录 **2**。

⭐ **关键推论**：那 42 条的红字大多已经是「成品视频/音频因版权或敏感内容被拒绝交付」，
跟今天 8 条有原文的一对照 —— **映射是对的**，根因 = BytePlus 输出音频版权风控 = **B 类、我们修不了**。
**A3 真正剩下的未知只有 10 条**（6 条「服务器繁忙」B_195/237/246~249/256 + 4 条「API Key 无效」B_60/62/66/67，
后者**全在 2026-07-14 一天、之后零复发**）。**原文已丢、不可查，别再花时间。**

### 5. 顺带修掉的两个真问题

**① 「API Key 无效」正则误伤面极大**（`src/lib/error-message.ts`）
原来 `/\b401\b|unauthorized|user not found|invalid api key|api key/` —— **裸的 `api key`**，
上游任何提到 api key 的文字都判成"密钥失效"；连我们自己抛的 `缺少 BytePlus API Key`
（= 服务端**根本没配**）也命中，文案却说"请更新密钥后重试"**把人往错方向带**。
拆成两条：先认"我们没配" → **新文案「服务端没有配置该模型的接口密钥，请联系管理员处理。」**；
再用精确特征（`invalid_api_key`/`incorrect api key`/`api key expired`/`401`/`unauthorized`…）判"平台说密钥无效"。
⭐ **`npx tsx` 拿 12 条真实上游原文验映射，12/12 通过**（含 6 条回归：输出音频版权 / 1015 限流 / 402 余额 / 超时 / 真人参考图 / 格式不支持，都没被抢走）。

**② 视频任务没重试上限、失败只写 console.warn**（`src/lib/generation-jobs.ts` `runVideoJob`）
- 图片任务有 `MAX_IMAGE_JOB_ATTEMPTS = 6` + `image-job-transient-retry` 日志；视频任务 catch 里
  **只有 `console.warn` + 每 10 秒无限重试、永不放弃、永不留痕**；另两个失败分支也**零诊断日志**。
- 已修：三个分支都补 `appendGenerationDiagnosticsLog`（带上游原文 + `upstreamRaw` 截 1500 字 + attempts），
  新事件 `video-job-poll-failed` / `video-job-completed-without-url` / `video-job-poll-error` / `video-job-poll-error-streak-exceeded`。
- ⛔⛔ **上限绝不能用 `attempts`**：视频轮询正常就要几十次（线上最大 `attempts=208` 且是**成功**的长视频），
  用 attempts 设限会掐死正常长视频。改成数**连续**失败 `extraJson.pollErrorStreak`（catch +1、查询成功归零），
  `MAX_VIDEO_POLL_ERROR_STREAK = 30` ≈ 连续 5 分钟查不动才判失败。
  ⚠️ 等本地存盘那条路是正常 return、**不过 catch**，"平台给了 url 就一直等到存好"的老行为没变。
- ✅ 线上核实：**实际没有僵尸任务**（当前 0 个 running；最大 attempts=208 是成功的）→ 隐患不是事故。

### 6. A7：curl / ffmpeg 都早就好了，真问题是「错误映射说假话」

⚠️ **跟 A3 一样，A7 的原表述"容器里没装 curl、这条路永远失败"也是过期的。**

| 项 | 线上实测 | 结论 |
|---|---|---|
| 容器少装 curl | 容器里 **curl 7.88.1 装着的**（正式+测试服，Debian 12）；`Dockerfile:4-7` 早就装了、注释写着 *"without it the fallback throws spawn curl ENOENT"*。`spawn curl ENOENT` 全站**只有 4 条、全在 2026-07-14 11:12~11:15 三分钟内、之后零复发**；07-29 还有 `provider-curl-success` | **已修，无事可做** |
| ffmpeg 转码失败 | `upload-image-reencode-start` **1097** = `-success` **1097**，`-failed` **0 条**（该事件确实存在，见 `local-assets.ts:172`，所以 0 是真的零失败）；`ffmpeg-missing-raw-write` 也 0 条 | **线上从未发生过** |
| 模型键没映射 | `byteplus-provider-key.ts:50` 已有 `seedream-5-0-pro`，`models.ts:105` 也在 | **已修** |

⛔⛔ **排查陷阱**：07-14 之后仍有大量 `image-provider-curl-fallback-failed`（07-15 九 / 07-16 十 / 07-24 十三 / 07-28 十一条），
**但捞原文一看根因全是「提供商余额不足！请联系管理员充值。」** —— **事件名带 curl，锅完全不在 curl**。
⭐ **别用事件名推根因，必须捞 `error.message`。**

**⭐ 真正修掉的**：`error-message.ts` 网络规则里塞了 `curl` 和 `command failed` 两个太宽的词，
于是 `spawn curl ENOENT`（容器少装程序）被说成「网络连接异常，请稍后重试」→
**用户白等白重试，我们后台也只看到"网络问题"、完全发现不了是部署问题，一埋两周**。已在网络规则**之前**新增：

```ts
const missingBinary = /\bspawn\s+\S+\s+enoent|\benoent\b/.test(lower);
const subprocessFailed = /command failed/.test(lower) && !/curl:\s*\(\d+\)/.test(lower);
if (missingBinary || subprocessFailed) return withErrorCode("服务端环境异常，请联系管理员处理。");
```

并从网络正则里**删掉 `command failed`**。⭐ 关键设计点：`Command failed: curl … curl: (7) Failed to connect`
这种"子进程跑起来了、失败在网络"的要放给网络规则，靠 **`curl: (数字)`** 排除。
⭐ **回归 22/22 通过**（6 条环境类 → 新文案；2 条 curl 网络失败 → 仍是网络；7 条纯网络/超时 → 一字未变；7 条其它高频原文没被抢走）。

### 7. A 表剩下 6 条全部收口（A1 真修 + A2/A4 加映射；A6/A8 不用动；A9 改不了）

用户要求"6 条全查、能改的改掉、改不了的说明"。

#### 7.1 ⭐⭐ A1 的真根因是「我们该压没压」（不是只改文案）

⛔ **我第一版判断错了**，写的是"图太大、官方没写上限、只能改文案 + 建议缩尺寸"。
用户一句「**图片过大不要动**……如果是体积大可以压缩一下保存好，质量保证在 90%」直接点破 —— 实测后根因完全不同。

**用容器自带 ffmpeg 对线上那张真实的 4.24MB 图重压（同尺寸）**：

```
源文件               4444000 字节
-q:v 2（约95%）      1682393
-q:v 3（约90%）       985381   ← 只有源文件的 22%！
-q:v 5（约80%）       586398
```

⭐⭐ **说明这张图从来没被我们压过**（压过就该是 ~985KB）。查到 `local-assets.ts`：

```
forceReencode 或 非 jpeg     → 压
jpeg + jpegNeedsReencode()   → 压
jpeg + 不需要重编码          → writeFile(原始 buffer)   ⛔ 一个字节都不压
```

而 `jpegNeedsReencode()` **只检查格式兼容性**（分量数 3 + 采样因子 `0x22/0x11/0x11`），**完全不看体积**。
手机原图正好是标准 baseline 4:2:0 → 判"不用重编码" → **原样存盘 → 原样发给模型 → 被 OpenAI 拒**。

**修法（按用户要求：不动像素尺寸，只把质量压到 90%）**：

- `image-upload-validation.ts` 新增两个常量（放在上传规则唯一来源）：
  `IMAGE_UPLOAD_RECOMPRESS_OVER_BYTES = 2MB`、`IMAGE_UPLOAD_RECOMPRESS_QUALITY = 90`。
- `local-assets.ts` 新增 `compressOversizedUploadJpeg()`：超阈值就 sharp
  `.rotate().jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:2:0" })`，接在那条"原样写盘"分支上。
- ⭐ **`.rotate()` 必须有**：sharp 默认丢 EXIF，手机照片带 `Orientation` 时不先转正、压完会显示成横躺。
- ⚠️ **压不动 / 压完更大 / sharp 报错 → 一律保留原文件，绝不让上传失败**，三种情况各有日志：
  `upload-image-oversized-recompressed` / `-recompress-skipped` / `-recompress-failed`。
- ⚠️ 与后台"生成图片压缩"（high95/standard80/low60）**是两件事**：那套管我们生成的图，这里管用户上传的参考图。

**本地实测（走真实上传链路）**：

| 用例 | 源 | 存盘后 | 结果 |
|---|---|---|---|
| 真实照片放大到手机原图规格 | 3.59MB / 3072×4096 | **0.76MB / 3072×4096** | 体积 **-78.7%**、**尺寸未动** ✅ |
| 带 EXIF `Orientation=6` 的大图 | 10.58MB / 4000×3000 | 6.82MB / **3000×4000** / 无 orientation | **已按 EXIF 转正**（不会横躺）✅ |
| 小图 3118 字节 | 800×600 | 3118 字节 / 800×600 | **字节完全一致 = 没被碰** ✅ |

**文案也换了**（历史大图 + 第三方 https 参考图不经过我们的压缩，还会触发），
按用户要求**句式对齐 B13/B15**：
**「参考图不符合平台要求，模型读不出这张图。请换一张体积更小的参考图（建议 2MB 以内）后重试。」**

#### 7.2 A2 / A4 加明确映射

| # | 上游真实原文 | 以前 | 现在 |
|---|---|---|---|
| **A2** | `图片平台没有返回图片：可直接用这版优化后的文生图提示词：…` | ⛔ **把模型那一大段中文提示词原样当红字贴给用户**（末尾透传最多 500 字） | **模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。以下是模型返回的内容：“…”** |
| **A4** | `Transaction API error: Unable to start a transaction in the given time.` | 兜底桶「服务器繁忙」，跟上游抖动混在一起 | **服务端数据库繁忙（连接池已满），请稍后重试。** |

⭐ **A2 的关键点**：新文案**故意复用已有的那句**，抽成唯一函数 `buildModelTextInsteadOfImageMessage()` →
**后台归一化 SQL 那条前缀规则已经存在、一行都不用改**（`admin-failure-triage.ts` 第 4 个 `regexp_replace`）。
自己另造一句的话，后台会立刻炸成几十条各 1 条。**"能统一一律统一"的现成收益。**

**A2 数据**：112 条 `image-provider-empty-result` 里 **101 条**是"模型回文字不给图"（还在发生，07-29 x5）。
**A4 池子现状**：`DATABASE_URL` **没配 `connection_limit`/`pool_timeout`** → Prisma 默认
`CPU核数×2+1`（容器 8 核 → **17 连接**）、`pool_timeout=10s`。日志 6 行、**最后一次 07-17、之后零复发**，且已判可重试。

#### 7.3 不用动 / 动不了

- **A6**（图片 5 分钟超时）：全站 **1 行**（07-23）、零复发，已有明确文案、不在兜底桶。没法让模型更快，调大超时属拍脑袋 → 不做。
- **A8**（上游非 JSON）：14 行、仍在发生，但**已有明确文案 + `isTransientServerError=true` 会自动退避重试**，多数到不了用户面前。两形态：11 条老接口 **200 但 body 截断**、3 条新接口 **502**。上游抖动，修不了。
- **A9**：⛔ **改不了，数据不足** —— 连 `requestId`/`model` 都没有（日志里是 `-`），无法定位。全站 1 条、零复发。

✅ **映射回归 21/21 通过**（含 B13「Image pixel is invalid」、B15「aspect ratio must be between」等，确认没被新规则抢走）。

### 8. ⭐ 归档与拍板事项已挪到第 11 条

**A4 真修复：给 `DATABASE_URL` 加 `connection_limit`（25~30）**。
⚠️ 改环境变量 + 重部署 + 核对 postgres `max_connections`，不是纯代码改动。目前零复发 → **不建议现在动**。

⛔ **已被用户否掉、别再提**：我原来提的"发给模型前把参考图**缩尺寸**（最长边 2048）"——
用户明确要求**不动尺寸、只压质量到 90%**，实测 -78.7% 已经够用。

### 9. 本次改动的文件（累计待部署 12 个）

本次新改 8 个：

```
src/components/chat-workbench.tsx        上传完当场转正 + 4 个跟踪上报
src/app/api/client-error/route.ts        上传链路客户端上报落盘到 upload-diagnostics-log
src/app/api/video/route.ts               data: 参考图落盘后送审（+ 落盘失败的人话文案）
src/lib/video-diagnostics-log.ts         summarizeVideoReference 补 data 分支（与 generation 侧统一）
src/lib/generation-jobs.ts               runVideoJob 三个失败分支补日志 + 连续失败上限
src/lib/openrouter-video.ts              轮询失败改用 video-provider-poll-failed 事件名
src/lib/local-assets.ts                  ⭐ 上传大图按 90% 质量原地压缩（不动尺寸）+ .rotate() 保方向
src/lib/error-message.ts                 收紧 api key 正则 + 环境类错误单列 + A1/A2/A4 三条明确映射
```

第十五次会话遗留未提交的 2 个（本次 `image-upload-validation.ts` 又追加了压缩阈值常量）：
`image-upload-validation.ts`、`upload-rules.ts`、`scripts/archive-resolved-generation-failures.mjs`
（`error-message.ts` / `video/route.ts` / `image-upload-validation.ts` 两批都改过）。

### 10. 🚀 下一个 AI：直接部署（用户明确授权，分步清单在 `05-next-actions.md` 顶部）

**起点**：线上三方 `v1.0.0.53`，本地 `v1.0.0.53` + 12 个文件未提交、**无 Prisma 迁移**、tsc 全绿。
**动作**：`bump v54` → 测试服 → 实机验收 9 项 → **原样**同步正式服（不再 bump）→ 4 件收尾 → commit + push。

**部署后 4 件收尾**（每一件的代码片段/命令都写在 `05` 第 4 步里，可直接复制）：

1. **归档 A5 那 4 条**：从归档脚本 `NEVER_ARCHIVE_REASON_PATTERNS` **删掉** `/参考素材不是可审核的公网地址/`，
   再加一条**带 `before` = 正式服部署时刻**的规则（只归档历史那 4 条；以后同名红字必是别的成因、应继续亮着）。
2. **归档 A7 那批**：⚠️ **不能按 failureReason 匹配**（「网络连接异常」是真网络错误共用的文案，会误吃），
   必须按**日志原文** `/spawn curl ENOENT/` 匹配。
3. **观察 7 个新日志事件**（grep 正式服 `upload-diagnostics-log.jsonl`）：
   4 个 `client-send-time-*` **应为 0**；`upload-image-oversized-recompressed` **应大量出现**、`-recompress-failed` **应为 0**。
4. **后台 `/admin?tab=failures` 抽查** A1/A2/A4 三条新文案各自聚成一条。

⚠️⚠️ **`scripts/archive-resolved-generation-failures.mjs` 千万别 `git checkout` 掉** ——
归档动作第十五次会话已经在正式服 DB 跑过（224 → 220 条待排查），但脚本代码一直没提交；
丢了它以后跑归档会**误吃新数据**（新规则 + 全局护栏都在里面）。

⚠️ **归档前必须重新 dry-run**（220 是快照），且**逐条扫明细里的 failureReason**，别只看数字。
本地 dry-run 永远是 0 → 必须 `docker cp` 进容器 `/app` 再 `docker exec -w /app node scripts/...`。

### 11. ⭐ 部署后才轮到的：只剩一个「能修但要拍板」的项

**A4 真修复：给 `DATABASE_URL` 加 `connection_limit`（25~30）**。
⚠️ 改环境变量 + 重部署 + 核对 postgres `max_connections`，不是纯代码改动。目前零复发（最后一次 07-17）→ **不建议现在动**。

⛔ **已被用户否掉、别再提**：我原来提的"发给模型前把参考图**缩尺寸**（最长边 2048）"——
用户明确要求**不动尺寸、只压质量到 90%**，实测 -78.7% 已经够用。

### 12. 本次的操作记忆（省时间）

- ⭐ **查线上日志用 python3 直接读宿主机 `/opt/flashmuse/data/runtime/*.jsonl`**（挂载出来的，不用进容器）；
  **连 DB 才需要** node 脚本 `docker cp` 进 `/app` 再 `docker exec -w /app node`。
- ⭐ **DB 失败事件 ↔ 日志对账姿势**：先用"同时有 requestId 和 taskId 的日志行"建 `requestId→taskId` 映射，
  再拿 taskId 找最后一条 poll 记录。⛔ **poll 日志行里没有 requestId**，只按 requestId grep 会误判"没日志"。
- ⭐⭐ **"图太大被拒"这类问题，先问一句"我们到底压过没压过"** —— **本次最大的教训**：
  我第一版查完就下结论"图太大、官方没写上限、只能改文案"，**漏了最关键的一步**：拿源文件重压一遍对比体积。
  一压才发现 `4444000 → 985381`，即"这张图从没被我们压过"，根因立刻从"模型限制"变成"我们自己漏了压缩"。
  ⭐ **判断"该压没压"的最快办法就是重压一次比大小。** 用户那句"可以压缩一下保存好"就是这么点破的。
- ⭐ **容器里可直接用 `/app/node_modules/ffmpeg-static/ffmpeg` 做压缩实验**（输出 `/tmp`、跑完删），
  不用把用户的图拉到本地。`-q:v` 与质量粗略对应：`2≈95% / 3≈90% / 5≈80%`。
- ⛔ **sharp 压缩默认丢 EXIF** → 手机照片必须先 `.rotate()` 把方向烧进像素，否则压完显示成横躺。
  测这一项要**自己造带 `withMetadata({ orientation: 6 })` 的图**，且**体积必须超过阈值**才会进压缩分支
  （我第一版测试图只有 1.39MB，压根没进分支，白测一轮）。
- ⛔⛔ **PowerShell `cd` 对 `[System.IO.File]` 无效、对 `Remove-Item` 有效** ——
  本次同一条命令里 ReadAllText 读错了目录（失败），后面的相对路径 `Remove-Item` 却真删了文件，
  **刚写好的一整节交接文档没拼进去就消失、只能重写**。⭐ **拼接文件只用绝对路径。**
- ⛔ **edit 别吃掉 `export` / 换行**（本次两次手误，tsc 都抓到了）→ **每改完立刻 `npx tsc --noEmit`**。
- ⭐ **Playwright 上传文件必须放在允许的根目录内**（`.playwright-mcp\`），temp 目录会被拒（`outside allowed roots`）；
  `showInputTip` 是瞬时提示、`innerText` 抓不到 → **改看网络请求更可靠**。

## 2026-07-29（第十五次会话）⭐⭐ 红字全量归纳成 A/B 两张表 + B 类全部处理完 + 上传格式白名单统一 —— ⚠️ **本地改动未部署未 push（v1.0.0.53 不变，没 bump）**

### 0. 本次会话在干什么（一句话）

用户要求「把所有生成失败原因归纳成表格：真实原因（大白话）／映射成的红字／兜底桶，**我们自己的原因和提供商的分开**，
已修好的不要列，只列**以后还会真实发生**的」→ 然后**按表逐条处理**。本次把 **B 类（提供商/模型端）全部处理完**，A 类留给下一个 AI。

⚠️ **无 Prisma 迁移。`npx tsc --noEmit` 全绿。5 个文件本地改动，未部署未 push，版本号没 bump（部署测试服时才 bump 成 v1.0.0.54）。**

### 1. ⭐ 归纳口径（下次做同类事照抄，这是本次最大的方法论产出）

第一版表格我是**直接把 DB 里 `GenerationEvent.failureReason` 的分布贴给用户**的 —— **被用户否了，理由完全正确**：
DB 里那些是**历史字符串**（当时就写死进去的），里面混着大量「已经被新代码取代、以后再也不会产生」的老文案。
用户要的是「**以后还会发生的根因 → 它现在会映射成哪句红字**」。

**所以正确做法是两步走，缺一不可**：
1. 从 DB 拿到"有哪些根因"（`GenerationEvent` 按归一化 reason 分组）→ 再逐个回 `.runtime/*-diagnostics-log.jsonl` 捞**上游原文**定根因；
2. **拿根因去读现在的 `src/lib/error-message.ts`**，看它今天会映射成哪句 —— 表格里填这一句，**不是填 DB 里那句**。

判断"还会不会发生"的四种情形：① 根因已修 → 剔除；② 文案已被取代 → 换成接班人那句；③ 从未发生过（纯预防规则）→ 剔除；④ 被自动重试/自愈消化、到不了用户面前 → 剔除。

### 2. 正式服红字全貌（查询时间 2026-07-29，本次归档后 **220 条待排查 / 524 已归档**）

原始分布是 **21 种 / 224 条**，归纳后：**A 类（我们自己的）9 条根因 42 条事件 ／ B 类（提供商端）14 条根因 178 条事件**。
两张表的完整内容 → **`07-red-error-triage-and-archive.md` 第十三节**（A 表带样本 requestId 和证据，下一个 AI 直接照着做）。
桌面上还留了两个 md（`FlashMuse-红字改写表-AB两类.md` 是新口径的、`FlashMuse-B类提供商红字改写表.md` 是旧口径已作废）。

### 3. B 类逐条处理结果（本次全部处理完）

| 原表编号 | 处理 | 结论 |
|---|---|---|
| B5「参考图未能通过平台审核」+ B6「参考图可能包含真人或隐私敏感信息」 | ✅ **合并成一句** | 本来就是同一个根因（平台内容安全检测拒绝素材），只是一条精确规则一条兜底规则 |
| 新增 | ✅ **补了成品图片侧那句** | `OutputImageSensitiveContentDetected` 以前掉进 B6 兜底 → 红字说"参考图可能包含真人"，**用户换一万张图都没用**（错怪） |
| B7「视频任务创建失败：The request failed because the image format is not supported by the API.」 | ✅ **查清 + 归档 4 条，不加映射** | 根因跟格式无关：音频 `.bin` 混进图片槽（v34 已修）。数据证明不会再发生 |
| B9「请求太频繁或额度不足」 | ✅ **拆掉、这条文案消失** | 裸 `429`→限流那句；裸 `quota`→余额不足那句。⛔ 不能整条并进"余额不足"：429 时钱是够的，会让用户白催充值 |
| B10「输出视频被平台过滤」 | ✅ 划掉（不并进 B1） | DB 0 条、日志 0 行，**从未发生过**；且原文只说 `completed with no output`，并进 B1 等于替平台编"因版权敏感"的理由 |
| B11「平台读取参考图失败」 | ✅ 划掉 | DB 0 条红字。日志 20 行但**全被 `transient-error` 判为可重试、服务端自动退避重试消化掉了**，用户从来没看见过 |
| B12「审核凭证已失效」 | ✅ 划掉 + 顺手改进 | 自愈逻辑 v47 就有、07-15 后零复发；本次补上"凭证过期不问用户、当场重新送审" |
| B1 / B2 / B3 / B4 / B8 / B13~B18 | 保留 | 提供商侧真实原因，我们修不了，按铁律该一直亮着 |

### 4. 代码改动明细（5 个文件）

**① `src/lib/error-message.ts`**（+53/-13）
- 新增 4 个常量做唯一来源：`REFERENCE_REVIEW_REJECTED_MESSAGE`（B5+B6 合并后那句）、`OUTPUT_IMAGE_REJECTED_MESSAGE`（新增）、`PROVIDER_INSUFFICIENT_CREDITS_MESSAGE`、`RATE_LIMITED_MESSAGE`。
- **合并句措辞从「参考图」改成「参考素材」** —— 线上真实原文里有 `InputVideoSensitiveContentDetected param: content[3]`，被判敏感的是**参考视频**，说"参考图"是错的（音频同理）。
- **新增成品图片规则**，插在「成品视频/音频」之后、「参考素材」之前：
  `成品图片被平台判定含敏感内容而拒绝交付（不是参考素材的问题，换图没用）。可直接重试或修改提示词后重试。`
- **删掉「请求太频繁或额度不足，请稍后再试。」**，拆成 `\b429\b|too many requests`→限流句、`\bquota\b|配额`→充值句。

**② `src/lib/image-upload-validation.ts` + ③ `src/lib/upload-rules.ts`**：图片格式白名单**收敛成唯一来源**
`IMAGE_UPLOAD_FORMATS = ["jpg","jpeg","png","webp"]`（`IMAGE_UPLOAD_ACCEPT` 由它推导），**删掉 `upload-rules.ts` 里的 `bytePlusImageFormats`**。

**④ `src/app/api/video/route.ts`**（+19）：新增局部标记 `staleAssetCardCleared`，两个分支（创建抛异常 / 创建返回 error 字段）都置。
两处 `if (!body.autoBytePlusAssetReview) return {status:"reviewing"}` 加上 `&& !staleAssetCardCleared`。

**⑤ `scripts/archive-resolved-generation-failures.mjs`**（+61）：新归档规则 + dry-run 明细 + ⭐ 全局护栏（见下面第 6 条）。

### 5. ⭐⭐ 上传格式白名单：官网权威结论（别再猜，也别再放宽）

用浏览器读了 BytePlus ModelArk 视频生成 API 官方文档，原文：

> • Image formats: `.jpeg`, `.png`, `.webp`, `.bmp`, `.tiff`, `.gif`. In addition, **Seedance 1.5 Pro and Seedance 2.0 series also support `.heic` and `.heif`**.

**所以 `bytePlusImageFormats` 是照官网抄的、没抄错。但我们故意只放 4 种**（`image-upload-validation.ts` 顶部写了长注释）：
1. **资产跨模型复用** —— 同一张图今天喂 Seedance、明天 `@` 给 GPT/Gemini（只吃 jpg/png/webp），白名单必须取**交集**，否则"换模型再用"时才炸；
2. **tiff / heic / heif 浏览器 `<img>` 渲染不了** —— 传上去画布节点/缩略图/资产库/@引用全是破图，负收益；gif 只取一帧、bmp 体积大，也没价值；
3. `accept` 属性一直只给这 4 种，宽白名单**只有"拖拽进工作流画布"能走到** = 隐藏的不一致。

⭐ **以后要放开 heic（iPhone 原图）必须先做"上传时转码成 jpg"，不要只改白名单。**

**分叉现场**（这就是铁律#3 的活标本）：`chat-workbench.tsx:14117` 走 `validateImageUploadFile`（4 种），
`workflow-tldraw-canvas-inner.tsx:6507` 走 `kindRule.formats.includes`（10 种）→ 同一个"能传什么图"有两个答案。
**行为变化只有一处**：工作流画布拖 tiff/gif/bmp/heic 进去，以前放过、现在提示"当前模型不支持该图片格式"。数量与大小上限一个没动。

### 6. ⭐⭐ 归档脚本差点误吃 6 条 —— 新增全局护栏（下次跑归档必读）

给脚本加了 **dry-run 明细输出**（以前只给数字），第一次试跑就发现两条老规则会吃掉不该归档的：

| 规则 | 误吃 | 为什么 |
|---|---|---|
| `gpt-image-empty-result-legacy-form` | 4 条 failureReason 已是 **v53 新统一文案「模型因色情/暴力/隐私安全等原因拒绝出图」**、07-29 刚发生的 | **haystack = 日志原文 + failureReason**，而日志里还包着 `图片平台没有返回图片：` 这层**内部壳** → 被连带命中。按铁律④这类该一直亮着 |
| `approved-card-not-reused` | 2 条「**参考素材不是可审核的公网地址**」（A 表里还在流血、根本没修的） | 它靠"走了送审复用、没新建素材"的**事件序列特征**命中，跟 failureReason 无关 |

**修法**：新增 `NEVER_ARCHIVE_REASON_PATTERNS` + `isNeverArchiveEvent()`，在规则匹配**之前**先判：
failureReason 命中就**任何规则都不许归档**。目前挡 4 类（三种模型拒绝措辞 + 参考素材公网地址）。
⭐ **比给每条规则配 `before` 更准**（不受部署时刻/时区影响）。⛔ 某条根因**真修好之后**才可以从这里删掉。

护栏加上后 dry-run 从 10 条降到 4 条，`--apply` 只归档了目标那 4 条（B_171/B_210/B_211/B_212），**224 → 220**。

### 7. B7 完整排查过程（音频当图片发，跟"格式"毫无关系）

4 条失败（07-17～07-20，全是同一用户 ID_686996 的 seedance-2-0）的 `byteplus-create-request` 日志里都有这一行：

```json
{"index":2,"pathTail":"users/ID_686996/files/d7d49e026965eddc8f73acba-武松音色1.bin","role":"reference_image"}
```

同一个音色文件在下面又正确地以 `role:"reference_audio"` 发了一份 → **音频被当参考图塞进 `image_url` 数组**，
BytePlus 只能回一句"这图片格式我不支持"。已归档的 26 条 `the specified asset is not an image` 是**同一个根因**，只是上游换了说法，当时的规则没认出这 4 条。

修复是 **v1.0.0.34 / commit `5bb0fc2` / 2026-07-21**（`B_252 音频误入图片槽修`），代码在 `video/route.ts:781-796`（按库里真实 `mediaType` 剔除）。4 条全在修复之前。

**为什么不加中文映射**：查了正式服活跃图片资产扩展名分布 —— `jpg 5302 / png 57`，**bmp/tiff/gif/heic/webp 一条都没有** →
根因已修 + 上传口已收紧 + 库里零存量，三重保证。真出现了再加（那时还有真实原文可对）。

### 8. B12 的自愈逻辑（用户提的"完美规则"其实已经实现了，本次补最后一步）

用户描述：「凭证不存在就直接拿图重新申请，把新凭证覆盖记好；下次先用存好的，行就直接用，不行再申请覆盖。」
—— 这**正是 v1.0.0.47 已有的逻辑**（`video/route.ts:911-948` + `977-990`），数据也证明它生效了：

| 检查项 | 结果 |
|---|---|
| 这条红字在 `GenerationEvent` 里 | **待排查 0 / 已归档 0** —— 从未真正显示给用户 |
| 日志里 `asset ... is not found` 最后一次 | **07-15**（v47 是 07-27 上线）→ 此后零复发 |
| `byteplus-stale-asset-card-cleared` 触发次数 | **0**（没再发生过，没机会触发） |
| 库里带 BytePlus 凭证的图 | 897 张，**895 张 Active** |

**本次补的最后一步**：清掉死凭证后 `reuseOnly` **必然**找不到 Active 凭证（刚被置 null）→ 只能走完整送审，
而完整送审原本要求前端带 `autoBytePlusAssetReview`，否则 `return {status:"reviewing"}` 让前端再来一轮 →
用户会白看一次"检测到真人图片，正在送审"的提示，**可这跟真人毫无关系**。
现在：凭证过期这一类**不问用户、当场重新送审**（原因 100% 确定），拿到新凭证 `patchWorkspaceBytePlusAssets` 写回库。
⛔ **真人/隐私审核那条路一行未动**（那个提示是用户该知道的，不能偷偷做）。

### 9. ⭐ 本次的操作记忆（省下一个 AI 的时间）

- ⛔⛔ **`generation-diagnostics-log.jsonl` 里也有 `video-route-failed`** —— **视频失败会双写两个日志**。
  本次差点据此误报"图片路径也发生过凭证失效、存在分叉"，一看 `event`/`model` 全是 `video-route-failed` / `byteplus:video.seedance-2-0`。
  ⭐ **按日志文件名判断"是图片还是视频路径"是错的，必须看行里的 `event` 和 `model`。**
- ⭐ **捞日志原文的姿势**（比 grep 好用）：写个 node 脚本按 requestId 过滤 + 只打 `error.message`/`extra.body`/`upstream.body`，
  `docker cp` 进 app 容器跑。⛔ **别用 `grep | cut`**：一行 JSON 几千字，`cut -c1-700` 正好把 `error` 字段切没了（本次踩过，白跑一轮）。
- ⛔ **psql 查 `failureReason` 必须 `left(...,90)`**：有条红字是模型 500 字的小作文，不截断会把工具输出冲爆（本次第一次查就爆了）。
- ⭐ **视频轮询阶段的失败在 BytePlus 侧没有任何日志**（只有 `byteplus-create-success`）→ 拿 taskId 去捞也是空的。
  这就是 A3 那 15 条查不动的原因，**必须先补落盘**。（OpenRouter 侧第十一次会话已补。）
- ⭐ **查官网规格用 playwright**：`browser_navigate` + `browser_find`（正则）比读整页快得多，本次一次就捞到格式那一行。
- ⭐ **纯函数验收错误映射**：`npx tsx` 直接 import `src/lib/error-message.ts` 跑真实上游原文（本次两轮 10/10 + 10/10），
  比起服部署快得多；测试文件写在 `.runtime/` 下、跑完删掉。

## 2026-07-29（第十四次会话）⛔⭐ 撤掉对话流/资产库的 AI 改写 + 模型拒绝类红字统一成一句 —— ✅ **四方同步 v1.0.0.53（正式服 = 测试服 = 本地 = GitHub）**

### 1. 起因：用户报「d37 这个对话用了 AI 改写，出了非常多的问题」

正式服 `WorkspaceSession cmrkbgj3o47juph1tcbsldzup`（`ID_636611`，编号 d37，事发 2026-07-29 01:58–02:08）。

⭐ **查到的硬数据（11 分钟内）**：

| 指标 | 值 |
|---|---|
| 实际发起的生图 | **23 次** |
| 其中成功（已出图、已入库、已扣费） | **17 张**（`MediaAsset` 里 `image_19_d37` ~ `image_36_d37` 全在） |
| 对话里最终看得见的 | **2 张** |
| AI 改写接口调用 | **23 次** |
| 合计扣积分 | **197**（生图 173 + 改写 24） |

⭐ **怎么查的**（下次照抄）：`WorkspaceSession.summaryJson->>'conversationCode' = 'd37'`（编号是前端自增的 `d{n}`，存在 summaryJson 里，**不是 id 截取**）→ 读 `messagesJson` 里带 `gptImageOptimization*` 字段的消息 → 对 `GenerationEvent` / `CreditLedger` / `MediaAsset` 按 userId+时间窗核对。

### 2. 根因（8 个问题，都定位到行）

1. ⭐⭐ **丢图**：`message.requestId` 是**单值**，而改写的并发锁是 `${message.id}:${failedIndex}`（**按槽位**）→ 同一条消息的 3 个失败卡各起一条改写链、互抢 requestId；后启动的一覆盖，先完成的成功图在 `appendImagesToAssistantMessage` 的 `message.requestId === requestId` 匹配不上 → **静默丢弃**。铁证：02:08:48 成功（`cee7aea9`）→ 02:08:51 另一次失败（`45a4eec6`）抢走 requestId → 那张图没了。
2. ⭐⭐ **成功被判成失败、继续烧钱**：编排用 `getMessageImageCount()` 读 `sessionsRef.current`，而 `sessionsRef` 是在 **useEffect 里赋值**的 → `await` 回来仍是旧值 → 明明成功也 throw、继续下一轮。并发下计数还会被别的链污染（互相误判）。
3. **消息提示词被改写词覆盖**：`finalizeAssistantImageFailures` 的 `...payload` 带 `content`。用户输「没穿衣服」，界面变「穿不透明罩衫」，而那张图的 `imagePrompts` 又是「穿日常T恤短裤」——**同一张图三种提示词**。
4. **失败卡永久转圈**：`gptImageOptimizationRetryingIndexes` 残留 `[0,1]` 被持久化进 DB（收尾只 filter 自己那个 index、读的还是过期快照）→ 那两个槽位永远渲染等待卡，计时从消息 createdAt 起算（显示"已等一天"）。
5. **文案四分叉**：同一个色情拒绝出现 4 种说法 —— `B_652`「模型因色情…拒绝出图」/ `B_626,627`「可能是提示词内容不符合平台安全策略」/ `B_622~625`「**生成结果可能涉及版权限制**」（`-agent` 那条其实也是色情拒绝、被误映射成版权）/ `B_635`「可能是因为提示词中包含了【sexu…】」（提示词里根本没这词）。
6. **同一失败两个错误码**：slot 里 `B_652`、`mediaErrorReasons` 里 `B_657`（每次映射都走 `createCodedApiError` 自增）→ 用户报的码后台对不上。
7. **改写记录被污染**：`runPromptSafetyRetry` 每条新链都把原句再 push 一遍 → 历史里原句出现 3 次，看着像"又拿原句去生成了"（实际没有，但记录误导）。
8. **媒体编号空洞**：`image_19/20/21/...` 号都占了，对话里只有 `image_28`、`image_36`。

### 3. 用户拍板：不修了，直接撤

> 「不用改了，直接把 ai 改写功能从对话流和资产库都撤掉，恢复原来的样子。保留红字。」
> 「这个对话流的设计不太适合 ai 改写。因为他是一条提词出多图，虽然是四张图，但提示词是相同的，但是如果每张独立改提示词那上面显示的提示词就不对了。这也是一个问题，以后想好再做。」
> 「当前工作流的 ai 改写继续保留，只有工作流的两个 gpt 图片模型因提示词问题不生图才会触发。」

### 4. 改了什么（2 个文件）

**`src/components/chat-workbench.tsx`（-241 行）**：删掉 `MediaOptimizationRetryActions`、`canConversationOptimizationRetry`、`runConversationGptImageOptimizationRetry`、`canAssetOptimizationRetry`、`runAssetGptImageOptimizationRetry`、`optimizingImageMessagesRef`/`isAssetOptimizingRef`、`retryFailedMedia` 的 `promptOverride`、`generateCharacterImage` 的 `promptOverride`/`carryOptimization`/`rethrowError`、`patchMessageById`、`gpt-image-safety-retry` 的 import；两个 Strip 去掉 `canOptimizationRetry`/`onOptimizationRetry`/`optimizingFailedIndexes` 三个 props，失败卡**恒显示「重新生成」**。

- `Message` / `CharacterGenerationResult` 上的 `gptImageOptimization*` **只留类型声明**（读旧数据不报错），代码里不再写入不再读取。
- ⭐ **副作用（白捡）**：历史数据里残留的 `gptImageOptimizationRetryingIndexes` 不再被读 → **永久转圈的失败卡自动自愈**，不用去 DB 洗数据。

**`src/lib/error-message.ts`**：三类合并成唯一一句

```
模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“xxxxx…”
```

- 删掉「模型拒绝了本次生成请求…平台安全策略」与「生成结果可能涉及版权限制，平台拒绝输出…」两句 → 转为 `LEGACY_MODEL_REFUSED_MESSAGES`（**只用于判定与后台归一化，禁止再拿它生成新文案**）。
- 去掉 `canRewrite` 分支与 `modelSupportsPromptSafetyRewrite` 依赖（`toUserErrorMessage` 的 `options.model` 保留入参但不再影响文案）。
- ⭐ **`MODEL_REFUSED_PREFIX` 一字未改** → 工作流的 AI 改写按钮判定（`isGptImageSafetyFailure` → `isModelRefusedMessage`）与后台 `FAILURE_REASON_SQL` 前缀归一化**都不受影响**。

⛔ **工作流那套一行未动**（`workflow-tldraw-canvas-inner.tsx` / `gpt-image-safety-retry.ts` / rewrite 接口全部原样）。

### 5. 测试服 v1.0.0.53 实机验收（全过）

| 项 | 结果 |
|---|---|
| 对话流 GPT-5.4 Image 2 + 露骨提示词 | ✅ 新文案：`(B_59) 模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“sexu…”` |
| 该失败卡内容 | ✅ 只有「图片生成失败 + 重新生成」，全页 `AI改写重试` 计数 **0** |
| **反例**：对话流正常生图（橘猫） | ✅ 成功出图，成功路径没被搞坏 |
| **反例**：工作流失败卡 | ✅ 三颗「AI改写重试 3/5/10 次」+ 说明文字**完整保留**，画布无 `Something went wrong` |
| 资产库角色生成失败卡 | ✅ 只有「重新生成」 |
| 纯函数（4 类原文 → 文案 + 按钮判定） | ✅ 5/5：四类全部统一成新文案、工作流按钮仍 true、视频模型 false、兜底桶不误判 |
| 控制台 | ✅ 0 error |

### 6. 部署

- 测试服：`bump-version.mjs` v52→**v53** → tgz(3 文件) → build → `sync-ali-test.sh` → `PUBLISHED_APP_VERSION` sed → `x-app-version: v1.0.0.53` + 外网 200。
- 正式服：备份 `/opt/flashmuse/app-backups/20260729-123320-presync-v53` → staging→prod rsync（**不再 bump**）→ build（`No pending migrations to apply.` / `✓ Ready in 78ms`）→ `.next/static` 同步阿里正式镜像 → 发布版本号 → **四域名 main/api/ali/static 全 200**、`x-app-version: v1.0.0.53`。
- GitHub：commit `ab6e223` 已推。**无 Prisma 迁移。**

### 7. ⛔ 本次的操作记忆

1. ⭐ **查线上 DB 不用写文件**（plan 模式也能用）：把 node 脚本 base64 后 `sudo docker exec <容器> sh -c 'echo <b64> | base64 -d | node'` —— 绕开 PowerShell 吃 `$`/中文/引号的所有坑。
2. ⛔ **`GenerationEvent` 没有 `surface` 列、`MediaAsset` 没有 `name` 列**（是 `displayName`/`systemName`）、积分表叫 **`CreditLedger`**（字段 `credits`，不是 `amount`）。先 `information_schema.columns` 查列名再写 SQL，省两轮报错。
3. ⛔ **PowerShell 没有 heredoc**：`git commit -F -` + `<<'EOF'` 直接语法错 → 提交信息写成文件再 `git commit -F <file>`。
4. ⭐ **删大段代码用 `[System.IO.File]::ReadAllLines` + 切片重写**（UTF8 无 BOM），比 edit 工具贴几十行 oldString 稳；但**改中文字符串一律用 edit 工具**。
5. ⚠️ `npx eslint` 在本项目本来就有 22 个 error（`react-hooks/immutability` 等历史遗留），**不是本次引入**，别被吓到；判断标准是"报错行是否在本次改动区域"。
6. ⭐ 老数据里存下来的红字**不会随代码改动而变**（红字是持久化的字符串）。测试时要看**新发起**的那一次。

## 2026-07-29（第十三次会话）⭐⭐ 归档 120 条「图片平台没有返回图片」 + 工作流「高清」改成四选项下拉 —— ✅ **四方同步 v1.0.0.52（正式服 = 测试服 = 本地 = GitHub）**

### 1. 归档：正式服 120 条、测试服 3 条（用户拍板归档）

- 新增归档规则 **`gpt-image-empty-result-legacy-form`**，`match: /图片平台没有返回图片：/`（**只认全角冒号**）。
  这正是后台归一化成「图片平台没有返回图片（模型未产出或拒绝生成）」那一桶的形态特征（见 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`），
  一条正则同时覆盖第十二次会话查出的三种旧形态（92 条 500 字小作文 / 7 条模型复读提示词 / 2 条 520 与空响应伪装）。
  ⛔ **绝不能放宽成 `图片平台没有返回图片` 裸串** —— 那会连带吃掉 `…，且没有返回可用原因。`（另一个根因、仍落兜底桶）
  和 `…，模型只回了一段文字：`（v51 新形态），两者都不该归档。
- ⭐ **正式服实际命中 120 条，不是文档里记的 101 条** —— 07-29 之后同类又新长了约 19 条，pending 总数也从 286 涨到 319。
  **教训：文档里的条数是快照，跑归档前一定重新 dry-run 看真实数字。**
- 结果：**正式服 319 → 199 待排查**；测试服 47 → 44。
- ⛔⭐ **顺手修掉一个会误伤的归档 bug**（差点污染生产数据）：dry-run 发现旧规则 `provider-insufficient-credits`
  **又命中了 11 条 07-28 上次归档之后新发生的事件**。按铁律 ④「映射出去后新形成的那条明确原因本身不归档（修不了就该一直亮着）」，
  这 11 条属于「提供商余额不足！请联系管理员充值。」这条明确文案，**必须继续亮着**。
  修法 = 给规则支持可选的 **`before` 日期下限** + 新增 `ruleAllowsEvents()`，该规则设 `before = 2026-07-27T18:19:00Z`
  （v1.0.0.47 上正式服的时刻，备份目录 `20260728-021857`）。加了下限后 dry-run 从 131 变成干净的 120。
  ⭐ **以后凡是 note 里写着「以后新发生的不再归档」的规则，都必须配 `before`，否则它会年复一年地吃新数据。**

### 2. 工作流「高清」：单按钮 → 四选项下拉（用户需求，功能与提示词一字未改）

| | 改动前 | 改动后 |
|---|---|---|
| 交互 | 一个按钮，点了就跑 | 下拉（悬停展开）：**GPT 2K / GPT 4K / Gemini 2K / Gemini 4K** |
| 模型 | 固定候选链 Gemini 3.1 Flash → Gemini 3 Pro → Seedream 4.5，前一个失败自动换下一个 | 用户选：GPT = **直连版 `openai/gpt-5.4-image-2`**；Gemini = `google/gemini-3.1-flash-image-preview` |
| 分辨率 | 固定该模型的 4K 档 | 用户选 2K / 4K |
| 失败行为 | 全链尝试完才失败卡 | **用户明确选了模型就不再悄悄换成别的模型**，直接失败卡 |
| 提示词 / 比例 | 指令式提升清晰度，比例贴源图 | **完全不变** |

- ⭐ **拆开了「高清」和「橡皮」共用的那条链**：以前 `EDIT_FUNCTION_KEYS = ["hd","eraser"]` 共用 `EDIT_FUNCTION_MODEL_CHAIN`，
  高清一改就会连带改掉橡皮 → 现在 `EDIT_FUNCTION_KEYS = ["eraser"]` + 新增 `HD_FUNCTION_MODEL_CHAIN` / `HD_FUNCTION_KEYS`。
  **橡皮的三级候选链行为一字未变**（实机验过面板照常打开）。
- ⭐ **复用了现成的一切、没有新起炉灶**：下拉 UI 抄「视频截图」那套 hover 下拉；生成链路直接走
  `createImageEditNode({ model, resolution, ratioFromSourceImage: true })` 的**既有 else 分支** —— `createImageEditNode` 本体**零改动**。
- **后台开关（`/admin?tab=settings` → 工作流 · 图片编辑功能）**：高清那行从「首选/次选/三选」变成 **GPT / Gemini 两个按模型的开关**。
  关掉一个 → 它的 2K/4K **两个选项一起隐藏**；两个都关 → **整个高清按钮不显示**。
  ⚠️ 高清**故意不做「全关就回落完整链」**（橡皮仍保留该回落）—— 用户要的就是"关了就没有"。
- 选项还要过第二道闸：该模型必须在后台启用的图片模型清单里（`enabledImageModelIds`），与画布其它地方一致。
- 三处配置表必须同步改（新增高清模型时）：`system-settings.ts` 的 `HD_FUNCTION_MODEL_CHAIN`、
  `workflow-tldraw-canvas-inner.tsx` 的 `HD_MODEL_OPTIONS`、`admin-system-settings-panel.tsx` 的 `HD_MODEL_CHAIN`。

### ⛔⛔ 本次踩的坑：React #310 把整个 tldraw 画布搞崩（v52 第一次上测试服就白屏）

- 症状：点任意节点 → 画布整个变成 **「Something went wrong / Please refresh your browser」**，
  控制台 `Minified React error #310`（**Rendered more hooks than during the previous render**）。
- 真因：我把算 `hdOptions` 的 **`useMemo` 放在了 `WorkflowSelectedNodeOverlay` 的 `if (!selected) return null;`（`:2493`）之后**。
  没选中节点时提前 return，那次渲染的 Hook 数就比选中时少一个 → 直接崩。
- 修法：**这里不用 Hook**，直接算（只有 4 个元素）。已在代码里写死注释警告。
- ⭐ **通用教训：往 `WorkflowSelectedNodeOverlay` 这种"中途 return null"的组件里加东西，一律加在提前 return 之前，
  或者干脆别用 Hook。** 新增的 `useState`（`hdMenuOpen`）放在了 2459 行、提前 return 之前，所以没事。

### 测试服实机验收（全过，0 控制台错误）

| 项 | 结果 |
|---|---|
| 高清下拉展开 | ✅ 四个选项齐全，样式与「视频截图」下拉一致 |
| **Gemini 2K** 实跑 | ✅ 成功出图，节点标签 `Gemini 3.1 Flash Image Preview / 16:9 / 2K / 2752x1536`（比例贴源图），扣 7 积分 |
| **GPT 2K** 实跑 | ✅ 成功出图，`GPT-5.4 Image 2 / 16:9 / 2K / 2560x1440` |
| **GPT 4K** 实跑 | ✅ 参数正确 `/ 4K / 3840x2160`、请求正常到达模型；本次源图是沙滩排球比基尼 → **模型自己拒绝**（非 bug，见下） |
| 后台关掉 GPT 开关 → 刷新前台 | ✅ 只剩 Gemini 2K / Gemini 4K |
| 后台两个都关 → 刷新前台 | ✅ **整个高清按钮消失**（快捷菜单只剩 快捷编辑/去背景/橡皮工具） |
| 开关恢复 ON 并刷新后台 | ✅ 持久化正确，橡皮三级链未受影响（`橡皮工具 首选` 仍 ON） |
| 橡皮工具（共用 `createImageEditNode`） | ✅ 面板正常打开（取消 / 立即使用） |
| 对话流 | ✅ 正常加载历史会话 |
| 后台「失败排查」页 | ✅ 数据正确（待排查 45 / 兜底桶 15 / 已归档 13），0 控制台错误 |

⚠️ **Gemini 4K 没单独实跑**（与 Gemini 2K 同一条代码路径、只差 `resolution` 字符串）。
⚠️ 开关改完**要刷新前台页面才生效**（`editModelToggles` 随 `/api/model-availability` 在页面加载时取一次），与其它模型开关行为一致，不是 bug。

### ⭐ 白捡一个：v51 遗留的"没实机测到"补上了一项

第十二次会话留了两项没测到，其中「**直连版 `openai/gpt-5.4-image-2` 的安全拒绝红字**」（当时四次全撞 1015 限流）
本次被 GPT 4K 那次意外触发、**完整跑通**，与预测文案逐字一致：

```
(B_58) 模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或由AI安全改写后重试，
AI改写会尽量保留原意和参考图，但不保证一定成功。以下是模型返回的拒绝原因："sexu…"
```

失败卡上「AI改写重试 3 次 / 5 次 / 10 次」**三颗按钮全部正常出现**，说明
`modelSupportsPromptSafetyRewrite()` + `isModelRefusedMessage()` 前缀判定这条链路是通的。
⭐ **另外白得一条测试技巧：想触发直连版的安全拒绝，不用改提示词硬碰 —— 拿一张"擦边的源图"走高清（img2img）即可，一次就中。**
（对比：第十二次会话在资产库靠改提示词试了 5 次全部照样出图、烧了约 96 积分。）
**仍未实机测到的只剩「资产库拒绝类失败卡的三颗按钮」一项。**

### 部署（严格按铁律：先测试服 → 验证 → 原样同步正式服）

1. `node scripts/bump-version.mjs`：v1.0.0.51 → **v1.0.0.52**（只在部署测试服这一步 bump）。
2. 测试服：tgz 14 个文件 → `/opt/flashmuse-staging/app` → `up -d --build staging-app` → `sync-ali-test.sh` → `PUBLISHED_APP_VERSION` 置 v52。
   （⚠️ 中途因 React #310 修了一次 `workflow-tldraw-canvas-inner.tsx` 并重新 build + 重新同步阿里静态。）
3. 归档脚本：测试服 `--apply` 3 条；正式服 `--apply` **120 条**（先 dry-run 两轮确认数字才 apply）。
4. 正式服：备份 `/opt/flashmuse/app-backups/20260728-214222-presync-v52` → 服务器到服务器 rsync（**不再 bump**）
   → `up -d --build flashmuse-app`（`No pending migrations to apply.`）→ `.next/static` 同步阿里正式镜像
   → `PUBLISHED_APP_VERSION` 置 v52 + force-recreate。
5. 健康检查：**main / api / ali / static 四域名全 200**，两服 `x-app-version: v1.0.0.52`，正式服首页 0 控制台错误。
6. commit + push → **四方同步 v1.0.0.52**。

**改了 4 个文件**（在 v51 那批 10 个文件之上）：`src/lib/system-settings.ts`、
`src/components/workflow-tldraw-canvas-inner.tsx`、`src/app/admin/admin-system-settings-panel.tsx`、
`scripts/archive-resolved-generation-failures.mjs`。**只动高清这一条路径 + 归档脚本，其它生成链路零改动。**

### ⭐⭐ 第十三次会话的操作记忆（下次直接照抄，全都实际跑通过）

**Playwright 操作 tldraw 画布（工作流）—— 这套之前没人写下来，摸索了一会儿**

1. ⛔ **`browser_click` 点不到画布里的节点**：会报
   `<img alt="生成图片" …> from <div class="tl-html-layer tl-shapes"> subtree intercepts pointer events` 然后超时。
   ✅ **必须用 `browser_run_code_unsafe` 里的 `page.mouse.click(x, y)`**（坐标从截图上量）。
2. ✅ **`Shift+1` = 缩放到适应全部节点**（tldraw 快捷键）。每次点开节点/生成完新节点后视口会乱，先 `Shift+1` 再按截图量坐标最省事。
3. ✅ **打开快捷菜单里的下拉**：`page.locator('button', { hasText: '高清' }).first().hover()` + 等 ~700ms，
   然后 `page.getByRole('button', { name: 'GPT 2K', exact: true }).click()`。
   ⚠️ **`exact: true` 必须加**，否则 `GPT 2K` 会同时匹配到 `GPT 4K` 之类。
4. ✅ **判断生成是否结束**：轮询 `document.body.innerText`，`!t.includes('生成中')` 即结束。
   ⚠️ 单次 `run_code` 有 30s 上限、MCP 调用有超时 → **长等待要拆成多次调用**，别在一个 `run_code` 里循环 100 秒（本次超时过一次）。
5. ✅ **验证模型/分辨率有没有走对**：节点右上角标签会打印 `模型名 / 比例 / 分辨率 / 实际像素`
   （例 `Gemini 3.1 Flash Image Preview / 16:9 / 2K / 2752x1536`），直接从 `innerText` 里读，比看图可靠。
6. ⚠️ **`page.reload({ waitUntil: 'networkidle' })` 在这个站会超时**（有长轮询）→ 用 `page.goto(url)` + 固定 `waitForTimeout`。
7. ⚠️ **测后台开关对前台的影响，必须重新加载前台页面**：`editModelToggles` 随 `/api/model-availability`
   **只在页面加载时取一次**。我一度以为高清按钮没了/没恢复，其实是那个标签页还是开关关闭时加载的。**不是 bug。**

**部署辅助脚本（因为 PowerShell 会吃掉 ssh 内联里的 `$(...)`/引号，一律写成本地 .sh → scp → `sed -i 's/\r$//'` → bash）**

本次写了 4 个放在本地 `.runtime/`（不进 git，需要时按下面用途重建即可）：

| 脚本 | 用途 |
|---|---|
| `pub52.sh` | 测试服：sed 改 `PUBLISHED_APP_VERSION` → `up -d --force-recreate staging-app` → 验版本头 |
| `prodsync52.sh` | 正式服：`$(date)` 生成时间戳备份目录 → staging→prod 服务器间 rsync → 打印版本号 |
| `syncali52.sh` | 正式服：`docker cp .next/static` → rsync 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/` |
| `pub52prod.sh` | 正式服：sed 改 `PUBLISHED_APP_VERSION` → force-recreate → 验版本头 + 四域名健康检查 |

⭐ **服务器上 `/tmp/health.sh` 还在**（上一批会话留的），`bash /tmp/health.sh` 直接就能打四域名 200，不用重写。

**测试服遗留数据（用户交代"测试内容不要删"，已保留）**

`工作流_01` 里多了 3 个本次测试产生的节点：Gemini 2K 成功图、GPT 2K 成功图（悟空那张）、
GPT 4K 的**失败卡**（模型安全拒绝，带三颗 AI 改写按钮）。⭐ 那张失败卡**留着正好是拒绝类失败卡的活样本**，别删。
测试服后台的高清 GPT / Gemini 开关**已恢复成 ON 并验证持久化**。

**其它小认知**

- ✅ **测试服后台可以用 `lookxun@163.com` / `dragonstar` 登录**（`/admin` → 邮箱 + 密码）。
  ⚠️ 注意区分：`01` 文档里说的"该账号没有可用密码"指的是**本地库**，测试服上是能登的。
- ⚠️ **`createImageEditNode` 的 `highDef` 选项现在是死代码**：它只在 `modelCandidates` 分支里被读，
  而唯一还用候选链的橡皮从不传 `highDef`。**故意留着没删**（那是共享函数的通用入参，删它要动签名、收益为零）。
- ⚠️ **本地 dry-run 归档永远是 0**：本地库没有线上失败数据（本次 `pendingFailureEvents: 39`、`toArchive: 0`）。
  **要看真实数字必须进服务器容器跑**（`docker cp` 脚本进 `/app` 再 `docker exec -w /app node ...`，否则找不到 `@prisma/client`）。
- ✅ 归档脚本改完先 `node --check` 语法自查：本次 note 里写了 ASCII 双引号 `"没出图"` 直接把 JS 字符串截断了
  （`SyntaxError: Unexpected identifier`）→ **中文 note 里一律用「」，别用 `"`**。


## 2026-07-29（第十二次会话）⭐⭐ 「图片平台没有返回图片」101 条查清 + 模型拒绝红字改成「统一文案 + 附模型原话」+ 资产库补 AI 改写 —— ⚠️ **只部署了测试服 v1.0.0.51，正式服仍 v1.0.0.50**

### 本次主线：接着排查红字，目标 = 「图片平台没有返回图片（模型未产出或拒绝生成）」101 条

#### ⭐ 结论一：这 101 条几乎全是「模型自己不肯画」，而我们把模型那段话当报错原样贴出去了

正式服实测构成（**全部 `openai/gpt-5.4-image-2`(61) + `-agent`(40)，OpenRouter 图片，全部来自同一个打点** `openrouter.ts` 老 `/chat/completions` 的 `image-provider-empty-result`）：

| 实际根因 | 条数 | 改动前用户看到什么 |
|---|---|---|
| **模型明文拒绝**（"抱歉，我不能帮助生成这类带有明显性化聚焦的人物图像…"） | **92** | 模型那段 **500 字小作文原样当红字**吐出来 |
| **模型把提示词/改写建议原样复读回来**（没出图、也没拒绝语） | **7** | 红字 = 用户自己的提示词（"白底纯净背景，北宋官制腰刀…"），完全看不懂 |
| **真实上游错误被这条文案掩盖**：`error code: 520`（Cloudflare）、`Provider returned an empty response` | **2** | "图片平台没有返回图片：error code: 520" |

#### ⛔⛔ 结论二：后台那条「高度集中在一个入口 = 该统一却分叉了」的信号，**这次是假信号**

新页显示「工作流 88 / 对话流 11 / 资产库 1 / Agent 1」，看着像分叉。实查：**101 条里 76 条来自同一个用户 ID_868181**（07-22~24 三天、一个会话、反复试同一批擦边提示词，07-23 一天 41 条），另 17 条来自 ID_686996。入口集中只是**这个人爱用工作流**。
⭐ **教训：看到"集中在一个入口"，先去「失败最多的用户」那张卡对一下是不是一个人刷出来的，再判断是不是分叉。**

#### ⭐⭐ 结论三：两个 gpt image2 的**红字形态不同**，是因为**走两条完全不同的接口**（用户当场质疑我没分清，核实后用户是对的）

| 后台名字 | model id | 走哪个接口 | 上游给回来什么 |
|---|---|---|---|
| GPT-5.4 Image 2（**GPT版**） | `openai/gpt-5.4-image-2-agent` | **老** `/chat/completions` | 中间那层语言模型把图片模型的拒绝**翻成中文人话**还回来（小作文）⭐ **信息量最大，常直接给出可用的安全改法** |
| GPT-5.4 Image 2（**直连版**） | `openai/gpt-5.4-image-2` | **新** `/api/v1/images`（2026-07-19 commit `d85fa92` 迁的） | OpenAI 直接 **400** `rejected by the safety system`（**有时**附 `safety_violations=[sexu…]`，有时连这个都没有） |

- 为什么 61 条挂在"直连版"名下却也是小作文：**它们全部发生在 07-17 及之前**（最后一条 07-17 16:24），那时 `gpt-5.4-image-2` 还没迁走、也还在走老接口。07-19 迁走后这个 id 再没出过一条小作文。
- ⛔ **修正上一任/我自己一开始的误判**：不是"换新接口就好了"。**GPT版还在走老接口、机制一点没变，随时会再犯**；07-24 之后没再发生只是因为那位重灾用户不试了。
- 用户线上实测的两批错误码（本次亲自去正式服 DB + 日志核实）：
  - **B_622~625**（07-28 07:26:54，GPT版，4 张图）→ 200 但没图，日志里小作文原文完整：`抱歉，我不能帮助生成这个人物"没穿衣服"的图像。如果你愿意，我可以改为生成同一人物在泳池里的安全版本，例如：- 穿连体泳衣或比基尼…`。**v50 的 `isModelRefusalText` 把它整段替换成统一文案 → 原文被扔掉，用户一个字看不到。**
  - **B_626~629**（07:27:01，直连版，同一段提示词）→ HTTP 400，原文 `Your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com and include the request ID d561e015-...`。**这次 OpenAI 没给 `safety_violations`** → 抠不到类别 → 落到"可能是提示词内容不符合平台安全策略"那句（所以用户说"也没有【sexu…】"）。

#### ⭐ 结论四：第十次会话留的「新接口 upstream.body 待跟踪」口子 —— **可以撤了**

正式服日志里 `image-provider-empty-result` **带 body 的一条都没有**（该 event 最后一次发生 = 2026-07-23，且全部来自老接口）。原因很明确：**直连版的拒绝走的是 400 `image-provider-non-ok` 分支，不会走到"200 但没图"**。已把 `openrouter.ts:1700` 那段"待跟踪"注释改成这个结论，body 继续留着做保险。

### 本次改动（9 个文件，全部只动失败分支，成功路径零改动）

用户拍板的最终产品要求：
> 「两种接口都尽量显示原文；小作文和【sexu…】**都要启动 AI 改写**；红字与 AI 改写**成套出现**；资产库也覆盖；对话流和资产库的失败卡上**只要显示了 AI 改写就不显示「重新生成」**；三颗 AI 改写按钮**上下居中**、字号与「重新生成」一样；需要兜底就统一用「模型拒绝了本次生成请求，可能是提示词内容不符合平台安全策略！…」这一句。工作流不用改，保持现状。」

1. **`src/lib/models.ts`** 新增唯一权威 **`modelSupportsPromptSafetyRewrite(modelId)`**（= gpt image2 两款）。
   ⭐ 它同时被"红字文案要不要写可AI改写"和"失败卡按钮要不要显示"两处使用 → **保证"红字承诺"与"按钮存在"永远一致**。
   （起因：用户问「视频怎么会误显示？能不能加模型判断？」—— 能，而且很干净。以前 `toUserErrorMessage` 只收到错误字符串、不知道模型，所以视频碰到拒绝语也会被写上"可点AI改写"，而视频没这个按钮。）
2. **`src/lib/error-message.ts`**（唯一入口，全模式生效）：
   - 删掉旧的 `MODEL_REFUSED_MESSAGE`，改成 **前缀常量 `MODEL_REFUSED_PREFIX = "模型因色情/暴力/隐私安全等原因拒绝出图"`** + `MODEL_REFUSED_REWRITE_HINT` / `MODEL_REFUSED_PLAIN_HINT` + `MODEL_REFUSED_FALLBACK_MESSAGE`（用户指定那句）+ `buildModelRefusedMessage(detail, canRewrite)`（原文截 260 字、剥掉我们自己包的"图片平台没有返回图片："外壳）。
   - **把两条拒绝规则合并成一条**：A) 直连版 `rejected by the safety system` → 优先取 `safety_violations=[...]`，没有就取那句英文并**削掉 `If you believe this is an error, contact us at …` 客服尾巴**；B) GPT版 `isModelRefusalText` → 原文即 detail。
   - 新增 C) **「模型只回了一段文字」**分支（提示词复读那 7 条）→ 「模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。以下是模型返回的内容：…」。
   - 新增 `isModelRefusedMessage(value)`（认前缀，供 `gpt-image-safety-retry` 判定）。
   - `toUserErrorMessage(value, fallback, options?: { model })` 新增第三参。
   - ⭐ **幂等保护**：如果传进来的已经是我们映射好的成品文案 → 原样返回。**为什么必须有**：这个函数在"服务端映射 → 前端再映射"链路上可能被调两次，而末尾兜底透传会把文案截到 180 字 → 会把刚附上的模型原文砍掉。
   - 修 **供应商名脱敏削域名**的 bug：`\bOpenAI\b` 把 `help.openai.com` 削成 `help..com` → 改成 `(?<![.\w])…(?![.\w])`。
   - 新增网关规则 `error code: 5\d\d|provider returned an empty response` → 「平台服务临时异常，请稍后重试。」
   - ⭐ **限流文案按用户要求改成「当前模型繁忙或被限流，请稍候再重试！」**（原「图片服务当前繁忙（限流），请稍后重试。」会让用户以为是我们的服务忙或自己点太快）。
3. **`src/lib/error-code.ts`**：`createCodedApiError(error, fallback, scope, options?: { model })` 透传。
4. **`src/app/api/image/route.ts:240`** + **`src/lib/generation-jobs.ts:751`** + 资产库前端三处传 model（视频那 6 处**故意不传** → 自动走不含"AI改写"的文案）。
5. **`src/lib/gpt-image-safety-retry.ts`**：判定改用 `isModelRefusedMessage`（**认前缀，⛔ 绝不能改回整句比对**）+ 改用 `modelSupportsPromptSafetyRewrite`；新增唯一权威 **`ensureMentionNamesPreserved()`**（保证改写后 @引用名一个不丢，见下）。
6. **`src/lib/openrouter.ts`**：`getOpenRouterNoImageReason` 改成返回 `{ providerError, modelText, combined }`，把三种情况彻底分开抛：① 平台报错 → `图片生成失败：${原文}`（让它正常映射成"平台临时异常"并保持可自动重试）② 模型拒绝 → `图片平台没有返回图片：${原文}` ③ 只回文字 → `图片平台没有返回图片，模型只回了一段文字：${原文}`。日志 upstream 多带 `providerError`。
7. **`src/components/chat-workbench.tsx`**：
   - `MediaOptimizationRetryActions` 从"右下角 12px 横排"改成**上下居中、`flex-col`、14px**（与「重新生成」同字号）。
   - `ImageResultStrip` / `ImageResultSlotStrip` 两处都加 `showOptimizationRetry` → **有 AI 改写就不渲染「重新生成」**（对话流 + Agent 模式共用这两个组件，一起生效）。
   - ⭐ **资产库补齐整套 AI 改写**（此前唯一漏做的入口）：`CharacterGenerationResult` 加 3 个字段（`gptImageOptimizationOriginalPrompt` / `AttemptPrompts` / `gptImageOptimizing`，老数据缺就当空、向后兼容）；`generateCharacterImage(options?: { promptOverride, carryOptimization, rethrowError })`；新增 `canAssetOptimizationRetry()` + `runAssetGptImageOptimizationRetry()`（编排走共享 `runPromptSafetyRetry`）；`isAssetOptimizingRef` 防连点；改写中显示等待卡（`status==='generating' || gptImageOptimizing`）；失败卡按同一规则显示三颗按钮/隐藏「重新生成」。
   - ⭐ **@名保护**（用户拍板）：改写后的提示词若丢了 @名，参考图会全丢 → 资产库在 `generate` 回调里过 `ensureMentionNamesPreserved()` 把缺失的 @名补回提示词最前面。
8. **`src/lib/admin-failure-triage.ts`**：⚠️ **自己引入的新问题，自己堵上** —— 新文案带可变原文，后台「失败原因」会炸成几十条各 1 条 → `FAILURE_REASON_SQL` 再套两层 `regexp_replace`，把「模型因色情/暴力/隐私安全等原因拒绝出图…」和「模型这次没有出图，只回了一段文字…」按前缀收敛。⛔ **以后改这两句文案要同步这里的前缀。**

### 上线前的确定性验证（用真实上游原文过纯函数，13 个用例）

写了一次性 `scripts/check-model-refusal-messages.mts`（跑完已删）把正式服真实原文喂进 `toUserErrorMessage` + `isGptImageSafetyFailure`，断言「红字里承诺了 AI 改写 ⇔ 按钮真的显示」：
**结果 13/13 通过，不一致用例 = 0。** 覆盖：B_622 小作文 / B_626 英文原文 / 带 safety_violations / 同一拒绝语落在视频模型（应不提 AI 改写且不显示按钮）/ 不传 model / 520 / empty response / 提示词复读 / 兜底桶不变 / 余额不足 / 参考图尺寸 / 成品被拒交付 / Kling `Image pixel is invalid` 全部回归正常。

### 部署与实机验收（测试服 v1.0.0.51，⚠️ 正式服未动）

- `node scripts/bump-version.mjs` → v50→**v51**；tgz 10 个文件 → `/opt/flashmuse-staging/app` → `up -d --build staging-app`（**No pending migrations**）→ `sync-ali-test.sh` → `PUBLISHED_APP_VERSION: "v1.0.0.51"` + force-recreate → `x-app-version: v1.0.0.51`、HTML v1.0.0.51、`http://101.37.129.164:8080/` 200。
- 用主测试号 `12424740@qq.com` 实测：

| 项 | 结果 |
|---|---|
| **GPT版红字带小作文原文** | ✅ `(B_47) 模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或由AI安全改写后重试…以下是模型返回的拒绝原因："抱歉，我不能帮助生成露骨裸体或强调性化身体部位的写实图像。如果你愿意，我可以改为帮你生成这些安全版本之一：- 年轻成年女性穿泳装躺在泳池里的写实俯拍照片…例如可用提示词：…"` |
| **三颗按钮上下居中 + 14px** | ✅ 实测 `fontSize=14px`、水平偏移 `0/0/0`、垂直 `−22/0/+22`（卡 250×250） |
| **有 AI 改写就不显示「重新生成」** | ✅ 新卡 innerText = `图片生成失败\|AI改写重试3次\|AI改写重试5次\|AI改写重试10次` |
| **点 AI 改写 → 等待卡不闪回** | ✅ 全程只显示等待卡（约 2 分钟），失败卡没回来 |
| **改写后成功出图** | ✅ 一次就过。原词`…没穿衣服躺在泳池里…强调身体曲线` → 改写`…穿保守泳衣躺在泳池里…强调姿态线条` |
| **反例：限流失败卡不亮 AI 改写** | ✅ B_48/49/50/51/54 都只有「重新生成」 |
| **反例：资产库限流失败卡** | ✅ 同上，只有「重新生成」（说明资产库失败卡本身渲染正常） |
| **刷新后 AI 改写按钮是否还在** | ✅ **在**（详见下面那条误报纠正） |
| 控制台 | ✅ 0 个真实报错（只有我们自己的 `[asset-generation] image request failed` 日志） |

### ⛔⛔ 一次误报及其纠正（**下一个 AI 千万别再踩**）

我一度报告「刷新后历史消息的失败卡不再渲染，只剩红字，用户刷新一下 AI 改写按钮就没了」。**这是错的，根本没这个 bug。**

- 逐层排查证明数据完好：测试服 DB 的 `messagesJson`、`GET /api/workspace-state` 返回，`mode:"image"` / `failedImageCount:1` / `imageResultSlots:[{type:"failed",reason:"(B_47)…"}]` / `generationMeta.model` / `settings.imageCount:"1张"` **一个字段都没丢**；`sanitizeWorkspaceMessage` 也不删这些字段。
- ⭐ **真正原因：失败卡被包在 `<LazyMediaMount height={250}>` 里**（`chat-workbench.tsx:16531`）—— **滚动到视口附近才挂载**，没进视口时只是 250px 占位。而红字**不在**这个组件里，所以红字一直显示。于是"红字在、卡不在"就被我误判成数据丢了。
- 验证方式：把那条消息 `scrollIntoView({block:'center'})` + 等 2.5s → 卡立刻出现，innerText = `图片生成失败|AI改写重试3次|AI改写重试5次|AI改写重试10次`。
- ⛔ **教训：用 `document.querySelectorAll('.flashmuse-failed-media-card')` 统计对话流失败卡是不可靠的**（懒挂载）。要先把目标消息滚进视口再断言。**别看到"红字在、卡不在"就下结论说数据丢了。**

### ⭐ 顺带查清：「图片服务当前繁忙（限流）」到底是什么（用户提问）

测试服日志原文：

```
HTTP 429 Too Many Requests
{"error":{"message":"OpenAI was rate limited by Cloudflare (error code: 1015)","code":429,
          "metadata":{"provider_name":"OpenAI"}}}
```

- `error code: 1015` 是 **Cloudflare 的限速码**。整句意思是 **OpenRouter 去调 OpenAI 时被 OpenAI 的 Cloudflare 挡了** —— 限速发生在 **OpenRouter → OpenAI** 那一跳，**跟我们的账号配额、用户点太快都没关系**（OpenRouter 出口 IP 被限，我们改不了）。
- 我们的行为是对的：同一 requestId 09:36:14 / 09:36:32 / 09:36:54 / 09:37:22 **自动重试 4 次、扛了约 70 秒**才 `image-job-failed`。
- 正式服 07-28 也有 **7 条**同类失败（都在资产库入口、都是直连版）。
- **用户拍板：只改文案**（改成「当前模型繁忙或被限流，请稍候再重试！」），**不动重试退避、不做限流自动降级**。
  （我提过的可选项：对 1015 用更长退避 30/60/120s；或限流时降级到 GPT版老接口 —— 后者会改变计费/画质预期，未采纳。）

### ⚠️ 两项没能实机测到（如实记录，别当成已验证）

1. **直连版的安全拒绝红字** —— 试了 4 次，**每次都撞 OpenRouter 限流**（B_48/49/50/51），拿不到 `rejected by the safety system`。已用真实原文做过纯函数验证，但**没有实机跑通**。
2. **资产库的"拒绝类"失败卡（三颗按钮）** —— 试了 5 次角色生成（约 96 积分），**每次都成功出图**：⭐ **角色生成的 `ruleText` 会把提示词包装成"角色设定图"，中间那层语言模型就不拒绝了**（试过"全裸/露骨""极度血腥断肢""1:1 复刻明星脸"全部照样出图）。资产库失败卡本体渲染正常（限流那次验证过、且正确地只显示「重新生成」），判定用的也是**与对话流同一个共享函数**，但"拒绝类文案 → 出现三颗按钮"这一步资产库侧没实际触发过。

### 本次会话结束时的状态

- 测试服 = **v1.0.0.51**（含上面全部改动，但**限流文案那一行是在部署之后才改的、还没上测试服**）。
- 正式服 = **v1.0.0.50**（一行没动）。GitHub = v1.0.0.50（**本次改动未 commit、未 push**）。
- 本地 `npx tsc --noEmit` 全绿（`src/` 无错）。无 Prisma 迁移。
- **归档脚本本次没跑**（这 101 条归不归档还没定，见 `05-next-actions.md`）。

## 2026-07-28（第十一次会话）⭐⭐ 「40 条轮询 failed」全部查清并修 + 后台新增「失败排查」页 —— ✅ **已部署两服 v1.0.0.50**

### 部署结果（一次性把积压的第十次 + 第十一次两批全部上线）

- ✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.50`**（commit `1fd1ef3`）。**无 Prisma 迁移**（两服 entrypoint 均 `No pending migrations`）。
- 正式服备份 `/opt/flashmuse/app-backups/20260728-140839-presync-v50`；四域名 main/api/ali/static 全 **200**；两服 `x-app-version: v1.0.0.50`。
- 归档：**正式服 33 条**（`kling-reference-image-pixel-invalid` 32 + `veo-r2v-duration` 1）→ 待排查 **308 → 286**；
  测试服命中 0（正常，无这批数据）、仍 36。⭐ 兜底桶「服务器繁忙」**从 60 降到 28**（占待排查 9.8%）。
  （先 `dry-run` 核对 `toArchive: 33` 与排查结论一致，再 `--apply`。）
- 部署后正式服后台实测：新页 `/admin?tab=failures` 真实数据正常
  （286 待排查 / 18 种 / 影响用户 15 人 / 还在流血 10 种 · 已停止 8 种 / 已归档 400 / 图片失败率 13.2% / 视频 19.8%）；
  概览页「失败原因」卡片未坏、第 4 条「服务器繁忙」已显示 28。
- ⚠️⛔ **为什么版本号是 v50 而不是 v49**：v49 上测试服后新页立刻报 **hydration mismatch（React #418）** ——
  日期在**客户端** `Intl.DateTimeFormat` 格式化，服务器容器与浏览器时区不同 → SSR 与 CSR 文本不一致。
  修法：**所有日期改由服务端预格式化成 `firstAtLabel/lastAtLabel/lastAtAgoLabel/createdAtLabel/resolvedAtLabel` 字符串再传给客户端组件**，
  客户端一行日期逻辑都不留。修完按铁律重新 bump 才上正式服（v49 只在测试服活了几分钟）。
  **以后后台新页（客户端组件）绝对不要在浏览器端格式化日期。**（已写进 `00-README.md` 的「重要工具/环境认知」。）

### 测试服实机验收（用户要求"测过再上正式服"，全过）

| 项 | 结果 |
|---|---|
| Kling v3.0 Standard + 200×120 参考图 | ✅ 发送前拦下：「参考图「small-200x120」太小了（200×120）。生视频要求参考图宽和高都不小于 300 像素，请换一张更大的图。」 |
| Veo 3.1 + 参考图 + 4 秒 | ✅ 发送前拦下：「当前模型在使用参考图时只支持 8 秒的视频时长（你选的是 4 秒），请把时长改成 8 秒后重试。」 |
| **反例** Veo 3.1 + 4 秒 + **无参考图** | ✅ 不拦、正常渲染出片（纯文生视频没被误伤） |
| **反例** Kling + 1280×720 合规参考图 | ✅ 不拦、正常渲染出片 |
| 后台新页 | ✅ 测试服 36 待排查 / 兜底桶 15 / 已归档 10（与文档记录一致）；筛选·搜索·展开样本·复制全通；**0 控制台错误** |
| 后台概览页「失败原因」卡片 | ✅ 未坏（本次把它的归一化 SQL 改成 import 共享常量） |
| 工作流画布 | ✅ 正常加载、节点工具齐全 |

⚠️ **唯一没点到的**：**工作流侧**的 Kling 拦截没做到"点生成看提示"（tldraw 画布 8% 缩放下连线不适合自动化）。
它走的是同一个共享函数、`api/video/route.ts` 还有一道服务端 400 兜底，风险很低，**下次有机会人工点一次**。

### ⛔ 本次验收/排查踩到的操作坑（全部已写进 `00-README.md` 与 `07` 第十一节）

1. **黑底提示是瞬时的**，`browser_snapshot` 之后就没了 → 点发送后**立刻轮询** `body.innerText`（15×120ms 循环能抓到）。
   更稳的判据：**被拦时输入框里的提示词和参考图不会被清空**。
2. **Playwright MCP 的文件选择器不能在 `run_code` 里自己 `waitForEvent('filechooser')`** —— 与 MCP 的 modal 跟踪打架卡住。
   正确姿势：`browser_click` 点上传 → `browser_file_upload` 传文件 → 再 `run_code` 做后续。
3. **`find <文件名> | head -1` 会先命中缩略图副本**（`image-thumbnails/...`）→ 差点把 **256×145** 当成原图（真实是 **338×191**）。
   容器里**没有 ffmpeg/ffprobe**，量 jpg 宽高用 `python3` 直接读 SOF 段即可。
4. **PowerShell 里 `node -e` 的 `$` 会被吃掉**（`p.$disconnect()` → `p.()` 语法错）→ 一次性脚本一律写文件。
5. **本地进不了后台**的解法：临时把主测试号 `12424740@qq.com` 加进 `.env` 的 `ADMIN_EMAILS`（逗号分隔），**验完已还原**。
6. 造测试图不用找素材：项目已装 `sharp`，几行生成 200×120（触发拦截）+ 1280×720（合规反例）。
7. `.gitignore` 顺手加了 `/tmp/*.log`（本地 dev 日志别再进 git）。

### ⚠️ 验收时新发现一个小问题（未修，已记进 `05-next-actions.md`）

被发送前拦截后，**不改任何东西直接再点一次发送** → `POST /api/asset-upload-temp` **500**，
容器日志 `[upload] asset-upload-temp patch failed ... error: 上传文件不存在或已过期`。
临时上传凭证像是被第一次尝试消耗/失效了；重新上传即可。**不影响首次拦截的正确行为**，
但用户连点两次会看到一个没用的报错（而不是再看到那句明确的拦截原因）。优先级低。

### ⭐⭐⭐ 排查方法论突破：**OpenRouter 的视频任务事后仍可回查，别再"等新数据攒几天"**

上一轮的结论是"上游原文当时没落盘（只记 `hasError` 布尔）→ 只能等新数据"。**这个结论是错的。**
`video-provider-poll-success` 里的 `taskId` 对 OpenRouter 就是完整轮询 URL
（`https://openrouter.ai/api/v1/videos/<id>`），带 API Key 直接 GET 就能把**当时的 `error` 原文**取回来。
本次一次性把 07-27 那批 33 个任务的原文全捞到了。
（⚠️ BytePlus 的 `cgt-xxx` 没有这个待遇 → 那 6 条仍不可考。）

### 轮询失败的真实构成：75 条 distinct taskId（"40"只是落在兜底桶的那部分）

先建 `taskId → requestId` 桥（来自 `video-provider-create-success`，它两个字段都有），75/75 全部映射上 DB：
26 条已是明确文案「成品被平台拒绝交付」（不归档）/ 4 条「API Key 无效」/ **33 条 OpenRouter 落在兜底桶** /
**6 条 BytePlus 落在兜底桶且仍不可考**（B_195/237/246-249/256）。

### 那 33 条的两个根因

**A. `Image pixel is invalid` —— 32 条（Kling 全系）**
同一个用户 ID_664169、同一会话、同两张参考图，07-27 连续失败 32 次。参考图实测 **338×191**（高 < 300）。
⭐ **和第七次会话归档的 191 条 BytePlus「参考图尺寸不合规」是同一个根因**（那批原文正是 `received a 338x194px image`）。
漏出来的原因：v47 的发送前尺寸拦截被写死「只对 BytePlus 生效」（三处都是，注释还明写"别的模型不能拿它拦人"）→
**Kling 路径完全裸奔**；而 Kling 官方规则和 BytePlus 一模一样（≥300×300px、比例 1:2.5~2.5:1）。
典型的「该统一却分叉了」。而且它是**异步**失败（先 202 收下、一两分钟后才 failed）→ 用户白等再看到"服务器繁忙"。

**B. `Unsupported output video duration 4 seconds, supported durations are [8] for feature reference_to_video.` —— 1 条**
`google/veo-3.1` 纯文生视频支持 4/6/8 秒，但**带参考图（r2v）只允许 8 秒**，我们的时长表没有这个维度。

### 改动（用户拍板 1+2+3 一起做；全部只动错误/校验分支，成功路径零改动）

1. **`src/lib/video-reference-image-rules.ts`** 新增唯一权威 `videoModelEnforcesReferenceImageSizeRules(modelId)`
   （集合 = BytePlus Seedance ×3 + Kling ×3），**三处咽喉全部改用它**：
   `chat-workbench.tsx:13374` / `workflow-tldraw-canvas-inner.tsx:4433` / `api/video/route.ts:827`。
   ⚠️ 往集合里加模型必须有依据（官方文档或线上失败原文），别拿 BytePlus 的数去拦没验证过的模型。
   ⭐ 顺带记下一条认知：`api/video/route.ts` 那道服务端兜底靠 `MediaAsset.width/height` 查库，
   而这两条资产的 width/height **就是 null** → 服务端根本拦不住，**真正拦得住的是前端那道"现场量图"**。两道都得在。
2. **`src/lib/error-message.ts`** 新增两条映射（放在最前面那个块里、`specified asset` 之后）：
   `image pixel is invalid` → 「参考图尺寸不符合平台要求（宽高都需不小于 300 像素，宽高比 0.4–2.5）…」；
   `unsupported output video duration` → 读出上游 `supported durations are [...]` 原样告诉用户。
   **`src/lib/transient-error.ts`** 把这两类列入 `isPermanentError`（换图换参数才行，重试白烧时间）。
3. **`src/lib/models.ts`** 新增唯一权威 `VIDEO_REFERENCE_DURATION_LIMITS`（现只有 `google/veo-3.1: [8]`）
   + `validateVideoDurationWithReferences(modelId, duration, referenceCount)`，同样三处咽喉发送前拦截
   （服务端那道另加 `video-route-reference-duration-rejected` 日志点）。
   ⭐ **故意不做静默改写**（不悄悄把 4 秒改成 8 秒）—— 时长直接决定计费，悄悄改会让用户多花钱且莫名其妙。
   ⭐ 也**没有改 UI 时长下拉**（9 处调用点都要穿参数，风险高收益低）；拦截 + 明确提示已经 100% 堵住失败。
4. **`scripts/archive-resolved-generation-failures.mjs`** 新增 `kling-reference-image-pixel-invalid` / `veo-r2v-duration`
   两条规则，另做一处**结构性增强**：这批日志里根本没有原文 → 靠 `match` 永远匹配不上，
   所以新增 `taskId → requestId` 桥 + `pollFailedTaskIds` 集合（扫日志时顺手建），
   命中后**按模型**分派根因（`^kwaivgi/kling-` → A，`google/veo-3.1` → B；依据是那次回查，不是猜）。
   BytePlus 的轮询失败**不在**分派里、仍不归档。`select` 补了 `model`。

### ⭐ 后台新增独立页面「失败排查」`/admin?tab=failures`（左侧"生成记录"下面）

- 新文件：**`src/lib/admin-failure-triage.ts`**（唯一权威数据层，只读不写）+ `src/app/admin/admin-failure-triage-panel.tsx`。
- ⭐ 顺手**消掉一处抄三遍**：原因归一化的 `regexp_replace` SQL 在 `admin-overview.ts` 里抄了 3 遍，
  现抽成 `FAILURE_REASON_SQL` 导出，概览页改为 import 复用（那三处从 `$queryRaw` 模板改成 `$queryRawUnsafe`，
  SQL 字符串完全一致、无外部输入）。
- 这页比概览小卡多给的（都是实际排查时反复手查的）：
  ① 每条原因标 **「近 7 天仍在发生」/「已停止发生」**（还在流血=没修好；已停止=可考虑归档），
  **列表排序刻意先按"还在流血"再按条数**；② 标 **「兜底桶 · 需回日志捞原文」** + 单独的「两个兜底桶」卡片
  （含"`grep -c` 行数 ≠ 事件数"的警告）；③ 点开任意一行给**最近 6 条样本 requestId（一键复制）**；
  ④「按入口」卡片（只在一个入口出 = 大概率分叉）；⑤「按模型」带**失败率**（有分母）；
  ⑥「失败最多的用户」（本次那 32 条就是这么定位到的）；⑦ 近 30 天趋势 + 今日/昨日/7天环比；⑧ 已归档区（划掉+说明+时间）。
- ⚠️ 归档动作仍**只由脚本执行**，这页纯只读。
- 实测：本地库 39 条失败事件下整页渲染正常、7 种原因、筛选/搜索/展开样本/复制都通（临时把测试号加进 `.env` 的
  `ADMIN_EMAILS` 登录验证，**验完已还原**）。

### 自查

`npx tsc --noEmit`（过滤 `.next`）全绿；新增/改动文件 `eslint` 无 error。**无 Prisma 迁移**。

## 2026-07-28（第十次会话·补）⭐⭐ 「本地登录报请求失败」根治：`start-project.bat` 加 `.next` 损坏自愈 —— ⚠️ **仅本地脚本，不影响线上**

用户反馈"本地又登录不了、报请求失败，昨天也这样，是不是修不好了"。**跟业务代码无关**，查出三层问题，第三层才是"为什么昨天修好今天又坏、双击启动也救不回来"的真答案。

### ① 表象与第一层原因：`.next` 缓存损坏 → **所有 `/api/*` 全 404/500**

- 实测 `POST /api/auth/login-password` 返回 **404**，返回体里 Next 自己写着 `"c":["","api","auth","login-password"]` 却渲染成 `/_not-found`；路由文件本身好好在那。
- `.next/dev/types/routes.d.ts` **被写截断**（58 行、从字符串中间断掉 `e" | "/api/upload-image"...`）；`npx tsc --noEmit` 报的一堆 `TS1434/TS1109` 就是它。
- ⚠️ **我一开始把因果讲错了**：`routes.d.ts` 是纯类型文件、运行时会被剥掉，**不可能**导致 404。它只是"同一次写坏"的症状，真正 404 的是 `.next` 里的**路由清单**（`dev/server/app-paths-manifest.json` 这类）。教训：**下次先把坏掉的 `.next` 备份再删**，我这次直接删了导致证据丢失。
- 临时处置：停 dev → 删整个 `.next` → 重启 → 接口恢复 200、tsc 全绿。

### ② 第二层：为什么反复复发（**嫌疑锁定，尚无铁证**）

排除项（都实测过）：磁盘满（E: 剩 381GB）❌、多开 dev server ❌、异常关机（近 3 天无 Kernel-Power 41/6008）❌、OneDrive 同步（在 C:、项目在 E: 不在范围内）❌。
**头号嫌疑：腾讯电脑管家实时防护 `QQPCRTP.exe`**（Windows Defender 已被它顶掉关闭）。时间点吻合：`routes.d.ts` 写坏时间 `9:47:21`，dev server `9:46:38` 启动 —— **启动后 45 秒、正在生成路由清单时被打断**，不是关机时坏的。已让用户把 `E:\project\FlashMuse_Agent` 与 `node.exe` 加进管家信任区。**是否真断根要观察次日是否复发。**

### ③ 第三层（真答案）：`start-project.bat` 双击**根本没机会自愈**，脚本每次都当场死掉

用户只会双击 `start-project.bat`。加了自愈逻辑后实测**连续三次都没生效**，靠新加的独立追踪日志 `.runtime/start-project-trace.log` 才拿到铁证：

```
[11:46:25] launcher started (Worker=True)
[11:46:27] mutex owned=True port3000busy=True
Set-Content : 文件"start-project.log"正由另一进程使用，因此该进程无法访问此文件
```

⭐⭐ **`start-project.log` 被 `cmd /c npm run dev >> start-project.log` 的重定向独占着文件句柄**，脚本一进来就 `Set-Content` 写它 → **IOException → 整个脚本当场终止**。**结论：只要 dev server 还活着（哪怕是坏的僵尸），双击 bat 就必然毫无反应** —— 这就是"救不回来"的真因。

一路还查出另外两个真 bug：
- **`Test-TcpPort "127.0.0.1" 3000` 判定失效**：Next 绑在 IPv6 通配 `::` 上、且该探测只有 500ms 超时 → 报"端口空闲" → 脚本走冷启动 → 新 dev server 被挤到 **3001**，僵尸继续占 3000 → 然后死等 3000 变好、**5 分钟超时弹记事本**（就是用户看到的"没反应"）。改用 `Get-NetTCPConnection -State Listen -LocalPort` 精确判定。
- **互斥锁静默退出**：`Mutex(createdNew)` 一旦被卡死的旧实例持有，新的双击直接 `exit`、什么都不做。改成先等它 6 轮（每轮 20s 探活 + 10s），仍不健康就**无视锁继续自己修**。

### ④ `scripts/start-project.ps1` 的最终改动

1. **健康判定从"首页 200"改成"`/api/auth/me` 必须 200"** —— `.next` 坏时首页也 500/首页正常时 API 却可能 404，只有打 API 才测得准。连续 3 次（可配 `-Attempts`/`-TimeoutSec`）非 200 才判定损坏，避免首次冷编译慢被误杀。
2. **新增 `Write-Trace` + 独立追踪日志 `.runtime/start-project-trace.log`**（`.runtime` 已 gitignore）：npm 的 stdout 不会污染它，以后排查一看就知道走了哪条分支。
3. **`Write-Log` / 新增 `Reset-Log` 全部 try/catch 兜住**，日志写失败绝不再中断流程（第三层病根）。原来 8 处裸 `Add-Content/Set-Content $log` 全部收敛到这两个函数。
4. **新增 `Stop-NodeOnPort`**（按端口占用者 PID 杀，且**只杀 `node.exe`**，无关进程不动）+ `Stop-DevServer` 同时清 3000/3001 与命令行含项目根路径的 node、含 `npm run dev` 的 cmd。
5. **新增 `Repair-NextCache`**：停 dev → **先把坏掉的清单备份到 `.runtime/next-broken/<时间戳>/`**（types 目录 + 所有 `*manifest*.json`，都很小）→ 删 `.next` → 重启。这样以后真复发能拿到铁证定位到具体哪个文件。
6. **新增 `Test-DevPortBusy`**（`Get-NetTCPConnection` 精确判定）替代不可靠的 `Test-TcpPort` 探 3000。
7. 冷启动路径也加了自愈：起来后 API 不健康 → 自动修一次再起。

### ⑤ 实测结果（都跑过真机验证）

| 场景 | 结果 |
|---|---|
| 正常冷启动（`.next` 已删空） | 接口 200、无多余 3001、**没有误删 `.next`** |
| **故障态**（3000 被僵尸占 + 接口 500，等价用户今天的状态）→ 双击 bat | ⭐ **15 秒自愈成功**：探活 2 次 500 → 杀僵尸(PID 34324) → 备份清单 → 删 `.next` → 重启 → 接口 200 |
| 健康态下再双击 | 只开浏览器，`.next` 保留、备份数不变（不误伤） |
| PowerShell 语法检查 | PASS |

### ⑥ 遗留

- **第二层根因仍未结案**：观察次日是否复发。若还犯，就去 `.runtime/next-broken/` 拿备份的清单文件比对，定位到具体哪个文件、残在什么位置。
- 我在排查中两次把自己的 shell 杀掉（清理命令用 `CommandLine -like "*start-project*"` 匹配，而我自己的命令行里也含这个串）→ 表现为命令"无输出"。以后写这类清理命令**必须排除 `$PID`**。

## 2026-07-28（第十次会话）⭐ 模型「明文拒绝」识别 + AI 改写重试收敛成唯一权威并补给对话流 —— ⚠️ **仅本地，未部署**（tsc 全绿，无 Prisma 迁移）

排查对象＝`07-red-error-triage-and-archive.md` 第七节第 3 条「gpt-5.4-image-2 中文明文拒绝」。查清后发现是**两个不同的问题被混成一条**。

### ① 根因（`src/lib/openrouter.ts`，三个 `image-provider-empty-result` 打点各不相同）

| 打点 | 走哪个模型 | 有没有读上游拒绝文字 |
|---|---|---|
| `:1388` | BytePlus `/images` | 只读 `data.error.message` |
| **`:1679`** | **OpenRouter 新接口 `/api/v1/images`（`openai/gpt-5.4-image-2` 走这条）** | ❌ **完全没读** |
| `:1911` | OpenRouter 老 `/chat/completions`（`...-agent` GPT 版） | ✅ `getOpenRouterNoImageReason` 读 `choices[0].message.content/refusal` |

- **问题 A（落兜底桶的那批）**：新接口响应类型 `:1483` 只声明了 `data[].b64_json`，拒绝文字压根没被读；`:1689` 的日志 `upstream` 写死 `reason:"empty image result"`、**连 `responseText` 都没带**（对比 `:1658` 的 non-ok 分支是带 `body` 的）→ 抛「图片平台没有返回图片，且没有返回可用原因。」→ 被 `error-message.ts:69` 精准打回 fallback＝**「服务器繁忙」**。**所以连"它到底拒绝说了什么"都查不到。**
- **问题 B（那 ~20 条）**：老接口路径原文是读到的（红字就是「图片平台没有返回图片：抱歉，我不能…」，`error-message.ts` 走中文原文透出，**没落兜底桶**）。真正的缺口是 **UI：「AI 改写重试」只存在于工作流**（`onOptimizationRetry` 全库只出现在 `workflow-tldraw-canvas-inner.tsx`），对话流 / 资产库 / Agent 完全没有这个入口。
- 附带发现：工作流的判定 `isWorkflowGptImageSafetyFailure` 正则里本来就含 `图片平台没有返回图片`，但因为问题 A 把文案换成了"服务器繁忙"，**这条正则在新接口上永远不命中** —— 改写页进不去的直接原因。

### ② 本次改动

1. **步骤 1 —— 只加日志，不猜字段**（用户明确要求）：`openrouter.ts` 新接口空结果分支的 `upstream` 补 `body: redactBase64ForLog(responseText).slice(0,1200)`，新增 `redactBase64ForLog()`（200+ 长 base64 串换成 `[base64]`，防刷爆日志）。**⭐ 待跟踪：等线上攒到真实样本，看拒绝原文落在响应哪个字段，再写读取逻辑**（详见 `05-next-actions.md` 待跟踪项）。
2. **步骤 2 —— `src/lib/error-message.ts` 新增「模型明文拒绝」判定**：新增唯一权威常量 `MODEL_REFUSED_MESSAGE` + `isModelRefusalText()`（9 条高辨识度正则，中文只认"抱歉+我不能/无法"这类第一人称拒绝，英文补上以前**完全没有**的 `I can't help with` / `I'm unable to` / `I must decline` / `violates our policy`）。规则插在 `safety_violations` 那组之后、**版权/隐私/敏感那几条之前** —— 否则拒绝原文里的"版权/隐私"字样会被抢走误报成"参考图有问题"（其实和参考图无关）。同时补掉了「纯英文一律进兜底桶」（原 `:72`）对英文拒绝语的吞没。
3. **步骤 3 —— 新增唯一权威 `src/lib/gpt-image-safety-retry.ts`**（对话流 + 工作流共用，按 AGENTS.md「能统一一律统一」）：
   - `isGptImageSafetyFailure({model, errorText, hasPriorAttempts})`：判定收敛，工作流 `isWorkflowGptImageSafetyFailure` 改成薄壳调它。
   - `normalizeAttemptPrompt` / `getFallbackSafetyPrompt`（从工作流文件原样移出）/ `NO_NEW_SAFETY_PROMPT_MESSAGE` / `SAFETY_RETRY_EXHAUSTED_MESSAGE`。
   - `runPromptSafetyRetry()`：把"循环 / 去重 / 兜底改写词 / 最终文案"整套编排抽出来，**`rewrite` 和 `generate` 由调用方以回调传入** —— 故意不收敛 fetch，因为两处的 `readJson`（401 跳首页）和错误文案构建方式不同，硬合会改现有行为。`generate` **resolve 视为成功、throw 视为本轮仍失败**。
   - 工作流 `runGptImageOptimizationRetry`（`:4287`）重写成调用它，删掉本地那份 60 行循环，行为等价（`attemptsUsed` 累计口径保持不变）。
4. **对话流补上「AI 改写重试」入口**：
   - `Message` 加 `gptImageOptimizationOriginalPrompt` / `gptImageOptimizationAttemptPrompts` / `gptImageOptimizationRetryingIndexes`（与工作流 `node.data` 同名字段对齐）。
   - 新增 `patchMessageById()`（按消息 id 打补丁 —— 改写重试要跨多次生成改同一条消息，而 `requestId` 每次重试都变，`updateAssistantMessageByRequestId` 用不了）。
   - `retryFailedMedia` 加第三参 `promptOverride` 并改成 `async` + `return await runGeneration(...)`，让编排能 await 一轮跑完。
   - 新增 `canConversationOptimizationRetry()`（调共享判定）+ `runConversationGptImageOptimizationRetry()`。⭐ **对话流的失败被 `Promise.allSettled` 吞掉、不会 reject**，所以每轮结束后回 `sessionsRef` 核对"这条消息的图片数有没有变多"来判定成功，没变多就 throw 让编排继续下一轮。
   - 新增共享小组件 `MediaOptimizationRetryActions`（「AI改写重试 3/5/10 次」三颗按钮），两套条带 `ImageResultStrip` / `ImageResultSlotStrip` 的失败卡都接上，**按 `canOptimizationRetry` 收窄**（只图片模式 + gpt5.4image2 两种接口 + 拒绝类失败才亮，视频 / 其它模型一律不亮）。
   - 改写期间用 `gptImageOptimizationRetryingIndexes` 持续显示等待卡，避免两次尝试之间闪回失败卡；`optimizingImageMessagesRef` 按 `${messageId}:${failedIndex}` 上锁，防连点开多条改写链白烧积分。
   - 后端接口 `POST /api/workflow-prompt-optimization/rewrite` **零改动**（实测它与"工作流"无强绑定，`workflowId/Title/NodeId` 全可选且只用于记账，对话流直接传 sessionId / 会话标题 / messageId）。

### ③ 影响评估 / 已知点

- 动的都是**失败分支**，成功路径零改动。视频、Agent 模式共用同两套条带，已用 `canOptimizationRetry` 收窄，不会误出现按钮。
- ⚠️ **文案变化（预期内）**：以前落进「服务器繁忙」或被误报成"参考图有问题"的模型拒绝，现在统一显示 `MODEL_REFUSED_MESSAGE`。
- ⚠️ **一个待实机确认的观感问题**：对话流失败收尾 `finalizeAssistantImageFailures` 的 payload 带 `content: prompt` → 改写重试全败后，消息内容会被替换成**最后一次的改写提示词**（原本就是这套逻辑，只是原来传的是原提示词所以看不出来）。要在实机测试时看一眼是否需要处理。
- 步骤 3 我最初提的"给 API 加结构化 `code:"MODEL_REFUSED"`"**没做**：那要动 `createCodedApiError` + 6 个 route + `GenerationJob` 表 + `/api/generation-status`，风险和收益不成比例。改成"步骤 2 产出稳定文案 → 共享判定函数认这个稳定文案"，效果等价且零 DB 改动。真要结构化留作后续。
- ⚠️ 本地 `npx tsc --noEmit` 中 `src/` **全绿**；但 `.next/dev/types/routes.d.ts` / `validator.ts` 报一堆 TS1434/TS1109 语法错 —— 那是 **Next 生成的陈旧/损坏产物**（非本次改动引入），删掉 `.next` 重启 dev 即消失。

## 2026-07-28（第九次会话）⭐ 参考素材 url 归一化根治「平台拉我们动态缩略图接口超时」—— ✅ **已部署测试服 + 正式服 `v1.0.0.48`**（四方同步）；测试服实机回归全过；无 Prisma 迁移

### ① 根因（正式服日志原文）

后台待查清单里的「平台拉我们缩略图超时 18 条」，实测**全部集中在一个 requestId**（`id_mq4osh4b_j0yyiyq5:image:0`，用户 ID_953031，2026-07-15，对话流生图 seedream-4-5）。上游原文：

```
Timeout while downloading url:
http://101.47.19.109/api/media-thumbnail?url=%2Fgenerated%2Fusers%2FID_953031%2Fimages%2F...jpg&v=thumb256-20260606
```

两个毛病叠一起：
1. **给平台的是动态缩略图接口** `/api/media-thumbnail` —— 平台每来拉一次，我们的 Node 都要现场解析参数 + 用 sharp 现生成缩略图再返回。参考图本来就该给**文件静态直链**（nginx 直出、不经 Node）。
2. **前缀是 `101.47.19.109`（已退役的马来服务器）** —— 那台早就不在链路里，平台拉它注定失败。

**为什么会漏出去**：BytePlus 生图走 `openrouter.ts` 的 `toDataUrlIfLocalPublicAsset`，它**只认相对路径 `/generated/...`**，其它一律原样透传 → 这个「绝对地址 + 动态接口」的 URL 就被当参考图发给了平台。

### ② 修法：一个唯一权威函数，8 处接入（贯彻"能统一一律统一"）

新增 **`src/lib/reference-asset-url.ts`** → `normalizeReferenceAssetUrl()` / `normalizeReferenceAssetUrls()`，**幂等**：
- 剥掉自家主机绝对前缀（马来/腾讯/阿里/四域名/测试服，允许带端口）→ 相对路径
- `/api/media-thumbnail?url=X` → 还原成 **X（原图静态直链）**，最多解 3 层防嵌套
- `/generated/...` 去掉缓存版本号 query（`?v=thumb256-xxx`）与 `#` 片段
- `data:` / `asset://` / 第三方 https **原样不动**

接入位置（进模型/送审前的全部咽喉）：
- **入口 3 处**：`api/image/route.ts:95`、`api/video/route.ts:762-764`（图/视频/音频三类）、`api/byteplus-assets/route.ts`（送审 `toPublicAssetUrl`）
- **异步 job 唯一入口**：`generation-jobs.ts` 的 `resolveReferenceUrls`
- **底层拼地址/转 base64**：`openrouter.ts`（`toDataUrlIfLocalPublicAsset` / `toPublicGeneratedImageUrl` / `resolveOwnLocalAssetPath`）、`openrouter-video.ts`（2 处）、`seedance.ts`（1 处）、`video/route.ts` 的 `toPublicAssetUrl`

**顺手修掉同源潜伏 bug**：以前参考图若是 `http://<自家域名>/generated/...` 绝对地址，`toDataUrlIfLocalPublicAsset` 同样不认，会把地址原样发给平台（马来那批必挂）。现在一律归一化成本地路径直接读文件。

### ③ ⭐⭐ 重要认知修正：「18 条」不是 18 个失败事件，是**日志出现次数**

部署后跑归档脚本 **命中 0 条**，查清原因（**不是脚本坏了**）：
- 那 18 行日志全属**同一个 requestId**，事件构成是 `image-provider-non-ok ×6` + `provider-curl-non-ok ×6` + `image-provider-curl-fallback-failed ×6` + `image-route-failed ×7`，但**最终 `image-route-success ×3`**，该 GenerationEvent 的 **`status` = `success`**。
- 也就是说：**它是"重试过程中的中间失败"，最终成功了 → 后台「失败原因」列表里根本不占位**（那里只算 `status='failed'`）。
- 上一任 AI 的「18 条」是用 `grep -c` 数**日志行数**得出的，误当成了 18 个待排查事件。
- ⚠️ **教训（写进 07 文档）**：以后从日志 `grep -c` 得到的数字**必须回 DB 用 requestId 核对 `status`**，否则会把"中间失败/已重试成功"当成"待排查的红字"。
- 归档规则 `platform-download-our-thumbnail-endpoint` **保留**（以后真造成失败会自动认出来），当前命中 0 属正确结果。
- **Bug 本身是真的、值得修**：每次超时白等 10 秒 + 触发 curl 兜底重试链，用户端就是"转很久"；而且只要哪次重试都不中就会变成真失败。

### ④ 测试服实机回归（用户要求"测过没问题再上正式服"，全部通过）

测试号 `12424740@qq.com`，测试服 v48：
1. **对话流生图（带参考图，Seedream 4.5 / 2K / 4张）**：`image-provider-success ×4`，4 张图出图且风格跟参考图一致；日志里参考图 = `kind:"data"`（本地文件转 base64，说明归一化生效）。
2. **对话流生视频（带参考图，Seedance 2.0 Mini / 5秒）**：`byteplus-create-success` → 轮询 → `media-save-download-saved`，零错误；参考图 = `kind:"generated", pathTail:"users/ID_535317/images/...jpg"`（**原图路径，不是缩略图接口**）；前端封面就是参考图那只狐狸。
3. **工作流快捷编辑生图（走 async job = `resolveReferenceUrls`）**：`image-job-success`，人物保留、画改成向日葵花田，新节点 `image_5_w2`（Seedream 4.5 / 16:9 / 2K / 2848×1600）。
4. **v47 的 401 跳首页**：清掉 `flashmuse-session` cookie 后点生成 → URL 从 `/workspace` **直接跳 `/`**，零红字零提示；DB 查最近 20 分钟 GenerationEvent 全是 `success`，**含「请先登录」的失败事件 0 条**（确认 401 不再记事件）。
5. **两个日志文件 `media-thumbnail` 计数 = 0**（本次所有生成都没再把缩略图接口发出去）。
6. 单元自测：`normalizeReferenceAssetUrl` 10 条用例（含线上那条真实 URL）全过 + 幂等性 OK。

### ⑤ 部署记录

- 测试服：v47 → **v48**，`x-app-version: v1.0.0.48`，阿里测试镜像已同步，`PUBLISHED_APP_VERSION` = v48，入口 200。
- 正式服：备份 `/opt/flashmuse/app-backups/20260728-030655-presync-v48` → staging→prod rsync（不 bump）→ build → `.next/static` 同步阿里正式镜像 → `PUBLISHED_APP_VERSION` = v48 → **四域名 main/api/ali/static 全 200**、`x-app-version: v1.0.0.48`。
- commit `389ad87` + push → **四方同步 = v1.0.0.48**。
- ⚠️ 观察到一次 `PUT /api/workspace-state` 瞬时 **502**（前后同接口都 200，与本次改动无关，`workspace-state` 没被碰过）。如果反复出现再查阿里 nginx 超时/腾讯回源。

---

## 2026-07-28（第八次会话）**部署 v1.0.0.47 到测试服 + 正式服**（用户要求两服都部署），并执行归档

本次会话零代码改动，只做部署与归档。

1. `node scripts/bump-version.mjs`：v1.0.0.46 → **v1.0.0.47**（只在部署测试服这一步 bump）；`npx tsc --noEmit` 全绿。
2. **测试服**：tgz 21 个文件（含 `prisma/schema.prisma` + `prisma/migrations/20260727154203_generation_event_resolved/`）→ `/opt/flashmuse-staging/app` → `docker compose up -d --build staging-app`。entrypoint 日志确认 **31 migrations found / `20260727154203_generation_event_resolved` applied**。→ `sync-ali-test.sh` → compose `PUBLISHED_APP_VERSION` sed 成 `v1.0.0.47` + `force-recreate`。验证：`x-app-version: v1.0.0.47`、`127.0.0.1:5001/` 200、`http://101.37.129.164:8080/` 200。
3. **正式服**：备份 `/opt/flashmuse/app-backups/20260728-021857-presync-v47` → 服务器到服务器 rsync（staging→prod，排除 node_modules/.next/.env.local/.runtime 等）→ `docker compose up -d --build flashmuse-app`（entrypoint 日志确认同一迁移 applied）→ `/tmp/syncali.sh` 同步 `.next/static` 到阿里**正式**镜像 → `PUBLISHED_APP_VERSION` = `v1.0.0.47` + `force-recreate` → 四域名 main/api/ali/static **全 200**、`x-app-version: v1.0.0.47`。**正式服未 bump，原样带号 → 版本号一样 = 代码一样。**
4. **归档脚本两服各跑一次 dry-run → `--apply`**：
   - 测试服：待排查 46 → 归档 10（`reference-slot-not-an-image`）→ 剩 **36**。
   - 正式服：待排查 675 → **归档 367** → 剩 **308**。分布：`reference-image-size` 191、`provider-insufficient-credits` 66、`reference-slot-not-an-image` 26、`pre-diagnostics-log-unknowable` 24、`session-expired-recorded-as-failure` 17、`seedream-pro-sequential-param` 13、`reference-video-total-duration` 12、`stale-asset-card` 10、`approved-card-not-reused` 8。（预估 ~360，实测 367，吻合。）
5. commit `9268dab` + push GitHub → **四方同步 = v1.0.0.47**。
6. ⚠️ **遗留：实机回归仍未做**（v46/v47 两批功能都没点测过；v47 动了 6 个 route 错误分支 + 两处 `readJson`，需各模式跑一次成功生成 + 验一次 401 跳首页）。

---

## 2026-07-28（第七次会话）红字排查第 2~5 批：四类红字全部查清（余额不足 / 参考图尺寸第二种措辞 / 参数不支持 54 条 / 登录失效 17 条 / 第二个兜底桶 33 条）—— ✅ **已随 v1.0.0.47 部署两服（第八次会话）**；`npx tsc --noEmit` 全绿

> 本次会话共查掉 4 类红字、可归档约 **200 条**（累计实测 367 条），沉淀了三条重要认知（两个兜底桶 / 一根因多措辞 / 用 `git log -S` 验证修复时间），详见 `07-red-error-triage-and-archive.md`。



### 【第 2 批】⭐ 参考图尺寸这一类漏了 109 条：**同一根因、上游第二种措辞**（用户发现）

用户在后台看到还有「视频任务创建失败：expected the height to b...」，问是不是也算修复了。查正式服（`flashmuse-flashmuse-app-1` + `/opt/flashmuse/data/runtime/*.jsonl`）结论：

- **是同一个根因**（参考图宽/高 < 300px），只是上游在**不同阶段用了不同措辞**：
  - 素材**送审**阶段：`Height must be between 300px and 6000px.`（第六次会话查到的 82 条）
  - **建任务**阶段：`expected the height to be at least 300px, but received a 338x194px image instead`（**109 条**）
- 这 109 条明细：height 措辞 103（338×194 = 71、338×144 = 24、338×190 = 4、338×191 = 4）+ width 措辞 6（256×144）；**全部 `kind=video / byteplus:video.seedance-2-0-mini / provider=byteplus / 集中在 2026-07-27 一天`**；日志 `video-provider-create-non-ok` 里原文 `{"code":"InvalidParameter","message":"expected the height…","param":"image_url"}`。
- v47 的发送前拦截（`video-reference-image-rules.ts`）**两种措辞都能挡住**（它判的是真实宽高，不是文案），所以根因已修 → **该归档**。
- ⛔ **但两条正则都只写了第一种措辞**，直接跑归档抓不到这 109 条。已补：
  - `src/lib/error-message.ts`：加 `expected the (height|width) to be (at least|at most|between) \d+px` → 同一句中文文案。
  - 归档脚本 `reference-image-size` 规则的 `match` 同步加上（并把两种措辞写进注释）。
- ⭐ **归档脚本两处增强**（否则这类永远漏）：
  1. 匹配文本从"只有日志原文"改成 **日志原文 + `failureReason` 一起匹配** —— 这类错误没被"服务器繁忙"兜底覆盖，英文原文直接进了 `failureReason`；日志文件会轮转/被清，那时只有 DB 这份能认出来。
  2. 去掉 `requestId IS NOT NULL` 过滤 —— 没有 requestId 的事件现在也能靠 `failureReason` 归档（按自己单独成组）。
- 归档量预期再涨：**~146 → ~255 条**（191 尺寸/比例 + 53 余额不足 + 11 凭证失效 + 若干没复用旧证）。注意这 109 条**不在"服务器繁忙"212 里**（它有自己的红字），所以归档后是"服务器繁忙 212→~66"**加上**"expected the height 那两条整条消失"。

### 【顺带】⭐ 正式服未归档红字全貌 + 下一批目标（无代码，已写进 07 文档第五/六/七节）

顺手把正式服所有未归档红字和 BytePlus `InvalidParameter` 全部措辞捞了一遍（命令写进 07 文档，以后照抄）。新发现的高价值线索：

- **「当前模型不支持这组参数」54 条** —— 量太高不正常，疑似我们自己传了模型不支持的参数（很可能就是日志里 `sequential_image_generation` 那 39 条）。**下一个优先查。**
- **「请先登录后再使用模型」17 条** —— 正常用户不该看到，疑似会话/token 过期没自动续。
- **「请求失败，请稍后再试。」33 条** —— **第二个兜底桶**（`toUserErrorMessage` 默认 fallback），同样查不出原因，要同一套手法深挖。
- **平台拉我们缩略图超时 18 条** —— `Timeout/Error while downloading url: http://<ip>/api/media-thumbnail?...`，送审给的是动态接口，应改静态直链。
- 另外未查：`the specified asset is not an image` 26、`UnsupportedImageFormat` 4。
- ⛔ **踩坑记录（省下一个人的时间）**：正式服 app 容器叫 **`flashmuse-flashmuse-app-1`**（不是 `flashmuse-app`）；db 容器不能用 `psql -U postgres`（role 不存在），查库一律 `docker exec <app容器> node -e` 走 Prisma `$queryRawUnsafe`；**正式服现在还没有 `resolvedAt` 列**（迁移随 v47 才上），所以查询别带那个过滤。

### 【第 3 批】⭐ 排查「当前模型不支持这组参数」54 条 → 51 条可归档 + 修掉一个误映射

用户指定查这 54 条。查法：`docker exec flashmuse-flashmuse-app-1 node` 跑一次性脚本，按 requestId 关联 `.runtime/*.jsonl` 的失败类事件，把上游 message 归一化聚合。结论 —— **全是我们自己的 bug，而且三类都早已修掉**（后台看到的是历史存量）：

| 根因 | 条数 | 最后一次发生 | 修复 commit / 时间 | 归档 |
|---|---|---|---|---|
| A) `` `sequential_image_generation` … is not supported by the current model``（`seedream-5-0-pro`，端点 `ep-20260713101732-q5zvf`，image/asset） | 13 | 07-16 **06:21** | `08aa548`（07-16 **18:03**）：给 `"disabled"` 分支补 `supportsSequentialBatch &&` 守卫。根因是 **Seedream 5.0 Pro 连 `sequential_image_generation:"disabled"` 都不接受**，旧代码只要参考图 >1 张就发 | ✅ |
| B) `` content[N].image_url.url … the specified asset is not an image``（`seedance-2-0`，video/conversation） | 26 | 07-21 **07:45** | **B_252** / v1.0.0.34（07-21 **19:21**）按 `asset.kind` 路由 | ✅ |
| C) `` video total duration (seconds) … must be ≤ 15.2``（`seedance-2-0`/`-fast`） | 12 | 07-21 **05:57** | **B_232** / v1.0.0.34（同上）Int→Float + 统一 `validateReferenceTotalDuration` | ✅ |
| D) `gpt-5.4-image-2` 平台返回 HTML → `Unexpected token '<' … is not valid JSON` | 2（07-24、07-27） | 仍在发生 | ⚠️ 见下，**本次修** | ❌ |
| E) 无日志（07-09，已轮转） | 1 | 07-09 | 查不出 | ❌ |

⭐ **D 类是本次真正修掉的新 bug（两个）**：
1. `is not valid JSON` 被 `error-message.ts` 里 `/unsupported size|invalid option|invalid parameter|not valid/` 抢走 → 报「当前模型不支持这组参数，请换比例、分辨率或模型」，**用户按提示去改参数完全没用**（真因是平台返回 HTML 错误页）。已在该规则**之前**插入 `unexpected token '<'|is not valid json|unexpected end of json input|<!doctype html|<html` → 「平台服务临时异常（返回了非预期内容），请稍后重试。」
2. 同样的 `not valid` 让 `transient-error.ts` 的 `isPermanentError` 把它判成**永久失败** → 网关抖动本该服务端自动重连的却直接放弃。已在 `isPermanentError` **开头做例外先行 return false**，并在 `isTransientServerError` 里加同一批关键词 → 判为可重试。实测：`(B_401) …Unexpected token '<'…` → 「平台服务临时异常…」+ `transient=true`。

归档脚本新增 3 条规则 `seedream-pro-sequential-param` / `reference-slot-not-an-image` / `reference-video-total-duration`，实测 A/B/C 精准命中，D 与中文文案不误伤。**归档量预期 ~255 → ~306 条**，「当前模型不支持这组参数」54 → **3**。

⭐ **方法论沉淀（已写进 07 文档第三·B 节末）**：判断"是否真的修好了"不能只看"代码里现在有守卫"（守卫可能是后来加的），必须 `git log -S "<关键代码片段>" --date=iso` 拿到**修复 commit 的精确时间**，再和该根因**最后一次发生时间**对比。A/B/C 三类最后一次都在修复上线前、此后 7~12 天零复发 → 才敢归档。

### 【第 4 批】⭐ 排查并修复「请先登录后再使用模型。」17 条 —— 状态码错了，导致前端所有"未登录跳首页"保护失效

**数据**：17 条全部 `userId=NULL`、`image/conversation`、model 恒为默认 `seedream-4-5`、参考图 0 张，requestId 是我们前端生成的 `id_<base36时间>_<随机>`（**真实浏览器，不是爬虫**），时间是 **3~5 次连击**（07-17 07:26 五连、07-21 06:50 三连、07-25 三连…），北京时间都在白天。

**为什么"明明登录了"却说没登录**：登录 = 房卡（cookie）+ 前台记录（DB `Session` 行），服务器只认前台记录。本项目是**单会话策略** —— `createSession` 里 `session.deleteMany({ where: { userId } })`，**新设备登录会删掉该用户所有旧会话**。电脑上开着的工作台房卡还在、页面看着一切正常（头像/积分是加载时取的），但前台记录没了 → 点生成被拒。另两种：24h 未活动过期、账号停用。⭐ **单会话是有意设计（用户确认：多会话会导致两端同时生成等更多错误），不改。**

**真正的 bug（链条）**：
1. `assertUserCanUseCredits` 里 `if (!user) throw new Error("请先登录后再使用模型。")` —— 普通 Error
2. 掉进各 route 通用 catch → 编号 B_xxx → **返回 500** + `recordGenerationEvent(status:"failed")` 记红字
3. ⛔ 前端 5 处"未登录自动跳首页"的保护**只认 401** → 全部不触发
4. 用户只看到红字失败卡、没有任何登录引导 → 连点 3~5 次；后台被污染 17 条
5. `/api/image` 那句 `if (!user) return ...401` 写在 assert **后面**，永远执行不到

同样写法 **6 个 route**：`image`/`video`/`chat`/`agent-plan`/`conversation-memory`/`workflow-prompt-optimization/rewrite` → 所有模式都会中。

**修法（产品约定：不给任何提示，一操作就跳首页 —— 用户 2026-07-28 拍板）**：
- `src/lib/credits.ts` 新增唯一权威 `UNAUTHENTICATED_ERROR_MESSAGE`（"登录状态已失效，请重新登录后再试。"）/ `createUnauthenticatedError()` / **`isUnauthenticatedError()`**；assert 改抛带 `code:"UNAUTHENTICATED"` 的错误。
- 6 个 route 的 catch **第一句**统一判它 → 回 **401** 且**不记 GenerationEvent**（不是生成失败，不该进失败统计）。
- 新增唯一权威 `src/lib/session-expired-redirect.ts`：`handleSessionExpiredResponse()`（401 → `replace("/")`）+ 哨兵 `SESSION_EXPIRED_SILENT_ERROR`。
- **插在两处 `readJson` 开头**（`chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx`，是 **43 处调用的咽喉**）→ 对话流/工作流任何请求拿到 401 都直接跳首页，不用改 12 个 fetch 站点。
- `isAbortLikeError` 认哨兵 → 跳转瞬间不闪红字卡；chat-workbench 原有 4 处手写 401 跳转收敛成调共享函数。
- 归档规则 `session-expired-recorded-as-failure`（match `请先登录后再使用模型`；实测不误伤「积分不足…」和新文案）。
- ⚠️ **遗留分叉未处理**：`readJson` 两份的**错误文案构建方式不同**（`toUserErrorMessage` vs `getWorkflowApiErrorMessage` 会补 `errorCode` 前缀），本次只统一了 401 守卫，没合并整个函数（合并会改错误文案行为，风险高）。

归档量预期 **~306 → ~323 条**。`npx tsc --noEmit` 全绿。

### 【第 5 批】⭐ 排查「请求失败，请稍后再试。」33 条 —— 发现"第二个兜底桶"，全部归档（无代码改动）

**数据**：33 条全是 `image` + `provider=openrouter` + `openai/gpt-5.4-image-2`(20) / `-agent`(13)，日期只有 **07-24（13）、07-06（12）、07-09（8）**。

- **07-24 的 13 条**：日志里全是 `Insufficient credits` = OpenRouter 余额不足 → **现有 `provider-insufficient-credits` 规则已覆盖，不用加新规则**。
- **07-06 / 07-09 的 20 条**：日志里**一行都没有** —— 诊断日志文件最早一行是 `2026-07-10T19:56`（正式服 07-11 才从马来迁到腾讯云，旧日志没带过来）→ **永久不可追溯**。且确认**不是余额不足**：那两天 OpenRouter 图片成功 188 / 111 条（账户有钱），日志里 `Insufficient credits` 只出现在 07-21 与 07-24。

⭐⭐ **最重要的发现：有两个兜底桶，同一个根因会同时污染两个。**
`toUserErrorMessage(value, fallback = "请求失败，请稍后再试。")` 的 fallback 是**默认参数** —— 调用处显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 就落进「服务器繁忙」，不传就落进「请求失败」（gpt-image 走的 `getOpenRouterError`（`openrouter.ts:772`）属于后者）。所以**余额不足这一个根因：53 条进了"服务器繁忙"、13 条进了"请求失败"**。⛔ 以后排查任何一类，**两个桶都要查**。已写进 07 文档第一节和第三·D 节。

⭐ **另一个结构性事实**：`toUserErrorMessage` 在这条链上**被套了两层** —— 内层 `getOpenRouterError` 先把上游原文压成兜底文案（`图片生成失败：请求失败，请稍后再试。`），外层再处理时**原文已被吃掉**，任何规则都不可能再匹配。所以这个桶天生"从 DB 里绝对查不出根因"，只能靠诊断日志。**不用改代码**：诊断日志已经记了上游 body（这次 13 条就是靠它查出来的），缺的只是 07-10 之前那段历史；而新加的 402 规则在**内层**就命中，余额不足以后两个桶都不会再进。

**新增归档规则 `pre-diagnostics-log-unknowable`（用户 2026-07-28 拍板 B 方案）**：留着查不动的只会让人反复来查同一批，归档后「待排查」才真正代表**还有希望查的**。判定**三个条件必须同时成立**（别放宽）：① `createdAt < 2026-07-10`（`DIAGNOSTICS_LOG_START`）② 两个日志文件里一行都搜不到该 requestId ③ `failureReason` 命中 `GENERIC_FALLBACK_PATTERN`（服务器繁忙 / 请求失败）。
配套改动：`findMany` 的 select 补上 `createdAt`。

**正式服 dry-run 验证**（专门写脚本核对，未写库）：命中 **24 条** = 20 条「请求失败」+ 4 条「服务器繁忙」（07-05 2 / 07-06 13 / 07-09 9；模型 `gpt-5.4-image-2` 21 + `seedance-2-0` 3）；**07-10 之后的 221 条兜底桶事件一条都没碰**。归档后：「请求失败」33 → **0**，「服务器繁忙」再少 4 条。

### 【教训】同一根因常有多种上游措辞

以后每查一类，**必须先把该根因在正式服的全部措辞捞全再写正则**，别只按看到的那一条写。归一化去重命令已写进 07 文档第五节。

### 【第 1 批】供应商余额不足（OpenRouter 402）不再兜底成"服务器繁忙"

背景：正式服「服务器繁忙，请稍候再试.....」212 条里第二大类 = **OpenRouter 402 `Insufficient credits`（53 条）**，账户真没钱，但用户看到的是"服务器繁忙"→ 以为是我们抖动、反复重试白花时间，管理员也不知道要充值。

- **`src/lib/error-message.ts`（唯一入口，全模式生效）** 新增一条判定，**位置在限流/`quota` 规则之前**（否则会被 `429|quota` 那条抢走）：
  `402 | insufficient credits | insufficient_quota | insufficient balance | requires more credits | more credits, or fewer max_tokens | add more using | billing hard limit | exceeded your current quota | account balance | 余额不足`
  → **「提供商余额不足！请联系管理员充值。」**（`(B_xxx)` 前缀由既有 `withErrorCode` 自动带上，所以用户看到的是「(B_xxx) 提供商余额不足！请联系管理员充值。」）
- **`src/lib/transient-error.ts`** 的 `isPermanentError` 加同一批关键词 → 这类**不再被 `isTransientServerError` 判为可恢复**，服务端不再自动退避重试（以前会白烧几次）。
- **`scripts/archive-resolved-generation-failures.mjs`** 新增规则 `provider-insufficient-credits`（match 用文本特征 + `"status|statusCode|code": 402`，**故意不用裸 `\b402\b`**，因为它匹配的是整段日志 JSON，裸 402 会被 `"width":402` 之类误伤）。
- ⭐ **归档标准澄清（2026-07-28 用户口述，已写进 AGENTS.md 铁律 + 07 文档开头）**：**归档的对象本质是「服务器繁忙」这个兜底桶**（没被明确识别的错误全落进它，它是一堆无关根因的混合体）。判定只问"**这个根因还落在兜底桶里吗**"：①修好了→归档；②没修但**已映射成明确文案**→归档；③没查清/修不了、仍在桶里→留着亮；④**映射出去后新形成的那条明确原因本身→不归档**（修不了就该一直亮着，且已不污染兜底桶）。所以本次归档的理由不是"我们修了余额问题"，而是"**它已经从兜底桶里被拆出去了**"；而新出现的「提供商余额不足！请联系管理员充值。」以后不归档。
- 归档量预期：~93 → **~146 条**（82 尺寸不合规 + 53 余额不足 + 11 凭证失效 + 若干"没复用旧证"）；「服务器繁忙」212 → **~66**。
- 本地验证（tsx 直跑三种真实原文）：`(B_312) …Insufficient credits…` / `402 …requires more credits…` / `…exceeded your current quota…` 三条全部输出「提供商余额不足！请联系管理员充值。」且 `isTransientServerError=false`。

## 2026-07-27（第六次会话）线上资产远程 url 排查 + 红字失败原因深挖并修 4 处 + 参考图尺寸发送前拦截 + 失败原因归档机制 —— ⚠️ **全部本地完成、未部署**（部署后是 v1.0.0.47）；`npx tsc --noEmit` 全绿；**有 1 个新 Prisma 迁移**

> 详细的排查方法论、已修/待修清单、归档规则全部整理进新文档 **`07-red-error-triage-and-archive.md`**（排查线上报错必读，别重复踩坑）。

### ① 正式服「资产是否都下载到本地」排查 —— 用户拍板 C（先不管）
- 8181 条 MediaAsset：本地化 7560（92.4%）、**远程 url 621**（其中已归档 524、**未归档仍显示在资产库 97**：96 图 + 1 视频）。`posterUrl`/`thumbnailUrl` 远程的 0 条。
- 远程记录时间全部落在 **2026-06-05 ~ 06-21**，之后一条没有；本地化最新到 07-27 → **现在的落盘链路是好的，不会再产生**。
- 抽样 HEAD 全部失效：火山 tos 签名 **403**、OpenRouter **401** → **救不回来**（无法重新下载）。
- 受影响用户：`lixxix50@gmail.com` 64 条、`3676478@qq.com` 24 条、`312876953@qq.com` 1 条，其余 8 条零散。
- 给了 A（归档隐藏）/B（加失效角标）/C（不管）三个方案，**用户选 C：先不管了**。

### ② ⭐⭐ 红字「服务器繁忙，请稍候再试.....」212 条深挖 → 找到真实根因并修 4 处
**关键认知（写进 07 文档）**：`failureReason` 存的是给用户看的文案，"服务器繁忙"是 `toUserErrorMessage` 没匹配上时的兜底 → **从它本身查不出任何东西**，真实原因只能去 `.runtime/*-diagnostics-log.jsonl` 按 requestId/taskId 捞原文，而且**要看最终抛出的那条**（早期的 `create-non-ok` body 会把"送审阶段被拒"误判成"风控拦截"，本次踩过）。

查出的真实构成：参考图**尺寸/比例不合规 82**（Height 56 / Aspect 23 / Width 3）、**OpenRouter 余额不足 53**、轮询到 failed 但原因没落盘 40、审核**凭证失效 11**、`empty image result` 7、gpt 中文明文拒绝 4、DB 事务超时 2。

修了 4 处：
1. **补日志（根子）**：`video-provider-poll-success` / `create-success` 两处以前**只记 `hasError: true` 布尔**，上游 code/message 全丢 → 那 40 条永远查不出。新增唯一实现 `summarizeVideoTaskError()`（`openrouter-video.ts`），4 个日志点都带上 code + message（截断 600），并给 `OpenRouterVideoTask.error` 类型补 `code` 字段。
2. **⭐ `!triggered` 真 bug**：`autoReviewBytePlusVideoReferences` 原来用 `triggered`（只有"新办卡"才算干活）判断送审是否有效。**当所有参考图早就过审、只走"复用旧证"分支时 triggered 恒为 false → 已经拼好的 `asset://` 引用被整份丢掉、直接放弃重试 → 用户白白看到"服务器繁忙"**。改成看 `convertedCount`（换到证就必须拿去重试）。
3. **已过审的图第二次不再弹蓝字**（用户当初的设计）：给送审函数加 `reuseOnly` 模式（纯查库、不上传不等待）。被拦后先只用现成通行证**当场无感重试**；只有确实有素材要新送审才返回 `{status:"reviewing"}`（那才该弹「检测到真人图片，需要审核」）。创建抛错、创建返回 error 两条路径都加了。
4. **死卡自愈**：平台报 `The specified asset asset-xxx is not found` 时，以前会拿着死凭证一直失败。新增 `isBytePlusAssetNotFoundError` / `getBytePlusMissingAssetIds` / `clearStaleBytePlusAssetCards`，**自动清空库里失效的 bytePlusAssetId/GroupId/Status** 并纳入"可恢复错误"→ 重新送审拿新证记住。
5. **错误文案不再骗人**（`error-message.ts` 唯一入口，放最前面避免被 timeout/network 抢走）：尺寸不合规 / 平台读取参考图失败 / 凭证失效 三类各给真话。

### ③ 参考图尺寸/比例**发送前**拦截 + 黑底提示（用户明确要求）
- 新增唯一权威 `src/lib/video-reference-image-rules.ts`：常量（宽高 **300–6000px**、宽高比 **0.4–2.5**）+ `validateVideoReferenceImageDimensions/…Images/…BeforeSend` + 浏览器端 `measureImageDimensions`。**量不到宽高时不拦**（宁可让平台判，也不能因为读不到就把用户挡死）。
- 文案带上是哪张图、当前多大、要求多少，例：`参考图「xxx」太窄或太长了（1200×200，宽高比 6.00）。生视频要求宽高比在 0.4–2.5 之间（如 16:9、9:16、1:1、4:3），请换一张比例更常规的图。`
- 三处接上同一规则：**对话流** `sendMessage`（→ `showInputTip()` 黑底提示 + 中止发送，不扣积分不发请求）、**工作流** `runVideoNode`（抛同样文案）、**服务端** `api/video/route`（从 `MediaAsset.width/height` 读尺寸，不合规直接 400 + 同文案 + 记 `video-route-reference-image-size-rejected` 日志，兜住 Agent/资产库/任何入口）。
- **只对 BytePlus 视频模型生效**（这是 BytePlus 的硬规则，不能拿它拦 kling/veo）；`asset://` 引用跳过。

### ④ ⭐ 后台「失败原因」归档机制（用户要求：排查掉一批就自动归档、划掉但保留文字）
- **新迁移 `20260727154203_generation_event_resolved`**：`GenerationEvent` 加 `resolvedAt` / `resolvedNote` + 索引 `(status, resolvedAt)`。
- `admin-overview.ts`：`failureTop` 只统计 `resolvedAt IS NULL`；新增 `failureResolvedTop`（按「原因 + resolvedNote」分组）；`moderationBreakdown` 同样只统计未归档。
- `admin-overview-2.tsx`：`RankTable` 加 `strikethrough` 参数；「失败原因」卡片下方新增「已排查并修复（已归档，不计入上面数量）」区块 → **灰色 `line-through` 划掉、文字保留**，小字显示归档说明。
- **`B_xxx` 编号计数器与归档完全无关，继续自增。**
- 新增 `scripts/archive-resolved-generation-failures.mjs`（dry-run 默认 / `--apply` / `--undo`）：**按诊断日志里的真实原文**（不是 failureReason）判定归档，规则表 `RESOLVED_RULES` 是唯一入口，目前 3 条（参考图尺寸、凭证失效、`!triggered` bug；后者用事件序列特征判定）。本地 dry-run：39 条待归档、命中 0（本地无线上日志，正常）。
- **不归档的**：OpenRouter 余额不足这种运营问题（真没钱）必须一直亮着提醒充值。

### 本次会话踩的坑（记住）
- 别拿早期 provider 报错 body 当最终根因（会把 82 次"尺寸不合规"误判成"真人风控"）。
- 视频轮询失败事件**没有 requestId**，要先拿 `taskId` 再捞日志。
- 一次性脚本必须 `docker cp` 进容器 `/app` 跑（容器里才有 `@prisma/client`）；跑完删掉。
- `prisma generate` 在本地会因 dev server 占着 `query_engine-windows.dll` 报 EPERM → 先停 dev server 再 generate 再重启。
- ⚠️ 我曾用 `Remove-Item tmp\audit-*.js` 误删了 4 个**已被 git 跟踪**的历史排查脚本，已 `git checkout` 还原。清理临时文件前先看 `git status`。

## 2026-07-27（第五次会话）资产库视频卡时长角标 + 缩略图 hover 放大 + 时长/封面全量回填 —— ✅ **已部署测试服与正式服 `v1.0.0.46`**（四方同步）；`npx tsc --noEmit` 全绿；**无 Prisma 迁移**

### ① 资产库右侧视频卡左上角显示时长
- 新增 `src/lib/media-duration-format.ts` = **时长文案唯一权威实现**（`formatMediaClockTime` mm:ss / `formatMediaPaddedSeconds` / `parseChineseDurationSeconds`）。`audio-waveform-player.tsx` 原来的本地 `formatAudioTime`/`padSeconds` 收敛到它（音频显示零变化）。
- 新增 `src/components/media-duration-badge.tsx`（`MediaDurationBadge`）：位置/大小/字号/圆角与音频卡左上角时间显示完全一致；因为要叠在任意封面上，**用户拍板改成深底白字**（`bg-black/45` + white，而不是音频那套 `bg-black/12` + `#333`，浅底深字在深色封面上看不清）。以后别处要时长角标一律复用它。
- `chat-workbench.tsx` 视频卡挂上它；取值口径统一走新 helper `getAssetDurationSeconds()`：优先服务端 `durationSeconds`，老数据兜底解析参数卡「N秒」。
- ⭐ **顺手收敛的分叉**：`workspace-state/route.ts` 和 `media-assets/route.ts` 两处调用 `resolveAssetPreviewMeta` 时都硬写 `durationSeconds: null`（明显是漏的，`toAssetPreviewMeta` 本来就设计成由这列算时长）。现两处都 `select` 了 `MediaAsset.durationSeconds`，既传进 previewMeta 也在资产 payload 里直出 `durationSeconds`（`AssetItem` 新增该字段）。**副作用（已告知用户）：以前预览页参数卡没时长文案的上传视频，现在会显示「XX秒」。**

### ② 图片/视频缩略图 hover 放大反馈
- `globals.css` 新增统一工具类 **`.media-thumb-zoom`**：容器内 `img`/`video` 悬停 `scale(1.06)`、`transition .26s ease-out`；带 `@media (hover:hover)`（触屏不放大）和 `prefers-reduced-motion` 保护。容器必须自带 `overflow-hidden`。
- 按用户选择**只套在资产库右侧网格**（图片 + 视频卡的缩略图按钮）。对话流/工作流/@引用弹窗**没动**。以后别处要同样反馈直接加这个类，禁止再各写一套。

### ③ ⭐⭐ 踩坑记录：Turbopack 的 globals.css 改动不重编（"hover 没反应"的真凶）
- 现象：改完 `globals.css` 本地怎么试都没效果，但同批 JS 改动（时长角标）**是生效的** → 误判成代码写错。
- 真因：dev 的 CSS 产物 `.next/dev/static/chunks/src_app_globals_css_*.css` **停在几小时前的旧版本**，改 css 不触发重编、`touch layout.tsx` 也没用；JS 的 HMR 正常，所以只有 CSS 部分"看起来没实现"。
- 解法：**删掉整个 `.next` 再重启 dev**（只重启进程不够）。验证手段：`document.styleSheets` 里搜类名 / 直接 `page.request.get` 那个 css chunk 看有没有新规则。**以后改 globals.css 没反应先怀疑这个，别怀疑代码。**

### ④ 视频时长/封面全量回填（本地 + 测试服 + 正式服都跑了）
- 新增 `scripts/backfill-media-asset-durations.mjs`（默认 dry-run，`--apply` 才写）：给 `MediaAsset.durationSeconds` 为空的视频/音频补真实时长。项目只装了 `ffmpeg-static` 没有 ffprobe → **用 `ffmpeg -i` 解析 stderr 里的 `Duration: HH:MM:SS.xx`**（`-i` 无输出文件必然非 0 退出，从 `error.stderr` 里取）。只处理 `/generated/` 下的本机文件，远程签名过期的历史脏数据跳过。
- 为什么要它：`durationSeconds` 这列是后来才开始写的，早期生成/上传的视频全为空 → 时长角标显示不出来（用户反馈"有些视频左上角没有时间"）。
- 结果：**本地 28 条全补齐**（剩 8 条无时长的都是 `archivedAt` 归档记录，资产库不显示）；**测试服 5 条**；**正式服 2059 条**（候选 2060，1 条远程 URL 跳过），0 失败。
- 同时按用户交代把封面也补了：`scripts/backfill-uploaded-video-posters.mjs` 在**正式服新建 29 个 `.poster.jpg`**（测试服 0 条，本来就全有）。⭐ **新记忆**：脚本在服务器上现生成的媒体文件**不会自动同步阿里**（app 只在上传/生成时同步），要补一次 rsync：只传 `*.poster.jpg`、增量不删除，`/opt/flashmuse/data/generated/` → `root@101.37.129.164:/var/www/flashmuse-static/generated/`。已跑完。
- 复跑 dry-run 确认收敛：durations 只剩 1 条远程 URL、posters 只剩 2 条生成视频（不在上传封面范围），均为预期。

### 部署记录（测试服 + 正式服 v1.0.0.46）
- 测试服：`bump-version.mjs` v45→v46 → 26 个改动文件 tgz scp → `tar -xzf -C /opt/flashmuse-staging/app` → `up -d --build staging-app` → `sync-ali-test.sh` → sed `PUBLISHED_APP_VERSION: "v1.0.0.46"` + `force-recreate` → `x-app-version: v1.0.0.46`、`101.37.129.164:8080` 200、`staging-static` 200。
- 正式服（用户明确要求同步）：备份 `/opt/flashmuse/app-backups/20260727-210717-presync-v1.0.0.46` → 整份 rsync staging→prod（**不再 bump**，原样带 v46）→ `up -d --build flashmuse-app`（"No pending migrations"）→ `/tmp/syncali.sh` 同步阿里正式镜像 → sed `PUBLISHED_APP_VERSION: "v1.0.0.46"` + `force-recreate` → 四域名 main/api/ali/static 全 **200**、`x-app-version: v1.0.0.46`、公网首页版本号 v1.0.0.46。
- ⚠️ 中间验证提醒：`up --build` 之后 `x-app-version` 仍是**上一版**是**正常的**（该头发的是运行时 env `PUBLISHED_APP_VERSION`，第 5 步才改），此时看 HTML 里的版本号判断新代码是否上去。

## 2026-07-27（第四次会话·调研，未写任何代码）视频「高清/超分」方案调查 → 记为备忘 M020，等有免费方案再做

用浏览器实读官网/官方文档（不是凭记忆、不是本地旧文档）。结论与全部数据已整理进 `06-memo-tasks.md` 的 **M020**，此处只记要点：

- **BytePlus 没有视频超分/放大/画质增强接口**：模型目录只有 Seed / Seedream / Seedance / Seed Speech / Omnihuman / DreamActor；ModelArk API 参考也没有独立 upscale 端点。
- ⭐ **新情报：Seedance 2.0 已支持 `resolution: "4k"`**（仅 `seedance-2-0`；Fast/Mini 连 1080p 都不支持）。4K = 10-bit **H.265(HEVC)**，官方明示部分播放器/浏览器不能直接播；**$0.78/秒**（1080p $0.37 / 720p $0.15 / 480p $0.07）。**用户交代 4K 档先不接。** 我们 `models.ts` 目前也只到 1080p。
- 「用 Seedance 重生成 4K」**不是超分**（内容会变、贵约 10 倍），不该叫"高清"。
- **真·超分只能走第三方**，最好的是 **Topaz Video AI**（Replicate 与 fal 是同一引擎 Proteus v4 + Apollo v8）：Replicate →4K/30fps **$0.373/5s**、fal >1080p **$0.08/s**（约为 Seedance 4K 重生成的 1/10）。备选 Runway upscale-v1 / Bria（8K、全授权数据）/ Crystal（人脸向）。
- **开源最强 = ByteDance 自家 `SeedVR2`（Apache-2.0，ICLR2026）**，但官方要求 1×H100-80G 才 720p、**1080p/2K 需 4×H100-80G** → 我们无 GPU，自建不可行。
- **用户决定：先不做，记为备忘 M020，"如果没有免费版以后再做"。** 选型倾向与接入要点都写在 M020 里。

## 2026-07-27（第四次会话·追加）工作流上传/截图后资产库右侧列表不刷新根治 —— ✅ **已部署测试服 `v1.0.0.45`**（正式服仍 v43）

- **现象（测试服实测）**：工作流里视频截图后，回资产库「上传图片」，**左侧数量 +1 但右侧列表不出现**，必须刷新页面。
- **根因**：左侧计数来自服务端 `assetCounts`（某次拉取就更新了）；右侧列表是分页缓存，`loadWorkspaceAssets` 里 `loadedAssetFilters[filter] && hasFilterAssets` 命中就直接 return 不重拉。而工作流的上传/截图是画布组件**自己直接 POST `/api/media-assets`**、**从不通知父级** → 父级 `assets` state 里根本没有这条。对照：工作流**生成**的图/视频有 `onGeneratedMedia` 回调（本地插入 + force 刷新），所以一直是即时出现的。
- **修法**：画布新增 prop `onUploadedAsset?: ({ mediaType })`（`workflow-tldraw-canvas.tsx` + `-inner.tsx`），`handleUploadNodeFile` 的**图片（含视频截图，在入库 POST 的 `.then` 里调，保证已提交）/视频/音频**三个分支成功后都调它（文档不调，文档永不显示）；`chat-workbench` 侧按 mediaType 映射筛选（image→`conversation_uploads`、video→`upload_videos`、audio→`upload_audios`）并 `loadWorkspaceAssets(true, filter, 0, "auto")` 强制刷新列表+计数。
- **顺带修好**：工作流里拖拽/粘贴上传的图片、视频、音频以前同样有"要刷新才出现"的问题，现一并解决。

## 2026-07-27（第四次会话）工作流视频截图（首/尾/当前帧进画布）+ 上传视频缺封面根治 + 上传类归类全站统一 + 用户中心生成数量现算 + 积分页工作流图标 —— ✅ **已部署测试服 `v1.0.0.44`**（正式服仍 v43）；`npx tsc --noEmit` 全绿；**无 Prisma 迁移**

> 部署内容 = 本次 4 项 + 前两批（07-27 第二、三次会话）积压的所有改动，一并上了测试服。正式服未动。

### ① 工作流视频节点快捷菜单新增「视频截图 ▾」（悬停展开：截取首帧 / 尾帧 / 当前帧）
- 截出的 jpg **直接作为图片节点出现在源视频右侧**（不连线），走统一上传链路落盘。
- 截帧收敛为唯一实现 `getWorkflowVideoFrameJpeg()` + `getWorkflowVideoFrameLabel()`（`workflow-tldraw-canvas-inner.tsx:1927`），**右键菜单「导出首/尾/当前帧」（下载）与它共用**；`exportWorkflowVideoFrame` 变成薄壳。
- `addUploadedNode` 新增第三参 `rightOfNode`（放右侧、不连线；原 `targetNodeId` 是放左侧+自动连线，语义不同保持不变）；`handleUploadNodeFile` 新增可选第 5 参 `imageTitle`（默认「上传图片」）。
- 节点标题显示「视频截图 + 名字」：新增常量 `WORKFLOW_VIDEO_FRAME_NODE_TITLE` + `isWorkflowUploadLikeTitle()`，把原来散在 4 处的 `title.startsWith("上传")` / `=== "上传图片"` 判断统一走它（头图标 / 参数标签只显尺寸 / 标题拼法 / 右键菜单非生成节点判定）。
- 命名：同一帧重复截 = 内容哈希命中去重 → 复用同一文件同一名；不同帧 → `xxx-当前帧`、`xxx-当前帧_2`…（`upload-name.ts` 的 `allocateUniqueName`）。
- 归类：**按上传处理**（无模型无提示词，本质就是上传图片），进「上传的资产 · 上传图片」。曾一度试过归到 `workflow_images/generated`，因 `isUploadedMediaAsset` 还会按 url 在 `/upload_image/` 判上传而显示不出来，且属性上确实更像上传 → 用户拍板算上传，已回退。

### ② ⭐ 上传视频"没有封面"根治（去重继承了历史无封面记录）
- 根因：`createUploadedVideoPoster`（上传即时生成封面）是后加的功能，早于它上传的视频库里 `posterUrl` 为空；重新上传同一文件时命中内容哈希去重、早返回，把空 posterUrl 一起继承回来。
- 修法：`upload-file/route.ts` 新增 `ensureDedupPosterUrl()`（:73），命中去重 + 是视频 + 无 posterUrl → 现场生成封面 + 写回 `MediaAsset.posterUrl` + 同步阿里；两个去重早返回点（multipart / JSON base64）共用它。已有封面直接返回、零开销。
- 新增一次性脚本 `scripts/backfill-uploaded-video-posters.mjs`（默认 dry-run，`--apply` 才写）：给历史上传视频补 `.poster.jpg` + 回填 posterUrl，规则与 `createUploadedVideoPoster` 一致（同目录同名 `.poster.jpg`），跳过 `/videos/` 下的生成视频。
  - **本地已 `--apply`**：6 条历史上传视频全部补齐、0 失败。
  - **测试服跑过 dry-run = 0 条**（staging 18 个 video 资产 posterUrl 全非空，无需回填）。正式服部署时同样先 dry-run 再决定。

### ③ ⭐ 资产库「上传类」不再分对话流/工作流（读取侧统一）
- `workspace-state/route.ts` 新增 `UPLOAD_IMAGE_CATEGORIES = ["conversation_uploads", "workflow_upload_images", "workflow_uploads"]`（与早已存在的 `UPLOAD_VIDEO_CATEGORIES`/`UPLOAD_AUDIO_CATEGORIES` 同一套写法——**图片是唯一漏做不分流的那个**）。筛选页 + 计数都走它 → 三处上传（对话流/资产库/工作流）+ 工作流视频截图，全部显示在 **上传的资产 · 上传图片**；上传类不再计入"工作流/对话流"分组计数。
- 写入侧顺手修掉既有分叉：`persistWorkflowUploadNodeAsset` 里工作流上传的**图片**原来硬写成 `conversation_uploads`（对话流上传），现按真实来源写 `workflow_upload_images`。因读取已统一，**老数据不用 backfill 也照样显示**。
- 前端 `isAssetInFilter` 的 `conversation_uploads` 判定本来就只看"是不是上传"、不看流，无需改。
- ⚠️ 由此上一批（第二次会话）原计划的"`currentCategory` 从 `conversation_upload_*` 纠正为 `workflow_upload_*`"**backfill 不再是必须**（显示已统一），留着不做也无影响。

### ④ 用户中心「生成图片 X 张 / 生成视频 Y 段」显示 0 修复
- 根因：`User.generatedImageCount/generatedVideoCount` 两个列**从来没有任何代码给它们 +1**（历史遗留），真实用户恒为 0；后台早就用"现算 + Math.max"绕过，只有用户中心还在直接读列。
- 修法：`src/lib/user-profile.ts` 新增唯一权威 `getUserGeneratedMediaCounts(userId)`（MediaAsset 按 mediaType groupBy，**只数生成的**：`sourceKind` 不含 `upload`；用户删掉的仍计入，归档不计）+ `getUserProfileWithGeneratedCounts()`（与老列取 `Math.max`，口径与后台一致）。
- `/api/auth/me`、`/api/user-profile` 的 **GET 和 PUT** 都改走它。PUT 也必须带数量——否则保存资料后前端 `applyCurrentUserProfile` 整份覆盖，数字被刷回 0（隐藏坑，已堵）。
- 本地实测：`12424740@qq.com` = 632 张 / 25 段；`lookxun@163.com` = 6 张 / 0 段（老列都是 0）。

### ⑤ 「我的积分」页积分来源列：工作流用工作流图标
- `/api/credits/me` 新增来源 `"workflow"` + `isWorkflowLedger()`（优先 `workspaceKind === "workflow"`，老数据兜底 `metadata.creditSource` 以 `workflow_` 开头）。分组 key `workflow:${workspaceId}` → **每个工作流一行**（与每个对话一行对称），标题仍是工作流名。提示词工具/资产库生成等特殊来源分组不变。
- 前端 `UserCreditSource` 加 `"workflow"`，图标用 **`RiGitPullRequestLine`**（= 侧栏「工作流模式」同一个图标）；不加 label，所以那列仍显示工作流名称。

### 部署记录（测试服 v1.0.0.44）
- `node scripts/bump-version.mjs` → v43→v44；tgz 19 个改动文件 scp → `sudo tar -xzf -C /opt/flashmuse-staging/app` → `docker compose up -d --build staging-app`（"No pending migrations"）→ `sync-ali-test.sh` → sed `PUBLISHED_APP_VERSION: "v1.0.0.44"` + `force-recreate`。
- 验证：`x-app-version: v1.0.0.44`、首页 HTML 里版本号 v1.0.0.44、`127.0.0.1:5001` 200、`http://101.37.129.164:8080/` 200、`https://staging-static.venusface.com/` 200。
- ⚠️ 本批功能**均未实机点测**（用户习惯：叫测才测）。建议至少验：工作流视频截图三项、资产库上传图片里能看到截图、用户中心数量、积分页工作流图标、上传视频封面。


## 2026-07-27（第三次会话）提示词视频缩略图悬停封面 + 参考视频时长真实上限实测(15.2s)与三处统一 + 工作流视频快捷菜单（快捷编辑/下载）—— ⚠️ 仅本地，未 commit 未部署；`npx tsc --noEmit` 全绿。基线仍 `v1.0.0.43`

> 本批**未加 Prisma 迁移**、**无需数据 backfill**。承接上一批（第二次会话）那批未部署改动，一起部署即可。

### ① 对话流提示词里的视频小缩略图：鼠标悬停显示封面（对齐图片的"悬停看原图"）
- 新增 `HoverVideoPreview`（`chat-workbench.tsx:1284`）：与图片的 `HoverImagePreview` 同款悬停放大交互，放大处显示视频封面（有 `posterUrl` 用它，否则 `<video>` 首帧 `#t=0.1` 兜底），用 `onLoadedMetadata` 拿真实宽高做自适应定位。
- `MediaFileReference` 加 `posterUrl?`，`getUploadedMediaReferences` 从上传文件带出 posterUrl。
- `ReferencedTextContent` 里视频内联缩略图改为用 `HoverVideoPreview` 包裹（播放按钮角标保留）。

### ② ⭐ 实测 BytePlus Seedance 2.0 参考视频真实时长上限 = **15.2 秒**
- 在**测试服**用容器内 `ffmpeg-static` 造 15.00~15.92s 精确样片 → 同步到阿里测试镜像取得公网 URL → 直接 POST `/contents/generations/tasks` 打三个模型端点，从长到短试（被拒不计费）。
- API 报错原文写死：`video duration (seconds) ... must be less than or equal to 15.2 for model dreamina-seedance-2-0 / -fast / -mini in r2v`。**三个模型完全一致 = 15.2 秒（含）**。15.21s 起被拒；15.10/15.00 通过。
- 附带发现另一条约束：`video pixel count ≥ 409600`（与时长无关，我的 640×360 样片触发过它）。测试临时文件已全部清理。
- 另查正式服库：`videoDuration='15秒'` 且有探测时长的记录，**三个模型全部是 15.1 秒**（min=max=avg=15.1、distinct=1）。→ **自家生成的 15 秒视频（15.1s）拿去当参考视频是安全的（15.1 < 15.2）**。
- ⭐ **可复用的探测方法（以后要测任何 BytePlus 上限，照这个来，别再摸索）**：
  1. 容器内没有系统 ffmpeg，但有 `ffmpeg-static`：`/app/node_modules/ffmpeg-static/ffmpeg`（**没有 ffprobe**，量时长用 `ffmpeg -i 文件 2>&1 | grep "Duration:"`）。
  2. 造样片写成 `.sh` scp 到腾讯 `/tmp` → `sed -i 's/\r$//'` → `docker cp` 进容器 → `docker exec bash`。样片放 `/app/public/generated/_durtest`（= 宿主 `/opt/flashmuse-staging/data/generated/_durtest`）。
  3. 要公网 URL 给 BytePlus 下载：`rsync` 到阿里测试镜像 `/var/www/flashmuse-static-test/generated/`，再用 `https://staging-static.venusface.com/generated/...` 访问（用 `/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519` 这把 key，**必须 sudo**）。
  4. 探测脚本写成 `.js` 进容器 `node` 跑，API key 从 `/app/.env.local` 读 `BYTEPLUS_API_KEY`/`ARK_API_KEY`；端点 `https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`；模型名用 `dreamina-seedance-2-0-260128` / `-fast-260128` / `-mini-260615`（`system-settings.ts` 的 `BYTEPLUS_ENDPOINT_MODEL_NAMES` 有映射）。
  5. **省钱要点**：**从超限往下试**——被拒（400 InvalidParameter）不产生任何费用，第一个被接受的才会真生成，接受了立刻 `DELETE /contents/generations/tasks/{id}` 取消。本次全程都是 400，**一分钱没花**。
  6. PowerShell 内联嵌套引号会被吃掉 → 所有脚本一律写文件 scp，别拼内联命令（本次反复踩到）。

### ③ 时长限制三处分叉收敛（原来 client 15.35 / server 16.01，全错）
- `media-upload-validation.ts` 成为唯一权威：新增 `export const MEDIA_DURATION_EPSILON_SECONDS = 0.2`（唯一定义）+ `export function validateReferenceMediaDurationRange()`（单条时长校验唯一实现）。对外仍宣传 `maxSeconds=15`，容差 0.2 → **有效上限正好 15.2 = 实测硬上限**。
- 服务端 `validateMediaUploadMetadata` 的 `< 1.9 || > 16.01` → 改成 `< 2 - EPS || > 15 + EPS`。
- `chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx`：**各自删掉本地 `MEDIA_DURATION_EPSILON_SECONDS = 0.35` 和重复的 `validateMediaDuration`/`validateWorkflowMediaDuration`**，改为 import 共享实现（用别名保持调用点零改动）。
- ⭐ **顺带修掉一个历史 bug**：`upload-rules.ts` 的 `validateReferenceTotalDuration` 原来严格 `> 15` 就拦 → 我们自己生成的 15 秒视频（15.1s）**当参考视频会被自己拦死**。现在同样带 `+ MEDIA_DURATION_EPSILON_SECONDS`（=15.2）。这也是视频快捷编辑能对 15 秒视频生效的前提。

### ④ 工作流画布：视频节点加快捷菜单（本批只做「快捷编辑」+「下载」，高清按用户交代先等）
- 快捷菜单开放给视频：`showImageQuickMenu` 改名 `showMediaQuickMenu`，条件加 `node.kind === "video"`；`canQuickEdit` 同步放开（Tab 快捷键对视频也生效）。图片专属的**高清/去背景/橡皮**在视频上隐藏，橡皮浮层额外用 `!isVideoQuickMenuNode` 二次兜住。
- **视频快捷编辑** `createVideoEditNode`：新建视频节点，**参数以源视频的真实尺寸/真实时长为准**，**源视频当参考视频**（`referenceVideosOverride`）+ 用户提示词，**强制融合模式**（`videoReferenceMode: "reference"`，只有融合模式支持参考视频）。
  - ⭐ **参数一律从真实 `videoDimensions` / `durationSeconds` 反推，而不是照抄节点上的设置**。原因：**上传视频节点的 `resolution`/`duration` 是建节点时的默认值（720p / 8秒），不是真实值**——照抄会把一个上传的 1920×1080 / 12 秒视频错当成 720p / 8 秒。新增两个助手（对齐图片侧同名思路）：`closestResolutionForVideoDimensions()`（在模型支持的档里挑总像素最接近的一档）、`closestWorkflowVideoDurationLabel()`（真实秒数 → 最接近的「N秒」档）。比例用 `closestWorkflowRatioLabel()`，**模型没有完全一致的比例时取最接近的一档**。对生成视频结果不变（它的真实尺寸/时长本就等于其设置）。
  - ⭐ **分辨率优先决定模型，不是无脑依次**：先以档位最全的 `seedance-2-0` 为基准按真实尺寸算出该用哪一档，再据此过滤候选链 → **需要 1080p 时只有 2.0 支持，链条只剩 2.0，直接用 2.0、不再依次尝试**；480p/720p 时三个都支持，才依次 **Mini → Fast → 2.0**。
  - 把源视频**精确时长**（`durationSeconds`，如 15.1）传进 `referenceVideoDurations`，让总时长校验拿到真实值。
- **统一链路（铁律#3）**：没有另写一套生视频逻辑，而是给唯一的 `runVideoNode` 加可选第二参数 `{ modelCandidates, referenceVideosOverride, referenceVideoDurations, forceReferenceMode }`，把原来的单次执行体包进候选链循环。**不传 options 时行为与改造前完全一致**（attempts=[单模型]、同样的 requestId 生成、同样的校验与轮询）。候选链换模型时会 `updateNode` 同步节点显示的 model/比例/分辨率（等待卡标签跟随实际尝试的模型，与图片候选链一致）。
- **计费正确性**：每次尝试都生成**新的 `requestId`**、`creditSource` 仍是 `workflow_video_generation`，失败的尝试不计费、成功只计一次，不会重复扣分（与图片编辑候选链同机制）。
- **下载收敛**：图片快捷菜单原来**自己内联写了一份下载**（用 `getStaticMediaUrl` + 自己拼文件名），与右键菜单用的共享 `downloadWorkflowNode()`（`:1898`，本就同时支持 image/video、文件名走 `getWorkflowDownloadFileName`）是两份分叉。现在**快捷菜单图片/视频统一走共享那份**，删掉内联实现。

### ⑤ 后台：新增「工作流 · 视频编辑功能」表格 + 开关联通
- `system-settings.ts` 新增 `VIDEO_EDIT_FUNCTION_MODEL_CHAIN`（Mini → Fast → 2.0）+ `VIDEO_EDIT_FUNCTION_KEYS = ["video_quick"]`，并并入 `DEFAULT_EDIT_MODEL_TOGGLES`（默认全开）。**新增视频编辑模型只改这张表 + 前端那张，别再复制第三份。**
- `admin-system-settings-panel.tsx` 新增 `VIDEO_EDIT_MODEL_CHAIN` + `videoEditFunctionRows`，渲染「工作流 · 视频编辑功能」表（快捷编辑=候选链三个开关；下载=纯前端无模型）。
- 前端新增 `getVideoEditCandidates("video_quick", toggles)`（与图片的 `getEditCandidates` 同规则：按开关过滤、保持顺序、全关回落完整链），`createVideoEditNode` 改用它 → **后台开关真正生效**。
- 存取链路无需额外改动：后台 API 是 `{...current.editModelToggles, ...body}` 合并（新键自动落地）；`/api/model-availability` 已返回 `editModelToggles`，`chat-workbench` 已透传给 `WorkflowCanvas`。
- **样式（⚠️ 走过一次弯路，已回退）**：我一度把两张编辑功能表的**列头行**（功能/规则说明/使用模型）底色从 `bg-[#fafafa]` 改成 `bg-white`，**这是理解错了、已全部改回灰色**。用户要的是：**标题栏灰 + 列头行灰 + 内容行白**（= 和大表一致）。列头行本来就该是灰的，别再动它。

### ⑥ ⚠️ 本批唯一未完成项：编辑功能表「内容行看起来不是白色」
- 用户反馈：图片编辑功能表的**内容行看起来不是白的**，而大表的内容行是白的，要求统一成白色。
- **但从代码看内容行本来就是白的**，我没找到那个灰：三个 `<section>` class 完全一样（都 `bg-white`，`:390` 大表 / `:455` 图片编辑 / `:493` 视频编辑），内容行本身也都**没设任何背景**、直接继承白色（大表 `:388` 与图片编辑 `:467` 的 class 结构一模一样，都只有 `border-b border-[#f2f2f2]`）。
- **我的判断（未经用户确认）**：用户看到的灰其实是「使用模型」列里那三个模型标签的**药丸底色 `bg-[#f4f6fb]`**（很浅的蓝灰）。它在编辑表里是 `w-full`，会把整个 470px 列铺满 → 看着像一整条灰带；大表里药丸是 `360px + 中间 70px 空隙`，周围留白多，所以看着"白底上放几个小标签"。
- ⚠️ **关键坑**：**大表也用同一个 `#f4f6fb`**（`OpenRouterModelTag:202`、`BytePlusModelTag:216/:228`，空位占位 `:200/:213`）。所以**只改编辑表的药丸会让两边更不一致**，要改就得三张表一起改。
- **已向用户提出二选一、等回复**：(A) 药丸底改白+加浅边框，**三张表一起改**；(B) 只改编辑表、大表保持。**下一个 AI 请先拿到用户选择再动手，不要自己猜。**
- **另一个卡点**：本地后台我进不去，所以没法自己截图核对。`.env` 里 `ADMIN_EMAILS=lookxun@163.com` 确实是管理员白名单，但**这个账号在本地库里的密码不是 `dragonstar`**（试过，进不去；测试服那套账号密码只对测试服有效）。要么找用户要本地后台密码，要么让用户贴截图。

### 注意
- 本批**只做了本地改动 + 测试服的一次性 API 探测**，没有部署、没有改任何服务器状态（测试服产生的样片与脚本已清理）。
- `runVideoNode` 是生视频主路径（对话流不走它，但工作流所有视频生成都走），已保证无 options 时行为不变；部署后建议顺手验一次「工作流普通生视频」仍正常。
- **本批全部功能都还没实机验证过**（用户交代"叫你测试才测试"，且视频快捷编辑一点就真花钱生视频）。只有 `npx tsc --noEmit` 全绿。

---

## 2026-07-27（第二次会话）视频封面/播放按钮全平台统一 + 上传视频归类分叉根治（图层无封面 & 资产库重复）—— ⚠️ 仅本地，未 commit 未部署；本地 dev 已验证通过，`npx tsc --noEmit` 全绿。基线仍 `v1.0.0.43`

> 用户新交代不变：**叫你测试才测试**；本批默认只本地不部署。下一个 AI 若要部署走 03 的 测试服→正式服 流程（会自增版本号）。本批**未加 Prisma 迁移**，但**改了一条线上数据的分类需要 backfill**（见文末"部署注意"）。

**开场小插曲（本地 dev 登录失败）**：现象=所有 `/api/*` 返回 404、页面 `/` 正常 200，登录接口 404。根因=`next dev` 的 turbopack 路由清单/缓存坏了（把 `route.ts` 当页面路由匹配到 `/_not-found`）。**解法=杀掉 `next dev` 进程树 + 删 `.next` + 重启 `npm run dev`**。（记住：以后"所有接口 404/登录失败"多半是这个，重启即好。dev 由 `start-project.bat`→`scripts/start-project.ps1` 起，端口 3000。）

### 需求
用户要：① 工作流"图层"面板里上传视频的小缩略图要显示**封面**（上传视频也要有封面）；② **所有视频小缩略图中间要有播放按钮**表示是视频；③ **全平台统一**。随后发现两个连带 bug：**图层里上传视频只显示图标没封面**、**资产库里同一个上传视频显示成两条相同的**。

### 真正根因（一个分叉引发两 bug）
`/api/upload-file/route.ts` 把资产分类**算了两遍且分叉**（违反"能统一一律统一"）：`buildMediaAssetRecord` 内部用权威 `classifyAsset` → 正确得 `workflow_upload_videos` 写进 `MediaAsset`；但同一路由又用**本地 `getFileCategory` 忽略 `flow`**，把 `UserAssetState.currentCategory` 误写成 `conversation_upload_videos`。而**客户端资产库/图层实际只读 `/api/workspace-state`（走 `UserAssetState.currentCategory`）**，于是这条工作流上传视频被当成 conversation：
- 图层：被排除出 `workflowAssets`（`chat-workbench.tsx:15822` 过滤 `isWorkflowAsset`）→ 图层 `WorkflowAssetLayerRow` 拿不到 DB 的 `posterUrl` → 显示 `RiVideoLine` 图标。
- 资产库重复：工作流侧"查重"用 `normalizeMediaUrlForMatch(url)===X && isWorkflowAsset`，因它被标 conversation 查不到权威记录 A → 又插一条 `createClientId()` 的客户端副本 B（**DB 其实只有一条**，B 仅内存、刷新即消，但用户当会话看到两条）。

### 已做（本对话，全部本地）
1. **统一播放按钮组件**：新增 `src/components/video-play-badge.tsx` `VideoPlayBadge`（5 档 size：xs/sm/md/lg/xl，`bg-black/42`+`RiPlayLargeFill`+`backdrop-blur`）。把散在 6 处的重复 overlay 收敛到它：对话流资产卡(`chat-workbench.tsx:6358` lg)、内联视频(`6842` xl)、资产导入弹窗(`15944` md)、@引用弹窗(`asset-mention-picker.tsx:119` sm)、上传缩略图(`video-upload-thumbnail.tsx` 原 CSS 三角形→sm 徽标)、后台媒体缩略图(`admin-credits-panel.tsx` 新增 xs)。删掉各处重复 markup 及 chat-workbench 里不再用的 `RiPlayLargeFill` import。**全平台视频小图现在同一个播放按钮。**
2. **图层面板视频缩略图加封面+播放按钮**：`WorkflowAssetLayerRow`（`workflow-tldraw-canvas-inner.tsx:5113`）缩略图 `<span>` 加 `relative`，视频且有 previewUrl 时叠 `<VideoPlayBadge size="xs">`；`<img>` 加 `onError`→`setPreviewFailed` 回退图标（防老的无封面上传视频显示破图）。
3. **根因修复：上传归类不再分叉**：`upload-file/route.ts` 的 `getFileCategory(mediaType, flow)` 改为走权威 `classifyAsset({origin:"upload",flow,mediaType}).initialCategory`（import `classifyAsset`/`AssetMediaType`）。→ 新上传的工作流视频 `currentCategory=workflow_upload_videos`，不再误入 conversation，也就不再产生资产库重复副本。
4. **`workspace-state/route.ts` 对齐 `media-assets`**：`isWorkflowCategory` 补 `|| item.currentCategory.startsWith("workflow_upload_")`（media-assets:148 早就这么写，workspace-state 漏了）。→ 工作流上传资产 `librarySource="workflow"` → 进 `workflowAssets` → 图层直接拿到 DB 真实 `posterUrl` 显示封面。（注：上传视频仍留在"上传视频"tab，因该 tab 过滤 `uploaded && isVideoAsset` 不看 librarySource；不会跑去"工作流视频"tab，那 tab 要 `!uploaded`。）
5. **上传视频 posterUrl 前端链路补全（新上传的防御）**：`uploadWorkflowFile`（`workflow-tldraw-canvas-inner.tsx:734`）接收/返回服务端 `posterUrl`；`precheckUploadedFileDedup`（`upload-content-hash.ts`）+ 服务端 dedup（GET+两处 POST，`upload-file/route.ts`）都补带 `posterUrl`；视频上传节点 `data` 写 `posterUrl: uploadedVideo.posterUrl`（`:3322`）→ 新上传即便资产还没加载进 `assets`，图层也能从 node.data 拿到封面。
6. **数据修复（本地 DB）**：写一次性脚本把历史误分类的 `UserAssetState.currentCategory` 从 `conversation_upload_*` 纠正为 `workflow_upload_*`（依据 `mediaAsset.sourceKind` 以 `workflow_upload_` 开头判定）。本地只命中 1 条（就是用户那条"7110"）。脚本已删。

### 走过的弯路（重要教训，别重犯）
- 我一度给客户端 `getLocalVideoPosterUrl`（`chat-workbench.tsx:2170` + `admin-credits-panel.tsx` 那份重复实现）加"支持 `/files/` 上传视频→硬拼同目录 `.poster.jpg`"。**这是错的、已回退**：老上传视频没有 poster 文件，硬拼的 URL 404 → 资产库里**其它上传视频封面全变破图**（它们本来靠 `<video>` 首帧兜底显示）。真正让图层出封面的是上面第 4 条（归类修复让资产进 `workflowAssets`、直接用 DB 的 `posterUrl`），**不需要任何 URL 推算**。→ 教训：poster 是否存在无法客户端同步判断，别凭 URL 规则臆造 poster 地址。
- `getLocalVideoPosterUrl` 只认 `/generated/.../videos/`（生成视频），上传视频在 `/files/`——保持不认（回退后现状），靠 DB `posterUrl` 或 `<video>` 首帧兜底。

### 验证（Playwright 本地，测试号 `12424740@qq.com`/`dragonstar` = 本地 ID_779117）
- 资产库"上传视频"tab：7110 只剩**一条**，7 个视频全显示封面+播放按钮。
- 工作流_01 图层面板：7110 缩略图显示**封面+播放按钮**（poster thumbnail 已加载 256px、badge 存在）。

### ⭐ 部署注意（下一个 AI 若要部署这批）
- **代码**：走 03 测试服→正式服流程（会 bump 版本）。改动集中在 `upload-file`/`workspace-state`/`chat-workbench`/`workflow-tldraw-canvas-inner`/`asset-mention-picker`/`video-upload-thumbnail`/`admin-credits-panel` + 新增 `video-play-badge.tsx`；**无 Prisma 迁移**。
- **线上数据 backfill（必须做，否则正式服/测试服历史"工作流上传视频"仍无封面/仍可能重复）**：部署后在对应库跑一次"把 `UserAssetState.currentCategory` 里 `mediaAsset.sourceKind` 以 `workflow_upload_` 开头、但 currentCategory 为 `conversation_upload_*`/`conversation_uploads` 的记录，按 sourceKind 纠正成对应 `workflow_upload_*`"。写成 `.js` 放进容器 `/app` 跑（遵守 00-README：一次性 node 脚本进容器跑、别用 PowerShell 内联）。**只影响历史工作流上传媒体**，新上传因代码已修不再产生错分类。

---

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
