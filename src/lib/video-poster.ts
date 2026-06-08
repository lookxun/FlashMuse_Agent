import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename, join, parse } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getLocalGeneratedFilePath(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return undefined;
  return join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
}

function createVideoPosterPath(videoUrl: string) {
  const parsed = parse(basename(videoUrl.split("?")[0] || `video-${Date.now()}.mp4`));
  const filename = `${parsed.name || `${Date.now()}-${randomUUID()}`}.jpg`;
  const userMatch = videoUrl.match(/^\/generated\/users\/([^/]+)\/videos\//);
  const posterPublicDirectory = userMatch ? `/generated/users/${userMatch[1]}/video-posters` : "/generated/video-posters";
  const posterDirectory = join(process.cwd(), "public", posterPublicDirectory.replace(/^\//, ""));

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
  await mkdir(poster.directory, { recursive: true });

  if (!existsSync(poster.filePath)) {
    await execFileAsync(ffmpegPath, ["-y", "-ss", "0", "-i", videoPath, "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-frames:v", "1", "-q:v", "3", poster.filePath], { maxBuffer: 20 * 1024 * 1024 });
  }

  return poster.publicUrl;
}
