# Current Handover Changelog · 卷 3（2026-08-09 起用）

> ⭐⭐ **这是当前活跃的流水，新会话的记录写在这里（倒序，最新的放最上面）。**
>
> - **卷 1 = `CHANGELOG.md`**（2026-07-21~2026-08-03，约 467KB / 2538 行）**已归档、只读、勿改**。
> - **卷 2 = `CHANGELOG_2.md`**（2026-08-03~2026-08-09，约 131KB / 2388 行）**已归档、只读、勿改**。
>   需要第 45~60 次会话的详细过程时才去翻它。
>   ⚠️ 卷 2 的 **887~1033 行是编码受损原文**（用 PowerShell 写中文文件的失误，760 个 `U+FFFD`，第 50~53 次会话）——
>   ⛔ **别去"修"它**（等于伪造记录）；那几批的完好摘要在 `01-current-status.md` / `05-next-actions.md`。
> - ⛔⛔ **轮转规则**：当本文件也变得过大（经验阈值 ≈ 400KB 或 2000+ 行）时，
>   **新建 `CHANGELOG_4.md` 接着写**，本文件转为只读归档；以此类推（5、6…）。
>   ⭐ 新卷开头都要照本文件这样：① 指明上一卷是谁、已归档只读 ② 写一段「当前状态摘要」保证接手能续上 ③ 再往下倒序追加会话记录
>   ④ 把旧卷标题改成「卷 N · 已归档只读」并在顶部加指向新卷的提示 ⑤ 更新 `00-README.md` 文档索引里的 CHANGELOG 行。
> - 判据不变：**版本号一样 = 测试服和正式服代码一样**（本项目核心约定，见 `AGENTS.md`）。

## 📌 当前状态摘要（2026-08-11 第六十四次会话末）

| | 版本 / 状态 |
|---|---|
| 本地 / 测试服 / **正式服** / GitHub | **`v1.0.0.98`** —— **四方同步**，commit `77d7357` 已 push，工作区干净、无未推送 |
| 硬判据 | staging→prod 对齐后 `src/` 逐文件 md5 完全相等（`42b1d044b6a094a34e3a2fe02e2d1265`，194 文件）|
| 迁移 / 基础设施 | ⭐ **带 1 个 Prisma 迁移**（`20260811010000_content_moderation_term_sort_order`，两服都已 Applying）；无 compose/nginx 改动；两服 `.env` 的 `PUBLISHED_APP_VERSION` 已改 v98 |
| 自查 | `tsc` 0 |
| 回滚点 | `/opt/flashmuse/app-backups/20260811-180453-presync-v1.0.0.98`（145M）+ 正式库备份 `pre-deploy-v98`（6.3M，EXIT=0）|

- **最近上线的内容（v98，第六十四次会话）**：修**内容审核词库的两个问题** ——
  ① **「王丹」被存成「王\uFFFD\uFFFD」**（测试服 + 正式服都有、本地没有；根因是 2026-08-07 填词时词表**分段传入浏览器、每段各自 UTF-8 解码**，「丹」的 3 个字节被切在第 4587 字节这个 3 字节/base64 对齐边界上）；
  ② **词库排列三端不一致**（后台按 `createdAt` 排，而整批词同一事务插入、586 行 `createdAt` 完全相同 → 排序无决定性依据）。
  ⭐ 修法：新增 **`sortOrder`** 列（读取 `ORDER BY sortOrder, createdAt, id`）+ 三端数据统一成**权威 587 词**（原 586 含王丹 + 用户加的「毛主席」）。
  ⭐ 顺带解除一个真伤害：那行坏数据的 `normalized` 被剥成「**王**」一个字 → 测试服上任何含「王」的提示词都被拦（国王/王子/女王…）。
- **上一批（v97，第六十三次会话）**：① **M029 修对话流「视频双失败卡」**（视频失败无脑 +1、被两个轮询器双双收尾 → 加"只有还剩待生成名额才计一次失败"守卫）；
  ② **M037 工作流上传进度不再拖垮画布**（进度只 patch 那一个 shape、不 stringify/不 onChange/不 PUT）；
  ③ **后台「语义审核待确认」只显示 `flagged`（疑似命中）**，不再把「正常」结果列进来。
  ⭐ 还**修了历史坏数据**：本地 1 条 + 正式库 2 条 `failedVideoCount=2` 的老消息回收成 1（修复只对新数据生效，老消息要手动改）。
- **上一批（v96，第六十二次会话）**：按**逐模型实测的上游真实上限**，把「提示词字数默认限制」按模型全部改成用户拍板的产品值
  （`MODEL_DEFAULT_PROMPT_MAX_LENGTH`）。⭐⭐ **关键发现：即梦/各家前台的字数限制是"产品限制"，上游 API 大多不卡这么严** ——
  实测对照表在桌面 `模型提示词字数上限.md`，也整理进了本次会话记录。
- **上一批（v95）**：修「公告『新增』显示成『新建』」（简繁转换改字）+ M040 幂等测试 + 删死常量 `MAX_DRAFT_INPUT_LENGTH` + M011 关闭。
- **再上一批（v91~v94）**：Seedance 2.5 后台补齐、提示词「超字数不删字」全套、API 统一 `no-store`、三处重复实现收敛。已全部在正式服。
- **账号**：一切测试（本地/测试服/正式服）只用 `12424740@qq.com` / `dragonstar`；
  登后台 `/admin` 只能用白名单号 `lookxun@163.com`（同密码，⛔ 只许看后台、禁止在前台做任何生成）。
- **服务器**：腾讯新加坡 `119.28.116.16`（app，正式 `:5000` / 测试 `:5001`）、阿里杭州 `101.37.129.164`（入口+静态镜像）。
  测试服入口 `http://101.37.129.164:8080/` 或 `https://staging-static.venusface.com/`；正式 `https://main.venusface.com/`。
- **活跃备忘重点**：**M041**（简繁转换会改用户自己的字，只影响繁体用户，用户拍板先记不做）、
  M038 / M039（@名正则不对称、从资产库捞回老图，都要先确认产品口径）、M032（工作流参考图静默挂不上，**根因未知，只许加日志**）。
- 🎯🎯 **下一个 AI 的最优先任务 = 「间断性卡死」bug 的静态定位**（证据链已完整，⛔ 定位到之前只许加日志、不许改行为）。

---

## 第六十四次会话（2026-08-11）：修内容审核词库「王丹」乱码 + 词库排列三端不一致 → 两服上线 `v1.0.0.98`

> | | 版本 / 状态 |
> |---|---|
> | 本地 / 测试服 / 正式服 / GitHub | **`v1.0.0.98`**（四方同步，commit `77d7357` 已 push）|
> | 迁移 | ⭐ 1 个：`20260811010000_content_moderation_term_sort_order`（两服 Applying）|
> | 回滚点 | `/opt/flashmuse/app-backups/20260811-180453-presync-v1.0.0.98`（145M）；正式库备份 `pre-deploy-v98` |

🗣️ **用户起点**：「测试服后台内容审核里敏感政治内容有一个 `王\uFFFD\uFFFD`，本地没看到乱码，正式服也有，我手动删掉了。查清楚为什么服务器上会有乱码、`王\uFFFD\uFFFD` 到底是什么词，两服都恢复成原来的文字。另外正式服里词的排列都不一样（测试服和本地是一致的），这也要改。」

