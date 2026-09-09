import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getCreditPackSettings, updateCreditPackSettings } from "@/lib/system-settings";
import { sanitizeCreditPacks, type CreditPack } from "@/lib/membership";

export const runtime = "nodejs";

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ packs: sanitizeCreditPacks(getCreditPackSettings()) });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const packs = await updateCreditPackSettings(sanitizeCreditPacks(body.packs as CreditPack[]));
  return NextResponse.json({ packs });
}
