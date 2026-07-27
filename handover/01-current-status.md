# Current Status

> 本批交接文档 2026-07-21 重建。更早的详细流水在 `historical-handover-docs-last-used-2026-07-21/`（尤其 `CHANGELOG.md` 580KB、`01-current-status.md`、`05-next-actions.md`）。遇到需要历史上下文的难题再翻归档。

## 当前状态（2026-07-28 第七次会话更新）

### ⭐⭐ 给下一个 AI：**接手第一件事就是直接部署**（用户 2026-07-28 明确交代）

- 本地积压**两次会话**的改动，全部未部署。部署后 = **`v1.0.0.47`**，含 **1 个新 Prisma 迁移** `20260727154203_generation_event_resolved`。线上仍是 `v1.0.0.46`（正式服 = 测试服 = GitHub）。
- `npx tsc --noEmit` **全绿**；归档脚本本地 dry-run 跑通；版本号**还没 bump**（bump 只在部署测试服那一步做）。
- **不用再问要不要部署，直接按 `05-next-actions.md` 顶部的步骤走**：先测试服（bump v46→v47）→ 验证 → 再同步正式服 → **两服各自跑归档脚本**。
- 部署完两服都要跑：`node scripts/archive-resolved-generation-failures.mjs`（先 dry-run 看数）→ `--apply`。正式服预计归档 **~360 条**。

### 本次会话（第七次）做完的事：红字排查第 2~5 批，四类红字全部查清

主线是**继续排查后台「运营概览 → 失败原因」的红字**（方法论全在 `07-red-error-triage-and-archive.md`）。本次查掉四类、共可归档约 200 条：

| 红字 | 条数 | 结论 | 归档后 |
|---|---|---|---|
| OpenRouter 余额不足（混在两个兜底桶里） | 53 + 13 | 映射成「提供商余额不足！请联系管理员充值。」+ 不再自动重试 | 拆出兜底桶 |
| 视频任务创建失败：`expected the height/width…` | 109 | **同一根因的第二种上游措辞**，v47 发送前拦截本来就挡得住，只是正则漏了 | 109 → **0** |
| 当前模型不支持这组参数 | 54 | 51 条是我们自己的 bug 且都早已修掉；另修一个误映射 | 54 → **3** |
| 请先登录后再使用模型 | 17 | **状态码错了**（500 该是 401），前端所有跳登录保护全失效 | 17 → **0** |
| 请求失败，请稍后再试。 | 33 | 13 余额不足 + 20 条 07-10 前永久不可追溯 | 33 → **0** |

### 本次改动的代码（全部只动错误分支，成功路径零改动）

1. **`src/lib/error-message.ts`**（唯一入口，全模式生效）新增 3 类判定：
   - 供应商余额不足（`402` / `insufficient credits` / `insufficient_quota` / `exceeded your current quota` …）→ 「提供商余额不足！请联系管理员充值。」**位置必须在限流/`quota` 规则之前**，否则被抢走。
   - 参考图尺寸的**第二种措辞** `expected the (height|width) to be at least \d+px`（原来只认 `must be between \d+px and \d+px`）。
   - 平台返回 HTML 错误页 `Unexpected token '<' | is not valid JSON | <!doctype html` → 「平台服务临时异常（返回了非预期内容），请稍后重试。」**必须放在 `not valid` 规则之前**。
