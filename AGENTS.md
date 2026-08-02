<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 铁律：改 compose / 挂载路径 / 端口之前，先把**服务器上那份**打印出来逐行比（2026-08-02 加，差一步打挂正式服 443）

2026-08-02 复核上一批时抓到：仓库的 `docker-compose.yml` 把 443 证书写成
`- /etc/letsencrypt:/etc/letsencrypt:ro`，而**这台机器上根本没有 `/etc/letsencrypt`**
（acme.sh 装在 `/opt/flashmuse/data/letsencrypt`）→ Docker 会**默默创建一个空目录**挂进去 →
nginx 找不到证书起不来 → **main/api 两个域名 443 全挂**。

- ⛔⛔ **仓库里的 compose 长期和服务器漂移**（服务器早就有 443 端口和 data/letsencrypt，仓库那份还是旧的）。
  "补齐仓库"时**照想象写**就会造出这种炸弹。
- ⭐ **姿势**：改 compose 前 `sudo cat /opt/flashmuse/docker-compose.yml` 打出来逐行比；
  改完 `docker compose config` 看**展开后的真实路径/端口/密码**，再 `up -d`。
- ⭐ **判据**：凡是 `- /宿主机路径:/容器路径` 里的宿主机路径，都要 `ls` 一遍确认**真的存在**。
  Docker 对不存在的路径不报错，只会给你一个空目录。
- ⛔ **别指望测试服能替你测出来**：测试服**没有 443 server 块**，这个洞在测试服怎么点都是好的。
  → 通用结论：**两服有差异的那部分（本项目 = 443/证书/入口 conf），测试服天然覆盖不到，必须在正式服上单独核对。**

# 铁律：加接口限流之前，先想清楚"到这一层时 `$remote_addr` 是谁"（2026-08-02 加）

上一批给腾讯 nginx 加了 `limit_req_zone $binary_remote_addr ... rate=20r/s` + `burst=60`，两个真坑：

- ⛔⛔ **国内用户全部经阿里回源，到腾讯这一层 `$remote_addr` 只有阿里那一个 IP**
  → 等于把**全部国内用户算成一个客户端**共用 20r/s，几个人同时用就一起 429。
  ⭐ 修法：`set_real_ip_from 101.37.129.164; real_ip_header X-Real-IP;`
  （**只信阿里那一跳**，直连的客户端伪造 X-Real-IP 无效）。
- ⛔ **`location /` 也代理 `_next/static`**（腾讯侧没有本地静态镜像）→ 冷启动一个页面瞬间几十个请求，
  `burst=60` 会把**真实用户**打成 429 白屏。限流是拦"每秒成百上千"的滥用，别跟正常用户较劲 → 50r/s + burst 200。
- ⭐ **验证方式（二值、没有解释空间）**：`for i in $(seq 1 100); do curl ... & done; wait`
  —— 全 200 才算过；顺便 `docker logs <nginx>` 看日志里记的是**真实客户端 IP** 还是阿里的 IP。
- ⭐ **两服限流层数必须一样**：阿里正式那份 `flashmuse-static-ip`（混着别的项目、没碰）没有限流，
  所以**阿里测试那两份的 limit_req 要删掉** —— 否则"测试服 429 但正式服不会" = 测出来的不作数。

# 铁律：给接口加"归属校验"时，回头确认**我们自己的合法调用**还过不过得去（2026-08-02 加）

上一批给 `GET /api/byteplus-assets?id=` 加了「查 `UserAssetState.bytePlusAssetId` 才放行」，
但 **POST 送审那条路从来不落库这个 id**（只存在前端 state）→ 用户点「刷新审核状态」
永远拿到 404「素材不存在」，**手动审核功能直接废掉**。

- ⭐ **姿势**：加校验后，把"这个字段是谁写进去的"grep 一遍
  （`grep bytePlusAssetId` 一眼看出只有视频链路的自动送审在写）。
  校验依赖的数据没人写 = 校验必然拒绝所有人。
- ⭐ 同源问题也要防：**权限收紧类改动**（加登录、加归属、加白名单、加限流）
  一律要列出"现有调用方有哪几处"，逐处确认还能通。

# 铁律：把副作用从 setState updater 里移出去时，**映射本身要留在 updater 里**（2026-08-02 加）

上一批为修"在 updater 里发 fetch/自增编号"（React 可能重跑 updater），把
`setWorkflowItems(prev => ...)` 改成了「从 `ref` 读整份数组 → 算出 `next` → `setWorkflowItems(next)`」。
⛔ 这引入了新 bug：`ref` 只在 effect 里同步，**同一 tick 内若已有别处 `setWorkflowItems(fn)` 排队**
（例如生成回填），这里的整份 `next` 会把它**覆盖掉 = 成品图静默丢失**。

- ⭐ 正确切法：**纯映射留在 updater**（`prev.map(...)`，可重跑、可叠加）；
  **不可重复执行的副作用**（编号自增、发 PUT、埋点）放到 updater 外面。
- ⭐ 需要"最新整份数据"去发请求时，**在真正要发的那一刻从 ref 现取**，不要提前算好快照。

# 铁律：从 Windows 往服务器送文本文件，先 `sed -i 's/\r$//'` 再 diff（2026-08-02 加）

Windows 打的 tgz 里文本文件带 CRLF → 服务器上 `diff 服务器那份 新那份` 会显示**整个文件都变了**，
于是「只允许出现 `>` 行、出现 `<` 就停手」这条判据**当场失效**（看不出到底哪几行真改了）。

- ⭐ 顺序：传上去 → `sed -i 's/\r$//'` → **再** diff → `nginx -t` → reload。
- ⛔ **别依赖脚本里的 `if diff a b | grep -q '^< '; then exit 1; fi` 守卫**：2026-08-02 它没按预期触发。
  **把 diff 打出来人肉看一眼**，别把"脚本没退出"当成"没有 `<` 行"。
- ⛔ PowerShell `Set-Content -Encoding UTF8` **会加 BOM**（给 nginx conf 加过一次）。改带中文的文件一律用 edit 工具。
- ⚠️ PS5.1 的 `Get-Content` / `Select-String` **显示** UTF-8 中文会花屏 —— 那是**控制台解码问题、不是文件坏了**。
  2026-08-02 我据此误判过"文件成了 mojibake"，是用 `[System.IO.File]::ReadAllText` 数 `U+FFFD`（0 个）才排除的。
  **要看中文内容就用 read 工具。**


# 铁律：改 Next 配置项之前必须读 `node_modules/next/dist/docs/`，⛔ 不许照运行时错误信息里的名字写（2026-08-02 加）

2026-08-02 修"上传 >10MB 被 500"时，运行时错误信息给的配置名是 `middlewareClientMaxBodySize`（还带文档链接），
**那是旧名字** —— Next 16.2.4 已经把它改名成 **`experimental.proxyClientMaxBodySize`**
（证据在 `docs/01-app/02-guides/upgrading/codemods.md` 的 middleware→proxy 重命名清单里）。
⛔⛔ 照旧名字写下去，Next 不认识这个键、**静默无效** —— 配置没生效，但我们以为修好了。
⭐ 姿势：改任何 Next 配置项，先在 `node_modules/next/dist/docs/` 里 grep 到它当前的名字和位置
（尤其注意是不是在 `experimental` 里），再动手；改完 `next build`，确认它出现在
`Experiments (use with caution):` 列表里才算被接受。

# 铁律：middleware/proxy 的 matcher 改了之后，要测编译产物里的正则，别只 curl 几个接口（2026-08-02 加）

改了 `src/middleware.ts` 的 matcher 后，光 curl 几个接口不够 —— 运行时真正生效的是
**`.next/server/middleware-manifest.json` → `middleware["/"].matchers[0].regexp`** 那份编译产物，
用 `node -e "new RegExp(regexp)"` 批量跑十几个路径，几秒钟覆盖全部用例。

- ⭐ **必须包含嵌套多段路由**（`/api/auth/session`、`/api/admin/overview`）——
  "`.*` 到底能不能跨 `/`" 正是这类写法最容易翻车的地方，单段路由验不出来。
