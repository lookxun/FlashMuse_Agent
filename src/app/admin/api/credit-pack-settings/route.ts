import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getCreditPackSettings, updateCreditPackSettings } from "@/lib/system-settings";
import { sanitizeCreditPacks, type CreditPack } from "@/lib/membership";
import { appendPaymentLog } from "@/lib/payment-log";

export const runtime = "nodejs";

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ packs: sanitizeCreditPacks(getCreditPackSettings()) });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { packs?: unknown };
  // ⛔ 必须显式校验是数组：`sanitizeCreditPacks(undefined)` 会返回**默认 8 档**，
  //   一个空 body 就能把管理员调好的价格全部重置回默认值（静默改价）。
  if (!Array.isArray(body.packs)) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const before = sanitizeCreditPacks(getCreditPackSettings());
  const packs = await updateCreditPackSettings(sanitizeCreditPacks(body.packs as CreditPack[]));
  // ⭐ 改价必须留痕：这是"1 分钱测完忘了改回来"这类事故唯一的事后追溯依据。
  void appendPaymentLog("credit-pack-settings-changed", {
    adminEmail: email,
    before: before.map((item) => `${item.payCny}=${item.credits}${item.locked ? "" : "(unlocked)"}`),
    after: packs.map((item) => `${item.payCny}=${item.credits}${item.locked ? "" : "(unlocked)"}`),
  });
  return NextResponse.json({ packs });
}
