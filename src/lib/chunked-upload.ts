// M034 分片上传（客户端，统一入口）：把大文件切成 1MB 的小片、每片独立请求、失败只重传那一片。
// 专治跨境丢包导致的"偶发卡几十秒到 3 分半"——整包重传时一次丢包就得从头再来，分片则只补那一片。
// 对话流·工作流·资产库统一走它（"能统一一律统一"）。
//
// ⚠️ 哈希口径：预检/去重用的是**原始文件**的 SHA-256（computeFileContentHashHex），
//   分片改变了传输形态但不改变字节，assemble 时服务端会把拼接结果的哈希和这个原始哈希比对。

export const UPLOAD_CHUNK_SIZE = 1024 * 1024; // 1MB / 片
// 只有多于一片（>1MB）才走分片：小文件切成一片没有收益，反而多一次 assemble 往返。
export const UPLOAD_CHUNK_MIN_BYTES = UPLOAD_CHUNK_SIZE;
const MAX_CHUNK_ATTEMPTS = 3;

/** 文件够大（多于一片）才值得分片上传。 */
export function shouldChunkUpload(file: File) {
  return file.size > UPLOAD_CHUNK_MIN_BYTES;
}

function makeUploadId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID().replace(/-/g, "");
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** 传单片：XHR（能报进度），失败/超时自动重试。onChunkBytes 报本片已上传字节数。 */
function putChunk(chunkUrl: string, blob: Blob, token: string | undefined, signal: AbortSignal | undefined, onChunkBytes: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    let attempt = 0;
    const tryOnce = () => {
      attempt += 1;
      const xhr = new XMLHttpRequest();
      let lastBytes = 0;
      const onAbort = () => xhr.abort();
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      const retryOrFail = (error: Error) => {
        cleanup();
        onChunkBytes(-lastBytes); // 撤回本次已计入的字节，重试时重新计
        if (signal?.aborted) { reject(new Error("上传已取消")); return; }
        if (attempt >= MAX_CHUNK_ATTEMPTS) { reject(error); return; }
        setTimeout(tryOnce, 400 * attempt);
      };
      try {
        xhr.open("POST", chunkUrl);
        xhr.timeout = 60 * 1000;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      } catch {
        retryOrFail(new Error("上传初始化失败"));
        return;
      }
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onChunkBytes(event.loaded - lastBytes);
        lastBytes = event.loaded;
      };
      xhr.onload = () => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) { onChunkBytes(blob.size - lastBytes); resolve(); return; }
        retryOrFail(new Error(`分片上传失败(${xhr.status})`));
      };
      xhr.onerror = () => retryOrFail(new Error("分片上传失败，请检查网络"));
      xhr.ontimeout = () => retryOrFail(new Error("分片上传超时"));
      xhr.onabort = () => { cleanup(); reject(new Error("上传已取消")); };
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        xhr.send(blob);
      } catch {
        retryOrFail(new Error("分片发送失败"));
      }
    };
    tryOnce();
  });
}

export type ChunkedUploadResult<T> = T & { error?: string };

/**
 * 分片上传一个文件。`chunkUrl` = 指向 /api/upload-chunk 的完整地址（含直传 base）。
 * `target` = "image" 走 asset-upload-temp（返回 token 待 PATCH 转正）；"file" 走 upload-file。
 * `fields` 会原样透传给目标 POST（name / mediaKind / flow / workflowId / conversationId 等）。
 * 返回目标 POST 的响应 JSON（形态与非分片路径完全一致）。
 */
export async function uploadFileInChunks<T>(opts: {
  chunkUrl: string;
  file: File;
  target: "image" | "file";
  fields?: Record<string, string>;
  originalContentHash?: string;
  token?: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<ChunkedUploadResult<T>> {
  const { chunkUrl, file, target, fields, originalContentHash, token, onProgress, signal } = opts;
  const uploadId = makeUploadId();
  const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_SIZE);
  const totalBytes = file.size || 1;
  let sentBytes = 0;
  onProgress?.(2);
  const reportBytes = (delta: number) => {
    sentBytes += delta;
    // 分片阶段占进度条 2~96；剩下留给 assemble。
    const pct = 2 + Math.min(94, Math.max(0, (sentBytes / totalBytes) * 94));
    onProgress?.(pct);
  };

  for (let index = 0; index < totalChunks; index += 1) {
    if (signal?.aborted) throw new Error("上传已取消");
    const start = index * UPLOAD_CHUNK_SIZE;
    const blob = file.slice(start, Math.min(start + UPLOAD_CHUNK_SIZE, file.size));
    const url = `${chunkUrl}?uploadId=${encodeURIComponent(uploadId)}&index=${index}&total=${totalChunks}`;
    await putChunk(url, blob, token, signal, reportBytes);
  }

  onProgress?.(97);
  const assembleResponse = await fetch(`${chunkUrl}?assemble=1`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ uploadId, totalChunks, target, fileName: file.name, mimeType: file.type || "application/octet-stream", originalContentHash, fields: fields ?? {} }),
    signal,
  });
  const data = (await assembleResponse.json().catch(() => ({}))) as ChunkedUploadResult<T>;
  if (!assembleResponse.ok) throw new Error(data.error || "文件上传失败");
  onProgress?.(100);
  return data;
}
