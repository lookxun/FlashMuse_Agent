# Product Rules（2026-07-21 重建）

> 详细历史规则在 `historical-handover-docs-last-used-2026-07-21/04-product-rules.md`（工作流细则很长）。这里保留仍有效的核心与铁律。

## 产品形态

- `闪念 / FlashMuse`：内部简易「即梦式」创意助手。模式：Agent/通用对话、图片生成、视频生成、资产库、工作流。
- 工作流模式在**正式服已开启**（历史上曾 feature-gate，现已放开）。

## ⭐⭐ 三条铁律（详见 00-README / AGENTS.md 顶部）

1. **动代码前先评估对既有功能的影响**，有影响先说清、等确认再改（各模式常共用同一份代码）。
2. **默认只本地不部署**；"部署掉"=只测试服；"部署正式服"才走测试服→整份同步正式服。版本号自增只在部署测试服时跑。
3. **能统一一律统一**，禁止同一逻辑复制多份各走各的。已有统一入口举例：入库 `media-asset-record.ts`、生成任务/读取 `generation-jobs.ts`、扣费 `credits.ts`(`chargeCredits`)、模型→端点键 `byteplus-provider-key.ts`、参考图 hint `reference-hint.ts`、错误文案 `error-message.ts`、@提及匹配/删除 `mention-text.ts`、上传命名 `upload-name.ts`、图片上传校验 `image-upload-validation.ts`、视频音频上传校验 `media-upload-validation.ts`+`media-upload-probe.ts`、参考组合校验 `upload-rules.ts`、断线判定 `transient-error.ts`、音频波形播放器 `audio-waveform-player.tsx`、@引用资产选择器 `asset-mention-picker.tsx`。新增模型/模式只改统一函数 + `system-settings.ts` 配置表（对称补齐所有前缀 conversation-image/asset-image/agent-image/video/agent-video）。

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

## 计费

- `CreditLedger` 唯一来源。计费按 provider 返回的 `usage.usd(cost)` → 积分（非按 model id 查价）。图片存盘重排队扣费幂等、只 finalize 扣一次。

## Auth Session

- 普通用户 idle 登录（非 30 天持久）：本地开发 24h、正式 1h（除非用户改）。真实操作(click/键盘/滚轮/触摸)调 `/api/auth/activity` 续期；后台检查/autosave/媒体轮询不续期；生成等待期算活动、保活。admin 用独立 cookie `flashmuse-admin-session`。

## GPT-5.4 Image 2

- 有"新接口"（`openai/gpt-5.4-image-2`，走 `/api/v1/images`，4K/画质档 auto/low/medium/high 默认高/16 参考图/`size` 精确像素）和"GPT版"（`openai/gpt-5.4-image-2-agent`，走老 agent 接口、无4K/画质、3 参考图）并存。参考图失败分流：瞬时错误走服务端重连不切 base64、安全拒绝秒失败。安全改写重试(AI改写重试N次)见归档 08，最小补丁原则。

## 工作流要点（详见归档 04）

- 与对话流共用同一套生成/存盘/计费/资产链路。整张画布存 `WorkspaceWorkflow.canvasJson` 单大字段（隐患见 M019）。节点媒体命名 `image_N_wX`/`video_N_wX`，计数器每工作流独立。用量视频计数用持久化 `countedGeneratedUrls` 去重（2026-07-21 修虚高）。"使用提示词"读后端 `GenerationJob`（`/api/workflow-generation-references`）。空生成节点有内容时删除弹确认框。
