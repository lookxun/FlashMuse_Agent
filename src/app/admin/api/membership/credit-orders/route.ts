import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { listAdminCreditRecords } from "@/lib/payment-orders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (userId) {
    const credits = await listAdminCreditRecords(userId);
    return NextResponse.json({ credits });
  }

  const grouped = await prisma.paymentOrder.groupBy({
    by: ["userId"],
    where: { kind: "credit_pack" },
    _count: { _all: true },
    _sum: { credits: true },
  });
  const paidGrouped = await prisma.paymentOrder.groupBy({
    by: ["userId"],
    where: { kind: "credit_pack", status: "paid" },
    _sum: { credits: true },
  });
  const paidCredits: Record<string, number> = {};
  for (const row of paidGrouped) paidCredits[row.userId] = row._sum.credits ?? 0;
  const counts: Record<string, { count: number; credits: number }> = {};
  for (const row of grouped) {
    counts[row.userId] = { count: row._count._all, credits: paidCredits[row.userId] ?? 0 };
  }
  return NextResponse.json({ counts });
}
