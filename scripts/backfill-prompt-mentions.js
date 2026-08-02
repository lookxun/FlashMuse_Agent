// 一次性回填：资产库生成图(角色/场景/道具/分镜)的 sourcePrompt 里 @名 与 job 实际参考图(referenceNames)对不上时，
// 把 @名按实际参考名改正，使 @名 与真实参考一一对应（预览 @名可正常变蓝）。只在 1:1(数量相等)时改，否则跳过并记录。
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const MENTION_RE = /@([^@\s，。！？；;、]+)/g;

function extractMentions(text) {
  const out = [];
  let m;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text || "")) !== null) out.push(m[1]);
  return out;
}

async function main() {
  // 2026-08-02：补上 --apply 保护（原来是 scripts/ 里唯一没有 dry-run 保护的改数据脚本，直接跑就改库）。
  const apply = process.argv.includes("--apply");
  if (!apply) console.log("[dry-run] 只统计、不改库。确认无误后加 --apply 真改。");
  const assets = await prisma.mediaAsset.findMany({
    where: { sourceKind: "asset_generation_image", requestId: { not: null } },
    select: { id: true, systemName: true, sourcePrompt: true, requestId: true, userId: true },
  });
  let fixed = 0, skipped = 0, ok = 0;
  for (const asset of assets) {
    if (!asset.sourcePrompt) continue;
    const jobs = await prisma.$queryRawUnsafe(
      'SELECT "referenceImages","referenceNames" FROM "GenerationJob" WHERE "requestId" = $1 LIMIT 1',
      asset.requestId,
    );
    const job = jobs[0];
    if (!job) continue;
    const refImages = Array.isArray(job.referenceImages) ? job.referenceImages : [];
    const refNames = (job.referenceNames && typeof job.referenceNames === "object" && !Array.isArray(job.referenceNames)) ? job.referenceNames : {};
    const correctNames = refImages.map((url) => refNames[url]).filter(Boolean);
    if (correctNames.length === 0) continue;
    const mentions = extractMentions(asset.sourcePrompt);
    // 已一致：@名集合 == 实际参考名集合
    const sameSet = mentions.length === correctNames.length && mentions.every((n) => correctNames.includes(n));
    if (sameSet) { ok++; continue; }
    if (mentions.length !== correctNames.length) {
      console.log(`SKIP ${asset.systemName} mentions=[${mentions}] correct=[${correctNames}] (count mismatch)`);
      skipped++;
      continue;
    }
    // 数量相等：按出现顺序逐个替换 @旧名 -> @正确名
    let next = asset.sourcePrompt;
    for (let i = 0; i < mentions.length; i++) {
      if (mentions[i] === correctNames[i]) continue;
      next = next.replace(new RegExp(`@${mentions[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g"), `@${correctNames[i]}`);
    }
    if (next !== asset.sourcePrompt) {
      if (apply) await prisma.mediaAsset.update({ where: { id: asset.id }, data: { sourcePrompt: next } });
      console.log(`${apply ? "FIX" : "WOULD-FIX"} ${asset.systemName}: [${mentions}] -> [${correctNames}]`);
      fixed++;
    }
  }
  console.log(`\nDONE${apply ? "" : " (dry-run)"} fixed=${fixed} skipped=${skipped} alreadyOk=${ok} total=${assets.length}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
