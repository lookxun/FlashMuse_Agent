import { NextResponse } from "next/server";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDemoRechargeHistory, ledgerToMembershipCharge } from "@/lib/membership-purchase-records";
import { listPaidCreditRecords } from "@/lib/payment-orders";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const [grantRows, monthlyGrants] = await Promise.all([
    prisma.creditLedger.findMany({
      where: { userId: user.id, kind: "admin_membership_grant" },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, credits: true, metadata: true },
    }),
    prisma.creditLedger.findMany({
      where: { userId: user.id, kind: "membership_grant" },
      orderBy: { createdAt: "asc" },
      select: { credits: true, createdAt: true },
    }),
  ]);

  const adminMembership = grantRows.map((row, index) => {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? { ...(row.metadata as Record<string, unknown>) } : {};
    const start = new Date(typeof metadata.grantStartedAt === "string" ? metadata.grantStartedAt : row.createdAt);
    const next = grantRows[index - 1];
    const end = next ? new Date(next.createdAt) : new Date(8640000000000000);
    const credited = monthlyGrants
      .filter((item) => item.createdAt >= start && item.createdAt < end)
      .reduce((sum, item) => sum + item.credits, 0);
    metadata.creditsGranted = credited > 0 ? credited : Number(metadata.creditsGranted) || 0;
    return ledgerToMembershipCharge({ ...row, metadata });
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  // ⛔⛔ 演示用的假充值记录**绝不许出现在正式环境的用户界面上**。
  // `getDemoRechargeHistory` 里给 3 个测试邮箱写了硬编码的假订单（含用户自己的 lookxun@163.com），
  // 而积分充值页的「充值记录」是真实用户会点开的东西 —— 上线后看到从没发生过的充值＝当成真扣过钱。
  // 后台「用户充值」列表仍能看到这些演示数据（那份是服务端组件直接调 lib，不走本接口，只有管理员能看）。
  const paidCredits = await listPaidCreditRecords(user.id);
  const demo = process.env.NODE_ENV === "production" ? { membership: [], credits: [] } : getDemoRechargeHistory(user.email);
  const membership = [...demo.membership, ...adminMembership].sort((left, right) => right.at.localeCompare(left.at));
  const credits = paidCredits.length > 0 ? paidCredits : demo.credits;
  return NextResponse.json({ membership, credits });
}
