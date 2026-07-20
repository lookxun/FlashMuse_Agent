# FlashMuse Handover

> **⭐⭐ 最新（2026-07-20 收尾）：四方同步 正式服=测试服=本地=GitHub=`v1.0.0.25` / commit `c19ecca`，工作树干净、无 Prisma 迁移、四域名 200。** 本对话做完并全部上线正式服：① **工作流"断线后输入框永久转圈'加载引用资产...'"根治**——真因=断线/删缩略图漏删对应 @名(命名去重 vs 原始不一致)产生孤儿@名 + 孤儿@名触发 `loadMentionAssetFilters` 无限重载(missingFilters 把空分类永远算缺失)；修=新增自愈 effect(validReferenceNames 收缩就删失效@名，覆盖断线/删节点/删缩略图/切模式) + @名有效性改为"只认当前缩略图"(`validReferenceNames`=visibleUploads，粘贴裸@名不变蓝不加载) + 去掉读整库机制/转圈 + 取名统一 + missingFilters 兜底。**全平台统一规则：有缩略图才有效变蓝，没缩略图@名一定一起没。** ② **B_42 修复**：工作流融合生视频 @引用视频/音频被当参考图发 BytePlus(`content[N].image_url not an image`)，真因=`getWorkflowPromptReferenceUrls` 目录解析只认 image 不看 asset.kind；修=按 `(asset.kind ?? "image")===kind` 路由(图/视频/音频各归各槽)。以前没暴露因"@引用视频/音频"是 07-21 才加、之前只能+上传走正确分支、且该验证一直没跑。 ③ 对话流"使用提示词"媒体由累加改**整体替换**。 已用测试服号 `12424740@qq.com` 浏览器实测全部通过。**测试服账号明文见 03-deploy-and-servers.md（主测试号 12424740@qq.com / dragonstar；模拟真实测试优先用它、白名单号不测、测试内容别删）。下一个 AI 无遗留待推/待部署。**
>
> **架构认知（排查"某些国内用户 ali 比 main 慢"）**：`ali`/`static.venusface.com`=阿里 nginx **静态镜像+反代回腾讯新加坡**（动态/API 全 `proxy_pass → 119.28.116.16:5000`），走 ali 的动态请求多一跳跨境；对直连新加坡线路好的用户反而比直连 main 慢。ali 不是国内 app 服务器。