- ⚠️ **负向断言 `(?!a|b)` 是前缀匹配，不是整段匹配**：matcher 里写 `(?!upload-file)`，
  将来新增的 `/api/upload-filex`、`/api/upload-files` 也会被一并排除。
  要整段匹配就写 `(?!(?:upload-file|asset-upload-temp|upload-image)(?:$|/))`。
  （2026-08-02 的排除名单用的是前缀匹配版，**当前线上没有受影响的路由，是有意不单独为它发版**；
  下次谁动 `middleware.ts` 顺手评估要不要换成整段匹配。）

# 铁律⭐⭐：报"根因"之前，先把那个 `if` 的条件抄出来逐项验证（2026-08-02 加，代价惨痛）

2026-08-02 排查"工作流节点传参考图静默挂不上"，**连续两次归因都是错的**，两次的共同点是
**从"现象 + 记忆里一闪而过的 tip 文案"反推是哪条分支**，而不是**去读那条分支的判据条件**：

1. 第一次说是"服务端 dedup（`duplicate:true`）导致" → 错。反例：能挂上的那张图，POST **也**返回了 `duplicate:true`。
2. 第二次说是 `workflow-tldraw-canvas-inner.tsx:3761` 的 by-name 历史恢复分支 → 也错。
   那行判据是 **`asset.name === file.name`**，而 `asset.name` 是服务端权威名、
   `upload-name.ts:26` 的 `sanitizeUploadBaseName()` **已经去掉扩展名**（`replace(/\.[^.]+$/, "")`）
   → `"ref-r1"` 永远不等于 `"ref-r1.jpg"`，**这条分支对任何带扩展名的文件根本进不去**。

- ⭐ **姿势**：怀疑某个 `if`/`find`/`filter` 分支是元凶时，**把它的条件原样抄进你的笔记**，
  逐个变量确认"在我这个场景里它的实际值是什么"。⭐ **特别小心两个看着同名的东西**
  （`asset.name` 去了扩展名 vs `file.name` 带扩展名；`lastSeenAt` vs `activeWorkspaceSeenAt`）。
- ⭐ **没验证过的归因必须标明「假设，未验证」**，⛔ 不许当结论写进交接文档 ——
  错的根因会让下一个人朝错误方向改一整天。
- ⭐ **tip / toast 文案不能当证据**：它们一闪而过、而且经常长得很像
  （`已存在，已直接连接` vs `已在历史记录中，已恢复并连接`）。要么复现时录下来，要么去代码里对文案。

# 铁律：往"共享命名空间"里加新标识符之前，先枚举现存的全部取值（2026-08-02 加）

2026-08-02 新增备忘任务时取了 `M031`，而 `M031` 早就被「数据保留 / 清理策略」占了 →
`01`/`05`/`CHANGELOG` 里的 "M031" 从此**指向两个不同的东西**（已改成 `M032`）。
⛔ **不许"找一个看起来没用过的号"**，必须先枚举：

- 备忘编号：`grep '### \[.\] M' handover/06-memo-tasks.md`
- `B_xxx` 错误编号：看 `.runtime/error-code-counter.txt`（规则见 `07-red-error-triage-and-archive.md`）
- Prisma 迁移名、工作流/节点系统名、`upload-rules.ts` 的规则 key —— 同理。

# 铁律：把 `/generated/` 地址变成本地文件路径，只能走 `resolveGeneratedFilePath()`（2026-08-02 加）

⛔⛔ 历史上有 **6 处**都是这么写的，**全都能被路径穿越**：

```ts
const localUrl = normalizeReferenceAssetUrl(url);
if (!localUrl.startsWith("/generated/")) return url;      // ← 唯一的校验
const filePath = join(process.cwd(), "public", localUrl.replace(/^\//, ""));
readFileSync(filePath)                                     // ← 直接读
```

`startsWith("/generated/")` **拦不住 `..`**，而 `normalizeReferenceAssetUrl` 只剥 query 和 `#`
（`reference-asset-url.ts:67`），不做路径规范化。于是任何**登录用户**把参考图填成
`/generated/../../.env.local`，`join()` 折叠掉 `..` 后就读到了 `.env.local`，
内容被 base64 塞进发给模型的请求 —— 等于泄露 `OPENROUTER_API_KEY` / `BYTEPLUS_*` /
**`AUTH_SECRET`**（它一泄，别人能自己签管理员 cookie 登 `/admin`）/ 数据库口令。

- ⭐ **唯一正解：`resolve()` 之后必须仍在 `public/generated` 里面。**
  这个判断对任何编码方式都有效（`..`、`%2e%2e`、绝对路径），比"过滤 `..` 字符串"可靠得多。
- ⭐ **唯一权威 = `src/lib/generated-asset-path.ts`**：
  `resolveGeneratedFilePath()` / `isInsideGeneratedRoot()` / `generatedAssetExists()` /
  `getGeneratedFileSize()` / `toDataUrlIfLocalPublicAsset()`。
  ⛔ **禁止再在别处自己写 `join(process.cwd(), "public", ...)` + `readFileSync`。**
- ⭐ 顺带收掉一个既有分叉：`toDataUrlIfLocalPublicAsset` 原本在
  `openrouter.ts` / `openrouter-video.ts` / `seedance.ts` **一字不差地存了三份**（连 `getMimeType` 都一样），
  三份都带着同一个漏洞。现在是一份。
- ⭐ 判据：**项目里本来就有一处写对了**（`api/media-thumbnail/route.ts` 的 `isInsideGenerated`），
  另外 6 处压根没写。**发现"同一个判断有的地方有、有的地方没有"，就是该收敛的信号。**

# 铁律：服务端"按用户给的地址去下载东西"，必须过 SSRF 防护，且**逐跳**校验（2026-08-02 加）

`POST /api/media-save-status` 原本**不要求登录**（只写了 `const user = await getCurrentUser()`
然后一路用 `user?.id`，**没有"没登录就退出"那一句**），而 `getMediaSaveStatuses()` 对任何
没见过的地址都会 `enqueueRemoteAssetSave()` → `saveRemoteAsset()` → `fetch(url)`，
唯一的过滤是 `/^https?:\/\//`。下载到的字节写进 `public/generated/`，**下一次轮询就把 `localUrl` 回给调用方**。
→ 任何人（不用账号）发两个请求就能让服务器去读**云元数据 `169.254.169.254`**（拿实例凭证）、
扫内网、读同机另外两个项目的端口，然后把结果存成公开文件下载走。

- ⭐ **唯一权威 = `src/lib/ssrf-guard.ts`**：`assertRemoteUrlAllowed()` / `isRemoteUrlAllowed()` / **`safeFetch()`**。
- ⭐⭐ **必须解析 DNS 之后再判 IP**，不能只看域名字符串 ——
  否则攻击者拿自己的域名解析到 `169.254.169.254` 就绕过了。用 `dns.lookup(all)`，
  **任意一条 A/AAAA 落在私网就整体拒绝**。
- ⛔⛔ **不能用 `fetch(url, { redirect: "follow" })`，也不能用 `curl -L`** ——
  那样只校验了第一跳，一个正常公网地址 302 到元数据接口就穿透了。
  必须 `redirect: "manual"` 自己逐跳校验（`safeFetch` 已实现，最多 5 跳）。
- ⭐ **2026-08-02 用户拍板：走「内网黑名单」不走「域名白名单」。**
  白名单更严，但供应商回给我们的媒体域名是**运行时才知道的**
  （BytePlus 是 `ark-*.tos-ap-southeast-1.volces.com`，OpenRouter 那条无法穷举），
  **漏一个域名就等于用户丢图**；而"拒绝私网"覆盖了全部真实攻击面且不可能误伤公网供应商。
- ⭐ 两道防线都要：`enqueueRemoteAssetSave` 里拦（不建注定失败的任务）+ `saveRemoteAsset` 里拦（根治）。
- ⭐ 自验脚本 `scripts/verify-ssrf-guard.mjs`（25 个用例，含真实供应商域名必须放行）。
  ⚠️ **改了 `ssrf-guard.ts` 的网段表，必须同步改那个脚本里的副本**，否则测的不是线上那份。

