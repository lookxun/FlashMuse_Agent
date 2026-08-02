#!/usr/bin/env node
/**
 * 数据保留清理（2026-08-02 用户拍板：保留 1 周）。
 *
 * 清理范围（只清「运维记录」，绝不动用户内容）：
 *   - GenerationEvent：7 天前 **且**（已成功 或 已归档）。⭐ 未归档的失败事件不删 —— 那是红字排查材料。
 *   - GenerationJob：7 天前 **且** 已结束（succeeded/failed）。⚠️ 代价：7 天前的生成记录
 *     「使用提示词 / 后台弹窗」的参考图回溯会变少（MediaAsset 本身的 sourcePrompt 不受影响）。
 *   - UploadEvent：7 天前的全部。
 *
 * ⛔ 明确不碰（用户数据 / 审计需要）：
 *   - WorkspaceMessage / WorkspaceSession.messagesJson（用户的对话内容）
 *   - CreditLedger（账单，审计需要永久保留）
 *   - UserAssetState.purgeAt / 软删工作流（产品规则：回收站到期只是客户端隐藏，不真删）
 *
 * 用法：
 *   node scripts/cleanup-old-data.mjs           # dry-run，只报各表会删多少
 *   node scripts/cleanup-old-data.mjs --apply   # 真删（分批，每批 5000，批间歇 200ms）
 *
 * 部署：服务器上每天备份之后跑（cron，见 handover/03-deploy-and-servers.md）。
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const RETENTION_DAYS = 7;
const BATCH_SIZE = 5000;
const BATCH_SLEEP_MS = 200;

const prisma = new PrismaClient();
const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function countTargets() {
  const [events, jobs, uploads] = await Promise.all([
    prisma.generationEvent.count({ where: { createdAt: { lt: cutoff }, OR: [{ status: "success" }, { resolvedAt: { not: null } }] } }),
    prisma.generationJob.count({ where: { createdAt: { lt: cutoff }, status: { in: ["succeeded", "failed"] } } }),
    prisma.uploadEvent.count({ where: { createdAt: { lt: cutoff } } }),
  ]);
  return { events, jobs, uploads };
}

async function batchedDelete(label, deleteSql) {
  let total = 0;
  for (;;) {
    const deleted = await deleteSql();
    total += deleted;
    if (deleted < BATCH_SIZE) break;
    await sleep(BATCH_SLEEP_MS);
  }
  console.log(`[cleanup] ${label}: deleted ${total}`);
}

async function main() {
  console.log(`[cleanup] mode=${APPLY ? "APPLY" : "dry-run"} cutoff=${cutoff.toISOString()} (>${RETENTION_DAYS} 天)`);

  if (!APPLY) {
    const targets = await countTargets();
    console.log(`[cleanup] 将删除：GenerationEvent=${targets.events} GenerationJob=${targets.jobs} UploadEvent=${targets.uploads}`);
    console.log("[cleanup]  dry-run，未删任何行。加 --apply 真删。");
    return;
  }

  await batchedDelete("GenerationEvent", () =>
    prisma.$executeRaw`DELETE FROM "GenerationEvent" WHERE "id" IN (
      SELECT "id" FROM "GenerationEvent"
      WHERE "createdAt" < ${cutoff} AND ("status" = 'success' OR "resolvedAt" IS NOT NULL)
      LIMIT ${BATCH_SIZE})`);
  await batchedDelete("GenerationJob", () =>
    prisma.$executeRaw`DELETE FROM "GenerationJob" WHERE "id" IN (
      SELECT "id" FROM "GenerationJob"
      WHERE "createdAt" < ${cutoff} AND "status" IN ('succeeded', 'failed')
      LIMIT ${BATCH_SIZE})`);
  await batchedDelete("UploadEvent", () =>
    prisma.$executeRaw`DELETE FROM "UploadEvent" WHERE "id" IN (
      SELECT "id" FROM "UploadEvent" WHERE "createdAt" < ${cutoff}
      LIMIT ${BATCH_SIZE})`);
}

main()
  .catch((error) => {
    console.error("[cleanup] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