> **⭐⭐ 最新（2026-07-20：测试服 HTTPS 域名搭建 + gpt-5.4-image-2 参考图失败分流 + 音视频参考组合校验统一 + 使用提示词只读自己那份）：全部只到【测试服 v1.0.0.23】，未 commit/push、正式服仍 v1.0.0.19。`tsc` 通过、无 Prisma 迁移。** 承接 07-19（正式服 v1.0.0.19）。做完：① **测试服 https 域名 `staging-static.venusface.com`**（阿里 DNS→101.37.129.164 + Let's Encrypt + nginx 443）搭好，测试服 env 的 `NEXT_PUBLIC_PRIMARY_BASE_URL`+`NEXT_PUBLIC_UPLOAD_BASE_URL` 都改成它 → img2img 参考图真实走 https URL 分支（⚠️ 坑：拼参考图 URL 优先用 PRIMARY，只改 UPLOAD 无效）；② **gpt-5.4-image-2 参考图失败分流**：上游瞬时错误(5xx/429/408)不切 base64、交服务端重连继续用 URL 重试；安全/内容审核拒绝(safety system)秒级失败不切 base64（不再白等 2 分钟）；③ **症状B**：视频"音视频参考组合"校验抽到唯一 `upload-rules.ts`（`validateVideoReferenceCombination`/`getVideoAudioUploadDisabledMessage`+文案常量），对话流/工作流/服务端三处共用；文案改成"只有融合模式才支持上传视频和音频"/"音频不能单独上传，必须带图片或视频"（v22 只改发送时、v23 补齐附加/上传时）；④ **症状A**：使用提示词/提示词显示"只读自己那份引用包"——删掉 4 处"翻上一条用户消息"兜底 + 还原时不拿@文字重造媒体卡（每张生成图/视频出生即钉完整引用包、独立、软删不影响、没了显示裂开）。**下一个 AI 待办：用户验完后 commit（源码+deploy/staging+handover）；是否上正式服由用户拍板（走测试服→整份同步正式服铁律）。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **（上一条）2026-07-19：GPT版老接口并存 + 对话流优化规则 + 预览页参考缩略图/使用提示词统一 + 测试服视频封面NEXT_PUBLIC修复）：✅ 已整份对齐部署正式服 `v1.0.0.19`、已 push GitHub `d85fa92`、四域名 200、无 Prisma 迁移。三方同步：正式服=测试服=本地=GitHub。** 本 session 承接"gpt-5.4-image-2 迁新接口"，用户提了一串新需求（都先测试服迭代 v14→v19），最后拍板整份对齐正式服+push。要点：① 新增 **GPT-5.4 Image 2（GPT版）** id `openai/gpt-5.4-image-2-agent` 走老接口/agent（发送时映射回真实名），与新接口并存，无4K/无画质/参考图3张/不金色；② 三处模型弹窗加高+小灰字（仅对话流+工作流，资产库不显示）；③ 对话流优化提示词加规则"不改原意+纠正逻辑错误"；④ **预览页右侧**顶部加 80×80 参考缩略图（图/视频/音频统一）、提示词 @名蓝色、「使用提示词」统一走 `copyPrompt`（带回图/视频/音频/文档，copyPrompt 改跨 session 查找）；⑤ **测试服上传视频无封面根因**=`NEXT_PUBLIC_UPLOAD_BASE_URL` 构建期未注入→回退生产地址404，Dockerfile 加 ARG（默认空、正式服零影响）+ 测试服 compose 传 `http://101.37.129.164:8080`；⑥ **扣费已实测正常**（GPT版 usd~$0.127→9积分/张、新接口 avg~10积分/张，无扣0）；⑦ 正式服 `UPLOAD_RULE_OVERRIDES` gpt-5.4-image-2 已改 16。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **（历史）2026-07-19 later session，gpt-5.4-image-2 img2img 修复 + 对话流重试大修：已部署测试服 `v1.0.0.13`（已被上面整份对齐 v1.0.0.19 覆盖上线）。** 承接同日 v1.0.0.8。从查测试服 B_1~B_14 红字真因入手修了一串真 bug：① **B_1~B_12 真因=参考图传 http 被 OpenRouter 新接口拒**（只认 https），修 `toPublicGeneratedImageUrl` 把自家 http 绝对地址改写成 https（v9）；② **参考图改"URL 优先→失败回退 base64"**（新增 `referenceToDataUrl`，v10，实测测试服 URL 失败→base64 成功出图、16 张全送达）；③ **B_13/B_14 真因=OpenAI 安全系统直接拒绝**"生成美女"(`safety_violations=[sexu…]`，请求阶段拒、未生成、失败不扣费、有概率过)，加错误映射文案"模型拒绝了本次生成请求…【类别】…"（v11）；④ ⭐**对话流"申请多张+重试"卡槽定位 bug**（重试结果覆盖了成功位）修复（v12）；⑤ ⭐**红字与失败卡 1:1**（原因挂到 slot 上、排除重试中的，v13）。用户两大目标：**URL优先/base64回退**（已实现）+ **测试服=正式服完全对齐**（部署正式服=一次性同步整份源码，已核实正式服还在 v1.0.0.2、缺全部改动、迁移一致无需跑、UPLOAD_RULE_OVERRIDES 需手动改 16；**用户说还没改完、暂不部署正式服**）。免费 HTTPS 已验证 uguu.se 直链能让 gpt-5.4-image-2 img2img 成功=方向1可行，**用户明天加子域名 `staging-static.venusface.com`**（阿里云 DNS）给测试服配 https。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **（上一条）2026-07-19，gpt-5.4-image-2 迁 OpenRouter 新图片接口：✅ 已部署测试服 `v1.0.0.8`；⚠️ 未同步正式服、未 commit/push。** 只改 **gpt-5.4-image-2** 一个生成模型：从 `/chat/completions`+`modalities` 迁到专用 `POST /api/v1/images`（`generateGptImage2`）。要点：① 新接口该模型**尺寸只认 `size`(精确像素)，K数/比例被忽略**，智能比例=不传 size 自动；加了 **4K 尺寸表** + `classifyImageResolutionByModel`（修 4K 误显示成 3K）。② **画质档 auto/low/medium/high（默认高，仅该模型显示）加在三处**（对话流/资产库/工作流）。③ 参考图默认 **16张/10MB**、改传公网 URL、加体积日志。④ 扣费用返回的 `usage.cost`(美元)、原生 `n`。⑤ **对话流输入框撑宽逻辑重写**（ResizeObserver 实测，发送按钮不出框）。⑥ 后台上传规则面板过滤弃用的 3 个 OpenRouter 重复款（不动共享数组）。⑦ **暂缓**：对话流"最多4张"改原生 n（与 Agent 共用的多图槽位/重试结构，风险高，当前申请4次功能正常）。⚠️ `UPLOAD_RULE_OVERRIDES` 是各服务器独立 env 数据，正式服部署时需把 gpt-5.4-image-2 也改 16。全量实测在桌面 `gpt54-image2-test/测试结论.md`。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **⭐⭐ 铁律（2026-07-18 加，所有 AI 必读）：现在的 AI 可以用【浏览器工具 playwright】直接读全网站正文（含火山 BytePlus 官网这种 JS 渲染的文档）。以前的 AI 读不了外网，所以用户是把官网文档复制成本地 .md 给 AI 看的；后来另一个 AI 装好了浏览器工具，就能直接读了。**
> - **查任何官网规格/文档，一律用浏览器工具打开渲染后的真实页面为准**（`playwright_browser_navigate` + `playwright_browser_find`/`snapshot`）。**`webfetch` 对 JS 渲染的站点只能抓到导航空壳、抓不到正文，绝不能拿它当"读过官网"**。
> - **不要再依赖本地复制的旧文档当权威**——它们可能过时。`E:\project\【1】Api key\Byteplus\` 里从网站复制的文档已于 2026-07-18 全部删除（只保留 `Byteplus api key.md` 密钥/端点映射）。需要火山文档直接开浏览器读官网。
> - **踩坑实录（务必引以为戒）**：本次有 AI 先用 webfetch 读火山文档只拿到空壳，却退回去拿用户早前复制的**旧本地 .md**（那份还是加 4k 之前的版本）当权威，错误地告诉用户"参考视频上限是 50MB"；实际用浏览器打开当前官网确认是 **200MB / 像素 8295044 / 含 4k**。教训：读不到正文就用浏览器工具，别拿旧本地文件冒充官网。

> **⭐⭐ 最新铁律（2026-07-18 加，已同步进 `AGENTS.md` 顶部 + `03-deploy-and-servers.md` 顶部，所有 AI 必读）：搭好了独立【测试服】+ 定死部署语义。**
> - **测试服**：和正式服同一份代码、数据/环境/端口全隔离，用来线上验证不影响真实用户。入口（阿里，IP，无域名）：前端 `http://101.37.129.164:8080/`、后台 `http://101.37.129.164:8080/admin`。架构=腾讯 `/opt/flashmuse-staging/` 独立 Docker 栈(staging-app/db/nginx，宿主 5001) + 阿里 `/var/www/flashmuse-static-test/` 独立镜像(8080) + 独立 ali-sync。详见 `03-deploy-and-servers.md` 顶部。
> - **部署语义**：用户说"部署掉/部署一下"等**默认只部署测试服，绝不动正式服**；**只有明确说"把正式服部署掉/更新正式服/上线正式服"**才走完整顺序"先一次性部署测试服→验证→再把测试服代码原样同步正式服"，任何情况都不跳过测试服、不直接改正式服代码。
> - **版本号**：`src/lib/app-version.ts` 的 `APP_VERSION`（四段 100 进制 `vAA.BB.CC.DD`）。**只在部署测试服时**先跑 `node scripts/bump-version.mjs` 自增（最右段 +1、满 100 进位）；**正式服部署绝不自增**，原样带走测试服的号 → 保证"版本号一样 = 代码一样"。测试服 `NEXT_PUBLIC_IS_TEST=true`(build arg) 显示 logo"测试服"、`版本号(t):vX`、标签标题 `(测试服)` 前缀；显示位置=首页底部 footer / 工作台设置版本信息 / 后台左侧当前管理员上方。当前测试服版本 `v1.0.0.1`。

