import { NextResponse } from "next/server";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { sanitizeCreditPacks } from "@/lib/membership";
import { getCreditPackSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  return NextResponse.json({ packs: sanitizeCreditPacks(getCreditPackSettings()) });
}
