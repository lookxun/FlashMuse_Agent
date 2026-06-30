import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getUploadRuleOverrides, updateUploadRuleOverrides } from "@/lib/system-settings";
import type { UploadRuleOverrides } from "@/lib/upload-rules";

export const runtime = "nodejs";

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ uploadRuleOverrides: getUploadRuleOverrides() });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const uploadRuleOverrides = body.uploadRuleOverrides && typeof body.uploadRuleOverrides === "object" && !Array.isArray(body.uploadRuleOverrides) ? body.uploadRuleOverrides as UploadRuleOverrides : {};
  const next = await updateUploadRuleOverrides(uploadRuleOverrides);
  return NextResponse.json({ uploadRuleOverrides: next });
}