### 一、乱码那个词 = **王丹**（取证过程）

| 环境 | 第 386 位 | 与本地其余 585 词 |
|---|---|---|
| 本地 | `王丹`（hex `e78e8b e4b8b9`）| — |
| 测试服 | `王` + **2 个 U+FFFD**（hex `e78e8b efbfbd efbfbd`）| **逐字、逐位置完全一致** |
| 正式服 | 已被用户手删 | — |

- ⭐ **判据方式**：把两台的 `value` 用 `encode(convert_to(value,'UTF8'),'hex')` 导出（中文永不过管道），
  在 node 里解码后与本地 586 词逐位置比对 → **staging 只有 index 386 不匹配**（`mismatch idx = [386]`）。

### 二、⭐⭐ 根因（用模拟实验精确复现，不是推测）

`丹` 的 UTF-8 = `E4 B8 B9`（3 字节）。它在权威词表（以「，」拼接）里正好占**第 4585~4587 字节**。

```
在第 4587 字节处切一刀（4587 = 3×1529，是 3 字节 / base64 对齐边界）
→ 前半段以 E4 B8 结尾（不完整序列）→ 1 个 U+FFFD
→ 后半段以 B9 开头（孤立续字节）  → 1 个 U+FFFD
→ 拼起来 = 「王」+ 2 个 U+FFFD，而且全文只坏这一个字（模拟结果 total FFFD = 2）
```

- ⭐ **结论**：2026-08-07 那次往测试服后台填 586 词时，词表是**分段传进浏览器的（字节/base64 分块），每段各自解码**，「丹」正好压在分段线上。
- ⭐ **服务端完全无辜**：`/admin/api/content-moderation` 只做 `splitContentModerationTerms` + NFKC 归一，无任何有损转码；Postgres 是 UTF8（坏数据是进库前就坏了，PG 只会拒绝非法 UTF-8、不会替换）。
- ⭐ **权威源文件本身是干净的**：`final-terms2.txt`（7291 字节 / 586 词 / 0 个 U+FFFD），且 `final-terms2.b64` 解码后与它逐字节相等。
- ⭐ **正式服为什么也有**：2026-08-08 同步敏感词是从测试库 `\copy` 导出 `value` 再 INSERT 进正式库的 —— **逐字节照搬，把坏行一起搬过去了**。

### 三、⚠️ 这个乱码造成的真伤害（比显示难看严重得多）

那行的 **`normalized` = 「王」一个字**（U+FFFD 属于符号类 `\p{S}`，被 `normalizeContentModerationText` 的 `replace(/[\s\p{P}\p{S}_]+/gu,"")` 剥掉了）。
而 `findContentPolicyMatch` 是 `normalizedPrompt.includes(term.normalized)` →
**测试服上任何含「王」的提示词都会被拦**（国王 / 王子 / 女王 / 王冠…）。

- 实测确认已解除：两台 `ONE_CHAR_TERMS=0`；拿「国王坐在王座上」去撞 enabled 词库 → **命中 0 条**。

### 四、⭐⭐ 排列不一致的根因 = `ORDER BY createdAt` 没有决定性依据

- `src/app/admin/page.tsx:444` 读词是 `ORDER BY t."createdAt" ASC`，
  而**整批词是在同一个事务里插入的、`DEFAULT now()` 取事务时间戳** → 实测
  **586 行的 `createdAt` distinct = 1**（本地 / 测试服 / 正式服都是 1）。
- → 排序键完全相同 = **Postgres 返回什么顺序都合法**（实际取决于堆/扫描顺序）。
  本地和测试服**碰巧**等于插入顺序；正式服当初是从导出文件按另一顺序 INSERT、今天用户手删后后台又
  `DELETE 全部 + 重新 INSERT` 了一遍 → 实测 **586 个位置里 585 个与本地不同**。
- ⛔ **所以这不是数据坏了，是代码的排序键不稳定**：不改代码的话，下次谁点一下「保存规则」，顺序还会再乱。

### 五、修法（用户拍板：`毛主席` 保留 / 排序方案我定 → 选了 `sortOrder` 列）

**代码（4 文件 + 1 迁移）**

| 文件 | 改动 |
|---|---|
| `prisma/schema.prisma` | `ContentModerationTerm` 新增 `sortOrder Int @default(0)`，注释钉住"⛔ 别退回按 createdAt 排" |
| `prisma/migrations/20260811010000_content_moderation_term_sort_order/` | `ADD COLUMN sortOrder` + `(groupId, sortOrder)` 索引 |
| `src/app/admin/api/content-moderation/route.ts` | 保存时 `sortOrder = 数组下标`（= 管理员在框里的输入顺序）|
| `src/app/admin/page.tsx` | 读取改 `ORDER BY t."sortOrder" ASC, t."createdAt" ASC, t."id" ASC` |

- ⭐⭐ **排序键写成三级是刻意的**：老数据 `sortOrder` 全 0 时，靠 `createdAt`/`id` 兜底**仍然是确定顺序**
  → 迁移刚上线那一刻不会又乱一次。
- ⭐ **为什么不选"零迁移方案"**（保存时把 createdAt 按下标加微秒递增）：能用，但语义取巧；
  `sortOrder` 才能表达"管理员框里怎么排、页面就怎么显示"。

**数据（⛔ 只 UPDATE / INSERT，零删除）**

- 权威清单 = `final-terms2.txt` 的 586 词（含 `王丹`）+ **`毛主席`** 放末位 = **587 词**
  （⭐ `毛主席` 既不在原始 602 词也不在 586 词里，是后来加的；用户拍板保留）。
- 生成脚本 `.runtime/gen-fix.mjs` → `.runtime/fix-terms.sql`（272KB）：
  ① 先 `UPDATE ... WHERE value LIKE '%'||chr(65533)||'%'` 把坏行修成 `王丹`（顺带解掉 `normalized='王'`）；
  ② 587 条 `INSERT ... ON CONFLICT (groupId, normalized) DO UPDATE SET value, createdAt`（存在就改、缺的补上）；
  ③ 自检 4 条 SQL（TOTAL / BAD_FFFD / DISTINCT_CREATEDAT / **不在清单里的多余词只报不删**）。
- ⭐ **动前先备份两服原词库**（hex 导出）：`/tmp/terms-backup-{staging,prod}-20260811-173839.txt`（各 586 行）。
- ⭐ **SQL 文件本地 md5 = 服务器 md5**（`aa09ec36a7103418bcd8ae9db423e98f`）→ 证明中文在传输途中一个字节都没变。

**修复结果（三端）**

| | 词数 | 与权威清单逐字符相同 | U+FFFD | `DISTINCT_CREATEDAT` |
|---|---|---|---|---|
| 本地 | 587 | ✅ | 0 | 587 |
| 测试服 | 587 | ✅ | 0 | 587 |
| 正式服 | 587 | ✅ | 0 | 587 |

### 六、验证（真走界面，⛔ 别重复做）

**测试服 v98 巡检 6 项全过**：登录 / 对话模式（历史 24 条）/ 工作流点节点不崩（`.tl-shape` 点击后无 `Something went wrong`）/ 资产库 /
**真跑生图成功**（Seedream 4.5，94,351 → 94,348 扣 3 分，成品图走 `/api/media-thumbnail` 正常显示）/ 后台 **console 0 error**。