# 铁律：上传接口的校验不能只覆盖一部分 mediaKind（2026-08-02 加）

`POST /api/upload-file` 原本**只在 `mediaKind` 是 video/audio 时才校验**（`route.ts` 的 `requestedKind`），
文档路径是**零校验** —— 既不限后缀也不限大小，而落盘后缀是**直接取客户端传的文件名**
（`local-assets.ts` 的 `getExtensionFromUrl(originalName)`）。
→ 传一个 `x.html` 就得到 `https://main.venusface.com/generated/.../xxx-x.html`，
而 `/generated/` 是**同源**静态目录 → **在自己域名下执行 JS（存储型 XSS）**。`.svg` 同理。
没有大小上限还意味着 `await file.arrayBuffer()` 能被用来打内存/磁盘。

- ⭐ 文档格式白名单的**唯一权威 = `media-upload-validation.ts` 的 `DOCUMENT_UPLOAD_FORMATS`**
  + `validateDocumentUploadFile()`；`upload-rules.ts` 的 `documentFormats` 从那里 import
  （和图片走 `image-upload-validation.ts` 的 `IMAGE_UPLOAD_FORMATS` 是同一个既有约定）。
- ⭐ **只认后缀、不认客户端给的 `Content-Type`**（后者能随便伪造，而决定 nginx 返回什么 MIME、
  浏览器要不要执行的，正是落盘后的后缀）。用 `buffer.byteLength` 而不是 `file.size`（后者是客户端声明值）。
- ⭐ **两个分支都要拦**：multipart 和 base64/JSON 老路都能上传。
- ⭐ 配套 nginx（4 份 conf 全部）：`/generated/` 加 `X-Content-Type-Options: nosniff`，
  并对危险后缀（`html?|xhtml|xht|shtml|svgz?|xml|xsl|js|mjs|css|wasm`）加 `Content-Disposition: attachment`。
  ⛔ **不能对整个 `/generated/` 加 attachment**（会影响正常图片视频）。
  ⚠️ **nginx 的 `if` 是一个新的配置层级，里面写了 `add_header` 就不再继承外层的** →
  必须把 `Cache-Control` / CORS / nosniff 在 `if` 里**重新写一遍**（已实测验证）。
- ⭐ 改 nginx 一定要**真验**，别只看 `nginx -t`：本次用 docker 起 nginx 实测了
  `.html`/`.svg` 有 attachment、`.jpg`/`.mp4`/`.txt` 没有、Range 请求仍返回 206。

# 铁律：数据库备份 —— 没演练过的备份不算备份（2026-08-02 建立）

完整用法、紧急恢复步骤、以及 **9 条踩过的坑** 见 **`deploy/backup/README.md`（要恢复数据先看那里）**。
这里只留最容易致命的几条：

- ⛔⛔ **`pg_restore` 不能用 stdin 管道喂**：`-Fc` 归档 + `-j` 并行**要求可 seek**，
  管道会**恢复出 0 张表且报错看不见**。必须解压成文件 → `docker cp` 进容器 → 按路径恢复。
  ⭐ **第一次演练就是这么失败的** —— 这正说明"演练"这步不可省；只跑备份不演练，
  等于一直以为自己有备份。
- ⚠️ **cron 按系统本地时区跑，不是 UTC**（这台是 `Asia/Shanghai +0800`）。
  我写 `30 19` 并注释成"UTC 19:30 = 北京 03:30"，实际会在**北京晚 19:30 高峰**跑。改前先 `timedatectl`。
- ⚠️ **crontab 里 `%` 是特殊字符**（换行），命令含 `%` 必须写 `\%`，否则**从 `%` 处截断**。
  我的探针用了 `date '+%F'` 被截断，一度误判"cron 没生效"。
- ⚠️ **这台机器没装 MTA，cron 发不出邮件** → 不能依赖"失败会收到通知"，一切落日志 + `last-status.txt`。
- ⛔ **`local a="$1" b="$X/$a"` 在 bash 里是错的**：`local` 的全部参数**在它执行前就被展开**，
  那时 `$a` 还没赋值，配合 `set -u` 直接中断整个脚本。必须先声明再逐个赋值。
- ⛔ **`--append-verify` 和 `--partial-dir` 互斥**（rsync rc=1 秒失败）。
  ⭐ 选 `--partial-dir`：`--append-verify` 会把没传完的文件**以最终文件名**留在目标端，
  "看起来像完整备份的截断文件"比没有备份更危险。
- ⭐ **xz 的 `-6` 和 `-9` 在这个库上差 40%（14.3MB vs 8.5MB），不是我以为的 4%** ——
  字典 8MiB vs 64MiB，而库里有大量重复的中文提示词。**别凭直觉调压缩等级，要实测。**
  用 `-T 1` 不用 `-T0`：`-9` 每线程 ~674MB，而**这是多项目共用的机器**。
- ⭐ **多项目共用的机器上装定时任务：绝不碰 root crontab**，只新增 `/etc/cron.d/<自己的名字>`，
  并**断言 root crontab 条数改前改后不变**。

# 铁律：判断「某个字段实际会不会有多个」要看写入方，不能只看 TypeScript 类型（2026-08-01 加）


⛔⛔ 2026-08-01 我看到工作流节点的 `data.images` 是 `string[]`，就按"数组可能有多项"
**推出了一个根本不存在的问题**（"源节点里有 4 张图会一起连进来"），还把它当"待办"报给了用户。
🗣️ **用户当场纠正**：「一个节点只能生一个视频或一张图片」——查证后他是对的。

- ⭐ **正解：去看写入方**。本次三处一看就清楚：
  ① 发给 `/api/image` 的请求写死 **`count: 1`**；
  ② `applyImageNodeResult` 里 `images` 是**覆盖不是追加**；
  ③ `handleUploadNodeFiles` 一次拖 N 张图是**建 N 个独立节点**、不是一个节点装 N 张。
  → `data.images` **实际长度恒为 1**，那个 `.map()` 只是写法兼容。
- ⛔ **类型只说明"能装多个"，不说明"业务上会装多个"。** 同理别只看 `?`（可选）就假设"经常是空"。
- ⭐ 这和另一条老教训同源：**「交接文档/表格里的描述可能已过期，动手前先用数据或代码验前提」**
  （历史上"6 处跨工作流遍历"实际只有 3 处，也是这么翻出来的）。
- ⭐ **报"待办/风险"之前先问自己：这个场景在产品上真的会发生吗？** 能举出具体的用户操作路径才算成立。

# 铁律：测试服和正式服「关键的东西」必须一样，基础设施优化要两服都做（2026-08-01 用户拍板）


🗣️ **用户原话意思**：「我做测试服就是为了提前测试，也就是**测试服和正式服关键的东西一定要一样**，
这样我们在测试服上测试好的东西到正式服就会最大限度不出问题。」

- ⛔ 所以「只给测试服换个更快的入口 / 只给正式服加个优化」这类**让两服架构产生差异**的方案一律不许提。
  2026-08-01 我推荐过「测试服绕开阿里、直连 `119.28.116.16:5001`」（零风险、快 10 倍），**被用户当场否掉**：
  那样测试服就不再经过阿里那一跳，**在测试服测好的东西到正式服不作数**。
- ✅ 正解：找到真正的病根，**两服都改同一个东西**（本次 = 两边 nginx 都加 upstream keepalive）。
- ⭐ `http://119.28.116.16:5001/`（绕开阿里直连腾讯 staging）**仍可用于临时排查、排除链路噪声**，
  但**不能当测试服入口**。
- ⚠️ 唯一允许的既有差异是**数据和 env**（两服数据库/`.env.local` 独立，本来就该独立）。

# 铁律：量"跨机器链路"的性能，必须站在「真实用户那一侧的那台机器」上测（2026-08-01 加）

⛔⛔ 2026-08-01 我为了验阿里的优化效果，**站在腾讯服务器上 curl 阿里的地址** ——
那等于**跨境跑两趟**（腾讯→阿里→腾讯），`connect=0.25~1.37s` 里混着"腾讯到阿里"那一跳，
**差点误判"keepalive 没生效、优化失败"**。

