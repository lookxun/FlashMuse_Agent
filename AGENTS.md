<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 铁律⭐⭐⭐：上游「按帧数吃显存/算力」时，**只封顶秒数是没用的 —— fps 必须一起封顶**（2026-09-12 抓到，60fps 视频必挂）

深度动作捕捉（RunningHub DepthCrafter）真机矩阵是在 **30fps** 下测的：896×512 × **750 帧稳过、900 帧 VRAM OOM**。
于是上一批把秒数封到 `MAX_DEPTH_SECONDS = 25` 就以为安全了。⛔ 但 `frame_load_cap = min(25, 源时长) × **源 fps**`，
而 fps 是直接信源视频的（原来放到 120）→ **手机拍的 60fps 视频跑满 25 秒 = 1500 帧 = 实测天花板的 2 倍，必挂。**

- ⭐⭐ **判据（一句话）**：把上游那个"额度"的公式抄出来，看它**由几个变量相乘**。
  只封顶其中一个，另一个就能把你顶穿（这里是 `秒 × fps`；换成图片就是 `张数 × 像素`、文本就是 `条数 × 长度`）。
- ⭐ **正解是降 fps，⛔ 不是截帧数**：降 fps **不改成品时长**（VideoCombine 用同一个 fps 合片）→ 按秒收费一分不变；
  而"截帧数"是**内容被砍了却仍按完整秒数收钱 = 多收**（违反本文件那条"上游截断多少就只收多少"的铁律）。
- ⭐ 唯一权威 `src/lib/video-depth-size.ts` 的 `resolveVideoDepthFps` / `DEPTH_MAX_FPS = 30` / `MAX_DEPTH_FRAMES = 750`。
  ⛔ 要放大 `DEPTH_MAX_FPS` 之前先算 `MAX_DEPTH_SECONDS × fps` 会不会超过 750。
- ⭐ **真机矩阵要连同测试时的 fps 一起记进注释**（只记"25 秒能过"是残缺的情报，下一个人就会栽）。

# 铁律⭐⭐：**"写死规格的档位"绝不许被"真实宽高反推"覆盖；而且反推点往往有好几处，写入侧那个才是根**（2026-09-12）

深度捕捉输出恒定 896×512，我们按 **480p** 记账、发上游、写 `settings.resolution`。
但 `getVideoResolutionFromDimensions(896,512)` 会落进 **720p**（`minSide 512 > 500` 且 `maxSide 896 > 800`，两个 480p 条件都不满足）
—— 而这个反推函数在**四处**都比"存好的档位"优先，于是界面上全是 720p/HD，**和我们自己的账本对不上**。

- ⭐⭐ **最值钱的一条：先查库、再改显示。** 我先改了节点头 → 资产库还是 HD；再改资产预览 → 还是 HD；
  回库一查才发现 **`MediaAsset.resolution` 本身就被存成了 720p**（写入侧 `finalizeVideoJobAsset` 也在反推）。
  → **"显示对了 ≠ 数据对了"**；顺序搞反白花了两轮部署。
  ⭐ 判据：`SELECT resolution, width, height FROM "MediaAsset" WHERE model='...'` ——**一行 SQL 就能定位是哪一层错**。
- ⭐ **grep 那个反推函数，逐个调用点问「这里该不该让位给存好的值」**。本项目四处：
  ① `generation-jobs.ts` 的 `finalizeVideoJobAsset`（**写入侧，根**）② 画布节点头 `getWorkflowNodeParamParts`
  ③ `media-asset-record.ts` 的 `toAssetPreviewMeta` ④ `chat-workbench-core.tsx` 的 `getWorkflowPreviewMeta`
  （+ `chat-workbench.tsx` 里那条 fallback）。
- ⛔ **别去改共享反推函数的阈值**（把 `minSide <= 500` 放宽到 540 能顺手治好这一例，
  但会把全站所有 960×540 之类的视频标签一起改掉）——只给"有写死规格"的那个模型加例外。
- ⭐ 回归要带**反向用例**：普通视频仍按宽高反推（896×512 仍是 720p）、深度但没存档位时仍回落反推。

# 铁律⭐⭐：模型不在菜单列表里的"特殊节点"，编辑器会**显示成另一个模型**，而且用户点一下就把它改成普通节点（真扣钱）（2026-09-12）

`VideoNodeEditor` 第一行是 `modelOptions.videoModels.some(id === node.data.model) ? node.data.model : videoModels[0]`。
画质增强 / 深度动作捕捉这两个模型**故意不在 `videoModels` 里**（它们只从快捷菜单进入）→ 回落成**列表第一个**
（Seedance 2.0 Fast）→ ① 节点上显示的是**另一个模型** ② 用户点一下模型菜单，`onChange` 就把 `node.data.model` 改成普通视频模型
→ 再点运行 = 拿「深度动作捕捉」当提示词**真跑一条普通视频、真扣钱**。

- ⭐ **判据**：凡是"从快捷菜单创建、模型不在下拉列表里"的节点，去看它的编辑器渲染了哪些菜单。
  **能改模型 = 能把它变成另一种会花钱的节点。**
- ⭐ **正解**：这类节点不渲染模型/参数/时长菜单（`isPostProcessNode` 时返回 null）——它们的档位由快捷菜单在创建时定死，本来就不该在这里改。
- ⭐ 这与上一批修的"运行按钮掉进 `runVideoNode`"是**同一族的两半**：
  修了"按下去跑错函数"，还要修"把节点本身改成别的模型"。**修这类 bug 时把"入口"和"数据"两头都数一遍。**


# 铁律⭐⭐⭐：**上游不返回成本的链路，扣费输入绝不许来自客户端** —— 必须服务端现场实测（2026-09-12 抓到 4 个漏洞）

2026-09-12 审「画质增强 / 深度动作捕捉」这两条新链路：MediaKit / RunningHub **从来不返回 `usage.cost`**，
所以 `withVideoUsdFallback` 的兜底定价就是**唯一扣费依据**，而它读的 `settings.duration`
**整条路都来自客户端**（画布节点里 `Math.floor(durationSeconds)` 拼的 `"5秒"`）。
→ **客户端报「1秒」，60 秒的视频就只扣 1 秒的钱。**

- ⭐⭐ **判据（一句话）**：把这次扣费的每一个输入变量列出来，逐个问「**这个数是谁算的？**」。
  只要有一个来自请求体，而上游又不给成本 → **客户端可以自己定价**。
- ⭐ **正解**：服务端手上本来就有那个文件（两个 provider 都要读本地文件传上去）→
  一律现场 ffmpeg 实测（唯一权威 `src/lib/video-source-asset.ts` 的 `resolveSourceVideoDuration`），
  客户端那个数**只在实测失败时兜底**，并把 `durationSource` / `probedSeconds` / `clientDuration` 全写进诊断日志
  （判据：日志里必须是 `"probed"`）。
- ⭐⭐ **同族第二漏：兜底定价里写 `if (seconds <= 0) return usage`** → `usd` 缺失 → `chargeCredits` 按 0 扣
  = **静默白送**（不报错、不进红字、后台也看不见）。**凡是兜底定价分支，都不许有"算不出来就不定价"的出口**，
  一律回落到 `getEffectiveVideoDurationSeconds`（拿不到按 5 秒兜底）。
- ⭐⭐ **第三漏：上游只处理前 N 秒，我们按完整时长收钱 = 多收。**
  深度捕捉的 `frame_load_cap` 只吃前 N 秒（`MAX_DEPTH_SECONDS`），而扣费用的是源视频完整时长。
  → **凡是上游有"只处理前 N 个/前 N 秒"的截断，收费秒数必须按同一个 N 截断**（日志里记 `capped`）。
- ⭐ **第四漏（同批，另一族）：尺寸也别信客户端。** 画布节点声明 1280×720、文件真实 864×496 →
  发给上游的 `custom_width/height` 用了声明值 → ①成品尺寸和源视频不一样 ②上游 GPU 直接 `CUDA error` 挂掉。
  改成**实测优先、客户端兜底**之后两个问题一起消失。

# 铁律⭐⭐：**菜单报价必须按"真实扣费的分布"给，而"贵不贵"常常不由分辨率决定**（2026-09-12 把「3积分」纠成「约2-4积分」）

GPT Image 2.5 的菜单副标题写 `usd: 0.041` → 显示「约3积分/张」。拉真实扣费一量：
**同一个 1K + 同一个默认画质 high，16:9 = $0.0286（2 分）/ 4:3 = $0.0390（3 分）/ 1:1 = $0.0528（4 分）**
—— **比例越"方"越贵**（1:1 是 16:9 的 1.85 倍，而像素只多 14% → 按 patch 计费、不是按像素线性；
GPT-5.4 Image 2 上同样成立）。而**画质的影响更大**：max 是默认档的 **4 倍**（0.1137 vs 0.0285）。
→ 那个单一数字**两头都不对**（16:9 高估 37%、1:1 低估 46%）。

- ⭐ **判据**：把真实扣费按 `模型 × 画质 × size` 聚类（数据源：`CreditLedger` + 诊断日志的
  `image-provider-success.extra.usd`）。**同一"档"里最大/最小差 1.5 倍以上 → 菜单必须给区间**
  （`usd` + `usdHigh` → 「约2-4积分/张」，沿用 `seedream-5-0-pro` 的先例），⛔ 别硬凑一个数。
- ⭐⭐ **预估闸门要按"真正决定价钱的那个维度"建表**：本项目原来只有 `estUsdByResolution`，
  而 2.5 的价钱主要由**画质**决定 → 新增 `estQualityMultiplier`（只给这两个模型配，其余恒 1 倍、行为不变），
  并把 `settings.quality` 从 `/api/image` 一路传到 `getEstimatedGenerationUsd`。
  基准取「该分辨率里**最贵比例**的默认画质」——闸门宁高不低。
- ⛔ **`usd` 字段同时被 `getImageModelFallbackUsd`（上游不给成本时的扣费兜底）读** → 改它要意识到这一点。
- ⭐ **验收必须逐笔对账**：真跑几张 → `credits` 与 `round(extra.usd × usdToCnyRate × creditsPerCny)` 逐条相等。
  ⛔ 别只看菜单文字改没改。

# 铁律⭐⭐：**幂等早退的路径上，要问一句「那把锁/那个占位有没有人释放」**（2026-09-12 抓到占位泄漏）

`reserveGenerationQuota` 在真正建 job 之前插一条 `GenerationReservation` 占位，正常由
`markJobSucceeded` / `markJobFailed` 释放。但**刷新页面后前端会对一条已经 succeeded 的消息再 POST 一次** →
闸门又插了一条新占位 → `createXxxJob` 走幂等早退（返回那条早就完成的 job）→
**没人再走 markJobSucceeded → 占位永远不释放，只能等 `expiresAt`（30 分钟）**。
实测抓到：占位 19:23:15 插入，而对应 job 19:12:59 就成功了 → 用户被白占 8 积分的额度。

- ⭐ **判据**：凡是「同一个 requestId 重复进来会走幂等早退」的接口，
  把**早退之前已经产生的副作用**（占位、advisory lock 之外的行锁、计数器、临时文件）逐个列出来问
  「这条早退路径上谁来清理它？」没人 → 就是泄漏。
- ⭐ **正解（本项目）**：闸门事务里先查
  `SELECT 1 FROM "GenerationJob" WHERE "requestId"=... AND status IN ('succeeded','failed')`，
  有就直接 return、不插占位（活儿已经干完了，不该再占任何额度）。
- ⭐ **验法是二值的**：拿一个**已 succeeded** 的 requestId 再 POST 一次 →
  `GenerationReservation` 必须仍是 0 行（旧代码会多出一行）。⛔ 别靠"刷新一下看看"。
- ⭐ 顺带：**`expiresAt` 那个兜底是"别把用户永久卡住"，不是"泄漏没关系"** —— 泄漏期间用户的可用余额是真的少了。

# 铁律⭐⭐⭐：Prisma 的 `DateTime` 列是 **`timestamp without time zone`（裸 UTC）** —— SQL 里转北京必须绕两步，⛔ 单次 `AT TIME ZONE 'Asia/Shanghai'` 是**反方向**（2026-09-10 抓到，上一批"改成北京时间"把 6 处按天统计改得比原来更错）

Postgres 的 `AT TIME ZONE` 对两种列语义**完全相反**：
- 对 `timestamp`（无时区，本项目 Prisma `DateTime` 全是这种，存的是裸 UTC 值）：
  `AT TIME ZONE 'Asia/Shanghai'` = 「把这个裸值**当成**北京时间」→ 结果**减 8 小时**；
- 对 `timestamptz`：`AT TIME ZONE 'Asia/Shanghai'` = 「转换成北京本地时间」→ 结果**加 8 小时**（这才是直觉）。

⭐⭐ **本项目正确写法（唯一）**：`"createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'`
（先声明"它是 UTC"、再转北京）。判据一行、二值：

```sql
WITH t AS (SELECT '2026-09-09 16:08:55'::timestamp AS ts)   -- 存的 UTC 值 = 北京 09-10 00:08
SELECT to_char(ts,'MM-DD HH24:MI')                                        AS old_utc_way,      -- 09-09 16:08
       to_char(ts AT TIME ZONE 'Asia/Shanghai','MM-DD HH24:MI')           AS wrong_way,        -- 09-09 08:08 ❌
       to_char(ts AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai','MM-DD HH24:MI') AS right_way -- 09-10 00:08 ✅
FROM t;
```

- ⭐⭐ **最值钱的一点：改错方向比不改更糟。** 原来按 UTC 分桶只有「北京 00:00–08:00」的事件归错天（错 8 小时窗口）；
  改成单次 `AT TIME ZONE` 之后变成「北京 08:00–24:00」都归到前一天（错 **16** 小时窗口）。
  → **凡是"调时区"的改动，必须同时算出「改前偏差」和「改后偏差」两个数**，⛔ 别只确认"我加了时区参数"。
- ⭐ **动手前先查列类型**（一行、决定性）：
  `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE ...`；
  再顺手查一遍「全库还有哪些 timestamptz」：
  `SELECT table_name, column_name FROM information_schema.columns WHERE data_type='timestamp with time zone' AND table_schema='public'`。
  本项目实测：**全库唯一的 `timestamptz` 只有 `_prisma_migrations` 的 `started_at`/`finished_at`/`rolled_back_at`**
  → ⛔ 给那张表写诊断 SQL 时**不能**加 `AT TIME ZONE 'UTC'` 前置（我自己就因此把迁移完成时间看错了 8 小时）。
- ⭐ **`date_trunc` 夹在中间时两头都要转**（留存 SQL 那种）：
  `((date_trunc('day', c AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') + N days) AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC'`
  —— 最后必须**转回裸 UTC**，才能和同为裸 UTC 的列做比较。
- ⭐ **服务端算「北京当天 0 点」只许用 `startOfBeijingDay()`**（`src/lib/beijing-time.ts` 唯一权威）。
  ⛔ `new Date(new Date().setHours(0,0,0,0))` 在 UTC 容器里拿到的是「UTC 当天 0 点」，不是北京 0 点。
- ⭐ **JS 层和 SQL 层要分开数一遍**：本次 JS 层（`beijing-time.ts` 那 5 个格式化函数 + 所有委托它的 `formatDate`）
  **一处没错**，错的全在 SQL 层 + 一处 `setHours`。
  ⛔ 别因为"格式化函数都带了 timeZone"就以为整批改对了。
  ⭐ 排查清单（grep 这些就够）：`AT TIME ZONE` / `date_trunc` / `setHours` / `getHours` / `getDate()` /
  `toISOString().slice` / `toLocaleString`（注意 `toLocaleString("en-US")` 多半是**数字千分位**、跟时间无关）。

# 铁律⭐⭐：验「按天分桶的图表」只认「界面每一格 vs SQL 真值逐格相等」，且先搞清 `innerText` 里数字的排列顺序（2026-09-10 加）

后台趋势图是 SVG，`innerText` 会把数字标签按 **DOM 顺序**吐出来 ——
本项目「对话流 / 工作流」双系列柱状图是**按天交替**的（`day1-conv, day1-wf, day2-conv, day2-wf, …`），
⛔ **不是**「先一整行对话流、再一整行工作流」。我第一次按后者数，得出的结论完全错。

- ⭐ **判据**：拿同一条件的 SQL 真值（`GROUP BY 北京日, bucket`）和界面那串数字**逐格并排比**，
  全等才算过。本次正式服 7 天 × 2 系列 = **14 格全部相等**才敢说修好了。
- ⭐ **顺手把"改之前那种写法"的 SQL 也跑一遍当对照组** —— 两份分布明显不同，才能证明"确实是这个改动起了作用"
  （本次旧写法把 09/04 的 43 张拆成 09/03 的 39 + 09/04 的 4，一眼看出）。
- ⭐ **优先挑"只有一种解释"的数据点**：本次用「我今天北京 01:14 登录 → `Session.lastSeenAt` 必须归到 09/10」
  （旧写法会归到 09/09），比看一堆历史数字快得多。

# 铁律⭐⭐：归档「兜底桶」的完整姿势 —— 回日志捞原文 + 用 `npx tsx` 喂真实 `toUserErrorMessage` 判定「现在还会不会落桶」（2026-09-10 实操，63 → 15）

`07-red-error-triage-and-archive.md` 讲了方法论，这条补**可照抄的操作序列**：

1. **从 DB 取兜底桶全部 requestId**（两个桶一起取：`failureReason LIKE '%服务器繁忙，请稍候再试%' OR LIKE '%请求失败，请稍后再试%'`），
   顺手按 `model` / 按北京日 分组看分布 —— 集中在某个模型/某几天，往往一眼看出根因族。
2. ⭐ **在容器里**用 node 扫日志（⛔ 宿主机路径进不去容器）：容器内是 **`/app/.runtime/`**，
   要一起扫 `generation-diagnostics-log.jsonl` + **`.1` / `.2`**（轮转档）+ `video-diagnostics-log.jsonl`；
   匹配时**按 requestId 前缀**（日志里带 `:image:0` 之类后缀）；取 `upstream.body` / `error.message` 归一化后聚类。
   ⚠️ 跑法 `sudo docker exec -w /app <app容器> node scripts/xxx.mjs`（⛔ 宿主机 `sudo node` 没有 node）。
3. ⭐⭐ **决定"能不能归档"的唯一依据 = 把每条真实原文喂真正的 `toUserErrorMessage`**（本地 `npx tsx`，几秒、零成本），
   看它现在**还落不落兜底桶**；顺手连跑三遍验幂等。
   本次 8 类原文里 **3 类仍落桶** → 那 15 条一条都不归档（铁律：还在桶里 = 留着亮）。
- ⭐ **"日志被轮转裁掉"要单独一条规则 + 一个人工实测的时间下限**：
  本项目新增 `rotated-log-unknowable` + `ROTATED_LOG_WINDOW_START`（当前 `2026-08-11`，
  实测依据 = 「能捞到原文的最早 08-12、捞不到的最晚 08-10」）。
  ⛔⛔ **别把它写成"当前时间减 31 天"这种动态值** —— 那会让每次跑归档都顺手抹掉一批"其实还能查"的事件。
  下次归档前**重新实测一次**再更新这个常量。
- ⭐ **同一族但日期窗口不同 → 必须另写一条规则**：本次 402 余额那族已有规则 `before: 2026-07-27`，
  而新捞到的 2 条发生在 09-01、超出窗口匹配不上 → 单独加 `provider-402-inflight-credits`（match 更精确、`before` 用新日期）。
- ⭐ **`before` 取"映射代码真正上到那台服务器的时刻"，不是"代码写好的时刻"**：
  本次 Recraft 映射代码上一批就写好了，但**正式服直到本批 v1.0.1.22 才带上它** → `before` 用本批部署时刻。
- ⭐ `--apply` 前**必须逐条看 dry-run 打出的样本 `failureReason`**，确认全是兜底文案、没有混进已映射的新文案。
- ⚠️ 归档后**顺手把改动过的脚本同步到两台服务器的 `app/scripts/`**（`docker cp` 进容器的那份重启就没了），
  并对齐三方 md5，否则下次 build 会退回旧规则。

# 铁律⛔：`.mjs` / `.ts` 里用双引号包的长中文说明，内部**不许出现英文双引号**（2026-09-10 踩到）

给归档规则写 `note: "…根因属"用户的图不合规"、我们不帮改图…"` → 字符串提前闭合，
`node --check` 报 `SyntaxError: Unexpected identifier`，而**从报错完全看不出是引号的问题**。
- ⭐ 一律用中文引号「」或『』；**加完规则先 `node --check <文件>`** 再往服务器传。
- ⭐ 同源提醒（本文件另有一条）：块注释里别让连续星号紧邻斜杠，会把注释提前闭合。
<!-- END:nextjs-agent-rules-anchor-do-not-remove -->

# 铁律⭐⭐⭐：真钱链路里「钱到没到」的唯一权威 = **我们自己发起的服务端查询**，⛔ 永远不是对方 POST 过来的那份报文（2026-09-09 支付审计加）

支付宝异步通知 `/api/pay/alipay/notify` 是**公网可达、任何人都能 POST** 的地址。
原来的写法是「验签通过 → 按报文里的 `trade_status` / `total_amount` 加分」——**唯一防线只有验签**。
问题在于：**这条验签到目前为止从没被真正跑过**（线上加分全是前端轮询 `alipay.trade.query` 完成的），
而 alipay-sdk 有 `checkNotifySign`（会二次 decode）和 `checkNotifySignV2`（不 decode）两个变体，
选错一个就全部验签失败；将来支付宝换 v3 JSON 通知格式同样会失效。**验签是"从没验证过的单点"。**

- ⭐⭐ **正解（已实现）**：通知接口降级成**"去查一下"的触发器**。
  ① 验签通过 + `app_id` 是我们的 + `trade_status` 成功 → 走快路结算（正常情况，快）；
  ② 验签没过 / app_id 不对 / 格式不认识 → **报文一个字都不信**，改用我们自己的私钥打
     `alipay.trade.query`（alipay-sdk 会用支付宝公钥验 v3 响应签名 `alipay-timestamp\nalipay-nonce\nbody\n`）
     → 查到真付了才加分。**最坏只是慢一点，绝不可能靠伪造报文白拿积分。**
- ⭐ **触发器路径必须限流**：否则有人拿真实订单号高频打我们的通知地址 = 把我们对支付宝的查单调用放大成 DDoS。
  现在 `pay-notify:order:<no>` 30/min、`pay-notify:ip:<ip>` 600/min（远高于支付宝真实重试频率）。
- ⭐ **前端轮询查单也要节流**：同一订单号对支付宝**最多 2 秒查一次**（`pay-query:<no>`），
  被节流时只读库、不打上游，前端 2.5s 轮询照常工作。
- ⛔ **不是我们的订单号一律回 `success`**（别让支付宝对着别人的单一直重试）；只有「金额比订单少」才回 failure。

# 铁律⭐⭐⭐：**「本地把订单标成过期」绝不等于「对方那边不能再付」** —— 关单前必须先查，且已关的单仍须允许补加分（2026-09-09 支付审计抓到，差点钱收了不加分）

`PAYMENT_ORDER_EXPIRE_MS = 15min` 只是**我们界面上**的过期。支付宝那边的订单**还能被付掉**（precreate 没设 `timeout_express`）。
原来的代码是「本地一超 15 分钟 → 先 `status='closed'` → 再去查单」，而 `fulfillPaidCreditOrder` 又**拒绝 closed 的单**：

- 🔴 于是「14:59 付的、15:01 才轮询到」这一笔 → 订单先被关 → 加分被拒 → 通知还返回 `success` 让支付宝别再重试
  → **钱真收了、积分一分不给、还静默无痕**。这比多送一点积分严重得多。
- ⭐ **两头都堵（已实现）**：
  ① `syncAlipayCreditOrder` **先查支付宝、确认没付成功之后才敢关单**
     （⚠️ 查单 throw 分不清"交易不存在"和"网络抖动"，所以 throw 时仍按本地过期关单 —— 靠下面第 ② 条兜住）；
  ② `fulfillPaidCreditOrder` **允许 `pending` 和 `closed` 两种状态继续加分**（钱真到了就必须给）。
- ⭐ **还要有补单入口**：异步通知会丢（地址配错 / 网关不通 / 我们刚好在重启），而前端轮询只在充值弹层开着时跑。
  现在 `reconcileRecentCreditOrders(userId)` 挂在「打开充值页拉充值记录」那一下：
  取最近 24h、**出过码**（`qrCode != null`，没出码支付宝那边压根没这笔交易）、还没付成功的单，最多 3 条，逐条再查一次。
  ⭐ 限流 10 次/5min + 全程 fail-open（补单失败绝不能让充值记录打不开）。
- ⭐ **判据（一句话）**：把「用户在我们关单之后才付钱」当必测用例，问一句
  「这笔钱最终会不会变成积分？」不会 → 就是事故。

# 铁律⭐⭐：加分必须有「三道幂等」+ 一条审计日志；⛔ 只靠代码里的 if 不算（2026-09-09 支付审计加）

`fulfillPaidCreditOrder` 的三道保险，缺一不可：
① `SELECT ... FOR UPDATE` 行锁（通知和前端轮询同时到达时按订单串行化）；
② 订单 `status === 'paid'` 直接返回；
③ **`CreditLedger` 的 `@@unique([requestId, kind])`**（requestId = 订单号、kind = `recharge`）——
  上面两道全被绕过时，数据库把第二次插入打回来、整个事务回滚。
⭐ 判据：迁移里真的有那个唯一索引（`CreditLedger_requestId_kind_key`，`20260522120000_credit_system`），
⛔ 别只看 `schema.prisma`。

- ⭐⭐ **必须有支付审计日志**（唯一实现 `src/lib/payment-log.ts` → `.runtime/payment-diagnostics-log.jsonl`）：
  只落库的话，**被拒的请求（验签失败、金额不符、限流）压根不留痕** —— 「有没有人在打我们的回调地址」永远查不出来。
  事件：`order-created` / `order-credited` / `order-credit-duplicated` / `order-amount-mismatch` /
  `order-closed` / `notify-received` / `notify-unverified` / `notify-throttled` / `credit-pack-settings-changed`。
  ⛔⛔ **禁止把 `sign` / 私钥 / 完整报文 / 买家账号写进这个日志。**
  ⚠️ 服务器上这个文件属主必须是 uid 1000（⛔ 别用 root 跑脚本创建它，见本文件那条 root 建日志的铁律）。
- ⭐ **金额校验只拒「少付」，不拒「多付」**（`isPaidAmountEnough`：`paid + 0.009 >= orderPayCny`）：
  订单码金额是 precreate 时写死的、付款人改不了 → 多付现实中不会发生；
  但把多付判成失败就成了"钱收了不加分"。⛔ 别改回 `Math.abs(diff) < 0.009`。

# 铁律⭐⭐：后台那种「整份覆盖」的配置接口，必须显式校验请求体是数组/对象，⛔ 别让 sanitize 的默认值把配置静默重置（2026-09-09 支付审计加）

`POST /admin/api/credit-pack-settings` 原来直接 `sanitizeCreditPacks(body.packs)`，而
`sanitizeCreditPacks(undefined)` **返回默认 8 档** → 一个空 body 就把管理员调好的价格全部重置回默认值（静默改价）。
- ⭐ **判据**：sanitize 函数「传 undefined / 传垃圾」时返回什么？返回**一份看起来合法的默认值** = 这个接口能被空请求体改掉线上配置。
  → 接口层必须 `if (!Array.isArray(body.packs)) return 400`。
- ⭐ 同源：`updateCreditPackSettings` 只改 `.env.local` 的那一行（走 `writeLocalEnvValues`），已符合本文件「只改那一个 key」的铁律。
- ⚠️ **运营红线**：为测 1 分钱把某档改成 `¥0.01`，**积分也要一起改小**（例如 0.01 元 = 1 积分）。
  改成「0.01 元 = 250 积分」并忘记改回，就是持续漏钱。测完必须改回 + 重新锁上，
  判据 = `grep credit-pack-settings-changed .runtime/payment-diagnostics-log.jsonl` 的最后一行。


# 铁律⭐⭐：本地「资产保存中」不落地，先看 `.runtime/media-save-jobs.json` 那条 job 的 `status`，⛔ 别看预览能不能播（2026-09-09 加，为此折腾一整轮）

「资产保存中」角标 = **后台 Node 把整份文件下到本机硬盘**才算完；预览页能播是**浏览器直连火山 CDN 边下边播**，两条完全不同的路。诊断唯一权威是那条 job 的 `status`（`downloading`/`failed`/`pending`/`saved`），别拿「预览能播」当「已保存」。

- 🔴🔴 **本地下跨境大视频（尤其 Seedance 2.0 4K，14MB+）的三个坑，全踩过、全修了**：
  ① **超时太短 + 整份进内存**：原 `REMOTE_DOWNLOAD_TIMEOUT_MS=3min` 一刀切、`arrayBuffer()` 整份进内存 → 4K 反复 `This operation was aborted`。
     现在视频单独 `REMOTE_VIDEO_DOWNLOAD_TIMEOUT_MS=15min` + **流式写盘**（`Readable.fromWeb(response.body)` → `createWriteStream` + `pipeline`）；图片仍 buffer（要 sharp 转码）。`STALE_DOWNLOADING_MS` 20min。
  ② **Node 内置 fetch(undici) 默认不走系统代理** → 本机在国内直连新加坡 TOS 慢到超时（用户手动下载 1 秒是浏览器走 Clash）。
     修：`local-assets.ts` 的 `getLocalMediaProxyUrl()` 读 env `LOCAL_MEDIA_PROXY`，用 undici `ProxyAgent` 传给 `safeFetch`（`ssrf-guard.ts` 的 `safeFetch` 签名已加可选 `dispatcher`）+ curl 兜底 `--proxy`。
     ⛔⛔ **`NODE_ENV==="production"` 时 `getLocalMediaProxyUrl` 恒返回 undefined**（线上腾讯新加坡直连火山本来就快，绝不能绕代理）。⛔ 别在生产 env 配 `LOCAL_MEDIA_PROXY`。
  ③ **队列定时器只活在内存 → 进程重启后 pending/downloading 任务成孤儿、永远「保存中」**（没有任何入口再 `scheduleJob` 它们）。
     修：`media-save-queue.ts` 的 `resumePendingMediaSaveJobs()`（启动把 downloading 降 pending、扫全部 pending/failed 重排），在 `generation-worker.ts` 的 `startGenerationWorker` 里 `void` 调（不 await + catch，遵守「往 worker 加活儿要隔离」铁律）。