**正式服 v98 巡检 6 项全过**：登录 / 工作流 14 个 shape 点击不崩 / 资产库 31 张缩略图 /
**真跑生图成功**（GPT-5.4 Image 2，9,097 → 9,082 扣 15 分，⚠️ 等了约 2.5 分钟才出）/ 后台 `/admin` / **console 0 error**。

**词库顺序的两级判据（下次照抄）**

1. ⭐⭐ **零风险的掩码判据**：后台锁定态下词库是 `terms.replace(/[^\n,，]/g,"*")`，
   **掩码保留了每个词的字数** → 直接把它和 `canonical.map(t=>'*'.repeat(len)).join('，')` 比对，
   **不用解锁、不用揭示、不碰数据**就能验顺序。两服都 `MASK_EQUAL true`（2509 字符逐字符相同）。
2. 再解锁（`dragonstar`）+ 点眼睛看真实文字：两服都
   **587 词 / `EXACT_EQUAL_CANONICAL true` / 第 386 位 `王丹` / 末位 `毛主席` / 0 个 U+FFFD**。
   ⛔ 全程**没点过「保存规则」**；看完**立刻重新锁定**并确认回到 `已锁定，点开关输入密码解锁` + 掩码态。

**部署硬判据**：两服迁移都 `Applying` + `All migrations have been successfully applied.`；
`/api/health` 两服都 `{"ok":true,"version":"v1.0.0.98"}`；`src/` 逐文件 md5 测试服 = 正式服（194 文件、`42b1d044...`）；
腾讯 26 chunk = 阿里 26；四域名全 200；`x-app-version: v1.0.0.98`；`/api/announcement` 仍带 `no-store`。

### 七、⭐ 恢复资产（下次要再修/再核对，直接用这些，⛔ 别重新拉词库）

| 东西 | 位置 | 说明 |
|---|---|---|
| **权威源词表** | `C:\Users\ASUS\AppData\Local\Temp\opencode\final-terms2.txt` | 7291 字节 / **586 词** / 0 个 U+FFFD，中文逗号分隔。⭐ 这是 2026-08-07 筛出来的那份，**唯一可信底本** |
| 同一份的 base64 | 同目录 `final-terms2.b64` | 9724 字节，解码后与上面**逐字节相等**（已验） |
| 权威 **587** 词清单 | `.runtime/canonical-terms.json`（数组）/ `.runtime/canonical-terms.txt`（「，」拼接）| = 586 词 + 末位 `毛主席` |
| 生成器 | `.runtime/gen-fix.mjs` | 读源文件 → 复用后台同机制的 split/normalize → 自检（586 词、含王丹、normalized 无重复无空）→ 产出下面那个 SQL |
| 修复 SQL | `.runtime/fix-terms.sql`（272KB）| ① 修 U+FFFD 坏行 ② 587 条 upsert ③ 4 条自检。**只 UPDATE/INSERT，零删除** |
| 本地修复脚本 | `.runtime/fix-local.mjs` | 本地库用（会同时写 `sortOrder`，服务器那份 SQL 当时还没这列） |
| **两服原词库备份** | 服务器 `/tmp/terms-backup-staging-20260811-173839.txt`、`/tmp/terms-backup-prod-20260811-173839.txt` | 各 586 行，hex 格式（`id\|value_hex\|normalized_hex\|createdAt`）。⚠️ `/tmp` 重启会清 |

⭐ `.runtime/` 是 gitignored，所以这些文件**只在本机**；要长期保住，`canonical-terms.txt` 值得另存一份。

### 八、几个取证细节（下次排查同类问题能省时间）

- ⭐ **正式服的时间线可以反推用户做了什么**：本次 prod 的
  `ContentModerationTerm.createdAt` = **2026-08-11 03:57**、`RuleGroup.updatedAt` = **07:33**（都是当天）
  → 说明用户在后台**保存过两次**（手删乱码那次触发了 `DELETE 全部 + 重新 INSERT`）
  → 这正是"正式服顺序被彻底打乱"的直接动作（旧顺序本身已是不确定的，一保存就固化成另一种）。
- ⭐ **`毛主席` 的来历查过了**：既不在原始 602 词、也不在 586 词里 → 是后来加进正式服的。
  ⛔ **我没有自己决定删它**，而是问了用户（🗣️「毛主席 留」）—— 配置类数据里的"多出来的东西"
  很可能是用户手工加的，**按铁律不许当垃圾清**。
- ⭐ **staging 的 `editUnlocked` 当时是 `true`**（用户正在里面操作），prod 是 `false`。
  本次两服都已恢复**锁定态**并复验（`readOnly/disabled` + 掩码 + 「已锁定，点开关输入密码解锁」）。
- ⭐ **判"坏数据只有一行"要正反两面查**：正向 `value LIKE '%'||chr(65533)||'%'`；
  反向把两台的词集合与本地做双向差集（`stagingOnly` / `localNotInStaging` 各 1 条 = 只坏一行）。
  ⚠️ 我第一版"坏行检测"写得过宽（把 `hujintao`、`政f`、`共c党` 这类**合法的拼音/字母谐音词**也标成坏行），
  → **判据必须精确到 `U+FFFD`**，别用"含 ASCII"这种间接特征。
- ⚠️ **本项目词库里大量词本来就含 ASCII 字母**（`gc党` / `xiao平` / `ze东` / `政f` …），
  所以任何"中文校验/清洗"类脚本都不能拿"必须全是中文"当规则。

### 九、留痕（⛔ 别当成用户数据）


- 测试服 `12424740@qq.com`：一条对话「v98巡检：一只白色小兔子坐在草地上吃胡萝卜」+ 1 张图（扣 3 分）。
- 正式服 `12424740@qq.com`（ID_636611）：一条对话「v98巡检：一只灰色小猫趴在窗台上看外面」+ 1 张图（扣 15 分，余额 9,082）。
- ⛔ **公告一个字都没动**（正式服禁测公告铁律）；⛔ 零删除用户数据；两服后台已恢复锁定态。
- ⚠️ 词库现在是 **587** 词（比历史文档里写的 586 多一个 `毛主席`）—— 以后核对数量以 587 为准。

### 十、本次踩到 / 用到的经验

1. ⭐⭐ **"同一份数据在两台机器上顺序不同"要先去查排序键的 `distinct` 数**，
   `SELECT count(DISTINCT sortkey)` 一行就能定案 —— 等于 1 就说明**排序压根没有依据**，
   ⛔ 别去猜"是不是同步脚本搞乱了"。
2. ⭐⭐ **判定"一个字符为什么变成 2 个 U+FFFD"的通用手法**：
   `N 字节的字符 → N 个替换字符里的 2 个` = **字节流被切开、两半各自解码**。
   把源文件按怀疑的偏移真切一刀做**模拟实验**，能精确复现就是坐实（本次一次命中）。
   ⭐ 顺带记：**3 字节对齐 = base64 对齐**，所以"用 base64 分段传输"最容易切在这种位置上。
3. ⭐ **掩码/脱敏后的文本仍然能当判据**（本次靠"字数序列"验顺序）——
   验证不一定要拿到明文，先想想"有没有一个不解密就能比对的不变量"。
