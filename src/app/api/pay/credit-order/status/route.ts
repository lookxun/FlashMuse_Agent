import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAlipayCreditOrder } from "@/lib/payment-orders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const orderNo = new URL(request.url).searchParams.get("orderNo")?.trim() ?? "";
  if (!orderNo || !/^C\d{14,18}$/.test(orderNo)) return jsonError("订单号无效");

  try {
    const order = await syncAlipayCreditOrder(orderNo, user.id);
    if (!order) return jsonError("订单不存在", 404);
    const userRow = order.status === "paid"
      ? await prisma.user.findUnique({ where: { id: user.id }, select: { credits: true } })
      : null;
    return Response.json({
      orderNo: order.orderNo,
      status: order.status,
      packCny: order.packCny,
      payCny: order.payCny,
      credits: order.credits,
      creditsBalance: userRow?.credits,
    });
  } catch {
    return jsonError("查询失败，请稍后再试");
  }
}