- ⭐ **正解**：国内用户走「用户 → 阿里 → 腾讯」，其中「用户→阿里」本来就快
  （实测阿里本机自取静态 0.005s），**唯一的变量是「阿里→腾讯」这一跳** →
  所以要**登到阿里上，curl 阿里自己的入口**（`curl -H "Host: xxx" https://127.0.0.1/... -k`）。
- ⭐ **同时要有对照组**：本次用「阿里绕开自己的 nginx、裸连腾讯 5000/5001」当"改之前的等效行为"，
  一眼看出 keepalive 的净收益（`connect` 1.3s → 0.00008s）。
- ⭐ **看 `connect` 而不只看 `total`**：`connect` 单独一列最能区分"握手慢"和"传输慢"，
  而这两者的解法完全不同（前者靠连接复用，后者只能改善线路）。
- ⛔ **纯验证脚本别开 `set -e`**：`curl` 超时返回非 0 会把脚本整段掐断、后面的复测全不跑（踩过）。

# 铁律：改「混着别的项目」的配置文件 = 精确替换 + 计数断言，禁止整份覆盖、也别用 sed 全局替换（2026-08-01 加）

阿里那台 nginx 上还有 `tiantangqiyuan` / `venusai` / `video-downloader` 三个别的项目，
而 FlashMuse 正式服入口 `flashmuse-static-ip` **自己内部就混着 `/tiantangqiyuan/`**。

⭐ **正确姿势**（模板 `deploy/ali/ali-add-upstream-keepalive.py`，2026-08-01 实跑验证过）：

1. **先只读勘察**，找出可区分的文本特征（本次：6 处「`proxy_pass` 紧跟 `Host xxx`」缺 `proxy_http_version 1.1`、
   2 处 `location /`「紧跟 `proxy_request_buffering off`」已有 `Connection`）。
2. **精确多行替换**，然后**断言条数必须完全等于预期 `(6, 2, 2)`** —— 不符就**一个字都不改**直接退出
   （说明服务器现状和勘察时不一样了，必须人工核对）。
3. **断言别的项目没被动**：改前改后 `tiantangqiyuan` 相关字符串的条数必须相等。
4. **残留检查**：不该再有任何漏掉的旧写法。
5. 幂等 marker + 备份 + `nginx -t` + **失败自动回滚** + 只 `reload` 不 `restart`。
6. 验证时**把别的项目也 curl 一遍**。

⛔ 别用 `sed` 全局替换（改不到"缺哪几行"这种结构性问题，也没有断言保护）。
⛔ 更别整份覆盖（会删掉别的项目的配置）。
⛔ **备份文件绝不放 `/etc/nginx/sites-enabled/`**（2026-08-02 踩过）：nginx 会 include 目录下**所有**文件，
  一个 `.bak` 里的 upstream 就能让整台 `duplicate upstream` 起不来 —— 备份放 `/root/`。
⭐ **同一功能有多个入口 conf 时，改一个必须把兄弟们全 grep 一遍** ——
2026-08-01 就发现 `staging-static` 那份**漏了** 07-30 加给 8080 那份的 `proxy_buffers` + `gzip`
（走 HTTPS 访问测试服时大响应一直在写磁盘、JSON 从来没压缩过）。这正是"能统一一律统一"。

# 铁律：工作流画布里给 `<button>` 写字号无效 —— 必须写在里面的 `<span>` 上（2026-08-01 加）


⛔⛔ **tldraw 的 `ui.css` 里有一条「无 layer」的 `button { font-size: inherit }`，而 Tailwind 的工具类在 `@layer` 里。
CSS 规则：无 layer 的样式永远赢过 `@layer` 里的样式（跟特异性无关、跟先后顺序无关）。**
→ 所以在工作流画布（`workflow-tldraw-canvas-inner.tsx`）里给 `<button className="text-[14px]">` 写字号
**会被静默吃掉**，回落成继承来的值。

- ⭐ **正解**：字号写在按钮里的 `<span className="text-[14px]">` 上（span 不在那条选择器里）。
  现成的例子：上传 chip 的 `text-[12px]` span、@ 按钮的 `text-[15px]` span、
  三选菜单的 `menuItemTextClassName`（2026-08-01 就是踩了这个才加的）。
- ⭐ **本地肉眼看不出来**（12px 和 14px 差别很小），我是**部署到测试服后用
  `getComputedStyle(btn).fontSize` 才量出来的**（className 里明明写着 `text-[14px]`，computed 是 `12px`）。
  → 判据：**改了画布里的字号，要么写到 span 上，要么用 `getComputedStyle` 实测，别靠肉眼**。
- ⚠️ 同理要警惕：别的被 tldraw 无 layer 规则覆盖的属性（`font`、`letter-spacing` 等）。
  排查姿势：在页面里造一个探针 `div` 挂同一个 class 量一下 —— **探针生效但目标不生效 = 被更高优先来源覆盖**，
  ⛔ 别怀疑"Tailwind 没生成这个类"（本次我先怀疑错了方向）。
  ⛔ 也别用 `sheet.cssRules` 遍历去找覆盖者：Tailwind v4 把工具类包在 `@layer` 里，
  顶层拿到的是 `CSSLayerBlockRule`（没有 `selectorText`），**会被你的循环整段跳过**、查不到。

# 铁律：给 hover 弹出的菜单留间距用 `padding` 不能用 `margin`（2026-08-01 加）

菜单用 `absolute bottom-full mb-2` 时，那 8px **外边距是"没有元素"的空隙** →
鼠标从按钮移向菜单时穿过它就触发 `mouseleave`，菜单**当场闪没**、根本点不到。
⭐ 正解：外层容器用 `pb-2`（内边距）把命中区连成一片，白色卡片放在内层 div。

# 铁律：菜单里的「选文件」项不能用 `<label>` 包 input + 在 `onChange` 里关菜单（2026-08-01 用户当场报的）

`<input type="file">` 的 `onChange` **只有"用户真的选完文件"才触发**：
- 系统选文件框弹着的那段时间，菜单一直留在屏幕上；
- 用户点「取消」→ `onChange` 压根不触发 → **菜单永远不关**。

⭐ 正解：把隐藏 `<input>` 放在**菜单外面**（按钮的容器里，菜单关了它还在），菜单项是普通 `<button>`，
`onClick` 里**先关菜单、再 `inputRef.current.click()`** 主动打开选文件框。
多个按钮各一个 input 时，用 `useRef<Record<string, HTMLInputElement | null>>` 按 key 存
（渲染函数在 `map` 里跑，不能用 Hook）。

# 铁律：给"加载中"盖遮罩，别只盖内容区、别用白底色块（2026-08-01 用户两次返工）

🗣️ 用户原话意思：「不要在中间加一块白底，要让整个输入框模糊化，然后在上面显示转圈+正在加载中...」

- ⛔ **不要用半透明白底色块**（`bg-white/62` 那种）—— 用户明确不要。用 **`backdrop-blur-[4px]`**。
- ⛔⛔ **更关键：别只盖"内容区"那一条**。第一次我只盖了文字输入区，而加载期间提示词是**空的**、
  placeholder 也被藏了 → **后面什么都没有，模糊一片空白渲染出来还是一块淡白色圆角块**，
  用户看到的和白底几乎没区别、当场打回。
- ⭐ **判据**：盖遮罩前先问「这块区域下面**有没有东西可以被模糊**」。没有就往上提一层，
  盖到**有可见内容的那个容器**（本次是提到 `WorkflowPromptBox` 根节点 = 整张卡片：
  上传按钮 + 输入区 + 模型/比例那一行 + 发送键），圆角跟着那一层（`rounded-[26px]`）。
- ⭐ 「整个输入框」这类说法**先确认范围**：用户指的是整张卡片，我理解成了文字输入区。

# 铁律：抢 tldraw 的键盘/剪贴板事件必须用 window 捕获阶段 + 只在自己要管时才 stopPropagation（2026-08-01 加）

tldraw 在 **`ownerDocument` 上以冒泡阶段**监听 `copy`/`cut`/`paste`
（`node_modules/tldraw/dist-cjs/lib/ui/hooks/useClipboardEvents.js:693`）。

