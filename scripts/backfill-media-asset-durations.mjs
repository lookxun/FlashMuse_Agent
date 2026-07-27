// 一次性回填：给视频资产补真实时长 durationSeconds。
//
// 背景：MediaAsset.durationSeconds 是后来才开始写的，早期的生成视频/上传视频这列为空，
// 导致资产库视频卡左上角的「时长角标」（MediaDurationBadge）显示不出来。
// 时长的显示口径见 src/lib/media-duration-format.ts + chat-workbench 的 getAssetDurationSeconds：
// 优先 durationSeconds，其次解析 previewMeta/videoDuration 里的「N秒」文案。本脚本补第一手数据。
//
// 只处理落在本机 public/ 下的视频（url 以 /generated/ 开头）。远程 provider 临时地址
// （tos/ark 这类带签名过期的历史脏数据）取不到文件，一律跳过。
//
// 用法（本地在项目根目录 / 服务器进容器 /app 目录）：
//   node scripts/backfill-media-asset-durations.mjs          # 试跑，只统计不写
//   node scripts/backfill-media-asset-durations.mjs --apply  # 真正写库

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
  const clean = publicUrl.split("?")[0].split("#")[0];
  return join(process.cwd(), "public", clean.replace(/^\//, ""));
}

/** 用 ffmpeg 读时长（项目只装了 ffmpeg-static，没有 ffprobe）：解析 stderr 里的 `Duration: HH:MM:SS.xx`。 */
async function readDurationSeconds(filePath) {
  let stderr = "";
  try {
    const result = await execFileAsync(ffmpegPath, ["-i", filePath], { maxBuffer: 20 * 1024 * 1024, timeout: 60_000 });
    stderr = result.stderr ?? "";
  } catch (error) {
    // ffmpeg 只给 -i 不给输出文件时必然以非 0 退出，但 stderr 里已经有 Duration 了。
    stderr = error?.stderr ?? "";
  }
  const matched = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!matched) return undefined;
  const seconds = Number(matched[1]) * 3600 + Number(matched[2]) * 60 + Number(matched[3]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

async function main() {
  if (!ffmpegPath) throw new Error("找不到 ffmpeg-static 二进制");
  const assets = await prisma.mediaAsset.findMany({
    where: { mediaType: { in: ["video", "audio"] }, durationSeconds: null, archivedAt: null },
    select: { id: true, url: true, mediaType: true, systemName: true },
  });
  let filled = 0;
  let skippedRemote = 0;
  let missingFile = 0;
  let failed = 0;
  for (const asset of assets) {
    const filePath = localPath(asset.url);
    if (!filePath) { skippedRemote += 1; continue; }
    if (!existsSync(filePath)) { missingFile += 1; continue; }
    const seconds = await readDurationSeconds(filePath);
    if (!seconds) {
      failed += 1;
      console.warn(`[fail] ${asset.systemName ?? asset.id} ${asset.url}`);
      continue;
    }
    filled += 1;
    if (apply) await prisma.mediaAsset.update({ where: { id: asset.id }, data: { durationSeconds: seconds } });
    else console.log(`[dry-run] ${asset.mediaType} ${asset.systemName ?? asset.id} -> ${seconds.toFixed(2)}s`);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", candidates: assets.length, filled, skippedRemoteUrl: skippedRemote, missingFile, failed }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
