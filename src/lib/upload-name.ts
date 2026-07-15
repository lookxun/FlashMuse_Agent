import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ============================================================================
 * 上传文件命名的唯一权威（Single Source of Truth for uploaded-file names）
 * ============================================================================
 *
 * 铁律（见 AGENTS.md）：能统一的一律统一。此前"上传文件如何取名/去重错开名_2"
 * 在对话流输入框(makeUniqueReferenceName)、资产库(getVersionedName)、工作流
 * (直接用 file.name 带扩展名) 各写了一份，碰撞域/扩展名处理都不同，导致同一张图
 * 在不同地方显示不同名字。现全部收敛到这里：
 *
 *  - 同一张图（同 contentHash）→ 复用它在库里已有的权威名（改名后的当前名优先）。
 *  - 新图 → 服务端全局分配唯一名：base 撞名就 base_2 / base_3…（含在途生成任务的
 *    预约名，与生成命名互不撞车）。
 *  - 名字一律【去扩展名】+ sanitize（保证能被 @ 提及匹配）。
 *
 * 前端三处（对话流/工作流/资产库）不再自己算名字，一律用这里返回的名字显示 + 作 @引用名。
 */

const NAME_FALLBACK = "上传文件";

/** 去扩展名 + 去空格/标点/@，截断 24 字；空则回退。与 @ 提及匹配兼容。 */
export function sanitizeUploadBaseName(rawFileName: string | null | undefined, fallback = NAME_FALLBACK): string {
  const stem = (rawFileName ?? "").replace(/\.[^.]+$/, "");
  const cleaned = stem.replace(/[\s，。？！?!.、；;：“”"'（）()【】\[\]{}@]/g, "").slice(0, 24);
  return cleaned || fallback;
}

/** 收集该用户已占用的所有名字：MediaAsset 系统名/出生名 + 用户改名 + 在途生成任务预约名。 */
export async function collectUsedNames(tx: Prisma.TransactionClient, userId: string): Promise<Set<string>> {
  const [assets, states, jobs] = await Promise.all([
    tx.mediaAsset.findMany({ where: { userId }, select: { systemName: true, initialName: true } }),
    tx.userAssetState.findMany({ where: { userId }, select: { currentName: true } }),
    tx.$queryRaw<Array<{ reservedNames: string[] | null }>>`SELECT "reservedNames" FROM "GenerationJob" WHERE "userId" = ${userId} AND "status" IN ('queued', 'running')`,
  ]);
  const used = new Set<string>();
  for (const asset of assets) for (const name of [asset.systemName, asset.initialName]) if (name) used.add(name);
  for (const state of states) if (state.currentName) used.add(state.currentName);
  for (const job of jobs) for (const name of job.reservedNames ?? []) used.add(name);
  return used;
}

/** 在 used 集合里给 base 找一个唯一名：base 空缺就用 base，否则 base_2 / base_3…。 */
export function allocateUniqueName(base: string, used: Set<string>): string {
  const name = base || NAME_FALLBACK;
  if (!used.has(name)) return name;
  let index = 2;
  while (used.has(`${name}_${index}`)) index += 1;
  return `${name}_${index}`;
}

/** 取一条已存在资产的权威名：改名后的当前名 > 系统名 > 出生名。 */
function canonicalName(row: { currentName?: string | null; systemName: string | null; initialName: string | null }): string | null {
  return row.currentName?.trim() || row.systemName?.trim() || row.initialName?.trim() || null;
}

export interface ResolveUploadNameInput {
  userId: string;
  originalFileName: string | null | undefined;
  contentHash?: string | null;
}

/**
 * 在给定事务内（必须已持有 upload:userId advisory 锁，见 withUploadNameLock）
 * 解析一个上传文件应显示的权威名。
 * - contentHash 命中已有资产 → 复用其权威名（reused=true）。
 * - 否则全局分配唯一名（reused=false）。
 */
export async function resolveUploadNameInTx(tx: Prisma.TransactionClient, input: ResolveUploadNameInput): Promise<{ name: string; reused: boolean }> {
  const hash = input.contentHash?.trim();
  if (hash) {
    const existing = await tx.mediaAsset.findFirst({
      where: { userId: input.userId, contentHash: hash, archivedAt: null },
      select: { systemName: true, initialName: true, userStates: { where: { userId: input.userId }, select: { currentName: true }, take: 1 } },
      orderBy: { firstSeenAt: "asc" },
    });
    if (existing) {
      const name = canonicalName({ currentName: existing.userStates[0]?.currentName, systemName: existing.systemName, initialName: existing.initialName });
      if (name) return { name, reused: true };
    }
  }
  const used = await collectUsedNames(tx, input.userId);
  const base = sanitizeUploadBaseName(input.originalFileName);
  return { name: allocateUniqueName(base, used), reused: false };
}

/**
 * 独立解析权威名（自开事务 + advisory 锁）。用于只需拿名字、随后自己另做写入的调用点。
 * 注意：锁只在本事务内有效，若调用方在拿到名字后另起事务写入，极端并发下有极小撞名窗口；
 * 需强一致时请把命名与写入放进同一个 withUploadNameLock 事务。
 */
export async function resolveUploadName(input: ResolveUploadNameInput): Promise<{ name: string; reused: boolean }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`upload:${input.userId}`}))`;
    return resolveUploadNameInTx(tx, input);
  });
}

/** 在持有 upload:userId advisory 锁的事务内运行 fn（命名+写入放一起，杜绝撞名窗口）。 */
export async function withUploadNameLock<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`upload:${userId}`}))`;
    return fn(tx);
  });
}