- ⭐ 想在它之前处理 → `window.addEventListener("paste", handler, true)`（**捕获阶段**）。
  不抢在它前面，剪贴板里的图片会被它建成一个 **tldraw 原生 image shape**（不是我们的节点）。
- ⛔⛔ **只在"这次确实是我要管的东西"时才 `preventDefault + stopPropagation`**，其余一律放行 ——
  否则会把 tldraw 的「节点复制粘贴」和纯文本粘贴一起打断。
- ⛔ 焦点在 `input / textarea / [contenteditable="true"]` 里时直接 return
  （提示词框有自己的 `onPaste`，粘图 = 变成该节点的参考素材，是另一个意图）。
- ⭐ 作用域天然安全：`WorkflowCanvas` 只在 `activePanel === "workflow"` 时渲染 →
  window 监听离开工作流自动卸载，不影响对话模式/资产库。


# 铁律⭐⭐：默认「只写本地代码 → 写完先来汇报」，**没提前说就不许测试、不许部署**（2026-07-31 用户拍板）

🗣️ **用户原话意思**：「以后做任务，没特殊说法就是先做本地，做完先告诉我。我没提前说就不要测试不要部署。这个要写到规则里让后面的 AI 知道。」

**默认动作只有三步，做完就停下来汇报，然后等用户下一步指令：**

1. 改本地代码；
2. `npx tsc --noEmit` 自查（这不算"测试"，是编译自查，必须做）；
3. **汇报**：改了哪些文件、为什么这么改、影响范围、以及"要不要我测试 / 部署"。

⛔ **在用户当次没明确要求之前，下面这些一律不许做：**

- ⛔ **不许测试**：不开 Playwright、不开浏览器、不登录任何环境（本地 / 测试服 / 正式服都算）、
  不真跑生图生视频（**会烧真钱**）、不写一次性脚本去连数据库跑数据。
- ⛔ **不许部署**：不 `npm run build`、不上腾讯、不同步阿里、不 `git push`、不跑 `scripts/bump-version.mjs`。
- ⛔ **不许提交**：没让 commit 就不 commit（与下面「Git and GitHub」一致）。

✅ **例外（这些不算"测试"，可以做）**：`npx tsc --noEmit`、`eslint`、读代码、`grep`、看交接文档、看 `prisma/schema.prisma`。
✅ **判据**：只要一个动作会「产生副作用」（改数据库、烧积分、改服务器、动 git 远端）
或「花时间去跑真环境」，就属于**必须先问**。

⭐ **用户说了才做**：他会明确说「测一下 / 你去验一下 / 部署掉 / 上正式服」这类话；
「继续优化」「改一下这个」「优化一下性能」**都只是让你写代码**，不是让你去跑。

⭐ 汇报时**主动把"我建议测这几项"列出来给他挑**，而不是自己先跑完再说。

# 铁律：一切测试（本地 / 测试服 / **正式服**）只用 `12424740@qq.com`（2026-07-31 用户拍板）

🗣️ **用户原话意思**：「以后本地，测试服和正式服都用 `12424740@qq.com` 这个号测试，这个记录清楚让后面的 AI 不要弄错。」

- **三个环境都用它**（密码 `dragonstar`；本地库 / 测试库 / 正式库里都有这个号）。
  它是**普通用户**（测试服 ID_535317 / 正式服另有 ID），正好也最接近真实用户视角。
- ⛔⛔ **禁止再用 `lookxun@163.com` 做前台测试 / 巡检 / 真跑生图生视频** —— 那是**用户自己的号**，
  在上面加节点、烧积分等于动用户的数据和钱。**它只用于"必须管理员权限"的场合**（登后台 `/admin` 看页面）。
  2026-07-31 踩过：我照旧文档用它做正式服巡检，在**他自己的 `工作流_01`** 里加了 2 个节点、烧了 47 积分。
- ⭐ **测试内容不要删**（用户长期交代）→ 要做会留痕的实验（比如生成一张图验证链路），
  **新建一个工作流/对话**来做，别动现有的。
- ⭐ 正式服真跑生成**确实会花真钱**，这是"部署完必须真上号验一遍"的必要成本（用户已认可），
  但**必须花在测试号上、并在交接文档里写清留下了什么痕迹**。

# 铁律：查「点了没反应 / 交互卡」，先分「等接口」还是「接口慢」，再单独算一笔"每请求固定开销"（2026-07-31 加）

用户报某个按钮"点了要过好久才反应"时，**按这个顺序拆，别一头钻进那个功能的业务代码**：

1. ⭐⭐ **先看前端时序：是不是"等接口回来才画 UI"？** 这类问题九成是这个。
   2026-07-31 的「使用提示词」就是：`await fetch` 回来才建节点 → 点下去屏幕**一个像素都不动**（菜单都不关）。
   ⭐ **正解永远是"先给反馈、再补内容"**：能同步算出来的先画（画布上本来就有的模型/比例/分辨率），
   要等后端的那部分给**禁用 + 转圈 + 文案**，回来了只 patch 那一个对象。
   ⛔ 配套三件事缺一不可：① 超时兜底（`AbortController`，绝不允许永久禁用）；
   ② 临时态字段**必须在存库边界剥掉**（否则刷新后永久卡住，`promptLoading` / `uploadProgress` 都是这个坑）；
   ③ 想清楚"回来时用户已经改过了怎么办"（禁用态天然免疫；不禁用就要判"用户是否已编辑"）。
2. **再看接口自己**：`SELECT *` 拉了没用的大 JSON 列吗？几条查询是不是**串行 `?? await`**（能 `Promise.all` 吗）？
   `A 不中再查 B` 能不能合成一条 SQL（`= 或 LIKE` + `ORDER BY (精确命中) DESC`）？
   ⭐ 只需要大 JSON 里一个字段时，用 `"extraJson"->>'key'` **在库里就抽出来**，别把整列搬回 Node。
3. ⭐⭐ **最后单独算一笔「每个请求都要付的固定开销」** —— 这一步最容易漏，而它往往是最大头。
   2026-07-31 查出来的真凶就在这：`getCurrentSession()`（**全站每个登录态接口的第一件事**）
   里 `await` 写了一次 `Session.lastSeenAt`（纯签到、跟"你是谁"无关）→ **每次点击白等一个跨境往返**。
   已改成「不 `await` + 60 秒节流」，细节与三条禁忌见 `handover/02-architecture-and-data.md` 那一节。
   ⛔ **改这类全站路径前必须先把影响面逐项列给用户**（我这次列了 4 项，用户才拍板）。
   ⛔ 尤其分清「看着像一回事的两个字段」：`lastSeenAt`（活跃统计）vs `activeWorkspaceSeenAt`（后台「在线」判定）
   —— 动错一个后台就开始说假话。

⭐ **通用判据**：优化交互延迟时，把一次点击拆成
「① 前端有没有立刻给反馈 ② 这个接口自己几个 DB 往返 ③ 每个请求的固定开销（鉴权等）」三笔账**分别报数**，
⛔ 别只报一个"总共几秒"就开始改代码。

# 铁律：给「下行瘦身」配防线时，取"库里现有数据"的那次查询不许带 `deletedAt: null`（2026-07-31 加）

下行做了瘦身（投影/只发标题），PUT 侧就必须有"客户端手里没有权威数据时绝不覆盖"的防线。
**这类防线几乎都以「能从库里查到现有那份」为前提** → 那次查询一旦带了 `deletedAt: null`，
**软删除的行就查不到、防线全部失效、被空数据覆盖 = 真删用户数据**。

- 2026-07-31 实测踩到：删掉一个"只发了标题"的工作流后，客户端仍会带着 `deletedAt` 继续 PUT 它，
  `upsertWorkspaceWorkflows` 里那次 `where: { userId, deletedAt: null }` 查不到它 →
  **回收站里那条工作流的 canvasJson 被洗成 `{}`**（本地实测 279 字节 → 2 字节）。
  修法 = 那次查询去掉 `deletedAt: null`（"库里有没有内容"这种统计口径仍只算未删的行）。
