import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";
import { resolveGeneratedFilePath } from "@/lib/generated-asset-path";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";
import { VIDEO_ENHANCE_FAST_MODEL_ID, VIDEO_ENHANCE_MODEL_ID, VIDEO_ENHANCE_STANDARD_MODEL_ID, isVideoEnhanceModel } from "@/lib/models";
import { getConfiguredBytePlusMediaKitApiKey, getConfiguredMediaKitApiKey } from "@/lib/system-settings";


export { VIDEO_ENHANCE_FAST_MODEL_ID, VIDEO_ENHANCE_MODEL_ID, VIDEO_ENHANCE_STANDARD_MODEL_ID, isVideoEnhanceModel };

export const VIDEO_ENHANCE_MODEL_LABEL = "火山画质增强";
export const VIDEO_ENHANCE_FAST_MODEL_LABEL = "画质增强极速";
export const VIDEO_ENHANCE_STANDARD_MODEL_LABEL = "画质增强标准";
export const VIDEO_ENHANCE_RESOLUTIONS = ["720p", "1080p", "2K"] as const;
export const BYTEPLUS_VIDEO_ENHANCE_RESOLUTIONS = ["720p", "1080p", "2K", "4K"] as const;
export type VideoEnhanceResolution = (typeof VIDEO_ENHANCE_RESOLUTIONS)[number];
export type BytePlusVideoEnhanceResolution = (typeof BYTEPLUS_VIDEO_ENHANCE_RESOLUTIONS)[number];
export type VideoEnhanceVariant = "generative" | "fast" | "standard";

const MEDIAKIT_BASE_URL = "https://mediakit.cn-beijing.volces.com";
const BYTEPLUS_MEDIAKIT_BASE_URL = "https://mediakit.ap-southeast-1.bytepluses.com";

export function isVideoEnhanceResolution(value: unknown): value is VideoEnhanceResolution {
  return value === "720p" || value === "1080p" || value === "2K";
}

export function isBytePlusVideoEnhanceResolution(value: unknown): value is BytePlusVideoEnhanceResolution {
  return value === "720p" || value === "1080p" || value === "2K" || value === "4K";
}

export function getVideoEnhanceLabel(modelId?: string) {
  if (modelId === VIDEO_ENHANCE_FAST_MODEL_ID) return VIDEO_ENHANCE_FAST_MODEL_LABEL;
  if (modelId === VIDEO_ENHANCE_STANDARD_MODEL_ID) return VIDEO_ENHANCE_STANDARD_MODEL_LABEL;
  return VIDEO_ENHANCE_MODEL_LABEL;
}

export function getRequiredMediaKitApiKey() {
  const apiKey = getConfiguredMediaKitApiKey();
  if (!apiKey) throw new Error("画质增强未配置或已关闭，请在后台模型开关里填写 MediaKit API Key 并打开开关。");
  return apiKey;
}

export function getRequiredBytePlusMediaKitApiKey() {
  const apiKey = getConfiguredBytePlusMediaKitApiKey();
  if (!apiKey) throw new Error("海外画质增强未配置或已关闭，请在后台模型开关里填写 BytePlus MediaKit API Key 并打开开关。");
  return apiKey;
}

function mediakitHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function toPublicGeneratedAssetUrl(value: string) {
  const url = normalizeReferenceAssetUrl(value);
  if (!url) return url;
  if (url.startsWith("/generated/")) {
    const base = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL || process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "https://main.venusface.com").replace(/\/$/, "");
    return `${base}${url}`;
  }
  return url;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  return fallback;
}

function getVideoMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".webm") return "video/webm";
  if (extension === ".avi") return "video/x-msvideo";
  if (extension === ".mkv") return "video/x-matroska";
  return "video/mp4";
}

function toUpstreamResolution(resolution: string) {
  if (resolution === "2K") return "2k";
  if (resolution === "4K") return "4k";
  return resolution;
}

async function getLocalMediaProxyDispatcher() {
  if (process.env.NODE_ENV === "production") return undefined;
  const url = (process.env.LOCAL_MEDIA_PROXY ?? "").trim();
  if (!url) return undefined;
  const { ProxyAgent } = await import("undici");
  return new ProxyAgent(url);
}

async function mediakitFetch(url: string, init: RequestInit) {
  const dispatcher = await getLocalMediaProxyDispatcher();
  // ⭐⭐ 必须带超时：常驻 worker 的 `runVideoJob` 最多同时跑 8 条（MAX_CONCURRENT_VIDEO），
  //   一个永远不返回的 fetch 就永久占掉一个槽 —— 8 个卡住 = 视频任务全站不再被认领。
  //   上传源视频那一跳给 10 分钟（跨境传大文件），其余 60 秒足够。
  const signal = init.signal ?? AbortSignal.timeout(init.method === "PUT" ? 600_000 : 60_000);
  if (!dispatcher) return fetch(url, { ...init, signal });
  return fetch(url, { ...init, signal, dispatcher } as RequestInit & { dispatcher: unknown });
}

