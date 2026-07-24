# Current Status

> 本批交接文档 2026-07-21 重建。更早的详细流水在 `historical-handover-docs-last-used-2026-07-21/`（尤其 `CHANGELOG.md` 580KB、`01-current-status.md`、`05-next-actions.md`）。遇到需要历史上下文的难题再翻归档。

## 当前状态（2026-07-26 更新）

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