4. ⛔ **PowerShell 又吃了三次**：内联 `node -e` 里的中文 `，` 直接 ParserError；
   `SELECT count(*)` 里的 `*` 被当成 cmdlet；ssh 内联多条命令只跑第一条。
   → 一律写 `.mjs` / `.sh` 再跑（本次全程照办）。
5. ⚠️ **Playwright 的 `evaluate --filename` 落在仓库根**（不是 `.playwright-mcp/`）→ 用完记得删（本次已删）。
6. ⭐ 判"生图成功"的正确姿势：`img` 里排除 `user_avatar`，并且**认 `/api/media-thumbnail?url=` 这种缩略图接口地址**
   （成品图在对话流里是走缩略图接口的，只 grep `/generated/` 会漏）。
7. ⭐ **登录相关**：前台登录是**两步**（先填邮箱 → 提交 → 再出密码框）；后台 `/admin` 是**独立的一套登录**
   （前台登了管理员号也进不去，会看到「管理员白名单登录」页，要在那页再填一次邮箱+密码）。
   ⛔ 别去猜 `POST /api/auth/login` 这种接口路径（我试过，404），老实走界面。
8. ⚠️ **本次会话我一度改坏了 `CHANGELOG_3.md` 的结构**：往顶部插新会话时把下一条（第六十三次）的
   `## 标题` 一起替换掉了 → 靠 `Select-String -Pattern "^## "` 数标题行才发现并补回。
   ⭐ **插入后固定做一次"数标题"自检**（本次应有 5 个 `## `：当前状态摘要 + 64/63/62/61 次会话）。

---

## 第六十三次会话（2026-08-10）：修「视频双失败卡」(M029) + 「工作流上传进度拖垮画布」(M037) + 后台语义审核只显示疑似 → 两服上线 `v1.0.0.97`

> | | 版本 / 状态 |
> |---|---|
> | 本地 = 测试服 = **正式服** = GitHub | **`v1.0.0.97`**，commit `abfca9a` |
>
> ⭐ 用户指令链：「后台语义审核待确认里为什么把结果是正常的也显示了？不是应该显示疑似吗」→（选 1：只保留疑似）→
> 「把备忘任务列出来看哪些优先」→「M037 做掉，M029 也看能不能做掉，我本地『生成毛主席』这条就出现了重复失败卡」→
> （给了截图：一条视频消息里两张「视频生成失败」卡，B_242）→「全部做吧，本地修复，部署测试服要测就上号测，测试服没问题就推正式服」。

### 一、后台「语义审核待确认」只显示「疑似命中」（用户报的第一件事）

- **现象**：后台那张表把 `status=clear`（正常/不涉及敏感政治）的记录也列出来了，而它叫"待确认"，正常的根本不需要确认。
- **根因**：`admin-content-moderation-panel.tsx:120` 的过滤只看 `action === "semantic_review"`，不看 status →
  flagged / clear / error 全塞进来。（图片侧的"已拦截记录"不受影响。）
- **修法（1 行）**：`const review = events.filter((item) => item.action === "semantic_review" && item.status === "flagged");`

### 二、M037：工作流上传进度不再拖垮画布（✅ 完成）

- **根因（备忘里早写清了）**：`updateNode({uploadProgress}) → updateState → onChange`，每次要 `exportStateFromEditor` +
  `stateKey`（整张画布 `JSON.stringify`，重度用户 655KB）+ 对所有节点 `updateShape` + 父级 6 次全画布遍历 + 防抖 PUT；
  而一次上传触发 70~100 次进度 → **O(进度次数 × 节点数 × 画布大小)**，节点越多越卡。
- **修法（`workflow-tldraw-canvas-inner.tsx`，约 25 行）**：
  - 新增 `updateNodeUploadProgress(nodeId, progress)`：只直接 `editor.updateShape` patch 那**一个** shape 的
    `props.node.data.uploadProgress`，tldraw 只重渲染那一个节点的 `UploadingNodeOverlay`。**不 stringify、不 onChange、不 PUT。**
  - 新增 `progressOnlyUpdateRef`：在 `registerAfterChangeHandler` 的 workflow_node 分支里，进度更新期间直接 `return`，
    连 `exportStateFromEditor` + `syncWorkflowConnectionShapes` 都跳过（改动周围 `loadingRef` 也一并置真）。
  - 4 个上传热点回调（图/视频/音频/文本）从 `updateNode(...)` 换成 `updateNodeUploadProgress(...)`；
    **上传完成/失败仍走原来的 `updateNode`**（带真实 url + `uploadProgress:undefined`）正常落库。
  - ⭐ 既有的 `throttleUploadProgress` 节流保留（双保险）。上传态字段在存库边界的既有剥离逻辑不动。

### 三、M029：修对话流「视频双失败卡」（✅ 完成，含历史坏数据修复）

- ⭐⭐ **是我先拿用户库里的持久化数据坐实的**（`WorkspaceMessage.messageJson`）：那条 B_242 视频消息
  `failedVideoCount=2 / pendingVideoCount=0 / videos=0 / mediaErrorReasons 只有 1 条` —— 失败记了 2 次但真实原因只有 1 个 → 画出 2 张失败卡。
- **根因（关键是找到"为什么只有视频会双"）**：
  - **图片**失败打在具体 slot 下标（`imageResultSlots[i]`）→ 同一格标两次仍是 1 张卡，**天然幂等**。
  - **视频**没有 slot 概念，失败就是无脑 `failedVideoCount + 1`（`markAssistantVideoFailure`，`chat-workbench.tsx`）。
    对话流有**两个收尾者**：前台 `while` 轮询（catch 里 mark）+ 后台 reconcile 兜底（`reconcileConversationVideo`，
    key = `${requestId}:video:${index}`）。虽然有 `runningRequestIdsRef` 守卫，但**跨浏览器重启/竞态**下两者会对同一个视频先后各收尾一次 → 计数变 2。
    （B_242「远程地址已过期」正是任务跑久、跨重启最容易触发的失败。）
- **修法（`markAssistantVideoFailure`）**：保持不变量 `videos.length + failedVideoCount + pendingVideoCount === 请求数`。
  非重试路径下，**只有还剩待生成名额（`pendingVideoCount > 0`）时这次失败才算一次真正收尾**；pending 已归 0 = 早被另一个收尾者处理过（成功或失败）→ **这次是重复收尾，整条消息不动**（不 +1、不追加原因）。
  ⭐ 已推演所有时序（前台先/reconcile 先/竞态/Agent 一次多视频）都正确；不碰重试路径、不碰图片侧（图片有 slot 兜底、且没报过、最小改动）。
- **历史坏数据修复**（一次性脚本，逻辑：video 消息 + 非重试 + `mediaErrorReasons.length>=1` + `failedVideoCount > 原因条数` → 把 `failedVideoCount` 收回到原因条数）：
  - 本地库 dry-run 1 条 → apply 修 1；正式库 3100 条视频消息里 2 条坏（都是 failed=2/reasons=1）→ 修 2；测试库 0 条。
  - ⚠️ **修复只对新数据生效**，老坏消息必须这样手动改回来（脚本已删，逻辑记在这，下次照做）。

