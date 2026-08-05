# Current Handover Changelog · 卷 2（2026-08-03 起用）

> ⭐⭐ **这是当前活跃的流水，新会话的记录写在这里（倒序，最新的放最上面）。**
>
> - **卷 1 = `CHANGELOG.md`**（2026-07-21~2026-08-03，约 467KB / 2538 行）**已归档、只读、勿改**。
>   需要 2026-08-03 之前的详细过程时才去翻它。
> - ⛔⛔ **轮转规则（写进交接文档维护）**：当本文件也变得过大（经验阈值 ≈ 400KB 或 2000+ 行）时，
>   **新建 `CHANGELOG_3.md` 接着写**，本文件转为只读归档；以此类推（4、5…）。
>   ⭐ 新卷开头都要照本文件这样：① 指明上一卷是谁、已归档只读 ② 写一段「当前状态摘要」保证接手能续上 ③ 再往下倒序追加会话记录。
> - 判据不变：**版本号一样 = 测试服和正式服代码一样**（本项目核心约定，见 `AGENTS.md`）。

---

## 📌 当前状态摘要（开卷时的基线，2026-08-03 第三十七次会话之后）

- **四方同步 = `v1.0.0.69`**：正式服 = 测试服 = 本地 = GitHub（commit `9e97c97`）。四域名 main/api/ali/static 全 200。
- **无待部署**（本卷开卷时）；`tsc` 全绿、`npm test` 15/15；Prisma 迁移 33 个，`No pending migrations`。
- **v1.0.0.69 已上线的内容**（详细过程在卷 1 的第 34~37 次会话）：
  1. **MiniMax H3（`minimax/hailuo-3`）视频模型**：接进**对话流 + 工作流**（Agent 按用户要求不接）；
     H3 扣费已用硬证据坐实（GET 上游拿到 `usage.cost` + 账本 `credits` 对得上），并加了兜底价 + `video-job-charged` 日志。
  2. **收敛（"能统一一律统一"）**：扣费用量三件套 → `video-usage-cost.ts`；视频参考模式 → `upload-rules` + `video-reference-modes.ts`；
     NEW 徽标 → `new-badge.tsx`；视频时长选择器 → `video-duration-slider.tsx`（对话流+工作流共用）。
  3. **M033 图片秒回预检**：`asset-upload-temp` 加 GET 预检 + CORS，图片上传前先哈希预检、命中免整包重传。
  4. **M034 分片上传 + 单片重传**：新增 `upload-chunk` 路由 + `upload-chunks.ts` + `chunked-upload.ts`
     （>1MB 才分片、1MB/片、失败只重传该片、assemble 校验整体哈希、临时片处理后必清 + 机会性清孤儿）。
  5. 两处 UI：logo 副标题「AI影游助手」；视频时长选择器改滑块+数字框。
- **账号纪律**：前台一律 `12424740@qq.com`（密码 `dragonstar`）；`lookxun@163.com` 只用于登后台 `/admin`。
- **服务器**：腾讯新加坡 `119.28.116.16`（Docker 栈，跑 app）；阿里 `101.37.129.164`（国内入口/静态镜像/反代回腾讯）。
- **接下来的活跃备忘**（详见 `06-memo-tasks.md`）：M032（参考图偶发挂不上，根因未知）、M029（单轮询器）、
  M030（服务端文档解析）、M026（工作流节点分页）、M015（阿里端压缩，等 M034 效果再定）等。
  ⭐ M035（工作流接 H3）**已完成**；Agent 接 H3 用户明确不做。

---

## 2026-08-05（第四十二次会话）：把上次攒的两批全部推上线 —— **两服都到 `v1.0.0.74`**，并在部署前抓到一个新缺口（`input audio` 版权被拒说成"模型拒绝"）

