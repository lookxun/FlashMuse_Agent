import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendGenerationDiagnosticsLog, summarizeGeneratedReference } from "@/lib/generation-diagnostics-log";
import { DEFAULT_VIDEO_MODEL, HAILUO3_SUPPORTED_DURATION_SECONDS, HAILUO3_VIDEO_MODEL_ID, resolveVideoSettingsForModel } from "@/lib/models";
import { getBytePlusBaseUrl, getBytePlusModelForRequest, getConfiguredBytePlusApiKey, getConfiguredOpenRouterApiKey } from "@/lib/system-settings";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";
import { toDataUrlIfLocalPublicAsset } from "@/lib/generated-asset-path";

type VideoSettings = {
  ratio?: string;
  resolution?: string;
  duration?: string;
};

export type VideoReferenceMode = "reference" | "first_frame" | "last_frame" | "first_last_frame";

type OpenRouterVideoImage = {
  type: "image_url";
  image_url: { url: string };
};

type BytePlusVideoReference = {
  type: "video_url";
  video_url: { url: string };
  role: "reference_video";
};

type BytePlusAudioReference = {
  type: "audio_url";
  audio_url: { url: string };
  role: "reference_audio";
};

export type OpenRouterVideoTask = {
  id?: string;
  generation_id?: string;
  polling_url?: string;
  pollingUrl?: string;
  status?: string;
  unsigned_urls?: string[];
  content?: { video_url?: string; remote_video_url?: string };
  /**
   * ⭐ 2026-08-03 实测确认**确实会返回**（以前这里没声明，导致"扣费到底拿不拿得到成本"查不清）：
   * `GET /api/v1/videos/{id}` 对已完成任务返回 `{"status":"completed","usage":{"cost":1.95,"is_byok":false}}`
   * （MiniMax H3 15 秒 2K）。整条按成本扣费链路就靠这个 `cost`
   * （`video-usage-cost.ts` → `chargeCredits`）。⛔ 别删这个字段声明。
   */
  usage?: { cost?: number; is_byok?: boolean; [key: string]: unknown };
  error?: { message?: string; code?: string | number } | string;
};

type CreateVideoOptions = {
  generateAudio?: boolean;
};

const OPENROUTER_VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const execFileAsync = promisify(execFile);

// `unlock` = 该账号的「解除限制」开关；传 undefined 回落全局 env（见 getBytePlusModelForRequest）。
function getBytePlusVideoModelName(modelId?: string, providerKey?: string, unlock?: boolean) {
  if (modelId === "byteplus:video.seedance-2-0-fast") return getBytePlusModelForRequest(providerKey ?? "video.seedance-2-0-fast", unlock);
  if (modelId === "byteplus:video.seedance-2-0-mini") return getBytePlusModelForRequest(providerKey ?? "video.seedance-2-0-mini", unlock);
  if (modelId === "byteplus:video.seedance-2-0") return getBytePlusModelForRequest(providerKey ?? "video.seedance-2-0", unlock);
  return undefined;
}

