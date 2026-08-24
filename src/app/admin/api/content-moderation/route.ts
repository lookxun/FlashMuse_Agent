import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { verifyPassword } from "@/lib/auth";
import { invalidateContentModerationCache, normalizeContentModerationText, SENSITIVE_POLITICS_CATEGORY, splitContentModerationTerms } from "@/lib/content-moderation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function requireAdmin() {
  const email = await getCurrentAdminEmail();
  return email && isAdminEmail(email) ? email : null;
}

// 内容审核页所有改动操作的二次确认口令（固定为 dragonstar）。
// ⛔ 只存 scrypt 哈希、不存明文；改口令就重新生成一条 scrypt 串替换。
const MODERATION_ACTION_PASSWORD_HASH = "scrypt:70f6d8be9ded66a26a6e7c820522ee08:8094a2757c478888aaaa4c21fa8dff2a907c91506d80c99ed9b8f68061d207e78765c3eb908fd053a94642ba66381cd00c9ac2c502569aed845a757eaec14090";

export async function verifyModerationActionPassword(password: unknown) {
  if (typeof password !== "string" || password.length === 0) return false;
  return verifyPassword(password, MODERATION_ACTION_PASSWORD_HASH);
}

export async function POST(request: Request) {
  const adminEmail = await requireAdmin();
  if (!adminEmail) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const hasHidden = typeof body.hidden === "boolean";
  const termsHidden = Boolean(body.hidden);
  const hasTerms = typeof body.terms === "string";
  const terms = hasTerms
    ? splitContentModerationTerms(body.terms)
      .map((value) => ({ value: value.slice(0, 240), normalized: normalizeContentModerationText(value).slice(0, 480) }))
      .filter((item) => item.normalized.length > 0)
      .slice(0, 3000)
    : [];

  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "ContentModerationRuleGroup" ("id", "category", "label", "enabled", "termsHidden", "updatedAt")
        VALUES (${randomUUID()}, ${SENSITIVE_POLITICS_CATEGORY}, ${"敏感政治内容"}, ${enabled}, ${termsHidden}, NOW())
        ON CONFLICT ("category") DO UPDATE SET "enabled" = EXCLUDED."enabled"${hasHidden ? Prisma.sql`, "termsHidden" = EXCLUDED."termsHidden"` : Prisma.empty}, "updatedAt" = NOW()
        RETURNING "id"
      `;
      const groupId = rows[0]?.id;
      if (!groupId) throw new Error("保存审核规则失败");
      if (hasTerms) {
        await tx.$executeRaw`DELETE FROM "ContentModerationTerm" WHERE "groupId" = ${groupId}`;
        // ⭐ sortOrder = 管理员输入的下标，读取端一律按它排 —— ⛔ 别退回按 createdAt 排：
        //    这一批全在同一事务里插入、createdAt 完全相同，按它排会得到不确定的顺序。
        let sortOrder = 0;
        for (const term of terms) {
          await tx.$executeRaw`
            INSERT INTO "ContentModerationTerm" ("id", "groupId", "value", "normalized", "sortOrder")
            VALUES (${randomUUID()}, ${groupId}, ${term.value}, ${term.normalized}, ${sortOrder})
          `;
          sortOrder += 1;
        }
      }
    });
    invalidateContentModerationCache();
    return NextResponse.json({ ok: true, count: terms.length, termsUpdated: hasTerms });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}

// 手动删除一条审核记录（已拦截记录 / 语义审核待确认）。用户 2026-08-18 拍板：不再自动清理，改为手动删。
export async function DELETE(request: Request) {
  const adminEmail = await requireAdmin();
  if (!adminEmail) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "缺少记录 id" }, { status: 400 });
  try {
    await prisma.$executeRaw`DELETE FROM "ContentModerationEvent" WHERE "id" = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 });
  }
}