- ⭐ **本地要下大视频，`.env.local` 必须有 `LOCAL_MEDIA_PROXY=http://127.0.0.1:7897`**（Clash 混合端口）。判据：`curl 127.0.0.1:7897` 返回 **400** 而不是超时 = 端口对。没配就会一直卡「保存中」。
- ⭐ **卡住的任务怎么手动救**：把那条 job 的 `status` 改回 `pending`、`nextRetryAt=Date.now()`，重启 dev（启动自恢复会捡它）。⛔ 别指望前端轮询触发——那条 url 可能已不在当前对话的轮询列表里。

# 铁律⭐⭐：探「上游支持哪些分辨率/时长」用**必被拒的值**让错误文案自己报，⛔ 别用刚好合法的值（那会真建任务真花钱）（2026-09-09 加）

2026-09-09 要确认 Seedance 2.0 是否支持 4K、2.5 是否支持 1080p。姿势：POST `/contents/generations/tasks` 时把
**`duration` 设成 `1`（所有 Seedance 都非法）**、分辨率设成待测值：
- 报「**duration** 非法」= 分辨率这一档**过了**（上游先校验分辨率通过了才轮到时长）；
- 报「**resolution** 非法」= 这一档**没开**。
实测坐实：**Seedance 2.0 = 480p/720p/1080p/4K（4K 独有）；2.5 = 480p/720p/1080p**（1080p 与 2.0 同像素表）；Fast/Mini 只有 480p/720p。

- ⭐ 同源于本文件「探测上游硬上限只用必被拒的值」——2026-08-09 曾用「刚好等于上限」的 30.2 秒探，结果**真建了任务、真花了钱**。
- ⭐ 官方文档是 JS 渲染的 SPA，`webfetch` 直接抓拿不到正文；套 `https://r.jina.ai/<url>` 才拿到「Set video output specifications」那张分辨率/像素表。
- ⚠️ 补新分辨率档要同步四处：`videoModelRules` 的 `resolutions` + `sizes` 像素表 + `nonStandardSizes` + `estUsdPerSecondByResolution` 预估（⚠️ 没有真实扣费数据时按 token∝像素粗估，标注待回校）。

# 铁律⭐⭐：读 `generationMeta.originalPrompt` / `itemPrompts` / `message.videoPrompts` 一律要回落到 `message.content` —— 下行投影会在它们等于 baseline 时删掉（2026-09-05 抓到，失败任务点「重新生成」没反应）

服务端下行投影 `projectWorkspaceMessageForClient`（`src/lib/workspace-sessions.ts:444`）为瘦身，会在
`generationMeta.originalPrompt === message.content`（或 `itemPrompts` 每项 = baseline、`videoPrompts` 全 = baseline）时
**把这些字段删掉**，约定前端读不到就从 `message.content` 回落。

- ⛔ **2026-09-05 真事故**：`retryFailedMedia`（`chat-workbench.tsx:7978`，图片+视频失败卡「重新生成」共用它）
  只读 `meta.originalPrompt`、**没回落 content** → 刚生成时内存有值能重试，**一刷新/重进对话，originalPrompt 被投影删掉
  → `prompt="" → if(!prompt) return` → 点了没反应、也不报错**（最难查，因为没有任何错误、且首次生成那次是好的）。
  同一个坑还有 `getAgentMediaPromptItems`（`chat-workbench-core.tsx:2689/2692/2703`，Agent「使用提示词」面板刷新后取不到词）。
- ⭐ **判据（一句话）**：grep `originalPrompt` / `itemPrompts` / `videoPrompts` 的每个读取点，
  回落链**必须最终落到 `?? message.content`**。少这一环 = "首次好、刷新后坏"的隐形 bug。
- ⭐ **配对完整性**：PUT 侧恢复函数 `restoreProjectedMessageFields`（`workspace-sessions.ts:333`）对三类字段都恢复了，
  是**读取方漏回落**、不是投影/恢复配对的问题。新增读取点时照抄现有的正确回落（如 `replayMessage` 7848、复制/预览那几处）。
- ⭐ **验法（二值、零成本）**：进一条失败任务 → **刷新页面**（关键：制造"内存里没值"的场景）→ 点「重新生成」，
  必须有反应（失败卡变「X%生成中」）。⛔ 别只在刚生成后测（那时内存有值、测不出）。

# 铁律⭐⭐⭐：停用一个子系统时，**"读判定"和"写库"是两回事** —— 必须把所有会写库的入口单独数一遍（2026-09-05 审计抓到，会员关了还在扣用户积分）

2026-09-05 审「会员保留但隐藏」这一批：总开关 `MEMBERSHIP_SYSTEM_ENABLED = false` 把
**读判定**全挡住了（能不能用某模型/画质/并发、发不发月积分），但
**结算/发放/作废这几个会写库的函数一个都没挡**。而 `getActiveMembershipTier()` 在关闭时恒返回 `"free"`
→ `settleMembershipCredits()` 把**所有人当成"会员已过期"**：
① 有 `membershipParked*` 记录的会被**"恢复"成会员并发一笔积分**；
② `membershipCredits > 0` 的会被**从 `User.credits` 里真扣掉**并记一条"作废"流水。
而它的调用方 `/api/membership/quote` 是**任何登录用户都能 GET** 的接口。

- ⭐ **判据（一句话）**：把这个子系统里**所有会 `UPDATE` / `INSERT` 的函数**列出来，逐个问
  「总开关关着时它被调到会发生什么」。⛔ 别只看拦截函数（`canXxxUse` / `shouldEnforceXxx`）——
  那些只决定"许不许用"，不决定"会不会动数据"。
- ⭐ **最阴的形态是"关闭状态被当成某个业务状态"**：本次"会员关闭"被代码理解成"人人已过期"，
  于是"过期清算"这条路径对全站用户生效了。**凡是用一个枚举值（free / 空 / 0）同时表示
  "功能关闭"和"某种真实业务状态"的，都要单独确认这两种含义不会串。**
- ⭐ **正解**：在**写函数自己的顶部**加 `if (!ENABLED) return`（第一道），
  再把只服务该子系统的接口整体 403（第二道）。⛔ 别只在调用方加判断——将来多一个调用方就漏。
- ⚠️ 本次没爆是因为生产库那两个字段还全是 0/空（列刚加）。**"现在恰好没数据"不是安全，是运气。**

# 铁律⭐⭐⭐：为演示/预览造的假数据，**绝不许出现在真实用户点得到的界面上**（2026-09-05 抓到，差点上线）

`getDemoRechargeHistory()` 给三个邮箱（`12424740@qq.com`、**`lookxun@163.com` ← 用户自己的号**、
`176107103@qq.com`）写了硬编码的假充值订单（"C2026082011062290 · ¥200 → 1800积分"这种），
本来只是给后台「用户充值」列表做演示。但**新做的积分充值页也读同一个接口** →
上线后这三个号点「充值记录」就会看到**从没发生过的充值**。

- ⭐ **判据（一句话）**：这份假数据的入口，**普通用户点得到吗？** 点得到 = 事故（尤其是钱相关的）。
- ⭐ **正解**：在**接口层**按环境切（`process.env.NODE_ENV === "production" ? 空 : demo`），
  而不是删掉演示数据 —— 后台那份是服务端组件直接调 lib、不走这个接口，只有管理员看得到，可以留。
- ⭐ **验法是二值的**：上线环境用真实账号点开那个界面，必须是"暂无记录"，同时 `fetch` 那个接口返回 `[]`。
  ⛔ 别只看代码，本次正是因为真走了一遍界面才发现测试号 `12424740@qq.com` 也在演示名单里。

# 铁律⭐⭐：横在全站关键路径前面的「闸门」必须 fail-open —— 只有业务判定才许拒绝（2026-09-05 加）

`reserveGenerationQuota` 是**图片/视频/语音生成的第一道**，依赖一张新表 `GenerationReservation`
+ `pg_advisory_xact_lock`。原来它直接 `await` 整个事务：**迁移没跑 / 连接抖动 / 锁报错 = 全站生成 500**。

- ⭐ **正解**：`try { 事务 } catch { if (是业务错) throw; 写一条诊断日志; return false }` ——
  只有「并发上限」「积分不足」这两个**业务判定**才允许把用户请求拒掉，
  其它任何异常一律**放行**（后面还有 `assertUserCanUseCredits` 和真实扣费兜着）。
- ⭐ **判据**：问一句「**这段代码自己坏了，会不会连带把主功能停掉？**」会 → 必须 fail-open。
  同源于本文件那条「往常驻 worker 的 tick 里加活儿」——都是"寄生在关键路径上的新逻辑"。
- ⭐ 配套：fail-open 之后要有**可观测性**（本次 `generation-quota-gate-failed` 事件），
  否则闸门静默失效没人知道。判据：`grep -c 'generation-quota-gate-failed'` 必须是 0。

# 铁律⭐⭐⭐：定价/预估这类数字，**必须从真实扣费数据统计**，⛔ 不许用文档价、菜单价或"宁高不低"的直觉（2026-09-05 把最大偏差从 399% 打到 3%）

用户说「预估要尽量准」。我没调参数，而是去**正式服 `CreditLedger`** 把真实扣费拉出来
（图片 5791 条 / 视频 4206 条），按 `模型 × metadata->>'resolution'` 算 avg/p90/p99。一量就发现**两个反向错误**：

- ⛔⛔ **视频每秒单价只有一个数（720p 基准），而它随分辨率差 6 倍**：
  实测 Seedance 2.0 → 480p `0.071` / 720p `0.155` / **1080p `0.386`**（按 token 计费，token ∝ 像素）。
  → **480p 估高 2 倍（把选最便宜档的用户拦住）、1080p 估低 3 倍（等于没拦，照样亏）**。
- ⛔ **拿不到时长时按"该模型最长档"估**，而上游侧兜底是 **5 秒** → Seedance 2.5 上差 **6 倍（+399%）**。

- ⭐⭐ **这条最值钱的启发**：**如果只按"宁高不低"的直觉往上调，480p 会被拦得更死，而 1080p 那个洞还在。**
  "偏高"和"偏低"可能**同时存在于同一个模型的不同档位**，只有量真实数据才看得见。
- ⭐ **取 p99 填表**（不是均值、也不是 max）：估低了等于没拦；max 里混着异常样本（时长 metadata 与实际不符）。
- ⭐ **重新统计的 SQL 已写进 `05-next-actions.md`**（供应商调价 / 接新模型后要回校）。
- ⭐ **唯一权威**：`models.ts` 的 `estUsdByResolution`（图片）/ `estUsdPerSecondByResolution`（视频），
  **只被 `getEstimatedGenerationUsd` 读**。
- ⭐⭐ **一张表两个读者时，加字段而不是改字段**：菜单副标题（界面上的「X积分/张·秒」）继续读老字段
  `usd` / `usdPerSecond` → **界面文案一个字没变**，回归里逐条断言了 hint 字符串。
  ⛔ 别图省事把菜单也切到实测价 —— 那是改用户看得到的报价，要单独找用户拍板。
- ⭐⭐ **"事前预估"和"真正发给上游的参数"必须是同一个函数算的**：
  以前预估按最长档、`openrouter-video.ts` 的 `getDuration` 按 5 秒兜底 —— 两份逻辑必然对不上。
  已收敛成 `models.ts` 的 **`getEffectiveVideoDurationSeconds`**，`getDuration` 变成它的薄封装。
- ⭐ **预估用的分辨率必须归一化**（`resolveImageSettingsForModel` / `resolveVideoSettingsForModel`），
  和本文件那条「按档位限制画质要校验归一化后的真实档位」是同一个坑。
- ⭐⭐ **验收必须端到端**：45 条纯函数回归（含 98 组"时长与改前逐个相等"）**+ 真跑一条最便宜的**
  （视频 480p/5秒：预估 13 / 实扣 12；图片 2K：预估 2 / 实扣 2）。
  ⭐ 读 `GenerationReservation.estCredits`（在跑时）再对 `CreditLedger.credits`（跑完后）—— 这是最硬的判据。

# 铁律⛔⛔：Windows 打部署包**别用 `tar -T 清单文件`** —— 自带 bsdtar 会静默漏掉一半条目（2026-09-05 踩到）

`tar -czf x.tgz -T 清单.txt`（bsdtar 3.8.8）：**58 条清单只打进 29 个文件，而且不报错**
（还伴随一堆 `Couldn't visit directory:` 的空名条目）。这种包推上去就是"上线当场 404 / 功能缺一半"。

- ⭐ **正解（已固化成 `.runtime/pack.js`）**：用 node 按清单**把文件复制到 `.runtime/pkg/` 保持相对路径**，
  再 `tar -czf ../x.tgz .` 打**整个目录**；打完 `tar -tzf | 数文件数`，**必须等于复制的文件数**，不等就 exit 1。
- ⭐ **部署清单必须是 `git status --short -- src prisma`** —— 只取 `src` 会漏掉 Prisma 迁移，
  而本批漏了迁移 = `GenerationReservation` 表不存在 = **图片/视频/语音全部 500**。
- ⭐ 解包后立刻在服务器上 `grep` 断言：**本次新增的字符串字面量必须命中、被删掉的旧实现必须为 0**
  （本次查了 `estUsdPerSecondByResolution`、`1080p": 0.458`，以及旧的 `getMaxVideoDurationSeconds` = 0）。

# 铁律⭐：`BlackHoverTooltip` 那种「JS onMouseEnter + portal」对 **disabled 按钮照样有效**（2026-09-05 实测，别再怀疑）

把 tooltip 从 CSS `group-hover` 改成 JS `onMouseEnter` 后，我怀疑
「Chrome 不给 disabled 元素派发鼠标事件 → 包在外层 span 上的 handler 收不到」，
差点为此改代码。**用 Playwright 造最小用例实测：hover 一个 `disabled` 按钮，
外层 span 的 `pointerenter` / `mouseover` / `mouseenter` 全部照常触发。**

- ⭐ **判据**：`page.setContent` 造 `<span onmouseenter><button disabled></span>` → `page.hover('#btn')`
  → 读 `window.hits`。几秒钟、二值、没有解释空间。
- ⭐ 通用启发：**"我记得某浏览器有个坑"不是证据** —— 这类浏览器行为疑问一律现场造最小用例实测，
  比读文档/凭记忆改代码快得多也可靠得多（本次省掉一次无谓改动）。


# 铁律⭐⭐⭐：改 `.env.local` 只许改那一个 key，整份重写 = 密钥被冲掉（2026-08-31 加）

2026-08-31 第一百零一次为对齐会员默认，用 node 改 `.env.local` 的 `MEMBERSHIP_SETTINGS`，
整份重写 → 本地 `BYTEPLUS_API_KEY` 被写成空、`BYTEPLUS_API_KEY_ENABLED=false`；
`OPENROUTER_API_KEY` 被写成旧的。后台「模型开关」看起来像 BytePlus API 消失了。
用户自己从测试服/正式服把密钥调回来。

- ⭐ **`.env.local` 里同时躺着密钥和业务配置**（OPENROUTER / BYTEPLUS / MEMBERSHIP_SETTINGS / 上传规则…）。
  改会员配置 ≠ 可以动 API key。
- ⭐ **正解**：读整份 → **只替换目标那一行** → 写回。写完立刻断言
  `OPENROUTER_API_KEY` / `BYTEPLUS_API_KEY` 的**长度没变、不是空**。长度变了 = 立刻停手、从备份/测试服拷回来。
- ⛔ **禁止**整份 `writeFile` 覆盖、禁止 PowerShell `Set-Content`。
- ⛔ **后台「模型开关」点保存会把两个 API key 一起写回去**。BytePlus 输入框是空的再保存 = 密钥被写成空。
  只改会员用 `updateMembershipSettings`（只写 `MEMBERSHIP_SETTINGS` 那一行），别走模型开关那次全量保存。

# 铁律⭐⭐：代码里出现 `slice(0, N)` / `.filter(...).slice()` 砍用户素材，就必须去 `upload-rules.ts` 把 N 配上（2026-08-19 加）

2026-08-19 审 Recraft 接入时抓到：`generateRecraftImage` 里写了 `referenceImages.slice(0, 1)`（上游只吃 1 张），
但 **`getBaseUploadRule` 里没给 Recraft 分支** → 落进 fallback 的 **3 张** →
**用户能选 3 张、界面显示"最多3张"、实际只发 1 张，多的 2 张被静默丢掉**，界面上一点提示都没有。

- ⭐ **判据（一句话）**：**底层砍到 N，规则层是不是也是 N？** 不是 → 那个差额就是"静默丢用户东西"的量。
  grep 姿势：`slice(0,` / `.slice(0, 1)` / `Math.min(` 出现在"参考图/参考视频/音频/文档"链路上，都要回头查规则层。
- ⭐ **修的位置永远是 `src/lib/upload-rules.ts` 的 `getBaseUploadRule`**（唯一权威）——
  改一处，对话流 / 资产库 / 工作流 / 服务端 `/api/image`（它也调 `validateReferenceImageCount`）**一起生效**。
  ⛔ 别在组件里判、也别只在底层 slice。
- ⭐ **上游硬上限要实测坐实、别读文档猜**（本次：传 2 张 → 400
  `Recraft: input_references: must have between 0 and 1 items`）；**探测只用必被拒的值**（免费）。
- ⭐ **两个零成本判据**：① 界面上上传按钮的数字（工作流节点会直接显示「图片 **1**」）
  ② 直调接口发 N+1 张 → 必须被我们自己的校验拒（400「当前模型最多支持 N 张参考图」），**不花一分钱**。

# 铁律⭐⭐：把某个选项改成「按模型给」时，必须把**该选项的所有菜单入口**数一遍（2026-08-19 加）

同一批 Recraft 改造里，上一任把「图片比例」改成按模型（新增 `ImageModelRule.ratios`），
改了**用户设置下拉 / 加载时的 merge / 工作流节点**三处，**漏了最主要的那个** ——
`chat-workbench.tsx` 的 `renderImageSettingsMenu` 里
`currentRatioOptions = mode === "video" ? [...] : ratioOptions`（**对话流和资产库共用的主输入框菜单**）。
后果：用户能选 21:9，而 `generateRecraftImage` 把不支持的比例映射成 `aspect_ratio:"auto"`
→ **出图比例和他选的不一样，且没有任何提示**。

- ⭐ **判据**：`grep` 那个**全局选项常量**（本次 `ratioOptions`），把每个引用点逐个看
  「这里该不该换成按模型的版本」。⛔ 别只改你正在看的那个组件。
- ⭐ **别忘了"存过的旧值"**：老账号的 `defaultImageRatio` 可能存着新模型不支持的值 →
  **加载 profile 时**和**新建对话套用默认参数时**都要 `normalizeXxxForModel` 归一化
  （只在"切模型"那一刻归一化是不够的）。
- ⭐ **反向用例必须有**：改完要证明**别的模型一个字都没变**（本次 35 条回归里 12 条反向：
  Gemini 仍含 21:9、GPT 仍 16 张、Seedance 2.5 仍 30 张…）。

# 铁律⭐⭐：基础 class 写死 `relative` 的组件（如 `BlackHoverTooltip`），**别再通过 `className` 传 `absolute` 定位**（2026-08-20 加，资产库失败卡「重新生成」按钮不居中）

`BlackHoverTooltip`（`black-hover-tooltip.tsx:55`）根节点写死 `relative inline-flex`，而 `chat-workbench.tsx` 那处
把居中样式 `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` 通过 `className` 传进去。
⛔ **同时出现 `relative` 和 `absolute` 时，Tailwind 生成的 CSS 里 `relative` 排在 `absolute` 后面 → `relative` 必赢**
（跟 class 属性里的先后顺序无关，只看 CSS 源序）→ 外壳变成 `position:relative`、`left-1/2` 那套居中静默失效，
按钮被顶到偏右下。

- ⭐ **判据（一行、二值）**：`getComputedStyle(el).position` —— 造一个 `<div class="relative inline-flex absolute left-1/2 ...">`
  实测它是 `relative` 就坐实了（本次就是这么验的，⛔ 别靠肉眼看偏没偏）。
- ⭐ **正解（不动共享组件）**：在调用处**外面套一个带定位类的 div**（`absolute left-1/2 ...`），
  让 `BlackHoverTooltip` 保持它的默认 `relative`（它是 absolute 还是 relative 都能给 tooltip 气泡当定位上下文）。
  ⛔ 别去改那个"全站唯一实现"组件的基础 class（其它调用点都靠它默认的 `relative`，改了有连带风险）。
- ⭐ 同源于本文件那条「tldraw 无 layer 规则永远赢过 @layer」——**位置/优先级问题先想"谁在 CSS 里更靠后/更高优先"，别怀疑类没生成**。

# 铁律⭐：本地测「被地区限制的模型」= 带 `NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY` 重启 dev（Node 24，2026-08-20 加）

本地直连 GPT-5.4 Image 2 出图报 **(B_243) 当前模型在你的地区不可用** —— 上游按出口 IP 地区限制。
⛔ **光开 Clash 系统代理没用**：Node 内置 fetch（undici）默认**不认**系统代理 / `HTTP_PROXY` 环境变量。
- ⭐ **解法（无需改代码）**：带代理环境变量**重启 dev 服务**：
  `$env:HTTPS_PROXY="http://127.0.0.1:7897"; $env:HTTP_PROXY="http://127.0.0.1:7897"; $env:NODE_USE_ENV_PROXY="1"` → `npm run dev`。
  `NODE_USE_ENV_PROXY=1` 是 Node 24 让内置 fetch 走环境变量代理的开关；7897 是本机 Clash Verge 混合代理端口
  （判据：`curl 127.0.0.1:7897` 返回 **400** 而不是超时 = 端口对）。
- ⚠️ kill 旧 dev 会换 PID、重启后需重新登录一次；纯本地临时操作、不动代码。

# 铁律⭐⭐⭐：「按档位限制画质」必须校验**归一化之后真正会用的那一档**，不是用户请求的那个值（2026-08-30 审计抓到两个真绕过）

会员画质校验原来写的是 `canMembershipUseVideoResolution(tier, body.settings?.resolution)` ——
只看**客户端请求的分辨率**。但模型规则表 `resolveXxxSettingsForModel` 会把**该模型不支持的档位抬到它自己的默认档**，
于是「请求 720p / 干脆不传」在只有高档位的模型上会变成高档位：

- `minimax/hailuo-3` 只有 **2K** 一档 → 基础会员（上限 720p）传 720p 或不传，**实际出 2K**（最贵的那档）；
- `kwaivgi/kling-video-o1` 只有 **1080p** 一档 → 标准会员（上限 720p）传 720p，**实际出 1080p**。

⛔ **只校验请求值 = 等于没校验。**
- ⭐ **判据（一行）**：拿 **`resolveVideoSettingsForModel(model, settings).resolution`**（图片同理 `resolveImageSettingsForModel`）
  去比会员白名单，⛔ 不是拿 `settings.resolution`。唯一实现 `src/lib/membership-guard.ts`。
- ⭐⭐ **`ratio` 必须一起传进来**：`resolveImageSettingsForModel` 里
  **`isSmartRatio = !settings?.ratio || settings.ratio === "智能比例"`** —— **不传 ratio 就被当成智能比例**，
  这条分支**直接用 `rule.defaultResolution`、完全忽略请求的分辨率**。
  ⚠️ 我写回归用例时忘了传 ratio，于是「free 要 4K」被放行，一度以为拦截失效（实际是用例错）。
  → **测这类校验，ratio 必须给具体值；另外单独补一条「智能比例」的用例。**
- ⭐ **配套的一致性判据**：某个档位被允许用某模型，但**该模型的所有档位它一个都不许用** → 这是配置自相矛盾，
  界面上会出现「分辨率下拉是空的」，服务端则会静默抬档。发现这种组合要么给档位加那一档、要么把模型从该档位移走。
- ⭐ **同源提醒**：`nonStandardSizes` / `defaultResolution` 这类"模型自己的兜底"都会让"用户选的"和"实际用的"不一致，
  凡是**按用户选择做限制/计费**的地方，都要先归一化再判。

# 铁律⭐⭐⭐：「先查再放行」的限制一律是假的 —— 并发/额度必须在**同一个事务 + per-user 咨询锁**里判（2026-08-30 修）

`assertMembershipConcurrencyAllowed` 原来是「`count` 在跑的任务 → 大于上限就抛错」。
⛔ **20 个请求同时打进来，都 count 到 0 → 全部放行** → 基础会员「同时生成 1 条」形同虚设。
配合另一个洞（积分只判 `> 0`），**剩 1 积分的号能同时开一堆贵任务，把余额刷成负几千** —— 真金白银的损失。

- ⭐ **唯一正解 = `src/lib/generation-quota.ts` 的 `reserveGenerationQuota`**：
  一个事务里 `SELECT pg_advisory_xact_lock(hashtext(userId))` → 数在跑的（`GenerationJob` ∪ `GenerationReservation`，
  **按 requestId 去重**）→ 校验并发 → 校验 `余额 >= 在跑预估 + 本次预估` → 插占位。
  咨询锁按用户串行化、事务结束自动释放、**跨进程有效**（多实例也挡得住）。
  ⛔ **别把删掉的 `assertMembershipConcurrencyAllowed` 捡回来。**
- ⭐⭐ **"占位"必须有 `expiresAt` 兜底（本项目 30 分钟）**：进程崩了没释放也会自己过期 ——
  **绝不允许出现"用户被永久卡住不能生成"**。这比"少拦一次"严重得多。
- ⭐⭐ **闸门要放在「真正花钱之前」那一步**：`/api/video` 是**先打上游建任务、再 `createVideoJob`**，
  所以不能等建 job 的事务里才判（那时钱已经花了）。⭐ 判据：**从闸门到"上游被调用"之间不许有花钱动作**。
- ⭐ **占位释放三个点**：异步 job → `markJobSucceeded` / `markJobFailed` 里；同步接口（语音、工作流编辑）→ 路由 `finally`。
  漏一个就是"用户后面被莫名拦住直到过期"。
- ⭐ **事前预估只用来"判够不够"，⛔ 不是扣费**（扣费永远按上游 usage）。
  唯一实现 `getEstimatedGenerationUsd`（`models.ts`）：**取上限价**（有 `usdHigh` 用它）、视频拿不到时长按最长档估、
  **表里没有的模型返回 0 = 不做限制**（不认识的模型不许连带把正常用户拦死）。

# 铁律⭐⭐：加「第二种余额」之前先数一遍有多少地方在读余额 —— 能做成子标记就别开新池子（2026-08-30 会员积分）

用户要求「扣费顺序：会员赠送的积分先扣，自己买的永久积分后扣」。
⛔ 直觉做法是开两个余额字段，但全站有十几处读 `User.credits`（`assertUserCanUseCredits`、额度闸门、
后台统计、用户中心、积分流水…），**漏一处就是"有分花不出去"或"能花出不存在的分"**。

- ⭐ **正解（已实现，唯一权威 `src/lib/membership-credits.ts`）**：
  `credits` 仍是**唯一总余额**（所有调用方一行都不用改），`membershipCredits` 只是
  「这总余额里**属于赠送**的那部分」的**子标记**。
  - 发放 → `credits += N` 且 `membershipCredits += N`
  - 扣费 → `credits -= n` 且 **`membershipCredits = GREATEST(0, membershipCredits - n)`** ← 赠送分天然先被花完
  - 过期/换档 → `credits -= 剩余 membershipCredits`（作废）+ 记一条流水
- ⭐ **周期性发放用「懒触发」，⛔ 别挂常驻 worker 的 tick**（本文件另有铁律：往 tick 里加活儿会把全站生成拖停）。
  本项目挂在 `reserveGenerationQuota` 和充值页报价接口里顺手结算；久没来会补发、**最多补 24 期**（别无上限循环）。
- ⭐ **"改档位/到期/实付"要收敛成一个入口**（`applyMembershipPurchase`），支付回调也走它，
  否则换档时"作废上一档赠送分 + 重置发放周期"这些步骤一定会被漏掉。

# 铁律⭐⭐：界面上写了「每帐号1次」「限时」「仅新用户」，代码里就必须有记录去拦（2026-08-30）

充值页底行一直写着「(每帐号1次)」，但 `getFirstMonthDiscount` **一次都没校验过** ——
到期重买还是 5 折，可以无限循环；而且包月/包季/包年**各自**还能再享一次。

- ⭐ **判据（一句话）**：文案里的每一个**限定词**（次数、时间、人群），去代码里找**对应的那个字段/记录**。找不到 = 这句话是假的。
- ⭐ 本项目实现：`User.membershipDiscountUsed String[]` 存的是档位 `standard` / `pro`，
  `canUseFirstPeriodDiscount(period, current, settings, tier)` **按档各一次**（标准和高级互不影响；某一档月/季/年任选用过一次，这一档不再打折）。
  ⭐ 报价函数返回 `discountApplied`，**界面上那个「首月x折」金色标签必须读它**，⛔ 别再直接读 `getFirstMonthDiscount`（那样折用完了标签还在）。