### 四、部署（测试服 → 正式服，全程按 `03` 部署铁律）

- `bump-version` v96→**v97**；改动 4 文件（3 个 src + app-version），**无迁移、无 compose/nginx**。
- **测试服**：清单法 tgz → scp → `tar -xzf -C /opt/flashmuse-staging/app` → grep 确认 4 处改动进服务器源码 →
  后台 build（health=v97）→ `sync-ali.sh --stack=staging`（42 文件）→ `.env` 写 `PUBLISHED_APP_VERSION` + force-recreate →
  `x-app-version=v97` + 外网 8080=200。测试库坏数据扫描 = 0。
- **测试服上号冒烟**：登录 ✓ / 工作流点节点不崩 ✓（M037 那个文件、最高风险区）/ 后台内容审核页「正常」**0 条、只剩「疑似命中」1 条** ✓ / 全程 console 0 error。
- **正式服**：备份 145M（`20260810-192542-presync-v1.0.0.97`）→ staging→prod rsync（**不 bump**）→
  ⭐ **`src/` md5 与 staging 完全相等 `f608cba...`（194 文件）** → build（health=v97、无迁移）→
  `docker cp .next/static` 推阿里正式镜像 `flashmuse-static`（腾讯 42 = 阿里 42）→ `.env` 版本信号 + force-recreate → 四域名 200 + `x-app-version=v97`。
- **正式库坏数据**：dry-run 2 条 → apply 修 2（容器内 `node repair.mjs`，跑完删脚本）。
- **正式服上号巡检 6 项全过**：登录 / 对话模式 / 工作流点节点不崩 / 资产库 33 缩略图 / **真跑生图成功**（灰色布偶猫 2K）/ 后台内容审核过滤修复生效 + **0 console error**。
- commit `abfca9a` + push GitHub。

### 五、留痕（⛔ 别当用户数据）

- 正式服 `12424740@qq.com`：新建一条对话「v97巡检：一只灰色布偶猫趴在木地板上晒太阳」含 1 张 2K 图（扣积分，余额约 9,097）。
- ⛔ 公告一个字没动（正式服禁测公告）；后台只登录看页面，没改任何配置。

### 六、经验/踩坑

- ⭐⭐ **"现象相似≠根因相同"再次应验**：M029 备忘假设是"两个轮询器都 +1"，但**图片和视频不一样** ——
  图片按 slot 幂等、只有视频是裸计数。**先去库里把持久化数据取证（failed=2 但 reasons=1）**，比读代码猜快得多、也一次锁定是视频侧。
- ⭐ **PowerShell 又吃掉了 shell 的 `for` 循环和 `\$`**（验四域名那条 `for d in ...` 被拆成一堆 `=`）→ 一律用服务器上现成的 `/tmp/health.sh`，或写 `.sh` scp 上去跑。
- ⭐ 判"生图成功"要**排除 `user_avatar`**（`/generated/user_avatar/...` 是头像，会被算进 img；本次卡了两轮才想起截图确认）。

---

## 第六十二次会话（2026-08-10）：逐模型实测提示词上游真实上限 → 按用户拍板的产品值改「默认字数限制」→ 两服上线 `v1.0.0.96`

> | | 版本 / 状态 |
> |---|---|
> | 本地 = 测试服 = **正式服** = GitHub | **`v1.0.0.96`**，commit `815650e` |
>
> ⭐ 用户指令链：「先看当前平台里所有模型分别支持多少字」→「2000 都是临时值，你去 OpenRouter 查其它模型」→
> 「到各家官方文档去查」→「不要动代码，你自己测试一下这些数值对不对」→「GPT-5.4 Image 2 到腾讯服上测；
> 所有语言模型也查+测；Seedance 2.0/2.5 也测；最后给我一张准确表格」→「Seedream 三个也测；语言模型是 token 吗？我要文字数量」→
> 「导出到桌面，三列，第三列产品端限制我来填」→（乱码）「做成 md」→「我填好了，做进项目做成默认字数限制，本地/测试服/正式服都做，不用测试」→
> 「有版本号为什么前端没跳版本提示？」

### 一、把"平台所有模型的提示词字数上限"逐个查清 + 实测（本次的核心）

**背景**：`prompt-length.ts` 里除了 Seedance 2.0 系(3500)/2.5(14500) 外全是临时值 2000。用户要精确数据。

- ⭐⭐ **最重要的方法论结论**：**OpenRouter 不公布"提示词字数上限"，只有 `context_length`（token 上下文窗口）；
  图片/视频生成模型在其模型列表里 `context_length=0`（不适用）。真实上限只能去各家官方文档 + 直打上游实测。**
- ⭐⭐ **第二个关键结论**：**即梦/各家前台看到的字数限制是"产品限制"，上游 API 往往不卡这么严** ——
  实测 Seedance 2.0（即梦 3500）发 8000 字真出片；2.5（即梦 14500）发 30000 字真出片；Seedream 全系（即梦 2000）发 2 万字真出图。
  → 所以我们平台的字数限制是**产品决策**，想设多少设多少（别超上游硬上限即可）。

**实测手法（照抄）**：直打上游，**只发"必被拒"的超长值**，被拒 = 免费且错误信息里带真实上限；
被收下 = 会真生成、真花钱（走 OpenRouter/BytePlus 余额，不走用户积分），属探测的必要留痕。
- OpenRouter 视频：`POST https://openrouter.ai/api/v1/videos`（key 在本地 `.env.local` 的 `OPENROUTER_API_KEY`）。
- OpenRouter 图片：`POST /api/v1/images`；OpenRouter 对话：`POST /api/v1/chat/completions`（`max_tokens:1` 兜底）。
- BytePlus 直连视频：`POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks`，
  model 用真实端点 id（2.0=`ep-20260521133841-nn8bg`… 2.5=`ep-20260807153703-h48pt`；`getBytePlusBaseUrl` 默认这个域名，
  ⛔ 不是 `openai.byteplusapi.com`，那个 DNS 解析不了）。BytePlus 图片：`/api/v3/images/generations`（⚠️ Seedream `size` 至少 3686400 像素，用 `2048x2048`）。BytePlus 对话：`/api/v3/chat/completions`。
- ⛔ **GPT/OpenAI 系从本机直连会 403「Country not supported」** → 必须到**腾讯服**（新加坡）跑：
  写 `.mjs` scp 到 `/tmp` → `docker cp` 进 `flashmuse-staging-staging-app-1:/app` → `docker exec -w /app ... node x.mjs`（读 `/app/.env.local`）。
- ⚠️ **踩坑**：构造超长字符串**别用 `Array.from(s).length` 判长度**（对多 MB 串是 O(n²)、node 卡 99% CPU 卡死）→ 用 `s.length`（BMP 中文 length==字数）。
- ⚠️ 语言模型上下文单位是 **token**；实测**重复中文 ≈ 1 字 = 1 token**（错误信息里 `requested about N tokens` 反推），故"字数 ≈ token 数"。

