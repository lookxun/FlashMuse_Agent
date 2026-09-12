import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";
import { resolveGeneratedFilePath } from "@/lib/generated-asset-path";
import { VIDEO_DEPTH_MODEL_ID } from "@/lib/models";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";
import { safeFetch } from "@/lib/ssrf-guard";
import { getConfiguredRunningHubApiKey } from "@/lib/system-settings";
import { getLocalVideoDimensions } from "@/lib/video-poster";

export { VIDEO_DEPTH_MODEL_ID };

export const VIDEO_DEPTH_MODEL_LABEL = "深度动作捕捉";
export const RUNNINGHUB_DEPTHCRAFTER_WORKFLOW_ID = "1868729320020787201";

const RUNNINGHUB_BASE_URL = "https://www.runninghub.ai";
const DEPTHCRAFTER_NODE_ID = "1";
const VIDEO_LOAD_NODE_ID = "3";
const VIDEO_COMBINE_NODE_ID = "4";
/**
 * ⭐ 上游那条工作流真正会处理的秒数上限（`frame_load_cap = min(这个数, 源时长) × fps`）。
 * ⛔ 扣费必须按截断后的秒数算 —— 按完整时长收钱就是对 60 秒以上的源视频多收。
 */
export const MAX_DEPTH_SECONDS = 60;
const DEFAULT_DEPTH_FPS = 30;
const MAX_DEPTH_RES = 4096;

export function getRequiredRunningHubApiKey() {
  const apiKey = getConfiguredRunningHubApiKey();
  if (!apiKey) throw new Error("深度动作捕捉未配置或已关闭，请在后台快捷菜单开关里填写 RunningHub API Key 并打开开关。");
  return apiKey;
}

function runningHubHeaders(apiKey: string, json = true) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/**
 * ⭐⭐ 所有打 RunningHub 的请求都必须带超时：常驻 worker 的 `runVideoJob` 同时最多 8 条
 * （MAX_CONCURRENT_VIDEO），一个永远不返回的 fetch 会永久占掉一个槽，8 个卡住 = 视频全站不再被认领。
 * 上传源视频那一跳给 10 分钟（要传整份文件），建任务/查状态/取结果 60 秒够了。
 */
function runningHubFetch(url: string, init: RequestInit, timeoutMs = 60_000) {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : undefined;
  const failedReason = nested?.failedReason && typeof nested.failedReason === "object" ? nested.failedReason as Record<string, unknown> : undefined;
  const candidates = [
    failedReason?.exception_message,
    failedReason?.exception_type,
    nested?.exception_type,
    nested?.errorMessage,
    record.errorMessage,
    record.message,
    record.error,
    record.msg,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const text = candidate.trim();
    if (!text || /^success$/i.test(text)) continue;
    return text;
  }
  if (record.error && typeof record.error === "object") {
    const message = (record.error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() && !/^success$/i.test(message.trim())) return message.trim();
  }
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

function getFilename(pathOrUrl: string, mime: string) {
  const base = pathOrUrl.split("?")[0]?.split("/").filter(Boolean).pop() || "source";
  if (/\.(mp4|mov|webm|avi|mkv)$/i.test(base)) return base;
  if (mime.includes("quicktime")) return `${base}.mov`;
  if (mime.includes("webm")) return `${base}.webm`;
  return `${base}.mp4`;
}

function resolveDepthFps(fps?: number) {
  return typeof fps === "number" && Number.isFinite(fps) && fps > 0 && fps <= 120 ? fps : DEFAULT_DEPTH_FPS;
}

function frameLoadCapFromDuration(duration?: string, durationSeconds?: number, fps?: number) {
  const fromNumber = Number(durationSeconds);
  const fromText = Number(String(duration ?? "").match(/\d+(?:\.\d+)?/)?.[0]);
  const seconds = Number.isFinite(fromNumber) && fromNumber > 0 ? fromNumber : fromText;
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
  const cappedSeconds = Math.min(MAX_DEPTH_SECONDS, safeSeconds);
  return Math.max(1, Math.ceil(cappedSeconds * resolveDepthFps(fps)));
}

function maxResFromDimensions(width?: number, height?: number) {
  const longEdge = Math.max(Number(width) || 0, Number(height) || 0);
  if (longEdge <= 0) return 0;
  return Math.min(MAX_DEPTH_RES, Math.max(64, Math.round(longEdge / 64) * 64));
}

function snapToMultiple(value: number, multiple = 64) {
  return Math.max(multiple, Math.round(value / multiple) * multiple);
}

function snapDimensionsToDepthCrafter(width?: number, height?: number) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!(w > 0 && h > 0)) return { width: 0, height: 0 };
  const ratio = w / h;
  const centerW = snapToMultiple(w);
  const centerH = snapToMultiple(h);
  let best = { width: centerW, height: centerH };
  let bestSizeError = Number.POSITIVE_INFINITY;
  let bestRatioError = Number.POSITIVE_INFINITY;
  for (let nextWidth = Math.max(64, centerW - 128); nextWidth <= centerW + 128; nextWidth += 64) {
    for (let nextHeight = Math.max(64, centerH - 128); nextHeight <= centerH + 128; nextHeight += 64) {
      const sizeError = Math.hypot(nextWidth - w, nextHeight - h);
      const ratioError = Math.abs(nextWidth / nextHeight - ratio);
      if (sizeError < bestSizeError - 0.5 || (Math.abs(sizeError - bestSizeError) <= 0.5 && ratioError < bestRatioError)) {
        best = { width: nextWidth, height: nextHeight };
        bestSizeError = sizeError;
        bestRatioError = ratioError;
      }
    }
  }
  return best;
}