- ⭐ **判防线够不够强的姿势**：把"用户删掉一个从没打开过的对象"当成必测用例，
  删完去库里看它的内容字段是不是还在（不是只看列表里消失了）。
- ⭐ **结构性判据要选"天然可分"的那个**：本次防线用「客户端这份画布里**有没有 `nodes` 数组**」
  而不是「nodes 是不是空数组」—— 因为前端只要加载过画布就一定会写 `nodes: [...]`（哪怕空），
  于是「用户真的清空画布」（`nodes: []`，要存）和「压根没加载过」（`{}`，要拦）**结构上天然不同**。
  ⛔ 若判据选成"空就不写"，用户就永远清不掉画布。

# 铁律：评估架构优化要算"随数据量怎么增长"，不能只算当下字节（2026-07-30 加）

上一任把「工作流按需加载」评估成"不值得做"，因为 gzip 后只能再省 31KB。**用户否掉了这个结论**：

> 「如果只是算眼前的账那当然没必要做，没多少大。但是我们的项目还要一直运行的，
> 以后如果一个人 100 多个工作流 1000 个工作流难道还一次性下发吗？那不卡才怪呢。」

- ⭐ **判据要两个**：① 当下多大（gzip 后，见上一条铁律）② **随数据量线性/指数增长吗**。
  只满足①不做、满足②就要做 —— 因为②是"以后一定会爆",而且越晚做越难改。
- ⭐ **量增长率的姿势**：算"每单位数据多少字节"（本次：骨架版每节点约 560 字节），
  再乘上可预见的规模（1000 工作流 × 50 节点 = 28MB）。**别只报一个总数就下结论。**
- ⭐ **顺手做的"搬到服务端"往往比省字节更值**：本次为了按需加载，把 3 处跨工作流遍历搬到服务端，
  **白捡修掉一个真 bug** —— 远端图片地址原来只在"用户开着页面"时才换成本地，关了页面就留着会过期的地址 = 死链。

**配套：查"前端为什么必须拿到全部数据"时，逐处点开看，别信交接文档里的清单数字。**
本次交接文档写的"6 处跨工作流遍历"实际只有 3 处 —— 另外 4 处第一行就 `find(id === xxx)`、只用一个。
（同源于下面那条"A 表描述可能已过期，动手前先用数据验前提"。）

**配套：想把某件事"搬到服务端"之前，先 grep 一遍服务端是不是早就在做了。**
本次要把"反查这张图属于哪个工作流节点"搬到服务端，结果发现 `generation-jobs.ts` 的
`finalizeImageJobAsset` / `finalizeVideoJobAsset` **在任务成功那一刻就已经建好 MediaAsset 了**
（注释原文："这样即使用户永远不回来，成品图也一定进资产库、不丢"），
workflowId / workflowNodeId / systemName / sourcePrompt / model / 生成参数**全都有**
→ 前端那套反查是**纯重复劳动**，只要把已有数据回给前端就行，一行新逻辑都不用写。
⭐ 判断姿势：`grep buildMediaAssetRecord` / `grep finalize` / 看 `prisma/schema.prisma` 有没有现成的列
（本次还发现 `WorkspaceWorkflow` 早就有 `nextImageNumber`/`nextVideoNumber` 两列，
而前端还在扫所有名字自己推编号）。

**⚠️ 反过来也要留意：搬到服务端会引入"服务端改 + 客户端整体覆盖"的并发竞争。**
本次给 `applyWorkflowJobResultToCanvas`（服务端改画布）配了一道 `mergeWorkflowCanvasMedia` 里的兜底：
客户端还挂着 `http(s)://` 远端地址而后端 job 已落地 → 一律用 job 的本地地址。
**凡是"服务端直接改一个会被客户端整体覆盖的字段"，都必须配这种兜底。**

# 铁律：查"慢/卡"这类性能问题，先分层掐表 + 逐层量字节，禁止看代码猜（2026-07-30 加）

排查「某个接口慢」时，**先量再说**，顺序固定：

1. **分层掐表**把范围缩到一层：容器内直打 app → 宿主打 nginx → 本机走 TLS → 跨境。
   本次实测 39ms / 2ms / 20ms / 0.43s，**四层都快 = 问题在"响应体大小"而不是"处理慢"**。
2. **nginx 日志按 body 字节排序**（`awk` 取第 10 段），一眼看出哪个接口最大、多大。
   ⭐ nginx 会自己把病因写在 warn 里：`an upstream response is buffered to a temporary file`
   = **响应撑爆了 `proxy_buffers`（默认才 8×4k=32KB），被落盘到磁盘再转发** —— 这就是本次那 17~30 秒。
3. **逐层量字节**：顶层各字段 → 钻进最大那个 → 再钻一层。本次钻了三层才发现"同一份提示词存了 4 份"。
   ⛔ **别在第一层就下结论**：我第一次判断"消息一次全发"就是错的（消息早就有分页），**是用户纠正的**。
4. **改完必须再量一次**（拿真实重度用户数据跑，见 `.runtime/verify-gain.js`），否则不知道有没有效果、还剩多少。
5. ⭐⭐ **要不要"为了省字节改代码"，必须先量 gzip 后的大小，别拿未压缩字节做决策**（2026-07-30 加）。
   本次实测：工作流 canvas 未压缩 **655KB**，gzip 后只有 **105KB（16%）** ——
   因为 `data.prompt` 是纯中文提示词文本还大量重复，**正好是 gzip 最擅长的东西**。
   于是那个"看起来能省 655KB"的优化（M025）**实际收益只剩 ~31KB**（据此建议不做，🗣️ 但**最终结论用户还没拍板**，
   见 `06-memo-tasks.md` 的 M025）。
   姿势：`zlib.gzipSync(Buffer.from(JSON.stringify(x)), { level: 5 }).length`（模板 `.runtime/m025.js`）。
   ⭐ 顺序永远是「**先上 gzip + 放大缓冲，再谈剥字段**」—— 前者零风险，后者要动前端读写链路、改错就删用户数据。
6. ⭐ **怀疑"新版本变慢/报错"，先拿还没升级的那台做对照** ——
   本次靠"部署前的 v54 也有 30.8s 的 401"排除了"是新代码引起的"。
   ⭐ 同理，**怀疑"数据被自己弄丢了"时，先找一个"这次没被碰过"的行/用户做对照**
   （2026-07-30：查库发现 `feedbackLogs` 是 0，差点以为被自己的 PUT 洗了；
   靠另一个没登录过的用户那行 `updatedAt` 还是部署前的时间、也是 0，才确认本来就是空的）。
7. ⭐ **502 `connect() failed (111: Connection refused)` 基本都是部署窗口**（容器没在监听），不是 bug；
   判据 = 时间戳全挤在 `up -d --build` / `force-recreate` 那几秒。⛔ 别和"慢"混成一个问题查。
8. ⭐ **覆盖服务器上的 nginx conf 前，先看 diff 里有没有 `<` 行**（2026-07-30 加）：
   全是 `>`（纯新增）= 仓库那份是服务器的严格超集、期间没人手改过，才敢覆盖；
   出现 `<` = 服务器被手改过，**先搞清楚再动**。

**配套的代码铁律：下行做了"投影/瘦身"，就必须配一个 PUT 侧的"字段恢复"。**
因为 `messageJson` / `canvasJson` 这类都是**整体覆盖**保存的，前端把瘦身版存回来就等于**删库**。
现成的成对实现照抄：`workspace-sessions.ts` 的 `projectWorkspaceMessageForClient()` ↔ `restoreProjectedMessageFields()`、
`workspace-workflows.ts` 的 `mergeWorkflowCanvasMedia()`。
⛔ 投影只能"**整体相等才省**"，逐项省会让按下标取的数组（`itemPrompts`）错位、或回落到另一条数据上。
⛔ **别在会被回写数据库的对象上剥字段**（`route.ts` 的 `baseState` 就会回写，剥了等于真删用户数据）。

# 铁律：nginx 配置以仓库为准，禁止只在服务器手改（2026-07-30 加）

