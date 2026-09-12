import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename, join, parse } from "node:path";
import { promisify } from "node:util";
import { isInsideGeneratedRoot, resolveGeneratedFilePath } from "@/lib/generated-asset-path";

const execFileAsync = promisify(execFile);

// ⛔⛔ 这里以前是本地手写的 `join(process.cwd(),"public",url)` + 只判 `startsWith("/generated/")`
//    —— 正是 `AGENTS.md` 点名的路径穿越写法（`/generated/../../.env.local` 会被 join 折叠出去）。
//    2026-09-12 起统一走唯一权威 `resolveGeneratedFilePath()`：本文件的入参从「只有我们自己生成的 url」
//    变成了「用户可以指定的源视频」（runninghub.ts 的 getLocalVideoDimensions 就是拿用户传的 sourceUrl 调的）。
function getLocalGeneratedFilePath(publicUrl: string) {
  return resolveGeneratedFilePath(publicUrl);
}

function createVideoPosterPath(videoUrl: string) {
  const parsed = parse(basename(videoUrl.split("?")[0] || `video-${Date.now()}.mp4`));
  const filename = `${parsed.name || `${Date.now()}-${randomUUID()}`}.jpg`;
  const userMatch = videoUrl.match(/^\/generated\/users\/([^/]+)\/videos\//);
  const posterPublicDirectory = userMatch ? `/generated/users/${userMatch[1]}/video-posters` : "/generated/video-posters";
  const posterDirectory = join(process.cwd(), "public", posterPublicDirectory.replace(/^\//, ""));
  // ⛔ `([^/]+)` 能匹配到 `..`，所以写出去之前也必须确认目标目录仍在 public/generated 笼子里。
  if (!isInsideGeneratedRoot(posterDirectory)) return undefined;

  return {
    directory: posterDirectory,
    filePath: join(posterDirectory, filename),
    publicUrl: `${posterPublicDirectory}/${filename}`,
  };
}

export async function createVideoPosterFromLocalVideo(publicVideoUrl: string) {
  const { default: ffmpegPath } = await import("ffmpeg-static");
  if (!ffmpegPath) return undefined;

  const videoPath = getLocalGeneratedFilePath(publicVideoUrl);
  if (!videoPath || !existsSync(videoPath)) return undefined;

  const poster = createVideoPosterPath(publicVideoUrl);
  if (!poster) return undefined;
  await mkdir(poster.directory, { recursive: true });

  if (!existsSync(poster.filePath)) {
    await execFileAsync(ffmpegPath, ["-y", "-ss", "0", "-i", videoPath, "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-frames:v", "1", "-q:v", "3", poster.filePath], { maxBuffer: 20 * 1024 * 1024, timeout: 60_000 });
  }

  return poster.publicUrl;
}

/**
 * 为"上传视频"生成封面。上传视频落在 /generated/.../files/ 下（不进 /videos/），
 * 故封面就放在同目录、同名加 .poster.jpg，客户端 getLocalVideoPosterUrl 用同一规则推算。
 * 与生成视频的 /video-posters/ 方案并存，互不影响。
 */
export async function createUploadedVideoPoster(publicVideoUrl: string) {
  const { default: ffmpegPath } = await import("ffmpeg-static");
  if (!ffmpegPath) return undefined;

  const videoPath = getLocalGeneratedFilePath(publicVideoUrl);
  if (!videoPath || !existsSync(videoPath)) return undefined;

  const cleanUrl = publicVideoUrl.split("?")[0].split("#")[0];
  const posterPublicUrl = cleanUrl.replace(/\.(mp4|mov|webm)$/i, ".poster.jpg");
  if (posterPublicUrl === cleanUrl) return undefined;
  const posterPath = getLocalGeneratedFilePath(posterPublicUrl);
  if (!posterPath) return undefined;

  if (!existsSync(posterPath)) {
    await execFileAsync(ffmpegPath, ["-y", "-ss", "0", "-i", videoPath, "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-frames:v", "1", "-q:v", "3", posterPath], { maxBuffer: 20 * 1024 * 1024, timeout: 60_000 });
  }

  return posterPublicUrl;
}

/**
 * 读取本地视频的真实宽高（用 ffmpeg 解析流信息，无需 ffprobe）。封面被降采样到 640，不能拿来当尺寸，
 * 所以视频尺寸一律走这里。解析不到返回 undefined。
 */
export async function getLocalVideoDimensions(publicVideoUrl: string): Promise<{ width: number; height: number; durationSeconds?: number; fps?: number } | undefined> {
  const { default: ffmpegPath } = await import("ffmpeg-static");
  if (!ffmpegPath) return undefined;
  const videoPath = getLocalGeneratedFilePath(publicVideoUrl);
  if (!videoPath || !existsSync(videoPath)) return undefined;
  // ffmpeg 未指定输出会以非 0 退出，但仍把流信息打到 stderr，这里主动捕获。
  const stderr = await execFileAsync(ffmpegPath, ["-hide_banner", "-i", videoPath], { maxBuffer: 20 * 1024 * 1024, timeout: 60_000 })
    .then((result) => `${result.stdout}${result.stderr}`)
    .catch((error: unknown) => {
      const err = error as { stderr?: string; stdout?: string };
      return `${err.stdout ?? ""}${err.stderr ?? ""}`;
    });
  const videoLine = stderr.split("\n").find((line) => /Stream #.*Video:/.test(line));
  const match = videoLine?.match(/,\s*(\d{2,5})x(\d{2,5})/);
  if (!match) return undefined;
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return undefined;
  // 同时解析真实时长（精确到 0.1 秒），供参考视频总时长校验用。
  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationRaw = durationMatch ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]) : undefined;
  const durationSeconds = typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw * 10) / 10 : undefined;
  const fpsMatch = videoLine?.match(/(\d+(?:\.\d+)?)\s*fps/i) ?? videoLine?.match(/(\d+)\/(\d+)\s*fps/i);
  const tbrMatch = videoLine?.match(/(\d+(?:\.\d+)?)\s*tbr/i);
  let fps: number | undefined;
  if (fpsMatch?.[2]) {
    const num = Number(fpsMatch[1]);
    const den = Number(fpsMatch[2]);
    if (num > 0 && den > 0) fps = num / den;
  } else if (fpsMatch?.[1]) {
    fps = Number(fpsMatch[1]);
  } else if (tbrMatch?.[1]) {
    fps = Number(tbrMatch[1]);
  }
  if (!(typeof fps === "number" && Number.isFinite(fps) && fps > 0 && fps <= 120)) fps = undefined;
  return { width, height, durationSeconds, fps };
}
