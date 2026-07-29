// 失败原因「归档」脚本：把**根因已经查清并修掉**的失败事件打上 resolvedAt + resolvedNote。
//
// 归档效果（后台 → 运营概览 → 失败原因）：
//   · 未归档的仍然正常计数（这才是还要继续排查的量）
//   · 已归档的挪到下面「已排查并修复」区，**文字保留但划掉**，随时可追溯
//   · 错误编号 B_xxx 计数器与归档无关，继续自增
//
// 归档判定不是看用户看到的那句话（"服务器繁忙"什么都看不出来），而是按 requestId
// 去 .runtime 的诊断日志里找**真实失败原文**，命中已修复的根因才归档。
//
// 用法（服务器进容器 /app 跑，本地在项目根目录跑）：
//   node scripts/archive-resolved-generation-failures.mjs              # 试跑，只统计不写
//   node scripts/archive-resolved-generation-failures.mjs --apply      # 真正写库
//   node scripts/archive-resolved-generation-failures.mjs --undo       # 取消归档（清空 resolvedAt/Note）
//   node scripts/archive-resolved-generation-failures.mjs --reset-all  # ⭐ 整轮清零（见下）
//
// ⭐⭐ `--reset-all`（2026-07-29 用户拍板新增）＝「整轮清零、开新一轮」：
//   把**当前所有**待排查失败事件一次性归档掉（不看 RESOLVED_RULES、不看全局护栏），
//   让后台「待排查」归 0，从此刻起只看**新长出来**的红字。
//   配套动作：把 `.runtime/error-code-counter.txt` 写回 0，让 B_xxx 重新从 B_1 开始数。
//   ⛔ 与常规按规则归档是**两回事**，别混用：日常排查仍走 RESOLVED_RULES（逐个根因查清才归档）。
//   ⛔ 只在用户明确说"全部归档 / 清零 / 重新开始一轮"时才跑。