nginx 配置在仓库里有副本（`nginx/flashmuse.conf`、`deploy/staging/*.conf`、`deploy/ali/`）。
**先改仓库、再部署过去**；2026-07-30 发现仓库那份已经和服务器漂移了（服务器多了 443 server 块和 CORS 头）。
⛔ **阿里正式那份 `flashmuse-static-ip` 不许整份覆盖** —— 它里面还有**别的项目**的配置（`/tiantangqiyuan/`），
整份覆盖会违反下面"绝不能影响其它项目"的约定。要改就用幂等增量脚本
（`deploy/ali/ali-add-proxy-buffers.sh` 是模板：备份 → 只插需要的几行 → `nginx -t` → 失败自动回滚 → 可重复跑）。

# 铁律：排查掉一批红字失败原因，就必须去后台归档（2026-07-27 加）

后台「运营概览 → 失败原因」里的红字，每查清一类根因并修掉/堵上后，**必须把这批历史失败事件归档**：

- 归档 = 给 `GenerationEvent` 打 `resolvedAt` + `resolvedNote`；后台那条原因**文字保留但划掉**（灰色 line-through），并从上方"待排查"数量里扣掉。
- 操作只有一步：往 `scripts/archive-resolved-generation-failures.mjs` 的 `RESOLVED_RULES` 加一条规则（`match` 匹配的是**诊断日志里的真实原文**，不是 failureReason），然后跑 `--apply`。⭐ **跑之前必须先 dry-run 看真实数字**（交接文档里的条数只是快照：2026-07-29 记的 101 条，实跑是 120 条）。
- ⭐⭐ **写归档规则时先问「这个根因以后还会不会再发生」**：修好了、此后零复发 → 不用管；**修不了、只是从兜底桶映射成了明确文案**（余额不足 / 模型拒绝 / 平台审核）→ **必须给规则配 `before` 日期下限**（= 映射上线的时刻，脚本已支持），否则以后每次跑归档都会把「本该一直亮着」的新事件偷偷抹掉、后台再也看不见这个问题（2026-07-29 差点误吃 11 条新的「提供商余额不足」）。
- **`B_xxx` 错误编号计数器**：日常按规则归档时**与归档无关，继续自增**；⭐ 只有用户明确要求「整轮清零 / 重新开始一轮」时才重置（`--reset-all` 会把 `.runtime/error-code-counter.txt` 写回 0，下一条报错从 `B_1` 开始）。
- ⭐⭐ **「整轮清零」模式（2026-07-29 用户拍板，新增 `--reset-all`）**：`node scripts/archive-resolved-generation-failures.mjs --reset-all --apply` 会把**当前全部**待排查失败事件一次性归档（不看 `RESOLVED_RULES`、不看全局护栏）+ 把 B_xxx 计数器归 0，从此只看**新长出来**的红字。⛔ 与下面的日常按规则归档是两回事，别混用；只在用户明确说"全部归档/清零/重新开始"时跑。**2026-07-29 v1.0.0.54 部署后已执行过一次（正式服 + 测试服）。**
- **归档的对象本质是「服务器繁忙，请稍候再试.....」这个兜底桶**（所有没被明确识别的错误都落进它，它是一堆无关根因的混合体）。⭐ **其实有两个兜底桶**：`toUserErrorMessage` 的 fallback 是默认参数 —— 显式传 `GENERIC_MEDIA_ERROR_MESSAGE` 落进「服务器繁忙」，不传落进「**请求失败，请稍后再试。**」，**同一个根因会同时污染两个**（余额不足就是 53 + 13），排查时两个桶都要查。判定只问一句：**这个根因还落在兜底桶里吗？** ①修好了 → 归档；②没修但**已映射成明确文案**（不再落进兜底桶）→ 归档；③还没查清/修不了、仍落在桶里 → 留着亮；④**映射出去后新形成的那条明确原因本身 → 不归档**（修不了就该一直亮着，且它已不污染兜底桶）。例：OpenRouter 余额不足历史 53 条已归档，但新出现的「提供商余额不足！请联系管理员充值。」不归档。
- 排查方法论 / 已修清单 / 待查清单 / 常见误区 → **`handover/07-red-error-triage-and-archive.md`（排查线上报错必读）**。两条核心：**① `failureReason` 是给用户看的文案（"服务器繁忙"是兜底），从它本身查不出根因，真实原因只在 `.runtime/*-diagnostics-log.jsonl` 里。② ⭐ 日志里 `grep -c` 数出来的行数 ≠ 待排查的失败事件数** —— 必须回 DB 按 requestId 核对 `GenerationEvent.status`：`status='success'` 的是"中间失败/已重试成功"，**后台里根本不占位、不用归档**（2026-07-28 踩坑：「缩略图超时 18 条」实际是同一个 requestId 的 18 行日志、该请求最终成功）。

# 铁律：动代码前先评估对既有功能的影响 + 默认只改本地不部署（2026-07-19 加，所有 AI 必须遵守）

用户提需求时，**动代码之前必须先排查：本次需求会不会影响 / 破坏其它已有功能**（尤其对话流 / 工作流 / 资产库 / Agent / 通用模式这几套本质相同、常共用同一份代码的功能）。

- **有影响就先别动代码**：先把**影响范围**告诉用户，等用户确认后再改。目标是新写代码时最大限度不把其它功能搞坏。
- **默认只做本地、不部署、不测试**：用户没明确说"部署"就只在本地改（改完 `npx tsc --noEmit` 自查即可），**不要 build / 不要上腾讯 / 不要同步阿里 / 不要 push**；用户没明确说"测试"也**不要开浏览器、不要登录、不要真跑生成**。⭐ 完整口径见本文件**最顶部那条铁律**（2026-07-31 用户拍板）。
- 与下面"能统一一律统一"配合：改统一函数时尤其要评估它被哪些模式共用，别只顾眼前这条需求。

# 铁律：测试服→正式服部署顺序 + 版本号自增（2026-07-18 加，所有 AI 必须遵守）

有一套**测试服**（腾讯 `/opt/flashmuse-staging/` + 阿里镜像，入口 `http://101.37.129.164:8080/`、后台 `/admin`），和正式服代码一致、数据/环境独立。用来在不影响正式服用户的前提下线上验证。

- **部署顺序永远是：先测试服，再正式服。** 哪怕用户说"直接部署正式服"，也必须先部署测试服、验证 OK 后，再把**测试服那份代码原样同步到正式服**。禁止跳过测试服、禁止直接改正式服代码。
- **"部署掉 / 部署一下"等默认只部署测试服，绝不动正式服。** 只有用户明确说"把正式服部署掉 / 更新正式服 / 上线正式服"这类话，才执行"先一次性部署测试服、再同步到正式服"的完整顺序。默认永远只到测试服为止。
- **版本号自增只发生在"部署测试服"这一步**：部署测试服前先跑 `node scripts/bump-version.mjs`（四段 100 进制 vAA.BB.CC.DD 最右段 +1、满 100 进位，写回 `src/lib/app-version.ts`）。**正式服部署绝不跑自增脚本**，只把测试服的代码（含已写好的版本号）原样带过去。
- 由此保证"**版本号一样 = 测试服和正式服代码一样；不一样 = 代码不一样**"。破坏此保证的操作（正式服再自增、正式服独立改代码、跳过测试服）一律禁止。
- 版本号是 `src/lib/app-version.ts` 里的 `APP_VERSION` 常量；`NEXT_PUBLIC_IS_TEST=true`（测试服构建 arg）控制显示 `(t)` 后缀与 logo"测试服"标识。改中文源码用 edit 工具，**禁止 PowerShell `Set-Content`**（会把中文注释变乱码，本次已踩坑）。
- ⭐⭐ **每部署完一台就必须真上号点一遍看有没有崩（2026-07-29 用户加）**：**curl 200 / 版本号头对了 ≠ 没崩**。测试服部署完上号、正式服部署完**也要上号**，**崩了立刻修**（修不了就回滚 `app-backups`，保证用户还能用）。最小巡检 6 项（登录 / 对话模式 / 工作流画布点节点不崩 / 资产库 / 真跑一次生图（动过视频链路再跑生视频）/ 后台 `/admin` 且控制台 0 error）写在 `handover/03-deploy-and-servers.md`「部署铁律」节。

