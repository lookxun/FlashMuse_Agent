// 一次性回填：给「上传的视频」补封面。
//
// 背景：上传视频即时生成封面（同目录 .poster.jpg）是后来才加的功能，早于该功能上传的视频在
// MediaAsset 里 posterUrl 为空、磁盘上也没有 .poster.jpg，所以在对话流/工作流/资产库都显示不出封面。
// 上传链路已在「命中去重复用旧记录」时会现补一次封面（见 src/app/api/upload-file/route.ts
// ensureDedupPosterUrl），本脚本负责把不会被重新上传的历史视频一次性补齐。
//
// 规则与 createUploadedVideoPoster 完全一致：封面 = 视频同目录同名 .poster.jpg。
// 只处理落在本机 public/ 下的上传视频（url 以 /generated/ 开头且不在 /videos/ 目录，
// /videos/ 是生成视频，走另一套 /video-posters/ 方案，不在本脚本范围）。
//
// 用法（本地在项目根目录 / 服务器进容器 /app 目录）：
//   node scripts/backfill-uploaded-video-posters.mjs          # 试跑，只统计不写
//   node scripts/backfill-uploaded-video-posters.mjs --apply  # 真正生成封面 + 写库

import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

function localPath(publicUrl) {
  if (!publicUrl.startsWith("/generated/")) return undefined;
  return join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
}

function posterPublicUrlFor(videoUrl) {
  const clean = videoUrl.split("?")[0].split("#")[0];
  const poster = clean.replace(/\.(mp4|mov|webm)$/i, ".poster.jpg");
  return poster === clean ? undefined : poster;
}

async function main() {
  if (!ffmpegPath) throw new Error("找不到 ffmpeg-static 二进制");
  const assets = await prisma.mediaAsset.findMany({
    where: { mediaType: "video", posterUrl: null, archivedAt: null },
    select: { id: true, userId: true, url: true, normalizedUrl: true, systemName: true },
  });
  let created = 0;
  let reused = 0;
  let skippedGenerated = 0;
  let missingFile = 0;
  let failed = 0;
  for (const asset of assets) {
    const url = asset.url;
    if (!url.startsWith("/generated/") || url.includes("/videos/")) { skippedGenerated += 1; continue; }
    const videoPath = localPath(url);
    const posterUrl = posterPublicUrlFor(url);
    const posterPath = posterUrl ? localPath(posterUrl) : undefined;
    if (!videoPath || !posterUrl || !posterPath) { skippedGenerated += 1; continue; }
    if (!existsSync(videoPath)) { missingFile += 1; continue; }
    const posterExists = existsSync(posterPath);
    if (!posterExists) {
      created += 1;
      if (apply) {
        try {
          await execFileAsync(ffmpegPath, ["-y", "-ss", "0", "-i", videoPath, "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-frames:v", "1", "-q:v", "3", posterPath], { maxBuffer: 20 * 1024 * 1024, timeout: 60_000 });
        } catch (error) {
          created -= 1;
          failed += 1;
          console.warn(`[fail] ${asset.systemName ?? asset.id} ${url}: ${error?.message ?? error}`);
          continue;
        }
      }
    } else {
      reused += 1;
    }
    if (apply) await prisma.mediaAsset.update({ where: { id: asset.id }, data: { posterUrl } });
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", total: assets.length, posterCreated: created, posterAlreadyOnDisk: reused, skippedNotUpload: skippedGenerated, missingFile, failed }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