# 铁律⭐⭐：钱只能在服务端算 —— 前端算好的金额一律不许直接写进账（2026-08-30）

升级要付多少、积分包能拿多少积分，原来**只在前端算**。接支付时若直接信客户端传来的金额，
**用户改一个数就能 1 块钱买年卡**。

- ⭐ **唯一权威 = `GET /api/membership/quote`**（服务端用 `getMembershipUpgradeQuote` / `getCreditPackCredits` 算），
  充值页打开时拉一次、前端只显示；本地那份只当"还没拉到"时的占位。
- ⭐⭐ **支付回调落库时必须再复算一遍**，⛔ 绝不允许把请求体里的 `payCny` / `credits` 直接入账。
- ⚠️ 过 JSON 之后 `Date` 会变字符串 → 前端类型要用 `Omit<Quote,"newExpiresAt"> & { newExpiresAt: string }`，
  别照 `Date` 用（tsc 不会替你发现，因为服务端类型是 Date）。

# 铁律⭐⭐：折算「旧套餐剩余价值」必须用**当时实付**，缺记录时按**最低可能价**回落（2026-08-30）

升级补差价 = 新档标价 − 旧档剩余价值，而旧剩余价值 = **实付** × 剩余天数 ÷ 周期天数。
⛔ **不能用标价**：用户首期打过 5 折，按标价折算就把他没花过的钱退给他。

- ⭐ 所以库里存了 `User.membershipPaidCny`（迁移 `20260830010000_membership_paid_cny`）。
- ⭐⭐ **老数据是 0（没有实付记录）时，回落成「最低可能价」= 首期折后价，⛔ 不是标价**。
  宁可少抵一点（用户可申诉、我们不亏），也绝不多抵。同理 `Math.min(paid, listPrice)` 夹一层，防脏数据。
- ⭐ **"只升不降"要两个维度一起判**：`标准包年 → 高级单月` 是「档升了但周期降了」，必须拒 ——
  否则用户能用一次"升级"把包年偷换成单月。单月与包月**同级**（都 1 个月），互相不算升级也不算降级。

# 铁律⭐⭐：下线一个模型 = 菜单删掉 + 服务端硬拒 + 默认值改掉（2026-08-30 下线 4 个视频模型）

只从 `videoGenerationModels` 里删掉是不够的：**老对话、老工作流节点、老 `.env.local` 配置里还存着那些 id**，
直接打接口照样能跑（还会真花钱）。

- ⭐ **三件套**：① 从模型清单删 ② **`RETIRED_VIDEO_MODEL_IDS`（`system-settings.ts`，唯一权威）**
  让 `isConversationVideoModelEnabled` 返回 false，且 `/api/video` 入口直接拒「该模型已下线」
  ③ 把它相关的规则/价格/时长/上传规则/后台面板全清掉。
- ⛔⛔ **小心 `DEFAULT_XXX = 列表[0]` 这种写法**：删了前几个模型，默认值会**静默变成另一个模型**。
  本次 `DEFAULT_VIDEO_MODEL` 原来是 `videoGenerationModels[0]`，删完第一个变成 **MiniMax H3（只有 2K、最贵）**，
  而它同时是 `fallbackVideoModelRule`（未知模型的回落规则）→ 基础会员一进来就撞画质墙。
  **已改成写死 `byteplus:video.seedance-2-0-fast`**，⛔ 别改回下标写法。
- ⭐ **历史资产的显示名要保留**：`media-asset-record.ts` 里那张 id→名称表**不要删下线模型的条目**，
  否则老视频在资产库里会显示成一串裸 id。
- ⭐ 判据：`grep` 那 4 个 id，**逐个文件确认"该删的删了、该留的（历史显示名）留着"**。

# 铁律⭐：`edit` 工具插新代码时 `oldString` 必须带足够上下文（2026-08-30 一次会话里插错两次）

用 `};\n\n` 这种**极短的 oldString** 去"在某个常量后面插一段"，会匹配到**文件里另一处同样的片段**：
本次一次插进了 `system-settings.ts` 的**函数体中间**（`const` 卡在 `}` 和 `return` 之间）、
一次把 `admin-membership-panel.tsx` 的 **`useEffect` cleanup 切断**（`return () => { cancelled = true;` 后面的 `};\n }, []);` 被吃掉）。

- ⭐ **判据**：oldString 里至少包含**一个该文件独有的标识符**（变量名/函数名/中文注释），别只用括号和空行。
- ⭐ 插完**立刻 `read` 那一段确认位置对**，⛔ 别等 `tsc` —— 这两次里有一次 `tsc` 是过的（const 在使用点之后声明，
  运行时才炸），从报错完全看不出插错了地方。

# 铁律⭐⭐：Tailwind 的 `grid-cols-[...]` / 任意值 class **绝不能用模板字符串/变量拼**（2026-08-18 第六十六次会话，用户截图报"界面出问题"）


Tailwind 只把**源码里静态出现的完整 class 字面量**编进 CSS。你写
`` `grid-cols-[130px_...${cond ? "_80px" : ""}]` `` 这种**拼出来的 class**，扫描器看不到 →
**那条 CSS 根本没生成** → grid 回落成默认单列 → **整张表塌成一列、每个格子竖着堆**。
- ⛔ 2026-08-18 真事故：我把后台内容审核 `EventTable` 的 `grid-cols-[...]` 从写死字面量改成模板拼接 → 表格塌了。
  原代码本来就写死几个完整字面量，正是为了避这个坑。
- ⭐ **正解**：每种列组合**各写死一个完整字面量**，用 `cond ? "完整A" : "完整B"` 选，⛔ 别用 `` `...${}...` `` 拼。
  适用于一切任意值 class（`grid-cols-[...]` / `w-[...]` / `h-[...]` / `bg-[#...]` 等动态部分）。
- ⭐ **判据**：class 里有 `${` 或变量插值 = 危险信号；本地/测试服看着对不代表安全（dev 有时把用过的类缓存进来），
  但**换一种组合、或干净构建就会缺**。要么写死字面量，要么把所有可能值写进 `safelist`。

# 铁律⭐⭐⭐：**现象相似 ≠ 根因相同** —— 上一次事故的根因会造成路径依赖，把你带到完全错的方向（2026-08-09 第六十一次会话，被用户一句话问倒）

2026-08-09 用户报「测试服顶部公告：后台写的是『新增』，前台显示『新建』」。
这和**前一天**那起正式服事故（公告显示旧文案 → 根因是响应缺 `Cache-Control`、被透明代理缓存）**现象几乎一样**，
于是我照着下面那条 no-store 铁律去查，得出结论「用户链路上还存着修复上线前缓存的旧副本」。
🗣️ 用户一句话直接问倒：「**问题我测试服里是第一次发这条公告。。哪来的缓存？**」

- ⛔⛔ **这个反问是决定性的**：缓存假说要求"以前存过这条内容"，而这是**首次发布** → 假说自相矛盾、当场作废。
  真凶完全在另一头：**简繁转换在改字**（详见下一条铁律）。
- ⭐⭐ **判据（写在动手前）**：**我的假说要求什么前提？那个前提在这次的场景里成立吗？**
  「缓存」要求"这条内容以前存在过"；「竞态」要求"有两个东西在抢"；「权限」要求"身份变过"……
  **先证明前提，再查证据。** 前提不成立就立刻换方向，⛔ 别为自己的假说找补。
- ⭐ **最危险的时刻 = 刚修完一个相似 bug**：交接文档里那条崭新的铁律会让你产生强烈的路径依赖，
  **越"熟悉"越容易错**。这类时候要**强迫自己再列 2~3 个候选根因**（本次正确答案压根不在缓存这一族里）。
- ⭐⭐ **用户拿业务事实推翻你的技术推理时，他往往是对的**（"第一次发"、"能打字就说明加载完了"都是这种）。
  **先认真验他的理由，再谈自己的推理。**（同源于本文件「用户的物理常识往往比我的代码推理更硬」那条。）
- ⭐ 顺带一个**很强的排除手法**：把"接口/数据库返回的内容"和"用户屏幕上看到的内容"**分别取证**。
  本次接口与库里**全都是正确的「新增」**，而 DOM 里是「新建」→ 一步就把范围锁进"浏览器端渲染后被改字"，
  彻底排除了链路/缓存/服务端那一整族原因。

# 铁律⭐⭐⭐：**简体中文是本项目的源语言 —— 简体模式下禁止做任何「繁→简」字词替换**（2026-08-09 加，公告改字事故根因）

`src/lib/chat/chat-workbench-core.tsx` 的全局简繁转换（`applyDocumentLanguage`）历史上这么写：
`globalSimplifiedPhrases`（繁→简表）= 把 `globalTraditionalPhrases`（简→繁表）**机械反转** `.map(([f,t])=>[t,f])`。
⛔ **反转不是无损的**：简→繁那侧有 `["新建" → "新增"]`（繁体/台湾习惯用「新增」表示「新建」），
反转后就成了 `["新增" → "新建"]`；而简体分支对**每个文本节点**都跑 `convertTraditionalToSimplified`
→ **默认简体用户页面上任何「新增」都被静默改成「新建」**（真实事故：顶部公告被改字，用户以为后台没保存）。

- ⭐ **唯一正解（现已实现）**：简体分支**只还原"我们自己存进 WeakMap 的原文"**
  （`originalTextNodeValues` / `originalAttributeValues`）；**没存过 = 我们从没转过它 = 它本来就是简体 → 原样不动**。
  ⛔⛔ **禁止再加回任何"繁→简"转换函数/词表**（那两张反向表和 `convertTraditionalToSimplified` 已删除）。
- ⭐ **为什么这样才对**：繁体模式下每个被转换的节点都存了原始简体文本（含 MutationObserver 新增的）
  → 切回简体时**那份原文才是权威**，压根不需要拿有损词表去"猜"。
- ⭐⭐ **验这类"改字"只能用确定性判据，⛔ 别靠刷页面**（简体分支**不装 MutationObserver**，
  改字与异步渲染是**竞态** → 刷新有时对有时错，旧代码会碰巧显示正确）：
  **切繁体 → 再切回简体**（旧代码走这条路**必错**）。判据两条：目标词还在 + 其它词完整还原（视频↔影片）。
  ⭐ 再加一条旁证：**我们自己的界面文案（如「新建工作流」）必须保持不动** → 证明"该动的没动、不该动的也没动"。
- ⚠️ **已知未修（备忘 M041，用户拍板先不做）**：这套机制**分不清"界面标签"和"用户自己的内容"** ——
  排除名单只有 `script, style, noscript, textarea, input, [contenteditable="true"], [data-no-translate="true"]`，
  而 `data-no-translate` 全项目只用在少数 toast 上 → **繁体用户**发出去的聊天消息、上传文档正文、公告都会被改字。
  🗣️ 用户口径：「**用户用什么文字打，显示出来就是什么文字**」。要修就给用户内容标 `data-no-translate`（标外层容器即可）。


# 铁律⭐⭐：几个「真走界面」的验法照抄清单 —— 光看代码/接口证明不了这些（2026-08-09 第六十次会话沉淀）

`AGENTS.md` 已有铁律说「验用户能不能看到必须真走界面」。这条补的是**具体怎么走才算数**，
全都是 2026-08-09 审 v94 那批时真用过、且**成本为 0** 的姿势：

- ⭐⭐ **验「粘贴会不会被静默砍字」必须真发 `paste` 事件**，⛔ `fill()`/`type()` 证明不了
  （原生 `maxLength`、`slice()` 只在粘贴路径上咬人）：
  ```js
  const dt = new DataTransfer(); dt.setData('text/plain', 'A'.repeat(20000));
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  ```
  ⚠️ **contenteditable 有效**（组件自己有 `onPaste` 处理器）；⛔ **`<textarea>` 上无效**
  （合成事件没有默认插入行为）→ textarea 用 `page.keyboard.insertText('D'.repeat(4000))`。
  ⭐ 判据是**字符数**（`el.innerText.length` / `ta.value.length`），不是"看起来很长"。
- ⭐ **验「加了一行会不会把框顶高 / 跳高」必须量高度**，⛔ 别靠肉眼：
  空态和有内容各测一次 `card.getBoundingClientRect().height`，**两个数必须相等**（本次 136 = 136）。
  ⭐ 顺带：`maxlength` 这类属性存不存在也要 `getAttribute('maxlength')` **实测**，别看源码。
- ⭐⭐ **验「服务端只记日志不拦」不用手打接口**（⛔ 手打生成接口 = 开始烧钱，见本文件那条铁律）：
  **先在后台把上限调小 → 前端此时还是旧缓存 → 从界面正常发一条**
  → 既证明了"没被拦"（图正常出），又让服务端真落一行日志（回头 `grep -c` 判据）。
  ⭐ 这个"后台改配置 + 前端旧缓存"的错位，是验一切「前后端各自判定」的通用手法。
- ⭐⭐ **验「只保存 A 不会清空 B」要连试多次并每次 GET 回读**：
  本次连发 3 次只带 `promptLengthOverrides` 的 POST，每次都 `GET` 回来确认
  `uploadRuleOverrides` **原样在**。⛔ 只试一次 + 只看返回值不算（返回值可能是你刚发的那份）。
  ⭐ 测完**必须把配置改回原值并复验**（本次改回 `{}`）。
- ⭐ **验「后台配好了前台到底吃不吃」要走完整条链**：后台 POST → `GET /admin/api/...` →
  **`/api/model-availability`**（前台真正读的那个）→ **刷新前台页面**看界面上的数字变了。
  ⛔ 少任何一环都可能"后台存对了、前台没生效"。
- ⭐ **`aria-pressed` 是开关状态的唯一硬判据**；若 `aria-label` 是通用文案（如「启用 BytePlus」重复很多个），
  就**往上爬 DOM 找带模型名的那个祖先**当上下文，再把 `{ctx, pressed}` 成对打出来。
- ⚠️ **Playwright 截图/文件默认落在仓库根**（不是 `.playwright-mcp/`）→ 用完记得删，别混进 commit。
- ⚠️ 上传文件类的用例，**文件必须放在 workspace 根内**（放 temp 目录会 `File access denied ... outside allowed roots`）。

# 铁律⭐⭐⭐：所有 GET 接口**必须显式带 `Cache-Control: no-store`** —— 没有这个头，运营商/网关的透明缓存会给用户返旧数据（2026-08-09 正式服真实事故）

2026-08-09 用户报「正式服顶部公告：后台写的是『新增』，前台显示『新建』（10 小时前那一版），**刷新一下新的、再刷新旧的、过几秒自动又变回旧的**」。
根因**不在数据库、不在我们的逻辑**：`/api/announcement` 和 `/api/auth/me` 的响应
**一个 `Cache-Control` 都没有**（也没有 `Expires`、没有 `Last-Modified`）。
按 RFC 9111 §4.2.2，这种 200 GET 响应允许任何共享缓存**自行用启发式过期决定缓存多久**
→ 用户侧的运营商/公司网关透明代理存了一份很旧的副本。

- ⛔⛔ **代码里的 `fetch(url, { cache: "no-store" })` 治不了这个** —— 那只约束**浏览器自己**的 HTTP 缓存，
  中间代理只看**响应头**。防线必须在服务端响应头上（我们两个接口的 fetch 早就写了 no-store，照样翻车）。
- ⭐ **判据（一行、二值）**：`curl -sI <接口>` 看有没有 `Cache-Control`。**没有 = 允许被别人随便缓存**。
- ⭐⭐ **唯一实现 = `src/proxy.ts`**：对所有 `/api/*` 统一加
  `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` + `Pragma: no-cache` + `Expires: 0`
  （后两个是给只认 HTTP/1.0 的老代理看的，成本为零）。
  ⭐ **白名单 `CACHEABLE_API_PATHS`**：`/api/media-thumbnail` **必须放行**（内容寻址、阿里正式那份 nginx 故意缓存它 30 天、
  路由自己返回 `immutable`）——⛔ 一刀切给所有 /api 加 no-store 会把缩略图缓存打掉。
- ⛔⛔⛔ **这个 bug 在数据中心 / 干净浏览器里永远复现不出来**（那条链路上没有透明缓存）：
  我第一轮从腾讯服务器 curl 20/20 全对、Playwright 干净上下文刷 8/8 全对，据此回答用户"没有出入"——**是错的**。
  ⭐ 教训：**用户报"时好时坏/刷新就变"，先去 `curl -sI` 数响应头，别急着测"我这边能不能复现"。**
- ⭐ 顺带一个诊断姿势（当时最迷惑的一步）：DOM 文本 = 旧值、而 **React 的 `memoizedProps` = 新值**，
  且两个接口的实时返回都是新值 → 这种"三方对不上"几乎一定是**链路上有人给了旧响应**，不是渲染 bug。
- ⚠️ 影响面不止公告：`/api/auth/me` 被缓存意味着**积分 / 昵称 / 头像也可能显示旧值**，
  甚至可能与「间断性卡死」那类怪现象有关（未证实，但值得下次排查时想到）。
- ⚠️ 上完正式服后**用户自己那条链路上的旧副本可能还没过期** → 要提醒他强刷一次（Ctrl+F5）。
- ⛔⛔ **限定（2026-08-09 第六十一次会话补，很重要）**：**这条铁律只适用于"这条内容以前存在过"的场景。**
  次日测试服出现「公告显示的字不对」，我照这条去查、判成缓存 —— **错了**，那是**首次发布该公告**（缓存假说的前提不成立），
  真凶是**简繁转换在改字**（见本文件顶部那两条铁律）。⭐ **先证明前提，再查证据。**
<!-- END:nextjs-agent-rules-anchor-do-not-remove -->


# 铁律⭐⭐：后台「按模型」的配置 key **必须带版本号** —— 同系列不同代共用一个 key = 静默把新模型砍回老模型的量（2026-08-09 加）

`BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS` 当初写成 `byteplus:video.seedance:reference`（**不带版本号**），
于是 Seedance **2.0/Fast/Mini 与 2.5 共用同一条 override**。2.5 上线后这就变成真伤害：
后台「上传规则」面板那 3 行硬编码 `modelId: "byteplus:video.seedance-2-0"` → 显示的默认值是 9/3/3；
**管理员碰一下开关或输入框就 `saveNow`** → `{maxCount:9}` 写进共用 key →
`applyUploadRuleOverrides` 对 2.5 也生效 → **2.5 的 30 图/10 视频/10 音频被静默砍成 9/3/3**，
而面板里压根没有 2.5 的行，**后台上完全看不出来**。

- ⭐ **判据（一句话）**：一个 override/开关 key 会被**几个模型**命中？>1 且它们的**能力上限不一样** → 必须拆。
  拆的时候**老 key 一个字都别改**（`.env.local` 里已有的老配置就不用迁移），只给新代加一组新 key，
  再抽一个 `getXxxKeys(modelId)` 当唯一权威给「面板」和「运行时」共用。
- ⭐⭐ **回归必须写成"双向隔离"两条**：给老 key 写 override → 老模型变、**新模型不变**；
  给新 key 写 override → 新模型变、**老模型不变**。只测一个方向证明不了隔离。
- ⛔ **后台面板里"某个模型压根没有那一行"是最危险的形态** —— 它不是"少个功能"，
  而是"这个模型被另一行的配置暗中支配、且没人能发现"。
  ⭐ 所以补后台时**判据不是"页面能打开"，而是"每个模型都有自己的行、且行里的默认数字是它自己的"**
  （本次真机核对：2.0 融合 = 9/3/3、2.5 融合 = 30/10/10）。
- ⭐ **顺带的姿势**：后台面板的行清单如果是**硬编码数组**，那"新增模型要手工加行"就是个必漏点；
  排查时先搞清楚它是硬编码还是从模型表生成（本项目 BytePlus 视频那几行是硬编码，
  而名为 `openRouterVideoRows` 的自动生成那行**只含 OpenRouter 模型**，BytePlus 视频永远不会自动出现）。

# 铁律⭐：给「自动选模型」的候选链加新模型，放**最后一位** + 开关默认关，别动默认行为（2026-08-09 加）

同一批里给 Agent 自动生视频和工作流「视频快捷编辑」接 Seedance 2.5。这两件事都会花用户的钱，
而 2.5 比 2.0 贵 → **默认行为一个字都不许变**：

- **候选链**（`getPreferredAvailableGenerationModel` / `VIDEO_EDIT_FUNCTION_MODEL_CHAIN` 这类"取第一个已启用的"）：
  新模型放**最后一位** → 前面几个都被后台关掉才轮到它。⛔ 别放首位（等于悄悄涨价）。
- **开关**：`isBytePlusPreferenceEnabled` 只在偏好表里的值**等于 `"byteplus"`** 时才 true
  → **故意不往 `DEFAULT_MODEL_PROVIDER_PREFERENCES` 里写那个 key**，开关就默认「关」，
  管理员想用再开。⭐ 这比"加个开关默认开"安全得多。
- ⭐ **验收判据是"开关的真实状态"**：真机 `aria-pressed` 逐个核对
  （本次三个 2.5 开关：视频生成 = true、Agent = **false**、快捷编辑四选 = true）。
- ⛔ **只加配置表不接候选链 = 死配置**（本项目 `agent-video.seedance-2-0-mini` 就是这样躺了很久：
  偏好表和端点表都有它，KEYS 表里没有 → 那两条配置从来没生效）。
  补后台时**要么两头都接上、要么写注释钉住"故意不接"**，别留半份。

# 铁律：验「视频延长」必须用**短**源视频；验「某个上限」别用刚好等于上限的素材（2026-08-09 加）

我拿 **30 秒**源视频去验 Seedance 2.5 的「视频延长」，真出片了，但**"变长"这条压根不可能成立**
—— 2.5 的输出上限就是 30 秒。⭐ 换 8 秒源视频重跑才验得到语义。
⭐ 通用判据：**验"会不会变大/变长/变多"的功能，输入必须离上限足够远**；
同理（本文件另有一条）**探测上游硬上限只用必被拒的值**，别用刚好等于上限的值（那次会真建任务真花钱）。

# 铁律⭐⭐：后台管理页只能用白名单号登，而白名单在 **env `ADMIN_EMAILS`** 里（2026-08-09 加）

测试服 `ADMIN_EMAILS=lookxun@163.com,176107103@qq.com` —— **主测试号 `12424740@qq.com` 不在里面**，
用它登 `/admin` 是进不去的。⭐ 登后台只能用 `lookxun@163.com`（密码同 `dragonstar`），
这也是本项目唯一允许用那个号的场合（⛔ 它是用户自己的号，**只许看后台页面，禁止在前台做任何生成**）。
⭐ 不确定时先 `sudo grep -E '^ADMIN_EMAILS' <那台的 .env.local>` 查一眼，别瞎试密码。

# 铁律⭐⭐：参考素材「时长上限」是**按模型**的 —— 规则层放宽了不算数，四条通道要各自对上（2026-08-09 加）

2026-08-09 用户要求「2.5 支持 30 秒参考视频/音频」。`upload-rules.ts` 的
`getSeedanceReferenceLimits`（2.5 = 30 秒 / 10 个 / 总 30 秒）**早就写对了**，但真传 30 秒还是被拦 ——
因为 **`media-upload-validation.ts` 的 `validateMediaUploadMetadata` 里写死 `> 15 + EPS`**，
而它是**服务端 `/api/upload-file` + 对话流 + 资产库 + 工作流上传节点**共用的那一层 → 规则层白改。

- ⭐ **正解 = 让那个函数收一个可选的 `{minSeconds,maxSeconds}`**，
  **知道模型的通道传模型区间、不知道模型的通道用全平台最宽区间**
  （`REFERENCE_CLIP_SECONDS_MIN/MAX = 2/30`，唯一权威）。
  ⛔ 别把服务端 upload-file 也按某个模型收紧 —— 资产库/画布上传节点**压根还没选模型**，
  收紧就等于"2.5 用户永远传不上 30 秒素材"。真正的按模型收紧发生在**「把素材附加给某个模型」那一步**。
- ⭐⭐ **必须逐条数清有几条通道**（这次是 5 处 `validateMediaUploadMetadata` + 2 处
  `validateReferenceMediaDurationRange`）：① 对话流附加（传模型区间）② 资产库上传（最宽）
  ③ 工作流上传节点/拖拽（最宽）④ 服务端 `/api/upload-file`（最宽）
  ⑤ **服务端 `/api/video` 的 `validateOwnedReferences`（必须传模型区间）** ——
  ⑤ 最容易漏，它在**发给上游之前**再校一遍，漏了就是"前端放行、点发送被服务端拒"。
- ⭐ **文案必须把区间写进去**（🗣️ 用户原话：这样用户才知道不同模型支持不同时长）：
  唯一实现 `buildReferenceDurationRangeMessage` → 「当前模型支持上传2-15秒参考视频」/「…2-30秒参考音频」。
  ⛔ 别再写「时长不能超过 15 秒」这种不带模型信息的话。
- ⭐ **上游真实硬上限 = 我们宣传的整数 + 0.2 容差**，两代都验过：
  2.0 是 **15.2**、2.5 实测是 **30.2**（`must be less than or equal to 30.2 for model
  dreamina-seedance-2-5 in r2v`）→ 现有 `MEDIA_DURATION_EPSILON_SECONDS = 0.2` 正好对齐，不用改。
- ⭐⭐ **探测上游硬上限的姿势（免费）**：造一个**明显超限**的素材（40 秒）直打上游 →
  400 的错误文案里**上游会把精确上限告诉你**。⛔⛔ **但别拿"刚好等于上限"的值去探** ——
  2026-08-09 我用 30.2 秒探，**上游接受了 → 真建了任务、真花了 BytePlus 的钱**（`cgt-20260809060339-fcv8w`，
  running 状态删不掉）。**探测只用必被拒的值。**
- ⭐ edit/extend 的源视频官方要求 **[4,30]**（不是 [2,30]）→ `minSeconds: 4`，提前用大白话拦住。

# 铁律⭐⭐：解析「模型返回的 JSON」一律要容错裸控制字符 —— 长回复里的真实换行会让 `JSON.parse` 必挂（2026-08-09 加，正式服「对话后出现很多代码」根因）

2026-08-09 用户报正式服 Agent 模式「对话后出现很多代码」。去正式服拉那条对话的消息坐实：
assistant 正文是**一整段原始 JSON**（`{"intent":"...","content":"...","suggestions":[...]}`）直接显示。
根因：`parseStructuredAgentReply`（`openrouter.ts`）里 `JSON.parse` 遇到**模型在 `content` 字符串值里写的真实换行**
就抛错 —— **JSON 规范里字符串内不许出现裸控制字符（`\n`/`\r`/`\t`）**，而长回复/剧本/分镜**必然有换行**
→ catch 兜底把整段原始 JSON 当正文吐给用户。**只要是长结构化回复就 100% 翻车，不是偶发。**

- ⭐ **正解 = `openrouter.ts` 的 `parseLenientModelJson()`**（唯一实现）：先正常 `JSON.parse`，失败就用
  `escapeRawControlCharsInJsonStrings()`（**只在字符串上下文内**把裸 `\n\r\t` 转义）后重试。
  ⛔ **凡是解析模型返回的 JSON 都要走它**，别再直接 `JSON.parse(text.match(/\{[\s\S]*\}/)[0])`
  （`parseStructuredAgentReply`/`parseAgentPlan`/`parseIntentClassification` 已统一）。
- ⭐ **验法**：拿一条 content 里带真实换行的字符串，`JSON.parse` 抛错、转义后成功 —— 二值。
- ⚠️ **老脏数据不会自动修**：历史上已经被吐成 JSON 存进库的那些 assistant 消息，只对新回复生效、不回填。
- ⭐ 顺带：让模型"只返回 JSON"的 prompt 里写「不要输出字面量 \n」**约束不住**模型（它照样用真实换行排版），
  所以**防线必须在解析侧**，别指望 prompt。

# 铁律⭐⭐⭐：验"用户能不能看到"必须**真走界面**，⛔ 直调接口只能证明后端对（2026-08-08 加，被用户当场戳出来）

2026-08-08 我验正式服内容审核，全程用 `fetch()` 直调 `/api/image`，拿到 `400 + CONTENT_POLICY_BLOCKED`
就报"端到端验通"。🗣️ 用户追问「**前端没有找到这一条**」—— 一句话戳破：
**我压根没走界面**，所以"用户在界面上到底看不看得到那句红字"**根本没验过**。
补测才发现：真走界面 3 次，**有 1 次整屏卡在「加载中...0%」、没有红字、消息一条没存**。

- ⭐ **判据**：凡是"用户会看到/会用到"的东西，**验收必须落在界面上**。
  直调接口只能证明「后端返回对了」，⛔ **不能**证明「前端渲染了、用户看见了、状态存住了」。
  ⭐ 这类改动的验收清单至少两行：**① 接口返回对 ② 界面上真出现了那句话/那张卡**。
- ⭐ **被拦截/失败这类路径尤其要真点** —— 它们平时不发生，正好是最少被走到、最容易坏的分支；
  而且**命中拦截不扣积分**，真走界面的成本是 0。
- ⛔ **别拿"我这次调用返回对了"当"功能没问题"**：本次接口 100% 正确，坏的恰恰是接口之后那一段。

# 铁律⭐⭐：做对照实验，两组的**条件必须对等**；不对等就不许下"某路径特有"的结论（2026-08-08 加）

同一次排查里我下错两个结论，都栽在"证据不对等"上：

1. 我说「这个 bug 是**拦截路径特有**的」—— 依据是"拦截那次坏了、正常那次好了"。
   但**正常那次是在刷新页面 + 已经发过一次之后做的**，而坏的那次是**刚加载后的第一次发送** →
   ⭐ **两组差了不止一个变量，这个结论不成立**。
