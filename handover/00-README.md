# FlashMuse Handover（2026-07-21 重建）

> 本目录是**当前**交接文档。上一批（截至 2026-07-21，含全部历史 CHANGELOG/流水）已归档到 `historical-handover-docs-last-used-2026-07-21/`，只读、勿改。更早的归档在 `historical-handover-docs-last-used-2026-06-20/`。归档只在遇到难题需要历史上下文时才翻。

## ⭐ 当前线上状态（2026-07-21）

- **四方同步**：正式服 = 测试服 = 本地 = GitHub = **`v1.0.0.36` / commit `dd37a78`**（handover doc commit 之后另有跟进）。四域名 main/api/ali/static.venusface.com 全 200。工作树干净、无待部署。
- **主服务器 = 腾讯云新加坡 `119.28.116.16`**（Docker 栈）。马来西亚老服务器已彻底退出链路。阿里 `101.37.129.164` = 国内入口/静态镜像 + 反代回腾讯。**部署一律走腾讯 Docker 流程**，见 `03-deploy-and-servers.md`。
- **测试服**（独立、数据隔离）：入口 `http://101.37.129.164:8080/`（或 https `staging-static.venusface.com`）、后台 `/admin`。主测试号 `12424740@qq.com` / `dragonstar`（普通用户 ID_535317，模拟真实用户优先用它）。详见 03。

## ⭐⭐ 三条铁律（所有 AI 必守，已同步进 `AGENTS.md` 顶部）

1. **动代码前先评估对既有功能的影响**：对话流 / 工作流 / 资产库 / Agent / 通用模式本质相同、常共用同一份代码。有影响就**先说清影响范围、等用户确认再改**。
2. **默认只做本地、不部署**：用户没明确说"部署"就只在本地改（`npx tsc --noEmit` 自查）。**"部署掉/部署一下"= 只部署测试服，绝不动正式服**；只有用户明确说"部署正式服/上线正式服"才走"先测试服→验证→整份同步正式服"完整顺序。版本号自增只在部署测试服那一步跑 `node scripts/bump-version.mjs`，正式服原样带过去 → **版本号一样 = 代码一样**。
3. **能统一的一律统一**：写/改前先查有没有统一公共路径，有就复用、没有就抽一个，**禁止把同一逻辑复制多份各自演化**（踩过坑：`getBytePlusProviderKey` 复制三份漏修）。"一处能用，其它处都该能用"。

## ⭐ 重要工具/环境认知

- **可以用浏览器工具（playwright）直读全网站正文**（含火山 BytePlus 这种 JS 渲染的官网）。查官网规格一律用浏览器打开渲染后页面为准；`webfetch` 对 JS 站只拿到空壳=没读到。别拿本地旧复制文档当权威。
- **改中文源码只用 edit/write 工具，禁 PowerShell `Set-Content`/`Out-File`**（会把中文变乱码）。本地搜文件用 Grep/Read 工具，别用 PowerShell grep。
- **PowerShell 内联 ssh 命令里的 `$(...)`/`%{}`/中文/嵌套引号会被本地 PS 先解释坏** → 一律把命令写成本地 `.sh`/`.sql`/`.js`，scp 到服务器 `/tmp`，`sed -i 's/\r$//'` 去 CRLF 后再 `bash`/`psql -f`/`node` 跑。

## 阅读顺序

1. `01-current-status.md` — 最近几批做了什么、当前状态
2. `02-architecture-and-data.md` — 架构、数据表、媒体链路、上传链路、资产分类、关键去重规则
3. `03-deploy-and-servers.md` — 服务器/部署流程（**改代码/部署必读**）
4. `04-product-rules.md` — 产品规则 + 铁律细节
5. `05-next-actions.md` — 待办
6. `06-memo-tasks.md` — 用户押后的备忘任务（M001~M019）
7. `CHANGELOG.md` — 本批起的更新流水（历史流水在归档里）

## 项目基本信息

- 产品名：`闪念 / FlashMuse`（内部用的简易「即梦式」创意助手，对话式生图/生视频 + 工作流 + 资产库）。
- 路径：`E:\project\FlashMuse_Agent`。GitHub：`https://github.com/lookxun/FlashMuse_Agent`（本地 origin 已指向它，identity `lookxun`）。
- 技术栈：`Next.js 16.2.4`、`React 19.2.4`、`Prisma 6.19.3`、`PostgreSQL`、`Tailwind CSS 4`。
- 版本号：`src/lib/app-version.ts` 的 `APP_VERSION`（四段 100 进制 `vAA.BB.CC.DD`）；测试服 build arg `NEXT_PUBLIC_IS_TEST=true` 显示 logo"测试服"/`版本号(t):vX`/标签标题 `(测试服)` 前缀。

## 交接文档维护规则

- 保持当前交接文档简洁、只写有效内容。太长或混入过时历史时，把整批归档进 `historical-handover-docs-last-used-YYYY-MM-DD/`（只读，不改不删），再写一批新的精简当前文档。
- 日常更新写进 `handover/` 下的当前文档，不写进归档。
- 押后任务写 `06-memo-tasks.md`（每条要有 ID、押后原因、以后怎么做）；用户说完成就打 `[x]`。