2. **`src/lib/transient-error.ts`**：余额不足列入 `isPermanentError`（不再白烧重试）；HTML/非 JSON 响应做**例外先行 return false** + 列入可重试（以前被 `not valid` 误判成永久失败，网关抖动直接放弃）。
3. **`src/lib/credits.ts`**：新增唯一权威 `UNAUTHENTICATED_ERROR_MESSAGE` / `createUnauthenticatedError()` / **`isUnauthenticatedError()`**；`assertUserCanUseCredits` 改抛带 `code:"UNAUTHENTICATED"` 的错误。
4. **6 个 route 的 catch 第一句**统一判 `isUnauthenticatedError` → 回 **401 且不记 GenerationEvent**：`image` / `video` / `chat` / `agent-plan` / `conversation-memory` / `workflow-prompt-optimization/rewrite`。
5. **新增 `src/lib/session-expired-redirect.ts`**（唯一权威）：`handleSessionExpiredResponse()`（401 → `window.location.replace("/")`）+ 哨兵 `SESSION_EXPIRED_SILENT_ERROR`。插在**两处 `readJson`**（`chat-workbench.tsx` / `workflow-tldraw-canvas-inner.tsx`，**43 处调用的咽喉**）开头 → 一行覆盖全部生成请求，不用改 12 个 fetch 站点；`isAbortLikeError` 认哨兵 → 跳转瞬间不闪红字；chat-workbench 原有 4 处手写 401 跳转收敛成调共享函数。
6. **`scripts/archive-resolved-generation-failures.mjs`** 新增 5 条规则（`provider-insufficient-credits` / `seedream-pro-sequential-param` / `reference-slot-not-an-image` / `reference-video-total-duration` / `session-expired-recorded-as-failure` / `pre-diagnostics-log-unknowable`）+ 两处结构性增强：**匹配文本 = 日志原文 + `failureReason`**（有些错误原文直接进了 failureReason，日志会轮转）、去掉 `requestId IS NOT NULL` 过滤；select 补 `createdAt`。

### ⭐⭐ 本次沉淀的三条重要认知（下一个 AI 必须知道）

1. **兜底桶有两个，同一个根因会同时污染两个**：`toUserErrorMessage` 的 fallback 是**默认参数** —— 显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 落进「服务器繁忙，请稍候再试.....」，不传落进「**请求失败，请稍后再试。**」。余额不足就是 53 + 13 同时污染。**排查任何一类，两个桶都要查。**
2. **同一根因常有多种上游措辞**：写正则前必须先把该根因在正式服的**全部措辞捞全**（归一化去重命令在 07 文档第五节）。参考图尺寸就因为只写了一种措辞，漏了 109 条。
3. **判断"是否真的修好了"不能只看代码里现在有守卫**（守卫可能是后来才加的）：必须 `git log -S "<关键代码片段>" --date=iso` 拿到**修复 commit 的精确时间**，再对比该根因**最后一次发生的时间**。

### ⚠️ 遗留 / 未做

- **`readJson` 两份分叉**（chat-workbench / workflow）**错误文案构建方式不同**（`toUserErrorMessage` vs `getWorkflowApiErrorMessage` 会补 `errorCode` 前缀）。本次只统一了 401 守卫，**没合并整个函数**（合并会改错误文案的实际显示，风险高，要先做影响评估）。
- **单会话策略一行没动** —— 用户 2026-07-28 明确：**是有意设计**（多会话会导致两端同时生成等更多错误），不要改。
- 下一批还有查的价值的：⭐**平台拉我们缩略图超时 18 条**（`Timeout while downloading url: http://<ip>/api/media-thumbnail?...`，送审给的是动态接口，应改静态直链）、`UnsupportedImageFormat` 4 条、gpt 中文明文拒绝约 20 条（应识别成"模型拒绝"接上已有的 AI 改写重试）。

### ⛔ 查正式服的踩坑记忆（省下一个人的时间）

- app 容器叫 **`flashmuse-flashmuse-app-1`**（不是 `flashmuse-app`）；测试服是 `flashmuse-staging-staging-app-1`。
- db 容器**不能** `psql -U postgres`（role 不存在）→ 查库一律 `sudo docker exec <app容器> node -e "..."` 走 Prisma `$queryRawUnsafe`。
- **正式服现在还没有 `resolvedAt` 列**（随 v47 才上），部署前查询别带 `resolvedAt` 过滤，否则报 `42703`。
- **诊断日志最早一行是 `2026-07-10T19:56`**（正式服 07-11 才从马来迁腾讯云）→ 更早的失败永久查不出。
- 一次性脚本：`scp` 到 `/tmp` → `docker cp` 进容器 `/app` → `node` 跑 → 删掉。PowerShell 里内联双引号/`$()`/中文会坏，写 `.sh` 再 `sed -i 's/\r$//'`。

## 此前状态（2026-07-27 第六次会话）

