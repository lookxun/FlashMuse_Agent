# Next Actions（2026-07-21 重建）

> 历史 END-OF-SESSION 记录都在 `historical-handover-docs-last-used-2026-07-21/05-next-actions.md`（很长）。这里只留当前有效待办。

## ✅ 当前状态（2026-08-26 第九十三次会话末）：**四方 `v1.0.1.10`，已 push**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 = 正式服 = GitHub | **`v1.0.1.10`** |
| 自查 | `tsc` 0 |
| 迁移 / 基建 | 无新迁移、无 compose/nginx |
| 回滚点 | 正式服 app `.../20260826-154406-presync-v1.0.1.10` |

### 🎯 待办 0

1. ✅ sticky 已真机走界面：新建对话 / 切到旧会话（以前 sticky 过 kimi）都先走后台优先 deepseek。切模式也写入 scope。
2. Agent 仍逼吐 JSON。闲聊改人话直出没拍板。语速别做。⛔ 正式服公告别动。
3. `modal.md` / `tmp-openrouter` / `原型测试.url` 别 `git add -A`。
4. `@名` 只认输入框已有素材。单独 `@xxx` 当普通字。M041/M038/M039 已在测服验过。流式缺 usage 不许写 0 分账本。

### ⚠️ 血泪教训（本对话框仍有效）

写文件只用 edit/write。Agent 优先不再写死 K3，后台「AI聊天对话」最下一行下拉+开关。开关开着下拉禁用。接上后粘 `lastAgentChatModel`，失败才按优先→原顺序再找。删 @名 和解析 @名 的终止符必须含 `@`（`@000@A_old`）。`@名` 有效 = 输入框已有对应图/视频/音频；禁止再按 @名 从整个资产库捞图。用户内容标 `data-no-translate`；繁体过期字靠 converted WeakMap，当前值等于已转换结果才跳过。积分表「图片/视频/语音」。

---

## ⏪ 上一状态（2026-08-23 第八十三次会话末）：**四方同步 `v1.0.1.5`**

| | 版本 / 状态 |
|---|---|
| 线上（测服=正式服=GitHub） | **`v1.0.1.5`**（`4c7ddeb`） |
| 本地 | **`v1.0.1.5` + 未提交** `AGENTS.md` / `03` / `05`（上号口径） |
| 自查 | `tsc` 0 |
| 迁移 | 正式服已 apply 默认语音字段 + `archivedAt` 列。归档运行时仍走 JSON。 |
| 回滚点 | 正式服 app `.../20260823-151900-presync-v1.0.1.5` |

### 🎯 待办 0

1. ⚠️ **本批新功能没真走界面**：① 找一条 `messagesHasMore` 的对话滚到顶，应自动加载、灰色转圈+「加载更早的消息」、不跳底。② 带上传图/视频/音频生成一次，后台弹窗和预览要能看到这些参考（资产库没 @ 的图也要在）。生成检查用免费语音 `fish-audio/s2.1-pro-free`。
2. 本地规则改动还没 commit。`modal.md` 别 `git add -A`。
3. Fish 音色克隆**没真打上游**。点归档名称弹详情**已撤**。语速别做。Kimi 别写成 MiniMax。⛔ 正式服公告别动。老成品没存过的参考补不回来。

### ⚠️ 血泪教训（本对话框仍有效）

写文件只用 edit/write。`button { font: inherit }` 无 layer，会赢过 Tailwind 写在 button 上的字号 → 字号写 span。工作流归档必须能从 GET 读回来（`usageSummary.archivedAt`），只写内存/未生效列 = 热更新就「自动恢复」。刷新面板别再用「登录默认」覆盖上次所在页。`keepSingleEmptySession` 必须把归档会话当已删一样跳过，否则归档空对话刷新就没了。测服要把当次新内容全部测一遍；没说推正式服就别推。说了推正式服，到正式服用免费语音 `fish-audio/s2.1-pro-free` 测一下不崩即可。别再例行付费生图。

---

## ⏪ 上一状态（2026-08-22 第七十八次会话末）：**本对话框收尾；本地 = 测试服 `v1.0.1.3`；正式服仍 v99，未 commit**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 | **`v1.0.1.3`** |
| 正式服 / GitHub | 仍 **`v1.0.0.99`** |
| 自查 | `tsc` 0 |
| 迁移 / 基建 | 无 Prisma 迁移、无 compose/nginx |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

当时待办：正式服等拍板（本会话已做）。

### ⚠️ 血泪教训（本对话框仍有效）

写/改文件只准 edit/write。Agent 收尾解析失败把整段 JSON 当正文 = 「对话后出现很多代码」。`cleanModelText` 不能先拿整段 JSON 去洗。思考结束不要再 `scrollIntoView`。

---

## ⏪ 上一状态（2026-08-22 第七十七次会话末）：**已部署测试服 `v1.0.1.3`；正式服仍 v99，未 commit**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 | **`v1.0.1.3`** |
| 正式服 / GitHub | 仍 **`v1.0.0.99`** |
| 自查 | `tsc` 0 |
| 迁移 / 基建 | 无 Prisma 迁移、无 compose/nginx |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

### 🎯 待办 0

1. 正式服等拍板（不再 bump）。⛔ 正式服公告别动。
2. 老对话里已经存成 JSON 的 Agent 消息不会自动变，只修新回复。
3. 语速别做。

---

## ⏪ 上一状态（2026-08-22 第七十六次会话末）：**已部署测试服 `v1.0.1.2`；正式服仍 v99，未 commit**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 | **`v1.0.1.2`** |
| 正式服 / GitHub | 仍 **`v1.0.0.99`** |
| 自查 | `tsc` 0 |
| 迁移 / 基建 | 无 Prisma 迁移、无 compose/nginx |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

### 🎯 待办 0

1. 真走界面验：Agent 先 K3、问「你是什么模型」只答闪念、生成偏好自动/手动、闲聊流式、TTS 出声+扣费对账。
2. 正式服等拍板（不再 bump，staging→prod 原样同步）。⛔ 正式服公告别动。
3. 语速别做。Kimi 别写成 MiniMax。Agent/通用自动生视频默认是对话流列表第一项（现为 H3）。

---

## ⏪ 上一状态（2026-08-22 第七十五次会话末）：**本地叠了 74+75 未提交；测试服仍旧 v1.0.1.1，正式服仍 v99**

| | 版本 / 状态 |
|---|---|
| 本地 | **`v1.0.1.1` + 第 74、75 次未提交**（⛔ 未 bump、未部署、未 commit） |
| 测试服 | 仍 **`v1.0.1.1`** |
| 正式服 / GitHub | 仍 **`v1.0.0.99`** |
| 自查 | `tsc` 0 |
| 迁移 / 基建 | 无 Prisma 迁移、无 compose/nginx |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

⭐ 本会话细节 → `CHANGELOG_3.md` 第七十五次会话。

### 🎯 待办 0

1. ⚠️ **本地 ≠ 测试服**。要上线先问一起 bump 还是拆。正常：`node scripts/bump-version.mjs` → 测服 → 真走界面验 → 再正式服（正式服不再 bump）。
2. 建议验：Agent 先走 K3、地区不可用会换下一个且下一句不再重试已跳过的；问「你是什么模型」只答闪念、不报 Kimi/月之暗面；生成偏好自动/手动出图参数对；后台 K3 有「Agent优先」、没有独立 Agent 开关组。闲聊/流式第 74 次那批也还没真走界面验。
3. 正式服等拍板。无迁移、无 compose/nginx。⛔ 正式服公告别动。
4. 语速别做。Kimi K3 别写成 MiniMax。Agent 是短剧 Agent，通用是万能任务（以后加 skill）。

### ⚠️ 血泪教训（仍有效）

写/改任何文件只准用 edit/write。Agent 自动链若从 Terra Pro 起、又不在服务端换模 = 每句地区不可用。身份探测路径不要只打一个模型。

---

## ⏪ 上一状态（2026-08-22 第七十四次会话末）：**本地叠了未提交整批；测试服仍旧 v1.0.1.1，正式服仍 v99**

| | 版本 / 状态 |
|---|---|
| 本地 | **`v1.0.1.1` + 本会话未提交**（⛔ 未 bump、未部署、未 commit） |
| 测试服 | 仍 **`v1.0.1.1`**（不含本会话） |
| 正式服 / GitHub | 仍 **`v1.0.0.99`** |
| 自查 | `tsc` 0 |
| 迁移 / 基建 | 无 Prisma 迁移、无 compose/nginx |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

⭐ 本会话细节 → `CHANGELOG_3.md` 第七十四次会话。

### 🎯 待办 0

1. ⚠️ **本地 ≠ 测试服**。要上线先问用户：一起 bump 还是拆。正常：`node scripts/bump-version.mjs` → 测服 → 真走界面验闲聊/流式/Kimi/Grok/语音下载命名 → 再正式服（正式服**不再 bump**）。
2. 闲聊跳过规划 + 流式 **还没真走界面验**。建议验：闲聊只打一次 `/api/chat`（stream）；说「生成一张图」仍走 `/api/agent-plan`；字是边出边写；思考中没有复制/重新生成/反馈按钮。
3. 正式服等拍板。无迁移、无 compose/nginx。⛔ 正式服公告一个字别动。上正式服巡检要真跑一次生图；动过语音就再跑一次 TTS。
4. 语速别做。Qwen 无情绪、Fish 无音色。粤语专业主持不要加回。Kimi K3 别再写成 MiniMax。

### ⚠️ 血泪教训（仍有效）

写/改任何文件只准用 edit/write 工具，shell 永不写文件；`git checkout`/revert 前先 `git status`。
本机 5432 通 ≠ Postgres 在跑（Docker 半死进程会占端口）。启动脚本只测 TCP 会误判。

---

## ⏪ 上一状态（2026-08-21 第七十三次会话末）：**已部署测试服 `v1.0.1.1`；正式服仍 v99，未 commit**

当时待办：音频模型刷新不持久化（本会话已修）；正式服等拍板。

---

## ⏪ 上一状态（2026-08-21 第七十二次会话末）：**情绪下拉 + MiniMax 音色试听全语种 + 失败卡对齐；全本地 tsc 0，未部署未 commit**

| | 版本 / 状态 |
|---|---|
| 本地 | **`v1.0.1.0` + 一大批未提交**（Recraft + 语音第一版 + 第七十一次收尾 + 本次）；⛔ 未 bump、未部署、未 commit |
| 测试服 | **`v1.0.1.0`** |
| 正式服 / GitHub | 仍 **`v1.0.0.99`** |
| 自查 | `tsc` 0 |
| 迁移 / 基建 | 无 Prisma 迁移、无 compose/nginx 改动 |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

⭐⭐ 本次 = 情绪下拉 + MiniMax 五种语言试听预录音频 + 语音失败卡对齐图片/视频。细节 → `CHANGELOG_3.md` 顶条（第七十二次会话）。

### 🎯 待办 0（本次）

1. 音频模型选择**不跨刷新持久化**（load 时 audio 可能回落到 Fish 免费）。
2. ⚠️ **本地叠着多批未提交**（Recraft + 语音第一版 + 收尾 + 本次）→ 部署前先问一起 bump 还是分开。⛔ 没让部署就别部署、别测烧钱。
3. 语速 `speed` 别做。Qwen 没有情绪下拉、Fish 没有音色按钮 = 官方能力如此，别当漏了。
4. Qwen 两个音色没有预录音频（用户没让做）。粤语专业主持两个已从菜单去掉，别加回去。

### ⚠️ 血泪教训（仍有效）

写/改任何文件只准用 edit/write 工具，shell 永不写文件；`git checkout`/revert 前先 `git status`。

---

## ⏪ 上一状态（2026-08-21 第七十一次会话末）：**语音生成收尾一大批（等待卡/提示词/音色弹窗/后台开关）；全本地 tsc 0，未部署未 commit**

情绪下拉当时还没做。已修：身份句拦语音、`pendingAudioCount` 漏写。

---

## ⏪ 上一状态（2026-08-20 第七十次会话末）：**对话流「语音生成」第一版做完（本地，tsc 0）；期间一次编码事故已完全恢复零损失**

| | 版本 / 状态 |
|---|---|
| 本地 | **`v1.0.1.0` + 一大批未提交**（Recraft 旧批次 + 本次语音生成）；⛔ 未 bump、未部署、未 commit |
| 测试服 | **`v1.0.1.0`** |
| 正式服 / GitHub | 仍 **`v1.0.0.99`** |
| 自查 | `tsc` 0；11 个音频相关文件 0 U+FFFD / 0 BOM |
| 迁移 / 基建 | 无 Prisma 迁移、无 compose/nginx 改动 |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

⭐⭐ 本次 = **对话流接入「语音生成」(TTS) 第一版**（4 个 OpenRouter 音频模型：MiniMax Speech 2.8 HD / Qwen Audio 3.0 TTS Plus / Fish Audio S2.1 Pro / Fish 免费版）。全本地、未部署未 commit。细节、事故恢复、还没做的小尾巴 → `CHANGELOG_3.md` 顶条（第七十次会话，五节）。

### 🎯 待办 0（本次新增）：语音生成第一版的收尾 + 首次真跑验证

1. **4 个音频模型图标**（用户要 remixicon，找不到去 lobehub）：改 `src/components/model-icon.tsx` 的 `getGenerationModelIcon`（唯一权威）补 `minimax/` `qwen/` `fish-audio/` 分支。
2. **首次真跑一次 TTS**（本地，可能要带代理——音频模型是否被地区限制未知）：验出音频 + 扣分对账（`CreditLedger` kind=`audio`）+ 进资产库 `conversation_audios` + 三卡样式（880×200）。
3. **默认音色校准**：MiniMax `female-tianmei` 未实测，真调一次确认 voice id（Qwen `longanlingxin` 已由 playground 实测）。
4. （可选）音频模型选择跨刷新持久化。
5. ⚠️ **本地现在叠着多批未提交改动**（Recraft 等 + 语音生成）→ 部署前先跟用户理清"一起 bump 还是分开"。

### ⚠️ 血泪教训（已升 AGENTS.md 最高级铁律）

本次我用 PowerShell 写含中文的 `chat-workbench.tsx` → 整份中文损坏；补救时 `git checkout` 又误删了该文件里未提交的 Recraft 改动。已从测试服 v1.0.1.0 完整恢复。**下一个 AI：写/改任何文件只准用 edit/write 工具，shell 永不写文件；`git checkout`/revert 单个文件前先 `git status` 看它有没有别批次的未提交改动。**

---

## ⏪ 上一状态（2026-08-20 第六十九次会话末）：**又加了 2 个本地小改动（三视图大脸 + 失败卡按钮居中）；测试服仍 v1.0.1.0、正式服仍 v99**

### 🎯🎯 待办 0（本次新增，等用户拍板）：把本次这两处小改动一起部署

⚠️ **现在有两批待部署**：① 待办 1 的 v1.0.1.0（已在测试服）② 本次两处小改动（本地、未 bump）。
**先问用户**：这两批一起推正式服，还是分开？若一起 → 本地这两处直接跟着 v1.0.1.0 上（v1.0.1.0 已经在测试服跑过巡检，本次两处只是加在其上、无迁移无基建改动，测试服重新同步一次再巡检即可，⛔ 是否 bump 看用户，正常做法：本地既然还叫 v1.0.1.0 且测试服也是 v1.0.1.0，要区分就得 bump 一版，否则会破坏"版本号一样=代码一样"的核心约定）。

### 🎯🎯 待办 1（等用户拍板）：把 `v1.0.1.0` 推正式服 + commit

测试服已巡检 6 项 + Recraft 必测全过（含真跑出图、扣费对账、服务端拦截、后台删除功能）。
正式服步骤（照 `03-deploy-and-servers.md`，⛔ **不再 bump**）：

1. 备份 app：`sudo cp -r /opt/flashmuse/app /opt/flashmuse/app-backups/<ts>-presync-v1.0.1.0`（无迁移，库备份可选）。
2. staging→prod rsync → ⭐ **判据：prod 的 `src/` 逐文件 md5 = staging**。
3. `up -d --build flashmuse-app` → `/api/health` = v1.0.1.0。
4. `docker cp .next/static` 推阿里**正式**镜像 `flashmuse-static`（腾讯文件数 = 阿里文件数）。
5. `/opt/flashmuse/.env` 的 `PUBLISHED_APP_VERSION=v1.0.1.0` + `force-recreate` → 四域名 200。
6. 正式服**真上号**巡检 6 项 + Recraft 必测（正式服汇率不同 → 菜单积分数会不一样，按它自己的汇率对账）。
   ⛔ 公告一个字都别动。
7. commit + push（15 个源码文件 + 交接文档）。

---

## ⏪ 上一状态（2026-08-19 第六十七次会话末）：**Recraft V4.1/Pro 接入 + 模型菜单副标题；本地两批未提交，下一个 AI 要部署**

| | 版本 / 状态 |
|---|---|
| 测试服 / 正式服 / GitHub | **`v1.0.0.99`**（四方同步基线，没动）|
| 本地 | ⚠️ **`v1.0.0.99` + 两批未提交**：① 内容审核删除功能（session66，3文件）② 本次 Recraft + 菜单副标题（10文件 + 新 `recraft-icon.tsx`）；`tsc` 0 |
| 迁移 / 基建 | 无新 Prisma 迁移、无 compose/nginx 改动 |
| 回滚点 | 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99` |

### 🎯🎯🎯 待办 1（最优先，用户已交代要部署）：把这两批一起上测试服 → 正式服

**这次要部署的全部文件（两批）**：
```
# 批1 内容审核删除功能（session66）
src/lib/content-moderation.ts
src/app/admin/api/content-moderation/route.ts
src/app/admin/admin-content-moderation-panel.tsx
# 批2 Recraft + 菜单副标题（本次）
src/lib/models.ts
src/lib/openrouter.ts
src/lib/media-asset-record.ts
src/app/api/model-availability/route.ts
src/components/chat-workbench.tsx
src/components/workflow-tldraw-canvas.tsx
src/components/workflow-tldraw-canvas-inner.tsx
src/components/model-icon.tsx
src/components/recraft-icon.tsx   # 新文件
```

**步骤（照 `03-deploy-and-servers.md`）**：
1. ⛔ **先 `node scripts/bump-version.mjs`（v99 → v100）** —— 别往 v99 上叠。
2. **无 Prisma 迁移、无 compose/nginx** → 上正式服**不需要**库备份（按铁律跑一次也行）。
3. 测试服：打包 → scp → grep 确认版本号在服务器源码 → 后台 build → `sync-ali.sh --stack=staging` → 写 `PUBLISHED_APP_VERSION=v1.0.0.100` + `force-recreate` → 验 `/api/health` version + `x-app-version` + 8080/https 200。
4. 测试服**真上号巡检 6 项 + Recraft 必测 5 项**（见下），OK 再上正式服。
5. 正式服：备份 app → staging→prod rsync（**不再 bump**）→ 判据 prod `src/` md5 = staging → `up -d --build`（health=v100）→ `docker cp .next/static` 推阿里正式镜像（数量一致）→ 置 `PUBLISHED_APP_VERSION` + `force-recreate` → 四域名 200 → **正式服也真上号巡检 + Recraft 必测** → commit + push。

**⭐⭐ Recraft 必测 5 项（真上号 `12424740@qq.com`）**：
1. 图片模型下拉有 **Recraft V4.1 / V4.1 Pro**，排在 **Gemini 3.1 Flash 上面**，带 **Recraft 图标 + NEW 标**；
2. 名字下方灰字：`平面设计·高美学·短词出图 · X积分/张`（V4.1）、`意料之外的美·2K高清 · X积分/张`（Pro）——**积分随后台汇率**；顺带看别的图片/视频模型也有「简介 · X积分/张 或 /秒」；
3. 选 Recraft → 比例菜单**只 5 个**（无 21:9）、分辨率**单档**（V4.1=1K / Pro=2K）；
4. **真跑一张 Recraft 出图**（走 `/api/v1/images`）→ 出图 + 扣费正常（V4.1 约2-3分 / Pro 约15分）；
5. 内容审核后台两张表（已拦截 / 语义待确认）能「详细」弹窗 + 逐条「删除」，且**不再30天自动清理**。
⛔ 公告在正式服**一个字都别动**（禁测铁律）。

---

## ⏪ 上一状态（2026-08-18 第六十六次会话末）：**已部署 `v1.0.0.99` 四方同步；本地另有一批未提交改动（内容审核删除功能）**

| | 版本 / 状态 |
|---|---|
| 测试服 / 正式服 / GitHub | **`v1.0.0.99`** —— 四方同步基线；commit `5fc8886` 已 push；staging→prod `src` md5 完全相等（`875c03b9923a74cd2f0ae038911d39f7`）|
| 本地 | ⚠️ **`v1.0.0.99` + 未提交改动**（内容审核「不自动清理 + 手动删除」）；`tsc` 0；⛔ 未 commit / 未 bump / 未部署 |
| 本地改动文件 | `src/lib/content-moderation.ts`、`src/app/admin/api/content-moderation/route.ts`、`src/app/admin/admin-content-moderation-panel.tsx`（**无新迁移、无 compose/nginx 改动**）|
| 回滚点（v99）| 正式服 app `/opt/flashmuse/app-backups/20260818-141800-presync-v1.0.0.99` + 正式库 `pre-deploy-v99`（EXIT=0，异地已同步）|

🎯 **本次两段**（细节在 `CHANGELOG_3.md` 顶条，第六十六次会话，四节）：

1. **把第六十五次会话攒下的一批本地改动（用户中心「设置」新功能 + 后台审核「详细」列，含 8 字段迁移）bump→v99 部署上线，四方同步完成。** 两服巡检 6 项全过、console 0 error、真跑生图成功。⛔ 正式服公告没动。
2. **（本地未提交）内容审核记录改「不自动清理 + 手动删除」**：去掉 30 天自动清理 → 永不自动删；新增 `DELETE` 接口按 id 删记录；已拦截记录 + 语义审核待确认两张表都改成「提示词两行 + 详细 + 删除」按钮；去掉语义审核表的「加入词库」按钮。

### ⚠️ 下一个 AI 衔接要点

- ⛔⛔ **本地代码 ≠ 已部署 v99**（本地在 v99 之上又叠了内容审核删除功能）→ 要上线本批**先 `node scripts/bump-version.mjs`（→ v100）**再走「测试服→正式服」，⛔ 别往 v99 上叠。**这批无迁移、无 compose/nginx 改动，比 v99 简单。**
- 内容审核两张表现在逐条手动删（删 `ContentModerationEvent` 行、不可恢复）、**不再自动清理**——表会一直长，以后太大可加「批量删/按时间清」入口（用户目前只要逐条删）。删除按钮受页面编辑锁约束（锁定时整页 `pointer-events-none`）。
- ⭐ **踩坑教训（可升铁律）**：Tailwind 的 `grid-cols-[...]` 任意值 class **绝不能用模板字符串/变量拼**（Tailwind 扫不到 → CSS 不生成 → 表格塌成一列），每种组合写死完整字面量。

🎯🎯 **下一个 AI 的最优先任务仍是「间断性卡死」bug 的静态定位**（见下方待办 1，⛔ 只许加日志不许改行为）。

---

## ⏪ 上一状态（2026-08-18 第六十六次会话中·部署完 v99 时的快照）：**四方同步 `v1.0.0.99`**

（此后本地又叠了内容审核删除功能，见上方最新状态。）

---

## ⏪ 上一状态（2026-08-18 第六十五次会话末）：**测试服 = 正式服 = GitHub `v1.0.0.98`；本地 = v98 + 一批未提交改动**

⭐ 本次做了 4 件事（**全部本地、未提交**），详细过程在 `CHANGELOG_3.md`（第六十五次会话，六节）：

1. **修本地「登录后对话历史读不出来」**——根因 dev 的 `.next` 缓存损坏（路由没注册返 404 HTML），删 `.next` 重启即好，**不是代码问题**；顺手清 `.runtime` 垃圾 + 删 `.next`。
2. **后台「已拦截记录」表格**：完整提示词最多 2 行 + 新增「详细」列弹窗（命中词红色高亮）。文件 `admin-content-moderation-panel.tsx`。
3. **用户中心「设置」两大新功能**：登录默认面板（默认对话流）+ 新建对话默认生成参数（图片/视频两组，选项随模型联动）。后端 User 表 +8 字段 + 迁移；新增复用组件 `SettingsSelect`。
4. **设置项调整**：删「自动收入资产库」死开关（改成永远收入）；下拉点空白关闭；图标对齐（分辨率行灰色 `RiFullscreenLine`、模型行固定 `AiGenerate3dIcon`、菜单选项加图标单行加宽）。

### ⚠️ 下一个 AI 衔接要点

- 要上线本批：`node scripts/bump-version.mjs`（→v99）→ 测试服 → 正式服，**务必带上那个 Prisma 迁移**。
- 「登录默认面板」现在**覆盖了「恢复上次面板」**（用户要的确定性落点，别改回去）。
- 「新建对话套用默认参数」只在 `startNewSession` 触发。
- `autoSaveHistory` DB 字段 + 后台「自动收入资产库」显示**未动**（无害恒 true）；要清理可后续去掉后台那行（用户未拍板）。
- 测试账号默认图片模型被测成 GPT-5.4 Image 2、视频 MiniMax H3、登录默认面板已调回对话模式。

---

## ⏪ 上一状态（2026-08-11 第六十四次会话末）：**本地 = 测试服 = 正式服 = GitHub 全部 `v1.0.0.98`**

---

## ⏪ 上一状态（2026-08-10 第六十三次会话末）：**本地 = 测试服 = 正式服 = GitHub 全部 `v1.0.0.97`**

| | 版本 / 状态 |
|---|---|
| 本地 / 测试服 / 正式服 / GitHub | **`v1.0.0.97`** —— **四方同步**，commit `abfca9a` 已 push、工作区干净 |
| 硬判据 | staging→prod 对齐后 `src/` 逐文件 md5 完全相等（`f608cba83ef9a05fcbf4cc2690295ee1`，194 文件）|
| 迁移 / 基础设施 | 无 Prisma 迁移、无 compose/nginx 改动；只改正式服 `.env` 的 `PUBLISHED_APP_VERSION`（v96→v97）|
| 自查 | `tsc` 0 |

⭐ 本次 = **修「视频双失败卡」(M029) + 「工作流上传进度拖垮画布」(M037) + 后台语义审核只显示疑似 + 修历史坏数据**，两服都已上线。
详细过程在 `CHANGELOG_3.md` 顶条（第六十三次会话，六节）。

- ✅ **M037 已完成**（工作流上传进度只 patch 单个 shape，不再触发整张画布 stringify/onChange/PUT）。
- ✅ **M029 已完成**（视频失败加"名额守卫"，重复收尾整条不动；历史坏数据本地 1 + 正式 2 已修）。
  ⚠️ **未做过"活复现"**（跨浏览器重启竞态、费钱）→ 若下次真在正式服再看到视频双失败卡，先去
  `WorkspaceMessage.messageJson` 取证 `failedVideoCount` vs `mediaErrorReasons.length` 是否对得上，再判断守卫有没有漏。

🎯🎯 **下一个 AI 的最优先任务仍是「间断性卡死」bug 的静态定位**（见下方待办 1，⛔ 只许加日志不许改行为）。

---

## ⏪ 上一状态（2026-08-10 第六十二次会话末）：**本地 = 测试服 = 正式服 = GitHub 全部 `v1.0.0.96`**

| | 版本 / 状态 |
|---|---|
| 本地 / 测试服 / 正式服 / GitHub | **`v1.0.0.96`** —— **四方同步**，commit `815650e` 已 push、工作区干净 |
| 硬判据 | 本次改的 2 文件本地 = 测试服 = 正式服 md5 完全相等 |
| 迁移 / 基础设施 | 无 Prisma 迁移、无 compose/nginx 改动；只改两服 `.env` 的 `PUBLISHED_APP_VERSION`（v95→v96）|
| 自查 | `tsc` 0、`npm test` **71/71** |

⭐ 本次 = **按逐模型实测的上游真实上限，把「提示词字数默认限制」改成用户拍板的产品值**（`prompt-length.ts` 的 `MODEL_DEFAULT_PROMPT_MAX_LENGTH`）。
详细过程 + 各模型实测上限 + 实测手法在 `CHANGELOG_3.md` 顶条（第六十二次会话）；完整对照表在桌面 `模型提示词字数上限.md`。

⭐⭐ **下次部署必记**：最后一步要把 `/opt/flashmuse*/.env` 的 `PUBLISHED_APP_VERSION` 改成新版号 + `docker compose up -d --force-recreate`，
否则前端不弹「发现新版本」提示（本次一开始漏了，被用户发现后补上）。

🎯🎯 **下一个 AI 的最优先任务仍是「间断性卡死」bug 的静态定位**（见下方待办 1，⛔ 只许加日志不许改行为）。

---

## ⏪ 上一状态（2026-08-09 第六十一次会话末）：**本地 = 测试服 = 正式服 = GitHub 全部 `v1.0.0.95`**

| | 版本 / 状态 |
|---|---|
| 本地 / 测试服 / 正式服 / GitHub | **`v1.0.0.95`** —— **四方同步**，commit `6bf62bb` 已 push、工作区干净 |
| 硬判据 | 测试服 vs 正式服 `src/` md5 完全相等（194 文件、`3517c5e1f162d744c638798db1f7dfcd`）|
| 迁移 / 基础设施 | 无 Prisma 迁移（两服都 41 个）、无 compose/nginx 改动 |
| 自查 | `tsc` 0、`npm test` **71/71** |

⭐ 本次干了三件事（详细过程在 **`CHANGELOG_3.md`** 顶条，⚠️ 流水已轮转到卷 3）：

1. **修掉「公告『新增』显示成『新建』」** —— 影响所有简体用户（默认）。
   ⛔⛔ **根因不是缓存**：我第一轮判成"透明代理缓存旧副本"，被用户一句
   「**测试服里是第一次发这条公告，哪来的缓存？**」直接问倒 —— 那个判断是错的。
   真凶 = **简繁转换**（`chat-workbench-core.tsx`）：`globalSimplifiedPhrases` 是把简→繁表**机械反转**得来的，
   于是多出 `["新增" → "新建"]`；而简体分支对**每个文本节点**都跑 `convertTraditionalToSimplified`
   → 页面上任何「新增」被静默改字。**这也解释了"刷新有时新有时旧、过几秒又变回旧"**（异步 fetch 与那次一次性遍历的竞态）。
   ⭐ 修法：简体分支**只还原存下来的原文，没存过就原样不动**（文本节点 + 属性两处）+ **删掉**那个有损反向函数与两张反向表。
2. **M040 完成**：`tests/error-message-idempotency.test.ts`（56 用例，`npm test` 15 → **71**）。
3. **删死常量 `MAX_DRAFT_INPUT_LENGTH`** + **M011 关闭**（实测两台 `.env.local` 重复 key = 0）。

**已验到的关键判据（⛔ 别重复做）**：
- ⭐⭐ **确定性判据**：切繁体 → 再切回简体（**旧代码走这条路必错**）→ **两服都**是公告仍「新增」且完整还原（影片→视频）；
- 测试服连刷 6 次 + 单页 1~8 秒逐秒采样：横幅稳定 231 字、「新增」恒在、「新建」**从未出现**；
- ⭐ 旁证：侧边栏「**新建**工作流 / 新建对话」（我们自己的界面文案）保持不动 → "该动的没动、不该动的也没动"；
- 正式服：四域名 200、**静态 chunk 8/8 全 200**、`no-store` 正确、`/api/media-thumbnail` 白名单未被加、
  静态镜像 42=42；巡检 6 项全过（含**真跑生图成功**）、**console 全程 0 error**。
- ⚠️ **回滚点**：`/opt/flashmuse/app-backups/20260809-232055-presync-v1.0.0.94`。

⚠️ **本次踩到的坑（下次省时间，已写进 `CHANGELOG_3.md` 第六节）**：
① **生产构建会压缩局部函数名** → 拿函数名 grep `.next` 产物**验不了改动**（三个名字全 0，包括本该存在的那个）→ 必须走界面；
② `curl` 抓 HTML **必须加 `--compressed`**（否则在 grep gzip 二进制）；
③ **PowerShell 重定向 `> file` 写 UTF-16LE** → node 读出来是乱码、正则全不匹配（要用 `execSync` 在 node 里取 diff）；
④ **PowerShell 不支持 heredoc** → 含中文的提交信息用 write 工具写成文件再 `git commit -F`；
⑤ 判"成品图出来了"要**排除 `user_avatar`**（头像会被算进 `img` 里，我一度以为 5 秒就出图）。

🎯🎯 **下一个 AI 的最优先任务：仍然是「间断性卡死」bug 的静态定位**（见下方待办 1，⛔ 只许加日志不许改行为）。

---

## 🎯🎯🎯 待办 1（最优先）：「间断性卡死」bug —— 证据链已完整，可以开始静态定位了



见下方那一节里的完整证据（三条 client 诊断事件 + 服务端同 requestId 是 `image-job-success`）。
⭐⭐ 最硬的线索 = `byLoadingSessionIds:false` + `pendingRequestCount:0`（**死锁态**）。
→ 下一步是**纯读代码的静态定位**：找出「哪条路径会让会话被移出 loading 集合但没把 `messagesLoaded` 置 true」。
⛔ 定位到之前仍然只许加日志、不许改行为。

## 🎯🎯 待办 2：观察 `prompt-length-over-limit` 的真实规模，再决定要不要开服务端拦截

- 判据一行：`grep -c '"prompt-length-over-limit"' .runtime/generation-diagnostics-log.jsonl`（两服都看）。
- ⚠️ 测试服现在有 **1 条是我 2026-08-09 人造的**（`used:23 / maxLength:10`），数真实规模时要减掉它。
- 用户当时选的是「先只记日志观察几天」；量很小 = 可以考虑真拦，量大 = 说明某个模型默认值配小了，先调默认值。

## ✅【已完成，第六十一次会话做掉了】原待办 3：清掉 `MAX_DRAFT_INPUT_LENGTH` 死常量

已删（搭 v95 的车），原位留注释说明"为什么删、要上限用什么"：
⭐ 要上限用 `getPromptMaxLength()`；要安全网用 `PROMPT_MAX_LENGTH_CEILING`（99999）。
⛔ 别再把它捡回来 —— 它是"下一个人拿去 `slice(0,2000)` 破坏『超字数不删字』口径"的现成陷阱。

## ✅【已完成，第六十一次会话做掉了】原待办 4：CHANGELOG 轮转开卷 3

- **`CHANGELOG_3.md` 已建并成为当前活跃卷**（2026-08-09 起用）；`CHANGELOG_2.md` 已改标题为
  「卷 2 · 已归档只读」并在顶部加了指向卷 3 的提示；`00-README.md` 文档索引三行已更新。
- ⚠️ 顺带保留提醒：卷 2 的 **887~1033 行是编码受损原文**（760 个 `U+FFFD`，第 50~53 次会话）。
  ⛔ **别去"修"它**（等于伪造记录）；那几批的完好摘要在 `01-current-status.md` / `05-next-actions.md`。
- ⭐ **下一次轮转**：卷 3 到 ≈400KB 或 2000+ 行时开 `CHANGELOG_4.md`，固定 5 个动作见 `00-README.md`。

## 🎯 待办 3（原待办 5）：老待办原样保留

Agent 的 `agent-video.seedance-2-0-mini` 死配置（等用户拍板）、「视频延长」变长语义未验到（要一段**真实拍摄**的 8~10 秒短片）、
「失败趋势（近 30 天）」等数据自然长满（约 3 周）、**M041**（简繁转换改用户的字，用户拍板先记不做）、
M037 / M032 / M038 / M039 等 —— 见下方各节与 `06-memo-tasks.md`。


---

## ⏪ 上一状态（2026-08-09 第五十九次会话末）：**本地 = 测试服 `v1.0.0.94`（未提交）；正式服 `v1.0.0.90`**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 | **`v1.0.0.94`** —— 本次**整批推**，「版本号一样 = 代码一样」这条约定**已修复** |
| 正式服 / GitHub | `v1.0.0.90` —— **v91 / v92 / v93 / v94 全都没上正式服** |
| ⚠️ 未提交 | 本地这一整批（含 v91~v94 的全部改动）**还没 commit** |

⭐ 本次 = **提示词「超字数不删字」全套改造**（细节在 `CHANGELOG_2.md` 顶条五节）：
① 去掉 5 类静默截断，只留 99999 安全网；② 计数器**独立占一行、居右、11px 灰字**（对话流/工作流加高一行，资产库不加高）；
③ 5 个按钮超限灰掉 + **通用黑底提示框**「当前模型提示词只支持XXXX字！」；④ 发送入口 4 处兜底；
⑤ 服务端 `/api/image`+`/api/video` **只记日志不拦**（`prompt-length-over-limit`）；
⑥ 顺带把 `BlackHoverTooltip` 收敛成 `src/components/black-hover-tooltip.tsx`（唯一实现，core 里再导出）。

⛔⛔ **本次按用户要求「不要测试」→ 测试服一次界面都没走过**，只验了活着
（`/api/health` = v94、`x-app-version` = v94、`/api/announcement` 带 no-store、外网 8080 = 200）。

---

## ✅【已完成，第六十次会话做掉了】原待办 1：真走界面验 v94 这一批

> ⛔ 别再照下面这份清单重做 —— 4 个落点 × 5 件事已在测试服**全部真机验过**（结果见本文件顶部「当前状态」
> 与 `CHANGELOG_2.md` 顶条第二~三节）。下面只作历史留档。

⭐ `AGENTS.md` 铁律：**只测纯函数/接口不作数**。4 个落点 × 5 件事：

| 落点 | 要验 |
|---|---|
| 对话流输入框 | ① 计数器只在有内容时出现、始终占一行不跳高 ② 超限数字变红 ③ **粘贴长文一个字都不丢** ④ 发送键灰掉 ⑤ hover 出黑底「当前模型提示词只支持XXXX字！」 |
| 资产库生成框 | 同上；⭐ 额外确认**卡片总高没变**（只是输入区往下移一行）；失败卡上的「重新生成」也要灰 |
| 工作流节点 | 同上；⭐ 计数器显示的是**合计**（输入框 + 连接的文本节点）；回车超限有红字 |
| 图片/视频快捷编辑 | 同上；⭐ 重点验**粘贴**（原生 `maxLength` 已去掉，以前粘贴会被浏览器静默砍） |

⭐ 顺带核对：切换模型时上限跟着变（2.0 系 3500 / 2.5 = 14500 / 其余 2000）；后台「上传规则 → 文字」列改数字后前台生效。
⚠️ 测试号一律 `12424740@qq.com` / `dragonstar`；入口 `http://101.37.129.164:8080/`。

## ✅【已完成，第六十次会话做掉了】原待办 2：commit + v91~v94 整批上正式服

> ⛔ 已完成：commit `6839819` + push、正式服已是 `v1.0.0.94`、巡检全过、公告响应头已确认带 no-store。
> 下面只作历史留档。

- ⚠️ 顺序：**先做完待办 1 → 用户拍板 → 再上正式服**（⛔ 别把一次界面都没测过的代码推正式服）。
- 无 Prisma 迁移、无 compose/nginx 改动。
- ⭐ 上正式服后必须核对：`curl -sI https://main.venusface.com/api/announcement` **有 Cache-Control**；
  后台「上传规则」页 2.0 那行 9/3/3、2.5 那行 30/10/10、**「文字」列 2.5 显示 14500**；
  三个 2.5 开关（视频生成=开、**Agent=关**、快捷编辑四选=开）。
- ⚠️ **要提醒用户强刷一次（Ctrl+F5）** —— 他链路上那份旧公告副本可能还没过期。
- ⛔ 公告相关的功能测试全部跳过（正式服禁测公告）。

## 🎯🎯 待办 3：「间断性卡死」bug —— **证据链已完整，可以开始静态定位了**

见下方「上一状态」那一节里的完整证据（三条 client 诊断事件 + 服务端同 requestId 是 `image-job-success`）。
⭐⭐ 最硬的线索 = `byLoadingSessionIds:false` + `pendingRequestCount:0`（**死锁态**）。
→ 下一步是**纯读代码的静态定位**：找出「哪条路径会让会话被移出 loading 集合但没把 `messagesLoaded` 置 true」。
⛔ 定位到之前仍然只许加日志、不许改行为。

## 🎯 待办 4：观察 `prompt-length-over-limit` 的真实规模，再决定要不要开服务端拦截

- 判据一行：`grep -c '"prompt-length-over-limit"' .runtime/generation-diagnostics-log.jsonl`（两服都看）。
- 用户当时选的是「先只记日志观察几天」；量很小 = 可以考虑真拦，量大 = 说明某个模型默认值配小了，先调默认值。

## 🎯 待办 5：老待办原样保留

Agent 的 `agent-video.seedance-2-0-mini` 死配置（等用户拍板）、「视频延长」变长语义未验到（要一段**真实拍摄**的 8~10 秒短片）、
「失败趋势（近 30 天）」等数据自然长满（约 3 周）、M040 / M037 / M032 等 —— 见下方各节。

## ✅ 本次已查清、用户拍板「不用改」的事（⛔ 别再重复排查）

**对话流视频卡「一直显示资产保存中」** —— **不是 bug，是本地环境**：
BytePlus 出片成功，但**本地跨境下载超时失败 12 次**（`This operation was aborted`），
且**本地 dev server 10:25 就停了**（worker 只跑在 app 进程里）→ job 冻在 `running/attempts=300`。
⭐ 机制、线上为什么不会这样、以及"本地不用改库、起 dev 就会自愈"的完整结论写在 `CHANGELOG_2.md` 顶条第四节。
⭐ 存盘队列在 **`.runtime/media-save-jobs.json`**（不在数据库），本地 203 条里只有这 1 条失败。

---

## ⏪ 上一状态（2026-08-09 第五十八次会话末）：**本地 `v1.0.0.93` + 未提交改动；测试服 `v1.0.0.93`（只有一半）；正式服 `v1.0.0.90`**

| | 版本 / 状态 |
|---|---|
| 本地 | `v1.0.0.93` + **一批未提交改动**（按模型字数 + 图标收敛 + 表格改列）；`tsc` 0、`npm test` 15/15 |
| 测试服 | `v1.0.0.93`，**只含 `src/proxy.ts` 的 no-store 修复**（部署时只 scp 了 proxy.ts + app-version.ts）|
| 正式服 / GitHub | `v1.0.0.90` —— **v91 / v92 / v93 全都没上正式服** |

⛔⛔ **注意：本地 v93 ≠ 测试服 v93**，本次破坏了「版本号一样 = 代码一样」这条核心约定。
⭐ **下次部署前必须先 `node scripts/bump-version.mjs`（→ v94）**，⛔ 别再往 v93 上叠代码。

⭐ 本次干了三件事，细节在 `CHANGELOG_2.md` 顶条（八节）：
① **修掉正式服公告「刷新就变回旧文案」** —— 根因是 `/api/announcement`、`/api/auth/me` 的响应
**一个 `Cache-Control` 都没有**，被用户链路上的透明代理缓存了（已在 `src/proxy.ts` 统一加 no-store，
新立铁律在 `AGENTS.md` 最顶部）；
② **提示词字数上限做成「按模型可配」**（后台「上传规则」页新增「文字」列，2.0 系默认 3500、2.5 默认 14500）；
③ 顺手把**存了三份且已漂移**的「模型 → 图标」映射收敛成 `src/components/model-icon.tsx`。

---

## ✅【已完成，2026-08-09 第五十九次会话做掉了】原待办 1：前端「字数拦截」改造

> ⛔⛔ **别再照下面这份计划动手** —— 已经全部实现并部署测试服 v1.0.0.94。
> ⭐ 实际做法与用户后来追加的口径（计数器**独立占一行**而不是浮在右上角、
> 黑底提示框文案「当前模型提示词只支持XXXX字！」、服务端**只记日志不拦**）见
> `CHANGELOG_2.md` 顶条第一~二节，以及上面的「待办 1：真走界面验 v94 这一批」。
> ⭐ 下面这一段**只作为历史留档**（记录当时是怎么把行号查好、准备怎么改的）。
> ⚠️ 与最终实现的两处差异：① Q1 用户选的是**加高一行**（不是留白 76px 也不是半透明浮层）；
> ② `getPromptLengthTipText` / `getWorkflowPromptLengthTipText` 最终是**删掉**而不是改口吻。

## 🗄️（历史留档）原待办 1 的实施计划：前端「字数拦截」改造

🗣️ **用户已拍板的三条口径（⛔ 别再自己发明方案）**：
1. **学即梦：不删字** —— 打字/粘贴都允许超出上限，字**全留在框里**让用户自己删；超了报错并**拦住发送**；
2. **要计数器**，但**只在用户输入（框里有内容）时才显示**；位置 **输入框内右上角**、**灰字**、**字号比正文小一点**；
3. **超限时发送/生成按钮灰掉禁用 + 悬浮（title）说明原因**。

⭐ **参考对象即梦的实测数据**（我未登录实测出来的，可直接引用，⛔ 别再花时间重测）：
上限 20000；**不截断**（粘 25000 字全留）；**完全没有计数器**；超限弹**顶部居中 toast**
「文字描述超过了 20000 字符」约 3 秒消失；**发送按钮不禁用**；输入框固定 96px 高 + 自己滚动。
⚠️ 即梦 `/ai-tool/generate` 要登录、**没测到**，那里可能另有表现 → 可问用户。

### 🗳️ 先问用户这两个问题（⛔ 上一轮已经问了但会话结束，没拿到答复）

- **Q1 计数器留白**：计数器浮在「输入框内右上角」会压到第一行文字（我们的文字从左上开始且会换行）。
  - **A（上一轮我推荐的）**：给编辑区留一条固定右侧留白（对话流约 76px、工作流节点约 60px），
    计数器浮在留白里 → 永不重叠、不跳动；代价是输入区窄 76px。
  - **B**：不留白，计数器半透明浮在文字上 → 不占宽度，但长文第一行会被盖住一点。
- **Q2 服务端要不要拦**：前端不截断后，超限文本**真的可能到达后端**（切模型后草稿超限、程序化提交、直调接口）。
  - ① 直接拦（`/api/image`、`/api/video` 按 `getPromptMaxLength` 校验 `sourcePrompt`，超了返回明确红字）
  - ② 先只记诊断日志不拦，观察几天再开
  - ③ 不动

### 实施计划（行号都已查好，直接按这个改）

**① 文案与判定收敛到 `src/lib/prompt-length.ts`（唯一权威，⛔ 别在组件里写）**
新增/改写：`isPromptOverLimit(text, maxLength)`（按 `Array.from` 数字符）、
`formatPromptCounter(used, maxLength)` → `"1234 / 3500"`、
`getPromptOverLimitTipText(used, maxLength)` → 「提示词已超过 3500 字（当前 3712 字），请删减后再发送」、
`getWorkflowPromptOverLimitTipText(...)` → 「输入框和连接文本合计已超过 N 字…请删减后再生成」。
⭐ 现有的 `getPromptLengthTipText` / `getWorkflowPromptLengthTipText` 是"已截断"口吻，要改成"已超出"。

**② 去掉 5 处静默截断**（保留一个 `PROMPT_MAX_LENGTH_CEILING = 99999` 的**安全网**，
超过它才硬截断 —— 防止粘 50 万字把 contenteditable 和"草稿存库"搞崩）

| 文件 | 位置 | 改法 |
|---|---|---|
| `src/lib/chat/chat-workbench-core.tsx` | `PlainMentionEditor.commitInput`（约 L5378）| 不再 `slice(0,maxLength)`，只在超 99999 时截断；超限仍调 `onLimit()`（`showInputTip` 自带去重，不会刷屏）|
| `src/components/chat-workbench.tsx` | `setActiveDraftInput` / `setActiveDraftInputWithMentionCards`（约 L2071-2079）| 去掉 slice |
| 同上 | `addActiveUploadedImages`（约 L2314）/ `addActiveUploadedMediaReference`（约 L2359）| 去掉 slice（插 @名 绝不能删用户的字）|
| 同上 | `insertAssetReference`（约 L7705）/ `insertCharacterReferenceText`（约 L7718）+ 4 处 `focusEditorAt(Math.min(max, …))` | 去掉上限钳制，光标按真实长度定位 |
| `src/components/workflow-tldraw-canvas-inner.tsx` | `WorkflowMentionEditor.commitInput`（约 L6083）+ `insertReferenceText`（约 L6367）| 同上 |
| 同上 | 快捷编辑 `<textarea maxLength=…>`（约 L2731）| **去掉原生 `maxLength`**（它会让粘贴被浏览器静默砍掉）→ 受控 + 超限报错 |

**③ 计数器：新增 `src/components/prompt-length-counter.tsx`（三处共用，⛔ 别各写一份）**
- 显示时机：**框里有内容才渲染**（空的时候完全不出现）；超限时**强制显示**且数字变红 `text-red-500`。
- 样式：`absolute right-3 top-2 z-20 pointer-events-none text-[11px] text-[#aaaaaa]`
  （项目里现有的计数类文本是 `text-[12px] text-[#888]`，见 `chat-workbench.tsx:9225`「已选 N 项」，再降一档）。
- 落点：对话流 **`chat-workbench.tsx:9832` 那个 `<div className="relative">`**（已有 relative；
  ⚠️ 里面已有 placeholder `absolute left-2 top-1 z-20` 和 @资产选择器 `absolute bottom-full left-2 z-50`，
  放右上角不冲突但 z-index 要 ≥ 20）；资产库生成框同理；
  工作流放 **`WorkflowMentionEditor` 内部约 L6129 的 `<div className="relative">`**（贴编辑区，别贴整张卡片）。
- ⭐ 工作流显示的是**合计**（输入框 + 连接的文本节点），因为限制本身是合计。

**④ 按钮灰掉 + title**

| 按钮 | 位置 | 改法 |
|---|---|---|
| 对话流发送 | `chat-workbench.tsx:10030`（disabled 表达式在 **L10033**）| 追加 `\|\| isPromptOverLimit`；**新加 `title`**（现在只有 `aria-label`，没有 title）|
| 资产库生成图片 | `chat-workbench.tsx:10280`（disabled = `!characterGeneratePrompt.trim() \|\| isCharacterGenerateInputDisabled`）| 同上；⚠️ 另有一个预览区中央的次级触发在 **L10123**（**目前无 disabled**，也要一起处理）|
| 工作流节点运行 | `workflow-tldraw-canvas-inner.tsx:6779`（`disabled={!canRun}`）；`canRun` 定义在 **L6302** | `canRun` 追加 `&& !overLimit`；按钮加 title |
| 快捷编辑发送 | 约 L2731 附近 | 同上 |

**⑤ 发送入口再兜一道**（防回车 / 程序化调用绕过按钮）
- `sendMessage`（`chat-workbench.tsx:6150`）：在「请输入提示词！」那条守卫（**L6163**）**之后**插一条超限守卫 → `showInputTip` + return。
  ⚠️ 注意 `rawText` 为空那条守卫**只对 image/video 生效**，agent/general 靠按钮 disabled 拦。
- `generateCharacterImage`（`chat-workbench.tsx:7873`）：同样加一条。
- `runFromPromptBox`（`workflow-tldraw-canvas-inner.tsx:6321`，第一句就是 `if (!canRun) return;`）：靠 `canRun` 覆盖；
  ⭐ 工作流原有的「连线时拦」（约 L4103/L4120/L4147/L4176/L4226）和「跑之前校验」（约 L4403/L4548/L4652）**原样保留**当兜底。

**⑥ 验证**
1. 扩写 `.runtime/verify-prompt-length.ts`：加 `isPromptOverLimit` / `formatPromptCounter` / 三句文案，
   边界必测「**正好等于上限不算超限**、超 1 字算、emoji 算 1 个字、安全网 99999」。
2. `tsc` + `npm test` + 改动文件 eslint 零新增。
3. ⭐⭐ **必须真走界面**（`AGENTS.md` 铁律）：bump → 部署测试服 → 在
   **对话流 / 资产库生成 / 工作流节点 / 图片视频快捷编辑** 这 4 处各验 5 件事 ——
   计数器出现时机、超限变红、**粘贴长文不丢字**、发送键灰掉、hover 有说明。
   ⛔ 只测纯函数/接口不作数。

## 🎯🎯 待办 2：v91 + v92 + v93 上正式服（正式服目前还带着公告 bug）

⚠️ 顺序：**先把待办 1 做完（或用户明确说先只上缓存修复）→ bump → 部署测试服 → 再上正式服**。
⛔ 别直接把本地这批未提交代码推正式服（它一次界面都没测过）。

- 这批包含：v91/v92（后台补齐 Seedance 2.5）+ v93（API no-store 修复）+ 本地未提交的字数/图标改动。
- 无 Prisma 迁移、无 compose/nginx 改动。
- ⭐ 上正式服后必须核对：`curl -sI https://main.venusface.com/api/announcement` **有 Cache-Control**；
  后台「上传规则」页 2.0 那行 9/3/3、2.5 那行 30/10/10；三个 2.5 开关（视频生成=开、**Agent=关**、快捷编辑四选=开）。
- ⚠️ **要提醒用户强刷一次（Ctrl+F5）** —— 他链路上那份旧公告副本可能还没过期。
- ⛔ 公告相关的功能测试全部跳过（正式服禁测公告）。

## 🎯🎯 待办 3：「间断性卡死」bug —— **证据链已完整，可以开始静态定位了**

2026-08-09 在测试服 `upload-diagnostics-log.jsonl` 里第一次抓到全套现形：

```
client-chat-send-suspicious-session-shape
  {"sessionId":"54ccae5d-…","generationMode":"image","messagesLoaded":false,
   "localMessageCount":1,"titleLength":3,"requestId":"9222941f-bd71-4bdd-ad16-dc3ddaf35cf9"}

client-chat-session-stuck-loading
  {"sessionId":"54ccae5d-…","byMessagesLoadedFalse":true,"byLoadingSessionIds":false,
   "localMessageCount":0,"titleLength":3,"pendingRequestCount":0}

client-chat-put-session-shape-suspicious  ×25
  {"activeSessionId":"54ccae5d-…","count":1,"sessions":[{"messageCount":1~2,"titleLength":19}]}
```

而服务端 `generation-diagnostics-log.jsonl` 里同一个 requestId 是 **`image-job-success`**（图真的生成成功、真的扣了积分），
只是前端永远停在「加载中…0%」、消息一条没存。

⭐⭐ **最硬的线索是 `byLoadingSessionIds:false` + `pendingRequestCount:0`** ——
这个会话**既没加载完、又不在"正在加载"集合里、也没有在飞的请求** = **死锁态**。
→ 下一步是**纯读代码的静态定位**：找出「哪条路径会让会话被移出 loading 集合但没把 `messagesLoaded` 置 true」
（abort / 提前 return / 竞态覆盖）。⛔ 定位到之前仍然只许加日志、不许改行为。
⭐ 修好后**顺带要治第二个伤**：这个状态下的自动保存会用 `messageCount:1` 的空快照去 PUT
（25 条 `put-session-shape-suspicious` 就是它），**这才是"消息没存"的直接原因**。

## 🎯 待办 4：Agent 的 `agent-video.seedance-2-0-mini` 死配置（等用户拍板）

它在 `DEFAULT_MODEL_PROVIDER_PREFERENCES` 和 `DEFAULT_BYTEPLUS_MODEL_SELECTIONS` 里都有，
但**不在 `BYTEPLUS_AGENT_VIDEO_MODEL_KEYS` 里** → 那两条配置目前完全不生效。
⛔ 往 KEYS 里加会让 Mini **立刻**对 Agent 生效（偏好表里默认 byteplus）= 行为变更，所以没动，代码里已写注释钉住。

## 🎯 待办 5：「视频延长」的**语义**（输出比源视频长）仍未验到

功能端到端已验通（30 秒源视频真出片、扣 581 分、无红字），但"变长"没验到：
30 秒源视频本身就是上限（选错素材）；8 秒那次用 ffmpeg `testsrc2` + `sine` 合成素材，被上游**成品审核**拒了。
⭐ 下次用**一段真实拍摄的 8~10 秒短视频**再跑一次，⛔ 别再用合成测试素材。

## 🎯 待办 6：「失败趋势（近 30 天）」等数据长出来

保留期已 31 天，但正式服已被删的历史找不回来 → 约 3 周后才会长满。
判据是**图能渲染 30 根柱 + 图例写着「保留 31 天」**，⛔ 别把"柱子不满 30 天"当成没修好。

## 🎯 待办 7：老待办原样保留

M040、M037、M032 等 —— 见下方各节。

---

## ⏪ 上一状态（2026-08-09 第五十七次会话末）：**测试服 `v1.0.0.92`、正式服 `v1.0.0.90`**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 | `v1.0.0.92`；`tsc` 0、`npm test` 15/15 |
| 正式服 / GitHub | `v1.0.0.90` |
| ⚠️ 未提交 / 未上正式服 | **v91 + v92（后台补齐 Seedance 2.5）** |

⭐ 本次 = 后台补齐 Seedance 2.5（上传规则独立 override key + Agent 视频开关 + 快捷编辑链四选）。
细节在 `CHANGELOG_2.md` 顶条（八节）。

---

## 🎯🎯🎯 待办 1（最优先）：v91 + v92 上正式服 + commit

改动 8 个文件，**无迁移、无 compose/nginx 改动**：

```
src/lib/app-version.ts
src/lib/models.ts                                 # 新增 SEEDANCE_25_VIDEO_MODEL_ID
src/lib/upload-rules.ts                           # 2.5 独立 override key（核心）
src/lib/system-settings.ts                        # Agent 2.5 开关 + 端点 + 快捷编辑链加 2.5
src/lib/chat/chat-workbench-core.tsx              # Agent 高级档候选链 [2.5, 2.0]
src/components/workflow-tldraw-canvas-inner.tsx   # 快捷编辑链副本
src/app/admin/admin-upload-rules-panel.tsx        # 6 行可编辑 + 2.5 只读行
src/app/admin/admin-system-settings-panel.tsx     # Agent 2.5 行 + 四选文案
```

⭐ 上正式服后**必须去后台核对三个 2.5 开关的状态**（这是"默认行为不变"的判据）：
「视频生成」组 = 开、「Agent 自动生成视频」= **关**、快捷编辑链「四选」= 开（但在最后一位）。
⭐ 再核对「上传规则」页 2.5 融合那行默认是 **30 / 10 / 10**（2.0 那行仍 9 / 3 / 3）。
⛔ 公告那几项跳过（正式服禁测公告）。

## 🎯🎯 待办 2：「间断性卡死」bug —— **证据链已完整，可以开始定位代码了**

2026-08-09 在测试服 `upload-diagnostics-log.jsonl` 里第一次抓到全套现形（那 4 条诊断日志起作用了）：

```
client-chat-send-suspicious-session-shape
  {"sessionId":"54ccae5d-…","generationMode":"image","messagesLoaded":false,
   "localMessageCount":1,"titleLength":3,"requestId":"9222941f-bd71-4bdd-ad16-dc3ddaf35cf9"}

client-chat-session-stuck-loading
  {"sessionId":"54ccae5d-…","byMessagesLoadedFalse":true,"byLoadingSessionIds":false,
   "localMessageCount":0,"titleLength":3,"pendingRequestCount":0}

client-chat-put-session-shape-suspicious  ×25
  {"activeSessionId":"54ccae5d-…","count":1,"sessions":[{"messageCount":1~2,"titleLength":19}]}
```

而服务端 `generation-diagnostics-log.jsonl` 里同一个 requestId 是 **`image-job-success`**
（图真的生成成功、真的扣了积分），只是前端永远停在「加载中…0%」、消息一条没存。

⭐⭐ **最硬的那条线索是 `byLoadingSessionIds:false` + `pendingRequestCount:0`** ——
它说明这个会话**既没加载完（messagesLoaded=false）、又不在"正在加载"的集合里、也没有在飞的请求**
= **死锁态：没有任何人会再把 messagesLoaded 置成 true**。
→ 下一步该做的是**静态定位**：去读加载消息那段代码，找出「哪条路径会让会话被移出 loading 集合
但没把 messagesLoaded 置 true」（例如 abort / 提前 return / 竞态里被覆盖）。
⭐ 这一步是纯读代码就能定案的，⛔ 定位到之前仍然只许加日志、不许改行为。
⭐ 修好之后**顺带要治的第二个伤**：这个状态下的自动保存会用 `messageCount:1` 的空快照去 PUT
（25 条 `put-session-shape-suspicious` 就是它），**这才是"消息没存"的直接原因**。

## 🎯 待办 3：Agent 的 `agent-video.seedance-2-0-mini` 死配置（等用户拍板）

它在 `DEFAULT_MODEL_PROVIDER_PREFERENCES` 和 `DEFAULT_BYTEPLUS_MODEL_SELECTIONS` 里都有，
但**不在 `BYTEPLUS_AGENT_VIDEO_MODEL_KEYS` 里** → 那两条配置目前完全不生效。
⛔ 往 KEYS 里加会让 Mini **立刻**对 Agent 生效（偏好表里默认是 byteplus）= 行为变更，所以没动，
已在代码里写注释钉住。要不要接，问用户。

## 🎯 待办 4：「失败趋势（近 30 天）」等数据长出来

保留期已 31 天，但正式服已被删的历史找不回来 → 约 3 周后才会长满。
判据是**图能渲染 30 根柱 + 图例写着「保留 31 天」**，⛔ 别把"柱子不满 30 天"当成没修好。

## ~~🎯 待办：正式服 3 条 localhost:3000 死链~~ ✅ 已核查，**原定性是错的**

正式库 public schema **全部 202 个 text/varchar/json/jsonb 列**逐列扫 `%localhost:3000%` →
**零命中**（`MediaAsset` 四个 url 列也单独查过，全 0）。
⛔ **不是脏数据，别再照交接文档写清库脚本。** 源码里 `localhost:3000` 只出现在 OpenRouter 的
`HTTP-Referer` 和几处 CORS 白名单 → 那 3 条 error 是运行时拼出来的。
⭐ 下次真在正式服前台复现到它，先记下**出现它的页面 + userId + 完整 url** 再查。

## 🎯 待办 5：「视频延长」的**语义**（输出比源视频长）仍未验到

功能端到端已验通（30 秒源视频真出片、扣 581 分、无红字），但"变长"没验到：
- 30 秒源视频 → 输出上限就是 30，不可能变长（选错素材）；
- 8 秒源视频那次被上游**成品审核**拒了（`(B_2) …成品视频/音频因版权或敏感内容被平台拒绝交付`，不扣分）
  —— 因为我用的是 ffmpeg `testsrc2` 测试图案 + `sine` 正弦音，正弦音容易被判成音乐/版权。
⭐ 下次用**一段真实拍摄的 8~10 秒短视频**再跑一次即可，⛔ 别再用合成测试素材。

## 🎯 待办 6：老待办原样保留

M040、M037、M032 等 —— 见下方各节。

---

## ⏪ 上一状态（2026-08-09 第五十六次会话末）：**测试服 = 正式服 = `v1.0.0.90`**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 = 正式服 | `v1.0.0.90`；`tsc` 0、`npm test` 15/15；四域名 200；无待应用迁移 |
| GitHub | 见本次 commit |

⭐ 本次 = 「参考素材单条时长上限按模型（2.5 = 2~30 秒 / 2.0 = 2~15 秒）+ 拦截文案带上区间」，
并把上次攒着的 v88/v89 一起上了正式服。细节在 `CHANGELOG_2.md` 顶条（七节）。

---

## 🎯 待办 1：Seedance 2.5「**视频延长**」仍未真跑端到端（两次会话都欠着）

「视频编辑」已真出片过。**「视频延长」只验过 UI**。在测试服跑一次：
2.5 + 选「视频延长」→ 传 1 个参考视频 + 提示词「延长@视频1，继续故事」→ 确认出片、时长比源视频长。
约几分钟、花积分。

## 🎯 待办 2：「间断性卡死」老 bug 又现形了一次（有新线索，值得去捞日志）

2026-08-09 测试服 v90 巡检时：**第一次**发生图整屏卡「加载中…0%」、**消息一条没存**、
但**积分扣了 3 分**；刷新后那条对话里什么都没有；**紧接着第二次完全正常出图**。
- ⭐ 时间点：**2026-08-09 06:1x UTC，测试服用户 ID_535317**，提示词「v90巡检：一只白色小狗坐在草地上，阳光明媚」。
- 去测试服 `/opt/flashmuse-staging/data/runtime/*-diagnostics-log.jsonl` 按这个时间窗和提示词捞
  （`client-*` 事件要看 `PERSISTED_CLIENT_EVENTS` 有没有收；见 `AGENTS.md` 那条铁律）。
- ⛔ **按铁律：没复现稳定之前只许加日志，不许改行为。**

## 🎯 待办 3：「失败趋势（近 30 天）」要等数据长出来

保留期已从 7 天改成 31 天，但正式服已被删的历史找不回来 → 约 3 周后那张图才会真正长满 30 天。
判据是**图能渲染 30 根柱 + 图例写着「保留 31 天」**，⛔ 别把"柱子不满 30 天"当成没修好。

## 🎯 待办 4：正式服 3 条历史 console error（低优先，非本批引入）

老资产 poster 地址存成 `https://localhost:3000/generated/...` → `ERR_SSL_PROTOCOL_ERROR`（用户 ID_636611）。
要清就写一次性脚本把 `MediaAsset` 里带 `localhost:3000` 的 url 前缀改成相对路径，
⛔ 动前先 dry-run 数条数、⛔ 只改自己确认过的那些行。

## 🎯 待办 5：老待办原样保留

M040、M037、M032 等 —— 见下方各节。

---

## ⏪ 上一状态（2026-08-09 第五十五次会话末）：**测试服 `v1.0.0.89` / 正式服 `v1.0.0.87`**

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 | `v1.0.0.89`；`tsc` 0、`npm test` 15/15 |
| 正式服 | `v1.0.0.87` |
| GitHub | `v1.0.0.87`（commit `a1a6e81` + 交接 `acc1981`）|

⭐ 本次会话四段（整批上两服 / 修失败趋势保留期 / 公告禁测铁律 / edit-extend 上传按钮收敛）
全部细节在 `CHANGELOG_2.md` 顶条（九节），摘要在 `01-current-status.md` 顶条。

---

## ~~🎯🎯🎯 待办 1（最优先）：**v88 + v89 未 commit、未上正式服**~~ ✅ **已于第五十六次会话随 v90 一起上正式服并提交**

这批 = 「Seedance 2.5 视频编辑/延长的上传按钮按支持能力收敛」+ 顺手修的 4 个同类问题 + 对话流单选。
测试服 v89 已真机验通（规则矩阵 29/29 + 真走界面 + 服务端日志坐实 + 视频编辑真出片）。

**改动文件（只有 5 个，都是前端规则 + 服务端兜底）**：

```
src/lib/app-version.ts
src/lib/upload-rules.ts                              # 唯一权威：edit/extend 只开 video maxCount 1 + 独立 override key
src/lib/openrouter-video.ts                          # 服务端兜底：mediaMax=1、audios 清空
src/lib/video-reference-modes.ts                     # 菜单描述写明「只支持 1 个参考视频」
src/components/workflow-tldraw-canvas-inner.tsx      # 数字 1-1→1、单选
src/components/chat-workbench.tsx                    # 对话流 file input 单选
```

⚠️ **无新 Prisma 迁移、无 compose/nginx 改动** → 上正式服**不需要**再跑库备份（但跑一次也不亏）。
流程：备份 `app/` → staging→prod rsync（**不再 bump**）→ `up -d --build` →
`docker cp .next/static` 推阿里正式镜像（数量必须一致）→ 置 `PUBLISHED_APP_VERSION=v1.0.0.89` + `force-recreate`
→ 四域名 200 → **真上号巡检 6 项**（⛔ 公告那几项跳过，见 `AGENTS.md` 新铁律）。

⭐ 正式服巡检时顺带确认：2.5 选「视频编辑」后**只剩「视频 1」一个上传按钮**。

## 🎯 待办 2：Seedance 2.5「**视频延长**」仍未真跑端到端

「视频编辑」本次已真出片（跟随源视频 720p/5秒/1280x720，扣 97 分）。
**「视频延长」只验了 UI（按钮收敛正确），没真出过片。** 在测试服跑一次：
传 1 个参考视频 + 提示词写「延长@视频1，继续故事」→ 确认能出片、时长比源视频长。约几分钟、花积分。

## 🎯 待办 3：「失败趋势（近 30 天）」要等数据长出来

保留期已从 7 天改成 31 天（`scripts/cleanup-old-data.mjs` 的 `EVENT_RETENTION_DAYS`），
但**正式服已被删的历史找不回来** → 约 3 周后那张图才会真正长满 30 天。
⛔ 期间别把「柱子还是不满 30 天」当成没修好；判据是**图能渲染 30 根柱 + 图例写着「保留 31 天」**。

## 🎯 待办 4：正式服 3 条历史 console error（低优先，非本批引入）

老资产 poster 地址存成 `https://localhost:3000/generated/...` → `ERR_SSL_PROTOCOL_ERROR`。
要清就写个一次性脚本把 `MediaAsset` 里带 `localhost:3000` 的 url 前缀改成相对路径，
⛔ 动前先 dry-run 数条数、⛔ 只改自己确认过的那些行（别按类型整批 UPDATE）。

## 🎯 待办 5：老待办原样保留

那个「间断性卡死」bug（4 条诊断日志已上线，等它再现形）、M040、M037、M032 等 —— 见下方各节。

---

## ⏪ 上一状态（2026-08-09 第五十四次会话末）：**测试服 `v1.0.0.85`；本地又多了两批改动（去非标 / 走马灯）**

| | 版本 / 状态 |
|---|---|
| 本地 | `v1.0.0.85` **+ 两批未部署改动**（Seedance 2.5 去非标 / 公告单行走马灯）；`tsc` 0、`npm test` 15/15；**全部未 commit** |
| 测试服 | `v1.0.0.85`（含 50~53 批 + 本次审查 5 处修复；⛔ 不含去非标与走马灯）；5 个公告迁移已应用 |
| 正式服 / GitHub | 仍 `v1.0.0.82` |

⭐ 本次三段工作的全部细节（十一节）在 `CHANGELOG_2.md` 顶条；摘要在 `01-current-status.md` 顶条。

---

## 🎯🎯🎯 待办 1（最优先，用户已明确交代「下一个 AI 要部署掉」）

### 第一步：部署测试服

⛔ **必须先 bump**：`node scripts/bump-version.mjs`（v85 → **v86**）。
本地代码已超过测试服 v85，⛔ 不许原地覆盖已部署的版本号（会破坏"版本号一样 = 代码一样"这个核心判据）。

**本批要打进 tgz 的文件（本次两批改动只碰了这 5 个）**：

```
src/lib/app-version.ts
src/lib/models.ts                              # Seedance 2.5 去掉 nonStandardSizes
src/components/announcement-banner.tsx         # AnnouncementBar 共用组件 + 走马灯
src/app/admin/admin-announcement-panel.tsx     # 预览复用 AnnouncementBar + 铺满内容区
src/app/globals.css                            # 走马灯 keyframes
```

⚠️ **无新 Prisma 迁移**（公告那 5 个迁移测试库早已应用）、无 compose/nginx 改动。
流程照 `03-deploy-and-servers.md`「测试服部署流程」：打包 → scp → 解包后 `grep` 确认版本号在服务器源码里 →
后台 build（约 2~4 分钟，轮询 `tail`）→ `sync-ali.sh --stack=staging` → 写 `PUBLISHED_APP_VERSION` + `force-recreate`
→ 验 `/api/health` 的 version + `x-app-version` + 8080/https 200。

### 第二步：测试服真机必测（这两批的验收）

1. **公告走马灯**：后台「顶部公告」输入一条**长文案**（超过一行）→ 预览条应变走马灯、**高度仍 50px、不换行**；
   开启后前台横幅同样走马灯，**匀速 30px/秒**、首尾空一段、**无缝相接**。
2. **短文案**：静态居中、不滚动。
3. ⭐ **窄屏（拉窄到手机宽度）**：滚动文字**绝不能压在 × 上**（这是本次修的真 bug，必须回归）。
4. ⭐ **后台预览拉窄浏览器要铺满右侧**（不能露出灰底）—— 用户专门提过两次。
5. **Seedance 2.5 不再显示「非标」**：对话流选 2.5 + 480p/16:9，参数条应是 `854 × 480`（⛔ 后面不带「（非标）」）；
   ⭐ 反向确认 2.0 Fast 的 480p 仍显示「（非标）」。
6. **巡检 6 项**（`03-deploy-and-servers.md`「部署铁律」）：登录 / 对话模式 / 工作流点节点不崩 / 资产库 /
   真跑一次生图 / 后台 console 0 error。

### 第三步：上正式服（用户说"部署掉"通常含正式服，⭐ 但动手前跟他确认一句）

⛔⛔ **先跑正式库备份**（本批合计带 **5 个 Prisma 迁移**：公告 3 张表；迁移单向、代码能回滚库不能）：

```bash
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh --stack prod --label pre-deploy
```

然后按流程：备份 `app/` → staging→prod rsync（**不再 bump**）→ `up -d --build` →
`docker logs` 确认 **5 个迁移都 Applying** → `docker cp .next/static` 推阿里**正式**镜像 `flashmuse-static`（数量必须一致）
→ 写 `PUBLISHED_APP_VERSION` + `force-recreate` → 四域名 200 → **正式服也上号巡检 6 项**。
⚠️ 正式服这一批跨度很大（v82 → v86）：**Seedance 2.5 全套 + 视频真实参数 + 顶部公告 + 本次两批**，
巡检要额外看：对话流/工作流视频参数显示正常、后台「顶部公告」页能打开。

### 第四步：commit + push

至今**一次都没提交**（最后一个 commit 是第 49 次会话）。攒了 50~54 五次会话的改动。
⛔ commit message 用 write 工具写进 `.runtime/commit-xx.txt` 再 `git commit -F`（PowerShell 没有 heredoc）。

---

## 🎯 待办 2：Seedance 2.5 的 edit/extend **仍未真跑端到端**

`ratio=adaptive` + `duration=-1` 已确认火山接受，但**"视频编辑""视频延长"两个模式没真出过片**。
上测试服后真跑一次编辑 + 一次延长（传参考视频 + 提示词写触发词），确认能出片、语义对。约几分钟、花积分。
顺带验：越界文案（传超大/超小/怪比例参考视频）弹的是大白话「视频尺寸太小或太大了…」「视频画面太宽或太窄了…」。

## 🎯 待办 3：老待办原样保留

那个「间断性卡死」bug（4 条诊断日志已上线，等它再现形）、M040、M037、M032 等 —— 见下方各节。

---

| | 版本 / 状态 |
|---|---|
| 本地 | `v1.0.0.83` **+ 一大批未提交改动（第 50/51 Seedance 2.5 + 第 52 视频参数 + 本次公告）**；`tsc` 0；⭐ 本次 5 个新迁移（公告 3 表）本地库已 deploy；无 compose/nginx 改动 |
| 测试服 | `v1.0.0.83`（不含以上）|
| 正式服 / GitHub | `v1.0.0.82` |

⭐ **本次全部细节 + 必测清单在 `CHANGELOG_2.md` 顶条（第五十三次会话，七节）。**

### 🎯🎯 待办 1（🗳️ 等用户拍板）：bump→v84 部署测试服？整批上正式服？commit？

⛔ 本次全在本地、未 bump、未测。要部署测试服**必须先 `node scripts/bump-version.mjs`（→v84）**。上正式服则把整批（Seedance 2.5 v83 + 视频参数 + 公告）一起同步。

### 🎯🎯 待办 2（公告功能真跑必测，部署后做）

1. 后台「顶部公告」输入文案 → 开启(二次确认) → 前台工作台 ~5 秒内自动出现横幅（`#e1ff67`/50px），样式对。
2. 点 × → 消失、刷新不再弹；后台「本次已关闭用户数量」+1。
3. 后台关闭(二次确认) → 前台 ~5 秒消失；发布历史多一条（时间/文案/关闭数）。
4. 再开一次 = 新记录、关闭数从 0；用户重新看到、可再关。
5. **首页**登录/未登录各看：都显示公告，**未登录没有 ×**。
6. workspace / 首页布局没被横幅挤乱、切页面横幅不消失。
- ⚠️ 首页无 5 秒轮询（进页面拉一次），后台改了首页要重进才更新（落地页够用）。

### 🎯 待办 3：老待办原样保留（本轮没动）

Seedance 2.5 待办（edit/extend 未真跑端到端、越界黑框文案是否更口语化）、视频参数第 52 次必测清单、间断性卡死 bug 等日志、M040、M037、M032 等 —— 见下方各节。

---

## ⏪ 上一状态（2026-08-09 第五十二次会话末）：**视频参数统一用真实值(服务端下发) + edit/extend 等待卡文案 + 越界文案大白话 + 修上传视频预览标签 —— 全在本地未部署**

| | 版本 / 状态 |
|---|---|
| 本地 | `v1.0.0.83` **+ 一批未提交改动（本次 8 文件，叠在第 50/51 次 Seedance 2.5 那批之上）**；`tsc` 0、`npm test` 15/15；无迁移、无 compose/nginx 改动 |
| 测试服 | `v1.0.0.83`（不含本次）|
| 正式服 / GitHub | `v1.0.0.82` |

⭐ **本次全部细节 + 必测清单在 `CHANGELOG_2.md` 顶条（第五十二次会话，七节）。**

### 🎯🎯 待办 1（🗳️ 等用户拍板）：bump→v84 部署测试服？commit？整批上正式服？

⛔ 本次全在本地、未 bump、未测。要部署测试服**必须先 `node scripts/bump-version.mjs`（→v84）**。上正式服则把整批（Seedance 2.5 v83 + 本次）一起同步。

### 🎯🎯 待办 2（真跑必测，都要花积分）：本次 4 件事的验收

1. **对话流 edit/extend**：等待期参数条（提示词下面那行，`MediaPromptBlock`）显示「`Seedance 2.5| 生成后自动获取参数，标准尺寸视频参数会跟随源视频`」→ 出片后切成真实尺寸/时长；普通视频参数正常。
2. **工作流 edit/extend**：节点标题等待期显示同一句 → 出片后切真实；普通视频节点比例/分辨率跟真实尺寸。
3. **越界文案**：传超大/超小/怪比例参考视频，弹的是「视频尺寸太小或太大了…」「视频画面太宽或太窄了…」大白话。
4. **资产库**：上传一个视频 → 点开预览 → 参数标签是「上传视频」（不是「上传图片」）。
5. **回归**：普通生图/生视频显示参数没跑偏、资产库图片显示正常。

### 🎯 待办 3：老待办原样保留（本轮没动）

见下方各节：Seedance 2.5 待办（edit/extend 未真跑端到端、越界黑框文案是否更口语化）、间断性卡死 bug 等日志、M040、M037、M032 等。

---

## ⏪ 上一状态（2026-08-09 第五十一次会话末）：**Seedance 2.5 接进工作流 + 后台开关 + edit/extend UI 收尾，已部署测试服 v83**（未 commit / 未上正式服）

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 | `v1.0.0.83`（第五十次会话 12 文件 + 本次 5 文件，均未提交）；`tsc` 0、`npm test` 15/15；无迁移、无 compose/nginx 改动 |
| 正式服 / GitHub | 仍 `v1.0.0.82`（Seedance 2.5 全套还没上正式服）|

⭐ **本次全部细节在 `CHANGELOG_2.md` 顶条（第五十一次会话，八节）。** 下一个 AI 继续 2.5 前先读它 + 第五十次会话那条。

### 🎯🎯 待办 1（🗳️ 等用户拍板）：commit + push + 上正式服？

测试服已是 v83（Seedance 2.5 接对话流+工作流+后台开关，功能已真跑验通）。上正式服 = 把 v83 **原样同步**（不再 bump），走部署铁律巡检。⛔ 目前**未 commit、未 push、正式服还是 v82**。

### 🎯 待办 2（🗳️ 等用户拍板）：参考视频上传越界的黑框文案要不要改口语化？

现在弹的是技术数字（「视频总像素需在 409600 到 8295044 之间」等），用户看不懂。用户问过要不要改成「视频尺寸太小/太大，请换一个」这类，**还没得到明确答复**，没动。（拦截逻辑本身两个流程都已实现且实测有效，见 `CHANGELOG_2.md` 第五节，别重做。）

### 🎯 待办 3：可选 cosmetic —— edit/extend 时节点标题/消息卡摘要仍显示「16:9/720p/5秒」

后端会强制忽略（adaptive/-1），只是显示误导，不影响功能。要改就把摘要在 edit/extend 时隐藏这几段。

### 🎯 待办 4：Seedance 2.5 已接**对话流 + 工作流**；Agent / 资产库仍未接（用户没要求）

### 🎯 待办 5：老待办原样保留（间断性卡死 bug 等日志、M040、M037、M032 等，见下方各节）

---

## ⏪ 上一状态（2026-08-09 第五十次会话末）：**Seedance 2.5 接进对话流视频，全在本地（未 commit / 未部署 / 未 bump）**

| | 版本 / 状态 |
|---|---|
| 本地 | `v1.0.0.82` + 一批未提交的 Seedance 2.5 改动（12 文件）；`tsc` 0、`npm test` 15/15；无迁移、无 compose/nginx 改动 |
| 测试服 / 正式服 / GitHub | 仍 `v1.0.0.82`（本次没动） |

⭐ **本次全部细节在 `CHANGELOG_2.md` 顶条（第五十次会话，八节）。下一个 AI 继续 Seedance 2.5 前先读它。**

### 🎯🎯 待办 1（最优先，两问）：commit + bump→v83 部署测试服？

本次把火山新模型 **Seedance 2.5** 接进了对话流视频（端点 `ep-20260807153703-h48pt`），全在本地。
- ⛔ 部署测试服**必须先 `node scripts/bump-version.mjs`（→v83）**（v82 已是四方基线，不许原地覆盖）。
- 12 个改动文件清单见 `CHANGELOG_2.md` 第八节。无 Prisma 迁移、无 compose/nginx 改动。

### 🎯 待办 2（🗳️ 用户还没答的交互决定）：视频编辑/延长时要不要隐藏「比例 + 时长」选择器？

选「视频编辑」「视频延长」这两个新模式时，UI 上比例/时长选择器**目前还显示**，但后端会忽略、强制 `ratio=adaptive`+`duration=-1`。我问过用户要不要隐藏，**还没得到答复**。要做就在 `chat-workbench.tsx` 的视频控件里按 `selectedVideoReferenceMode ∈ {edit,extend}` 隐藏这两个选择器。

### 🎯 待办 3：⚠️ 视频编辑/延长**没真跑过端到端**（上测试服后要真跑验一次）

`ratio="adaptive"`+`duration=-1` 已探测确认火山接受，但**真出片效果没验**。上测试服后真跑一次编辑 + 一次延长（传参考视频 + 提示词写触发词），确认能出片、语义对；顺带确认 30 秒、480/720p、30/10/10 上限在界面都对。约几分钟、花积分。

### 🎯 待办 4：Seedance 2.5 仅接了**对话流**（工作流/Agent/资产库未接，用户明确只要对话流）

### 🎯 待办 5：老待办原样保留（本轮没动，见下方「上一状态」各节）

间断性卡死 bug 等日志、内容审核取舍、M040 红字幂等测试、H3 生视频那一跑、M037、M032 等。

---

## ✅ 当前状态（2026-08-09 第四十九次会话末）：**两服+GitHub = `v1.0.0.82`**，Agent「很多代码」修复 + Agent 接入内容审核，均已部署并真走界面验通

| | 版本 / 状态 |
|---|---|
| 本地 = 测试服 = 正式服 = GitHub | `v1.0.0.82`（四域名 200；无新迁移；`tsc` 0、`npm test` 15/15）|

⭐ 本次细节见 `CHANGELOG_2.md` 顶条。**无待部署、无待提交。** 那 4 条诊断日志已随本批一起上线（原待办 1 完成）。

### ✅ 本次会话已完成（不用再做）
1. **修 Agent「对话后出现很多代码」**（`parseStructuredAgentReply`/`parseAgentPlan`/`parseIntentClassification` 用 `parseLenientModelJson` 容错解析裸换行）。
2. **Agent 模式接入内容审核**（`/api/agent-plan` 命中词库直接红字、不调模型不扣分）。
3. **v82 两服部署 + 阿里静态同步 + 四域名 200 + 两服真走界面验通（Test1 无代码 / Test2 红字）+ commit + push。**

### 🎯 仍挂着的待办（原样保留）
- ⚠️ **老脏消息**：历史上被吐成 JSON 的 Agent 回复不会自动修（历史数据，不建议回填）。
- 那个「间断性卡死」bug（v48 加的 4 条诊断日志已随 v82 上线）→ **等它再现形、按下面待办的 grep 命令定案**。
- 内容审核已知取舍（语义审核每次都跑要不要抽样等，改前问用户）、M040 红字幂等测试、H3 生视频那一跑、M037、M032 等。

---

## ⏪ 上一状态（2026-08-08 第四十八次会话末）：**两服+GitHub = `v1.0.0.81`**（内容审核已上正式服 + 586 词生效）；⚠️ **本地另有 4 条新日志未 bump/未部署/未 commit**

| | 版本 / 状态 |
|---|---|
| 本地 | `v1.0.0.81` **+ 4 条新诊断日志（未 bump、未部署、未 commit）**；`tsc` exit 0、`npm test` 15/15 |
| 测试服 | `v1.0.0.81`（3 迁移已应用；586 词 + 开关开）|
| 正式服 | `v1.0.0.81`（四域名 200；3 迁移已应用；**586 词已同步 + 开关已开**）|
| GitHub | `v1.0.0.81`（commit `7358a94`）|

⭐ 本次细节全在 **`CHANGELOG_2.md` 顶条（第四十八次会话，共十一节）**，其中**第十节最重要**。
⛔ **要部署必须先 `node scripts/bump-version.mjs`（→v82）**（铁律：v81 已部署，改了代码不许原地覆盖）。

### 🎯🎯 待办 1（最优先）：**部署那 4 条诊断日志，然后等那个未结案的 bug 自己现形**

🗣️ **用户已批准加日志**（「行，你把日志加上」），**代码已写完、tsc/测试全绿，只差部署**。

**背景（一句话）**：真走界面发被内容审核拦截的提示词，**3 次里中 1 次**会
「整屏卡在『加载中...0%』、没有红字、库里那条对话**标题存了但 msgs=0**」。
**接口侧完全正确**（400 + 正确文案 + 0 扣费），坏的是前端这一段。**根因未坐实 → 只加了日志、零行为改动。**

**这 4 条日志（都只在"异常形状"时才写，正常流程不记）**：

| # | 位置 | 事件名 | 用途 |
|---|---|---|---|
| 1 | `workspace-sessions.ts:267`（**服务端**） | **`workspace-session-messages-skipped`** | ⭐⭐ **最关键。出现 = 立刻指认是那条持久化闸门吞的** |
| 2 | `chat-workbench.tsx:6681`（发送入口） | `chat-send-suspicious-session-shape` | 发送这一刻本地有几条消息、`messagesLoaded` 是什么 |
| 3 | `chat-workbench.tsx:3229`（PUT 之前） | `chat-put-session-shape-suspicious` | 即将发上去的会话形状 |
| 4 | `chat-workbench.tsx:1391`（加载态） | `chat-session-stuck-loading` | ⭐ 二值：是 `messagesLoaded===false` 还是 `loadingSessionIds` 触发 |

⭐ **四条配成一套，定案逻辑（照抄）**：
- ②有消息 + ③形状异常 + ①skipped → **是 `workspace-sessions.ts:248` 那条闸门吞的**；
- ②有消息但①没出现 → 消息在客户端被后续 setState 覆盖了；
- ②就 0 条消息 → 乐观插入压根没成功（往上查 `visibleMessages`）；
- ④`byLoadingSessionIds=true` → 是 `loadSessionDetails` 卡住（`chat-workbench.tsx:2440` 的
  `if (!data.session) return` 会让 `messagesLoaded` **永远**留在 false）。

**部署后怎么查**（客户端三条落在上传诊断日志，服务端那条同一个文件）：
```bash
grep -E 'chat-session-stuck-loading|chat-send-suspicious-session-shape|chat-put-session-shape-suspicious|workspace-session-messages-skipped' \
  /opt/flashmuse/data/runtime/upload-diagnostics-log.jsonl
```
⚠️ 分析 jsonl **一律用 node**，别用 `ConvertFrom-Json`（含中文会整行报错）。
⚠️ 三个客户端事件名**已加进** `client-error/route.ts` 的 `PERSISTED_CLIENT_EVENTS`（不加就只进 console、事后查不到）。

### ⛔⛔ 待办 1 的三条禁忌（我踩过 / 下错过，别重复）

1. ⛔ **别再说"这 bug 是拦截路径特有的"** —— 我说过，**不成立**：那个"对照实验"是在刷新 + 已发过一次之后做的，
   **条件不对等**；从没在"刚加载后第一次发送"的条件下试过正常提示词。
2. ⛔ **别再往"初始加载还没就绪"的方向查** —— 🗣️ **用户一句话推翻过**：
   「**如果在加载中，那就是加载慢的问题。。在加载中用户可没有看到输入框根本没法输入提示词**」
   → 输入框能用、能打字发送 = 加载早完成了 → **那个加载态是发送之后才出现的、是发送触发的**。
3. ⛔ **别往 `summarizeWorkspaceState` / `mergeUnloadedSessions` 上查** ——
   （`workspace-state-cleanup.ts:85/103`）**是死代码、全项目零调用**，已确认。
   🗳️ 顺带：**这两个死函数要不要删，等用户拍板**（删它跟本 bug 无关，属于清理）。

⭐ **零成本复现姿势**（不烧积分）：测试服前台真在输入框打一个词库里的词发送 —— 命中会在建 job 前被拦，**一分不扣**。
拿词的办法：`docker exec staging-db psql -c "select value from \"ContentModerationTerm\" limit 1"`，
⚠️ **传进浏览器要用 `TextDecoder` 解 base64，⛔ 别用裸 `atob()`**（见 `AGENTS.md` 顶部铁律）。

### 🎯 待办 2：内容审核剩下的已知取舍（都不是 bug，改前问用户）

1. ⚠️ **每次生成都会送一次语义审核**（未命中词库时）→ 多一次文本模型调用。想省钱只能做**抽样**，**改前必须问用户**。
2. ⚠️ **工作流节点重试没有去重**（对话流已用 `suppressContentModerationRecord` 去重）。
3. ⚠️ **`ContentModerationEvent` 保留 30 天**，后台没有"手动清理/忽略"入口。
4. ⚠️ **审核只覆盖生成提示词**（`/api/image`、`/api/video`）。⛔ 不管普通聊天/通用模式/Agent 对话/提示词优化/图片反推。
5. ⚠️ `initialHidden`（DB `termsHidden`）是**半废字段**（进页面恒隐藏），是否清理待用户定。
6. ⚠️ 锁是**页面级 UX + 共享状态**，服务端 mutation 仍只靠管理员 cookie，没按 `editUnlocked` 硬拦。

### ⚠️ 待办 3：排查红字时请跳过 B_193 / B_194（我的测试造成的）

我手打 `/api/image` 时**两次写错 model id**（用了 `byteplus:seedream-4-5`，正确是
`byteplus:conversation-image.seedream-4-5`，⭐ 正确 id 在 `src/lib/models.ts`，
⛔ `/api/models` 返回的是**文本模型**列表）→ 正式服留下 **B_193 / B_194**。
⛔ **不是用户问题、不是 bug、不用归档。**

### 🎯 待办 4：M040 —— 把「红字幂等」固化成 `npm test` 用例（第 44 次立项，仍没做）

- 防线是 `error-message.ts` 第 217 行那份**白名单式幂等保护**，**每加一句新红字都得记得往里加一条，漏了就串**。
- ⭐ 最低成本：固化成「**任意一条映射结果连跑 3 遍必须完全一致**」，清单抄 `CHANGELOG_2.md` 第 44 次会话第二节的 **37 条 + 8 条反向**。
- ⭐ 内容审核那句拦截红字**已实跑验证不需要进白名单**，但仍该被测试兜住。

### 🎯 待办 5：老待办原样保留（本轮没动）

后台「失败原因」老数据脏（⛔ 不建议回填）、ID_947011 那个 bug 等日志说话（⛔ 别再猜别再改行为）、
两条已定位但故意没修的缺陷（mention 正则不对称 / `getOrderedExplicitImageReferences` 从资产库捞图）、
H3 生视频那一跑（约 47 积分 / 10~16 分钟）、M037 把 `uploadProgress` 搬出画布状态、
M032（⛔ 仍不许动代码）、M036 / M015（🗣️ 用户说先放着）。

### ✅ 本次会话已完成（不用再做）

1. **v81 两服部署 + 3 个迁移应用 + 阿里静态同步 + 四域名 200**；正式服备份 `20260808-072915-presync-v1.0.0.81`。
2. **正式服敏感词同步**：0 → **586 词**、开关 false → **true**（纯 INSERT，零删除，全程服务器内搬运）。
3. **正式服端到端验通**（命中拦截 / 不误拦 / 真跑生图 / 语义审核 3 条全处理）。
4. **后台内容审核页 8 项验收**（把第 46/47 次一直挂着的"没人亲眼验过"清掉了）。
5. **巡检 6 项全过**、正常浏览 0 console error。
6. **commit + push GitHub**（`7358a94`）。
7. **真走界面测出那个间断性卡死** + **写好 4 条诊断日志**（未部署）。

---

## ⏪ 上一状态（2026-08-07 第四十七次会话末）：**测试服 `v1.0.0.80`（只到"蓝字挪位"）；本地代码已远超它但未部署未 commit；正式服仍 `v1.0.0.76`**

| | 版本 / 状态 |
|---|---|
| 本地代码 | 版本串 `v1.0.0.80`，**但带一批 v80 之后的新功能（眼睛隐藏/页面锁/密码/两个新 DB 列）全部未 commit、未部署** |
| 测试服 | `v1.0.0.80`：**只含"保存规则那行蓝字挪位"**；DB 无 `termsHidden`/`editUnlocked` 两列；586 词 + `enabled=true` 在 |
| 正式服 | `v1.0.0.76`（无内容审核） |
| GitHub | `v1.0.0.76`（`55b72f2`） |
| 本地 DB | 有 `termsHidden`+`editUnlocked` 两列（本会话两个新迁移已本地 deploy）；586 词 + `enabled=true` |

⛔⛔ **接手第一件事：本地代码 ≠ 测试服 v80。** 要部署测试服**必须先 `node scripts/bump-version.mjs`（→v81）**（铁律：v80 部署后又改了代码，不许原地覆盖同版本号）。
⭐ 本会话细节（按时间顺序 5 件事 + 改动文件清单 + 已知取舍）全在 **`CHANGELOG_2.md` 顶条（第四十七次会话）**。

### 🎯 待办 1（最优先，三问）：**要不要 bump v81 部署测试服？要不要 commit？正式服？**

- **部署测试服**：先 bump→v81，走完整流程（build→sync-ali→发版本信号）。⚠️ 有两个新迁移会自动跑，把 `termsHidden`/`editUnlocked` 列加到测试服 DB。**部署前测试服后台别去点隐藏/锁**（那两列还没有，会 500）——部署后就正常了。
- **commit**：本地攒了 v77(资产库失败卡①)+v78(②)+v79(内容审核)+v80(蓝字挪位)+**v80 后未 bump 的这批(眼睛/锁/密码)**，全没 commit。
- **正式服**：仍 v76，要上内容审核需先把测试服那份推过去 + 在正式服后台录词开开关。

### 🎯 待办 2：内容审核后台页本会话新功能的**验收点**（部署 v81 后上号验）

1. 进页面 = **锁定态**（整页淡化+禁用、只能滚动）；词库**默认隐藏**（显示成 `*`，逗号/换行保留）。
2. 点锁开关 → 弹密码框 → 输 `dragonstar` → 解锁（整页恢复可编辑）；错密码红字、弹窗不关。
3. 解锁后词库**仍隐藏**，手动点眼睛开关才显示原文。
4. 切到别的后台页再回来 → **又恢复锁定**（靠离开时写库 `editUnlocked=false`）。
5. 跨浏览器：A 解锁后 B 刷新也是解锁；A 离开后 DB 写回锁定。
6. 加入词库 → 在最后一个词后用中文逗号「，」跟着追加。

### 🎯 待办 3：内容审核老待办（第 46 次会话留的，仍在）

后台那两个页面界面本身仍需管理员亲眼过一遍（第 46 次列的 5 项）；每次生成都送一次语义审核（省钱要抽样，改前问用户）；工作流节点重试没去重；`ContentModerationEvent` 30 天保留无手动清理入口；审核只覆盖生成提示词。详见下方"上一状态"。

### 🎯 待办 4：M040 —— 把「红字幂等」固化成 `npm test` 用例（仍没做，见更早会话）

---

## ⏪ 上一状态（2026-08-07 第四十六次会话末）：**测试服 `v1.0.0.79`；⛔ 正式服仍 `v1.0.0.76`；⛔ 未 commit**


| | 版本 |
|---|---|
| 本地 | `v1.0.0.79`（未 commit，攒了 v77+v78+v79 三批）|
| 测试服 | `v1.0.0.79`（已部署；`/api/health` + `x-app-version` 都是 v79；迁移已执行；8080/https = 200；巡检全过、console 0 error）|
| **正式服** | **`v1.0.0.76`** —— ⛔ 本次全程没动 |
| GitHub | **`v1.0.0.76`（`55b72f2`）** |

⭐ **本批有新 Prisma 迁移** `20260807000000_content_moderation`（3 张表），推正式服时 entrypoint 会自动 `migrate deploy`。
本次做的是「内容审核（敏感政治内容）」整套功能，细节见 **`CHANGELOG_2.md` 顶条（九节）**。

### 🎯 待办 1（最优先）：**后台那两个页面还没有人亲眼验证过**

我只验到「接口未登录返回 403」+「构建产物里有那些字符串」。**界面本身没看过**（测试号 `12424740@qq.com` 不是管理员，
管理员号是用户自己的 `lookxun@163.com`，按铁律不动）。请用户或拿到授权后确认这 5 项：
1. 侧边栏「内容审核」在**服务器信息正上方**；
2. 开关**点一下就保存，刷新不回弹**（这是用户报过的 bug，务必复验）；
3. 词库输入逗号 → 保存 → 刷新后**仍以中文逗号展示**（不变回换行）；
4. `已拦截记录` 表头是「命中」、显示命中词、**没有"加入词库"按钮和操作列**；`语义审核待确认` 有「加入词库」；
5. 两张表**各自每页 10 条**、上一页/下一页能翻。
⭐ 顺带看「模型开关」里新增的 **内容审核语义模型** 那一行，两个开关默认都应是**开**。

### 🎯 待办 2（两问，同上一轮一样没解决）：**要不要推正式服？要不要 commit + push？**

- **推正式服**：会从 v76 直接跳到 **v1.0.0.79**（⛔ 不再 bump，按流程把测试服那份原样 rsync）。
  ⚠️ **正式服上线后审核默认是"不生效"的**：`ContentModerationRuleGroup` 是空表 →
  **必须先在正式服后台录词 + 打开开关**，否则关键词拦截等于没开（语义审核也不会排队）。
- **commit + push**：本地攒了 v77（资产库失败卡第一轮）+ v78（第二轮）+ v79（内容审核）三批。

### 🎯 待办 3：内容审核本身还剩的 4 件事（都不是 bug，是已知取舍）

1. ⚠️ **每次生成都会送一次语义审核**（未命中词库时）→ 每次生图/生视频都多一次 OpenRouter/BytePlus 文本调用。
   ⭐ 想省钱只能做**抽样**（如按比例/按用户/按来源）或只审高风险来源，**改前必须问用户**。
2. ⚠️ **工作流节点的重试没有去重**：对话流失败卡重试已经不重复记录（`suppressContentModerationRecord`），
   工作流节点重试仍是新 requestId → 后台会各记一条。要统一就照对话流那条路把标记传进 `workflow-tldraw-canvas-inner.tsx` 的两处 fetch。
3. ⚠️ **`ContentModerationEvent` 保留 30 天**（`MODERATION_EVENT_RETENTION_DAYS`），后台没有"手动清理/忽略"入口。
   要加"归档/忽略"就参考 `07-red-error-triage-and-archive.md` 那套 `resolvedAt` 做法。
4. ⚠️ **审核只覆盖生成提示词**（`/api/image`、`/api/video`，含对话流/工作流/资产库/Agent）。
   ⛔ **不管**普通聊天、通用模式、Agent 对话、提示词优化、图片反推 —— 这是用户当初定的范围，要扩再问。

### 🎯 待办 4：M040 —— 把「红字幂等」固化成 `npm test` 用例（第 44 次会话立的项，仍没做）

- 现在的防线是 `error-message.ts` 第 217 行那份**白名单式幂等保护**，**每加一句新红字都得记得往里加一条，漏了就串**。
- ⭐ 本次新增的拦截红字**实跑验证过不需要进白名单**（不含会被兜底抢走的关键词），但**这件事仍应该被测试兜住**。
- ⭐ **最低成本做法**：把回归脚本固化成一个用例 ——「**任意一条映射结果连跑 3 遍必须完全一致**」，
  清单抄 `CHANGELOG_2.md` 第 44 次会话那条第二节的 **37 条 + 8 条反向**，再把本次这句加进去。

### 🎯 待办 5：M040 之外的老待办原样保留（见下面各节）

以下 4 条来自第 44/45 次会话，本轮没动：后台「失败原因」老数据脏（不建议回填）、ID_947011 那个 bug 等日志说话（⛔ 别再猜别再改行为）、
两条已定位但故意没修的缺陷（mention 正则不对称 / `getOrderedExplicitImageReferences` 从资产库捞图）。

## ⏪ 上一状态（2026-08-06 第四十五次会话末）：**测试服 `v1.0.0.78`；⛔ 正式服仍 `v1.0.0.76`；⛔ 未 commit**

| | 版本 |
|---|---|
| 本地 | `v1.0.0.78`（未 commit）|
| 测试服 | `v1.0.0.78`（已部署；`/api/health` + `x-app-version` 都是 v78；阿里 8080 = 200；上号实测全过、console 0 error）|
| **正式服** | **`v1.0.0.76`** —— ⛔ 本次全程没动 |
| GitHub | **`v1.0.0.76`（`55b72f2`）** |

**无 Prisma 迁移、无 compose/nginx 改动。** 改动只有 1 个文件 `src/components/chat-workbench.tsx`（4 处）+ `app-version.ts`。
本次细节见 **`CHANGELOG_2.md` 顶条**（八节，含实测表 + 零成本造失败卡的方法）。

### 🎯 待办 1（最优先，两问）：**要不要推正式服？要不要 commit + push？**

- **推正式服**：正式服现在 v76 → 会直接跳到 **v1.0.0.78**（⛔ **不再 bump**，按流程只把测试服那份原样 rsync 过去）。
  ⭐ **用户就是在正式服上报的这个 bug**（他自己的号 ID_636611 = `12424740@qq.com`），
  ⚠️ 但**他那条已经被吃掉的 B_141 失败卡救不回来**（数据早就没了）；部署只对**以后新发生的**生效。
- **commit + push**：本地攒了 v77 + v78 这一批（其实是同一件事的两轮），⛔ 按铁律没让 commit 就没 commit。

### 🎯 待办 2：M040 —— 把「红字幂等」固化成 `npm test` 用例（上一次会话立的项，仍没做）

- 现在的防线是 `error-message.ts` 第 217 行那份**白名单式幂等保护**，**每加一句新红字都得记得往里加一条，漏了就串**。
- ⭐ **最低成本做法**：把第 44 次会话那个回归脚本固化成一个用例 ——
  「**任意一条映射结果连跑 3 遍必须完全一致**」。用例清单直接抄 `CHANGELOG_2.md` 第 44 次会话那条第二节的 **37 条 + 8 条反向**。
  现在 `npm test` 只有 15 个用例、跑 1.2 秒，加进去成本几乎为零。
- 🗳️ **更彻底但影响面大（⛔ 动前必须问用户）**：给映射结果打不可见标记 / 统一前缀，第二遍见到直接原样返回，不再靠白名单穷举。

### 🎯 待办 3：⚠️ 后台「失败原因」老数据是脏的（已知，⛔ 不建议回填）

历史上被串成"拒绝出图"的那些条，`failureReason` 存的是**客户端映射后**的文案 → 在后台混进了「模型拒绝」那一行。
⛔ 不建议回填（要动用户数据，且真假难分）。⭐ 要看准确规模去 `.runtime/generation-diagnostics-log.jsonl` 按 `extra.userError` 统计。

### 🎯 待办 4：**ID_947011 那个 bug 还没结案 —— 等日志说话，⛔ 别再猜、别再改行为**

**现在能做的只有一件事：等它再发生，然后一条命令定案：**
```bash
grep -E 'copy-prompt-restored|input-image-removed|precheck-(hit|miss)|send-reference-snapshot' \
  /opt/flashmuse/data/runtime/upload-diagnostics-log.jsonl | grep <用户ID>
```
按时间排开，看这几个信号分流（完整解释见 `CHANGELOG_2.md` 第 43 次会话那条的第八节）：
- **`send-reference-snapshot` 的 `sent` 里出现 `[@/assetLibrary]`** → 「用户删了、发送时从资产库把老图捞回来还插最前面」
  （= ID_868181 音频那个病理，`getOrderedExplicitImageReferences` 那条路）。
- **`input-image-removed` 的 `mentionStillThere:true`** → 删缩略图时 @名没清干净（正则不对称，见下面待办 5）。
- **`precheck-hit` 之后没有任何 POST** → 用户这次选的文件字节和以前某张一样，替换实际没发生。
- **`input-image-dropped-before-upload`** → 图压根没进输入框，`reason` 直接说是哪条分支丢的。

⛔⛔ **别再做这三件事（第 43 次会话都做过、都被否掉/证伪了）**：
1. 别改「秒回去重」的行为和文案 —— 🗣️「**提示不要改。还是一样用「图片已存在，无需重复上传！」**」；
2. 别把「同名上传 = 替换掉框里那张老图」捡回来 —— 根因没坐实、两边都没复现，用户要求全撤；
3. 别拿用户转发过来的图去正式服比对像素 —— 那些图**不是上传原件**。

⭐ **验证 `send-reference-snapshot` 在正式服落盘**（唯一还没验的一条，约 15 积分）：传一张图 + 发一次生成，然后 grep 那个事件名。

### 🎯 待办 5：两条已定位但**故意没修**的真实缺陷（要修必须先跟用户确认口径）

1. **删 @名 / 解析 @名 的正则不对称**（`src/lib/mention-text.ts`）：
   `removeMentionName` 的 lookahead `(?=$|[\s，。！？；;、])` **不含 `@`**，而 `getMentionNames` 的
   `[^@\s，。！？；;、]+` **把 `@` 当终止符** → `"@000@A_old"` 删「000」删不掉、却照样被解析出来。
   实测 7 条里 1 条漏。⚠️ 那行注释声称「可紧贴中文、可相邻」，**注释声称支持、正则做不到**。
   ⭐ 修它必须带**反向用例**（`@000_2` 不许被删「000」误伤）。
2. **`getOrderedExplicitImageReferences` 会从整个资产库把 @名对应的图捞回来、并排在最前面**
   （`chat-workbench.tsx:6210` 附近）。这是 ID_868181 音频 bug 的同构点。
   ⛔ 改它影响面很大（@名的顺序/意图语义），**必须先跟用户确认产品口径**。

### 🎯 待办 6：H3 生视频那一跑（🗣️ 用户 2026-08-05 指定「下次要做测试时」顺带验掉）

- ⛔ **时机**：**用户说了要测试/部署时**才排进去。⚠️ 第 44、45 次会话都部署过，但都没顺带跑掉，**仍然挂着**。
- 模型 `minimax/hailuo-3`，约 **47 积分**、**10~16 分钟**（H3 比 Seedance 慢很多，别以为卡死）。
- 一次跑完同时验 4 件事（都是二值）：① 出现 **`video-job-charged`**（v69 加的，**从来没被真正触发过一次**）
  ② **不该**出现 `usdFromFallbackPricing` ③ 台账迁移在**测试服**生效 ④ `transfer-diagnostics-log.jsonl` 最新那条的
  `kbps`/`concurrency`/`chunks`/`retries`/`via` —— ⛔ `via` 出现 `"rsync"` = 退回单流了。
- ⚠️ 分析 jsonl **一律用 node**，别用 `ConvertFrom-Json`（含中文会整行报错）。

### 🎯 待办 7：M037 —— 把 `uploadProgress` 搬出画布状态（🗣️ 用户说"单独排一次"）

根治方案 + 全部实测数字见 `06-memo-tasks.md` 的 **M037**。⭐ 顺带能干掉「临时态必须在存库边界剥掉」这条老坑。

### 🎯 待办 8：观察传输日志、按时段优化；🗳️ M036 / M015（🗣️ 用户都说「先放着」）

- 传输日志攒几天后按小时聚合，再决定要不要按时段调 `ALI_SYNC_CONCURRENCY`（现在 16，实测最优；32 反而更差）。
- **M032** 工作流传参考图偶发"静默挂不上" —— ⛔ **仍不许动代码**（根因未知）。
- **M029** 单轮询器；**M030** 服务端文档解析；**M026 / M019** 工作流节点分页 / 拆表；**M020** 视频真·超分。

### ⛔ 红字：一条都没归档，也别去归档

正式服「待排查」情况与判定规则见 `07-red-error-triage-and-archive.md`；
其中 B_92 / B_123 那类「参考素材/参考视频没过审」、以及 B_141/B_142 那类「模型拒绝出图」
都属于**该一直亮着**的（用户侧内容问题，不是我们的 bug）。

### ✅ 本次会话（第四十五次）已完成，不用再做

1. **查清「资产库并发生成时失败卡被吃掉」的两个根因并全部修掉**（正式服日志 + DB 双证，非猜测）。
2. **部署测试服 v77 → 自测抓到第二个根因 → 改完 bump 到 v78 完整重推**（⛔ 没有原地覆盖 v77）。
3. **上号实测 6 项 + 6 项巡检全过**，console 0 error。
4. ⭐ 沉淀出「用 `page.route` fulfill 500 造真实失败卡」这个**零积分**验法（见 `CHANGELOG_2.md` 顶条第四节）。

## ⏪ 上一状态（2026-08-06 第四十四次会话末）：**四方同步 `v1.0.0.76`，无待部署、无待提交**

| | 版本 |
|---|---|
| 本地 | `v1.0.0.76` |
| 测试服 | `v1.0.0.76`（部署完成；`x-app-version` + `/api/health` 都是 v76；阿里 8080 与 https 入口 200）|
| 正式服 | `v1.0.0.76`（部署完成；四域名 main/api/ali/static 全 200；静态 40 文件已同步阿里正式镜像）|
| GitHub | `v1.0.0.76`（commit **`6c017e2`**，v75 + v76 两批一次性 commit + push）|

**无 Prisma 迁移、无 compose/nginx 改动。** 本次细节见 **`CHANGELOG_2.md` 顶条**（六节，含 37 行红字对照表）。

⚠️ **本次没上号巡检**（🗣️ 用户明确说「不用测试了。。我来测试」）→ **零积分消耗、零留痕**。
⭐ **所以"用户侧验收"这一步还悬着**：如果他反馈红字还是歪的，先去 `.runtime/generation-diagnostics-log.jsonl`
比对 `extra.userError`（服务端映射的正确文案）和他截图里的红字 —— 两者不一致就说明**还有第三处在重复映射**。

### ✅ 本次会话已完成（不用再做）

1. **正式服 B_123「审核视频的问题被拼进了拒绝出图的文案里」已修并两服上线 v1.0.0.76。**
   根因 = 同一句红字被 `toUserErrorMessage()` 跑了两遍，第二遍掉进裸 `版权` 兜底；
   修法 = `error-message.ts` 的幂等保护补上 `isReferenceReviewRejectedMessage()`。
   回归 37/37 + 反向 8/8 + `tsc` + `npm test` 15/15 全绿。
2. **v75 + v76 两批已 commit + push**（`6c017e2`）→ **四方同步恢复**。
3. **AGENTS.md 新增 2 条铁律**：`toUserErrorMessage` 跑两遍必须同步幂等保护 /
   判新镜像起来没看 `/api/health` 不看 `x-app-version`。

### 🎯 待办 1（最优先，⭐ 推荐先做这个）：把「红字幂等」固化成自动化测试用例 → **备忘编号 M040**

本次只补了漏掉的那一句。**但根子上的问题是「同一个函数在服务端和客户端各跑一遍」这个链路本身**：

- 调用点：服务端 route 映射后写进 error message → 客户端 `src/lib/chat/chat-workbench-core.tsx:6168`
  `throw new Error(toUserErrorMessage(text))` → 工作流节点 catch `workflow-tldraw-canvas-inner.tsx:4707` 再来一次。
- ⭐ **现在的防线是"白名单式幂等保护"**（`error-message.ts` 第 217 行列举我们自己的成品文案）——
  **每加一句新文案就得记得往那里加一条，漏了就串**（本次就是漏了）。
- ⭐⭐ **最低成本、最该做的一件事**：把本次那个回归脚本**固化成 `npm test` 里的一个用例**
  ——「**任意一条映射结果连跑 3 遍必须完全一致**」。这样以后谁加新文案，漏了幂等保护会**当场被测试抓住**，
  不用再等用户来报。现在 `npm test` 只有 15 个用例、跑 1.16 秒，加进去成本几乎为零。
  ⭐ 用例清单直接抄 `CHANGELOG_2.md` 顶条第二节那 37 条 + 8 条反向。
- 🗳️ **更彻底但影响面大的方向（⛔ 动前必须问用户）**：给映射结果打一个不可见标记 / 统一约定
  「已映射过的文案一律带某个固定前缀」→ 第二遍见到就直接原样返回，不再靠白名单穷举。

### 🎯 待办 2：⚠️ **后台「失败原因」里的老数据是脏的（已知，⛔ 不建议回填）**

历史上被串成"拒绝出图"的那些条，`failureReason` 存的是**客户端映射后**的文案 →
在后台被记在「模型拒绝」那一行里，**混进了本该属于「参考视频/音频没过审」的条数**。
- ⛔ **不建议回填**：改历史 `failureReason` 会动用户数据，且分不清哪些是"真·模型拒绝"
  （两者最终文案都以同一个前缀开头，只能靠尾巴那段原文里有没有「参考X没能通过」来分）。
- ⭐ 真要看准确规模，去 `.runtime/generation-diagnostics-log.jsonl` 按 `extra.userError` 统计
  （那里存的是**服务端映射的正确文案**，没被污染）。
- ⭐ **顺带确认过**：`admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` **不用改** ——
  本次没动任何文案措辞，只是不再让它被二次加工。

### 🎯 待办 3：**ID_947011 那个 bug 还没结案 —— 等日志说话，⛔ 别再猜、别再改行为**

**现在能做的只有一件事：等它再发生，然后一条命令定案：**
```bash
grep -E 'copy-prompt-restored|input-image-removed|precheck-(hit|miss)|send-reference-snapshot' \
  /opt/flashmuse/data/runtime/upload-diagnostics-log.jsonl | grep <用户ID>
```
按时间排开，看这几个信号分流（完整解释见 `CHANGELOG_2.md` 第 43 次会话那条的第八节）：
- **`send-reference-snapshot` 的 `sent` 里出现 `[@/assetLibrary]`** → 「用户删了、发送时从资产库把老图捞回来还插最前面」
  （= ID_868181 音频那个病理，`getOrderedExplicitImageReferences` 那条路）。
- **`input-image-removed` 的 `mentionStillThere:true`** → 删缩略图时 @名没清干净（正则不对称，见下面待办 4）。
- **`precheck-hit` 之后没有任何 POST** → 用户这次选的文件字节和以前某张一样，替换实际没发生。
- **`input-image-dropped-before-upload`** → 图压根没进输入框，`reason` 直接说是哪条分支丢的。

⛔⛔ **别再做这三件事（第 43 次会话都做过、都被否掉/证伪了）**：
1. 别改「秒回去重」的行为和文案 —— 🗣️「**提示不要改。还是一样用「图片已存在，无需重复上传！」**」；
   同一文件不重复上传、不同文件同名就重命名，**这套逻辑用户明确说没问题**。
2. 别把「同名上传 = 替换掉框里那张老图」捡回来 —— 方向看着对，但根因没坐实、两边都没复现，用户要求全撤。
3. 别拿用户转发过来的图去正式服比对像素 —— 那些图**不是上传原件**（判据：连"老图"的预测文件名都找不到）。

⭐ **验证 `send-reference-snapshot` 在正式服落盘**（唯一还没验的一条，约 15 积分）：
传一张图 + 发一次生成，然后 grep 那个事件名。不急，代码和另外两条走同一条落盘链路。

### 🎯 待办 4：两条已定位但**故意没修**的真实缺陷（要修必须先跟用户确认口径）

1. **删 @名 / 解析 @名 的正则不对称**（`src/lib/mention-text.ts`）：
   `removeMentionName` 的 lookahead `(?=$|[\s，。！？；;、])` **不含 `@`**，而 `getMentionNames` 的
   `[^@\s，。！？；;、]+` **把 `@` 当终止符** → `"@000@A_old"` 删「000」删不掉、却照样被解析出来。
   实测 7 条里 1 条漏。⚠️ 那行注释声称「可紧贴中文、可相邻」，**注释声称支持、正则做不到**。
   ⭐ 修它必须带**反向用例**（`@000_2` 不许被删「000」误伤）。
2. **`getOrderedExplicitImageReferences` 会从整个资产库把 @名对应的图捞回来、并排在最前面**
   （`chat-workbench.tsx:6210`）。这是 ID_868181 音频 bug 的同构点。
   ⛔ 改它影响面很大（@名的顺序/意图语义），**必须先跟用户确认产品口径**。

### 🎯 待办 5：H3 生视频那一跑（🗣️ 用户 2026-08-05 指定「下次要做测试时」顺带验掉）

- ⛔ **时机**：**用户说了要测试/部署时**才排进去，不是现在马上跑。
  ⚠️ 本次（第 44 次）虽然部署了两服，但用户说"我来测试"→ **这一跑还没做**，仍然挂着。
- 模型 `minimax/hailuo-3`，约 **47 积分**、**10~16 分钟**（H3 比 Seedance 慢很多，别以为卡死）。
- 一次跑完同时验 4 件事（都是二值）：① `.runtime/generation-diagnostics-log.jsonl` 出现 **`video-job-charged`**
  （v69 专门补的，**从来没被真正触发过一次**）② **不该**出现 `usdFromFallbackPricing`
  ③ 台账迁移在**测试服**生效（正式服已验过）④ `.runtime/transfer-diagnostics-log.jsonl` 最新那条的
  `kbps`/`concurrency`/`chunks`/`retries`/`via` —— ⛔ `via` 出现 `"rsync"` = `ALI_SYNC_PULL_BASE_URL` 没配、退回单流了。
- ⚠️ 分析 jsonl **一律用 node**，别用 `ConvertFrom-Json`（含中文会整行报错）。

### 🎯 待办 6：M037 —— 把 `uploadProgress` 搬出画布状态（🗣️ 用户说"单独排一次"）

根治方案 + 全部实测数字见 `06-memo-tasks.md` 的 **M037**。⭐ 顺带能干掉「临时态必须在存库边界剥掉」这条老坑。

### 🎯 待办 7：观察传输日志、按时段优化；🗳️ M036 / M015（🗣️ 用户都说「先放着」）

- 传输日志攒几天后按小时聚合，再决定要不要按时段调 `ALI_SYNC_CONCURRENCY`（现在 16，实测最优；32 反而更差）。
- **M032** 工作流传参考图偶发"静默挂不上" —— ⛔ **仍不许动代码**（根因未知）。
- **M029** 单轮询器；**M030** 服务端文档解析；**M026 / M019** 工作流节点分页 / 拆表；**M020** 视频真·超分。

### ⛔ 红字：一条都没归档，也别去归档

正式服「待排查」情况与判定规则见 `07-red-error-triage-and-archive.md`；
其中 B_92 / B_123 那类「参考素材/参考视频没过审」属于**该一直亮着**的（第十九节 C 小节）。

## ⏪ 上一状态（2026-08-06 第四十三次会话末）：**两服 `v1.0.0.75`；GitHub 仍 `v1.0.0.74`**

| | 版本 |
|---|---|
| 本地 | `v1.0.0.75` |
| 测试服 | `v1.0.0.75`（部署 + 上号巡检、console 0 error、4 条日志全部实测落盘）|
| 正式服 | `v1.0.0.75`（部署 + 上号巡检、四域名 200、console 0 error、3/4 条日志实测落盘）|
| GitHub | **`v1.0.0.74`** —— ⛔ 本地这批未 commit/未 push |

**无 Prisma 迁移、无 compose/nginx 改动。** 本次细节见 **`CHANGELOG_2.md` 顶条**（九节）。

### ⭐⭐ 先记住这条新铁律（🗣️ 2026-08-06 用户拍板，已写进 `AGENTS.md` 最顶部）

🗣️「**以后找bug不确定不要乱动代码加日志找到真实原因为止，宁可不动也不乱动。**」

本次我因为"根因没坐实就改行为"被要求**整批撤回两次**。⛔ 别再犯：没复现 = 不许动行为，只许加日志。

### 🎯 待办 1（最优先）：**问用户要不要 commit + push**（本地攒了 v75 这一批）

改动文件只有 3 个（都是纯日志）：`src/app/api/asset-upload-temp/route.ts`、
`src/components/chat-workbench.tsx`、`src/app/api/client-error/route.ts`，加 `src/lib/app-version.ts`。
⛔ 按铁律没让 commit 就没 commit。

### 🎯 待办 2：**ID_947011 那个 bug 还没结案 —— 等日志说话，⛔ 别再猜、别再改行为**

**现在能做的只有一件事：等它再发生，然后一条命令定案：**
```bash
grep -E 'copy-prompt-restored|input-image-removed|precheck-(hit|miss)|send-reference-snapshot' \
  /opt/flashmuse/data/runtime/upload-diagnostics-log.jsonl | grep <用户ID>
```
按时间排开，看这几个信号分流（完整解释见 `CHANGELOG_2.md` 顶条第八节）：
- **`send-reference-snapshot` 的 `sent` 里出现 `[@/assetLibrary]`** → 「用户删了、发送时从资产库把老图捞回来还插最前面」
  （= ID_868181 音频那个病理，`getOrderedExplicitImageReferences` 那条路）。
- **`input-image-removed` 的 `mentionStillThere:true`** → 删缩略图时 @名没清干净（正则不对称，见下面待办 3）。
- **`precheck-hit` 之后没有任何 POST** → 用户这次选的文件字节和以前某张一样，替换实际没发生。
- **`input-image-dropped-before-upload`** → 图压根没进输入框，`reason` 直接说是哪条分支丢的。

⛔⛔ **别再做这三件事（本次都做过、都被否掉/证伪了）**：
1. 别改「秒回去重」的行为和文案 —— 🗣️「**提示不要改。还是一样用「图片已存在，无需重复上传！」**」；
   同一文件不重复上传、不同文件同名就重命名，**这套逻辑用户明确说没问题**。
2. 别把「同名上传 = 替换掉框里那张老图」捡回来 —— 方向看着对，但根因没坐实、两边都没复现，用户要求全撤。
3. 别拿用户转发过来的图去正式服比对像素 —— 那些图**不是上传原件**（判据：连"老图"的预测文件名都找不到）。

⭐ **验证 `send-reference-snapshot` 在正式服落盘**（唯一还没验的一条，约 15 积分）：
传一张图 + 发一次生成，然后 grep 那个事件名。不急，代码和另外两条走同一条落盘链路。

### 🎯 待办 3：两条已定位但**故意没修**的真实缺陷（要修必须先跟用户确认口径）

1. **删 @名 / 解析 @名 的正则不对称**（`src/lib/mention-text.ts`）：
   `removeMentionName` 的 lookahead `(?=$|[\s，。！？；;、])` **不含 `@`**，而 `getMentionNames` 的
   `[^@\s，。！？；;、]+` **把 `@` 当终止符** → `"@000@A_old"` 删「000」删不掉、却照样被解析出来。
   实测 7 条里 1 条漏。⚠️ 那行注释声称「可紧贴中文、可相邻」，**注释声称支持、正则做不到**。
   ⭐ 修它必须带**反向用例**（`@000_2` 不许被删「000」误伤）。
2. **`getOrderedExplicitImageReferences` 会从整个资产库把 @名对应的图捞回来、并排在最前面**
   （`chat-workbench.tsx:6210`）。这是 ID_868181 音频 bug 的同构点。
   ⛔ 改它影响面很大（@名的顺序/意图语义），**必须先跟用户确认产品口径**。

### 🎯 待办 4：H3 生视频那一跑（🗣️ 用户 2026-08-05 指定「下次要做测试时」顺带验掉）

- ⛔ **时机**：**用户说了要测试/部署时**才排进去，不是现在马上跑。
- 模型 `minimax/hailuo-3`，约 **47 积分**、**10~16 分钟**（H3 比 Seedance 慢很多，别以为卡死）。
- 一次跑完同时验 4 件事（都是二值）：① `.runtime/generation-diagnostics-log.jsonl` 出现 **`video-job-charged`**
  （v69 专门补的，**从来没被真正触发过一次**）② **不该**出现 `usdFromFallbackPricing`
  ③ 台账迁移在**测试服**生效（正式服已验过）④ `.runtime/transfer-diagnostics-log.jsonl` 最新那条的
  `kbps`/`concurrency`/`chunks`/`retries`/`via` —— ⛔ `via` 出现 `"rsync"` = `ALI_SYNC_PULL_BASE_URL` 没配、退回单流了。
- ⚠️ 分析 jsonl **一律用 node**，别用 `ConvertFrom-Json`（含中文会整行报错）。

### 🎯 待办 5：M037 —— 把 `uploadProgress` 搬出画布状态（🗣️ 用户说"单独排一次"）

根治方案 + 全部实测数字见 `06-memo-tasks.md` 的 **M037**。⭐ 顺带能干掉「临时态必须在存库边界剥掉」这条老坑。

### 🎯 待办 6：观察传输日志、按时段优化；🗳️ M036 / M015（🗣️ 用户都说「先放着」）

- 传输日志攒几天后按小时聚合，再决定要不要按时段调 `ALI_SYNC_CONCURRENCY`（现在 16，实测最优；32 反而更差）。
- **M032** 工作流传参考图偶发"静默挂不上" —— ⛔ **仍不许动代码**（根因未知）。
- **M029** 单轮询器；**M030** 服务端文档解析；**M026 / M019** 工作流节点分页 / 拆表；**M020** 视频真·超分。

### ⛔ 红字：一条都没归档，也别去归档

正式服「待排查」情况与判定规则见 `07-red-error-triage-and-archive.md`；
其中 B_92 那类「参考素材/参考视频没过审」属于**该一直亮着**的（第十九节 C 小节）。

### ✅ 本次会话已完成（不用再做）

- 用户 ID_947011 那个 bug：**查清了全部可查的硬事实**（时间线 + 零上传 + 04:27 替换其实成功），
  但**根因未定**；6 个变体测试服全试过没复现；改动全部撤回，只留 4 条日志并两服上线 `v1.0.0.75`。
- 抓到并修掉一个**会让所有客户端诊断白写**的坑：`reportClientDiagnostic` 的事件
  **必须加进 `client-error/route.ts` 的 `PERSISTED_CLIENT_EVENTS` 白名单才会落盘**，否则只 console.error。

## ⏪ 上一状态（2026-08-05 第四十二次会话末）：**四方同步 `v1.0.0.74`，无待部署、无待提交**

| | 版本 |
|---|---|
| 本地 | `v1.0.0.74` |
| 测试服 | `v1.0.0.74`（部署 + 上号巡检 6 项全过、console 0 error）|
| 正式服 | `v1.0.0.74`（部署 + 上号巡检 6 项全过、四域名 200、console 0 error）|
| GitHub | `v1.0.0.74`（五批一次性 commit + push）|

**无 Prisma 迁移、无 compose/nginx 改动。** 本次细节见 **`CHANGELOG_2.md` 顶条**（九节）。

### ✅ 用户报的那个 bug 已在正式服端到端验通（不用再管）

工作流_11 的 `video_4_w11` 点「使用提示词」→ 新节点 → **点生成不再报「视频时长读取失败」** →
出片 `video_5_w11`。⭐ 顺带确认：**正式服测试号 `12424740@qq.com` 就是 ID_636611 = B_92 那个用户**，
所以工作流_11 就是他报的那个。

### 🎯🎯 待办 1（🗣️ 用户 2026-08-05 明确指定）：**下次要做测试时，就跑 H3 生视频，顺带把"传输日志/kbps"那条一起验掉**

🗣️ **用户原话意思**：「下次测试时就跑 h3 生视频，顺带就把第 2 条验证掉」
（"第 2 条" = 上一版待办里的「真跑一次 H3 生视频验扣费日志」，现在合并成这一条）。

- ⛔ **注意时机**：这是「**下次要测试的时候**」做，不是"现在马上去跑"。
  按最顶部那条铁律，**用户没说测试/部署就只写代码** —— 但只要他说了"测一下 / 部署"，
  **这次巡检就把 H3 那一跑排进去**（替代或追加在巡检第 5 项的"真跑生视频"上）。
- **模型**：MiniMax H3 = `minimax/hailuo-3`（**对话流 + 工作流**都接了，Agent 按用户要求没接）。
- **成本与耗时**：约 **47 积分**、**10~16 分钟**（H3 比 Seedance 慢很多，别以为卡死了）。
  ⭐ 号一律 `12424740@qq.com`；要留痕就**新建**一个对话/工作流，别动现有的。
- **一次跑完要同时验这 4 件事（都是二值判据）**：
  1. ⭐ **扣费日志**：`.runtime/generation-diagnostics-log.jsonl` 里应出现 **`video-job-charged`**
     （这条日志是 v69 专门为"扣费成功却零日志"补的，**从来没被真正触发过一次**）。
     再回库对 `CreditLedger` 那一行的 `usd`/`credits`，看和上游 `usage.cost` 对不对得上。
  2. ⭐ **兜底定价没被误触**：日志里**不该**出现 `usdFromFallbackPricing`
     （出现了说明上游这次没给 `cost`，那是另一件事，要单独记）。
  3. ⭐ **台账迁移在测试服生效**（正式服已实测过，**测试服还没被触发过**）。
  4. ⭐ **大视频走并发分片链路的真实速度**：看 `.runtime/transfer-diagnostics-log.jsonl` 最新那条的
     `kbps` / `concurrency` / `chunks` / `retries` / `via`。⛔ `via` 必须是分片那条路，
     **出现 `via:"rsync"` = `ALI_SYNC_PULL_BASE_URL` 没配、退回单流了**（大视频必失败）。
- ⚠️ 分析 jsonl **一律用 node**，别用 `ConvertFrom-Json`（含中文会整行报错）。

### 🎯 待办 2：M037 —— 把 `uploadProgress` 搬出画布状态（🗣️ 用户说"单独排一次"）

根治方案 + 全部实测数字见 `06-memo-tasks.md` 的 **M037**。⭐ 顺带能干掉「临时态必须在存库边界剥掉」这条老坑。

### 🎯 待办 3：观察传输日志、按时段优化（🗣️ 用户的原始意图）

攒几天数据后按小时聚合看，再决定要不要按时段调 `ALI_SYNC_CONCURRENCY`（现在 16，实测最优；32 反而更差）。
⭐ 待办 1 那一跑会给这里贡献一条**大视频**样本（现在样本大多是小文件）。


### 🎯 待办 4：🗳️ M036 阿里多出的 225 个媒体 / M015 阿里端压缩（🗣️ 用户都说「先放着」）

- **M032** 工作流传参考图偶发"静默挂不上" —— ⛔ **仍不许动代码**（根因未知）。
- **M029** 单轮询器；**M030** 服务端文档解析；**M026 / M019** 工作流节点分页 / 拆表；**M020** 视频真·超分。

### ⛔ 红字：一条都没归档，也别去归档

正式服「待排查」现在 7 种 / 109 条，其中 **B_92 那类「参考素材/参考视频没过审」9 条属于"该一直亮着"**
（判定见 `07-red-error-triage-and-archive.md` 第十九节 C 小节）。
⭐ 有一条**新的可查线索**：那 9 条在后台显示「影响用户 0」，正是 v74 之前 `userId` 没记住导致的 ——
**v74 之后的新失败会带上用户**，下次排查能直接看到是谁。

### ⛔⛔ 四件"别再做第二遍"的事

1. **别把「上次审核被拒就不再送审」这个优化捡回来**（和文案口径「重试可能通过」矛盾）。
2. **别往红字里加"例如影视剧、动漫、综艺"这类举例**（替平台编理由，用户已否掉）。
3. **改那句文案的措辞必须同步 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`**。
4. ⭐ **别为了"免费触发一次失败"去手打 `POST /api/video`** —— 本次这么试，第 4 次**真把任务建出来了、扣了 53 积分**
   （参考视频有归属校验，用不存在的 url 触发不了后段失败）。这个接口的默认结果是"开始烧钱"。

### ✅ 本次会话已完成（不用再做）

- v73（B_92 那批 4 处）+ v74（新发现的 `input audio` 版权缺口）两服都已上线，四方同步。
- 抓到并修掉：`error-message.ts` 精确规则漏 `audio` → 参考音频被版权拒时说成"模型拒绝"。回归 8/8（含 4 条反向）。
- 五批未提交的改动已一次性 commit + push。

## ⏪ 上一状态（2026-08-05 第四十一次会话末）：**测试服 `v1.0.0.72`；正式服仍 `v1.0.0.71`；另有一批改完未部署**


| | 版本 |
|---|---|
| 本地 | `v1.0.0.72` **+ 一批未部署的改动**（查 B_92 顺带修的 4 处）|
| 测试服 | `v1.0.0.72`（已部署 + 上号实测全过、console 0 error）|
| 正式服 | **`v1.0.0.71`** —— ⛔ 本次会话全程没动 |
| GitHub | **`v1.0.0.69`（`9e97c97`）** —— 本地攒了**五批**未 commit/未 push |

两批都**无 Prisma 迁移、无 compose/nginx 改动**。本次细节见 **`CHANGELOG_2.md` 顶条**（六节）
+ **`07-red-error-triage-and-archive.md` 第十九节**（B_92 那条红字的完整查法与结论）。

### 🎯 待办 1（最优先）：**部署本地这批「查 B_92 顺带修的 4 处」到测试服（要 bump 到 v1.0.0.73）**

⚠️ **测试服的 v72 里没有这 4 处**（它们是查 B_92 之后才改的、一行都没部署）。改动文件：
`api/video/route.ts`（失败事件补 `userId` + 失败日志补参考视频/音频）、
`lib/error-message.ts`（参考素材没过审的文案**按图片/视频/音频精确对应**）、
`lib/admin-failure-triage.ts`（`FAILURE_REASON_SQL` 把那 4 种措辞归一化收回一行）、
`lib/analytics-events.ts`（审核类分类补 `版权|copyright`）；`lib/transient-error.ts` 只剩注释加强。

⭐ **这批特别值得实测的两项（都能二值判断）**：
1. **失败事件终于记住 userId**：故意让一次工作流生视频在创建阶段失败（例如用会被拒的参考素材），
   然后 `SELECT "userId" FROM "GenerationEvent" WHERE "failureCode"='B_x'` —— **不再是空**。
2. **红字说得准了**：参考**视频**被拒 → 红字应当直接说「参考视频…」，参考**音频**被拒说「参考音频…」，
   ⛔ 不再笼统说"参考素材"（只在判不出类型时才回落"参考素材"）。

### 🎯 待办 2：**问用户要不要把 v72 +（待办 1 那批）同步到正式服**

⭐ **用户是在正式服上报的「使用提示词后发送报视频时长读取失败」**（工作流_11 那个节点现在还卡着）。
部署后**那个坏节点打开工作流就会自愈**（自愈 effect 会补上时长/宽高），**不用手工改数据**。
照 `03-deploy-and-servers.md`「正式服部署流程」：备份 → staging→prod rsync（⛔ **不再 bump**）
→ build → 同步 `.next/static` 到阿里正式镜像 → `.env` 写 `PUBLISHED_APP_VERSION` + force-recreate
→ 四域名 200 → **正式服也上号巡检 6 项**。
⭐ 正式服要**重点加测**：去 **工作流_11** 那个原始节点点「使用提示词」→ **点发送不再报「视频时长读取失败」**。

### 🎯 待办 3：**问用户要不要 commit + push**（本地攒了五批）

第 39 次并发分片、第 40 次 manifest/缩略图、v72 那批、B_92 那批、以及更早未 push 的 v70。
⛔ 按铁律没让 commit 就没 commit。

### 🎯 待办 4：M037 —— 把 `uploadProgress` 搬出画布状态（🗣️ 用户说"单独排一次"）

根治方案 + 全部实测数字见 `06-memo-tasks.md` 的 **M037**。⭐ 顺带能干掉「临时态必须在存库边界剥掉」这条老坑。

### 🎯 待办 5：真跑一次 H3 生视频验扣费日志（一直没做，约 47 积分 + 10~16 分钟）

⭐ 顺带能验 ① 台账在测试服的迁移 ② 大视频走并发链路的 kbps（`transfer-diagnostics-log.jsonl`）。

### 🎯 待办 6：🗳️ M036 阿里多出的 225 个媒体 / M015 阿里端压缩（🗣️ 用户都说「先放着」）

- **M032** 工作流传参考图偶发"静默挂不上" —— ⛔ **仍不许动代码**（根因未知）。
  ⚠️ **本次修的两个 bug 都不是 M032**（根因都明确、可复现、已坐实）。
- **M029** 单轮询器；**M030** 服务端文档解析；**M026 / M019** 工作流节点分页 / 拆表；**M020** 视频真·超分。

### ⛔ 红字：B_92~B_98 **不要归档**（也不要跑归档脚本）

那 7 条「参考视频没过版权检测」**从来没落进兜底桶**，属于「修不了就该一直亮着」那一类。
判定过程见 `07-red-error-triage-and-archive.md` 第十九节 C 小节。

### ⛔⛔ 三件"别再做第二遍"的事（本次会话踩过/被否掉的）

1. **别把「上次审核被拒就不再送审」这个优化捡回来** —— 它和用户定的文案口径「重试可能通过」矛盾
   （缓存否决 = 重试永远不可能通过 = 红字骗人）。`api/video/route.ts` 那段
   `if (status === "Failed")` 上面已有 ⛔ 注释钉住。
2. **别往红字里加"例如影视剧、动漫、综艺等片段"这类举例** —— 用户明确否掉；那是替平台编理由，
   而实测那个被拒素材就是个普通竖屏短片。拿不到证据就只说"平台判定/检测"。
3. **改那句文案的措辞时，必须同步 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`** —— 否则后台
   一个根因炸成 4 行。

### ✅ 本次会话已完成（不用再做）

- 「使用提示词」→ 参考视频/音频丢时长宽高 → 发送被永久拦死：**已修 + 测试服 v72 实测通过**。
- 顺带修掉「自愈写值会把工作流顶到列表最前」的副作用（`getWorkflowMeaningfulSnapshot` 少剥一层）。
- 查清 B_92（用户侧问题、不归档）并修掉顺带发现的 4 处（**未部署**，见待办 1）。

## ⏪ 上一状态（2026-08-04 第四十次会话末）：**两服已部署 `v1.0.0.71`；本批未 commit/未 push**

测试服 = 正式服 = 本地 = `v1.0.0.71`；**GitHub 仍 `v1.0.0.69`（`9e97c97`）**。四域名 200、无待应用迁移。
本次细节见 **`CHANGELOG_2.md` 顶条**（第四十次：manifest 泄露 + 缩略图同步 + 缩略图收敛 + 上传去重死代码 + 进度节流）。

### 🎯 待办 1（最优先）：**问用户要不要 commit + push**

本地现在攒了**三批**未提交（第 39 次的并发分片、第 40 次的本批、以及更早未 push 的 v70）。
⛔ 按铁律没让 commit 就没 commit。**两服代码都已经是 v71 了，只差 git 这一步。**

### 🎯 待办 2：M037 —— 把 `uploadProgress` 搬出画布状态（🗣️ 用户说"单独排一次"）

本次只做了**止血**（进度节流，70~100 次 → ~20 次）。根治方案 + 全部实测数字见 `06-memo-tasks.md` 的 **M037**。
⭐ 顺带能干掉「临时态必须在存库边界剥掉」这条老坑。

### 🎯 待办 3：真跑一次 H3 生视频验扣费日志（一直没做，约 47 积分 + 10~16 分钟）

⭐ 现在还能顺带验**两件本次没验成的事**：① 台账在**测试服**的迁移（正式服已实测生效，测试服还没触发）
② 大视频走新并发链路的端到端表现（看 `transfer-diagnostics-log.jsonl` 的 kbps）。

### 🎯 待办 4：🗳️ M036 阿里多出的 225 个媒体要不要清理（🗣️ 用户 2026-08-04 说「先放着」）

### 🎯 待办 5：M015 阿里端压缩（🗣️ 用户 2026-08-04 说「先放着」）；其它活跃备忘见 `06-memo-tasks.md`

- **M032** 工作流传参考图偶发"静默挂不上" —— ⛔ **仍不许动代码**，但本次已把 B 的假设证伪 + 补了数据结论；
- **M029** 单轮询器；**M030** 服务端文档解析（Agent 读不到文档内容，用户能感知）；
- **M026 / M019** 工作流节点分页 / 拆表（要 Prisma 迁移）；**M020** 视频真·超分（等免费方案）。

### ✅ 本批已完成（不用再做）

- 两端媒体复查 + 补齐 78 个 → 复验「两端已一致」；**视频一个不缺**。
- manifest 公网泄露已堵（代码迁移 + 4 份 conf + 阿里幂等脚本），**正式服实测迁移已生效**。
- 上传缩略图自动同步阿里（两服实测通过）；缩略图逻辑收敛成一份；上传去重死代码已修（实测提示弹出）。

## ⏪ 上一状态（2026-08-04 第三十九次会话末）：**两服已部署 `v1.0.0.70`（视频同步已修好）；本批未 commit/未 push**

测试服 = 正式服 = 本地 = `v1.0.0.70`；**GitHub 仍 `v1.0.0.69`（`9e97c97`）**。
正式服四域名全 200、无待应用迁移。本次会话细节见 **`CHANGELOG_2.md` 顶条**（第三十九次：视频同步根因 + 并发分片传输）。

### 🎯 待办 1（最优先）：**问用户要不要 commit + push**

本批改了 4 个文件 + 新增 4 个文件（含 2 个 shell 脚本），`tsc` 全绿、`npm test` 15/15。
⛔ 按铁律没让 commit 就没 commit。**两服代码已经是 v70 了，只差 git 这一步。**

### 🎯 待办 2：🗳️ 阿里侧「多出来的 225 个媒体」要不要清理（= 新备忘 **M036**）

补数据**已跑完并复验通过**（见下方"本批已完成"），但脚本报「阿里多出 225 个条目」（腾讯没有、阿里有）。
**脚本故意不删**。⛔ **别自己动手删** —— 数据库里还有引用的删了就是死链。
完整的安全清理步骤写在 `06-memo-tasks.md` 的 **M036**。⭐ 不急：225 个文件对 21GB 占比极小。

### ✅ 本批已完成（不用再做，只列出来供核对）

- **媒体两端已完全对齐**：补了 **1245 个 / 1.11GB、0 失败**，61 分 55 秒、平均 314.6 KB/s；
  复验 `--dry-run` = 「✅ 两端已一致，需要传 0 个」。腾讯 21320 个 / 21.20GB。
- 阿里侧无 `.fmpart.` 残留、无临时目录残留；传输日志属主已是 `ubuntu:netdev`（app 能写）。
- **随时可复查两端是否一致**（幂等只读）：
  `sudo bash /opt/flashmuse/app/scripts/backfill-ali-media.sh --stack=prod --dry-run`

### 🎯 待办 3：真跑一次 H3 生视频验扣费日志（仍未做，约 47 积分 + 10~16 分钟）

扣费已用硬证据坐实过，但**从没真跑一次 H3 走后台队列**验证 `video-job-charged` 日志。
⭐ 现在顺带还能验**新的并发同步链路对大视频的端到端表现**（看 `transfer-diagnostics-log.jsonl` 里的 kbps）。

### 🎯 待办 4：观察传输日志、按时段优化（🗣️ 用户的原始意图）

`.runtime/transfer-diagnostics-log.jsonl` 现在记了 `ts`/`tsEpochMs`/`kbps`/`concurrency`/`chunks`/`retries`/`via`。
🗣️ 用户：「不同时间速度不一样，以后看日志再优化」→ **攒几天数据后按小时聚合看**，
再决定要不要按时段调 `ALI_SYNC_CONCURRENCY`（现在 16，实测最优；32 反而更差）。
⚠️ 分析 jsonl **一律用 node 别用 `ConvertFrom-Json`**（含中文会整行报错，见 `AGENTS.md`）。

### 🎯 待办 5：M015 阿里端压缩（🗣️ 用户拍板"等 M034 测完效果再说"）；其它活跃备忘见 `06-memo-tasks.md`

⭐ **M015 的前提已经变了**：跨境慢的真凶是丢包、而并发是免费解药（已落地，38 倍提速）→
压缩剩下的价值只有"省存储/省出流量"，**不再是"为了传得动"**。详见 M015 里 2026-08-04 那条更新。
- **M029** 对话流生成统一单轮询器；**M030** 服务端文档解析；**M026** 单工作流内部节点分页；
  **M020** 视频真·超分；**M032** 工作流传参考图偶发"静默挂不上"（⛔ 根因未知，严谨复现前不许动代码）；
  **M036** 阿里多出的 225 个媒体（见待办 2）。

### ✅ 本卷已关闭的老待办（别再捡回来）

- ~~视频同步失败 / 阿里读不到视频~~ → **第三十九次会话已修**（并发分片，实测 571~606 KB/s）。
- ~~去掉视频压缩~~ / ~~阿里直连供应商下载~~ → **用户明确否掉**，压缩和 faststart 保持现状。
- ~~四批同步正式服 + push~~ / ~~M033~~ / ~~M034~~ / ~~工作流接 H3（M035）~~ → 均已完成。
- ~~Agent 接 H3~~ / ~~H3 超长任务前端提示~~ → 用户明确不做。

## ⏪ 上一状态（2026-08-03 第三十八次会话末）：**四方同步 `v1.0.0.69`，正式服已部署+巡检；无紧急待办**

正式服 = 测试服 = 本地 = GitHub = `v1.0.0.69`（commit `9e97c97`）。四域名全 200，**无待部署、无未推、无待应用迁移**。
本次会话细节见 **`CHANGELOG_2.md` 顶条**（第三十八次会话：四批一起同步正式服 + push + 巡检 + CHANGELOG 分卷）。

> ⛔ **没有紧急待办**。下一步做哪条由用户挑，下面按建议优先级列活跃备忘（都来自 `06-memo-tasks.md`）。

### 🎯 待办 1：真跑一次 H3 生视频验扣费日志（一直没做，约 47 积分 + 10~16 分钟）

扣费已用「GET 上游拿到 `usage.cost` + 账本 `credits`」硬证据坐实过，但**从没在环境里真跑一次 H3 走后台队列**
验证新加的 **`video-job-charged`** 日志。要做：测试服(或正式服)工作流选 H3、**5 秒档**跑一次，跑完 grep 诊断日志 `video-job-charged`
（看 usd / 扣分 / 有没有用兜底价）+ 查 `creditLedger` 那一笔 > 0。⚠️ H3 很慢，5 秒也要等几分钟，别以为卡死。
⭐ 也可顺带补上本次正式服巡检没做的「真跑生视频」那一项。

### 🎯 待办 2：M015 阿里端压缩（🗣️ 用户拍板"等 M034 测完效果再说"）

M033+M034 已四方上线。M015 需在共用的阿里生产机新起 sharp/ffmpeg 进程、且收益有限（压缩治不了丢包这个真病根、
93% 上传本来就快）。**等用户看 M034 实际效果后再决定**；真做只做阿里端、别做浏览器端（9 条理由见 `06-memo-tasks.md` M015）。

### 🎯 待办 3：拍板 9 第二步 —— 42 对孪生函数收敛（🟡 持续进行）

审计细节见 `08-full-audit-2026-08-02.md` 的 3.1。本卷已收敛：扣费用量三件套、参考模式、NEW 徽标、时长滑块、@提及选区引擎等。

### 🎯 待办 4：其它活跃备忘（都在 `06-memo-tasks.md`，无一紧急）

- **M029** 对话流生成统一单轮询器（修"重复失败卡"隐患）；**M030** 服务端文档解析（Agent 读不到文档内容）；
- **M026** 单个工作流内部节点分页（要拆表+Prisma 迁移，用户说以后做）；**M020** 视频真·超分（等免费方案）；
- **M032** 工作流传参考图偶发"静默挂不上"（⛔ 根因未知，严谨复现前不许动代码）。

### 🎯 待办 5：红字（⛔ 别自己开工、别跑归档脚本）；小项备忘见下方历史条目。

### ✅ 本卷已关闭的老待办（别再捡回来）

- ~~四批同步正式服 + push~~ → **第三十八次会话已完成**（四方同步 v1.0.0.69）。
- ~~M033 图片秒回预检~~ / ~~M034 分片上传~~ / ~~工作流接 H3（M035）~~ → 均已完成并上线。
- ~~Agent 接 H3~~ / ~~H3 超长任务前端提示~~ → 用户明确不做。

## ⏪ 上一状态（2026-08-03 第三十七次会话末）：**M033+M034 完成并部署测试服 v69（含此前 H3 批）；正式服仍 v67；本地全部未 commit**

测试服 = `v1.0.0.69`（已部署+上号实测全过）；正式服 = GitHub = `v1.0.0.67`（`05035da`）。
**本地四批未提交**：第 34/35/36 三批 + 第 37 批（本批 M033/M034）。
`tsc` 全绿、`npm test` 15/15、新文件 eslint 0 问题。**无 Prisma 迁移、无 compose 改动**（仅 `src/proxy.ts` matcher 加 `upload-chunk`）。
本批细节见 `CHANGELOG.md` 顶条（第三十七次会话）。M033/M034 已在 `06-memo-tasks.md` 标记 `[x]`。

### 🎯 待办 1（最优先）：**问用户 → commit + push → 同步正式服**

四批一起同步正式服，照 `03-deploy-and-servers.md`「正式服部署流程」：
备份 → staging→prod rsync（⛔ **不再 bump**，原样带 v1.0.0.69）→ build → 同步 `.next/static` 到阿里正式镜像
→ `/opt/flashmuse/.env` 写 `PUBLISHED_APP_VERSION=v1.0.0.69` + force-recreate → 四域名 200 → **正式服也上号巡检**。
⭐ 正式服要**重点加测**：① **M034 分片上传**（传一张 >1MB 的图/视频，看是否走 `upload-chunk`、有没有落成 + 目录清干净）
② H3 首次上正式（工作流 + 对话流的 NEW 徽标 / 2K / 四参考模式 / 尾帧单槽）③ 时长滑块能拖 ④ logo「AI影游助手」
⑤ **真跑一次生图 + 真跑一次生视频**（视频链路本批间接变过——H3 批）。

### 🎯 待办 2：真跑一次 H3 生视频验扣费日志（本次没做，约 47 积分 + 10~16 分钟）

第三十六次已用「GET 上游拿到 `usage.cost` + 账本 `credits`」硬证据坐实过扣费，但**本会话没在测试服真跑一次 H3 走后台队列**
验证新加的 **`video-job-charged`** 日志。要做：测试服工作流选 H3、**5 秒档**跑一次，跑完 grep 诊断日志 `video-job-charged`
（能看到 usd / 扣分 / 有没有用兜底价）+ 查 `creditLedger` 那一笔 > 0。⚠️ H3 很慢，5 秒也要等几分钟，别以为卡死。

### 🎯 待办 3：M015 阿里端压缩（🗣️ 用户拍板"等 M034 测完再说"）

M033+M034 已上测试服。M015 需在共用的阿里生产机新起 sharp/ffmpeg 进程、且收益有限（压缩治不了丢包这个真病根、
93% 上传本来就快）。**等用户看 M034 实际效果后再决定要不要做**；真做只做阿里端、别做浏览器端（9 条理由见 `06-memo-tasks.md` M015）。

### 🎯 待办 4：拍板 9 第二步 —— 42 对孪生函数收敛（🟡 持续进行）

审计细节见 `08-full-audit-2026-08-02.md` 的 3.1。

### 🎯 待办 5：M032 工作流节点传参考图偶发"静默挂不上"（⛔ 根因未知，严谨复现前不许动代码）

### 🎯 待办 6：红字（⛔ 别自己开工、别跑归档脚本）

### ✅ 已关闭的老待办（别再捡回来）

- ~~M033 图片秒回预检~~ / ~~M034 分片上传~~ → **第三十七次会话已完成并部署测试服 v69、实测全过**。
- ~~Agent 接 H3~~ / ~~H3 超长任务前端提示~~ → 用户明确不做。

## ⏪ 上一状态（2026-08-03 第三十六次会话末）：**本地三批未 commit、未部署；测试服 v68、正式服 v67**

测试服 = `v1.0.0.68`；正式服 = GitHub = `v1.0.0.67`（`05035da`）。
**本地三批未提交**：① 第三十四次的 H3 接入 ② 第三十五次的两处 UI ③ **第三十六次（本批）**。
`tsc` 全绿、`npm test` 15/15、eslint `no-unused-vars` 归零。**无 Prisma 迁移、无 compose/nginx 改动。**
本批细节见 `CHANGELOG.md` 顶条（第三十六次会话）。

### 🎯 待办 1（最优先）：**问用户 → commit + push → 部署测试服（要 bump）→ 上号真测**

⚠️ **本批一个像素都没在浏览器看过、一次生成都没真跑**（按铁律：没说测就不测）。
部署测试服照 `03-deploy-and-servers.md`：先 `node scripts/bump-version.mjs`（→ v1.0.0.69）→ build →
同步阿里镜像 → 版本信号 → **上号巡检 6 项**。⭐ 本批要**额外加测**这几项：

1. **工作流视频节点选 MiniMax H3**：模型下拉里出现 H3 且带 **NEW 徽标**；
   分辨率只有 **2K**；时长滑块 5~15；6 个比例能切。
2. **工作流的四个参考模式**（参考图 / 首帧 / **尾帧** / 首尾帧）能切换，且：
   - 尾帧模式 = **单槽**上传按钮显示「尾帧」（本批新写的分支，最可能出问题的就是它）；
   - 首尾帧 = 两槽「首帧」「尾帧」；参考图模式 = 图片/视频/音频/文件四个按钮里**只有图片能点**
     （H3 不支持参考视频音频，`upload-rules` 会禁掉）。
   - 各模式的**必填张数**：不够时运行按钮应该是禁用/报错（首帧 1、尾帧 1、首尾帧 2）。
3. **工作流真跑一次 H3 生视频** —— ⚠️ **会花真钱**：15 秒约 **140 积分**，
   ⭐ **用 5 秒档验就够（约 47 积分）**。⚠️ H3 渲染很慢（15 秒 2K 要 10~16 分钟），5 秒也要等几分钟，别以为卡死。
   跑完**去后台/查库看 `creditLedger` 那一笔 `credits` > 0**，并在诊断日志里 grep
   **`video-job-charged`**（本批新加的日志，能直接看到 usd / 扣分 / 有没有用兜底价）。
4. **侧边栏「工作流模式」的 NEW 徽标**：现在是青绿小圆角（不再是绿色胶囊）——
   看它跟「工作流模式」四个字的**垂直对齐和间距**（本批唯一纯视觉风险点）。
5. **对话流回归**：视频模型下拉的 NEW 徽标没变形；四个参考模式仍正常
   （本批把对话流的选项数组也换成了共享实现，**行为应当一字不变**，但要看一眼）。

### 🎯 待办 2：正式服同步（用户拍板后）

照 `03-deploy-and-servers.md`「正式服部署流程」：备份 → staging→prod rsync（⛔ **不再 bump**）→ build
→ 同步 `.next/static` 到阿里正式镜像 → `.env` 写 `PUBLISHED_APP_VERSION` + force-recreate → 四域名 200
→ **正式服也上号巡检**。⭐ 正式服要重点加测：时长滑块能拖、logo「AI影游助手」、
**真跑一次生视频**（H3 首次上正式服）。

### 🎯 待办 3：上传体验三条方案（M033/M034/M015，🗣️ 用户拍板"下个 AI 做"）

⛔ 动手前先读 `06-memo-tasks.md` 的 M034（有 2026-08-02 正式服实测数据：**病因是丢包不是体积**）。
建议顺序：M033（图片补秒回预检，零风险）→ M034（分片+单片重传）→ M015（阿里端压缩）。

### 🎯 待办 4：拍板 9 第二步 —— 42 对孪生函数收敛（🟡 已吃掉一大块）

✅ 已收敛：@提及选区引擎、视频参考纯尺寸校验、视频参考模式裁剪/限张/图标判定、视频时长选择器，
**本批新增 4 块**：**扣费用量三件套**（`video-usage-cost.ts`）、
**参考模式类型 + 选项 + 文案 + 必填张数**（`upload-rules.VideoReferenceMode` + `video-reference-modes.ts`）、
**NEW 徽标**（`new-badge.tsx`）、`isNewGenerationModel`（进 `models.ts`）。
剩余继续逐步收敛，审计细节见 `08-full-audit-2026-08-02.md` 的 3.1。

### 🎯 待办 5：Agent 接 H3（⛔ 🗣️ 用户目前明确不接，别自己开工）

要接就改 `system-settings.ts:isAgentVideoModelEnabled`（现在非 BytePlus 一律 false）。

### 🎯 待办 6：M032 工作流节点传参考图偶发"静默挂不上"（⛔ 根因未知，严谨复现前不许动代码）

### 🎯 待办 7：红字（⛔ 别自己开工、别跑归档脚本）；小项备忘见下方历史条目。

### ✅ 已关闭的老待办（别再捡回来）

- ~~验证 H3 扣费真扣到了~~ → **本次已坐实**（GET 上游拿到 `usage.cost=1.95` + 账本 `credits=137`），
  并加了兜底价 + `video-job-charged` 日志。
- ~~H3 超长任务的前端提示~~ → 🗣️ **用户明确说"3 不用做了"**，⛔ 别再提。
- ~~工作流接 H3~~ → **本次已完成**（连带收掉参考模式那份分叉）。

## ⏪ 上一状态（2026-08-03 第三十五次会话末）：**测试服 `v1.0.0.68` 已部署+上号实测全过；正式服仍 v67；本地未 commit**

> ⚠️ **部分已过期**：本地现在多了第三十六次会话那一批；其中「待办 2 验 H3 扣费」「待办 3 前端提示」
> 「待办 4 工作流接 H3」三条都已有结论，⛔ 别照这一节开工。


测试服 = `v1.0.0.68`；正式服 = GitHub = `v1.0.0.67`（`05035da`）。
**本地两批未提交**：① 第三十四次的 H3 接入 ② 本次的两处 UI（logo 改字 + 时长滑块）。
合计 14 个文件，**无 Prisma 迁移、无 compose/nginx 改动**。`tsc` 通过、`npm test` 15/15。
细节见 `CHANGELOG.md` 顶条（第三十五次会话）。

### 🎯 待办 1（最优先）：**问用户 → commit + push → 同步正式服**

正式服同步照 `03-deploy-and-servers.md`「正式服部署流程」：
备份 → staging→prod rsync（⛔ **不再 bump**，原样带 v1.0.0.68）→ build →
**同步 `.next/static` 到阿里正式镜像** → 往 `/opt/flashmuse/.env` 写 `PUBLISHED_APP_VERSION=v1.0.0.68`
+ force-recreate → 四域名 200 → **正式服也上号巡检 6 项**。
⭐ 正式服巡检时**重点加测**：① 对话流+工作流的**时长滑块能拖**（本批唯一交互改动）
② logo 显示「AI影游助手」③ **真跑一次生视频**（H3 首次上正式服）。

### 🎯 待办 2：⚠️ **验证 H3 扣费真的扣到了**（本次没验成，是遗留风险）

- **风险**：扣费金额依赖 OpenRouter **视频轮询响应里带 `usage.cost`**，而
  `OpenRouterVideoTask` 类型里**压根没声明 `cost`**（`openrouter-video.ts:34`）。
  若不返回 → `usd=0` → **扣 0 分 = 白送**。
- **为什么本次没验成**：H3 对话流视频走后台队列（`generation-jobs.ts:1030`）扣费，
  **这条路扣费成功不写诊断日志**，只落库 `creditLedger`；而本地 `.env.local` 没有 `DATABASE_URL`。
- ⭐ **验法（二选一，都很快）**：① 登后台 `/admin` 或查库，看 08-03 那几笔 H3（用户 `ID_779117`）的
  `creditLedger.credits`/`usd` 是否 > 0；② 测试服真跑一次 H3 再查同一张表。
- ⛔ **别把 H3 那批 CHANGELOG 里的「实测 5 秒 $0.65 / 约 47 积分」当已验证** ——
  那是直打 OpenRouter 量出来的价，不等于我们的扣费链路真拿到了 `cost`。

### 🎯 待办 3：H3 超长任务的前端提示（本次调查后的建议，未做、未拍板）

15 秒 2K 要渲染 **10~16 分钟**（实测数据在 CHANGELOG 顶条第一节）。
建议给这类任务加「预计 10 分钟+」的明确文案，避免用户以为卡死。🗣️ 要不要做需用户拍板。

### 🎯 待办 4：工作流 / Agent 接 H3（前一批**故意没做**，独立一件事）

- 工作流要接：先把工作流那套**平行的**参考模式实现（`isWorkflowBytePlusSeedanceVideoModel` /
  `getWorkflowEffectiveBytePlusVideoReferenceItems` / `getWorkflowBytePlusVideoReferenceLimitHint` /
  `showVideoReferenceModeMenu`）收敛到 `upload-rules.supportsVideoReferenceMode`，再删掉
  `workflow-tldraw-canvas-inner.tsx` 里 `workflowVideoModels` 那个排除 H3 的 filter。
- Agent 接：改 `system-settings.ts:isAgentVideoModelEnabled`（现在非 BytePlus 一律 false）。
  🗣️ 用户目前**明确不接 Agent**。

### 🎯 待办 5：上传体验三条方案（M033/M034/M015，🗣️ 用户拍板"下个 AI 做"）

⛔ 动手前先读 `06-memo-tasks.md` 的 M034（有 2026-08-02 正式服实测数据：**病因是丢包不是体积**）。
建议顺序：M033（图片补秒回预检，零风险）→ M034（分片+单片重传）→ M015（阿里端压缩）。

### 🎯 待办 6：拍板 9 第二步 —— 42 对孪生函数收敛（🟡 已吃掉几块）

✅ 已收敛：@提及选区引擎、视频参考纯尺寸校验、视频参考模式裁剪/限张/图标判定（进 upload-rules）、
**本批新增：视频时长选择器（进 `video-duration-slider.tsx`，对话流+工作流共用）**。
剩余继续逐步收敛。审计细节见 `08-full-audit-2026-08-02.md` 的 3.1。

### 🎯 待办 7：M032 工作流节点传参考图偶发"静默挂不上"（⛔ 根因未知，严谨复现前不许动代码）

### 🎯 待办 8：红字（⛔ 别自己开工、别跑归档脚本）；小项备忘见下方历史条目。

## ⏪ 上一状态（2026-08-03 第三十四次会话末）：**本地接入 MiniMax H3 视频模型，未 commit、未部署**

> ⚠️ **已过期**：这批已随第三十五次会话一起部署到测试服 v68。⛔ 别照着这一节判断要不要部署。


线上仍 `v1.0.0.67`；本地多了「MiniMax H3 接入对话流」这一批（9 改 + 2 新增），未 bump/未部署/未提交。
`tsc` 绿、`npm test` 15/15、eslint 无新增。完整清单见 CHANGELOG 顶条（第三十四次会话）。

### 🎯 待办 1（最优先）：**问用户 → commit + 部署测试服 → 真界面验收**

本批纯前后端代码，**无 Prisma 迁移、无 compose/nginx 改动**。部署测试服照 `03-deploy-and-servers.md`：
先 `node scripts/bump-version.mjs` → build → 同步阿里镜像 → 版本信号 → **上号巡检**。
⚠️ **本地没数据库、UI 没在浏览器点过**，H3 这套必须在测试服真点一遍，重点验：
1. 对话流视频下拉里 **MiniMax H3** 显示正常（在 Kling 上面、音浪图标、青绿 NEW 徽标）。
2. 分辨率只有 **2K**；6 个比例切换正常；时长 5~15 两列网格。
3. **四个参考模式**（参考图/首帧/尾帧/首尾帧）切换 + 各自张数限制（参考图 9 / 首帧 1 / 尾帧 1 / 首尾帧 2）。
4. **真跑一次生视频**（会花真钱，约 $0.65/5秒），确认出片 + 资产库显示名 `MiniMax H3` + 扣分正常。
5. 三个 Kling 模型的新图标、侧边栏「工作流模式」NEW 徽标（现在是青绿圆角、非胶囊）。

### 🎯 待办 2：工作流 / Agent 接 H3（本批**故意没做**，独立一件事）

- 工作流要接：先把工作流那套**平行的**参考模式实现（`isWorkflowBytePlusSeedanceVideoModel` /
  `getWorkflowEffectiveBytePlusVideoReferenceItems` / `getWorkflowBytePlusVideoReferenceLimitHint` /
  `showVideoReferenceModeMenu`）收敛到 `upload-rules.supportsVideoReferenceMode`，再删掉
  `workflow-tldraw-canvas-inner.tsx` 里 `workflowVideoModels` 那个排除 H3 的 filter。
- Agent 接：改 `system-settings.ts:isAgentVideoModelEnabled`（现在非 BytePlus 一律 false）。用户目前**明确不接 Agent**。

### 🎯 待办 3：上传体验三条方案（M033/M034/M015，用户拍板"下个 AI 做"）

⛔ 动手前先读 `06-memo-tasks.md` 的 M034（有 2026-08-02 正式服实测数据：病因是丢包不是体积）。
建议顺序：M033（图片补秒回预检，零风险）→ M034（分片+单片重传）→ M015（阿里端压缩）。

### 🎯 待办 4：拍板 9 第二步 —— 42 对孪生函数收敛（🟡 已吃掉几块）

✅ 已收敛：@提及选区引擎、视频参考纯尺寸校验、**本批新增：视频参考模式裁剪/限张/图标判定统一进 upload-rules**。
剩余继续逐步收敛。审计细节见 `08-full-audit-2026-08-02.md` 的 3.1。

### 🎯 待办 5：M032 工作流节点传参考图偶发"静默挂不上"（⛔ 根因未知，严谨复现前不许动代码）

### 🎯 待办 6：红字（⛔ 别自己开工、别跑归档脚本）；小项备忘见下方历史条目。

## ✅ 上一状态（2026-08-02 第三十三次会话末）：**四方同步 `v1.0.0.67`，两服都已部署+实测**

## ⏪ 上一状态（2026-08-02 第三十二次会话末）：**测试服 `v1.0.0.66` 已部署+上号实测全过；正式服仍 v64；本地未 commit**

本批 = 审计清仓批（死代码 / ESLint 222→97 / 视频尺寸常量收敛 / **middleware→proxy 迁移+整段匹配** /
轮询门控 / **@提及选区引擎收敛**）+ 4.1 资产生成子系统文档补记。**已部署测试服 v66，巡检 6 项 + @提及专项全过**。
细节见 CHANGELOG 顶两条。

### 🎯 待办 1（最优先）：**问用户 commit + 正式服同步**

本地改动未 commit、未 push（GitHub 仍 v64 `6b4e385`）。正式服同步照 `03-deploy-and-servers.md`
「正式服部署流程」：备份 → staging→prod rsync（⛔ 不再 bump）→ build → **同步 `.next/static` 到阿里正式镜像**
→ `.env` 置 `PUBLISHED_APP_VERSION=v1.0.0.66` + force-recreate → 四域名 200 → **正式服也上号巡检 6 项**。
⚠️ 两批都无 Prisma 迁移、无 compose/nginx 改动。⭐ 正式服巡检时**加测 @提及**（本批唯一行为微调点）。

### 🎯 待办 2：拍板 9 第二步 —— 42 对孪生函数收敛（🟡 已吃掉两块）

✅ 已收敛：@提及光标选区引擎（进 `mention-text.ts`，采用工作流 mention 原子化版本）+
视频参考纯尺寸校验（进 `media-upload-validation.ts`）。**剩余约 40 对**继续逐步收敛进 core/共享模块。
审计细节见 `08-full-audit-2026-08-02.md` 的 3.1。

### 🎯 待办 3：M032 工作流节点传参考图偶发"静默挂不上"（⛔ 根因未知，**严谨复现之前不许动代码**）

完整定义在 `06-memo-tasks.md` 的 M032。两个归因已被证伪，先复现（看 tip 原文判分支）再谈修法。

### 🎯 待办 4：~~Next 16 middleware→proxy 迁移~~ ✅ 本批已做（含 matcher 整段匹配）

残留远期风险：`/api/workspace-state` 的 32MB body 上限（当前 655KB，3.2 倍才会撞上，届时"只做瘦身"）。

### 🎯 待办 5：红字（⛔ 别自己开工、别跑归档脚本）

🗣️ 用户交代等红字攒多了再排查。看实时数字用 `/admin?tab=failures`。

### 🎯 待办 6：小项备忘

- 1.1 根治："生成前占额度/预扣"（v63 只做了原子扣费止血）。
- 1.9 消息双份存储：需数据迁移演练，单独一批。
- `_next/static` 原子切换（版本目录+软链）、零停机部署、告警（外部拨测打 `/api/health`）。
- 媒体 21GB 备份（🗣️ 用户说"单独议"）。

## ✅ 上一状态（2026-08-02 第二十八次会话末）：**测试服 `v1.0.0.63` 已部署+实测；正式服未动；本地未 commit**

**审计第 1 档 + 第 2 档已全部做完并上测试服**（细节见 CHANGELOG 第二十八次会话）。
剩下的拍板表更新：**3**（密码出 git，历史可洗）= 代码已改、洗历史随正式服批做；**4** = 取消（用户：两服各有一份就算备份）；
**5** = 保留 1 周，清理脚本已写、**cron 随正式服批挂**；**6/7/8** = 已完成；**9/10** = 下一批；**11** = 不做；**12** = 押后。

### 🎯 待办 1（最优先）：**问用户 commit + 正式服同步**

本地改动未 commit、未 push。正式服同步时照 CHANGELOG 第二十八次会话「部署 4 个坑」走：
compose 单独 cp 到 `/opt/flashmuse/`、写 `/opt/flashmuse/.env`（`FLASHMUSE_DB_PASSWORD`，顺便换新密码）、
`chown -R 1000:1000` 数据目录（pgdata 除外）、挂 cleanup cron（每天备份后跑）、2.6 证书核实 10 分钟、git 历史洗密码。
⛔ 正式服数据库密码也换 → 换完记得 `ALTER USER` 与 `.env` 一致，且 `/opt/flashmuse/data/.env.local` 里的 DATABASE_URL 不用动（compose env 优先）。

### 🎯 待办 2：**拍板 9+10 批次**（用户已批，未开工）

- 拆 `chat-workbench.tsx`：先把第 1~7,627 行（约 330 个纯函数 + 约 60 个无 hook 小组件）搬进 `src/lib/chat/*`（零风险、机械操作），再逐步消灭与工作流文件的 42 对孪生函数（20 对已漂移）。
- 加 2 个测试：纯函数单测 +「getPersistableSessions/getPersistableWorkflowItems 输出不含临时字段」契约测试（后者永久消灭 2.2 那一整类 bug）。

### 🎯 待办 3：M032 工作流节点传参考图偶发"静默挂不上"（⛔ 根因未知，**严谨复现之前不许动代码**）

完整定义在 `06-memo-tasks.md` 的 M032。两个归因已被证伪，先复现（看 tip 原文判分支）再谈修法。

### 🎯 待办 4：Next 16 middleware→proxy 迁移（🟡 不紧急，单独一批）

同前。含 matcher 排除名单前缀匹配→整段匹配的评估、`/api/workspace-state` 的 32MB body 上限远期风险。

### 🎯 待办 5：红字（⛔ 别自己开工、别跑归档脚本）

🗣️ 用户交代等红字攒多了再排查。看实时数字用 `/admin?tab=failures`。

### 🎯 待办 6：小项备忘

- 1.1 根治："生成前占额度/预扣"（本轮只做了原子扣费止血）。
- 1.9 消息双份存储：需数据迁移演练，单独一批。
- `_next/static` 原子切换（版本目录+软链）、零停机部署、告警（外部拨测打 `/api/health`）。
- 2.6 证书续期核实（随正式服批做，10 分钟）。
- 阿里正式 `flashmuse-static-ip` 的 `/generated/` 加固（幂等增量脚本，混着别的项目）。

## ✅ 上一状态（2026-08-02 第二十七次会话末）：**四方同步 `v1.0.0.62`，两服都已部署**

**正式服 = 测试服 = 本地 = GitHub = `v1.0.0.62`。工作区干净、无待部署、无未推、无 Prisma 迁移。**
上一会话的「部署这批安全修复」**已于本会话完成**（R1 上 v61、加 Next 修复后回炉上 v62，两服各验一轮）。

### 🎯 待办 1：M032 工作流节点传参考图偶发"静默挂不上"（⛔ 根因未知，**严谨复现之前不许动代码**）

完整定义（现象 / 两个已被证伪的归因 / 假设 / 复现设计）在 **`06-memo-tasks.md` 的 M032**。
⛔⛔ 不要再按"dedup"或"by-name 恢复分支（:3761）"去改 —— 这两个方向都已被判据条件证伪。
要先做复现（全新内容+全新文件名、干净工作流、**看 tip 原文**判断走哪条分支），再谈修法。

### 🎯 待办 2：Next 16 已把 `middleware` 弃用改名 `proxy`（🟡 不紧急）

本项目还在用 `src/middleware.ts` + `export function middleware`（build 时有 deprecation 警告）。
迁移会连带改文件名、导出名和几个配置名 —— 面大、收益是防未来，**建议单独做一批，别混在别的批次里**。
相关：`middleware.ts` 里的上传排除名单目前是**前缀匹配**写法（`/api/upload-filex` 这类未来路由会被误排；
当前线上无受影响路由，是有意不换），动 middleware 时顺手评估要不要换整段匹配。
⚠️ **顺带记一个潜伏风险**（不用现在动）：`/api/workspace-state` **仍在 middleware 匹配范围内**，
所以它的 body 仍受 `proxyClientMaxBodySize: '32mb'` 限制。画布 JSON 目前才 655KB（未压缩），
离 32MB 很远，而且已经从 10MB 放宽了 3.2 倍。但**它是"只增不减"的字段** ——
真超过 32MB 会**再次静默截断 → 500**。和「数据保留 / 清理策略」（拍板表第 5 条）是同一个根。

### 🎯 待办 3：媒体 21GB 备份（🗣️ 用户说"单独议"）

数据库备份已上线（每天 03:30 两服 + 异地阿里，每周一演练，见 `deploy/backup/README.md`）。
**媒体文件（generated 21GB）还没纳入**；阿里那份是同步脚本没加 `--delete` 碰巧留下的，不是设计。
要做需单独设计（增量 + 限速 + 避高峰，跨境只有 74KB/s）。

### 🎯 待办 4：红字（⛔ 别自己开工、别跑归档脚本）

🗣️ 用户交代**等红字攒多了再排查**。看实时数字用 `/admin?tab=failures`。

### 🎯 待办 5：跨境残留毛刺（方案 C，要花钱 → 等用户拍板）

keepalive 后中位数 0.30~0.37s 已到物理下限，偶发 1.0~1.5s 毛刺（线路丢包 30~40%）。
方案：C-1 全球加速/专线、C-2 国内也部一台 app、C-3 不动。**建议仍是不动。**

### ⭐ 本会话沉淀（备查）

- ⭐⭐ **`03-deploy-and-servers.md` 新增「部署前『自己审自己』清单」** —— 本会话最重要的沉淀。
  它来自用户临时试过的那一轮「双 AI 审计」（那轮在已自查通过的代码里又挑出 6 个问题）。
  🗣️ 用户之后决定回到单 AI，临时频道文档已删除，**手法留在那份清单里，每次部署前逐条走**。
- `AGENTS.md` 新增 4 条铁律：Next 配置名先读随包 docs / matcher 要测编译产物正则 /
  **报根因前先抄出 `if` 的判据逐项验** / **往共享命名空间加标识符前先枚举现存取值**。
- `03-deploy-and-servers.md` 另新增 2 条：本机 curl 会话对 Host 敏感 / 测试服 nginx 是 3 份不是 2 份。


---

## ✅ 上一状态（2026-08-02 第二十六次会话末）：本地有一批安全修复未部署；备份体系已上线

> ✅ **「待办 1：部署这批安全修复」已于第二十七次会话全部完成**（下面那份 11 步部署清单 + 8 项验收
> 就是当时照做的，留档备查；⛔ 别再照着部署一遍）。当时的已知缺口"阿里 flashmuse-static-ip 未加固"**仍然存在**。

线上（正式服 = 测试服 = GitHub）仍 **`v1.0.0.60`**；本地多了「3 个安全洞修复」，
**未 bump、未部署、未提交**。`tsc` 全绿，eslint 与基线一致（零新增），无 Prisma 迁移。

### 🎯🎯 待办 1（最优先）：**部署这批安全修复** —— 🗣️ 等用户说了才做

用户这次只说了「先做 0 档」，**部署节奏他没定**。按铁律我没有部署。

⭐ **我的建议：尽快上**，理由是可利用性：

| 洞 | 谁能打 | 后果 |
|---|---|---|
| ① SSRF | **不用账号，任何人** | 读云元数据拿实例凭证、扫内网、读同机另两个项目（CinematicFlow / VibeSocial） |
| ② 路径穿越 | 任何**登录用户** | 读 `.env.local` → 全部 API key + **`AUTH_SECRET`**（能自签管理员 cookie 登 `/admin`） |
| ③ 上传 XSS | 任何登录用户 | 在主域名下执行 JS，以受害者身份调所有接口 |

---

#### 📋 这批的完整部署清单（下个 AI 照这个走）

**⚠️ 与平时的部署有两点不同，别按老流程闭眼跑：**
1. **改了 4 份 nginx conf** → 除了应用代码，还要推 nginx 配置并 reload。
2. **正式服阿里那份 `flashmuse-static-ip` 也 serve `/generated/`，本次没碰它** → 见下面的「已知缺口」。

**无 Prisma 迁移**（本批一个都没有）→ 不需要额外的迁移前备份，但**建议顺手跑一次带标签的备份**，
反正只要 36 秒：

```bash
sudo /opt/flashmuse/scripts/flashmuse-db-backup.sh --stack prod --label pre-deploy-security
```

##### 步骤

| # | 步骤 | 备注 |
|---|---|---|
| 1 | `node scripts/bump-version.mjs` | v1.0.0.60 → **v1.0.0.61**。⛔ 只在部署测试服这一步 bump，正式服不再 bump |
| 2 | 按 `03-deploy-and-servers.md`「测试服部署流程」推应用代码 | 本批改了 14 个文件 + 新增 4 个（清单见下） |
| 3 | ⭐ **推测试服的 3 份 nginx conf 并 reload** | ① `deploy/staging/flashmuse-test-8080.conf`、② `deploy/staging/flashmuse-staging-static-ssl.conf` → 阿里那台的 `/etc/nginx/sites-enabled/`；③ `deploy/staging/flashmuse-staging.conf` → 腾讯 `/opt/flashmuse-staging/data/nginx/flashmuse-staging.conf`（bind-mount 进 `staging-nginx` 容器，见 `deploy/staging/docker-compose.yml:44`）。**这三份都不含别的项目，可整份覆盖**（既有约定）。⛔ ③ 不能漏：漏了它测试服容器内 nginx 就没加固，而测试服正是验 attachment 头的地方 → 会验出假结果。推完逐个 `nginx -t` 再 `reload` |
| 4 | 测试服跑下面那 8 项验收 | 见下 |
| 5 | 巡检 6 项（`03` 里的最小巡检） | 登录 / 对话 / 工作流点节点不崩 / 资产库 / 真跑生图 / 后台 0 error |
| 6 | 用户确认后，按「正式服部署流程」把测试服那份**原样** rsync 过去（⛔ 不再 bump） | |
| 7 | ⭐ **推正式服的 nginx conf** | `nginx/flashmuse.conf` → 腾讯 `/opt/flashmuse/data/nginx/flashmuse.conf`（它被 bind-mount 进 `flashmuse-nginx` 容器）→ 然后 `sudo docker exec flashmuse-flashmuse-nginx-1 nginx -t && sudo docker exec flashmuse-flashmuse-nginx-1 nginx -s reload`。⚠️ **覆盖前先 diff**：全是 `>`（纯新增）才敢覆盖，出现 `<` 说明服务器被手改过（这是既有铁律） |
| 8 | 同步 `.next/static` 到阿里正式镜像 | 漏了会全站 404 |
| 9 | 发版本信号 + 四域名健康检查 | |
| 10 | **正式服也要上号巡检** | 用 `12424740@qq.com` |
| 11 | commit + push | |

##### ⭐ 这批必须验的 8 项（都是我改动直接影响的路径）

| # | 验什么 | 预期 | 为什么要验 |
|---|---|---|---|
| 1 | 上传一个正常 **pdf / docx / txt** | 成功 | 洞③ 新加了白名单，怕误伤正常文档 |
| 2 | 尝试上传一个 **`.html` 或 `.svg`** | **被拒**，提示"不支持的文件格式：.html" | 洞③ 是否真的拦住 |
| 3 | 上传一个 **>10MB 的 pdf** | 被拒，提示"文件不能超过 10MB" | 新加的大小上限 |
| 4 | **对话流真跑一次生图**（带参考图） | 出图、图能落地进资产库 | 洞② 改了 `openrouter.ts` 的参考图读取路径（4 处），这是最怕改坏的地方 |
| 5 | **工作流真跑一次生图**（带参考图/@提及） | 同上 | 同上，且工作流走的是另一条链路 |
| 6 | **真跑一次生视频** | 出视频 + 有封面 | 改过 `openrouter-video.ts` 和 `seedance.ts` |
| 7 | 生成完等图/视频落地 | `media-save-status` 轮询正常、图进资产库 | 洞① 给这个接口**加了强制登录**，怕轮询挂 |
| 8 | 资产库缩略图正常显示 + 浏览器直接打开一个 `/generated/xxx.jpg` | 都正常 | 改过 `media-thumbnail`；nginx 加了 nosniff/attachment，怕误伤正常图片 |

⭐ **快速自查（不用部署就能跑）**：`node scripts/verify-ssrf-guard.mjs` 应输出 **25/25 全过**。

##### 本批改动的文件（18 个）

```
新增（4）
  src/lib/generated-asset-path.ts       /generated/ → 本地路径的唯一权威（resolve 包含校验）
  src/lib/ssrf-guard.ts                 SSRF 防护唯一权威（含逐跳校验的 safeFetch）
  scripts/verify-ssrf-guard.mjs         SSRF 自验（25 用例，纯本地不联网）
  deploy/backup/                        备份/恢复/安装 3 个脚本 + README（⚠️ 服务器上已经装好了，
                                        这个目录只是仓库权威副本，部署时不需要额外动作）

改动（14）
  src/app/api/media-save-status/route.ts   加强制登录（洞①）
  src/lib/local-assets.ts                  saveRemoteAsset 改走 safeFetch；curl -fL → -f
  src/lib/media-save-queue.ts              enqueue 处第二道 SSRF 防线
  src/lib/openrouter.ts                    4 处路径穿越 → 统一实现；删掉本地重复的 getMimeType
  src/lib/openrouter-video.ts              删掉重复的 toDataUrlIfLocalPublicAsset + getMimeType
  src/lib/seedance.ts                      同上
  src/app/api/media-thumbnail/route.ts     本地 isInsideGenerated → 复用共享实现（防漂移）
  src/app/api/upload-file/route.ts         文档后缀白名单 + 大小上限（multipart 和 base64 两个分支）
  src/lib/media-upload-validation.ts       新增 DOCUMENT_UPLOAD_FORMATS / validateDocumentUploadFile
  src/lib/upload-rules.ts                  documentFormats 改为 import（唯一权威）
  nginx/flashmuse.conf                     ⭐ 两个 server 块的 /generated/ + /home-assets/ 加固
  deploy/staging/flashmuse-staging.conf     ⭐ 同上
  deploy/staging/flashmuse-test-8080.conf   ⭐ 同上
  deploy/staging/flashmuse-staging-static-ssl.conf ⭐ 同上
```

**自查状态**：`npx tsc --noEmit` **全绿**；`npx eslint src` = **230 problems（106 errors / 124 warnings），
与改动前基线完全一致、零新增**；**无 Prisma 迁移**。

##### ⛔ 这批已知的缺口（部署完仍然存在，要不要补请问用户）

1. **阿里那份 `flashmuse-static-ip` 没加固**。它**也 serve `/generated/`**（阿里是国内入口 + 静态镜像），
   所以从 `ali.venusface.com` / `static.venusface.com` 访问历史 `.html` 时**仍然没有 attachment 头**。
   ⛔ 那份 conf **混着别的项目（`/tiantangqiyuan/`），按铁律禁止整份覆盖** →
   要补必须写一个幂等增量脚本，照抄 `deploy/ali/ali-add-upstream-keepalive.py` 的做法
   （精确替换 + 计数断言 + 断言别的项目未被动 + 备份 + `nginx -t` + 失败自动回滚 + 只 reload）。
   ⭐ **注意**：洞③ 的**上传侧白名单已经堵住了"新增"**，这个缺口只影响"历史已存在的危险文件"，
   而且主域名那边已经堵上了。所以不紧急，但应该补。
2. 洞①②③ 之外的其它安全项（限流、`/api/intent` 免费调用、管理员会话无状态等）**全部没做** →
   见 `08-full-audit-2026-08-02.md` 的 2.8 节。


### ✅ 已完成：数据库备份体系（本会话建立并全部验过）

每天**北京时间 03:30** 备份两服 → 本机 + 异地阿里；**每周一 04:10 自动恢复演练**。
**用法、紧急恢复步骤、9 条踩过的坑 → `deploy/backup/README.md`。**

日常只需要看一眼：

```bash
sudo cat /opt/flashmuse/backups/last-status.txt   # OK / OK_LOCAL_ONLY / FAILED
sudo tail -30 /opt/flashmuse/backups/drill.log    # 每周演练结果
```

⚠️ **这台机器没装 MTA，cron 发不出邮件** → 不会有失败通知，只能靠上面这两个文件。

### 🎯 待办 2：媒体文件备份（21GB）—— 🗣️ 用户说"单独议"

现状：阿里镜像那边**碰巧**有一份（因为同步脚本没加 `--delete`），**是巧合不是设计**，
而且不覆盖 `home-assets` 和 `.runtime`。
要做的话得单独设计（增量、限速、避开高峰），因为跨境链路只有 74KB/s。

### 🎯 待办 3：跨境线路的残留毛刺（方案 C，要花钱 → **等用户拍板**）

keepalive 已经把"每请求重新握手"这个放大器干掉了，但偶发 1.0~1.5s 毛刺还在，
因为那条线**本次实测丢包 30~40%**（比上次记录的 33% 还差些）。配置层面已经到顶。
方案见下面「上一状态」里那张表（C-1 全球加速 / C-2 国内也部一台 app / C-3 什么都不做）。
⭐ 我的建议仍是先什么都不做。

### 🎯 待办 4：红字（⛔ 别自己开工、别跑归档脚本）

正式服待排查 38 条 / 5 种，其中审核类 33 条（改不了、就该一直亮），兜底桶仅 2 条（5.3%，很干净）。
🗣️ 用户交代**等红字攒多了再排查**。

---

## 🗳️🗳️ 需要用户拍板的全部事项（**2026-08-02 第二十八次会话已全部拍板**，留档）

> ⭐ **2026-08-02 用户逐项拍板完毕**：3 按建议做且历史可以洗；4 不做了（媒体两台服务器各有一份就算备份）；
> 5 保留 1 周；6/7/8/9/10 都做；11 先不动；12 继续押后。第 1 档 + 第 2 档全做，先本地。
> **执行状态：6/7/8 + 1~2 档已完成并部署测试服 v63；9/10 是下一批。**

| # | 要拍板的事 | 我的建议 | 依据 / 代价 |
|---|---|---|---|
| **1** | ~~这批安全修复什么时候部署？~~ | ✅ **已于 2026-08-02 完成（v1.0.0.62 两服上线）** | — |
| **2** | 要不要补上**阿里 `flashmuse-static-ip`** 的 `/generated/` 加固？ | 要补，但不紧急 | 上传侧已堵住新增；这只影响历史文件从 ali/static 域名访问。⛔ 必须用幂等增量脚本（混着别的项目） |
| **3** | **数据库密码明文在 git 里**怎么处理？ | 挪到 `env_file` + **换密码**；git 历史是否重写由你定 | 已推 GitHub，换密码不洗历史 = 旧密码永久留档。共用机器，别人拿到 shell 就能连库 |
| **4** | **媒体 21GB** 要不要纳入备份？ | 要，但方案要单独设计（增量 + 限速 + 避高峰） | 跨境只有 74KB/s。现在阿里那份是**因为同步脚本没加 `--delete` 碰巧留下的，不是设计**，且不含 `home-assets` / `.runtime` |
| **5** | **数据保留/清理策略**要不要做？窗口定多久？ | 需要你定天数 | `GenerationEvent`/`GenerationJob`/`UploadEvent`/`WorkspaceMessage` **只增不减**；`UserAssetState.purgeAt` 这个列**从来不真删**。⚠️ 你长期交代过"测试内容不要删"，所以我不敢自己定 |
| **6** | **积分并发白刷**要不要修？ | 要修，2 小时的事 | 在漏真钱。扣费改原子 `decrement` 是小改动；"生成前占额度"要动更多地方 |
| **7** | 要不要提前动 **M023（`connection_limit`）**？ | 建议连同 1.2 / 1.4 一起修，因为本次发现了两个**新的**加压来源 | 🗣️ 你 2026-07-30 拍板"等下次真犯病再动" —— 所以要你重新拍 |
| **8** | 要不要补**日志轮转 / 内存上限 / healthcheck / 告警**？ | 要，1 天 | **磁盘满是下一次故障最可能的原因**，而这台机器还有另外两个项目（你交代过绝不能影响它们） |
| **9** | ⭐ **要不要拆 `chat-workbench.tsx`（18,015 行）**？ | **建议做**，2~3 天 | 它与工作流文件有 **42 对孪生函数、20 对已漂移**，其中 1 个是**线上真 bug**。不拆就会继续漂。⚠️ 前两任 AI 提过、你没否也没同意 |
| **10** | 要不要加**两个测试 + lint 门禁**？ | 建议只加 2 个（纯函数单测 + "临时字段不许落库"契约测试） | 后者能永久消灭那**一整类** bug（`promptLoading` 已经犯过两次了）。⚠️ 归档里从没讨论过测试 |
| **11** | **跨境毛刺（方案 C）**要不要花钱？ | 先什么都不做，观察 | 中位数已 0.30~0.37s，配置层面到顶。本次实测丢包 30~40% |
| **12** | 归档里丢掉的 **M029 单轮询器 / M030 文档解析**还做不做？ | 你当年都说过以后做，请重新确认优先级 | 见 `06-memo-tasks.md` |

---

## 📋 完整问题清单（1~4 档）→ 见 **`08-full-audit-2026-08-02.md`**

2026-08-02 通读全项目（含两个历史归档 + 全部源码 + 部署方案）后整理，**用户目前只批了 0 档**。
那份文档里每一条都有**文件行号 + 影响 + 建议修法**，并且交叉引用了已有的 M 编号（避免重复立项）。

**如果只看三条，看这三个现存真 bug**：

| 位置 | 问题 |
|---|---|
| `workflow-tldraw-canvas-inner.tsx:1775` | **`getStaticMediaUrl` 是个空函数**（两个分支都 `return url`）→ 工作流画布从来没用上静态域名 / 缓存破除。**线上真 bug** |
| `chat-workbench.tsx:3582` | `getPersistableSessions` 剥了 `uploadedImages` **但没剥 `uploadedFiles`** → 上传中刷新，"卡在 47%" 会**存进数据库** |
| `chat-workbench.tsx:11615` | 在 `setWorkflowItems` 的 **updater 里面发 fetch PUT**（React 可能重跑 updater → 重复发），且它是第二个写 `/api/workspace-state` 的人（250ms vs 500ms，无顺序保证） |

⭐ 那份文档最后两节同样重要，**动手前先看**：
- **「⛔ 用户明确否过的，别再提」** —— 对象存储 / CDN / 真删除 / 对话流 AI 改写 等 13 条
- **「✅ 已经做得好的，别浪费时间重做」** —— 20 条（任务队列、幂等键、按需加载读侧、
  阿里 keepalive、`deploy/ali/*.py` 那个增量脚本模板…）

---


## ✅ 上一状态（2026-08-01 第二十五次会话末）：**四方同步 `v1.0.0.60`，两服都已部署**


**正式服 = 测试服 = 本地 = GitHub = `v1.0.0.60`。无待部署、无未推、无 Prisma 迁移。**
上一会话那三条待办（同步正式服 / 鉴权必测 / M027）**全部做完了**。

> ⚠️ 2026-08-02 更新：上面这段"无待部署"已过期 —— 现在本地有一批安全修复未部署，见本文件顶部。

### 🎯 待办 1：跨境线路的残留毛刺（方案 C，要花钱 → **等用户拍板**）

keepalive 已经把「每请求重新握手」这个放大器干掉了（测试服 5.4×、正式服 4.4×），
但偶发 **1.0~1.5s 毛刺还在**，因为阿里→腾讯那条线**实测丢包 33.3%**：握手不用了，
但**传数据时丢包照样要 RTO 重传**。配置层面已经到顶。

| 方案 | 做什么 | 成本 |
|---|---|---|
| C-1 | 阿里云**全球加速 / 专线**（走内网骨干，绕开公网丢包） | 按带宽计费 |
| C-2 | **国内也部一台 app**（不只是静态镜像） | 一台服务器 + 数据同步复杂度（**跨境数据库会是新问题**） |
| C-3 | 什么都不做 | 现状 0.30~0.37s 中位数，偶发 1.5s |

⭐ **我的建议：先什么都不做，观察一段时间**。0.3s 中位数已经够用了，
毛刺的收益/成本比不如别的功能。⛔ 但这是**用户的钱和体验，必须他自己决定**。

### 🎯 待办 2：红字（⛔ 别自己开工、别跑归档脚本）

正式服待排查 **38 条 / 5 种**，其中**审核类 33 条**（模型/平台拒绝，按铁律**改不了、不归档、就该一直亮**），
**兜底桶仅 2 条**（5.3%，很干净，说明我们对线上失败的"盲区"很小）。
今日新增 29 条集中在 **4 个用户的 GPT-5.4 Image 2 拒绝出图**上 = 用户行为，不是代码分叉。
🗣️ 用户交代**等红字攒多了再排查**。

### ✅ 已消掉的两条待办（2026-08-01 用户拍板，⛔ 别再当待办捡回来）

1. **侧边栏三态不做持久化** —— 🗣️ 用户原话意思：「这个保持现状吧，**刷新回常规态挺好**。」
   ⛔ 别再提"要不要存 localStorage"。
2. **「从当前画布选择」的连线粒度** —— **查证后发现这是个不存在的问题**，已删。
   🗣️ 用户指出：「一个节点不可能生成四张图片，一个节点只能生一个视频或一张图片」+
   「**我确定以后也不会有一处节点生多图的情况。**」
   → 我原先担心的"源节点里有 4 张图会一起连进来"**在产品规则下不可能发生**
   （代码三处保证：`count: 1` / images 覆盖不追加 / 一次拖 N 张建 N 个节点）。
   **已写进 `04-product-rules.md` 并在 `getWorkflowNodeOutputUploadItems` 上注释。**
   ⭐ 顺带定了另一条：「连线跟着源图变」的行为**保持现状**（符合"连线 = 数据流"的语义）。
   ⛔ **教训（我犯的错）**：看到 `data.images` 是 `string[]` 就按"数组可能有多项"去推理，
   **没去验证业务上到底能不能出现多项** —— 被用户当场揪出来。
   **以后判断"某个字段会不会有多个"，要去看写入方（API 请求参数、赋值处），不能只看类型。**

### 本会话改动过的文件（5 个，应用逻辑一行没动）

```
deploy/staging/flashmuse-test-8080.conf            加 upstream fm_test_app + keepalive + map
deploy/staging/flashmuse-staging-static-ssl.conf   同上 + ⭐ 补齐漏掉的 proxy_buffers 和 gzip
deploy/ali/ali-add-upstream-keepalive.py           【新增】正式服幂等增量脚本（精确替换 + 计数断言 6/2/2）
src/components/workflow-tldraw-canvas-inner.tsx    ⭐ 只加了一段注释（产品规则：一个节点恒定一张图）
handover/*.md + AGENTS.md                          本次沉淀 + 3 条新铁律
```

⭐ **应用代码逻辑一行没改**（v1.0.0.60 的代码就是上一会话那份，本次只是搬到正式服 + 改 nginx + 加注释）。
⚠️ 那段注释**没有重新部署**（纯注释、不影响运行；下次任何一批部署会顺带带上去）。

---

## ✅ 上一状态（2026-08-01 第二十四次会话末）：测试服 = 本地 = `v1.0.0.60`；正式服 = GitHub = `v1.0.0.57`

> ⚠️ **下面这三条待办本会话已全部做完**，保留作为过程留档。

**未 commit、未 push、无 Prisma 迁移。** 🗣️ 用户明确说过「先不要部署正式服」。

### ✅ 待办 1（已完成）：v60 已同步正式服

正式服落后 3 个版本，差的内容：

| 版本 | 内容 | 测过没 |
|---|---|---|
| v58 | 上一会话攒的「交互性能」批（使用提示词点了立刻出节点 + **全站鉴权省一个 DB 往返**）+ 本会话的侧边栏三态 / Ctrl+V 粘贴 / 上传按钮三选菜单 | ✅ 测试服完整巡检 6 项 + 15 项功能验收**全过** |
| v59 | loading 遮罩改毛玻璃（**位置错的那版**，已被 v60 覆盖） | ⛔ 用户说不要测 |
| v60 | 毛玻璃提到整张输入卡片（正确版） | ⛔ 用户说不要测 |

**正式服流程照 `03-deploy-and-servers.md`「正式服部署流程」**：备份 → staging→prod 整份 rsync（**不再 bump**）
→ `up -d --build flashmuse-app` → **同步 `.next/static` 到阿里正式镜像**（漏了会全站 404）
→ 发版本信号 → 四域名健康检查 → **正式服也要上号巡检 6 项** → commit + push。

⚠️ **同步前建议**：v59/v60 那个毛玻璃在测试服**肉眼看一眼**（我没测），确认不是又一块白板。
⚠️ **v58 里含全站鉴权改动**（`lastSeenAt` 不 await + 60 秒节流），测试服已验「连刷 5 次不掉线 + 后台在线人数/DAU 正常」，
但**「开着页面放置 10 分钟以上再操作仍是登录态」这条一直没验过**（上一会话清单里的第 ③ 条）→ 上正式服前值得补一次。

### 🎯 待办 2：本会话新功能里两个"已报备、用户没要求改"的点

1. **「从当前画布选择」是按节点连线，不是按单张图** → 源节点里有 4 张图时会一起连进来（连线语义本来如此，超限会被拦）。
   要改成"只连那一张"需要新机制。
2. 侧边栏三态**没做持久化**（刷新回常规态）。我问过「要不要存 localStorage」，用户没回答。

### 🎯 待办 3（用户说"以后再说"，别自己开工）

- **测试服/阿里入口慢** → 已查清根因（跨境丢包 25~37% + 阿里 nginx 缺 upstream keepalive），
  三个方案在 `CHANGELOG.md` 顶条第 5 节。**推荐方案 A：测试服入口改用 `http://119.28.116.16:5001/`（零风险）**。
- **M027**：`ali.venusface.com`（正式服国内入口）大概率同样缺 keepalive，比 main 慢 3~8 倍。见 `06-memo-tasks.md`。

### 本会话改动过的文件（v58+v59+v60 合计 9 个）

```
src/lib/app-version.ts                                v1.0.0.57 → v1.0.0.60
src/lib/auth.ts                                       ⭐ 全站鉴权：lastSeenAt 不再 await + 60 秒节流（上一会话写的，本会话首次上线）
src/app/api/auth/workspace-instance/route.ts          心跳写完对齐节流计时器
src/lib/generation-jobs.ts                            窄查询 getWorkflowPromptReferenceRow（上一会话）
src/app/api/workflow-generation-references/route.ts   改调窄查询（上一会话）
src/components/asset-mention-picker.tsx               ⭐ 只加了一个可选 title（三处共用，⛔ 禁止 fork）
src/components/chat-workbench.tsx                     侧边栏三态 cycleSidebarState + logo 改刷新 + 删掉进工作流自动收起 + promptLoading 剥离
src/components/workflow-tldraw-canvas.tsx             加 leftSidebarToggleLabel / leftSidebarVisible 类型
src/components/workflow-tldraw-canvas-inner.tsx       粘贴走上传通道 + 三选菜单 + 从当前画布选择弹窗 + connectNodeAsInput + 毛玻璃遮罩
```

---

## ✅ 上一状态：**本地有一批未部署改动（交互性能）**（2026-07-31 第二十三次会话末，已随 v58 上线测试服）

线上（正式服 = 测试服 = GitHub）仍是 **`v1.0.0.57`**；本地多了下面这批，**未部署、未 bump、未提交**。
`npx tsc --noEmit` 全绿；eslint 错误数 48 → 48（一条没新增）；**无 Prisma 迁移**。

**改了 6 个文件**（做了什么见 `01-current-status.md` 顶部 / `CHANGELOG.md` 顶条）：

```
src/lib/auth.ts                                       ⭐⭐ 全站鉴权：lastSeenAt 不再 await（A）+ 60 秒节流（B）
src/app/api/auth/workspace-instance/route.ts          心跳写完对齐节流计时（2 行）
src/components/workflow-tldraw-canvas-inner.tsx       「使用提示词」点了立刻出节点 + 输入框禁用转圈态
src/components/chat-workbench.tsx                     promptLoading 不落库（剥离）
src/lib/generation-jobs.ts                            新增窄查询 getWorkflowPromptReferenceRow，删掉 SELECT * 那份
src/app/api/workflow-generation-references/route.ts   改调窄查询
```

### ⛔⛔ 先读这条：**没让测就别测、没让部署就别部署**（2026-07-31 用户拍板的新铁律）

🗣️ 用户原话意思：「以后做任务，没特殊说法就是先做本地，做完先告诉我。我没提前说就不要测试不要部署。」
默认三步 = 改代码 → `npx tsc --noEmit` → **汇报后停下等指令**。完整口径见 `AGENTS.md` **最顶部那条**。
⭐ 下面这份清单是**给"用户说了要部署/要测试"的那一刻准备的**，⛔ 不是让你现在就去跑。

### ⛔⛔ 再读这条：**一切测试只用 `12424740@qq.com`**（密码 `dragonstar`，三个库里都有）

`lookxun@163.com` 是**用户自己的号**，**只**用于登后台 `/admin`。会留痕的实验**新建一个工作流**来做
（用户交代"测试内容不要删"）。详见 `AGENTS.md`。

---

## 🎯🎯 本批「必测清单」（用户明确要求写下来的，部署时照着跑）

> ⭐ 按优先级排。**第 1~3 组是这批的高危项，一项都不能省**；第 4~6 组是功能验收。
> 部署顺序照铁律：`bump v57→v58` → 测试服 → 实机验收 → 原样同步正式服（**不再 bump**）→ 正式服也真上号验一遍。

### 🔴 第 1 组：鉴权（A+B）—— **最高优先级，因为它是全站路径且本地一个字都没验过**

| # | 怎么测 | 判读标准（**通过条件**） |
|---|---|---|
| ⭐1 | 退出登录 → 重新用 `12424740@qq.com` 登录 | 能正常登进工作台，不报错、不跳回首页 |
| ⭐2 | 登录后**刷新页面 5~6 次**，再点几个接口（切工作流、开资产库） | **每次都还是登录态**，不会莫名掉线或跳首页（验 A 的 fire-and-forget 没把会话搞坏） |
| ⭐3 | 开着工作台**放置 10 分钟以上**，再点一个需要登录的操作 | 仍是登录态（验续期心跳 `/api/auth/activity` 还在正常延长 `expiresAt`）。⛔ 这条最容易出问题，别省 |
| ⭐4 | 两个浏览器/两个标签页同时登同一个号，各点一会儿 | 都正常，互不踢下线 |
| ⭐5 | 后台 `/admin` 看**「在线用户」数字 + 用户头像上的绿色「在线」胶囊** | **和改之前一样正常**（它用 `activeWorkspaceSeenAt`，理论上零影响；这条是保险） |
| ⭐6 | 后台看**「今日活跃用户 / 7天 / 30天活跃用户」** | 数字还在正常变化（B 让 `lastSeenAt` 最多晚 60 秒，按天统计不该有差别） |
| ⭐7 | 后台某个用户详情页看**「最后活跃时间」** | 有值、且大致是刚才的时间（允许晚 60 秒内） |
| 8 | 库里核对（可选，最硬的证据）：登录后疯狂点 1 分钟，看 `Session.lastSeenAt` 被写了几次 | 应该**只被更新 1~2 次**而不是几十次（证明 B 生效）。姿势：连库 `SELECT "lastSeenAt" FROM "Session" WHERE ...` 隔几秒取两次比对 |

⛔ **如果第 2/3/4 条任何一条挂了 → 立刻把 `auth.ts` 那两条改动回滚**（把 `void` 改回 `await`、
把 `shouldWriteLastSeen()` 的判断直接 `return true`），别硬修。宁可慢也不能让用户掉线。

### 🔴 第 2 组：`promptLoading` 绝不能落库（改错了会让节点永久卡死）

| # | 怎么测 | 判读标准 |
|---|---|---|
| ⭐9 | 工作流里点一个生成图片/视频节点的「使用提示词」→ 新节点出现 → **等它加载完** → **刷新页面** | 新节点的输入框**可以正常输入**（不是灰的、没有转圈）。⛔ 若刷新后还卡在「正在加载中...」= 落库了，回滚 |
| ⭐10 | 点「使用提示词」→ **在转圈还没结束时立刻刷新页面** | 刷新后那个节点输入框**能正常输入**（这是更严的版本：临时字段在"正在转圈"的瞬间也不许被自动保存带走） |
| ⭐11 | 库里核对：`canvasJson::text LIKE '%promptLoading%'` | **必须全部为 false**。现成脚本 `.runtime/check-prompt-loading.js`（本地版，服务器上照抄 SQL） |

### 🔴 第 3 组：「使用提示词」不许丢用户数据

| # | 怎么测 | 判读标准 |
|---|---|---|
| ⭐12 | 点「使用提示词」前后，**核对源节点自己**的提示词/参考素材 | 源节点**一个字都没变**（新逻辑只往画布里加节点、只 patch 新节点） |
| ⭐13 | 点「使用提示词」→ 等加载完 → 切到别的工作流 → 再切回来 | 新节点的提示词 + 参考缩略图**都还在**（验它被正常保存了） |
| 14 | 部署前后各跑一次 `wfcheck.sql`（第二十二次会话留的，见本文件下方历史节） | 各工作流的 prompts/uploads/hist_* 条数**只增不减** |

### 🟡 第 4 组：「使用提示词」交互（这是本次需求本体）

| # | 怎么测 | 判读标准 |
|---|---|---|
| ⭐15 | 点图片节点的「使用提示词」 | **点下去几乎立刻**（同一帧）出现新节点、被选中、镜头飞过去 |
| ⭐16 | 看新节点输入框 | 整个输入框**禁用态**（点不进去、打不了字），输入区**上下左右正中**显示转圈 + 「正在加载中...」，发送按钮**置灰** |
| ⭐17 | 等接口回来 | 转圈消失、输入框可编辑、**提示词与原节点那次生成用的一致**、**参考缩略图（@名蓝字）都带回来了**、发送按钮变黑可点 |
| ⭐18 | 对**视频节点**也做一遍 15~17 | 同上（视频还要带回时长/参考模式：首帧/首尾帧/融合） |
| 19 | 对**从资产库导入的生成图**节点做一遍 | 也能带回提示词+参考（走的是"按媒体 url 回溯原始 job"那条，本次合并成一条 SQL 了，**要专门验**） |
| 20 | 对**上传的**素材节点看快捷菜单 | 「使用提示词」仍**置灰**（上传素材没有可复用的提示词） |
| 21 | 连点「使用提示词」3 下 | 出 3 个节点，**每下都立刻有反应**，画布不崩（没做防重入锁是有意的） |
| 22 | 断网/把接口打挂后点「使用提示词」 | 节点照样立刻出现；**最多 15 秒后**转圈消失、回落到画布自带的提示词（`AbortController` 兜底），**绝不永久禁用** |

### 🟡 第 5 组：性能真的变快了吗（掐表，别只凭感觉）

| # | 怎么测 | 判读标准 |
|---|---|---|
| 23 | 浏览器 Network 面板看 `POST /api/workflow-generation-references` 的耗时 | 比部署前明显下降（省了鉴权那个往返 + 最多 2 个查询往返） |
| 24 | 顺手看**任意其它接口**（如 `GET /api/workspace-state`）的耗时 | **也该快一点**（A 让全站每个接口都少一个往返）。⭐ 这是本批最大的收益，值得记个数字进 CHANGELOG |
| 25 | 分层掐表（可选，姿势见 `AGENTS.md` 性能铁律） | 容器内直打 app → 宿主打 nginx → 本机走 TLS → 跨境，四层各记一个数 |

### 🟢 第 6 组：最小巡检 6 项（每台部署完都必须跑，铁律）

登录 / 对话模式 / 工作流点节点不崩（React #310）/ 资产库 / **真跑一次生图** / 后台 `/admin` 且控制台 **0 error**。
详见 `03-deploy-and-servers.md`「部署铁律」节。⭐ 本批**没动生成链路**，所以生视频可以不跑（省钱）；
但**鉴权动了 = 所有接口都动了**，所以这 6 项一项都不能省。

---

### ⚠️ 已知的本地测试痕迹（下一任别当成用户自己的数据）

| 环境 | 痕迹 | 处置 |
|---|---|---|
| **本地** `12424740@qq.com` | `工作流_03` 多了 2 个「使用提示词」建出的空图片节点（一个带橡皮 inpainting 提示词、一个空）；`工作流_01` 多了 1 个带「把背景换成海边。美女衣服全部去除」+ `@image_5_w1` 的空图片节点 | 留着（用户交代"测试内容不要删"）；线上零影响 |
| **本地** `12424740@qq.com` | `工作流_05` 的 canvas 早前被 `deletedAt` 那个 bug 洗成 2 字节 | 代码已修，数据回不来；**只影响本地** |

### ✅ 本批留下的一次性脚本（都在 `.runtime/`，不进 git）

| 文件 | 干什么 |
|---|---|
| `check-prompt-loading.js` | ⭐ **验 `promptLoading` 没落库**（顺带看各工作流字节数/`updatedAt`） |
| `test-wf-ref-sql.js` | 验新窄 SQL 能跑并掐表 |
| `find-ref-node.js` | 找"有参考图 + 有 cleanPrompt"的工作流节点当测试素材 |

⛔ **工具坑（都踩过一次了）**：PowerShell `Out-File` 会写坏 eslint 的 json（用 eslint 的 `--output-file`）；
`npx next lint --file` 已不支持（直接 `npx eslint <文件>`）；Playwright `run_code` 沙箱里没有 `setTimeout`，
在 `page.route` 处理器里 `await page.waitForTimeout()` **会锁死页面** ——
要给接口加延迟看 loading 态请用 CDP `Network.emulateNetworkConditions` 的 `latency`，
且**必须在 `finally` 里恢复**（我这次忘了恢复，后面每步都莫名多等 3 秒、差点误判）。

---

## 🚀 其它待办（按优先级，用户没催的别自己加戏）

1. ⭐⭐ **补验「服务端在落地那刻直接改画布」**（上一任把这条写成"已验"**是错的、被用户当场揪出来了**）：
   实验设计见 `CHANGELOG.md` 里第二十二次会话那条的红框。一句话 = 起生成 → 立刻查库确认节点 `isRunning:true` 且 `images` 为空
   → **立刻 `browser_close` 把浏览器整个关掉** → 等 1~2 分钟 → **只查库**。约 8~10 积分，**新建一个工作流**来做。
2. **[顺手可做] 预览页那个 `/api/generation-references` 也是同样的毛病**（`getGenerationJobByMediaUrl` 里 `SELECT *` + 串行 2~3 个往返）。
   本次只收了工作流那条，这条**留着没动**。要收的话姿势一样（窄列 + 合成一条 SQL）。
3. **[小尾巴·可选] 多标签页完整时序补测**：只验到「两个标签页同时开同一个号 → 数据没丢」，
   完整场景（标签页 A 编辑工作流 A、标签页 B 停在工作流 B，各自自动保存）没跑完（Playwright 工具超时）。
4. **[用户已拍板不做] M026**（单个工作流内的节点分页）：用户说"先不做，以后再说"。见 `06-memo-tasks.md`。
5. **红字排查**：仍停在 v54 那一轮（待排查 9 条、全是改不了的审核类）。
   ⚠️ **用户交代：攒多了再查、别主动查、⛔ 别跑归档脚本。** 看实时数字用 `/admin?tab=failures`。
6. **[已拍板不主动做] M023**：给 `DATABASE_URL` 显式加 `connection_limit`，等它下次真犯病再取现场数据。
7. 存量小问题见本文件下方「存量待办」。

---

## 历史：第二十二次会话末的状态（**已四方同步 v1.0.0.57**）—— 下面留档备查

## ✅ （历史）当前状态：**无待部署、无未推**（2026-07-31 第二十二次会话末）

**四方同步 = `v1.0.0.57`**（正式服 = 测试服 = 本地 = GitHub），四域名全 200，无 Prisma 迁移。
本批上线 = 工作流按需加载（骨架版）+ **第二阶段「其余只发标题」** + 修掉一个真删数据的 bug。
做了什么 / 收益数字 / 验收清单全在 `CHANGELOG.md` 顶条与 `01-current-status.md` 顶部。

### ⛔⛔ 先读这条：**一切测试只用 `12424740@qq.com`**（2026-07-31 用户拍板）

🗣️ 用户原话意思：「以后本地，测试服和正式服都用 `12424740@qq.com` 这个号测试，这个记录清楚让后面的 AI 不要弄错。」
密码 `dragonstar`，三个库里都有这个号。`lookxun@163.com` 是**用户自己的号**，**只**用于登后台 `/admin`。
会留痕的实验**新建一个工作流**来做（用户交代"测试内容不要删"）。详见 `AGENTS.md` 第一条铁律。

### 🚀 接手可以做的（按优先级，用户没催的别自己加戏）

1. ⭐⭐ **补验「服务端在落地那刻直接改画布」**（我上次把这条写成"已验"，**是错的、被用户当场揪出来了**）。
   - 为什么之前那次不算、正确的实验怎么设计 → **`CHANGELOG.md` 顶条那段红框**（必读，里面还有一条通用教训）。
   - 一句话实验：测试服新建工作流 → 加图片节点点生成 → **立刻查库确认那节点是 `isRunning:true` 且 `images` 为空**
     → **立刻 `browser_close` 把浏览器整个关掉** → 等 1~2 分钟 → **只查库**：
     若变成「本地 `/generated/...` 地址 + `mediaSystemNames` 有 `image_N_wM` + `isRunning` 已清」= 只可能是服务端改的。
   - 花费约 8~10 积分。图片和视频走同一个函数（`applyWorkflowJobResultToCanvas`），验图片即可。
2. **[小尾巴·可选] 多标签页完整时序补测**：本批只验到「两个标签页同时开同一个号 → 数据没丢」。
   完整场景（标签页 A 编辑工作流 A、标签页 B 停在工作流 B，各自自动保存）没跑完（Playwright 工具超时）。
   按设计它比以前更安全（B 手里 A 是"只发标题"→ 压根不会回写 A），**但没实测**。
3. **[用户已拍板不做] M026**（单个工作流内的节点分页）：用户说"先不做，以后再说"。见 `06-memo-tasks.md`。
4. **红字排查**：仍停在 v54 那一轮。⚠️ **用户交代：攒多了再查、别主动查、⛔ 别跑归档脚本。**
   看实时数字用 `/admin?tab=failures`；方法论在 `07-red-error-triage-and-archive.md`。
5. **[已拍板不主动做] M023**：给 `DATABASE_URL` 显式加 `connection_limit`，等它下次真犯病再取现场数据。
6. 存量小问题见本文件下方「存量待办」。

### ⚠️ 已知的测试痕迹（下一任别当成用户自己的数据）

| 环境 | 痕迹 | 处置 |
|---|---|---|
| **正式服** `lookxun@163.com` | `工作流_01` 3 节点 → 5 节点（多了 `image_3_w1` 一杯咖啡 + `video_1_w1` 白猫打滚），扣 47 积分 | 用户没让删，**先留着**；要删只删这两个节点 |
| **测试服** `12424740@qq.com` | `工作流_01` +1 图片节点（`image_14_w1`）、`工作流_02` +1 视频节点（`video_10_w2`）；对话流多了一条误发的「@qq.com」对话 | 留着（用户交代"测试内容不要删"） |
| **本地** `12424740@qq.com` | `工作流_05` 的 canvas 被那个 `deletedAt` bug 洗成 2 字节（原本 1 个空文本节点 / 279 字节） | 代码已修，数据还不回来；**只影响本地** |

### ⭐ 本批留下的可复用工具（都在 `.runtime/`，不进 git）

| 文件 | 干什么 |
|---|---|
| `measure57.js` | ⭐ 量「只发标题」的真实收益：按用户比较 老口径/新口径 的 raw + gzip 字节（docker cp 进 app 容器 `node measure57.js`） |
| `wfcheck.sql` | ⭐⭐ **验"有没有删用户数据"的那条 SQL**（每工作流的 nodes/prompts/uploads/历史节点/counted/远端地址/卡住的 isRunning/字节数）。部署前后各跑一次逐行 diff |
| `prodsync57.sh` / `syncali57.sh` / `pub57.sh` / `pub57prod.sh` | 正式服备份+对齐 / 静态同步阿里正式镜像 / 测试服发布信号 / 正式服发布信号+四域名健康检查 |
| `prod-wf-baseline.txt` / `prod-wf-after.txt` | 正式服部署前后的 87 行快照（用 `Compare-Object` 逐行 diff 的原始数据） |

⭐ **核对姿势**：`ssh ... "sudo docker exec <db容器> psql -U flashmuse -d flashmuse -t -A -F '|' -f /tmp/wfcheck.sql" > 快照.txt`
然后 `Compare-Object (Get-Content 前) (Get-Content 后)`。**判据 = 任何一行的 prompts/uploads/hist_*/counted 都不许变少**。

---

## 历史：第二十一次会话末的待办（部署 + 详细测试）—— ✅ 已于第二十二次会话全部执行完毕

> ✅ 下面原文只作为「一次"接手先部署上一任攒的活"的交接长什么样」留档，**不要再照着跑一遍**。

## 🚀🚀 （已完成）当前状态：**本地有一批未部署改动（工作流按需加载，M025+）**（2026-07-30 第二十一次会话末）

线上（正式服 = 测试服 = GitHub）仍是 **`v1.0.0.56`**；本地多了下面这批，**未部署、未 bump、未提交**。
`npx tsc --noEmit` 全绿，**无 Prisma 迁移**。

### ⭐ 接手第一件事：**部署这批（用户已明确授权）+ 做详细测试**

> 🗣️ **用户 2026-07-30 原话意思**：「等做完下一个 AI 一起部署吧」「**详细测试等下个 AI 部署完再做**」。
> → 上一任只做了**简单测试**（下面列了做过哪些）。**详细测试是你的活**，清单在下面「本批必须补测的」，
> 全部内联在本文件里、**不需要翻别的文档、也不依赖 `.runtime/`（它 gitignore、可能已被清掉）**。
> 部署顺序照铁律：`bump v56→v57` → 测试服 → 实机验收 → 原样同步正式服（不再 bump）。

**改了 6 个文件**（做了什么见 `01-current-status.md` 顶部 / `CHANGELOG.md` 顶条）：

```
src/lib/workspace-workflows.ts        骨架版下发 + 三道防删 + 落地后改画布地址
src/app/api/workspace-state/route.ts  活跃工作流判定 + 单工作流画布接口 + runningWorkflowIds
src/lib/generation-jobs.ts            getRunningWorkflowIds + 成功后改画布地址
src/lib/media-assets.ts               getSavedMediaOrigins（媒体归属的服务端权威）
src/app/api/media-save-status/route.ts 返回 origin
src/components/chat-workbench.tsx     按需补拉 + 占位/重试 + 三处遍历改成读服务端
```

⛔⛔ **本批唯一会造成不可逆损失的风险点：工作流画布被写成缺字段的版本 = 真删用户提示词。**
上一任上了三道防线（见 `workspace-workflows.ts` 的 `upsertWorkspaceWorkflows` 注释），
**验收时必须按下面第 1 条实测**，别只看页面正常。

### ⭐⭐ 验收用的核对 SQL（**直接抄，别去找 `.runtime/`**）

放服务器上跑（`docker exec <pg容器> psql -U <user> -d <db> -f /tmp/x.sql`，连接信息见 `03-deploy-and-servers.md`）。
⚠️ PowerShell 吃引号，**写成 .sql 文件再 `docker cp` 进去跑**，别用 `psql -c`。

```sql
-- 「有没有删掉用户数据」+「有没有残留会过期的远端地址」一次看完
SELECT u.email, w.title,
  jsonb_array_length(COALESCE(w."canvasJson"->'nodes','[]'::jsonb)) AS nodes,
  (SELECT count(*) FROM jsonb_array_elements(COALESCE(w."canvasJson"->'nodes','[]'::jsonb)) n
    WHERE length(COALESCE(n->'data'->>'prompt','')) > 0) AS prompts,
  (SELECT count(*) FROM jsonb_array_elements(COALESCE(w."canvasJson"->'nodes','[]'::jsonb)) n
    WHERE n->'data'->'uploads' IS NOT NULL) AS uploads,
  jsonb_array_length(COALESCE(w."canvasJson"->'historicalMediaNodes','[]'::jsonb)) AS hist_media,
  jsonb_array_length(COALESCE(w."canvasJson"->'historicalTextNodes','[]'::jsonb)) AS hist_text,
  jsonb_array_length(COALESCE(w."canvasJson"->'countedGeneratedUrls','[]'::jsonb)) AS counted,
  (SELECT count(*) FROM jsonb_array_elements(COALESCE(w."canvasJson"->'nodes','[]'::jsonb)) n,
        jsonb_array_elements_text(COALESCE(n->'data'->'images','[]'::jsonb)) img
    WHERE img LIKE 'http%') AS remote_imgs,
  (SELECT count(*) FROM jsonb_array_elements(COALESCE(w."canvasJson"->'nodes','[]'::jsonb)) n
    WHERE n->'data'->>'videoUrl' LIKE 'http%') AS remote_videos,
  (SELECT count(*) FROM jsonb_array_elements(COALESCE(w."canvasJson"->'nodes','[]'::jsonb)) n
    WHERE n->'data'->>'isRunning' = 'true') AS stuck_running,
  length(w."canvasJson"::text) AS bytes, w."updatedAt"
FROM "WorkspaceWorkflow" w JOIN "User" u ON u.id = w."userId"
WHERE w."deletedAt" IS NULL
ORDER BY u.email, w.title;
```

**怎么判读**：
- `prompts` / `uploads` / `hist_media` / `hist_text` / `counted` —— **部署前后必须完全一样**，少一条就是删数据了，**立刻回滚**。
- **没打开过的工作流**，`bytes` 和 `updatedAt` 也应该**完全不变**（上一任本地实测就是纹丝不动）。
- `remote_imgs` / `remote_videos` / `stuck_running` —— **应该都是 0**（这三个是 ① 那条改动要保证的）。

### ⭐ 本批必须补测的（上一任只做了简单测试）

1. ⭐⭐ **拿真实重度用户核对上面那条 SQL**（最重要）：**部署前先跑一次存档**，
   然后上号切几个工作流 + 改点东西 + 等自动保存（约 5~10 秒），**再跑一次比对**。
   ⭐ **必须拿 `ID_868181` 这种"多工作流大画布"的号验**，小号测不出效果。
2. **`③ media-save-status 的 origin`**：本地**没能实机跑通**（本地网络快，服务端图片落地后前端手里
   根本没有远端地址，那条轮询不触发）。上一任只用 SQL 验了数据源字段齐全。
   **线上跨境慢，这条路径会真的走到** → 部署后去资产库确认：新生成的工作流图片
   **名字是 `image_N_wM` 而不是"图片生成"这种兜底名，提示词也对**。
3. **视频链路**：本批动了 `runVideoJob` 的成功分支（加了改画布地址），**本地没跑视频**。必须真跑一次生视频。
4. **`①` 的并发兜底**：生成中不停切工作流/切面板，跑完用上面 SQL 看 `remote_imgs`/`stuck_running` 是否为 0。
5. **打开非活跃工作流 → 节点上的提示词要正常显示**（最容易破的一条），且**点任意节点不能崩**
   （React #310 老坑，见 `AGENTS.md` 里 `WorkflowSelectedNodeOverlay` 那条）。
6. **工作流列表顺序不能乱**（"只打开不置顶"那个修复别回归）。
7. **多标签页**：两个标签页开同一个账号，一个在工作流 A 编辑、另一个在工作流 B，互相不能覆盖。
8. 后台 `/admin?tab=records` 里那次生成记录正常 + 常规最小巡检 6 项（`03-deploy-and-servers.md`）。

### ⭐ 量收益的工具

- `scripts/measure-workspace-state-size.mjs`（**已进 git**，用法在文件头注释）：挑重度用户、打印字节数。
- 或直接在浏览器控制台：
  `fetch('/api/workspace-state?summary=1&panel=chat').then(r=>r.text()).then(t=>console.log(t.length))`
  再看 `workflowItems` 里 `canvasTrimmed` 的个数（应该是"总数 - 1"，只有活跃那个是完整版）。

### ✅ 上一任做过的简单测试（都过了，0 控制台 error）

切工作流自动补拉（41 条提示词全在）｜来回切 4 个不丢、顺序不乱、打开不置顶｜
**重命名/删除没打开过的工作流**（标题生效、画布字节纹丝不动）｜真跑生图 4 次成功｜
生成中切走别的工作流→仍发完整版→切回来正确回填｜对话流/资产库正常｜
**核对数据库：提示词/uploads/历史节点条数与基线一字不差，没打开过的工作流连字节数和 updatedAt 都没变**。

实测收益（本地 8 工作流/162 节点）：接口响应 **233KB → 137KB（-41%）**，骨架版画布 **117KB → 69KB**。

### ⚠️ 上一任在**本地库**留下的测试痕迹（只影响本地，别当成 bug）

用 `12424740@qq.com` 测的，本地 postgres（docker `flashmuse-postgres`）里：

| 改了什么 | 现状 |
|---|---|
| `工作流_03` 加了 5 个节点（1 个空文本 + 4 张测试生图 `image_11_w3`~`image_15_w3`） | 保留，**没删**（是"生成回填正常"的活样本） |
| `工作流_07` 加了 2 个空文本节点（原 43 → 45） | 保留 |
| `工作流_06` 改名成"改名测试"过 | ✅ **已改回 `工作流_06`** |
| `工作流_05` 删除过 | ✅ **已恢复**（`deletedAt` 清空） |

⭐ 所以**本地的"基线数字"是改动后的**：01/20、02/7、03/10、04/52、05/1、06/5、07/45、08/29（节点数）。
要在本地重新比对，**以现在的数字为基线**，别拿 `CHANGELOG` 里 162 节点那组老数字对。
⛔ **线上数据一个字节都没动过**（本批从没部署过）。

### ⚠️ 一个仍未解决的事（要不要做，用户还没定）

**骨架版仍然是"每个工作流都发"**，只是每个变小了。上一任量过：骨架版每节点约 560 字节 →
**1000 个工作流仍是几十 MB**。要彻底断根需要"其余工作流只发标题"，
而本批的 ①②③ 已经把三处跨工作流遍历全部搬到服务端了 —— **地基已经打好，可以往下做**。
⛔ 用户没拍板前别动。

---

## 历史：第二十次会话末的待办（M025 讨论）—— ✅ 已于第二十一次会话拍板并实现

1. ✅ **M025 用户拍板"必须做"**（理由：以后一个人可能 100~1000 个工作流，一次性下发必卡），
   并追加要求「单个工作流内的节点以后也要分页」（= 新备忘 M026，**用户明确说这次不做**）。
2. **红字排查**：仍是 v54 那一轮，**用户交代攒多了再查、别主动查、⛔ 别跑归档脚本**。
   去 `/admin?tab=failures` 看实时数字（上次快照：正式服待排查 9 条 / 全是审核类 / 兜底桶 0 条）。
   方法论在 `07-red-error-triage-and-archive.md`。
3. **[已拍板不主动做] M023**：给 `DATABASE_URL` 显式配 `connection_limit`，等它下次真犯病再取现场数据。
4. 存量小问题见本文件下方「存量待办」。

## ✅ 此前状态：**无待部署、无未推**（2026-07-30 第二十次会话末）

**四方同步 = `v1.0.0.56`**（正式服 = 测试服 = 本地 = GitHub），四域名全 200，无 Prisma 迁移。


### ⭐ 本批留下的可复用工具（都在 `.runtime/`，不进 git）

| 文件 | 干什么 |
|---|---|
| `m025.js` | 量每个用户 canvas 的**未压缩 vs gzip** 字节 + 模拟瘦身后能再省多少（docker cp 进容器跑） |
| `baseline-prod.sh` / `after-prod.sh` | nginx 日志按响应体字节排序 Top10 + 数「落盘临时文件」告警条数 + 查 5xx |
| `check-feedback.sh` | 查某用户 `UserWorkspaceState.state->'feedbackLogs'` 条数（验 PUT 合并有没有抹数据） |
| `push-staging-nginx.sh` / `push-ali-test-nginx.sh` / `push-prod-nginx.sh` | 三处 nginx 的部署脚本（**自带备份 + `nginx -t` + 失败自动回滚 + 先打 diff**） |
| `prodsync56.sh` / `syncali56.sh` / `pub56prod.sh` / `pub56.sh` | 正式服备份+对齐 / 静态同步阿里 / 发布版本信号+健康检查 / 测试服发布信号 |

⭐ **`.runtime/m025.js` 那个"顺手量 gzip"的姿势值得记住**：
以后判断"要不要为了省字节改代码"，**先用 `zlib.gzipSync` 量一遍压缩后的大小**，
别拿未压缩字节做决策 —— 本次就是这一步把一个"看起来省 655KB"的优化否掉了。

---

## 历史：第十九次会话攒的那批部署清单（已于第二十次会话执行完毕，留档备查）

> ✅ **本节已全部执行完毕**（v1.0.0.56 两服上线 + nginx 4 处 + 11 项验收 + M025 判定）。
> 下面原文只作为「一次含 nginx 的完整部署交接长什么样」的模板留档，**不要再照着跑一遍**。

## 🚀🚀 （已完成）接手第一件事：**直接部署这两批**（2026-07-30 第十九次会话末，用户已明确授权）

> ✅ **不用再问用户要不要部署。** 用户 2026-07-30 明确交代「保证无缝接让下个 AI 部署」+ 确认「下个 AI 可以直接部署」。
> 已授权：**先测试服 → 实机验收 → 再原样同步正式服**（铁律顺序不能跳）。
> ⭐ 本批**比平常多一步**：除了代码，还要**部署 4 处 nginx 配置**（第 2 步，命令可直接抄）。
> ⛔ **只部署"已做完的"那些**（批次 A + B 的 ①③④）。**② 工作流 canvas 瘦身没做**（= M025，等用户拍板），
> 别顺手去动它。
> 服务器信息 / 命令模板照抄 **`03-deploy-and-servers.md`**；两批改动的文件清单在 `01-current-status.md` 顶部；
> 做了什么在 `CHANGELOG.md` 顶部。

### 第 0 步：确认起点

| 位置 | 版本 | 状态 |
|---|---|---|
| 线上（正式服 = 测试服 = GitHub） | `v1.0.0.55` | 三者一致 |
| 本地 | `v1.0.0.55` + **两批未提交** | **没 bump**；`npx tsc --noEmit` 全绿；**无 Prisma 迁移** |

```
git status --short
```
应看到（17 改 + 3 新增）：
```
 M AGENTS.md                                      本次新增两条铁律
 M deploy/staging/flashmuse-staging.conf          ④ nginx（腾讯测试服）
 M deploy/staging/flashmuse-test-8080.conf        ④ nginx（阿里测试服入口）
 M nginx/flashmuse.conf                           ④ nginx（腾讯正式）+ 顺手对齐了仓库漂移
 M handover/00-README.md
 M handover/01-current-status.md
 M handover/05-next-actions.md
 M handover/06-memo-tasks.md
 M handover/CHANGELOG.md
 M src/app/admin/admin-account-features-panel.tsx A 白名单开关置灰
 M src/app/admin/api/users/admin-whitelist/route.ts A 拒绝关闭永久管理员
 M src/app/admin/api/users/feature-bulk/route.ts   A 一键全关时保留永久管理员
 M src/app/admin/page.tsx                          A 传 adminWhitelistLocked
 M src/app/api/workspace-state/route.ts            B ① feedbackLogs 不下发 + PUT 合并
 M src/lib/admin.ts                                A getAdminEmails 并入永久管理员
 M src/lib/system-settings.ts                      A 落盘时补回永久管理员
 M src/lib/workspace-sessions.ts                   B ③ 投影 + PUT 恢复 + 上限 50→30
?? deploy/ali/ali-add-proxy-buffers.sh             ④ 阿里正式的幂等增量脚本
?? scripts/measure-workspace-state-size.mjs        量响应体大小/验证收益的工具
?? src/lib/permanent-admins.ts                     A 唯一来源常量
```

⚠️⚠️ **打 tgz 时别漏这三个新文件**（尤其 `src/lib/permanent-admins.ts`，漏了 build 直接失败）。
⚠️ `nginx/` 和 `deploy/` 里那几个 conf **不在 app 的 tgz 里**，是**第 2 步单独部署**的，别混在一起。

### 第 1 步：部署测试服（代码）
照 `03-deploy-and-servers.md`「测试服部署流程」。要点：
1. `node scripts/bump-version.mjs` → **v1.0.0.55 → v1.0.0.56**（⚠️ 只在这一步 bump）
2. `npx tsc --noEmit` 必须全绿
3. 打 tgz（**含 `src/lib/permanent-admins.ts`**）→ scp → 解到 `/opt/flashmuse-staging/app`
4. `nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（后台跑 + 轮询 tail）
   - **无迁移**，entrypoint 应输出 "No pending migrations"
5. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`
6. sed 改 `PUBLISHED_APP_VERSION: "v1.0.0.56"` + `force-recreate staging-app`

### 第 2 步：⭐ 部署 nginx（本批特有，**代码部署完再做**；下面命令可直接抄）

> 统一前置（下文 `$PEM` 就指它）：
> `$PEM = "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem"`
> ⚠️ 4 处都要做：腾讯测试 / 阿里测试 / 腾讯正式 / 阿里正式。**测试服那两处先做、验证完再做正式那两处。**

**2.1 腾讯测试服（容器 `flashmuse-staging-staging-nginx-1`）**
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "deploy\staging\flashmuse-staging.conf" ubuntu@119.28.116.16:/tmp/
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 @'
set -e
sudo cp /opt/flashmuse-staging/data/nginx/flashmuse-staging.conf /opt/flashmuse-staging/data/nginx/flashmuse-staging.conf.bak.$(date +%Y%m%d-%H%M%S)
sudo sed -i "s/\r$//" /tmp/flashmuse-staging.conf
sudo cp /tmp/flashmuse-staging.conf /opt/flashmuse-staging/data/nginx/flashmuse-staging.conf
sudo docker exec flashmuse-staging-staging-nginx-1 nginx -t
sudo docker exec flashmuse-staging-staging-nginx-1 nginx -s reload
echo STAGING_NGINX_OK
'@
```
⚠️ `nginx -t` 不过就把 `.bak` 拷回去再 reload。

**2.2 阿里测试服入口（阿里主机 `/etc/nginx/sites-enabled/flashmuse-test-8080`，走腾讯跳板）**
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "deploy\staging\flashmuse-test-8080.conf" ubuntu@119.28.116.16:/tmp/
```
然后把下面存成本地 `.runtime/push-ali-test-nginx.sh`，scp 到腾讯 `/tmp` 再 `sudo bash`（⛔ 别用 ssh 内联，PowerShell 会吃掉引号）：
```bash
#!/bin/bash
set -e
KEY=/opt/flashmuse/data/runtime/flashmuse_to_ali_ed25519
ALI="ssh -o StrictHostKeyChecking=no -i $KEY root@101.37.129.164"
sed -i 's/\r$//' /tmp/flashmuse-test-8080.conf
scp -o StrictHostKeyChecking=no -i $KEY /tmp/flashmuse-test-8080.conf root@101.37.129.164:/tmp/
$ALI 'set -e
  mkdir -p /root/nginx-backups
  cp /etc/nginx/sites-enabled/flashmuse-test-8080 /root/nginx-backups/flashmuse-test-8080.$(date +%Y%m%d-%H%M%S).bak
  cp /tmp/flashmuse-test-8080.conf /etc/nginx/sites-enabled/flashmuse-test-8080
  nginx -t && nginx -s reload && echo ALI_TEST_NGINX_OK'
curl -s -o /dev/null -w "8080=%{http_code}\n" http://101.37.129.164:8080/
```

**2.3 腾讯正式服（容器 `flashmuse-flashmuse-nginx-1`）**
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "nginx\flashmuse.conf" ubuntu@119.28.116.16:/tmp/
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 @'
set -e
sudo sed -i "s/\r$//" /tmp/flashmuse.conf
echo "===== diff（只该看到本次新增的 proxy_buffer*/gzip 那几行）====="
sudo diff /opt/flashmuse/data/nginx/flashmuse.conf /tmp/flashmuse.conf || true
'@
```
⭐ **先看 diff**：仓库这份已按服务器实际内容对齐过（含 443 server 块 + `/generated` 的 CORS 头），
所以 diff 里**只应该出现 `proxy_buffer*` / `proxy_max_temp_file_size` / `gzip*` / `Accept-Encoding` / 注释**这些新增行。
若出现别的差异 = 期间有人手改过服务器，**先搞清楚再覆盖**。确认后：
```powershell
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 @'
set -e
sudo cp /opt/flashmuse/data/nginx/flashmuse.conf /opt/flashmuse/data/nginx/flashmuse.conf.bak.$(date +%Y%m%d-%H%M%S)
sudo cp /tmp/flashmuse.conf /opt/flashmuse/data/nginx/flashmuse.conf
sudo docker exec flashmuse-flashmuse-nginx-1 nginx -t
sudo docker exec flashmuse-flashmuse-nginx-1 nginx -s reload
echo PROD_NGINX_OK
'@
```

**2.4 阿里正式（ali/static）**：⛔ **绝对不要整份覆盖** ——
那份 `flashmuse-static-ip` 里还有**别的项目**的配置（`/tiantangqiyuan/`），整份覆盖会违反「绝不影响其它项目」铁律。
跑仓库里的幂等增量脚本（自带备份 + `nginx -t` + 失败自动回滚 + 跑完打四域名状态码，可重复跑）：
```powershell
scp -i $PEM -o StrictHostKeyChecking=no "deploy\ali\ali-add-proxy-buffers.sh" ubuntu@119.28.116.16:/tmp/
ssh -i $PEM -o StrictHostKeyChecking=no ubuntu@119.28.116.16 "sed -i 's/\r$//' /tmp/ali-add-proxy-buffers.sh && sudo bash /tmp/ali-add-proxy-buffers.sh"
```
期望输出里有 `插入了 2 处`（正式那份有两个 server 块）+ `nginx -t 通过并已 reload` + 四域名 200。
⭐ 若输出 `已经加过了（找到 marker），幂等跳过` = 之前跑过，正常。

**2.5 ⭐ 验证 gzip 真的生效了**（4 处都验，`Content-Encoding: gzip` 必须出现）
```powershell
"测试服(阿里8080)"; curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" http://101.37.129.164:8080/api/models | Select-String "content-encoding|HTTP/"
"正式(腾讯main)";   curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" https://main.venusface.com/api/models | Select-String "content-encoding|HTTP/"
"正式(阿里ali)";    curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" https://ali.venusface.com/api/models | Select-String "content-encoding|HTTP/"
```
⚠️ `/api/models` 响应可能小于 `gzip_min_length 1024` 而不压 —— 那就换成登录后打
`/api/workspace-state?summary=1&panel=chat`（浏览器 Network 里看最直观，同时能验响应体变小）。

### 第 3 步：测试服实机验收（⭐ 是必须点到的）

测试账号 `12424740@qq.com` / `dragonstar`。

| # | 怎么测 | 期望 |
|---|---|---|
| ⭐1 | 后台 `/admin?tab=account-features` 看 `lookxun@163.com` 那行 | 「后台白名单」开关**蓝色但点不动**，hover 提示「该账号是永久管理员…」 |
| ⭐2 | 直接打接口试着关它（绕过前端）：`POST /admin/api/users/admin-whitelist {userId, whitelisted:false}` | 返回 **400**「该账号是永久管理员，后台白名单不可关闭」 |
| 3 | 别的账号的白名单开关 | 照旧可开可关 |
| ⭐4 | **打开工作台，Network 看 `/api/workspace-state?summary=1&panel=chat`** | ① 响应**明显变小**；② 响应头有 **`Content-Encoding: gzip`**；③ **响应里没有 `feedbackLogs`** |
| ⭐5 | 对话流：滚到底看历史 | 首屏 **30 条**（原 50），往上有「加载更早的消息」且能正常加载出来 |
| ⭐6 | **随便点一条历史图片/视频消息的「使用提示词」** | 提示词**正常显示、和原来一致**（这是验③投影没把提示词弄丢，**最关键的一条**） |
| ⭐7 | 点几个「喜欢/不喜欢/回答不对」，刷新页面，再点一次 | 不报错；**去 DB 查 `UserWorkspaceState.state->'feedbackLogs'` 条数应该在增长、不能被清零**（验 ① 的 PUT 合并） |
| ⭐8 | 发一条新消息 + 生成一张图，刷新 | 消息、图、提示词全在（验 ③ 的 PUT 恢复没把库里字段删掉） |
| 9 | 工作流模式：点节点、拖节点、切换工作流 | 一切照旧（本批**没动** canvas，②还没做） |
| 10 | 资产库 / 后台各页 | 正常，0 控制台 error |
| ⭐11 | 跑一次生图 + 一次生视频 | 成功 |

⚠️ **#6/#7/#8 是本批风险最集中的三条**（投影 + PUT 恢复），务必实测。
⭐ **最好拿"聊得多、有很多图文消息"的号验**（测试服 `12424740@qq.com` 有资产）。

### 第 4 步：同步正式服
照 `03`「正式服部署流程」（备份 → rsync 对齐 → build → 同步 `.next/static` 到阿里**正式**镜像 → 发布信号 → 四域名健康检查）。
⚠️ **不再 bump**。⚠️ **正式服的 nginx（2.3 / 2.4）也要做**。

### 第 5 步：两台都真上号巡检（铁律，`03` 的「最小巡检 6 项」）
⭐ 本批动了工作区读写链路 → **除 6 项之外，正式服也要再验一遍上面的 #4/#6/#8**。

### 第 6 步：⭐ 量一下实际收益（本批特有，值得做）
部署后重跑一次 nginx 日志排序，确认那个接口的响应体真的下来了：
```
sudo docker logs --tail 50000 flashmuse-flashmuse-nginx-1 2>&1 | grep 'workspace-state' \
 | awk '{for(i=1;i<=NF;i++) if($i ~ /^"(GET|PUT|POST)$/){print $(i+4)"\t"$(i+1); break}}' | sort -rn | head -10
```
- 改动前：Top 是 **1,188,114 字节**
- 期望：明显变小（②还没做的用户仍可能有几百 KB，见 M025）
- ⭐ 也可以把 `scripts/measure-workspace-state-size.mjs` 拷进容器再跑一次对比

### 第 7 步：收尾
- `git add` 全部（含 2 个新增）→ commit → push
- 更新 `00-README.md` / `01-current-status.md` / 本文件顶部为"四方同步 v1.0.0.56"
- ⛔ **不要跑归档脚本**（红字仍是新一轮，攒够再说）
- ⭐ **回头问用户 M025（②工作流 canvas 瘦身）要不要做** —— 那是剩下最大的一块（单用户 655KB）

### ⚠️ 回滚
- **代码**：按 `03` 用 `/opt/flashmuse/app-backups/<时间戳>` 复原。
- **nginx**：正式/测试的 conf 覆盖前都要留 `.bak`；阿里正式那个脚本自动备份到 `/root/nginx-backups/`。
- ⭐ **本批无迁移**，数据库不用动。
- ⚠️ **③ 的投影若真出问题**（提示词显示不对），最快的止血是把 `workspaceMessageRowsToMessages` 里
  `projectWorkspaceMessageForClient(...)` 这层调用去掉（一行），立刻恢复原样 ——
  **库里的数据一直是完整的**，投影只影响下行。

## 📌 其它状态（部署完之后看这里）

### 红字：仍是 v54 那一轮，**别主动查、别跑归档脚本**
用户 2026-07-29 交代：「从 v54 部署完开始看后面新出现的红字，**等红字多了以后再排查**」。
第十九次会话末快照：正式服 **待排查 9 条 / 2 种、兜底桶 0 条、已归档 745**，
9 条**全是「审核 / 内容策略类」**（平台或模型拒绝，我们改不了 → 按铁律不归档、就该一直亮着）。
→ 量还很少就直接跟用户说"红字还没攒够，建议再等等"；量够了按 `07-red-error-triage-and-archive.md` 排。

### ⚠️ 运营上要留心的一点（v55 的既定副作用，不是 bug）
v55 那条迁移让「解除限制」**全站默认关**，正式服目前**只有 `lookxun@163.com` 开着**，其余 36 个账号都是关的。
原来靠全局开关吃专属 Endpoint ID 的用户，从 v55 起内容敏感的提示词会开始被平台拒。
→ **有人反馈"以前能出图现在被拒"，去 `/admin?tab=account-features` 把他的「解除限制」打开即可。**

### 存量待办
- **[🗣️ 待与用户讨论] M025**：② 工作流 canvas 瘦身。
  **用户 2026-07-30 交代「把 M025 记录清楚，我跟下一个 AI 讨论一下」** → ⛔ 没拍板前别动代码。
  我的建议是**倾向不做**：gzip 上线后最重用户的 canvas 只有 105KB（未压缩 655KB），
  M025 还能省的只剩 ~31KB，而病根（撑爆 32KB 缓冲被落盘）已被 `proxy_buffers 32 32k` 堵死、告警 8→0。
  **完整讨论材料（是什么 / 值多少 / 建议理由 / 真要做的三步方案 + 必测清单）在 `06-memo-tasks.md` 的 M025。**
- **[已拍板不主动做] M023**：给 `DATABASE_URL` 显式配 `connection_limit`，留 v54 那句红字当哨兵，等它下次真犯病再取现场数据。
  ⛔ 别照抄"25~30"（病因 A/B 解法相反）、别改 `.env.local`（会被 compose 覆盖）、别想在测试服压测求这个数。

---

## 历史：第十八次会话的部署清单（已于第十九次会话全部执行完，留档备查）

> ✅ **本节已于 2026-07-30 第十九次会话全部执行完毕**（v1.0.0.55 两服上线 + 14 项验收 + 两件手工事 + 收尾提交）。
> 下面内容只作为模板留档，**不要再照着跑一遍**。

## 🚀🚀 （已完成）接手第一件事：**直接部署**（2026-07-30 第十八次会话末，用户明确交代"下一个 AI 直接部署掉"）

> ⚠️ **不用再问用户要不要部署。** 已授权：**先测试服 → 实机验证 → 再整份同步正式服**（铁律顺序不能跳）。
> 服务器信息 / 命令模板照抄 **`03-deploy-and-servers.md`**。本节只列**本批特有**的东西。
> 本批做了什么，看 `CHANGELOG.md` 顶部「2026-07-30（第十八次会话）」那条（很详细）。

### 第 0 步：确认起点

| 位置 | 版本 | 状态 |
|---|---|---|
| 线上（正式服 = 测试服 = GitHub） | `v1.0.0.54` | 三者一致 |
| 本地 | `v1.0.0.54` + **24 改 + 7 新增未提交** | **没 bump**；`npx tsc --noEmit` 全绿；⭐ **有 1 个 Prisma 迁移** |

```
git status --short    # 应看到 24 个 M + 7 个 ??，清单原样列在 CHANGELOG 第 0 节
```

⚠️⚠️ **打 tgz 时务必带上这两个新目录，漏了会当场炸**：
- `prisma/migrations/20260730000000_user_unlock_limits_enabled/`（漏了 → 新列不存在 → 后台新页和所有生成链路查 `unlockLimitsEnabled` 全崩）
- `src/app/admin/api/users/{unlock-limits,admin-whitelist,feature-bulk}/`（漏了 → 后台开关点了 404）

### 第 1 步：部署测试服
照 `03-deploy-and-servers.md`「测试服部署流程」。要点：
1. `node scripts/bump-version.mjs` → **v1.0.0.54 → v1.0.0.55**（⚠️ 只在这一步 bump，正式服不再 bump）
2. `npx tsc --noEmit` 必须全绿
3. 打 tgz（**含 `src/lib/app-version.ts` + 上面那两个新目录**）→ scp → 解到 `/opt/flashmuse-staging/app`
4. `nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（**后台跑 + 轮询 tail**，防 120s 工具超时）
5. ⭐ **这次 entrypoint 的 `migrate deploy` 会真的跑一条迁移**（不再是 "No pending migrations"）→
   **去 tail 里确认它输出了 `20260730000000_user_unlock_limits_enabled` 且成功**
6. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`
7. sed 改 `PUBLISHED_APP_VERSION: "v1.0.0.55"` + `force-recreate staging-app`
8. 验证 `x-app-version` = v1.0.0.55，外网 `http://101.37.129.164:8080/` 200

### 第 2 步：⭐⭐ 部署后**必须手工做**的两件事（每台服务器都要，别漏）

**2.1 迁移把 `unlockLimitsEnabled` 默认设成 `false` = 全站解除限制"当场全关"。**
用户就是要这个（"所有开关默认关闭"），但**后果要知道**：原来靠全局开关吃着专属 Endpoint ID 的用户，
部署那刻起改发公开模型名 → **平台审核变严，内容敏感的提示词会开始被拒**。
→ **部署完立刻去 `/admin?tab=account-features`，把该给的账号手工打开「解除限制」**
（至少建议：正式服 `lookxun@163.com`、测试服 `12424740@qq.com`，否则你自己实机验生图就可能被拦）。

**2.2 把服务器 `.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS` 改成 `false`。**
它现在只是"拿不到 userId 时"的回落。留着 `true` 会造成语义矛盾（所有账号都关、边角调用却仍解除限制）。
- 正式服：`/opt/flashmuse/data/.env.local`；测试服：`/opt/flashmuse-staging/data/.env.local`
- 改完 `force-recreate` 对应 app 容器（env 变化必须重建）
- ⚠️ 先 `grep BYTEPLUS_UNLOCK_LIMITS` 看当前值，若本来就是 false 就不用动

### 第 3 步：测试服实机验收清单（⭐ 是必须点到的）

测试账号：`12424740@qq.com` / `dragonstar`。

| # | 怎么测 | 期望 |
|---|---|---|
| ⭐1 | 后台左侧出现「帐号功能管理」，点进去 | 4 张卡片 + 表格正常，0 控制台 error |
| ⭐2 | 点某账号的「解除限制」开关 | 状态能存下来（页面会 reload） |
| ⭐3 | 点表头「通用模式」总开关 | 弹**项目样式的白色确认框**（不是"localhost 显示"那种），确认后卡片数字变 |
| 4 | 「后台白名单」列表头 | **没有**总开关（按要求隐藏） |
| ⭐5 | 试着把**自己**的白名单开关关掉 | 弹出错框「不能把自己移出后台白名单」 |
| 6 | 「模型开关」页 BytePlus 那行 | 「解除限制」已消失、排版没错乱 |
| 7 | 「用户管理」页 | 卡片是 `正常用户/禁用用户 95/7`（**只有禁用数字红色**）+ 「在线用户」；表格**没有**通用模式列 |
| ⭐8 | 另开一个前台标签页登录着，回后台用户管理看自己 | 头像下沿有绿色「在线」胶囊，**横排**、**行高没变** |
| ⭐9 | **给自己开着解除限制**，真跑一次生图 + 一次生视频 | 成功（验三条链路 unlockLimits 透传没改坏） |
| ⭐10 | **把解除限制关掉**，用敏感提示词跑一次生图 | 失败，且红字是「模型因色情/暴力/隐私安全等原因拒绝出图…以下是模型返回的拒绝原因：“**输入的提示词文字被平台判定含敏感信息**”」（**不是**"更换参考素材"） |
| ⭐11 | 工作流：点一个图片节点/视频节点 | 快捷菜单出现「使用提示词」，点了在右侧生成带提示词+参考图的新节点；**画布不崩** |
| ⭐12 | 工作流：点开 02/04/08 什么都不做，切走再回来 | 左侧列表**顺序不动**（多切几次；第一次打开会存一次洗干净的数据） |
| ⭐13 | 工作流：拖一下节点 / 生成一张图 | **会置顶** |
| 14 | 对话流发一条消息、Agent 模式问一句 | 正常（验文本链路 unlockLimits 没改坏） |

⚠️ **#12/#13 是本批唯一"改完没被用户复验"的功能**（用户当时转去做后台了），务必实测。

### 第 4 步：同步正式服
照 `03-deploy-and-servers.md`「正式服部署流程」1~8 步（备份 → rsync 对齐 → build → 同步 `.next/static`
到阿里**正式**镜像 `flashmuse-static`（**不是** `-test`）→ 发布信号 → 四域名健康检查）。
⚠️ **不再 bump**，原样带 v1.0.0.55。⚠️ **正式服也要做第 2 步那两件手工事**。
⚠️ 正式服 entrypoint 同样会跑那条迁移 → 确认成功。

### 第 5 步：部署完两台都真上号巡检（铁律，`03` 的「最小巡检 6 项」）
curl 200 ≠ 没崩。登录 / 对话模式 / 工作流点节点不崩 / 资产库 / 真跑生图（动过视频链路 → **也要跑生视频**）/ 后台 `/admin` 0 error。
⭐ 本批动了图片·视频·文本**全部三条**生成链路，**生图和生视频都必须真跑**。

### 第 6 步：收尾
- `git add` 全部（含 7 个新增）→ commit → push（GitHub 同步）
- 更新 `00-README.md` / `01-current-status.md` / 本文件顶部为"四方同步 v1.0.0.55"
- ⛔ **不要跑归档脚本**（红字是新一轮，攒够再说，见 `07` 顶部红框）

### ⚠️ 回滚
出问题按 `03` 的回滚指引用 `/opt/flashmuse/app-backups/<时间戳>` 复原。
⭐ **注意迁移不会自动回滚** —— 但新列是"多一列、默认 false"，**旧代码不读它、完全兼容**，所以代码回滚即可，不用动数据库。

---

## 历史：第十七次会话的状态（已被上面这批取代，留档备查）

## ⭐ 当前状态（2026-07-29 第十七次会话更新）

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.54`**，四域名全 200，无待部署、无未推、无 Prisma 迁移。
✅ **两台都实机巡检过、0 控制台 error**（登录/对话/工作流点节点/资产库/真跑生图/真跑生视频/后台）。
✅ **红字整轮清零**：正式服归档 221 条、测试服 46 条，两服待排查 = 0，`B_xxx` 计数器归 0（下一条报错是 `B_1`）。

## 🎯 接手第一件事：**什么都别急着改**

用户 2026-07-29 明确交代：**「从部署完开始看后面新出现的红字，新一轮开始。等红字多了以后再排查问题。」**

所以现在**不要主动去排红字**（后台此刻是干净的 0 条，查不出东西）。正确动作：

1. 先去后台 `/admin?tab=failures` 看一眼**新一轮攒了多少条**（`待排查失败事件` 那个数字）。
2. **量还很少（比如 10 条以内）→ 直接跟用户说"红字还没攒够，建议再等等"**，然后等用户派新活。
3. **量够了 → 按 `07-red-error-triage-and-archive.md` 的方法论排查**（先用 `/admin?tab=failures` 这页，
   别手写 SQL；铁律：`failureReason` 是给用户看的文案，真实根因只在 `.runtime/*-diagnostics-log.jsonl` 里）。

⛔ **别再去翻 A 表**：A 表 9 条已在第十六次会话全部收口，且相关历史事件已在本次整轮清零里归档掉了。

### 唯一一个存量项（已拍板：不主动做，等它下次犯病）

**A4 真修复：给 `DATABASE_URL` 显式配 `connection_limit`** → 备忘 **M023**（`06-memo-tasks.md`，2026-07-30 已重写）。
⭐ **2026-07-30 用户拍板：现在不动，留 v54 那句红字当哨兵，等它下次真发生时趁热取现场数据再改。**
⛔ **别照着"25~30"闭眼改**：正确数值取决于病因是「池子太小」还是「慢查询占住连接不还」，**两者解法方向相反**；
⚠️ 也**别去改 `.env.local`**（compose 的 `environment:` 会覆盖它，改了无效）—— 要改**两个 `docker-compose.yml`**。
⛔ **别想"在测试服压测出并发数再同步正式服"**：测试服空载测不出、且与正式服共享同一台物理机（压测会拖慢正式服）。
详细的病因判别法（`pg_stat_activity` 那三步）+ 正确改法都写在 M023 里。目前**零复发**（最后一次 07-17）。

⛔ **已被用户否掉、别再提**：把参考图**缩尺寸**（最长边 2048）——
用户明确要求「**图片过大不要动**（不动尺寸）……如果是体积大可以压缩一下保存好，质量保证在 90%」。
v54 走的就是**只降质量、保尺寸**那条路，线上实测 -78.5%，够用。

---

## 历史：第十六次会话留下的部署清单（已于第十七次会话全部执行完，留档备查）


## 🚀🚀 （已完成）接手第一件事：**直接部署**（用户 2026-07-29 第十六次会话末明确交代"下一个 AI 直接部署"）

> ✅ **本节已于 2026-07-29 第十七次会话全部执行完毕**（v1.0.0.54 两服上线 + 实机验收 + 收尾 4 件事 + 整轮清零）。
> 下面内容只作为「一次完整部署长什么样」的模板留档，**不要再照着跑一遍**。


> ⚠️ **不用再问用户要不要部署。** 用户已授权：**先测试服 → 验证 → 再同步正式服**（铁律顺序不能跳）。
> 详细服务器信息 / 命令模板见 **`03-deploy-and-servers.md`**（照抄那两节的流程即可）。本节只列本次特有的东西。

### 第 0 步：确认起点（应该和下面完全一致）

| 位置 | 版本 | 状态 |
|---|---|---|
| 线上（正式服 = 测试服 = GitHub） | `v1.0.0.53` | 三者一致 |
| 本地 | `v1.0.0.53` + **12 个文件未提交** | **没 bump**；`npx tsc --noEmit` 全绿；**无 Prisma 迁移** |

```
git status --short   # 应该看到下面这 12 个（5 个 handover + 7 个代码/脚本）
```

**代码/脚本（7 个 src + scripts，必须全部带上）**：

```
src/components/chat-workbench.tsx                 上传完当场转正（A5 前端根治）+ 4 个跟踪上报
src/app/api/client-error/route.ts                 上传链路客户端上报落盘到 upload-diagnostics-log
src/app/api/video/route.ts                        data: 参考图落盘后送审（A5）／凭证过期当场重送审
src/lib/local-assets.ts                           ⭐ 上传大图按 90% 质量原地压缩（A1 真修，不动尺寸）+ .rotate()
src/lib/generation-jobs.ts                        runVideoJob 三个失败分支补日志 + 连续失败上限
src/lib/openrouter-video.ts                       轮询失败改用 video-provider-poll-failed 事件名
src/lib/video-diagnostics-log.ts                  summarizeVideoReference 补 data 分支
src/lib/error-message.ts                          A1/A2/A4 明确映射 + api key 收紧 + 环境类单列 + B5/B6 合并
src/lib/image-upload-validation.ts                格式白名单唯一来源 + 压缩阈值/质量常量
src/lib/upload-rules.ts                           删掉 bytePlusImageFormats
scripts/archive-resolved-generation-failures.mjs  新归档规则 + dry-run 明细 + 全局护栏
```

⚠️⚠️ **`scripts/archive-resolved-generation-failures.mjs` 千万别 `git checkout` 掉** ——
**归档动作第十五次会话已经在正式服 DB 上跑过了**（224 → 220 条待排查），但脚本代码一直没提交。
丢了它，以后再跑归档会**误吃新数据**（那条新规则 + 全局护栏都在里面）。

### 第 1 步：部署测试服

按 `03-deploy-and-servers.md`「测试服部署流程」6 步走。要点：

1. `node scripts/bump-version.mjs` → **v1.0.0.53 → v1.0.0.54**（⚠️ 只在这一步 bump，正式服不再 bump）
2. `npx tsc --noEmit` 必须全绿
3. 打 tgz（**含 `src/lib/app-version.ts`**）→ scp → 解到 `/opt/flashmuse-staging/app`
4. `nohup sudo docker compose up -d --build staging-app > /tmp/sb.log 2>&1 &`（**后台跑 + 轮询 tail**，防 120s 工具超时）
5. `sudo bash /opt/flashmuse-staging/sync-ali-test.sh`
6. sed 改 `PUBLISHED_APP_VERSION: "v1.0.0.54"` + `force-recreate staging-app`
7. 验证 `curl -D - http://127.0.0.1:5001/api/models | grep x-app-version` = v1.0.0.54，外网 `http://101.37.129.164:8080/` 200

**无 Prisma 迁移**，entrypoint 那句 `migrate deploy` 应该输出 "No pending migrations"。

### 第 2 步：测试服实机验收清单（本次改动的验收点，⭐ 是必须点到的）

测试账号：`12424740@qq.com` / `dragonstar`（登录页选"密码登录"→填邮箱→提交→填密码）。

| # | 怎么测 | 期望 |
|---|---|---|
| ⭐1 | **对话流上传一张图**，开浏览器 Network 看 | 上传当下就打了 `POST` **和** `PATCH /api/asset-upload-temp`（以前 PATCH 要等点发送） |
| ⭐2 | 接着点发送 | **不再有第二次 PATCH**、**没有** `/api/upload-image`；`/api/image` 请求体里 `referenceImages` 是 `/generated/...` 而**不是** `data:base64` |
| 3 | 输入框缩略图 | 正常显示、**不闪**（预览仍用本地 dataURL，只有 `url` 换成了正式地址） |
| 4 | **同一张图再传一次** | 提示"图片已存在，无需重复上传！"，且**不多打 PATCH** |
| ⭐5 | **传一张 >2MB 的手机照片**（最好带 EXIF 方向的竖拍照） | ①存下来的文件明显变小（看容器里 `ls -l`）②**像素尺寸没变** ③**方向正常、没横躺** ④日志出现 `upload-image-oversized-recompressed` |
| 6 | 传一张 <2MB 的小图 | 日志**不**出现 recompress 事件（字节不该被碰） |
| 7 | 正常生图 / 生视频各一次 | 成功，没被这批改动影响 |
| 8 | 工作流拖图进画布 + 跑一次生图 | 正常（工作流那条路本次没动，但 `local-assets` 是共用的） |
| 9 | 后台 `/admin?tab=failures` | 页面正常、0 控制台错误 |

⚠️ **老数据的红字不会变**（是持久化字符串）。要验新文案必须**新发起**一次并让它真失败，不方便造就跳过 —— 纯函数回归已经跑过 21/21。

### 第 3 步：同步正式服

按 `03-deploy-and-servers.md`「正式服部署流程」1~8 步（**备份 → rsync 对齐 → build → 同步 `.next/static` 到阿里正式镜像 → 发布信号 → 四域名健康检查**）。
⚠️ **不再 bump**，正式服原样带 v1.0.0.54（版本号一样 = 代码一样）。
⚠️ 静态一定要同步到**正式**镜像 `flashmuse-static`，**不是** `-test`。

### 第 4 步：部署完必须做的 4 件事（别忘，这是本次的收尾）

**4.1 ⭐ 归档 A5 那 4 条**（根因已修）。分两步改 `scripts/archive-resolved-generation-failures.mjs`：

① 从 `NEVER_ARCHIVE_REASON_PATTERNS`（约 63 行）里**删掉**这一行 + 它上面那句注释：

```js
  // 我们自己的 bug，2026-07-29 仍在发生、尚未修（某个参考素材解析不出公网直链就放弃送审）。
  /参考素材不是可审核的公网地址/,
```

② 往 `RESOLVED_RULES` 加一条（⚠️ **必须配 `before` = 你部署正式服的时刻**：修的是"base64 参考图"这一种成因，
以后若再出现同样红字必是**别的**成因、应该继续亮着）：

```js
  {
    key: "reference-not-public-url-data-base64",
    match: /参考素材不是可审核的公网地址/,
    before: new Date("2026-07-XXTXX:XX:00Z"),   // ← 填正式服部署完成时刻（UTC）
    note: "参考图是 data: base64 导致送审拿不到公网直链、整单被毙。v1.0.0.54 两层修：服务端把 data: 落盘后再送审 + 对话流改成上传完当场转正。以后新发生的同名红字必是别的成因，不再归档。",
  },
```

**4.2 ⭐ 归档 A7 那批「网络连接异常」**（curl 缺失已修、07-14 后零复发）。
⚠️ **不能按 failureReason 匹配**（「网络连接异常，请稍后重试。」是真网络错误共用的文案，会误吃）——
必须按**日志原文**匹配（脚本的 haystack 含日志原文）：

```js
  {
    key: "spawn-curl-enoent",
    match: /spawn curl ENOENT/,
    note: "容器里没装 curl，curl 兜底重试必然失败、还被通用规则误报成"网络连接异常"。Dockerfile 已装 curl，全站仅 4 条、全在 2026-07-14 11:12~11:15，之后零复发；v1.0.0.54 起这类错误改映射成「服务端环境异常」。",
  },
```

⭐ **跑之前先 dry-run，并逐条扫一眼明细里的 failureReason**（别只看数字，这是第十五次会话的血泪教训）。
⚠️ 本地 dry-run 永远是 0（本地库没线上数据）→ 必须 `docker cp` 进容器 `/app` 再 `docker exec -w /app node scripts/...`。
⚠️ 归档前的待排查条数是 **220 条（快照）**，跑之前重新数。

**4.3 ⭐ 观察新加的跟踪点**（`grep` 正式服 `/opt/flashmuse/data/runtime/upload-diagnostics-log.jsonl`）：

```
# 这 4 条正常应该是 0 条（出现 = 上传即转正还有漏网路径）
client-send-time-commit-still-needed
client-send-time-data-url-fallback
client-send-time-data-url-fallback-failed
client-send-time-persist-uploaded-images-failed

# 这 3 条是新压缩的：-recompressed 应大量出现（说明在干活），-failed 应为 0
upload-image-oversized-recompressed
upload-image-oversized-recompress-skipped
upload-image-oversized-recompress-failed
```

**4.4** 后台 `/admin?tab=failures` 抽查 A1/A2/A4 三条新文案**各自聚成一条**（尤其 A2 那句带模型原文的，
靠 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 前缀归一化）。

### 第 5 步：commit + push（保持四方同步）

⛔ PowerShell 没 heredoc → commit 信息写成文件再 `git commit -F <file>`。
建议 commit 信息主干：

```
修掉红字 A5(base64参考图毙整单)/A1(上传大图该压没压) + A2/A4 加明确映射 + 视频轮询失败补落盘与连续失败上限 + 错误映射三处说假话修正 (v1.0.0.54)
```

---

## 当前状态（2026-07-29 第十六次会话更新）

⚠️ **不是四方同步**：线上（正式服 = 测试服 = GitHub）仍 `v1.0.0.53`，**本地累计 12 个文件未部署未提交、没 bump**。
无 Prisma 迁移，`npx tsc --noEmit` 全绿。清单见上面第 0 步 / `01-current-status.md` 顶条。

本次做的：**A 表 9 条全部收口**。修掉 A5（base64 参考图毙整单，两层修）、**真修掉 A1**（上传大图该压没压）、
查清 A3 + A7（⛔ 两条**原表述都是错的**）、A2/A4 加明确映射、A6/A8 确认不用动、A9 数据不足改不了；
顺带修三个真问题（API Key 正则误伤 / 视频任务无重试上限且只写 console.warn / 环境错误被说成网络错误）。

### ⭐ 部署之后才轮到的：只剩一个「能修但要拍板」的项

**A4 真修复：给 `DATABASE_URL` 加 `connection_limit`（25~30）**。
⚠️ 改环境变量 + 重部署 + 核对 postgres `max_connections`，不是纯代码改动。目前**零复发**（最后一次 07-17）→ 不急。

⛔ **已被用户否掉、别再提**：我原来提的"发给模型前把参考图**缩尺寸**（最长边 2048）"——
用户明确要求「**图片过大不要动**（不动尺寸）……如果是体积大可以压缩一下保存好，质量保证在 90%」。
所以走的是**只降质量、保尺寸**那条路，实测 -78.7% 已经够用。

### 红字排查还想继续的话

A 表已清零。下一步只能等新数据：**用 `/admin?tab=failures`** 看有没有新的原因冒出来
（⚠️ 条数去后台看实时值）。B 表那些提供商侧的按铁律不归档、就该一直亮着。

### ⛔⛔ 本次新增的硬知识（别踩第二遍）

- ⭐⭐ **两个最大的教训**：
  ① **A 表里的描述可能已经过期**（A3、A7 都是）→ 动手前先用数据验前提；
  ② **遇到"图太大被拒"，先拿源文件重压一遍比大小**，确认"我们到底压过没压过" ——
  我漏了这一步，差点把"我们自己漏了压缩"误判成"模型限制、只能改文案"。
  一压才发现 `4444000 → 985381`（同尺寸、约 90% 质量），根因立刻翻转。
- **A1 根因**：`jpegNeedsReencode()` 只判**格式兼容性**（分量数 + 4:2:0 采样因子）、**完全不看体积**
  → 格式本来就兼容的手机原图走"原样写盘"分支，一个字节都不压。
- ⛔ **sharp 压缩默认丢 EXIF** → 手机照片必须先 `.rotate()` 把方向烧进像素，否则压完显示成横躺。
  测这一项要自己造带 `withMetadata({ orientation: 6 })` 的图，**且体积必须超过阈值**才会进压缩分支。
- ⭐ **容器里可直接用 `/app/node_modules/ffmpeg-static/ffmpeg` 做压缩实验**（输出 `/tmp`、跑完删）。
  `-q:v` 与质量粗略对应：`2≈95% / 3≈90% / 5≈80%`。
- **A3**：不存在"零日志"，线上有 39,270 条轮询日志；真问题是"只记 `hasError` 布尔"+"`poll-success` 把 `status:failed` 也叫 success"。
- **A7**：curl 早装进 Dockerfile（`spawn curl ENOENT` 只有 4 条、全在 07-14 三分钟内）；ffmpeg 转码 **1097/1097 全成功、零失败**。
- ⛔ **别用日志事件名推根因**：`image-provider-curl-fallback-failed` 07-15 起几十条，**根因全是"提供商余额不足"**，跟 curl 无关。
- ⭐ **改带"可变尾巴"的红字文案，必须同步 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL`**（否则后台炸成几十条各 1 条）。
  ⭐ 本次 A2 因为**复用了已有文案**（抽成 `buildModelTextInsteadOfImageMessage`），一行 SQL 都没改。
- ⭐ **判"图太大/参数越界"类问题用 `image-provider-reference-sizes` 做成败相关性统计** ——
  它只记 `maxSingleBytes`/`perImageBytes`，⛔ **没有宽高**（别去找 width/height，会白跑一轮）。
- ⭐ **容器里没 ffprobe/PIL，但 `python3` 能直接解析 JPEG SOF 段**拿宽高/位深/分量数（3=YCbCr、4=CMYK；`0xc2`=渐进式）。
- ⛔ **视频任务的重试上限绝不能用 `attempts`** —— 正常成功的长视频轮询就要几十次（线上最大 208 次且成功）。
  要用"**连续**失败次数"（`extraJson.pollErrorStreak`）。
- ⛔⛔ **PowerShell `cd` 对 `[System.IO.File]` 无效、对 `Remove-Item` 有效** ——
  同一条命令里混用会出现"读错目录 + 真删对目录的文件"，本次因此丢了一整节刚写好的交接文档。**拼接文件只用绝对路径。**
- ⛔ **PowerShell 内联 ssh 里带 `count(*)`、嵌套引号会被本地 PS 解释坏** → 一律写成 `.sh` scp 上去跑。
- ⭐ **Playwright 上传的文件必须放在 `.playwright-mcp\` 等允许根目录内**，放系统 temp 会被拒（`outside allowed roots`）。
  `showInputTip` 是瞬时提示、`innerText` 抓不到 → **看网络请求更可靠**。
- ⛔ **写 python 探测脚本时中文里别用半角双引号**（直接 `SyntaxError`），用「」。

## 此前状态（2026-07-29 第十五次会话更新）

⚠️ **不是四方同步**：线上（正式服 = 测试服 = GitHub）仍 `v1.0.0.53`，**本地有 5 个文件未部署未提交、没 bump**。
无 Prisma 迁移，`npx tsc --noEmit` 全绿。清单与说明见 `01-current-status.md` 顶条。

本次做的：**把线上红字全量归纳成 A/B 两张表**（A = 我们自己的原因 9 条、B = 提供商端 14 条），
并把 **B 类全部处理完**；顺手统一了图片上传格式白名单、给归档脚本加了全局护栏。
正式服待排查 **224 → 220 条**（归档了 B7 那 4 条）。

### ⭐⭐ 接手第一件事：按 `07` 第十三节的 A 表继续（那 9 条全部未修）

**建议顺序**：

1. **A5「参考素材不是可审核的公网地址。」** —— A 表里**唯一还在流血**的（07-29 刚发生 4 条）。
   证据：`966d223a-f720-4c34-82f2-9e12c1b80ef0` 的 5 个参考图里 index 0/1/2 都成功 reuse 到 Active 凭证，
   **只有 index 3 是 `kind:"unknown"`** → `byteplus-auto-review-public-url-failed` → 整单毙。
   ⭐ 这条同时挡在归档脚本的 `NEVER_ARCHIVE_REASON_PATTERNS` 里，**修好后要记得把它从名单里删掉**再归档。
2. **A3「BytePlus 视频轮询失败零日志」** —— 15 条查不动的根源（11 条落兜底 + 4 条被判成"API Key 无效"）。
   **必须先补落盘**（OpenRouter 侧第十一次会话已补，BytePlus 侧还是盲区），补完攒几天新数据才可能查。
3. **A1**（OpenAI 说我们的参考图不合法，资产库角色生成，可复现）→ **A2**（模型 200 但空结果）。

⚠️ **A1/A2/A3/A4 单纯改文案没意义** —— 它们落在兜底桶「服务器繁忙」（= 我们没识别出根因的混合体），
要做的是**给它们各自加明确映射**（A3 还得先补日志）。

### ⛔ 本次新增的两条硬知识（别踩第二遍）

- **`generation-diagnostics-log.jsonl` 里也有 `video-route-failed`（视频失败双写两个日志）** →
  **按日志文件名判断"图片还是视频路径"是错的**，要看行里的 `event` 和 `model`。我差点据此误报"图片路径也有凭证失效、存在分叉"。
- **归档脚本 `--apply` 之前必须逐条扫 dry-run 明细的 failureReason**（本次新加了明细输出）。
  只看数字会误吃：`gpt-image-empty-result-legacy-form` 差点吃掉 4 条 failureReason 已是 v53 新文案的事件
  （因为 haystack = 日志原文 + failureReason，而日志里还留着 `图片平台没有返回图片：` 这层**内部包壳**）。

### ⚠️ 部署时注意

本次改动都在**服务端映射/校验层**，没有 UI 改动，实机验收要点：
① 工作流画布**拖** tiff/gif/heic 进去应被拦（提示"当前模型不支持该图片格式"）、jpg/png/webp 正常；
② 对话流/资产库上传行为**应完全不变**（数量与大小上限一个没动）；
③ 生成正常图/视频不受影响（成功路径没碰）。

## 此前状态（2026-07-29 第十四次会话更新）


✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.53`**（commit `ab6e223`）。无 Prisma 迁移，无待部署、无未推。

本次做的：**撤掉对话流 + 资产库的 AI 改写重试**（工作流那套一行未动）、**模型拒绝类红字三合一**。
起因是正式服 d37 对话实测出：11 分钟发起 23 次生图、成功 17 张、对话里只剩 2 张、扣 197 积分。
完整根因与验收见 CHANGELOG 顶条 + `01-current-status.md`。

### ⛔⭐ 产品决策（别自己改回去）

用户明确：**对话流的设计不适合 AI 改写** —— 一条提示词出多图，每张独立改提示词，上面显示的提示词就对不上了。
**要重做必须先解决"一条提示词多图"的展示模型问题**，别把删掉的代码捡回来。

### ⭐ 接手第一件事：继续排查红字

用 `/admin?tab=failures`（⚠️ 条数去后台看实时值）。审核类按铁律不归档。
⭐ **可以考虑归档**：`B_622~657` 那批「模型拒绝」的**旧四分叉文案**（v53 起已统一成一句）。
⚠️ 按铁律 ④，**统一后的新文案不归档**（修不了、该一直亮着）→ 归档规则**必须配 `before` = v53 上线时刻（2026-07-29T04:33Z 左右）**。

### ⛔ 第十四次会话的操作记忆（省时间）

- ⭐ **查线上 DB 不用落文件**：node 脚本 base64 → `sudo docker exec <容器> sh -c 'echo <b64> | base64 -d | node'`，绕开 PowerShell 吃 `$`/中文/引号的全部坑。
- ⛔ **列名坑**：`GenerationEvent` 无 `surface`；`MediaAsset` 无 `name`（用 `displayName`/`systemName`）；积分表 = **`CreditLedger`**、字段 `credits`。
- ⭐ **对话编号 `d37`** = 前端自增，存 `WorkspaceSession.summaryJson->>'conversationCode'`，**不是 id 截取**。
- ⛔ **PowerShell 没 heredoc** → commit 信息写成文件再 `git commit -F <file>`。
- ⭐ 删大段代码用 `[System.IO.File]::ReadAllLines` + 切片重写（UTF8 无 BOM）；**改中文字符串一律用 edit 工具**。
- ⚠️ `npx eslint` 本来就有 22 个 error（历史遗留），不是新引入的。
- ⭐ **老数据的红字不随代码改动而变**（是持久化字符串），验文案要看**新发起**的那次。

## 此前状态（2026-07-29 第十三次会话更新）

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.52`。** 无 Prisma 迁移，无待部署、无未推。

- 归档已跑：**正式服 120 条（319 → 199 待排查）**、测试服 3 条。
- 归档脚本新增 **`before` 日期下限**机制（`ruleAllowsEvents()`）。
  ⭐ **凡是 note 里写「以后新发生的不再归档」的规则都必须配 `before`**，否则会一直吃新数据
  （本次 `provider-insufficient-credits` 就差点误吃 11 条新事件）。
- 工作流「高清」已改成四选项下拉（GPT/Gemini × 2K/4K），后台按模型开关，橡皮的三级候选链未受影响。

### ⭐ 接手第一件事：继续排查红字

用 `/admin?tab=failures`。正式服 **199 条待排查**。审核类按铁律不归档；真正可查的（⚠️ 条数是快照，去后台看实时值）：
`empty image result` 7 条 / `InvalidParameter.UnsupportedImageFormat` 4 条 / `API Key 无效` 4 条（查是哪个渠道）/ DB 事务超时 2 条。

## ⭐ 仍未实机测到的（只剩一项了）

**资产库「拒绝类」失败卡的三颗 AI 改写按钮。**
⭐ **本次学到的触发技巧（比第十二次会话那套靠谱得多）：不要靠改提示词硬碰** ——
拿一张**擦边的源图**走 img2img（本次高清 GPT 4K 用沙滩排球比基尼源图，**一次就中**，
直连版立刻回 `safety_violations`）。第十二次会话在资产库改提示词试了 5 次全部照样出图、烧了约 96 积分。

另：**Gemini 4K** 没单独实跑（与 Gemini 2K 同一条代码路径、只差 `resolution` 字符串），有机会点一下。

## ⛔⛔ 加 Hook 会把 tldraw 画布搞崩（2026-07-29 踩过，v52 第一次上测试服白屏）

`WorkflowSelectedNodeOverlay` 在 **`workflow-tldraw-canvas-inner.tsx:2493` 有 `if (!selected) return null;`**。
在它**之后**加任何 Hook（我加了个 `useMemo`）→ **React #310「Rendered more hooks than during the previous render」**
→ 点任意节点，整个画布变成「Something went wrong / Please refresh your browser」。

**修法：加在提前 return 之前，或干脆别用 Hook**（本次改成直接计算，只有 4 个元素）。

## ⭐ 新增高清模型要同步改三处配置表

`system-settings.ts` 的 `HD_FUNCTION_MODEL_CHAIN` / `workflow-tldraw-canvas-inner.tsx` 的 `HD_MODEL_OPTIONS` /
`admin-system-settings-panel.tsx` 的 `HD_MODEL_CHAIN`。
⚠️ **高清和橡皮的链已拆开**（`HD_FUNCTION_KEYS` vs `EDIT_FUNCTION_KEYS`），改一个不会影响另一个 —— 别再合回去。

## ⭐ 自动化测工作流画布是可行的（别再默认"留给人工"）

上一批文档写了"tldraw 不适合自动化"，那只对**连线**成立。**点节点 / 开快捷菜单 / 点下拉 / 跑生成 / 读结果标签全都跑通了**，
完整姿势见 **`07` 第十一·B 节**（新增）。三个最关键的：

- `browser_click` 点不到画布节点（img 拦 pointer events）→ 用 `run_code` 里的 `page.mouse.click(x, y)`，坐标从截图量。
- 每次量坐标前先按 **`Shift+1`**（缩放到适应全部节点），否则上次的坐标全失效。
- 验"模型/分辨率走对没有"**读节点右上角标签**（`模型 / 比例 / 分辨率 / 实际像素`），别靠看图。

## ⭐ 归档脚本的两个操作前提（省时间）

- **本地 dry-run 永远是 0**（本地库没有线上失败数据）→ 要看真实数字必须
  `docker cp` 脚本进容器 `/app` 再 `docker exec -w /app … node scripts/…`（否则找不到 `@prisma/client`）。
- 改完先 `node --check scripts/archive-resolved-generation-failures.mjs`：
  ⛔ **中文 note 里不能用 ASCII 双引号**（会截断 JS 字符串，本次踩过 `SyntaxError`），一律用「」。

## 此前状态（2026-07-29 第十二次会话）

⚠️ **不是四方同步了**：本地 `v1.0.0.51`（有未 commit 改动）> 测试服 `v1.0.0.51` > 正式服 `v1.0.0.50` = GitHub `v1.0.0.50`。

- 本地比测试服多**一行改动**：限流文案改成「当前模型繁忙或被限流，请稍候再重试！」（部署完测试服之后才改的）。
- 测试服比正式服多**一整批**：模型拒绝红字改成「统一文案 + 附模型原话」+ 资产库补 AI 改写 + 一堆错误文案修正（详见 CHANGELOG 顶条）。
- `npx tsc --noEmit` 全绿，**无 Prisma 迁移**，**归档脚本本次没跑**。

### ⭐ 接手第一件事：问用户要不要上正式服

要上就按铁律走：`node scripts/bump-version.mjs`（v51→**v52**）→ 打 tgz 上测试服 → 验一眼限流文案 → 原样同步正式服（**不再 bump**）→ commit + push。
本次改动的 10 个文件：`src/lib/models.ts` / `error-message.ts` / `error-code.ts` / `gpt-image-safety-retry.ts` / `openrouter.ts` / `generation-jobs.ts` / `admin-failure-triage.ts` / `app-version.ts` / `src/app/api/image/route.ts` / `src/components/chat-workbench.tsx`。

## ⭐⭐ 等用户拍板：那 101 条「图片平台没有返回图片」要不要归档

**背景**（完整排查见 `07` 文档第十二节 + CHANGELOG 顶条）：这 101 条 = 92 条模型明文拒绝 + 7 条模型复读提示词 + 2 条 520/空响应被伪装。全部来自 GPT版老接口那一个打点。

**两种口径，必须用户点头才动**：

- **归档**（我倾向这个）：理由 = 它们**不在兜底桶里**，但**旧形态已被本次改动彻底取代**（以前是 500 字小作文/用户自己的提示词/520 伪装，现在是统一文案 + 附原文 + AI 改写入口）。归档后正式服待排查 286 → ~185。`note` 建议写「模型明文拒绝：v1.0.0.51 起统一映射为『模型因色情/暴力/隐私安全等原因拒绝出图 + 模型原话』并提供 AI 改写重试入口」。
- **不归档**：按铁律"模型拒绝属于提示词内容/平台策略、我们修不了 → 就该一直亮着"。

⚠️ 若归档，规则要能同时认出三种历史形态（`图片平台没有返回图片：` 开头的小作文 / 提示词复读 / `error code: 520`），别只写一条正则。

## ⭐ 本次没能实机测到的两项（下一个 AI 有机会补）

1. **直连版（`openai/gpt-5.4-image-2`）的安全拒绝红字**：试 4 次全撞 OpenRouter 限流（`error code: 1015`）。预期文案 = 「模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或由AI安全改写后重试…以下是模型返回的拒绝原因："Your request was rejected by the safety system."」（客服尾巴会被削掉）。已用真实原文做纯函数验证 13/13 通过。
2. **资产库「拒绝类」失败卡的三颗 AI 改写按钮**：⭐ **难点已查明** —— 角色生成的 `ruleText` 会把提示词包装成"角色设定图"，中间那层语言模型就不拒绝了（试过"全裸/露骨""极度血腥断肢""1:1 复刻明星脸"5 次全部出图，烧约 96 积分）。**别再靠改提示词硬碰**；更靠谱的路子是**在资产库选直连版**（OpenAI 硬拒、不会被中间层改写掉），等限流缓解时试。
   资产库失败卡本体渲染是正常的（限流那次验过，且正确地只显示「重新生成」、不显示 AI 改写）。

## ⛔⛔ 排查/测试对话流失败卡时必读（2026-07-29 我误报过一次）

**对话流的失败卡包在 `<LazyMediaMount height={250}>` 里（`chat-workbench.tsx:16531`）—— 滚进视口才挂载。** 而红字**不在**这个组件里、一直显示。

- 所以「红字在、卡不在」是**正常现象**，不是数据丢了。我据此误报了一个不存在的 bug（"刷新后 AI 改写按钮丢了"），逐层查完发现 DB 的 `messagesJson`、`GET /api/workspace-state` 返回的 `mode`/`failedImageCount`/`imageResultSlots`/`generationMeta` **一个字段都没丢**，把消息 `scrollIntoView({block:'center'})` + 等 2.5s 后按钮立刻出现。
- ⛔ **用 `document.querySelectorAll('.flashmuse-failed-media-card')` 统计对话流失败卡不可靠**，必须先把目标消息滚进视口再断言。

## ⭐ 改「模型拒绝」文案时必须连带改的三处（都写了注释，别漏）

1. `src/lib/gpt-image-safety-retry.ts` 的判定 —— 认前缀 `模型因色情/暴力/隐私安全等原因拒绝出图`（函数 `isModelRefusedMessage`）。⛔ **绝不能改回整句比对**，否则**对话流/工作流/资产库所有 AI 改写按钮全部不亮**。
2. `src/lib/admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` —— 按前缀归一化。不改的话后台「失败原因」会**炸成几十条各 1 条**（因为文案带可变原文）。
3. `src/lib/error-message.ts` 顶部的**幂等保护** —— 认出成品文案就原样返回。**因为这个函数在"服务端映射→前端再映射"链路上可能被调两次**，末尾兜底透传会截到 180 字、把刚附上的模型原文砍掉。

## ⭐ 已知但用户明确说不做的（别重复提）

- **限流（Cloudflare 1015）只改文案**：用户 2026-07-29 拍板。我提过的"对 1015 用更长退避 30/60/120s"和"限流时自动降级到 GPT版老接口"**都不做**（后者会改变计费/画质预期，直连版支持 4K/画质档、老接口不支持）。
- **工作流的失败卡不改**：用户 2026-07-29 明确"工作流不用改，当前的就行"。所以工作流失败卡仍是「重新生成 + AI改写」并存、旧字号，与对话流/资产库不一致，**这是有意的**。

## ⭐⭐ 待跟踪（已撤销，别再等）

~~新接口空结果落盘 `upstream.body`，过几天回正式服捞字段名~~ ❌ **2026-07-29 撤销**：正式服日志里 `image-provider-empty-result` **带 body 的一条都没有**，因为**直连版的拒绝走 400 `image-provider-non-ok` 分支，根本不会走到"200 但没图"**。`openrouter.ts` 那段注释已改成这个结论，body 继续留着做保险。

## 此前状态（2026-07-28 第十一次会话）

✅ **四方同步：正式服 = 测试服 = 本地 = GitHub = `v1.0.0.50`（2026-07-28 部署完成）。**

- 本次一次性上线了积压的两批（第十次 + 第十一次会话）。**无 Prisma 迁移**（两服 `No pending migrations`）。
- 正式服备份 `/opt/flashmuse/app-backups/20260728-140839-presync-v50`；四域名全 200；两服 `x-app-version: v1.0.0.50`。
- 归档已跑：**正式服 33 条 → 308 降到 286**；测试服命中 0、仍 36。兜底桶「服务器繁忙」**从 60 降到 28**。
- ⚠️ **为什么是 v50 不是 v49**：v49 上测试服后发现新页 **hydration mismatch（React #418）** ——
  日期在客户端 `Intl.format` 会因服务器/浏览器时区不同导致两次渲染不一致。
  已改成**服务端预格式化成 `*Label` 字符串再传给客户端组件**，然后按铁律重新 bump 才上正式服。
  ⛔ **以后后台新页（客户端组件）里绝对不要在浏览器端格式化日期。**
- ⚠️ **唯一没点到的一项**：**工作流侧**的 Kling 参考图拦截没做到"点生成看提示"（tldraw 画布连线不好自动化）。
  它走的是同一个共享函数、服务端还有一道 400 兜底，风险很低，**下次有机会人工点一次**。

## ✅ 已完成：v1.0.0.50 的测试服实机验收（2026-07-28，全过）

| 项 | 结果 |
|---|---|
| Kling v3.0 Standard + 200×120 参考图 | ✅ 发送前拦下并给出明确原因（含实际宽高） |
| Veo 3.1 + 参考图 + 4 秒 | ✅ 发送前拦下：「…只支持 8 秒（你选的是 4 秒）」 |
| **反例** Veo 3.1 + 4 秒 + 无参考图 | ✅ 不拦、正常生成成功 |
| **反例** Kling + 1280×720 合规参考图 | ✅ 不拦、正常生成成功 |
| 后台新页 `/admin?tab=failures` | ✅ 数据正确、交互可用、0 控制台错误 |
| 后台概览页「失败原因」卡片 | ✅ 未坏（本次改了它的归一化 SQL 为共享常量） |
| 工作流画布加载 | ✅ 正常 |

## ⭐⭐ 待跟踪（第十次会话故意留的口子，别忘）

**新接口空结果已开始落盘响应体原文，过几天回正式服日志捞真实字段。**

- 背景：`openai/gpt-5.4-image-2` 走 OpenRouter 新接口 `/api/v1/images`，返回 200 但没图时（模型明文拒绝），**拒绝文字落在响应哪个字段目前未知**（老 `/chat/completions` 接口在 `choices[0].message.content|refusal`，新接口是 `data[]` 形状，不是那个结构）。**不许凭猜测写字段名**，所以本次只在 `openrouter.ts` 的 `image-provider-empty-result` 分支加了 `upstream.body`（已 `redactBase64ForLog` 去 base64、截 1200 字）。
- 捞法（部署后攒几天再做）：正式服容器里 `grep image-provider-empty-result .runtime/*-diagnostics-log.jsonl`，看 `upstream.body` 的 JSON 结构。
- 捞到之后要做的：在 `generateGptImage2` 的空结果分支读出原文 → 抛 `图片平台没有返回图片：${原文}` → `error-message.ts` 的 `isModelRefusalText()` 会自动把它映射成 `MODEL_REFUSED_MESSAGE` → 对话流/工作流的失败卡自动亮「AI改写重试」（判定 `src/lib/gpt-image-safety-retry.ts` 已就绪，无需再改前端）。
- 顺手做的话：给 `scripts/archive-resolved-generation-failures.mjs` 加 `gpt-image-model-refusal` 规则时想清楚 —— **模型拒绝属于"提示词内容/平台策略、我们修不了"，按铁律不归档**；但**"因为读不到原文而落进兜底桶"这个 bug 修好后，历史那批落在兜底桶里的可以归档**（归档理由是"已从兜底桶拆出、现在有明确文案"）。

## ⚠️ 新发现的小问题（第十一次会话验收时观察到，未修）

**被发送前拦截后，再点一次发送会报 `POST /api/asset-upload-temp 500`。**

- 容器日志原文：`[upload] asset-upload-temp patch failed { ... error: Error: 上传文件不存在或已过期 }`
- 复现：对话流上传一张图 → 因参考图尺寸/时长被**发送前拦截** → **不改任何东西直接再点发送** → 500。
- 判断：临时上传凭证（token）像是被第一次尝试消耗/失效了；重新上传即可正常。
- 影响：**不影响首次拦截的正确行为**，但用户连点两次会看到一个没用的报错（而不是再看到那句明确的拦截原因）。
- 优先级低，但如果要修：查 `api/asset-upload-temp` 的 token 生命周期，
  被拦截（未真正发起生成）时不应该让 token 失效。

## ⭐ 待观察：本地 `.next` 反复损坏（登录报「请求失败」）是否已断根

- 症状识别口诀：**接口全 404/500、莫名"请求失败"，或 `tsc` 报 `.next/dev/types/*` 语法错 → 一定是 `.next` 坏了，跟业务代码无关，别去翻登录逻辑。**
- 现在**双击 `start-project.bat` 会自动修**（实测故障态 15 秒自愈）。修复过程与判定见 `.runtime/start-project-trace.log`。
- **次日要确认**：如果还复发，说明"腾讯电脑管家实时防护"这个头号嫌疑判断错了 → 去 **`.runtime/next-broken/<时间戳>/`** 拿自动备份的清单文件（types 目录 + 所有 `*manifest*.json`），比对到底是哪个文件、残在什么位置，那才是铁证。
- 已排除的嫌疑（别重复查）：磁盘满、多开 dev server、异常关机、OneDrive 同步。

## ⚠️⚠️ 仍未点测：第十次会话那批「模型明文拒绝 + AI 改写重试补给对话流」（**已随 v50 上线，但没验过**）

⭐ **这是目前唯一一批"已经在正式服跑着、却从来没有人实机点过"的功能**，下一个 AI 有空请补测（或提醒用户自测）。
本次会话只验了第十一次会话那批（Kling / veo 拦截 + 后台新页），**下面这 5 项一项都没点**：

1. 用 `gpt-5.4-image-2` 在**对话流**发一个会被模型拒绝的提示词 → 红字应显示「模型拒绝生成本次内容（可能涉及安全、隐私、版权或未成年人等限制）！…」，失败卡底部应出现「AI改写重试 3/5/10 次」三颗按钮。
2. 点其中一颗 → 应持续显示等待卡（**两次尝试之间不闪回失败卡**）→ 成功则出图；全败则显示最后一次的失败原因。连点两次应只跑一条链（防重锁）。
3. **工作流侧回归**（第十次会话重写了它的编排循环）：同一场景在工作流点「AI改写重试」，行为应与以前完全一致。
4. **反例检查**：视频失败卡、非 gpt5.4image2 模型的图片失败卡**不能**出现「AI改写重试」按钮。
5. ⚠️ 看一眼：改写全败后对话流那条消息的内容是否被替换成最后一次的改写提示词（已知行为，确认是否需要处理）。

**外加一项（第十一次会话遗留）**：**工作流侧的 Kling 参考图尺寸拦截**没做到"点生成看提示"
（tldraw 连线不好自动化）。走的是同一个共享函数 + 服务端 400 兜底，风险低，但有机会人工点一次。


## ⚠️（已过期，留档）第十次会话留的「接手第一件事：继续排查红字」

> ⛔ **别照这段做了**：红字已于 2026-07-29 第十七次会话**整轮清零**（待排查 = 0）。
> 里面的条数（286 条 / 101 条 / 166 条…）全是历史快照，方法论仍然有效、条数一律作废。
> 当前正确动作见本文件顶部：**先看新一轮攒了多少，不够就直说别硬查**。

**不用先部署、不用问要不要部署** —— 直接开始排查后台红字。（本地那批未部署改动是次要待办，见本文件下方。）

### 怎么开始（完整方法论在 `07-red-error-triage-and-archive.md`，必读）

一句话流程：**后台看红字 → 拿 requestId 去 `.runtime/*-diagnostics-log.jsonl` 捞真实原文（别信 `failureReason`，它是给用户看的兜底文案）→ 修/堵 → 往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加一条规则 → 跑 `--apply` 归档（后台那条文字保留但划掉）。**

**正式服现在剩 286 条待排查 / 18 种原因 / 还在流血 10 种**（2026-07-28 归档 33 条后）。⭐ **先开 `/admin?tab=failures`。**

⭐ **新页第一眼就给出了下一个目标**：「图片平台没有返回图片（模型未产出或拒绝生成）」**101 条**，
其中 **工作流 88 / 对话流 11 / 资产库 1 / Agent 1** —— 高度集中在工作流一个入口，
按本页的设计意图这是**"该统一却分叉了"的强信号**，值得优先查。
（审核类待排查 166 条按铁律**不归档**，别去动。）

按性价比排的其余条目（详见 07 文档第六、七节）：
1. ~~40 条「轮询 failed」~~ ✅ **第十一次会话已全部查清并修，v1.0.0.50 上线并归档 33 条**（Kling 参考图尺寸 32 + veo-3.1 r2v 时长 1；
   另 6 条 BytePlus 仍不可考、留着亮）。⭐ 顺带沉淀出「OpenRouter 任务事后可回查原文」这条方法论，见 07 文档第九节。
2. `empty image result` 7 条（OpenRouter 说成功但没图，看是不是特定 model/参数组合）。
3. `InvalidParameter.UnsupportedImageFormat` 4 条、DB 事务超时 2 条、`API Key 无效` 4 条（查是哪个渠道）。
4. 后台列表里其它未归档条目，同一套方法逐条查。

> ~~gpt-5.4-image-2 中文明文拒绝~~ ✅ **第十次会话已查清并修（本地未部署）**，见 07 文档第七节第 3 条 + 本文件「待跟踪」。

**不要归档的**（平台审核/用户提示词内容，我们修不了，就该一直亮着）：成品被平台拒绝交付 56、模型拒绝 sexu/viol 28+12、版权限制 16、真人隐私敏感 13+6+1、「提供商余额不足！请联系管理员充值。」、以及第十次会话新映射出的 `MODEL_REFUSED_MESSAGE`（模型明文拒绝）。

### ⛔ 排查前必读的三条硬教训

1. **兜底桶有两个，同一根因会同时污染两个**：`toUserErrorMessage` 的 fallback 是**默认参数** —— 显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 落进「服务器繁忙，请稍候再试.....」，不传落进「**请求失败，请稍后再试。**」。查任何一类**两个桶都要查**。
2. ⭐ **日志 `grep -c` 出来的条数 ≠ 待排查的失败事件数**（第九次会话踩坑）：「平台拉缩略图超时 18 条」实际是**同一个 requestId 的 18 行日志**，该请求最终 `image-route-success`、GenerationEvent 的 `status = 'success'` → **后台里根本不占位**，归档必然 0 条。**拿到日志计数必须回 DB 按 requestId 核对 `status`**（具体命令在 07 文档第五·B 节）。
3. **同一根因常有多种上游措辞**：写正则前先把该根因的全部措辞捞全（归一化去重命令在 07 文档第五节）。参考图尺寸就因为只写一种措辞漏了 109 条。
4. ⭐ **同一个"根因"可能是多个打点分叉**（第十次会话踩到）：`image-provider-empty-result` 有 **3 个打点**（BytePlus / OpenRouter 新 `/images` / OpenRouter 老 `/chat/completions`），三份对"上游原因"的读取程度完全不同 —— **查一类红字时先 grep 清楚这个 event 一共有几处打点**，别只看到一处就下结论。
5. ⭐⭐ **OpenRouter 的任务事后可以回查原文，别再"等新数据攒几天"**（第十一次会话）：`taskId` 就是
   `https://openrouter.ai/api/v1/videos/<id>`，带 key `curl` 就有 `error` 原文（命令见 07 文档第九节）。BytePlus 的 `cgt-xxx` 不行。
6. ⭐ **"某个防护只对某一家平台生效"是高发漏点**：本次 32 条就是因为 v47 的参考图尺寸拦截被写死"只对 BytePlus"，
   Kling 裸奔。以后写这类守卫，先问一句「别家平台是不是也有同样的规则？」——有就抽成模型集合统一判定。

## ✅ 已完成：v46 那批的实机点测（用户 2026-07-28 自测通过）

资产库视频时长角标 / 缩略图 hover 放大 / 工作流「视频截图 ▾」/ 截图后进上传图片分类 / 用户中心生成计数 / 我的积分工作流图标 —— **全部用户已自测通过，不用再测。**

## ✅ 已完成：v47 部署（2026-07-28 第八次会话）

按下面顺序已全部做完（步骤保留，作为以后部署的标准流程参考）：

### 部署步骤（细节照 `03-deploy-and-servers.md`）
1. `node scripts/bump-version.mjs`（v46 → **v47**，只在部署测试服这一步 bump）
2. tgz 打包改动文件（**必须含 `prisma/schema.prisma` + `prisma/migrations/20260727154203_generation_event_resolved/`**）→ 传测试服
3. 测试服 `docker compose up -d --build` → ⭐ **看 entrypoint 日志里那个迁移有没有 applied**
4. `sync-ali-test.sh`（阿里测试镜像）→ 改 `PUBLISHED_APP_VERSION` 发布版本信号 + `force-recreate` → 验证入口 200 / `x-app-version: v1.0.0.47`
5. 正式服：备份 → rsync staging→prod → build（entrypoint 自动 migrate）→ `/tmp/syncali.sh` → `/tmp/health.sh` 四域名 200 → commit + push。**正式服不再 bump 版本号。**
6. ⭐ **两服各自跑归档脚本**（见下）

### 待部署内容清单

**第六次会话那批**：
1. 视频轮询/创建失败**落上游原文日志**（原来只记 `hasError` 布尔）。
2. **`!triggered` 真 bug 修复** + **已过审图第二次不弹蓝字**（`reuseOnly` 预检 + 无感重试）。
3. **死卡自愈**（平台报 `asset ... is not found` 时清库里失效凭证并重新送审）。
4. **错误文案 3 类真话**（尺寸不合规 / 平台读不到参考图 / 凭证失效）。
5. **参考图尺寸/比例发送前拦截 + 黑底提示**（对话流 / 工作流 / 服务端三处，只对 BytePlus 视频模型）。
6. **后台失败原因归档机制**：⭐ **新 Prisma 迁移 `20260727154203_generation_event_resolved`** —— 两服 entrypoint 会自动 `migrate deploy`，但部署后要确认日志里有 applied。

**第七次会话那批（2026-07-28，红字排查第 2~5 批）**：
7. ⭐ **供应商余额不足映射**：`error-message.ts` 新增 402/`insufficient credits` 类 → 「提供商余额不足！请联系管理员充值。」（位置在限流/`quota` 规则**之前**）；`transient-error.ts` 列为永久错误不再自动重试；归档规则 `provider-insufficient-credits`。
8. ⭐ **参考图尺寸第二种措辞**：`expected the (height|width) to be at least \d+px` 补进 `error-message.ts` 与归档规则（正式服 109 条）；归档脚本改成**日志原文 + `failureReason` 一起匹配**、去掉 `requestId IS NOT NULL` 过滤。
9. ⭐ **「当前模型不支持这组参数」54 条**：归档脚本加 3 条规则（`seedream-pro-sequential-param` / `reference-slot-not-an-image` / `reference-video-total-duration`，共 51 条）；另修**误映射** —— 平台返回 HTML 的 `Unexpected token '<' … is not valid JSON` 以前被 `not valid` 抢走报成"换比例/分辨率"，且被 `isPermanentError` 判成永久失败不再重连 → 现改成「平台服务临时异常（返回了非预期内容），请稍后重试。」并列为**可自动重试**。
10. ⭐ **「请先登录后再使用模型」17 条**：`credits.ts` 新增 `isUnauthenticatedError()`；**6 个 route**（image/video/chat/agent-plan/conversation-memory/workflow-rewrite）catch 第一句回 **401 且不记 GenerationEvent**；新增 `src/lib/session-expired-redirect.ts` 并插在**两处 `readJson`** 开头 → 401 直接跳首页、不给提示。
11. ⭐ **「请求失败，请稍后再试。」33 条**（无代码改动）：归档脚本加 `pre-diagnostics-log-unknowable` 规则（三条件：早于 `DIAGNOSTICS_LOG_START`=2026-07-10 + 日志零记录 + 落在兜底文案桶；正式服 dry-run 实测命中 **24 条**，07-10 之后 221 条一条不碰），`findMany` select 补 `createdAt`。

### ⚠️ 部署后必须回归的（第七次会话动了共用错误路径）→ **仍未做，见文档顶部**

**归档已执行完毕（2026-07-28）**：两服容器 `/app` 各跑
```bash
node scripts/archive-resolved-generation-failures.mjs          # 先 dry-run 看条数
node scripts/archive-resolved-generation-failures.mjs --apply  # 再归档
```
实际结果：测试服 10 条（剩 36）；**正式服 367 条**（reference-image-size 191 / provider-insufficient-credits 66 / reference-slot-not-an-image 26 / pre-diagnostics-log-unknowable 24 / session-expired 17 / seedream-pro-sequential-param 13 / reference-video-total-duration 12 / stale-asset-card 10 / approved-card-not-reused 8），**剩余未归档 308 条**。
⛔ 查正式服记忆：app 容器 = `flashmuse-flashmuse-app-1`；db 容器不能 `psql -U postgres`（role 不存在），查库走 `docker exec <app容器> node -e` + Prisma `$queryRawUnsafe`。

## ⭐⭐ 接手主线任务：继续排查红字失败原因并修复

**完整方法论、已修清单、待查清单、归档规则 → `handover/07-red-error-triage-and-archive.md`（必读）。**
一句话流程：**后台看红字 → 拿 requestId 去 `.runtime/*-diagnostics-log.jsonl` 捞真实原文（别信 failureReason）→ 修/堵 → 往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加一条规则 → 跑 `--apply` 归档（划掉）。**

下一批按性价比排（详见 07 文档第六、七节）：
1. ✅ **OpenRouter 余额不足 53 条已做（2026-07-28）**：映射成「(B_xxx) 提供商余额不足！请联系管理员充值。」+ 列入 `isPermanentError` 不再自动重试 + 归档规则已加（用户拍板归档历史那批）。可选增强：后台单列一栏 + 运营告警。
1b. ✅ **「当前模型不支持这组参数」54 条已查完（2026-07-28）**：51 条归档 + 修掉一个误映射（详见 07 文档第三·B 节）。
1c. ✅ **「请先登录后再使用模型」17 条已查完并修复（2026-07-28）**：500→401 + 不记事件 + 前端统一跳首页，17 条归档。
1d. ✅ **「请求失败，请稍后再试。」33 条已查完（2026-07-28）**：13 余额不足 + 20 永久不可追溯，全部归档。
1e. ✅ **平台拉我们缩略图超时 —— 2026-07-28 第九次会话已查完并修掉**（`Timeout/Error while downloading url: http://<ip>/api/media-thumbnail?...`）：真因=把动态缩略图接口地址 + 已退役马来 IP 当参考图发给平台；修法=唯一权威 `normalizeReferenceAssetUrl()` 还原成静态直链，8 处接入。⚠️ 但那"18 条"是**同一 requestId 的日志行数**、该请求最终成功，**后台待排查里不占位**，所以归档 0 条属正常。
2. **那 40 条轮询 failed** —— 日志已修好，攒几天新数据再查（大概率输出侧审核）。
3. **gpt-5.4-image-2 中文明文拒绝** —— 现在走"空结果"分支落到"服务器繁忙"，应识别成"模型拒绝生成"并接上已有的 AI 改写重试。
4. `empty image result` 7 条、DB 事务超时 2 条、`the specified asset is not an image` 之外的其它 InvalidParameter（`UnsupportedImageFormat` 4 条）。

## ⭐ 已知但还没做（用户已知，等拍板）
- **参考图尺寸自动修正**：那 82 次现在只是"拦住 + 说清"，可用 sharp 自动缩放/补边到合规再送审（服务器已有 sharp）。
- **`getVideoErrorMessage` 有两份复制**（`api/video/route.ts` + `lib/generation-jobs.ts`）且都丢掉 `error.code` —— 这是"真人/敏感错误被降级成服务器繁忙"的第二个原因，收敛成一份并保留 code。影响面：所有模式的视频错误文案。
- **正式服 97 条远程 url 资产**（签名已失效、救不回来）：用户拍板 **C = 先不管**。

## 线上实机验收（v46/v47 的功能基本都没点测过）
测试服 `http://101.37.129.164:8080/`，正式服 `https://main.venusface.com/`，测试号 `12424740@qq.com` / `dragonstar`（本地库也能登）。建议验：
1. 资产库视频卡左上角时长（深底白字 mm:ss）、图片/视频缩略图 hover 轻微放大。
2. 工作流视频节点「视频截图 ▾」三项（图片出现在源视频右侧、标题「视频截图 xxx」、命名递增、同帧重复截提示"图片已存在"）。
3. 截图后**不刷新**进资产库「上传的资产 · 上传图片」应立刻有。
4. 用户中心「生成图片/生成视频」不再是 0；「我的积分」工作流行是工作流图标、每个工作流一行。
5. 上传视频（含重复上传老视频）有封面；正式服历史封面已回填 29 个。
6. **工作流普通生视频仍正常**（第三次会话改过 `runVideoNode` 主路径，第六次又在里面加了参考图尺寸校验）。
7. 工作流视频「快捷编辑」（会真花钱）+ 候选链降级仍未实机验证。
8. **本批新增**：拿一张 240×180 或极窄的图当参考去生视频 → 应在**点发送的瞬间**弹黑底提示并中止（不扣积分）；换合规图应正常生成。

## 回填脚本（都已跑完，不用再跑）
- `scripts/backfill-media-asset-durations.mjs`：本地 28 / 测试服 5 / 正式服 2059 条已 apply。
- `scripts/backfill-uploaded-video-posters.mjs`：正式服新建 29 个封面并已 rsync 到阿里正式镜像。
- ⭐ 记忆：脚本在服务器上现生成的媒体文件**不会自动同步阿里**（app 只在上传/生成时同步），要补一次 rsync（命令见 CHANGELOG 第五次会话）。

## 上传规则涉及 200MB 视频时
- 正式 nginx `client_max_body_size`（历史 20m）需先评估调整（用户交代，未批准前不改服务器）。

## ⭐ 用户明确押后的
- **视频「高清」= 备忘 `M020`（见 06-memo-tasks）**：用户 2026-07-27 交代"**如果没有免费版以后再做**"。已查清：BytePlus 无超分接口；Seedance 2.0 的 4K 档是重生成不是超分、$0.78/秒（**4K 档也先不接**）；真超分要 Topaz（fal/Replicate，约 $0.02~0.08/秒）等第三方付费；开源最强 SeedVR2 需 4×H100，我们无 GPU。**接手别重复调研，M020 里数据齐全。**
- **工作流视频快捷菜单的「高清」按钮**：同上押后。做的话语义要改成"提升清晰度/分辨率（内容不变）"。

## 第一次会话（已部署正式服 v1.0.0.43）遗留的待定项
1. **"资产保存中"角标对"存盘快的视频"会一闪而过/看不到**（用户 2026-07-27 反馈，后端验证过没问题）。根因=前端视频轮询前 2min 每 10s、之后每 **30s**（`chat-workbench.tsx` 的 `FAST_VIDEO_POLL_*`/`SLOW_VIDEO_POLL_INTERVAL_MS`）；seedance-mini 存盘只几十秒，"保存中窗口"夹在两次 30s 轮询之间被跳过。慢/跨境卡的视频窗口长、一定能显示（这才是功能目标）。**待用户拍板**是否把慢轮询 30s→15s（工作流侧 `videoPollIntervalMs` 要一起调）。
2. **正式服僵尸 video job 未清**：ID_686996（`312876953@qq.com`）requestId `d049d7ad-9819-4177-8dc4-bf270f4ea0e2:video:0`，status 仍 `running`（07-24 卡下载假死的历史遗留，代码已根治不再复发）。用户交代先不清，以后可手动 `UPDATE "GenerationJob" SET status='failed'...`。

## 本对话（2026-07-27 第一次会话）已完成（细节见 CHANGELOG）
- **视频"卡下载→僵尸任务"根治**（下载 3min 超时 + ffmpeg 60s 超时 + 存盘锁 inFlight 假死自愈 8min + stale 30min→8min）。
- **恢复乐观显示**：视频出结果先用远程地址展示（角标"资产保存中..."），本地存好后无感换本地。对话流+工作流统一；资产库仍只存本地 url+全参数；OpenRouter 需密钥视频不预览；只做视频。
- **工作流生成动画**：侧栏工作流历史条目 + "工作流模式"入口显示 `HaloPulseIndicator`。
- 已整份部署正式服 v1.0.0.43 + push。

## 编辑类收尾剩余小项（非阻塞，待用户定）
1. **编辑类定价**：去背景本地抠图零成本、橡皮/高清走云模型，是否按普通图片计费或调价——待用户定。**视频快捷编辑 = 一次完整视频生成计费，也待确认是否单独定价。**
2. **去背景资产库 model 标签**：进资产库那条仍带计算出的 `input.model`，预览可能仍显示模型标签；工作流节点本身已干净。待用户定是否清。
3. 候选链"失败自动降级"本地只验证过首选成功路径（图片/视频都是），真降级要线上某模型报错才触发。


## 更早的待办（都非紧急）

1. **验收（可选）**：用户可到正式服硬刷抽验 @引用资产三处（视频/资产不再重复、左侧分类溢出滚动条常驻可下拉）；道具生成三档比例/写实出手办；融合生视频参考视频总时长>15s 弹"当前视频加起来是 XX.X 秒…"。
2. **对话流"最多4张"改原生 n**（暂缓，风险高）：多图 orchestration 与 Agent 共用单槽位/重试结构，当前申请4次(每次n=1)功能正常。要做需单独改+验证。
3. **清理旧 mention 死常量**（`mentionAssetTypes`/`isMentionGroupAsset`/`mentionGroupToAssetCountKey`/`mentionAssetTypeLabels`/`MentionAssetGroupType`，已无引用、保留无害）。
4. **复查 `GenerationEvent` 失败原因**（用户交代）：断线重连/BBR 上线跑一阵后，查失败原因聚合 + `/opt/flashmuse/data/runtime/*-diagnostics-log.jsonl`，确认"服务器繁忙"占比是否下降、"真人检测→服务器繁忙"是否消失、有无**新的可恢复错误**要补进 `isTransientServerError`（唯一权威判定）。
5. **M018 / M019 押后**（见 06-memo-tasks）：M018 刚上传媒体不刷新自动切阿里镜像；M019 工作流 canvasJson 大字段重构。
6. **上传规则若上正式服**：视频 200MB 规则需先把正式 nginx `client_max_body_size`（历史 20m）调到 ≥200MB + 上传超时（用户交代部署前评估，未批准前不改服务器）。

## 部署记忆（速查，详见 03）

- ⛔ **Turbopack 不重编 `globals.css`**：本地改样式没反应时，**删掉整个 `.next` 再重启 dev**（重启进程不够）。验证：浏览器里搜 `document.styleSheets` 有没有新类名。
- ⚠️ 部署验证顺序坑：`up -d --build` 之后 `x-app-version` 仍是**上一版**是正常的（那个头发的是运行时 env `PUBLISHED_APP_VERSION`，最后一步才改）。此时判断新代码有没有上去要看 **HTML 里的版本号**。
- 腾讯 ssh：`ssh -i "C:\Users\ASUS\AppData\Local\Temp\opencode\CinematicFlow.pem" ubuntu@119.28.116.16`（docker 加 sudo）。
- 正式服整份对齐 = 备份 → rsync staging→prod（排除 node_modules/.next/tmp/*.log/.git/.env.local/.runtime）→ `docker compose up -d --build flashmuse-app`（entrypoint 自动 migrate）→ `/tmp/syncali.sh`（阿里**正式**镜像）→ `/tmp/health.sh` 四域名 200 → commit+push。正式服不自增版本。
- `/tmp/syncali.sh`+`/tmp/health.sh` 重启清、需重建（内容见 03）；阿里 key root 属主必 sudo。
- PowerShell 内联 `$()`/中文/引号会坏 → 写 .sh scp + `sed -i 's/\r$//'` + bash；改中文源码用 edit 工具禁 Set-Content；一次性 node 脚本放进容器 `/app` 跑。