import { existsSync, createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");
const resetAll = process.argv.includes("--reset-all");

/** B_xxx 错误编号计数器文件（与 src/lib/error-code.ts 的 ERROR_COUNTER_PATH 必须一致）。 */
const ERROR_COUNTER_PATH = join(process.cwd(), ".runtime", "error-code-counter.txt");

/**
 * ⭐⭐ 整轮清零：把当前所有待排查失败事件一次性归档 + B_xxx 计数器归 0。
 * 说明写进 resolvedNote，后台里这些原因文字仍保留（划掉），随时可追溯。
 */
async function runResetAll(note) {
  const pending = await prisma.generationEvent.count({ where: { status: "failed", failureReason: { not: null }, resolvedAt: null } });
  const counterBefore = await import("node:fs/promises")
    .then((fs) => fs.readFile(ERROR_COUNTER_PATH, "utf8"))
    .then((text) => text.trim())
    .catch(() => "(计数器文件不存在)");
  if (!apply) {
    console.log(JSON.stringify({ mode: "reset-all-dry-run", willArchive: pending, errorCodeCounterNow: counterBefore, willResetCounterTo: 0, note }, null, 2));
    console.log("\n（试跑，未写库、未动计数器。加 --apply 才真正执行。）");
    return;
  }
  const now = new Date();
  const result = await prisma.generationEvent.updateMany({
    where: { status: "failed", failureReason: { not: null }, resolvedAt: null },
    data: { resolvedAt: now, resolvedNote: note },
  });
  await mkdir(dirname(ERROR_COUNTER_PATH), { recursive: true });
  await writeFile(ERROR_COUNTER_PATH, "0");
  const remaining = await prisma.generationEvent.count({ where: { status: "failed", failureReason: { not: null }, resolvedAt: null } });
  console.log(JSON.stringify({ mode: "reset-all-apply", archived: result.count, errorCodeCounterBefore: counterBefore, errorCodeCounterAfter: "0", remainingPending: remaining, note }, null, 2));
}

/** 整轮清零写进 resolvedNote 的说明（改这句等于改历史记录里的追溯文字，慎改）。 */
const RESET_ALL_NOTE =
  "2026-07-29 v1.0.0.54 部署后按用户要求【整轮清零】：此前累积的全部历史失败事件一次性归档，红字排查从 v1.0.0.54 上线时刻起重新开始一轮（B_xxx 错误编号同时重置为从 B_1 开始）。归档不代表每条根因都已修好，只代表「这批历史数据不再计入待排查」；文字全部保留可追溯。";

const LOG_FILES = [".runtime/generation-diagnostics-log.jsonl", ".runtime/video-diagnostics-log.jsonl"];

/**
 * 已修复根因清单（唯一权威）。新处理好一类就往这里加一条，然后重跑本脚本。
 * match 命中的是诊断日志里的失败原文（error / upstream / extra 拼起来的文本）。
 *
 * ⭐ 归档判定标准（2026-07-28 用户澄清）：归档的对象本质是「服务器繁忙」这个**兜底桶**——
 * 所有没被明确识别的错误都落进它，所以它不是一个原因，而是一堆无关根因的混合体。
 * 只问一句：**这个根因还落在兜底桶里吗？**
 *   ① 修好了 → 归档
 *   ② 没修但已映射成明确文案（不再落进兜底桶）→ 归档
 *   ③ 还没查清 / 修不了、仍落在桶里 → 不归档，留着亮
 *   ④ 映射出去后新形成的那条明确原因本身 → 不归档（修不了就该一直亮着）
 */
/**
 * ⭐ 部分规则要带日期下限（`before`）。见铁律 ④：
 * 「某个根因被从兜底桶里映射成明确文案」之后**新发生**的那条明确原因本身**不归档**（修不了就该一直亮着）。
 * 所以这类规则只归档"映射上线之前"的历史事件，上线之后新长出来的必须留着亮。
 * ⚠️ 没有 before 的规则 = 根因真的被修掉了、此后零复发，不需要日期下限。
 */
function ruleAllowsEvents(rule, events) {
  if (!rule.before) return true;
  return events.every((event) => event.createdAt < rule.before);
}

/**
 * ⭐⭐ 全局护栏：failureReason 命中这里任意一条的事件，**任何规则都不许归档**（2026-07-29 新增）。
 *
 * 为什么需要（当天差点误吃 6 条）：规则匹配的 haystack 是「诊断日志原文 + failureReason」拼起来的，
 * 于是一条按**日志特征**写的规则会连带吃掉 failureReason 已经是「新文案 / 另一个未修根因」的事件：
 *   · `gpt-image-empty-result-legacy-form`（match `图片平台没有返回图片：`）差点吃掉 4 条
 *     failureReason 已是 v53 统一文案「模型因色情/暴力/隐私安全等原因拒绝出图」的事件
 *     —— 那层 `图片平台没有返回图片：` 只是我们内部的包壳，还留在日志里。按铁律④这类该一直亮着。
 *   · `approved-card-not-reused`（靠"走了送审复用、没新建素材"的事件序列特征）差点吃掉 2 条
 *     failureReason 是「参考素材不是可审核的公网地址。」的事件 —— 那是**还没修**的另一个根因。
 *
 * ⭐ 用 failureReason 语义判定比给每条规则配 before 日期更准（不受部署时刻/时区影响）。
 * ⛔ 某条根因**真的修好之后**，才可以把它从这里删掉、并写一条带说明的归档规则。
 */
const NEVER_ARCHIVE_REASON_PATTERNS = [
  // 铁律④：模型拒绝出图（含 v52 及以前的历史措辞）—— 我们修不了，就该一直亮着。
  /模型因色情\/暴力\/隐私安全等原因拒绝出图/,
  /模型拒绝了本次生成请求/,
  /生成结果可能涉及版权限制/,
  // 我们自己的 bug，2026-07-29 仍在发生、尚未修（某个参考素材解析不出公网直链就放弃送审）。
  /参考素材不是可审核的公网地址/,
];

function isNeverArchiveEvent(event) {
  const reason = event.failureReason ?? "";
  return NEVER_ARCHIVE_REASON_PATTERNS.some((pattern) => pattern.test(reason));
}


const RESOLVED_RULES = [
  {
    key: "reference-image-size",
    // ⚠️ 同一个根因（参考图宽/高 < 300px）上游有**两种措辞**，都要认：
    //   · 素材送审阶段：`Height must be between 300px and 6000px.`（正式服 82 条）
    //   · 建任务阶段：  `expected the height to be at least 300px, but received a 338x194px image instead`（正式服 109 条）
    match: /(?:height|width) must be between \d+px and \d+px|aspect ratio must be between|expected the (?:height|width) to be (?:at least|at most|between)\s*\d+px/i,
    note: "参考图尺寸/比例不合规（宽高 300–6000px、比例 0.4–2.5）→ v1.0.0.47 已在发送前拦截并直接提示原因（对话流/工作流/服务端三处共用规则）",
  },
  {
    key: "stale-asset-card",
    match: /specified asset\s+\S+\s+is not found|asset\s+asset-[\w-]+\s+is not found/i,
    note: "审核凭证在平台侧失效 → v1.0.0.47 自动清理死凭证并重新送审",
  },
  {
    key: "approved-card-not-reused",
    match: /__NEVER_MATCH__/, // 占位：该类无独立原文特征，由下面 reuse-only 逻辑单独判定
    note: "已过审素材没被复用就放弃重试（!triggered bug）→ v1.0.0.47 已修",
  },
  {
    key: "provider-insufficient-credits",
    match: /insufficient credits|insufficient_quota|insufficient balance|requires more credits|exceeded your current quota|"(?:status|statusCode|code)":\s*402\b/i,
    // ⭐ 日期下限 = v1.0.0.47 上正式服的时刻（备份目录 20260728-021857，UTC+8）。
    //   在那之前的落在兜底桶里 → 归档；之后新发生的已经是明确文案「提供商余额不足！请联系管理员充值。」，
    //   属于"运营真没钱"、我们修不了 → 按铁律 ④ **必须继续亮着**，绝不能被这条规则吃掉。
    //   （2026-07-29 踩到：不加下限时它又命中了 11 条上次归档之后的新事件。）
    before: new Date("2026-07-27T18:19:00Z"),
    note: "供应商账户余额不足（OpenRouter 402）→ v1.0.0.47 起已从「服务器繁忙」兜底桶拆出，单独提示「提供商余额不足！请联系管理员充值。」；根因属运营（真没钱），以后新发生的会以那条明确文案单独亮着、不再归档",
  },
  // ↓ 以下三条来自「当前模型不支持这组参数」54 条的排查（2026-07-28）：都是我们自己的 bug，且都已在
  //   各自最后一次发生**之后**修掉上线，此后零复发，所以归档。
  {
    key: "seedream-pro-sequential-param",
    match: /`?sequential_image_generation`? .*not (?:valid|supported)|sequential_image_generation` is not supported by the current model/i,
    note: "Seedream 5.0 Pro 不接受 sequential_image_generation 参数，我们在多参考图时仍发了 \"disabled\" → 2026-07-16 commit 08aa548 给该分支补上 supportsSequentialBatch 守卫后不再发送（最后一次失败 07-16 06:21，修复 07-16 18:03，此后零复发）",
  },
  {
    key: "reference-slot-not-an-image",
    match: /the specified asset is not an image/i,
    note: "非图片素材（音频/视频）被塞进参考图槽 → B_252，v1.0.0.34（2026-07-21 19:21）按 asset.kind 正确路由后修复（最后一次失败 07-21 07:45，此后零复发）",
  },
  {
    // ⭐ 与上面 reference-slot-not-an-image 是**同一个根因**，只是上游换了个说法：
    //   同样是音频 .bin 被当参考图发过去（正式服 4 条全是同一用户的「武松音色1.bin」，
    //   日志里 references 同时有 role:"reference_image" 和 role:"reference_audio" 两条同文件），
    //   BytePlus 这次回的是 InvalidParameter.UnsupportedImageFormat 而不是 asset is not an image。
    //   当时的归档规则只认后者，所以这 4 条被漏下了（2026-07-29 查清）。
    // ⛔⛔ **必须配 before**：这句上游原文以后还可能被**真正的格式问题**触发（例如有人把 gif 改名成
    //   .jpg 混过上传白名单）。没有 before 的话，以后每次跑归档都会把本该亮着的新事件偷偷抹掉。
    key: "audio-in-image-slot-unsupported-format",
    match: /the request failed because the image format is not supported by the api|InvalidParameter\.UnsupportedImageFormat/i,
    before: new Date("2026-07-21T11:21:00Z"),
    note: "同 reference-slot-not-an-image 的根因（音频 .bin 被塞进参考图槽），只是上游回的是 InvalidParameter.UnsupportedImageFormat：正式服 4 条日志里同一个「武松音色1.bin」同时以 reference_image 和 reference_audio 两种 role 发出去了。v1.0.0.34（2026-07-21 19:21）按库里真实 mediaType 剔除非图片素材后修复，4 条全部发生在修复之前（07-17～07-20）。另：v1.0.0.54 起图片上传白名单统一收敛成 jpg/jpeg/png/webp（唯一来源 IMAGE_UPLOAD_FORMATS，工作流拖拽也拦），且正式服库里活跃图片资产只有 jpg 5302 + png 57、零个 bmp/tiff/gif/heic 存量 → 三重保证不会再发生。⛔ 本规则带 before 日期下限，以后真正的格式问题不会被误归档",
  },
  {
    key: "reference-video-total-duration",
    match: /video total duration \(seconds\) specified in the request must be less than or equal to/i,
    note: "参考视频总时长超上限但前端没拦住（精度 Int 截断）→ B_232，v1.0.0.34（2026-07-21 19:21）durationSeconds Int→Float + 统一 validateReferenceTotalDuration 后修复（最后一次失败 07-21 05:57，此后零复发）",
  },
  {
    key: "platform-download-our-thumbnail-endpoint",
    match: /(?:Timeout while downloading|Error while downloading)[^"]*\/api\/media-thumbnail/i,
    note: "我们把「给人看的动态缩略图接口」(/api/media-thumbnail) 当成参考图地址发给平台，平台来拉时要我们现场生成缩略图 → 超时；地址前缀还是已退役的马来 IP。v1.0.0.48 新增唯一权威 normalizeReferenceAssetUrl()：参考素材进模型/送审前一律还原成文件静态直链（nginx 直出、不经 Node），并剥掉自家主机绝对前缀",
  },
  {
    key: "session-expired-recorded-as-failure",
    // 这类原文就在 failureReason 里（不是上游返回的），靠脚本"日志原文 + failureReason 一起匹配"命中。
    match: /请先登录后再使用模型/,
    note: "登录状态已失效（单会话被新登录顶掉 / 24h 过期）以前被当成生成失败记红字并返回 500 → 前端所有「未登录自动跳首页」的保护都只认 401、全部不触发 → 用户连点数次。v1.0.0.47 改为返回 401 且不再记 GenerationEvent，前端直接跳首页（按用户要求不给任何提示）",
  },
  {
    key: "kling-reference-image-pixel-invalid",
    match: /image pixel is invalid/i,
    note: "Kling（kwaivgi）参考图尺寸不合规，上游只回一句 `Image pixel is invalid` 且是**异步**失败（任务先被收下、一两分钟后才 failed）→ 全落进「服务器繁忙」兜底桶。真因与 BytePlus 那 191 条完全相同（正式服实测某用户拿 338×191 的截图连续失败 32 次），而 v47 的发送前尺寸拦截被写死「只对 BytePlus 生效」→ Kling 路径裸奔。v1.0.0.49 起改由 videoModelEnforcesReferenceImageSizeRules() 统一判定（BytePlus Seedance + Kling 共用 300–6000px / 0.4–2.5），三处咽喉全部接入，并给 `Image pixel is invalid` 加了明确文案 + 列为永久错误不再白重试",
  },
  {
    key: "veo-r2v-duration",
    match: /unsupported output video duration/i,
    note: "google/veo-3.1 纯文生视频支持 4/6/8 秒，但**带参考图**（reference_to_video）只允许 8 秒，我们的时长表没有这个维度 → 任务被收下后异步失败、落进「服务器繁忙」。v1.0.0.49 新增唯一权威 models.ts 的 VIDEO_REFERENCE_DURATION_LIMITS + validateVideoDurationWithReferences()，对话流/工作流/服务端三处发送前拦截并明确提示（故意不静默改成 8 秒——时长直接决定计费）",
  },
  {
    key: "gpt-image-empty-result-legacy-form",
    // ⚠️ 只认**全角冒号**那一种：`图片平台没有返回图片：<可变尾巴>`。
    //   这正是后台归一化成「图片平台没有返回图片（模型未产出或拒绝生成）」那 101 条的形态特征
    //   （见 admin-failure-triage.ts 的 FAILURE_REASON_SQL）。
    //   ⛔ 绝不能放宽成 `图片平台没有返回图片` 裸串 —— 那会连带吃掉
    //   `图片平台没有返回图片，且没有返回可用原因。`（落兜底桶、根因另说）和
    //   `图片平台没有返回图片，模型只回了一段文字：`（v51 新形态），两者都不该在这里归档。
    match: /图片平台没有返回图片：/,
    note: "「图片平台没有返回图片：<可变尾巴>」的三种旧形态（92 条模型明文拒绝的 500 字小作文原样当红字 / 7 条模型把提示词复读回来导致红字变成用户自己的提示词 / 2 条 error code: 520 与空响应被伪装成「模型不肯画」）→ v1.0.0.51 起 openrouter.ts 把「没出图」彻底拆成三路分别抛出：平台报错→「图片生成失败：<原文>」（可自动重试）、模型拒绝→统一「模型因色情/暴力/隐私安全等原因拒绝出图 + 附模型原话」并给出 AI 改写重试入口（对话流/工作流/资产库三处共用 modelSupportsPromptSafetyRewrite 判定）、只回文字→「模型这次没有出图，只回了一段文字」。归档理由 = 这个旧形态本身已不复存在（新形成的「模型拒绝」按铁律不归档，会单独亮着）",
  },
  {
    key: "pre-diagnostics-log-unknowable",
    match: /__NEVER_MATCH__/, // 占位：靠下面的"日志启用前 + 无任何日志 + 落在兜底桶"特征判定
    note: "发生在诊断日志启用（2026-07-10，正式服迁腾讯云）之前、且落在兜底文案桶里：上游原文既不在 failureReason 里（被兜底文案覆盖）、也没有日志可查 → **永久不可追溯**，留着也无法排查。用户 2026-07-28 拍板归档，让「待排查」数字只代表还有希望查的",
  },
];

/**
 * ⭐ 诊断日志启用日期（正式服 2026-07-11 从马来迁到腾讯云，日志文件最早一行是 07-10T19:56）。
 * 早于这个日期的失败事件在日志里一行都查不到，如果 failureReason 又是兜底文案（原文被覆盖），
 * 就等于永久无解。
 */
const DIAGNOSTICS_LOG_START = new Date("2026-07-10T00:00:00Z");

/**
 * 两个兜底桶（都是"没识别出根因"的意思，从文案本身查不出任何东西）：
 * - `GENERIC_MEDIA_ERROR_MESSAGE` = 「服务器繁忙，请稍候再试.....」（显式传的）
 * - `toUserErrorMessage` 的默认 fallback = 「请求失败，请稍后再试。」（gpt-image 的 getOpenRouterError 走这个）
 * ⚠️ 同一个根因会因为调用处传不传 fallback 而落进不同的桶（余额不足就同时污染了两个）。
 */
const GENERIC_FALLBACK_PATTERN = /服务器繁忙，请稍候再试|请求失败，请稍后再试/;

function textOf(entry) {
  const parts = [];
  if (entry.error) parts.push(typeof entry.error === "string" ? entry.error : JSON.stringify(entry.error));
  if (entry.upstream) parts.push(typeof entry.upstream === "string" ? entry.upstream : JSON.stringify(entry.upstream));
  if (entry.extra) parts.push(JSON.stringify(entry.extra));
  return parts.join(" ");
}

async function main() {
  if (resetAll) {
    await runResetAll(RESET_ALL_NOTE);
    return;
  }
  if (undo) {
    const result = apply
      ? await prisma.generationEvent.updateMany({ where: { resolvedAt: { not: null } }, data: { resolvedAt: null, resolvedNote: null } })
      : { count: await prisma.generationEvent.count({ where: { resolvedAt: { not: null } } }) };
    console.log(JSON.stringify({ mode: apply ? "undo-apply" : "undo-dry-run", affected: result.count }, null, 2));
    return;
  }

  const failures = await prisma.generationEvent.findMany({
    // ⚠️ 不再要求 requestId 非空：failureReason 里就带原文的那类（如参考图尺寸）没有日志也能归档。
    where: { status: "failed", failureReason: { not: null }, resolvedAt: null },
    select: { id: true, requestId: true, kind: true, model: true, failureReason: true, createdAt: true },
  });
  const byRequestId = new Map();
  for (const event of failures) {
    // 没有 requestId 的按自己单独成组（只能靠 failureReason 匹配）
    const key = event.requestId ?? `#id:${event.id}`;
    const list = byRequestId.get(key) ?? [];
    list.push(event);
    byRequestId.set(key, list);
  }
  if (byRequestId.size === 0) {
    console.log("没有待归档的失败事件。");
    return;
  }

  // 扫日志，按 requestId 收集失败原文
  const textByRequestId = new Map();
  const eventNamesByRequestId = new Map();
  // ⭐ 视频「异步轮询失败」专用索引：轮询日志行**没有 requestId**（只有 taskId），
  //   而且 v47 之前上游 error 一个字都没落盘（只记 `hasError: true` 布尔）→ 靠原文永远匹配不上。
  //   所以这里额外建 taskId → requestId 的桥（来自 create-success，它两个都有），
  //   再把"轮询到 failed 的 taskId"收进集合，交给下面按模型判定。
  const taskIdByRequestId = new Map();
  const pollFailedTaskIds = new Set();
  for (const file of LOG_FILES) {
    if (!existsSync(file)) { console.warn(`[skip] 找不到日志 ${file}`); continue; }
    const reader = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of reader) {
      if (!line.includes('"requestId"') && !line.includes('"taskId"')) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry.event === "video-provider-poll-success" && entry.taskId && entry.upstream?.hasError === true) {
        pollFailedTaskIds.add(String(entry.taskId));
      }
      if (!entry.requestId || !byRequestId.has(entry.requestId)) continue;
      if (entry.event === "video-provider-create-success" && entry.taskId) taskIdByRequestId.set(entry.requestId, String(entry.taskId));
      const text = textOf(entry);
      if (text) textByRequestId.set(entry.requestId, `${textByRequestId.get(entry.requestId) ?? ""} ${entry.event}: ${text}`);
      const names = eventNamesByRequestId.get(entry.requestId) ?? [];
      names.push(entry.event);
      eventNamesByRequestId.set(entry.requestId, names);
    }
  }

  const perRule = {};
  const idsByNote = new Map();
  // ⭐ dry-run 明细（2026-07-29 新增）：只给数字看不出"到底要吃掉哪些"。
  // 踩过的坑：haystack = 日志原文 + failureReason，所以一条按**日志**特征写的规则
  // 有可能吃掉 failureReason 已经是「新文案」的事件（按铁律④这类不该归档）。
  // 必须能在 --apply 之前逐条看一眼 failureReason 到底是什么。
  const samplesByRule = new Map();
  for (const [requestId, events] of byRequestId) {
    // ⭐⭐ 全局护栏最先判（见 NEVER_ARCHIVE_REASON_PATTERNS 上面的注释）：
    // 这些 failureReason 不管命中哪条规则都不许归档。
    if (events.some(isNeverArchiveEvent)) continue;

    const text = textByRequestId.get(requestId) ?? "";
    const names = eventNamesByRequestId.get(requestId) ?? [];
    // ⭐ 除了日志原文，failureReason 本身也参与匹配：有些错误没被"服务器繁忙"兜底覆盖，
    //    上游英文原文直接进了 failureReason（例：`expected the height to be at least 300px…` 109 条）。
    //    日志文件会轮转/被清，这时只有 DB 里这份原文能认出来。规则都是很具体的上游英文特征，不会误伤中文文案。
    const reasonText = events.map((event) => event.failureReason ?? "").join(" ");
    const haystack = `${text} ${reasonText}`;
    let rule = RESOLVED_RULES.find((candidate) => candidate.match.test(haystack) && ruleAllowsEvents(candidate, events));
    // 「已过审素材没被复用就放弃重试」的特征：走了自动送审、只复用了旧凭证、没有新建过素材，最后仍失败。
    if (!rule && names.includes("byteplus-auto-review-reuse-active-asset") && !names.some((name) => /auto-review-asset-created|auto-review-asset-active/.test(name))) {
      rule = RESOLVED_RULES.find((candidate) => candidate.key === "approved-card-not-reused");
    }
    // ⭐「永久不可追溯」：诊断日志启用（2026-07-10）之前 + 日志里一行都没有 + failureReason 是兜底文案
    //   （原文被兜底覆盖）→ 三个条件同时成立就等于永远查不出来，留着只会让人反复来查同一批查不动的。
    //   ⚠️ 三个条件必须同时满足，别放宽：只要日志里有原文、或 failureReason 里带原文，就还有希望，不能归到这里。
    if (!rule && text === "" && events.every((event) => event.createdAt < DIAGNOSTICS_LOG_START && GENERIC_FALLBACK_PATTERN.test(event.failureReason ?? ""))) {
      rule = RESOLVED_RULES.find((candidate) => candidate.key === "pre-diagnostics-log-unknowable");
    }
    // ⭐ 视频异步轮询失败（v47 前上游原文没落盘，匹配不上任何 match）：靠 taskId 认出来，再按模型定根因。
    //   依据不是猜的 —— 2026-07-28 拿这批 taskId 回查 OpenRouter（`GET /api/v1/videos/{id}` 事后仍可查），
    //   Kling 三个模型 32/32 全是 `Image pixel is invalid`，veo-3.1 那 1 条是 `Unsupported output video duration`。
    //   ⚠️ 只认这 4 个模型；BytePlus 那几条轮询失败上游任务无法事后回查 → 根因仍不明，不归档。
    if (!rule && pollFailedTaskIds.has(taskIdByRequestId.get(requestId) ?? "\u0000")) {
      const model = events.find((event) => event.model)?.model ?? "";
      if (/^kwaivgi\/kling-/.test(model)) rule = RESOLVED_RULES.find((candidate) => candidate.key === "kling-reference-image-pixel-invalid");
      else if (model === "google/veo-3.1") rule = RESOLVED_RULES.find((candidate) => candidate.key === "veo-r2v-duration");
    }
    if (!rule) continue;
    perRule[rule.key] = (perRule[rule.key] ?? 0) + events.length;
    const samples = samplesByRule.get(rule.key) ?? [];
    for (const event of events) {
      samples.push(`${event.createdAt.toISOString().slice(0, 16).replace("T", " ")} | ${event.model ?? "-"} | ${requestId.slice(0, 40)} | ${(event.failureReason ?? "").replace(/\s+/g, " ").slice(0, 90)}`);
    }
    samplesByRule.set(rule.key, samples);
    const ids = idsByNote.get(rule.note) ?? [];
    ids.push(...events.map((event) => event.id));
    idsByNote.set(rule.note, ids);
  }

  const total = Object.values(perRule).reduce((sum, value) => sum + value, 0);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    pendingFailureEvents: failures.length,
    requestsScanned: byRequestId.size,
    toArchive: total,
    byRule: perRule,
  }, null, 2));

  if (!apply) {
    // ⭐ 逐条列出要吃掉什么（含 failureReason 原文）—— apply 之前必须扫一眼，见上面注释。
    for (const [key, samples] of samplesByRule) {
      console.log(`\n### ${key}（${samples.length} 条）`);
      for (const sample of samples) console.log(`  ${sample}`);
    }
    console.log("\n（试跑，未写库。加 --apply 才真正归档。）");
    return;
  }
  const now = new Date();
  for (const [note, ids] of idsByNote) {
    const result = await prisma.generationEvent.updateMany({ where: { id: { in: ids } }, data: { resolvedAt: now, resolvedNote: note } });
    console.log(`归档 ${result.count} 条 → ${note}`);
  }
  const remaining = await prisma.generationEvent.count({ where: { status: "failed", failureReason: { not: null }, resolvedAt: null } });
  console.log(`\n剩余未归档失败事件：${remaining} 条`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