- ⚠️⭐ **本地有一批未部署的改动**（部署后是 `v1.0.0.47`，含 **1 个新 Prisma 迁移** `20260727154203_generation_event_resolved`）。**线上仍是 `v1.0.0.46`（正式服 = 测试服 = GitHub）**，本地版本号还没 bump（部署测试服那一步才 bump）。`npx tsc --noEmit` 全绿。
- **第六次会话做的**（详见 CHANGELOG 顶部 + ⭐ 新文档 `07-red-error-triage-and-archive.md`）：
  1. **正式服"资产是否都本地化"排查**：8181 条里远程 url 621（未归档仍显示的 97 条，签名全失效救不回来），全部是 2026-06 的历史遗留、现在链路正常。**用户拍板 C：先不管。**
  2. ⭐⭐ **红字「服务器繁忙」212 条深挖**：查出真实构成（参考图尺寸/比例不合规 82、OpenRouter 余额不足 53、轮询 failed 原因没落盘 40、审核凭证失效 11、empty image 7、gpt 中文拒绝 4、DB 事务超时 2），并修 4 处：**补上轮询/创建失败的上游原文日志**（原来只记 `hasError` 布尔）、**`!triggered` 真 bug**（已过审素材没被复用就放弃重试）、**已过审图第二次不再弹蓝字**（`reuseOnly` 预检 + 无感重试）、**死卡自愈**（凭证失效自动清理重送审）；错误文案新增 3 类真话。
  3. **参考图尺寸/比例发送前拦截 + 黑底提示**：新增唯一规则 `src/lib/video-reference-image-rules.ts`（300–6000px、0.4–2.5），对话流 / 工作流 / 服务端三处共用，只对 BytePlus 视频模型生效。
  4. ⭐ **后台失败原因「归档」机制**（用户要求：排查掉一批就归档、划掉但保留文字）：DB 加 `resolvedAt`/`resolvedNote`；后台上面只算未归档、下面新增划掉的「已排查并修复」区；新增 `scripts/archive-resolved-generation-failures.mjs`（规则表 `RESOLVED_RULES` 是唯一入口）。**`B_xxx` 编号继续自增，与归档无关。**
- ⭐ **下一个 AI 的主线任务 = 继续排查红字并修复**，方法论 / 已修清单 / 待查清单 / 归档流程全在 **`handover/07-red-error-triage-and-archive.md`**，照着做即可无缝衔接。
- ⚠️ v46 里第二~五次会话的功能**多数仍没实机点测过**（清单见 `05-next-actions.md`）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。
- ⛔ **改中文文档/源码只能用 edit/write 工具**（PowerShell `Set-Content` 会把 UTF-8 中文按 GBK 写回、文件报废）。
- ⛔ **Turbopack 不重编 `globals.css`**：本地改样式没反应时删掉整个 `.next` 再重启 dev（重启进程不够）。
- ⛔ 本地 `prisma generate` 会被 dev server 占用 dll 报 EPERM → 先停 dev server。

### 此前状态（2026-07-27 第五次会话，已部署两服 v1.0.0.46）

