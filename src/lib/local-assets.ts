import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { appendUploadDiagnosticsLog } from "@/lib/upload-diagnostics-log";
import { getCompressionQualityPercent, getGenerationCompressionSettings } from "@/lib/system-settings";
import { IMAGE_UPLOAD_RECOMPRESS_OVER_BYTES, IMAGE_UPLOAD_RECOMPRESS_QUALITY } from "@/lib/image-upload-validation";
import { safeFetch } from "@/lib/ssrf-guard";

type AssetType = "image" | "video";
type SaveAssetOptions = { userId?: string; diagnostics?: { requestId?: string; fileName?: string; fileSize?: number }; keepTransparent?: boolean };

const GENERATED_ROOT = join(process.cwd(), "public", "generated");
const ASSET_UPLOAD_TEMP_ROOT = join(process.cwd(), ".runtime", "asset-upload-temp");
const execFileAsync = promisify(execFile);
// 单次远程下载超时（含 fetch 建连+读 body）。跨境下载偶尔会"假死"——连接挂住但既不完成也不报错，
// Node fetch 默认永不超时，会让存盘任务永久卡在"下载中"。这里强制超时：到点 abort→抛错→上层按失败重试，
// 直到成功或远程地址过期。正常 15s 视频原始下载远快于此（整段存盘 p99 约 3 分钟且含转码/同步）。
const REMOTE_DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;

function isJpegMime(mimeType?: string | null) {
  return /^image\/jpe?g(?:;|$)/i.test(mimeType ?? "");
}

function jpegNeedsReencode(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return true;

  let offset = 2;
  while (offset + 3 < buffer.length) {
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= buffer.length) return true;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return true;

    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (length < 8) return true;
      const componentCount = buffer[offset + 7];
      if (componentCount !== 3) return true;
      const factors = [0, 1, 2].map((index) => buffer[offset + 8 + index * 3 + 1]);
      return !(factors[0] === 0x22 && factors[1] === 0x11 && factors[2] === 0x11);
    }

    offset += length;
  }

  return true;
}

export type ImageDimensions = {
  width: number;
  height: number;
};

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function getAssetFolder(type: AssetType) {
  return type === "image" ? "images" : "videos";
}

function getSafeUserSegment(userId?: string) {
  const safeUserId = userId?.trim().replace(/[^A-Za-z0-9_-]/g, "_");
  return safeUserId ? join("users", safeUserId) : "";
}

function getGeneratedFolder(folder: string, options: SaveAssetOptions = {}) {
  const userSegment = getSafeUserSegment(options.userId);
  return userSegment ? join(userSegment, folder) : folder;
}

function getExtensionFromMime(mimeType?: string | null) {
  if (!mimeType) return undefined;
  return mimeExtensions[mimeType.split(";")[0].trim().toLowerCase()];
}

function getExtensionFromUrl(url: string) {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);/i);
    return getExtensionFromMime(match?.[1]);
  }

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // Uploads pass ordinary filenames such as "voice.wav", not only absolute URLs.
    pathname = url.split(/[?#]/, 1)[0] ?? url;
  }
  const extension = extname(pathname).replace(/^\./, "").toLowerCase();
  return extension || undefined;
}

function parseDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:")) return undefined;
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return undefined;

  const header = dataUrl.slice(5, commaIndex);
  if (!/;base64(?:;|$)/i.test(header)) return undefined;

  return {
    mimeType: header.split(";")[0],
    base64: dataUrl.slice(commaIndex + 1),
  };
}

function createPublicAssetPath(type: AssetType, extension: string, options: SaveAssetOptions = {}) {
  const folder = getGeneratedFolder(getAssetFolder(type), options);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const publicFolder = folder.replace(/\\/g, "/");

  return {
    directory: join(GENERATED_ROOT, folder),
    filePath: join(GENERATED_ROOT, folder, filename),
    publicUrl: `/generated/${publicFolder}/${filename}`,
  };
}