**实测结果（完整表导出到桌面 `模型提示词字数上限.md`）**：
| 模型 | 实测真实上限 |
|---|---|
| 对话模型（全部） | 最低 GPT-4o≈12.8万字，其余 16万~105万字（Seed2.0Lite 26万 / DeepSeek R1 16万 / DeepSeek V4 Pro·Gemini·GPT5.x 105万；Seed2.0Pro 30万~60万之间）|
| Seedream 4.5 / 5.0 Lite / 5.0 Pro | ≥2万字（都真出图）|
| GPT-5.4 Image 2 | **正好 32000**（40039 被拒，错误原文写明）|
| Gemini 3.1 Flash / 3 Pro Image | ≥10万字 |
| Seedance 2.0 系 / 2.5（BytePlus） | ≥8000 / ≥30000（都真出片）|
| Kling v3.0 Std/Pro/O1 | **2500 硬上限**（⚠️ 官方文档写 3072 是错的，8000 字任务秒失败 `size must be between 0 and 2500`）|
| MiniMax H3（海螺）| **7000**（15040 被拒 `> 7000 characters`）|
| Veo 3.1 | ≥20000（真出片）|

### 二、按用户填的产品值改「默认字数限制」（v96 的代码改动）

用户在桌面 md 第三列填好后，改**唯一权威** `src/lib/prompt-length.ts` 的 `MODEL_DEFAULT_PROMPT_MAX_LENGTH`：
- 对话（key `chat`）**20000**；Seedream 三个 **5000**；GPT-5.4 Image 2（两个 id）+ Gemini 两个图片 **8000**；
  Seedance 2.0 系 **4000** / 2.5 **15000**；H3 **4000**；Veo 3.1 **4000**；Kling 三个 **2000**（注释钉住"上游硬上限 2500 别超"）。
- ⭐ **配 key 的依据**（`getPromptLengthOverrideKey`）：agent/general→`chat`；BytePlus Seedance 2.0 系→`SEEDANCE_20_FAMILY_MODEL_ID`；
  其余→模型 id。⭐ **OpenRouter 通道的 `bytedance/seedance-2.0`/`-fast` 不属于 BytePlus 2.0 系**（`isBytePlusVideoModel` 只认 `byteplus:video.*`），
  所以单独各配了一条 4000，否则会漏。图片模型每个 id 各一条（含 BytePlus 的 `byteplus:conversation-image.*` 和 OpenRouter 的 `bytedance-seed/seedream-4.5`）。
- ⛔ 这只改**默认值**，后台 `PROMPT_LENGTH_OVERRIDES` override 仍优先。`DEFAULT_PROMPT_MAX_LENGTH`(全局兜底 2000) 保持不变。

**部署**（用户要求本地/测试服/正式服都做、不用测试）：bump v95→v96 → 打 2 文件 tgz → 测试服解包 build + `sync-ali-test.sh` →
正式服 `rsync staging→prod`（不 bump）+ build + `docker cp .next/static` 到阿里正式镜像（chunk 26=26）→ 三方 md5 一致 → 四域名 200、health=v96 → commit `815650e` push。

### 三、⭐⭐ 补上被漏掉的「版本提示」最后一步（用户追问"为什么前端没跳版本提示"）

- **根因**：前端"发现新版本"提示由 `/api/*` 响应头 `x-app-version` 触发（`src/proxy.ts` 写，读环境变量 `PUBLISHED_APP_VERSION`），
  **服务端版本比前端 bundle 新才弹**。我部署时把代码升到 v96，但**漏了最后一步**：两服 compose 的
  `PUBLISHED_APP_VERSION` 还停在 **v95**（在 `/opt/flashmuse/.env` 和 `/opt/flashmuse-staging/.env`，⛔ 不是 `data/.env.local`，
  是 compose 用 `${PUBLISHED_APP_VERSION:-}` 注入）→ 头报 v95 ≤ 前端 v96 → 不弹。
- ⚠️ 顺带澄清：`x-app-version` **只加在 `/api/*` 上**，curl 根域名/页面路由看不到头是正常的（我一度以为是"没生效"）。
- **修复**：`sed -i` 把两服 `.env` 的 `PUBLISHED_APP_VERSION` 改成 v1.0.0.96 → `docker compose up -d --force-recreate <app>`（只重建容器、不 build，十几秒）。
  验证正式服 `curl -sI https://main.venusface.com/api/model-availability` → `x-app-version: v1.0.0.96` ✅。
- ⭐⭐ **写死的教训（下次部署必做）**：部署最后一步 = 改 `/opt/flashmuse*/.env` 的 `PUBLISHED_APP_VERSION` 为新版号 + `force-recreate`，
  否则前端永远不弹版本提示。这次是我漏了、被用户发现。

### 留痕（本次测试花的钱，⛔ 别当用户数据）

- 走 OpenRouter/BytePlus **余额**（不走用户积分）：Veo 3.1 一条 4 秒视频、Seedance 2.0 三条、2.5 一条、
  Seedream 三个模型各一张图（5.0 Pro 因脚本改错多跑一张）、Gemini 图片 2 张、Seed 2.0 Pro 一次 30 万 token 输入。合计约几美元。
- 可灵 3 个任务是"创建后秒失败"（免费）；所有语言模型/GPT 图片超限都是 400 免费。
- ⛔ 全程没在前台界面做过生成、没花用户积分、零删用户数据；服务器/本地所有临时脚本已清理。
- ⚠️ 桌面留了 `模型提示词字数上限.md`（有用，别删）+ 一个乱码的 `模型提示词字数上限.csv`（用户可删）。

---

## 第六十一次会话（2026-08-09）：修掉「公告『新增』显示成『新建』」+ M040 幂等测试 + 清死常量 → **两服上线 `v1.0.0.95`，四方同步**

> | | 版本 / 状态 |
> |---|---|
> | 本地 = 测试服 = **正式服** = GitHub | **`v1.0.0.95`**，commit `6bf62bb`|
>
> ⭐ 用户指令链：「看完交接文档告诉我做到哪了」→「测试服复现了公告改字，你去查原因」→「改吧」→
> 「2 是个啥问题？我的理解是用户用什么文字打显示出来就是什么文字」→「A 吧（记备忘）+ 把好做的备忘拿出来」→
> 「🟢 那三条能一起修掉吗？能就一起修然后部署测试服」→「推到正式服上去」。

### 一、⭐⭐⭐ 主线 bug：顶部公告「新增」被显示成「新建」——根因**不是缓存**，是简繁转换改字

**现象**：用户在**测试服第一次**发那条 Seedance 2.5 公告，前端显示「**新建**【视频编辑】」而后台写的是「**新增**」。

#### 我的第一轮判断是错的（要记住这个教训）

我先按 `AGENTS.md` 那条「用户报刷新就变、先 `curl -sI` 数响应头」的铁律去查，结论是
「**用户链路上的透明代理里还存着 no-store 修复上线之前缓存的旧副本**」。
🗣️ 用户一句话直接问倒：「**问题我测试服里是第一次发这条公告。。哪来的缓存？**」
→ **这个反问是决定性的**：缓存假说要求"以前存过这条内容"，而这是首次发布，假说自相矛盾。

⭐⭐ **教训（已可升为通用判据）**：**上一次事故的根因，会让人对下一次相似现象产生强烈的路径依赖。**
"现象相似"绝不等于"根因相同"。用户拿**业务事实**（第一次发）推翻我的技术推理时，**他往往是对的**，
要立刻回到证据、别急着为自己的假说找补。（同源于文件里那条「用户的物理常识往往比我的代码推理更硬」。）