function getCurlCommand() {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function toCurlHeaderArgs(headers: Record<string, string>) {
  return Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
}

async function curlGetJson(url: string, headers: Record<string, string>) {
  const { stdout } = await execFileAsync(getCurlCommand(), ["-sS", "-L", ...toCurlHeaderArgs(headers), url], { maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(stdout) as OpenRouterVideoTask;
}

function getOpenRouterApiKey() {
  return getConfiguredOpenRouterApiKey();
}

/**
 * 视频任务返回体里的失败原文摘要（唯一实现，创建/轮询两处日志共用）。
 *
 * ⭐ 为什么必须有：以前这两处日志只记 `hasError: true` 这个布尔，
 * 上游（BytePlus/OpenRouter）真正的失败 code/message 一个字都没落盘 →
 * 后台概览里那些「服务器繁忙」事后完全查不出真实原因（踩过坑：40 条视频失败查不到根因）。
 * 所以只要返回体带 error，就把 code + message 原文（截断）一起记进日志。
 */
function summarizeVideoTaskError(task: OpenRouterVideoTask) {
  const raw = task.error;
  if (!raw) return undefined;
  if (typeof raw === "string") return { errorMessage: raw.slice(0, 600) };
  const code = raw.code === undefined || raw.code === null ? undefined : String(raw.code);
  const message = typeof raw.message === "string" ? raw.message.slice(0, 600) : undefined;
  if (!code && !message) return { errorRaw: JSON.stringify(raw).slice(0, 600) };
  return { ...(code ? { errorCode: code } : {}), ...(message ? { errorMessage: message } : {}) };
}

/**
 * ⭐ 轮询日志的事件名（2026-07-29 加）。
 *
 * ⛔ 以前不管任务成功失败，只要 HTTP 200 就一律记 `video-provider-poll-success` ——
 * "success" 指的是**这次查询通了**，可是任务 `status:"failed"` 的失败也叫 success。
 * 排 A3 时被这个名字带偏过：以为"轮询阶段零日志"，实际线上有近 4 万条，只是全叫 success。
 * 现在任务真失败时单独叫 `video-provider-poll-failed`，一眼能 grep 出来。
 */
function getVideoPollEvent(task: OpenRouterVideoTask) {
  const status = typeof task.status === "string" ? task.status.toLowerCase() : "";
  const failed = status.includes("fail") || status === "error" || status === "canceled" || status === "cancelled";
  return failed || task.error ? "video-provider-poll-failed" : "video-provider-poll-success";
}

export function getOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "FlashMuse",
  };
}

function getBytePlusHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function getRequiredOpenRouterApiKey() {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error("缺少 API Key");
  return apiKey;
}

// ⭐ `getMimeType` + `toDataUrlIfLocalPublicAsset` 已收敛到唯一权威实现
//   `lib/generated-asset-path.ts`（原先本文件、openrouter.ts、seedance.ts 三处一字不差地各存一份，
//    且三份都只用 `startsWith("/generated/")` 判断、拦不住 `..` 路径穿越 → 能读到 .env.local）。
//   ⛔ 禁止在本文件里再写一份，改动请改那个模块。

function toPublicGeneratedAssetUrl(value: string) {
  // 给平台的地址必须是**文件静态直链**：先过唯一权威归一化（剥自家主机前缀、把
  // `/api/media-thumbnail?url=` 动态缩略图接口还原成原图），再按当前环境拼公网 base。
  const url = normalizeReferenceAssetUrl(value);
  if (!url) return url;
  if (url.startsWith("/generated/")) {
    const base = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL || process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "https://main.venusface.com").replace(/\/$/, "");
    return `${base}${url}`;
  }
  return url;
}

function getClosestDuration(seconds: number, supported: number[]) {
  return supported.reduce((best, item) => (Math.abs(item - seconds) < Math.abs(best - seconds) ? item : best), supported[0]);
}

function getDuration(model: string, value?: string) {
  const seconds = Number(value?.match(/\d+/)?.[0]);
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 5;

  if (model.startsWith("byteplus:video.")) return Math.min(15, Math.max(4, safeSeconds));
  if (model === "google/veo-3.1") return getClosestDuration(safeSeconds, [4, 6, 8]);
  if (model === "kwaivgi/kling-video-o1") return getClosestDuration(safeSeconds, [5, 10]);
  // Hailuo 3：OpenRouter 声明 5~15 整秒（官方 4~15，OpenRouter 从 5 起）→ 4 秒必须就近取到 5，否则上游 400。
  if (model === HAILUO3_VIDEO_MODEL_ID) return getClosestDuration(safeSeconds, HAILUO3_SUPPORTED_DURATION_SECONDS);

  return safeSeconds;
}

/**
 * OpenRouter 侧支持 `frame_images`（首帧/尾帧）的模型 —— 依据是
 * `GET /api/v1/videos/models` 的 `supported_frame_images` 字段。
 * ⛔ 别拿 BytePlus 那套 role 名字去猜：OpenRouter 用的是独立字段 `frame_images[].frame_type`。
 */
function supportsOpenRouterFrameImages(model: string) {
  return model === HAILUO3_VIDEO_MODEL_ID;
}

/**
 * 首帧/首尾帧模式 → 组装 OpenRouter 的 `frame_images`；其它情况返回 undefined（走 `input_references`）。
 * ⭐ OpenRouter 文档：两个字段同时给时 `frame_images` 优先、整个请求按图生视频处理 —— 所以这里二选一，不同时发。
 */