> **⚠️ 最新（视频/音频上传收尾，本地待部署）：** 视频/音频统一上传改造、音频 `.bin` 错误扩展名修复、对话流/工作流输入框视频缩略图共享组件均已完成；`npx tsc --noEmit` 通过，无 Prisma 迁移，未 build / 部署 / commit / push。**用户明确要求下一个 AI 直接部署。** 但资产库视频/音频真实上传尚未获得一次成功验证：此前“文件上传失败”未取到 Network 响应，可能是在公网而非本地测试，不能声称已验收。部署前先把生产 Nginx 请求体上限调至至少 200MB 并延长上传超时；部署后立刻验证资产库、对话流、工作流的 MP4/MOV/MP3/WAV 上传、去重、分类、引用与失败提示。详情见 `01-current-status.md`、`05-next-actions.md`、`CHANGELOG.md` 顶条。

Last rebuilt: 2026-06-20

> **⚠️ 2026-07-22（本地资产库直传 + 实时计数 + 图片上传限制统一 session）：全部仅本地，未 build / 未部署 / 未 commit / 未 push；`npx tsc --noEmit` 通过；无 Prisma 迁移。** ① 资产库「上传图片」去弹窗：点右上按钮直接选文件，临时预览卡立即在右侧网格显示，保留黑色半透明遮罩+蓝色圆环进度、失败重试/移除/自动转码重试/内容去重/服务端命名；完成即自动入库，删除仍走软删除；上传前改名取消；单次最多 **10** 张，超出黑底提示。② 左侧资产数量与右侧变化实时同步：新增/删除/恢复/移动分类、资产库直传、对话流上传/生成、工作流生成均即时调整统一 `assetCounts`，`@引用资产` 同步；下次服务端读数仍为权威校准。③ 图片格式/大小唯一规则：新增 `src/lib/image-upload-validation.ts`，只允许 JPG/JPEG/PNG/WebP、原始单图 ≤10MB；后端 `/api/asset-upload-temp` 强制校验，资产库/对话流/工作流复用同一校验与选择器；工作流图片从5MB升10MB；模型只继续控制是否支持图片及数量，不再各自控制图片格式/大小；合规 PNG/WebP 与异常 JPEG 仍统一转 JPG 保存。**下一个 AI 优先继续统一视频、音频、文档上传的格式/大小规则**：先盘点三端前后端差异、与用户确认每类规则，再同样抽后端权威+前端即时校验；不要动图片既定规则，不要把头像独立上传接口误并入素材/参考图链路。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **⚠️ 2026-07-22（视频/音频上传规则统一 + 资产库直传入口）：全部仅本地，`npx tsc --noEmit` 通过；未 build / 部署 / commit / push；无 Prisma 迁移。** 只以 BytePlus Seedance 2.0/Fast/Mini 融合模式为全平台音视频规则：视频 MP4/MOV≤200MB、2-15秒、最多3/总15秒、尺寸/比例/像素/FPS/编码均按官方；音频 MP3/WAV≤15MB、2-15秒、最多3/总15秒。新增统一 `media-upload-validation` + 服务器真实文件探测 `media-upload-probe`；`/api/upload-file` 强制 token/登录与真实属性校验，工作流首次正确入库；`/api/video` 不再接受任意外部音视频 URL；资产库上传视频/音频分类右上已加直传按钮。图片/文档未动。生产仍20MB Nginx，用户说部署前不要改服务器；部署时先调网关至至少200MB+超时，再完整验证。

