# Current Handover Changelog（2026-07-21 重建起）

> 本批 CHANGELOG 从 2026-07-21 交接文档重建开始记。**此前的全部历史流水**（约 580KB，含 2026-06 起到 07-21 每一次改动/部署细节）在 `historical-handover-docs-last-used-2026-07-21/CHANGELOG.md`，遇到需要历史上下文的难题再翻。

## 2026-07-28（第十一次会话）⭐⭐ 「40 条轮询 failed」全部查清并修 + 后台新增「失败排查」页 —— ✅ **已部署两服 v1.0.0.50**

### 部署结果（一次性把积压的第十次 + 第十一次两批全部上线）

- ✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.50`**（commit `1fd1ef3`）。**无 Prisma 迁移**（两服 entrypoint 均 `No pending migrations`）。
- 正式服备份 `/opt/flashmuse/app-backups/20260728-140839-presync-v50`；四域名 main/api/ali/static 全 **200**；两服 `x-app-version: v1.0.0.50`。
- 归档：**正式服 33 条**（`kling-reference-image-pixel-invalid` 32 + `veo-r2v-duration` 1）→ 待排查 **308 → 286**；
  测试服命中 0（正常，无这批数据）、仍 36。⭐ 兜底桶「服务器繁忙」**从 60 降到 28**（占待排查 9.8%）。
  （先 `dry-run` 核对 `toArchive: 33` 与排查结论一致，再 `--apply`。）
- 部署后正式服后台实测：新页 `/admin?tab=failures` 真实数据正常
  （286 待排查 / 18 种 / 影响用户 15 人 / 还在流血 10 种 · 已停止 8 种 / 已归档 400 / 图片失败率 13.2% / 视频 19.8%）；
  概览页「失败原因」卡片未坏、第 4 条「服务器繁忙」已显示 28。
- ⚠️⛔ **为什么版本号是 v50 而不是 v49**：v49 上测试服后新页立刻报 **hydration mismatch（React #418）** ——
  日期在**客户端** `Intl.DateTimeFormat` 格式化，服务器容器与浏览器时区不同 → SSR 与 CSR 文本不一致。
  修法：**所有日期改由服务端预格式化成 `firstAtLabel/lastAtLabel/lastAtAgoLabel/createdAtLabel/resolvedAtLabel` 字符串再传给客户端组件**，
  客户端一行日期逻辑都不留。修完按铁律重新 bump 才上正式服（v49 只在测试服活了几分钟）。
  **以后后台新页（客户端组件）绝对不要在浏览器端格式化日期。**（已写进 `00-README.md` 的「重要工具/环境认知」。）

### 测试服实机验收（用户要求"测过再上正式服"，全过）

| 项 | 结果 |
|---|---|
| Kling v3.0 Standard + 200×120 参考图 | ✅ 发送前拦下：「参考图「small-200x120」太小了（200×120）。生视频要求参考图宽和高都不小于 300 像素，请换一张更大的图。」 |
| Veo 3.1 + 参考图 + 4 秒 | ✅ 发送前拦下：「当前模型在使用参考图时只支持 8 秒的视频时长（你选的是 4 秒），请把时长改成 8 秒后重试。」 |
| **反例** Veo 3.1 + 4 秒 + **无参考图** | ✅ 不拦、正常渲染出片（纯文生视频没被误伤） |
| **反例** Kling + 1280×720 合规参考图 | ✅ 不拦、正常渲染出片 |
| 后台新页 | ✅ 测试服 36 待排查 / 兜底桶 15 / 已归档 10（与文档记录一致）；筛选·搜索·展开样本·复制全通；**0 控制台错误** |
| 后台概览页「失败原因」卡片 | ✅ 未坏（本次把它的归一化 SQL 改成 import 共享常量） |
| 工作流画布 | ✅ 正常加载、节点工具齐全 |

⚠️ **唯一没点到的**：**工作流侧**的 Kling 拦截没做到"点生成看提示"（tldraw 画布 8% 缩放下连线不适合自动化）。
它走的是同一个共享函数、`api/video/route.ts` 还有一道服务端 400 兜底，风险很低，**下次有机会人工点一次**。

### ⛔ 本次验收/排查踩到的操作坑（全部已写进 `00-README.md` 与 `07` 第十一节）

1. **黑底提示是瞬时的**，`browser_snapshot` 之后就没了 → 点发送后**立刻轮询** `body.innerText`（15×120ms 循环能抓到）。
   更稳的判据：**被拦时输入框里的提示词和参考图不会被清空**。
2. **Playwright MCP 的文件选择器不能在 `run_code` 里自己 `waitForEvent('filechooser')`** —— 与 MCP 的 modal 跟踪打架卡住。
   正确姿势：`browser_click` 点上传 → `browser_file_upload` 传文件 → 再 `run_code` 做后续。
3. **`find <文件名> | head -1` 会先命中缩略图副本**（`image-thumbnails/...`）→ 差点把 **256×145** 当成原图（真实是 **338×191**）。
   容器里**没有 ffmpeg/ffprobe**，量 jpg 宽高用 `python3` 直接读 SOF 段即可。
4. **PowerShell 里 `node -e` 的 `$` 会被吃掉**（`p.$disconnect()` → `p.()` 语法错）→ 一次性脚本一律写文件。
5. **本地进不了后台**的解法：临时把主测试号 `12424740@qq.com` 加进 `.env` 的 `ADMIN_EMAILS`（逗号分隔），**验完已还原**。
6. 造测试图不用找素材：项目已装 `sharp`，几行生成 200×120（触发拦截）+ 1280×720（合规反例）。
7. `.gitignore` 顺手加了 `/tmp/*.log`（本地 dev 日志别再进 git）。

### ⚠️ 验收时新发现一个小问题（未修，已记进 `05-next-actions.md`）

被发送前拦截后，**不改任何东西直接再点一次发送** → `POST /api/asset-upload-temp` **500**，
容器日志 `[upload] asset-upload-temp patch failed ... error: 上传文件不存在或已过期`。
临时上传凭证像是被第一次尝试消耗/失效了；重新上传即可。**不影响首次拦截的正确行为**，
但用户连点两次会看到一个没用的报错（而不是再看到那句明确的拦截原因）。优先级低。

### ⭐⭐⭐ 排查方法论突破：**OpenRouter 的视频任务事后仍可回查，别再"等新数据攒几天"**

上一轮的结论是"上游原文当时没落盘（只记 `hasError` 布尔）→ 只能等新数据"。**这个结论是错的。**
`video-provider-poll-success` 里的 `taskId` 对 OpenRouter 就是完整轮询 URL
（`https://openrouter.ai/api/v1/videos/<id>`），带 API Key 直接 GET 就能把**当时的 `error` 原文**取回来。
本次一次性把 07-27 那批 33 个任务的原文全捞到了。
（⚠️ BytePlus 的 `cgt-xxx` 没有这个待遇 → 那 6 条仍不可考。）

### 轮询失败的真实构成：75 条 distinct taskId（"40"只是落在兜底桶的那部分）

先建 `taskId → requestId` 桥（来自 `video-provider-create-success`，它两个字段都有），75/75 全部映射上 DB：
26 条已是明确文案「成品被平台拒绝交付」（不归档）/ 4 条「API Key 无效」/ **33 条 OpenRouter 落在兜底桶** /
**6 条 BytePlus 落在兜底桶且仍不可考**（B_195/237/246-249/256）。

### 那 33 条的两个根因

**A. `Image pixel is invalid` —— 32 条（Kling 全系）**
同一个用户 ID_664169、同一会话、同两张参考图，07-27 连续失败 32 次。参考图实测 **338×191**（高 < 300）。
⭐ **和第七次会话归档的 191 条 BytePlus「参考图尺寸不合规」是同一个根因**（那批原文正是 `received a 338x194px image`）。
漏出来的原因：v47 的发送前尺寸拦截被写死「只对 BytePlus 生效」（三处都是，注释还明写"别的模型不能拿它拦人"）→
**Kling 路径完全裸奔**；而 Kling 官方规则和 BytePlus 一模一样（≥300×300px、比例 1:2.5~2.5:1）。
典型的「该统一却分叉了」。而且它是**异步**失败（先 202 收下、一两分钟后才 failed）→ 用户白等再看到"服务器繁忙"。

**B. `Unsupported output video duration 4 seconds, supported durations are [8] for feature reference_to_video.` —— 1 条**
`google/veo-3.1` 纯文生视频支持 4/6/8 秒，但**带参考图（r2v）只允许 8 秒**，我们的时长表没有这个维度。

### 改动（用户拍板 1+2+3 一起做；全部只动错误/校验分支，成功路径零改动）

1. **`src/lib/video-reference-image-rules.ts`** 新增唯一权威 `videoModelEnforcesReferenceImageSizeRules(modelId)`
   （集合 = BytePlus Seedance ×3 + Kling ×3），**三处咽喉全部改用它**：
   `chat-workbench.tsx:13374` / `workflow-tldraw-canvas-inner.tsx:4433` / `api/video/route.ts:827`。
   ⚠️ 往集合里加模型必须有依据（官方文档或线上失败原文），别拿 BytePlus 的数去拦没验证过的模型。
   ⭐ 顺带记下一条认知：`api/video/route.ts` 那道服务端兜底靠 `MediaAsset.width/height` 查库，
   而这两条资产的 width/height **就是 null** → 服务端根本拦不住，**真正拦得住的是前端那道"现场量图"**。两道都得在。
2. **`src/lib/error-message.ts`** 新增两条映射（放在最前面那个块里、`specified asset` 之后）：
   `image pixel is invalid` → 「参考图尺寸不符合平台要求（宽高都需不小于 300 像素，宽高比 0.4–2.5）…」；
   `unsupported output video duration` → 读出上游 `supported durations are [...]` 原样告诉用户。
   **`src/lib/transient-error.ts`** 把这两类列入 `isPermanentError`（换图换参数才行，重试白烧时间）。
3. **`src/lib/models.ts`** 新增唯一权威 `VIDEO_REFERENCE_DURATION_LIMITS`（现只有 `google/veo-3.1: [8]`）
   + `validateVideoDurationWithReferences(modelId, duration, referenceCount)`，同样三处咽喉发送前拦截
   （服务端那道另加 `video-route-reference-duration-rejected` 日志点）。
   ⭐ **故意不做静默改写**（不悄悄把 4 秒改成 8 秒）—— 时长直接决定计费，悄悄改会让用户多花钱且莫名其妙。
   ⭐ 也**没有改 UI 时长下拉**（9 处调用点都要穿参数，风险高收益低）；拦截 + 明确提示已经 100% 堵住失败。
4. **`scripts/archive-resolved-generation-failures.mjs`** 新增 `kling-reference-image-pixel-invalid` / `veo-r2v-duration`
   两条规则，另做一处**结构性增强**：这批日志里根本没有原文 → 靠 `match` 永远匹配不上，
   所以新增 `taskId → requestId` 桥 + `pollFailedTaskIds` 集合（扫日志时顺手建），
   命中后**按模型**分派根因（`^kwaivgi/kling-` → A，`google/veo-3.1` → B；依据是那次回查，不是猜）。
   BytePlus 的轮询失败**不在**分派里、仍不归档。`select` 补了 `model`。

### ⭐ 后台新增独立页面「失败排查」`/admin?tab=failures`（左侧"生成记录"下面）

- 新文件：**`src/lib/admin-failure-triage.ts`**（唯一权威数据层，只读不写）+ `src/app/admin/admin-failure-triage-panel.tsx`。
- ⭐ 顺手**消掉一处抄三遍**：原因归一化的 `regexp_replace` SQL 在 `admin-overview.ts` 里抄了 3 遍，
  现抽成 `FAILURE_REASON_SQL` 导出，概览页改为 import 复用（那三处从 `$queryRaw` 模板改成 `$queryRawUnsafe`，
  SQL 字符串完全一致、无外部输入）。
- 这页比概览小卡多给的（都是实际排查时反复手查的）：
  ① 每条原因标 **「近 7 天仍在发生」/「已停止发生」**（还在流血=没修好；已停止=可考虑归档），
  **列表排序刻意先按"还在流血"再按条数**；② 标 **「兜底桶 · 需回日志捞原文」** + 单独的「两个兜底桶」卡片
  （含"`grep -c` 行数 ≠ 事件数"的警告）；③ 点开任意一行给**最近 6 条样本 requestId（一键复制）**；
  ④「按入口」卡片（只在一个入口出 = 大概率分叉）；⑤「按模型」带**失败率**（有分母）；
  ⑥「失败最多的用户」（本次那 32 条就是这么定位到的）；⑦ 近 30 天趋势 + 今日/昨日/7天环比；⑧ 已归档区（划掉+说明+时间）。
- ⚠️ 归档动作仍**只由脚本执行**，这页纯只读。
- 实测：本地库 39 条失败事件下整页渲染正常、7 种原因、筛选/搜索/展开样本/复制都通（临时把测试号加进 `.env` 的
  `ADMIN_EMAILS` 登录验证，**验完已还原**）。

### 自查

`npx tsc --noEmit`（过滤 `.next`）全绿；新增/改动文件 `eslint` 无 error。**无 Prisma 迁移**。

## 2026-07-28（第十次会话·补）⭐⭐ 「本地登录报请求失败」根治：`start-project.bat` 加 `.next` 损坏自愈 —— ⚠️ **仅本地脚本，不影响线上**

用户反馈"本地又登录不了、报请求失败，昨天也这样，是不是修不好了"。**跟业务代码无关**，查出三层问题，第三层才是"为什么昨天修好今天又坏、双击启动也救不回来"的真答案。

### ① 表象与第一层原因：`.next` 缓存损坏 → **所有 `/api/*` 全 404/500**

- 实测 `POST /api/auth/login-password` 返回 **404**，返回体里 Next 自己写着 `"c":["","api","auth","login-password"]` 却渲染成 `/_not-found`；路由文件本身好好在那。
- `.next/dev/types/routes.d.ts` **被写截断**（58 行、从字符串中间断掉 `e" | "/api/upload-image"...`）；`npx tsc --noEmit` 报的一堆 `TS1434/TS1109` 就是它。
- ⚠️ **我一开始把因果讲错了**：`routes.d.ts` 是纯类型文件、运行时会被剥掉，**不可能**导致 404。它只是"同一次写坏"的症状，真正 404 的是 `.next` 里的**路由清单**（`dev/server/app-paths-manifest.json` 这类）。教训：**下次先把坏掉的 `.next` 备份再删**，我这次直接删了导致证据丢失。
- 临时处置：停 dev → 删整个 `.next` → 重启 → 接口恢复 200、tsc 全绿。

### ② 第二层：为什么反复复发（**嫌疑锁定，尚无铁证**）

排除项（都实测过）：磁盘满（E: 剩 381GB）❌、多开 dev server ❌、异常关机（近 3 天无 Kernel-Power 41/6008）❌、OneDrive 同步（在 C:、项目在 E: 不在范围内）❌。
**头号嫌疑：腾讯电脑管家实时防护 `QQPCRTP.exe`**（Windows Defender 已被它顶掉关闭）。时间点吻合：`routes.d.ts` 写坏时间 `9:47:21`，dev server `9:46:38` 启动 —— **启动后 45 秒、正在生成路由清单时被打断**，不是关机时坏的。已让用户把 `E:\project\FlashMuse_Agent` 与 `node.exe` 加进管家信任区。**是否真断根要观察次日是否复发。**

### ③ 第三层（真答案）：`start-project.bat` 双击**根本没机会自愈**，脚本每次都当场死掉

用户只会双击 `start-project.bat`。加了自愈逻辑后实测**连续三次都没生效**，靠新加的独立追踪日志 `.runtime/start-project-trace.log` 才拿到铁证：

```
[11:46:25] launcher started (Worker=True)
[11:46:27] mutex owned=True port3000busy=True
Set-Content : 文件"start-project.log"正由另一进程使用，因此该进程无法访问此文件
```

⭐⭐ **`start-project.log` 被 `cmd /c npm run dev >> start-project.log` 的重定向独占着文件句柄**，脚本一进来就 `Set-Content` 写它 → **IOException → 整个脚本当场终止**。**结论：只要 dev server 还活着（哪怕是坏的僵尸），双击 bat 就必然毫无反应** —— 这就是"救不回来"的真因。

一路还查出另外两个真 bug：
- **`Test-TcpPort "127.0.0.1" 3000` 判定失效**：Next 绑在 IPv6 通配 `::` 上、且该探测只有 500ms 超时 → 报"端口空闲" → 脚本走冷启动 → 新 dev server 被挤到 **3001**，僵尸继续占 3000 → 然后死等 3000 变好、**5 分钟超时弹记事本**（就是用户看到的"没反应"）。改用 `Get-NetTCPConnection -State Listen -LocalPort` 精确判定。
- **互斥锁静默退出**：`Mutex(createdNew)` 一旦被卡死的旧实例持有，新的双击直接 `exit`、什么都不做。改成先等它 6 轮（每轮 20s 探活 + 10s），仍不健康就**无视锁继续自己修**。

### ④ `scripts/start-project.ps1` 的最终改动

1. **健康判定从"首页 200"改成"`/api/auth/me` 必须 200"** —— `.next` 坏时首页也 500/首页正常时 API 却可能 404，只有打 API 才测得准。连续 3 次（可配 `-Attempts`/`-TimeoutSec`）非 200 才判定损坏，避免首次冷编译慢被误杀。
2. **新增 `Write-Trace` + 独立追踪日志 `.runtime/start-project-trace.log`**（`.runtime` 已 gitignore）：npm 的 stdout 不会污染它，以后排查一看就知道走了哪条分支。
3. **`Write-Log` / 新增 `Reset-Log` 全部 try/catch 兜住**，日志写失败绝不再中断流程（第三层病根）。原来 8 处裸 `Add-Content/Set-Content $log` 全部收敛到这两个函数。
4. **新增 `Stop-NodeOnPort`**（按端口占用者 PID 杀，且**只杀 `node.exe`**，无关进程不动）+ `Stop-DevServer` 同时清 3000/3001 与命令行含项目根路径的 node、含 `npm run dev` 的 cmd。
5. **新增 `Repair-NextCache`**：停 dev → **先把坏掉的清单备份到 `.runtime/next-broken/<时间戳>/`**（types 目录 + 所有 `*manifest*.json`，都很小）→ 删 `.next` → 重启。这样以后真复发能拿到铁证定位到具体哪个文件。
6. **新增 `Test-DevPortBusy`**（`Get-NetTCPConnection` 精确判定）替代不可靠的 `Test-TcpPort` 探 3000。
7. 冷启动路径也加了自愈：起来后 API 不健康 → 自动修一次再起。

### ⑤ 实测结果（都跑过真机验证）

| 场景 | 结果 |
|---|---|
| 正常冷启动（`.next` 已删空） | 接口 200、无多余 3001、**没有误删 `.next`** |
| **故障态**（3000 被僵尸占 + 接口 500，等价用户今天的状态）→ 双击 bat | ⭐ **15 秒自愈成功**：探活 2 次 500 → 杀僵尸(PID 34324) → 备份清单 → 删 `.next` → 重启 → 接口 200 |
| 健康态下再双击 | 只开浏览器，`.next` 保留、备份数不变（不误伤） |
| PowerShell 语法检查 | PASS |

### ⑥ 遗留

- **第二层根因仍未结案**：观察次日是否复发。若还犯，就去 `.runtime/next-broken/` 拿备份的清单文件比对，定位到具体哪个文件、残在什么位置。
- 我在排查中两次把自己的 shell 杀掉（清理命令用 `CommandLine -like "*start-project*"` 匹配，而我自己的命令行里也含这个串）→ 表现为命令"无输出"。以后写这类清理命令**必须排除 `$PID`**。

## 2026-07-28（第十次会话）⭐ 模型「明文拒绝」识别 + AI 改写重试收敛成唯一权威并补给对话流 —— ⚠️ **仅本地，未部署**（tsc 全绿，无 Prisma 迁移）

排查对象＝`07-red-error-triage-and-archive.md` 第七节第 3 条「gpt-5.4-image-2 中文明文拒绝」。查清后发现是**两个不同的问题被混成一条**。

### ① 根因（`src/lib/openrouter.ts`，三个 `image-provider-empty-result` 打点各不相同）

| 打点 | 走哪个模型 | 有没有读上游拒绝文字 |
|---|---|---|
| `:1388` | BytePlus `/images` | 只读 `data.error.message` |
| **`:1679`** | **OpenRouter 新接口 `/api/v1/images`（`openai/gpt-5.4-image-2` 走这条）** | ❌ **完全没读** |
| `:1911` | OpenRouter 老 `/chat/completions`（`...-agent` GPT 版） | ✅ `getOpenRouterNoImageReason` 读 `choices[0].message.content/refusal` |

- **问题 A（落兜底桶的那批）**：新接口响应类型 `:1483` 只声明了 `data[].b64_json`，拒绝文字压根没被读；`:1689` 的日志 `upstream` 写死 `reason:"empty image result"`、**连 `responseText` 都没带**（对比 `:1658` 的 non-ok 分支是带 `body` 的）→ 抛「图片平台没有返回图片，且没有返回可用原因。」→ 被 `error-message.ts:69` 精准打回 fallback＝**「服务器繁忙」**。**所以连"它到底拒绝说了什么"都查不到。**
- **问题 B（那 ~20 条）**：老接口路径原文是读到的（红字就是「图片平台没有返回图片：抱歉，我不能…」，`error-message.ts` 走中文原文透出，**没落兜底桶**）。真正的缺口是 **UI：「AI 改写重试」只存在于工作流**（`onOptimizationRetry` 全库只出现在 `workflow-tldraw-canvas-inner.tsx`），对话流 / 资产库 / Agent 完全没有这个入口。
- 附带发现：工作流的判定 `isWorkflowGptImageSafetyFailure` 正则里本来就含 `图片平台没有返回图片`，但因为问题 A 把文案换成了"服务器繁忙"，**这条正则在新接口上永远不命中** —— 改写页进不去的直接原因。

### ② 本次改动

1. **步骤 1 —— 只加日志，不猜字段**（用户明确要求）：`openrouter.ts` 新接口空结果分支的 `upstream` 补 `body: redactBase64ForLog(responseText).slice(0,1200)`，新增 `redactBase64ForLog()`（200+ 长 base64 串换成 `[base64]`，防刷爆日志）。**⭐ 待跟踪：等线上攒到真实样本，看拒绝原文落在响应哪个字段，再写读取逻辑**（详见 `05-next-actions.md` 待跟踪项）。
2. **步骤 2 —— `src/lib/error-message.ts` 新增「模型明文拒绝」判定**：新增唯一权威常量 `MODEL_REFUSED_MESSAGE` + `isModelRefusalText()`（9 条高辨识度正则，中文只认"抱歉+我不能/无法"这类第一人称拒绝，英文补上以前**完全没有**的 `I can't help with` / `I'm unable to` / `I must decline` / `violates our policy`）。规则插在 `safety_violations` 那组之后、**版权/隐私/敏感那几条之前** —— 否则拒绝原文里的"版权/隐私"字样会被抢走误报成"参考图有问题"（其实和参考图无关）。同时补掉了「纯英文一律进兜底桶」（原 `:72`）对英文拒绝语的吞没。
3. **步骤 3 —— 新增唯一权威 `src/lib/gpt-image-safety-retry.ts`**（对话流 + 工作流共用，按 AGENTS.md「能统一一律统一」）：
   - `isGptImageSafetyFailure({model, errorText, hasPriorAttempts})`：判定收敛，工作流 `isWorkflowGptImageSafetyFailure` 改成薄壳调它。
   - `normalizeAttemptPrompt` / `getFallbackSafetyPrompt`（从工作流文件原样移出）/ `NO_NEW_SAFETY_PROMPT_MESSAGE` / `SAFETY_RETRY_EXHAUSTED_MESSAGE`。
   - `runPromptSafetyRetry()`：把"循环 / 去重 / 兜底改写词 / 最终文案"整套编排抽出来，**`rewrite` 和 `generate` 由调用方以回调传入** —— 故意不收敛 fetch，因为两处的 `readJson`（401 跳首页）和错误文案构建方式不同，硬合会改现有行为。`generate` **resolve 视为成功、throw 视为本轮仍失败**。
   - 工作流 `runGptImageOptimizationRetry`（`:4287`）重写成调用它，删掉本地那份 60 行循环，行为等价（`attemptsUsed` 累计口径保持不变）。
4. **对话流补上「AI 改写重试」入口**：
   - `Message` 加 `gptImageOptimizationOriginalPrompt` / `gptImageOptimizationAttemptPrompts` / `gptImageOptimizationRetryingIndexes`（与工作流 `node.data` 同名字段对齐）。
   - 新增 `patchMessageById()`（按消息 id 打补丁 —— 改写重试要跨多次生成改同一条消息，而 `requestId` 每次重试都变，`updateAssistantMessageByRequestId` 用不了）。
   - `retryFailedMedia` 加第三参 `promptOverride` 并改成 `async` + `return await runGeneration(...)`，让编排能 await 一轮跑完。
   - 新增 `canConversationOptimizationRetry()`（调共享判定）+ `runConversationGptImageOptimizationRetry()`。⭐ **对话流的失败被 `Promise.allSettled` 吞掉、不会 reject**，所以每轮结束后回 `sessionsRef` 核对"这条消息的图片数有没有变多"来判定成功，没变多就 throw 让编排继续下一轮。
   - 新增共享小组件 `MediaOptimizationRetryActions`（「AI改写重试 3/5/10 次」三颗按钮），两套条带 `ImageResultStrip` / `ImageResultSlotStrip` 的失败卡都接上，**按 `canOptimizationRetry` 收窄**（只图片模式 + gpt5.4image2 两种接口 + 拒绝类失败才亮，视频 / 其它模型一律不亮）。
   - 改写期间用 `gptImageOptimizationRetryingIndexes` 持续显示等待卡，避免两次尝试之间闪回失败卡；`optimizingImageMessagesRef` 按 `${messageId}:${failedIndex}` 上锁，防连点开多条改写链白烧积分。
   - 后端接口 `POST /api/workflow-prompt-optimization/rewrite` **零改动**（实测它与"工作流"无强绑定，`workflowId/Title/NodeId` 全可选且只用于记账，对话流直接传 sessionId / 会话标题 / messageId）。

### ③ 影响评估 / 已知点

- 动的都是**失败分支**，成功路径零改动。视频、Agent 模式共用同两套条带，已用 `canOptimizationRetry` 收窄，不会误出现按钮。
- ⚠️ **文案变化（预期内）**：以前落进「服务器繁忙」或被误报成"参考图有问题"的模型拒绝，现在统一显示 `MODEL_REFUSED_MESSAGE`。
- ⚠️ **一个待实机确认的观感问题**：对话流失败收尾 `finalizeAssistantImageFailures` 的 payload 带 `content: prompt` → 改写重试全败后，消息内容会被替换成**最后一次的改写提示词**（原本就是这套逻辑，只是原来传的是原提示词所以看不出来）。要在实机测试时看一眼是否需要处理。
- 步骤 3 我最初提的"给 API 加结构化 `code:"MODEL_REFUSED"`"**没做**：那要动 `createCodedApiError` + 6 个 route + `GenerationJob` 表 + `/api/generation-status`，风险和收益不成比例。改成"步骤 2 产出稳定文案 → 共享判定函数认这个稳定文案"，效果等价且零 DB 改动。真要结构化留作后续。
- ⚠️ 本地 `npx tsc --noEmit` 中 `src/` **全绿**；但 `.next/dev/types/routes.d.ts` / `validator.ts` 报一堆 TS1434/TS1109 语法错 —— 那是 **Next 生成的陈旧/损坏产物**（非本次改动引入），删掉 `.next` 重启 dev 即消失。

## 2026-07-28（第九次会话）⭐ 参考素材 url 归一化根治「平台拉我们动态缩略图接口超时」—— ✅ **已部署测试服 + 正式服 `v1.0.0.48`**（四方同步）；测试服实机回归全过；无 Prisma 迁移

### ① 根因（正式服日志原文）

后台待查清单里的「平台拉我们缩略图超时 18 条」，实测**全部集中在一个 requestId**（`id_mq4osh4b_j0yyiyq5:image:0`，用户 ID_953031，2026-07-15，对话流生图 seedream-4-5）。上游原文：

```
Timeout while downloading url:
http://101.47.19.109/api/media-thumbnail?url=%2Fgenerated%2Fusers%2FID_953031%2Fimages%2F...jpg&v=thumb256-20260606
```

两个毛病叠一起：
1. **给平台的是动态缩略图接口** `/api/media-thumbnail` —— 平台每来拉一次，我们的 Node 都要现场解析参数 + 用 sharp 现生成缩略图再返回。参考图本来就该给**文件静态直链**（nginx 直出、不经 Node）。
2. **前缀是 `101.47.19.109`（已退役的马来服务器）** —— 那台早就不在链路里，平台拉它注定失败。

**为什么会漏出去**：BytePlus 生图走 `openrouter.ts` 的 `toDataUrlIfLocalPublicAsset`，它**只认相对路径 `/generated/...`**，其它一律原样透传 → 这个「绝对地址 + 动态接口」的 URL 就被当参考图发给了平台。

### ② 修法：一个唯一权威函数，8 处接入（贯彻"能统一一律统一"）

新增 **`src/lib/reference-asset-url.ts`** → `normalizeReferenceAssetUrl()` / `normalizeReferenceAssetUrls()`，**幂等**：
- 剥掉自家主机绝对前缀（马来/腾讯/阿里/四域名/测试服，允许带端口）→ 相对路径
- `/api/media-thumbnail?url=X` → 还原成 **X（原图静态直链）**，最多解 3 层防嵌套
- `/generated/...` 去掉缓存版本号 query（`?v=thumb256-xxx`）与 `#` 片段
- `data:` / `asset://` / 第三方 https **原样不动**

接入位置（进模型/送审前的全部咽喉）：
- **入口 3 处**：`api/image/route.ts:95`、`api/video/route.ts:762-764`（图/视频/音频三类）、`api/byteplus-assets/route.ts`（送审 `toPublicAssetUrl`）
- **异步 job 唯一入口**：`generation-jobs.ts` 的 `resolveReferenceUrls`
- **底层拼地址/转 base64**：`openrouter.ts`（`toDataUrlIfLocalPublicAsset` / `toPublicGeneratedImageUrl` / `resolveOwnLocalAssetPath`）、`openrouter-video.ts`（2 处）、`seedance.ts`（1 处）、`video/route.ts` 的 `toPublicAssetUrl`

**顺手修掉同源潜伏 bug**：以前参考图若是 `http://<自家域名>/generated/...` 绝对地址，`toDataUrlIfLocalPublicAsset` 同样不认，会把地址原样发给平台（马来那批必挂）。现在一律归一化成本地路径直接读文件。

### ③ ⭐⭐ 重要认知修正：「18 条」不是 18 个失败事件，是**日志出现次数**

部署后跑归档脚本 **命中 0 条**，查清原因（**不是脚本坏了**）：
- 那 18 行日志全属**同一个 requestId**，事件构成是 `image-provider-non-ok ×6` + `provider-curl-non-ok ×6` + `image-provider-curl-fallback-failed ×6` + `image-route-failed ×7`，但**最终 `image-route-success ×3`**，该 GenerationEvent 的 **`status` = `success`**。
- 也就是说：**它是"重试过程中的中间失败"，最终成功了 → 后台「失败原因」列表里根本不占位**（那里只算 `status='failed'`）。
- 上一任 AI 的「18 条」是用 `grep -c` 数**日志行数**得出的，误当成了 18 个待排查事件。
- ⚠️ **教训（写进 07 文档）**：以后从日志 `grep -c` 得到的数字**必须回 DB 用 requestId 核对 `status`**，否则会把"中间失败/已重试成功"当成"待排查的红字"。
- 归档规则 `platform-download-our-thumbnail-endpoint` **保留**（以后真造成失败会自动认出来），当前命中 0 属正确结果。
- **Bug 本身是真的、值得修**：每次超时白等 10 秒 + 触发 curl 兜底重试链，用户端就是"转很久"；而且只要哪次重试都不中就会变成真失败。

### ④ 测试服实机回归（用户要求"测过没问题再上正式服"，全部通过）

测试号 `12424740@qq.com`，测试服 v48：
1. **对话流生图（带参考图，Seedream 4.5 / 2K / 4张）**：`image-provider-success ×4`，4 张图出图且风格跟参考图一致；日志里参考图 = `kind:"data"`（本地文件转 base64，说明归一化生效）。
2. **对话流生视频（带参考图，Seedance 2.0 Mini / 5秒）**：`byteplus-create-success` → 轮询 → `media-save-download-saved`，零错误；参考图 = `kind:"generated", pathTail:"users/ID_535317/images/...jpg"`（**原图路径，不是缩略图接口**）；前端封面就是参考图那只狐狸。
3. **工作流快捷编辑生图（走 async job = `resolveReferenceUrls`）**：`image-job-success`，人物保留、画改成向日葵花田，新节点 `image_5_w2`（Seedream 4.5 / 16:9 / 2K / 2848×1600）。
4. **v47 的 401 跳首页**：清掉 `flashmuse-session` cookie 后点生成 → URL 从 `/workspace` **直接跳 `/`**，零红字零提示；DB 查最近 20 分钟 GenerationEvent 全是 `success`，**含「请先登录」的失败事件 0 条**（确认 401 不再记事件）。
5. **两个日志文件 `media-thumbnail` 计数 = 0**（本次所有生成都没再把缩略图接口发出去）。
6. 单元自测：`normalizeReferenceAssetUrl` 10 条用例（含线上那条真实 URL）全过 + 幂等性 OK。

### ⑤ 部署记录

- 测试服：v47 → **v48**，`x-app-version: v1.0.0.48`，阿里测试镜像已同步，`PUBLISHED_APP_VERSION` = v48，入口 200。
- 正式服：备份 `/opt/flashmuse/app-backups/20260728-030655-presync-v48` → staging→prod rsync（不 bump）→ build → `.next/static` 同步阿里正式镜像 → `PUBLISHED_APP_VERSION` = v48 → **四域名 main/api/ali/static 全 200**、`x-app-version: v1.0.0.48`。
- commit `389ad87` + push → **四方同步 = v1.0.0.48**。
- ⚠️ 观察到一次 `PUT /api/workspace-state` 瞬时 **502**（前后同接口都 200，与本次改动无关，`workspace-state` 没被碰过）。如果反复出现再查阿里 nginx 超时/腾讯回源。

---

## 2026-07-28（第八次会话）**部署 v1.0.0.47 到测试服 + 正式服**（用户要求两服都部署），并执行归档

本次会话零代码改动，只做部署与归档。

1. `node scripts/bump-version.mjs`：v1.0.0.46 → **v1.0.0.47**（只在部署测试服这一步 bump）；`npx tsc --noEmit` 全绿。
2. **测试服**：tgz 21 个文件（含 `prisma/schema.prisma` + `prisma/migrations/20260727154203_generation_event_resolved/`）→ `/opt/flashmuse-staging/app` → `docker compose up -d --build staging-app`。entrypoint 日志确认 **31 migrations found / `20260727154203_generation_event_resolved` applied**。→ `sync-ali-test.sh` → compose `PUBLISHED_APP_VERSION` sed 成 `v1.0.0.47` + `force-recreate`。验证：`x-app-version: v1.0.0.47`、`127.0.0.1:5001/` 200、`http://101.37.129.164:8080/` 200。
3. **正式服**：备份 `/opt/flashmuse/app-backups/20260728-021857-presync-v47` → 服务器到服务器 rsync（staging→prod，排除 node_modules/.next/.env.local/.runtime 等）→ `docker compose up -d --build flashmuse-app`（entrypoint 日志确认同一迁移 applied）→ `/tmp/syncali.sh` 同步 `.next/static` 到阿里**正式**镜像 → `PUBLISHED_APP_VERSION` = `v1.0.0.47` + `force-recreate` → 四域名 main/api/ali/static **全 200**、`x-app-version: v1.0.0.47`。**正式服未 bump，原样带号 → 版本号一样 = 代码一样。**
4. **归档脚本两服各跑一次 dry-run → `--apply`**：
   - 测试服：待排查 46 → 归档 10（`reference-slot-not-an-image`）→ 剩 **36**。
   - 正式服：待排查 675 → **归档 367** → 剩 **308**。分布：`reference-image-size` 191、`provider-insufficient-credits` 66、`reference-slot-not-an-image` 26、`pre-diagnostics-log-unknowable` 24、`session-expired-recorded-as-failure` 17、`seedream-pro-sequential-param` 13、`reference-video-total-duration` 12、`stale-asset-card` 10、`approved-card-not-reused` 8。（预估 ~360，实测 367，吻合。）
5. commit `9268dab` + push GitHub → **四方同步 = v1.0.0.47**。
6. ⚠️ **遗留：实机回归仍未做**（v46/v47 两批功能都没点测过；v47 动了 6 个 route 错误分支 + 两处 `readJson`，需各模式跑一次成功生成 + 验一次 401 跳首页）。

---

## 2026-07-28（第七次会话）红字排查第 2~5 批：四类红字全部查清（余额不足 / 参考图尺寸第二种措辞 / 参数不支持 54 条 / 登录失效 17 条 / 第二个兜底桶 33 条）—— ✅ **已随 v1.0.0.47 部署两服（第八次会话）**；`npx tsc --noEmit` 全绿

> 本次会话共查掉 4 类红字、可归档约 **200 条**（累计实测 367 条），沉淀了三条重要认知（两个兜底桶 / 一根因多措辞 / 用 `git log -S` 验证修复时间），详见 `07-red-error-triage-and-archive.md`。



### 【第 2 批】⭐ 参考图尺寸这一类漏了 109 条：**同一根因、上游第二种措辞**（用户发现）

用户在后台看到还有「视频任务创建失败：expected the height to b...」，问是不是也算修复了。查正式服（`flashmuse-flashmuse-app-1` + `/opt/flashmuse/data/runtime/*.jsonl`）结论：

- **是同一个根因**（参考图宽/高 < 300px），只是上游在**不同阶段用了不同措辞**：
  - 素材**送审**阶段：`Height must be between 300px and 6000px.`（第六次会话查到的 82 条）
  - **建任务**阶段：`expected the height to be at least 300px, but received a 338x194px image instead`（**109 条**）
- 这 109 条明细：height 措辞 103（338×194 = 71、338×144 = 24、338×190 = 4、338×191 = 4）+ width 措辞 6（256×144）；**全部 `kind=video / byteplus:video.seedance-2-0-mini / provider=byteplus / 集中在 2026-07-27 一天`**；日志 `video-provider-create-non-ok` 里原文 `{"code":"InvalidParameter","message":"expected the height…","param":"image_url"}`。
- v47 的发送前拦截（`video-reference-image-rules.ts`）**两种措辞都能挡住**（它判的是真实宽高，不是文案），所以根因已修 → **该归档**。
- ⛔ **但两条正则都只写了第一种措辞**，直接跑归档抓不到这 109 条。已补：
  - `src/lib/error-message.ts`：加 `expected the (height|width) to be (at least|at most|between) \d+px` → 同一句中文文案。
  - 归档脚本 `reference-image-size` 规则的 `match` 同步加上（并把两种措辞写进注释）。
- ⭐ **归档脚本两处增强**（否则这类永远漏）：
  1. 匹配文本从"只有日志原文"改成 **日志原文 + `failureReason` 一起匹配** —— 这类错误没被"服务器繁忙"兜底覆盖，英文原文直接进了 `failureReason`；日志文件会轮转/被清，那时只有 DB 这份能认出来。
  2. 去掉 `requestId IS NOT NULL` 过滤 —— 没有 requestId 的事件现在也能靠 `failureReason` 归档（按自己单独成组）。
- 归档量预期再涨：**~146 → ~255 条**（191 尺寸/比例 + 53 余额不足 + 11 凭证失效 + 若干没复用旧证）。注意这 109 条**不在"服务器繁忙"212 里**（它有自己的红字），所以归档后是"服务器繁忙 212→~66"**加上**"expected the height 那两条整条消失"。

### 【顺带】⭐ 正式服未归档红字全貌 + 下一批目标（无代码，已写进 07 文档第五/六/七节）

顺手把正式服所有未归档红字和 BytePlus `InvalidParameter` 全部措辞捞了一遍（命令写进 07 文档，以后照抄）。新发现的高价值线索：

- **「当前模型不支持这组参数」54 条** —— 量太高不正常，疑似我们自己传了模型不支持的参数（很可能就是日志里 `sequential_image_generation` 那 39 条）。**下一个优先查。**
- **「请先登录后再使用模型」17 条** —— 正常用户不该看到，疑似会话/token 过期没自动续。
- **「请求失败，请稍后再试。」33 条** —— **第二个兜底桶**（`toUserErrorMessage` 默认 fallback），同样查不出原因，要同一套手法深挖。
- **平台拉我们缩略图超时 18 条** —— `Timeout/Error while downloading url: http://<ip>/api/media-thumbnail?...`，送审给的是动态接口，应改静态直链。
- 另外未查：`the specified asset is not an image` 26、`UnsupportedImageFormat` 4。
- ⛔ **踩坑记录（省下一个人的时间）**：正式服 app 容器叫 **`flashmuse-flashmuse-app-1`**（不是 `flashmuse-app`）；db 容器不能用 `psql -U postgres`（role 不存在），查库一律 `docker exec <app容器> node -e` 走 Prisma `$queryRawUnsafe`；**正式服现在还没有 `resolvedAt` 列**（迁移随 v47 才上），所以查询别带那个过滤。

### 【第 3 批】⭐ 排查「当前模型不支持这组参数」54 条 → 51 条可归档 + 修掉一个误映射

用户指定查这 54 条。查法：`docker exec flashmuse-flashmuse-app-1 node` 跑一次性脚本，按 requestId 关联 `.runtime/*.jsonl` 的失败类事件，把上游 message 归一化聚合。结论 —— **全是我们自己的 bug，而且三类都早已修掉**（后台看到的是历史存量）：

| 根因 | 条数 | 最后一次发生 | 修复 commit / 时间 | 归档 |
|---|---|---|---|---|
| A) `` `sequential_image_generation` … is not supported by the current model``（`seedream-5-0-pro`，端点 `ep-20260713101732-q5zvf`，image/asset） | 13 | 07-16 **06:21** | `08aa548`（07-16 **18:03**）：给 `"disabled"` 分支补 `supportsSequentialBatch &&` 守卫。根因是 **Seedream 5.0 Pro 连 `sequential_image_generation:"disabled"` 都不接受**，旧代码只要参考图 >1 张就发 | ✅ |
| B) `` content[N].image_url.url … the specified asset is not an image``（`seedance-2-0`，video/conversation） | 26 | 07-21 **07:45** | **B_252** / v1.0.0.34（07-21 **19:21**）按 `asset.kind` 路由 | ✅ |
| C) `` video total duration (seconds) … must be ≤ 15.2``（`seedance-2-0`/`-fast`） | 12 | 07-21 **05:57** | **B_232** / v1.0.0.34（同上）Int→Float + 统一 `validateReferenceTotalDuration` | ✅ |
| D) `gpt-5.4-image-2` 平台返回 HTML → `Unexpected token '<' … is not valid JSON` | 2（07-24、07-27） | 仍在发生 | ⚠️ 见下，**本次修** | ❌ |
| E) 无日志（07-09，已轮转） | 1 | 07-09 | 查不出 | ❌ |

⭐ **D 类是本次真正修掉的新 bug（两个）**：
1. `is not valid JSON` 被 `error-message.ts` 里 `/unsupported size|invalid option|invalid parameter|not valid/` 抢走 → 报「当前模型不支持这组参数，请换比例、分辨率或模型」，**用户按提示去改参数完全没用**（真因是平台返回 HTML 错误页）。已在该规则**之前**插入 `unexpected token '<'|is not valid json|unexpected end of json input|<!doctype html|<html` → 「平台服务临时异常（返回了非预期内容），请稍后重试。」
2. 同样的 `not valid` 让 `transient-error.ts` 的 `isPermanentError` 把它判成**永久失败** → 网关抖动本该服务端自动重连的却直接放弃。已在 `isPermanentError` **开头做例外先行 return false**，并在 `isTransientServerError` 里加同一批关键词 → 判为可重试。实测：`(B_401) …Unexpected token '<'…` → 「平台服务临时异常…」+ `transient=true`。

归档脚本新增 3 条规则 `seedream-pro-sequential-param` / `reference-slot-not-an-image` / `reference-video-total-duration`，实测 A/B/C 精准命中，D 与中文文案不误伤。**归档量预期 ~255 → ~306 条**，「当前模型不支持这组参数」54 → **3**。

⭐ **方法论沉淀（已写进 07 文档第三·B 节末）**：判断"是否真的修好了"不能只看"代码里现在有守卫"（守卫可能是后来加的），必须 `git log -S "<关键代码片段>" --date=iso` 拿到**修复 commit 的精确时间**，再和该根因**最后一次发生时间**对比。A/B/C 三类最后一次都在修复上线前、此后 7~12 天零复发 → 才敢归档。

### 【第 4 批】⭐ 排查并修复「请先登录后再使用模型。」17 条 —— 状态码错了，导致前端所有"未登录跳首页"保护失效

**数据**：17 条全部 `userId=NULL`、`image/conversation`、model 恒为默认 `seedream-4-5`、参考图 0 张，requestId 是我们前端生成的 `id_<base36时间>_<随机>`（**真实浏览器，不是爬虫**），时间是 **3~5 次连击**（07-17 07:26 五连、07-21 06:50 三连、07-25 三连…），北京时间都在白天。

**为什么"明明登录了"却说没登录**：登录 = 房卡（cookie）+ 前台记录（DB `Session` 行），服务器只认前台记录。本项目是**单会话策略** —— `createSession` 里 `session.deleteMany({ where: { userId } })`，**新设备登录会删掉该用户所有旧会话**。电脑上开着的工作台房卡还在、页面看着一切正常（头像/积分是加载时取的），但前台记录没了 → 点生成被拒。另两种：24h 未活动过期、账号停用。⭐ **单会话是有意设计（用户确认：多会话会导致两端同时生成等更多错误），不改。**

**真正的 bug（链条）**：
1. `assertUserCanUseCredits` 里 `if (!user) throw new Error("请先登录后再使用模型。")` —— 普通 Error
2. 掉进各 route 通用 catch → 编号 B_xxx → **返回 500** + `recordGenerationEvent(status:"failed")` 记红字
3. ⛔ 前端 5 处"未登录自动跳首页"的保护**只认 401** → 全部不触发
4. 用户只看到红字失败卡、没有任何登录引导 → 连点 3~5 次；后台被污染 17 条
5. `/api/image` 那句 `if (!user) return ...401` 写在 assert **后面**，永远执行不到

同样写法 **6 个 route**：`image`/`video`/`chat`/`agent-plan`/`conversation-memory`/`workflow-prompt-optimization/rewrite` → 所有模式都会中。

**修法（产品约定：不给任何提示，一操作就跳首页 —— 用户 2026-07-28 拍板）**：
- `src/lib/credits.ts` 新增唯一权威 `UNAUTHENTICATED_ERROR_MESSAGE`（"登录状态已失效，请重新登录后再试。"）/ `createUnauthenticatedError()` / **`isUnauthenticatedError()`**；assert 改抛带 `code:"UNAUTHENTICATED"` 的错误。
- 6 个 route 的 catch **第一句**统一判它 → 回 **401** 且**不记 GenerationEvent**（不是生成失败，不该进失败统计）。
- 新增唯一权威 `src/lib/session-expired-redirect.ts`：`handleSessionExpiredResponse()`（401 → `replace("/")`）+ 哨兵 `SESSION_EXPIRED_SILENT_ERROR`。
- **插在两处 `readJson` 开头**（`chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx`，是 **43 处调用的咽喉**）→ 对话流/工作流任何请求拿到 401 都直接跳首页，不用改 12 个 fetch 站点。
- `isAbortLikeError` 认哨兵 → 跳转瞬间不闪红字卡；chat-workbench 原有 4 处手写 401 跳转收敛成调共享函数。
- 归档规则 `session-expired-recorded-as-failure`（match `请先登录后再使用模型`；实测不误伤「积分不足…」和新文案）。
- ⚠️ **遗留分叉未处理**：`readJson` 两份的**错误文案构建方式不同**（`toUserErrorMessage` vs `getWorkflowApiErrorMessage` 会补 `errorCode` 前缀），本次只统一了 401 守卫，没合并整个函数（合并会改错误文案行为，风险高）。

归档量预期 **~306 → ~323 条**。`npx tsc --noEmit` 全绿。

### 【第 5 批】⭐ 排查「请求失败，请稍后再试。」33 条 —— 发现"第二个兜底桶"，全部归档（无代码改动）

**数据**：33 条全是 `image` + `provider=openrouter` + `openai/gpt-5.4-image-2`(20) / `-agent`(13)，日期只有 **07-24（13）、07-06（12）、07-09（8）**。

- **07-24 的 13 条**：日志里全是 `Insufficient credits` = OpenRouter 余额不足 → **现有 `provider-insufficient-credits` 规则已覆盖，不用加新规则**。
- **07-06 / 07-09 的 20 条**：日志里**一行都没有** —— 诊断日志文件最早一行是 `2026-07-10T19:56`（正式服 07-11 才从马来迁到腾讯云，旧日志没带过来）→ **永久不可追溯**。且确认**不是余额不足**：那两天 OpenRouter 图片成功 188 / 111 条（账户有钱），日志里 `Insufficient credits` 只出现在 07-21 与 07-24。

⭐⭐ **最重要的发现：有两个兜底桶，同一个根因会同时污染两个。**
`toUserErrorMessage(value, fallback = "请求失败，请稍后再试。")` 的 fallback 是**默认参数** —— 调用处显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 就落进「服务器繁忙」，不传就落进「请求失败」（gpt-image 走的 `getOpenRouterError`（`openrouter.ts:772`）属于后者）。所以**余额不足这一个根因：53 条进了"服务器繁忙"、13 条进了"请求失败"**。⛔ 以后排查任何一类，**两个桶都要查**。已写进 07 文档第一节和第三·D 节。

⭐ **另一个结构性事实**：`toUserErrorMessage` 在这条链上**被套了两层** —— 内层 `getOpenRouterError` 先把上游原文压成兜底文案（`图片生成失败：请求失败，请稍后再试。`），外层再处理时**原文已被吃掉**，任何规则都不可能再匹配。所以这个桶天生"从 DB 里绝对查不出根因"，只能靠诊断日志。**不用改代码**：诊断日志已经记了上游 body（这次 13 条就是靠它查出来的），缺的只是 07-10 之前那段历史；而新加的 402 规则在**内层**就命中，余额不足以后两个桶都不会再进。

**新增归档规则 `pre-diagnostics-log-unknowable`（用户 2026-07-28 拍板 B 方案）**：留着查不动的只会让人反复来查同一批，归档后「待排查」才真正代表**还有希望查的**。判定**三个条件必须同时成立**（别放宽）：① `createdAt < 2026-07-10`（`DIAGNOSTICS_LOG_START`）② 两个日志文件里一行都搜不到该 requestId ③ `failureReason` 命中 `GENERIC_FALLBACK_PATTERN`（服务器繁忙 / 请求失败）。
配套改动：`findMany` 的 select 补上 `createdAt`。

**正式服 dry-run 验证**（专门写脚本核对，未写库）：命中 **24 条** = 20 条「请求失败」+ 4 条「服务器繁忙」（07-05 2 / 07-06 13 / 07-09 9；模型 `gpt-5.4-image-2` 21 + `seedance-2-0` 3）；**07-10 之后的 221 条兜底桶事件一条都没碰**。归档后：「请求失败」33 → **0**，「服务器繁忙」再少 4 条。

### 【教训】同一根因常有多种上游措辞

以后每查一类，**必须先把该根因在正式服的全部措辞捞全再写正则**，别只按看到的那一条写。归一化去重命令已写进 07 文档第五节。

### 【第 1 批】供应商余额不足（OpenRouter 402）不再兜底成"服务器繁忙"

背景：正式服「服务器繁忙，请稍候再试.....」212 条里第二大类 = **OpenRouter 402 `Insufficient credits`（53 条）**，账户真没钱，但用户看到的是"服务器繁忙"→ 以为是我们抖动、反复重试白花时间，管理员也不知道要充值。

- **`src/lib/error-message.ts`（唯一入口，全模式生效）** 新增一条判定，**位置在限流/`quota` 规则之前**（否则会被 `429|quota` 那条抢走）：
  `402 | insufficient credits | insufficient_quota | insufficient balance | requires more credits | more credits, or fewer max_tokens | add more using | billing hard limit | exceeded your current quota | account balance | 余额不足`
  → **「提供商余额不足！请联系管理员充值。」**（`(B_xxx)` 前缀由既有 `withErrorCode` 自动带上，所以用户看到的是「(B_xxx) 提供商余额不足！请联系管理员充值。」）
- **`src/lib/transient-error.ts`** 的 `isPermanentError` 加同一批关键词 → 这类**不再被 `isTransientServerError` 判为可恢复**，服务端不再自动退避重试（以前会白烧几次）。
- **`scripts/archive-resolved-generation-failures.mjs`** 新增规则 `provider-insufficient-credits`（match 用文本特征 + `"status|statusCode|code": 402`，**故意不用裸 `\b402\b`**，因为它匹配的是整段日志 JSON，裸 402 会被 `"width":402` 之类误伤）。
- ⭐ **归档标准澄清（2026-07-28 用户口述，已写进 AGENTS.md 铁律 + 07 文档开头）**：**归档的对象本质是「服务器繁忙」这个兜底桶**（没被明确识别的错误全落进它，它是一堆无关根因的混合体）。判定只问"**这个根因还落在兜底桶里吗**"：①修好了→归档；②没修但**已映射成明确文案**→归档；③没查清/修不了、仍在桶里→留着亮；④**映射出去后新形成的那条明确原因本身→不归档**（修不了就该一直亮着，且已不污染兜底桶）。所以本次归档的理由不是"我们修了余额问题"，而是"**它已经从兜底桶里被拆出去了**"；而新出现的「提供商余额不足！请联系管理员充值。」以后不归档。
- 归档量预期：~93 → **~146 条**（82 尺寸不合规 + 53 余额不足 + 11 凭证失效 + 若干"没复用旧证"）；「服务器繁忙」212 → **~66**。
- 本地验证（tsx 直跑三种真实原文）：`(B_312) …Insufficient credits…` / `402 …requires more credits…` / `…exceeded your current quota…` 三条全部输出「提供商余额不足！请联系管理员充值。」且 `isTransientServerError=false`。

## 2026-07-27（第六次会话）线上资产远程 url 排查 + 红字失败原因深挖并修 4 处 + 参考图尺寸发送前拦截 + 失败原因归档机制 —— ⚠️ **全部本地完成、未部署**（部署后是 v1.0.0.47）；`npx tsc --noEmit` 全绿；**有 1 个新 Prisma 迁移**

> 详细的排查方法论、已修/待修清单、归档规则全部整理进新文档 **`07-red-error-triage-and-archive.md`**（排查线上报错必读，别重复踩坑）。

### ① 正式服「资产是否都下载到本地」排查 —— 用户拍板 C（先不管）
- 8181 条 MediaAsset：本地化 7560（92.4%）、**远程 url 621**（其中已归档 524、**未归档仍显示在资产库 97**：96 图 + 1 视频）。`posterUrl`/`thumbnailUrl` 远程的 0 条。
- 远程记录时间全部落在 **2026-06-05 ~ 06-21**，之后一条没有；本地化最新到 07-27 → **现在的落盘链路是好的，不会再产生**。
- 抽样 HEAD 全部失效：火山 tos 签名 **403**、OpenRouter **401** → **救不回来**（无法重新下载）。
- 受影响用户：`lixxix50@gmail.com` 64 条、`3676478@qq.com` 24 条、`312876953@qq.com` 1 条，其余 8 条零散。
- 给了 A（归档隐藏）/B（加失效角标）/C（不管）三个方案，**用户选 C：先不管了**。

### ② ⭐⭐ 红字「服务器繁忙，请稍候再试.....」212 条深挖 → 找到真实根因并修 4 处
**关键认知（写进 07 文档）**：`failureReason` 存的是给用户看的文案，"服务器繁忙"是 `toUserErrorMessage` 没匹配上时的兜底 → **从它本身查不出任何东西**，真实原因只能去 `.runtime/*-diagnostics-log.jsonl` 按 requestId/taskId 捞原文，而且**要看最终抛出的那条**（早期的 `create-non-ok` body 会把"送审阶段被拒"误判成"风控拦截"，本次踩过）。

查出的真实构成：参考图**尺寸/比例不合规 82**（Height 56 / Aspect 23 / Width 3）、**OpenRouter 余额不足 53**、轮询到 failed 但原因没落盘 40、审核**凭证失效 11**、`empty image result` 7、gpt 中文明文拒绝 4、DB 事务超时 2。

修了 4 处：
1. **补日志（根子）**：`video-provider-poll-success` / `create-success` 两处以前**只记 `hasError: true` 布尔**，上游 code/message 全丢 → 那 40 条永远查不出。新增唯一实现 `summarizeVideoTaskError()`（`openrouter-video.ts`），4 个日志点都带上 code + message（截断 600），并给 `OpenRouterVideoTask.error` 类型补 `code` 字段。
2. **⭐ `!triggered` 真 bug**：`autoReviewBytePlusVideoReferences` 原来用 `triggered`（只有"新办卡"才算干活）判断送审是否有效。**当所有参考图早就过审、只走"复用旧证"分支时 triggered 恒为 false → 已经拼好的 `asset://` 引用被整份丢掉、直接放弃重试 → 用户白白看到"服务器繁忙"**。改成看 `convertedCount`（换到证就必须拿去重试）。
3. **已过审的图第二次不再弹蓝字**（用户当初的设计）：给送审函数加 `reuseOnly` 模式（纯查库、不上传不等待）。被拦后先只用现成通行证**当场无感重试**；只有确实有素材要新送审才返回 `{status:"reviewing"}`（那才该弹「检测到真人图片，需要审核」）。创建抛错、创建返回 error 两条路径都加了。
4. **死卡自愈**：平台报 `The specified asset asset-xxx is not found` 时，以前会拿着死凭证一直失败。新增 `isBytePlusAssetNotFoundError` / `getBytePlusMissingAssetIds` / `clearStaleBytePlusAssetCards`，**自动清空库里失效的 bytePlusAssetId/GroupId/Status** 并纳入"可恢复错误"→ 重新送审拿新证记住。
5. **错误文案不再骗人**（`error-message.ts` 唯一入口，放最前面避免被 timeout/network 抢走）：尺寸不合规 / 平台读取参考图失败 / 凭证失效 三类各给真话。

### ③ 参考图尺寸/比例**发送前**拦截 + 黑底提示（用户明确要求）
- 新增唯一权威 `src/lib/video-reference-image-rules.ts`：常量（宽高 **300–6000px**、宽高比 **0.4–2.5**）+ `validateVideoReferenceImageDimensions/…Images/…BeforeSend` + 浏览器端 `measureImageDimensions`。**量不到宽高时不拦**（宁可让平台判，也不能因为读不到就把用户挡死）。
- 文案带上是哪张图、当前多大、要求多少，例：`参考图「xxx」太窄或太长了（1200×200，宽高比 6.00）。生视频要求宽高比在 0.4–2.5 之间（如 16:9、9:16、1:1、4:3），请换一张比例更常规的图。`
- 三处接上同一规则：**对话流** `sendMessage`（→ `showInputTip()` 黑底提示 + 中止发送，不扣积分不发请求）、**工作流** `runVideoNode`（抛同样文案）、**服务端** `api/video/route`（从 `MediaAsset.width/height` 读尺寸，不合规直接 400 + 同文案 + 记 `video-route-reference-image-size-rejected` 日志，兜住 Agent/资产库/任何入口）。
- **只对 BytePlus 视频模型生效**（这是 BytePlus 的硬规则，不能拿它拦 kling/veo）；`asset://` 引用跳过。

### ④ ⭐ 后台「失败原因」归档机制（用户要求：排查掉一批就自动归档、划掉但保留文字）
- **新迁移 `20260727154203_generation_event_resolved`**：`GenerationEvent` 加 `resolvedAt` / `resolvedNote` + 索引 `(status, resolvedAt)`。
- `admin-overview.ts`：`failureTop` 只统计 `resolvedAt IS NULL`；新增 `failureResolvedTop`（按「原因 + resolvedNote」分组）；`moderationBreakdown` 同样只统计未归档。
- `admin-overview-2.tsx`：`RankTable` 加 `strikethrough` 参数；「失败原因」卡片下方新增「已排查并修复（已归档，不计入上面数量）」区块 → **灰色 `line-through` 划掉、文字保留**，小字显示归档说明。
- **`B_xxx` 编号计数器与归档完全无关，继续自增。**
- 新增 `scripts/archive-resolved-generation-failures.mjs`（dry-run 默认 / `--apply` / `--undo`）：**按诊断日志里的真实原文**（不是 failureReason）判定归档，规则表 `RESOLVED_RULES` 是唯一入口，目前 3 条（参考图尺寸、凭证失效、`!triggered` bug；后者用事件序列特征判定）。本地 dry-run：39 条待归档、命中 0（本地无线上日志，正常）。
- **不归档的**：OpenRouter 余额不足这种运营问题（真没钱）必须一直亮着提醒充值。

### 本次会话踩的坑（记住）
- 别拿早期 provider 报错 body 当最终根因（会把 82 次"尺寸不合规"误判成"真人风控"）。
- 视频轮询失败事件**没有 requestId**，要先拿 `taskId` 再捞日志。
- 一次性脚本必须 `docker cp` 进容器 `/app` 跑（容器里才有 `@prisma/client`）；跑完删掉。
- `prisma generate` 在本地会因 dev server 占着 `query_engine-windows.dll` 报 EPERM → 先停 dev server 再 generate 再重启。
- ⚠️ 我曾用 `Remove-Item tmp\audit-*.js` 误删了 4 个**已被 git 跟踪**的历史排查脚本，已 `git checkout` 还原。清理临时文件前先看 `git status`。

## 2026-07-27（第五次会话）资产库视频卡时长角标 + 缩略图 hover 放大 + 时长/封面全量回填 —— ✅ **已部署测试服与正式服 `v1.0.0.46`**（四方同步）；`npx tsc --noEmit` 全绿；**无 Prisma 迁移**

### ① 资产库右侧视频卡左上角显示时长
- 新增 `src/lib/media-duration-format.ts` = **时长文案唯一权威实现**（`formatMediaClockTime` mm:ss / `formatMediaPaddedSeconds` / `parseChineseDurationSeconds`）。`audio-waveform-player.tsx` 原来的本地 `formatAudioTime`/`padSeconds` 收敛到它（音频显示零变化）。
- 新增 `src/components/media-duration-badge.tsx`（`MediaDurationBadge`）：位置/大小/字号/圆角与音频卡左上角时间显示完全一致；因为要叠在任意封面上，**用户拍板改成深底白字**（`bg-black/45` + white，而不是音频那套 `bg-black/12` + `#333`，浅底深字在深色封面上看不清）。以后别处要时长角标一律复用它。
- `chat-workbench.tsx` 视频卡挂上它；取值口径统一走新 helper `getAssetDurationSeconds()`：优先服务端 `durationSeconds`，老数据兜底解析参数卡「N秒」。
- ⭐ **顺手收敛的分叉**：`workspace-state/route.ts` 和 `media-assets/route.ts` 两处调用 `resolveAssetPreviewMeta` 时都硬写 `durationSeconds: null`（明显是漏的，`toAssetPreviewMeta` 本来就设计成由这列算时长）。现两处都 `select` 了 `MediaAsset.durationSeconds`，既传进 previewMeta 也在资产 payload 里直出 `durationSeconds`（`AssetItem` 新增该字段）。**副作用（已告知用户）：以前预览页参数卡没时长文案的上传视频，现在会显示「XX秒」。**

### ② 图片/视频缩略图 hover 放大反馈
- `globals.css` 新增统一工具类 **`.media-thumb-zoom`**：容器内 `img`/`video` 悬停 `scale(1.06)`、`transition .26s ease-out`；带 `@media (hover:hover)`（触屏不放大）和 `prefers-reduced-motion` 保护。容器必须自带 `overflow-hidden`。
- 按用户选择**只套在资产库右侧网格**（图片 + 视频卡的缩略图按钮）。对话流/工作流/@引用弹窗**没动**。以后别处要同样反馈直接加这个类，禁止再各写一套。

### ③ ⭐⭐ 踩坑记录：Turbopack 的 globals.css 改动不重编（"hover 没反应"的真凶）
- 现象：改完 `globals.css` 本地怎么试都没效果，但同批 JS 改动（时长角标）**是生效的** → 误判成代码写错。
- 真因：dev 的 CSS 产物 `.next/dev/static/chunks/src_app_globals_css_*.css` **停在几小时前的旧版本**，改 css 不触发重编、`touch layout.tsx` 也没用；JS 的 HMR 正常，所以只有 CSS 部分"看起来没实现"。
- 解法：**删掉整个 `.next` 再重启 dev**（只重启进程不够）。验证手段：`document.styleSheets` 里搜类名 / 直接 `page.request.get` 那个 css chunk 看有没有新规则。**以后改 globals.css 没反应先怀疑这个，别怀疑代码。**

### ④ 视频时长/封面全量回填（本地 + 测试服 + 正式服都跑了）
- 新增 `scripts/backfill-media-asset-durations.mjs`（默认 dry-run，`--apply` 才写）：给 `MediaAsset.durationSeconds` 为空的视频/音频补真实时长。项目只装了 `ffmpeg-static` 没有 ffprobe → **用 `ffmpeg -i` 解析 stderr 里的 `Duration: HH:MM:SS.xx`**（`-i` 无输出文件必然非 0 退出，从 `error.stderr` 里取）。只处理 `/generated/` 下的本机文件，远程签名过期的历史脏数据跳过。
- 为什么要它：`durationSeconds` 这列是后来才开始写的，早期生成/上传的视频全为空 → 时长角标显示不出来（用户反馈"有些视频左上角没有时间"）。
- 结果：**本地 28 条全补齐**（剩 8 条无时长的都是 `archivedAt` 归档记录，资产库不显示）；**测试服 5 条**；**正式服 2059 条**（候选 2060，1 条远程 URL 跳过），0 失败。
- 同时按用户交代把封面也补了：`scripts/backfill-uploaded-video-posters.mjs` 在**正式服新建 29 个 `.poster.jpg`**（测试服 0 条，本来就全有）。⭐ **新记忆**：脚本在服务器上现生成的媒体文件**不会自动同步阿里**（app 只在上传/生成时同步），要补一次 rsync：只传 `*.poster.jpg`、增量不删除，`/opt/flashmuse/data/generated/` → `root@101.37.129.164:/var/www/flashmuse-static/generated/`。已跑完。
- 复跑 dry-run 确认收敛：durations 只剩 1 条远程 URL、posters 只剩 2 条生成视频（不在上传封面范围），均为预期。

### 部署记录（测试服 + 正式服 v1.0.0.46）
- 测试服：`bump-version.mjs` v45→v46 → 26 个改动文件 tgz scp → `tar -xzf -C /opt/flashmuse-staging/app` → `up -d --build staging-app` → `sync-ali-test.sh` → sed `PUBLISHED_APP_VERSION: "v1.0.0.46"` + `force-recreate` → `x-app-version: v1.0.0.46`、`101.37.129.164:8080` 200、`staging-static` 200。
- 正式服（用户明确要求同步）：备份 `/opt/flashmuse/app-backups/20260727-210717-presync-v1.0.0.46` → 整份 rsync staging→prod（**不再 bump**，原样带 v46）→ `up -d --build flashmuse-app`（"No pending migrations"）→ `/tmp/syncali.sh` 同步阿里正式镜像 → sed `PUBLISHED_APP_VERSION: "v1.0.0.46"` + `force-recreate` → 四域名 main/api/ali/static 全 **200**、`x-app-version: v1.0.0.46`、公网首页版本号 v1.0.0.46。
- ⚠️ 中间验证提醒：`up --build` 之后 `x-app-version` 仍是**上一版**是**正常的**（该头发的是运行时 env `PUBLISHED_APP_VERSION`，第 5 步才改），此时看 HTML 里的版本号判断新代码是否上去。

## 2026-07-27（第四次会话·调研，未写任何代码）视频「高清/超分」方案调查 → 记为备忘 M020，等有免费方案再做

用浏览器实读官网/官方文档（不是凭记忆、不是本地旧文档）。结论与全部数据已整理进 `06-memo-tasks.md` 的 **M020**，此处只记要点：

- **BytePlus 没有视频超分/放大/画质增强接口**：模型目录只有 Seed / Seedream / Seedance / Seed Speech / Omnihuman / DreamActor；ModelArk API 参考也没有独立 upscale 端点。
- ⭐ **新情报：Seedance 2.0 已支持 `resolution: "4k"`**（仅 `seedance-2-0`；Fast/Mini 连 1080p 都不支持）。4K = 10-bit **H.265(HEVC)**，官方明示部分播放器/浏览器不能直接播；**$0.78/秒**（1080p $0.37 / 720p $0.15 / 480p $0.07）。**用户交代 4K 档先不接。** 我们 `models.ts` 目前也只到 1080p。
- 「用 Seedance 重生成 4K」**不是超分**（内容会变、贵约 10 倍），不该叫"高清"。
- **真·超分只能走第三方**，最好的是 **Topaz Video AI**（Replicate 与 fal 是同一引擎 Proteus v4 + Apollo v8）：Replicate →4K/30fps **$0.373/5s**、fal >1080p **$0.08/s**（约为 Seedance 4K 重生成的 1/10）。备选 Runway upscale-v1 / Bria（8K、全授权数据）/ Crystal（人脸向）。
- **开源最强 = ByteDance 自家 `SeedVR2`（Apache-2.0，ICLR2026）**，但官方要求 1×H100-80G 才 720p、**1080p/2K 需 4×H100-80G** → 我们无 GPU，自建不可行。
- **用户决定：先不做，记为备忘 M020，"如果没有免费版以后再做"。** 选型倾向与接入要点都写在 M020 里。

## 2026-07-27（第四次会话·追加）工作流上传/截图后资产库右侧列表不刷新根治 —— ✅ **已部署测试服 `v1.0.0.45`**（正式服仍 v43）

- **现象（测试服实测）**：工作流里视频截图后，回资产库「上传图片」，**左侧数量 +1 但右侧列表不出现**，必须刷新页面。
- **根因**：左侧计数来自服务端 `assetCounts`（某次拉取就更新了）；右侧列表是分页缓存，`loadWorkspaceAssets` 里 `loadedAssetFilters[filter] && hasFilterAssets` 命中就直接 return 不重拉。而工作流的上传/截图是画布组件**自己直接 POST `/api/media-assets`**、**从不通知父级** → 父级 `assets` state 里根本没有这条。对照：工作流**生成**的图/视频有 `onGeneratedMedia` 回调（本地插入 + force 刷新），所以一直是即时出现的。
- **修法**：画布新增 prop `onUploadedAsset?: ({ mediaType })`（`workflow-tldraw-canvas.tsx` + `-inner.tsx`），`handleUploadNodeFile` 的**图片（含视频截图，在入库 POST 的 `.then` 里调，保证已提交）/视频/音频**三个分支成功后都调它（文档不调，文档永不显示）；`chat-workbench` 侧按 mediaType 映射筛选（image→`conversation_uploads`、video→`upload_videos`、audio→`upload_audios`）并 `loadWorkspaceAssets(true, filter, 0, "auto")` 强制刷新列表+计数。
- **顺带修好**：工作流里拖拽/粘贴上传的图片、视频、音频以前同样有"要刷新才出现"的问题，现一并解决。

## 2026-07-27（第四次会话）工作流视频截图（首/尾/当前帧进画布）+ 上传视频缺封面根治 + 上传类归类全站统一 + 用户中心生成数量现算 + 积分页工作流图标 —— ✅ **已部署测试服 `v1.0.0.44`**（正式服仍 v43）；`npx tsc --noEmit` 全绿；**无 Prisma 迁移**

> 部署内容 = 本次 4 项 + 前两批（07-27 第二、三次会话）积压的所有改动，一并上了测试服。正式服未动。

### ① 工作流视频节点快捷菜单新增「视频截图 ▾」（悬停展开：截取首帧 / 尾帧 / 当前帧）
- 截出的 jpg **直接作为图片节点出现在源视频右侧**（不连线），走统一上传链路落盘。
- 截帧收敛为唯一实现 `getWorkflowVideoFrameJpeg()` + `getWorkflowVideoFrameLabel()`（`workflow-tldraw-canvas-inner.tsx:1927`），**右键菜单「导出首/尾/当前帧」（下载）与它共用**；`exportWorkflowVideoFrame` 变成薄壳。
- `addUploadedNode` 新增第三参 `rightOfNode`（放右侧、不连线；原 `targetNodeId` 是放左侧+自动连线，语义不同保持不变）；`handleUploadNodeFile` 新增可选第 5 参 `imageTitle`（默认「上传图片」）。
- 节点标题显示「视频截图 + 名字」：新增常量 `WORKFLOW_VIDEO_FRAME_NODE_TITLE` + `isWorkflowUploadLikeTitle()`，把原来散在 4 处的 `title.startsWith("上传")` / `=== "上传图片"` 判断统一走它（头图标 / 参数标签只显尺寸 / 标题拼法 / 右键菜单非生成节点判定）。
- 命名：同一帧重复截 = 内容哈希命中去重 → 复用同一文件同一名；不同帧 → `xxx-当前帧`、`xxx-当前帧_2`…（`upload-name.ts` 的 `allocateUniqueName`）。
- 归类：**按上传处理**（无模型无提示词，本质就是上传图片），进「上传的资产 · 上传图片」。曾一度试过归到 `workflow_images/generated`，因 `isUploadedMediaAsset` 还会按 url 在 `/upload_image/` 判上传而显示不出来，且属性上确实更像上传 → 用户拍板算上传，已回退。

### ② ⭐ 上传视频"没有封面"根治（去重继承了历史无封面记录）
- 根因：`createUploadedVideoPoster`（上传即时生成封面）是后加的功能，早于它上传的视频库里 `posterUrl` 为空；重新上传同一文件时命中内容哈希去重、早返回，把空 posterUrl 一起继承回来。
- 修法：`upload-file/route.ts` 新增 `ensureDedupPosterUrl()`（:73），命中去重 + 是视频 + 无 posterUrl → 现场生成封面 + 写回 `MediaAsset.posterUrl` + 同步阿里；两个去重早返回点（multipart / JSON base64）共用它。已有封面直接返回、零开销。
- 新增一次性脚本 `scripts/backfill-uploaded-video-posters.mjs`（默认 dry-run，`--apply` 才写）：给历史上传视频补 `.poster.jpg` + 回填 posterUrl，规则与 `createUploadedVideoPoster` 一致（同目录同名 `.poster.jpg`），跳过 `/videos/` 下的生成视频。
  - **本地已 `--apply`**：6 条历史上传视频全部补齐、0 失败。
  - **测试服跑过 dry-run = 0 条**（staging 18 个 video 资产 posterUrl 全非空，无需回填）。正式服部署时同样先 dry-run 再决定。

### ③ ⭐ 资产库「上传类」不再分对话流/工作流（读取侧统一）
- `workspace-state/route.ts` 新增 `UPLOAD_IMAGE_CATEGORIES = ["conversation_uploads", "workflow_upload_images", "workflow_uploads"]`（与早已存在的 `UPLOAD_VIDEO_CATEGORIES`/`UPLOAD_AUDIO_CATEGORIES` 同一套写法——**图片是唯一漏做不分流的那个**）。筛选页 + 计数都走它 → 三处上传（对话流/资产库/工作流）+ 工作流视频截图，全部显示在 **上传的资产 · 上传图片**；上传类不再计入"工作流/对话流"分组计数。
- 写入侧顺手修掉既有分叉：`persistWorkflowUploadNodeAsset` 里工作流上传的**图片**原来硬写成 `conversation_uploads`（对话流上传），现按真实来源写 `workflow_upload_images`。因读取已统一，**老数据不用 backfill 也照样显示**。
- 前端 `isAssetInFilter` 的 `conversation_uploads` 判定本来就只看"是不是上传"、不看流，无需改。
- ⚠️ 由此上一批（第二次会话）原计划的"`currentCategory` 从 `conversation_upload_*` 纠正为 `workflow_upload_*`"**backfill 不再是必须**（显示已统一），留着不做也无影响。

### ④ 用户中心「生成图片 X 张 / 生成视频 Y 段」显示 0 修复
- 根因：`User.generatedImageCount/generatedVideoCount` 两个列**从来没有任何代码给它们 +1**（历史遗留），真实用户恒为 0；后台早就用"现算 + Math.max"绕过，只有用户中心还在直接读列。
- 修法：`src/lib/user-profile.ts` 新增唯一权威 `getUserGeneratedMediaCounts(userId)`（MediaAsset 按 mediaType groupBy，**只数生成的**：`sourceKind` 不含 `upload`；用户删掉的仍计入，归档不计）+ `getUserProfileWithGeneratedCounts()`（与老列取 `Math.max`，口径与后台一致）。
- `/api/auth/me`、`/api/user-profile` 的 **GET 和 PUT** 都改走它。PUT 也必须带数量——否则保存资料后前端 `applyCurrentUserProfile` 整份覆盖，数字被刷回 0（隐藏坑，已堵）。
- 本地实测：`12424740@qq.com` = 632 张 / 25 段；`lookxun@163.com` = 6 张 / 0 段（老列都是 0）。

### ⑤ 「我的积分」页积分来源列：工作流用工作流图标
- `/api/credits/me` 新增来源 `"workflow"` + `isWorkflowLedger()`（优先 `workspaceKind === "workflow"`，老数据兜底 `metadata.creditSource` 以 `workflow_` 开头）。分组 key `workflow:${workspaceId}` → **每个工作流一行**（与每个对话一行对称），标题仍是工作流名。提示词工具/资产库生成等特殊来源分组不变。
- 前端 `UserCreditSource` 加 `"workflow"`，图标用 **`RiGitPullRequestLine`**（= 侧栏「工作流模式」同一个图标）；不加 label，所以那列仍显示工作流名称。

### 部署记录（测试服 v1.0.0.44）
- `node scripts/bump-version.mjs` → v43→v44；tgz 19 个改动文件 scp → `sudo tar -xzf -C /opt/flashmuse-staging/app` → `docker compose up -d --build staging-app`（"No pending migrations"）→ `sync-ali-test.sh` → sed `PUBLISHED_APP_VERSION: "v1.0.0.44"` + `force-recreate`。
- 验证：`x-app-version: v1.0.0.44`、首页 HTML 里版本号 v1.0.0.44、`127.0.0.1:5001` 200、`http://101.37.129.164:8080/` 200、`https://staging-static.venusface.com/` 200。
- ⚠️ 本批功能**均未实机点测**（用户习惯：叫测才测）。建议至少验：工作流视频截图三项、资产库上传图片里能看到截图、用户中心数量、积分页工作流图标、上传视频封面。


## 2026-07-27（第三次会话）提示词视频缩略图悬停封面 + 参考视频时长真实上限实测(15.2s)与三处统一 + 工作流视频快捷菜单（快捷编辑/下载）—— ⚠️ 仅本地，未 commit 未部署；`npx tsc --noEmit` 全绿。基线仍 `v1.0.0.43`

> 本批**未加 Prisma 迁移**、**无需数据 backfill**。承接上一批（第二次会话）那批未部署改动，一起部署即可。

### ① 对话流提示词里的视频小缩略图：鼠标悬停显示封面（对齐图片的"悬停看原图"）
- 新增 `HoverVideoPreview`（`chat-workbench.tsx:1284`）：与图片的 `HoverImagePreview` 同款悬停放大交互，放大处显示视频封面（有 `posterUrl` 用它，否则 `<video>` 首帧 `#t=0.1` 兜底），用 `onLoadedMetadata` 拿真实宽高做自适应定位。
- `MediaFileReference` 加 `posterUrl?`，`getUploadedMediaReferences` 从上传文件带出 posterUrl。
- `ReferencedTextContent` 里视频内联缩略图改为用 `HoverVideoPreview` 包裹（播放按钮角标保留）。

### ② ⭐ 实测 BytePlus Seedance 2.0 参考视频真实时长上限 = **15.2 秒**
- 在**测试服**用容器内 `ffmpeg-static` 造 15.00~15.92s 精确样片 → 同步到阿里测试镜像取得公网 URL → 直接 POST `/contents/generations/tasks` 打三个模型端点，从长到短试（被拒不计费）。
- API 报错原文写死：`video duration (seconds) ... must be less than or equal to 15.2 for model dreamina-seedance-2-0 / -fast / -mini in r2v`。**三个模型完全一致 = 15.2 秒（含）**。15.21s 起被拒；15.10/15.00 通过。
- 附带发现另一条约束：`video pixel count ≥ 409600`（与时长无关，我的 640×360 样片触发过它）。测试临时文件已全部清理。
- 另查正式服库：`videoDuration='15秒'` 且有探测时长的记录，**三个模型全部是 15.1 秒**（min=max=avg=15.1、distinct=1）。→ **自家生成的 15 秒视频（15.1s）拿去当参考视频是安全的（15.1 < 15.2）**。
- ⭐ **可复用的探测方法（以后要测任何 BytePlus 上限，照这个来，别再摸索）**：
  1. 容器内没有系统 ffmpeg，但有 `ffmpeg-static`：`/app/node_modules/ffmpeg-static/ffmpeg`（**没有 ffprobe**，量时长用 `ffmpeg -i 文件 2>&1 | grep "Duration:"`）。
  2. 造样片写成 `.sh` scp 到腾讯 `/tmp` → `sed -i 's/\r$//'` → `docker cp` 进容器 → `docker exec bash`。样片放 `/app/public/generated/_durtest`（= 宿主 `/opt/flashmuse-staging/data/generated/_durtest`）。
  3. 要公网 URL 给 BytePlus 下载：`rsync` 到阿里测试镜像 `/var/www/flashmuse-static-test/generated/`，再用 `https://staging-static.venusface.com/generated/...` 访问（用 `/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519` 这把 key，**必须 sudo**）。
  4. 探测脚本写成 `.js` 进容器 `node` 跑，API key 从 `/app/.env.local` 读 `BYTEPLUS_API_KEY`/`ARK_API_KEY`；端点 `https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`；模型名用 `dreamina-seedance-2-0-260128` / `-fast-260128` / `-mini-260615`（`system-settings.ts` 的 `BYTEPLUS_ENDPOINT_MODEL_NAMES` 有映射）。
  5. **省钱要点**：**从超限往下试**——被拒（400 InvalidParameter）不产生任何费用，第一个被接受的才会真生成，接受了立刻 `DELETE /contents/generations/tasks/{id}` 取消。本次全程都是 400，**一分钱没花**。
  6. PowerShell 内联嵌套引号会被吃掉 → 所有脚本一律写文件 scp，别拼内联命令（本次反复踩到）。

### ③ 时长限制三处分叉收敛（原来 client 15.35 / server 16.01，全错）
- `media-upload-validation.ts` 成为唯一权威：新增 `export const MEDIA_DURATION_EPSILON_SECONDS = 0.2`（唯一定义）+ `export function validateReferenceMediaDurationRange()`（单条时长校验唯一实现）。对外仍宣传 `maxSeconds=15`，容差 0.2 → **有效上限正好 15.2 = 实测硬上限**。
- 服务端 `validateMediaUploadMetadata` 的 `< 1.9 || > 16.01` → 改成 `< 2 - EPS || > 15 + EPS`。
- `chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx`：**各自删掉本地 `MEDIA_DURATION_EPSILON_SECONDS = 0.35` 和重复的 `validateMediaDuration`/`validateWorkflowMediaDuration`**，改为 import 共享实现（用别名保持调用点零改动）。
- ⭐ **顺带修掉一个历史 bug**：`upload-rules.ts` 的 `validateReferenceTotalDuration` 原来严格 `> 15` 就拦 → 我们自己生成的 15 秒视频（15.1s）**当参考视频会被自己拦死**。现在同样带 `+ MEDIA_DURATION_EPSILON_SECONDS`（=15.2）。这也是视频快捷编辑能对 15 秒视频生效的前提。

### ④ 工作流画布：视频节点加快捷菜单（本批只做「快捷编辑」+「下载」，高清按用户交代先等）
- 快捷菜单开放给视频：`showImageQuickMenu` 改名 `showMediaQuickMenu`，条件加 `node.kind === "video"`；`canQuickEdit` 同步放开（Tab 快捷键对视频也生效）。图片专属的**高清/去背景/橡皮**在视频上隐藏，橡皮浮层额外用 `!isVideoQuickMenuNode` 二次兜住。
- **视频快捷编辑** `createVideoEditNode`：新建视频节点，**参数以源视频的真实尺寸/真实时长为准**，**源视频当参考视频**（`referenceVideosOverride`）+ 用户提示词，**强制融合模式**（`videoReferenceMode: "reference"`，只有融合模式支持参考视频）。
  - ⭐ **参数一律从真实 `videoDimensions` / `durationSeconds` 反推，而不是照抄节点上的设置**。原因：**上传视频节点的 `resolution`/`duration` 是建节点时的默认值（720p / 8秒），不是真实值**——照抄会把一个上传的 1920×1080 / 12 秒视频错当成 720p / 8 秒。新增两个助手（对齐图片侧同名思路）：`closestResolutionForVideoDimensions()`（在模型支持的档里挑总像素最接近的一档）、`closestWorkflowVideoDurationLabel()`（真实秒数 → 最接近的「N秒」档）。比例用 `closestWorkflowRatioLabel()`，**模型没有完全一致的比例时取最接近的一档**。对生成视频结果不变（它的真实尺寸/时长本就等于其设置）。
  - ⭐ **分辨率优先决定模型，不是无脑依次**：先以档位最全的 `seedance-2-0` 为基准按真实尺寸算出该用哪一档，再据此过滤候选链 → **需要 1080p 时只有 2.0 支持，链条只剩 2.0，直接用 2.0、不再依次尝试**；480p/720p 时三个都支持，才依次 **Mini → Fast → 2.0**。
  - 把源视频**精确时长**（`durationSeconds`，如 15.1）传进 `referenceVideoDurations`，让总时长校验拿到真实值。
- **统一链路（铁律#3）**：没有另写一套生视频逻辑，而是给唯一的 `runVideoNode` 加可选第二参数 `{ modelCandidates, referenceVideosOverride, referenceVideoDurations, forceReferenceMode }`，把原来的单次执行体包进候选链循环。**不传 options 时行为与改造前完全一致**（attempts=[单模型]、同样的 requestId 生成、同样的校验与轮询）。候选链换模型时会 `updateNode` 同步节点显示的 model/比例/分辨率（等待卡标签跟随实际尝试的模型，与图片候选链一致）。
- **计费正确性**：每次尝试都生成**新的 `requestId`**、`creditSource` 仍是 `workflow_video_generation`，失败的尝试不计费、成功只计一次，不会重复扣分（与图片编辑候选链同机制）。
- **下载收敛**：图片快捷菜单原来**自己内联写了一份下载**（用 `getStaticMediaUrl` + 自己拼文件名），与右键菜单用的共享 `downloadWorkflowNode()`（`:1898`，本就同时支持 image/video、文件名走 `getWorkflowDownloadFileName`）是两份分叉。现在**快捷菜单图片/视频统一走共享那份**，删掉内联实现。

### ⑤ 后台：新增「工作流 · 视频编辑功能」表格 + 开关联通
- `system-settings.ts` 新增 `VIDEO_EDIT_FUNCTION_MODEL_CHAIN`（Mini → Fast → 2.0）+ `VIDEO_EDIT_FUNCTION_KEYS = ["video_quick"]`，并并入 `DEFAULT_EDIT_MODEL_TOGGLES`（默认全开）。**新增视频编辑模型只改这张表 + 前端那张，别再复制第三份。**
- `admin-system-settings-panel.tsx` 新增 `VIDEO_EDIT_MODEL_CHAIN` + `videoEditFunctionRows`，渲染「工作流 · 视频编辑功能」表（快捷编辑=候选链三个开关；下载=纯前端无模型）。
- 前端新增 `getVideoEditCandidates("video_quick", toggles)`（与图片的 `getEditCandidates` 同规则：按开关过滤、保持顺序、全关回落完整链），`createVideoEditNode` 改用它 → **后台开关真正生效**。
- 存取链路无需额外改动：后台 API 是 `{...current.editModelToggles, ...body}` 合并（新键自动落地）；`/api/model-availability` 已返回 `editModelToggles`，`chat-workbench` 已透传给 `WorkflowCanvas`。
- **样式（⚠️ 走过一次弯路，已回退）**：我一度把两张编辑功能表的**列头行**（功能/规则说明/使用模型）底色从 `bg-[#fafafa]` 改成 `bg-white`，**这是理解错了、已全部改回灰色**。用户要的是：**标题栏灰 + 列头行灰 + 内容行白**（= 和大表一致）。列头行本来就该是灰的，别再动它。

### ⑥ ⚠️ 本批唯一未完成项：编辑功能表「内容行看起来不是白色」
- 用户反馈：图片编辑功能表的**内容行看起来不是白的**，而大表的内容行是白的，要求统一成白色。
- **但从代码看内容行本来就是白的**，我没找到那个灰：三个 `<section>` class 完全一样（都 `bg-white`，`:390` 大表 / `:455` 图片编辑 / `:493` 视频编辑），内容行本身也都**没设任何背景**、直接继承白色（大表 `:388` 与图片编辑 `:467` 的 class 结构一模一样，都只有 `border-b border-[#f2f2f2]`）。
- **我的判断（未经用户确认）**：用户看到的灰其实是「使用模型」列里那三个模型标签的**药丸底色 `bg-[#f4f6fb]`**（很浅的蓝灰）。它在编辑表里是 `w-full`，会把整个 470px 列铺满 → 看着像一整条灰带；大表里药丸是 `360px + 中间 70px 空隙`，周围留白多，所以看着"白底上放几个小标签"。
- ⚠️ **关键坑**：**大表也用同一个 `#f4f6fb`**（`OpenRouterModelTag:202`、`BytePlusModelTag:216/:228`，空位占位 `:200/:213`）。所以**只改编辑表的药丸会让两边更不一致**，要改就得三张表一起改。
- **已向用户提出二选一、等回复**：(A) 药丸底改白+加浅边框，**三张表一起改**；(B) 只改编辑表、大表保持。**下一个 AI 请先拿到用户选择再动手，不要自己猜。**
- **另一个卡点**：本地后台我进不去，所以没法自己截图核对。`.env` 里 `ADMIN_EMAILS=lookxun@163.com` 确实是管理员白名单，但**这个账号在本地库里的密码不是 `dragonstar`**（试过，进不去；测试服那套账号密码只对测试服有效）。要么找用户要本地后台密码，要么让用户贴截图。

### 注意
- 本批**只做了本地改动 + 测试服的一次性 API 探测**，没有部署、没有改任何服务器状态（测试服产生的样片与脚本已清理）。
- `runVideoNode` 是生视频主路径（对话流不走它，但工作流所有视频生成都走），已保证无 options 时行为不变；部署后建议顺手验一次「工作流普通生视频」仍正常。
- **本批全部功能都还没实机验证过**（用户交代"叫你测试才测试"，且视频快捷编辑一点就真花钱生视频）。只有 `npx tsc --noEmit` 全绿。

---

## 2026-07-27（第二次会话）视频封面/播放按钮全平台统一 + 上传视频归类分叉根治（图层无封面 & 资产库重复）—— ⚠️ 仅本地，未 commit 未部署；本地 dev 已验证通过，`npx tsc --noEmit` 全绿。基线仍 `v1.0.0.43`

> 用户新交代不变：**叫你测试才测试**；本批默认只本地不部署。下一个 AI 若要部署走 03 的 测试服→正式服 流程（会自增版本号）。本批**未加 Prisma 迁移**，但**改了一条线上数据的分类需要 backfill**（见文末"部署注意"）。

**开场小插曲（本地 dev 登录失败）**：现象=所有 `/api/*` 返回 404、页面 `/` 正常 200，登录接口 404。根因=`next dev` 的 turbopack 路由清单/缓存坏了（把 `route.ts` 当页面路由匹配到 `/_not-found`）。**解法=杀掉 `next dev` 进程树 + 删 `.next` + 重启 `npm run dev`**。（记住：以后"所有接口 404/登录失败"多半是这个，重启即好。dev 由 `start-project.bat`→`scripts/start-project.ps1` 起，端口 3000。）

### 需求
用户要：① 工作流"图层"面板里上传视频的小缩略图要显示**封面**（上传视频也要有封面）；② **所有视频小缩略图中间要有播放按钮**表示是视频；③ **全平台统一**。随后发现两个连带 bug：**图层里上传视频只显示图标没封面**、**资产库里同一个上传视频显示成两条相同的**。

### 真正根因（一个分叉引发两 bug）
`/api/upload-file/route.ts` 把资产分类**算了两遍且分叉**（违反"能统一一律统一"）：`buildMediaAssetRecord` 内部用权威 `classifyAsset` → 正确得 `workflow_upload_videos` 写进 `MediaAsset`；但同一路由又用**本地 `getFileCategory` 忽略 `flow`**，把 `UserAssetState.currentCategory` 误写成 `conversation_upload_videos`。而**客户端资产库/图层实际只读 `/api/workspace-state`（走 `UserAssetState.currentCategory`）**，于是这条工作流上传视频被当成 conversation：
- 图层：被排除出 `workflowAssets`（`chat-workbench.tsx:15822` 过滤 `isWorkflowAsset`）→ 图层 `WorkflowAssetLayerRow` 拿不到 DB 的 `posterUrl` → 显示 `RiVideoLine` 图标。
- 资产库重复：工作流侧"查重"用 `normalizeMediaUrlForMatch(url)===X && isWorkflowAsset`，因它被标 conversation 查不到权威记录 A → 又插一条 `createClientId()` 的客户端副本 B（**DB 其实只有一条**，B 仅内存、刷新即消，但用户当会话看到两条）。

### 已做（本对话，全部本地）
1. **统一播放按钮组件**：新增 `src/components/video-play-badge.tsx` `VideoPlayBadge`（5 档 size：xs/sm/md/lg/xl，`bg-black/42`+`RiPlayLargeFill`+`backdrop-blur`）。把散在 6 处的重复 overlay 收敛到它：对话流资产卡(`chat-workbench.tsx:6358` lg)、内联视频(`6842` xl)、资产导入弹窗(`15944` md)、@引用弹窗(`asset-mention-picker.tsx:119` sm)、上传缩略图(`video-upload-thumbnail.tsx` 原 CSS 三角形→sm 徽标)、后台媒体缩略图(`admin-credits-panel.tsx` 新增 xs)。删掉各处重复 markup 及 chat-workbench 里不再用的 `RiPlayLargeFill` import。**全平台视频小图现在同一个播放按钮。**
2. **图层面板视频缩略图加封面+播放按钮**：`WorkflowAssetLayerRow`（`workflow-tldraw-canvas-inner.tsx:5113`）缩略图 `<span>` 加 `relative`，视频且有 previewUrl 时叠 `<VideoPlayBadge size="xs">`；`<img>` 加 `onError`→`setPreviewFailed` 回退图标（防老的无封面上传视频显示破图）。
3. **根因修复：上传归类不再分叉**：`upload-file/route.ts` 的 `getFileCategory(mediaType, flow)` 改为走权威 `classifyAsset({origin:"upload",flow,mediaType}).initialCategory`（import `classifyAsset`/`AssetMediaType`）。→ 新上传的工作流视频 `currentCategory=workflow_upload_videos`，不再误入 conversation，也就不再产生资产库重复副本。
4. **`workspace-state/route.ts` 对齐 `media-assets`**：`isWorkflowCategory` 补 `|| item.currentCategory.startsWith("workflow_upload_")`（media-assets:148 早就这么写，workspace-state 漏了）。→ 工作流上传资产 `librarySource="workflow"` → 进 `workflowAssets` → 图层直接拿到 DB 真实 `posterUrl` 显示封面。（注：上传视频仍留在"上传视频"tab，因该 tab 过滤 `uploaded && isVideoAsset` 不看 librarySource；不会跑去"工作流视频"tab，那 tab 要 `!uploaded`。）
5. **上传视频 posterUrl 前端链路补全（新上传的防御）**：`uploadWorkflowFile`（`workflow-tldraw-canvas-inner.tsx:734`）接收/返回服务端 `posterUrl`；`precheckUploadedFileDedup`（`upload-content-hash.ts`）+ 服务端 dedup（GET+两处 POST，`upload-file/route.ts`）都补带 `posterUrl`；视频上传节点 `data` 写 `posterUrl: uploadedVideo.posterUrl`（`:3322`）→ 新上传即便资产还没加载进 `assets`，图层也能从 node.data 拿到封面。
6. **数据修复（本地 DB）**：写一次性脚本把历史误分类的 `UserAssetState.currentCategory` 从 `conversation_upload_*` 纠正为 `workflow_upload_*`（依据 `mediaAsset.sourceKind` 以 `workflow_upload_` 开头判定）。本地只命中 1 条（就是用户那条"7110"）。脚本已删。

### 走过的弯路（重要教训，别重犯）
- 我一度给客户端 `getLocalVideoPosterUrl`（`chat-workbench.tsx:2170` + `admin-credits-panel.tsx` 那份重复实现）加"支持 `/files/` 上传视频→硬拼同目录 `.poster.jpg`"。**这是错的、已回退**：老上传视频没有 poster 文件，硬拼的 URL 404 → 资产库里**其它上传视频封面全变破图**（它们本来靠 `<video>` 首帧兜底显示）。真正让图层出封面的是上面第 4 条（归类修复让资产进 `workflowAssets`、直接用 DB 的 `posterUrl`），**不需要任何 URL 推算**。→ 教训：poster 是否存在无法客户端同步判断，别凭 URL 规则臆造 poster 地址。
- `getLocalVideoPosterUrl` 只认 `/generated/.../videos/`（生成视频），上传视频在 `/files/`——保持不认（回退后现状），靠 DB `posterUrl` 或 `<video>` 首帧兜底。

### 验证（Playwright 本地，测试号 `12424740@qq.com`/`dragonstar` = 本地 ID_779117）
- 资产库"上传视频"tab：7110 只剩**一条**，7 个视频全显示封面+播放按钮。
- 工作流_01 图层面板：7110 缩略图显示**封面+播放按钮**（poster thumbnail 已加载 256px、badge 存在）。

### ⭐ 部署注意（下一个 AI 若要部署这批）
- **代码**：走 03 测试服→正式服流程（会 bump 版本）。改动集中在 `upload-file`/`workspace-state`/`chat-workbench`/`workflow-tldraw-canvas-inner`/`asset-mention-picker`/`video-upload-thumbnail`/`admin-credits-panel` + 新增 `video-play-badge.tsx`；**无 Prisma 迁移**。
- **线上数据 backfill（必须做，否则正式服/测试服历史"工作流上传视频"仍无封面/仍可能重复）**：部署后在对应库跑一次"把 `UserAssetState.currentCategory` 里 `mediaAsset.sourceKind` 以 `workflow_upload_` 开头、但 currentCategory 为 `conversation_upload_*`/`conversation_uploads` 的记录，按 sourceKind 纠正成对应 `workflow_upload_*`"。写成 `.js` 放进容器 `/app` 跑（遵守 00-README：一次性 node 脚本进容器跑、别用 PowerShell 内联）。**只影响历史工作流上传媒体**，新上传因代码已修不再产生错分类。

---

## 2026-07-27（视频卡下载僵尸根治 + 恢复乐观显示 + 工作流生成动画）—— ✅ 已整份部署正式服 `v1.0.0.43` + push GitHub。四方同步（正式=测试=本地=GitHub=v1.0.0.43），四域名 200，无 Prisma 迁移

**起因**：用户报 ID_686996（`312876953@qq.com`）一条 seedance-2-0 视频生了 40 多分钟才显示失败、无错误码。查正式服 DB+诊断日志定位：火山其实 5 分钟就出片（远程 volces mp4），但**本地下载 `saveRemoteAsset` 的 fetch 没超时、跨境下载假死**（只有 `media-save-download-start attempt=1`、之后无 saved/failed/expired），`processMediaSaveJob` 的 `inFlight` 锁又只在 `finally` 释放→假死永不释放→卡死回收(30min stale)/24h 过期判失败全被这把锁挡死→job 永远 running=僵尸；前端自己超时显示"失败"但后端从没判失败（所以无错误码）。

**① 可靠性层（根治僵尸）**
- `local-assets.ts saveRemoteAsset`：加 `REMOTE_DOWNLOAD_TIMEOUT_MS=3min` AbortController，覆盖 fetch/arrayBuffer/curl 兜底（curl 加 `--max-time`）；到点 abort→抛错→上层按失败重试。
- `video-poster.ts`：封面(×2)/尺寸探测 ffmpeg 各加 `timeout:60_000`。
- `media-save-queue.ts`：`STALE_DOWNLOADING_MS` 30min→8min；`inFlight` 从 `Set` 改 `Map<id,上锁时刻>`，持锁超 8min 视为假死可强夺重跑；`enqueueRemoteAssetSave` 也会踢"downloading 超 8min"的假死任务（原来它只踢 pending/failed，回收逻辑等于没人调）。→ 四层防线：3min 下载超时 / 60s ffmpeg / 8min 锁自愈 / 24h 远程过期。

**② 恢复乐观显示（用户最初设计，07-08/07-14 为修资产库 bug 时被改成"必须先下本地才交付"，牺牲了展示速度）**
- `generation-jobs.ts runVideoJob`：拿到"浏览器可直接播"的远程地址（非 OpenRouter 需密钥）就写 `extraJson.preview.videoUrl`（写一次），job 保持 running；本地存好才转 succeeded、写资产库（**只本地 url、带全参数，零改动**）。
- 对话流 `chat-workbench.tsx`：Message 加 `videoPreviewUrls`(展示专用，不进 videos/资产库)+`videoSavedFlashAt`；`applyVideoPreviewToMessage`（幂等、无变化返回原 state 防 effect 死循环）；reconcile + createAndPollVideo 见 running+preview 即展示；成功 append 本地时撤一条 preview+打 flash；`InlineVideoResult` 左上角"转圈+资产保存中..."/成功"✓保存成功"(2s 后 1s 渐隐)。
- 工作流 `workflow-tldraw-canvas-inner.tsx`：node.data 加 `videoPreviewUrl`/`videoSavedFlashAt`；pollVideoNode/applyVideoNodeJobResult 同理；`WorkflowVideoSaveBadge` 同款角标；预览阶段 `WorkflowInlineVideo` 跳过 onGeneratedMedia（远程绝不进库）。
- OpenRouter 需密钥视频：不做预览、保持等本地（按用户定）。只做视频、图片维持现状。

**③ 工作流生成动画（对齐对话流/资产库）**
- `chat-workbench.tsx` 侧栏：工作流历史条目（收起弹窗+展开两处）在 `node.data.isRunning` 时右侧显示 `HaloPulseIndicator`（盖住⋯菜单）；"工作流模式"入口在 `activePanel!=="workflow" && hasAnyWorkflowGenerating` 时右侧显示动画（与对话/资产入口对称）。数据经 `updateWorkflowCanvas` 实时同步进 `workflowItems`。

**部署**：本地 tsc 全绿→测试服 v42→v43 验证→整份 rsync 测试服→正式服（备份 `20260725044123-presync-v43`）→重建（No pending migrations）→同步阿里正式镜像→四域名 200→PUBLISHED_APP_VERSION v41→v43 force-recreate→commit `58b38eb` push。**那条正式服僵尸 job（requestId `d049d7ad...`）按用户交代未清。**

## 2026-07-26（工作流重试秒跳失败卡根治 + gpt版安全改写 + 橡皮防双击 + 新版本提示条整套 + 提示条右侧居中 + 工作流菜单空白关闭）—— ✅ 已整份部署正式服 `v1.0.0.41` + push GitHub。四方同步（正式=测试=本地=GitHub=v1.0.0.41）

**背景**：接上一批（07-22~25 编辑菜单批，仍未部署，基线 v1.0.0.36）。本对话先修 bug + 加功能，分多次部署测试服（v37→v41），最后用户拍板整份部署正式服 + push。全程 `npx tsc --noEmit` 全绿，无 Prisma 迁移。

### 已做（本对话，按时间）

1. **工作流图片/视频节点「重试成功却秒跳失败卡→多次重试多图覆盖」根治**（`workflow-tldraw-canvas-inner.tsx`）。根因：后端 `getActiveGenerationJobs`（`generation-jobs.ts:386`）会返回近 6h 内的**旧 failed 任务**；用户点重试后节点清 error、切等待卡，`reconcileImageJobsFromBackend`(4424)/`reconcileVideoJobsFromBackend`(4481) 被 `pendingRecoverySignature` 触发重跑，按 `workflowNodeId` 匹配到**上一次旧失败任务**，又把正在转的等待卡打回失败卡 → 用户以为失败反复点，多次重试都成功→多张图互相覆盖（旧的进被删节点）。之前只有「AI改写重试」路径有 `optimizingImageNodesRef` 保护，普通重试/视频重试没有。**修法**：每次重试都会立即写入新 `imageRequestId`/`videoRequestId`，失败分支加守卫——`if (node.data.isRunning && node.data.<x>RequestId && node.data.<x>RequestId !== job.requestId) continue;`（旧请求的过期失败结果直接跳过）。不影响刷新恢复（那时节点无 requestId，照常显示失败）。

2. **gpt版 gpt5.4image2 版权红字进入安全改写页**（`workflow-tldraw-canvas-inner.tsx:1607`）。根因：`isWorkflowGptImageSafetyFailure` 把 model 写死 `"openai/gpt-5.4-image-2"`（只认直连新接口），GPT版老接口内部 id 是 `...-agent` 被挡外。两接口后端红字文本本就一致。**修法**（贯彻"能统一一律统一"）：改用 `models.ts` 已有 `isGptImage2Model(m) || isGptImage2AgentModel(m)`（新增 import `isGptImage2AgentModel`）。仅影响工作流失败卡是否显示「AI改写重试」（对话流/资产库/Agent 没这套 UI）。注：这套安全改写**目前只在工作流**，对话流没有。

3. **橡皮工具「立即使用」防双击**（`workflow-tldraw-canvas-inner.tsx` 约 2597–2630）。根因：`onClick` 里源图 `img.onload` 是异步，关弹窗 `setEraserOpen(false)` 写在 onload 回调里 → 加载慢时弹窗/按钮还在，用户再点一次 → 生成两张（且第一次 onload 结尾清了涂抹层，第二张无紫蒙版=出原图）。**修法**：点第一下就**同步**上锁 `eraserSubmittingRef`(新增)+ 立刻关弹窗清状态（按钮当场消失），异步合成用已捕获的 canvas 引用（React 卸载后位图仍在），onload/onerror 结束解锁。

4. **新版本提示条整套**（新增 `src/middleware.ts` + `src/components/version-update-notifier.tsx`，挂进 `src/app/layout.tsx`）。方案：middleware 给所有 `/api/*` 响应带 `x-app-version` 头；前端组件拦截自己发出的 `window.fetch`（**搭在已有请求流量上，不专门轮询、不开长连接**），读头与自己 bundle 打死的 `APP_VERSION` 数值比较，**服务端更高才弹**顶部提示条（白底 360×60、黑色「刷新」按钮=时间戳强制刷新绕 HTML 缓存 `location.replace(?_v=Date.now())`、放大的「×」=忽略当前版本、下方灰字「或 CTRL+F5(蓝) 强制刷新即可加载新版本！」）。
   - ⭐⭐ **部署时机门控（关键，解决"部署中途就弹→点刷新白屏"）**：middleware 发的版本 = **运行时环境变量 `PUBLISHED_APP_VERSION`**（非直接 APP_VERSION，因新容器一起来就是新版但阿里静态还没同步完）。部署顺序：①`up --build`（PUBLISHED 仍上一版/空→不发新版头→不误弹）→ ②同步阿里静态 → ③sed 改 compose `PUBLISHED_APP_VERSION` 为新版 + `docker compose up -d --force-recreate <app>`（此刻才发新版头，静态已就绪）。**保证"提示条弹出=静态就绪=刷新必正常"**。本地开发（非 production）无该 env 时 middleware 回退 APP_VERSION（保留本地即时可见）。测试服 + 正式服 compose 都已加 `PUBLISHED_APP_VERSION: ""` 环境变量行（在 DATABASE_URL 行后），部署脚本见 `03-deploy-and-servers.md` 更新后的流程。

5. **提示条只在右侧内容区左右居中**（`version-update-notifier.tsx`）：动态量 `.flashmuse-sidebar` 实际宽度（展开 262/收起 80/隐藏 0，ResizeObserver+resize+1s 兜底轮询），`left: calc(50% + 菜单宽/2)`，不算左侧主菜单。无 sidebar 的页面 = 整屏居中。

6. **用户信息菜单：工作流里点任意空白也能关**（`chat-workbench.tsx` 约 10566）。根因：原来靠 `window` 冒泡阶段监听 click 关菜单，但工作流 tldraw 画布在冒泡阶段 `stopPropagation` 吞掉 click → 收不到 → 关不掉（对话流没画布所以正常）。**修法**：改**捕获阶段** `addEventListener("click", closeMenu, true)` + 新增 `userMenuRef`/`userMenuButtonRef` 判断点击是否在菜单/头像按钮内（内则不关）。监听器只在菜单打开时存在、单次 click 判断、不吞事件 → **不影响工作流性能/行为**。三处（对话流/工作流/资产库）共用同一份逻辑，一处改全生效。

### 部署（测试服 v37→v41 多次；正式服一次整份对齐 v41）
- 打包踩坑：首个 tgz 含 `public/`（home-assets 图片）达 150MB、跨境 scp 反复断 → 之后一律 `--exclude=./public`（本批没动 public，服务器已有），降到 ~26MB。scp 加 `-o ServerAliveInterval=15 -o ServerAliveCountMax=8` 抗断。
- **正式服部署**（本次）：备份 `/opt/flashmuse/app-backups/20260724-215621-presync-v41` → rsync staging→prod（不再 bump，带 v41）→ 加 compose `PUBLISHED_APP_VERSION` 行 → `up -d --build`（无 pending 迁移）→ `/tmp/syncali.sh`（阿里正式镜像）→ 发布 `PUBLISHED_APP_VERSION=v1.0.0.41 + force-recreate` → `/tmp/health.sh` 四域名 200、公网 main = v1.0.0.41。
- 本批带上正式服的完整内容 = 07-22~25 编辑菜单整套（去背景/橡皮/多模型候选链/下载/后台编辑开关，**首次上正式服**，含新依赖 `@imgly/background-removal-node` + 脚本 `scripts/remove-background-worker.mjs`）+ 本对话 6 项。commit+push GitHub。

## 2026-07-25（去背景等待卡尺寸修复 + 橡皮工具全套根治 + 菜单精简+下载原图 + 后台编辑功能设置/模型三档开关）—— ⚠️ 仅本地，未 commit 未部署；⭐ 下一个 AI 要直接部署（先测试服再正式服）

**背景**：接 2026-07-24 那批继续。全程本地 `npx tsc --noEmit` 全绿。基线仍 `v1.0.0.36` / `dd37a78`（GitHub/正式服/测试服都还在这，本地累积了 07-22~07-25 一大批未提交改动）。**用户新交代两条：① 以后"叫你测试才测试"，用户会自己测很多东西，不要每次自动跑 Playwright；② 这批要求下一个 AI 直接部署服务器（走 03 的 测试服→正式服 流程）。**

### 已做（本对话）

1. **去背景「等待卡尺寸不对」根治**：`generateImageForNode`（`workflow-tldraw-canvas-inner.tsx` 约 3971 / 3992）发起时无条件 `visualSize: undefined`，把 `createImageEditNode` 刚锁好的源图显示尺寸清掉了 → 等待卡回落默认 16:9；结果卡因 `applyImageNodeResult` 用捕获的旧 node 恢复了 visualSize 所以正常，导致"只有第2步等待卡尺寸错"。修法：初始 `updateNode` 对 `node.data.transparentImage` 节点**保留 visualSize**（与 `applyImageNodeResult:3922` 同条件）。→ 原图→等待卡→结果卡三步尺寸一致。

2. **橡皮工具（局部消除）全套根治**——之前根本没做成，实测只是整图重绘/换人：
   - **查明本质**：两家（OpenRouter Image API `/api/v1/images`、BytePlus `/images/generations`）**都没有 mask/inpaint 蒙版通道**，只有"参考图+提示词"的整图 img2img。seedream 这类是重绘模型，涂个紫圈让它"移除"→它会重画整张（换人/皮肤变白）。Lovart/LibTV 登录墙+Cloudflare 进不去、抓不到它们接口，但业界这类"消除"靠 mask-inpaint 或指令式编辑模型（nano-banana/Gemini flash image）。
   - **模型**：橡皮从 `seedream-5-0-pro` 换成 **`google/gemini-3.1-flash-image-preview`**（指令式局部编辑、擅长"改指定处、其余保留"）。
   - **实心灰蒙版是关键**：用户涂的仍是**半透明紫**（canvas 存纯不透明色 `rgb(168,85,247)` + CSS `opacity-50` 显示；避免重叠叠加变深），但**导出给模型的参考图里，用涂抹区当蒙版把该区填成完全不透明中性灰 `#808080`**（`source-in` 合成），彻底盖住底下主体 → 模型看不见原物、才肯"当没东西补背景"。提示词改成"移除灰色遮挡区域内物体并自然补全、不保留被遮挡物"。→ 实测涂整个人也能删干净并补花园背景，其余不变。
   - **橡皮尺寸/比例贴源图**：用 `getWorkflowNodeNaturalSize(node)` 取源图尺寸（不要用 display 图，会被压成小尺寸误判 1K），按每个候选模型算最接近的 ratio+resolution。
   - 半透明修复涉及：arc/stroke 改纯色、canvas 加 `opacity-50`、导出蒙版填灰。

3. **高清 + 橡皮 = 多模型候选链（首选失败自动降级）**：新增模块常量 `EDIT_MODEL_CANDIDATES = [gemini-3.1-flash-image-preview, gemini-3-pro-image-preview, byteplus:conversation-image.seedream-4-5]`。`createImageEditNode` 加 `modelCandidates?/highDef?` 选项：按序尝试，前一个抛错自动换下一个（换模型时同步节点显示的 model/比例/分辨率），**三个都失败才显示失败卡**。高清=highDef(4K)、橡皮=贴源图尺寸。

4. **快捷菜单精简**：删掉 编辑元素 / 编辑文字 / 多角度 / 移动对象 四个按钮（用户以后要加别的）。菜单现只剩 快捷编辑 / 高清 / 去背景 / 橡皮工具 + 下载。（`createImageElementSplitNodes` 及相关 import 变成未引用但保留，无害。）

5. **下载按钮实现**：菜单最后的下载键 = 下载**原图**到本地（`getStaticMediaUrl(url) ?? url`，**不要用 `getImageDisplayUrl`——那是缩略图**，最初错用缩略图已修）。fetch→blob→a[download]，文件名跟随资产名补 .png，失败兜底 `window.open`。

6. **后台「工作流·图片编辑功能」设置（放进模型开关页新板块）**：
   - 只读**规则说明表**：快捷编辑/高清/去背景/橡皮 各一行写清逻辑与尺寸策略。
   - **高清+橡皮各一组"首选/次选/三选"模型开关**，关掉首选自动用次选三选、全关回落完整链。
   - 全链路：新增 settings 字段 `editModelToggles: Record<"<func>:<modelId>", boolean>`（默认全 true，`func` ∈ {hd, eraser}），存 `.env.local` 的 `EDIT_MODEL_TOGGLES`（`system-settings.ts`：`AdminSystemSettings` 字段 + `EDIT_FUNCTION_MODEL_CHAIN`/`EDIT_FUNCTION_KEYS`/`DEFAULT_EDIT_MODEL_TOGGLES` + getter/updater）→ `/admin/api/system-settings` 合并式读写 → `/api/model-availability` 下发 → `chat-workbench` 存 state 传 `editModelToggles` 给 `WorkflowCanvas` → 前端 `getEditCandidates(func, toggles)` 按开关过滤 `EDIT_MODEL_CANDIDATES`（保序，全关回落完整链）。前端候选链顺序 = system-settings 的 `EDIT_FUNCTION_MODEL_CHAIN` = admin 面板 `EDIT_MODEL_CHAIN`，三处必须一致。

### 本对话改动文件（都未 commit）
- `src/components/workflow-tldraw-canvas-inner.tsx`（去背景 visualSize 保留、橡皮换 Gemini+实心灰蒙版+半透明显示、`EDIT_MODEL_CANDIDATES`/`getEditCandidates`、`createImageEditNode` 候选链+highDef、菜单删4键、下载原图、`editModelToggles` 传入 runtime + 高清/橡皮按钮用 getEditCandidates；`WorkflowCanvasProps` 加 `editModelToggles`）
- `src/components/workflow-tldraw-canvas.tsx`（wrapper props 加 `editModelToggles`）
- `src/components/chat-workbench.tsx`（`editModelToggles` state + 从 `/api/model-availability` 读 + 传给 WorkflowCanvas）
- `src/lib/system-settings.ts`（`editModelToggles` 字段 + 常量 + get/update 持久化）
- `src/app/api/model-availability/route.ts`（下发 `editModelToggles`）
- `src/app/admin/api/system-settings/route.ts`（合并式接收 `editModelToggles`）
- `src/app/admin/admin-system-settings-panel.tsx`（编辑功能规则表 + 三档开关 UI/保存）

### ⚠️ 下一个 AI（重点）
- **直接部署**：这批（含 07-22~07-25 全部本地改动）走 03 的部署流程——**先测试服（`node scripts/bump-version.mjs` 版本+1）→ 验证 → 再原样同步正式服**。注意 07-22 那批新增依赖 `@imgly/background-removal-node` + `scripts/remove-background-worker.mjs` 要一并带上部署（接手环境先 `npm install`）。
- **测试习惯**：用户会自己测，**别每次自动开 Playwright**，等用户说"测试"再测。
- 未做/待定：编辑类定价（去背景/橡皮本地或云成本差异是否调价，待用户定）；去背景资产库 model 标签是否清（待用户定）；候选链"失败自动降级"只在真有模型报错时触发，本地只验证过首选成功路径。

## 2026-07-24（快捷编辑输入框样式统一 + 全平台弹窗层级统一 + 高清换 Gemini + 去背景显示/尺寸/参数收尾）—— ⚠️ 仍在 2026-07-23 那批之上继续，仅本地，未 commit 未部署

**背景**：接 2026-07-23 那批继续。本对话都是在已有编辑类功能上的**打磨/修正**，无新功能。全程本地 `npx tsc --noEmit` 全绿，仅本地未 commit 未部署。基线仍 `v1.0.0.36` / `dd37a78`。

### 已做

1. **快捷编辑输入框样式对齐工作流其它输入框**（`workflow-tldraw-canvas-inner.tsx` 约 2415-2453 那个 `quickEditOpen` 浮层）：
   - 容器改磨砂玻璃质感（`border-2 border-[#f1f2f2] bg-white/78 backdrop-blur-[18px]` + focus 态白边/阴影），底框圆角 `rounded-[22px]`→`rounded-[16px]`。
   - 发送按钮统一成和生成按钮一致（`h-9 w-9 rounded-[10px] bg-[#111111]`，disabled 变灰）。
   - textarea 加 class **`workflow-prompt-textarea`**，字号/行高由 `globals.css:115` 那条全局 `font-size:14px!important; line-height:24px!important` 统一控制 → 和图片/视频节点输入框完全一致；以后要整体调大只改 globals.css 一处。（中途一度加到 16/18px，用户最终要求"统一成节点输入框大小"=14px。）

2. **全平台弹窗层级统一**（用户规则：用户中心这类弹窗永远最上层、黑遮罩在其下、其它内容都在遮罩下）：
   - 根因：这类居中弹窗遮罩原是 `z-50`，但工作流画布里的工具栏菜单/提示/右键菜单/快捷编辑框是 `z-[9999]~z-[10000]`，所以在工作流里打开用户中心，工作流 UI 会盖在弹窗上。
   - 改法：把主端全部全屏居中弹窗遮罩 `z-50`→**`z-[11000]`**（高于一切页面内浮层）。涉及 `chat-workbench.tsx`（用户中心 / 生图弹窗 / 资产预览 / 3 个确认框，共 6 处）、`app/page.tsx`（登录面板）、`admin` 三面板（积分/用户/记录的详情弹窗+加载弹窗，共 8 处）。
   - 保持不动：工作流内部资产导入（`z-[10050]`）、删除确认（`z-[10002]`）本就在工作流浮层之上、彼此不冲突；admin-credits 那个无黑底的隐形 popover 关闭遮罩也没动。
   - ⚠️ 踩坑：改 admin 三文件时一度用 PowerShell `Set-Content -Encoding utf8` 批量替换，把中文全变乱码（铁律明确禁过），已 `git checkout` 回滚、全部改用 edit 工具重做。**再次强调：改任何含中文的源码只用 edit 工具。**

3. **高清模型 Seedream 4.5 → Gemini 3.1 Flash**（用户实测 Seedream 4.5 不听话、会改内容）：
   - 高清按钮 `createImageEditNode(node, { model: "google/gemini-3.1-flash-image-preview", resolution:"4K", ratioFromSourceImage:true })`。其它不变（4K、比例贴合原图、上传图取最接近比例）。用户实测效果不错。
   - Gemini 3.1 Flash 是 `models.ts:88` 的正式前端图片模型，支持 4K。⚠️ `createImageEditNode` 只在该 model 属于**当前启用的 imageModels** 时才用它，否则静默回落源模型——如发现高清没用 Gemini，去 admin 确认它已启用。

4. **去背景显示收尾**（用户报"去背景不是真透明、只是变灰"）：
   - 真因不是抠图坏了，而是**显示容器底色写死灰 `#e6e6e6`**（`ImageDisplayCard`）：透明 PNG 透出这层灰 → 看着像变灰。服务端抠图链路本身是对的（真 alpha）。
   - 改：`ImageDisplayCard` 图片容器底色改为——**去背景/抠图产出的透明图透明、其它生图仍灰底占位**（远程 url 慢加载期要灰底）。判定用**"创建时标记 + 运行时真实 alpha 检测"兼用**：
     - 新增 `WorkflowNodeData.transparentImage`，`createImageEditNode` 里 `bgRemove||transparent` 时置 true（即时透明、无灰闪）。
     - 新增 `useImageHasAlpha(url)` + `detectImageHasAlpha` + `imageAlphaCache`（模块级缓存）：只对**同源本地 `/generated` 相对路径**图片做 canvas 采样（≤64×64、透明像素>8 判透明），远程 http/blob/data 一律不检测（保持灰底）。各入口(腾讯/阿里)都用相对 `/generated` 同源检测、不会被 CDN 跨域污染。→ **自愈本次更新前已存在的去背景图**（它们没标记，靠检测恢复透明）。
     - 容器底色 = `transparentImage || hasAlpha ? "transparent" : "#e6e6e6"`。
   - （中途试过棋盘格底，用户否了——他要纯透明，"移动图片和其它图叠加就能看出是不是透明"。）

5. **去背景参数/尺寸收尾**（用户："去背景不调模型，参数不该有模型；尺寸该和原图一样；等待/生成/失败三卡同图尺寸必须一致"）：
   - `createImageEditNode` 里 `bgRemove` 节点的 `node.data.model/ratio/resolution` 全置 `undefined`（节点头只剩尺寸；仍传个 model 给 API，服务端 bgRemove 分支忽略）。
   - 三卡尺寸一致 = 用**源节点当前实际显示尺寸** `getWorkflowNodeVisualSize(sourceNode)` 作 `visualSize`（尊重源图被缩放过的情况），且 `applyImageNodeResult` 对 `transparentImage` 节点**保留 visualSize**（普通生图仍清空回落自然尺寸）。这样等待卡(无图走 visualSize)=生成卡(有图 clamp 回 visualSize)=失败卡，都=源图显示尺寸。

### 本对话改动文件（都在 2026-07-23 那批之上，均未 commit）
- `src/components/workflow-tldraw-canvas-inner.tsx`（快捷编辑框样式、`transparentImage` 字段、`useImageHasAlpha`/`detectImageHasAlpha`/`imageAlphaCache`、`ImageDisplayCard` 底色、`createImageEditNode` 高清换 Gemini + bgRemove 清参数/锁 visualSize、`applyImageNodeResult` 保留 visualSize）
- `src/components/chat-workbench.tsx`（6 处弹窗 `z-50`→`z-[11000]`）
- `src/app/page.tsx`（登录面板 `z-[11000]`）
- `src/app/admin/admin-credits-panel.tsx`、`admin-users-panel.tsx`、`admin-records-panel.tsx`（弹窗 `z-[11000]`，共 8 处）

### ⚠️ 下一个 AI 注意 / 未做
- 用户指定的**编辑文字 / 多角度 / 移动对象**三个按钮仍未做（见 2026-07-23 条目，`workflow-tldraw-canvas-inner.tsx:2398-2400` 目前是无 onClick 的占位按钮）。
- 去背景生成的**资产进资产库**时，`onGeneratedMedia`/`applyImageNodeResult` 那条仍带着计算出的 `input.model`（类型强制 ModelName），所以资产库预览里可能仍显示模型标签。工作流节点本身已干净。用户问过是否也清掉资产那条的 model，**尚未定**。
- 去背景尺寸一致的边界情况（源图特殊 clamp）若仍有偏差，让用户报"源图显示尺寸 vs 等待卡尺寸"具体差值再精调。

## 2026-07-23（编辑类五功能：透明抠图根治 + 快捷编辑/高清重做 + 轮询不刷新根治 + 错误中文透出）—— ⚠️ 仅本地，未 commit 未部署

**背景**：接上一批（2026-07-22）本地开发的"编辑类快捷菜单"。本对话把去背景/编辑元素/橡皮三个未跑通的功能测通并根治，重做了快捷编辑/高清，并修了两个真 bug。全程本地 dev + Playwright 实测，`npx tsc --noEmit` 全绿。**未 commit、未部署**。

### 关键认知（务必记住，别再走弯路）
- **两家出图 provider 在本环境都产不出真透明 PNG**：
  - `openai/gpt-5.4-image-2` 经 OpenRouter → **拒绝** `background:"transparent"`（上游 400，只接受 `auto`/`opaque`；`auto` 出的图 `channels:3` 无 alpha）。2026-07-22 交接里"gpt 直连支持 transparent"的假设是**错的**。
  - BytePlus Seedream 5.0 Pro → 能出 `.png` 但 `channels:3` 无 alpha（背景没被抠掉）。
  - 结论：靠"模型 prompt 出透明底"这条路走不通 → **去背景/编辑元素透明主体层改为服务端本地抠图**（方案 A，用户拍板）。

### 已做（全部本地实测通过）

1. **去背景 = 本地抠图**（`@imgly/background-removal-node`，自带 onnx 分割模型，产真 alpha PNG，约 1~3s/张）。
   - 新增 `src/lib/background-removal.ts` + `scripts/remove-background-worker.mjs`。**推理跑在独立 node 子进程**里（onnxruntime 原生库在 Next 主进程内跑会整进程崩溃，实测崩过；子进程隔离后稳）。
   - `next.config.ts`：`serverExternalPackages` 加 `@imgly/background-removal-node`、`onnxruntime-node`（否则被 Turbopack 打包，wasm/onnx 资源路径失效报 `Unsupported format`）。
   - `generation-jobs.ts`：`CreateImageJobInput` 加 `bgRemove`；`runImageJob` 里 `extraJson.bgRemove` 为 true 时**跳过出图 provider**，对 `referenceImages[0]` 跑本地抠图→存透明 PNG（`saveDataUrlAsset(...,{keepTransparent:true})`）→走统一 `localizeAndFinalizeImages`（落库/扣费一致）。
   - UI 端到端实测：右侧新节点、落库 `.png`、`hasAlpha:true channels:4`（alpha 17~249，主体不透明背景透明）。
2. **编辑元素**（两重叠节点）：背景层 = gpt 内容感知补全（移除主体+补全，不透明 `.jpg`）；主体层 = 本地抠图透明 PNG（`bgRemove:true`）。两节点同坐标重叠、可拖开。实测通过。
3. **橡皮工具**：修了**真 bug**——涂抹 div 的 `onPointerDownCapture={stopCanvasPointer}`（捕获阶段 `stopPropagation`）会把同元素冒泡阶段的绘制 `onPointerDown` 一起跳过，导致**根本涂不上**（真人也涂不了，这就是它一直没验证通过的根因）。改成绘制逻辑放捕获阶段（`onPointerDownCapture/MoveCapture/UpCapture` 里做绘制+stopPropagation）。实测：涂抹正常→"立即使用"合成紫标 dataURL→Seedream 5.0 Pro 内容感知补全→出图。
4. **错误真实原因中文透出**（用户要求）：`generation-jobs.ts` 编辑类任务(`editFunction:true`)失败时不再套通用"服务器繁忙"，改用 `editErrorFallback` 透出真实原因；`error-message.ts` 加"不支持所请求参数(no provider/not supported.accepted)"→中文映射。之前 gpt 400 被吞成"服务器繁忙"、B_ 码只是全局自增序号（不是上游码），坑了很久。
5. **轮询成功后不刷新不显示 = 根治**（用户报的第一个问题）：`pollMountedRef` 被一个"只有 cleanup 没有 setup"的 effect（`useEffect(() => () => {...}, [])`）在 React 严格模式（Next dev 默认开）mount→cleanup→mount 时置成 `false` 且**再没置回 true** → `pollImageNode` 等所有轮询守卫直接 return → 前端完全不轮询（实测发起后 `/api/generation-status` 请求数=0）→ 节点一直转等待卡、成功后不显示、必须刷新（刷新靠后端已落库结果重建）。改成正常 mount effect（setup 置 true、cleanup 置 false）。修后轮询恢复、节点不刷新自动出图。**注意：这是严格模式(dev)专属，生产不双跑 effect 不受影响，但本地 dev 测试必踩。**
6. **快捷编辑重做**（用户要求：和原图同模型/尺寸/比例，保证输出尺寸一致）：`createImageEditNode` 加 `matchSourceImage`。判断"源模型+源参数能否重现源图实际尺寸"（生成图天然一致→直接沿用源 model+ratio+resolution；**上传图/对不上→统一用 Seedream 4.5，比例+分辨率取最接近原图实际尺寸的档**）。不再写死 gpt。实测 gpt 源图→快捷编辑用 gpt 16:9 2K→输出 2560×1440=源图一致。
7. **高清重做**（用户要求）：改成**统一 Seedream 4.5 + 4K + 贴合原图比例**（`ratioFromSourceImage`）。实测输出 5504×3040（源 2K→真 4K）。之前是 gpt 固定 2K（源已 2K 时等于没变高）。
8. 新增工具 `closestWorkflowRatioLabel`(真·最接近比例,无容差)、`closestResolutionForImageDimensions`(按像素挑最接近分辨率档)；`createImageEditNode` 分辨率统一 `normalizeImageResolutionForModel` 归一化到实际 model（修了"model 切走但 resolution 没跟着归一化"的不一致）。

### 本对话改动文件（在 2026-07-22 那批基础上继续，均未 commit）
- 新增：`src/lib/background-removal.ts`、`scripts/remove-background-worker.mjs`
- 改：`src/components/workflow-tldraw-canvas-inner.tsx`（bgRemove/matchSourceImage/ratioFromSourceImage、橡皮涂抹修复、pollMountedRef 修复、快捷编辑/高清按钮、两个 ratio/resolution 工具）、`src/lib/generation-jobs.ts`（bgRemove 分支+editFunction 错误透出）、`src/app/api/image/route.ts`（透传 bgRemove/editFunction）、`src/lib/error-message.ts`、`next.config.ts`、`package.json`/`package-lock.json`（新依赖 `@imgly/background-removal-node`）
- 沿用 2026-07-22 的 `local-assets.ts`/`media-save-queue.ts`/`openrouter.ts` 的 `keepTransparent` 落库旁路（本地抠图 png 靠它不被转 jpg；gpt `background:transparent` 那段现已成死代码但无害，未触发）

### ⚠️ 下一个 AI 注意 / 未做
- **扣费与正常生图完全同一套**（`workflow_image_generation`，按 model+分辨率算）。去背景/编辑元素本地抠图几乎零成本但仍按图片计费——**定价是否要调，用户还没定**。
- **上传图源的快捷编辑兜底**（→Seedream 4.5 最接近尺寸）逻辑已写好+tsc 过，但**只在生成图源上跑通了端到端**，上传图源没在浏览器实测。
- **橡皮小体验**：节点在画布上很小时，280px 的橡皮设置面板会盖住涂抹区（缩放正常时不会）。
- 用户说**下一个 AI 继续改另三个功能**：编辑菜单里还有 **编辑文字 / 多角度 / 移动对象** 三个按钮（目前实现/是否跑通未知，需先排查现状）。
- 本地 dev 登录会话会过期，重登：首页"登录"→"密码登录"→邮箱 `12424740@qq.com`→密码 `dragonstar`；工作流 `工作流_04` 有多个图片节点可测；低缩放下自动化选节点不稳。改中文源码只用 edit 工具（禁 PowerShell Set-Content，会乱码，本次又踩了一次已回滚）。

## 2026-07-22（本地开发：工作流图片节点「编辑类快捷菜单」五功能）—— ⚠️ 仅本地未部署，部分未跑通验证

**背景/参考**：对标 lovart.ai 画布，为工作流图片节点做一排"编辑快捷菜单"。查了 OpenRouter + BytePlus 两家官网能力（用 Playwright MCP 读渲染后的 BytePlus 文档）。结论：`gpt-5.4-image-2` 直连支持 `background:transparent`+`output_format:png`（真透明抠图）；BytePlus `dola-seedream-5-0-pro-260628` 支持"交互式编辑"（`<point>`/`<bbox>` 坐标、自由涂抹标记局部重绘）与"多层图像生成"；两家都**没有真超分/mask inpaint 专用端点**。

**铁律（用户强调，务必延续）**：所有编辑功能结果一律在**选中图片右侧新建节点**跑等待卡、成功显示图，**绝不覆盖原节点**；节点只有用户删除才消失。所有需要透明输出的图**禁止走 png→jpg 转换**。

### 已实现（`npx tsc --noEmit` 全绿，dev 正常；均本地，未部署）

**统一入口**：`workflow-tldraw-canvas-inner.tsx` 新增 `createImageEditNode(sourceNode, options)`（源图右侧建图片节点 + 走现有 `generateImageForNode → /api/image(async) → runImageJob` img2img 链路），options 支持 `prompt/model/ratio/resolution/transparent/position/referenceImageOverride/select`。另有 `createImageElementSplitNodes`（编辑元素两层）。都挂进 `WorkflowRuntime`。

1. **快捷编辑**（✅ 已完整跑通验证）：选中图片→顶部菜单点「快捷编辑」或按 **Tab**→图片下方出输入框（现有样式、同宽、1 行高可增到 3 行再滚动、2000 字、右侧发送按钮 `RiArrowUpLine`）。发送→右侧新节点用 **gpt-5.4-image-2 直连** img2img（源图当参考图+指令）。实测出图、扣 9 积分、不覆盖原节点。
2. **高清**（🟡 观察到 2K 任务在跑，未看到最终成图）：菜单「放大」已按用户要求改标签为**高清**。直接跑 `createImageEditNode(node,{prompt:保持内容不变提清晰, model:gpt直连, resolution:"2K"})`。⚠️ 无真超分，本质重绘，可能微改内容——用户已知悉、先接受，不行再换专用超分。
3. **去背景**（🟡 参数链路正确，但测试时 provider 返回 **B_211 服务器繁忙**，未在一次成功生成上确认 PNG 保留）：`createImageEditNode(node,{prompt:只留主体透明底, model:gpt直连, transparent:true})`。
4. **编辑元素**（🔲 未跑通验证）：`createImageElementSplitNodes` 固定两层——背景层(gpt,移除主体+内容感知补全)不透明 + 主体层(gpt,transparent)透明，两节点**同坐标重叠**（先建背景在下、后建主体在上）。多层输出的 Seedream 原生 API 未确认，先固定两层（符合用户"先固定两层"退路）。
5. **橡皮工具**（🔲 未跑通验证）：菜单「橡皮工具」→右侧出菜单盒（标题+`RiResetLeftLine`重置、滑块调笔刷 5~100、取消/立即使用）。鼠标变圆形笔刷在图上涂 `rgba(168,85,247,0.5)` 紫色（canvas 覆盖在节点图上，屏幕坐标）；立即使用→把原图+紫色涂抹合成 PNG dataURL 作为 `referenceImageOverride`，用 **Seedream 5.0 Pro**（`byteplus:conversation-image.seedream-5-0-pro`）跑"移除紫色标记区域+周围内容自然填补"。去除=内容感知填补（非留洞）。

### 后端改动（opt-in，默认路径零改动；影响共用链路，务必知悉）
沿 `/api/image` 共用链路（对话流/工作流/Agent/资产库共用）加了一个 `transparent` 透传，**只在编辑功能显式传 true 时生效**：
- `src/app/api/image/route.ts`：body 加 `transparent?`，async 分支传给 `createImageJob`。
- `src/lib/generation-jobs.ts`：`CreateImageJobInput` 加 `transparent`，写入 `extraJson.transparent`；`runImageJob` 读 `job.extraJson.transparent` 传给 `generateOpenRouterImage`。
- `src/lib/openrouter.ts`：`ImageGenerationOptions` 加 `transparent`；gpt `buildBody` 加 `background:"transparent"+output_format:"png"`；BytePlus body `output_format` 按 transparent 选 png/jpeg；`saveImageForDisplay(meta.transparent)` → `saveGeneratedAsset/enqueueRemoteAssetSave({keepTransparent})`。
- `src/lib/local-assets.ts`：`SaveAssetOptions` 加 `keepTransparent`；**`encodeGeneratedImageBuffer` 开头若 `keepTransparent` 则直接返回原 buffer（png），跳过 flatten+jpeg**（第 182 行附近，这步原本会把透明底填白转 jpg）。三处调用点透传。
- `src/lib/media-save-queue.ts`：`MediaSaveJob` + `enqueueRemoteAssetSave` 入参加 `keepTransparent`，`saveRemoteAsset` 调用透传（BytePlus 远程图走这条队列）。
- 前端 `generateImageForNode` 入参加 `transparent`，POST body 带上。

### ⚠️ 下一个 AI 必须继续测试/确认的（都没跑通一次成功）
1. **去背景**：provider 不忙时重试，确认结果是**真透明 PNG**（存的是 `.png`、透明底没被填白）。查落库文件扩展名 + 打开图看 alpha。
2. **编辑元素**：确认生成**两个重叠节点**、能拖开、主体层透明。
3. **橡皮工具**：确认①涂抹 UI/笔刷/滑块正常；②合成的紫色标记 dataURL 作为参考图**能正常传到 Seedream 并出图**（风险点：dataURL 作为 `referenceImages` 经 `createImageJob→resolveReferenceUrls` 是否被正确处理，需重点验证）；③结果是紫色区域被内容感知移除。
4. **共用链路回归**：确认加 `transparent` 后，**普通生图（对话流/工作流/Agent/资产库，transparent 未传）完全不受影响**（默认仍转 jpg、行为不变）。
5. 已知无关噪声：测试中 gpt 直连出现 `B_211 服务器繁忙`（上游临时错误，非本次代码问题）。

### 测试环境备忘（给下个 AI）
- 本地 dev：`npm run dev`（端口 3000）。改中文源码**只用 edit 工具，禁止 PowerShell Set-Content**（本次两次踩坑：Set-Content 把 openrouter.ts/workflow 文件中文变乱码，已 `git checkout` 回滚重做）。
- 若 dev 报 `Code generation for chunk item errored`（Turbopack 缓存了坏模块），停 dev + `Remove-Item .next` + 重启。
- 本地登录=测试服账号：登录页选"密码登录"，邮箱 `12424740@qq.com`，密码 `dragonstar`（提交邮箱→输密码→登录）。工作流 `工作流_04` 有多个图片节点可测。6% 缩放下 tldraw 虚拟化离屏节点、自动化选节点很不稳，建议先「定位节点」或手动缩放。
- 工作树尚未 commit；本批改动文件：`workflow-tldraw-canvas-inner.tsx`、`api/image/route.ts`、`generation-jobs.ts`、`openrouter.ts`、`local-assets.ts`、`media-save-queue.ts`。

## 2026-07-21（交接文档归档重建）

- 用户指出交接文档已超 1.2MB（CHANGELOG 580KB / 01 276KB / 05 200KB）。按"交接文档维护规则"把整批当前文档归档进 `handover/historical-handover-docs-last-used-2026-07-21/`（11 个 .md，只读），重写一批精简的新当前文档：`00-README`/`01-current-status`/`02-architecture-and-data`/`03-deploy-and-servers`/`04-product-rules`/`05-next-actions`/`06-memo-tasks`/`CHANGELOG`。
- 新文档保留所有仍有效的关键内容：三条铁律、腾讯 Docker 部署流程（正式服+测试服）、服务器全景/密钥/踩坑、数据表/媒体链路/上传链路/资产分类、`getAssetIdentityKey` 去重规则、产品规则、活跃备忘 M001~M019。删去了已过时的马来 PM2 流程细节、逐条历史部署备份名、腾讯迁移过程流水（这些在归档里）。
- 归档文件夹 `historical-handover-docs-last-used-*` 只读，勿改勿删。更早还有 `historical-handover-docs-last-used-2026-06-20/`。

## 2026-07-21（部署 session：部署正式服 v1.0.0.34 + @引用资产滚动条常驻 + 修@引用资产重复视频/资产）—— ✅ 四方同步 v1.0.0.36 / `dd37a78`

**状态**：本对话按用户指令先把上一 session 的 v1.0.0.34 部署上正式服，又做两个 @引用资产弹窗改动并再次部署，最终四方同步 **v1.0.0.36 / commit `dd37a78`**（+ handover doc commit），四域名 200，无遗留。无本对话新增 Prisma 迁移。

### 1. 部署正式服 v1.0.0.34（上一 session 积压）
- 确认测试服=v34/正式服=v25/仅差迁移 `20260721000000_media_asset_duration_float` → 备份 → `rsync` staging→prod → `docker compose up -d --build flashmuse-app`（entrypoint 自动 apply 迁移，核验 `MediaAsset.durationSeconds`=double precision）→ 同步阿里正式镜像 → 四域名 200、公网 v1.0.0.34。正式服原样带 v34、未自增。
- 正式服 DB 跑 `scripts/backfill-prompt-mentions.js`（docker cp 进容器 `/app` 跑）：fixed=0 / alreadyOk=84 / skipped=3 / total=262（数据本就基本干净；3 个@名与参考图数量不匹配被安全跳过）。
- commit+push GitHub `8986fe1..5bb0fc2`（29 文件，含道具 prop_image 全套 + 工作流用量计数修复 + B_232/B_252 + 迁移 + `/api/generation-references`）。

### 2. @引用资产弹窗左侧分类"滚动条常驻"（v1.0.0.35，`asset-mention-picker.tsx`）
- 需求：新增道具分类后左侧显示不全，用户不想加高弹窗，要溢出时滚动条常显可下拉。
- 改：左侧分类 div 加类 `mention-cat-scroll` + 注入 `<style>`（`scrollbar-width:thin` + `::-webkit-scrollbar{width:8px}` thumb `#c7c7c7`）。用 `overflow-y-auto`（非 scroll，避免无溢出时占 gutter）——定义了 `::-webkit-scrollbar` 后浏览器改用非叠加式滚动条，溢出常驻可见、无溢出（如资产库生成弹窗 6 个图片分类）不显示。三处 @引用资产共用此组件=一处改全覆盖。

### 3. 修「@引用资产同一上传视频/资产显示成两个」（v1.0.0.36，`chat-workbench.tsx`）
- 现象（测试号 12424740 浏览器复现）：上传视频实际 2 个，点开 @引用资产 → `@1784181320556-1d99e327-c` 变两个共 3 个；回资产库刷新即恢复。
- 定位：服务端 `workspace-state?assetFilter=upload_videos` 只返回 2 条（干净）→ 前端 `assets` 里同一文件存了两份（一份 `<video>` 首帧无 posterUrl、一份 `<img>` poster，底层 url 相同）。
- 根因：`getAssetIdentityKey`(`chat-workbench.tsx:2617`) 原 `mediaId||归一化url||id`（mediaId 优先）。同一文件"消息内嵌引用(无 mediaId,key=url)"与"资产库懒加载权威记录(有 mediaId,key=mediaId)"两份 key 不同 → `loadMentionFilterPage` 合并时漏判成两条。
- 修：改成 **`归一化url||mediaId||id`（url 优先）**。url 是文件唯一身份 → 两份必合并（用带 posterUrl 权威版覆盖）。三处 @引用资产共用同一 `assets`+此函数+`isAssetInFilter`=一处改全覆盖所有分类（"上传图片"等同类隐患一并根治）。
- 验证：上传视频恢复 2 条无重复、上传图片首屏 30 无重复。

### 4. 部署正式服 v1.0.0.36 + push
- v35/v36 各 bump+打 patch 部署测试服验证 → 用户拍板部署正式服：备份 `/opt/flashmuse/app-backups/20260721-201737-presync-v36` → rsync→build→同步阿里正式镜像→四域名 200、公网 v1.0.0.36。commit+push `5bb0fc2..dd37a78`（3 文件：`asset-mention-picker.tsx`/`chat-workbench.tsx`/`app-version.ts`）。无 Prisma 迁移。
