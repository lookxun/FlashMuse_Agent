# Product Rules（2026-07-21 重建）

> 详细历史规则在 `historical-handover-docs-last-used-2026-07-21/04-product-rules.md`（工作流细则很长）。这里保留仍有效的核心与铁律。

## 产品形态

- `闪念 / FlashMuse`：内部简易「即梦式」创意助手。模式：Agent/通用对话、图片生成、视频生成、资产库、工作流。
- 工作流模式在**正式服已开启**（历史上曾 feature-gate，现已放开）。

## ⭐⭐ 工作流：一个生成节点**永远只出一张图 / 一个视频**，不会多图（🗣️ 2026-08-01 用户确认，产品层面定死）

🗣️ **用户原话意思**：「一个节点当前不可能生成四张图片，一个节点只能生一个视频或一张图片，
生成后输入框就消失了，不可能生成覆盖原来的。」+ 「**我确定以后也不会有一处节点生多图的情况。**」

- **和对话流的区别**：对话流输入框有「4张」那个数量按钮（一条提示词出多图）；
  **工作流没有数量选项**，一个节点 = 一次生成 = 一张图 / 一个视频。
- **代码上的三处保证**（`workflow-tldraw-canvas-inner.tsx`）：
  | 位置 | 事实 |
  |---|---|
  | 4349 行 发给 `/api/image` 的请求 | 写死 **`count: 1`** |
  | 4292 行 `applyImageNodeResult` | `images` **直接覆盖**、不是追加（重新生成/高清/去背景都是替换） |
  | 3539 / 3681 行 上传建节点、资产还原到画布 | 都是 **`images: [url]`** 单个元素 |
  | 3605 行 `handleUploadNodeFiles` | 一次拖 N 张图 = **建 N 个独立节点**，不是一个节点装 N 张 |
- ⭐ 所以 `node.data.images` 虽然类型是 `string[]`，**实际长度恒为 1**。
  `getWorkflowNodeOutputUploadItems`（970 行）里那个 `.map()` 只是写法上的兼容，不代表业务上会有多项。
- ⭐⭐ **这条规则让「连线只能到节点粒度」不再是问题**：
  「从当前画布选择」是给源节点和当前节点加一条边（不是复制单张图），
  曾担心"源节点里有 4 张图会一起连进来" —— **在这条产品规则下这个场景不存在**，
  所以保持"连线"这个实现（好处：不产生重复数据、断线就干净、复用手动拉线那一整套校验）。
- ⛔ **如果哪天真要做"一次生成多张"，必须先回来读这条**：那时连线粒度问题才会浮现，
  需要给 edge 加 `sourceItemIndex` 之类的机制，且所有"顺着连线取输入"的地方都要跟着改
  （`getConnectedInputUploads`、送模型拼参考图、缩略图显示、@提及名字解析、画布存取）。

## ⭐ 工作流「连线」vs「从资产库导入」的行为差异（2026-08-01 查清，**保持现状**）

同样是给节点加参考素材，两条路的**数据来源不同，源图被替换时表现也不同**：

| 入口 | 实现 | 源图后来被替换时 |
|---|---|---|
| **从资产库导入** / @引用资产 | `insertAssetReference`（6619 行）→ 往 `node.data.uploads` **塞一份单张的 upload 项**（固定 url） | **不受影响**（拿的是那一刻的 url） |
| **从当前画布选择** | `insertCanvasAssetReference`（6777 行）→ `connectNodeAsInput()` **加一条边** | ⭐ **参考图跟着自动变成源节点的新图** |

- 之所以两边实现不同：**资产库里的资产不在画布上**，没有节点可连，只能复制进来；
  **画布上的已经有节点了**，连线更自然（不产生重复数据、断线不残留）。
- 🗣️ **2026-08-01 决定：保持现状**（"跟着变"符合"连线 = 数据流"的语义；改成"选定就固定"反而会产生
  和从资产库导入一样的重复数据 + 断线残留问题）。


## ⭐ 帐号功能开关（2026-07-30 加，后台 `/admin?tab=account-features`）

