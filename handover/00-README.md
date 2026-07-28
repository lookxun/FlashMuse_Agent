# FlashMuse Handover（2026-07-21 重建）

> 本目录是**当前**交接文档。上一批（截至 2026-07-21，含全部历史 CHANGELOG/流水）已归档到 `historical-handover-docs-last-used-2026-07-21/`，只读、勿改。更早的归档在 `historical-handover-docs-last-used-2026-06-20/`。归档只在遇到难题需要历史上下文时才翻。

## ⭐ 当前线上状态（2026-07-29 第十三次会话）

- ✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.52`**，四域名全 200。**无待部署、无未推。** 无 Prisma 迁移。
- ⭐⭐ **当前主线任务 = 继续排查后台红字失败原因并修复 + 归档**。用专用页 **`/admin?tab=failures`「失败排查」**开始，别再手写 SQL（用法见 `07` 第十节）。
- **正式服剩 199 条待排查**（本次归档 120 条「图片平台没有返回图片」旧形态后，319 → 199）。
  ⚠️ **文档里的条数都是快照**：本次就发现实际是 120 条而不是上一批记的 101 条（几天内又新长了 19 条）。**跑归档前必须重新 dry-run。**
- ⭐⭐ **归档脚本新增 `before` 日期下限**：凡是 note 里写「以后新发生的不再归档」的规则**都必须配 `before`**，
  否则它会一直吃新数据（本次 `provider-insufficient-credits` 差点误吃 11 条上次归档之后的新事件）。
- ⛔⛔ **往 `WorkflowSelectedNodeOverlay`（工作流选中节点浮层）里加 Hook 会把整个 tldraw 画布搞崩** ——
  它在 `workflow-tldraw-canvas-inner.tsx:2493` 有 `if (!selected) return null;`，在其后加 Hook = **React #310**
  = 点任意节点变「Something went wrong」。加在提前 return 之前，或别用 Hook。
- ⛔ **后台新页面（客户端组件）里绝对不要在浏览器端格式化日期** —— 服务器/浏览器时区不同会触发 hydration mismatch（React #418，v49 踩过）。一律服务端算好传字符串。
- **主服务器 = 腾讯云新加坡 `119.28.116.16`**（Docker 栈）。马来西亚老服务器已彻底退出链路。阿里 `101.37.129.164` = 国内入口/静态镜像 + 反代回腾讯。**部署一律走腾讯 Docker 流程**，见 `03-deploy-and-servers.md`。
- **测试服**（独立、数据隔离）：入口 `http://101.37.129.164:8080/`（或 https `staging-static.venusface.com`）、后台 `/admin`。主测试号 `12424740@qq.com` / `dragonstar`（普通用户 ID_535317，模拟真实用户优先用它；本地库也能登）。详见 03。

## 历史线上状态（2026-07-28 第十一次会话）

- ✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.50`**（commit `1fd1ef3`），四域名全 200。**无待部署、无未推。** 无 Prisma 迁移。
- ⭐⭐ **当前主线任务 = 继续排查后台红字失败原因并修复 + 归档**。
  ⭐ **现在有专用工具了：后台新页 `/admin?tab=failures`「失败排查」**（左侧"生成记录"下面）——
  每条原因都标了「近 7 天仍在发生 / 已停止发生」「是否兜底桶」，点开就有样本 requestId（一键复制），
  还有按入口/按模型（带失败率）/按用户的分布。**排查先来这页，别再手写 SQL。** 用法见 `07` 第十节。
- **正式服剩 286 条待排查 / 18 种原因 / 还在流血 10 种**（2026-07-28 归档 33 条后；兜底桶「服务器繁忙」已从 60 降到 28）。
  ⭐ 下一个目标现成的：「图片平台没有返回图片」101 条里 **工作流占 88** —— 高度集中在一个入口 = "该统一却分叉了"的强信号。
- ⚠️ **唯一"上线了但从没实机点过"的一批**：第十次会话的「模型明文拒绝 + 对话流 AI 改写重试」，清单见 `05-next-actions.md`。
- ⭐⭐ **排查方法论新增一条硬知识**：**OpenRouter 的视频任务事后仍可回查原文**
  （`taskId` 就是 `https://openrouter.ai/api/v1/videos/<id>`，带 key `curl` 就有 `error`）→ **别再"等新数据攒几天"**。见 `07` 第九节。
- ⛔ **后台新页面（客户端组件）里绝对不要在浏览器端格式化日期** —— 服务器/浏览器时区不同会触发
  hydration mismatch（React #418，v49 上测试服时踩过）。一律服务端算好传字符串。
- **主服务器 = 腾讯云新加坡 `119.28.116.16`**（Docker 栈）。马来西亚老服务器已彻底退出链路。阿里 `101.37.129.164` = 国内入口/静态镜像 + 反代回腾讯。**部署一律走腾讯 Docker 流程**，见 `03-deploy-and-servers.md`。
- **测试服**（独立、数据隔离）：入口 `http://101.37.129.164:8080/`（或 https `staging-static.venusface.com`）、后台 `/admin`。主测试号 `12424740@qq.com` / `dragonstar`（普通用户 ID_535317，模拟真实用户优先用它；本地库也能登）。详见 03。