#### 真正的根因（已坐实）

`src/lib/chat/chat-workbench-core.tsx` 的全局简繁转换：

1. `globalTraditionalPhrases`（简→繁）里有一条 **`["新建", "新增"]`** —— 这是对的，繁体/台湾习惯用「新增」表示「新建」；
2. 但 `globalSimplifiedPhrases`（繁→简）是把上面那张表 **`.map(([f,t]) => [t,f])` 机械反转**得来的
   → 于是多出一条 **`["新增" → "新建"]`**；
3. 而 `applyLanguageToTextNode` 的**非繁体分支**（= 默认的简体中文）对**每一个文本节点**都跑
   `convertTraditionalToSimplified` → **页面上任何「新增」都被静默改成「新建」**。

⭐ **确定性证据（node 实跑那两行核心逻辑）**：
`😍新增【视频编辑】和【视频延长】两个功能！` → `😍新建【视频编辑】和【视频延长】两个功能！`

⭐ **为什么"刷新有时新有时旧、过几秒又变回旧"**：公告是**异步 fetch 回来再插进 DOM** 的，
而简体模式下那次转换遍历是**一次性的**（`applyDocumentLanguage` 在简体分支**不装 MutationObserver**）→
遍历跑的时候公告还没到就逃过一劫、已经在 DOM 里就被改字，**先后顺序不固定 = 竞态**。

⭐ **排查过程中逐项排除掉的（留档，别重查）**：
`/api/announcement`、`/api/auth/me`、`/workspace` 三者**都带 no-store**（两服都验过）；
数据库与接口返回的正文**都是正确的「新增」**；**没有 Service Worker / PWA 缓存**（全仓 grep 零命中）；
公告**不是**服务端渲染进 HTML 的（`AnnouncementBanner` 是纯客户端 fetch）；
`/api/auth/me` 里那个 `announcementCache` 只有 **5 秒** TTL，解释不了 10 小时旧数据。

#### 修法（用户拍板"改吧"后动手）

**核心口径：简体中文是本项目的源语言，切到/停留在简体时绝不做任何"繁→简"字词替换。**

- `applyLanguageToTextNode` / `applyLanguageToElementAttributes` 的简体分支改成
  **只还原"我们自己存下来的原文"**（`originalTextNodeValues` / `originalAttributeValues`）；
  **没存过 = 我们从没转过它 = 它本来就是简体 → 原样不动（直接 return / continue）**。
- **删掉**有损的 `convertTraditionalToSimplified` + `globalSimplifiedPhrases` + `globalSimplifiedChars`，
  原地留 ⛔ 注释钉住原因（⛔ 谁都别再加回一个反向转换函数）。
- **简→繁方向一个字未动。**

⭐ **为什么这样是对的**：繁体模式下每个被转换的节点都会把**原始简体文本存进 WeakMap**
（包括 MutationObserver 动态新增的节点）→ 切回简体时**那份原文才是权威还原来源**，
压根不需要、也不该拿一张有损的反向词表去"猜"。

### 二、⭐⭐ 验证：设计了一个**确定性判据**替代原来那个碰运气的竞态

⛔ 直接刷页面看公告**不算强证据** —— 旧代码也可能因竞态碰巧显示正确。

⭐⭐ **确定性判据 = 切繁体 → 再切回简体**（旧代码走这条路**必定**出错，因为还原时一定会跑那个有损函数）：

| 步骤 | 公告「新增」 | 公告「新建」 | 「视频」 | 「影片」 |
|---|---|---|---|---|
| ① 简体基线 | ✅ 有 | 无 | ✅ | 无 |
| ② 切繁体 | ✅ 有 | 无 | 无 | ✅（正常繁体化）|
| ③ **切回简体（决定性）** | ✅ **有** | **无** | ✅ **完整还原** | 无 |

**两服（测试服 + 正式服）都跑了这三步，全过。**

⭐ **顺带一个漂亮的旁证**：侧边栏「**新建**工作流 / 新建对话」是**我们自己的界面文案**，
它**保持不动**；公告里用户写的「新增」也**不动** → **该动的没动、不该动的也没动**，正是修复目标。
（正式服全页面「新建」只出现 1 次 = 那个按钮。）

⭐ 补充压力测试（测试服）：连刷 6 次 + 单页 1~8 秒逐秒采样 → 横幅稳定 231 字、
「新增」恒在、「新建」**一次都没出现过**。

### 三、搭车做掉的三条「零成本」备忘（用户问"🟢 那三条能一起修掉吗"）

#### ✅ M040 完成：把「红字文案映射幂等」固化成自动化用例

成品 = **`tests/error-message-idempotency.test.ts`（56 用例，`npm test` 从 15 → 71 全过）**。

⭐⭐ **关键设计决定（以后改这个测试先看这条）**：**故意不 import 任何内部文案常量**
（`buildModelRefusedMessage` / `PROVIDER_INSUFFICIENT_CREDITS_MESSAGE` 这些本来就没导出，
**也不要为了测试去导出**）。测的是**不变量** `f(x) === f(f(x)) === f(f(f(x)))`，不是"某句话长什么样"
→ 以后改措辞不用改测试，而措辞改坏了幂等仍然会被抓住。

覆盖：**45 条真实上游原文**各连跑 3 遍（原文全部来自 `error-message.ts` 注释与线上诊断日志）；
`(B_xxx)` 前缀不丢且仍幂等；**9 条反向用例** ——
英文必须被映射／**B_123 回归**（参考视频没过审 ⛔ 不许出现"拒绝出图/拒绝原因"）／
图片·视频·**音频**三类各自对应（audio 历史上漏写过）／**句中假冒**不许被当成成品放过／
**近似句**（「参考视频**通过了**版权检测」）不许被误判／成品被拒不许错怪参考素材／
限流不许说成余额不足／"我们没配密钥"不许说成"密钥已过期"。

⭐ **顺带固化了一个我原以为存在、实测不存在的边界**：末尾「中文透传 + 超长截断」那一路**是幂等的** ——
`slice(0,180) + "..."` = 183 字，第二遍再截 180 正好把 `...` 削掉又加回来，数学上自洽。
已加 **176~200 逐长度扫描** → **改 `maxLength` 或省略号写法的人会被这条挡住**。

**结果：56/56 全过，一条 BREAK 都没有** → 现有那道白名单幂等保护是对的，⛔ 没有改任何行为。

#### ✅ 删掉死常量 `MAX_DRAFT_INPUT_LENGTH`

先 grep 确认**零真实引用**（只有定义 + 一句注释），删掉并在原位留注释说明"为什么删、要上限用什么"。
⛔ 它是个真陷阱：下一个人很可能拿它去 `slice(0, 2000)`，**那会破坏「超字数不删字」这条已拍板口径**。
⭐ 要上限用 `getPromptMaxLength()`；要安全网用 `PROMPT_MAX_LENGTH_CEILING`（99999）。

#### ✅ M011 关闭：实测**根本不用做**

只读勘察两台 `.env.local`（⛔ **一个值都没打印**，env 里全是密钥/数据库口令）：
正式 48 行 / 39 个有效赋值、测试 53 行 / 42 个 —— **重复 key 数量都是 0**，`DATABASE_URL` 各恰好 1 行。
⭐ 判据留档（几秒、零风险）：
`sudo grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' <env> | tr -d ' ' | sed 's/=$//' | sort | uniq -c | awk '$1>1'`

