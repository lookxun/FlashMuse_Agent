import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getAdminSystemSettings, isCompressionQuality, updateAdminSystemSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

// 2026-08-02 审计 2.8h：GET 不再把 API key 明文回给浏览器（管理员 cookie 一旦泄露就多丢一层）。
// 返回掩码（****末4位）；POST 收到以 **** 开头的值 = 「没改，沿用当前」。
function maskApiKey(key: string) {
  if (!key) return "";
  return key.length > 4 ? `****${key.slice(-4)}` : "****";
}
function unmaskApiKeyUpdate(value: unknown, current: string) {
  if (typeof value !== "string") return current;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("****")) return current;
  return trimmed;
}

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const settings = getAdminSystemSettings();
  return NextResponse.json({ settings: { ...settings, openRouterApiKey: maskApiKey(settings.openRouterApiKey), bytePlusApiKey: maskApiKey(settings.bytePlusApiKey) } });
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  // 字段合并式更新：body 里没提供的字段沿用当前设置，避免不同面板的部分更新互相覆盖清空。
  const current = getAdminSystemSettings();
  const openRouterApiKey = unmaskApiKeyUpdate(body.openRouterApiKey, current.openRouterApiKey);
  const openRouterApiKeyEnabled = typeof body.openRouterApiKeyEnabled === "boolean" ? body.openRouterApiKeyEnabled : current.openRouterApiKeyEnabled;
  const bytePlusApiKey = unmaskApiKeyUpdate(body.bytePlusApiKey, current.bytePlusApiKey);
  const bytePlusApiKeyEnabled = typeof body.bytePlusApiKeyEnabled === "boolean" ? body.bytePlusApiKeyEnabled : current.bytePlusApiKeyEnabled;
  const bytePlusUnlockLimits = typeof body.bytePlusUnlockLimits === "boolean" ? body.bytePlusUnlockLimits : current.bytePlusUnlockLimits;
  const bytePlusRegion = body.bytePlusRegion === "eu-west-1" ? "eu-west-1" : body.bytePlusRegion === "ap-southeast-1" ? "ap-southeast-1" : current.bytePlusRegion;
  const modelProviderPreferences = body.modelProviderPreferences && typeof body.modelProviderPreferences === "object" && !Array.isArray(body.modelProviderPreferences) ? body.modelProviderPreferences as Record<string, "openrouter" | "byteplus"> : current.modelProviderPreferences;
  const bytePlusModelSelections = body.bytePlusModelSelections && typeof body.bytePlusModelSelections === "object" && !Array.isArray(body.bytePlusModelSelections) ? body.bytePlusModelSelections as Record<string, string> : current.bytePlusModelSelections;
  const editModelToggles = body.editModelToggles && typeof body.editModelToggles === "object" && !Array.isArray(body.editModelToggles) ? { ...current.editModelToggles, ...body.editModelToggles as Record<string, boolean> } : current.editModelToggles;
  const agentPriorityModelId = typeof body.agentPriorityModelId === "string" && body.agentPriorityModelId.trim() ? body.agentPriorityModelId.trim() : current.agentPriorityModelId;
  const agentPriorityEnabled = typeof body.agentPriorityEnabled === "boolean" ? body.agentPriorityEnabled : current.agentPriorityEnabled;
  const imageCompressionEnabled = typeof body.imageCompressionEnabled === "boolean" ? body.imageCompressionEnabled : current.imageCompressionEnabled;
  const imageCompressionQuality = isCompressionQuality(body.imageCompressionQuality) ? body.imageCompressionQuality : current.imageCompressionQuality;
  const videoCompressionEnabled = typeof body.videoCompressionEnabled === "boolean" ? body.videoCompressionEnabled : current.videoCompressionEnabled;
  const videoCompressionQuality = isCompressionQuality(body.videoCompressionQuality) ? body.videoCompressionQuality : current.videoCompressionQuality;
  if (openRouterApiKeyEnabled && !openRouterApiKey) return NextResponse.json({ error: "请输入 OpenRouter API Key" }, { status: 400 });
  if (bytePlusApiKeyEnabled && !bytePlusApiKey) return NextResponse.json({ error: "请输入 BytePlus API Key" }, { status: 400 });

  const settings = await updateAdminSystemSettings({ openRouterApiKey, openRouterApiKeyEnabled, bytePlusApiKey, bytePlusApiKeyEnabled, bytePlusUnlockLimits, bytePlusRegion, modelProviderPreferences, bytePlusModelSelections, editModelToggles, agentPriorityModelId, agentPriorityEnabled, imageCompressionEnabled, imageCompressionQuality, videoCompressionEnabled, videoCompressionQuality });
  return NextResponse.json({ settings });
}
