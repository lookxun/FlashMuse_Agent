# Memo Tasks（2026-07-21 重建）

> 备忘任务 = 用户说现在不做、以后可能要做的事。每条有 ID、押后原因、以后怎么做。用户说完成就打 `[x]`。历史完整版在 `historical-handover-docs-last-used-2026-07-21/06-memo-tasks.md`。

## 已完成 / 已过时（一行留档）

- **[x] M002** 静态域名公网访问（2026-06-26 完成）。**[x] M004** commit 已部署改动（已成常态）。**[x] M006** 阿里证书自动续期（webroot 已配）。
- **[进行中→基本完成] M016** 资产入库/显示统一大改造：`media-asset-record.ts` 唯一权威入库、显示统一投影已上线。**M017** 上传按内容 SHA-256 去重：服务端+客户端均已上线（`upload-content-hash.ts`+`contentHash`）。历史数据不回填不删不改。

## 活跃备忘

### [ ] M021 对话流的 AI 改写重做 —— 押后：**先想清楚"一条提示词出多图"怎么展示**（2026-07-29 用户交代）

- **背景**：v1.0.0.53 把 AI 改写从**对话流和资产库整体撤掉**了（工作流那套保留不动）。
  起因是正式服 d37 对话实测：11 分钟发起 23 次生图、成功 17 张、**对话里只剩 2 张**、扣 197 积分。
- **押后原因（用户原话）**：「这个对话流的设计不太适合 ai 改写。因为他是一条提词出多图，虽然是四张图，
  但提示词是相同的，但是如果每张独立改提示词那上面显示的提示词就不对了。**这也是一个问题，以后想好再做。**」
- ⛔ **以后重做的硬前提（三条，缺一条就别开工）**：
  1. **先解决展示模型**：一条 assistant 消息现在只有一个 `content`/`originalPrompt`，
     4 张图共用它。要支持"每张图各自的提示词"，得先让消息能表达 per-slot prompt（`imagePrompts` 已经是 per-url 的，
     但消息头部显示的仍是单个 `content`），否则界面上的提示词必然对不上图。
  2. **并发模型**：`message.requestId` 是**单值**，`appendImagesToAssistantMessage` 靠它匹配消息 →
     任何"同一条消息并发多条重试链"的写法都会互相覆盖、把成功图静默丢掉。
     要么串行化（锁到 message 粒度），要么把 requestId 改成集合。
  3. **成功判定不能读 ref 快照**：`sessionsRef.current` 在 `useEffect` 里赋值，`await` 之后读到的是旧值 →
     成功会被判成失败、继续下一轮白烧积分。让 `retryFailedMedia` 直接返回本次结果。
- **相关代码（当时删掉的东西，git 里查 commit `ab6e223` 的 revert 即可看到原样）**：
  `chat-workbench.tsx` 的 `MediaOptimizationRetryActions` / `canConversationOptimizationRetry` /
  `runConversationGptImageOptimizationRetry` / `canAssetOptimizationRetry` /
  `runAssetGptImageOptimizationRetry` / `patchMessageById` / `retryFailedMedia(promptOverride)`。
  **工作流那份 `src/lib/gpt-image-safety-retry.ts` 还在、还在用**，重做时复用它，别再写第二套。

### [ ] M022 是否给 `ID_636611` 补积分（d37 丢图事件）—— 等用户拍板

- **事实**：2026-07-29 01:58–02:08，该用户因对话流 AI 改写的 bug，**扣 197 积分、成功出图 17 张、对话里只看到 2 张**。
- **丢掉的 15 张图并没有消失**，全在他资产库里（`image_19_d37` ~ `image_36_d37`，`MediaAsset` 有记录、文件在盘）。
  所以严格说是"出了但没在对话里显示"，不是白扣。
- **我没动任何积分**。用户要补的话：直接改 `User` 的积分 + 写一条 `CreditLedger`（direction 走赠送/补偿），别只改余额。

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

### [ ] M023 给 `DATABASE_URL` 加 `connection_limit`（25~30）—— 押后：目前零复发、不急
- **来历**：A4「数据库连接池被打满」的**真修复**（第十六次会话查清）。当前靠 v54 加的明确错误文案兜着，
  用户能看懂发生了什么，但根因（连接数上限）没动。
- **为什么押后**：不是纯代码改动 —— 要改 `/opt/flashmuse/data/.env.local` 的 `DATABASE_URL` +
  核对 postgres 的 `max_connections` + `force-recreate` 重启容器。**最后一次发生是 07-17，之后零复发。**
- **以后怎么做**：先 `psql -c 'show max_connections'` 看容量 → 再给 `DATABASE_URL` 追加
  `?connection_limit=25&pool_timeout=20` → 重建容器 → 观察一周。⚠️ env 是**每台服务器独立数据**，两服都要改。

### [ ] M003 正式服工作流模式
- 注：工作流模式当前已在正式服开启（历史 feature-gate 已放开）。此条保留仅作历史参照，无待办。