> 🗣️ **用户指令**：「部署到测试服，测试一下没问题就推到正式服。然后推一次 github」。
> **结果：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.74`（四方同步），用户报的那个 bug 已在正式服端到端验通。**

### 一、先部署 v73（第四十一次会话攒的「查 B_92 顺带修的 4 处」）

`tsc` 全绿 + `npm test` 15/15 → `bump v72→v73` → tgz 6 个文件（`app-version` / `api/video/route`
/ `error-message` / `admin-failure-triage` / `analytics-events` / `transient-error`）→ scp → 解到
`/opt/flashmuse-staging/app` → `up -d --build staging-app`（约 3.5 分钟）→ `sync-ali.sh --stack=staging`
（⛔ 本批不带 `--with-generated`，代码部署不影响 generated）→ `.env` 写 `PUBLISHED_APP_VERSION=v1.0.0.73`
+ force-recreate。验证：`x-app-version: v1.0.0.73` + `/api/health` + 阿里 8080 = 200 + 迁移 `No pending migrations`（33 个）。

### 二、⭐⭐ 部署后验证时抓到一个**新缺口**（这条最值得记）

**回归脚本跑到「参考音频被版权拒」这条用例 FAIL** —— 输出的是「模型因色情/暴力/隐私安全等原因拒绝出图…」，
而不是「参考音频没能通过平台的版权检测…」。

- **根因**：`error-message.ts` 那条精确规则写的是 `input\s+(?:image|video)`，**漏了 `audio`** →
  「`input audio` + 只提 copyright（不提 sensitive）」这一种组合掉进下面那条**裸 `copyright` 兜底**（→ 模型拒绝）。
  `sensitive` 那一路歪打正着能命中（下面还有一条 `sensitive|privacy` 的兜底会调 `detect`），
  **所以只测 sensitive 是测不出来的**。
- ⭐ **这正是上次会话定的口径没落实**：用户原话「图片 视频和音频准确对应就行了。是什么没过就显示什么」——
  `REFERENCE_REVIEW_KIND_LABEL` 里明明有 `audio: "音频"`，**标签准备好了但规则到不了那里**。
  ⭐ **通用判据：新增/细化一个枚举分支时，把"每个分支各自的进入条件"逐个造用例喂一遍**，
  ⛔ 别因为"标签表里写了"就以为通了。
- **修法**：`input\s+(?:image|video|audio)`（一处，并在上面写了 ⛔ 注释说明为什么必须写齐三类）。
- ⭐ **反向用例一条没少**：回归共 **8/8**，其中 **4 条是反向的** ——
  `output video` 版权仍走"成品被拒交付"、`OutputImageSensitive` 仍走"成品图片"、
  `InputTextSensitive` 仍走"模型拒绝/调整提示词"、`output audio` 版权仍走"成品"。
  （脚本 `.runtime/v73-msg-check.ts`，`npx tsx` 直接 import 真实模块喂上游原文，几秒钟。）
- ⭐ **不需要动 `FAILURE_REASON_SQL`**：那条归一化本来就覆盖 图片/视频/音频/素材 四种措辞，只是以前"音频"永远走不到。

### 三、因为改了代码，**重新 bump 到 v74 再推一遍测试服**（保住"版本号一样=代码一样"）

⛔ 没有原地覆盖 v73 —— 那会让"测试服 v73"和"本地 v73"内容不同、直接破坏本项目最核心的那条判据。
v74 走了完整一轮（tgz 2 个文件 → build → sync-ali → 发布信号），验证 `x-app-version: v1.0.0.74` + health + 8080=200。

### 四、测试服上号巡检（6 项全过 + 3 项硬证据）

1 登录 ✅（页脚 `版本号(t):v1.0.0.74`）／2 对话模式 7 条列表 + 历史消息 + 图片 ✅／
3 工作流画布点节点不崩（React #310）✅ 快捷菜单正常／4 资产库缩略图 9/9 加载 ✅／
5 **真跑生视频 ✅ + 真跑生图 ✅**（柯基犬，截图确认真渲染）／6 后台 `/admin` + 「失败排查」页 ✅ **0 error**。

- ⭐ **硬证据 1（构建产物 grep）**：新文案「没能通过平台的版权检测」、后台补的 `版权|copyright`、
  `currentUserId` 三样**都在 `/app/.next/server` 里**（命中即真编译进去了，比看版本号硬）。
- ⭐ **硬证据 2（服务器源码逐行）**：`let currentUserId` 在 **try 之外（579 行）**，
  catch 里 `video-route-failed` 与 `recordGenerationEvent` **都是 `userId: currentUserId`**，
  `failedReferences` 已含 video/audio。
- ⚠️ **踩坑留档：我为了"免费触发一次创建阶段失败"去手打 `POST /api/video`，结果第 4 次真把任务建出来了**
  （前 3 次分别被 `MISSING_REQUEST_ID` / 模型 id 写错 / **参考视频归属校验**挡回来 —— 后者说明
  "拿不存在的本地 url 触发失败"这条路**走不通**，服务端要求参考视频必须是本账号已上传的资产）。
  → **扣了 53 积分**、在测试服"对话流生成视频"里多出 1 条。
  ⭐ **教训：探测失败路径前先想清楚"这条路会不会反而成功"** —— `/api/video` 的默认结果是"开始烧钱"。
  ⭐ 好在它同时顶掉了巡检第 5 项要求的"真跑生视频"。

### 五、正式服部署（v1.0.0.71 → v1.0.0.74，⛔ 不再 bump）

迁移数两服一致（34 个目录 = 33 迁移 + lock）→ **无新迁移**。
备份 `/opt/flashmuse/app-backups/20260805-181042-presync-v74` → staging→prod `rsync -a --delete`
（排除 `.env.local`/`.next`/`node_modules`/`.runtime`）→ **对齐后三项断言**
（版本号 v74、`currentUserId` 4 处、`input audio` 规则 1 处）→ `up -d --build flashmuse-app`（约 3 分钟）
→ `docker cp .next/static` + rsync 到阿里**正式**镜像 `/var/www/flashmuse-static/_next/static/`
→ `.env` 写 `PUBLISHED_APP_VERSION=v1.0.0.74` + force-recreate →
`x-app-version: v1.0.0.74` + health + **四域名 main/api/ali/static 全 200**。

### 六、⭐⭐ 正式服上号巡检：用户报的那个 bug **端到端验通**

- ⭐ **意外收获（重要认知）**：正式服的测试号 `12424740@qq.com` 就是 **ID_636611** ——
  **也就是 B_92 那个用户**。所以 **工作流_11 就是用户报的那个工作流**，
  画布里还能看到 B_92 被拒的那个素材 `video-1785913684561.mp4`（与 `07-...md` 第十九节记的文件名一致）。
- ⭐⭐ **原样复现 → 通过**：工作流_11 的视频节点 `video_4_w11`（Seedance 2.0 Mini / 融合模式 /
  参考 = 1 图 `@林小鹿` + 1 视频 `@video-1785919442384`）点「使用提示词」→ 新节点提示词与参考素材都回来了 →
  时长从 10 秒拖到 **5 秒**省钱 → **点「生成」不再报「视频时长读取失败」，直接 10% 开跑** →
  出片 `video_5_w11`（720×1280 / 00:05，资产库里能看到），**扣 45 积分**。
- 6 项巡检：登录 ✅／对话模式 40 条 + 22 张历史图 ✅／工作流画布点节点不崩 ✅／
  资产库 ✅／**真跑生视频 ✅ + 真跑生图 ✅**（2K 柯基犬，扣 15 积分，截图确认）／后台 `/admin` + 失败排查页 ✅ **0 error**。
- ⭐ **顺带在正式服后台看到"修 1"的现场证据**：那条「参考素材未能通过平台审核…」9 条事件显示
  **「影响用户 0」** —— 正是 `userId` 没记住导致的（历史数据补不回来，v74 之后的新失败会有人）。
  同时这 9 条**被归一化成了一行**（没炸成多行）✅。

### 七、Git（四方同步）

本地攒的**五批**一次性提交并 push：第 39 次并发分片、第 40 次 manifest/缩略图、v72 那批、
B_92 那批、以及本次的 audio 缺口修复 + 文档。

### 八、留痕与账目（⛔ 下一任别当成用户数据）

| 环境 | 留下了什么 | 积分 |
|---|---|---|
| 测试服 | 对话流多 1 条生成视频（我探针误建的，无对话归属）；新对话「v74 巡检：一只柯基犬…」+ 1 张图 | −53、−8（96,111 → 96,050）|
| 正式服 | **工作流_11 新增视频节点 `video_5_w11`**（5 秒，就是复现用户 bug 那次）；新对话「v74 正式服巡检：一只柯基犬…」+ 1 张 2K 图 | −45、−15（9,888 → 9,828）|

### 九、⛔ 本次没做的事

- **红字一条都没归档**（B_92~B_98 那类按铁律"该一直亮着"；其余也没跑归档脚本）。
- M037 / H3 真跑验扣费 / M036 / M015 / M032 全部未动。

---

## 2026-08-05（第四十一次会话）：① 修「工作流『使用提示词』后发送报『视频时长读取失败』」（v1.0.0.72 **测试服已部署+实测全过**）② 查清正式服 B_92 并顺带修 4 处（**未部署**）

> **本次会话两件事**：前半段修用户在正式服报的那个"发不出去"的 bug（已部署测试服 v72 + 上号实测全过）；
> 后半段查用户点名的红字 B_92（用户侧问题、不归档），顺着它修掉 4 个我们自己的毛病（**这批还没部署**）。
> ⛔ **正式服全程没动**（仍 v1.0.0.71），本地五批都还没 commit。

- 🗣️ **用户起点**（正式服真实反馈）：「工作流_11 里用两张图和一个视频生成了一个视频，点这个视频的
  『使用提示词』出来一个新的视频节点，点发送提示我视频时长读取失败，不能发送。」

### 一、根因（⭐ 判据条件抄出来逐项验过，不是猜的）

**「使用提示词」还原出来的参考视频/音频，压根没带 `durationSeconds` 和 `dimensions`。**

- `workflow-tldraw-canvas-inner.tsx` 的 `addNodeFromPrompt` 里，从后端权威 job 还原参考素材时只造了
  `{ id, kind, name, url, status, progress }` —— **少了时长和宽高**。
- 而发送前的 `validateWorkflowUploadsForSubmit`（同文件 ~937 行）**逐个校验参考视频的时长**：
  `if (!Number.isFinite(durationSeconds) || !durationSeconds) return "视频时长读取失败"` →
  **发送被永久拦死**，而且用户在界面上没有任何办法补这个值（只能删掉素材重新 @ 一次）。
- ⭐ **三条对得上的旁证**：
  ① **只有工作流会中招** —— 对话流的「使用提示词」不做逐条时长校验（只校验总时长，缺值按 0 算，不拦）；
  ② **纯参考图不会触发** —— 时长校验只对 video/audio 跑（用户正好是两图 + 一视频）；
  ③ **老路径不会中招** —— 画布内联快照 `legacyUploads` 是把字段整个带过来的；
     后来改成"从后端权威 job 读"（为了瘦身 canvas）才把这两个字段丢了。**这是那次瘦身的漏项。**

### 二、改了什么（4 个文件，一份实现）

1. **`src/lib/generation-jobs.ts`** 新增 `resolveReferenceMediaMetadata(userId, urls)`：
   按 url 反查 `MediaAsset` 拿 `durationSeconds/width/height`（这些值本来就在库里：
   上传走 `media-upload-probe` 写、生成走 `video-poster` 写）。匹配 `url` + `normalizedUrl` 两列，
   口径与 `resolveReferenceNames` 完全一致；best-effort，查不到就不返回。
2. **`src/app/api/workflow-generation-references/route.ts`**：返回的 references 给视频/音频带上时长与宽高。
   ⭐ **只有真有视频/音频参考时才多查一次库**（`mediaUrls.length > 0`）——
   纯参考图仍是 1 个跨境往返（这是交互路径，每个往返 ~0.4s，不能变慢）。
3. **`src/components/workflow-tldraw-canvas-inner.tsx`** 两处：
   - `addNodeFromPrompt` 里把后端直出的时长/宽高填进 uploads；
   - ⭐⭐ **`WorkflowPromptBox` 里加了唯一的自愈 effect**（`mediaMetadataAttemptedRef`）：
     只要节点上还有缺元数据的视频/音频（`status==="ready"`、非 blob:），就在浏览器里
     `readWorkflowMediaMetadataFromUrl` 读一次补上，每个 upload.id 只尝试一次、失败不重试。
     **放在节点身上而不是只放在「使用提示词」那条路上，是为了让「已经存进数据库的坏节点自己好起来」**
     —— 用户正式服上那个卡住的节点，打开工作流就自动修复，不用删素材重建。⛔ 别再在别处写第二份补齐逻辑。
4. **`src/lib/chat/chat-workbench-core.tsx`**：`getWorkflowMeaningfulSnapshot` 的 `stripData` 里
   **把 uploads 上的 `durationSeconds`/`dimensions` 也剥掉**。
   ⭐ **为什么必须配这一步**：这两个是"打开工作流就会被自动补齐"的派生字段，不剥掉的话
   **仅仅打开一次工作流就会被当成"用户改了内容"顶到列表最前面**（那个函数的注释里早就警告过这类字段：
   `videoDimensions`/`durationSeconds`/`imageDimensions` 都在 `stripKeys` 里，只是漏了 uploads 里面那一层）。

### 三、测试服部署 v1.0.0.72（照 `03-deploy-and-servers.md` 流程，无迁移、无 compose/nginx 改动）

`bump → tgz(5 个文件) → scp → tar -xzf → up -d --build staging-app`（build ~3.5 分钟）
`→ sync-ali.sh --stack=staging`（_next/static 40 个 + home-assets 18 个，⛔ 本批没带 `--with-generated`：
代码部署不影响 generated，省时间）`→ .env 写 PUBLISHED_APP_VERSION=v1.0.0.72 + force-recreate`。
验证：`x-app-version: v1.0.0.72` + `/api/health {"ok":true}` + 阿里 8080 = 200。

### 四、上号实测（**6 项巡检全过 + 3 项针对性验证，console 0 error**）

- ⭐⭐ **针对性验证 1（后端直出，二值）**：在页面里直接 POST `/api/workflow-generation-references`
  拿两个历史 job：视频 ref 返回 `durationSeconds:15.1 / 1280×720`、另一个 `12 / 1280×720`，
  音频返回 `4`，**图片 ref 不带这些字段**（符合设计）。
  ⭐ 那个 `15.1` 正是"我们自己生成的 15 秒视频实际 15.1 秒"，靠 `MEDIA_DURATION_EPSILON_SECONDS=0.2` 才过 —— 容差没白留。
- ⭐⭐ **针对性验证 2（原样复现用户场景 → 成功）**：测试服 **工作流_01** 的视频节点
  `workflow_node_mrthvhli_yfn1a19`（Seedance 2.0，参考 = 1 图 + 1 视频 + 1 音频）点「使用提示词」→
  新节点 uploads 回库里带 **video `durationSeconds:12` + `1280×720`、audio `4`、image 无时长** →
  **点发送不再报「视频时长读取失败」，直接开跑**（4%→82%→完成）→ 出片 `video_3_w1`（5.06 秒 + 封面）。
  ⭐ 顺手把时长从 15 秒拖到 **5 秒**省钱（滑块拖动实测正常）：**扣 111 积分**。
- ⭐ **针对性验证 3（不再被顶到列表最前，二值）**：打开 工作流_01 **之前**列表序为
  `12,11,10,09,08,07,06,05,04,02,01,03`，**只打开、不改动之后 工作流_01 仍在原位**（没顶到最前）→
  第 4 条改动生效。（之后我真的加了节点，那时它才上去 —— 那是正确行为。）
- 6 项巡检：登录 ✅ / 对话模式历史消息+图片 ✅ / 工作流画布点节点不崩（React #310）✅ /
  资产库缩略图 ✅ / **真跑生视频 ✅ + 真跑生图 ✅** / 后台 `/admin` ✅ 且 `browser_console_messages` **0 error**。
- ⚠️ **测试服留痕**（用户交代测试内容不要删）：
  ① 工作流_01 新增视频节点 `video_3_w1`（Seedance 2.0 / 16:9 / 720p / 5 秒），**扣 111 积分**；
  ② 新建 **工作流_13** + 图片节点 `image_1_w13`（Seedance 4.5 / 16:9 / 2K，白猫窗台），**扣 3 积分**。
  积分 96,225 → 96,111。

### 五、顺着「查 B_92」又修了 4 处（🗣️ 用户：「全都做掉吧」）—— ⛔ 这批还没部署

🗣️ 用户接着问「查一下正式服 B_92 是什么问题」。**结论：用户侧问题，不是我们的 bug、没扣钱、不归档。**
完整查法 / 事实 / 归档判定 / 我一开始的错误归因 → 都写进 **`07-red-error-triage-and-archive.md` 第十九节**。

- **B_92 是什么**：2026-08-05 07:23 UTC，用户 ID_636611 工作流生视频（融合模式，1 图 + 1 视频），
  BytePlus 拒了**那个上传的参考视频**，原文
  `The request failed because the input video may be related to copyright restrictions.`
  ⭐ **B_92~B_98 共 7 次**（5 分钟内连点、还换了模型 seedance-2-0 → 2-0-mini），都一样被拒。
  **没扣钱**（`CreditLedger` 0 行、`GenerationJob` 都没建成）。⛔ **不归档**（它从来没落进兜底桶）。
- ✅ **修 1：失败事件没记 userId**（`api/video/route.ts` 最外层 catch）→ 这 7 条在库里 `userId` 全空，
  后台「失败最多的用户」整批统计不到。根因是 `const user` 在 `try` 里、catch 看不见 →
  提了个 `let currentUserId` 出来。
- ✅ **修 2：失败现场日志不记参考视频/音频** → `video-route-failed` 和 `video-request-error` 的
  `references` 原来只映射 `referenceImages`，"哪个视频被拒"看不到（我这次只能回头翻 create-start）。
- ✅ **修 3（做了又撤了，别再做）**：我一度改成「上次审核被拒过就不再送审、直接抛上次的错」
  （省约 14 秒 + 不在平台上堆 Failed 素材）—— **但它和用户最终定的红字口径「重试可能通过」直接矛盾**：
  缓存上次的否决 = 重试永远不可能通过 = 红字骗人。🗣️ 用户明确说平台这个检测会误判、重试可能过
  （每次重新送审 = 平台重新过一次审）。→ **已撤回原样**，并在 `video/route.ts` 那段
  `if (status === "Failed")` 上写了 ⛔ 注释钉住；`transient-error.ts` 也一并还原（不留死代码）。
  ⭐ 教训：**"减少无用重试"这类优化，动手前先问"用户看到的文案有没有承诺这次重试有意义"** ——
  不一致时**改链路去迁就文案**（文案是产品口径），别反过来。
- ✅ **修 4：后台「审核类」分类漏了"版权"** → `analytics-events.ts` 的 `isModerationReason` 正则里
  没有 `版权|copyright`，只提版权的失败会被静默漏算。已补。
- ✅ **文案最终版（🗣️ 用户改了三轮，第三轮给的原句：「图片 视频和音频准确对应就行了。是什么没过就显示什么」）**：
  **「参考{图片|视频|音频|素材}没能通过平台的版权检测（可能涉及真人、隐私或版权），重试可能通过，但建议更换参考素材后再重试成功率更高。」**
  - 三轮教训（我三次都自作聪明写多了）：① 「自己拍摄或自己生成」→ 用户改成「AI生成」；
    ② ⛔ 我编了「（例如影视剧、动漫、综艺等片段）」→ 用户否掉，我回头查库坐实**他是对的**
    （那素材是 576×1024 / 10.3 秒 / 753KB、文件名 `video-1785913684561.mp4`，毫无影视剧痕迹）→
    **通用规矩：拿不到证据的原因，红字里只许说"平台判定/检测"，⛔ 不许替平台编理由**；
    ③ 最终按素材类型精确对应，并把结论改回「**重试可能通过**」。
  - 实现：`buildReferenceReviewRejectedMessage(kind)` + `detectReferenceReviewMediaKind()`，
    **精确规则与宽松兜底两条共用**；⭐ 顺带**删掉**我上一版那条单独的"input video 版权"规则
    （少一条规则少一个抢匹配的坑）。类型识别**只认 input/参考 语境**，绝不把 `output` 认成参考素材。
  - ⛔⛔ **一个根因裂成 4 种措辞 → 后台会炸成 4 行**（第五节那个老坑）→ 已在
    `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 加归一化收回一行，**改措辞必须同步改那条正则**。
    ⭐ 已在正式服库上用 7 条样本实跑：4 种措辞并成 1 行，老文案 / 成品被拒 / 兜底桶三条**都没被误碰**。
  - ⭐ 回归 **11/11**（`npx tsx` 直接 import）：8 条正向（图/视频/音频 × 版权/敏感/真人 + 2 条回落素材）
    + **3 条反向**（`output` video 版权 → 仍"成品被拒交付"；`OutputImageSensitive` → 仍"成品图片"；
    `input text` 敏感 → 仍"模型拒绝"）。**反向那 3 条最容易被新规则抢走，绝不能省。**
  - ⚠️ 纯语法坑（我连踩两次）：**块注释里别让连续星号紧邻斜杠** —— 注释里写 Markdown 粗体再跟斜杠分隔
    会拼出块注释结束符、把注释提前闭合，`tsc` 报一片莫名其妙的 TS1109/TS1127/TS1443，从报错完全看不出是注释问题。
