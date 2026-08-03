// M034 分片上传的服务端临时分片存储（专治跨境丢包：客户端把大文件切成小片、每片独立传、
// 失败只重传那一片，而不是整包重来）。分片先落到 `.runtime/upload-chunks/<userId>/<uploadId>/<index>`，
// 收齐后由 /api/upload-chunk 的 assemble 拼成完整 Buffer，再交给既有的上传处理逻辑。
//
// ⚠️ 目录必须"能减"：assemble 成功/失败都要 clearUploadChunks；另外每次操作机会性清理过期的孤儿目录
// （用户传到一半关页面会留下分片），避免又造一个"只增不减"的目录（备忘 M034 明确警告过）。

import { mkdir, writeFile, readFile, rm, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const UPLOAD_CHUNKS_ROOT = join(process.cwd(), ".runtime", "upload-chunks");

// 单片上限：客户端切片是 1MB，留足余量防止个别实现把边界算大；超过一律拒收，防止被塞超大"分片"打爆磁盘。
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
// 一个上传最多多少片：1MB/片 × 250 = 250MB，覆盖视频 200MB 上限还有余量。
export const MAX_CHUNKS_PER_UPLOAD = 250;
// 孤儿分片目录的存活上限：超过就当作"传了一半被放弃"清掉。
const STALE_CHUNK_DIR_MS = 6 * 60 * 60 * 1000;

/** uploadId 只允许我们自己生成的 [a-z0-9-] 串，杜绝路径穿越（../ 之类）。 */
function isSafeSegment(value: string) {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function getUploadDir(userId: string, uploadId: string) {
  if (!isSafeSegment(userId) || !isSafeSegment(uploadId)) throw new Error("非法的上传标识");
  return join(UPLOAD_CHUNKS_ROOT, userId, uploadId);
}

/** 落一片。index 从 0 起。 */
export async function saveUploadChunk(userId: string, uploadId: string, index: number, buffer: Buffer) {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS_PER_UPLOAD) throw new Error("非法的分片序号");
  if (buffer.byteLength > MAX_CHUNK_BYTES) throw new Error("分片过大");
  const dir = getUploadDir(userId, uploadId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${index}.part`), buffer);
}

/**
 * 收齐所有分片并按序拼接成完整 Buffer。缺片/多片都会报错（客户端会重传缺的那片）。
 * 不做删除——由调用方在处理完（无论成败）后调用 clearUploadChunks。
 */
export async function assembleUploadChunks(userId: string, uploadId: string, totalChunks: number) {
  if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > MAX_CHUNKS_PER_UPLOAD) throw new Error("非法的分片总数");
  const dir = getUploadDir(userId, uploadId);
  const parts: Buffer[] = [];
  for (let index = 0; index < totalChunks; index += 1) {
    const part = await readFile(join(dir, `${index}.part`)).catch(() => undefined);
    if (!part) throw new Error(`缺少分片 ${index}`);
    parts.push(part);
  }
  return Buffer.concat(parts);
}

/** 处理完后清掉该上传的整个分片目录。静默失败（清理不该影响主流程）。 */
export async function clearUploadChunks(userId: string, uploadId: string) {
  try {
    await rm(getUploadDir(userId, uploadId), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/** 机会性清理过期孤儿分片目录（传了一半被放弃的）。静默失败，最多扫一层用户目录。 */
export async function sweepStaleUploadChunks() {
  try {
    const now = Date.now();
    const users = await readdir(UPLOAD_CHUNKS_ROOT).catch(() => [] as string[]);
    for (const user of users) {
      const userDir = join(UPLOAD_CHUNKS_ROOT, user);
      const uploads = await readdir(userDir).catch(() => [] as string[]);
      for (const upload of uploads) {
        const uploadDir = join(userDir, upload);
        const info = await stat(uploadDir).catch(() => undefined);
        if (info && now - info.mtimeMs > STALE_CHUNK_DIR_MS) {
          await rm(uploadDir, { recursive: true, force: true }).catch(() => undefined);
        }
      }
    }
  } catch {
    // ignore
  }
}