async function writeGeneratedImageAsJpeg(buffer: Buffer, filePath: string, diagnostics?: SaveAssetOptions["diagnostics"] & { userId?: string; mimeType?: string; forceReencode?: boolean; stage?: string }) {
  const startedAt = Date.now();
  if (!ffmpegPath) {
    await writeFile(filePath, buffer);
    void appendUploadDiagnosticsLog({ event: "upload-image-ffmpeg-missing-raw-write", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, durationMs: Date.now() - startedAt, extra: { stage: diagnostics?.stage, filePath } });
    return;
  }

  const tempInputPath = `${filePath}.${randomUUID()}.input`;
  await writeFile(tempInputPath, buffer);
  try {
    void appendUploadDiagnosticsLog({ event: "upload-image-reencode-start", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, extra: { stage: diagnostics?.stage } });
    await execFileAsync(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      tempInputPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      filePath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    void appendUploadDiagnosticsLog({ event: "upload-image-reencode-success", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, durationMs: Date.now() - startedAt, extra: { stage: diagnostics?.stage, filePath } });
  } catch (error) {
    void appendUploadDiagnosticsLog({ event: "upload-image-reencode-failed", requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: diagnostics?.fileSize ?? buffer.length, forceReencode: diagnostics?.forceReencode, durationMs: Date.now() - startedAt, error, extra: { stage: diagnostics?.stage, filePath } });
    throw error;
  } finally {
    await unlink(tempInputPath).catch(() => undefined);
  }
}

function getImageExtensionFromMimeOrUrl(mimeType?: string | null, sourceUrl?: string) {
  return getExtensionFromMime(mimeType) ?? (sourceUrl ? getExtensionFromUrl(sourceUrl) : undefined) ?? "png";
}

// 生成图片落盘编码：按后台"图片生成压缩"设置。
// 开启 → 用 sharp 转 JPEG，质量 = 后台三档对应的精确 JPEG 质量(95/90/80)。
// 关闭 → 保留原始字节与原始格式(不转码不压缩)。
async function encodeGeneratedImageBuffer(buffer: Buffer, filePathHint: string, sourceMime?: string | null, sourceUrl?: string, keepTransparent?: boolean): Promise<{ buffer: Buffer; extension: string }> {
  // 去背景/编辑元素等需要真透明输出：保留原始 png/webp，绝不 flatten 成白底、绝不转 jpg。
  if (keepTransparent) {
    const extension = getImageExtensionFromMimeOrUrl(sourceMime, sourceUrl);
    return { buffer, extension: extension === "jpg" || extension === "jpeg" ? "png" : extension };
  }
  const setting = getGenerationCompressionSettings().image;
  if (!setting.enabled) {
    return { buffer, extension: getImageExtensionFromMimeOrUrl(sourceMime, sourceUrl) };
  }
  const quality = getCompressionQualityPercent(setting.quality);
  try {
    const out = await sharp(buffer, { failOn: "none" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
    return { buffer: out, extension: "jpg" };
  } catch {
    // sharp 失败兜底：退回 ffmpeg 转 jpeg（保持"至少转成 jpg"的既有行为）。
    const tempPath = `${filePathHint}.${randomUUID()}.jpg`;
    await writeGeneratedImageAsJpeg(buffer, tempPath, { mimeType: sourceMime ?? undefined, stage: "generated-image-sharp-fallback" });
    const out = readFileSync(tempPath);
    await unlink(tempPath).catch(() => undefined);
    return { buffer: out, extension: "jpg" };
  }
}

// 生成视频落盘后可选压缩：按后台"视频生成压缩"设置。开启则用 ffmpeg 转 H.264(CRF)+faststart，
// 只有转码后体积更小才替换原文件；URL/路径不变。
const VIDEO_QUALITY_CRF: Record<"high" | "standard" | "low", number> = { high: 18, standard: 21, low: 24 };

export async function compressGeneratedVideoInPlace(publicUrl: string): Promise<string> {
  const setting = getGenerationCompressionSettings().video;
  if (!setting.enabled || !ffmpegPath) return publicUrl;
  if (!publicUrl.startsWith("/generated/")) return publicUrl;
  const cleanUrl = publicUrl.split("?")[0].split("#")[0];
  const sourcePath = join(process.cwd(), "public", cleanUrl.replace(/^\//, ""));
  if (!existsSync(sourcePath)) return publicUrl;

  const crf = VIDEO_QUALITY_CRF[setting.quality];
  const tempPath = `${sourcePath}.${randomUUID()}.tmp.mp4`;
  try {
    await execFileAsync(ffmpegPath, [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", sourcePath,
      "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      tempPath,
    ], { timeout: 300_000, maxBuffer: 20 * 1024 * 1024 });
    const originalSize = statSync(sourcePath).size;
    const compressedSize = statSync(tempPath).size;
    if (compressedSize > 0 && compressedSize < originalSize) {
      await rename(tempPath, sourcePath);
    } else {
      await unlink(tempPath).catch(() => undefined);
    }
  } catch {
    await unlink(tempPath).catch(() => undefined);
  }
  return publicUrl;
}

function getCurlCommand() {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function toHeaderRecord(headers?: HeadersInit) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

function toCurlHeaderArgs(headers?: HeadersInit) {
  return Object.entries(toHeaderRecord(headers)).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
}

export async function saveDataUrlAsset(dataUrl: string, type: AssetType, options: SaveAssetOptions = {}) {
  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const buffer = Buffer.from(parsed.base64, "base64");

  if (type === "image") {
    const encoded = await encodeGeneratedImageBuffer(buffer, join(GENERATED_ROOT, getGeneratedFolder(getAssetFolder("image"), options), `${Date.now()}-${randomUUID()}`), parsed.mimeType, undefined, options.keepTransparent);
    const asset = createPublicAssetPath("image", encoded.extension, options);
    await mkdir(asset.directory, { recursive: true });
    await writeFile(asset.filePath, encoded.buffer);
    return asset.publicUrl;
  }

  const asset = createPublicAssetPath(type, getExtensionFromMime(parsed.mimeType) ?? "mp4", options);
  await mkdir(asset.directory, { recursive: true });
  await writeFile(asset.filePath, buffer);
  return asset.publicUrl;
}

export async function saveUploadedImageAsset(dataUrl: string, folder = "upload_image", options: SaveAssetOptions = {}) {
  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const buffer = Buffer.from(parsed.base64, "base64");
  return saveUploadedImageBufferAsset(buffer, parsed.mimeType, folder, options);
}

export async function saveUploadedImageBufferAsset(buffer: Buffer, mimeType = "image/jpeg", folder = "upload_image", options: SaveAssetOptions = {}) {
  const extension = "jpg";
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const generatedFolder = getGeneratedFolder(folder, options);
  const publicFolder = generatedFolder.replace(/\\/g, "/");
  const directory = join(GENERATED_ROOT, generatedFolder);
  const filePath = join(directory, `${hash}.${extension}`);

  await mkdir(directory, { recursive: true });

  if (!existsSync(filePath)) await writeGeneratedImageAsJpeg(buffer, filePath, { ...options.diagnostics, userId: options.userId, mimeType, fileSize: buffer.length, stage: `save-uploaded-image-${folder}` });

  return `/generated/${publicFolder}/${hash}.${extension}`;
}

/**
 * ⭐⭐ 上传的 JPEG 体积超阈值就**原地压一遍**（2026-07-29 加，修红字 A1）。
 *
 * ⛔ 修的是什么：`jpegNeedsReencode()` 只判**格式兼容性**（分量数 + 4:2:0 采样因子），**不看体积** ——
 * 格式本来就兼容的手机原图会走"原样写盘"分支，**一个字节都没压**。线上因此存下一张 4.24MB 的
 * 3072×4096 原图，发给 OpenAI 直接 400 `Invalid image file or mode` → 用户连点 6 次全灭（红字 A1）。
 *
 * ⚠️ **只降质量、绝不动像素尺寸**（用户明确要求"图片过大不要动，质量保证在 90%"）。
 * 实测那张图 4444000 → 约 985KB，尺寸一点没变，已落回历史成功区间（成功过的最大 2.71MB）。
 *
 * ⭐ `.rotate()` 是必须的：sharp 默认会**丢掉 EXIF**，手机照片带 `Orientation` 时不先按 EXIF 转正，
 * 压完就会显示成横躺/倒置。`.rotate()` 把方向**烧进像素**，之后不再需要 EXIF。
 *
 * ⚠️ 压不动就原样返回，**绝不让上传失败**（压缩是优化，不是必要条件）。
 */
async function compressOversizedUploadJpeg(buffer: Buffer, diagnostics?: SaveAssetOptions["diagnostics"] & { userId?: string; mimeType?: string }) {
  if (buffer.length <= IMAGE_UPLOAD_RECOMPRESS_OVER_BYTES) return buffer;
  const startedAt = Date.now();
  const baseLog = { requestId: diagnostics?.requestId, userId: diagnostics?.userId, fileName: diagnostics?.fileName, mimeType: diagnostics?.mimeType, fileSize: buffer.length };
  try {
    const out = await sharp(buffer, { failOn: "none" })
      .rotate()
      .jpeg({ quality: IMAGE_UPLOAD_RECOMPRESS_QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
    if (out.length >= buffer.length) {
      void appendUploadDiagnosticsLog({ event: "upload-image-oversized-recompress-skipped", ...baseLog, durationMs: Date.now() - startedAt, extra: { reason: "压完反而更大，保留原文件", originalBytes: buffer.length, compressedBytes: out.length, quality: IMAGE_UPLOAD_RECOMPRESS_QUALITY } });
      return buffer;
    }
    void appendUploadDiagnosticsLog({ event: "upload-image-oversized-recompressed", ...baseLog, durationMs: Date.now() - startedAt, extra: { originalBytes: buffer.length, compressedBytes: out.length, quality: IMAGE_UPLOAD_RECOMPRESS_QUALITY, thresholdBytes: IMAGE_UPLOAD_RECOMPRESS_OVER_BYTES } });
    return out;
  } catch (error) {
    void appendUploadDiagnosticsLog({ event: "upload-image-oversized-recompress-failed", ...baseLog, durationMs: Date.now() - startedAt, error, extra: { originalBytes: buffer.length, quality: IMAGE_UPLOAD_RECOMPRESS_QUALITY } });
    return buffer;
  }
}

export async function saveTemporaryUploadedImageBuffer(buffer: Buffer, mimeType = "image/jpeg", options: SaveAssetOptions & { forceReencode?: boolean } = {}) {
  const startedAt = Date.now();
  const userSegment = getSafeUserSegment(options.userId) || "anonymous";
  const token = `${Date.now()}-${randomUUID()}`;
  const directory = join(ASSET_UPLOAD_TEMP_ROOT, userSegment);
  const filePath = join(directory, `${token}.jpg`);
  await mkdir(directory, { recursive: true });
  if (options.forceReencode || !isJpegMime(mimeType)) {
    await writeGeneratedImageAsJpeg(buffer, filePath, { ...options.diagnostics, userId: options.userId, mimeType, fileSize: buffer.length, forceReencode: options.forceReencode, stage: "temporary-upload" });
  } else {
    if (jpegNeedsReencode(buffer)) {
      // 以前这里抛"需要转码"让客户端再传一趟(多一次 客户端→Ali→马来 往返，很慢)。
      // 现在直接内联转码，省掉整个第二趟往返。
      void appendUploadDiagnosticsLog({ event: "temporary-upload-jpeg-inline-reencode", requestId: options.diagnostics?.requestId, userId: options.userId, fileName: options.diagnostics?.fileName, mimeType, fileSize: options.diagnostics?.fileSize ?? buffer.length, forceReencode: options.forceReencode, durationMs: Date.now() - startedAt, extra: { token } });
      await writeGeneratedImageAsJpeg(buffer, filePath, { ...options.diagnostics, userId: options.userId, mimeType, fileSize: buffer.length, forceReencode: true, stage: "temporary-upload-inline" });
    } else {
      // ⭐ 走到这里说明"格式本来就兼容、不需要转码"。⛔ 但 `jpegNeedsReencode` **不看体积** ——
      // 以前直接原样写盘，手机原图（4MB+）就这样被存下来、再原样发给模型 → 红字 A1。
      // 现在按体积阈值补一道"只降质量、不动尺寸"的压缩（见 compressOversizedUploadJpeg）。
      await writeFile(filePath, await compressOversizedUploadJpeg(buffer, { ...options.diagnostics, userId: options.userId, mimeType }));
    }
  }
  void appendUploadDiagnosticsLog({ event: "temporary-upload-buffer-saved", requestId: options.diagnostics?.requestId, userId: options.userId, fileName: options.diagnostics?.fileName, mimeType, fileSize: options.diagnostics?.fileSize ?? buffer.length, forceReencode: options.forceReencode, token, durationMs: Date.now() - startedAt, extra: { directory } });
  return { token };
}

export async function commitTemporaryUploadedImage(token: string, options: SaveAssetOptions = {}) {
  const startedAt = Date.now();
  const userSegment = getSafeUserSegment(options.userId) || "anonymous";
  const safeToken = token.trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeToken) throw new Error("上传文件不存在");

  const tempPath = join(ASSET_UPLOAD_TEMP_ROOT, userSegment, `${safeToken}.jpg`);
  if (!existsSync(tempPath)) throw new Error("上传文件不存在或已过期");

  const buffer = readFileSync(tempPath);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const generatedFolder = getGeneratedFolder("upload_image", options);
  const publicFolder = generatedFolder.replace(/\\/g, "/");
  const directory = join(GENERATED_ROOT, generatedFolder);
  const filePath = join(directory, `${hash}.jpg`);
  await mkdir(directory, { recursive: true });
  // 用 writeFile+unlink 而非 rename：临时目录(.runtime)与目标(public/generated)在 Docker 下可能是不同挂载点/设备，
  // 跨设备 rename 会抛 EXDEV。buffer 已在上面读入内存，直接写目标再删临时最稳妥。
  if (!existsSync(filePath)) await writeFile(filePath, buffer);
  await unlink(tempPath).catch(() => undefined);
  void appendUploadDiagnosticsLog({ event: "temporary-upload-committed", requestId: options.diagnostics?.requestId, userId: options.userId, token: safeToken, durationMs: Date.now() - startedAt, extra: { url: `/generated/${publicFolder}/${hash}.jpg`, deduped: existsSync(filePath) } });
  return `/generated/${publicFolder}/${hash}.jpg`;
}

export async function deleteTemporaryUploadedImage(token: string, options: SaveAssetOptions = {}) {
  const userSegment = getSafeUserSegment(options.userId) || "anonymous";
  const safeToken = token.trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeToken) return false;
  const tempPath = join(ASSET_UPLOAD_TEMP_ROOT, userSegment, `${safeToken}.jpg`);
  await unlink(tempPath).catch(() => undefined);
  return true;
}

export async function saveUserAvatarAsset(dataUrl: string) {
  return saveUploadedImageAsset(dataUrl, "user_avatar");
}

function getSafeFileBaseName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "file";
}

export async function saveUploadedFileAsset(dataUrl: string, originalName = "file", options: SaveAssetOptions = {}) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("文件数据格式不正确，无法保存到本地。请稍后再试。");
  return saveUploadedFileBufferAsset(Buffer.from(parsed.base64, "base64"), originalName, parsed.mimeType, options);
}

export async function saveUploadedFileBufferAsset(buffer: Buffer, originalName = "file", mimeType?: string, options: SaveAssetOptions = {}) {
  const extension = getExtensionFromUrl(originalName) ?? getExtensionFromMime(mimeType) ?? "bin";
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const baseName = getSafeFileBaseName(originalName.replace(/\.[^.]+$/, ""));
  const generatedFolder = getGeneratedFolder("files", options);
  const publicFolder = generatedFolder.replace(/\\/g, "/");
  const directory = join(GENERATED_ROOT, generatedFolder);
  const filename = `${hash}-${baseName}.${extension}`;
  const filePath = join(directory, filename);

  await mkdir(directory, { recursive: true });
  if (!existsSync(filePath)) await writeFile(filePath, buffer);
  return `/generated/${publicFolder}/${filename}`;
}

export async function saveRemoteAsset(url: string, type: AssetType, init?: RequestInit, options: SaveAssetOptions = {}) {
  // 单次下载总超时：fetch 建连、读 body、以及非 ok 时的 curl 兜底全都在这个时限内；
  // 到点 abort/kill → 抛错 → 上层（media-save 队列）按失败重试，避免"假死"永久卡住。
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_DOWNLOAD_TIMEOUT_MS);
  try {
    // ⛔⛔ 出网必须走 `safeFetch`（2026-08-02 加）：这个函数的 url 可以来自用户输入
    //   （`/api/media-save-status` 会把没见过的地址直接入队），不拦就等于"服务器帮外人去读内网"。
    //   `safeFetch` 会**逐跳**校验（不能用 `redirect: "follow"`，那只校验第一跳）。
    //   拦法与理由见 `lib/ssrf-guard.ts` 顶部。⛔ 禁止为了"让某个地址能过"而在这里开后门。
    const response = await safeFetch(url, { ...init, cache: "no-store", signal: controller.signal });
    const imageDir = join(GENERATED_ROOT, getGeneratedFolder(getAssetFolder("image"), options));

    if (!response.ok) {
      try {
        // ⛔ 这里原来用的是 `curl -fL`，`-L` 会**跟随重定向**——那等于绕开 SSRF 校验
        //   （公网地址 302 到 `http://169.254.169.254/...` 就穿透了）。
        //   已改成 `-f` 不跟随；供应商的直链本来就不需要重定向。
        const { stdout } = await execFileAsync(getCurlCommand(), ["-f", "-sS", "--max-time", String(Math.ceil(REMOTE_DOWNLOAD_TIMEOUT_MS / 1000)), ...toCurlHeaderArgs(init?.headers), url], { encoding: "buffer", maxBuffer: 500 * 1024 * 1024, signal: controller.signal });
        const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
        // ⛔ 空 body 必须当失败（2026-08-02 加）：curl 的 `-f` 只对 HTTP >= 400 报错，
        //   遇到 302（不带 -L 时不会去跟随）会**成功退出（exit 0）并输出空 body**。
        //   不拦这一句，0 字节的 buffer 会被当成图片/视频原样存盘 ——
        //   比"明确失败"更难查（用户看到一张打不开的图，日志却一切正常）。
        //   走 throw 是为了复用下面现成的 catch 失败分支，不新造错误路径。
        if (buffer.byteLength <= 0) throw new Error("curl 返回了空响应体");
        if (type === "image") {
          const encoded = await encodeGeneratedImageBuffer(buffer, join(imageDir, `${Date.now()}-${randomUUID()}`), undefined, url, options.keepTransparent);
          const asset = createPublicAssetPath("image", encoded.extension, options);
          await mkdir(asset.directory, { recursive: true });
          await writeFile(asset.filePath, encoded.buffer);
          return asset.publicUrl;
        }
        const asset = createPublicAssetPath(type, getExtensionFromUrl(url) ?? "mp4", options);
        await mkdir(asset.directory, { recursive: true });
        await writeFile(asset.filePath, buffer);
        return asset.publicUrl;
      } catch {
        throw new Error(`保存${type === "image" ? "图片" : "视频"}失败：${response.status}`);
      }
    }

    const contentType = response.headers.get("content-type");
    const buffer = Buffer.from(await response.arrayBuffer());

    if (type === "image") {
      const encoded = await encodeGeneratedImageBuffer(buffer, join(imageDir, `${Date.now()}-${randomUUID()}`), contentType, url, options.keepTransparent);
      const asset = createPublicAssetPath("image", encoded.extension, options);
      await mkdir(asset.directory, { recursive: true });
      await writeFile(asset.filePath, encoded.buffer);
      return asset.publicUrl;
    }

    const asset = createPublicAssetPath(type, getExtensionFromMime(contentType) ?? getExtensionFromUrl(url) ?? "mp4", options);
    await mkdir(asset.directory, { recursive: true });
    await writeFile(asset.filePath, buffer);
    return asset.publicUrl;
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveGeneratedAsset(source: string, type: AssetType, init?: RequestInit, options: SaveAssetOptions = {}) {
  if (source.startsWith("/generated/")) return source;
  if (source.startsWith("data:")) return saveDataUrlAsset(source, type, options);
  return saveRemoteAsset(source, type, init, options);
}

function getPngDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getJpegDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }

    offset += 2 + length;
  }

  return undefined;
}

function getWebpDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return undefined;

  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (format === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (format === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return undefined;
}

export function getImageDimensionsFromBuffer(buffer: Buffer): ImageDimensions | undefined {
  return getPngDimensions(buffer) ?? getJpegDimensions(buffer) ?? getWebpDimensions(buffer);
}

export function getLocalImageDimensions(publicUrl: string): ImageDimensions | undefined {
  if (!publicUrl.startsWith("/generated/")) return undefined;

  const filePath = join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
  if (!existsSync(filePath)) return undefined;

  return getImageDimensionsFromBuffer(readFileSync(filePath));
}

export async function createGeneratedImageThumbnail(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return undefined;
  if (!ffmpegPath) return undefined;

  const cleanPublicUrl = publicUrl.split("?")[0].split("#")[0];
  const sourcePath = join(process.cwd(), "public", cleanPublicUrl.replace(/^\//, ""));
  if (!existsSync(sourcePath)) return undefined;

  const userPathMatch = cleanPublicUrl.match(/^\/generated\/users\/([^/]+)\/(.+)$/);
  const generatedRelativePath = (userPathMatch ? userPathMatch[2] : cleanPublicUrl.replace(/^\/generated\//, "")).replace(/\.[^.\/\\]+$/, ".jpg");
  const thumbnailPublicUrl = userPathMatch ? `/generated/users/${userPathMatch[1]}/image-thumbnails/${generatedRelativePath.replace(/\\/g, "/")}` : `/generated/image-thumbnails/${generatedRelativePath.replace(/\\/g, "/")}`;
  const thumbnailPath = join(process.cwd(), "public", thumbnailPublicUrl.replace(/^\//, ""));

  if (existsSync(thumbnailPath)) return thumbnailPublicUrl;
  await mkdir(dirname(thumbnailPath), { recursive: true });
  await execFileAsync(ffmpegPath, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-vf",
    "scale=256:256:force_original_aspect_ratio=decrease",
    "-frames:v",
    "1",
    "-q:v",
    "5",
    thumbnailPath,
  ], { timeout: 60_000, maxBuffer: 1024 * 1024 });

  return thumbnailPublicUrl;
}

export async function deleteLocalGeneratedAsset(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return false;

  const normalized = publicUrl.replace(/^\/generated\//, "").replace(/\//g, "\\");
  const filePath = join(GENERATED_ROOT, normalized);

  if (!existsSync(filePath)) return false;

  await unlink(filePath);
  return true;
}