function getOpenRouterFrameImages(model: string, images: OpenRouterVideoImage[], mode?: VideoReferenceMode) {
  if (!supportsOpenRouterFrameImages(model) || images.length === 0) return undefined;
  if (mode === "first_last_frame") {
    const [first, last] = images;
    if (!first || !last) return undefined;
    return [{ ...first, frame_type: "first_frame" as const }, { ...last, frame_type: "last_frame" as const }];
  }
  if (mode === "first_frame") return [{ ...images[0], frame_type: "first_frame" as const }];
  if (mode === "last_frame") return [{ ...images[0], frame_type: "last_frame" as const }];
  return undefined;
}

function toOpenRouterImage(url: string): OpenRouterVideoImage {
  return {
    type: "image_url",
    image_url: { url: toDataUrlIfLocalPublicAsset(url) },
  };
}

function getBytePlusReferenceRole(index: number, mode?: VideoReferenceMode) {
  if (mode === "first_last_frame") {
    if (index === 0) return "first_frame";
    if (index === 1) return "last_frame";
  }
  if (mode === "first_frame" && index === 0) return "first_frame";
  return "reference_image";
}

export function getBytePlusEffectiveReferenceImages(referenceImages: string[] = [], mode?: VideoReferenceMode) {
  const images = referenceImages.filter(Boolean);
  if (mode === "first_last_frame") return images.slice(0, 2);
  if (mode === "first_frame") return images.slice(0, 1);
  return images.slice(0, 9);
}

async function getOpenRouterError(response: Response, fallback: string) {
  const text = await response.text();

  try {
    const data = JSON.parse(text) as { error?: { message?: string; code?: number | string } };
    const message = data.error?.message ?? text;
    return `${fallback}：${message}`;
  } catch {
    return `${fallback}：${text}`;
  }
}

async function postOpenRouterVideoTask(prompt: string, referenceImages: string[] = [], settings?: VideoSettings, model = DEFAULT_VIDEO_MODEL, options: CreateVideoOptions & { requestId?: string; referenceMode?: VideoReferenceMode } = {}) {
  const apiKey = getRequiredOpenRouterApiKey();

  const images = referenceImages.filter(Boolean).map(toOpenRouterImage);
  const frameImages = getOpenRouterFrameImages(model, images, options.referenceMode);
  const videoSettings = resolveVideoSettingsForModel(model, settings);
  const startedAt = Date.now();
  const body = {
    model,
    prompt,
    duration: getDuration(model, settings?.duration),
    resolution: videoSettings.resolution,
    aspect_ratio: videoSettings.ratio,
    generate_audio: options.generateAudio ?? true,
    // 首帧/首尾帧 → frame_images；其余（含融合/普通参考）→ input_references。二者互斥，不同时发。
    ...(frameImages ? { frame_images: frameImages } : images.length > 0 ? { input_references: images } : {}),
  };
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-start", requestId: options.requestId, mode: "video", provider: "openrouter", model, prompt, settings, references: referenceImages.map((url, index) => summarizeGeneratedReference(url, index)), extra: { url: OPENROUTER_VIDEOS_URL, generateAudio: options.generateAudio ?? true, videoSettings, referenceMode: options.referenceMode, frameImageCount: frameImages?.length ?? 0 } });

  let response: Response;
  try {
    response = await fetch(OPENROUTER_VIDEOS_URL, {
      method: "POST",
      headers: getOpenRouterHeaders(apiKey),
      body: JSON.stringify(body),
    });
  } catch (error) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-fetch-error", requestId: options.requestId, mode: "video", provider: "openrouter", model, prompt, settings, references: referenceImages.map((url, index) => summarizeGeneratedReference(url, index)), durationMs: Date.now() - startedAt, error });
    throw error;
  }

  if (!response.ok) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-non-ok", requestId: options.requestId, mode: "video", provider: "openrouter", model, status: response.status, prompt, settings, references: referenceImages.map((url, index) => summarizeGeneratedReference(url, index)), durationMs: Date.now() - startedAt, upstream: { statusText: response.statusText, body: await response.clone().text().catch(() => "") } });
    throw new Error(await getOpenRouterError(response, "视频任务创建失败"));
  }

  const data = (await response.json()) as OpenRouterVideoTask;
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-success", requestId: options.requestId, mode: "video", provider: "openrouter", model, taskId: data.polling_url ?? data.pollingUrl ?? data.id ?? data.generation_id, status: response.status, prompt, settings, references: referenceImages.map((url, index) => summarizeGeneratedReference(url, index)), durationMs: Date.now() - startedAt, upstream: { status: data.status, hasError: Boolean(data.error), ...summarizeVideoTaskError(data), hasUnsignedUrls: Boolean(data.unsigned_urls?.length) } });
  return data;
}