- ⭐ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.46`**。测试服入口全 200、正式服四域名 main/api/ali/static 全 200、两服 `x-app-version: v1.0.0.46`、无未应用迁移、`npx tsc --noEmit` 全绿。**无待部署。**
- **第五次会话做的**（详见 CHANGELOG 顶部）：
  1. 资产库右侧**视频卡左上角显示时长**（新增唯一权威 `src/lib/media-duration-format.ts` + 共享 `MediaDurationBadge`；音频播放器的时间格式化收敛进来）。角标尺寸同音频、但**深底白字**（用户拍板，浅底深字在封面上看不清）。
  2. **图片/视频缩略图 hover 放大**：统一 CSS 工具类 `.media-thumb-zoom`（scale 1.06 / .26s，触屏与 reduced-motion 不放大）。按用户选择**只套资产库右侧网格**。
  3. 收敛分叉：`workspace-state` / `media-assets` 两处调 `resolveAssetPreviewMeta` 都硬写 `durationSeconds: null`（漏传），现在真实传了并在资产 payload 直出 `durationSeconds`。副作用：预览页参数卡里上传视频现在也会显示「XX秒」。
  4. **时长/封面全量回填**：新增 `scripts/backfill-media-asset-durations.mjs`（ffmpeg 解析 `Duration:`，无 ffprobe）。本地 28 条 / 测试服 5 条 / **正式服 2059 条**补齐；正式服另用 poster 脚本**新建 29 个封面**并 rsync 到阿里正式镜像。
  5. ⛔ **踩坑：Turbopack 不重编 globals.css** → 改 CSS 看不到效果（同批 JS 改动却生效）。**必须删掉整个 `.next` 再重启 dev**，重启进程不够。以后"样式改了没反应"先查这个。
- ⚠️ **v46 里第二~四次会话那批功能仍然没有实机点测过**（视频截图/快捷编辑/积分页/用户中心等，清单见 `05-next-actions.md`），本次只实测了本会话这两项（时长角标 15/15、7/7；hover computed transform = matrix(1.06...)）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。
- ⚠️ **本地后台进不去**：`.env` 的 `ADMIN_EMAILS=lookxun@163.com` 是管理员白名单，但该账号在**本地库**里的密码不是 `dragonstar`（测试服那套账号只对测试服有效）。**但主测试号 `12424740@qq.com` / `dragonstar` 在本地库可以登录**（本次已用它实测）。
- ⛔ **教训**：改中文文档/源码**只能用 edit/write 工具**，用 PowerShell `Set-Content` 做正则替换会把 UTF-8 中文按 GBK 写回 → 文件报废。

### 此前状态（2026-07-27 第四次会话，测试服 v1.0.0.45）

- ⭐ **测试服 = `v1.0.0.45`（已部署，含第二/三/四次会话全部改动）；正式服 = `v1.0.0.43`；GitHub = v43**（本地工作树未 commit，基线 commit `03b21b5`）。测试服入口全 200、`x-app-version: v1.0.0.45`、无未应用迁移、`npx tsc --noEmit` 全绿。
- ⚠️ **本批功能全部未实机点测**（用户习惯：叫测才测）。验收清单见 `05-next-actions.md`。
- **第四次会话做的**（详见 CHANGELOG 顶部两条）：
  1. 工作流视频节点快捷菜单加 **「视频截图 ▾」**（悬停展开：截取首帧/尾帧/当前帧），截出的图直接作为图片节点出现在源视频右侧；截帧与右键导出共用唯一实现；节点标题显示「视频截图 xxx」。
  2. ⭐ **上传视频没封面根治**：去重早返回会继承历史空 posterUrl → 新增 `ensureDedupPosterUrl` 现场补 + 写回库；新增 `scripts/backfill-uploaded-video-posters.mjs`（本地已 apply 补 6 条；测试服 dry-run=0 条，无需补）。
  3. ⭐ **资产库上传类不再分对话流/工作流**：新增 `UPLOAD_IMAGE_CATEGORIES`（视频/音频早就不分流，图片是唯一漏做的），三处上传 + 视频截图统一显示在「上传的资产 · 上传图片」；顺手修掉工作流上传图片被写成 `conversation_uploads` 的分叉（读取已统一 → 老数据免 backfill）。
  4. **用户中心「生成图片/生成视频」显示 0 修复**：`User.generatedImageCount/VideoCount` 两个列从来没被任何代码 +1 → 改为现算（`getUserGeneratedMediaCounts`，只数 `sourceKind` 不含 upload 的），`/api/auth/me` 与 `/api/user-profile` 的 GET+PUT 都走它。
  5. **「我的积分」工作流行用工作流图标**（`/api/credits/me` 新增 `workflow` 来源、每个工作流一行；前端 `RiGitPullRequestLine`）。
  6. **工作流上传/截图后资产库右侧列表不刷新根治**（v45）：新增 `onUploadedAsset` 回调 → 父级 force 刷新对应上传分类；工作流拖拽/粘贴上传的图片/视频/音频以前同样有这问题，一并解决。
  7. 后台编辑功能表"内容行不是白色"一项，用户口头结掉（保持现状，不再处理）。
  8. **调研（无代码）**：视频「高清/超分」方案全面调查 → **BytePlus 无超分接口**；Seedance 2.0 已有 4K 档但那是重生成不是超分、且 $0.78/秒（**用户交代 4K 先不接**）；真超分只能走 Topaz（Replicate/fal）等第三方，开源最强 SeedVR2 需 4×H100。**用户决定先不做，记为备忘 `M020`**（数据/选型/接入要点全在 `06-memo-tasks.md` M020，别再重复调研）。
- **第三次会话做的**（已随 v44 上测试服，细节见 CHANGELOG）：对话流提示词里视频缩略图悬停显示封面（`HoverVideoPreview`）；⭐ 实测 Seedance 参考视频真实上限 **15.2 秒**、正式服生成的"15 秒"视频实际 **15.1 秒**；时长校验三处分叉收敛到 `media-upload-validation.ts`（容差 0.2）；修「自家 15 秒视频当参考被自己拦死」；工作流视频节点快捷菜单（快捷编辑 + 下载，模型链 Mini→Fast→2.0，参数按源视频真实尺寸/时长反推）；后台新增「工作流 · 视频编辑功能」表；图片快捷菜单下载收敛到共享 `downloadWorkflowNode`。**「高清」按用户交代先不做**。
- **第二次会话做的**（已随 v44 上测试服）：视频封面/播放按钮全平台统一（新增 `src/components/video-play-badge.tsx`，收敛 6 处重复 overlay）；上传视频归类分叉根治（`upload-file` 的 `getFileCategory` 改走权威 `classifyAsset(flow)`、`workspace-state` 的 `isWorkflowCategory` 补 `workflow_upload_*`）。原计划的 `currentCategory` backfill **已不必须**（第四次会话把上传类读取统一了）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。
- ⚠️ **本地后台进不去**：`.env` 的 `ADMIN_EMAILS=lookxun@163.com` 是管理员白名单，但该账号在**本地库**里的密码不是 `dragonstar`（测试服那套账号只对测试服有效）。
- ⛔ **教训（本次踩坑）**：改中文文档/源码**只能用 edit/write 工具**，用 PowerShell `Get-Content -Raw` + `Set-Content` 做正则替换会把整份 UTF-8 中文按 GBK 解码写回 → 文件报废且不可完全还原（本次 01/05 两份被毁，已用 `git checkout` + 重写恢复）。

### 关键实测数据（第三次会话新增，以后别再猜）
- **Seedance 2.0 / Fast / Mini 参考视频时长上限 = 15.2 秒（含）**，API 原文 `must be less than or equal to 15.2 ... in r2v`。另有 `video pixel count ≥ 409600`、宽高 300–6000px、宽高比 0.4–2.5。
- **正式服生成的「15 秒」视频实际统一 = 15.1 秒** → 当参考视频安全（15.1 < 15.2）。
- **视频模型分辨率天花板**：`seedance-2-0` 有 480p/720p/1080p；`-fast` 和 `-mini` 只有 480p/720p（`models.ts:415-446`）。

### 此前状态（2026-07-27 第一次会话，已部署正式服 v1.0.0.43）

  1. **视频"卡下载→僵尸任务"根治**：`saveRemoteAsset` 下载加 3min 超时、ffmpeg 加 60s 超时、`media-save-queue` 锁(inFlight)改成假死可自愈(8min)+stale 阈值 30min→8min。根因=跨境下载 fetch 无超时假死、锁只在 finally 释放→回收/过期全被挡死→job 永远 running。
  2. **恢复乐观显示**（用户最初设计）：视频出结果先用远程地址展示（角标"资产保存中..."），后台下本地后无感替换成本地("✓保存成功"2s 后渐隐)。资产库仍只写本地 url+全参数、零改动。对话流+工作流统一；OpenRouter 需密钥视频不预览；只做视频。
  3. **工作流生成动画**：侧栏工作流历史条目 + "工作流模式"入口在有节点 `isRunning` 时显示 `HaloPulseIndicator`（对齐对话流/资产库）。
- ⭐ 正式服有一条历史僵尸 video job（ID_686996 / requestId `d049d7ad...`）按用户交代**未清**（先改问题）。以后可手动标 failed。
- ⭐ 用户习惯：**叫你测试才测试**，不要每次自动开 Playwright。

### 此前状态（2026-07-26）

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