**三个开关，一律"默认关闭、需要谁用再单独开"**（用户 2026-07-30 明确定的产品口径）：

| 开关 | 打开后 | 默认 |
|---|---|---|
| 通用模式 | 该账号能用「通用模式」（不开则入口隐藏 + 服务端硬拦） | 关 |
| **解除限制** | 该账号的 BytePlus 请求发**专属 Endpoint ID**（平台策略更宽，敏感题材更容易过）；关 = 发公开模型名走标准审核。⛔ **不跳过任何我们自己的校验** | 关 |
| **后台白名单** | 该账号能进 `/admin` 后台 | 关（**只有 `lookxun@163.com` 开**） |

- 表头三个总开关 = **一键全开/全关（批量把所有账号设成同一个值）**，**不是全局覆盖**；
  真正生效的永远是每个账号自己的开关，批量后仍可单独调。
- ⛔ **「后台白名单」故意不给总开关**（一键全开等于让全站所有人都能进后台，风险太高）。
- ⛔ **不许把自己移出白名单**（会当场把自己锁在后台外）；批量关闭白名单时保留操作者。
- 存储位置与技术细节（尤其"白名单不在数据库里"）见 `02-architecture-and-data.md` 的专节。

## ⭐⭐ 三条铁律（详见 00-README / AGENTS.md 顶部）

1. **动代码前先评估对既有功能的影响**，有影响先说清、等确认再改（各模式常共用同一份代码）。
2. **默认只本地不部署**；"部署掉"=只测试服；"部署正式服"才走测试服→整份同步正式服。版本号自增只在部署测试服时跑。
3. **能统一一律统一**，禁止同一逻辑复制多份各走各的。已有统一入口举例：入库 `media-asset-record.ts`、生成任务/读取 `generation-jobs.ts`、扣费 `credits.ts`(`chargeCredits`)、模型→端点键 `byteplus-provider-key.ts`、**按账号功能开关 `account-features.ts`(`resolveUnlockLimitsForUser`)**、**在线判定 `online-users.ts`**、**参考素材 url 归一化 `reference-asset-url.ts`(`normalizeReferenceAssetUrl`：进模型/送审前把动态缩略图接口地址 `/api/media-thumbnail?url=` 和自家主机绝对前缀还原成文件静态直链)**、参考图 hint `reference-hint.ts`、错误文案 `error-message.ts`、登录失效跳转 `session-expired-redirect.ts`、@提及匹配/删除 `mention-text.ts`、上传命名 `upload-name.ts`、图片上传校验 `image-upload-validation.ts`、视频音频上传校验 `media-upload-validation.ts`+`media-upload-probe.ts`、参考组合校验 `upload-rules.ts`、视频参考图尺寸 `video-reference-image-rules.ts`、断线判定 `transient-error.ts`、时长文案 `media-duration-format.ts`、音频波形播放器 `audio-waveform-player.tsx`、视频播放角标 `video-play-badge.tsx`、@引用资产选择器 `asset-mention-picker.tsx`、**写 `.env.local` 的合并逻辑 `system-settings.ts`(`writeLocalEnvValues`)**。新增模型/模式只改统一函数 + `system-settings.ts` 配置表（对称补齐所有前缀 conversation-image/asset-image/agent-image/video/agent-video）。

## 删除/资产规则

- 用户删除=**软删除**；生成文件与 DB 记录保留（后端不物理删媒体）。UI 可对用户说"删除/30天清理"。
- 资产原始数据出生即冻结，之后只有改名/移动/删除（只写 `UserAssetState`，绝不碰 `MediaAsset` 原始数据）。合理的出生后写入白名单只有：视频 poster 晚到回填、reversePrompt、远程→本地 URL 规整。
- 上传图片统一 `conversation_uploads` 桶；上传不问分类；移动到"上传图片"写 `currentCategory=conversation_uploads`。不靠文件名/prompt 猜分类。
- 资产库第 1 组：角色/场景/**道具(prop_image)**/分镜图片。道具三档比例：单道具9:16 / 多角度16:9 / 四宫格1:1(`grid-square`)。