> **✅ 2026-07-22（部署 07-20+07-21 全部上线 + 一批工作流/UI 小改动 session）：把积压的 07-20（资产库改造 + 新依赖 `wavesurfer.js`）+ 07-21（@引用资产迷你资产库 + 从资产库导入音视频 + 视频卡@图标）两批一次性部署上线，并顺带做了几处小改。全部已部署腾讯 + 同步阿里、四域名 200、`tsc`+`build` 通过、无 Prisma 迁移、已 push GitHub（三方同步 `ac4c38f`）。`wavesurfer.js` 随镜像 build 自动装入（Dockerfile 内 npm install，无需宿主单独装）。本 session 新增小改动：① 工作流空图片/视频生成节点（无结果）输入框有提示词时删除弹通用确认框（为空直接删；覆盖键盘 Del/右键菜单/runtime.deleteNode 三入口；弹窗 z-[10002] 高于节点输入框浮层 z-[9999]；确定按钮黑色 bg-[#111] px-12 对齐导入弹窗）；② 图层面板右键不出菜单；③ @引用弹窗视频无封面（上传视频）用 `<video #t=0.1>` 首帧作封面、不再只显图标；④ @引用弹窗音频卡时间改"倒计时秒/总秒数"两位数（15/15→00/15）、移右上（加 `secondsCountdown` prop 隔离，其它地方不变）；⑤ 从资产库导入弹窗选中蓝框/勾移 DOM 末尾+z-50、盖住底部渐变黑。**已核查这些+07-20/07-21 改动不影响生成主链路/扣积分**（图片存盘重排队扣费仍幂等/只 finalize 扣一次；服务端只改资产库过滤展示；前端没动生成提交/扣费）。**下一个 AI**：可做浏览器全面验证 + 清理旧 mention 死常量；M018/M019 押后。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**部署踩坑记：Ali 同步 key 属主 root 一切到阿里的 ssh/rsync 都要 sudo；`/tmp/syncali.sh`+`/tmp/health.sh` 重启会清需重建；部署窗口旧标签报 ChunkLoadError 是固有现象、硬刷即可。**

> **🔒 铁律（2026-07-19 加，所有 AI 必须遵守，已同步进 `AGENTS.md` 顶部）：** ① 用户提需求时，**动代码前必须先排查本次需求会不会影响/破坏其它已有功能**（对话流/工作流/资产库/Agent/通用模式本质相同、常共用同一份代码）；**有影响先别动代码，先把影响范围告诉用户、等确认再改**，最大限度不把其它功能搞坏。② **默认只做本地、不部署**：用户没明确说"部署"，就只在本地改（`npx tsc --noEmit` 自查即可），不要 build / 不上腾讯 / 不同步阿里 / 不 push；用户说"要部署"才走部署流程。git 攒到一定程度再一次性推。

> **⚠️ 2026-07-20（资产库改造 session）：全部仅本地、未 build/未部署/未 commit；`tsc` 过；无 Prisma 迁移；新增 npm 依赖 `wavesurfer.js`（部署时服务器要 `npm install`）。** 主线=**资产库改造**：侧栏"上传图片"移到横线下、新建 `上传的资产`(圆点)分组含 上传图片/上传视频/上传音频（对话流+工作流所有上传合并）；上传视频=一行4+无 poster 用视频首帧封面、从"生成视频"移出；上传音频=波形播放器方卡(一行5，悬停播放、纯文件名无@)。服务端(`workspace-state` 过滤/计数)+前端(`isAssetInFilter`)同步改、`MediaAsset.mediaType` 透传前端(含 `media-assets` GET)、`conversation_uploads` 分页收窄到=计数(39)。附带：抽共享音频波形播放器 `src/components/audio-waveform-player.tsx`(wavesurfer.js，工作流音频节点改用它)、图片生成"存盘慢就重排队绝不丢库"改造(`runImageJob`，不再 60s 回退远程 url→国内本地跨境慢必现的"成功却不进库"根治，线上更稳)、手动补一张本地漏掉的分镜图。**下一个 AI 接着改造 `@引用资产` + `从资产库导入`（目前只图+视频，要让音频/视频也显示，交互先问用户）。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **✅ 2026-07-19（生成链路服务端断线重连改造 session）：从后台失败原因排查入手，做了一批修复 + 一个重要改造，全部已部署腾讯+同步阿里、四域名 200、tsc 过、无 Prisma 迁移，并已 push GitHub。① ⭐生成链路服务端断线重连：新增统一判定 `src/lib/transient-error.ts` `isTransientServerError`（网络/超时/5xx/Bad Gateway/平台临时[抓我们素材失败·事务超时·asset not found]/限流=可恢复重试；真人·版权·参数·审核拒绝·未知=永久不重试），接上三处缺口——图片任务 `runImageJob` 可恢复错误退避重排队（不再一次异常就毙）、视频创建 `createVideoTaskWithTransientRetry` 重试 3 次、`createBytePlusAsset`(auto-review 建素材)重试 3 次。**"真人检测→服务器繁忙"真因=送审重试时 BytePlus 抓我们参考图 url 撞我们瞬时 502→抓图失败→兜底，不是真人逻辑坏；用户定调不补映射、服务端自愈。** ② B_146=Seedream 5.0 Pro+多参考图报"当前模型不支持这组参数"（`openrouter.ts` disabled 分支漏 gate，给 Pro 发了它不支持的 `sequential_image_generation`）→ 加 `supportsSequentialBatch` gate。③ B_144=参考图宽高比越界(仅视频模型)→ `error-message.ts` 映射成"参考图太窄或太长…换 16:9/9:16/1:1/4:3"。④ 后台"失败原因"聚合：`admin-overview.ts` SQL 剥 `(B_xx)` 前缀 + 归一"图片平台没有返回图片"族 → 同原因合并一条、按量降序。⑤ 运维：腾讯宿主开 BBR(迁移漏了→跨境大文件传输崩溃致视频 aliSyncError 根因，6.8MB 视频 5 分钟传不完→4 秒)、阿里补同步 92 视频(现超集、走本地镜像不回源)、同步脚本修 `docker cp` 嵌套 bug(曾致工作台 ChunkLoadError)。**用户交代：过段时间回来复查 GenerationEvent 失败原因，看"服务器繁忙"是否下降、有无新可恢复错误要补进 `isTransientServerError`。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**

> **⚠️ 2026-07-18（视频三处根治 + 回填 session）：排查线上错误码牵出 3 个视频真问题全部根治 + 历史回填。① B_122=真人审核 `waitForBytePlusAssetActive` 在 CreateAsset 刚返回、GetAsset 未同步时第一次查 "asset not found" 就整单毙 → 改成只 Failed/超180s 才失败、瞬态继续轮询（历史 10 例全 ID_315163）；② B_135=参考音频以原始链接直传被 BytePlus 版权拦（图片走"Skip免审素材→asset://"能过、音频没走）→ 新增 `isBytePlusRecoverableReferenceError` 让音频/视频版权敏感也走 Skip 素材重试（实测：原始链接复现失败、Skip素材成功出片）；③ 对话流"@音频名删不掉"=`ensureMediaFileMentions` 强制把媒体@名拼进提示词最前（污染 prompt/content/cleanPrompt/等待卡、删了发送又补回），音频视频本靠附件数组送达与@名无关 → 去掉强制补名（是"存"的问题非读）。④ 历史回填 4 用户 50 视频 job 的强制@名（GenerationJob/WorkspaceSession/WorkspaceMessage/MediaAsset 四表，只剥"开头带音视频扩展名的@名"、备份在 runtime）。改动文件仅 `src/app/api/video/route.ts`+`src/components/chat-workbench.tsx`；已部署腾讯+同步阿里、四域名 200、tsc 过、无 Prisma 迁移；⚠️代码未 push GitHub，下一个 AI 需 commit+push。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**

> **✅ 2026-07-17（上传命名统一 + 资产库排序 session）：上传文件命名全平台统一（服务端唯一权威 `src/lib/upload-name.ts`，同图复用同名/异名即时错开 名_2/去扩展名/改名跟随，覆盖对话流·工作流·资产库的 图·视频·音频·文档）+ 资产库右侧按入库时间(firstSeenAt)稳定降序排序（修「别处上传后顺序跳、刷新才复原」）。连同 07-16 输入框统一那批一起：`tsc`+`build` 通过、已部署腾讯 flashmuse-app、已同步 `.next/static` 到阿里、四域名 200、已 push GitHub。无 Prisma 迁移。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**

> **⚠️ 2026-07-16（输入框统一 session）：@mention 逻辑全平台收敛为唯一 `src/lib/mention-text.ts` + 上传缩略图/资产库输入框对齐 + 选中覆盖 + 全平台唯一引用名 + 视频/音频/文档判重提示 + 资产库"上传成功却不显示"根治。（已随 07-17 session 一起部署+推送）**

> **✅ 2026-07-15（后台/工作流统一读取根治 session）：后台弹窗+工作流「使用提示词」的参考素材缩略图/@蓝字/干净提示词/视频尺寸全根治，全部已部署腾讯+同步阿里+push GitHub（连同 07-14 统一根治大 session 那批一起推）。** 要点：①后台参考素材匹配从「仅精确 requestId」改多口径（requestId→裸id前缀→workflowNodeId→messageId+kind），抽唯一 `buildJobReferenceItems` 后台+工作流共用；②参考图破图真因=对话流 `asset://<bytePlusAssetId>` 引用建 job 时没解析成真实 url，新增唯一 `resolveReferenceUrls` 前向修+回填 256 条；③视频没尺寸真因=从没量过视频宽高（`media-save-queue` 只量图片），新增 `getLocalVideoDimensions`（ffmpeg 解析，**不能用被降采样的封面**）前向修+回填 238 条；④sourcePrompt 混入 `参考图顺序:` hint 的历史数据回填剥离 190 条；⑤后台@不蓝=后缀不一致，`AdminPromptWithMentions` 加去后缀容错；⑥导入资产「使用提示词」无缩略图=只按工作流节点查，新增 `getGenerationJobByMediaUrl` 按媒体 url 回溯原始 job，对话流图回填 291 条 requestId（精确 `:image:序号`）；⑦对话流视频历史双卡 7 例手修。**前向保证：新生成天然带全 requestId/cleanPrompt/refs(asset:// 已解析)/尺寸，工作流「使用提示词」+后台弹窗都能带回——别再当 bug 查历史。** **⚠️ 教训：禁止用 `Set-Content` 改带中文源码（整文件 mojibake）；PowerShell 管道 psql 含中文 SQL 要先设 UTF8 编码。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。

> **✅ 2026-07-14（统一根治大 session）：Agent/通用模型路由统一根治 + 工作流"使用提示词"存读用户真实干净prompt + 后台媒体弹窗参考素材缩略图/@蓝字 + 资产库生图去内部强制规则 + 视频本地存盘不限时根治 + 多批历史回填。（已随 2026-07-15 session 一起 push GitHub）**

> **✅ 2026-07-14（later session）最新：工作流"使用提示词"带图/@变蓝根治 + 等待卡计时平滑 + 回填 830 条历史 job，全部已部署腾讯 + push GitHub（含上一 session 另一 AI 的 handover commit `84582e5` 一起推）。** 现象=工作流视频右键"使用提示词"只回文字、无图、@不蓝。真根因=上次部署新加的"每8秒兜底reconcile"+实时轮询+resume **双重收尾同一视频**，先收尾者删入边、后收尾者拍到空快照并用 `undefined` 把好快照冲空。根治=弃脆弱的画布内 `generationUploads` 快照，改成**点"使用提示词"时读后端权威 `GenerationJob`**（新接口 `/api/workflow-generation-references`）；`GenerationJob` 加 `referenceNames` 列、建任务时反查名字写库；去掉画布 `generationUploads` 冗余写入（瘦身）；工作流等待卡加每秒 tick 平滑走秒；回填 830 条历史 job 名字（老视频也带图+蓝@）。对话流不涉及（它读消息里提交时就存的 imageReferences/uploadedFiles，天然稳）。有 Prisma 迁移 `20260714100000`（腾讯 entrypoint 自动 apply）。**新增备忘 M019：工作流整张画布存单个 canvasJson 大字段的结构隐患，以后重构。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条 + 06-memo-tasks M019。**用户铁律不变：资产原始数据出生即冻结永不变。**

> **✅ 2026-07-14 最新：修对话流视频/图片 3 个 bug（新模型 Seedance 2.0 Mini 触发暴露）——① 错误码红字误映射（Request id 数字子串如 401 被 HTTP 码正则命中，显示成"API Key 无效"）② 视频双失败卡（前台+后台两轮询器都无脑 +1 计数）③ 视频等待卡关浏览器重登录后消失（渲染依赖内存 pending，改按持久化状态）。均已部署腾讯 + push GitHub（`2db526b`/`e9ee160`/`04dafb0`）。图片同款双卡隐患也一并修。四路径×两问题已核查（工作流本来无此问题）。押后 M018 统一单轮询器重构。详见 CHANGELOG / 01-current-status 顶条 + 06-memo-tasks M018。**


> **✅ 2026-07-13（deploy session）最新：把前两批新模型改动部署上线（`7c66f85`）+ 修 3 个 bug 并部署（`b94c3ea`）+ 回填一批历史图名。腾讯=GitHub=本地 三方同步于 `b94c3ea`。** 本 session：①部署"模型开关5组+Terra + Seedream 5.0 Pro/Seedance 2.0 Mini + 校准计费/尺寸/多图 + 前端卡顿修复"；②修 Seedream 5.0 Pro 像素分档扣费（异步图拿不到实测尺寸→永远算高档，改用已知 targetDimensions 判档，1K=0.045/2K=0.09）；③修工作流节点成功/失败都不返回（恢复只在挂载/可见/聚焦触发、无周期兜底 → 加"有进行中节点就每8s重跑reconcile"）；④修统一读取的洞（工作流校准 effect 只纠正已有名、不补全空名 → 改为从库按url补全缺失名）；⑤线上DB事务回填 workflow_02（账号12424740=真实id **ID_636611**）三张7-07遗留空名图→image_2/3/4_w2；⑥后台上传规则面板补 Pro/Mini 标签。Seedance 2.0 的 4K **用户决定先不接**。详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。**用户铁律不变：资产原始数据出生即冻结永不变。**

> **⚠️ 2026-07-13 最新（later session）：新增 2 个 BytePlus 模型（Seedream 5.0 Pro 图片 / Seedance 2.0 Mini 视频）+ 全量按官网校准计费·尺寸·多图 + 修一个全局前端卡顿 bug。（已由上面 deploy session 部署上线）** 要点：Pro 调用名带 `dola-` 前缀、只支持 1K/2K/单图；计费 token×单价自算（图片像素分档+参考图、视频有无视频输入分档）；4.5/Lite 保留"一次出多张"、Pro/OpenRouter 走"申请N次"；Lite 补 3K；改路由后 dev 必须停 node+删 `.next` 重启。参考文档存 `E:\project\【1】Api key\Byteplus\`（api key/模型价格/tutorial）。详见 CHANGELOG / 01-current-status / 05-next-actions。

> **⚠️ 2026-07-13（earlier）：后台"模型开关"大简化 + 新增 GPT-5.6 Terra/Terra Pro + Agent 模式改造（全部仅本地，未 commit/未推/未部署）。** 7 组→5 组（图片/视频/通用/Agent/反推优化），取消 OpenRouter↔BytePlus 互斥改"相加"（去掉重复的 OR seedream-4.5/seedance/seed-2.0-lite，只留 BytePlus 版），表头"使用位置"→"功能模块"+新增"作用位置"列。反推/优化固定顺序 GPT-5.5→5.4→Seed2.0Pro→Seed2.0Lite。通用模式加 GPT-5.6 Terra/Terra Pro（金色改到 Terra Pro）。Agent 合并成一组、去掉备选、首选不可用随机兜底用「图片生成/视频生成」。默认全开（含 BYTEPLUS_API_KEY_ENABLED 默认→true）。`tsc`+`build` 通过。**已与上面 later session 那批合并，一起部署。** 详见 CHANGELOG / 01-current-status / 05-next-actions 顶条。另：后台白名单已加 `176107103@qq.com`（腾讯 env，已上线）。**用户铁律不变：资产原始数据出生即冻结永不变。**

> **✅ 2026-07-12 (later session) 最新：生成图统一出生根治 + 资产→节点读取统一(model) + 全平台上传内容哈希去重(阶段3b全量) 已部署腾讯并 commit+push GitHub（腾讯=GitHub=本地 三方同步）。** 所有生成由服务端 finalize 唯一权威出生（异步存盘图先等本地存盘再落库，修复资产库图 model/参数全空）；从资产库导入/图层恢复/GET 接口都带真实 model（修导入节点显示默认模型）；对话流+工作流(画布/输入框)+资产库三处上传统一内容哈希去重（跨平台判重、提示「图片已存在，无需重复上传！」按位置分开弹、去掉资产库旧 url 判重）。历史空 model 老图从 GenerationJob/ledger 精确回填 7 张（12424740）、5 张无来源留空不猜。详见 `CHANGELOG.md` / `01-current-status.md` / `05-next-actions.md` 顶条。**用户铁律不变：资产原始数据出生即冻结永不变，之后只有改名/移动/删除（只写 UserAssetState）；新口子必须走统一存/读模块。**

> **✅ 2026-07-12 (上午)：资产入库/显示统一大改造 阶段1/2/3a/4** 已部署腾讯（统一入库 `src/lib/media-asset-record.ts`、关掉出生后覆盖、视频存尺寸、上传按内容哈希去重、库/工作流显示统一）。历史数据不删不改。

> **✅ 2026-07-11 大事进度：主服务器已从马来完整迁到腾讯云新加坡**，迁移阶段4也完成 —— main/api DNS 已直指腾讯、腾讯 nginx 443 SSL 直连，马来已彻底出链路。证书自动续期已配好（acme.sh tls-alpn-01 走443，Let's Encrypt ECC 到 2026-10-09，cron 自动续）。唯一遗留：马来退役待用户决定（AI 未停）。当前架构/部署见 `03-deploy-and-servers.md` 顶部。

This folder is the current handover entry. The previous long handover set was moved to `historical-handover-docs-last-used-2026-06-20/` because it mixed current facts with outdated May and early June decisions.

Read in this order:

1. `01-current-status.md`
2. `02-architecture-and-data.md`
3. `03-deploy-and-servers.md`
4. `04-product-rules.md`
5. `05-next-actions.md`
6. `06-memo-tasks.md`
7. `07-remote-video-url-debug.md`
8. `08-gpt-image-prompt-optimization.md`
9. `09-migration-to-tencent.md`（马来→腾讯迁移，进行中）
10. `CHANGELOG.md`

Project path: `E:\project\FlashMuse_Agent`

GitHub repository: `https://github.com/lookxun/FlashMuse_Agent`

Local root note, 2026-06-26:

- The temporary copied folder `E:\project\FlashMuse_Agent` was removed after comparing it with the original `E:\project\AI-Video-Assistant` folder.
- The original `E:\project\AI-Video-Assistant` folder, which had the larger and more complete local state including `.runtime/`, was renamed to `E:\project\FlashMuse_Agent`.
- The old path `E:\project\AI-Video-Assistant` should no longer exist. Continue from `E:\project\FlashMuse_Agent`.
- The internal planning folder was renamed from `AI-Video-Assistant_Project Planning` to `FlashMuse_Agent_Project Planning`.
- Final local validation after the rename: `npx tsc --noEmit` passed.

Product name: `闪念 / FlashMuse`

Stack: `Next.js 16.2.4`, `React 19.2.4`, `Prisma 6.19.3`, `PostgreSQL`, `Tailwind CSS 4`.

Default rule for future handover maintenance:

1. When the current handover docs become too long or start mixing old and current facts, archive the whole current set into a new English folder named like `historical-handover-docs-last-used-YYYY-MM-DD`.
2. Write a new smaller current set by extracting only important, still-valid content.
3. Treat archived docs as backup only. Use them when current docs are insufficient or a difficult bug needs historical context.
4. Do not delete archived handover folders.
5. Archived folders named `historical-handover-docs-last-used-*` are read-only. Do not modify, overwrite, or move files inside them unless the user explicitly asks to reorganize historical backups.
6. Future handover updates must be written to the current files directly under `handover/`, not into archived folders.

Important local state on 2026-06-20 rebuild:

- At that time, local key source files matched the currently deployed Malaysia server source hashes for `src/lib/media-assets.ts`, `src/app/api/media-assets/route.ts`, `src/app/api/workspace-state/route.ts`, and `src/components/chat-workbench.tsx`.
- At that time, local Git still had uncommitted deployed changes; this was later superseded by 2026-06-23 and 2026-06-26 GitHub syncs.
- Latest local commit seen during that rebuild: `508008e Add media asset migration tooling`.

Important local state after 2026-06-26 repo rename/GitHub sync:

- GitHub repository was renamed from `lookxun/AI-Video-Assistant` to `lookxun/FlashMuse_Agent`.
- Local `origin` now points to `https://github.com/lookxun/FlashMuse_Agent.git`.
- Latest pushed source-code sync commit after local workflow/custom context-menu/snapping and diagnostics work: `0f4c97c Implement workflow canvas updates and diagnostics`.
- Later handover-only commits may follow this source-code sync commit.
- Local repository-level Git identity was set to `lookxun <lookxun@users.noreply.github.com>` so future local commits do not fail with `Author identity unknown`.
- After the local folder rename, if homepage flashes or Turbopack reports `Next.js package not found`, stop local Next Node processes and delete `.next`; this fixed the issue once on 2026-06-26.