2. 我接着说「可能是**初始加载还没就绪**的时序竞争」→ 🗣️ 用户一句话推翻：
   「**如果在加载中，那就是加载慢的问题。。在加载中用户可没有看到输入框根本没法输入提示词**」
   ⭐ **输入框能用、能打字发送，就证明加载早完成了** → 那个加载态是**发送之后**才出现的。
- ⭐ **判据**：写下"A 组坏、B 组好"之前，**把两组的操作序列逐步并排列出来**，
  确认**只差你想验的那一个变量**。差两个以上 → 只能说"暂未复现"，⛔ 不许说"某路径特有"。
- ⭐ **用户的物理常识往往比我的代码推理更硬**（"能打字 = 加载完了"），**他推翻我时先认真验他的理由**。



# 铁律⭐⭐：`atob()` 不解 UTF-8 —— 中文 base64 必须 `TextDecoder`；且"审核没拦"要先分清「代码没跑」还是「没匹配上」（2026-08-08 加）

2026-08-08 验正式服内容审核，我把词库里的词用 base64 传进浏览器、`atob(b64)` 拿到"词"就发给 `/api/image`
→ 得到 500 而不是拦截，**差点报"审核在正式服失效"**。真因：**`atob()` 返回 latin1 字节串**，
UTF-8 中文没被解码 → 我发出去的是乱码，自然不命中词库。

- ⭐ **正解**：`new TextDecoder('utf-8').decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))`。
  改对之后立刻 `400 + CONTENT_POLICY_BLOCKED`。
- ⭐⭐ **更通用的判据（这条最值钱）**：**"拦截没生效"要先分清两件事** ——
  ① 审核代码**压根没跑**（异常/条件不满足）② 跑了但**没匹配上**。
  本项目里 `enforceContentPolicy` 未命中时会写一条 **`semantic_review` 事件** →
  **那条事件存在就是"代码跑了"的铁证**，于是问题被瞬间缩到"匹配"这一层。
  ⭐ 找这种"只有某条路径才会产生的副作用"当探针，比读代码猜快得多。
- ⭐ **最后定案靠"在容器内用真实模块 + 真实数据比对"**（`STORED_EQUALS_RECOMPUTED` / `INCLUDES_STORED` /
  `FIND_RESULT`）—— 逻辑和数据都证明 HIT，就只剩"我发过去的字符串"这一个变量了。
- ⚠️ 顺带：**远端命令输出含中文会让 bash 工具返回异常** → 一律 `tr -cd '\40-\176\12'` 只留 ASCII，
  或把中文字段 **base64 输出**，中文永不过管道。
- ⚠️ 顺带：**手打生成接口时 model id 别猜** —— 正确的图片模型 id 在 `src/lib/models.ts`
  （`byteplus:conversation-image.seedream-4-5`），⛔ `/api/models` 返回的是**文本模型**列表。
  我猜错两次，在正式服白留了 **B_193 / B_194** 两条红字（已写进交接文档提醒别当成用户问题）。

# 铁律：远端脚本"我记得跑过了"不算数 —— 拿服务器上的实际值当判据（2026-08-08 加）

2026-08-08 正式服部署，我以为"备份 + staging→prod 对齐"那个脚本跑成了（输出被工具吞掉、我误读为成功），
结果一查 **prod 还是 v76、连 build 日志都不存在** —— 白等了一轮。

- ⭐ **判据（二值）**：`grep 'APP_VERSION =' /opt/flashmuse/app/src/lib/app-version.ts` +
  `ls /tmp/prodbuild*.log`。两者都对上才算这一步真做完了。
- ⭐ 同源于本文件那条「验新镜像看 `/api/health` 不看 `x-app-version`」：
  **部署每一步都要有一个"服务器上能查到的实际值"作为完成判据**，⛔ 别用"命令没报错"或"我记得跑过"。



# 铁律⛔⛔：验证脚本**绝不许删改用户已有的真实数据行**，造用例只用自己的独立命名空间（2026-08-07 加，我真删了用户的词库）

2026-08-07 验「内容审核」时，我为了造干净用例在脚本里
`DELETE FROM "ContentModerationRuleGroup" WHERE category='sensitive_politics'` ——
**外键级联把词条一起带走**，用户本地录的 2 个词全没了（🗣️「怎么本地的两个词给我清掉了吗？」）。

- ⭐ **正确姿势**：造用例用**独立 category / 独立 id 前缀**（如 `verify_only_xxx`、`requestId LIKE 'verify-%'`），
  清理时**只删自己插进去的那几行**，⛔ 绝不按业务主键（category / userId / 类型）整条删。
- ⭐ **写脚本前先问一句「这张表里有没有用户手工录进去的东西」** —— 配置类（规则、词库、开关、白名单）几乎一定有。
- ⭐ **删了怎么救**：先去**事件/日志类表**找它的影子（本次 `ContentModerationEvent.matchedTerm` 捞回了一个词）。
  ⛔ 但「命中即 return」的匹配逻辑意味着**只有被命中过的值才留痕**，其余永久丢失。
- ⭐ 顺带：**跑完就删临时脚本**（放 `.runtime/`），别留在仓库里被下一个人当成正式测试。

# 铁律：新增一句"红字文案"必须同时验两件事 —— 幂等 + 错误码前缀会不会被贴上（2026-08-07 补充）

除了本文件那条「`toUserErrorMessage` 会跑两遍 → 幂等保护」之外，还有第二个坑：
**`getApiErrorMessageWithCode`（`chat-workbench-core.tsx:6195`）会把非 `B_` 的 `errorCode` 拼成 `(XXX) 原文`。**
所以路由里返回 `errorCode: "CONTENT_POLICY_BLOCKED"` 这类自定义码时，要确认用户会不会看到那个英文码。

- ⭐ **判据**：看这条路径是先经 `readJson` 还是先经 `getApiErrorMessageWithCode`。
  `readJson` 在 `!response.ok` 时**先抛 `toUserErrorMessage(error)`** → 拼码那行走不到（2026-08-07 五条真实路径都是这种）。
- ⭐ 两件事都要用 `npx tsx` 实跑：① 文案连跑 3 遍相等 ② 带 `(B_9)` 前缀时前缀不丢。

# 铁律⛔⛔：往常驻 worker 的 tick 里加活儿，一律「不 await + 带超时 + 自带并发锁」（2026-08-07 加）

2026-08-07 我把语义审核写成 `await processContentModerationQueue(2)` 放进 `generation-worker.ts` 的 `tick()`，
而那次 `fetch` **没有超时** → 上游一卡住，`tick` 的 `running` 标志永远是 true →
**图片和视频任务全都不再被认领 = 全站生成停摆**（自查时抓到，没上线）。

- ⭐ **三件套缺一不可**：① 调用方 `void`（不 await）② 请求 `AbortSignal.timeout(...)`
  ③ 被调函数内部自己有 `running` 标志（因为不 await 了，外层那把锁保护不到它）。
- ⭐ **判据**：问「这件事失败/超时，会不会连带影响 tick 里**别的**活儿」。会 → 必须隔离。
  worker 的 tick 是**全站生成的心跳**，任何寄生在它上面的外网调用都要当成危险品。

# 铁律：审核/统计类要记「用户写的那句话」时用 `sourcePrompt`，⛔ 别用发给模型的 `prompt`（2026-08-07 加）

资产库/工作流发给 `/api/image`、`/api/video` 的 `prompt` 是**拼过的**（规则文本 + 参考图 hint + 用户原话），
而 `sourcePrompt` 才是用户原话（各条路径本来都在传）。用错的后果有两个，第二个更隐蔽：
① 后台看到的是一大段系统文本；② **关键词匹配会拿我们自己拼进去的规则文本去比，可能凭空命中**。

# 铁律⭐⭐：**一条链的回调只许改自己那一条** —— 共享数组 state 里，别人的条目一律不许动（2026-08-06 加）

2026-08-06 用户报「资产库角色图片同时生成 5 张，3 成 2 败，**消失了一个失败卡**」。
根因是**同一族的两处**，都发生在「N 条独立并发链写同一份 `assetGenerateJobs` 数组」上：

- ⛔ **`chat-workbench.tsx:7869` 成功回调里挂着 `.filter(同 type 的其它 failed 全删掉)`**
  → **任意一张成功就抹掉同类型的所有失败卡**。判据只看 `type`，**不看批次、不看时间**，
  而它是**唯一一处会主动删除"别人的"条目**的代码。
- ⛔ **`chat-workbench.tsx:7770` 复用别人的 id**（"上次结果是失败 → 新任务顶用那条失败卡的 jobId"，
  美其名曰"原地重试"）→ **连续两次失败，第一次的记录被第二次覆盖**，卡数不增、文案被换掉。
- ⭐ **判据（一句话）**：在一个 `setXxx(prev => …)` 里，凡是**碰到 `job.id !== 当前 id` 的条目**
  （无论 filter 删、还是复用它的 id 覆盖），都要问一句「**并发时另一条链正指着它，我凭什么动它？**」
- ⭐ **认知纠偏（我一开始就差点搞错）**：**先去看写入方确认"一次请求到底出几张"** ——
  资产库 `count` **写死 1**、`/api/image` 上限本来就是 4，所以"同时生成五张" = **连点 5 次 = 5 条独立链**。
  → 这类"部分成功部分失败"**只可能出在前端 state 合并**，不可能是后端返回结构映射错。
  （同源于本文件那条「判断某字段会不会有多个要看写入方，别只看 TS 类型」。）
- ⭐⭐ **配套两道防线，缺一不可**（否则条目会被"静默弄没"或"复活"）：
  ① **下行合并别只保护"进行中"**：`2538` 那处原来只保 `generating`，
     刚变 `failed`、**500ms 防抖 PUT 还没落库**的那条会被服务端旧快照**覆盖掉**；
  ② **反向也要防复活**：用户删掉后若紧接着来一次加载，旧快照又会把它**加回来**
     → 用一个 `dismissed…IdsRef: Set` 记住"用户主动删掉的 id"，所有合并入口都排除它。
- ⭐⭐ **零成本造失败卡的验法（下次照抄，⛔ 别再去写必被拒的提示词烧钱）**：
  Playwright `page.route('**/api/image')` 把 **POST `fulfill({status:500, body:{error:…}})`**
  —— 它走的正是线上真实失败那条 `catch` 分支，**0 积分**、条数与时序精确可控；
  ⭐ 但**"成功"那一次必须真跑**（要验的正是"成功回调会不会吃掉失败卡"）。用完 `page.unrouteAll()`。
  ⭐ 二值判据：`document.querySelectorAll('.flashmuse-failed-media-card').length`；
  ✕ 是 `button[aria-label="清除失败卡"]`；⚠️ `getByRole('button',{name:'资产库'})` 会撞两个元素，
  用 `page.locator('button[aria-label="资产库"]').first()`。
- ⭐ **console 日志能当二值判据**：修前 `[asset-generation] image request failed` 里
  **`jobId ≠ requestId`**（= 复用了别人的卡），修后**恒等**。加日志时把这类"身份字段"都打出来很值。
- ⛔ **自测中途改了代码 → 必须重新 bump 完整重推**（本次 v77 → v78），
  **不许原地覆盖同一个版本号** —— 那会让"测试服 vX ≠ 本地 vX"，直接破坏本项目最核心的判据。

# 铁律⭐⭐⭐：**没复现 = 不许动行为，只许加日志**（2026-08-06 用户拍板，最高优先级）

🗣️ **用户原话**：「**以后找bug不确定不要乱动代码加日志找到真实原因为止，宁可不动也不乱动。**」

2026-08-06 查用户 ID_947011 报的「换了第二张参考图，发送出去还是原来那张」（对话模式），我**在根因没坐实的情况下改了两轮行为、被要求整批撤回两次**：
① 把「秒回去重命中」改成"合并掉这一格"并改了提示文案 → 🗣️「**不要去乱改提示啊。提示不要改。**」
② 把「同名上传」改成"替换掉框里那张同名老图"（方向看着对、还配了 17 条回归）→ 但**测试服 6 个变体全试过都没复现、用户自己也测了一次没复现** → 🗣️「你先把改动全部撤回」。

- ⭐ **判据（一句话）**：**我能在测试服稳定复现吗？** 不能 → **这一轮只许加日志**，把盲区补上、等它下次自己现形。
- ⭐ **加日志之前先问「现有数据到底缺哪一块」**，别乱撒。本次缺的是"用户意愿 vs 实际发出"的对照，
  于是只加了 4 条并全部带**来源标记**，一条命令就能定案（见 `05-next-actions.md` 待办 2）。
- ⛔ **"看着像对的方向"不是依据**：#3/#5 那两个变体确实"没做到用户意愿"，但它们**不是用户报的那个现象**
  （用户那次是**零上传**）。⭐ **改之前必须先证明"我要改的这条路，正是用户踩的那条路"。**
- ⭐ **用户的纠正要当硬证据收下**：🗣️「不删旧的传同名，确实应该三个文件」——我曾把这个正确行为当成 bug 去"修"。
- ⭐ **两条已定位但故意没修的缺陷要写进交接文档待办**（本次是 mention 正则不对称 + `getOrderedExplicitImageReferences` 从资产库捞图），
  ⛔ 别顺手改掉，也别忘掉。

# 铁律⭐⭐：`toUserErrorMessage` 在链路上会跑**两遍** —— 加了新红字文案就必须同步加进「幂等保护」（2026-08-06 加，正式服 B_123）

`toUserErrorMessage()` 在「**服务端 route 映射一次 → 客户端 `chat/chat-workbench-core.tsx:6168`
`throw new Error(toUserErrorMessage(text))` 再映射一次 → 工作流节点 catch
`workflow-tldraw-canvas-inner.tsx:4707` 还会再来一次**」这条链路上**必然被跑多遍**。
而我们自己的成品中文文案里往往带着**会被下面兜底规则命中的关键词** → 第二遍就被重新包了一层。

- 🔴 **B_123 实例**：上游 `input video may be related to copyright restrictions` →
  服务端正确映射成「**参考视频**没能通过平台的**版权**检测…」→ 客户端再映射一次，
  这句话里的「版权」命中 `error-message.ts` 那条**裸 `copyright|版权` 兜底** →
  变成「模型…**拒绝出图**…以下是模型返回的拒绝原因：“参考视频没能通过平台的版权检测…”」
  = **审核视频的问题被拼进了拒绝出图的文案里**，把用户指向完全错误的排查方向（去改提示词）。
- ⭐ **唯一防线 = `error-message.ts` 第 217 行那道「幂等保护」白名单**
  （`isModelRefusedMessage` / `^模型这次没有出图…` / `isReferenceReviewRejectedMessage`）。
  ⛔⛔ **每新增/改动一句我们自己的红字文案，都必须问一句「它二次映射还会回到自己吗」**，
  不会就往那个白名单里加一条。
- ⭐ **判定函数只认「开头 + 前半句」，⛔ 别拿整句去比** —— 措辞会被用户改
  （那句 2026-08-05 才刚改过一次）。本次用 `/^参考(?:图片|视频|音频|素材)没能通过平台的版权检测/`。
- ⭐⭐ **验法（几秒钟、二值、必须做）**：`npx tsx` import 真实模块，把**每一条**红字
  **连跑 3 遍**，`a === b && b === c` 才算过。本次 37 条里揪出 2 条 BREAK。
  ⭐ **必须带反向用例**：上游英文原文照样要被映射；「任务失败：参考视频没能通过…」这种
  **句中假冒**要被重新映射；「参考视频**通过了**版权检测」这种近似句不许被放过。
- ⛔ **「另一条没坏」不代表规则写对了**：本次「参考**图片**」侥幸没串，**纯属巧合** ——
  精确规则的第二个分支里认「参考图」三个字，而「参考图片」正好含它。
  ⭐ 同源判据：**发现"同一类里有的坏有的不坏"，先去证明那个"不坏"是不是巧合**，别当成"规则是对的"。
