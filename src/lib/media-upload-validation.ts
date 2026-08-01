export type UploadMediaKind = "video" | "audio";
export type MediaUploadMetadata = { durationSeconds?: number; width?: number; height?: number; fps?: number; videoCodec?: string; audioCodec?: string };

const MB = 1024 * 1024;
const rules = {
  video: { extensions: ["mp4", "mov"], mimeTypes: ["video/mp4", "video/quicktime"], maxBytes: 200 * MB },
  audio: { extensions: ["mp3", "wav"], mimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"], maxBytes: 15 * MB },
} as const;
export const VIDEO_UPLOAD_ACCEPT = ".mp4,.mov,video/mp4,video/quicktime";
export const AUDIO_UPLOAD_ACCEPT = ".mp3,.wav,audio/mpeg,audio/wav";

function extensionOf(name: string | undefined | null) { return (name ?? "").split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? ""; }

// 参考视频/音频「单条时长」允许的读取抖动容差（秒）。唯一权威，禁止再各处复制。
// 实测 BytePlus Seedance 2.0 三个模型 r2v 的参考视频真实上限 = 15.2 秒（API 直接报 "must be less than or equal to 15.2"）。
// 我们对外仍按 maxSeconds=15 宣传，容差取 0.2 → 有效上限 15 + 0.2 = 15.2，正好等于真实硬上限；
// 对话流 / 工作流 / 服务端三处必须共用这一个常量与下面的 validateReferenceMediaDurationRange，保持完全一致。
export const MEDIA_DURATION_EPSILON_SECONDS = 0.2;

// 单条时长范围校验（对话流客户端、工作流客户端共用；服务端 validateMediaUploadMetadata 也按同一容差判定）。
export function validateReferenceMediaDurationRange(kindLabel: string, durationSeconds: number | undefined, rule: { minSeconds?: number; maxSeconds?: number }) {
  if (!Number.isFinite(durationSeconds ?? Number.NaN) || !durationSeconds) return `${kindLabel}时长读取失败`;
  if (rule.minSeconds !== undefined && durationSeconds < rule.minSeconds - MEDIA_DURATION_EPSILON_SECONDS) return `${kindLabel}时长不能少于 ${rule.minSeconds} 秒`;
  if (rule.maxSeconds !== undefined && durationSeconds > rule.maxSeconds + MEDIA_DURATION_EPSILON_SECONDS) return `${kindLabel}时长不能超过 ${rule.maxSeconds} 秒`;
  return undefined;
}

/** Browser-safe first pass. The server repeats this with probed media metadata. */
export function validateMediaUploadFile(file: Pick<File, "name" | "type" | "size">, kind: UploadMediaKind) {
  const rule = rules[kind];
  const mime = (file.type ?? "").split(";", 1)[0]?.toLowerCase() ?? "";
  const label = kind === "video" ? "视频" : "音频";
  if (!rule.extensions.includes(extensionOf(file.name) as never) || (mime && !rule.mimeTypes.includes(mime as never))) return kind === "video" ? "仅支持 MP4、MOV 格式的视频" : "仅支持 MP3、WAV 格式的音频";
  if (file.size <= 0) return `${label}文件为空`;
  if (file.size > rule.maxBytes) return `${label}不能超过 ${kind === "video" ? 200 : 15}MB`;
  return undefined;
}

export function validateMediaUploadMetadata(kind: UploadMediaKind, metadata: MediaUploadMetadata) {
  const label = kind === "video" ? "视频" : "音频";
  if (!Number.isFinite(metadata.durationSeconds) || !metadata.durationSeconds) return `${label}时长读取失败`;
  // 实测真实上限 15.2 秒（=15 + MEDIA_DURATION_EPSILON_SECONDS）；下限 2 秒同容差。三处统一走这个容差。
  if (metadata.durationSeconds < 2 - MEDIA_DURATION_EPSILON_SECONDS || metadata.durationSeconds > 15 + MEDIA_DURATION_EPSILON_SECONDS) return `${label}时长需在 2 到 15 秒之间`;
  if (kind === "audio") return undefined;
  const { width, height, fps } = metadata;
  if (!width || !height) return "视频尺寸读取失败";
  if (width < 300 || width > 6000 || height < 300 || height > 6000) return "视频宽高需在 300 到 6000 像素之间";
  if (width * height < 409600 || width * height > 8295044) return "视频总像素需在 409600 到 8295044 之间";
  if (width / height < 0.4 || width / height > 2.5) return "视频宽高比需在 0.4 到 2.5 之间";
  // Browsers do not expose encoded FPS. Server probes supply it when available.
  if (fps !== undefined && (!Number.isFinite(fps) || fps < 24 || fps > 60)) return "视频帧率需在 24 到 60 FPS 之间";
  if (metadata.videoCodec && !/^(h264|hevc|h265)$/i.test(metadata.videoCodec)) return "视频编码仅支持 H.264 或 H.265";
  if (metadata.audioCodec && !/^(aac|mp3)$/i.test(metadata.audioCodec)) return "视频音频编码仅支持 AAC 或 MP3";
  return undefined;
}

export function validateMediaUploadBuffer(buffer: Uint8Array, file: Pick<File, "name" | "type" | "size">, kind: UploadMediaKind, metadata: MediaUploadMetadata) {
  // File 的 name/type 是原型 getter，禁止用 {...file} 展开（会丢失），必须显式取字段。
  return validateMediaUploadFile({ name: file.name, type: file.type, size: buffer.byteLength }, kind) ?? validateMediaUploadMetadata(kind, metadata);
}

// ============ 文档上传（pdf/docx/xlsx/txt...） ============
//
// ⛔⛔ 为什么这一段必须存在（2026-08-02 安全加固）：
// `POST /api/upload-file` 原来**只在 `mediaKind` 是 video/audio 时才校验**
// （`route.ts:131` 的 `requestedKind`），文档路径是**零校验** ——
// 既不限后缀也不限大小，而落盘时的后缀是**直接取客户端传来的文件名**
// （`local-assets.ts:423` 的 `getExtensionFromUrl(originalName)`）。
//
// 后果：传一个 `x.html` 上去就得到 `https://main.venusface.com/generated/.../xxx-x.html`，
// 而 `/generated/` 是**同源**静态目录 → **在我们自己的域名下执行 JS（存储型 XSS）**。
// 会话 cookie 是 httpOnly 偷不走，但脚本能以受害者身份调用全部接口。`.svg` 同理。
// 另外没有大小上限 → `await file.arrayBuffer()` 会把整个文件读进内存，是个免费的内存/磁盘 DoS。
//
// ⭐ 这里是文档格式的**唯一权威**：`upload-rules.ts` 的 `documentFormats` 从这里导入，
//    与图片走 `image-upload-validation.ts` 的 `IMAGE_UPLOAD_FORMATS` 是同一个约定。
// ⛔ 禁止在别处另写一份文档后缀数组（历史上图片格式就是因为多写了一份，
//    导致"对话流传不上去、工作流拖进来能行"的分叉）。
export const DOCUMENT_UPLOAD_FORMATS = ["pdf", "txt", "csv", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "md"] as const;

// 与 `upload-rules.ts` 里文档规则的 `maxSizeMb: 10` 保持一致。
export const DOCUMENT_UPLOAD_MAX_BYTES = 10 * MB;

/**
 * 文档上传的服务端硬校验（后缀白名单 + 大小上限）。
 * ⚠️ 只认**后缀**、不认客户端给的 `Content-Type`（后者可以随便伪造，
 *    而真正决定 nginx 返回什么 MIME、浏览器要不要执行的，正是落盘后的后缀）。
 */
export function validateDocumentUploadFile(file: Pick<File, "name" | "size">) {
  const extension = extensionOf(file.name);
  if (!extension) return "文件缺少扩展名";
  if (!(DOCUMENT_UPLOAD_FORMATS as readonly string[]).includes(extension)) {
    return `不支持的文件格式：.${extension}（仅支持 ${DOCUMENT_UPLOAD_FORMATS.join("、")}）`;
  }
  if (file.size <= 0) return "文件为空";
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) return `文件不能超过 ${Math.floor(DOCUMENT_UPLOAD_MAX_BYTES / MB)}MB`;
  return undefined;
}
