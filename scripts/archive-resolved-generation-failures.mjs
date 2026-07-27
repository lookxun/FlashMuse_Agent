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
//   node scripts/archive-resolved-generation-failures.mjs          # 试跑，只统计不写
//   node scripts/archive-resolved-generation-failures.mjs --apply  # 真正写库
//   node scripts/archive-resolved-generation-failures.mjs --undo   # 取消归档（清空 resolvedAt/Note）

import { existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");

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
    select: { id: true, requestId: true, kind: true, failureReason: true, createdAt: true },
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
  for (const file of LOG_FILES) {
    if (!existsSync(file)) { console.warn(`[skip] 找不到日志 ${file}`); continue; }
    const reader = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of reader) {
      if (!line.includes('"requestId"')) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (!entry.requestId || !byRequestId.has(entry.requestId)) continue;
      const text = textOf(entry);
      if (text) textByRequestId.set(entry.requestId, `${textByRequestId.get(entry.requestId) ?? ""} ${entry.event}: ${text}`);
      const names = eventNamesByRequestId.get(entry.requestId) ?? [];
      names.push(entry.event);
      eventNamesByRequestId.set(entry.requestId, names);
    }
  }

  const perRule = {};
  const idsByNote = new Map();
  for (const [requestId, events] of byRequestId) {
    const text = textByRequestId.get(requestId) ?? "";
    const names = eventNamesByRequestId.get(requestId) ?? [];
    // ⭐ 除了日志原文，failureReason 本身也参与匹配：有些错误没被"服务器繁忙"兜底覆盖，
    //    上游英文原文直接进了 failureReason（例：`expected the height to be at least 300px…` 109 条）。
    //    日志文件会轮转/被清，这时只有 DB 里这份原文能认出来。规则都是很具体的上游英文特征，不会误伤中文文案。
    const reasonText = events.map((event) => event.failureReason ?? "").join(" ");
    const haystack = `${text} ${reasonText}`;
    let rule = RESOLVED_RULES.find((candidate) => candidate.match.test(haystack));
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
    if (!rule) continue;
    perRule[rule.key] = (perRule[rule.key] ?? 0) + events.length;
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