## 道具生成 propify（2026-07-21）

- 道具生成**只产实体道具**：写实/2D/3D 三种风格作用在**道具实物**上（写实=真实材质的手办/摆件/雕像产品照，**不出真人**，`getPropStyleRuleText`/`enforceAssetGeneratePropStylePrompt`）。
- **propify 道具化**：用户输入人/角色/生物 → 转手办/人偶/雕像摆件；场景 → 微缩模型/沙盘；分镜/剧情 → 代表性实体物品。**例外**：照片/相片/海报/明信片/卡片/画作/书刊/传单/地图/票据/邮票/日历/扑克牌等**平面印刷品·影像制品本身就是实体道具**，直接生成该实物、表面可印人物/场景。只有"无载体的活体主体本身"才转手办。规则在 `getPropGenerationRuleText`/`getPropPromptOptimizationRuleText`。

## 参考图 / @引用规则

- 显式 `@资产名` 控制参考图与顺序；避免重复参考 URL。
- **全平台统一：有缩略图才有效变蓝，没缩略图 @名一定一起没**（有效@名=当前输入框有缩略图撑腰 `validReferenceNames`=visibleUploads）。裸/粘贴的@名不变蓝、不加载。断线/删节点/删缩略图/切模式有自愈 effect 删失效@名。
- 资产库生成的 sourcePrompt @名以"文字@名为唯一真源"构造参考图（提交时按@名匹配草稿、去悬空@名），保证@名与实际参考图一一对应、预览天然变蓝。
- 服务端 `video/route` 发送前按库里真实 `mediaType` 把混进图片槽的 video/audio 剔除（不靠扩展名，防 `.bin` 音频误入图片槽），两条流共用。

## 上传规则（唯一权威 + 后台可覆盖）

- 图片：`image-upload-validation.ts`，只 JPG/JPEG/PNG/WebP、原始单图 ≤10MB（后端强制、三前端复用）。模型 `uploadRule.image` 只控制 enabled/maxCount。
- 视频/音频：`media-upload-validation.ts` + 服务端 ffmpeg 探测，按 BytePlus Seedance 融合模式官方规则（视频 MP4/MOV ≤200MB、2-15s、最多3/总≤15s；音频 MP3/WAV ≤15MB、2-15s、最多3/总≤15s）。参考视频总时长精度：`validateReferenceTotalDuration`（四舍五入 0.1s，>15.0 拦，文案带 XX.X 秒）。
- 参考组合校验唯一权威 `upload-rules.ts`（`validateVideoReferenceCombination`/`getVideoAudioUploadDisabledMessage`）：只有融合模式支持视频/音频；音频不能单独上传必须带图/视频。对话流/工作流/服务端三处共用。
- 后台"上传规则"编辑表存 env `UPLOAD_RULE_OVERRIDES`（`system-settings.ts` + `admin/api/upload-rules`），优先于 `upload-rules.ts` 静态兜底。所有生成上传路径用 `getUploadRule(..., overrides)`。

## BytePlus Seedance 视频规则

- 融合模式(`reference`)：图 `reference_image`、视频 `reference_video`、音频 `reference_audio`；首帧(`first_frame`)/首尾帧(`first_last_frame`)只图。三种模式不混。对话流/工作流都有显式参考模式菜单（`referenceMode`），不再从措辞推断。
- 真人/隐私/版权敏感的输入素材（图/视频/音频）→ 走 auto-review：建 BytePlus 素材(Skip 免审)→ `asset://` 重试（`isBytePlusRecoverableReferenceError`，最多 3 次）。首次进审核 UI 加蓝色系统提示（同 video 请求内去重）。

## MiniMax H3 视频规则（2026-08-03 接入对话流，`minimax/hailuo-3`）

