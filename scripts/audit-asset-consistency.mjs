import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

// 只读摸底脚本：统计资产库入库信息的完整度与归类可疑项。绝不写库。
// 用法：
//   node scripts/audit-asset-consistency.mjs --all              # 全库汇总
//   node scripts/audit-asset-consistency.mjs --user=USER_ID     # 单用户汇总 + 样本
//   node scripts/audit-asset-consistency.mjs --user=USER_ID --samples=30

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const userId = process.argv.find((a) => a.startsWith("--user="))?.slice("--user=".length);
const all = process.argv.includes("--all");
const sampleLimit = Number(process.argv.find((a) => a.startsWith("--samples="))?.slice("--samples=".length) || 20);
if (!userId && !all) {
  console.error("Usage: node scripts/audit-asset-consistency.mjs --all | --user=USER_ID [--samples=30]");
  process.exit(1);
}

// 物理路径判断：这条 URL 在磁盘上是不是"上传"位置
function isUploadPath(url) {
  return /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(url) || /\/generated\/(?:users\/[^/]+\/)?files\//.test(url);
}

const prisma = new PrismaClient();

function newCounter() {
  return {
    total: 0,
    image: 0,
    video: 0,
    generated: 0,
    upload: 0,
    // 字段缺失（只对"生成"类判定参数缺失，上传类本无这些参数属正常）
    genMissingModel: 0,
    genMissingRatio: 0,
    genMissingResolution: 0,
    genMissingSize: 0, // 图片缺宽高
    genMissingSettings: 0, // 缺全量 generationSettings
    genMissingPreviewMeta: 0,
    videoMissingSize: 0,
    videoMissingDuration: 0,
    // 归类可疑
    mismatchGeneratedButUploadPath: 0, // promptSource=generated 但落在上传路径
    mismatchUploadButGenPath: 0, // promptSource=upload 但落在生成路径（"生成显示成上传"高危）
    sourceKindPromptMismatch: 0, // sourceKind 含 upload 与 promptSource 不一致
    // 命名
    missingSystemName: 0,
    missingInitialName: 0,
  };
}

function classifyRow(row, c, samples) {
  c.total += 1;
  const isVideo = row.mediaType === "video";
  if (isVideo) c.video += 1; else c.image += 1;
  const ps = row.promptSource || "";
  const sk = row.sourceKind || "";
  const uploadPath = isUploadPath(row.url);
  const isUpload = ps === "upload" || (!ps && sk.includes("upload"));
  if (isUpload) c.upload += 1; else c.generated += 1;

  const flags = [];
  if (!isUpload) {
    if (!row.model) { c.genMissingModel += 1; flags.push("no_model"); }
    if (!row.ratio) { c.genMissingRatio += 1; flags.push("no_ratio"); }
    if (!row.resolution && !row.imageSize) { c.genMissingResolution += 1; flags.push("no_resolution"); }
    if (row.generationSettings == null) { c.genMissingSettings += 1; flags.push("no_settings"); }
    if (row.previewMeta == null) { c.genMissingPreviewMeta += 1; flags.push("no_previewMeta"); }
    if (!isVideo && (!row.width || !row.height)) { c.genMissingSize += 1; flags.push("no_size"); }
    if (isVideo && (!row.width || !row.height)) { c.videoMissingSize += 1; flags.push("video_no_size"); }
    if (isVideo && !row.videoDuration && !row.durationSeconds) { c.videoMissingDuration += 1; flags.push("video_no_duration"); }
  }
  if (ps === "generated" && uploadPath) { c.mismatchGeneratedButUploadPath += 1; flags.push("gen_but_upload_path"); }
  if (ps === "upload" && !uploadPath) { c.mismatchUploadButGenPath += 1; flags.push("upload_but_gen_path"); }
  if (sk.includes("upload") !== (ps === "upload") && ps) { c.sourceKindPromptMismatch += 1; flags.push("sourcekind_prompt_mismatch"); }
  if (!row.systemName) { c.missingSystemName += 1; flags.push("no_systemName"); }
  if (!row.initialName) { c.missingInitialName += 1; flags.push("no_initialName"); }

  if (samples && flags.length && samples.list.length < samples.limit) {
    samples.list.push({ id: row.id, mediaType: row.mediaType, promptSource: ps, sourceKind: sk, name: row.userStates?.[0]?.currentName, category: row.userStates?.[0]?.currentCategory, flags, url: row.url.slice(0, 120) });
  }
}

const select = {
  id: true, mediaType: true, url: true, promptSource: true, sourceKind: true,
  model: true, ratio: true, resolution: true, imageSize: true, videoDuration: true,
  width: true, height: true, durationSeconds: true, generationSettings: true, previewMeta: true,
  systemName: true, initialName: true,
  userStates: { where: { hiddenAt: null, deletedAt: null }, select: { currentName: true, currentCategory: true } },
};

try {
  if (userId) {
    const rows = await prisma.mediaAsset.findMany({ where: { userId, archivedAt: null }, select });
    const c = newCounter();
    const samples = { list: [], limit: sampleLimit };
    for (const row of rows) classifyRow(row, c, samples);
    console.log(JSON.stringify({ userId, counts: c, samples: samples.list }, null, 2));
  } else {
    // 全库汇总（不带样本，按用户聚合可能很大，只出总计）
    const c = newCounter();
    let cursor = undefined;
    for (;;) {
      const rows = await prisma.mediaAsset.findMany({ where: { archivedAt: null }, select, take: 2000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" } });
      if (rows.length === 0) break;
      for (const row of rows) classifyRow(row, c, null);
      cursor = rows[rows.length - 1].id;
      if (rows.length < 2000) break;
    }
    console.log(JSON.stringify({ scope: "all-users", counts: c }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