async function uploadLocalVideoToMediaKit(input: { localUrl: string; apiKey: string; baseUrl: string; requestId?: string; model: string }) {
  const filePath = resolveGeneratedFilePath(input.localUrl);
  if (!filePath) return undefined;
  const startedAt = Date.now();
  const uploadAddressResponse = await mediakitFetch(`${input.baseUrl}/api/v1/tools-sync/request-media-upload-url`, {
    method: "POST",
    headers: mediakitHeaders(input.apiKey),
    body: "{}",
  });
  const uploadAddressPayload = await uploadAddressResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!uploadAddressResponse.ok || uploadAddressPayload.success === false) {
    throw new Error(getErrorMessage(uploadAddressPayload, "画质增强上传地址申请失败"));
  }
  const result = uploadAddressPayload.result && typeof uploadAddressPayload.result === "object" ? uploadAddressPayload.result as Record<string, unknown> : {};
  const uploadUrl = typeof result.upload_url === "string" ? result.upload_url : "";
  const fileId = typeof result.file_id === "string" ? result.file_id : "";
  if (!uploadUrl || !fileId) throw new Error("画质增强上传地址申请失败");
  const uploadHeaders = new Headers();
  const rawHeaders = Array.isArray(result.upload_headers) ? result.upload_headers : [];
  for (const item of rawHeaders) {
    if (!item || typeof item !== "object") continue;
    const key = typeof (item as { key?: unknown }).key === "string" ? (item as { key: string }).key : "";
    const value = typeof (item as { value?: unknown }).value === "string" ? (item as { value: string }).value : "";
    if (key) uploadHeaders.set(key, value);
  }
  if (!uploadHeaders.has("Content-Type")) uploadHeaders.set("Content-Type", getVideoMimeType(filePath));
  const body = readFileSync(filePath);
  const putResponse = await mediakitFetch(uploadUrl, { method: "PUT", headers: uploadHeaders, body });
  if (!putResponse.ok) {
    const putText = await putResponse.text().catch(() => "");
    void appendGenerationDiagnosticsLog({ event: "mediakit-upload-failed", requestId: input.requestId, mode: "video", provider: "mediakit", model: input.model, status: putResponse.status, durationMs: Date.now() - startedAt, extra: { body: putText.slice(0, 500) } });
    throw new Error("画质增强上传源视频失败");
  }
  const mediaUrl = fileId.startsWith("mediakit://") ? fileId : `mediakit://${fileId}`;
  void appendGenerationDiagnosticsLog({ event: "mediakit-upload-success", requestId: input.requestId, mode: "video", provider: "mediakit", model: input.model, durationMs: Date.now() - startedAt, extra: { bytes: body.byteLength } });
  return mediaUrl;
}

async function resolveEnhanceVideoUrl(input: { sourceUrl: string; apiKey: string; baseUrl: string; requestId?: string; model: string }) {
  const localUrl = normalizeReferenceAssetUrl(input.sourceUrl);
  if (localUrl.startsWith("/generated/") && resolveGeneratedFilePath(localUrl)) {
    const uploaded = await uploadLocalVideoToMediaKit({ localUrl, apiKey: input.apiKey, baseUrl: input.baseUrl, requestId: input.requestId, model: input.model });
    if (uploaded) return uploaded;
  }
  if (/^https?:\/\//i.test(input.sourceUrl) || input.sourceUrl.startsWith("mediakit://") || input.sourceUrl.startsWith("vod://") || input.sourceUrl.startsWith("tos://")) return input.sourceUrl;
  return toPublicGeneratedAssetUrl(input.sourceUrl);
}

export async function createMediaKitEnhanceTask(input: { sourceUrl: string; resolution: VideoEnhanceResolution; requestId?: string; clientToken?: string }) {
  const apiKey = getRequiredMediaKitApiKey();
  const startedAt = Date.now();
  const videoUrl = await resolveEnhanceVideoUrl({ sourceUrl: input.sourceUrl, apiKey, baseUrl: MEDIAKIT_BASE_URL, requestId: input.requestId, model: VIDEO_ENHANCE_MODEL_ID });
  const body = {
    video_url: videoUrl,
    resolution: toUpstreamResolution(input.resolution),
    client_token: input.clientToken ?? input.requestId,
  };
  const url = `${MEDIAKIT_BASE_URL}/api/v1/tools/enhance-video-generative`;
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-start", requestId: input.requestId, mode: "video", provider: "mediakit", model: VIDEO_ENHANCE_MODEL_ID, extra: { url, resolution: input.resolution } });
  let response: Response;
  try {
    response = await mediakitFetch(url, {
      method: "POST",
      headers: mediakitHeaders(apiKey),
      body: JSON.stringify(body),
    });
  } catch (error) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-fetch-error", requestId: input.requestId, mode: "video", provider: "mediakit", model: VIDEO_ENHANCE_MODEL_ID, durationMs: Date.now() - startedAt, error });
    throw error;
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    const message = getErrorMessage(payload, "画质增强任务提交失败");
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-non-ok", requestId: input.requestId, mode: "video", provider: "mediakit", model: VIDEO_ENHANCE_MODEL_ID, status: response.status, durationMs: Date.now() - startedAt, upstream: { body: JSON.stringify(payload).slice(0, 1500) } });
    throw new Error(message);
  }
  const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
  if (!taskId) throw new Error("画质增强没有返回任务编号");
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-success", requestId: input.requestId, mode: "video", provider: "mediakit", model: VIDEO_ENHANCE_MODEL_ID, taskId, status: response.status, durationMs: Date.now() - startedAt });
  return { taskId, raw: payload };
}