- **走 OpenRouter；只接对话流**（Agent/工作流未接，见 M035）。模型下拉显示 `MiniMax H3`、在 Kling 上面、带官方音浪图标 + 青绿 NEW 徽标。
- **分辨率只有 2K 一档**（OpenRouter 只开这一档，官方的 768P 没接）。时长 **5~15 秒全 11 档**。
- **6 个比例的实测输出尺寸**（已固化进 `models.ts`）：21:9→2944×1248（略宽，标 nonStandard）、16:9→2560×1440、4:3→1920×1440、1:1→1440×1440、3:4→1440×1920、9:16→1440×2560（标准比例短边固定 1440）。
- **参考模式四选**（比 Seedance 多一个尾帧）：参考图模式(`reference`，默认 **9 张**，实测上限就是 9，第 10 张 OpenRouter 提交即 400)、首帧(`first_frame`，1 张)、尾帧(`last_frame`，1 张)、首尾帧(`first_last_frame`，2 张)。首帧/尾帧/首尾帧走 OpenRouter 的 `frame_images[].frame_type`，参考图模式走 `input_references`，二者互斥。
- ⛔ **不支持参考视频/音频**：OpenRouter 对非 BytePlus 供应商会**静默丢弃** video/audio references（不报错、照收钱但素材没用上）→ `validateVideoReferenceCombination` 里"非 BytePlus 不许传视频音频"那条正好挡住，保持不动。
- 计费走 `usage.cost`（不配价格表）：实测 5 秒固定 $0.65（≈47 积分）、15 秒 ≈140 积分、参考图另计。
- ⚠️ **名字**：id 里带 `hailuo` 是 OpenRouter 沿用海螺老命名，但界面一律 `MiniMax H3`（这一代不叫海螺）。上一代 `minimax/hailuo-2.3` 才是真海螺，是另一个模型。

## 计费

- `CreditLedger` 唯一来源。计费按 provider 返回的 `usage.usd(cost)` → 积分（非按 model id 查价）。图片存盘重排队扣费幂等、只 finalize 扣一次。

## Auth Session

- 普通用户 idle 登录（非 30 天持久）：本地开发 24h、正式 1h（除非用户改）。真实操作(click/键盘/滚轮/触摸)调 `/api/auth/activity` 续期；后台检查/autosave/媒体轮询不续期；生成等待期算活动、保活。admin 用独立 cookie `flashmuse-admin-session`。

## GPT-5.4 Image 2

- 有"新接口"（`openai/gpt-5.4-image-2`，走 `/api/v1/images`，4K/画质档 auto/low/medium/high 默认高/16 参考图/`size` 精确像素）和"GPT版"（`openai/gpt-5.4-image-2-agent`，走老 agent 接口、无4K/画质、3 参考图）并存。参考图失败分流：瞬时错误走服务端重连不切 base64、安全拒绝秒失败。安全改写重试(AI改写重试N次)见归档 08，最小补丁原则。

## 工作流要点（详见归档 04）

- 与对话流共用同一套生成/存盘/计费/资产链路。整张画布存 `WorkspaceWorkflow.canvasJson` 单大字段（隐患见 M019）。节点媒体命名 `image_N_wX`/`video_N_wX`，计数器每工作流独立。用量视频计数用持久化 `countedGeneratedUrls` 去重（2026-07-21 修虚高）。"使用提示词"读后端 `GenerationJob`（`/api/workflow-generation-references`）。空生成节点有内容时删除弹确认框。

## ⭐ 「使用提示词」的交互口径（2026-07-31 用户明确指定，改前必读）

🗣️ 用户原话意思：「点了以后立马生成新节点，然后如果输入框的内容还没有读出来，整个输入框是禁用态，
转圈动画 +『正在加载中...』（在输入框内上下左右居中在最中间），然后再保证一下尽量最快速读出来。」