async function readSourceVideo(sourceUrl: string) {
  const localUrl = normalizeReferenceAssetUrl(sourceUrl);
  const filePath = localUrl.startsWith("/generated/") ? resolveGeneratedFilePath(localUrl) : undefined;
  if (filePath) {
    const bytes = readFileSync(filePath);
    const mime = getVideoMimeType(filePath);
    return { bytes, mime, filename: getFilename(filePath, mime) };
  }
  if (!/^https?:\/\//i.test(sourceUrl)) throw new Error("深度动作捕捉缺少可读取的源视频");
  const response = await safeFetch(sourceUrl);
  if (!response.ok) throw new Error("深度动作捕捉下载源视频失败");
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mime, filename: getFilename(sourceUrl, mime) };
}

async function uploadVideoToRunningHub(input: { sourceUrl: string; apiKey: string; requestId?: string }) {
  const startedAt = Date.now();
  const source = await readSourceVideo(input.sourceUrl);
  const form = new FormData();
  form.append("apiKey", input.apiKey);
  form.append("fileType", "input");
  form.append("file", new Blob([new Uint8Array(source.bytes)], { type: source.mime }), source.filename);
  const response = await runningHubFetch(`${RUNNINGHUB_BASE_URL}/task/openapi/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
  }, 600_000);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const fileName = typeof data.fileName === "string" ? data.fileName.trim() : typeof data.filename === "string" ? data.filename.trim() : "";
  if (!response.ok || payload.code !== 0 || !fileName) {
    void appendGenerationDiagnosticsLog({ event: "runninghub-upload-failed", requestId: input.requestId, mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, status: response.status, durationMs: Date.now() - startedAt, extra: { body: JSON.stringify(payload).slice(0, 500) } });
    throw new Error(getErrorMessage(payload, "深度动作捕捉上传源视频失败"));
  }
  void appendGenerationDiagnosticsLog({ event: "runninghub-upload-success", requestId: input.requestId, mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, durationMs: Date.now() - startedAt, extra: { bytes: source.bytes.byteLength } });
  return fileName;
}

function mapRunningHubStatus(status: unknown) {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "SUCCESS" || value === "COMPLETED" || value === "COMPLETE") return "succeeded";
  if (value === "FAILED" || value === "ERROR") return "failed";
  if (value === "QUEUED" || value === "CREATE") return "queued";
  if (value === "RUNNING") return "running";
  return "running";
}

function getResultVideoUrl(payload: Record<string, unknown>) {
  const nested = payload.data;
  const results = Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(nested)
      ? nested
      : Array.isArray((nested as { results?: unknown } | undefined)?.results)
        ? (nested as { results: unknown[] }).results
        : [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.fileUrl === "string" ? record.fileUrl : typeof record.url === "string" ? record.url : typeof record.video_url === "string" ? record.video_url : "";
    if (/^https?:\/\//i.test(url) && /\.(mp4|mov|webm|mkv)(?:$|\?)/i.test(url)) return url;
  }
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.fileUrl === "string" ? record.fileUrl : typeof record.url === "string" ? record.url : typeof record.video_url === "string" ? record.video_url : "";
    if (/^https?:\/\//i.test(url)) return url;
  }
  return "";
}

export async function createRunningHubDepthTask(input: { sourceUrl: string; duration?: string; durationSeconds?: number; width?: number; height?: number; requestId?: string }) {
  const apiKey = getRequiredRunningHubApiKey();
  const startedAt = Date.now();
  const fileName = await uploadVideoToRunningHub({ sourceUrl: input.sourceUrl, apiKey, requestId: input.requestId });
  // ⭐⭐ 尺寸以**服务端实测的源文件**为准，客户端传来的只当兜底。
  //   ⛔ 反过来（信客户端）会出真问题：2026-09-12 实测一条 Seedance 480p 视频真实是 864×496，
  //      而画布节点声明的是 1280×720 → 发给 DepthCrafter 的 custom_width/height 被写成 1280×704
  //      → ① 成品尺寸和源视频不一样（违反「深度图必须跟源视频同尺寸」）
  //        ② 上游 GPU 直接 `CUDA error: invalid configuration argument` 整条任务失败。
  const probed = await getLocalVideoDimensions(normalizeReferenceAssetUrl(input.sourceUrl)).catch(() => undefined);
  let width = Number(probed?.width) > 0 ? Number(probed?.width) : Number(input.width) || 0;
  let height = Number(probed?.height) > 0 ? Number(probed?.height) : Number(input.height) || 0;
  const fps = resolveDepthFps(probed?.fps);
  const durationSeconds = probed?.durationSeconds ?? (Number(input.durationSeconds) > 0 ? Number(input.durationSeconds) : undefined);
  const snapped = snapDimensionsToDepthCrafter(width, height);
  width = snapped.width;
  height = snapped.height;
  const maxRes = maxResFromDimensions(width, height) || 1920;
  const frameLoadCap = frameLoadCapFromDuration(input.duration, durationSeconds, fps);
  const body = {
    apiKey,
    workflowId: RUNNINGHUB_DEPTHCRAFTER_WORKFLOW_ID,
    addMetadata: false,
    nodeInfoList: [
      { nodeId: DEPTHCRAFTER_NODE_ID, fieldName: "max_res", fieldValue: maxRes },
      { nodeId: DEPTHCRAFTER_NODE_ID, fieldName: "window_size", fieldValue: 40 },
      { nodeId: DEPTHCRAFTER_NODE_ID, fieldName: "overlap", fieldValue: 10 },
      { nodeId: VIDEO_LOAD_NODE_ID, fieldName: "video", fieldValue: fileName },
      ...(width > 0 && height > 0 ? [
        { nodeId: VIDEO_LOAD_NODE_ID, fieldName: "custom_width", fieldValue: width },
        { nodeId: VIDEO_LOAD_NODE_ID, fieldName: "custom_height", fieldValue: height },
      ] : []),
      { nodeId: VIDEO_LOAD_NODE_ID, fieldName: "force_rate", fieldValue: fps },
      { nodeId: VIDEO_LOAD_NODE_ID, fieldName: "frame_load_cap", fieldValue: String(frameLoadCap) },
      { nodeId: VIDEO_COMBINE_NODE_ID, fieldName: "frame_rate", fieldValue: fps },
      { nodeId: VIDEO_COMBINE_NODE_ID, fieldName: "save_output", fieldValue: true },
      { nodeId: VIDEO_COMBINE_NODE_ID, fieldName: "filename_prefix", fieldValue: "depth" },
    ],
  };
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-start", requestId: input.requestId, mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, extra: { workflowId: RUNNINGHUB_DEPTHCRAFTER_WORKFLOW_ID, maxRes, width, height, fps, frameLoadCap } });
  let response: Response;
  try {
    response = await runningHubFetch(`${RUNNINGHUB_BASE_URL}/task/openapi/create`, {
      method: "POST",
      headers: runningHubHeaders(apiKey),
      body: JSON.stringify(body),
    });
  } catch (error) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-fetch-error", requestId: input.requestId, mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, durationMs: Date.now() - startedAt, error });
    throw error;
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const taskId = data.taskId != null ? String(data.taskId) : "";
  if (!response.ok || payload.code !== 0 || !taskId) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-non-ok", requestId: input.requestId, mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, status: response.status, durationMs: Date.now() - startedAt, upstream: { body: JSON.stringify(payload).slice(0, 1500) } });
    throw new Error(getErrorMessage(payload, "深度动作捕捉没有返回任务编号"));
  }
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-success", requestId: input.requestId, mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: response.status, durationMs: Date.now() - startedAt });
  return { taskId, raw: payload };
}

export async function getRunningHubDepthTask(taskId: string) {
  const apiKey = getRequiredRunningHubApiKey();
  const startedAt = Date.now();
  const statusResponse = await runningHubFetch(`${RUNNINGHUB_BASE_URL}/task/openapi/status`, {
    method: "POST",
    headers: runningHubHeaders(apiKey),
    body: JSON.stringify({ apiKey, taskId }),
  });
  const statusPayload = await statusResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!statusResponse.ok) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll-non-ok", mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: statusResponse.status, durationMs: Date.now() - startedAt, extra: { body: JSON.stringify(statusPayload).slice(0, 1500) } });
    throw new Error(getErrorMessage(statusPayload, "查询深度动作捕捉任务失败"));
  }
  const statusCode = typeof statusPayload.code === "number" ? statusPayload.code : 0;
  if (statusCode === 804) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll", mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: statusResponse.status, durationMs: Date.now() - startedAt, extra: { status: "running" } });
    return { id: taskId, status: "running" as const };
  }
  if (statusCode === 805 || mapRunningHubStatus(statusPayload.data ?? statusPayload.status) === "failed") {
    const outputResponse = await runningHubFetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
      method: "POST",
      headers: runningHubHeaders(apiKey),
      body: JSON.stringify({ apiKey, taskId }),
    }).catch(() => undefined);
    const outputPayload = outputResponse ? await outputResponse.json().catch(() => ({})) as Record<string, unknown> : {};
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll", mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: statusResponse.status, durationMs: Date.now() - startedAt, extra: { status: "failed", body: JSON.stringify(statusPayload).slice(0, 800), output: JSON.stringify(outputPayload).slice(0, 1500) } });
    return { id: taskId, status: "failed" as const, error: getErrorMessage(outputPayload, getErrorMessage(statusPayload, "深度动作捕捉失败")) };
  }
  const status = mapRunningHubStatus(statusPayload.data ?? statusPayload.status);
  if (status !== "succeeded") {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll", mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: statusResponse.status, durationMs: Date.now() - startedAt, extra: { status } });
    return { id: taskId, status };
  }
  const outputResponse = await runningHubFetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
    method: "POST",
    headers: runningHubHeaders(apiKey),
    body: JSON.stringify({ apiKey, taskId }),
  });
  const outputPayload = await outputResponse.json().catch(() => ({})) as Record<string, unknown>;
  const outputCode = typeof outputPayload.code === "number" ? outputPayload.code : 0;
  if (outputCode === 804) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll", mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: outputResponse.status, durationMs: Date.now() - startedAt, extra: { status: "running", stage: "outputs" } });
    return { id: taskId, status: "running" as const };
  }
  if (outputCode === 805) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll", mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: outputResponse.status, durationMs: Date.now() - startedAt, extra: { status: "failed", stage: "outputs", body: JSON.stringify(outputPayload).slice(0, 1500) } });
    return { id: taskId, status: "failed" as const, error: getErrorMessage(outputPayload, "深度动作捕捉失败") };
  }
  const videoUrl = getResultVideoUrl(outputPayload);
  void appendGenerationDiagnosticsLog({ event: "video-provider-poll", mode: "video", provider: "runninghub", model: VIDEO_DEPTH_MODEL_ID, taskId, status: outputResponse.status, durationMs: Date.now() - startedAt, extra: { status: videoUrl ? "succeeded" : "running", hasVideoUrl: Boolean(videoUrl) } });
  if (!videoUrl) return { id: taskId, status: "running" as const };
  return {
    id: taskId,
    status: "succeeded" as const,
    video_url: videoUrl,
    result: { video_url: videoUrl },
  };
}
