import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getMembershipSettings, updateMembershipSettings } from "@/lib/system-settings";
import { MEMBERSHIP_SYSTEM_ENABLED, sanitizeMembershipSettings, type MembershipSettings } from "@/lib/membership";

export const runtime = "nodejs";

function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ settings: sanitizeMembershipSettings(getMembershipSettings()) });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!MEMBERSHIP_SYSTEM_ENABLED) return NextResponse.json({ error: "会员系统未启用" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!isPlainObject(body.settings)) return NextResponse.json({ error: "缺少设置" }, { status: 400 });
  const settings = await updateMembershipSettings(sanitizeMembershipSettings(body.settings as MembershipSettings));
  return NextResponse.json({ settings });
}
