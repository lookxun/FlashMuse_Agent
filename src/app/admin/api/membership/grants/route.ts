import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });

  const [rows, monthlyGrants] = await Promise.all([
    prisma.creditLedger.findMany({
      where: { userId, kind: "admin_membership_grant" },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, credits: true, metadata: true },
    }),
    prisma.creditLedger.findMany({
      where: { userId, kind: "membership_grant" },
      orderBy: { createdAt: "asc" },
      select: { credits: true, createdAt: true },
    }),
  ]);
  const grants = rows.map((row, index) => {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? { ...(row.metadata as Record<string, unknown>) } : {};
    const start = new Date(typeof metadata.grantStartedAt === "string" ? metadata.grantStartedAt : row.createdAt);
    const next = rows[index - 1];
    const end = next ? new Date(next.createdAt) : new Date(8640000000000000);
    const credited = monthlyGrants
      .filter((item) => item.createdAt >= start && item.createdAt < end)
      .reduce((sum, item) => sum + item.credits, 0);
    metadata.creditsGranted = credited > 0 ? credited : Number(metadata.creditsGranted) || 0;
    return { ...row, metadata };
  });
  return NextResponse.json({ grants });
}