export async function createOpenRouterVideoTask(prompt: string, referenceImages: string[] = [], settings?: VideoSettings, model = DEFAULT_VIDEO_MODEL, options?: { bytePlusProviderKey?: string; referenceMode?: VideoReferenceMode; referenceVideos?: string[]; referenceAudios?: string[]; requestId?: string; unlockLimits?: boolean }) {
  if (getBytePlusVideoModelName(model, options?.bytePlusProviderKey, options?.unlockLimits)) return createBytePlusVideoTask(prompt, referenceImages, settings, model, options?.bytePlusProviderKey, options?.referenceMode, options?.referenceVideos, options?.referenceAudios, options?.requestId, options?.unlockLimits);

  try {
    return await postOpenRouterVideoTask(prompt, referenceImages, settings, model, { generateAudio: true, requestId: options?.requestId, referenceMode: options?.referenceMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/audio|generate_audio|sound|voice/i.test(message)) {
      void appendGenerationDiagnosticsLog({ event: "video-provider-create-retry-without-audio", requestId: options?.requestId, mode: "video", provider: "openrouter", model, prompt, settings, references: referenceImages.map((url, index) => summarizeGeneratedReference(url, index)), error });
      return postOpenRouterVideoTask(prompt, referenceImages, settings, model, { generateAudio: false, requestId: options?.requestId, referenceMode: options?.referenceMode });
    }

    throw error;
  }
}

async function createBytePlusVideoTask(prompt: string, referenceImages: string[] = [], settings?: VideoSettings, model = DEFAULT_VIDEO_MODEL, bytePlusProviderKey?: string, referenceMode?: VideoReferenceMode, referenceVideos: string[] = [], referenceAudios: string[] = [], requestId?: string, unlockLimits?: boolean) {
  const apiKey = getConfiguredBytePlusApiKey();
  if (!apiKey) throw new Error("缺少 BytePlus API Key");

  const bytePlusModel = getBytePlusVideoModelName(model, bytePlusProviderKey, unlockLimits);
  if (!bytePlusModel) throw new Error("连接不到模型，请联系管理员！");

  const videoSettings = resolveVideoSettingsForModel(model, settings);
  const images = getBytePlusEffectiveReferenceImages(referenceImages, referenceMode).map((url, index) => ({
    type: "image_url",
    image_url: { url: toDataUrlIfLocalPublicAsset(url) },
    role: getBytePlusReferenceRole(index, referenceMode),
  }));
  const videos: BytePlusVideoReference[] = referenceVideos.filter(Boolean).slice(0, 3).map((url) => ({
    type: "video_url",
    video_url: { url: toPublicGeneratedAssetUrl(url) },
    role: "reference_video",
  }));
  const audios: BytePlusAudioReference[] = referenceAudios.filter(Boolean).slice(0, 3).map((url) => ({
    type: "audio_url",
    audio_url: { url: toPublicGeneratedAssetUrl(url) },
    role: "reference_audio",
  }));
  const body = {
    model: bytePlusModel,
    content: [
      { type: "text", text: prompt },
      ...images,
      ...videos,
      ...audios,
    ],
    resolution: videoSettings.resolution,
    ratio: videoSettings.ratio,
    duration: getDuration(model, settings?.duration),
    generate_audio: true,
    watermark: false,
  };

  const url = `${getBytePlusBaseUrl()}/contents/generations/tasks`;
  const startedAt = Date.now();
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-start", requestId, mode: "video", provider: "byteplus", model, responseModel: bytePlusModel, prompt, settings, references: [...referenceImages.map((item, index) => summarizeGeneratedReference(item, index, getBytePlusReferenceRole(index, referenceMode))), ...referenceVideos.map((item, index) => summarizeGeneratedReference(item, index, "reference_video")), ...referenceAudios.map((item, index) => summarizeGeneratedReference(item, index, "reference_audio"))], extra: { url, referenceMode, videoSettings, imageCount: images.length, videoCount: videos.length, audioCount: audios.length } });
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: getBytePlusHeaders(apiKey),
      body: JSON.stringify(body),
    });
  } catch (error) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-fetch-error", requestId, mode: "video", provider: "byteplus", model, responseModel: bytePlusModel, prompt, settings, durationMs: Date.now() - startedAt, error, extra: { url, referenceMode, imageCount: images.length, videoCount: videos.length, audioCount: audios.length } });
    throw error;
  }

  if (!response.ok) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-create-non-ok", requestId, mode: "video", provider: "byteplus", model, responseModel: bytePlusModel, status: response.status, prompt, settings, durationMs: Date.now() - startedAt, upstream: { url, statusText: response.statusText, body: await response.clone().text().catch(() => "") } });
    throw new Error(await getOpenRouterError(response, "BytePlus 视频任务创建失败"));
  }

  const data = (await response.json()) as OpenRouterVideoTask;
  void appendGenerationDiagnosticsLog({ event: "video-provider-create-success", requestId, mode: "video", provider: "byteplus", model, responseModel: bytePlusModel, taskId: data.id ?? data.generation_id ?? data.polling_url ?? data.pollingUrl, status: response.status, prompt, settings, durationMs: Date.now() - startedAt, upstream: { status: data.status, hasError: Boolean(data.error), ...summarizeVideoTaskError(data), hasUnsignedUrls: Boolean(data.unsigned_urls?.length) } });
  return data;
}

