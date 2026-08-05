import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type VideoManifestEntry = {
  taskId: string;
  prompt: string;
  model?: string;
  settings?: { ratio?: string; resolution?: string; duration?: string };
  localVideoUrl?: string;
  remoteVideoUrl?: string;
  posterUrl?: string;
  createdAt: number;
  updatedAt: number;
};

const GENERATED_ROOT = join(process.cwd(), "public", "generated");
const VIDEO_DIR = join(GENERATED_ROOT, "videos");

// ⛔⛔ 这份台账**绝不能放在 public/ 下面**（2026-08-04 修）。
// 它历史上是 public/generated/videos/manifest.json，而 /generated/ 是 nginx 直接 serve 的
// **公网无鉴权**静态目录 → 任何人 GET 一下就拿到最近 500 条视频的
// 「全站用户完整提示词 + 用户 ID + 供应商预签名下载地址（24 小时内可直接下片）」。
// 实测 https://static.venusface.com/generated/videos/manifest.json 返回 200 + 1.68MB 明文。
// 它只被服务端从本地磁盘读（前端/阿里镜像压根不读它）→ 挪进 .runtime/ 零功能影响。
// ⭐ 同时：它也因此**一直在被同步/补数据脚本白传**（每生成一条视频就整份重写 1.68MB）。
const RUNTIME_DIR = join(process.cwd(), ".runtime");
const MANIFEST_PATH = join(RUNTIME_DIR, "video-manifest.json");
// 迁移用：老位置（只读 + 迁移后删除，绝不再写）。
const LEGACY_MANIFEST_PATH = join(VIDEO_DIR, "manifest.json");

async function readManifest(): Promise<VideoManifestEntry[]> {
  const parse = (content: string): VideoManifestEntry[] | null => {
    try {
      const parsed = JSON.parse(content) as VideoManifestEntry[];
      return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.taskId === "string") : [];
    } catch {
      return null;
    }
  };

  const current = await readFile(MANIFEST_PATH, "utf8").catch(() => null);
  if (current !== null) return parse(current) ?? [];

  // 新位置还没有 → 读老位置（首次升级后的第一次读）。
  const legacy = await readFile(LEGACY_MANIFEST_PATH, "utf8").catch(() => null);
  return legacy === null ? [] : parse(legacy) ?? [];
}

async function writeManifest(entries: VideoManifestEntry[]) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  // 原子落地：先写临时文件再 rename（同目录），避免并发读到半截 JSON。
  const tmpPath = `${MANIFEST_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(entries.slice(-500), null, 2));
  await rename(tmpPath, MANIFEST_PATH);
  // ⭐ 写成功后删掉老位置那份公开可读的（幂等；删不掉就算了，nginx 侧还有一道 404 兜底）。
  await unlink(LEGACY_MANIFEST_PATH).catch(() => undefined);
}

export async function upsertVideoManifestEntry(entry: Omit<VideoManifestEntry, "createdAt" | "updatedAt"> & Partial<Pick<VideoManifestEntry, "createdAt" | "updatedAt">>) {
  const entries = await readManifest();
  const now = Date.now();
  const existingIndex = entries.findIndex((item) => item.taskId === entry.taskId);
  const previous = existingIndex >= 0 ? entries[existingIndex] : undefined;
  const nextEntry: VideoManifestEntry = {
    ...(previous ?? { createdAt: entry.createdAt ?? now }),
    ...entry,
    prompt: entry.prompt || previous?.prompt || "",
    updatedAt: entry.updatedAt ?? now,
  };

  if (existingIndex >= 0) entries[existingIndex] = nextEntry;
  else entries.push(nextEntry);

  await writeManifest(entries);
  return nextEntry;
}

export async function listRecoverableVideos() {
  const manifest = await readManifest();
  const manifestUrls = new Set(manifest.map((entry) => entry.localVideoUrl).filter(Boolean));
  const files = existsSync(VIDEO_DIR) ? await readdir(VIDEO_DIR) : [];
  const orphanVideos = await Promise.all(
    files
      .filter((file) => /\.(mp4|webm|mov)$/i.test(file))
      .map(async (file) => {
        const filePath = join(VIDEO_DIR, file);
        const stats = await stat(filePath);
        return {
          url: `/generated/videos/${file}`,
          name: file,
          createdAt: stats.birthtimeMs || stats.mtimeMs,
          updatedAt: stats.mtimeMs,
        };
      }),
  );

  return {
    manifest,
    orphanVideos: orphanVideos.filter((video) => !manifestUrls.has(video.url)).sort((a, b) => b.updatedAt - a.updatedAt),
  };
}
