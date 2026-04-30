import { DEFAULT_VIDEO_MODEL } from "@/lib/models";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

type VideoSettings = {
  ratio?: string;
  resolution?: string;
  duration?: string;
};

function getLocalEnvValue(name: string) {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) return undefined;

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith(`${name}=`));

  return line?.split("=").slice(1).join("=").trim();
}

export type SeedanceCreateTaskResponse = {
  id?: string;
  taskId?: string;
  task_id?: string;
  success?: boolean;
  code?: string | null;
  msg?: string | null;
  message?: string | null;
  data?: {
    id?: string;
    taskId?: string;
    task_id?: string;
    message?: string;
    status?: number;
    success?: boolean;
  };
  result?: {
    id?: string;
    taskId?: string;
    task_id?: string;
  };
};

function getSeedanceConfig() {
  const baseUrl = getLocalEnvValue("SEEDANCE_BASE_URL") || process.env.SEEDANCE_BASE_URL;
  const projectCode = getLocalEnvValue("SEEDANCE_PROJECT_CODE") || process.env.SEEDANCE_PROJECT_CODE;
  const accessKey = getLocalEnvValue("SEEDANCE_ACCESS_KEY") || process.env.SEEDANCE_ACCESS_KEY;
  const secretKey = getLocalEnvValue("SEEDANCE_SECRET_KEY") || process.env.SEEDANCE_SECRET_KEY;

  if (!baseUrl || !projectCode || !accessKey || !secretKey) {
    throw new Error("缺少 Seedance 配置");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    headers: {
      projectCode,
      "X-Access-Key": accessKey,
      "X-Secret-Key": secretKey,
    },
  };
}

export async function createSeedanceVideoTask(prompt: string) {
  return createSeedanceVideoTaskWithReferences(prompt);
}

function getVideoDuration(value?: string) {
  const match = value?.match(/\d+/)?.[0];
  return match ? Number(match) : 5;
}

function getVideoResolution() {
  return "720p";
}

function getVideoScale(value?: string) {
  return value ?? "16:9";
}

function getVideoMode(referenceImageCount: number) {
  if (referenceImageCount >= 2) return "first_last_frame";
  if (referenceImageCount === 1) return "image_to_video";
  return undefined;
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

export async function createSeedanceVideoTaskWithReferences(prompt: string, referenceImages: string[] = [], settings?: VideoSettings) {
  const config = getSeedanceConfig();
  const resources = referenceImages.filter(Boolean).map(toDataUrlIfLocalPublicAsset);
  const mode = getVideoMode(resources.length);

  const response = await fetch(`${config.baseUrl}/openApi/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...config.headers,
    },
    body: JSON.stringify({
      modelId: DEFAULT_VIDEO_MODEL,
      abilityType: "VIDEO",
      prompt,
      payload: {
        resources,
        referVideoUrl: [],
        referAudioUrl: [],
        params: {
          ...(mode ? { mode } : {}),
          resolution: getVideoResolution(),
          scale: getVideoScale(settings?.ratio),
          duration: getVideoDuration(settings?.duration),
          generateAudio: false,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seedance 创建任务失败：${text}`);
  }

  return (await response.json()) as SeedanceCreateTaskResponse;
}

export async function getSeedanceVideoTask(taskId: string) {
  const config = getSeedanceConfig();

  const response = await fetch(`${config.baseUrl}/openApi/queryResult`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...config.headers,
    },
    body: JSON.stringify({
      taskId,
      abilityType: "VIDEO",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seedance 查询任务失败：${text}`);
  }

  return (await response.json()) as {
    id?: string;
    status?: string;
    success?: boolean;
    code?: string | null;
    msg?: string | null;
    data?: {
      status?: number;
      message?: string;
      taskId?: string;
      success?: boolean;
    };
    content?: { video_url?: string };
    error?: { message?: string };
  };
}
