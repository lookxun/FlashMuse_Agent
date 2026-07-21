# Memo Tasks（2026-07-21 重建）

> 备忘任务 = 用户说现在不做、以后可能要做的事。每条有 ID、押后原因、以后怎么做。用户说完成就打 `[x]`。历史完整版在 `historical-handover-docs-last-used-2026-07-21/06-memo-tasks.md`。

## 已完成 / 已过时（一行留档）

- **[x] M002** 静态域名公网访问（2026-06-26 完成）。**[x] M004** commit 已部署改动（已成常态）。**[x] M006** 阿里证书自动续期（webroot 已配）。
- **[进行中→基本完成] M016** 资产入库/显示统一大改造：`media-asset-record.ts` 唯一权威入库、显示统一投影已上线。**M017** 上传按内容 SHA-256 去重：服务端+客户端均已上线（`upload-content-hash.ts`+`contentHash`）。历史数据不回填不删不改。

## 活跃备忘

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

### [ ] M003 正式服工作流模式
- 注：工作流模式当前已在正式服开启（历史 feature-gate 已放开）。此条保留仅作历史参照，无待办。
