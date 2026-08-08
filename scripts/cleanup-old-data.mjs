#!/usr/bin/env node
/**
 * 数据保留清理（2026-08-02 用户拍板：保留 1 周）。
 *
 * 清理范围（只清「运维记录」，绝不动用户内容）：
 *   - GenerationEvent：**31 天**前 **且**（已成功 或 已归档）。⭐ 未归档的失败事件不删 —— 那是红字排查材料。
 *     ⭐⭐ 这里刻意不是 7 天：后台「失败趋势（近 30 天）」统计所有 failed（含已归档），
 *     7 天保留会让那张图永远只有七八根柱子（2026-08-09 查实并修）。
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
// ⭐⭐ GenerationEvent 单独保留 31 天，⛔ 不许改回 7 天。
// 原因（2026-08-09 查实）：后台「失败排查 → 失败趋势（近 30 天）」那张图统计的是
// **所有** failed 事件（含已归档），而这个脚本每天 05:10 会把「7 天前 + 已成功/已归档」的行删掉
// → 图上永远只可能有七八根柱子，「近 30 天」这个标题从来没成立过。
// 行很小（十几个标量列）、量级约每天 100~300 行 → 31 天最多几千行，代价可以忽略。
const EVENT_RETENTION_DAYS = 31;
const BATCH_SIZE = 5000;
const BATCH_SLEEP_MS = 200;

const prisma = new PrismaClient();
const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
const eventCutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function countTargets() {
  const [events, jobs, uploads] = await Promise.all([
    prisma.generationEvent.count({ where: { createdAt: { lt: eventCutoff }, OR: [{ status: "success" }, { resolvedAt: { not: null } }] } }),
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
  console.log(`[cleanup] mode=${APPLY ? "APPLY" : "dry-run"} cutoff=${cutoff.toISOString()} (>${RETENTION_DAYS} 天)，GenerationEvent cutoff=${eventCutoff.toISOString()} (>${EVENT_RETENTION_DAYS} 天)`);

  if (!APPLY) {
    const targets = await countTargets();
    console.log(`[cleanup] 将删除：GenerationEvent=${targets.events} GenerationJob=${targets.jobs} UploadEvent=${targets.uploads}`);
    console.log("[cleanup]  dry-run，未删任何行。加 --apply 真删。");
    return;
  }

  await batchedDelete("GenerationEvent", () =>
    prisma.$executeRaw`DELETE FROM "GenerationEvent" WHERE "id" IN (
      SELECT "id" FROM "GenerationEvent"
      WHERE "createdAt" < ${eventCutoff} AND ("status" = 'success' OR "resolvedAt" IS NOT NULL)
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