# 铁律：能统一的一律统一，禁止复制多份各走各的

本项目功能不多、各模式本质相同（对话流 / 工作流 / 资产库 / Agent 模式 / 通用模式）。写代码或改东西前，**必须先查是否已有统一的公共路径/函数**，有就复用、没有就抽一个，**绝不允许把同一段逻辑复制成多份各自演化**。

- 反例（已踩坑，2026-07-14）：`getBytePlusProviderKey`（模型→BytePlus 端点映射）被复制到 `image/route`、`video/route`、`generation-jobs` 三份，各改各的 → 只修了对话流那份，Agent/通用模式漏修 → 线上 Agent/通用生图/生视频用新模型直接失败。已收敛为唯一实现 `src/lib/byteplus-provider-key.ts`。
- 判断标准：**理论上"生图在一个地方能用，其它地方都应该能用"**（生视频、上传、进库、读取、命名、扣费、参考图……同理），因为它们本就该走同一套。若出现"对话流可以、工作流/Agent 不行"，几乎一定是某处该统一却分叉了——先找分叉点收敛，别再打局部补丁。
- 已有的统一入口举例（改相关功能务必复用，勿另起炉灶）：进库 `src/lib/media-asset-record.ts`(`buildMediaAssetRecord`/`classifyAsset`)、生成任务与读取 `src/lib/generation-jobs.ts`、扣费 `src/lib/credits.ts`(`chargeCredits`)、模型→端点键 `src/lib/byteplus-provider-key.ts`、**模型拒绝文案 `src/lib/error-message.ts`(`MODEL_REFUSED_PREFIX` + `isModelRefusedMessage` + `buildModelRefusedMessage`：⭐ 2026-07-29 起「模型拒绝 / 平台安全策略 / 版权限制」**三类合并成唯一一句**「模型因色情/暴力/隐私安全等原因拒绝出图，你可以调整提示词或更换参考图后重试。以下是模型返回的拒绝原因：“…”」，不再按模型分"能不能AI改写"。⛔ 改这句必须同步改三处：`gpt-image-safety-retry.ts` 的**前缀**判定、`admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 归一化、`error-message.ts` 顶部的幂等保护；`LEGACY_MODEL_REFUSED_MESSAGES` 里的老文案只用于判定/后台归一化，禁止拿来生成新文案)**、**AI 安全改写 `src/lib/gpt-image-safety-retry.ts`(`isGptImageSafetyFailure`/`runPromptSafetyRetry`/`ensureMentionNamesPreserved`：⛔⭐ **2026-07-29 起只有工作流用它** —— 对话流与资产库那两套已按用户拍板整体撤掉（对话流"一条提示词出多图"，每张独立改写会让显示的提示词对不上；且并发多链会互抢 `message.requestId` 导致成功图被静默丢弃，正式服实测 17 张成功只剩 2 张、白烧 197 积分）。⭐ **2026-07-30 用户拍板：对话流的 AI 改写彻底不做了（原 M021 已取消），别把删掉的代码捡回来、也别再提重做。**)**、**参考素材 url 归一化 `src/lib/reference-asset-url.ts`(`normalizeReferenceAssetUrl`/`normalizeReferenceAssetUrls`：进模型/送审前必过。把「给人看的动态缩略图接口地址 `/api/media-thumbnail?url=`」和「自家主机绝对前缀（含已退役马来 IP）」一律还原成文件静态直链 —— 平台是来"上门自取"的，给它动态接口它会现场等我们生成缩略图然后超时。8 处咽喉共用：image/video/byteplus-assets 三个 route 入口 + `generation-jobs.resolveReferenceUrls` + openrouter/openrouter-video/seedance/video-route 的底层拼址，禁止再在别处自己判 `startsWith("/generated/")`)**、参考图 hint `src/lib/reference-hint.ts`、错误文案 `src/lib/error-message.ts`、登录失效跳转 `src/lib/session-expired-redirect.ts`、@提及匹配/删除 `src/lib/mention-text.ts`、上传文件命名 `src/lib/upload-name.ts`(`resolveUploadName`：同图复用名/异名错开_2/去扩展名/改名跟随；对话流·工作流·资产库 图·视频·音频·文档统一走它，前端只显示服务端返回的 `name`，禁止再在前端各写一套取名/版本化逻辑)、音频波形播放器 `src/components/audio-waveform-player.tsx`(`AudioWaveformPlayer`：wavesurfer.js，`variant="node"` 工作流画布音频节点 / `variant="card"` 资产库上传音频方卡；工作流·资产库统一走它，禁止再各写一套音频播放 UI)、视频播放按钮角标 `src/components/video-play-badge.tsx`(`VideoPlayBadge`：全平台所有视频缩略图中间的播放标记，5 档 size；对话流·工作流·资产库·@引用·图层·后台·上传缩略图统一走它)、**媒体时长校验 `src/lib/media-upload-validation.ts`(`MEDIA_DURATION_EPSILON_SECONDS` 唯一容差常量 + `validateReferenceMediaDurationRange` 单条时长校验唯一实现；对话流·工作流·服务端三处共用，禁止再在组件里写本地副本——历史上就是各写一份导致 15.35/15.35/16.01 三个数都错)**、**参考素材总时长 `src/lib/upload-rules.ts`(`validateReferenceTotalDuration`)**、**工作流节点下载 `downloadWorkflowNode()`(`workflow-tldraw-canvas-inner.tsx`，图片/视频/文本通用；右键菜单与快捷菜单共用，禁止再内联写一份)**、**静态媒体地址 `src/lib/static-media-url.ts`(`getStaticMediaUrl`/`toLocalGeneratedUrl`/`shouldUseStaticAssetBaseUrl`：对话流·工作流画布统一走它，禁止再各写一份——工作流画布原来那份是空函数，从没生效过)**、**AUTH_SECRET 读取 `src/lib/auth-secret.ts`(`getAuthSecret`：生产没配直接抛错，禁止再写 `|| "flashmuse-local-dev-secret-change-me"` 兜底)**、**接口限流 `src/lib/rate-limit.ts`(`rateLimitAllow`/`getClientIp`)**、**诊断日志轮转 `src/lib/diagnostics-log-rotate.ts`(`appendDiagnosticsJsonl`：三个 diagnostics-log 统一走它，超 20MB 轮转成 .1)**。
- ⛔⛔ **往 `WorkflowSelectedNodeOverlay`（工作流选中节点浮层、含图片/视频快捷菜单）里加 Hook 会把整个 tldraw 画布搞崩**（2026-07-29 踩过）：它在 `workflow-tldraw-canvas-inner.tsx:2493` 有 `if (!selected) return null;`，在其**之后**加 `useMemo`/`useState` 等 → **React #310「Rendered more hooks than during the previous render」** → 点任意节点，画布整个变成「Something went wrong / Please refresh your browser」。**加在提前 return 之前，或干脆别用 Hook。**
- ⛔⛔ **排查对话流失败卡时必读（2026-07-29 踩过、误报过一次）**：失败卡包在 **`<LazyMediaMount height={250}>`**（`chat-workbench.tsx:16531`）里 —— **滚进视口才挂载**，没进视口时 DOM 里根本没有卡；而红字**不在**这个组件里、一直显示。所以**「红字在、卡不在」是正常现象，不是数据丢了**。用 `querySelectorAll('.flashmuse-failed-media-card')` 统计失败卡不可靠，必须先 `scrollIntoView` 再断言。
- ⛔ **"某条原因高度集中在一个入口"不一定是分叉**（2026-07-29 踩过）：后台「失败排查」页那条设计意图会给假信号 —— 先去看「失败最多的用户」卡，如果也集中在一个人，那是用户行为不是代码分叉（101 条里 76 条是同一个人三天刷出来的）。
- 新增模式/模型时：只改统一函数 + 配置表（`system-settings.ts` 的偏好/端点表要**对称补齐所有前缀** conversation-image / asset-image / agent-image / video / agent-video），改完所有模式自动一致。