### 四、⭐⭐ 新备忘 M041：简繁转换**分不清「界面标签」和「用户自己的内容」**（用户拍板先记不做）

🗣️ 用户看完"问题 2"后一句话点出了个**更大的问题**：「**我的理解是，用户用什么文字打，显示出来就是什么文字。为什么会互相影响？**」

我去查证了，**他是对的，这条原则现在对繁体用户是被违反的**：

- **问题 A（较严重）**：`applyDocumentLanguage` 是**把整个 `document.body` 的文字统统查找替换一遍**，
  排除名单只有 `script, style, noscript, textarea, input, [contenteditable="true"], [data-no-translate="true"]`，
  而 `data-no-translate` 全项目**只用在少数 toast 提示上**（grep 只有 3 处）→ **用户内容一个都没被保护**。
  已确认两处：**发出去的聊天消息**（打字时在 contenteditable 里安全，一发出去变普通文本节点就被转）、
  **上传文档的预览正文**（`chat-workbench-core.tsx:6809` 那个 `<pre>`，整篇被查找替换）；
  同理还有顶部公告（管理员打的内容）、提示词、素材名。
  → 繁体用户打「新建视频」发出去会**变成「新增影片」**。
- **问题 B（较轻）**：繁体分支在节点**已存过原文**时，拿的是**旧原文**重新转换写回，
  而不是刚变出来的新内容 → `characterData` 变化（积分刷新、AI 回复流式逐字冒出）会被**旧内容覆盖**，看起来像卡住。

**用户选了方案 A：只记备忘、这次不做**（理由：繁体用户目前极少，先把影响所有用户的公告 bug 收工上线）。
⭐ 修 A 的判据一句话：**这段文字是"我们写的界面文案"还是"用户/管理员打进去的内容"**，后者一律标 `data-no-translate`
（`closest()` 语义 → 标在**外层容器**上即可覆盖整棵子树）。
⚠️ 修 B 别低估：要想清楚"怎么区分『内容真的变了』和『我们自己刚写进去的繁体文字』"，否则会自己转自己、无限循环。

### 五、部署（测试服 → 正式服，全程照 `03` 的流程）

**测试服 v95**：bump → 打改动源码 tgz → `up -d --build`（约 3 分钟）→ `sync-ali.sh --stack=staging --with-generated`
（两端已一致、需传 0 个）→ `PUBLISHED_APP_VERSION=v1.0.0.95` + `force-recreate` → 验证 + 真走界面 + 巡检 6 项。

**正式服 v95**：
① **备份** `/opt/flashmuse/app-backups/20260809-232055-presync-v1.0.0.94`（⭐ 要回滚用这个，已核对备份里是旧版 v94）；
② 测试服→正式服 `rsync` 整份对齐（**不再 bump**）→ 版本变 v95、新测试文件带过来、迁移数仍 41；
③ `up -d --build flashmuse-app` → `/api/health` = `v1.0.0.95`、`No pending migrations`；
④ **同步 `.next/static` 到阿里【正式】镜像 `flashmuse-static`** → **42 = 42 文件数一致**；
⑤ `PUBLISHED_APP_VERSION=v1.0.0.95`（先删同名行再追加，改完**恰好 1 行**）+ `force-recreate`；
⑥ 健康检查：四域名全 200；`/api/announcement`+`/api/auth/me` **带 no-store**、`/api/media-thumbnail` **没被加**（白名单正常）；
   **静态 chunk 抽查 8/8 全 200**（main 与 static 两端）→ 无白屏风险；
⑦ **上号巡检 6 项全过**：登录 / 对话模式 / 工作流点节点不崩 / 资产库 / **真跑生图成功** / 后台 `/admin`，**console 全程 0 error**；
⑧ commit `6bf62bb` + push → **四方同步**。

⭐ **同步硬判据（不看版本号，看内容）**：测试服与正式服 `src/` 逐文件 md5 **完全相等**
（194 文件、`3517c5e1f162d744c638798db1f7dfcd`）；本次改的 4 个文件**本地与正式服逐字节相等**。

### 六、⭐ 本次踩到 / 澄清的坑（下次直接省时间）

1. ⭐⭐ **生产构建会压缩局部函数名** → 拿**函数名**去 `grep` `.next` 产物**验不了改动**。
   我查 `convertTraditionalToSimplified`（应为 0）、`MAX_DRAFT_INPUT_LENGTH`（应为 0）、
   `convertSimplifiedToTraditional`（**本该 >0**）→ **三个全是 0**，说明这个判据对局部函数无效、不是部署失败。
   ⭐ 只有**字符串字面量**能扛过压缩；本次改动没新增字面量 → **必须走界面验**。
   （这条是对 `AGENTS.md` 里「grep 构建产物」那条铁律的**重要限定**。）
2. ⭐ **`curl` 抓 HTML 必须加 `--compressed`**：响应是 gzip 的，不加就是在 grep 二进制 →
   我一度以为"首页里一条 `/_next/static` 都没有"，差点误判静态引用有问题。
3. ⭐ **PowerShell 的 `> file` 重定向写 UTF-16LE**（`AGENTS.md` 已有此坑，本次又踩）：
   `git diff > .runtime/d.txt` 后用 node 读是乱码、正则全不匹配 → 差点误判"只改了 3 处"。
   ⭐ 正解：`execSync('git diff ...').toString('utf8')` 在 node 里直接取。
4. ⭐ **PowerShell 不支持 heredoc**（`git commit -F - <<'EOF'` 直接语法报错）→
   含中文的提交信息**用 write 工具写成文件**再 `git commit -F <file>`（⛔ 禁止用 PowerShell 写中文文件）。
5. ⭐ **ssh 内联多条命令会被 PowerShell 吃坏**（`for d in ...; do ... done`、含 `%{http_code}` 的 curl 全中招）
   → 一律写 `.sh` + `scp` + `sed -i 's/\r$//'` + `bash`。
6. ⭐ **本地与服务器比 md5 别归一化行尾**：`chat-workbench-core.tsx`(6892) 和 `chat-workbench.tsx`(11015)
   在工作副本里**本来就是 CRLF**，tgz 是原样打包的 → **原始字节**才应相等；我先归一化反而造出假差异。
7. ⭐ **判"成品图出来了"别只数 `img`**：`/generated/user_avatar/...`（用户头像）会被算进去 →
   我一度以为"5 秒就出图"。判据要**排除 `user_avatar`**。
8. ⚠️ **`applyDocumentLanguage` 在简体分支不返回清理函数、也不装 MutationObserver**（只在繁体装）——
   这就是那个竞态的机制来源，改这块前要知道。

### 七、测试留痕（⛔ 别当成用户数据）

- **正式服**：新对话「v95巡检：一只棕色小狗趴在地毯上，暖光，写实风格」（1 张图，测试号 `ID_636611`）。
- **测试服**：新对话「v95巡检：一只黑色小猫蹲在木凳上，侧光，写实风格」（1 张图，`ID_535317`）；
  期间切过繁体→已切回简体。
- ⛔ **正式服公告一个字都没动**（禁测铁律）；后台只登录看页面，没改任何配置。