- ⭐ 顺带排除一个虚警：正式服容器里 **`ffprobe` 不在 PATH 是正常的** ——
  `video-poster.ts` / `media-upload-probe.ts` 用的是 npm 打包的 **`ffmpeg-static`**，
  注释里明写"无需 ffprobe"。⛔ 别当成缺依赖去"修"。
- 改动文件：`api/video/route.ts`、`lib/error-message.ts`、`lib/admin-failure-triage.ts`、`lib/analytics-events.ts`
  （`lib/transient-error.ts` 只剩注释加强，逻辑已还原）。
  `tsc` 全绿、`npm test` 15/15、这几个文件 eslint 0 问题。**⛔ 未部署**（v72 那批已在测试服，这批还没上）。

### 六、本次会话的遗留（接手先看这里）

| 项 | 状态 |
|---|---|
| 测试服 | **v1.0.0.72** 已部署 + 上号实测全过（不含第五节那 4 处） |
| 正式服 | **仍 v1.0.0.71** —— ⛔ 全程没动（用户没说"部署正式服"） |
| GitHub | **仍 v1.0.0.69（`9e97c97`）** —— 本地**五批**未 commit/未 push |
| 第五节那 4 处 | **一行都没部署**，要上测试服得 bump 到 **v1.0.0.73** |
| 无 Prisma 迁移 / 无 compose / 无 nginx 改动 | 本次两批都是纯应用代码 |

