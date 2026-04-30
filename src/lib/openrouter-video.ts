import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { DEFAULT_VIDEO_MODEL } from "@/lib/models";

type VideoSettings = {
  ratio?: string;
  resolution?: string;
  duration?: string;
};

type OpenRouterVideoImage = {
  type: "image_url";
  image_url: { url: string };
};

export type OpenRouterVideoTask = {
  id?: string;
  generation_id?: string;
  polling_url?: string;
  pollingUrl?: string;
  status?: string;
  unsigned_urls?: string[];
  content?: { video_url?: string; remote_video_url?: string };
  error?: { message?: string } | string;
};

const OPENROUTER_VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const execFileAsync = promisify(execFile);

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

function getLocalEnvValue(name: string) {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) return undefined;

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith(`${name}=`));

  return line?.split("=").slice(1).join("=").trim();
}

function getOpenRouterApiKey() {
  return getLocalEnvValue("OPENROUTER_API_KEY") || process.env.OPENROUTER_API_KEY;
}

export function getOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Yinzao",
  };
}

export function getRequiredOpenRouterApiKey() {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error("缺少 OpenRouter API Key");
  return apiKey;
}

function getMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

function toDataUrlIfLocalPublicAsset(url: string) {
  if (!url.startsWith("/generated/")) return url;

  const filePath = join(process.cwd(), "public", url.replace(/^\//, ""));
  if (!existsSync(filePath)) return url;

  const data = readFileSync(filePath);
  return `data:${getMimeType(filePath)};base64,${data.toString("base64")}`;
}

function getDuration() {
  return 4;
}

function getResolution() {
  return "720p";
}

function getAspectRatio(value?: string) {
  return value || "16:9";
}

function isShortVideoPrompt(prompt: string) {
  const normalized = prompt.replace(/[\s，。,.!?！？、；;：:「」“”"'（）()【】\[\]]/g, "");
  return normalized.length < 28;
}

function getSafeVideoPrompt(prompt: string) {
  if (!isShortVideoPrompt(prompt)) return prompt;

  return `以“${prompt}”为核心生成一段 4 秒写实电影感视频：主体清晰出现在画面中央，场景干净有层次，主体做一个自然的小动作并看向镜头，镜头缓慢推进，柔和自然光，浅景深，画面稳定流畅，高级质感。`;
}

function toOpenRouterImage(url: string): OpenRouterVideoImage {
  return {
    type: "image_url",
    image_url: { url: toDataUrlIfLocalPublicAsset(url) },
  };
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

export async function createOpenRouterVideoTask(prompt: string, referenceImages: string[] = [], settings?: VideoSettings) {
  const apiKey = getRequiredOpenRouterApiKey();

  const images = referenceImages.filter(Boolean).map(toOpenRouterImage);
  const frameImages = images.slice(0, 2).map((image, index) => ({
    ...image,
    frame_type: index === 0 ? "first_frame" : "last_frame",
  }));

  const response = await fetch(OPENROUTER_VIDEOS_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model: DEFAULT_VIDEO_MODEL,
      prompt: getSafeVideoPrompt(prompt),
      duration: getDuration(),
      resolution: getResolution(),
      aspect_ratio: getAspectRatio(settings?.ratio),
      generate_audio: false,
      ...(frameImages.length > 0 ? { frame_images: frameImages } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "OpenRouter 视频任务创建失败"));
  }

  return (await response.json()) as OpenRouterVideoTask;
}

export async function getOpenRouterVideoTask(taskId: string) {
  const apiKey = getRequiredOpenRouterApiKey();

  const url = /^https?:\/\//.test(taskId)
    ? taskId
    : taskId.startsWith("/api/")
      ? `https://openrouter.ai${taskId}`
      : `${OPENROUTER_VIDEOS_URL}/${encodeURIComponent(taskId)}`;

  const headers = getOpenRouterHeaders(apiKey);
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (response.status === 404) {
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
    throw new Error(`${await getOpenRouterError(response, "OpenRouter 视频任务查询失败")}，查询地址：${url}`);
  }

  return (await response.json()) as OpenRouterVideoTask;
}
