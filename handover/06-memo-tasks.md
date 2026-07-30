# Memo Tasks（2026-07-21 重建）

> 备忘任务 = 用户说现在不做、以后可能要做的事。每条有 ID、押后原因、以后怎么做。用户说完成就打 `[x]`。历史完整版在 `historical-handover-docs-last-used-2026-07-21/06-memo-tasks.md`。

## 已完成 / 已过时（一行留档）

- **[x] M002** 静态域名公网访问（2026-06-26 完成）。**[x] M004** commit 已部署改动（已成常态）。**[x] M006** 阿里证书自动续期（webroot 已配）。
- **[进行中→基本完成] M016** 资产入库/显示统一大改造：`media-asset-record.ts` 唯一权威入库、显示统一投影已上线。**M017** 上传按内容 SHA-256 去重：服务端+客户端均已上线（`upload-content-hash.ts`+`contentHash`）。历史数据不回填不删不改。
- **[取消] M021** 对话流的 AI 改写重做 —— **2026-07-30 用户明确说不做了**。对话流「一条提示词出多图」的展示模型与 AI 改写天然冲突，不再考虑重做。⛔ 别再把 v1.0.0.53 撤掉的那批代码捡回来（工作流那份 `gpt-image-safety-retry.ts` 保留不动、继续用）。
- **[取消] M022** 给 `ID_636611` 补积分（d37 丢图事件）—— **2026-07-30 用户明确说不做了**。丢掉的 15 张图本来就都在他资产库里（`image_19_d37`~`image_36_d37`），属"出了但没在对话里显示"，不是白扣，不补。**任何人都没动过他的积分。**

## 已查清 / 无需再查（留档防重复劳动）

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

### [ ] M025 ②「工作流列表不带完整画布」——⭐⭐ **用户要和下一个 AI 讨论，还没拍板。方案 + 实测数据 + 我的建议都在下面，别自己决定**

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

### [ ] M005 输入框 @mention 重构
- 押后：当前 @mention 行为可接受，重构风险 > 收益。逻辑已收敛 `src/lib/mention-text.ts`。
- 以后：若 @ 编辑 bug 复现，做聚焦的 contenteditable mention 重构（原子删除/光标/蓝色渲染）。

### [ ] M007 正式前端监控
- 押后：当前 `/api/client-error` + 浏览器全局捕获够用。以后进正式运营再上正式前端监控系统。

### [ ] M008 媒体存盘队列支持多实例
- 押后：当前 `.runtime/media-save-jobs.json` 单实例够用。多实例部署前移到 DB 表/队列服务。

### [ ] M009 BytePlus 审核 asset-url 流程完善
- 押后：现自动审核首版可用。以后存 provider 可达 HTTPS URL、持久化 approved `assetId`、以 `asset://assetId` 发视频生成。

### [ ] M010 迁移/审计脚本清理
- 押后：临时脚本还有用。以后把稳定的从 `tmp/` 移进 `scripts/`、写用法+dry-run，别删还需要的。

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

### [ ] M023 给 `DATABASE_URL` 显式配 `connection_limit` —— 押后：**等它下次真犯病、拿到现场数据再动**（2026-07-30 用户拍板）

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