export async function createBytePlusMediaKitEnhanceTask(input: { sourceUrl: string; resolution: BytePlusVideoEnhanceResolution; variant: "fast" | "standard"; requestId?: string; clientToken?: string }) {
  const apiKey = getRequiredBytePlusMediaKitApiKey();
  const startedAt = Date.now();
  const model = input.variant === "fast" ? VIDEO_ENHANCE_FAST_MODEL_ID : VIDEO_ENHANCE_STANDARD_MODEL_ID;
  const videoUrl = await resolveEnhanceVideoUrl({ sourceUrl: input.sourceUrl, apiKey, baseUrl: BYTEPLUS_MEDIAKIT_BASE_URL, requestId: input.requestId, model });
  const path = input.variant === "fast" ? "/api/v1/tools/enhance-video-fast" : "/api/v1/tools/enhance-video";
  const url = `${BYTEPLUS_MEDIAKIT_BASE_URL}${path}`;
  const body = input.variant === "fast"
    ? {
        video_url: videoUrl,
        resolution: toUpstreamResolution(input.resolution),
        bitrate_level: "medium",
        client_token: input.clientToken ?? input.requestId,
      }
    : {
        video_url: videoUrl,
        scene: "aigc",
        tool_version: "standard",
        resolution: toUpstreamResolution(input.resolution),
        bitrate_level: "medium",
        client_token: input.clientToken ?? input.requestId,
      };
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-start", requestId: input.requestId, mode: "video", provider: "mediakit", model, extra: { url, resolution: input.resolution, variant: input.variant } });
  let response: Response;
  try {
    response = await mediakitFetch(url, {
      method: "POST",
      headers: mediakitHeaders(apiKey),
      body: JSON.stringify(body),
    });
  } catch (error) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-fetch-error", requestId: input.requestId, mode: "video", provider: "mediakit", model, durationMs: Date.now() - startedAt, error });
    throw error;
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    const message = getErrorMessage(payload, "画质增强任务提交失败");
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-non-ok", requestId: input.requestId, mode: "video", provider: "mediakit", model, status: response.status, durationMs: Date.now() - startedAt, upstream: { body: JSON.stringify(payload).slice(0, 1500) } });
    throw new Error(message);
  }
  const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
  if (!taskId) throw new Error("画质增强没有返回任务编号");
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-success", requestId: input.requestId, mode: "video", provider: "mediakit", model, taskId, status: response.status, durationMs: Date.now() - startedAt });
  return { taskId, raw: payload };
}

function getEnhancePollTarget(taskId: string) {
  if (taskId.includes("enhance-video-generative")) return { baseUrl: MEDIAKIT_BASE_URL, apiKey: getRequiredMediaKitApiKey(), model: VIDEO_ENHANCE_MODEL_ID };
  if (taskId.includes("enhance-video-fast")) return { baseUrl: BYTEPLUS_MEDIAKIT_BASE_URL, apiKey: getRequiredBytePlusMediaKitApiKey(), model: VIDEO_ENHANCE_FAST_MODEL_ID };
  if (taskId.includes("enhance-video")) return { baseUrl: BYTEPLUS_MEDIAKIT_BASE_URL, apiKey: getRequiredBytePlusMediaKitApiKey(), model: VIDEO_ENHANCE_STANDARD_MODEL_ID };
  return { baseUrl: MEDIAKIT_BASE_URL, apiKey: getRequiredMediaKitApiKey(), model: VIDEO_ENHANCE_MODEL_ID };
}

export async function getMediaKitEnhanceTask(taskId: string) {
  const target = getEnhancePollTarget(taskId);
  const startedAt = Date.now();
  const response = await mediakitFetch(`${target.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${target.apiKey}` },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (response.status === 404 || (payload.success === false && (payload.error as { code?: unknown } | undefined)?.code === 404)) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll-404", mode: "video", provider: "mediakit", model: target.model, taskId, status: response.status, durationMs: Date.now() - startedAt, extra: { body: JSON.stringify(payload).slice(0, 500) } });
    return { success: true, task_id: taskId, status: "running" };
  }
  if (!response.ok || payload.success === false) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll-non-ok", mode: "video", provider: "mediakit", model: target.model, taskId, status: response.status, durationMs: Date.now() - startedAt, extra: { body: JSON.stringify(payload).slice(0, 1500) } });
    throw new Error(getErrorMessage(payload, "查询画质增强任务失败"));
  }
  void appendGenerationDiagnosticsLog({ event: "video-provider-poll", mode: "video", provider: "mediakit", model: target.model, taskId, status: response.status, durationMs: Date.now() - startedAt, extra: { status: payload.status, hasVideoUrl: Boolean((payload.result as { video_url?: unknown } | undefined)?.video_url) } });
  return payload;
}