## 历史线上状态（2026-07-28 第十次会话）

- **线上四方（正式服 = 测试服 = GitHub）= `v1.0.0.48`**，四域名全 200。⚠️ **但本地有一批未部署改动**（模型明文拒绝识别 + AI 改写重试收敛并补给对话流 + `start-project.ps1` 自愈；**无 Prisma 迁移**，`src/` tsc 全绿）。**已于第十一次会话随 v50 部署完成。**
- ⭐⭐ 当前主线任务 = 继续排查后台红字失败原因并修复 + 归档。方法论必读 `07-red-error-triage-and-archive.md`。当时正式服剩 308 条待排查。

## 历史线上状态（2026-07-28 第九次会话）

- **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.48`**（commit `389ad87`）。四域名全 200。

## 历史线上状态（2026-07-27 第六次会话）

- **线上 = `v1.0.0.46`（正式服 = 测试服 = GitHub）**；本地那批积压改动已在第八次会话作为 v47 部署完成。

## 历史线上状态（2026-07-21）

- **四方同步**：正式服 = 测试服 = 本地 = GitHub = **`v1.0.0.36` / commit `dd37a78`**（handover doc commit 之后另有跟进）。四域名 main/api/ali/static.venusface.com 全 200。工作树干净、无待部署。
- **主服务器 = 腾讯云新加坡 `119.28.116.16`**（Docker 栈）。马来西亚老服务器已彻底退出链路。阿里 `101.37.129.164` = 国内入口/静态镜像 + 反代回腾讯。**部署一律走腾讯 Docker 流程**，见 `03-deploy-and-servers.md`。
- **测试服**（独立、数据隔离）：入口 `http://101.37.129.164:8080/`（或 https `staging-static.venusface.com`）、后台 `/admin`。主测试号 `12424740@qq.com` / `dragonstar`（普通用户 ID_535317，模拟真实用户优先用它）。详见 03。

## ⭐⭐ 四条铁律（所有 AI 必守，已同步进 `AGENTS.md` 顶部）

0. **排查掉一批红字失败原因就必须归档**：查清根因 → 修掉 → 往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加规则 → 跑 `--apply`，后台那条原因**划掉但保留文字**、不再计入待排查数量。`B_xxx` 编号继续自增。详见 `07-red-error-triage-and-archive.md`。
1. **动代码前先评估对既有功能的影响**：对话流 / 工作流 / 资产库 / Agent / 通用模式本质相同、常共用同一份代码。有影响就**先说清影响范围、等用户确认再改**。
2. **默认只做本地、不部署**：用户没明确说"部署"就只在本地改（`npx tsc --noEmit` 自查）。**"部署掉/部署一下"= 只部署测试服，绝不动正式服**；只有用户明确说"部署正式服/上线正式服"才走"先测试服→验证→整份同步正式服"完整顺序。版本号自增只在部署测试服那一步跑 `node scripts/bump-version.mjs`，正式服原样带过去 → **版本号一样 = 代码一样**。
3. **能统一的一律统一**：写/改前先查有没有统一公共路径，有就复用、没有就抽一个，**禁止把同一逻辑复制多份各自演化**（踩过坑：`getBytePlusProviderKey` 复制三份漏修）。"一处能用，其它处都该能用"。

## ⭐ 重要工具/环境认知