export async function getOpenRouterVideoTask(taskId: string) {
  if (/^cgt-/i.test(taskId)) return getBytePlusVideoTask(taskId);

  const apiKey = getRequiredOpenRouterApiKey();

  const url = /^https?:\/\//.test(taskId)
    ? taskId
    : taskId.startsWith("/api/")
      ? `https://openrouter.ai${taskId}`
      : `${OPENROUTER_VIDEOS_URL}/${encodeURIComponent(taskId)}`;

  const headers = getOpenRouterHeaders(apiKey);
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (response.status === 404) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll-404", mode: "video", provider: "openrouter", taskId, status: response.status, durationMs: Date.now() - startedAt, upstream: { url } });
    try {
      return await curlGetJson(url, headers);
    } catch {
      // OpenRouter can briefly return 404 before the job is visible; keep polling.
    }

    return {
      id: taskId,
      polling_url: url,
      status: "pending",
    } satisfies OpenRouterVideoTask;
  }

  if (!response.ok) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll-non-ok", mode: "video", provider: "openrouter", taskId, status: response.status, durationMs: Date.now() - startedAt, upstream: { url, statusText: response.statusText, body: await response.clone().text().catch(() => "") } });
    throw new Error(await getOpenRouterError(response, "视频任务查询失败"));
  }

  const data = (await response.json()) as OpenRouterVideoTask;
  void appendGenerationDiagnosticsLog({ event: getVideoPollEvent(data), mode: "video", provider: "openrouter", taskId, status: response.status, durationMs: Date.now() - startedAt, upstream: { status: data.status, hasVideoUrl: Boolean(data.content?.video_url || data.unsigned_urls?.length), hasError: Boolean(data.error), ...summarizeVideoTaskError(data) } });
  return data;
}

async function getBytePlusVideoTask(taskId: string) {
  const apiKey = getConfiguredBytePlusApiKey();
  if (!apiKey) throw new Error("缺少 BytePlus API Key");

  const url = `${getBytePlusBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`;
  const headers = getBytePlusHeaders(apiKey);
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    void appendGenerationDiagnosticsLog({ event: "video-provider-poll-non-ok", mode: "video", provider: "byteplus", taskId, status: response.status, durationMs: Date.now() - startedAt, upstream: { url, statusText: response.statusText, body: await response.clone().text().catch(() => "") } });
    throw new Error(await getOpenRouterError(response, "BytePlus 视频任务查询失败"));
  }

  const data = (await response.json()) as OpenRouterVideoTask;
  void appendGenerationDiagnosticsLog({ event: getVideoPollEvent(data), mode: "video", provider: "byteplus", taskId, status: response.status, durationMs: Date.now() - startedAt, upstream: { status: data.status, hasVideoUrl: Boolean(data.content?.video_url || data.unsigned_urls?.length), hasError: Boolean(data.error), ...summarizeVideoTaskError(data) } });
  return data;
}
