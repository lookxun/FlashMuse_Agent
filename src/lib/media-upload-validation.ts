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
  if (metadata.durationSeconds < 1.9 || metadata.durationSeconds > 16.01) return `${label}时长需在 2 到 15 秒之间`;
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