- **可以用浏览器工具（playwright）直读全网站正文**（含火山 BytePlus 这种 JS 渲染的官网）。查官网规格一律用浏览器打开渲染后页面为准；`webfetch` 对 JS 站只拿到空壳=没读到。别拿本地旧复制文档当权威。
- **改中文源码只用 edit/write 工具，禁 PowerShell `Set-Content`/`Out-File`**（会把中文变乱码）。本地搜文件用 Grep/Read 工具，别用 PowerShell grep。
- **PowerShell 内联 ssh 命令里的 `$(...)`/`%{}`/中文/嵌套引号会被本地 PS 先解释坏** → 一律把命令写成本地 `.sh`/`.sql`/`.js`，scp 到服务器 `/tmp`，`sed -i 's/\r$//'` 去 CRLF 后再 `bash`/`psql -f`/`node` 跑。
- ⭐⭐ **本地登录/接口莫名"请求失败"的唯一口诀（2026-07-28 查透）**：**接口全 404/500、或 `npx tsc --noEmit` 报 `.next/dev/types/*` 语法错 → 一定是 `.next` 缓存坏了，跟业务代码无关，别去翻登录逻辑。** 处置：**双击 `start-project.bat` 即可自愈**（脚本会自动杀僵尸 dev server、把坏掉的清单备份到 `.runtime/next-broken/<时间戳>/`、删 `.next`、重启；实测 15 秒）。排查过程看 **`.runtime/start-project-trace.log`**（独立追踪日志，不会被 npm 输出污染）。注意 `routes.d.ts` 是**纯类型文件、运行时被剥掉、不可能导致 404**，它只是症状；真正 404 的是路由清单 `dev/server/app-paths-manifest.json` 这类。复发根因仍未结案（头号嫌疑＝腾讯电脑管家实时防护，已加白名单，待观察）。
- ⛔ **写"清理进程"的命令必须排除 `$PID`**：用 `CommandLine -like "*start-project*"` 这类匹配会**把自己的 shell 一起杀掉**（自己的命令行里也含这个串），表现为命令"无输出"、白查半天。
- ⛔ **本地 `prisma generate` 会被 dev server 占用 dll 报 EPERM** → 先停 dev server。**Turbopack 不重编 `globals.css`** → 改样式没反应时删掉整个 `.next` 再重启 dev（重启进程不够）。
- ⛔ **后台/前台的客户端组件（`"use client"`）里不要格式化日期**（`Intl.DateTimeFormat`、`toLocaleString`、`Date.now()` 相对时间）：服务器容器与浏览器时区/时钟不同 → SSR 与 CSR 文本不一致 → **hydration mismatch（React #418）**。一律**在服务端算好、传字符串**（例：`src/lib/admin-failure-triage.ts` 里的 `*Label` 字段）。2026-07-28 v49 上测试服时踩过。
- ⛔ **PowerShell 里 `node -e "...$..."` 的 `$` 会被本地 shell 吃掉**（`p.$disconnect()` → `p.()` 语法错）→ 一次性脚本一律写成 `.js`/`.sh` 文件再跑，别内联。
- ⛔ **查资产真实尺寸时 `find <文件名> | head -1` 会先命中缩略图副本**（`image-thumbnails/...`）→ 差点把 256×145 当成原图 338×191。必须把所有匹配路径列出来看清楚。容器里**没有 ffmpeg/ffprobe**，量 jpg 宽高可用 `python3` 直接读 SOF 段。
- ⭐ **Playwright 测"发送前拦截"类功能**：黑底提示是**瞬时**的，`browser_snapshot` 之后就没了 → 点发送后**立刻轮询** `body.innerText`；更稳的判据是**被拦时输入框内容不会被清空**。文件选择器**不要**在 `run_code` 里自己 `waitForEvent('filechooser')`（会和 MCP 打架卡住），用 `browser_click` + `browser_file_upload`。详见 `07` 第十一节。

## 阅读顺序

1. `01-current-status.md` — 最近几批做了什么、当前状态
2. `02-architecture-and-data.md` — 架构、数据表、媒体链路、上传链路、资产分类、关键去重规则
3. `03-deploy-and-servers.md` — 服务器/部署流程（**改代码/部署必读**）
4. `04-product-rules.md` — 产品规则 + 铁律细节
5. `05-next-actions.md` — 待办
6. `06-memo-tasks.md` — 用户押后的备忘任务（M001~M020）
7. `07-red-error-triage-and-archive.md` — ⭐ **红字失败原因排查方法论 + 归档规则（排查线上报错必读、当前主线任务）**
   · 第九节 = ⭐「40 条轮询 failed」全过程 + **OpenRouter 任务事后回查原文**的命令
   · 第十节 = ⭐ **后台「失败排查」页 `/admin?tab=failures`** 的功能与使用动线
   · 第十一节 = ⭐ 实机验收"发送前拦截"类功能的操作要点（Playwright 技巧）
8. `CHANGELOG.md` — 本批起的更新流水（历史流水在归档里）

## 项目基本信息

- 产品名：`闪念 / FlashMuse`（内部用的简易「即梦式」创意助手，对话式生图/生视频 + 工作流 + 资产库）。
- 路径：`E:\project\FlashMuse_Agent`。GitHub：`https://github.com/lookxun/FlashMuse_Agent`（本地 origin 已指向它，identity `lookxun`）。
- 技术栈：`Next.js 16.2.4`、`React 19.2.4`、`Prisma 6.19.3`、`PostgreSQL`、`Tailwind CSS 4`。
- 版本号：`src/lib/app-version.ts` 的 `APP_VERSION`（四段 100 进制 `vAA.BB.CC.DD`）；测试服 build arg `NEXT_PUBLIC_IS_TEST=true` 显示 logo"测试服"/`版本号(t):vX`/标签标题 `(测试服)` 前缀。

## 交接文档维护规则

- 保持当前交接文档简洁、只写有效内容。太长或混入过时历史时，把整批归档进 `historical-handover-docs-last-used-YYYY-MM-DD/`（只读，不改不删），再写一批新的精简当前文档。
- 日常更新写进 `handover/` 下的当前文档，不写进归档。
- 押后任务写 `06-memo-tasks.md`（每条要有 ID、押后原因、以后怎么做）；用户说完成就打 `[x]`。