- ⭐ **正式服部署后有个免费的好事**：用户那个卡住的节点（工作流_11）**打开工作流就会自愈**
  （自愈 effect 会补上时长/宽高），不用手工改数据。
- ⛔ **B_92~B_98 不要归档、也不要跑归档脚本**（判定见 `07` 第十九节 C 小节）。
- ⭐ **第五节那 4 处值得实测的两项**（都能二值判断）：
  ① 故意让一次工作流生视频在创建阶段失败 → 查库 `GenerationEvent.userId` **不再是空**；
  ② 让参考视频/音频被拒一次 → 红字应当直接说「参考**视频**/**音频**」而不是笼统的"参考素材"。

---

## 2026-08-04（第四十次会话）：两端媒体复查 + 修 manifest 公网泄露 + 上传缩略图同步阿里 + 缩略图逻辑收敛 + 上传去重死代码 + 进度节流（v1.0.0.71 **两服已部署**）

- 🗣️ **用户起点**：「查一下 8 并发上线后阿里的视频媒体数量和腾讯是否一样、还有没有没下载到的」
  （⚠️ 实际并发是 **16** 不是 8）。
- ✅ **两端媒体复查**：腾讯 21904 个 / 21.82GB。开查时差 **78 个**（缩略图 75 + 其它 3），
  **mp4：腾讯 3084 / 阿里 3095（阿里多 11 个旧残留）→ 视频一个不缺**。
  补完 78 个（25 秒、0 失败）→ 复验 `--dry-run` = **「✅ 两端已一致，需要传 0 个」**。阿里多出的仍是 225 个（M036）。
- ⭐⭐ **顺带查 `videos/manifest.json` 为什么没同步，挖出两个真问题**：
  1. 🔴 **它公网无鉴权可读 = 全站用户创作内容泄露**。它是服务端「视频恢复台账」（最近 500 条），
     历史上落在 `public/generated/` 下，而 `/generated/` 是 nginx 直接 serve 的公开目录 →
     实测 `https://static.venusface.com/generated/videos/manifest.json` 返回 **200 + 1.68MB 明文**，
     里面有**所有用户的完整提示词、用户 ID、供应商预签名下载地址**（24h 内谁都能直接下片）。
     ⭐ 而它**只被服务端从本地磁盘读**（前端/阿里压根不读）→ 挪走零功能影响。
  2. 🟡 **上传图的缩略图从来不同步阿里**：上传接口只同步**原图**，而缩略图是 `/api/media-thumbnail`
     **按需现生成**的，那条路压根没调过同步 → 阿里镜像里一张上传缩略图都没有
     （这次缺的 75 个文件全是 `image-thumbnails/upload_image/…`），国内用户看图库要跨境回源。
- ✅ **本次改了什么**：
  1. **台账搬出 public**：`video-manifest.ts` → `.runtime/video-manifest.json`；
     **读**先新位置、没有就回落老位置（历史 500 条不丢）；**写**改「写 `.tmp` 再 rename」原子落地；
     写成功后**自动 unlink 老位置那份公开文件**（自我清理，不用手动 rm）。
  2. **nginx 兜底 404**：`location = /generated/videos/manifest.json { return 404; }` 加进
     腾讯正式 2 个 server 块 + 3 份测试服 conf；阿里正式那份混着 `tiantangqiyuan`，
     写了幂等增量脚本 **`deploy/ali/ali-deny-video-manifest.py`**（marker 幂等 + 计数断言=2 + 别的项目条数不变断言 + 失败回滚）。
  3. **缩略图新建后同步阿里**（修 ②）。
  4. ⭐ **缩略图逻辑收敛**：`api/media-thumbnail/route.ts` 和 `local-assets.ts` 原来存着**一字不差的两份**
     ffmpeg 缩略图逻辑（连 `scale=256:256` / `-q:v 5` / timeout 都一样，2026-06-05 先有路由那份、
     06-08 加即时生成时照抄了一份）→ 收敛成唯一实现 **`ensureGeneratedImageThumbnail(url, { syncToAli })`**，
     `createGeneratedImageThumbnail` 变薄封装（5 个既有调用方零改动）。
     ⭐ `syncToAli` 做成**选项、默认 false**：那 5 个调用方是把 `[localUrl, thumbnailUrl]` **合成一次**
     同步发的，而那次的 `ok` 就是 `job.aliSynced`（前端拿它判断能不能读阿里镜像）——
     无条件同步会重复传 + 让 aliSynced 语义变模糊。安全校验（路径穿越 + 后缀白名单）**刻意留在路由**。
  5. 🐛 **修掉工作流上传去重的死代码**：两处判据是 `mediaSystemNames里的名字 === file.name`，
     而**存的名字永远不带扩展名** → `"少尉" === "少尉.jpg"` 永远 false →
     「已存在，已直接连接」提示**用户永远看不到**、同图传两次会**建重复节点**。
     新增 `matchesWorkflowUploadFileName()`（去扩展名 + 客户端兜底名两种口径）统一两处。
  6. ⚡ **进度节流** `throttleUploadProgress()`（`upload-progress.ts`）：100 一定放行，
     其余要么涨够 5% 要么隔 300ms —— 只包在工作流那 4 个上传调用点（对话流保持顺滑）。理由见 M037。
- ⭐⭐ **两个用户问题的调查结论（都有硬数据，见 `06-memo-tasks.md` 的 M032 / M037）**：
  - **M032**：**B 的第三个假设也被证伪**（`findExistingUploadNodeForFile` 和历史资产恢复**同一个原因**都进不去）；
    查正式服数据 354 条工作流上传，**"节点在+url不在"= 0 条** → 历史上零条"节点建了图没上去"。
    剩下两个假设（新节点在视口外 / 校验拒绝 toast 一闪而过）**保持不许动代码**。
  - **「工作流上传比对话流慢」**：**不是传得慢也不是服务端慢**（同一接口，
    正式服 `asset-upload-temp-post-success` 1597 条 p50 **1073ms**）——
    是 `updateNode(uploadProgress)` → `updateState` **每次都把整张画布重算一遍**
    （导出全画布 + `JSON.stringify` 655KB + 所有节点 updateShape + O(边×节点) + 父级 6 次快照），
    而进度事件一次上传 **70~100 次** → **O(进度×节点数×画布大小)，节点越多越卡**。
- ✅ **测试服 v71 实测（5 项全过）**：同图传第二次**真的弹出「v71-dup-test.jpg 已存在，已直接连接」且节点数不变**；
  新缩略图 **10 秒内出现在阿里、字节一致**（传输日志 `kind:"thumbnail"`）；两张 4.76MB 图走分片正常落地；
  真跑生图 16 秒出图、`ali-sync-summary okCount:2 failedCount:0`；manifest 三个入口全 404；控制台 0 error。
- ✅ **正式服 v71 已部署 + 巡检全过**：四域名 200、`No pending migrations`（33=33）、
  manifest **四域名全 404**、别的项目（`tiantangqiyuan`）200、资产库 33 张图 0 破图、
  **真跑生图成功**（GPT-5.4 Image 2，积分 10,145→10,130）、点节点不崩、控制台 0 error。
  ⭐⭐ **台账迁移在正式服实测生效**：老文件 `generated/videos/manifest.json` **已被代码自动删除**，
  新台账 `.runtime/video-manifest.json` **1,706,585 字节、属主 ubuntu:netdev（uid 1000 可写）**，历史数据没丢。
  ⭐ 另外发现**阿里侧压根没有这个文件的本地副本**（它一直是 `try_files → @generated_proxy` 回源腾讯拿的）
  → 腾讯那份一删，泄露就从源头断了，nginx 404 是第二道保险。
- 备份：DB **`pre-deploy-v71`**（5.5M 已校验、异地同步 OK）+ app **`20260804-232929-presync-v1.0.0.71`**（145M）。
- ⛔⛔ **本次踩的新坑（已写进 `03-deploy-and-servers.md`）**：
  1. **单文件 bind mount 用 `cp` 覆盖会换 inode → 容器里永远还是旧文件**（`nginx -t` 通过、
     reload 成功、宿主机文件已更新，但容器里 `grep` 是 0 行、manifest 还是 200，查了三轮才发现）。
     ⭐ 判据：`docker exec <c> wc -l <挂进去的文件>` 和宿主机行数不一致 = 中了。
     正解：**`cat 新文件 > 目标文件`** 原地写（保 inode）；已经 `cp` 过就必须 **`up -d --force-recreate` 那个容器**。
  2. ⛔⛔ **PowerShell 5.1 会把 ssh 命令里的内层双引号吃掉** → 多条命令只有第一条发给远端、
     其余在**本地**执行（本次出现过 `whoami`=root 紧接着 `id`=ubuntu 这种自相矛盾的输出，
     还误判过"阿里 key 没权限 / 文件不存在"）。**凡是要在远端跑多条命令，一律写成 .sh scp 上去跑。**
- ✅ **自查**：`tsc --noEmit` 全绿；eslint **28 个问题 = 改前改后完全相同**（既有基线，零新增）；`npm test` 15/15。
- 📌 **留痕**：测试服 `12424740@qq.com` 新建 **`工作流_12`**（4 个节点：1 小测试图 + 2 张 4.76MB 噪声图 + 1 个生成节点 + 1 张生成图）；
  正式服同账号新建对话「一只戴着围巾的小狐狸站在雪地里」+ 1 张生成图（−15 积分）。按规矩都没删。
- ⚠️ **仍未做**：GitHub 未推（本地三批未 commit）；真跑 H3 生视频验 `video-job-charged`；后台 `/admin`（需切 lookxun）。

---

## 2026-08-04（第三十九次会话）：查清「正式服两条视频看不了」的真根因 + 腾讯→阿里传输全面改并发分片（v1.0.0.70 两服已部署）

- 🗣️ **用户报障**：「我在工作流和对话流各生了一条视频，但是过了很久都没法看。可能已经下载好了，但没有传回阿里。」
- ⭐⭐ **根因（用户的判断基本对了一半）**：视频**生成成功、下载到腾讯成功、数据库记录也对**，
  但 **同步到阿里对大文件 100% 失败** → 阿里本地没有 → 前端从 `static.venusface.com` 读时走
  「阿里跨境回代理腾讯」的慢路径拉 20MB → 一直转圈。
  - `ali-sync.ts` 原来是 `rsync -azR` **单流**推，而这条跨境线 **RTT 278ms / 丢包 20~25%**，
    单流只有 **15~30 KB/s** → 18.8MB 要 10 分钟以上，而代码里 rsync 超时是 **120 秒 = 一次都不可能成功**。
  - 线上诊断日志实测 `aliSynced` **成功 43 / 失败 79**，失败的几乎全是视频（图片小能挤过去，所以长期没暴露）。
- ⭐⭐ **顺带查清用户追问的「为什么阿里线读不出来、腾讯线就可以」**（两条路的**跨境段根本不是同一条路**）：
  用户家宽（电信）直连腾讯新加坡是好路（~60ms、几乎不丢包）；阿里 ECS 出国走阿里云自己的国际转接，
  traceroute 看到**第 18 跳一下 +190ms（绕远）**、末段丢包 20~40%。按 `MSS/RTT/√丢包` 估算两者差 ~65 倍，
  和实测吻合。⛔ **我一度说"阿里云默认国际出口就这样"，是错的** ——
  实测阿里→OpenRouter **3,974 KB/s**、阿里→BytePlus **752 KB/s**（都 0 丢包，后者 RTT 398ms 比腾讯还高）
  → **阿里国际出口很好，唯独「阿里↔腾讯新加坡」这一对烂；真凶是丢包不是延迟。**
- ⭐ **并发扫描定最优值**：单流 15~30 / 4→147 / 8→357 / **16→461** / 32→329 KB/s（**16 最优，32 反而更差**）。
- ✅ **本次实现（🗣️ 用户拍板「压缩和重封装保持现状不变，只把传输全走并发」）**：
  1. **新增 `deploy/ali-parallel-pull.sh`** —— 阿里侧并发分片拉取器，**唯一实现**，被 ali-sync 和补数据脚本共用。
     两条路都做：**小文件（<=256KB）跨文件并发** + **大文件分片并发且片大小自适应**
     （`clamp(ceil(size/并发), 256KB, 1MB)`；固定 1MB 时 2.72MB 只切 3 片，实测只有 44KB/s）。
     逐片校验字节数（丢包时 curl 会提前结束却返回成功）+ 整体 md5 + `mv` 原子落地 + 单片重试 + 幂等跳过。
  2. **重写 `src/lib/ali-sync.ts`**：改走上面的拉取器；**签名不变**（调用方无需改）；
     没配 `ALI_SYNC_PULL_BASE_URL` 时**退回单流 rsync 兜底**（日志里 `via:"rsync"` 可辨认）。
  3. **新增 `src/lib/transfer-log.ts`** → `.runtime/transfer-diagnostics-log.jsonl`
     （🗣️ 用户要求「按时间记速度，以后看日志再优化」）：`ts`+`tsEpochMs`、bytes、durationMs、kbps、
     concurrency、chunks、retries、via、requestId/userId/model。同时给 `media-save-queue` 补了
     **`provider-download`**（供应商→腾讯下载速度）。
  4. **新增 `scripts/backfill-ali-media.sh`**：比对两端清单→只补差异，分批、flock、幂等可重跑。
  5. **`deploy/sync-ali.sh` 改并发**：`_next/static`/`home-assets` 走**分桶并发 rsync**（8 桶）
     + 最后单流 `--delete` 对齐（⛔ --delete 绝不能进分桶，会互删）；`generated` 交给 backfill 脚本。
- ✅ **实测效果（真实文件）**：20.9MB 视频 **571 KB/s**、18.9MB **586 KB/s**、9.9MB **606 KB/s**，
  md5 全部一致、0 重试、临时文件清理干净。**那两条视频已推到阿里**，正式服上号实测
  `readyState=4`、**真的播起来了**（1.5 秒内进度走到 1.46s，18.4MB 用 2.386 秒传完，`X-...-Source: local`）。
- ✅ **两服均已部署 v1.0.0.70 并上号巡检**：
  测试服（真跑生图成功、传输日志逐条落盘）；正式服（四域名 200、无待应用迁移、真跑生图成功、
  工作流视频能播、资产库 31 张缩略图 0 破图、控制台 0 error）。正式服备份 `pre-deploy-v70`（5.3M 已校验）+
  app 目录 `20260804-043833-presync-v1.0.0.70`。
- ⚠️ **两服 `.env.local` 各加了 `ALI_SYNC_PULL_BASE_URL`**（正式 `:5000`、测试 `:5001`）。
  **env 不随代码同步**，重建 env / 新服务器时别忘。
- ⛔⛔ **踩坑留档**：补数据脚本以 root 跑，**首次创建**传输日志文件 → 属主 root → 容器里 app（uid 1000）
  `appendFile` 失败被静默吞掉 → **同步成功但应用侧零日志**。已在脚本里加 `chown 1000:1000`，
  并在部署时预置好文件属主。
- ✅✅ **补数据完成、两端媒体已完全对齐**（🗣️ 用户要求「保证两台服务器的媒体数量内容一致」）：
  - 开跑前缺口 **1245 个 / 1.11GB**（视频 135 个占 1061MB = 95% 的缺失字节；缩略图 941 个但只 7.93MB）。
  - 结果：**传成功 1245 / 跳过 0 / 失败 0**，耗时 **61 分 55 秒**，平均 **314.6 KB/s**（分 7 批，每批 200 个）。
    单批最快 453 KB/s，日志里单文件最快 **939.4 KB/s**。
  - **复验（`--dry-run`）：腾讯 21320 个 → 需要传 0 个，「✅ 两端已一致」**。
    阿里侧无 `.fmpart.` 残留、无临时目录残留。
  - ⚠️ **阿里多出 225 个条目**（腾讯没有的，疑似压缩前的旧版本）。**脚本故意不删**，
    🗳️ **要不要清理还没跟用户确认**（见 `05-next-actions.md` 待办）。
- 📋 **运维备查（下一个接手的人照这个用）**：
  - **看速度**：`.runtime/transfer-diagnostics-log.jsonl`（正式服在 `/opt/flashmuse/data/runtime/`）。
    `source:"backfill"` = 补数据脚本写的；没这个字段 = 应用实时同步写的。
  - **补缺口 / 对齐两端**（幂等，随时可跑）：
    `sudo bash /opt/flashmuse/app/scripts/backfill-ali-media.sh --stack=prod [--dry-run] [--limit=N] [--batch=N]`
    ⚠️ 全量约 1 小时，**务必 nohup 后台跑**：`sudo nohup bash ... > /tmp/backfill-prod.log 2>&1 &`
  - **调并发**：env `ALI_SYNC_CONCURRENCY`（默认 16，代码里 clamp 到 1~24）、`ALI_SYNC_CHUNK_BYTES`（默认 1MB 上限）。
    ⛔ **别调到 32**（实测反而更慢）。
- ✅ **自查**：`tsc --noEmit` 全绿、`eslint`（4 个改动文件）0 问题、`npm test` 15/15。
- 📌 **本次痕迹**：测试服 `12424740@qq.com` 两条生图对话；正式服同账号 1 条新对话 + 1 张生成图（按规矩没删）。
- 🗣️ **用户明确否掉/已定的**：① 去掉视频压缩 → **不做，压缩和 faststart 重封装保持现状**
  （查证发现供应商原始 mp4 的 moov 都在尾部 99.9%，去掉压缩会让所有视频开播变慢）；
  ② 阿里直连供应商下载 → **不做**（md5 证明只有部分视频字节一致，图片 100% 不一致、封面缩略图供应商压根没有），
  最终选「阿里从腾讯并发拉」；③「所有连接走并发」= **所有传文件的地方**，API/页面代理无法拆分并发，维持现状。

---

## 2026-08-03（第三十八次会话）：正式服部署 v1.0.0.69（四批一起同步）+ push GitHub + 备忘文档维护

- 🗣️ **用户指令**：「全部同步到正式服，然后推一次 github」→ 之后「CHANGELOG 太大，总结一个新的 CHANGELOG_2 出来，以后写这里；轮转规则写进交接文档维护」。
- **部署 v1.0.0.69 到正式服**（此前正式服停在 v67，落后 34/35/36/37 四批）：
  - 严格走 `03-deploy-and-servers.md`「正式服部署流程」：
    带标签数据库备份 `pre-deploy-v69`（5.3M，已校验）→ 备份 app 目录 `20260803-205403-presync-v1.0.0.69`
    → staging→prod rsync（不再 bump）→ build 重建容器（health=v69、`No pending migrations`）
    → 同步 `.next/static` 到阿里正式镜像（rc=0）→ `.env` 写 `PUBLISHED_APP_VERSION=v1.0.0.69` + force-recreate
    → 四域名 main/api/ali/static 全 200。
  - **无新迁移**（33=33）、无 compose 改动（仅 `src/proxy.ts` matcher 加 `upload-chunk`，已随代码同步）。
- **commit + push**：`05035da..9e97c97`，四方同步恢复到 v1.0.0.69。
- **正式服上号巡检**（`12424740@qq.com`）：登录进工作台（页脚 v69）✅、对话模式历史渲染✅、
  侧边栏「工作流模式」NEW 徽标 + logo「AI影游助手」✅、工作流画布点节点不崩✅、资产库缩略图✅、
  **真跑生图**（GPT-5.4 出图、URL 有效、积分 11061→11031 正常扣）✅、全程控制台 0 error✅。
  ⚠️ **未做**：真跑生视频（动过视频扣费代码，但费时/花钱，等用户 go）、后台 `/admin`（需切 lookxun）。
  📌 **留痕**：正式服 `12424740@qq.com` 新建对话「一只戴宇航头盔的橘猫…」+ 4 张生成图，按规矩没删。
- **备忘维护**：把 `06-memo-tasks.md` 的 **M035 标成 `[x]`**（工作流接 H3 其实第 36 次会话已完成、平行参考模式实现已收敛；
  Agent 按用户要求不接）—— 原备忘那条是旧描述、没跟上代码。
- **本次（changelog 轮转）**：新建本文件 `CHANGELOG_2.md`，卷 1 `CHANGELOG.md` 转为只读归档；
  轮转规则写进 `00-README.md` 的文档索引 + 本文件顶部。
