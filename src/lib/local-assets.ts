import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

type AssetType = "image" | "video";

const GENERATED_ROOT = join(process.cwd(), "public", "generated");
const execFileAsync = promisify(execFile);

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function getAssetFolder(type: AssetType) {
  return type === "image" ? "images" : "videos";
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

  try {
    const pathname = new URL(url).pathname;
    const extension = extname(pathname).replace(/^\./, "").toLowerCase();
    return extension || undefined;
  } catch {
    return undefined;
  }
}

function createPublicAssetPath(type: AssetType, extension: string) {
  const folder = getAssetFolder(type);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;

  return {
    directory: join(GENERATED_ROOT, folder),
    filePath: join(GENERATED_ROOT, folder, filename),
    publicUrl: `/generated/${folder}/${filename}`,
  };
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

export async function saveDataUrlAsset(dataUrl: string, type: AssetType) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const extension = getExtensionFromMime(match[1]) ?? (type === "image" ? "png" : "mp4");
  const asset = createPublicAssetPath(type, extension);

  await mkdir(asset.directory, { recursive: true });
  await writeFile(asset.filePath, Buffer.from(match[2], "base64"));

  return asset.publicUrl;
}

export async function saveUploadedImageAsset(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("图片数据格式不正确，无法保存到本地。请稍后再试。");
  }

  const buffer = Buffer.from(match[2], "base64");
  const extension = getExtensionFromMime(match[1]) ?? "png";
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const directory = join(GENERATED_ROOT, "upload_image");
  const filePath = join(directory, `${hash}.${extension}`);

  await mkdir(directory, { recursive: true });

  if (!existsSync(filePath)) {
    await writeFile(filePath, buffer);
  }

  return `/generated/upload_image/${hash}.${extension}`;
}

export async function saveRemoteAsset(url: string, type: AssetType, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });

  if (!response.ok) {
    const extension = getExtensionFromUrl(url) ?? (type === "image" ? "png" : "mp4");
    const asset = createPublicAssetPath(type, extension);

    await mkdir(asset.directory, { recursive: true });

    try {
      const { stdout } = await execFileAsync(getCurlCommand(), ["-fL", "-sS", ...toCurlHeaderArgs(init?.headers), url], { encoding: "buffer", maxBuffer: 500 * 1024 * 1024 });
      await writeFile(asset.filePath, Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
      return asset.publicUrl;
    } catch {
      throw new Error(`保存${type === "image" ? "图片" : "视频"}失败：${response.status}`);
    }
  }

  const contentType = response.headers.get("content-type");
  const extension = getExtensionFromMime(contentType) ?? getExtensionFromUrl(url) ?? (type === "image" ? "png" : "mp4");
  const asset = createPublicAssetPath(type, extension);
  const buffer = Buffer.from(await response.arrayBuffer());

  await mkdir(asset.directory, { recursive: true });
  await writeFile(asset.filePath, buffer);

  return asset.publicUrl;
}

export async function saveGeneratedAsset(source: string, type: AssetType, init?: RequestInit) {
  if (source.startsWith("/generated/")) return source;
  if (source.startsWith("data:")) return saveDataUrlAsset(source, type);
  return saveRemoteAsset(source, type, init);
}

export async function deleteLocalGeneratedAsset(publicUrl: string) {
  if (!publicUrl.startsWith("/generated/")) return false;

  const normalized = publicUrl.replace(/^\/generated\//, "").replace(/\//g, "\\");
  const filePath = join(GENERATED_ROOT, normalized);

  if (!existsSync(filePath)) return false;

  const { unlink } = await import("node:fs/promises");
  await unlink(filePath);
  return true;
}