- ⚠️ 修这类问题**不用**改 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`（没动措辞，只是不再被二次加工）；
  但**老数据是脏的**（历史被串的那些条记在「模型拒绝」行里），⛔ 不建议回填，要看真实规模请查
  `.runtime/generation-diagnostics-log.jsonl` 的 `extra.userError`（那里是服务端映射的正确文案）。

# 铁律：判「新镜像到底起来没」看 `/api/health` 的 `version`，⛔ 不看 `x-app-version`（2026-08-06 加）

`x-app-version` 由 `src/proxy.ts` 写，读的是**运行时** `PUBLISHED_APP_VERSION` —— 它是**故意**留到
「静态已同步到阿里」之后那一步才置成新版的（提示条门控：弹出即代表刷新不会白屏）。
所以 **`up -d --build` 完成后 `x-app-version` 仍显示旧版是正常的**，2026-08-06 我据此差点误判"build 没生效"。

- ⭐ **正确判据两条**：① `curl /api/health` → `{"ok":true,"version":"vX"}`（这个直接来自 `APP_VERSION`，编译进镜像）
  ② 容器内 `grep` 构建产物 `/app/.next/server` 找**本次新加的字符串/正则字面量**（命中 = 真编译进去了）。
- ⭐ 部署最后一步再 `PUBLISHED_APP_VERSION=vX` + `force-recreate`，然后 `x-app-version` 才该等于新版。
- ⛔⛔ **限定（2026-08-09 加）：上面第 ② 条只对「字符串/正则字面量」有效 —— 生产构建会把
  局部函数名、局部变量名全部压缩改名**，拿**函数名**去 grep `.next` 产物**什么都证明不了**。
  实测：我查 `convertTraditionalToSimplified`（应为 0）、`MAX_DRAFT_INPUT_LENGTH`（应为 0）、
  `convertSimplifiedToTraditional`（**本该 >0**）→ **三个全是 0**，差点误判部署失败。
  ⭐ 判据选择：**改动新增了字符串字面量 → 可以 grep；只改了逻辑/删了函数 → 只能真走界面验**
  （`export` 出去的符号名通常还在，但也别赌）。

# 铁律⛔⛔：`reportClientDiagnostic` 的事件**不在白名单里就等于没加**（2026-08-06 加，第一版就踩了）

`src/lib/chat/chat-workbench-core.tsx` 的 `reportClientDiagnostic()` → `POST /api/client-error`，
而那个路由**只有在 `PERSISTED_CLIENT_EVENTS` 白名单里的 message 才 `appendUploadDiagnosticsLog` 落盘**，
**不在名单里的只 `console.error`** —— docker logs 会滚掉，事后一行都查不到 = **等于没加这条日志**。

- ⭐ **加任何客户端诊断，必须同步把事件名加进 `src/app/api/client-error/route.ts` 的 `PERSISTED_CLIENT_EVENTS`。**
- ⭐ **验收是二值的**：部署后真去触发一次，然后 `grep -c '"client-<事件名>"' .runtime/upload-diagnostics-log.jsonl`
  必须 > 0。⛔ 别拿"代码里有这行"当通过。
- ⚠️ `/api/client-error` 把 `stack`（我们塞 detail 的地方）**截断到 2000 字符** → 日志里别记全 url，只记文件名末段。
- ⚠️ 顺带：**`.runtime/*-diagnostics-log.jsonl` 的属主必须是 uid 1000**（容器里 app 以 node 跑），
  root 建的文件会让 app 静默写不进去（本文件另有一条铁律记过这个坑）。

# 铁律⭐⭐：查「某个东西到底传上去没有」看**磁盘 mtime + 上传日志**，⛔ 不看 `MediaAsset.createdAt`（2026-08-06 加）

参考图的 `MediaAsset` 行**不是上传那一刻建的**，而是**任务成功时**由 `finalizeImageJobAsset` 之类建的
→ 它的 `createdAt` 和 `GenerationJob.createdAt` 交错在一起（实测差 7ms ~ 1.7s），**完全不能代表上传时间**。
2026-08-06 我一开始就被它误导，推出了错误的时间线。

- ⭐ **正确的三方互证**：① `ls --time-style=full-iso` 看 `generated/users/<id>/upload_image/` 的 **mtime**
  ② `.runtime/upload-diagnostics-log.jsonl`（一次正常上传会留 **7 条**：post-start / file-received /
  reencode / buffer-saved / post-success / patch-start / patch-success）③ `GenerationJob.referenceImages`（发了哪几张）。
- ⭐⭐ **"零上传"是个非常强的判据**：磁盘没有新文件 **且** 上传日志一条都没有 → 这次用户**压根没传成功过**，
  问题一定在客户端或秒回预检（GET，2026-08-06 之前**零日志**，这就是当时查不下去的根本原因）。
- ⛔ **别用"客户端算出来的原始字节哈希"去正式服比对用户转发给你的图**：
  2026-08-06 我按管线复刻算落盘文件名（PNG → `flatten(#ffffff)` → `jpeg({quality,mozjpeg,4:2:0})` →
  `sha256(重编码字节).slice(0,24)+".jpg"`，quality 有 95/80/60 三档）去全站找，**六个候选全都找不到**。
  ⭐ **救命判据：先找一张"确定应该存在"的做对照** —— 连"老图"都找不到，就说明用户转发过来的图
  **被压过、不是上传原件**（实测 470×520 / 534×541 vs 线上 2400×1088），样本不可信，**立刻停止推论**。

# 铁律：改错误映射/删除逻辑之类的东西，先看「删」和「读」的正则是不是**对称**的（2026-08-06 加）

`src/lib/mention-text.ts` 实测：`removeMentionName` 的 lookahead `(?=$|[\s，。！？；;、])` **不含 `@`**，
而 `getMentionNames` 的 `[^@\s，。！？；;、]+` **把 `@` 当终止符** →
`"@000@A_old 把图2放进图1"` 删「000」**一个字都删不掉**，而发送时**照样解析出 `["000","A_old"]`**。
→ 用户删了缩略图、@名还在，发送时 `getOrderedExplicitImageReferences` 就从**整个资产库**把老图捞回来（还排最前面）。

- ⭐ **判据**：凡是"写入用一个正则、读取用另一个正则"的地方，**把两个字符类抄出来逐字符比**。
- ⚠️ **注释可能在骗你**：那行注释写的是「可紧贴中文、可相邻」，**注释声称支持、正则做不到**
  （同源于本文件「标签准备好 ≠ 规则到得了」那条）。
- ⭐ 验法：`npx tsx` 直接 import 真实模块跑 7 个用例（含反向：`@000_2` 不许被删「000」误伤），几秒钟。


# 铁律⭐⭐：把一个分类「细化成 N 个分支」时，必须给**每个分支各自的进入条件**造用例（2026-08-05 加）

上一轮把「参考素材没过审」按 图片/视频/音频 细化，标签表 `REFERENCE_REVIEW_KIND_LABEL` 三类都写了，
但精确规则只写 `input\s+(?:image|video)` —— **漏了 audio**。于是
「`input audio` + 只提 copyright（不提 sensitive）」掉进裸 `copyright` 兜底、被说成"模型拒绝"。
⭐ **最阴的是 sensitive 那一路歪打正着能命中**（更下面还有一条 `sensitive|privacy` 兜底会调 detect）
→ **只测 sensitive 永远测不出来**。

- ⭐ **判据**：细化出 N 个分支就要有 **N × 每种触发词** 的用例，⛔ 别因为"枚举/标签表里写了那一项"
  就以为链路能到达它。**标签准备好 ≠ 规则到得了**。
- ⭐ 跑法照旧：`npx tsx` 直接 import 真实模块喂**上游真实原文**，几秒钟；脚本放 `.runtime/`。
  ⭐ **反向用例一条都不能省**（本次 8 条里 4 条反向）。
- ⭐ 修完先问一句「归一化 SQL 要不要跟着改」：本次**不用**（`FAILURE_REASON_SQL` 早就覆盖四种措辞，
  只是"音频"以前永远走不到）。但这一步必须**主动确认**，不是默认不用。

# 铁律⛔⛔：别为了"免费触发一次失败"去手打生成类接口 —— 它的默认结果是**开始烧钱**（2026-08-05 加）

我为验「创建阶段失败也记住 userId」，在页面里 `fetch('/api/video', ...)` 反复试：
前 3 次分别被 `MISSING_REQUEST_ID` / 模型 id 写错 / **参考视频归属校验**挡回来
（⭐ 顺带坐实：**拿一个不存在的本地 url 触发不了后段失败** —— 服务端要求参考视频必须是本账号已上传的资产），
**第 4 次真把 BytePlus 任务建出来了、扣了 53 积分**。

- ⭐ **判据**：这个接口"跑通"的代价是什么？凡是**成功 = 花钱**的接口，⛔ 不许拿它做探针。
- ⭐ **替代做法（本次最终用的，全是二值、零成本）**：
  ① 在容器里 `grep` **构建产物** `/app/.next/server` 找本次新加的字符串/标识符（命中 = 真编译进去了）；
  ② `grep -n` **服务器上的源码**，确认 `let` 在 try 之外、catch 里用的是那个变量；
  ③ 本地 `npx tsx` 喂真实原文跑纯函数回归。
- ⚠️ 顺带：**这类"意外成功"要当留痕记进交接文档**（谁的号、扣了多少、在哪留下一条数据），
  否则下一任会把它当成用户数据。

# 铁律⭐⭐：报错文案是「产品口径」—— 链路行为要迁就文案，且⛔不许替上游编理由（2026-08-05 加）

同一次会话里，同一句红字被用户改了**三轮**，每轮都打掉我一个自作聪明的地方。三条都要记住：

- ⛔⛔ **不许在文案里替上游/平台编原因。** 我写「参考视频涉及版权（**例如影视剧、动漫、综艺等片段**）」，
  🗣️ 用户当场否掉：「其实送审的也不是影视剧，也不是动漫，就是一个普通的视频。」
  回头查库坐实**用户是对的**（那素材是 576×1024 / 10.3 秒 / 753KB 的普通竖屏短片）。
  ⭐ **判据**：这个原因**我有证据吗**？没有就只说「平台判定/检测未通过」。
  编理由有两重伤害：① 用户觉得被冤枉 ② 把他往错误的排查方向带（去找"我是不是用了影视片段"）。
- ⛔⛔ **改链路前先看"用户看到的文案有没有承诺这件事"。** 我改了「上次审核被拒过就不再送审、直接抛上次的错」
  （省 14 秒、不在平台堆垃圾素材，看着全是优点），但用户定的文案是「**重试可能通过**」——
  缓存上次的否决 = 重试**永远**不可能通过 = **红字变成骗人的话**。
  ⭐ **不一致时改链路去迁就文案**（文案是产品口径），别反过来。已撤回并在那段代码上加 ⛔ 注释钉住。
  ⭐ 同源判据：凡是"减少无用重试/跳过重复请求"这类优化，先问**这次重试对用户到底有没有意义**——
  平台的内容审核是会**误判**的，每次重新送审都是重新过一次审，不是幂等查询。
- ⭐⭐ **把一句文案按类型细化成 N 句时，必须同步后台的归一化 SQL。**
  本次把"参考素材"细化成**参考图片/视频/音频**（🗣️ 用户：「是什么没过就显示什么」）——
  **同一个根因立刻裂成 4 种措辞 → 后台「失败原因」会炸成 4 行、条数被摊薄、看不出真实规模**
  （`07-red-error-triage-and-archive.md` 第五节记过这个坑）。
  唯一权威 = `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`，⛔ 改措辞必须同步改它，
  ⭐ 并**在真库上用样本实跑**确认"该合的合了、不该动的一条都没被误碰"（本次 7 条样本）。
- ⭐ **改错误映射的回归必须带"反向用例"**：新规则最容易**抢走**邻近规则的匹配。
  本次 11 条里有 **3 条是反向的**（`output video` 版权仍走"成品被拒交付"、`OutputImageSensitive` 仍走"成品图片"、
  `input text` 敏感仍走"模型拒绝"）。⛔ 只测"我这条命中了"不算通过。
  ⭐ 跑法：`npx tsx` 直接 import `src/lib/error-message.ts` 喂**真实上游原文**，几秒钟，脚本放 `.runtime/` 跑完删。
- ⚠️ 顺带一个纯语法坑（我连踩两次）：**块注释里别让连续星号紧邻斜杠** ——
  在注释里写 Markdown 粗体再跟斜杠分隔（如 `…图片…/…`）会拼出块注释结束符、**把注释提前闭合**，
  `tsc` 报一片莫名其妙的 TS1109 / TS1127 / TS1443，**从报错完全看不出是注释的问题**。

# 铁律⭐⭐：把某个数据「从内联快照换成后端读」时，必须逐字段对比新旧两条路径产出的对象（2026-08-05 加）

2026-08-05 修的线上 bug：工作流「使用提示词」当年为了给 canvas 瘦身，把参考素材从
「画布内联快照 `generationUploads`」改成「从后端权威 job 读」，新路径只造了
`{id, kind, name, url, status, progress}` —— **丢了 `durationSeconds` 和 `dimensions`**。
而发送前 `validateWorkflowUploadsForSubmit` **逐个校验参考视频的时长**，读不到就返回
「视频时长读取失败」→ **发送被永久拦死，而用户在界面上没有任何办法补上这个值**。

- ⭐ **判据（一行）**：把老路径的构造代码和新路径的构造代码**并排贴出来数字段**。
  本次老路径是 `{...rest}`（整份带过来）、新路径是手写的 6 个字段 —— **一眼就能看出少了什么**。
  ⛔ 别只测"功能看起来还在"：参考素材缩略图、@蓝字、提示词**全都正常显示**，
  唯一坏掉的是**一个只在点发送时才跑的校验**。
- ⭐⭐ **反向也要查一遍：这个字段有谁在校验它？** grep 那个字段名，看有没有
  `if (!x) return "…失败"` 这种**硬拦**。凡是「缺了就拒绝、而且用户补不了」的字段，
  都属于**必须带过来的**，不能算"可选元数据"。
- ⭐ **修法优先级**：① 后端权威直出（本次从 `MediaAsset` 反查，值本来就在库里）
  ② **再加一个"节点自愈" effect** —— 因为**坏数据已经存进数据库了**，只修新建路径救不了老数据。
  自愈要放在**那个对象自己身上**（本次是节点的输入框组件），
  ⛔ 别只放在"触发它的那条操作路径"上，那样已经存坏的老数据永远好不了。
  ⭐ 自愈必须配 `attemptedRef` 之类的**只试一次**保护，失败也不重试。
- ⛔⛔ **自愈会写值 → 必然影响"内容变了没"的判定**：本次自愈写 `uploads[].durationSeconds` 后，
  **仅仅打开一次工作流就会被 `getWorkflowMeaningfulSnapshot` 当成"用户改了内容"顶到列表最前面**。
  → 凡是新增"打开就自动补齐"的派生字段，**都要同步加进那个函数的剥离清单**
  （注意它原来只剥 `node.data` 顶层的 `durationSeconds`，**漏了 uploads 里面那一层**）。
  ⭐ 二值验证：记下列表顺序 → **只打开、不做任何编辑** → 看它有没有跳到最前。

# 铁律：上传「秒回预检 / 内容哈希」在 HTTP 测试入口一定失效，验它必须用 HTTPS 入口（2026-08-03 加）

`computeFileContentHashHex` 用的是 `crypto.subtle`，而 **`crypto.subtle` 只在安全上下文（HTTPS 或 localhost）才有**。
测试服的 **HTTP 入口 `http://101.37.129.164:8080/` 不是安全上下文** → `crypto.subtle` 为 undefined →
`computeFileContentHashHex` 返回 undefined → **M033 图片秒回预检、M034 分片的整体哈希校验、原有文档秒回预检全部自动跳过**。
- ⭐ **这是既有设计的软降级、不是 bug**（拿不到哈希就走正常上传）。但会让人以为"预检没写对"。
- ⭐ **判据**：`page.evaluate(() => window.isSecureContext)` 一句就能确认。要验预检/哈希，
  一律用 **`https://staging-static.venusface.com/`**（安全上下文），别用 8080。
- ⭐ 实测：8080 传图看不到 GET 预检、分片也不带 `originalContentHash`；换 HTTPS 立刻两者都出现、预检命中返回 `{url}`。
- ⚠️ 顺带：**Playwright 上传文件的路径必须在 workspace 根内**（`E:\project\FlashMuse_Agent` 或 `.playwright-mcp`），
  放 temp 目录会 `File access denied ... outside allowed roots`——先把测试文件 copy 进 `.playwright-mcp` 再传。

# 铁律⭐⭐：腾讯↔阿里传文件一律走「并发分片」，⛔ 单流必挂；判"链路烂不烂"看丢包不看延迟（2026-08-04 加）

2026-08-04 用户报「正式服生的两条视频过了很久都没法看」。**根因不是生成失败、不是没设计同步，
是「同步一直在跑但对大文件 100% 失败」**：`ali-sync.ts` 原来用 `rsync -azR` **单流**推，
而腾讯新加坡↔阿里杭州这条跨境线 **RTT 278ms、丢包 20~25%**，单流被拥塞控制压死只有 **15~30 KB/s**
→ 18.8MB 视频要 10 分钟以上，而代码里 rsync 超时写的是 **120 秒 = 一次都不可能成功**。
线上诊断日志实测 `aliSynced` **成功 43 / 失败 79**，失败的几乎全是视频（图片小、能挤过去，所以长期没暴露）。

- ⭐⭐ **真凶是丢包，不是延迟**（这条最反直觉、最容易归因错）：
  阿里→BytePlus RTT **398ms 比腾讯的 278ms 还高**，但 **0 丢包 → 752 KB/s**；
  阿里→OpenRouter RTT 173ms、0 丢包 → **3,974 KB/s**。
  → 所以**阿里云的国际出口其实很好，唯独「阿里↔腾讯新加坡」这一对烂**（traceroute 看到第 18 跳
  一下 +190ms，明显绕远；末段丢包 20~40%）。⛔ 别再说"阿里云默认国际出口就这样"（我说错过一次）。
- ⭐ **并发是唯一免费解药，且有最优值**（实测，⛔ 别凭感觉调）：
  单流 15~30 / **4 并发 147 / 8 并发 357 / 16 并发 461 / 32 并发 329 KB/s** → **16 最优，32 反而更差**。
  真实文件实测更好：20.9MB 视频 **571 KB/s**、18.9MB **586 KB/s**、9.9MB **606 KB/s**（0 重试）。
- ⭐⭐ **必须「按分片并发」+「小文件跨文件并发」两条路都有**，少一条就有场景退化成串行：
  ① 只按文件并发 → 治不了单个 20MB 大视频；
  ② 只按分片并发 → 941 个小缩略图每个只有 1 片 = 单流，退化成串行；
  ③ **固定 1MB 片会坑中等文件**：2.72MB 只切 3 片 = 只用到 3 个并发，**实测只有 44 KB/s**
     → 片大小必须**自适应** `clamp(ceil(size/并发数), 256KB, 1MB)`。
- ⭐ **唯一实现 = `deploy/ali-parallel-pull.sh`**（阿里侧 curl Range 并发拉腾讯 nginx 的 `/generated`），
  被两个调用方共用：`src/lib/ali-sync.ts`（生成后自动同步）+ `scripts/backfill-ali-media.sh`（补历史缺口）。
  ⛔ 别再写第二份分片逻辑。⛔ **别按文件逐个建 SSH 连接**：这条链路 SSH 握手实测 **4~12 秒**
  （丢包让 SYN 只能 RTO 翻倍等），必须「一次握手 + 清单从 stdin 喂进去」。
- ⭐ **必须逐片校验字节数**：丢包链路上 `curl` 会**提前结束却仍返回成功** → 不校验就拼出坏文件。
  整体再校验 md5，然后 `mv` 原子落地（同分区），用户绝不会读到半截文件。
- ⛔⛔ **root 建的日志文件会让容器里的 app 写不进去**（2026-08-04 踩到，排查了一轮）：
  补数据脚本以 root 跑，**首次创建** `.runtime/transfer-diagnostics-log.jsonl` → 属主 root，
  而 app 以 uid 1000(node) 跑 → `appendFile` 失败被 catch 静默吞掉 →
  **同步明明成功，但应用侧一条日志都没有**。判据：`ls -la` 看属主，其它诊断日志都是 `ubuntu netdev`。
  → 凡是「脚本和 app 都会写的文件」，脚本写完必须 `chown 1000:1000`。
- ⭐ **`ALI_SYNC_PULL_BASE_URL` 必须配**（正式 `:5000`、测试 `:5001`），没配会**静默退回单流 rsync**
  （故意留的兜底，日志里 `via:"rsync"` 能看出来）。⚠️ env 在服务器上、**不随代码同步**，
  部署新服务器/重建 env 时别忘了它。
- ⭐ **速度全部落 `.runtime/transfer-diagnostics-log.jsonl`**（🗣️ 用户要求「按时间记速度，
  不同时间速度不一样，以后看日志再优化」）：`ts`+`tsEpochMs`、bytes、durationMs、kbps、
  concurrency、chunks、retries、via、requestId/userId/model。唯一实现 `src/lib/transfer-log.ts`。

# 铁律⛔⛔：改「单文件 bind mount」进容器的配置，用 `cp` = 换 inode = 容器里永远是旧文件（2026-08-04 加，查了三轮）

`- /opt/flashmuse/data/nginx/flashmuse.conf:/etc/nginx/conf.d/default.conf:ro` 是**单文件**挂载，
Docker 在**容器启动那一刻按 inode 绑定**。你在宿主机 `cp 新文件 目标` → 目标变成**新 inode** →
容器里看到的还是创建时那个**旧 inode**。最坑的是**一切都显示成功**：
**宿主机文件确实更新了、`nginx -t` 通过、`nginx -s reload` 也返回成功** —— 配置就是没生效。

- ⭐ **判据（一行，二值）**：`sudo docker exec <容器> wc -l <挂进去的路径>` 与宿主机 `wc -l` **行数不一致**；
  或在容器里 `grep -c 你新加的关键字` 得到 0。⛔ 别拿 `nginx -t` / reload 成功当"生效了"。
- ⭐ **正解**：改这类文件一律 **`cat 新文件 > 目标文件`**（原地写、保住 inode）。
  ⛔ `cp` / `mv` / **`sed -i`（它也换 inode！）** 全都会踩。
- ⭐ **已经 `cp` 过怎么救**：只能 `docker compose up -d --force-recreate <那个容器>`（reload 没用）。
  ⚠️ 重建正式服 nginx 前先 `docker compose config` 确认展开后的**证书路径真实存在**
  （见本文件那条「443 证书/挂载路径」铁律，写错会让 443 全站挂）；重建约 20 秒不可用。
- ⚠️ **目录挂载没这个问题**（`/srv/generated` 那种），只有**单文件**挂载有。

# 铁律⛔⛔：远端要跑多条命令，一律写 `.sh` scp 上去跑 —— PowerShell 会吃掉 ssh 里的内层引号（2026-08-04 加）

`ssh host "cmd1; cmd2; cmd3"` 经 PowerShell 5.1 传给 OpenSSH 后**内层双引号丢失** →
**只有 `cmd1` 在远端跑，`cmd2`/`cmd3` 在本地跑**。症状极具误导性：
2026-08-04 同一条命令里 `whoami` 输出 `root`（远端）紧接着 `id` 输出 `uid=1000(ubuntu)`（本地），
**自相矛盾**；还据此误判过「阿里那把 key 没权限 / 阿里上 `/etc/nginx` 不存在」（单条命令跑完全正常）。

- ⭐ **姿势**：写成 `.sh` → `scp` → **`sed -i 's/\r$//'`**（Windows 行尾）→ `bash` 跑。只有**单条简单命令**才允许内联。
- ⛔ `$(...)` / `$?` / `$K` 这类同理：会在**本地**或**中间那台**被提前展开，别内联（`$?` 拿到的是中间机的退出码，不是远端的）。
- ⭐ 顺带：`curl -o /dev/null -w '%{http_code}'` 这种带 `%{}` 的也常被吃坏 → **一起放进 .sh**。

# 铁律：内部台账/日志类文件绝不能落在 `public/` 下（2026-08-04 加，真泄露过）

`videos/manifest.json`（视频恢复台账，最近 500 条）历史上落在 `public/generated/videos/` 下，
而 `/generated/` 是 nginx 直接 serve 的**公网无鉴权**目录 → 实测
`https://static.venusface.com/generated/videos/manifest.json` 返回 **200 + 1.68MB 明文**，
里面有**全站用户的完整提示词、用户 ID、供应商预签名下载地址**（24h 内谁都能直接下片）。

- ⭐ **判据**：问「这个文件前端/CDN 需要读吗」。**只被服务端从本地磁盘读** → 就该放 `.runtime/`，
  和三个 diagnostics 日志同级。唯一实现现在是 `src/lib/video-manifest.ts` 的 `.runtime/video-manifest.json`。
- ⭐ **迁移三件套**（照抄）：① 读**先新位置、没有回落老位置**（历史数据不丢）
  ② 写用 **tmp + rename** 原子落地（原来直接 `writeFile`，并发能读到半截 JSON）
  ③ 写成功后 **`unlink` 老位置那份**（自我清理，不用手动上服务器 rm）。
- ⭐ **再加一道 nginx 精确 404 兜底**：`location = /generated/videos/manifest.json { return 404; }`
  （`location =` 精确匹配优先级高于前缀匹配）。⚠️ 阿里正式那份 conf 混着别的项目 →
  用幂等增量脚本 `deploy/ali/ali-deny-video-manifest.py`（marker + 计数断言 + 别的项目条数不变断言 + 失败回滚）。
- ⭐ 顺带留档：**阿里侧其实没有这个文件的本地副本**（一直是 `try_files → @generated_proxy` 回源腾讯拿的）
  → 腾讯那份被代码删掉，泄露就从源头断了。**判"镜像上到底有没有这个文件"要 `ls` 真实路径，别看 curl 返回 200。**

# 铁律：mp4 的 `moov` 在文件尾部会让视频"开播很慢"，而它是**压缩顺带做的** `+faststart` 带来的（2026-08-04 加）

同一次排查里发现的第二个原因：**供应商原始 mp4 的 `moov`（索引）都在文件末尾**
（BytePlus 实测在 99.89%、OpenRouter H3 在 99.93%），浏览器得先把尾部捞出来才能开播。
而 `compressGeneratedVideoInPlace` 的 `-movflags +faststart` 正是把 moov 挪到开头（压过的那份实测在偏移 **36**）。

- ⚠️ **`compressGeneratedVideoInPlace` 只有「压完更小」才替换原文件**（`local-assets.ts:240`）→
  H3 这类本身编得好的 2K 视频**压完更大 → 保留原文件 → 没有 faststart** → moov 留在尾部。
- ⛔ **所以「把视频压缩整个去掉」是有副作用的**：所有视频都会退化成 moov 在尾部。
  🗣️ **2026-08-04 用户最终拍板：压缩和重封装都保留、保持现状**（只改传输为并发）。⛔ 别再提去掉压缩。
- ⭐ 判据（一行命令）：`grep -abo moov file.mp4 | head -1` 看偏移占全文百分比。

# 铁律：「先展示远程 url 让用户马上能看」对 OpenRouter 视频不成立（2026-08-04 加）

`https://openrouter.ai/api/v1/videos/{id}/content` **要 Bearer 密钥**，不带就是
`401 {"error":{"message":"No cookie auth credentials found"}}` → **不能直接把这个地址给浏览器**。
BytePlus 那边是**预签名 url**（实测 206 + `Accept-Ranges: bytes`），可以直接播。
⭐ 而且腾讯从 OpenRouter 下载实测 **9.2 MB/s（19.8MB 只要 2.2 秒）**、从 BytePlus **40 MB/s**
（同在新加坡，RTT 1.7ms / 4.3ms）→ **压根不需要展示远程，等本地落地即可**。

# 铁律：验"上游/镜像两端文件是不是同一份"，比 md5 不比大小（2026-08-04 加）

2026-08-04 想让「阿里直接从供应商下载」绕开烂链路，**md5 一比就发现只有一半可行**：
- OpenRouter H3 视频：腾讯本地 md5 = 阿里从供应商下的 md5（19777685 字节完全一致）✅
- BytePlus Seedance：供应商 11,993,236 → 腾讯本地 **10,429,641**（被 ffmpeg 压过）❌
- **图片 100% 不一致**：`encodeGeneratedImageBuffer` 把所有生成图**无条件转成 JPEG**（quality 95、
  mozjpeg、4:2:0、flatten 白底），连扩展名都变 `.jpg`（只有 `keepTransparent` 例外）。
→ 结论：**凡是本地会做后处理（压缩/转码/生成封面缩略图）的资源，都不能假设"两端各自下载就一样"**，
必须从「已经处理好的那一端」传。这也是最终选了「阿里从腾讯并发拉」而不是「阿里直连供应商」的原因。

# 铁律：验「上游到底给没给这个字段」= 拿历史任务 id 去 GET 上游 + 回库看账本，⛔ 别读类型声明（2026-08-03 加）

上一任把「MiniMax H3 到底扣没扣到钱」当成**查不清的遗留风险**交接出来，理由是
`OpenRouterVideoTask` 类型里**没声明 `cost`**（`openrouter-video.ts:34`），万一不返回就 `usd=0` = **白送**。
⭐ 实际两步、几分钟就能坐实，两步都是**二值判断、没有解释空间**：

1. **拿一个历史已完成任务的 id 直接 GET 上游**（幂等、免费、不烧一分钱）——
   从 `.runtime/generation-diagnostics-log.jsonl` grep `*-create-success` 就有 taskId：
   `GET https://openrouter.ai/api/v1/videos/{id}` → 真的返回 `{"usage":{"cost":1.95,"is_byok":false}}`。
2. **回库看账本那一行**：`creditLedger` 里 `usd=1.95 / credits=137`，和 `usd × 汇率 × 积分率` 完全对得上。

- ⛔ **类型声明 / 文档 / 别人写在 CHANGELOG 里的报价，都不是证据**
  （那份"实测 5 秒 $0.65"是**直打上游**量的，压根不代表我们的链路拿到了 cost）。
  同源于本文件那条「报根因前先把 `if` 条件抄出来逐项验证」。
- ⛔ **别信"本地没 `DATABASE_URL` 所以查不了库"** —— 上一任只看了 `.env.local`，
  **`DATABASE_URL` 在 `.env` 里**。查库前把 `.env` / `.env.local` **两个都看一遍**。
  （在项目目录里跑 `.mjs` 脚本才 import 得到 `@prisma/client`，放 temp 目录会 `ERR_MODULE_NOT_FOUND`。）
- ⭐ **顺手要做的两件事**：① 给"金额靠上游某字段"的链路加**兜底定价**
  （缺字段就按公式算，并打个 `usdFromFallbackPricing` 标记）—— `usd=0` 是**静默白送**，不报错、不进红字；
  ② 给**只落库不写日志**的那条路补一行诊断日志（本次 `video-job-charged`）——
  "扣费成功零日志"正是这件事三次交接都验不成的根本原因。
- ⭐⭐ **2026-08-19 补：验"新接的模型扣费对不对"的判据是三条，缺一不可**：
  ① 真调一次上游看它到底给不给 `usage.cost`（Recraft V4.1 = `0.035`、Pro = `0.21`，**给**）；
  ② **再发一次 `n=2`**，确认 cost **按张线性**（0.07）→ 一次排除"多张少收"这种只在多图时才漏的钱；
  ③ 真跑一次后回库看 **`CreditLedger` 那一行**（`credits / usd / cny / imageCount`），
  与 `round(usd × usdToCnyRate × creditsPerCny)` 对得上。
  ⭐ 顺带：**界面上「X积分/张」的提示必须和扣费用同一个公式**
  （本项目 = `models.ts` 的 `getGenerationModelSelectHint` ↔ `credits.ts` 的 `chargeCredits`），
  否则就是"标价和实收不一致"。



# 铁律⛔⛔：`overflow:hidden` 裁剪到 **padding box** —— 给固定元素留位只能用"真正占宽的兄弟节点"，不能用 padding（2026-08-09 加）

2026-08-09 做顶部公告走马灯时踩到：滚动容器用 `padding-right: 48px` 给右侧的 × 留位，
**静态居中时看着完全正常，一旦文字滚起来就穿过 padding 压在 × 上**（窄屏 414 实测两个字叠成一团）。
- ⭐ **根因是 CSS 规则本身**：`overflow` 的裁剪边界是 **padding box**，**padding 区域属于可绘制区** →
  padding 挡不住任何"会移动/超长"的内容。
- ⭐ **正解**：把那个固定元素做成 **flex 兄弟节点、真正占宽**（`w-12 shrink-0`），
  滚动区 `flex-1 min-w-0 overflow-hidden` → 裁剪边界就落在它左边。
  ⭐ 二值判据：`滚动区.getBoundingClientRect().right <= 固定元素.left`。
- ⭐ 同理适用于任何"跑马灯 / 横向滚动 / 长文本省略"旁边放按钮的场景。
- ⚠️ 顺带：**量"宽度变化"要用 `ResizeObserver` 盯容器，不能只听 `window resize`** ——
  侧边栏折叠、后台内容区变宽这类"窗口没变但容器变了"的情况听不到。

# 铁律：顶部公告横幅的两条已拍板口径，⛔ 别改回去（2026-08-09 加）

- ⭐ **唯一实现 = `src/components/announcement-banner.tsx` 的 `AnnouncementBar`**，
  **前台横幅与后台「顶部公告」页的预览条共用它**（原来各写一份长相，改前台后台不跟着变）。
  高度**固定 50px**、文案**永远单行不换行**、放不下走**匀速 30px/秒**走马灯（首尾空 96px、两份副本无缝相接）。
  ⛔ 走马灯位移量必须是"一份副本长度"，别写 `translateX(-100%)`（那取决于容器宽度、接缝会错开）。
  ⭐ 速度要**恒定 px/秒**而不是恒定时长，否则文案越长滚得越快、长公告看不清。
- ⭐ **后台预览宽度 = 铺满右侧内容区**（🗣️ 用户 2026-08-09 明确要求）。
  ⛔ **别再改成"按视口宽度呈现"** —— 我试过，后台页在窄屏下有横向滚动、内容区比视口更宽
  （实测视口 900 时内容区 1244），限制成视口宽会**铺不满、露出灰底**，被用户当场否掉。

# 铁律⭐⭐：「某个模式支持传什么、传几个」只改 `upload-rules.ts`，⛔ 别在组件里判（2026-08-09 加）

2026-08-09 用户要求「2.5 选视频编辑/延长后，不支持的上传按钮要取消、视频数字改成 1」。
⭐ **正解是改 `src/lib/upload-rules.ts` 的 `getBaseUploadRule`（唯一权威）** ——
工作流的 `canShowWorkflowUploadButton` 本来就按 `rule[kind].enabled` / `maxCount` 决定按钮显不显示，
对话流的 accept、`getSupportedUploadTypeLabel`、拖拽校验、`pruneWorkflowUploadsForRule`（切模式自动剪掉多余上传并从提示词删 @名）
**全都读同一份 rule** → 改一处，三条路（对话流/工作流/服务端）一起生效，一行组件代码都不用动。

- ⭐ **配套三件事，缺一就有漏**：
  ① **`getUploadRuleOverrideKey` 要给"上游硬规则"的模式一个后台面板里不存在的 key**
     （沿用 Hailuo 3 帧模式的先例）—— 否则后台把「融合模式」的数量调大，会把 edit/extend 一起放宽、必被上游拒；
  ② **服务端必须自己再兜一遍**（`openrouter-video.ts` 里 `mediaMax` / `audios`）——
     前端隐藏了按钮，但直调接口、工作流连线进来的上游节点媒体都绕得过；
  ③ **`<input type="file">` 的 `multiple` 要跟着 maxCount 走**（只准 1 个就别 multiple），
     否则用户一次选好几个再被逐个提示拒掉。
- ⭐ **数字文案**：`1-{maxCount}` 在 maxCount=1 时显示「1-1」很怪 → 只显示「1」。
- ⭐ **验法（几秒钟、二值）**：`npx tsx` 真 import `upload-rules.ts` 跑规则矩阵，
  ⛔ **必须带反向用例**（本次 29 条里 11 条反向：融合仍 30/10/10、2.0 仍 9/3、首帧 1、首尾帧 2、图片模式不受影响）。
  再加一条最硬的：**去服务端诊断日志看那次真实请求的 `imageCount/videoCount/audioCount`**。

# 铁律⛔⛔：**正式服的「顶部公告」一律不许测试**（2026-08-09 用户拍板）

公告是**全站所有用户都会看到**的东西 —— 在正式服开一次测试公告，等于把测试内容推到每个真实用户脸上，
而且会在发布历史里留下假记录、给用户的 `AnnouncementDismissal` 写脏数据。

- ⛔ **正式服禁止**：开启/关闭公告开关、输入测试文案、点前台 × 关闭。**连"开一下马上关"都不许。**
- ✅ **公告只在测试服和本地测**（测试服随便开，那里没有真实用户）。
- ⭐ 正式服部署后的巡检清单里，**公告那几项直接跳过**，只允许"打开后台『顶部公告』页看它不报错"这一项
  （⛔ 不许动开关、不许改文案）。

# 铁律⛔⛔⛔：写/改任何文件**只准用 edit/write 工具**，shell 永远不许写文件；且 `git checkout`/revert 前先查该文件有没有「别批次的未提交改动」（2026-08-20 第七十次会话，我又栽同一个坑还扩大了损失）

2026-08-20 我为了给 `chat-workbench.tsx` 加**一句 ASCII import**，图快用了
`(Get-Content -Raw) -replace ... | Set-Content -Encoding UTF8` → **整份中文被 GBK 双重编码损坏 + 加了 BOM**。
补救时更糟：`git checkout -- <file>` 图快 → 把这个文件里**上一批次（Recraft，第 67 次会话）尚未提交的改动一起 revert 掉了**，
把一个"编码事故"升级成"丢了整个功能"。最后靠**测试服 v1.0.1.0 的源码** scp 回来才捞回。

- ⭐⭐ **操作红线（无例外）**：**任何"写文件/改文件"只准走 edit / write 工具。** shell 只用于
  git / tsc / eslint / curl / scp 这类，**绝不许**用它的 `Set-Content` / `Out-File` / `-replace` 回写 /
  `>`、`>>` 重定向 / `sed -i` 去改**任何**文件（**不管是不是纯 ASCII、不管是不是源码**）。
  ⛔ 不给自己留"这次只改一句 ASCII / 只往顶部插一段"这种例外——**那正是踩坑的入口**。
- ⭐⭐ **"看到规则"≠"执行规则"**：下面那条"禁止 PS 读写中文文件"我上下文里一直有、也记得，照样栽了。
  根因是**动手那一刻凭手感、没在执行前过一遍规则**。所以把它固化成"动作级"约束（上一条），别靠"要记得"。
- ⭐⭐ **`git checkout` / `git restore` / `git stash` 前，先 `git status` 看那个文件是不是 ` M`**：
  本项目长期"多批未提交改动叠在工作区"（部署流程决定的）→ 对单文件做 whole-file revert 会**静默抹掉别的会话攒下的功能**。
  要丢弃改动前先想清楚"这个文件里除了我这次的，还有没有别人的"；宁可用 edit 工具逐处回退，也别一键 checkout。
- ⭐ **一旦已经用 PS 把中文文件写坏了**：GBK 反向恢复**是有损的**（本次 921 个 U+FFFD，不可接受），别指望它救回来；
  **优先找"另一份完好的源"**——git HEAD、**测试服/正式服上已部署的源码**（`scp` 取那一个文件）、别的备份盘，
  用 `Copy-Item`（字节复制，不经编码）回来，再用 edit 工具重做丢失的那少量改动，最后 `tsc` + 逐一核对。

# 铁律⛔⛔：**绝对禁止用 PowerShell 读写含中文的任何文件**（源码 **和交接文档/Markdown 都算**）（2026-08-03 加；2026-08-09 我又栽了一次，扩写）

⚠️⚠️ **2026-08-09 复发**：我为了往 `handover/CHANGELOG_2.md` 顶部插一条会话记录，用了
`$c = Get-Content x.md -Raw; Set-Content x.md -Value ($new + $c) -Encoding UTF8`
→ 把当时**尚未提交**的第 50~53 次会话条目（285 行）整段变成 mojibake。
⭐ **教训一句话：这条禁令不只管 `src/`，交接文档、CHANGELOG、任何含中文的文件全都算。
「往文件顶部插一段」这种最平常的操作就是最容易踩的地方 —— 一律用 read + write 工具，或写 `.js` 用 node 做。**
⭐ **能救回多少取决于有没有 commit**：已提交的部分 `git show HEAD:` 一取就完好；
**未提交的那部分只能靠 GBK 反向转换**，而它**确实不无损**（本次 150 行救回来带 760 个 `U+FFFD`，标点/换行被吞）
→ ⛔ 别去猜着补标点（等于伪造记录），原样保留 + 在文件里写明"编码受损原文"。
⭐ **恢复时的硬校验**：把还原结果与 `git show HEAD:` 的内容比对，能精确区分"哪段真丢了、哪段完好"。
⚠️ 另一个连带坑：**PS5.1 读 `.ps1` 脚本文件按 ANSI 解码** → 脚本里写中文注释会让紧随的语句被吃掉
（本次报"无法索引 Null 数组"，查了两轮）→ **临时 `.ps1` 里只许写 ASCII**。

2026-08-03 我为了把 `React.useMemo` 批量改成 `useMemo`，用了
`(Get-Content x.tsx -Raw) -replace ... | Set-Content -Encoding utf8 x.tsx`
→ **PS5.1 的 `Get-Content` 按系统 ANSI（GBK/936）解码 UTF-8 文件**，中文全变 mojibake（双重编码），
`Set-Content -Encoding utf8` 又**加了 BOM**。当时那个文件里还有**未提交的一整批改动**，不能 `git checkout` 丢掉。

- ⛔ **禁止的写法**（哪怕只是替换 ASCII 标识符）：`Get-Content|Set-Content`、`Set-Content`、`Out-File`、
  `-replace` 管道回写、`git show HEAD:x > tmp`（PS 重定向写 UTF-16LE）。
- ⭐ **正解**：改文件一律用 **edit/write 工具**；要批量替换就用 **node**
  （`fs.readFileSync(p,'utf8')` → replace → `fs.writeFileSync(p, s)`，node 默认 UTF-8 无 BOM）。
- ⛔⛔ **"反向转回来"这条路不通**：把 mojibake 串按 GBK 编码写回**不是无损的** ——
  UTF-8 三字节中文被 GBK 解码时经常**把紧跟其后的 ASCII 字符（引号/换行）一起吃掉**，实测残留 373 行 `U+FFFD`。别试。
- ⭐ **真能用的恢复手法（留档，下次照抄）**：
  ① 损坏文件另存做「代码结构参照」（**ASCII 部分完好**，只有中文烂了）；
  ② `git show HEAD:<path>` 用 **node** 取出干净底写回工作区；
  ③ 「**精确相等行做锚点 + LIS 单调对齐**」逐块配对：块内行数相等 → **纯 ASCII 行取参照**（= 你的真实代码改动）、
     **含中文行取 HEAD**（= 未改动行，顺手去乱码）；块内行数不等 → 是真加/删了行，单独人工处理；
  ④ ⭐⭐ **必须再扫一遍「乱码行里粘着代码关键字」**：乱码会把
     **注释行和它下一行的 `const` 定义粘成一行**，机械重建时那行代码会被当成注释一起丢掉
     （本次就丢了 `const isMultiColumnDurationMenu = ...`，靠 `tsc` 才暴露）。
     正则 `/[\u3040-\u9fff].*\s{2,}(const |let |if \(|return |show|set[A-Z])/` 一扫就出来。
  ⑤ 验收四件套：**无 BOM + 0 个 `U+FFFD` + 0 个 mojibake 字符 + `tsc`/测试全过**，
     再**逐行列出「与 HEAD 不同的中文行」人工确认条数和内容都是你本次该改的**。
- ⚠️ 另外记住：**PS5.1 控制台显示 UTF-8 中文会花屏，那是显示问题不是文件坏了**（看内容用 read 工具）；
  **`ConvertFrom-Json` 解析含中文的 jsonl 会整行报错** → 分析日志一律用 node。

# 铁律：tldraw 工作流节点里的自定义拖动控件，必须用原生 `<input type="range">`（2026-08-03 加，我连续归因错 3 次）

包着工作流视频/图片节点编辑器的容器上写着 **`onPointerDownCapture={stopCanvasPointer}`**
（`workflow-tldraw-canvas-inner.tsx:2795`，`stopCanvasPointer` = `event.stopPropagation()`，2517 行）。
**React 的捕获阶段自根往下**，所以这个**祖先先执行并掐断传播** →
你在节点内部写的任何 `onPointerDown`/`onPointerDownCapture`（以及后续 move/up）**压根收不到事件**。

- ⭐ **判据**：**`onClick` 能用、pointer 事件全废** = 一定是被祖先的 capture-phase `stopPropagation` 吃了
  （原来的按钮式菜单一直没事，正是因为 click 是另一个事件类型）。
- ⭐ **正解**：用**原生 `<input type="range">`** 承接拖动（`opacity-0` 绝对定位覆盖在自定义外观之上，
  自定义的轨道/进度/手柄全部 `pointer-events-none` 只负责好看）——
  **原生 range 的拖动是浏览器内建默认行为，不受 `stopPropagation` 影响**。
  现成实现：`src/components/video-duration-slider.tsx`；更早的先例是橡皮擦画笔大小（同文件 2735 行）。
  ⭐ `min` 固定 `0`、`max` = 视觉量程最大值，让它的坐标系和视觉刻度**完全对齐**；在 `onChange` 里 clamp + snap。
- ⛔ **这三种都试过、都没用，别再走一遍**：① 自己的 handler 里加 `stopPropagation`
  ② 改成 `onPointerDownCapture/MoveCapture/UpCapture` ③ 把 move/up 挂到 `window`
  （第 ③ 种连"重渲染丢 pointer capture"的假设都是错的 —— `pointerdown` 本身就没到）。
- ⭐ 这条再次印证下面那条最贵的铁律：**报根因前先去读"我这段代码的祖先容器上挂了什么事件处理器"**，
  别从现象反推。

# 铁律：Playwright 点滑块/进度条的极值，用 0.98 别用 1.0（2026-08-03 加）

`boundingBox()` 拿到 `{x,w}` 后点 `x + w * 1.0` 是**元素右边界之外** → **漏点**（值一动不动），
我据此一度误判"原生 range 有 thumb 内缩、拖到最右到不了最大值"。
⭐ 用 `0.98`/`0.999` 复验才证明映射全宽正确。**极值一律用分数，别用 1.0/0.0 的整边界。**
⭐ 顺带：验拖动必须**真实 `mouse.down()` → 多次 `mouse.move()` → `mouse.up()`**
并在过程中读值，⛔ 直接 `fill()`/设 `value` 证明不了"能拖"。


# 铁律：说"压缩/瘦身能省多少时间"之前，先看同样大小的样本耗时方差（2026-08-02 加，我当场被数据打回）

我看到"上传 2.4MB 要 145 秒"就推断"体积砍 80%、时间也砍 80%" —— **对这批数据是错的**。
翻日志才发现：**同样 2.40MB 可以是 3.5s（694KB/s）也可以是 145.1s（17KB/s），差 40 倍；
0.13MB 的小文件也能卡 12.1s（11KB/s）**。→ 瓶颈是**丢包/线路抖动**，不是带宽。
- ⭐ **判据**：把同一尺寸档位的样本排开看方差。**方差几十倍 = 丢包受限**（压缩只能缩小"坏运气窗口"，
  治不了根；对症药是**分片 + 单片重传**）；**方差很小 = 带宽受限**（这时候压缩才按比例见效）。
- ⭐ 顺带：**先看"有多少比例真的慢"再决定值不值得做** —— 本次 93% 的上传其实 10 秒内就完了，
  只有 7% 掉坑，那么"对 93% 无感知"的方案就该降优先级。
- ⛔ 别把"最坏的那一条"当成常态去设计方案。

# 铁律：给轮询"降频/加门控"之前，先问它除了心跳还兼着什么判定（2026-08-02 加）

上一批给 3 条定时轮询加了「标签页 `hidden` 就 `return`」，其中 `/api/auth/workspace-instance`（2 秒那条）
**同时是「同账号被别的标签页接管 → 本页 `location.replace("/")` 自我下线」的唯一判定**
（`chat-workbench.tsx:2950`）。停掉的后果：后台里那个已失去 claim 的旧标签页**继续自动保存**，
把新标签页的编辑覆盖掉 = **静默丢用户数据**。

- ⭐ **姿势**：把那个轮询的响应**逐个分支读完**，看有没有 `location.replace` / `setState(致命态)` /
  幂等锁释放这类"不只是上报"的动作。只要有，就**不能停，只能降频**（本次改成 hidden 时 30s）。
- ⭐ **二值验证**：开两个标签页 → 让 B 置前（A 自动变 hidden）→ 等够降频周期 → **看 A 的 URL 变没变**。
  变了 = 保险还在。⛔ 别用"控制台没报错"当通过。
- ⭐ 反过来也要判：`/api/auth/me`（会话失效有 focus 补检查）、媒体落地轮询
  （成品图是服务端在成功那刻落库的，不依赖前端）**确实可以停** —— 逐条给出"为什么能停"的理由，别一刀切。

# 铁律：在 node 里比对 git 里的文件内容，别经 PowerShell 落盘（2026-08-02 加）

`git show HEAD:x.ts > tmp.txt` 在 PowerShell 里写出的是 **UTF-16LE**，node 用 `'utf8'` 读回来
每个字符之间夹着 `\0` → **所有正则都匹配不到**，我据此一度误判"原文件里根本没有 `ChatWorkbench`"。
⭐ 正解：`execSync('git show HEAD:x.ts', {maxBuffer:1e9}).toString('utf8')` 直接在 node 里拿。
⭐ 顺带：审"机械拆分"这类大 diff 时，**按行分类统计**比通读快得多也更硬
（本次：405 行新增里 383 行只是加了 `export ` 前缀 → 剩 22 行人工看完）。

# 铁律：改 compose / 挂载路径 / 端口之前，先把**服务器上那份**打印出来逐行比（2026-08-02 加，差一步打挂正式服 443）

2026-08-02 复核上一批时抓到：仓库的 `docker-compose.yml` 把 443 证书写成
`- /etc/letsencrypt:/etc/letsencrypt:ro`，而**这台机器上根本没有 `/etc/letsencrypt`**
（acme.sh 装在 `/opt/flashmuse/data/letsencrypt`）→ Docker 会**默默创建一个空目录**挂进去 →
nginx 找不到证书起不来 → **main/api 两个域名 443 全挂**。

- ⛔⛔ **仓库里的 compose 长期和服务器漂移**（服务器早就有 443 端口和 data/letsencrypt，仓库那份还是旧的）。
  "补齐仓库"时**照想象写**就会造出这种炸弹。
- ⭐ **姿势**：改 compose 前 `sudo cat /opt/flashmuse/docker-compose.yml` 打出来逐行比；
  改完 `docker compose config` 看**展开后的真实路径/端口/密码**，再 `up -d`。
- ⭐ **判据**：凡是 `- /宿主机路径:/容器路径` 里的宿主机路径，都要 `ls` 一遍确认**真的存在**。
  Docker 对不存在的路径不报错，只会给你一个空目录。
- ⛔ **别指望测试服能替你测出来**：测试服**没有 443 server 块**，这个洞在测试服怎么点都是好的。
  → 通用结论：**两服有差异的那部分（本项目 = 443/证书/入口 conf），测试服天然覆盖不到，必须在正式服上单独核对。**

# 铁律：加接口限流之前，先想清楚"到这一层时 `$remote_addr` 是谁"（2026-08-02 加）

上一批给腾讯 nginx 加了 `limit_req_zone $binary_remote_addr ... rate=20r/s` + `burst=60`，两个真坑：

- ⛔⛔ **国内用户全部经阿里回源，到腾讯这一层 `$remote_addr` 只有阿里那一个 IP**
  → 等于把**全部国内用户算成一个客户端**共用 20r/s，几个人同时用就一起 429。
  ⭐ 修法：`set_real_ip_from 101.37.129.164; real_ip_header X-Real-IP;`
  （**只信阿里那一跳**，直连的客户端伪造 X-Real-IP 无效）。
- ⛔ **`location /` 也代理 `_next/static`**（腾讯侧没有本地静态镜像）→ 冷启动一个页面瞬间几十个请求，
  `burst=60` 会把**真实用户**打成 429 白屏。限流是拦"每秒成百上千"的滥用，别跟正常用户较劲 → 50r/s + burst 200。
- ⭐ **验证方式（二值、没有解释空间）**：`for i in $(seq 1 100); do curl ... & done; wait`
  —— 全 200 才算过；顺便 `docker logs <nginx>` 看日志里记的是**真实客户端 IP** 还是阿里的 IP。
- ⭐ **两服限流层数必须一样**：阿里正式那份 `flashmuse-static-ip`（混着别的项目、没碰）没有限流，
  所以**阿里测试那两份的 limit_req 要删掉** —— 否则"测试服 429 但正式服不会" = 测出来的不作数。

# 铁律：给接口加"归属校验"时，回头确认**我们自己的合法调用**还过不过得去（2026-08-02 加）

上一批给 `GET /api/byteplus-assets?id=` 加了「查 `UserAssetState.bytePlusAssetId` 才放行」，
但 **POST 送审那条路从来不落库这个 id**（只存在前端 state）→ 用户点「刷新审核状态」
永远拿到 404「素材不存在」，**手动审核功能直接废掉**。

- ⭐ **姿势**：加校验后，把"这个字段是谁写进去的"grep 一遍
  （`grep bytePlusAssetId` 一眼看出只有视频链路的自动送审在写）。
  校验依赖的数据没人写 = 校验必然拒绝所有人。
- ⭐ 同源问题也要防：**权限收紧类改动**（加登录、加归属、加白名单、加限流）
  一律要列出"现有调用方有哪几处"，逐处确认还能通。

# 铁律：把副作用从 setState updater 里移出去时，**映射本身要留在 updater 里**（2026-08-02 加）

上一批为修"在 updater 里发 fetch/自增编号"（React 可能重跑 updater），把
`setWorkflowItems(prev => ...)` 改成了「从 `ref` 读整份数组 → 算出 `next` → `setWorkflowItems(next)`」。
⛔ 这引入了新 bug：`ref` 只在 effect 里同步，**同一 tick 内若已有别处 `setWorkflowItems(fn)` 排队**
（例如生成回填），这里的整份 `next` 会把它**覆盖掉 = 成品图静默丢失**。

- ⭐ 正确切法：**纯映射留在 updater**（`prev.map(...)`，可重跑、可叠加）；
  **不可重复执行的副作用**（编号自增、发 PUT、埋点）放到 updater 外面。
- ⭐ 需要"最新整份数据"去发请求时，**在真正要发的那一刻从 ref 现取**，不要提前算好快照。

# 铁律：从 Windows 往服务器送文本文件，先 `sed -i 's/\r$//'` 再 diff（2026-08-02 加）

Windows 打的 tgz 里文本文件带 CRLF → 服务器上 `diff 服务器那份 新那份` 会显示**整个文件都变了**，
于是「只允许出现 `>` 行、出现 `<` 就停手」这条判据**当场失效**（看不出到底哪几行真改了）。

- ⭐ 顺序：传上去 → `sed -i 's/\r$//'` → **再** diff → `nginx -t` → reload。
- ⛔ **别依赖脚本里的 `if diff a b | grep -q '^< '; then exit 1; fi` 守卫**：2026-08-02 它没按预期触发。
  **把 diff 打出来人肉看一眼**，别把"脚本没退出"当成"没有 `<` 行"。
- ⛔ PowerShell `Set-Content -Encoding UTF8` **会加 BOM**（给 nginx conf 加过一次）。改带中文的文件一律用 edit 工具。
- ⚠️ PS5.1 的 `Get-Content` / `Select-String` **显示** UTF-8 中文会花屏 —— 那是**控制台解码问题、不是文件坏了**。
  2026-08-02 我据此误判过"文件成了 mojibake"，是用 `[System.IO.File]::ReadAllText` 数 `U+FFFD`（0 个）才排除的。
  **要看中文内容就用 read 工具。**


# 铁律：改 Next 配置项之前必须读 `node_modules/next/dist/docs/`，⛔ 不许照运行时错误信息里的名字写（2026-08-02 加）

2026-08-02 修"上传 >10MB 被 500"时，运行时错误信息给的配置名是 `middlewareClientMaxBodySize`（还带文档链接），
**那是旧名字** —— Next 16.2.4 已经把它改名成 **`experimental.proxyClientMaxBodySize`**
（证据在 `docs/01-app/02-guides/upgrading/codemods.md` 的 middleware→proxy 重命名清单里）。
⛔⛔ 照旧名字写下去，Next 不认识这个键、**静默无效** —— 配置没生效，但我们以为修好了。
⭐ 姿势：改任何 Next 配置项，先在 `node_modules/next/dist/docs/` 里 grep 到它当前的名字和位置
（尤其注意是不是在 `experimental` 里），再动手；改完 `next build`，确认它出现在
`Experiments (use with caution):` 列表里才算被接受。

# 铁律：middleware/proxy 的 matcher 改了之后，要测编译产物里的正则，别只 curl 几个接口（2026-08-02 加）

⭐ **2026-08-02 已迁移**：`src/middleware.ts` → **`src/proxy.ts`**（Next 16 把 middleware 文件约定改名 proxy，
函数名 `middleware` → `proxy`），matcher 的排除名单**已从前缀匹配换成整段匹配**
（`(?!(?:upload-file|asset-upload-temp|upload-image)(?:$|/))`，不会再误伤 `/api/upload-filex` 这类撞前缀的新路由）。
以下规则对 `src/proxy.ts` 同样适用：

改了 matcher 后，光 curl 几个接口不够 —— 运行时真正生效的是
**`.next/server/middleware-manifest.json` → `middleware["/"].matchers[0].regexp`** 那份编译产物，
用 `node -e "new RegExp(regexp)"` 批量跑十几个路径，几秒钟覆盖全部用例。
（不 build 时的应急验证：用 `next/dist/compiled/path-to-regexp` 本地编译 matcher 串测，2026-08-02 这么验过 11 个用例。）

- ⭐ **必须包含嵌套多段路由**（`/api/auth/session`、`/api/admin/overview`）——
  "`.*` 到底能不能跨 `/`" 正是这类写法最容易翻车的地方，单段路由验不出来。
- ⚠️ **负向断言 `(?!a|b)` 是前缀匹配，不是整段匹配**：matcher 里写 `(?!upload-file)`，
  将来新增的 `/api/upload-filex`、`/api/upload-files` 也会被一并排除。
  要整段匹配就写 `(?!(?:upload-file|asset-upload-temp|upload-image)(?:$|/))`（⭐ 已换成这个）。

# 铁律⭐⭐：报"根因"之前，先把那个 `if` 的条件抄出来逐项验证（2026-08-02 加，代价惨痛）

2026-08-02 排查"工作流节点传参考图静默挂不上"，**连续两次归因都是错的**，两次的共同点是
**从"现象 + 记忆里一闪而过的 tip 文案"反推是哪条分支**，而不是**去读那条分支的判据条件**：

1. 第一次说是"服务端 dedup（`duplicate:true`）导致" → 错。反例：能挂上的那张图，POST **也**返回了 `duplicate:true`。
2. 第二次说是 `workflow-tldraw-canvas-inner.tsx:3761` 的 by-name 历史恢复分支 → 也错。
   那行判据是 **`asset.name === file.name`**，而 `asset.name` 是服务端权威名、
   `upload-name.ts:26` 的 `sanitizeUploadBaseName()` **已经去掉扩展名**（`replace(/\.[^.]+$/, "")`）
   → `"ref-r1"` 永远不等于 `"ref-r1.jpg"`，**这条分支对任何带扩展名的文件根本进不去**。

- ⭐ **姿势**：怀疑某个 `if`/`find`/`filter` 分支是元凶时，**把它的条件原样抄进你的笔记**，
  逐个变量确认"在我这个场景里它的实际值是什么"。⭐ **特别小心两个看着同名的东西**
  （`asset.name` 去了扩展名 vs `file.name` 带扩展名；`lastSeenAt` vs `activeWorkspaceSeenAt`）。
- ⭐ **没验证过的归因必须标明「假设，未验证」**，⛔ 不许当结论写进交接文档 ——
  错的根因会让下一个人朝错误方向改一整天。
- ⭐ **tip / toast 文案不能当证据**：它们一闪而过、而且经常长得很像
  （`已存在，已直接连接` vs `已在历史记录中，已恢复并连接`）。要么复现时录下来，要么去代码里对文案。

# 铁律：往"共享命名空间"里加新标识符之前，先枚举现存的全部取值（2026-08-02 加）

2026-08-02 新增备忘任务时取了 `M031`，而 `M031` 早就被「数据保留 / 清理策略」占了 →
`01`/`05`/`CHANGELOG` 里的 "M031" 从此**指向两个不同的东西**（已改成 `M032`）。
⛔ **不许"找一个看起来没用过的号"**，必须先枚举：

- 备忘编号：`grep '### \[.\] M' handover/06-memo-tasks.md`
- `B_xxx` 错误编号：看 `.runtime/error-code-counter.txt`（规则见 `07-red-error-triage-and-archive.md`）
- Prisma 迁移名、工作流/节点系统名、`upload-rules.ts` 的规则 key —— 同理。

# 铁律：把 `/generated/` 地址变成本地文件路径，只能走 `resolveGeneratedFilePath()`（2026-08-02 加）

⛔⛔ 历史上有 **6 处**都是这么写的，**全都能被路径穿越**：

```ts
const localUrl = normalizeReferenceAssetUrl(url);
if (!localUrl.startsWith("/generated/")) return url;      // ← 唯一的校验
const filePath = join(process.cwd(), "public", localUrl.replace(/^\//, ""));
readFileSync(filePath)                                     // ← 直接读
```

`startsWith("/generated/")` **拦不住 `..`**，而 `normalizeReferenceAssetUrl` 只剥 query 和 `#`
（`reference-asset-url.ts:67`），不做路径规范化。于是任何**登录用户**把参考图填成
`/generated/../../.env.local`，`join()` 折叠掉 `..` 后就读到了 `.env.local`，
内容被 base64 塞进发给模型的请求 —— 等于泄露 `OPENROUTER_API_KEY` / `BYTEPLUS_*` /
**`AUTH_SECRET`**（它一泄，别人能自己签管理员 cookie 登 `/admin`）/ 数据库口令。

- ⭐ **唯一正解：`resolve()` 之后必须仍在 `public/generated` 里面。**
  这个判断对任何编码方式都有效（`..`、`%2e%2e`、绝对路径），比"过滤 `..` 字符串"可靠得多。
- ⭐ **唯一权威 = `src/lib/generated-asset-path.ts`**：
  `resolveGeneratedFilePath()` / `isInsideGeneratedRoot()` / `generatedAssetExists()` /
  `getGeneratedFileSize()` / `toDataUrlIfLocalPublicAsset()`。
  ⛔ **禁止再在别处自己写 `join(process.cwd(), "public", ...)` + `readFileSync`。**
- ⭐ 顺带收掉一个既有分叉：`toDataUrlIfLocalPublicAsset` 原本在
  `openrouter.ts` / `openrouter-video.ts` / `seedance.ts` **一字不差地存了三份**（连 `getMimeType` 都一样），
  三份都带着同一个漏洞。现在是一份。
- ⭐ 判据：**项目里本来就有一处写对了**（`api/media-thumbnail/route.ts` 的 `isInsideGenerated`），
  另外 6 处压根没写。**发现"同一个判断有的地方有、有的地方没有"，就是该收敛的信号。**

# 铁律：服务端"按用户给的地址去下载东西"，必须过 SSRF 防护，且**逐跳**校验（2026-08-02 加）

`POST /api/media-save-status` 原本**不要求登录**（只写了 `const user = await getCurrentUser()`
然后一路用 `user?.id`，**没有"没登录就退出"那一句**），而 `getMediaSaveStatuses()` 对任何
没见过的地址都会 `enqueueRemoteAssetSave()` → `saveRemoteAsset()` → `fetch(url)`，
唯一的过滤是 `/^https?:\/\//`。下载到的字节写进 `public/generated/`，**下一次轮询就把 `localUrl` 回给调用方**。
→ 任何人（不用账号）发两个请求就能让服务器去读**云元数据 `169.254.169.254`**（拿实例凭证）、
扫内网、读同机另外两个项目的端口，然后把结果存成公开文件下载走。

- ⭐ **唯一权威 = `src/lib/ssrf-guard.ts`**：`assertRemoteUrlAllowed()` / `isRemoteUrlAllowed()` / **`safeFetch()`**。
- ⭐⭐ **必须解析 DNS 之后再判 IP**，不能只看域名字符串 ——
  否则攻击者拿自己的域名解析到 `169.254.169.254` 就绕过了。用 `dns.lookup(all)`，
  **任意一条 A/AAAA 落在私网就整体拒绝**。
- ⛔⛔ **不能用 `fetch(url, { redirect: "follow" })`，也不能用 `curl -L`** ——
  那样只校验了第一跳，一个正常公网地址 302 到元数据接口就穿透了。
  必须 `redirect: "manual"` 自己逐跳校验（`safeFetch` 已实现，最多 5 跳）。
- ⭐ **2026-08-02 用户拍板：走「内网黑名单」不走「域名白名单」。**
  白名单更严，但供应商回给我们的媒体域名是**运行时才知道的**
  （BytePlus 是 `ark-*.tos-ap-southeast-1.volces.com`，OpenRouter 那条无法穷举），
  **漏一个域名就等于用户丢图**；而"拒绝私网"覆盖了全部真实攻击面且不可能误伤公网供应商。
- ⭐ 两道防线都要：`enqueueRemoteAssetSave` 里拦（不建注定失败的任务）+ `saveRemoteAsset` 里拦（根治）。
- ⭐ 自验脚本 `scripts/verify-ssrf-guard.mjs`（25 个用例，含真实供应商域名必须放行）。
  ⚠️ **改了 `ssrf-guard.ts` 的网段表，必须同步改那个脚本里的副本**，否则测的不是线上那份。

# 铁律：上传接口的校验不能只覆盖一部分 mediaKind（2026-08-02 加）

`POST /api/upload-file` 原本**只在 `mediaKind` 是 video/audio 时才校验**（`route.ts` 的 `requestedKind`），
文档路径是**零校验** —— 既不限后缀也不限大小，而落盘后缀是**直接取客户端传的文件名**
（`local-assets.ts` 的 `getExtensionFromUrl(originalName)`）。
→ 传一个 `x.html` 就得到 `https://main.venusface.com/generated/.../xxx-x.html`，
而 `/generated/` 是**同源**静态目录 → **在自己域名下执行 JS（存储型 XSS）**。`.svg` 同理。
没有大小上限还意味着 `await file.arrayBuffer()` 能被用来打内存/磁盘。

- ⭐ 文档格式白名单的**唯一权威 = `media-upload-validation.ts` 的 `DOCUMENT_UPLOAD_FORMATS`**
  + `validateDocumentUploadFile()`；`upload-rules.ts` 的 `documentFormats` 从那里 import
  （和图片走 `image-upload-validation.ts` 的 `IMAGE_UPLOAD_FORMATS` 是同一个既有约定）。
- ⭐ **只认后缀、不认客户端给的 `Content-Type`**（后者能随便伪造，而决定 nginx 返回什么 MIME、
  浏览器要不要执行的，正是落盘后的后缀）。用 `buffer.byteLength` 而不是 `file.size`（后者是客户端声明值）。
- ⭐ **两个分支都要拦**：multipart 和 base64/JSON 老路都能上传。
- ⭐ 配套 nginx（4 份 conf 全部）：`/generated/` 加 `X-Content-Type-Options: nosniff`，
  并对危险后缀（`html?|xhtml|xht|shtml|svgz?|xml|xsl|js|mjs|css|wasm`）加 `Content-Disposition: attachment`。
  ⛔ **不能对整个 `/generated/` 加 attachment**（会影响正常图片视频）。
  ⚠️ **nginx 的 `if` 是一个新的配置层级，里面写了 `add_header` 就不再继承外层的** →
  必须把 `Cache-Control` / CORS / nosniff 在 `if` 里**重新写一遍**（已实测验证）。
- ⭐ 改 nginx 一定要**真验**，别只看 `nginx -t`：本次用 docker 起 nginx 实测了
  `.html`/`.svg` 有 attachment、`.jpg`/`.mp4`/`.txt` 没有、Range 请求仍返回 206。

# 铁律：数据库备份 —— 没演练过的备份不算备份（2026-08-02 建立）

完整用法、紧急恢复步骤、以及 **9 条踩过的坑** 见 **`deploy/backup/README.md`（要恢复数据先看那里）**。
这里只留最容易致命的几条：

- ⛔⛔ **`pg_restore` 不能用 stdin 管道喂**：`-Fc` 归档 + `-j` 并行**要求可 seek**，
  管道会**恢复出 0 张表且报错看不见**。必须解压成文件 → `docker cp` 进容器 → 按路径恢复。
  ⭐ **第一次演练就是这么失败的** —— 这正说明"演练"这步不可省；只跑备份不演练，
  等于一直以为自己有备份。
- ⚠️ **cron 按系统本地时区跑，不是 UTC**（这台是 `Asia/Shanghai +0800`）。
  我写 `30 19` 并注释成"UTC 19:30 = 北京 03:30"，实际会在**北京晚 19:30 高峰**跑。改前先 `timedatectl`。
- ⚠️ **crontab 里 `%` 是特殊字符**（换行），命令含 `%` 必须写 `\%`，否则**从 `%` 处截断**。
  我的探针用了 `date '+%F'` 被截断，一度误判"cron 没生效"。
- ⚠️ **这台机器没装 MTA，cron 发不出邮件** → 不能依赖"失败会收到通知"，一切落日志 + `last-status.txt`。
- ⛔ **`local a="$1" b="$X/$a"` 在 bash 里是错的**：`local` 的全部参数**在它执行前就被展开**，
  那时 `$a` 还没赋值，配合 `set -u` 直接中断整个脚本。必须先声明再逐个赋值。
- ⛔ **`--append-verify` 和 `--partial-dir` 互斥**（rsync rc=1 秒失败）。
  ⭐ 选 `--partial-dir`：`--append-verify` 会把没传完的文件**以最终文件名**留在目标端，
  "看起来像完整备份的截断文件"比没有备份更危险。
- ⭐ **xz 的 `-6` 和 `-9` 在这个库上差 40%（14.3MB vs 8.5MB），不是我以为的 4%** ——
  字典 8MiB vs 64MiB，而库里有大量重复的中文提示词。**别凭直觉调压缩等级，要实测。**
  用 `-T 1` 不用 `-T0`：`-9` 每线程 ~674MB，而**这是多项目共用的机器**。
- ⭐ **多项目共用的机器上装定时任务：绝不碰 root crontab**，只新增 `/etc/cron.d/<自己的名字>`，
  并**断言 root crontab 条数改前改后不变**。

# 铁律：判断「某个字段实际会不会有多个」要看写入方，不能只看 TypeScript 类型（2026-08-01 加）


⛔⛔ 2026-08-01 我看到工作流节点的 `data.images` 是 `string[]`，就按"数组可能有多项"
**推出了一个根本不存在的问题**（"源节点里有 4 张图会一起连进来"），还把它当"待办"报给了用户。
🗣️ **用户当场纠正**：「一个节点只能生一个视频或一张图片」——查证后他是对的。

- ⭐ **正解：去看写入方**。本次三处一看就清楚：
  ① 发给 `/api/image` 的请求写死 **`count: 1`**；
  ② `applyImageNodeResult` 里 `images` 是**覆盖不是追加**；
  ③ `handleUploadNodeFiles` 一次拖 N 张图是**建 N 个独立节点**、不是一个节点装 N 张。
  → `data.images` **实际长度恒为 1**，那个 `.map()` 只是写法兼容。
- ⛔ **类型只说明"能装多个"，不说明"业务上会装多个"。** 同理别只看 `?`（可选）就假设"经常是空"。
- ⭐ 这和另一条老教训同源：**「交接文档/表格里的描述可能已过期，动手前先用数据或代码验前提」**
  （历史上"6 处跨工作流遍历"实际只有 3 处，也是这么翻出来的）。
- ⭐ **报"待办/风险"之前先问自己：这个场景在产品上真的会发生吗？** 能举出具体的用户操作路径才算成立。

# 铁律：测试服和正式服「关键的东西」必须一样，基础设施优化要两服都做（2026-08-01 用户拍板）


🗣️ **用户原话意思**：「我做测试服就是为了提前测试，也就是**测试服和正式服关键的东西一定要一样**，
这样我们在测试服上测试好的东西到正式服就会最大限度不出问题。」

- ⛔ 所以「只给测试服换个更快的入口 / 只给正式服加个优化」这类**让两服架构产生差异**的方案一律不许提。
  2026-08-01 我推荐过「测试服绕开阿里、直连 `119.28.116.16:5001`」（零风险、快 10 倍），**被用户当场否掉**：
  那样测试服就不再经过阿里那一跳，**在测试服测好的东西到正式服不作数**。
- ✅ 正解：找到真正的病根，**两服都改同一个东西**（本次 = 两边 nginx 都加 upstream keepalive）。
- ⭐ `http://119.28.116.16:5001/`（绕开阿里直连腾讯 staging）**仍可用于临时排查、排除链路噪声**，
  但**不能当测试服入口**。
- ⚠️ 唯一允许的既有差异是**数据和 env**（两服数据库/`.env.local` 独立，本来就该独立）。

# 铁律：量"跨机器链路"的性能，必须站在「真实用户那一侧的那台机器」上测（2026-08-01 加）

⛔⛔ 2026-08-01 我为了验阿里的优化效果，**站在腾讯服务器上 curl 阿里的地址** ——
那等于**跨境跑两趟**（腾讯→阿里→腾讯），`connect=0.25~1.37s` 里混着"腾讯到阿里"那一跳，
**差点误判"keepalive 没生效、优化失败"**。

- ⭐ **正解**：国内用户走「用户 → 阿里 → 腾讯」，其中「用户→阿里」本来就快
  （实测阿里本机自取静态 0.005s），**唯一的变量是「阿里→腾讯」这一跳** →
  所以要**登到阿里上，curl 阿里自己的入口**（`curl -H "Host: xxx" https://127.0.0.1/... -k`）。
- ⭐ **同时要有对照组**：本次用「阿里绕开自己的 nginx、裸连腾讯 5000/5001」当"改之前的等效行为"，
  一眼看出 keepalive 的净收益（`connect` 1.3s → 0.00008s）。
- ⭐ **看 `connect` 而不只看 `total`**：`connect` 单独一列最能区分"握手慢"和"传输慢"，
  而这两者的解法完全不同（前者靠连接复用，后者只能改善线路）。
- ⛔ **纯验证脚本别开 `set -e`**：`curl` 超时返回非 0 会把脚本整段掐断、后面的复测全不跑（踩过）。

# 铁律：改「混着别的项目」的配置文件 = 精确替换 + 计数断言，禁止整份覆盖、也别用 sed 全局替换（2026-08-01 加）

阿里那台 nginx 上还有 `tiantangqiyuan` / `venusai` / `video-downloader` 三个别的项目，
而 FlashMuse 正式服入口 `flashmuse-static-ip` **自己内部就混着 `/tiantangqiyuan/`**。

⭐ **正确姿势**（模板 `deploy/ali/ali-add-upstream-keepalive.py`，2026-08-01 实跑验证过）：

1. **先只读勘察**，找出可区分的文本特征（本次：6 处「`proxy_pass` 紧跟 `Host xxx`」缺 `proxy_http_version 1.1`、
   2 处 `location /`「紧跟 `proxy_request_buffering off`」已有 `Connection`）。
2. **精确多行替换**，然后**断言条数必须完全等于预期 `(6, 2, 2)`** —— 不符就**一个字都不改**直接退出
   （说明服务器现状和勘察时不一样了，必须人工核对）。
3. **断言别的项目没被动**：改前改后 `tiantangqiyuan` 相关字符串的条数必须相等。
4. **残留检查**：不该再有任何漏掉的旧写法。
5. 幂等 marker + 备份 + `nginx -t` + **失败自动回滚** + 只 `reload` 不 `restart`。
6. 验证时**把别的项目也 curl 一遍**。

⛔ 别用 `sed` 全局替换（改不到"缺哪几行"这种结构性问题，也没有断言保护）。
⛔ 更别整份覆盖（会删掉别的项目的配置）。
⛔ **备份文件绝不放 `/etc/nginx/sites-enabled/`**（2026-08-02 踩过）：nginx 会 include 目录下**所有**文件，
  一个 `.bak` 里的 upstream 就能让整台 `duplicate upstream` 起不来 —— 备份放 `/root/`。
⭐ **同一功能有多个入口 conf 时，改一个必须把兄弟们全 grep 一遍** ——
2026-08-01 就发现 `staging-static` 那份**漏了** 07-30 加给 8080 那份的 `proxy_buffers` + `gzip`
（走 HTTPS 访问测试服时大响应一直在写磁盘、JSON 从来没压缩过）。这正是"能统一一律统一"。

# 铁律：工作流画布里给 `<button>` 写字号无效 —— 必须写在里面的 `<span>` 上（2026-08-01 加）


⛔⛔ **tldraw 的 `ui.css` 里有一条「无 layer」的 `button { font-size: inherit }`，而 Tailwind 的工具类在 `@layer` 里。
CSS 规则：无 layer 的样式永远赢过 `@layer` 里的样式（跟特异性无关、跟先后顺序无关）。**
→ 所以在工作流画布（`workflow-tldraw-canvas-inner.tsx`）里给 `<button className="text-[14px]">` 写字号
**会被静默吃掉**，回落成继承来的值。

- ⭐ **正解**：字号写在按钮里的 `<span className="text-[14px]">` 上（span 不在那条选择器里）。
  现成的例子：上传 chip 的 `text-[12px]` span、@ 按钮的 `text-[15px]` span、
  三选菜单的 `menuItemTextClassName`（2026-08-01 就是踩了这个才加的）。
- ⭐ **本地肉眼看不出来**（12px 和 14px 差别很小），我是**部署到测试服后用
  `getComputedStyle(btn).fontSize` 才量出来的**（className 里明明写着 `text-[14px]`，computed 是 `12px`）。
  → 判据：**改了画布里的字号，要么写到 span 上，要么用 `getComputedStyle` 实测，别靠肉眼**。
- ⚠️ 同理要警惕：别的被 tldraw 无 layer 规则覆盖的属性（`font`、`letter-spacing` 等）。
  排查姿势：在页面里造一个探针 `div` 挂同一个 class 量一下 —— **探针生效但目标不生效 = 被更高优先来源覆盖**，
  ⛔ 别怀疑"Tailwind 没生成这个类"（本次我先怀疑错了方向）。
  ⛔ 也别用 `sheet.cssRules` 遍历去找覆盖者：Tailwind v4 把工具类包在 `@layer` 里，
  顶层拿到的是 `CSSLayerBlockRule`（没有 `selectorText`），**会被你的循环整段跳过**、查不到。

# 铁律：给 hover 弹出的菜单留间距用 `padding` 不能用 `margin`（2026-08-01 加）

菜单用 `absolute bottom-full mb-2` 时，那 8px **外边距是"没有元素"的空隙** →
鼠标从按钮移向菜单时穿过它就触发 `mouseleave`，菜单**当场闪没**、根本点不到。
⭐ 正解：外层容器用 `pb-2`（内边距）把命中区连成一片，白色卡片放在内层 div。

# 铁律：菜单里的「选文件」项不能用 `<label>` 包 input + 在 `onChange` 里关菜单（2026-08-01 用户当场报的）

`<input type="file">` 的 `onChange` **只有"用户真的选完文件"才触发**：
- 系统选文件框弹着的那段时间，菜单一直留在屏幕上；
- 用户点「取消」→ `onChange` 压根不触发 → **菜单永远不关**。

⭐ 正解：把隐藏 `<input>` 放在**菜单外面**（按钮的容器里，菜单关了它还在），菜单项是普通 `<button>`，
`onClick` 里**先关菜单、再 `inputRef.current.click()`** 主动打开选文件框。
多个按钮各一个 input 时，用 `useRef<Record<string, HTMLInputElement | null>>` 按 key 存
（渲染函数在 `map` 里跑，不能用 Hook）。

# 铁律：给"加载中"盖遮罩，别只盖内容区、别用白底色块（2026-08-01 用户两次返工）

🗣️ 用户原话意思：「不要在中间加一块白底，要让整个输入框模糊化，然后在上面显示转圈+正在加载中...」

- ⛔ **不要用半透明白底色块**（`bg-white/62` 那种）—— 用户明确不要。用 **`backdrop-blur-[4px]`**。
- ⛔⛔ **更关键：别只盖"内容区"那一条**。第一次我只盖了文字输入区，而加载期间提示词是**空的**、
  placeholder 也被藏了 → **后面什么都没有，模糊一片空白渲染出来还是一块淡白色圆角块**，
  用户看到的和白底几乎没区别、当场打回。
- ⭐ **判据**：盖遮罩前先问「这块区域下面**有没有东西可以被模糊**」。没有就往上提一层，
  盖到**有可见内容的那个容器**（本次是提到 `WorkflowPromptBox` 根节点 = 整张卡片：
  上传按钮 + 输入区 + 模型/比例那一行 + 发送键），圆角跟着那一层（`rounded-[26px]`）。
- ⭐ 「整个输入框」这类说法**先确认范围**：用户指的是整张卡片，我理解成了文字输入区。

# 铁律：抢 tldraw 的键盘/剪贴板事件必须用 window 捕获阶段 + 只在自己要管时才 stopPropagation（2026-08-01 加）

tldraw 在 **`ownerDocument` 上以冒泡阶段**监听 `copy`/`cut`/`paste`
（`node_modules/tldraw/dist-cjs/lib/ui/hooks/useClipboardEvents.js:693`）。

- ⭐ 想在它之前处理 → `window.addEventListener("paste", handler, true)`（**捕获阶段**）。
  不抢在它前面，剪贴板里的图片会被它建成一个 **tldraw 原生 image shape**（不是我们的节点）。
- ⛔⛔ **只在"这次确实是我要管的东西"时才 `preventDefault + stopPropagation`**，其余一律放行 ——
  否则会把 tldraw 的「节点复制粘贴」和纯文本粘贴一起打断。
- ⛔ 焦点在 `input / textarea / [contenteditable="true"]` 里时直接 return
  （提示词框有自己的 `onPaste`，粘图 = 变成该节点的参考素材，是另一个意图）。
- ⭐ 作用域天然安全：`WorkflowCanvas` 只在 `activePanel === "workflow"` 时渲染 →
  window 监听离开工作流自动卸载，不影响对话模式/资产库。


# 铁律⭐⭐：**同一批插入的行，`createdAt` 是完全相同的 → 拿它排序 = 没有排序**（2026-08-11 正式服真实事故）

内容审核词库后台读词写的是 `ORDER BY t."createdAt" ASC`，而那 586 个词是**在同一个事务里**逐条 INSERT 的、
`createdAt` 取 `DEFAULT now()`（= **事务时间戳，不是语句时间戳**）→ 实测
**`count(DISTINCT "createdAt")` = 1**。排序键全相等 = **Postgres 返回什么顺序都合法**（取决于堆/扫描顺序）。
结果：本地和测试服**碰巧**等于插入顺序，正式服 **586 个位置里 585 个都不一样**，用户一眼就看出来了。

- ⭐⭐ **判据（一行、二值）**：`SELECT count(DISTINCT <排序键>) FROM <表>`。
  **等于 1（或远小于行数）= 这个排序压根没有依据。** ⛔ 别去猜"是不是同步脚本把顺序搞乱了"。
- ⭐ **正解 = 加一个显式的 `sortOrder Int` 列**，写入时按数组下标赋值（= 用户/管理员看到的输入顺序），
  读取 `ORDER BY "sortOrder" ASC, "createdAt" ASC, "id" ASC`。
  ⭐⭐ **排序键必须写成多级**：老数据 `sortOrder` 全 0 时靠后面两级兜底，
  **否则"加列的那一刻"顺序又会乱一次**（默认值全相同 = 又回到本条铁律的坑）。
- ⛔ **别用 `ctid` 排序**（VACUUM / UPDATE 会改）；⛔ 别只加 `id` 兜底（那是 cuid/uuid，等于随机顺序，
  虽然稳定但和用户的输入顺序无关）。
- ⭐ **凡是「DELETE 全部 + 重新 INSERT」的保存方式**（本项目词库、上传规则这类整体覆盖的配置）
  **都天然踩这个坑**：每次保存都会把 `createdAt` 重置成同一个值 → 顺序每次保存都可能变。

# 铁律⭐⭐：**"一个字符变成 2 个 U+FFFD" = 字节流被切开、两半各自解码**（2026-08-11 加，坐实词库乱码根因）

用户报测试服词库里有个 `王\uFFFD\uFFFD`。UTF-8 的 `丹` = `E4 B8 B9`（3 字节）。
在权威源文件里它正好占**第 4585~4587 字节**；在**第 4587 字节**处切一刀
（`4587 = 3×1529`，**3 字节对齐 = base64 对齐**）→ 前半段以不完整的 `E4 B8` 结尾产生 1 个 U+FFFD、
后半段以孤立续字节 `B9` 开头再产生 1 个 → 拼起来正好 `王` + 2 个 U+FFFD，**而且全文只坏这一个字**。

- ⭐⭐ **取证手法 = 模拟实验**：把源文件按怀疑的偏移**真切一刀**、两半各自 `toString('utf8')` 再拼回去，
  能**精确复现**（含"只坏一个字"这个特征）就是坐实。⛔ 比读代码猜快得多，也没有解释空间。
- ⭐ **推断方向**：N 字节的字符坏成 **2 个** U+FFFD → 一定是**解码边界**问题（分块传输 / 分段 base64 /
  流式解码没缓冲），⛔ **不是**"整体编码搞错了"（那样会**全文**中文都变，而不是一个字）。
- ⭐ **先证明源头是干净的**：本次源文件 `final-terms2.txt` 7291 字节 / 586 词 / **0 个 U+FFFD**，
  且它的 base64 解码后逐字节相等 → 排除"源数据本来就烂"。
- ⭐ **别忘了查连带伤害**：本次那行的 `normalized`（真正用来匹配的列）被
  `replace(/[\s\p{P}\p{S}_]+/gu,"")` 把 U+FFFD（属 `\p{S}`）剥掉，只剩「**王**」一个字
  → **任何含「王」的提示词都被审核拦掉**（国王/王子/女王）。
  ⭐ 通用判据：`SELECT count(*) FROM <表> WHERE char_length(normalized) = 1` ——
  **归一化后只剩 1 个字的匹配词几乎一定是脏数据**，且伤害面极大。
- ⭐ **传播路径要顺手查**：本次正式服那份坏数据是 `\copy` 从测试库导出再 INSERT 的（逐字节照搬）
  → **"从另一个环境复制数据"会把坏数据一起复制过去**，修的时候两边都要修。
- ⚠️ **查这类问题一律 hex 出库**：`encode(convert_to(value,'UTF8'),'hex')`，中文永不过管道
  （PowerShell 会把中文显示成花屏，让你分不清"文件坏了"还是"显示坏了"）。

# 铁律⭐：验"脱敏/掩码后的列表顺序对不对"，用掩码本身的**字数序列**当判据（2026-08-11 加，零风险）

后台词库锁定态显示的是 `terms.replace(/[^\n,，]/g,"*")` —— 每个字换成 `*`、**分隔符保留** →
**掩码完整保留了"每个词几个字"这个序列**。于是直接把它和
`canonical.map(t => "*".repeat([...t].length)).join("，")` 比对，就能验"顺序对不对、词数对不对"，
**不用解锁、不用点眼睛揭示、不碰任何数据**（本次两服都 2509 字符逐字符相同）。

- ⭐ **通用启发**：要验证的东西被脱敏了，先问一句「**有没有一个不解密就能比对的不变量**」
  （长度序列、条数、hash、字段结构）。这比"为了验证去解锁/揭示"安全得多。
- ⭐ 真要看明文时（本次为了确认 `王丹` 真的回来了）：看完**立刻恢复锁定态并复验**
  （`readOnly/disabled` + 掩码 + 「已锁定」文案），⛔ 全程别点「保存规则」。

# 铁律⭐⭐：默认「只写本地代码 → 写完先来汇报」，**没提前说就不许测试、不许部署**（2026-07-31 用户拍板）

🗣️ **用户原话意思**：「以后做任务，没特殊说法就是先做本地，做完先告诉我。我没提前说就不要测试不要部署。这个要写到规则里让后面的 AI 知道。」

**默认动作只有三步，做完就停下来汇报，然后等用户下一步指令：**

1. 改本地代码；
2. `npx tsc --noEmit` 自查（这不算"测试"，是编译自查，必须做）；
3. **汇报**：改了哪些文件、为什么这么改、影响范围、以及"要不要我测试 / 部署"。

⛔ **在用户当次没明确要求之前，下面这些一律不许做：**

- ⛔ **不许测试**：不开 Playwright、不开浏览器、不登录任何环境（本地 / 测试服 / 正式服都算）、
  不真跑生图生视频（**会烧真钱**）、不写一次性脚本去连数据库跑数据。
- ⛔ **不许部署**：不 `npm run build`、不上腾讯、不同步阿里、不 `git push`、不跑 `scripts/bump-version.mjs`。
- ⛔ **不许提交**：没让 commit 就不 commit（与下面「Git and GitHub」一致）。

✅ **例外（这些不算"测试"，可以做）**：`npx tsc --noEmit`、`eslint`、读代码、`grep`、看交接文档、看 `prisma/schema.prisma`。
✅ **判据**：只要一个动作会「产生副作用」（改数据库、烧积分、改服务器、动 git 远端）
或「花时间去跑真环境」，就属于**必须先问**。

⭐ **用户说了才做**：他会明确说「测一下 / 你去验一下 / 部署掉 / 上正式服」这类话；
「继续优化」「改一下这个」「优化一下性能」**都只是让你写代码**，不是让你去跑。

⭐ 汇报时**主动把"我建议测这几项"列出来给他挑**，而不是自己先跑完再说。

# 铁律：一切测试（本地 / 测试服 / **正式服**）只用 `12424740@qq.com`（2026-07-31 用户拍板）

🗣️ **用户原话意思**：「以后本地，测试服和正式服都用 `12424740@qq.com` 这个号测试，这个记录清楚让后面的 AI 不要弄错。」

- **三个环境都用它**（密码 `dragonstar`；本地库 / 测试库 / 正式库里都有这个号）。
  它是**普通用户**（测试服 ID_535317 / 正式服另有 ID），正好也最接近真实用户视角。
- ⛔⛔ **禁止再用 `lookxun@163.com` 做前台测试 / 巡检 / 真跑生图生视频** —— 那是**用户自己的号**，
  在上面加节点、烧积分等于动用户的数据和钱。**它只用于"必须管理员权限"的场合**（登后台 `/admin` 看页面）。
  2026-07-31 踩过：我照旧文档用它做正式服巡检，在**他自己的 `工作流_01`** 里加了 2 个节点、烧了 47 积分。
- ⭐ **测试内容不要删**（用户长期交代）→ 要做会留痕的实验（比如生成一张图验证链路），
  **新建一个工作流/对话**来做，别动现有的。
- ⭐ 正式服真跑生成**确实会花真钱**，这是"部署完必须真上号验一遍"的必要成本（用户已认可），
  但**必须花在测试号上、并在交接文档里写清留下了什么痕迹**。

# 铁律：查「点了没反应 / 交互卡」，先分「等接口」还是「接口慢」，再单独算一笔"每请求固定开销"（2026-07-31 加）

用户报某个按钮"点了要过好久才反应"时，**按这个顺序拆，别一头钻进那个功能的业务代码**：

1. ⭐⭐ **先看前端时序：是不是"等接口回来才画 UI"？** 这类问题九成是这个。
   2026-07-31 的「使用提示词」就是：`await fetch` 回来才建节点 → 点下去屏幕**一个像素都不动**（菜单都不关）。
   ⭐ **正解永远是"先给反馈、再补内容"**：能同步算出来的先画（画布上本来就有的模型/比例/分辨率），
   要等后端的那部分给**禁用 + 转圈 + 文案**，回来了只 patch 那一个对象。
   ⛔ 配套三件事缺一不可：① 超时兜底（`AbortController`，绝不允许永久禁用）；
   ② 临时态字段**必须在存库边界剥掉**（否则刷新后永久卡住，`promptLoading` / `uploadProgress` 都是这个坑）；
   ③ 想清楚"回来时用户已经改过了怎么办"（禁用态天然免疫；不禁用就要判"用户是否已编辑"）。
2. **再看接口自己**：`SELECT *` 拉了没用的大 JSON 列吗？几条查询是不是**串行 `?? await`**（能 `Promise.all` 吗）？
   `A 不中再查 B` 能不能合成一条 SQL（`= 或 LIKE` + `ORDER BY (精确命中) DESC`）？
   ⭐ 只需要大 JSON 里一个字段时，用 `"extraJson"->>'key'` **在库里就抽出来**，别把整列搬回 Node。
3. ⭐⭐ **最后单独算一笔「每个请求都要付的固定开销」** —— 这一步最容易漏，而它往往是最大头。
   2026-07-31 查出来的真凶就在这：`getCurrentSession()`（**全站每个登录态接口的第一件事**）
   里 `await` 写了一次 `Session.lastSeenAt`（纯签到、跟"你是谁"无关）→ **每次点击白等一个跨境往返**。
   已改成「不 `await` + 60 秒节流」，细节与三条禁忌见 `handover/02-architecture-and-data.md` 那一节。
   ⛔ **改这类全站路径前必须先把影响面逐项列给用户**（我这次列了 4 项，用户才拍板）。
   ⛔ 尤其分清「看着像一回事的两个字段」：`lastSeenAt`（活跃统计）vs `activeWorkspaceSeenAt`（后台「在线」判定）
   —— 动错一个后台就开始说假话。

⭐ **通用判据**：优化交互延迟时，把一次点击拆成
「① 前端有没有立刻给反馈 ② 这个接口自己几个 DB 往返 ③ 每个请求的固定开销（鉴权等）」三笔账**分别报数**，
⛔ 别只报一个"总共几秒"就开始改代码。

# 铁律：给「下行瘦身」配防线时，取"库里现有数据"的那次查询不许带 `deletedAt: null`（2026-07-31 加）

下行做了瘦身（投影/只发标题），PUT 侧就必须有"客户端手里没有权威数据时绝不覆盖"的防线。
**这类防线几乎都以「能从库里查到现有那份」为前提** → 那次查询一旦带了 `deletedAt: null`，
**软删除的行就查不到、防线全部失效、被空数据覆盖 = 真删用户数据**。

- 2026-07-31 实测踩到：删掉一个"只发了标题"的工作流后，客户端仍会带着 `deletedAt` 继续 PUT 它，
  `upsertWorkspaceWorkflows` 里那次 `where: { userId, deletedAt: null }` 查不到它 →
  **回收站里那条工作流的 canvasJson 被洗成 `{}`**（本地实测 279 字节 → 2 字节）。
  修法 = 那次查询去掉 `deletedAt: null`（"库里有没有内容"这种统计口径仍只算未删的行）。
- ⭐ **判防线够不够强的姿势**：把"用户删掉一个从没打开过的对象"当成必测用例，
  删完去库里看它的内容字段是不是还在（不是只看列表里消失了）。
- ⭐ **结构性判据要选"天然可分"的那个**：本次防线用「客户端这份画布里**有没有 `nodes` 数组**」
  而不是「nodes 是不是空数组」—— 因为前端只要加载过画布就一定会写 `nodes: [...]`（哪怕空），
  于是「用户真的清空画布」（`nodes: []`，要存）和「压根没加载过」（`{}`，要拦）**结构上天然不同**。
  ⛔ 若判据选成"空就不写"，用户就永远清不掉画布。

# 铁律：评估架构优化要算"随数据量怎么增长"，不能只算当下字节（2026-07-30 加）

上一任把「工作流按需加载」评估成"不值得做"，因为 gzip 后只能再省 31KB。**用户否掉了这个结论**：

> 「如果只是算眼前的账那当然没必要做，没多少大。但是我们的项目还要一直运行的，
> 以后如果一个人 100 多个工作流 1000 个工作流难道还一次性下发吗？那不卡才怪呢。」

- ⭐ **判据要两个**：① 当下多大（gzip 后，见上一条铁律）② **随数据量线性/指数增长吗**。
  只满足①不做、满足②就要做 —— 因为②是"以后一定会爆",而且越晚做越难改。
- ⭐ **量增长率的姿势**：算"每单位数据多少字节"（本次：骨架版每节点约 560 字节），
  再乘上可预见的规模（1000 工作流 × 50 节点 = 28MB）。**别只报一个总数就下结论。**
- ⭐ **顺手做的"搬到服务端"往往比省字节更值**：本次为了按需加载，把 3 处跨工作流遍历搬到服务端，
  **白捡修掉一个真 bug** —— 远端图片地址原来只在"用户开着页面"时才换成本地，关了页面就留着会过期的地址 = 死链。

**配套：查"前端为什么必须拿到全部数据"时，逐处点开看，别信交接文档里的清单数字。**
本次交接文档写的"6 处跨工作流遍历"实际只有 3 处 —— 另外 4 处第一行就 `find(id === xxx)`、只用一个。
（同源于下面那条"A 表描述可能已过期，动手前先用数据验前提"。）

**配套：想把某件事"搬到服务端"之前，先 grep 一遍服务端是不是早就在做了。**
本次要把"反查这张图属于哪个工作流节点"搬到服务端，结果发现 `generation-jobs.ts` 的
`finalizeImageJobAsset` / `finalizeVideoJobAsset` **在任务成功那一刻就已经建好 MediaAsset 了**
（注释原文："这样即使用户永远不回来，成品图也一定进资产库、不丢"），
workflowId / workflowNodeId / systemName / sourcePrompt / model / 生成参数**全都有**
→ 前端那套反查是**纯重复劳动**，只要把已有数据回给前端就行，一行新逻辑都不用写。
⭐ 判断姿势：`grep buildMediaAssetRecord` / `grep finalize` / 看 `prisma/schema.prisma` 有没有现成的列
（本次还发现 `WorkspaceWorkflow` 早就有 `nextImageNumber`/`nextVideoNumber` 两列，
而前端还在扫所有名字自己推编号）。

**⚠️ 反过来也要留意：搬到服务端会引入"服务端改 + 客户端整体覆盖"的并发竞争。**
本次给 `applyWorkflowJobResultToCanvas`（服务端改画布）配了一道 `mergeWorkflowCanvasMedia` 里的兜底：
客户端还挂着 `http(s)://` 远端地址而后端 job 已落地 → 一律用 job 的本地地址。
**凡是"服务端直接改一个会被客户端整体覆盖的字段"，都必须配这种兜底。**

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
   于是那个"看起来能省 655KB"的优化（M025）**实际收益只剩 ~31KB**（据此建议不做，🗣️ 但**最终结论用户还没拍板**，
   见 `06-memo-tasks.md` 的 M025）。
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
- **默认只做本地、不部署、不测试**：用户没明确说"部署"就只在本地改（改完 `npx tsc --noEmit` 自查即可），**不要 build / 不要上腾讯 / 不要同步阿里 / 不要 push**；用户没明确说"测试"也**不要开浏览器、不要登录、不要真跑生成**。⭐ 完整口径见本文件**最顶部那条铁律**（2026-07-31 用户拍板）。
- 与下面"能统一一律统一"配合：改统一函数时尤其要评估它被哪些模式共用，别只顾眼前这条需求。

# 铁律：测试服→正式服部署顺序 + 版本号自增（2026-07-18 加，所有 AI 必须遵守）

有一套**测试服**（腾讯 `/opt/flashmuse-staging/` + 阿里镜像，入口 `http://101.37.129.164:8080/`、后台 `/admin`），和正式服代码一致、数据/环境独立。用来在不影响正式服用户的前提下线上验证。

- **部署顺序永远是：先测试服，再正式服。** 哪怕用户说"直接部署正式服"，也必须先部署测试服、验证 OK 后，再把**测试服那份代码原样同步到正式服**。禁止跳过测试服、禁止直接改正式服代码。
- **"部署掉 / 部署一下"等默认只部署测试服，绝不动正式服。** 只有用户明确说"把正式服部署掉 / 更新正式服 / 上线正式服"这类话，才执行"先一次性部署测试服、再同步到正式服"的完整顺序。默认永远只到测试服为止。
- **版本号自增只发生在"部署测试服"这一步**：部署测试服前先跑 `node scripts/bump-version.mjs`（四段 100 进制 vAA.BB.CC.DD 最右段 +1、满 100 进位，写回 `src/lib/app-version.ts`）。**正式服部署绝不跑自增脚本**，只把测试服的代码（含已写好的版本号）原样带过去。
- 由此保证"**版本号一样 = 测试服和正式服代码一样；不一样 = 代码不一样**"。破坏此保证的操作（正式服再自增、正式服独立改代码、跳过测试服）一律禁止。
- 版本号是 `src/lib/app-version.ts` 里的 `APP_VERSION` 常量；`NEXT_PUBLIC_IS_TEST=true`（测试服构建 arg）控制显示 `(t)` 后缀与 logo"测试服"标识。改中文源码用 edit 工具，**禁止 PowerShell `Set-Content`**（会把中文注释变乱码，本次已踩坑）。
- ⭐⭐ **每部署完一台就必须真上号点一遍看有没有崩（2026-07-29 用户加；2026-08-24 改口径；2026-09-12 再改）**：**curl 200 / 版本号头对了 ≠ 没崩**。
  🗣️ **2026-08-24 拍板：**
  1. **测服**：部署完必须把**当次更新的新内容全部测一遍**，有问题当场修，修完再测。⛔ 别再例行把对话/工作流/资产库/付费生图/后台全套点一遍。
  2. **正式服**：用户没明确说「推正式服 / 上正式服」就**不许推**。说了才推。
  3. ⛔ 别再拿付费生图当默认冒烟。
  🗣️⭐⭐⭐ **2026-09-12 用户拍板（覆盖上面第 2 条的冒烟方式）**：
  「**以后推正式服后 就用最便宜语音或图片模型生一条，保证正式服不崩即可。**」
  - ✅ **首选 = 语音 `qwen/qwen-audio-3.0-tts-plus`（Qwen Audio 3.0 TTS Plus）**：
    一句话实测**只扣 1 积分**（`usd 0.00042`），是全平台最便宜的一条真实生成。
  - ⛔⛔ **别用 `fish-audio/s2.1-pro-free`（那个"免费"的）** —— **OpenRouter 已把 fish-audio 全系下架**，
    点了必得红字 `B_498/B_500`，**证明不了"没崩"**（它还是新对话的默认语音模型，所以**必须手动切到 Qwen**）。
  - ✅ 语音整条链路都挂了才退到图片 **`byteplus:conversation-image.seedream-5-0`（Seedream 5.0 Lite）**，
    2 积分/张、**只生 1 张**。⛔ 别用 GPT/Gemini 那些十几积分的。
  - ⭐ **判据三条（缺一不可）**：① 界面上真出了音频卡（带时长）/图 ② **console 0 error**
    ③ 回库 `CreditLedger` 最新一行真是这次的（`kind/model/credits` 对得上）。
    ⛔ 别拿"页面能打开"当通过。
  - ⭐ 建议**新建一条对话**来跑（对话标题带版本号，如 `v1.0.1.25 正式服冒烟：...`），方便写进留痕。
  细节写在 `handover/03-deploy-and-servers.md`「部署铁律」节。

# 铁律：能统一的一律统一，禁止复制多份各走各的

本项目功能不多、各模式本质相同（对话流 / 工作流 / 资产库 / Agent 模式 / 通用模式）。写代码或改东西前，**必须先查是否已有统一的公共路径/函数**，有就复用、没有就抽一个，**绝不允许把同一段逻辑复制成多份各自演化**。

- 反例（已踩坑，2026-07-14）：`getBytePlusProviderKey`（模型→BytePlus 端点映射）被复制到 `image/route`、`video/route`、`generation-jobs` 三份，各改各的 → 只修了对话流那份，Agent/通用模式漏修 → 线上 Agent/通用生图/生视频用新模型直接失败。已收敛为唯一实现 `src/lib/byteplus-provider-key.ts`。
- 判断标准：**理论上"生图在一个地方能用，其它地方都应该能用"**（生视频、上传、进库、读取、命名、扣费、参考图……同理），因为它们本就该走同一套。若出现"对话流可以、工作流/Agent 不行"，几乎一定是某处该统一却分叉了——先找分叉点收敛，别再打局部补丁。
- ⭐⭐ **2026-08-09 新增的唯一权威 · 之一：简繁转换（`src/lib/chat/chat-workbench-core.tsx`）**
  `applyDocumentLanguage` / `applyLanguageToTextNode` / `applyLanguageToElementAttributes` / `convertSimplifiedToTraditional`
  + 两张简→繁表（`globalTraditionalPhrases` / `globalTraditionalChars`）+ `traditionalTextMap` / `getUserText`。
  ⛔⛔ **只有"简→繁"一个方向**：繁→简一律靠**还原 WeakMap 里的原文**，
  **禁止再加回任何"繁→简"转换函数/词表**（机械反转是有损的，会把简体正文里的「新增」改成「新建」——真实事故）。
  详见本文件顶部那条同名铁律。
- ⭐⭐⭐ **2026-08~09 会员 / 积分充值 / 额度闸门这一整套的唯一权威清单（改钱相关的东西必须先看这一节）**：
  - **`src/lib/membership.ts`** —— 总开关 `MEMBERSHIP_SYSTEM_ENABLED`（现在是 `false` = 保留但隐藏）、
    档位与价目表、`getMembershipUpgradeQuote`（买会员算钱的唯一函数）、
    `CREDIT_PACKS_CNY` + `getCreditPackCredits`（**积分包换算的唯一权威，接支付时服务端必须用它复算**）。
  - **`src/lib/membership-credits.ts`** —— `settleMembershipCredits`（月积分发放/过期作废）、
    `applyMembershipPurchase`（**唯一允许改 membershipTier/到期日的地方**）。
    ⛔⛔ 两个函数顶部都有 `if (!MEMBERSHIP_SYSTEM_ENABLED) return`，**别去掉**（见顶部那条铁律）。
  - **`src/lib/membership-guard.ts`** —— `shouldEnforceMembershipGenerationLimit`（**只拦四处**：对话流图/视频、
    资产库生图、工作流图片/视频节点）、`assertMembershipImageAllowed` / `assertMembershipVideoAllowed`
    （必须校验**归一化后**的真实分辨率）。
  - **`src/lib/generation-quota.ts`** —— `reserveGenerationQuota` / `releaseGenerationQuota`：
    并发上限 + 「积分够不够」在**同一个事务 + per-user 咨询锁**里原子判定。**fail-open**（见顶部铁律）。
    占位释放三处：`markJobSucceeded` / `markJobFailed`（`generation-jobs.ts`）+ 同步接口的 `finally`。
  - **`src/lib/models.ts` 的 `getEstimatedGenerationUsd`** —— 事前预估唯一入口，
    读 `estUsdByResolution` / `estUsdPerSecondByResolution`（**真实扣费数据的 p99**）；
    **`getEffectiveVideoDurationSeconds`** —— 「这次实际生成几秒」唯一权威，`openrouter-video.ts`
    的 `getDuration` 只是它的薄封装。
  - **`src/components/credit-recharge-modal.tsx`** —— 积分充值独立全屏页（**已上线、会收真钱**）；
    **`src/components/fake-pay-qr-code.tsx`** —— 假二维码唯一实现
    （⛔ 充值页禁止 import `membership-modal.tsx`，那会把整个会员页打进生产前端包）。
  - ⭐⭐⭐ **支付宝真钱链路（2026-09-09 审计后收敛，改钱相关代码必须先看这一组）**：
    - **`src/lib/alipay.ts`** —— SDK 装配 + `getAlipayAppId` / `alipayPrecreate` /
      **`alipayQuery`（「钱到没到」唯一权威）** / `verifyAlipayNotify` / `parseAlipayNotifyBody`。
    - **`src/lib/payment-orders.ts`** —— `PAYMENT_ORDER_NO_PATTERN`（订单号正则唯一权威）/
      `createPaymentOrderNo` / `createAlipayCreditOrder`（只收 packIndex）/
      **`fulfillPaidCreditOrder`（唯一加分入口，三道幂等，允许 pending+closed）** /
      `syncAlipayCreditOrder`（先查再关）/ `reconcileRecentCreditOrders`（补单）/
      `isPaidAmountEnough`（只拒少付）/ `getCreditOrderPayStatus`。
    - **`src/lib/payment-log.ts`** —— 支付审计日志唯一实现（`.runtime/payment-diagnostics-log.jsonl`）。
    - 三个接口：`POST /api/pay/credit-order`（下单，限流 8/10min·用户）、
      `GET /api/pay/credit-order/status`（查单，限流 + 同订单号对上游 2 秒 1 次）、
      `POST /api/pay/alipay/notify`（通知 = 触发器，限流 30/min·订单号）；
      `GET /api/credit-packs`（前台 8 档）、`GET|POST /admin/api/credit-pack-settings`（后台改价，必须校验请求体是数组）。
    - **回归**：`npx tsx scripts/verify-payment-rules.ts`（48 条，一半反向）—— 改上面这些纯函数前必跑。

  - **`src/lib/membership-purchase-records.ts`** —— 购买/充值记录；演示假数据只许在非生产环境下发。
  - `src/app/api/membership/quote`（会员报价，关闭时 403）、`src/app/api/membership/purchases`（记录）、
    `src/app/admin/api/membership/grant` + `membership-settings`（后台写接口，关闭时 403）。
- ⭐⭐⭐ **2026-09 新增的「视频后处理」这一族（画质增强 / 深度动作捕捉）唯一权威清单 —— 改它们必须先看这一节**：
  - **`src/lib/video-source-asset.ts`** —— 「用户给的源视频」→ **归属校验 + 真实时长** 的唯一权威：
    `getSourceVideoOwnershipError()`（路径里带别人 userId 就拒）/ `resolveSourceVideoDuration()`
    （**ffmpeg 现场实测源文件**，客户端那个数只在实测失败时兜底，支持 `maxSeconds` 截断）。
    ⛔⛔ **扣费秒数只认它** —— 上游 MediaKit / RunningHub **从不返回成本**，
    所以 `settings.duration` 就是唯一扣费依据，绝不许来自请求体（见顶部那条铁律）。
  - **`src/lib/mediakit.ts`** —— 画质增强唯一实现：国内大模型版 `enhance-video-generative`（北京）+
    海外极速 `enhance-video-fast`（新加坡）。⛔ 海外标准按用户拍板不做。
    ⛔ `BYTEPLUS_API_KEY`（`ark-`）**不是** MediaKit key，三把 key 各自独立
    （`MEDIAKIT_API_KEY` / `BYTEPLUS_MEDIAKIT_API_KEY` / `RUNNINGHUB_API_KEY`，只进 `.env.local`、⛔ 不进 git）。
  - **`src/lib/runninghub.ts`** —— 深度动作捕捉唯一实现（DepthCrafter，workflowId 写死
    `1868729320020787201`，**国际站 `www.runninghub.ai`**，⛔ 别打国内 `runninghub.cn`）。
    `MAX_DEPTH_SECONDS = 25` 既是上游 `frame_load_cap` 的上限、**也是收费秒数的截断值**（2026-09-12 真机：16:9 25s 成 / 30s OOM；21:9 已不支持）。
    尺寸**统一 480p**：只支持 16:9 / 4:3 / 1:1（竖版 9:16 / 3:4），其它比例贴最近的一档。唯一权威 `src/lib/video-depth-size.ts` 的 `fitVideoDepthOutputSize`。
  - **`src/lib/video-usage-cost.ts` 的 `withVideoUsdFallback`** —— 这两族的兜底定价（**唯一扣费依据**）：
    增强 = `分钟 × 分辨率系数(720p 1 / 1080p 2 / 2K 4 / 4K 8) × 基准价`（国内 `2.5/7.2`、海外极速 `0.1033`）；
    深度 = `秒 × $0.02`。⛔ 两个分支都**不许**出现"算不出秒数就原样返回"（那是静默白送）。
  - **两个接口**：`POST /api/video-enhance`、`POST /api/video-depth` —— 都必须
    ① 归属校验 ② 服务端实测时长 ③ 闸门 `reserveGenerationQuota` 在**打上游之前** ④ `finally` 里释放占位。
  - **开关**：`system-settings.ts` 的 `isVideoEnhanceEnabled` / `isBytePlusVideoEnhanceFastEnabled` /
    `isVideoDepthEnabled`（key 没配或开关关掉 → 前端按钮整个隐藏）；后台独立页
    **`src/app/admin/admin-workflow-shortcut-panel.tsx`（「快捷菜单开关(工作流)」）**，
    功能显示开关 key = `fn:${func}`、模型链开关 key = `${func}:${modelId}`。
    ⛔ 别把这些搬回「模型开关」页。
  - **回归**：`npx tsx scripts/verify-generation-pricing.ts`（57 条，16 条反向）—— 改
    菜单价格 / 预估表 / 兜底定价 / 归属校验 / 那 13 条红字之前**先跑它**。
  - ⭐ **轮询按 taskId / provider 分流**：`amk-...enhance-video-generative` → 国内 MediaKit；
    `...enhance-video-fast` → 海外 MediaKit；`provider=runninghub` → RunningHub。
    ⛔ 改常驻 `generation-worker` 相关代码必须**重启 dev / force-recreate 容器**（热更新换不到 worker）。
- ⭐⭐ **2026-08-19 新增三个唯一权威（改模型菜单/比例/新模型接入必须复用）**：  - **菜单副标题 `src/lib/models.ts` 的 `getGenerationModelSelectHint(modelId, usdToCnyRate?, creditsPerCny?)`**
    （+ 内部 `IMAGE_MODEL_MENU_INFO` / `VIDEO_MODEL_MENU_INFO`）：模型名下方那行灰字 =「几个字简介 · X积分/张(或/秒)」。
    **汇率必须由调用方从 `/api/model-availability` 的 `creditRate` 传进来**（后台可调、⛔ 别写死 7.2×10）；
    浮动计费的模型标「约」。对话流/资产库菜单与工作流图片·视频节点菜单**共用它**。
  - **「该模型支持哪些图片比例」= `ImageModelRule.ratios` + `getSupportedImageRatios` + `normalizeImageRatioForModel`**。
    ⛔ **禁止再用全局 `ratioOptions` 当图片比例列表**（Recraft 只有 5 个、无 21:9）；
    ⭐ 归一化要覆盖三处：切模型时 / 加载用户 profile 时 / 新建对话套用默认参数时。
  - **Recraft = `isRecraftModel` / `RECRAFT_V41_MODEL_ID` / `RECRAFT_V41_PRO_MODEL_ID`**，走
    `openrouter.ts` 的 `generateRecraftImage`（专用 `/api/v1/images`，⛔ 不支持 `/chat/completions`）；
    **参考图硬上限 1 张（已配进 `upload-rules.ts`）**、无 resolution 参数（V4.1 恒 1K / Pro 恒 2K）、
    上游字数硬上限 10000、按张计费（`usage.cost` 线性）。
- ⭐⭐ **2026-08-09 新增两个唯一权威（改相关功能必须复用）**：
  - **提示词字数上限 `src/lib/prompt-length.ts`**（`DEFAULT_PROMPT_MAX_LENGTH` / `MODEL_DEFAULT_PROMPT_MAX_LENGTH`（2.0 系 3500、2.5 = 14500、其余 2000）/ `getPromptLengthOverrideKey`（**模型粒度、故意不看参考模式** → 一个模型一个开关）/ `getDefaultPromptMaxLength` / `getPromptMaxLength` / `normalizePromptMaxLength` / `PROMPT_MAX_LENGTH_CEILING=99999`）。
    后台「上传规则」页的「文字」列配置它（env `PROMPT_LENGTH_OVERRIDES`，与上传数量的 `UPLOAD_RULE_OVERRIDES` **是两套、粒度不同**）。
    ⛔ 别再写死 2000；⛔ 后台面板显示的默认值必须走 `getDefaultPromptMaxLength`（面板显示 2000 而实际 14500 的话，管理员碰一下开关就把 2.5 静默砍到 2000）。
  - **模型图标 `src/components/model-icon.tsx`**（`getGenerationModelIcon` / `ModelIcon` / `AiGenerate3dIcon` / `AiAgentLineIcon` / `DeepSeekIcon`）：
    2026-08-09 收敛，原来**存在三份且已漂移**（工作流那份漏 DeepSeek、后台系统设置那份漏 MiniMax + 可灵）。
    `chat-workbench-core.tsx` 里**再导出**这几个符号，所以老 import 路径不用改。⛔ 禁止再在别处写 `modelId.startsWith("xxx/")` 判图标。
  - **提示词计数器 `src/components/prompt-length-counter.tsx`（`PromptLengthCounterRow`）** + **服务端超限日志 `src/lib/prompt-length-server.ts`（`logPromptLengthOverLimit`）**（2026-08-09 新增）。
    ⭐⭐ **口径（用户逐条拍板，⛔ 别改回去）**：**超字数不删字**（学即梦）——
    ① 任何输入路径都**不许** `slice(0, maxLength)`，只留 `PROMPT_MAX_LENGTH_CEILING = 99999` 安全网；
    ② 计数器是**输入框里独立的一行**（居右、灰字 11px、有内容才显示数字但**那一行始终占位**，否则一打字整个框跳高）——
    **对话流 / 工作流节点加高一行、资产库不加高**；⛔ 不是浮在右上角的绝对定位层（会压住文字，被用户否过）；
    ③ 超限 = 发送/生成按钮灰掉 + **通用黑底提示框**「当前模型提示词只支持XXXX字！」（⛔ 不用原生 `title`）+ 真按下去时红字拦住；
    ④ **服务端只记日志不拦**（`/api/image`+`/api/video`，事件 `prompt-length-over-limit`，喂 `sourcePrompt`）——
    判据 `grep -c '"prompt-length-over-limit"'`，观察够了再决定要不要开拦截。
    ⚠️ 工作流的计数显示/判定用的是**合计**（输入框 + 连接的文本节点），因为限制本身是合计。
  - **黑底悬浮提示 `src/components/black-hover-tooltip.tsx`（`BlackHoverTooltip`）**：2026-08-09 从
    `lib/chat/chat-workbench-core.tsx` 搬出来（**工作流画布不能 import core，会循环依赖**），core 里**再导出**、老路径可用。
    ⭐ `label` 为空（`""`）时**整个气泡不渲染**，所以条件提示直接写 `label={条件 ? "文案" : ""}`，
    ⛔ 别再套三元包两份按钮、也别再用原生 `title=`。
- 已有的统一入口举例（改相关功能务必复用，勿另起炉灶）：**内容审核 `src/lib/content-moderation.ts`(唯一权威：`CONTENT_POLICY_ERROR_MESSAGE`/`CONTENT_POLICY_ERROR_CODE`/`SENSITIVE_POLITICS_CATEGORY`/`normalizeContentModerationText`/`splitContentModerationTerms`/`findContentPolicyMatch`/`enforceContentPolicy`/`processContentModerationQueue` + `MODERATION_MODEL_CHAIN`：2026-08-07 新增。⭐ 入口**三处**：`/api/image`、`/api/video`（覆盖对话流/工作流/资产库/Agent 的**生成**提示词，`kind:"image"/"video"`）、以及 **`/api/agent-plan`（2026-08-09 新增，`kind:"chat"`，覆盖 Agent/通用模式的对话——它是每条 agent/general 消息的必经入口，命中直接返回红字、不调模型不扣分）**。⛔ 仍不管纯 `/api/chat`（提示词优化/反推）与普通聊天。⚠️ `enforceContentPolicy` 的 `kind` 现在是 `"image"|"video"|"chat"`。⭐ 审核一律喂 `sourcePrompt`（用户原话）。⭐ 语义审核候选链 = `openai/gpt-5.6-terra-pro`(openrouter, key `moderation.priority`) → `byteplus:chat.seed-2-0-pro`(key `moderation.seed-2-0-pro`)，两个默认都开；⛔ 新增模型要三处一起改：`MODERATION_MODEL_CHAIN` + `system-settings` 的两张默认表 + 后台 `admin-system-settings-panel.tsx` 的「内容审核语义模型」那一行。⛔ 这里故意不复用 `openrouter.ts` 的 `getTextProviderConfig`/`postChatCompletion`（那条路没超时、非 200 还回落 curl，对审核太重）。
⭐⭐ **2026-08-11 新增：词库的「显示顺序」唯一依据 = `ContentModerationTerm.sortOrder`**
（写入 `src/app/admin/api/content-moderation/route.ts` 按数组下标；读取 `src/app/admin/page.tsx`
`ORDER BY t."sortOrder" ASC, t."createdAt" ASC, t."id" ASC`）。
⛔⛔ **禁止退回 `ORDER BY createdAt`** —— 整批词是同一事务插入、`createdAt` 全相同（distinct=1），
按它排会让同一份数据在不同机器上顺序不同（2026-08-11 正式服真实事故，详见同名铁律）。
⚠️ **词库当前是 587 词**（586 + 用户加的「毛主席」），老文档里的 586 已过期；
权威底本 = `C:\Users\ASUS\AppData\Local\Temp\opencode\final-terms2.txt`（586 词）+ 末位「毛主席」。
⚠️ 词库里**大量词本来就含 ASCII 字母**（`gc党`/`xiao平`/`ze东`/`政f`）→ 任何清洗脚本不许拿"必须全是中文"当规则)**、图片缩略图生成 `src/lib/local-assets.ts`(`ensureGeneratedImageThumbnail(url, { syncToAli })` 唯一实现 + `createGeneratedImageThumbnail` 薄封装：2026-08-04 收敛，原来 `api/media-thumbnail/route.ts`（浏览器请求时**懒生成**）和 `local-assets.ts`（生成图落盘时**即时生成**）**一字不差存了两份**（连 `scale=256:256`/`-q:v 5`/timeout 都一样）。⭐ 分叉的代价是真实的：懒生成那份**从来不同步阿里** → 阿里镜像里上传图缩略图长期一张都没有。⭐ `syncToAli` 是**选项且默认 false**：即时生成那 5 个调用方是把 `[localUrl, thumbnailUrl]` **合成一次** `syncGeneratedFilesToAli` 发的，那次的 `ok` 就是 `job.aliSynced`（前端拿它判断能不能读阿里镜像），无条件同步会重复传 + 让语义变模糊。⛔ 路径穿越校验和后缀白名单**刻意留在路由**（只有它的入参来自用户），别下沉)**、进库 `src/lib/media-asset-record.ts`(`buildMediaAssetRecord`/`classifyAsset`)、生成任务与读取 `src/lib/generation-jobs.ts`、扣费 `src/lib/credits.ts`(`chargeCredits`)、**腾讯→阿里文件传输 `deploy/ali-parallel-pull.sh`(阿里侧并发分片拉取器，唯一实现) + `src/lib/ali-sync.ts`(应用侧调用) + `scripts/backfill-ali-media.sh`(补历史缺口) + `src/lib/transfer-log.ts`(传输速度日志唯一实现)：2026-08-04 新增，⛔ 别再写第二份分片逻辑、⛔ 别退回单流 rsync，原理与实测数据见本文件「腾讯↔阿里传文件一律走并发分片」那条铁律**、**视频用量/成本 `src/lib/video-usage-cost.ts`(`getVideoUsageMeta`/`withVideoUsdFallback`/`withChargedVideoUsage`：2026-08-03 收敛，原来 `api/video/route.ts`（前台同步轮询）和 `generation-jobs.ts`（后台队列）**各存一份一字不差的** getUsageMeta/withBytePlusVideoUsd/withChargedUsage —— 扣费金额是钱，两份各自演化就会"一条路扣对、另一条路白送"。⭐ 里面还有**兜底定价**：上游没给 `usage.usd` 时按公式算并标 `usdFromFallbackPricing`，因为 `usd=0` 是**静默白送**、不报错也不进红字)**、**视频参考模式 `src/lib/upload-rules.ts`(`VideoReferenceMode` 类型 + `supportsVideoReferenceMode`/`getVideoReferenceImageMaxCount`/`getEffectiveVideoReferenceItems`/`getVideoReferenceLimitHint`) + `src/lib/video-reference-modes.ts`(`getVideoReferenceModeOptions`/`getVideoReferenceModeLabel`/`getRequiredVideoReferenceImageCount`：**选项按模型给** —— BytePlus Seedance 3 项、Hailuo 3 四项含尾帧；2026-08-03 收敛，工作流原来那份本地类型**漏了 `last_frame`**，直接导致 H3 一开始不敢在工作流放出来)**、**NEW 徽标 `src/components/new-badge.tsx`(`NewBadge`，配 `models.ts` 的 `isNewGenerationModel`：原来模型下拉是青绿小圆角、侧边栏「工作流模式」是绿色胶囊，同一个东西两种长相，2026-08-03 用户拍板统一)**、模型→端点键 `src/lib/byteplus-provider-key.ts`、**模型拒绝文案 `src/lib/error-message.ts`(`MODEL_REFUSED_PREFIX` + `isModelRefusedMessage` + `buildModelRefusedMessage`：⭐ 2026-07-29 起「模型拒绝 / 平台安全策略 / 版权限制」**三类合并成唯一一句**「模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“…”」，不再按模型分"能不能AI改写"。⛔ 改这句必须同步改三处：`gpt-image-safety-retry.ts` 的**前缀**判定、`admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 归一化、`error-message.ts` 顶部的幂等保护；`LEGACY_MODEL_REFUSED_MESSAGES` 里的老文案只用于判定/后台归一化，禁止拿来生成新文案)**、**AI 安全改写 `src/lib/gpt-image-safety-retry.ts`(`isGptImageSafetyFailure`/`runPromptSafetyRetry`/`ensureMentionNamesPreserved`：⛔⭐ **2026-07-29 起只有工作流用它** —— 对话流与资产库那两套已按用户拍板整体撤掉（对话流"一条提示词出多图"，每张独立改写会让显示的提示词对不上；且并发多链会互抢 `message.requestId` 导致成功图被静默丢弃，正式服实测 17 张成功只剩 2 张、白烧 197 积分）。⭐ **2026-07-30 用户拍板：对话流的 AI 改写彻底不做了（原 M021 已取消），别把删掉的代码捡回来、也别再提重做。**)**、**参考素材 url 归一化 `src/lib/reference-asset-url.ts`(`normalizeReferenceAssetUrl`/`normalizeReferenceAssetUrls`：进模型/送审前必过。把「给人看的动态缩略图接口地址 `/api/media-thumbnail?url=`」和「自家主机绝对前缀（含已退役马来 IP）」一律还原成文件静态直链 —— 平台是来"上门自取"的，给它动态接口它会现场等我们生成缩略图然后超时。8 处咽喉共用：image/video/byteplus-assets 三个 route 入口 + `generation-jobs.resolveReferenceUrls` + openrouter/openrouter-video/seedance/video-route 的底层拼址，禁止再在别处自己判 `startsWith("/generated/")`)**、参考图 hint `src/lib/reference-hint.ts`、错误文案 `src/lib/error-message.ts`、登录失效跳转 `src/lib/session-expired-redirect.ts`、@提及匹配/删除 `src/lib/mention-text.ts`（⭐ 2026-08-02 起也是 **contenteditable 选区引擎的唯一权威**：`getEditableText`/`appendEditorText`/`getSelectionTextOffset`/`getSelectionTextRange`/`setSelectionTextOffset`/`getAtQueryAtCursor(ForReferences)`，对话流输入框与工作流节点输入框共用，采用「mention 原子化」版本——光标绝不落进 @文件名 span 内部；原来两处各存一份且已漂移）、上传文件命名 `src/lib/upload-name.ts`(`resolveUploadName`：同图复用名/异名错开_2/去扩展名/改名跟随；对话流·工作流·资产库 图·视频·音频·文档统一走它，前端只显示服务端返回的 `name`，禁止再在前端各写一套取名/版本化逻辑)、音频波形播放器 `src/components/audio-waveform-player.tsx`(`AudioWaveformPlayer`：wavesurfer.js，`variant="node"` 工作流画布音频节点 / `variant="card"` 资产库上传音频方卡；工作流·资产库统一走它，禁止再各写一套音频播放 UI)、视频播放按钮角标 `src/components/video-play-badge.tsx`(`VideoPlayBadge`：全平台所有视频缩略图中间的播放标记，5 档 size；对话流·工作流·资产库·@引用·图层·后台·上传缩略图统一走它)、**媒体时长校验 `src/lib/media-upload-validation.ts`(`MEDIA_DURATION_EPSILON_SECONDS` 唯一容差常量 + `validateReferenceMediaDurationRange` 单条时长校验唯一实现 + `validateReferenceVideoDimensions` 参考视频纯尺寸校验唯一实现【2026-08-02 收敛，原来 chat-core 和 workflow-inner 各手抄一份 300/6000/0.4/2.5/409600/8295044】；对话流·工作流·服务端三处共用，禁止再在组件里写本地副本——历史上就是各写一份导致 15.35/15.35/16.01 三个数都错)**、**参考素材总时长 `src/lib/upload-rules.ts`(`validateReferenceTotalDuration`)**、**工作流节点下载 `downloadWorkflowNode()`(`workflow-tldraw-canvas-inner.tsx`，图片/视频/文本通用；右键菜单与快捷菜单共用，禁止再内联写一份)**、**静态媒体地址 `src/lib/static-media-url.ts`(`getStaticMediaUrl`/`toLocalGeneratedUrl`/`shouldUseStaticAssetBaseUrl`：对话流·工作流画布统一走它，禁止再各写一份——工作流画布原来那份是空函数，从没生效过)**、**AUTH_SECRET 读取 `src/lib/auth-secret.ts`(`getAuthSecret`：生产没配直接抛错，禁止再写 `|| "flashmuse-local-dev-secret-change-me"` 兜底)**、**接口限流 `src/lib/rate-limit.ts`(`rateLimitAllow`/`getClientIp`)**、**诊断日志轮转 `src/lib/diagnostics-log-rotate.ts`(`appendDiagnosticsJsonl`：三个 diagnostics-log 统一走它，超 20MB 轮转成 .1)**。
- ⛔⛔ **往 `WorkflowSelectedNodeOverlay`（工作流选中节点浮层、含图片/视频快捷菜单）里加 Hook 会把整个 tldraw 画布搞崩**（2026-07-29 踩过）：它在 `workflow-tldraw-canvas-inner.tsx:2493` 有 `if (!selected) return null;`，在其**之后**加 `useMemo`/`useState` 等 → **React #310「Rendered more hooks than during the previous render」** → 点任意节点，画布整个变成「Something went wrong / Please refresh your browser」。**加在提前 return 之前，或干脆别用 Hook。**
- ⛔⛔ **排查对话流失败卡时必读（2026-07-29 踩过、误报过一次）**：失败卡包在 **`<LazyMediaMount height={250}>`**（`chat-workbench.tsx:16531`）里 —— **滚进视口才挂载**，没进视口时 DOM 里根本没有卡；而红字**不在**这个组件里、一直显示。所以**「红字在、卡不在」是正常现象，不是数据丢了**。用 `querySelectorAll('.flashmuse-failed-media-card')` 统计失败卡不可靠，必须先 `scrollIntoView` 再断言。
- ⛔ **"某条原因高度集中在一个入口"不一定是分叉**（2026-07-29 踩过）：后台「失败排查」页那条设计意图会给假信号 —— 先去看「失败最多的用户」卡，如果也集中在一个人，那是用户行为不是代码分叉（101 条里 76 条是同一个人三天刷出来的）。
- 新增模式/模型时：只改统一函数 + 配置表（`system-settings.ts` 的偏好/端点表要**对称补齐所有前缀** conversation-image / asset-image / agent-image / video / agent-video），改完所有模式自动一致。