- **点击 → 同一帧就出新节点**（选中 + 镜头飞过去）。⛔ **绝不允许"等接口回来才建节点"**（那就是用户投诉的"没反应"）。
- 内容还没读回来时：**整个输入框禁用**（打不了字）+ 输入区**上下左右正中**转圈 +「正在加载中...」+ 发送按钮置灰。
- 提示词**先留空**、不要先填画布自带那份 —— 否则会先闪一版旧的再跳变。
- 接口回来后**只 patch 这一个节点**的提示词与参考素材。
- **最多 15 秒**（`AbortController`）：网络挂了也必须解除禁用、回落画布自带那份，⛔ **绝不允许永久禁用**。
- 上传来的素材节点：「使用提示词」仍**置灰**（没有可复用的生成提示词）。
- 实现细节与禁忌见 `workflow-tldraw-canvas-inner.tsx` 的 `addNodeFromPrompt` 注释
  （尤其 `promptLoading` 是运行时临时字段、**绝不能落库**）。

## ⭐⭐ 视频时长选择器 = 滑块 + 数字输入框（2026-08-03 v68 起，🗣️ 用户逐条指定）

**唯一权威组件 = `src/components/video-duration-slider.tsx`（`VideoDurationSlider`）**，
**对话流（`chat-workbench.tsx` 的 `renderControlMenu` duration 分支）与工作流视频节点
（`WorkflowDurationMenuSingle`）共用同一份**。⛔ 别再各写一套。弹窗宽 `w-[340px]`，标题「选择视频生成时长」。

- **量程按模型自身**：滑块右端 = 该模型**最大档**（`scaleMax = maxSec`）。
  → Veo 3.1 右端就是 8，**末尾不留 10/15 空刻度**；Kling O1 到 10；Seedance/H3 到 15。整体长度不变。
- **前段灰色禁用**：小于最小档的区间画深灰 `#cfcfcf`、不可选（Veo/Seedance 的 0~4、H3 的 0~5）。
- **小竖线 = 每个「可选秒」一根**：连续档模型（H3 5~15）在 5–10 之间有 6/7/8/9；
  离散档模型（Kling 5/10/15）中间就没有。
- **数字刻度是按钮**：点了跳到对应秒；**可点的悬停加灰底**（`hover:bg-[#f0f0f0]`）；超范围的（如 0）灰显不可点。
  档位 ≤6 时直接标各档（Veo 标 0/4/6/8），档位多时用 `0/5/10/15` 里 ≤ 最大档的那几个。
- **右侧数字输入框**：可直接输入（回车/失焦提交）、上下箭头在**合法档之间**跳、超范围自动夹紧；
  与滑块间距 `gap-6`。
- **一律吸附到最近的合法档**（🗣️ 用户在三个方案里选的这个）：拖动/输入/点刻度都过 `snap()`。
  平局（如 Veo 拖到 7）取**较小档**（6）。
- ⛔⛔ **拖动只能用原生 `<input type="range">`**（透明覆盖，自定义外观全部 `pointer-events-none`）——
  原因见 `AGENTS.md` 那条铁律：工作流节点的祖先容器有 capture-phase `stopPropagation`，
  自己写 pointer 事件收不到。**别改回去。**

## ⭐ 左上角 logo = 切换线路（2026-08-02 v65 起，用户指定）

- 工作台和首页**一致**：在新加坡服点 → 阿里入口，在阿里/其他入口点 → 新加坡服（`main.venusface.com`）。
- 鼠标悬停显示「**切换线路**」（两处都有 `title`）。
- ⭐ **副标题文案 = `AI影游助手`**（2026-08-03 v68 起，🗣️ 用户改的；此前是 `AI视频助手`，更早还有过 `AI影片助手`）。
  全项目只有 `chat-workbench.tsx` 一处硬编码，改的时候 grep 一遍别漏。
- 历史变迁：切换收起 → 刷新页面 → **切换线路**（别再改回刷新）。

## ⭐ 工作流视频节点：选中即播、取消选中即停（2026-08-02 v65 起，用户指定）

- 点中视频节点 → 自动播放；点空白/别的节点 → 暂停。
- 实现：`WorkflowInlineVideo` 的 `selected` 属性 + effect；**`play()` 必须包 `requestAnimationFrame`**
  —— 浏览器对 `<video controls>` 有「点视频本体切换播放/暂停」的原生行为，同一次点击里会赛跑
  （实测时灵时不灵），延迟一帧让选中播放稳赢；之后用户点视频本体手动暂停不受影响。

