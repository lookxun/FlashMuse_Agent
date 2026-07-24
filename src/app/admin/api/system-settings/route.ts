import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getAdminSystemSettings, isCompressionQuality, updateAdminSystemSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ settings: getAdminSystemSettings() });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  // 字段合并式更新：body 里没提供的字段沿用当前设置，避免不同面板的部分更新互相覆盖清空。
  const current = getAdminSystemSettings();
  const openRouterApiKey = typeof body.openRouterApiKey === "string" ? body.openRouterApiKey.trim() : current.openRouterApiKey;
  const openRouterApiKeyEnabled = typeof body.openRouterApiKeyEnabled === "boolean" ? body.openRouterApiKeyEnabled : current.openRouterApiKeyEnabled;
  const bytePlusApiKey = typeof body.bytePlusApiKey === "string" ? body.bytePlusApiKey.trim() : current.bytePlusApiKey;
  const bytePlusApiKeyEnabled = typeof body.bytePlusApiKeyEnabled === "boolean" ? body.bytePlusApiKeyEnabled : current.bytePlusApiKeyEnabled;
  const bytePlusUnlockLimits = typeof body.bytePlusUnlockLimits === "boolean" ? body.bytePlusUnlockLimits : current.bytePlusUnlockLimits;
  const bytePlusRegion = body.bytePlusRegion === "eu-west-1" ? "eu-west-1" : body.bytePlusRegion === "ap-southeast-1" ? "ap-southeast-1" : current.bytePlusRegion;
  const modelProviderPreferences = body.modelProviderPreferences && typeof body.modelProviderPreferences === "object" && !Array.isArray(body.modelProviderPreferences) ? body.modelProviderPreferences as Record<string, "openrouter" | "byteplus"> : current.modelProviderPreferences;
  const bytePlusModelSelections = body.bytePlusModelSelections && typeof body.bytePlusModelSelections === "object" && !Array.isArray(body.bytePlusModelSelections) ? body.bytePlusModelSelections as Record<string, string> : current.bytePlusModelSelections;
  const editModelToggles = body.editModelToggles && typeof body.editModelToggles === "object" && !Array.isArray(body.editModelToggles) ? { ...current.editModelToggles, ...body.editModelToggles as Record<string, boolean> } : current.editModelToggles;
  const imageCompressionEnabled = typeof body.imageCompressionEnabled === "boolean" ? body.imageCompressionEnabled : current.imageCompressionEnabled;
  const imageCompressionQuality = isCompressionQuality(body.imageCompressionQuality) ? body.imageCompressionQuality : current.imageCompressionQuality;
  const videoCompressionEnabled = typeof body.videoCompressionEnabled === "boolean" ? body.videoCompressionEnabled : current.videoCompressionEnabled;
  const videoCompressionQuality = isCompressionQuality(body.videoCompressionQuality) ? body.videoCompressionQuality : current.videoCompressionQuality;
  if (openRouterApiKeyEnabled && !openRouterApiKey) return NextResponse.json({ error: "请输入 OpenRouter API Key" }, { status: 400 });
  if (bytePlusApiKeyEnabled && !bytePlusApiKey) return NextResponse.json({ error: "请输入 BytePlus API Key" }, { status: 400 });

  const settings = await updateAdminSystemSettings({ openRouterApiKey, openRouterApiKeyEnabled, bytePlusApiKey, bytePlusApiKeyEnabled, bytePlusUnlockLimits, bytePlusRegion, modelProviderPreferences, bytePlusModelSelections, editModelToggles, imageCompressionEnabled, imageCompressionQuality, videoCompressionEnabled, videoCompressionQuality });
  return NextResponse.json({ settings });
}
