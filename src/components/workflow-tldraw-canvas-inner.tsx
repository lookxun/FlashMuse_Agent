"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type CSSProperties, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { BaseBoxShapeUtil, BindingUtil, CubicBezier2d, HTMLContainer, Mat, Rectangle2d, SVGContainer, SelectionForegroundOverlayUtil, ShapeUtil, T, Tldraw, Vec, createShapeId, defaultBindingUtils, defaultOverlayUtils, defaultShapeUtils, resizeBox, useActions, useEditor, useValue, vecModelValidator, type Editor, type IndexKey, type RecordProps, type TLBinding, type TLComponents, type TLHandle, type TLHandleDragInfo, type TLResizeInfo, type TLShape, type TLShapeId, type TLUiOverrides, type TldrawOptions, type VecModel } from "tldraw";
import { type IconType } from "react-icons";
import { RiAddLine, RiArrowDownSLine, RiArrowUpLine, RiBringForward, RiBringToFront, RiCheckLine, RiCheckboxBlankCircleLine, RiCheckboxMultipleLine, RiClipboardLine, RiCloseLine, RiCursorLine, RiDeleteBinLine, RiDownloadLine, RiEmotionSadLine, RiExportFill, RiExportLine, RiEyeLine, RiEyeOffLine, RiFileCodeLine, RiFileCopy2Line, RiFileCopyLine, RiFileImageLine, RiFileTextLine, RiFilmAiLine, RiFocus3Line, RiGoogleFill, RiHand, RiHistoryLine, RiImage2Line, RiImageAiLine, RiImageCircleLine, RiImageLine, RiInformation2Line, RiLayoutLeft2Line, RiLayoutLeftLine, RiLoader4Line, RiLockLine, RiLockUnlockLine, RiMoreLine, RiMultiImageLine, RiNodeTree, RiOpenaiFill, RiPlayLargeFill, RiResetLeftLine, RiRoadMapLine, RiScissorsCutLine, RiSendBackward, RiSendToBack, RiShining2Line, RiStackLine, RiTBoxLine, RiTextBlock, RiTextSnippet, RiTimeLine, RiTiktokFill, RiUpload2Line, RiVideoLine, RiVideoOnLine, RiVoiceprintLine, RiZoomInLine, RiZoomOutLine } from "react-icons/ri";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, bytePlusVideoGenerationModels, frontendConversationModels, frontendImageGenerationModels, getExpectedImageDimensions, getExpectedVideoDimensions, getSupportedImageResolutions, getSupportedVideoRatios, getSupportedVideoResolutions, imageGenerationModels, normalizeImageResolutionForModel, normalizeVideoRatioForModel, normalizeVideoResolutionForModel, videoGenerationModels, type ConversationModel, type GenerationModel, type ModelName } from "@/lib/models";
import { GENERIC_MEDIA_ERROR_MESSAGE, toUserErrorMessage } from "@/lib/error-message";
import { buildReferenceHint } from "@/lib/reference-hint";
import { createUploadProgressTracker } from "@/lib/upload-progress";
import { sanitizeModelOutputText } from "@/lib/text-cleanup";
import { getUploadKindFromFileName, getUploadRule, type UploadKind, type UploadKindRule, type UploadRule, type UploadRuleOverrides } from "@/lib/upload-rules";

export type WorkflowNodeKind = "text" | "image" | "video" | "audio";

export type WorkflowNodeData = {
  text?: string;
  outputText?: string;
  prompt?: string;
  model?: ModelName;
  ratio?: string;
  resolution?: string;
  duration?: string;
  videoReferenceMode?: WorkflowVideoReferenceMode;
  images?: string[];
  imageDimensions?: Record<string, { width: number; height: number }>;
  videoUrl?: string;
  audioUrl?: string;
  posterUrl?: string;
  videoDimensions?: { width: number; height: number };
  durationSeconds?: number;
  videoCurrentTime?: number;
  isLocked?: boolean;
  isHidden?: boolean;
  mediaSystemNames?: Record<string, string>;
  visualSize?: { width: number; height: number };
  error?: string;
  isRunning?: boolean;
  uploadProgress?: number;
  uploadPreviewUrl?: string;
  taskId?: string;
  videoRequestId?: string;
  imageRequestId?: string;
  startedAt?: number;
  uploads?: WorkflowUploadItem[];
  // Full reference set (own uploads + connected-node references) captured at generation time,
  // so "使用提示词" can restore every reference even after success removes the incoming edges.
  generationUploads?: WorkflowUploadItem[];
  gptImageOptimizationOriginalPrompt?: string;
  gptImageOptimizationSuccessfulPrompt?: string;
  gptImageOptimizationAttemptsUsed?: number;
  gptImageOptimizationAttemptPrompts?: string[];
  gptImageOptimizationOptimizerModel?: string;
};

type WorkflowVideoReferenceMode = "reference" | "first_frame" | "first_last_frame";
type WorkflowUploadKind = UploadKind;

type WorkflowUploadItem = {
  id: string;
  kind: WorkflowUploadKind;
  name: string;
  url?: string;
  previewUrl?: string;
  status: "uploading" | "ready" | "error";
  progress?: number;
  error?: string;
  text?: string;
  dimensions?: { width: number; height: number };
  durationSeconds?: number;
  readonlySource?: "connection";
  sourceNodeId?: string;
};

export type WorkflowNode = {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  x: number;
  y: number;
  data: WorkflowNodeData;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowCanvasState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  historicalTextNodes?: WorkflowNode[];
  historicalMediaNodes?: WorkflowNode[];
  // 累计生成计数(只增不减)。存在 canvas 里随 canvasJson 持久化，刷新/删节点都不丢、不减。
  generatedMediaCounts?: { images: number; videos: number };
};

const workflowUploadApiBaseUrl = (process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ?? "").replace(/\/$/, "");
const workflowDefaultProductionUploadApiBaseUrl = "https://api.venusface.com";

function getWorkflowUploadApiBaseUrl() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Ali 镜像用户上传走同源(ali.venusface.com)，由 Ali 反代到马来：客户端上传腿走国内更稳，Ali→马来是机房骨干。
    if (host === "ali.venusface.com" || host === "static.venusface.com" || host === "101.37.129.164") return "";
  }
  if (workflowUploadApiBaseUrl) return workflowUploadApiBaseUrl;
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "";
  if (hostname === "api.venusface.com") return "";
  if (hostname.endsWith(".venusface.com") || hostname === "101.37.129.164" || hostname === "101.47.19.109") return workflowDefaultProductionUploadApiBaseUrl;
  return "";
}

function getWorkflowUploadApiUrl(path: string) {
  const baseUrl = getWorkflowUploadApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

type UsageMeta = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usd?: number;
  cny?: number;
  credits?: number;
};

type CreditResult = {
  skipped?: boolean;
  balance?: number;
  chargedCredits?: number;
  usage?: UsageMeta;
};

type WorkflowCanvasProps = {
  workflowId: string;
  value?: WorkflowCanvasState;
  onChange: (next: WorkflowCanvasState) => void;
  workflowTitle: string;
  onCredit?: (credit?: CreditResult) => void;
  onGeneratedMedia?: (media: { nodeId: string; kind: "image" | "video"; urls: string[]; reservedNames?: string[]; posterUrl?: string; sourcePrompt: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: Record<string, { width: number; height: number }>; durationSeconds?: Record<string, number>; silent?: boolean; promptOptimization?: { originalPrompt: string; optimizedPrompt: string; attemptsUsed: number; optimizerModel: string } }) => void;
  onPreviewMedia?: (media: { nodeId: string; kind: "image" | "video"; url: string; posterUrl?: string; name: string; sourcePrompt?: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: { width: number; height: number } }) => void;
  onShowTip?: (message: string) => void;
  getImageDisplayUrl?: (url: string) => string;
  getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined;
  enabledTextModelIds?: string[];
  textModelProviders?: Record<string, "openrouter" | "byteplus">;
  enabledImageModelIds?: string[];
  enabledVideoModelIds?: string[];
  uploadRuleOverrides?: UploadRuleOverrides;
  leftSidebarVisible?: boolean;
  onToggleLeftSidebar?: () => void;
  workflowAssets?: WorkflowAssetSummary[];
  referenceAssets?: WorkflowReferenceAsset[];
  referenceAssetsLoadStatus?: "idle" | "loading" | "loaded" | "failed";
  referenceAssetCounts?: Record<string, number>;
  onLoadReferenceAssets?: () => void;
  onLoadMoreReferenceAssets?: (groupType: string, loadedCount: number) => void;
  onExternalFilesDrop?: (files: File[]) => void;
  onOpenAssetImport?: () => void;
  assetsToImport?: WorkflowAssetSummary[];
  onAssetsImported?: () => void;
};

type WorkflowAssetSummary = {
  id: string;
  name: string;
  url: string;
  posterUrl?: string;
  kind: "image" | "video";
  nodeId?: string;
  sourcePrompt?: string;
  model?: ModelName;
  ratio?: string;
  resolution?: string;
  duration?: string;
  dimensions?: { width: number; height: number };
  origin?: "generated" | "upload";
};

type WorkflowReferenceAsset = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  groupType: string;
  groupLabel: string;
};

const workflowReferenceGroupOrder = ["character_image", "scene_image", "shot_image", "conversation_upload"];
const workflowReadableDocumentFormats = ["md", "txt", "csv"];
const MAX_WORKFLOW_DOCUMENT_TEXT_CHARS = 50_000;
const MAX_WORKFLOW_DOCUMENT_CONTEXT_CHARS = 30_000;
const MEDIA_DURATION_EPSILON_SECONDS = 0.35;
const WORKFLOW_TEXT_OUTPUT_INSTRUCTIONS = "\n\n输出要求：请只用中文回答，不要夹带英文段落或英文标题；不要输出代码、代码块、命令行、JSON、Markdown 表格或反引号内容；不要解释格式规则。第一行写一个简短中文标题，不要带 # 号；正文用清晰分段、短句和列表表达。可以适当使用少量自然表情或符号做视觉提示，但不要堆砌。重点可用 **加粗**，重要提醒可用 [blue]...[/blue] 或 [red]...[/red]。";
const BYTEPLUS_AUTO_REVIEW_NOTICE = "系统检测到真人图片，需要审核才能生成视频，此次视频生成任务会延长时间，请稍候....";

class WorkflowSelectionForegroundOverlayUtil extends SelectionForegroundOverlayUtil {
  override options = { zIndex: 100, lineWidth: 3 };
}

const workflowOverlayUtils = defaultOverlayUtils.map((OverlayUtil) => OverlayUtil === SelectionForegroundOverlayUtil ? WorkflowSelectionForegroundOverlayUtil : OverlayUtil);

type WorkflowModelOptions = {
  textModels: readonly ConversationModel[];
  textModelProviders: Record<string, "openrouter" | "byteplus">;
  imageModels: readonly GenerationModel[];
  videoModels: readonly GenerationModel[];
};

type VideoApiResponse = {
  id?: string;
  job_id?: string;
  polling_url?: string;
  pollingUrl?: string;
  status?: string;
  content?: unknown;
  videoUrl?: string;
  usage?: UsageMeta;
  credit?: CreditResult;
  error?: string | { message?: string };
  errorCode?: string;
  autoBytePlusAssetReview?: { triggered?: boolean; assets?: Array<{ url?: string; assetId?: string; groupId?: string; status?: string; error?: string }> };
};

type WorkflowNodeShape = TLShape<"workflow_node">;
type WorkflowConnectionShape = TLShape<"workflow_connection">;
type WorkflowConnectionBinding = TLBinding<"workflow_connection">;

let workflowHighlightedNodeIds = "";
const workflowHighlightListeners = new Set<() => void>();

function setWorkflowHighlightedNodeIds(nodeIds: string[]) {
  const next = [...new Set(nodeIds)].sort().join("|");
  if (workflowHighlightedNodeIds === next) return;
  workflowHighlightedNodeIds = next;
  workflowHighlightListeners.forEach((listener) => listener());
}

function subscribeWorkflowHighlightedNode(listener: () => void) {
  workflowHighlightListeners.add(listener);
  return () => workflowHighlightListeners.delete(listener);
}

function useWorkflowHighlightedNodeIds() {
  return useSyncExternalStore(subscribeWorkflowHighlightedNode, () => workflowHighlightedNodeIds, () => "").split("|").filter(Boolean);
}

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    workflow_node: { w: number; h: number; node: WorkflowNode };
    workflow_connection: { start: VecModel; end: VecModel };
  }
  interface TLGlobalBindingPropsMap {
    workflow_connection: { portId: "input" | "output"; terminal: "start" | "end" };
  }
}

const NODE_WIDTH = 320;
const NODE_HEIGHT = 180;
const CARD_HEIGHT = 180;
const TEXT_NODE_WIDTH = 720;
const TEXT_NODE_HEIGHT = 480;
const DEFAULT_STATE: WorkflowCanvasState = { nodes: [], edges: [] };
const WORKFLOW_CONNECTION_PORT_GAP = 10;
const WORKFLOW_CONNECTION_PORT_SIZE = 60;
const imageRatioOptions = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const fallbackVideoDurationOptions = ["5秒", "10秒", "15秒"];
const workflowVideoModels = [...videoGenerationModels, ...bytePlusVideoGenerationModels];
const videoPollIntervalMs = 10_000;
const videoMaxPollAttempts = 90;
const videoAbsoluteMaxPollAttempts = 360;
const imagePollIntervalMs = 3_000;

type WorkflowImageJobStatus = {
  requestId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  kind?: string;
  flow?: string;
  prompt?: string;
  workflowId?: string;
  workflowNodeId?: string;
  resultUrls?: string[];
  reservedNames?: string[];
  resultDimensions?: Record<string, { width: number; height: number }>;
  usage?: UsageMeta;
  credit?: CreditResult;
  error?: string;
  errorCode?: string;
};
type WorkflowVideoJobStatus = WorkflowImageJobStatus & { posterUrl?: string; providerTaskId?: string };
const MAX_WORKFLOW_PROMPT_LENGTH = 2000;
const DEFAULT_WORKFLOW_IMAGE_MODEL = "byteplus:conversation-image.seedream-4-5";
const DEFAULT_WORKFLOW_VIDEO_MODEL = "byteplus:video.seedance-2-0";
const WORKFLOW_NODE_GAP = 160;
const workflowVideoReferenceModeOptions: Array<{ value: WorkflowVideoReferenceMode; label: string; icon: IconType }> = [
  { value: "reference", label: "融合模式", icon: RiImageCircleLine },
  { value: "first_frame", label: "首帧模式", icon: RiImage2Line },
  { value: "first_last_frame", label: "首尾帧模式", icon: RiMultiImageLine },
];

const ratioCardMeta: Record<string, { icon: string; width: string; height: string }> = {
  智能比例: { icon: "spark", width: "16", height: "16" },
  "16:9": { icon: "rect", width: "18", height: "10" },
  "21:9": { icon: "rect", width: "18", height: "8" },
  "9:16": { icon: "rect", width: "10", height: "18" },
  "1:1": { icon: "rect", width: "14", height: "14" },
  "3:4": { icon: "rect", width: "12", height: "16" },
  "4:3": { icon: "rect", width: "16", height: "16" },
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getWorkflowUploadAccept(rule: UploadRule, kind: WorkflowUploadKind) {
  const kindRule = rule[kind];
  if (!kindRule.enabled) return "";
  const mimeByFormat: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    md: "text/markdown",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };
  const values = new Set<string>();
  kindRule.formats.forEach((format) => {
    values.add(`.${format}`);
    const mime = mimeByFormat[format];
    if (mime) values.add(mime);
  });
  return Array.from(values).join(",");
}

function getWorkflowUploadRule(node: WorkflowNode, overrides?: UploadRuleOverrides, videoReferenceMode?: WorkflowVideoReferenceMode) {
  const mode = node.kind === "text" ? "agent" : node.kind === "audio" ? "video" : node.kind;
  return getUploadRule({ mode, modelId: node.data.model, transportMode: node.kind === "video" ? "server-url" : "local-base64", videoReferenceMode: node.kind === "video" ? videoReferenceMode ?? node.data.videoReferenceMode ?? getWorkflowUploadRuleVideoReferenceMode(node.data.prompt ?? "") : undefined }, overrides);
}

const disabledWorkflowUploadRule: UploadKindRule = { enabled: false, maxCount: 0, maxSizeMb: 0, formats: [] };
const workflowReadableDocumentUploadRule: UploadKindRule = { enabled: true, maxCount: 5, maxSizeMb: 10, formats: workflowReadableDocumentFormats };

function getEffectiveWorkflowUploadRule(node: WorkflowNode, overrides?: UploadRuleOverrides, videoReferenceMode?: WorkflowVideoReferenceMode) {
  const rule = getWorkflowUploadRule(node, overrides, videoReferenceMode);

  return { ...rule, document: node.kind === "text" ? workflowReadableDocumentUploadRule : disabledWorkflowUploadRule };
}

function sanitizeWorkflowReferenceName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[@\s，。！？；;、]+/g, "").trim() || "上传文件";
}

function escapeWorkflowRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeWorkflowUploadReferenceText(prompt: string, referenceName: string) {
  if (!referenceName) return prompt;
  return prompt.replace(new RegExp(`@${escapeWorkflowRegExp(referenceName)}(?=$|[\\s，。！？；;、])`, "g"), "").replace(/[ \t]{2,}/g, " ");
}

function sortWorkflowDurationOptions(options: string[]) {
  return [...options].sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
}

function getWorkflowUploadRuleVideoReferenceMode(text: string): WorkflowVideoReferenceMode | undefined {
  const normalized = text.replace(/\s+/g, "");
  if (/首尾帧|首帧.*尾帧|尾帧.*首帧|第一帧.*最后一帧|最后一帧.*第一帧|开头帧.*结尾帧|结尾帧.*开头帧/.test(normalized)) return "first_last_frame";
  if (/尾帧|最后一帧|结尾帧|结束帧|收尾帧|作为结尾|当作结尾|做结尾|做尾帧|以这张图结束|以此图结束/.test(normalized)) return undefined;
  if (/首帧|第一帧|开头帧|起始帧|开始帧|作为开头|当作开头|做开头|做首帧|从这张图开始|以这张图开始|用这张图开头/.test(normalized)) return "first_frame";
  return undefined;
}

function isWorkflowBytePlusSeedanceVideoModel(modelId?: string) {
  return modelId === "byteplus:video.seedance-2-0" || modelId === "byteplus:video.seedance-2-0-fast" || modelId === "byteplus:video.seedance-2-0-mini";
}

function getWorkflowVideoReferenceModeLabel(value?: WorkflowVideoReferenceMode) {
  return workflowVideoReferenceModeOptions.find((option) => option.value === value)?.label ?? "融合模式";
}

function getWorkflowEffectiveBytePlusVideoReferenceItems<T>(items: T[] | undefined, mode?: WorkflowVideoReferenceMode): T[] {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (mode === "first_last_frame") return safeItems.slice(0, 2);
  if (mode === "first_frame") return safeItems.slice(0, 1);
  return safeItems.slice(0, 9);
}

function getWorkflowBytePlusVideoReferenceLimitHint(mode?: WorkflowVideoReferenceMode) {
  if (mode === "first_last_frame") return "首尾帧模式只会使用前两张参考图";
  if (mode === "first_frame") return "首帧模式只会使用第一张参考图";
  return "融合模式最多使用九张参考图";
}

function appendWorkflowReferenceHint(prompt: string, referenceNames: Array<string | undefined>) {
  const hint = buildReferenceHint(prompt, referenceNames);
  return hint ? `${prompt}\n\n${hint}` : prompt;
}

function pruneWorkflowUploadsForRule(node: WorkflowNode, uploadRule: UploadRule) {
  const uploads = node.data.uploads ?? [];
  if (uploads.length === 0) return {};

  const seenCounts: Record<WorkflowUploadKind, number> = { image: 0, document: 0, video: 0, audio: 0 };
  const keptUploads = uploads.filter((upload) => {
    const rule = uploadRule[upload.kind];
    if (!rule?.enabled) return false;
    if (seenCounts[upload.kind] >= rule.maxCount) return false;
    seenCounts[upload.kind] += 1;
    return true;
  });
  if (keptUploads.length === uploads.length) return {};

  const removedUploads = uploads.filter((upload) => !keptUploads.includes(upload));
  const prompt = removedUploads.reduce((current, upload) => removeWorkflowUploadReferenceText(current, getWorkflowUploadReferenceName(upload)), node.data.prompt ?? "");
  return { uploads: keptUploads, prompt };
}

function pruneWorkflowUploadsForModel(node: WorkflowNode, model: ModelName, overrides?: UploadRuleOverrides) {
  const uploads = node.data.uploads ?? [];
  if (uploads.length === 0) return {};

  const nextNode = { ...node, data: { ...node.data, model } };
  const uploadRule = getEffectiveWorkflowUploadRule(nextNode, overrides);
  return pruneWorkflowUploadsForRule(nextNode, uploadRule);
}

function pruneWorkflowUploadsForVideoReferenceMode(node: WorkflowNode, videoReferenceMode: WorkflowVideoReferenceMode, overrides?: UploadRuleOverrides) {
  return pruneWorkflowUploadsForRule({ ...node, data: { ...node.data, videoReferenceMode } }, getEffectiveWorkflowUploadRule(node, overrides, videoReferenceMode));
}

function readWorkflowFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function decodeWorkflowTextBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const hasUtf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    const utf8Text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return hasUtf8Bom ? utf8Text.replace(/^\uFEFF/, "") : utf8Text;
  } catch {
    try {
      return new TextDecoder("gb18030").decode(bytes);
    } catch {
      return new TextDecoder("gbk").decode(bytes);
    }
  }
}

function readWorkflowDocumentText(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(96, Math.max(8, Math.round((event.loaded / event.total) * 96))));
    };
    reader.onload = () => {
      onProgress(100);
      const text = reader.result instanceof ArrayBuffer ? decodeWorkflowTextBuffer(reader.result) : "";
      resolve(text.slice(0, MAX_WORKFLOW_DOCUMENT_TEXT_CHARS));
    };
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
}

function getWorkflowImageFileDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      URL.revokeObjectURL(objectUrl);
      width && height ? resolve({ width, height }) : reject(new Error("图片尺寸读取失败"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片尺寸读取失败"));
    };
    image.src = objectUrl;
  });
}

function getWorkflowUploadDuration(upload: WorkflowUploadItem) {
  return Math.max(0, upload.durationSeconds ?? 0);
}

function validateWorkflowMediaDuration(kindLabel: string, durationSeconds: number | undefined, rule: { minSeconds?: number; maxSeconds?: number }) {
  if (!Number.isFinite(durationSeconds ?? Number.NaN) || !durationSeconds) return `${kindLabel}时长读取失败`;
  if (rule.minSeconds !== undefined && durationSeconds < rule.minSeconds - MEDIA_DURATION_EPSILON_SECONDS) return `${kindLabel}时长不能少于 ${rule.minSeconds} 秒`;
  if (rule.maxSeconds !== undefined && durationSeconds > rule.maxSeconds + MEDIA_DURATION_EPSILON_SECONDS) return `${kindLabel}时长不能超过 ${rule.maxSeconds} 秒`;
  return undefined;
}

function validateWorkflowReferenceVideoDimensions(dimensions?: { width: number; height: number }) {
  if (!dimensions?.width || !dimensions.height) return "视频尺寸读取失败";
  const ratio = dimensions.width / dimensions.height;
  if (ratio < 0.4 || ratio > 2.5) return "视频宽高比需在 0.4 到 2.5 之间";
  if (dimensions.width < 300 || dimensions.width > 6000 || dimensions.height < 300 || dimensions.height > 6000) return "视频宽高需在 300 到 6000 像素之间";
  const pixels = dimensions.width * dimensions.height;
  if (pixels < 409600 || pixels > 2086876) return "视频总像素需在 409600 到 2086876 之间";
  return undefined;
}

function readWorkflowMediaFileMetadata(file: File, kind: "video" | "audio") {
  return new Promise<{ durationSeconds?: number; dimensions?: { width: number; height: number } }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = kind === "video" ? document.createElement("video") : document.createElement("audio");
    const cleanup = () => URL.revokeObjectURL(url);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const durationSeconds = Number.isFinite(element.duration) ? element.duration : undefined;
      const dimensions = kind === "video"
        ? { width: Math.floor((element as HTMLVideoElement).videoWidth), height: Math.floor((element as HTMLVideoElement).videoHeight) }
        : undefined;
      cleanup();
      resolve({ durationSeconds, dimensions: dimensions?.width && dimensions.height ? dimensions : undefined });
    };
    element.onerror = () => {
      cleanup();
      reject(new Error(kind === "video" ? "视频信息读取失败" : "音频信息读取失败"));
    };
    element.src = url;
  });
}

function appendWorkflowDocumentContext(prompt: string, uploads?: WorkflowUploadItem[]) {
  const documents = (uploads ?? []).filter((upload) => upload.kind === "document" && upload.status === "ready" && upload.text?.trim());
  if (documents.length === 0) return prompt;

  let remaining = MAX_WORKFLOW_DOCUMENT_CONTEXT_CHARS;
  const sections: string[] = [];
  documents.forEach((document, index) => {
    if (remaining <= 0) return;
    const content = (document.text ?? "").trim().slice(0, remaining);
    if (!content) return;
    remaining -= content.length;
    sections.push(`文档${index + 1}：${document.name}\n${content}`);
  });

  if (sections.length === 0) return prompt;
  return `${prompt || "请阅读我上传的文档，并告诉我可以怎么继续创作。"}\n\n已读取文档内容如下。请把这些内容作为当前上下文，不要假装没有读取：\n\n${sections.join("\n\n---\n\n")}`;
}

async function getWorkflowDirectUploadToken() {
  if (!getWorkflowUploadApiBaseUrl()) return "";
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20 * 1000);
  try {
    const response = await fetch("/api/upload-token", { method: "POST", cache: "no-store", signal: controller.signal });
    const data = await readJson<{ token?: string; error?: string }>(response);
    if (!data.token) throw new Error(data.error || "上传授权失败");
    return data.token;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("上传授权超时，请重试");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function uploadWorkflowFormDataWithProgress<T>(url: string, formData: FormData, onProgress?: (progress: number) => void, token?: string) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const tracker = createUploadProgressTracker(onProgress);
    let settled = false;
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      tracker.cancel();
      reject(error);
    };
    const resolveOnce = (data: T) => {
      if (settled) return;
      settled = true;
      resolve(data);
    };
    try {
      xhr.open("POST", url);
      xhr.timeout = 180 * 1000;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error("上传初始化失败"));
      return;
    }
    xhr.upload.onprogress = tracker.onUploadProgress;
    xhr.upload.onload = tracker.onBytesComplete;
    xhr.onload = () => {
      let data: T & { error?: string };
      try {
        data = JSON.parse(xhr.responseText || "{}") as T & { error?: string };
      } catch {
        rejectOnce(new Error("上传失败"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        rejectOnce(new Error(data.error || "上传失败"));
        return;
      }
      tracker.finish();
      resolveOnce(data);
    };
    xhr.onabort = () => rejectOnce(new Error("上传已取消"));
    xhr.onerror = () => rejectOnce(new Error("上传失败，请检查网络或跨域配置"));
    xhr.ontimeout = () => rejectOnce(new Error("上传超时，请重试"));
    try {
      xhr.send(formData);
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error("上传发送失败"));
    }
  });
}

async function uploadWorkflowImageOnce(file: File, onProgress?: (progress: number) => void, forceReencode = false, dedup = false) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  if (forceReencode) formData.append("forceReencode", "1");
  if (dedup) formData.append("dedup", "1");
  onProgress?.(2);
  const token = await getWorkflowDirectUploadToken();
  const postData = await uploadWorkflowFormDataWithProgress<{ token?: string; error?: string; duplicate?: boolean; url?: string; contentHash?: string }>(getWorkflowUploadApiUrl("/api/asset-upload-temp"), formData, onProgress, token);
  if (postData.duplicate && postData.url) return { url: postData.url, duplicate: true as const, contentHash: postData.contentHash };
  if (!postData.token) throw new Error(postData.error || "图片上传失败");
  const patchToken = await getWorkflowDirectUploadToken();
  const patchResponse = await fetch(getWorkflowUploadApiUrl("/api/asset-upload-temp"), { method: "PATCH", headers: { "Content-Type": "application/json", ...(patchToken ? { Authorization: `Bearer ${patchToken}` } : {}) }, body: JSON.stringify({ token: postData.token }) });
  const patchData = await readJson<{ url?: string; error?: string }>(patchResponse);
  if (!patchData.url) throw new Error(patchData.error || "图片保存失败");
  return { url: patchData.url, duplicate: false as const, contentHash: postData.contentHash };
}

async function uploadWorkflowImage(file: File, onProgress?: (progress: number) => void, dedup = false) {
  try {
    return await uploadWorkflowImageOnce(file, onProgress, false, dedup);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("转码")) throw error;
    return uploadWorkflowImageOnce(file, onProgress, true, dedup);
  }
}

async function uploadWorkflowFile(file: File, kind: Exclude<WorkflowUploadKind, "image">, onProgress?: (progress: number) => void) {
  // 二进制流式上传，避免 base64+JSON 大字符串导致的极慢和事件循环阻塞。
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("name", file.name);
  formData.append("mediaKind", kind);
  const token = await getWorkflowDirectUploadToken();
  const data = await uploadWorkflowFormDataWithProgress<{ url?: string; error?: string }>(getWorkflowUploadApiUrl("/api/upload-file"), formData, onProgress, token);
  if (!data.url) throw new Error(data.error || "文件上传失败");
  return data.url;
}

function getWorkflowMentionNames(text: string) {
  return [...text.matchAll(/@([^@\s，。！？；;、]+)/g)].map((match) => match[1]);
}

function getWorkflowUploadReferenceName(upload: WorkflowUploadItem) {
  return sanitizeWorkflowReferenceName(upload.name);
}

function getWorkflowUploadMediaSrc(upload: WorkflowUploadItem) {
  if (upload.url) return getStaticMediaUrl(upload.url) ?? upload.url;
  return upload.previewUrl;
}

function getWorkflowNameExtension(name: string) {
  const cleanName = name.split("?")[0]?.split("#")[0]?.split(/[\\/]/).pop() ?? "";
  const dotIndex = cleanName.lastIndexOf(".");
  return dotIndex >= 0 && dotIndex < cleanName.length - 1 ? cleanName.slice(dotIndex + 1).toLowerCase() : "";
}

function getWorkflowMimeExtension(mimeType: string) {
  const subtype = mimeType.split(";")[0]?.split("/")[1]?.toLowerCase() ?? "";
  if (subtype === "jpg") return "jpeg";
  if (subtype === "quicktime") return "mov";
  if (subtype === "mpeg") return "mp3";
  return subtype;
}

function getWorkflowFileExtension(file: File) {
  return getWorkflowNameExtension(file.name) || getWorkflowMimeExtension(file.type);
}

function getWorkflowUploadExtension(upload: WorkflowUploadItem) {
  const fromName = getWorkflowNameExtension(upload.name);
  if (fromName) return fromName;
  const source = upload.url ?? upload.previewUrl ?? "";
  return getWorkflowNameExtension(source);
}

function validateWorkflowUploadNodeFile(file: File, kind: "image" | "video" | "audio" | "text", media?: { durationSeconds?: number; dimensions?: { width: number; height: number } }, text?: string) {
  const extension = getWorkflowFileExtension(file);
  if (kind === "text") return (text ?? "").length > 2000 ? "上传文本不能超过 2000 字" : undefined;
  if (kind === "image") {
    if (!["jpg", "jpeg", "png", "webp"].includes(extension)) return "上传图片只支持 jpg、jpeg、png、webp";
    if (file.size > 5 * 1024 * 1024) return "上传图片不能超过 5MB";
    return undefined;
  }
  if (kind === "video") {
    if (!["mp4", "mov"].includes(extension)) return "上传视频只支持 mp4、mov";
    if (file.size > 50 * 1024 * 1024) return "上传视频不能超过 50MB";
    return validateWorkflowMediaDuration("视频", media?.durationSeconds, { minSeconds: 2, maxSeconds: 15 }) ?? validateWorkflowReferenceVideoDimensions(media?.dimensions);
  }
  if (!["mp3", "wav"].includes(extension)) return "上传音频只支持 mp3、wav";
  if (file.size > 15 * 1024 * 1024) return "上传音频不能超过 15MB";
  return validateWorkflowMediaDuration("音频", media?.durationSeconds, { minSeconds: 2, maxSeconds: 15 });
}

function persistWorkflowUploadNodeAsset(input: { url: string; name: string; mediaType: "image" | "video" | "audio" | "document"; workflowId: string; workflowNodeId: string; sourcePrompt: string; file: File; dimensions?: { width: number; height: number }; durationSeconds?: number; settings?: { ratio?: string; resolution?: string; duration?: string }; contentHash?: string }) {
  return fetch("/api/media-assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: input.url,
      name: input.name,
      currentCategory: input.mediaType === "image" ? "conversation_uploads" : input.mediaType === "video" ? "workflow_upload_videos" : input.mediaType === "audio" ? "workflow_upload_audios" : "workflow_upload_documents",
      mediaType: input.mediaType,
      dimensions: input.dimensions,
      durationSeconds: input.durationSeconds,
      sourcePrompt: input.sourcePrompt,
      sourceDetail: { uploadNode: true, originalFileName: input.file.name, mimeType: input.file.type, fileSize: input.file.size },
      promptSource: "upload",
      workflowId: input.workflowId,
      workflowNodeId: input.workflowNodeId,
      originalFileName: input.file.name,
      mimeType: input.file.type,
      fileSize: input.file.size,
      settings: input.settings,
      contentHash: input.contentHash,
    }),
  });
}

function getWorkflowPromptReferenceUrls(prompt: string, node: WorkflowNode, referenceAssets: WorkflowReferenceAsset[], kind: "image" | "video" | "audio") {
  const names = new Set(getWorkflowMentionNames(prompt));
  const urls: string[] = [];
  referenceAssets.forEach((asset) => {
    if (kind === "image" && names.has(asset.name) && !urls.includes(asset.url)) urls.push(asset.url);
  });
  (node.data.uploads ?? []).forEach((upload) => {
    if (upload.status !== "ready" || !upload.url || upload.kind !== kind) return;
    if (!urls.includes(upload.url)) urls.push(upload.url);
  });
  return urls;
}

function validateWorkflowUploadsForSubmit(node: WorkflowNode, overrides?: UploadRuleOverrides, videoReferenceMode?: WorkflowVideoReferenceMode) {
  const uploadRule = getEffectiveWorkflowUploadRule(node, overrides, videoReferenceMode);
  const uploads = node.data.uploads ?? [];
  if (uploads.some((upload) => upload.status === "uploading")) return "文件上传中";
  if (uploads.some((upload) => upload.status === "error")) return "有文件上传失败，请删除后重新上传";

  for (const kind of ["image", "document", "video", "audio"] as const) {
    const kindUploads = uploads.filter((upload) => upload.kind === kind);
    const kindRule = uploadRule[kind];
    if (kindUploads.length === 0) continue;
    if (!kindRule.enabled) return kind === "image" ? "当前模型不支持上传图片" : kind === "video" ? "当前模型不支持上传视频" : kind === "audio" ? "当前模型不支持上传音频" : "当前模型不支持上传文件";
    if (kindUploads.length > kindRule.maxCount) return kind === "image" ? `当前模型最多支持 ${kindRule.maxCount} 张参考图，不能上传更多图片` : kind === "video" ? `当前模型最多支持 ${kindRule.maxCount} 个参考视频` : kind === "audio" ? `当前模型最多支持 ${kindRule.maxCount} 个参考音频` : `当前类型最多支持 ${kindRule.maxCount} 个文件`;
    const badFormat = kindUploads.find((upload) => {
      const extension = getWorkflowUploadExtension(upload);
      return extension ? !kindRule.formats.includes(extension) : !upload.url;
    });
    if (badFormat) return kind === "image" ? "当前模型不支持该图片格式" : kind === "video" ? "当前模型不支持该视频格式" : kind === "audio" ? "当前模型不支持该音频格式" : "当前模型不支持该文件格式";
  }

  const videoUploads = uploads.filter((upload) => upload.kind === "video");
  let videoDuration = 0;
  for (const upload of videoUploads) {
    const durationError = validateWorkflowMediaDuration("视频", upload.durationSeconds, uploadRule.video);
    const dimensionError = validateWorkflowReferenceVideoDimensions(upload.dimensions);
    if (durationError) return durationError;
    if (dimensionError) return dimensionError;
    videoDuration += getWorkflowUploadDuration(upload);
  }
  if (uploadRule.video.maxTotalSeconds !== undefined && videoDuration > uploadRule.video.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) return `参考视频总时长不能超过 ${uploadRule.video.maxTotalSeconds} 秒`;

  const audioUploads = uploads.filter((upload) => upload.kind === "audio");
  let audioDuration = 0;
  for (const upload of audioUploads) {
    const durationError = validateWorkflowMediaDuration("音频", upload.durationSeconds, uploadRule.audio);
    if (durationError) return durationError;
    audioDuration += getWorkflowUploadDuration(upload);
  }
  if (uploadRule.audio.maxTotalSeconds !== undefined && audioDuration > uploadRule.audio.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) return `参考音频总时长不能超过 ${uploadRule.audio.maxTotalSeconds} 秒`;

  return undefined;
}

function canShowWorkflowUploadButton(kind: WorkflowUploadKind, uploads: WorkflowUploadItem[], uploadRule: UploadRule) {
  const kindRule = uploadRule[kind];
  if (!kindRule.enabled) return false;
  const kindUploads = uploads.filter((upload) => upload.kind === kind);
  if (kindUploads.length >= kindRule.maxCount) return false;
  if ((kind === "video" || kind === "audio") && kindRule.maxTotalSeconds !== undefined) {
    const usedDuration = kindUploads.reduce((sum, upload) => sum + getWorkflowUploadDuration(upload), 0);
    if (usedDuration >= kindRule.maxTotalSeconds - MEDIA_DURATION_EPSILON_SECONDS) return false;
  }
  return true;
}

function mergeWorkflowUploadItems(uploads: WorkflowUploadItem[]) {
  const merged: WorkflowUploadItem[] = [];
  uploads.forEach((upload) => {
    const key = upload.url ? `${upload.kind}:${upload.url}` : upload.id;
    if (merged.some((item) => (item.url ? `${item.kind}:${item.url}` : item.id) === key)) return;
    merged.push(upload);
  });
  return merged;
}

function getWorkflowNodeOutputUploadItems(node: WorkflowNode): WorkflowUploadItem[] {
  if (node.kind === "image") {
    return (node.data.images ?? []).map((url, index) => ({
      id: `connection-${node.id}-image-${index}`,
      kind: "image" as const,
      name: node.data.mediaSystemNames?.[url] ?? `图片${index + 1}`,
      url,
      status: "ready" as const,
      progress: 100,
      dimensions: node.data.imageDimensions?.[url],
      readonlySource: "connection" as const,
      sourceNodeId: node.id,
    }));
  }
  if (node.kind === "video" && node.data.videoUrl) {
    return [{
      id: `connection-${node.id}-video`,
      kind: "video" as const,
      name: node.data.mediaSystemNames?.[node.data.videoUrl] ?? "视频生成",
      url: node.data.videoUrl,
      previewUrl: node.data.posterUrl,
      status: "ready" as const,
      progress: 100,
      dimensions: node.data.videoDimensions,
      durationSeconds: node.data.durationSeconds,
      readonlySource: "connection" as const,
      sourceNodeId: node.id,
    }];
  }
  if (node.kind === "audio" && node.data.audioUrl) {
    return [{
      id: `connection-${node.id}-audio`,
      kind: "audio" as const,
      name: node.data.mediaSystemNames?.[node.data.audioUrl] ?? "上传音频",
      url: node.data.audioUrl,
      status: "ready" as const,
      progress: 100,
      durationSeconds: node.data.durationSeconds,
      readonlySource: "connection" as const,
      sourceNodeId: node.id,
    }];
  }
  return [];
}

function getWorkflowConnectedInputUploads(state: WorkflowCanvasState, nodeId: string, extraSource?: WorkflowNode) {
  const sourceNodes = state.edges.filter((edge) => edge.target === nodeId).map((edge) => state.nodes.find((node) => node.id === edge.source)).filter(Boolean) as WorkflowNode[];
  if (extraSource && !sourceNodes.some((node) => node.id === extraSource.id)) sourceNodes.push(extraSource);
  const uploads: WorkflowUploadItem[] = [];
  sourceNodes.forEach((source) => {
    getWorkflowNodeOutputUploadItems(source).forEach((upload) => {
      if (upload.url && uploads.some((item) => item.url === upload.url && item.kind === upload.kind)) return;
      uploads.push(upload);
    });
  });
  return mergeWorkflowUploadItems(uploads);
}

function removeConnectedReferenceNames(nodes: WorkflowNode[], removedEdges: Array<{ source: string; target: string }>): WorkflowNode[] {
  if (removedEdges.length === 0) return nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const namesByTarget = new Map<string, string[]>();
  removedEdges.forEach(({ source, target }) => {
    const sourceNode = nodeById.get(source);
    if (!sourceNode) return;
    const names = getWorkflowNodeOutputUploadItems(sourceNode).map(getWorkflowUploadReferenceName).filter(Boolean);
    if (names.length === 0) return;
    namesByTarget.set(target, [...(namesByTarget.get(target) ?? []), ...names]);
  });
  if (namesByTarget.size === 0) return nodes;
  return nodes.map((node) => {
    const names = namesByTarget.get(node.id);
    if (!names?.length) return node;
    const prompt = names.reduce((current, name) => removeWorkflowUploadReferenceText(current, name), node.data.prompt ?? "");
    if (prompt === (node.data.prompt ?? "")) return node;
    return { ...node, data: { ...node.data, prompt } };
  });
}

function getWorkflowGenerationUploadSnapshot(state: WorkflowCanvasState, node: WorkflowNode): WorkflowUploadItem[] {
  const connectedUploads = getWorkflowConnectedInputUploads(state, node.id);
  return mergeWorkflowUploadItems([...(node.data.uploads ?? []), ...connectedUploads])
    .filter((upload) => upload.status === "ready" && Boolean(upload.url))
    .map((upload) => {
      const { readonlySource: _readonlySource, sourceNodeId: _sourceNodeId, ...rest } = upload;
      return { ...rest, status: "ready" as const };
    });
}

function validateWorkflowConnectionUploadRules(source: WorkflowNode, target: WorkflowNode, state: WorkflowCanvasState, overrides?: UploadRuleOverrides) {
  const connectedUploads = getWorkflowConnectedInputUploads(state, target.id, source);
  if (connectedUploads.length === 0) return undefined;
  return validateWorkflowUploadsForSubmit({ ...target, data: { ...target.data, uploads: mergeWorkflowUploadItems([...(target.data.uploads ?? []), ...connectedUploads]) } }, overrides, target.kind === "video" && isWorkflowBytePlusSeedanceVideoModel(target.data.model) ? target.data.videoReferenceMode ?? "reference" : undefined);
}

function getWorkflowTextNodeOutput(node: WorkflowNode) {
  return node.kind === "text" ? node.data.text?.trim() || node.data.prompt?.trim() || node.data.outputText?.trim() || "" : "";
}

function validateWorkflowConnectionTextLimit(source: WorkflowNode, target: WorkflowNode, state: WorkflowCanvasState) {
  if (source.kind !== "text") return undefined;
  const existingText = state.edges
    .filter((edge) => edge.target === target.id)
    .map((edge) => state.nodes.find((node) => node.id === edge.source))
    .filter((node): node is WorkflowNode => Boolean(node))
    .map(getWorkflowTextNodeOutput)
    .filter(Boolean)
    .join("\n\n");
  const combinedPrompt = [target.data.prompt?.trim() ?? "", existingText, getWorkflowTextNodeOutput(source)].filter(Boolean).join("\n\n").trim();
  return Array.from(combinedPrompt).length > MAX_WORKFLOW_PROMPT_LENGTH ? `连接后提示词超过 ${MAX_WORKFLOW_PROMPT_LENGTH} 字，请缩短文本节点或输入框内容` : undefined;
}

function getShapeId(nodeId: string) {
  return createShapeId(nodeId);
}

function getWorkflowConnectionShapeId(edgeId: string) {
  return createShapeId(`workflow_connection_${edgeId}`);
}

function getWorkflowConnectionControlPoints(start: { x: number; y: number }, end: { x: number; y: number }) {
  const distance = end.x - start.x;
  const control = Math.max(30, distance > 0 ? distance / 3 : Math.min(Math.abs(distance) + 30, 100));
  return [new Vec(start.x + control, start.y), new Vec(end.x - control, end.y)] as const;
}

function getWorkflowConnectionPath(start: { x: number; y: number }, end: { x: number; y: number }) {
  const [cp1, cp2] = getWorkflowConnectionControlPoints(start, end);
  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
}

function getWorkflowConnectionCenter(start: { x: number; y: number }, end: { x: number; y: number }) {
  const [cp1, cp2] = getWorkflowConnectionControlPoints(start, end);
  return { x: (start.x + 3 * cp1.x + 3 * cp2.x + end.x) / 8, y: (start.y + 3 * cp1.y + 3 * cp2.y + end.y) / 8 };
}

function getWorkflowConnectionPorts(source: WorkflowNode, target: WorkflowNode) {
  const sourceSize = getWorkflowNodeVisualSize(source);
  const targetSize = getWorkflowNodeVisualSize(target);
  return {
    start: { x: source.x + sourceSize.w, y: source.y + sourceSize.h / 2 },
    end: { x: target.x, y: target.y + targetSize.h / 2 },
  };
}

function getWorkflowNodePortPagePoint(shape: WorkflowNodeShape, portId: "input" | "output") {
  const size = getWorkflowNodeVisualSize(shape.props.node);
  const local = portId === "output" ? { x: size.w, y: size.h / 2 } : { x: 0, y: size.h / 2 };
  return { x: shape.x + local.x, y: shape.y + local.y };
}

function getWorkflowConnectionBindings(editor: Editor, connection: WorkflowConnectionShape | TLShapeId) {
  const connectionId = typeof connection === "string" ? connection : connection.id;
  const bindings = editor.getBindingsFromShape(connectionId, "workflow_connection") as WorkflowConnectionBinding[];
  return {
    start: bindings.find((binding) => binding.props.terminal === "start"),
    end: bindings.find((binding) => binding.props.terminal === "end"),
  };
}

function getWorkflowConnectionNodeIds(editor: Editor, connection: WorkflowConnectionShape | TLShapeId) {
  const bindings = getWorkflowConnectionBindings(editor, connection);
  const startShape = bindings.start ? editor.getShape(bindings.start.toId) : undefined;
  const endShape = bindings.end ? editor.getShape(bindings.end.toId) : undefined;
  return {
    start: startShape?.type === "workflow_node" ? (startShape as WorkflowNodeShape).props.node.id : undefined,
    end: endShape?.type === "workflow_node" ? (endShape as WorkflowNodeShape).props.node.id : undefined,
  };
}

function getWorkflowConnectionBindingPosition(editor: Editor, binding: WorkflowConnectionBinding) {
  const target = editor.getShape(binding.toId) as WorkflowNodeShape | undefined;
  if (!target || target.type !== "workflow_node") return null;
  return getWorkflowNodePortPagePoint(target, binding.props.portId);
}

function createOrUpdateWorkflowConnectionBinding(editor: Editor, connectionId: TLShapeId, targetId: TLShapeId, props: WorkflowConnectionBinding["props"]) {
  const existing = (editor.getBindingsFromShape(connectionId, "workflow_connection") as WorkflowConnectionBinding[]).filter((binding) => binding.props.terminal === props.terminal);
  if (existing.length > 1) editor.deleteBindings(existing.slice(1));
  if (existing[0]) editor.updateBinding({ ...existing[0], toId: targetId, props });
  else editor.createBinding({ type: "workflow_connection", fromId: connectionId, toId: targetId, props });
}

function getWorkflowPortAtPoint(editor: Editor, pagePoint: { x: number; y: number }, terminal: "start" | "end"): { shape: WorkflowNodeShape; portId: "input" | "output" } | null {
  const portId = terminal === "start" ? "output" : "input";
  const margin = 40;
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== "workflow_node") continue;
    const workflowShape = shape as WorkflowNodeShape;
    const node = workflowShape.props.node;
    if (portId === "output" && !canWorkflowNodeOutput(node)) continue;
    if (portId === "input" && !canWorkflowNodeInput(node)) continue;
    const port = getWorkflowNodePortPagePoint(workflowShape, portId);
    if (Math.hypot(port.x - pagePoint.x, port.y - pagePoint.y) <= margin) return { shape: workflowShape, portId };
  }
  return null;
}

function getWorkflowConnectionTerminals(editor: Editor, connection: WorkflowConnectionShape) {
  const shapeTransform = Mat.Inverse(editor.getShapePageTransform(connection));
  const bindings = getWorkflowConnectionBindings(editor, connection);
  let start: VecModel | undefined;
  let end: VecModel | undefined;
  const startPage = bindings.start ? getWorkflowConnectionBindingPosition(editor, bindings.start) : null;
  const endPage = bindings.end ? getWorkflowConnectionBindingPosition(editor, bindings.end) : null;
  if (startPage) start = Mat.applyToPoint(shapeTransform, startPage);
  if (endPage) end = Mat.applyToPoint(shapeTransform, endPage);
  return { start: start ?? connection.props.start, end: end ?? connection.props.end };
}

function syncWorkflowConnectionShapes(editor: Editor, state: WorkflowCanvasState) {
  const edgeIds = new Set(state.edges.map((edge) => edge.id));
  const existingConnections = editor.getCurrentPageShapes().filter((shape) => shape.type === "workflow_connection" || (shape.type === "arrow" && typeof shape.meta?.workflowEdgeId === "string"));
  const staleConnections = existingConnections.filter((shape) => shape.type === "arrow" || !edgeIds.has(String(shape.meta?.workflowEdgeId))).map((shape) => shape.id);
  if (staleConnections.length > 0) editor.deleteShapes(staleConnections);

  const connectionShapeIds: TLShapeId[] = [];
  for (const edge of state.edges) {
    const source = state.nodes.find((node) => node.id === edge.source);
    const target = state.nodes.find((node) => node.id === edge.target);
    if (!source || !target) continue;
    const { start, end } = getWorkflowConnectionPorts(source, target);
    const id = getWorkflowConnectionShapeId(edge.id);
    connectionShapeIds.push(id);
    const shape = editor.getShape(id) as WorkflowConnectionShape | undefined;
    const props = { start: { x: 0, y: 0 }, end: { x: end.x - start.x, y: end.y - start.y } };
    const meta = { ...shape?.meta, workflowEdgeId: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target };
    if (shape) editor.updateShape<WorkflowConnectionShape>({ id, type: "workflow_connection", x: start.x, y: start.y, meta, props });
    else editor.createShapes([{ id, type: "workflow_connection", x: start.x, y: start.y, meta, props }] as never);
    createOrUpdateWorkflowConnectionBinding(editor, id, getShapeId(source.id), { portId: "output", terminal: "start" });
    createOrUpdateWorkflowConnectionBinding(editor, id, getShapeId(target.id), { portId: "input", terminal: "end" });
  }
  if (connectionShapeIds.length > 0) editor.sendToBack(connectionShapeIds);
}

function getWorkflowEdgesFromConnectionShapes(editor: Editor, current: WorkflowCanvasState) {
  const existingByPair = new Map(current.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.id]));
  const edges: WorkflowEdge[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== "workflow_connection") continue;
    const connection = shape as WorkflowConnectionShape;
    const bindings = getWorkflowConnectionBindings(editor, connection);
    if (!bindings.start || !bindings.end) continue;
    const sourceShape = editor.getShape(bindings.start.toId) as WorkflowNodeShape | undefined;
    const targetShape = editor.getShape(bindings.end.toId) as WorkflowNodeShape | undefined;
    if (!sourceShape || !targetShape || sourceShape.type !== "workflow_node" || targetShape.type !== "workflow_node") continue;
    const source = sourceShape.props.node.id;
    const target = targetShape.props.node.id;
    const pairKey = `${source}->${target}`;
    edges.push({ id: existingByPair.get(pairKey) ?? String(connection.meta?.workflowEdgeId ?? createId("workflow_edge")), source, target });
  }
  return edges;
}

function getNodeIdFromShapeId(shapeId: string) {
  return shapeId.replace(/^shape:/, "");
}

function getNodeLabel(kind: WorkflowNodeKind) {
  if (kind === "text") return "文本输入";
  if (kind === "image") return "图片生成";
  if (kind === "audio") return "上传音频";
  return "视频生成";
}

function getNodeIcon(kind: WorkflowNodeKind) {
  if (kind === "text") return RiTextBlock;
  if (kind === "image") return RiImageAiLine;
  if (kind === "audio") return RiVoiceprintLine;
  return RiFilmAiLine;
}

function getWorkflowNodeHeaderIcon(node: WorkflowNode) {
  if (node.kind === "text" && node.title === "上传文本") return RiTextSnippet;
  if (node.kind === "image" && node.title === "上传图片") return RiImageLine;
  if (node.kind === "video" && node.title === "上传视频") return RiVideoOnLine;
  if (node.kind === "audio") return RiVoiceprintLine;
  return getNodeIcon(node.kind);
}

function getWorkflowNodeMediaName(node: WorkflowNode) {
  const imageUrl = node.data.images?.[0];
  if (imageUrl) return node.data.mediaSystemNames?.[imageUrl] ?? "图片生成";
  if (node.data.videoUrl) return node.data.mediaSystemNames?.[node.data.videoUrl] ?? "视频生成";
  return "";
}

function getWorkflowUploadFileName(node: WorkflowNode) {
  const url = node.data.images?.[0] ?? node.data.videoUrl ?? node.data.audioUrl;
  if (url && node.data.mediaSystemNames?.[url]) return node.data.mediaSystemNames[url];
  return "";
}

function getWorkflowNodeParamParts(node: WorkflowNode) {
  const currentSize = getWorkflowNodeVisualSize(node);
  const sizeText = currentSize.w && currentSize.h ? `${Math.round(currentSize.w)}x${Math.round(currentSize.h)}` : "";
  if (node.title === "上传图片" || node.title === "上传视频" || node.title === "上传文本") return { modelLabel: "", ratio: "", resolution: "", duration: "", sizeText };
  if (node.kind === "audio") return { modelLabel: "", ratio: "", resolution: "", duration: "", sizeText: "" };
  const modelOptions = node.kind === "text" ? frontendConversationModels : node.kind === "image" ? frontendImageGenerationModels : workflowVideoModels;
  const modelLabel = node.data.model ? getModelLabel(modelOptions, node.data.model) : "";
  if (node.kind === "text") return { modelLabel: "", ratio: "", resolution: "", duration: "", sizeText };
  // Prefer the REAL video length (backfilled from the loaded file via onLoadedMetadata) over the
  // requested duration setting, so the label is always accurate and self-heals mismatched/migrated data.
  const durationText = node.kind === "video"
    ? (typeof node.data.durationSeconds === "number" && node.data.durationSeconds > 0 ? `${Math.round(node.data.durationSeconds)}秒` : node.data.duration ?? "")
    : "";
  return { modelLabel, ratio: node.data.ratio ?? "", resolution: node.data.resolution ?? "", duration: durationText, sizeText };
}

function estimateParamTextWidth(text: string) {
  return text.length * 8.5;
}

function estimateTitleTextWidth(text: string) {
  return 16 + 6 + text.length * 8 + 8;
}

function buildWorkflowParamLabel(parts: ReturnType<typeof getWorkflowNodeParamParts>, maxWidth: number) {
  const candidates = [
    [parts.modelLabel, parts.ratio, parts.resolution, parts.duration, parts.sizeText],
    [parts.ratio, parts.resolution, parts.duration, parts.sizeText],
    [parts.resolution, parts.duration, parts.sizeText],
    [parts.sizeText],
  ];
  for (const candidate of candidates) {
    const label = candidate.filter(Boolean).join(" / ");
    if (label && estimateParamTextWidth(label) <= maxWidth) return label;
  }
  return maxWidth >= 52 ? parts.sizeText : "";
}

function hasWorkflowNodeResult(node: WorkflowNode) {
  return Boolean(node.data.images?.length || node.data.videoUrl || node.data.audioUrl);
}

function canWorkflowNodeOutput(node: WorkflowNode) {
  if (node.kind === "text") return Boolean(getWorkflowTextNodeContent(node).trim());
  if (node.kind === "image") return Boolean(node.data.images?.[0]);
  if (node.kind === "video") return Boolean(node.data.videoUrl);
  if (node.kind === "audio") return Boolean(node.data.audioUrl);
  return false;
}

function canWorkflowNodeInput(node: WorkflowNode) {
  return (node.kind === "image" || node.kind === "video") && !hasWorkflowNodeResult(node) && !node.data.isRunning;
}

function getWorkflowConnectionError(source: WorkflowNode | undefined, target: WorkflowNode | undefined, edges: WorkflowEdge[]) {
  if (!source || !target) return "请选择有效节点";
  if (source.id === target.id) return "不能连接到自身";
  if (!canWorkflowNodeOutput(source)) return "源节点还没有可输出的内容";
  if (!canWorkflowNodeInput(target)) return "目标节点不是可输入的空图片/视频节点";
  if (edges.some((edge) => edge.source === source.id && edge.target === target.id)) return "这两个节点已经连接";
  const visits = new Set<string>();
  const reachesSource = (nodeId: string): boolean => {
    if (nodeId === source.id) return true;
    if (visits.has(nodeId)) return false;
    visits.add(nodeId);
    return edges.filter((edge) => edge.source === nodeId).some((edge) => reachesSource(edge.target));
  };
  if (reachesSource(target.id)) return "不能创建循环连接";
  if (source.kind === "text" && (target.kind === "image" || target.kind === "video")) return undefined;
  if ((source.kind === "image" || source.kind === "video" || source.kind === "audio") && (target.kind === "image" || target.kind === "video")) return undefined;
  return "当前节点类型暂不支持这样连接";
}

function hasResizableGeneratedMedia(node: WorkflowNode) {
  return node.kind === "image" ? Boolean(node.data.images?.[0]) : node.kind === "video" ? Boolean(node.data.videoUrl) : false;
}

function getWorkflowNodeExpectedDimensions(node: WorkflowNode) {
  if (node.kind === "image") return getExpectedImageDimensions(node.data.model, node.data.resolution, imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio : "16:9");
  if (node.kind === "video") return getExpectedVideoDimensions(node.data.model, node.data.resolution, node.data.ratio);
  if (node.kind === "audio") return { width: 500, height: 200 };
  return { width: TEXT_NODE_WIDTH, height: TEXT_NODE_HEIGHT };
}

function getWorkflowNodeNaturalSize(node: WorkflowNode) {
  const imageUrl = node.data.images?.[0];
  if (node.kind === "image" && imageUrl) {
    const dimensions = node.data.imageDimensions?.[imageUrl];
    if (dimensions?.width && dimensions.height) return { width: dimensions.width, height: dimensions.height };
  }
  if (node.kind === "video" && node.data.videoUrl && node.data.videoDimensions?.width && node.data.videoDimensions.height) return node.data.videoDimensions;
  return getWorkflowNodeExpectedDimensions(node);
}

function getWorkflowResizeSizeLimits(node: WorkflowNode) {
  const natural = getWorkflowNodeNaturalSize(node);
  if (!natural.width || !natural.height) return undefined;
  const longEdge = Math.max(natural.width, natural.height);
  const minScale = Math.min(1, 256 / longEdge);
  return {
    minWidth: Math.max(1, Math.round(natural.width * minScale)),
    minHeight: Math.max(1, Math.round(natural.height * minScale)),
    maxWidth: Math.round(natural.width),
    maxHeight: Math.round(natural.height),
  };
}

function getClampedGeneratedVisualSize(node: WorkflowNode) {
  const visual = node.data.visualSize;
  if (!visual?.width || !visual.height || !hasResizableGeneratedMedia(node)) return undefined;
  const natural = getWorkflowNodeNaturalSize(node);
  if (!natural.width || !natural.height) return undefined;
  const minScale = Math.min(1, 256 / Math.max(natural.width, natural.height));
  const currentScale = Math.min(visual.width / natural.width, visual.height / natural.height);
  const scale = Math.max(minScale, Math.min(1, currentScale));
  return { w: Math.round(natural.width * scale), h: Math.round(natural.height * scale) };
}

function getWorkflowNodeVisualSize(node: WorkflowNode) {
  const clampedGeneratedSize = getClampedGeneratedVisualSize(node);
  if (clampedGeneratedSize) return clampedGeneratedSize;
  if (hasResizableGeneratedMedia(node)) {
    const natural = getWorkflowNodeNaturalSize(node);
    if (natural.width && natural.height) return { w: Math.round(natural.width), h: Math.round(natural.height) };
  }
  if (node.data.visualSize?.width && node.data.visualSize.height) return { w: Math.round(node.data.visualSize.width), h: Math.round(node.data.visualSize.height) };
  const dimensions = getWorkflowNodeExpectedDimensions(node);
  const width = Math.max(1, dimensions.width || NODE_WIDTH);
  const height = Math.max(1, dimensions.height || CARD_HEIGHT);
  return { w: Math.round(width), h: Math.round(height) };
}

function getCommonWorkflowRatioLabel(dimensions?: { width: number; height: number }) {
  if (!dimensions?.width || !dimensions.height) return undefined;
  const ratio = dimensions.width / dimensions.height;
  const matches = imageRatioOptions.map((label) => {
    const [width, height] = label.split(":").map(Number);
    return { label, value: width / height };
  });
  return matches.find((item) => Math.abs(ratio - item.value) / item.value < 0.025)?.label;
}

function normalizeWorkflowImageRatio(value: unknown, dimensions?: { width: number; height: number }) {
  if (typeof value === "string" && imageRatioOptions.includes(value)) return value;
  return getCommonWorkflowRatioLabel(dimensions) ?? "16:9";
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w + WORKFLOW_NODE_GAP && a.x + a.w + WORKFLOW_NODE_GAP > b.x && a.y < b.y + b.h + WORKFLOW_NODE_GAP && a.y + a.h + WORKFLOW_NODE_GAP > b.y;
}

function findNonOverlappingNodePosition(nodes: WorkflowNode[], size: { w: number; h: number }, anchor?: WorkflowNode, fallback?: { x: number; y: number }) {
  const occupied = nodes.map((node) => ({ x: node.x, y: node.y, ...getWorkflowNodeVisualSize(node) }));
  const anchorSize = anchor ? getWorkflowNodeVisualSize(anchor) : undefined;
  const base = anchor && anchorSize ? { x: anchor.x + anchorSize.w + WORKFLOW_NODE_GAP, y: anchor.y } : fallback ?? { x: 160, y: 120 };
  const candidates = anchor && anchorSize
    ? [
      base,
      { x: anchor.x, y: anchor.y + anchorSize.h + WORKFLOW_NODE_GAP },
      { x: anchor.x - size.w - WORKFLOW_NODE_GAP, y: anchor.y },
      { x: anchor.x, y: anchor.y - size.h - WORKFLOW_NODE_GAP },
    ]
    : [base];
  for (let ring = 0; ring < 12; ring += 1) {
    for (const candidate of candidates) {
      const shifted = { x: candidate.x + ring * WORKFLOW_NODE_GAP, y: candidate.y + ring * WORKFLOW_NODE_GAP, ...size };
      if (!occupied.some((rect) => rectsOverlap(shifted, rect))) return { x: shifted.x, y: shifted.y };
    }
  }
  return base;
}

function findNonOverlappingNodePositionLeftOfTarget(nodes: WorkflowNode[], size: { w: number; h: number }, target: WorkflowNode) {
  const occupied = nodes.map((node) => ({ x: node.x, y: node.y, ...getWorkflowNodeVisualSize(node) }));
  const targetSize = getWorkflowNodeVisualSize(target);
  const base = { x: target.x - size.w - WORKFLOW_NODE_GAP, y: target.y + targetSize.h / 2 - size.h / 2 };
  const candidates = [
    base,
    { x: base.x, y: target.y + targetSize.h + WORKFLOW_NODE_GAP },
    { x: base.x, y: target.y - size.h - WORKFLOW_NODE_GAP },
    { x: base.x - size.w - WORKFLOW_NODE_GAP, y: base.y },
  ];
  for (let ring = 0; ring < 12; ring += 1) {
    for (const candidate of candidates) {
      const shifted = { x: candidate.x - ring * WORKFLOW_NODE_GAP, y: candidate.y + ring * WORKFLOW_NODE_GAP, ...size };
      if (!occupied.some((rect) => rectsOverlap(shifted, rect))) return { x: shifted.x, y: shifted.y };
    }
  }
  return base;
}

function focusWorkflowNodeInViewport(editor: Editor, node: WorkflowNode) {
  const size = getWorkflowNodeVisualSize(node);
  const screen = editor.getViewportScreenBounds();
  const zoom = Math.min(screen.w * 0.7 / size.w, screen.h * 0.7 / size.h);
  editor.zoomToBounds({ x: node.x, y: node.y, w: size.w, h: size.h }, { targetZoom: zoom, inset: 0, animation: { duration: 180 } });
}

function centerWorkflowNodeInViewport(editor: Editor, node: WorkflowNode) {
  const size = getWorkflowNodeVisualSize(node);
  editor.centerOnPoint({ x: node.x + size.w / 2, y: node.y + size.h / 2 }, { animation: { duration: 180 } });
}

function zoomToWorkflowNodes(editor: Editor, nodes: WorkflowNode[]) {
  const shapes = editor.getCurrentPageShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
  const shapeBounds = shapes.map((shape) => editor.getShapePageBounds(shape)).filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds));
  const rects = shapeBounds.length > 0
    ? shapeBounds.map((bounds) => ({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }))
    : nodes.map((node) => ({ x: node.x, y: node.y, ...getWorkflowNodeVisualSize(node) }));
  if (rects.length === 0) return;
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  const bounds = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  editor.zoomToBounds(bounds, { inset: 96, animation: { duration: 180 } });
}

function zoomToSelectedOrWorkflowNodes(editor: Editor, nodes: WorkflowNode[]) {
  const selectedShapeIds = editor.getSelectedShapeIds();
  const selectedBounds = selectedShapeIds
    .map((shapeId) => editor.getShape(shapeId))
    .filter((shape): shape is WorkflowNodeShape => shape?.type === "workflow_node")
    .map((shape) => editor.getShapePageBounds(shape))
    .filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds));
  if (selectedBounds.length > 0) {
    const minX = Math.min(...selectedBounds.map((bounds) => bounds.x));
    const minY = Math.min(...selectedBounds.map((bounds) => bounds.y));
    const maxX = Math.max(...selectedBounds.map((bounds) => bounds.x + bounds.w));
    const maxY = Math.max(...selectedBounds.map((bounds) => bounds.y + bounds.h));
    editor.zoomToBounds({ x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }, { inset: 96, animation: { duration: 180 } });
    return;
  }
  zoomToWorkflowNodes(editor, nodes);
}

function getDefaultNodeData(kind: WorkflowNodeKind): WorkflowNodeData {
  if (kind === "text") return { text: "", prompt: "" };
  if (kind === "audio") return { prompt: "上传音频" };
  if (kind === "video") {
    const resolution = normalizeVideoResolutionForModel(DEFAULT_WORKFLOW_VIDEO_MODEL, "720p");
    return { model: DEFAULT_WORKFLOW_VIDEO_MODEL, ratio: normalizeVideoRatioForModel(DEFAULT_WORKFLOW_VIDEO_MODEL, "16:9", resolution), resolution, duration: "8秒", videoReferenceMode: "reference", prompt: "" };
  }
  const defaultImageModel = frontendImageGenerationModels.some((model) => model.id === DEFAULT_WORKFLOW_IMAGE_MODEL) ? DEFAULT_WORKFLOW_IMAGE_MODEL : frontendImageGenerationModels[0]?.id ?? DEFAULT_IMAGE_MODEL;
  const resolution = normalizeImageResolutionForModel(defaultImageModel, "2K");
  return { model: defaultImageModel, ratio: "16:9", resolution, prompt: "" };
}

function normalizeState(value?: WorkflowCanvasState): WorkflowCanvasState {
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return DEFAULT_STATE;
  const nodes = value.nodes
    .filter((node) => node && typeof node.id === "string" && (node.kind === "text" || node.kind === "image" || node.kind === "video" || node.kind === "audio"))
    .map((node) => {
      const data = { ...getDefaultNodeData(node.kind), ...(node.data && typeof node.data === "object" ? node.data : {}) };
      if (node.kind === "image") {
        const imageUrl = Array.isArray(data.images) ? data.images[0] : undefined;
        data.ratio = normalizeWorkflowImageRatio(data.ratio, imageUrl ? data.imageDimensions?.[imageUrl] : undefined);
      }
      return {
        ...node,
        title: node.kind === "text" && (node.title === "文本生成" || node.title === "文本") ? "文本输入" : typeof node.title === "string" && node.title.trim() ? node.title : getNodeLabel(node.kind),
        x: Number.isFinite(node.x) ? node.x : 160,
        y: Number.isFinite(node.y) ? node.y : 120,
        data,
      };
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges.filter((edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const viewport = value.viewport && typeof value.viewport === "object"
    ? { x: Number.isFinite(value.viewport.x) ? value.viewport.x : 0, y: Number.isFinite(value.viewport.y) ? value.viewport.y : 0, zoom: Number.isFinite(value.viewport.zoom) ? value.viewport.zoom : 1 }
    : undefined;
  const historicalTextNodes = Array.isArray(value.historicalTextNodes)
    ? value.historicalTextNodes.reduce<WorkflowNode[]>((items, node) => {
      if (node?.kind !== "text" || !getWorkflowTextNodeContent(node).trim()) return items;
      const normalizedNode = {
        ...node,
        title: node.title || getNodeLabel("text"),
        x: Number.isFinite(node.x) ? node.x : 160,
        y: Number.isFinite(node.y) ? node.y : 120,
        data: { ...getDefaultNodeData("text"), ...(node.data && typeof node.data === "object" ? node.data : {}) },
      };
      const contentKey = normalizeWorkflowHistoricalTextContent(normalizedNode);
      if (!contentKey || items.some((item) => normalizeWorkflowHistoricalTextContent(item) === contentKey)) return items;
      return [...items, normalizedNode];
    }, [])
    : undefined;
  const historicalMediaNodes = Array.isArray(value.historicalMediaNodes)
    ? value.historicalMediaNodes.reduce<WorkflowNode[]>((items, node) => {
      if (!node || (node.kind !== "image" && node.kind !== "video")) return items;
      const url = getWorkflowNodeHistoricalMediaUrl(node);
      if (!url) return items;
      const normalizedNode = {
        ...node,
        title: typeof node.title === "string" && node.title.trim() ? node.title : getNodeLabel(node.kind),
        x: Number.isFinite(node.x) ? node.x : 160,
        y: Number.isFinite(node.y) ? node.y : 120,
        data: { ...getDefaultNodeData(node.kind), ...(node.data && typeof node.data === "object" ? node.data : {}) },
      };
      const key = normalizeWorkflowMediaUrl(url);
      if (!key || items.some((item) => normalizeWorkflowMediaUrl(getWorkflowNodeHistoricalMediaUrl(item) ?? "") === key)) return items;
      return [...items, normalizedNode];
    }, [])
    : undefined;
  return { nodes, edges, viewport, historicalTextNodes, historicalMediaNodes };
}

function getWorkflowTextNodeContent(node: WorkflowNode) {
  return node.kind === "text" ? node.data.text ?? node.data.prompt ?? node.data.outputText ?? "" : "";
}

function normalizeWorkflowHistoricalTextContent(node: WorkflowNode) {
  return getWorkflowTextNodeContent(node).replace(/\r\n/g, "\n").trim();
}

function addHistoricalTextNodes(state: WorkflowCanvasState, nodes: WorkflowNode[]) {
  const seen = new Set<string>();
  const additions = nodes.filter((node) => {
    if (node.kind !== "text") return false;
    const contentKey = normalizeWorkflowHistoricalTextContent(node);
    if (!contentKey || seen.has(contentKey)) return false;
    seen.add(contentKey);
    return true;
  });
  if (additions.length === 0) return state;
  const existing = state.historicalTextNodes ?? [];
  const additionKeys = new Set(additions.map(normalizeWorkflowHistoricalTextContent));
  const nextHistorical = [...additions, ...existing.filter((node) => !additionKeys.has(normalizeWorkflowHistoricalTextContent(node)))].slice(0, 80);
  return { ...state, historicalTextNodes: nextHistorical };
}

function getWorkflowNodeHistoricalMediaUrl(node: WorkflowNode): string | undefined {
  if (node.kind === "image") return node.data.images?.[0];
  if (node.kind === "video") return node.data.videoUrl;
  return undefined;
}

function addHistoricalMediaNodes(state: WorkflowCanvasState, nodes: WorkflowNode[]) {
  const existing = state.historicalMediaNodes ?? [];
  const existingKeys = new Set(existing.map((node) => normalizeWorkflowMediaUrl(getWorkflowNodeHistoricalMediaUrl(node) ?? "")).filter(Boolean));
  const seen = new Set<string>();
  const additions = nodes.filter((node) => {
    const url = getWorkflowNodeHistoricalMediaUrl(node);
    if (!url) return false;
    const key = normalizeWorkflowMediaUrl(url);
    if (!key || seen.has(key) || existingKeys.has(key)) return false;
    seen.add(key);
    return true;
  }).map((node) => ({ ...node }));
  if (additions.length === 0) return state;
  const nextHistorical = [...additions, ...existing].slice(0, 80);
  return { ...state, historicalMediaNodes: nextHistorical };
}

function addHistoricalNodes(state: WorkflowCanvasState, nodes: WorkflowNode[]) {
  return addHistoricalMediaNodes(addHistoricalTextNodes(state, nodes), nodes);
}

function stateKey(value: WorkflowCanvasState) {
  return JSON.stringify(value);
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as { error?: string | { message?: string }; errorCode?: string };
  if (!response.ok) {
    throw new Error(getWorkflowApiErrorMessage(data, GENERIC_MEDIA_ERROR_MESSAGE));
  }
  return data as T;
}

function getWorkflowApiErrorMessage(data: { error?: string | { message?: string }; errorCode?: string }, fallback = GENERIC_MEDIA_ERROR_MESSAGE) {
  const rawError = typeof data.error === "string" ? data.error : data.error?.message;
  const codedError = data.errorCode && rawError && !/^\(B_\d+\)/.test(rawError) ? `(${data.errorCode}) ${rawError}` : rawError;
  return toUserErrorMessage(codedError, fallback);
}

function isTransientWorkflowVideoPollStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isWorkflowGptImageSafetyFailure(node: WorkflowNode) {
  if (node.kind !== "image" || node.data.model !== "openai/gpt-5.4-image-2") return false;
  if (node.data.gptImageOptimizationOriginalPrompt || (node.data.gptImageOptimizationAttemptPrompts?.length ?? 0) > 0) return true;
  const error = node.data.error ?? "";
  return /图片平台没有返回图片|无法帮助|不能帮助|安全|隐私|未成年人|亲密|肖像|拒绝|不适合/i.test(error);
}

function normalizeWorkflowAttemptPrompt(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function getWorkflowFallbackSafetyPrompt(originalPrompt: string, attempt: number, seenPrompts: Set<string>) {
  const mentionPrefix = originalPrompt.match(/^((?:@[^@\s，。！？；;、]+\s*)+)/)?.[0]?.trim() ?? "";
  const body = mentionPrefix ? originalPrompt.slice(mentionPrefix.length).trim() : originalPrompt.trim();
  const withPrefix = (nextBody: string) => [mentionPrefix, nextBody].filter(Boolean).join(" ").trim();
  const candidates = [
    withPrefix(body.replace(/(坐在|站在|躺在|走在|坐 到|坐到|在)/, "穿日常连衣裙$1")),
    withPrefix(body.replace(/(坐在|站在|躺在|走在|坐 到|坐到|在)/, "穿着得体$1")),
    withPrefix(body.replace(/(坐在|站在|躺在|走在|坐 到|坐到|在)/, "日常穿着$1")),
    withPrefix(`${body}，穿着得体`),
    withPrefix(`${body}，自然生活照风格`),
    withPrefix(`${body}，非性感、自然姿态`),
  ].map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  const ordered = [...candidates.slice(Math.max(0, attempt - 1)), ...candidates.slice(0, Math.max(0, attempt - 1))];
  return ordered.find((item) => !seenPrompts.has(normalizeWorkflowAttemptPrompt(item))) ?? "";
}

function getVideoUrlFromResponse(data: VideoApiResponse) {
  const content = data.content && typeof data.content === "object" ? data.content as Record<string, unknown> : undefined;
  const direct = typeof data.videoUrl === "string" ? data.videoUrl : undefined;
  const contentUrl = typeof content?.video_url === "string" ? content.video_url : undefined;
  return direct || contentUrl || "";
}

function getPosterUrlFromResponse(data: VideoApiResponse) {
  const content = data.content && typeof data.content === "object" ? data.content as Record<string, unknown> : undefined;
  return typeof content?.poster_url === "string" ? content.poster_url : undefined;
}

function isVideoDoneStatus(status: unknown) {
  return status === "succeeded" || status === "success" || status === "completed" || status === "complete";
}

function getVideoTaskId(data: VideoApiResponse) {
  return data.id || data.job_id || data.polling_url || data.pollingUrl || "";
}

function getVideoWaitProgress(startedAt?: number, index = 0) {
  const start = startedAt ?? Date.now();
  const elapsedSeconds = Math.max(0, (Date.now() - start) / 1000);
  const stableOffset = index > 0 ? ((index * 7 + Math.abs(Math.floor(start / 1000))) % 7) - 3 : 0;
  const applyOffset = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value + stableOffset));
  if (elapsedSeconds <= 30) return applyOffset(Math.round(1 + (elapsedSeconds / 30) * 44), 1, 45);
  if (elapsedSeconds <= 90) return applyOffset(Math.round(45 + ((elapsedSeconds - 30) / 60) * 30), 43, 78);
  if (elapsedSeconds <= 180) return applyOffset(Math.round(75 + ((elapsedSeconds - 90) / 90) * 20), 73, 98);
  return 95 + ((Math.abs(Math.floor(start / 1000)) + index * 3) % 5);
}

function formatDimensionValue(value: number) {
  return value > 0 ? String(value) : "未知";
}

function closeWorkflowPopups() {
  window.dispatchEvent(new Event("workflow-close-popups"));
}

function formatElapsedTime(startedAt?: number) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000));
  return `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
}

function getStaticMediaUrl(url: string | undefined) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

type WorkflowHoverImagePreviewPosition = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function getWorkflowHoverImagePreviewPosition(clientX: number, clientY: number, naturalSize?: { width: number; height: number }): WorkflowHoverImagePreviewPosition {
  const margin = 16;
  const gap = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableRight = Math.max(0, viewportWidth - clientX - gap - margin);
  const availableLeft = Math.max(0, clientX - gap - margin);
  const useLeft = availableLeft > availableRight;
  const maxWidth = Math.max(120, Math.min(720, (useLeft ? availableLeft : availableRight) || viewportWidth - margin * 2));
  const maxHeight = Math.max(120, Math.min(760, viewportHeight - margin * 2));
  const naturalWidth = Math.max(1, naturalSize?.width ?? maxWidth);
  const naturalHeight = Math.max(1, naturalSize?.height ?? maxHeight);
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
  const width = Math.max(120, Math.round(naturalWidth * scale));
  const height = Math.max(120, Math.round(naturalHeight * scale));
  const rawLeft = useLeft ? clientX - gap - width : clientX + gap;
  const rawTop = clientY + gap + height > viewportHeight - margin ? clientY - gap - height : clientY + gap;
  const left = Math.min(Math.max(margin, rawLeft), Math.max(margin, viewportWidth - margin - width));
  const top = Math.min(Math.max(margin, rawTop), Math.max(margin, viewportHeight - margin - height));
  return { left, top, width, height };
}

function WorkflowHoverImagePreview({ src, alt, wrapperClassName = "inline-block", children }: { src: string; alt: string; wrapperClassName?: string; children: ReactNode }) {
  const [position, setPosition] = useState<WorkflowHoverImagePreviewPosition | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | undefined>(undefined);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const displaySrc = getStaticMediaUrl(src) ?? src;
  const updatePosition = (clientX: number, clientY: number, size = naturalSize) => {
    pointerRef.current = { x: clientX, y: clientY };
    setPosition(getWorkflowHoverImagePreviewPosition(clientX, clientY, size));
  };
  const preview = position && typeof document !== "undefined" ? createPortal(
    <span className="pointer-events-none fixed z-[9999] flex items-center justify-center rounded-[10px] border border-white/70 bg-white p-1 shadow-[0_18px_60px_rgba(0,0,0,0.32)]" style={{ left: position.left, top: position.top, width: position.width + 8, height: position.height + 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={displaySrc} alt={alt} className="block object-contain" style={{ width: position.width, height: position.height }} onLoad={(event) => {
        const image = event.currentTarget;
        if (!image.naturalWidth || !image.naturalHeight) return;
        const nextSize = { width: image.naturalWidth, height: image.naturalHeight };
        setNaturalSize(nextSize);
        const pointer = pointerRef.current;
        if (pointer) setPosition(getWorkflowHoverImagePreviewPosition(pointer.x, pointer.y, nextSize));
      }} />
    </span>,
    document.body,
  ) : null;

  return <span className={wrapperClassName} onMouseEnter={(event) => updatePosition(event.clientX, event.clientY)} onMouseMove={(event) => updatePosition(event.clientX, event.clientY)} onMouseLeave={() => { pointerRef.current = null; setPosition(null); }}>{children}{preview}</span>;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

async function getWorkflowExportImageSrc(url: string | undefined) {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) return undefined;
  return blobToDataUrl(await response.blob());
}

function getWorkflowDownloadFileName(node: WorkflowNode) {
  if (node.kind === "text") return `${node.title || "文本输入"}.txt`;
  const imageUrl = node.data.images?.[0];
  if (node.kind === "image" && imageUrl) return `${node.data.mediaSystemNames?.[imageUrl] ?? "workflow-image"}.${getUrlExtension(imageUrl, "jpg")}`;
  if (node.kind === "video" && node.data.videoUrl) return `${node.data.mediaSystemNames?.[node.data.videoUrl] ?? "workflow-video"}.${getUrlExtension(node.data.videoUrl, "mp4")}`;
  return "workflow-node.txt";
}

function getUrlExtension(url: string, fallback: string) {
  const path = url.split("?")[0].split("#")[0];
  const extension = path.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  return extension || fallback;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function copyWorkflowTextNode(node: WorkflowNode) {
  const text = getWorkflowTextNodeContent(node);
  if (!text.trim()) return;
  await navigator.clipboard.writeText(text);
}

function getWorkflowMediaBaseName(node: WorkflowNode, fallback: string) {
  const imageUrl = node.data.images?.[0];
  if (node.kind === "image" && imageUrl) return node.data.mediaSystemNames?.[imageUrl] ?? fallback;
  if (node.kind === "video" && node.data.videoUrl) return node.data.mediaSystemNames?.[node.data.videoUrl] ?? fallback;
  return fallback;
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

async function getWorkflowImageJpegBlob(url: string) {
  const source = await getWorkflowExportImageSrc(getStaticMediaUrl(url));
  if (!source) throw new Error("图片导出失败");
  const image = await loadImageElement(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("图片导出失败");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片导出失败")), "image/jpeg", 0.92);
  });
}

async function exportWorkflowImageJpg(node: WorkflowNode) {
  const imageUrl = node.data.images?.[0];
  if (!imageUrl) return;
  const blob = await getWorkflowImageJpegBlob(imageUrl);
  downloadBlob(blob, `${getWorkflowMediaBaseName(node, "workflow-image")}.jpg`);
}

async function exportWorkflowVideoFrame(node: WorkflowNode, frame: "first" | "last" | "current") {
  const videoUrl = getStaticMediaUrl(node.data.videoUrl);
  if (!videoUrl) return;
  const time = frame === "first" ? 0 : frame === "last" ? Number.POSITIVE_INFINITY : node.data.videoCurrentTime ?? 0;
  const frameUrl = await getWorkflowVideoFrameDataUrl(videoUrl, time);
  if (!frameUrl) throw new Error("视频帧导出失败");
  const blob = await fetch(frameUrl).then((response) => response.blob());
  const suffix = frame === "first" ? "首帧" : frame === "last" ? "尾帧" : "当前帧";
  downloadBlob(blob, `${getWorkflowMediaBaseName(node, "workflow-video")}-${suffix}.jpg`);
}

async function downloadWorkflowNode(node: WorkflowNode) {
  if (node.kind === "text") {
    const text = getWorkflowTextNodeContent(node);
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), getWorkflowDownloadFileName(node));
    return;
  }

  const url = node.kind === "image" ? node.data.images?.[0] : node.data.videoUrl;
  if (!url) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error("下载失败");
  downloadBlob(await response.blob(), getWorkflowDownloadFileName(node));
}

const workflowTldrawComponents: TLComponents = { ContextMenu: null };
const workflowTldrawOptions = { maxPages: 1, rightClickPanning: false } satisfies Partial<TldrawOptions>;
const workflowTldrawOverrides: TLUiOverrides = {
  translations: { en: { "action.workflow-download-node": "下载" }, zh: { "action.workflow-download-node": "下载" }, "zh-cn": { "action.workflow-download-node": "下载" }, "zh-CN": { "action.workflow-download-node": "下载" } },
  actions(editor, actions) {
    const { ["flatten-to-image"]: _flattenToImage, ...workflowSafeActions } = actions;
    return {
      ...workflowSafeActions,
      "workflow-download-node": {
        id: "workflow-download-node",
        label: "action.workflow-download-node",
        icon: "download",
        onSelect() {
          const selectedWorkflowNodes = editor.getSelectedShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node);
          const node = selectedWorkflowNodes.length === 1 ? selectedWorkflowNodes[0] : undefined;
          if (!node) return;
          void downloadWorkflowNode(node).catch((error) => console.warn("[workflow] download failed", error));
        },
      },
    };
  },
};

function getWorkflowVideoFrameDataUrl(url: string, timeSeconds: number) {
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const settle = (value?: string) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timeout = window.setTimeout(() => settle(undefined), 10_000);
    const cleanupSettle = (value?: string) => {
      window.clearTimeout(timeout);
      settle(value);
    };
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("error", () => cleanupSettle(undefined), { once: true });
    video.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const targetTime = Math.max(0, Math.min(timeSeconds, Math.max(0, duration - 0.04)));
      video.currentTime = targetTime;
    }, { once: true });
    video.addEventListener("seeked", () => {
      try {
        const width = video.videoWidth || 1;
        const height = video.videoHeight || 1;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return cleanupSettle(undefined);
        context.drawImage(video, 0, 0, width, height);
        cleanupSettle(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        cleanupSettle(undefined);
      }
    }, { once: true });
    video.src = url;
  });
}

function getWorkflowSvgTextLines(text: string, maxCharsPerLine: number, maxLines: number) {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine;
    if (!line) {
      lines.push("");
      continue;
    }
    while (line.length > maxCharsPerLine) {
      lines.push(line.slice(0, maxCharsPerLine));
      line = line.slice(maxCharsPerLine);
      if (lines.length >= maxLines) return lines;
    }
    lines.push(line);
    if (lines.length >= maxLines) return lines;
  }
  return lines;
}

type WorkflowRuntime = {
  selectedNodeId: string;
  connectingFrom: string;
  connectingTo: string;
  multiConnectSources: string[];
  connectionPointer?: { x: number; y: number };
  modelOptions: WorkflowModelOptions;
  workflowTitle: string;
  updateNode: (nodeId: string, patch: Partial<WorkflowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  disconnectNodes: (sourceNodeId: string, targetNodeId: string) => void;
  connectTo: (nodeId: string) => void;
  setConnectingFrom: (nodeId: string) => void;
  beginConnectionDrag: (nodeId: string, event: ReactPointerEvent) => void;
  beginInputConnectionDrag: (nodeId: string, event: ReactPointerEvent) => void;
  beginMultiConnectionDrag: (sourceIds: string[], event: ReactPointerEvent) => void;
  runImageNode: (node: WorkflowNode) => void;
  runGptImageOptimizationRetry: (node: WorkflowNode, maxAttempts: number) => void;
  runVideoNode: (node: WorkflowNode) => void;
  onGeneratedMedia?: WorkflowCanvasProps["onGeneratedMedia"];
  onShowTip?: (message: string) => void;
  markNodeAction: (nodeId: string) => void;
  onPreviewMedia?: WorkflowCanvasProps["onPreviewMedia"];
  getImageDisplayUrl?: (url: string) => string;
  getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined;
  referenceAssets: WorkflowReferenceAsset[];
  referenceAssetsLoadStatus: "idle" | "loading" | "loaded" | "failed";
  referenceAssetCounts?: Record<string, number>;
  onLoadReferenceAssets?: () => void;
  onLoadMoreReferenceAssets?: (groupType: string, loadedCount: number) => void;
  uploadRuleOverrides?: UploadRuleOverrides;
  getConnectedInputUploads: (nodeId: string) => WorkflowUploadItem[];
  getInputTextLength: (nodeId: string) => number;
  uploadFilesAsConnectedNodes: (targetNodeId: string, files: File[], onDuplicateTip?: (message: string) => void) => void;
};

const WorkflowRuntimeContext = createContext<WorkflowRuntime | null>(null);

function useWorkflowRuntime() {
  const context = useContext(WorkflowRuntimeContext);
  if (!context) throw new Error("Workflow runtime is missing");
  return context;
}

class WorkflowConnectionShapeUtil extends ShapeUtil<WorkflowConnectionShape> {
  static override type = "workflow_connection";
  static override props: RecordProps<WorkflowConnectionShape> = {
    start: vecModelValidator,
    end: vecModelValidator,
  };

  getDefaultProps(): WorkflowConnectionShape["props"] {
    return { start: { x: 0, y: 0 }, end: { x: 120, y: 0 } };
  }

  override canEdit() { return false; }
  override canResize() { return false; }
  override canSnap() { return false; }
  override canTabTo() { return false; }
  override canBeLaidOut() { return false; }
  override hideResizeHandles() { return true; }
  override hideRotateHandle() { return true; }
  override hideSelectionBoundsBg() { return true; }
  override hideSelectionBoundsFg() { return true; }

  override onTranslateStart(shape: WorkflowConnectionShape) {
    return { id: shape.id, type: "workflow_connection" as const, x: shape.x, y: shape.y };
  }

  override onTranslate(initial: WorkflowConnectionShape) {
    return { id: initial.id, type: "workflow_connection" as const, x: initial.x, y: initial.y };
  }

  override onTranslateEnd(initial: WorkflowConnectionShape) {
    return { id: initial.id, type: "workflow_connection" as const, x: initial.x, y: initial.y };
  }

  override getGeometry(shape: WorkflowConnectionShape) {
    const { start, end } = getWorkflowConnectionTerminals(this.editor, shape);
    const [cp1, cp2] = getWorkflowConnectionControlPoints(start, end);
    return new CubicBezier2d({ start: Vec.From(start), cp1, cp2, end: Vec.From(end) });
  }

  getHandles(shape: WorkflowConnectionShape): TLHandle[] {
    const { start, end } = getWorkflowConnectionTerminals(this.editor, shape);
    return [
      { id: "start", type: "vertex", index: "a0" as IndexKey, x: start.x, y: start.y },
      { id: "end", type: "vertex", index: "a1" as IndexKey, x: end.x, y: end.y },
    ];
  }

  onHandleDrag(shape: WorkflowConnectionShape, { handle }: TLHandleDragInfo<WorkflowConnectionShape>) {
    const terminal = handle.id as "start" | "end";
    const shapeTransform = this.editor.getShapePageTransform(shape);
    const handlePagePosition = shapeTransform.applyToPoint(handle);
    const target = getWorkflowPortAtPoint(this.editor, handlePagePosition, terminal);
    if (target) {
      createOrUpdateWorkflowConnectionBinding(this.editor, shape.id, target.shape.id, { portId: target.portId, terminal });
      return shape;
    }

    const existing = (this.editor.getBindingsFromShape(shape.id, "workflow_connection") as WorkflowConnectionBinding[]).filter((binding) => binding.props.terminal === terminal);
    if (existing.length > 0) this.editor.deleteBindings(existing);
    return { ...shape, props: { ...shape.props, [terminal]: { x: handle.x, y: handle.y } } };
  }

  onHandleDragEnd(shape: WorkflowConnectionShape) {
    const bindings = getWorkflowConnectionBindings(this.editor, shape);
    if (!bindings.start || !bindings.end) this.editor.deleteShapes([shape.id]);
  }

  component(shape: WorkflowConnectionShape) {
    const { start, end } = useValue(`workflow-connection-terminals:${shape.id}`, () => getWorkflowConnectionTerminals(this.editor, shape), [this.editor, shape]);
    const editor = useEditor();
    const [isPointerOver, setIsPointerOver] = useState(false);
    const isHovered = useValue(`workflow-connection-hovered:${shape.id}`, () => editor.getHoveredShapeId() === shape.id, [editor, shape.id]);
    const isSelected = useValue(`workflow-connection-selected:${shape.id}`, () => editor.getSelectedShapeIds().includes(shape.id), [editor, shape.id]);
    const highlightedNodeIds = useWorkflowHighlightedNodeIds();
    const isConnectedToHighlightedNode = highlightedNodeIds.some((nodeId) => shape.meta?.sourceNodeId === nodeId || shape.meta?.targetNodeId === nodeId);
    const center = getWorkflowConnectionCenter(start, end);
    const showDisconnectButton = isPointerOver || isHovered || isSelected;
    const lineActive = isPointerOver || isHovered || isSelected;
    const lineStroke = isConnectedToHighlightedNode ? "#2f80ed" : isSelected ? "#454e5a" : lineActive ? "#6f7788" : "#6f7782";
    const path = getWorkflowConnectionPath(start, end);
    const updatePointer = (event: ReactPointerEvent<SVGPathElement>) => {
      void event;
      setIsPointerOver(true);
    };
    return <>
      <SVGContainer
        className="workflow-connection-shape"
      >
        <path d={path} fill="none" stroke="transparent" strokeWidth="28" strokeLinecap="round" pointerEvents="stroke" onPointerEnter={updatePointer} onPointerMove={updatePointer} onPointerLeave={() => setIsPointerOver(false)} />
        <path d={path} fill="none" stroke={lineStroke} strokeWidth={lineActive ? "10" : "5"} strokeLinecap="round" pointerEvents="none" />
      </SVGContainer>
      {showDisconnectButton ? <HTMLContainer style={{ pointerEvents: "none" }}>
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerEnter={() => setIsPointerOver(true)}
          onPointerLeave={() => setIsPointerOver(false)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            this.editor.deleteShapes([shape.id]);
          }}
          className="absolute z-50 flex h-[100px] w-[100px] items-center justify-center rounded-full bg-black text-white shadow-[0_14px_36px_rgba(0,0,0,0.28)] transition hover:bg-[#111111]"
          style={{ left: center.x - 50, top: center.y - 50, pointerEvents: "all" }}
          title="断开连接"
          aria-label="断开连接"
        >
          <RiScissorsCutLine className="h-[46px] w-[46px] -scale-x-100" aria-hidden="true" />
        </button>
      </HTMLContainer> : null}
    </>;
  }

  override getIndicatorPath(shape: WorkflowConnectionShape) {
    void shape;
    return undefined;
  }
}

class WorkflowConnectionBindingUtil extends BindingUtil<WorkflowConnectionBinding> {
  static override type = "workflow_connection";
  static override props = {
    portId: T.literalEnum("input", "output"),
    terminal: T.literalEnum("start", "end"),
  };

  override getDefaultProps() {
    return { portId: "output" as const, terminal: "start" as const };
  }

  override onBeforeDeleteToShape({ binding }: { binding: WorkflowConnectionBinding }) {
    this.editor.deleteShapes([binding.fromId]);
  }
}

class WorkflowNodeShapeUtil extends BaseBoxShapeUtil<WorkflowNodeShape> {
  static override type = "workflow_node";
  static override props = { w: T.number, h: T.number, node: T.any };

  override canResize(shape: WorkflowNodeShape) { return shape.props.node.kind === "text" || hasResizableGeneratedMedia(shape.props.node); }
  override canEdit(shape: WorkflowNodeShape) { return shape.props.node.kind === "text"; }
  override canScroll(shape: WorkflowNodeShape) { return shape.props.node.kind === "text"; }
  override canBind() { return false; }
  override hideRotateHandle() { return true; }
  override isAspectRatioLocked(shape: WorkflowNodeShape) { return shape.props.node.kind !== "text"; }

  getDefaultProps(): WorkflowNodeShape["props"] {
    return { w: NODE_WIDTH, h: NODE_HEIGHT, node: { id: "", kind: "text", title: "文本输入", x: 0, y: 0, data: getDefaultNodeData("text") } };
  }

  override getGeometry(shape: WorkflowNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: WorkflowNodeShape) {
    return <WorkflowShapeComponent shape={shape} />;
  }

  override onEditStart(shape: WorkflowNodeShape) {
    if (shape.props.node.kind !== "text") return;
    focusWorkflowNodeInViewport(this.editor, { ...shape.props.node, x: shape.x, y: shape.y });
  }

  override getIndicatorPath(shape: WorkflowNodeShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  override async toSvg(shape: WorkflowNodeShape): Promise<ReactElement | null> {
    const node = shape.props.node;
    const width = shape.props.w;
    const height = shape.props.h;

    if (node.kind === "text") {
      const padding = 24;
      const lineHeight = 28;
      const text = node.data.text ?? node.data.prompt ?? node.data.outputText ?? "";
      const maxCharsPerLine = Math.max(8, Math.floor((width - padding * 2) / 8.5));
      const maxLines = Math.max(1, Math.floor((height - padding * 2) / lineHeight));
      const lines = getWorkflowSvgTextLines(text || "大段提示词或者剧本可以输入到这里...", maxCharsPerLine, maxLines);
      const isPlaceholder = !text.trim();
      return (
        <g>
          <rect width={width} height={height} rx={20} fill="#ffffff" stroke="#b8b8b8" strokeWidth={5} />
          <text x={padding} y={padding + 18} fill={isPlaceholder ? "#a6a6a6" : "#222222"} fontFamily="Arial, Helvetica, sans-serif" fontSize={16}>
            {lines.map((line, index) => <tspan key={index} x={padding} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>)}
          </text>
        </g>
      );
    }

    if (node.kind === "image") {
      const url = await getWorkflowExportImageSrc(getStaticMediaUrl(node.data.images?.[0]));
      if (!url) return <rect width={width} height={height} fill="#e6e6e6" />;
      return <image href={url} width={width} height={height} preserveAspectRatio="xMidYMid slice" />;
    }

    const videoUrl = getStaticMediaUrl(node.data.videoUrl);
    const frameUrl = videoUrl?.startsWith("/generated/") ? await getWorkflowVideoFrameDataUrl(videoUrl, node.data.videoCurrentTime ?? 0) : undefined;
    if (frameUrl) return <image href={frameUrl} width={width} height={height} preserveAspectRatio="xMidYMid slice" />;
    const posterUrl = await getWorkflowExportImageSrc(getStaticMediaUrl(node.data.posterUrl));
    if (posterUrl) return <image href={posterUrl} width={width} height={height} preserveAspectRatio="xMidYMid slice" />;
    return (
      <g>
        <rect width={width} height={height} fill="#20242a" />
        <circle cx={width / 2} cy={height / 2} r={Math.max(18, Math.min(width, height) * 0.08)} fill="rgba(255,255,255,0.86)" />
        <path d={`M ${width / 2 - 8} ${height / 2 - 13} L ${width / 2 - 8} ${height / 2 + 13} L ${width / 2 + 14} ${height / 2} Z`} fill="#20242a" />
      </g>
    );
  }

  override onResize(shape: WorkflowNodeShape, info: TLResizeInfo<WorkflowNodeShape>) {
    const node = shape.props.node;
    const resized = node.kind === "text"
      ? resizeBox(shape, info, { minWidth: 240, minHeight: 180 })
      : resizeBox(shape, info, getWorkflowResizeSizeLimits(node));
    return {
      x: resized.x,
      y: resized.y,
      props: {
        ...resized.props,
        node: {
          ...shape.props.node,
          x: resized.x,
          y: resized.y,
          data: { ...shape.props.node.data, visualSize: { width: resized.props.w, height: resized.props.h } },
        },
      },
    };
  }
}

const workflowShapeUtils = [...defaultShapeUtils, WorkflowConnectionShapeUtil, WorkflowNodeShapeUtil];
const workflowBindingUtils = [...defaultBindingUtils, WorkflowConnectionBindingUtil];

function WorkflowShapeComponent({ shape }: { shape: WorkflowNodeShape }) {
  const runtime = useWorkflowRuntime();
  const editor = useEditor();
  const node = shape.props.node;
  const portHoverTimerRef = useRef<number | null>(null);
  const [keepPortVisible, setKeepPortVisible] = useState(false);
  const isSelected = useValue(`workflow-selected-${shape.id}`, () => editor.getSelectedShapeIds().includes(shape.id), [editor, shape.id]);
  const isHovered = useValue(`workflow-hovered-${shape.id}`, () => editor.getHoveredShapeId() === shape.id, [editor, shape.id]);
  const isEditing = useValue(`workflow-editing-${shape.id}`, () => editor.getEditingShapeId() === shape.id, [editor, shape.id]);
  const sourcePrompt = node.data.prompt?.trim() || node.data.text?.trim() || node.data.outputText?.trim() || runtime.workflowTitle;
  const imageUrl = node.data.images?.[0];
  const imageDisplayUrl = imageUrl ? getStaticMediaUrl(imageUrl) ?? imageUrl : undefined;
  const videoPosterDisplayUrl = node.data.videoUrl ? runtime.getVideoPosterDisplayUrl?.(node.data.videoUrl, node.data.posterUrl) : undefined;
  const imageMediaName = imageUrl ? node.data.mediaSystemNames?.[imageUrl] ?? "图片生成" : "图片生成";
  const videoMediaName = node.data.videoUrl ? node.data.mediaSystemNames?.[node.data.videoUrl] ?? "视频生成" : "视频生成";
  const showOutputPort = ((isSelected || isHovered || keepPortVisible) && !runtime.connectingFrom || Boolean(runtime.connectingTo)) && canWorkflowNodeOutput(node);
  const showInputPort = (isSelected || isHovered || keepPortVisible || Boolean(runtime.connectingFrom) || runtime.multiConnectSources.length > 0) && canWorkflowNodeInput(node);

  useEffect(() => () => {
    if (portHoverTimerRef.current !== null) window.clearTimeout(portHoverTimerRef.current);
  }, []);

  const holdPortVisible = () => {
    if (portHoverTimerRef.current !== null) window.clearTimeout(portHoverTimerRef.current);
    setKeepPortVisible(true);
  };
  const releasePortVisibleSoon = () => {
    if (portHoverTimerRef.current !== null) window.clearTimeout(portHoverTimerRef.current);
    portHoverTimerRef.current = window.setTimeout(() => setKeepPortVisible(false), 220);
  };

  return (
    <HTMLContainer className="workflow-node-html overflow-visible" style={{ pointerEvents: "all" }}>
      <div data-workflow-node-id={node.id} className="workflow-node relative overflow-visible text-[#111111]" style={{ width: shape.props.w, height: shape.props.h }} onPointerEnter={holdPortVisible} onPointerLeave={releasePortVisibleSoon} onPointerDown={() => runtime.markNodeAction(node.id)} onDoubleClick={(event) => event.stopPropagation()}>
        {node.kind === "text" ? <TextDisplayCard node={node} selected={isSelected} height={shape.props.h} isEditing={isEditing} /> : null}
        {node.kind === "image" ? <ImageDisplayCard node={node} selected={isSelected} displayUrl={imageDisplayUrl} height={shape.props.h} /> : null}
        {node.kind === "video" ? <VideoDisplayCard node={node} selected={isSelected} height={shape.props.h} onSelect={() => editor.select(shape.id)} /> : null}
        {node.kind === "audio" ? <AudioDisplayCard node={node} selected={isSelected} height={shape.props.h} /> : null}
        {node.data.uploadProgress !== undefined && node.kind !== "audio" ? <UploadingNodeOverlay progress={node.data.uploadProgress} width={shape.props.w} height={shape.props.h} previewUrl={node.data.uploadPreviewUrl} isVideo={node.kind === "video"} /> : null}
        {showOutputPort ? <NodePort side="right" onPointerEnter={holdPortVisible} onPointerLeave={releasePortVisibleSoon} onPointerDown={(event) => runtime.beginConnectionDrag(node.id, event)} /> : null}
        {showInputPort ? <NodePort side="left" active={Boolean((runtime.connectingFrom && runtime.connectingFrom !== node.id) || (runtime.multiConnectSources.length > 0 && !runtime.multiConnectSources.includes(node.id)))} onPointerEnter={holdPortVisible} onPointerLeave={releasePortVisibleSoon} onPointerDown={(event) => runtime.beginInputConnectionDrag(node.id, event)} /> : null}
      </div>
    </HTMLContainer>
  );
}

function WorkflowSelectedNodeOverlay() {
  const runtime = useWorkflowRuntime();
  const editor = useEditor();
  const editorBoxRef = useRef<HTMLDivElement | null>(null);
  const [measuredEditorHeight, setMeasuredEditorHeight] = useState(320);
  const [dockSafeBottom, setDockSafeBottom] = useState<number | null>(null);
  const selected = useValue("workflow-selected-node-overlay", () => {
    const selectedShapeId = editor.getOnlySelectedShapeId();
    if (!selectedShapeId) return undefined;
    const shape = editor.getShape(selectedShapeId) as WorkflowNodeShape | undefined;
    if (!shape || shape.type !== "workflow_node") return undefined;
    const point = editor.pageToViewport({ x: shape.x, y: shape.y });
    return { shape, point, zoom: editor.getCamera().z };
  }, [editor]);

  useEffect(() => {
    const element = editorBoxRef.current;
    if (!element) return;
    const updateHeight = () => setMeasuredEditorHeight(Math.max(1, Math.ceil(element.getBoundingClientRect().height)));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [selected?.shape.id]);

  useEffect(() => {
    const dock = document.querySelector<HTMLElement>(".lovart-workflow-dock");
    const editorContainer = (editor as Editor & { getContainer?: () => HTMLElement | null }).getContainer?.();
    const updateDockSafeBottom = () => {
      const rect = dock?.getBoundingClientRect();
      const containerRect = editorContainer?.getBoundingClientRect();
      setDockSafeBottom(rect && containerRect ? Math.floor(rect.top - containerRect.top) - 8 : null);
    };
    updateDockSafeBottom();
    if (!dock) return undefined;
    const observer = new ResizeObserver(updateDockSafeBottom);
    observer.observe(dock);
    if (editorContainer) observer.observe(editorContainer);
    window.addEventListener("resize", updateDockSafeBottom);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDockSafeBottom);
    };
  }, [editor]);

  if (!selected) return null;
  const { shape, point, zoom } = selected;
  const node = shape.props.node;
  const Icon = getWorkflowNodeHeaderIcon(node);
  const mediaName = getWorkflowNodeMediaName(node);
  const title = node.kind === "text" ? (node.title === "上传文本" ? "上传文本（双击进入编辑模式）" : "文本输入（双击进入编辑模式）") : node.title.startsWith("上传") ? [node.title, getWorkflowUploadFileName(node)].filter(Boolean).join(" ") : [getNodeLabel(node.kind), mediaName].filter(Boolean).join(" ");
  const paramParts = getWorkflowNodeParamParts(node);
  const showEditor = (node.kind === "image" || node.kind === "video") && !hasWorkflowNodeResult(node) && !node.data.isRunning && node.data.uploadProgress === undefined;
  const screenNodeWidth = shape.props.w * zoom;
  const screenNodeHeight = shape.props.h * zoom;
  const maxParamWidth = Math.max(0, screenNodeWidth - estimateTitleTextWidth(title));
  const sizeLabel = buildWorkflowParamLabel(paramParts, maxParamWidth);
  const paramWidth = sizeLabel ? Math.min(maxParamWidth, estimateParamTextWidth(sizeLabel) + 2) : 0;
  const viewportBounds = editor.getViewportScreenBounds();
  const viewportWidth = viewportBounds.w;
  const viewportHeight = viewportBounds.h;
  const fallbackBottomToolbarSafeArea = 70;
  const safeViewportBottom = dockSafeBottom ?? viewportHeight - fallbackBottomToolbarSafeArea;
  const inputWidth = Math.min(680, Math.max(1, viewportWidth));
  const inputGap = 8;
  const minViewportTop = 16;
  const inputMaxHeight = Math.min(560, Math.max(160, safeViewportBottom - minViewportTop));
  const inputHeight = Math.min(Math.max(1, measuredEditorHeight), inputMaxHeight);
  const inputLeft = Math.max(inputWidth / 2, Math.min(point.x + screenNodeWidth / 2, viewportWidth - inputWidth / 2));
  const belowTop = point.y + screenNodeHeight + inputGap;
  const inputTop = Math.max(minViewportTop, Math.min(belowTop, safeViewportBottom - inputHeight));
  const promptMaxHeight = Math.max(52, inputMaxHeight - 176);
  const stopCanvasPointer = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <div className="pointer-events-none absolute z-30 h-[18px] overflow-visible text-[#367cee]" style={{ left: point.x, top: point.y - 18, width: screenNodeWidth, maxWidth: screenNodeWidth }}>
        <div className="absolute left-0 top-0 flex h-[18px] min-w-0 items-center gap-1.5 overflow-hidden" style={{ right: sizeLabel ? paramWidth + 8 : 0 }}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate text-[13px] font-semibold leading-[18px]">{title}</span>
        </div>
        {sizeLabel ? <div className="absolute right-0 top-0 h-[18px] truncate text-right text-[12px] font-medium leading-[18px] text-[#367cee]" style={{ width: paramWidth, maxWidth: paramWidth }}>{sizeLabel}</div> : null}
      </div>
      {showEditor ? (
        <div
          ref={editorBoxRef}
          className="pointer-events-auto absolute z-[9999] -translate-x-1/2 rounded-[26px] border-0 bg-transparent px-0 py-0"
          style={{ left: inputLeft, top: inputTop, width: inputWidth, maxHeight: inputMaxHeight }}
          onPointerDownCapture={stopCanvasPointer}
          onMouseDownCapture={stopCanvasPointer}
          onClick={stopCanvasPointer}
          onWheel={stopCanvasPointer}
        >
          {node.kind === "image" ? <ImageNodeEditor node={node} modelOptions={runtime.modelOptions} promptMaxHeight={promptMaxHeight} onChange={runtime.updateNode} onRun={() => runtime.runImageNode(node)} /> : null}
          {node.kind === "video" ? <VideoNodeEditor node={node} modelOptions={runtime.modelOptions} promptMaxHeight={promptMaxHeight} onChange={runtime.updateNode} onRun={() => runtime.runVideoNode(node)} /> : null}
        </div>
      ) : null}
    </>
  );
}

type WorkflowContextMenuState = { x: number; y: number; pagePoint?: { x: number; y: number }; isBlankCanvas?: boolean } | null;

function WorkflowCustomContextMenu({ menu, onClose, onAddNode, onUploadNode, onImportAsset, onUsePrompt }: { menu: WorkflowContextMenuState; onClose: () => void; onAddNode: (kind: WorkflowNodeKind, pagePoint?: { x: number; y: number }) => void; onUploadNode: () => void; onImportAsset?: () => void; onUsePrompt: (node: WorkflowNode) => void }) {
  const editor = useEditor();
  const actions = useActions();
  const selectedShapeIds = useValue("workflow-context-menu-selected", () => editor.getSelectedShapeIds(), [editor]);
  const hasSelection = selectedShapeIds.length > 0;
  const hasShapes = useValue("workflow-context-menu-has-shapes", () => editor.getCurrentPageShapes().length > 0, [editor]);
  const selectedWorkflowShape = useValue("workflow-context-menu-node", () => {
    const selectedWorkflowShapes = editor.getSelectedShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
    return selectedWorkflowShapes.length === 1 ? selectedWorkflowShapes[0] : undefined;
  }, [editor]);

  if (!menu) return null;

  const selectedWorkflowNode = menu.isBlankCanvas ? undefined : selectedWorkflowShape?.props.node;
  const showSelectionActions = hasSelection && !menu.isBlankCanvas;
  const isSelectedWorkflowShapeLocked = Boolean(selectedWorkflowShape && editor.isShapeOrAncestorLocked(selectedWorkflowShape));
  const selectedTextContent = selectedWorkflowNode?.kind === "text" ? getWorkflowTextNodeContent(selectedWorkflowNode) : "";
  const showTextItems = Boolean(selectedWorkflowNode?.kind === "text" && selectedTextContent.trim());
  const showImageItems = Boolean(selectedWorkflowNode?.kind === "image" && selectedWorkflowNode.data.images?.[0]);
  const showVideoItems = Boolean(selectedWorkflowNode?.kind === "video" && selectedWorkflowNode.data.videoUrl);
  const showNodeSpecificItems = showTextItems || showImageItems || showVideoItems;
  const isUploadedMediaNode = Boolean(selectedWorkflowNode?.title?.startsWith("上传"));

  const runAction = (actionId: string) => {
    const action = actions[actionId];
    if (!action) return;
    void action.onSelect("context-menu");
    onClose();
  };
  const runAddNode = (kind: WorkflowNodeKind) => {
    onAddNode(kind, menu.pagePoint);
    onClose();
  };
  const runUploadNode = () => {
    onClose();
    onUploadNode();
  };
  const runImportAsset = () => {
    onClose();
    onImportAsset?.();
  };
  const runDownload = () => {
    const selectedWorkflowNodes = editor.getSelectedShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node);
    const node = selectedWorkflowNodes.length === 1 ? selectedWorkflowNodes[0] : undefined;
    if (node) void downloadWorkflowNode(node).catch((error) => console.warn("[workflow] download failed", error));
    onClose();
  };
  const runNodeTask = (task: (node: WorkflowNode) => void | Promise<void>) => {
    const node = selectedWorkflowNode;
    if (!node) return;
    void Promise.resolve(task(node)).catch((error) => console.warn("[workflow] context menu task failed", error));
    onClose();
  };
  const runUsePrompt = () => {
    const node = selectedWorkflowNode;
    if (!node) return;
    onUsePrompt(node);
    onClose();
  };
  const runDelete = () => {
    editor.markHistoryStoppingPoint("delete workflow context menu");
    editor.deleteShapes(selectedShapeIds);
    onClose();
  };
  const runSelectAll = () => {
    editor.select(...editor.getCurrentPageShapes().map((shape) => shape.id));
    onClose();
  };
  const runZoomToAll = () => {
    const workflowNodes = editor.getCurrentPageShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node);
    zoomToWorkflowNodes(editor, workflowNodes);
    onClose();
  };

  const itemClassName = "flex h-8 w-full items-center justify-between rounded-[6px] px-2 text-left text-[13px] text-[#222222] transition hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:text-[#b8b8b8] disabled:hover:bg-transparent";
  const submenuClassName = "absolute left-[calc(100%-2px)] top-0 hidden w-[148px] rounded-[10px] border border-[#e8e8e8] bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)] group-hover:block";
  const iconClassName = "h-4 w-4 shrink-0 text-[#6f767d]";
  const menuLabel = (Icon: typeof RiAddLine, label: string) => <span className="flex min-w-0 items-center gap-2"><Icon className={iconClassName} aria-hidden="true" /><span className="truncate">{label}</span></span>;
  const separator = <div className="my-1 h-px bg-[#eeeeee]" />;

  return (
    <div data-workflow-context-menu className="pointer-events-auto absolute z-[10000] w-[180px] rounded-[10px] border border-[#e8e8e8] bg-white p-1.5 text-[#222222] shadow-[0_12px_32px_rgba(0,0,0,0.16)]" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      {menu.isBlankCanvas ? (
        <>
          <button type="button" onClick={() => runAddNode("text")} className={itemClassName}>{menuLabel(RiTextBlock, "插入文本节点")}<span className="text-[11px] text-[#999999]">T</span></button>
          <button type="button" onClick={() => runAddNode("image")} className={itemClassName}>{menuLabel(RiImageAiLine, "插入图片节点")}<span className="text-[11px] text-[#999999]">I</span></button>
          <button type="button" onClick={() => runAddNode("video")} className={itemClassName}>{menuLabel(RiFilmAiLine, "插入视频节点")}<span className="text-[11px] text-[#999999]">D</span></button>
          {separator}
          <button type="button" onClick={runUploadNode} className={itemClassName}>{menuLabel(RiUpload2Line, "从本地上传")}</button>
          {onImportAsset ? <button type="button" onClick={runImportAsset} className={itemClassName}>{menuLabel(RiExportFill, "从资产库导入")}</button> : null}
          {separator}
          <button type="button" onClick={() => { editor.zoomIn(); onClose(); }} className={itemClassName}>{menuLabel(RiZoomInLine, "画布放大")}<span className="text-[11px] text-[#999999]">Ctrl +</span></button>
          <button type="button" onClick={() => { editor.zoomOut(); onClose(); }} className={itemClassName}>{menuLabel(RiZoomOutLine, "画布缩小")}<span className="text-[11px] text-[#999999]">Ctrl -</span></button>
          {hasShapes ? <button type="button" onClick={runZoomToAll} className={itemClassName}>{menuLabel(RiFocus3Line, "显示全部节点")}<span className="text-[11px] text-[#999999]">Shift 1</span></button> : null}
          {separator}
        </>
      ) : null}
      {selectedWorkflowNode ? <button type="button" onClick={() => runAction("toggle-lock")} className={itemClassName}>{menuLabel(isSelectedWorkflowShapeLocked ? RiLockUnlockLine : RiLockLine, isSelectedWorkflowShapeLocked ? "解锁" : "锁定")}</button> : null}
      {selectedWorkflowNode ? separator : null}
      {showSelectionActions ? <button type="button" onClick={() => runAction("cut")} className={itemClassName}>{menuLabel(RiScissorsCutLine, "剪切")}<span className="text-[11px] text-[#999999]">Ctrl X</span></button> : null}
      {showSelectionActions ? <button type="button" onClick={() => runAction("copy")} className={itemClassName}>{menuLabel(RiFileCopyLine, "复制")}<span className="text-[11px] text-[#999999]">Ctrl C</span></button> : null}
      <button type="button" onClick={() => runAction("paste")} className={itemClassName}>{menuLabel(RiClipboardLine, "粘贴")}<span className="text-[11px] text-[#999999]">Ctrl V</span></button>
      {showSelectionActions ? <button type="button" onClick={() => runAction("duplicate")} className={itemClassName}>{menuLabel(RiFileCopy2Line, "复制副本")}<span className="text-[11px] text-[#999999]">Ctrl D</span></button> : null}
      {showSelectionActions ? <button type="button" onClick={runDelete} className={itemClassName}>{menuLabel(RiDeleteBinLine, "删除")}<span className="text-[11px] text-[#999999]">Del</span></button> : null}
      {showSelectionActions ? separator : null}
      {showSelectionActions ? <button type="button" onClick={() => runAction("bring-to-front")} className={itemClassName}>{menuLabel(RiBringToFront, "置于顶层")}</button> : null}
      {showSelectionActions ? <button type="button" onClick={() => runAction("bring-forward")} className={itemClassName}>{menuLabel(RiBringForward, "上移一层")}</button> : null}
      {showSelectionActions ? <button type="button" onClick={() => runAction("send-backward")} className={itemClassName}>{menuLabel(RiSendBackward, "下移一层")}</button> : null}
      {showSelectionActions ? <button type="button" onClick={() => runAction("send-to-back")} className={itemClassName}>{menuLabel(RiSendToBack, "置于底层")}</button> : null}
      {showNodeSpecificItems ? separator : null}
      {showTextItems ? <button type="button" onClick={() => runNodeTask(copyWorkflowTextNode)} className={itemClassName}>{menuLabel(RiFileTextLine, "复制文字")}</button> : null}
      {showImageItems || showVideoItems ? <button type="button" onClick={runUsePrompt} disabled={isUploadedMediaNode} className={itemClassName}>{menuLabel(RiTBoxLine, "使用提示词")}</button> : null}
      {showImageItems ? (
        <div className="group relative">
          <button type="button" className={itemClassName}>{menuLabel(RiExportLine, "导出")}<span className="text-[16px] leading-none text-[#999999]">›</span></button>
          <div className={submenuClassName}>
            <button type="button" onClick={() => runAction("export-as-svg")} className={itemClassName}>{menuLabel(RiFileCodeLine, "导出 SVG")}</button>
            <button type="button" onClick={() => runAction("export-as-png")} className={itemClassName}>{menuLabel(RiFileImageLine, "导出 PNG")}</button>
            <button type="button" onClick={() => runNodeTask(exportWorkflowImageJpg)} className={itemClassName}>{menuLabel(RiFileImageLine, "导出 JPG")}</button>
          </div>
        </div>
      ) : null}
      {showVideoItems ? (
        <div className="group relative">
          <button type="button" className={itemClassName}>{menuLabel(RiExportLine, "导出")}<span className="text-[16px] leading-none text-[#999999]">›</span></button>
          <div className={submenuClassName}>
            <button type="button" onClick={() => runNodeTask((node) => exportWorkflowVideoFrame(node, "first"))} className={itemClassName}>{menuLabel(RiImageLine, "导出首帧")}</button>
            <button type="button" onClick={() => runNodeTask((node) => exportWorkflowVideoFrame(node, "last"))} className={itemClassName}>{menuLabel(RiImageLine, "导出尾帧")}</button>
            <button type="button" onClick={() => runNodeTask((node) => exportWorkflowVideoFrame(node, "current"))} className={itemClassName}>{menuLabel(RiImageLine, "导出当前帧")}</button>
          </div>
        </div>
      ) : null}
      {showNodeSpecificItems ? <button type="button" onClick={runDownload} className={itemClassName}>{menuLabel(RiDownloadLine, "下载")}</button> : null}
      {hasShapes ? separator : null}
      {hasShapes ? <button type="button" onClick={runSelectAll} className={itemClassName}>{menuLabel(RiCheckboxMultipleLine, "全选")}<span className="text-[11px] text-[#999999]">Ctrl A</span></button> : null}
    </div>
  );
}

export function WorkflowCanvas({ workflowId, value, onChange, workflowTitle, onCredit, onGeneratedMedia, onPreviewMedia, onShowTip, getImageDisplayUrl, getVideoPosterDisplayUrl, enabledTextModelIds, textModelProviders = {}, enabledImageModelIds, enabledVideoModelIds, uploadRuleOverrides, leftSidebarVisible = true, onToggleLeftSidebar, workflowAssets = [], referenceAssets = [], referenceAssetsLoadStatus = "idle", referenceAssetCounts, onLoadReferenceAssets, onLoadMoreReferenceAssets, onExternalFilesDrop, onOpenAssetImport, assetsToImport, onAssetsImported }: WorkflowCanvasProps) {
  const editorRef = useRef<Editor | null>(null);
  const stateRef = useRef(normalizeState(value));
  const loadedWorkflowIdRef = useRef(workflowId);
  const pollMountedRef = useRef(true);
  const resumingVideoNodesRef = useRef<Set<string>>(new Set());
  const resumingImageNodesRef = useRef<Set<string>>(new Set());
  // Image nodes currently running the GPT-image safety-rewrite retry loop. While a node is in this set the
  // backend still has the ORIGINAL failed job (returned by /api/generation-status?active), so the recovery /
  // reconcile effects must NOT re-apply that stale failure — otherwise the node flips back to the failed card
  // ~2-3s after the user clicks retry even though the rewrite loop is still running in the background.
  const optimizingImageNodesRef = useRef<Set<string>>(new Set());
  const lastExternalKeyRef = useRef(stateKey(stateRef.current));
  const lastEmittedKeyRef = useRef("");
  const loadingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const geometryPollRef = useRef<number | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const selectedNodeIdRef = useRef("");
  const wasBrushingRef = useRef(false);
  const activeCanvasToolRef = useRef<"select" | "hand">("select");
  const recentActionNodeIdsRef = useRef<string[]>([]);
  const lastHandledDropStampRef = useRef(-1);
  const uploadNodeInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [connectingFrom, setConnectingFrom] = useState("");
  const [connectingTo, setConnectingTo] = useState("");
  const [multiConnectSources, setMultiConnectSources] = useState<string[]>([]);
  const [connectionPointer, setConnectionPointer] = useState<{ x: number; y: number } | undefined>();
  const [activeCanvasTool, setActiveCanvasToolState] = useState<"select" | "hand">("select");
  const [editorTick, setEditorTick] = useState(0);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState("#cccccc");
  const [contextMenu, setContextMenu] = useState<WorkflowContextMenuState>(null);

  const textModels = useMemo(() => {
    const modelById = new Map(frontendConversationModels.map((model) => [model.id, model]));
    const filtered = enabledTextModelIds && enabledTextModelIds.length > 0 ? enabledTextModelIds.map((id) => modelById.get(id)).filter((model): model is ConversationModel => Boolean(model)) : frontendConversationModels;
    return filtered.length > 0 ? filtered : frontendConversationModels;
  }, [enabledTextModelIds]);
  const imageModels = useMemo(() => {
    const enabled = enabledImageModelIds && enabledImageModelIds.length > 0 ? new Set(enabledImageModelIds) : undefined;
    const filtered = enabled ? frontendImageGenerationModels.filter((model) => enabled.has(model.id)) : frontendImageGenerationModels;
    return filtered.length > 0 ? filtered : frontendImageGenerationModels;
  }, [enabledImageModelIds]);
  const videoModels = useMemo(() => {
    const enabled = enabledVideoModelIds && enabledVideoModelIds.length > 0 ? new Set(enabledVideoModelIds) : undefined;
    const filtered = enabled ? workflowVideoModels.filter((model) => enabled.has(model.id)) : workflowVideoModels;
    return filtered.length > 0 ? filtered : workflowVideoModels;
  }, [enabledVideoModelIds]);
  const modelOptions = useMemo<WorkflowModelOptions>(() => ({ textModels, textModelProviders, imageModels, videoModels }), [imageModels, textModelProviders, textModels, videoModels]);

  const exportStateFromEditor = useCallback((editor: Editor): WorkflowCanvasState => {
    const shapes = editor.getCurrentPageShapesSorted().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
    const nodes = shapes.map((shape) => ({ ...shape.props.node, x: shape.x, y: shape.y, data: { ...shape.props.node.data, isLocked: shape.isLocked || undefined } }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const current = stateRef.current;
    const missingNodes = current.nodes.filter((node) => !nodeIds.has(node.id));
    const withHistorical = addHistoricalNodes(current, missingNodes);
    const camera = editor.getCamera();
    return {
      nodes,
      edges: current.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
      viewport: { x: camera.x, y: camera.y, zoom: camera.z },
      historicalTextNodes: withHistorical.historicalTextNodes,
      historicalMediaNodes: withHistorical.historicalMediaNodes,
    };
  }, []);

  const normalizeWorkflowShapesForTldrawActions = useCallback((editor: Editor) => {
    const shapes = editor.getCurrentPageShapesSorted().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
    const updates: WorkflowNodeShape[] = [];
    for (const shape of shapes) {
      const nodeId = getNodeIdFromShapeId(String(shape.id));
      if (shape.props.node.id === nodeId && shape.props.node.x === shape.x && shape.props.node.y === shape.y) continue;
      updates.push({
        ...shape,
        props: {
          ...shape.props,
          node: { ...shape.props.node, id: nodeId, x: shape.x, y: shape.y },
        },
      });
    }
    if (updates.length > 0) editor.updateShapes(updates);
  }, []);

  const emitEditorState = useCallback((editor: Editor) => {
    const next = exportStateFromEditor(editor);
    const key = stateKey(next);
    if (key === lastEmittedKeyRef.current || key === lastExternalKeyRef.current) return;
    loadingRef.current = true;
    setEditorTick((tick) => tick + 1);
    loadingRef.current = false;
    stateRef.current = next;
    lastEmittedKeyRef.current = key;
    lastExternalKeyRef.current = key;
    onChange(next);
    setEditorTick((tick) => tick + 1);
  }, [exportStateFromEditor, onChange]);

  const syncSelectedNodeFromEditor = useCallback((editor: Editor) => {
    const isBrushing = editor.isIn("select.brushing");
    const selectedShapeIds = editor.getSelectedShapeIds();
    const selectedNodeShapeIds = selectedShapeIds.filter((shapeId) => editor.getShape(shapeId)?.type === "workflow_node");
    const selectedConnectionShapeIds = selectedShapeIds.filter((shapeId) => editor.getShape(shapeId)?.type === "workflow_connection");
    if (wasBrushingRef.current && !isBrushing && selectedConnectionShapeIds.length > 0) {
      if (selectedNodeShapeIds.length > 0) editor.select(...selectedNodeShapeIds);
      else editor.select();
      setWorkflowHighlightedNodeIds(selectedNodeShapeIds.map((shapeId) => getNodeIdFromShapeId(String(shapeId))));
      wasBrushingRef.current = false;
      return;
    }
    wasBrushingRef.current = isBrushing;
    setWorkflowHighlightedNodeIds(selectedNodeShapeIds.map((shapeId) => getNodeIdFromShapeId(String(shapeId))));
    const selectedNodeShapeId = selectedNodeShapeIds[0];
    const nextSelectedNodeId = selectedNodeShapeId ? getNodeIdFromShapeId(String(selectedNodeShapeId)) : "";
    if (nextSelectedNodeId === selectedNodeIdRef.current) return;
    selectedNodeIdRef.current = nextSelectedNodeId;
    setSelectedNodeId(nextSelectedNodeId);
  }, []);

  const scheduleEmit = useCallback(() => {
    if (loadingRef.current || !editorRef.current) return;
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const editor = editorRef.current;
      if (!editor || loadingRef.current) return;
      syncSelectedNodeFromEditor(editor);
      normalizeWorkflowShapesForTldrawActions(editor);
      emitEditorState(editor);
    });
  }, [emitEditorState, normalizeWorkflowShapesForTldrawActions, syncSelectedNodeFromEditor]);

  const syncNodeGeometryFromEditor = useCallback((editor: Editor) => {
    if (loadingRef.current) return;
    const shapes = editor.getCurrentPageShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
    if (shapes.length === 0) return;
    const geometryByNodeId = new Map(shapes.map((shape) => [shape.props.node.id, { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h }]));
    let changed = false;
    const nextNodes = stateRef.current.nodes.map((node) => {
      const geometry = geometryByNodeId.get(node.id);
      if (!geometry) return node;
      const currentSize = getWorkflowNodeVisualSize(node);
      const shouldPersistVisualSize = node.kind === "text" || hasResizableGeneratedMedia(node);
      const nextVisualSize = shouldPersistVisualSize ? { width: geometry.w, height: geometry.h } : node.data.visualSize;
      const sizeChanged = shouldPersistVisualSize && (Math.round(currentSize.w) !== Math.round(geometry.w) || Math.round(currentSize.h) !== Math.round(geometry.h));
      const positionChanged = Math.round(node.x) !== Math.round(geometry.x) || Math.round(node.y) !== Math.round(geometry.y);
      if (!positionChanged && !sizeChanged) return node;
      changed = true;
      return { ...node, x: geometry.x, y: geometry.y, data: nextVisualSize ? { ...node.data, visualSize: nextVisualSize } : node.data };
    });
    if (!changed) return;
    const next = { ...stateRef.current, nodes: nextNodes };
    loadingRef.current = true;
    syncWorkflowConnectionShapes(editor, next);
    loadingRef.current = false;
    stateRef.current = next;
    lastEmittedKeyRef.current = stateKey(next);
    lastExternalKeyRef.current = lastEmittedKeyRef.current;
    onChange(next);
  }, [onChange]);

  const loadStateIntoEditor = useCallback((editor: Editor, nextState: WorkflowCanvasState) => {
    loadingRef.current = true;
    const existing = editor.getCurrentPageShapes().filter((shape) => shape.type === "workflow_node" || shape.type === "workflow_connection" || (shape.type === "arrow" && typeof shape.meta?.workflowEdgeId === "string")).map((shape) => shape.id);
    if (existing.length > 0) editor.deleteShapes(existing);
    if (nextState.nodes.length > 0) {
      editor.createShapes(nextState.nodes.map((node) => ({ id: getShapeId(node.id), type: "workflow_node", x: node.x, y: node.y, isLocked: Boolean(node.data.isLocked), props: { ...getWorkflowNodeVisualSize(node), node } })) as never);
    }
    syncWorkflowConnectionShapes(editor, nextState);
    stateRef.current = nextState;
    loadingRef.current = false;
    selectedNodeIdRef.current = "";
    setSelectedNodeId("");
    setWorkflowHighlightedNodeIds([]);
    setConnectingFrom("");
    setConnectingTo("");
    setEditorTick((tick) => tick + 1);
    if (nextState.nodes.length > 0) window.requestAnimationFrame(() => zoomToWorkflowNodes(editor, nextState.nodes));
  }, []);

  const handleMount = useCallback((editor: Editor) => {
    unlistenRef.current?.();
    editorRef.current = editor;
    editor.user.updateUserPreferences({ isSnapMode: true });
    const currentTheme = editor.getCurrentTheme();
    editor.updateTheme({
      ...currentTheme,
      colors: {
        ...currentTheme.colors,
        light: { ...currentTheme.colors.light, snap: "#00ff00" },
        dark: { ...currentTheme.colors.dark, snap: "#00ff00" },
      },
    });
    editor.setCameraOptions({ zoomSteps: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8] });
    loadedWorkflowIdRef.current = workflowId;
    loadStateIntoEditor(editor, stateRef.current);
    const syncAfterTldrawAction = () => {
      if (loadingRef.current) return;
      scheduleEmit();
    };
    const syncEdgesFromBindings = () => {
      if (loadingRef.current) return;
      const nextEdges = getWorkflowEdgesFromConnectionShapes(editor, stateRef.current);
      const removedEdges = stateRef.current.edges.filter((edge) => !nextEdges.some((item) => item.source === edge.source && item.target === edge.target)).map((edge) => ({ source: edge.source, target: edge.target }));
      const cleanedNodes = removeConnectedReferenceNames(stateRef.current.nodes, removedEdges);
      const next = { ...stateRef.current, nodes: cleanedNodes, edges: nextEdges };
      stateRef.current = next;
      lastEmittedKeyRef.current = stateKey(next);
      lastExternalKeyRef.current = lastEmittedKeyRef.current;
      onChange(next);
      setEditorTick((tick) => tick + 1);
    };
    const unlistenCreate = editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
      if (shape.type !== "workflow_node") return;
      syncAfterTldrawAction();
    });
    const unlistenChange = editor.sideEffects.registerAfterChangeHandler("shape", (prevShape, nextShape) => {
      if (prevShape.type === "workflow_connection" || nextShape.type === "workflow_connection") {
        syncWorkflowConnectionShapes(editor, stateRef.current);
        return;
      }
      if (prevShape.type !== "workflow_node" && nextShape.type !== "workflow_node") return;
      const next = exportStateFromEditor(editor);
      stateRef.current = next;
      syncWorkflowConnectionShapes(editor, next);
      syncAfterTldrawAction();
    });
    const unlistenDelete = editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
      if (shape.type === "workflow_connection" && typeof shape.meta?.workflowEdgeId === "string") {
        const edgeId = String(shape.meta.workflowEdgeId);
        const sourceNodeId = typeof shape.meta?.sourceNodeId === "string" ? shape.meta.sourceNodeId : "";
        const targetNodeId = typeof shape.meta?.targetNodeId === "string" ? shape.meta.targetNodeId : "";
        const cleanedNodes = sourceNodeId && targetNodeId ? removeConnectedReferenceNames(stateRef.current.nodes, [{ source: sourceNodeId, target: targetNodeId }]) : stateRef.current.nodes;
        const next = { ...stateRef.current, nodes: cleanedNodes, edges: stateRef.current.edges.filter((edge) => edge.id !== edgeId) };
        stateRef.current = next;
        lastEmittedKeyRef.current = stateKey(next);
        lastExternalKeyRef.current = lastEmittedKeyRef.current;
        onChange(next);
        return;
      }
      if (shape.type !== "workflow_node") return;
      stateRef.current = addHistoricalNodes(stateRef.current, [(shape as WorkflowNodeShape).props.node]);
      syncAfterTldrawAction();
    });
    const unlistenBindingCreate = editor.sideEffects.registerAfterCreateHandler("binding", (binding) => {
      if (binding.type === "workflow_connection") syncEdgesFromBindings();
    });
    const unlistenBindingChange = editor.sideEffects.registerAfterChangeHandler("binding", (_prevBinding, nextBinding) => {
      if (nextBinding.type === "workflow_connection") syncEdgesFromBindings();
    });
    const unlistenBindingDelete = editor.sideEffects.registerAfterDeleteHandler("binding", (binding) => {
      if (binding.type === "workflow_connection") syncEdgesFromBindings();
    });
    const unlistenStore = editor.store.listen(() => syncSelectedNodeFromEditor(editor));
    unlistenRef.current = () => {
      unlistenCreate();
      unlistenChange();
      unlistenDelete();
      unlistenBindingCreate();
      unlistenBindingChange();
      unlistenBindingDelete();
      unlistenStore();
    };
  }, [loadStateIntoEditor, onChange, scheduleEmit, syncSelectedNodeFromEditor, workflowId]);

  useEffect(() => {
    const next = normalizeState(value);
    const key = stateKey(next);
    const workflowChanged = loadedWorkflowIdRef.current !== workflowId;
    if (!workflowChanged && (key === lastExternalKeyRef.current || key === lastEmittedKeyRef.current)) return;
    loadedWorkflowIdRef.current = workflowId;
    lastExternalKeyRef.current = key;
    if (workflowChanged) lastEmittedKeyRef.current = "";
    stateRef.current = next;
    const editor = editorRef.current;
    if (editor) loadStateIntoEditor(editor, next);
  }, [value, workflowId, loadStateIntoEditor]);

  useEffect(() => () => {
    pollMountedRef.current = false;
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    if (geometryPollRef.current !== null) window.clearInterval(geometryPollRef.current);
    unlistenRef.current?.();
    unlistenRef.current = null;
    setWorkflowHighlightedNodeIds([]);
  }, []);

  useEffect(() => {
    geometryPollRef.current = window.setInterval(() => {
      const editor = editorRef.current;
      if (!editor) return;
      syncNodeGeometryFromEditor(editor);
    }, 900);
    return () => {
      if (geometryPollRef.current !== null) window.clearInterval(geometryPollRef.current);
      geometryPollRef.current = null;
    };
  }, [syncNodeGeometryFromEditor]);

  const updateState = useCallback((updater: (current: WorkflowCanvasState) => WorkflowCanvasState) => {
    const editor = editorRef.current;
    const current = editor ? exportStateFromEditor(editor) : stateRef.current;
    const next = updater(current);
    stateRef.current = next;
    lastEmittedKeyRef.current = stateKey(next);
    lastExternalKeyRef.current = lastEmittedKeyRef.current;
    onChange(next);
    if (!editor) return;
    loadingRef.current = true;
    const existingIds = new Set(editor.getCurrentPageShapes().filter((shape) => shape.type === "workflow_node").map((shape) => shape.id));
    const nextIds = new Set<TLShapeId>();
    next.nodes.forEach((node) => {
      const id = getShapeId(node.id);
      nextIds.add(id);
      const shape = editor.getShape(id) as WorkflowNodeShape | undefined;
      const size = getWorkflowNodeVisualSize(node);
      if (shape) editor.updateShape<WorkflowNodeShape>({ id, type: "workflow_node", x: node.x, y: node.y, isLocked: Boolean(node.data.isLocked), props: { ...shape.props, ...size, node } });
      else editor.createShapes([{ id, type: "workflow_node", x: node.x, y: node.y, isLocked: Boolean(node.data.isLocked), props: { ...size, node } }] as never);
    });
    const removed = Array.from(existingIds).filter((id) => !nextIds.has(id));
    if (removed.length > 0) editor.deleteShapes(removed);
    syncWorkflowConnectionShapes(editor, next);
    loadingRef.current = false;
    setEditorTick((tick) => tick + 1);
  }, [onChange]);

  const markNodeAction = useCallback((nodeId: string) => {
    recentActionNodeIdsRef.current = [nodeId, ...recentActionNodeIdsRef.current.filter((id) => id !== nodeId)].slice(0, 20);
  }, []);

  const updateNode = useCallback((nodeId: string, patch: Partial<WorkflowNodeData>) => {
    markNodeAction(nodeId);
    updateState((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const nextPatch = patch.model && patch.model !== node.data.model ? { ...patch, ...pruneWorkflowUploadsForModel(node, patch.model, uploadRuleOverrides) } : patch;
        return { ...node, data: { ...node.data, ...nextPatch } };
      }),
    }));
  }, [markNodeAction, updateState, uploadRuleOverrides]);

  const addNode = useCallback((kind: WorkflowNodeKind, pagePoint?: { x: number; y: number }) => {
    const editor = editorRef.current;
    const current = stateRef.current;
    const viewport = editor?.getViewportPageBounds();
    const draftNode: WorkflowNode = { id: createId("workflow_node"), kind, title: getNodeLabel(kind), x: 0, y: 0, data: getDefaultNodeData(kind) };
    const size = getWorkflowNodeVisualSize(draftNode);
    const anchorId = recentActionNodeIdsRef.current.find((nodeId) => current.nodes.some((node) => node.id === nodeId)) || selectedNodeIdRef.current;
    const anchor = current.nodes.find((node) => node.id === anchorId);
    const fallback = viewport ? { x: viewport.x + viewport.w / 2 - size.w / 2, y: viewport.y + viewport.h / 2 - size.h / 2 } : undefined;
    const position = pagePoint ? { x: pagePoint.x - size.w / 2, y: pagePoint.y - size.h / 2 } : findNonOverlappingNodePosition(current.nodes, size, anchor, fallback);
    const node: WorkflowNode = {
      id: draftNode.id,
      kind,
      title: getNodeLabel(kind),
      x: position.x,
      y: position.y,
      data: draftNode.data,
    };
    recentActionNodeIdsRef.current = [node.id, ...recentActionNodeIdsRef.current].slice(0, 20);
    updateState((state) => ({ ...state, nodes: [...state.nodes, node] }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const nextEditor = editorRef.current;
      if (!nextEditor) return;
      const shapeId = getShapeId(node.id);
      if (!nextEditor.getShape(shapeId)) return;
      nextEditor.select(shapeId);
      focusWorkflowNodeInViewport(nextEditor, node);
    }));
  }, [updateState]);

  const addNodeFromPrompt = useCallback((sourceNode: WorkflowNode) => {
    if (sourceNode.kind !== "image" && sourceNode.kind !== "video") return;
    const current = stateRef.current;
    const kind = sourceNode.kind;
    const defaultData = getDefaultNodeData(kind);
    const data: WorkflowNodeData = {
      ...defaultData,
      prompt: sourceNode.data.prompt ?? "",
      model: sourceNode.data.model ?? defaultData.model,
      ratio: sourceNode.data.ratio ?? defaultData.ratio,
      resolution: sourceNode.data.resolution ?? defaultData.resolution,
      duration: kind === "video" ? sourceNode.data.duration ?? defaultData.duration : undefined,
      videoReferenceMode: kind === "video" ? sourceNode.data.videoReferenceMode : undefined,
      uploads: (sourceNode.data.generationUploads ?? sourceNode.data.uploads)?.map((upload) => {
        const { readonlySource: _readonlySource, sourceNodeId: _sourceNodeId, ...rest } = upload;
        return { ...rest, id: createId("workflow_upload"), status: "ready" as const };
      }),
    };
    const draftNode: WorkflowNode = { id: createId("workflow_node"), kind, title: getNodeLabel(kind), x: 0, y: 0, data };
    const size = getWorkflowNodeVisualSize(draftNode);
    const position = findNonOverlappingNodePosition(current.nodes, size, sourceNode);
    const node = { ...draftNode, x: position.x, y: position.y };
    recentActionNodeIdsRef.current = [node.id, ...recentActionNodeIdsRef.current].slice(0, 20);
    updateState((state) => ({ ...state, nodes: [...state.nodes, node] }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const shapeId = getShapeId(node.id);
      if (!editor.getShape(shapeId)) return;
      editor.select(shapeId);
      focusWorkflowNodeInViewport(editor, node);
    }));
  }, [updateState]);

  const addUploadedNode = useCallback((draftNode: Omit<WorkflowNode, "x" | "y">, targetNodeId?: string) => {
    const editor = editorRef.current;
    const current = stateRef.current;
    const viewport = editor?.getViewportPageBounds();
    const draftWithPosition: WorkflowNode = { ...draftNode, x: 0, y: 0 };
    const size = getWorkflowNodeVisualSize(draftWithPosition);
    const target = targetNodeId ? current.nodes.find((node) => node.id === targetNodeId) : undefined;
    const anchorId = recentActionNodeIdsRef.current.find((nodeId) => current.nodes.some((node) => node.id === nodeId)) || selectedNodeIdRef.current;
    const anchor = current.nodes.find((node) => node.id === anchorId);
    const fallback = viewport ? { x: viewport.x + viewport.w / 2 - size.w / 2, y: viewport.y + viewport.h / 2 - size.h / 2 } : undefined;
    const position = target ? findNonOverlappingNodePositionLeftOfTarget(current.nodes, size, target) : findNonOverlappingNodePosition(current.nodes, size, anchor, fallback);
    const node: WorkflowNode = { ...draftWithPosition, x: position.x, y: position.y };
    recentActionNodeIdsRef.current = [node.id, ...recentActionNodeIdsRef.current].slice(0, 20);
    updateState((state) => ({ ...state, nodes: [...state.nodes, node], edges: targetNodeId ? [...state.edges, { id: createId("workflow_edge"), source: node.id, target: targetNodeId }] : state.edges }));
    return node;
  }, [updateState]);

  const selectAndFocusUploadedNodes = useCallback((nodeIds: string[], focus = true) => {
    if (nodeIds.length === 0) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const shapeIds = nodeIds.map(getShapeId).filter((shapeId) => editor.getShape(shapeId));
      if (shapeIds.length === 0) return;
      editor.select(...shapeIds);
      if (focus) zoomToSelectedOrWorkflowNodes(editor, stateRef.current.nodes.filter((node) => nodeIds.includes(node.id)));
    }));
  }, []);

  const handleUploadNodeFile = useCallback(async (file: File, targetNodeId?: string, onDuplicateTip?: (message: string) => void) => {
    try {
      if (file.type.startsWith("image/")) {
        const dimensions = await getWorkflowImageFileDimensions(file);
        const validationError = validateWorkflowUploadNodeFile(file, "image", { dimensions });
        if (validationError) return onShowTip?.(validationError);
        const nodeId = createId("workflow_node");
        const previewUrl = URL.createObjectURL(file);
        addUploadedNode({ id: nodeId, kind: "image", title: "上传图片", data: { ...getDefaultNodeData("image"), prompt: "上传图片", imageDimensions: {}, ratio: normalizeWorkflowImageRatio(undefined, dimensions), uploadProgress: 1, uploadPreviewUrl: previewUrl } }, targetNodeId);
        const uploaded = await uploadWorkflowImage(file, (progress) => updateNode(nodeId, { uploadProgress: Math.min(99, progress) }), true);
        const url = uploaded.url;
        if (uploaded.duplicate) (onDuplicateTip ?? onShowTip)?.("图片已存在，无需重复上传！");
        const data: WorkflowNodeData = { ...getDefaultNodeData("image"), prompt: "上传图片", images: [url], imageDimensions: { [url]: dimensions }, mediaSystemNames: { [url]: file.name }, ratio: normalizeWorkflowImageRatio(undefined, dimensions), visualSize: undefined, uploadProgress: undefined, uploadPreviewUrl: undefined };
        updateNode(nodeId, data);
        URL.revokeObjectURL(previewUrl);
        void persistWorkflowUploadNodeAsset({ url, name: file.name, mediaType: "image", workflowId, workflowNodeId: nodeId, sourcePrompt: "上传图片", file, dimensions, settings: { ratio: data.ratio, resolution: data.resolution }, contentHash: uploaded.contentHash }).catch((error) => console.warn("[media-assets] failed to persist workflow uploaded image", error));
        return nodeId;
      }
      if (file.type.startsWith("video/")) {
        const media = await readWorkflowMediaFileMetadata(file, "video");
        const validationError = validateWorkflowUploadNodeFile(file, "video", media);
        if (validationError) return onShowTip?.(validationError);
        const defaultData = getDefaultNodeData("video");
        const nodeId = createId("workflow_node");
        const previewUrl = URL.createObjectURL(file);
        addUploadedNode({ id: nodeId, kind: "video", title: "上传视频", data: { ...defaultData, prompt: "上传视频", videoDimensions: media.dimensions, durationSeconds: media.durationSeconds, ratio: media.dimensions ? getCommonWorkflowRatioLabel(media.dimensions) ?? defaultData.ratio : defaultData.ratio, uploadProgress: 1, uploadPreviewUrl: previewUrl } }, targetNodeId);
        const url = await uploadWorkflowFile(file, "video", (progress) => updateNode(nodeId, { uploadProgress: Math.min(99, progress) }));
        const data: WorkflowNodeData = { ...defaultData, prompt: "上传视频", videoUrl: url, videoDimensions: media.dimensions, durationSeconds: media.durationSeconds, videoCurrentTime: 0, mediaSystemNames: { [url]: file.name }, ratio: media.dimensions ? getCommonWorkflowRatioLabel(media.dimensions) ?? defaultData.ratio : defaultData.ratio, visualSize: undefined, uploadProgress: undefined, uploadPreviewUrl: undefined };
        updateNode(nodeId, data);
        URL.revokeObjectURL(previewUrl);
        void persistWorkflowUploadNodeAsset({ url, name: file.name, mediaType: "video", workflowId, workflowNodeId: nodeId, sourcePrompt: "上传视频", file, dimensions: media.dimensions, durationSeconds: media.durationSeconds, settings: { ratio: data.ratio, resolution: data.resolution, duration: data.duration } }).catch((error) => console.warn("[media-assets] failed to persist workflow uploaded video", error));
        return nodeId;
      }
      if (file.type.startsWith("audio/") || ["mp3", "wav"].includes(getWorkflowFileExtension(file))) {
        const media = await readWorkflowMediaFileMetadata(file, "audio");
        const validationError = validateWorkflowUploadNodeFile(file, "audio", media);
        if (validationError) return onShowTip?.(validationError);
        const nodeId = createId("workflow_node");
        addUploadedNode({ id: nodeId, kind: "audio", title: "上传音频", data: { ...getDefaultNodeData("audio"), durationSeconds: media.durationSeconds, uploadProgress: 1 } }, targetNodeId);
        const url = await uploadWorkflowFile(file, "audio", (progress) => updateNode(nodeId, { uploadProgress: Math.min(99, progress) }));
        updateNode(nodeId, { audioUrl: url, durationSeconds: media.durationSeconds, mediaSystemNames: { [url]: file.name }, uploadProgress: undefined });
        void persistWorkflowUploadNodeAsset({ url, name: file.name, mediaType: "audio", workflowId, workflowNodeId: nodeId, sourcePrompt: "上传音频", file, durationSeconds: media.durationSeconds }).catch((error) => console.warn("[media-assets] failed to persist workflow uploaded audio", error));
        return nodeId;
      }
      if (file.type === "text/plain" || getWorkflowFileExtension(file) === "txt") {
        const nodeId = createId("workflow_node");
        addUploadedNode({ id: nodeId, kind: "text", title: "上传文本", data: { ...getDefaultNodeData("text"), uploadProgress: 1 } }, targetNodeId);
        const text = await readWorkflowDocumentText(file, (progress) => updateNode(nodeId, { uploadProgress: Math.min(99, progress) }));
        const validationError = validateWorkflowUploadNodeFile(file, "text", undefined, text);
        if (validationError) {
          updateNode(nodeId, { uploadProgress: undefined, error: validationError });
          return onShowTip?.(validationError);
        }
        const url = await uploadWorkflowFile(file, "document");
        updateNode(nodeId, { text, prompt: text, outputText: undefined, mediaSystemNames: { [url]: file.name }, uploadProgress: undefined });
        void persistWorkflowUploadNodeAsset({ url, name: file.name, mediaType: "document", workflowId, workflowNodeId: nodeId, sourcePrompt: "上传文本", file }).catch((error) => console.warn("[media-assets] failed to persist workflow uploaded text", error));
        return nodeId;
      }
      onShowTip?.("上传节点只支持图片、视频、音频和 txt 文本");
    } catch (error) {
      onShowTip?.(`${file.name}：${toUserErrorMessage(error, "上传节点失败，请稍后重试。")}`);
    }
  }, [addUploadedNode, onShowTip, updateNode, workflowId]);

  const handleUploadNodeFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const nodeIds = (await Promise.all(files.map((file) => handleUploadNodeFile(file)))).filter((nodeId): nodeId is string => Boolean(nodeId));
    selectAndFocusUploadedNodes(nodeIds);
  }, [handleUploadNodeFile, selectAndFocusUploadedNodes]);

  const findExistingUploadNodeForFile = useCallback((file: File) => {
    const fileName = file.name;
    const extension = getWorkflowFileExtension(file);
    const expectedKind: WorkflowNodeKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") || ["mp3", "wav"].includes(extension) ? "audio" : "text";
    return stateRef.current.nodes.find((node) => {
      if (node.kind !== expectedKind) return false;
      return Object.values(node.data.mediaSystemNames ?? {}).some((name) => name === fileName);
    });
  }, []);

  const restoreWorkflowAssetToCanvas = useCallback((asset: WorkflowAssetSummary, pagePoint?: { x: number; y: number }, targetNodeId?: string, options?: { skipFocus?: boolean; allowDuplicate?: boolean }) => {
    const current = stateRef.current;
    const existingNode = options?.allowDuplicate ? undefined : current.nodes.find((node) => [...(node.data.images ?? []), ...(node.data.videoUrl ? [node.data.videoUrl] : [])].some((url) => normalizeWorkflowMediaUrl(url) === normalizeWorkflowMediaUrl(asset.url)));
    if (existingNode) {
      if (targetNodeId && !current.edges.some((edge) => edge.source === existingNode.id && edge.target === targetNodeId)) updateState((state) => ({ ...state, edges: [...state.edges, { id: createId("workflow_edge"), source: existingNode.id, target: targetNodeId }] }));
      return existingNode.id;
    }
    const kind: WorkflowNodeKind = asset.kind;
    const defaultData = getDefaultNodeData(kind);
    const isUpload = asset.origin === "upload";
    const uploadTitle = kind === "image" ? "上传图片" : "上传视频";
    const data: WorkflowNodeData = kind === "image"
      ? {
        ...defaultData,
        prompt: isUpload ? "上传图片" : asset.sourcePrompt ?? defaultData.prompt,
        model: isUpload ? undefined : asset.model,
        ratio: normalizeWorkflowImageRatio(asset.ratio, asset.dimensions),
        resolution: isUpload ? defaultData.resolution : asset.resolution ?? defaultData.resolution,
        images: [asset.url],
        imageDimensions: asset.dimensions ? { [asset.url]: asset.dimensions } : undefined,
        mediaSystemNames: { [asset.url]: asset.name },
        visualSize: undefined,
      }
      : {
        ...defaultData,
        prompt: isUpload ? "上传视频" : asset.sourcePrompt ?? defaultData.prompt,
        model: isUpload ? undefined : asset.model,
        ratio: asset.ratio ?? defaultData.ratio,
        resolution: isUpload ? defaultData.resolution : asset.resolution ?? defaultData.resolution,
        duration: isUpload ? defaultData.duration : asset.duration ?? defaultData.duration,
        videoUrl: asset.url,
        posterUrl: asset.posterUrl,
        videoDimensions: asset.dimensions,
        videoCurrentTime: 0,
        mediaSystemNames: { [asset.url]: asset.name },
        visualSize: undefined,
      };
    const draftNode: WorkflowNode = { id: createId("workflow_node"), kind, title: isUpload ? uploadTitle : getNodeLabel(kind), x: 0, y: 0, data };
    const size = getWorkflowNodeVisualSize(draftNode);
    const target = targetNodeId ? current.nodes.find((node) => node.id === targetNodeId) : undefined;
    const position = pagePoint
      ? { x: pagePoint.x - size.w / 2, y: pagePoint.y - size.h / 2 }
      : target ? findNonOverlappingNodePositionLeftOfTarget(current.nodes, size, target) : findNonOverlappingNodePosition(current.nodes, size, current.nodes[current.nodes.length - 1]);
    const node = { ...draftNode, x: position.x, y: position.y };
    recentActionNodeIdsRef.current = [node.id, ...recentActionNodeIdsRef.current].slice(0, 20);
    updateState((state) => ({ ...state, nodes: [...state.nodes, node], edges: targetNodeId ? [...state.edges, { id: createId("workflow_edge"), source: node.id, target: targetNodeId }] : state.edges }));
    if (!options?.skipFocus) {
      window.requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const shapeId = getShapeId(node.id);
        editor.select(shapeId);
        focusWorkflowNodeInViewport(editor, node);
      });
    }
    return node.id;
  }, [updateState]);

  const duplicateWorkflowNodeToCanvas = useCallback((sourceNode: WorkflowNode, pagePoint?: { x: number; y: number }) => {
    const current = stateRef.current;
    const size = getWorkflowNodeVisualSize(sourceNode);
    const position = pagePoint
      ? { x: pagePoint.x - size.w / 2, y: pagePoint.y - size.h / 2 }
      : findNonOverlappingNodePosition(current.nodes, size, sourceNode);
    const node: WorkflowNode = { ...sourceNode, id: createId("workflow_node"), x: position.x, y: position.y, data: { ...sourceNode.data } };
    recentActionNodeIdsRef.current = [node.id, ...recentActionNodeIdsRef.current].slice(0, 20);
    updateState((state) => ({ ...state, nodes: [...state.nodes, node] }));
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.select(getShapeId(node.id));
      focusWorkflowNodeInViewport(editor, node);
    });
    return node.id;
  }, [updateState]);

  const uploadFilesAsConnectedNodes = useCallback((targetNodeId: string, files: File[], onDuplicateTip?: (message: string) => void) => {
    if (files.length === 0) return;
    const run = async () => {
      const connectedNodeIds: string[] = [];
      for (const file of files) {
        const existingNode = findExistingUploadNodeForFile(file);
        if (existingNode) {
          (onDuplicateTip ?? onShowTip)?.(`${file.name} 已存在，已直接连接`);
          updateState((state) => state.edges.some((edge) => edge.source === existingNode.id && edge.target === targetNodeId) ? state : { ...state, edges: [...state.edges, { id: createId("workflow_edge"), source: existingNode.id, target: targetNodeId }] });
          connectedNodeIds.push(existingNode.id);
          continue;
        }
        const historicalAsset = workflowAssets.find((asset) => asset.name === file.name && (file.type.startsWith("image/") ? asset.kind === "image" : file.type.startsWith("video/") ? asset.kind === "video" : false));
        if (historicalAsset) {
          (onDuplicateTip ?? onShowTip)?.(`${file.name} 已在历史记录中，已恢复并连接`);
          const nodeId = restoreWorkflowAssetToCanvas(historicalAsset, undefined, targetNodeId);
          if (nodeId) connectedNodeIds.push(nodeId);
          continue;
        }
        const nodeId = await handleUploadNodeFile(file, targetNodeId, onDuplicateTip);
        if (nodeId) connectedNodeIds.push(nodeId);
      }
      // 输入框内上传：连线并显示在画布上，但保持选中"生成节点"（不选中上传的节点、不放大），
      // 这样输入框不会消失、提示也能正常弹在输入框上方。
      selectAndFocusUploadedNodes([targetNodeId], false);
    };
    void run();
  }, [findExistingUploadNodeForFile, handleUploadNodeFile, onShowTip, restoreWorkflowAssetToCanvas, selectAndFocusUploadedNodes, updateState, workflowAssets]);

  const restoreHistoricalTextNodeToCanvas = useCallback((historicalNode: WorkflowNode, pagePoint?: { x: number; y: number }) => {
    const current = stateRef.current;
    const size = getWorkflowNodeVisualSize(historicalNode);
    const position = pagePoint ? { x: pagePoint.x - size.w / 2, y: pagePoint.y - size.h / 2 } : findNonOverlappingNodePosition(current.nodes, size, current.nodes[current.nodes.length - 1]);
    const node = { ...historicalNode, id: createId("workflow_node"), x: position.x, y: position.y };
    updateState((state) => ({
      ...state,
      nodes: [...state.nodes, node],
      historicalTextNodes: (state.historicalTextNodes ?? []).filter((item) => item.id !== historicalNode.id),
    }));
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.select(getShapeId(node.id));
      focusWorkflowNodeInViewport(editor, node);
    });
  }, [updateState]);

  const deleteHistoricalTextNode = useCallback((historicalNode: WorkflowNode) => {
    updateState((state) => ({ ...state, historicalTextNodes: (state.historicalTextNodes ?? []).filter((item) => item.id !== historicalNode.id) }));
  }, [updateState]);

  const restoreHistoricalMediaNode = useCallback((historicalNode: WorkflowNode, pagePoint?: { x: number; y: number }) => {
    const current = stateRef.current;
    const size = getWorkflowNodeVisualSize(historicalNode);
    const position = pagePoint ? { x: pagePoint.x - size.w / 2, y: pagePoint.y - size.h / 2 } : findNonOverlappingNodePosition(current.nodes, size, current.nodes[current.nodes.length - 1]);
    const node = { ...historicalNode, id: createId("workflow_node"), x: position.x, y: position.y };
    updateState((state) => ({
      ...state,
      nodes: [...state.nodes, node],
      historicalMediaNodes: (state.historicalMediaNodes ?? []).filter((item) => item.id !== historicalNode.id),
    }));
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.select(getShapeId(node.id));
      focusWorkflowNodeInViewport(editor, node);
    });
  }, [updateState]);

  const deleteHistoricalMediaNode = useCallback((historicalNode: WorkflowNode) => {
    updateState((state) => ({ ...state, historicalMediaNodes: (state.historicalMediaNodes ?? []).filter((item) => item.id !== historicalNode.id) }));
  }, [updateState]);

  const deleteHistoricalWorkflowAsset = useCallback((asset: WorkflowAssetSummary) => {
    void fetch("/api/media-assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, url: asset.url, delete: true }),
    }).catch((error) => console.warn("[workflow] failed to move history asset to trash", error));
  }, []);

  const toggleWorkflowNodeLock = useCallback((nodeId: string) => {
    const shape = editorRef.current?.getShape(getShapeId(nodeId)) as WorkflowNodeShape | undefined;
    const nextLocked = !shape?.isLocked;
    updateNode(nodeId, { isLocked: nextLocked || undefined });
  }, [updateNode]);

  const toggleWorkflowNodeHidden = useCallback((nodeId: string) => {
    const editor = editorRef.current;
    const shapeId = getShapeId(nodeId);
    const shape = editor?.getShape(shapeId) as WorkflowNodeShape | undefined;
    if (shape?.isLocked) editor?.updateShape<WorkflowNodeShape>({ id: shapeId, type: "workflow_node", isLocked: false });
    const node = stateRef.current.nodes.find((item) => item.id === nodeId);
    const nextHidden = !node?.data.isHidden;
    if (nextHidden) editor?.deselect(shapeId);
    updateNode(nodeId, { isHidden: nextHidden || undefined });
  }, [updateNode]);

  const getWorkflowShapeVisibility = useCallback((shape: TLShape) => {
    if (shape.type !== "workflow_node") return "inherit";
    return (shape as WorkflowNodeShape).props.node.data.isHidden ? "hidden" : "inherit";
  }, []);

  const handleWorkflowAssetDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.closest(".workflow-layer-panel")) return;
    if (event.timeStamp - lastHandledDropStampRef.current < 200) return;
    lastHandledDropStampRef.current = event.timeStamp;
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.stopPropagation();
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) {
        onExternalFilesDrop?.(files);
        void handleUploadNodeFiles(files);
      }
      return;
    }
    const editor = editorRef.current;
    const getPagePoint = () => editor?.screenToPage({ x: event.clientX, y: event.clientY });
    const duplicateNodeId = event.dataTransfer.getData("application/x-flashmuse-workflow-node");
    if (duplicateNodeId) {
      const node = stateRef.current.nodes.find((item) => item.id === duplicateNodeId);
      if (!node) return;
      event.preventDefault();
      duplicateWorkflowNodeToCanvas(node, getPagePoint());
      return;
    }
    const historyMediaId = event.dataTransfer.getData("application/x-flashmuse-workflow-history-media");
    if (historyMediaId) {
      const node = (stateRef.current.historicalMediaNodes ?? []).find((item) => item.id === historyMediaId);
      if (!node) return;
      event.preventDefault();
      restoreHistoricalMediaNode(node, getPagePoint());
      return;
    }
    const historyTextId = event.dataTransfer.getData("application/x-flashmuse-workflow-history-text");
    if (historyTextId) {
      const node = (stateRef.current.historicalTextNodes ?? []).find((item) => item.id === historyTextId);
      if (!node) return;
      event.preventDefault();
      restoreHistoricalTextNodeToCanvas(node, getPagePoint());
      return;
    }
    const assetId = event.dataTransfer.getData("application/x-flashmuse-workflow-asset") || event.dataTransfer.getData("text/plain");
    if (!assetId) return;
    const asset = workflowAssets.find((item) => item.id === assetId);
    if (!asset) return;
    event.preventDefault();
    restoreWorkflowAssetToCanvas(asset, getPagePoint());
  }, [duplicateWorkflowNodeToCanvas, handleUploadNodeFiles, onExternalFilesDrop, restoreHistoricalMediaNode, restoreHistoricalTextNodeToCanvas, restoreWorkflowAssetToCanvas, workflowAssets]);

  const handleWorkflowContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    closeWorkflowPopups();
    const target = event.target as HTMLElement | null;
    const nodeElement = target?.closest<HTMLElement>("[data-workflow-node-id]");
    const nodeId = nodeElement?.dataset.workflowNodeId;
    const isBlankCanvas = !nodeId;
    if (nodeId && stateRef.current.nodes.some((node) => node.id === nodeId)) {
      const shapeId = getShapeId(nodeId);
      if (!editor.getSelectedShapeIds().includes(shapeId)) editor.select(shapeId);
      markNodeAction(nodeId);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 520;
    const pagePoint = editor.screenToPage({ x: event.clientX, y: event.clientY });
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - menuMaxHeight - 8)),
      pagePoint,
      isBlankCanvas,
    });
  }, [markNodeAction]);

  const handleWorkflowPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!contextMenu || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-workflow-context-menu]")) return;
    setContextMenu(null);
  }, [contextMenu]);

  const reorderWorkflowNodeLayer = useCallback((dragNodeId: string, targetNodeId: string, position: "before" | "after") => {
    if (!dragNodeId || !targetNodeId || dragNodeId === targetNodeId) return;
    const editor = editorRef.current;
    if (!editor) return;
    const currentTopToBottom = editor.getCurrentPageShapesSorted().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node.id).reverse();
    const dragIndex = currentTopToBottom.indexOf(dragNodeId);
    if (dragIndex < 0 || !currentTopToBottom.includes(targetNodeId)) return;
    const nextTopToBottom = currentTopToBottom.filter((id) => id !== dragNodeId);
    const targetIndex = nextTopToBottom.indexOf(targetNodeId);
    if (targetIndex < 0) return;
    nextTopToBottom.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, dragNodeId);
    editor.markHistoryStoppingPoint("reorder workflow layers");
    [...nextTopToBottom].reverse().forEach((nodeId) => {
      const shape = editor.getShape(getShapeId(nodeId));
      if (shape) editor.bringToFront([shape.id]);
    });
    scheduleEmit();
  }, [scheduleEmit]);

  const deleteNode = useCallback((nodeId: string) => {
    recentActionNodeIdsRef.current = recentActionNodeIdsRef.current.filter((id) => id !== nodeId);
    updateState((current) => {
      const deletedNodes = current.nodes.filter((node) => node.id === nodeId);
      const withHistory = addHistoricalNodes(current, deletedNodes);
      const removedEdges = withHistory.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
      const cleanedNodes = removeConnectedReferenceNames(withHistory.nodes, removedEdges);
      return { ...withHistory, nodes: cleanedNodes.filter((node) => node.id !== nodeId), edges: withHistory.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) };
    });
    if (connectingFrom === nodeId) setConnectingFrom("");
  }, [connectingFrom, updateState]);

  const disconnectNodes = useCallback((sourceNodeId: string, targetNodeId: string) => {
    updateState((current) => ({ ...current, nodes: removeConnectedReferenceNames(current.nodes, [{ source: sourceNodeId, target: targetNodeId }]), edges: current.edges.filter((edge) => !(edge.source === sourceNodeId && edge.target === targetNodeId)) }));
  }, [updateState]);

  const setCanvasTool = useCallback((tool: "select" | "hand") => {
    activeCanvasToolRef.current = tool;
    setActiveCanvasToolState(tool);
    editorRef.current?.setCurrentTool(tool === "hand" ? "hand" : "select");
  }, []);

  useEffect(() => {
    const deleteSelectedNodes = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const editor = editorRef.current;
      if (!editor) return;
      const selectedNodeIds = editor.getSelectedShapeIds().map((id) => getNodeIdFromShapeId(String(id))).filter((nodeId) => stateRef.current.nodes.some((node) => node.id === nodeId));
      if (selectedNodeIds.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const deleting = new Set(selectedNodeIds);
      updateState((current) => {
        const deletedNodes = current.nodes.filter((node) => deleting.has(node.id));
        const withHistory = addHistoricalNodes(current, deletedNodes);
        const removedEdges = withHistory.edges.filter((edge) => deleting.has(edge.source) || deleting.has(edge.target));
        const cleanedNodes = removeConnectedReferenceNames(withHistory.nodes, removedEdges);
        return { ...withHistory, nodes: cleanedNodes.filter((node) => !deleting.has(node.id)), edges: withHistory.edges.filter((edge) => !deleting.has(edge.source) && !deleting.has(edge.target)) };
      });
      if (selectedNodeIds.includes(connectingFrom)) setConnectingFrom("");
    };
    window.addEventListener("keydown", deleteSelectedNodes, true);
    return () => window.removeEventListener("keydown", deleteSelectedNodes, true);
  }, [connectingFrom, updateState]);

  useEffect(() => {
    const handleToolShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (event.isComposing) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        editorRef.current?.zoomIn();
        setContextMenu(null);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        editorRef.current?.zoomOut();
        setContextMenu(null);
        return;
      }
      if (event.shiftKey && event.key === "1") {
        const editor = editorRef.current;
        if (!editor) return;
        event.preventDefault();
        const workflowNodes = editor.getCurrentPageShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node);
        zoomToWorkflowNodes(editor, workflowNodes);
        setContextMenu(null);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && (key === "t" || key === "i" || key === "d")) {
        event.preventDefault();
        addNode(key === "t" ? "text" : key === "i" ? "image" : "video");
        setContextMenu(null);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && key === "v") {
        setCanvasTool("select");
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && key === "h") {
        setCanvasTool("hand");
      }
    };
    window.addEventListener("keydown", handleToolShortcut, true);
    return () => window.removeEventListener("keydown", handleToolShortcut, true);
  }, [addNode, setCanvasTool]);

  const connectTo = useCallback((targetId: string) => {
    if (!connectingFrom) return;
    const current = stateRef.current;
    const source = current.nodes.find((node) => node.id === connectingFrom);
    const target = current.nodes.find((node) => node.id === targetId);
    const error = getWorkflowConnectionError(source, target, current.edges) || (source && target ? validateWorkflowConnectionTextLimit(source, target, current) || validateWorkflowConnectionUploadRules(source, target, current, uploadRuleOverrides) : undefined);
    if (error) {
      onShowTip?.(error);
      return;
    }
    updateState((state) => ({ ...state, edges: [...state.edges, { id: createId("workflow_edge"), source: connectingFrom, target: targetId }] }));
    setConnectingFrom("");
    setConnectionPointer(undefined);
  }, [connectingFrom, onShowTip, updateState, uploadRuleOverrides]);

  const beginConnectionDrag = useCallback((nodeId: string, event: ReactPointerEvent) => {
    const current = stateRef.current;
    const source = current.nodes.find((node) => node.id === nodeId);
    if (!source || !canWorkflowNodeOutput(source)) return;
    event.preventDefault();
    event.stopPropagation();
    setConnectingFrom(nodeId);
    setConnectionPointer({ x: event.clientX, y: event.clientY });
    const handlePointerMove = (moveEvent: PointerEvent) => setConnectionPointer({ x: moveEvent.clientX, y: moveEvent.clientY });
    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      const targetElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
      const targetNodeId = targetElement?.closest<HTMLElement>("[data-workflow-node-id]")?.dataset.workflowNodeId;
      setConnectionPointer(undefined);
      if (targetNodeId) {
        const latest = stateRef.current;
        const latestSource = latest.nodes.find((node) => node.id === nodeId);
        const latestTarget = latest.nodes.find((node) => node.id === targetNodeId);
        const error = getWorkflowConnectionError(latestSource, latestTarget, latest.edges) || (latestSource && latestTarget ? validateWorkflowConnectionTextLimit(latestSource, latestTarget, latest) || validateWorkflowConnectionUploadRules(latestSource, latestTarget, latest, uploadRuleOverrides) : undefined);
        if (error) onShowTip?.(error);
        else updateState((state) => ({ ...state, edges: [...state.edges, { id: createId("workflow_edge"), source: nodeId, target: targetNodeId }] }));
      }
      setConnectingFrom("");
    };
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
  }, [onShowTip, updateState, uploadRuleOverrides]);

  const beginInputConnectionDrag = useCallback((nodeId: string, event: ReactPointerEvent) => {
    const current = stateRef.current;
    const target = current.nodes.find((node) => node.id === nodeId);
    if (!target || !canWorkflowNodeInput(target)) return;
    event.preventDefault();
    event.stopPropagation();
    setConnectingTo(nodeId);
    setConnectionPointer({ x: event.clientX, y: event.clientY });
    const handlePointerMove = (moveEvent: PointerEvent) => setConnectionPointer({ x: moveEvent.clientX, y: moveEvent.clientY });
    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      const sourceElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
      const sourceNodeId = sourceElement?.closest<HTMLElement>("[data-workflow-node-id]")?.dataset.workflowNodeId;
      setConnectionPointer(undefined);
      if (sourceNodeId) {
        const latest = stateRef.current;
        const latestSource = latest.nodes.find((node) => node.id === sourceNodeId);
        const latestTarget = latest.nodes.find((node) => node.id === nodeId);
        const error = getWorkflowConnectionError(latestSource, latestTarget, latest.edges) || (latestSource && latestTarget ? validateWorkflowConnectionTextLimit(latestSource, latestTarget, latest) || validateWorkflowConnectionUploadRules(latestSource, latestTarget, latest, uploadRuleOverrides) : undefined);
        if (error) onShowTip?.(error);
        else updateState((state) => ({ ...state, edges: [...state.edges, { id: createId("workflow_edge"), source: sourceNodeId, target: nodeId }] }));
      }
      setConnectingTo("");
      setConnectingFrom("");
    };
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
  }, [onShowTip, updateState, uploadRuleOverrides]);

  const showMultiConnectTips = useCallback((messages: string[]) => {
    messages.forEach((message) => onShowTip?.(message));
  }, [onShowTip]);

  const connectMultipleSourcesToTarget = useCallback((sourceIds: string[], targetId: string) => {
    const current = stateRef.current;
    const target = current.nodes.find((node) => node.id === targetId);
    if (!target) return;
    if (!canWorkflowNodeInput(target)) {
      onShowTip?.("目标节点不是可输入的空图片/视频节点");
      return;
    }
    // Layer 1: keep only selected nodes that actually have output content (drop empty generation nodes).
    const outputSources = sourceIds
      .filter((id) => id !== targetId)
      .map((id) => current.nodes.find((node) => node.id === id))
      .filter((node): node is WorkflowNode => Boolean(node) && canWorkflowNodeOutput(node as WorkflowNode));
    if (outputSources.length === 0) {
      onShowTip?.("选中的节点没有可连接的内容");
      return;
    }
    // Shuffle media sources so that when the target count limit is reached, the discarded ones are random.
    const shuffled = [...outputSources];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const workingEdges = [...current.edges];
    const newEdges: WorkflowEdge[] = [];
    let typeRejected = false;
    let countRejected = false;
    for (const source of shuffled) {
      const stateForCheck = { ...current, edges: workingEdges };
      const baseError = getWorkflowConnectionError(source, target, workingEdges);
      if (baseError) {
        if (baseError.includes("类型")) typeRejected = true;
        // duplicate / cycle / self are silently skipped
        continue;
      }
      const textError = validateWorkflowConnectionTextLimit(source, target, stateForCheck);
      if (textError) {
        countRejected = true;
        continue;
      }
      const uploadError = validateWorkflowConnectionUploadRules(source, target, stateForCheck, uploadRuleOverrides);
      if (uploadError) {
        if (uploadError.includes("不支持")) typeRejected = true;
        else countRejected = true;
        continue;
      }
      const edge = { id: createId("workflow_edge"), source: source.id, target: targetId };
      workingEdges.push(edge);
      newEdges.push(edge);
    }
    if (newEdges.length > 0) updateState((state) => ({ ...state, edges: [...state.edges, ...newEdges] }));
    const messages: string[] = [];
    if (typeRejected) messages.push("部分节点类型不被目标支持，已跳过");
    if (countRejected) messages.push("超出目标可接收的数量，已随机舍弃多余的连接");
    if (newEdges.length === 0 && messages.length === 0) messages.push("没有可连接到该节点的选中节点");
    showMultiConnectTips(messages);
  }, [onShowTip, showMultiConnectTips, updateState, uploadRuleOverrides]);

  const beginMultiConnectionDrag = useCallback((sourceIds: string[], event: ReactPointerEvent) => {
    const current = stateRef.current;
    const outputSources = sourceIds.filter((id) => {
      const node = current.nodes.find((item) => item.id === id);
      return node ? canWorkflowNodeOutput(node) : false;
    });
    if (outputSources.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    setMultiConnectSources(outputSources);
    setConnectionPointer({ x: event.clientX, y: event.clientY });
    const handlePointerMove = (moveEvent: PointerEvent) => setConnectionPointer({ x: moveEvent.clientX, y: moveEvent.clientY });
    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      const targetElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
      const targetNodeId = targetElement?.closest<HTMLElement>("[data-workflow-node-id]")?.dataset.workflowNodeId;
      setConnectionPointer(undefined);
      if (targetNodeId) connectMultipleSourcesToTarget(outputSources, targetNodeId);
      setMultiConnectSources([]);
    };
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
  }, [connectMultipleSourcesToTarget]);


  const getIncomingNodes = useCallback((nodeId: string) => stateRef.current.edges.filter((edge) => edge.target === nodeId).map((edge) => stateRef.current.nodes.find((node) => node.id === edge.source)).filter(Boolean) as WorkflowNode[], []);
  const getConnectedInputUploads = useCallback((nodeId: string) => getWorkflowConnectedInputUploads(stateRef.current, nodeId), []);
  const getInputText = useCallback((nodeId: string) => getIncomingNodes(nodeId).map(getWorkflowTextNodeOutput).filter(Boolean).join("\n\n"), [getIncomingNodes]);
  const getInputTextLength = useCallback((nodeId: string) => Array.from(getInputText(nodeId)).length, [getInputText]);
  const getReferenceImages = useCallback((nodeId: string) => {
    const urls: string[] = [];
    for (const source of getIncomingNodes(nodeId)) for (const url of source.data.images ?? []) if (url && !urls.includes(url)) urls.push(url);
    return urls;
  }, [getIncomingNodes]);
  // Resolve the display names for reference-image URLs (connected node names, asset-library names, or
  // uploaded-card names), matching how they appear as @mentions in the prompt. Used to classify each
  // reference as absolute vs "参考" (loose) when building the reference hint.
  const getReferenceImageNames = useCallback((node: WorkflowNode, urls: string[]) => {
    const nameByUrl = new Map<string, string>();
    for (const source of getIncomingNodes(node.id)) for (const url of source.data.images ?? []) if (url && source.data.mediaSystemNames?.[url]) nameByUrl.set(url, source.data.mediaSystemNames[url]);
    for (const asset of referenceAssets) if (asset.url && asset.name) nameByUrl.set(asset.url, asset.name);
    for (const upload of node.data.uploads ?? []) if (upload.url && upload.kind === "image") nameByUrl.set(upload.url, getWorkflowUploadReferenceName(upload));
    return urls.map((url) => nameByUrl.get(url));
  }, [getIncomingNodes, referenceAssets]);
  const getReferenceMediaUrls = useCallback((nodeId: string, kind: "video" | "audio") => {
    const urls: string[] = [];
    for (const source of getIncomingNodes(nodeId)) {
      const url = kind === "video" ? source.data.videoUrl : source.data.audioUrl;
      if (url && !urls.includes(url)) urls.push(url);
    }
    return urls;
  }, [getIncomingNodes]);

  const getPromptReferenceUrls = useCallback((prompt: string, node: WorkflowNode, kind: "image" | "video" | "audio") => getWorkflowPromptReferenceUrls(prompt, node, referenceAssets, kind), [referenceAssets]);

  const getEnabledImageModel = useCallback((model?: ModelName) => (model && imageModels.some((item) => item.id === model) ? model : (imageModels[0]?.id as ModelName | undefined) ?? DEFAULT_IMAGE_MODEL), [imageModels]);
  const getEnabledVideoModel = useCallback((model?: ModelName) => (model && videoModels.some((item) => item.id === model) ? model : (videoModels[0]?.id as ModelName | undefined) ?? DEFAULT_VIDEO_MODEL), [videoModels]);

  const applyImageNodeResult = useCallback((node: WorkflowNode, input: { prompt: string; model: ModelName; settings: { ratio: string; resolution: string }; promptOptimization?: { originalPrompt: string; optimizedPrompt: string; attemptsUsed: number; optimizerModel: string } }, images: string[], imageDimensions: Record<string, { width: number; height: number }> | undefined, credit: CreditResult | undefined, usage: UsageMeta | undefined, reservedNames?: string[]) => {
    const generationUploads = getWorkflowGenerationUploadSnapshot(stateRef.current, node);
    updateNode(node.id, {
      images,
      imageDimensions,
      prompt: input.prompt,
      generationUploads: generationUploads.length > 0 ? generationUploads : undefined,
      visualSize: undefined,
      isRunning: false,
      error: undefined,
      imageRequestId: undefined,
      startedAt: undefined,
      mediaSystemNames: { ...(node.data.mediaSystemNames ?? {}), ...Object.fromEntries(images.map((url, index) => [url, reservedNames?.[index]]).filter((item): item is [string, string] => Boolean(item[1]))) },
      ...(input.promptOptimization ? {
        gptImageOptimizationOriginalPrompt: input.promptOptimization.originalPrompt,
        gptImageOptimizationSuccessfulPrompt: input.promptOptimization.optimizedPrompt,
        gptImageOptimizationAttemptsUsed: input.promptOptimization.attemptsUsed,
        gptImageOptimizationOptimizerModel: input.promptOptimization.optimizerModel,
        gptImageOptimizationAttemptPrompts: undefined,
      } : {}),
    });
    updateState((state) => ({ ...state, edges: state.edges.filter((edge) => edge.target !== node.id) }));
    onGeneratedMedia?.({ nodeId: node.id, kind: "image", urls: images, reservedNames, sourcePrompt: input.prompt, model: input.model, ratio: input.settings.ratio, resolution: input.settings.resolution, dimensions: imageDimensions, promptOptimization: input.promptOptimization });
    onCredit?.({ ...credit, usage });
  }, [onCredit, onGeneratedMedia, updateNode, updateState]);

  // Poll a durable backend image job to completion. The backend worker generates/charges/saves regardless
  // of the browser; here we only READ status and reflect it. No timeout: we wait as long as it takes, and
  // only an explicit backend failure (job.status === "failed") surfaces a failed card.
  const pollImageNode = useCallback(async (node: WorkflowNode, requestId: string, input: { prompt: string; model: ModelName; settings: { ratio: string; resolution: string }; promptOptimization?: { originalPrompt: string; optimizedPrompt: string; attemptsUsed: number; optimizerModel: string } }): Promise<{ images: string[]; imageDimensions?: Record<string, { width: number; height: number }> } | undefined> => {
    while (true) {
      await new Promise((resolve) => window.setTimeout(resolve, imagePollIntervalMs));
      if (!pollMountedRef.current || loadedWorkflowIdRef.current !== workflowId) return undefined;
      let job: WorkflowImageJobStatus | undefined;
      try {
        const statusResponse = await fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestIds: [requestId] }) });
        const statusData = await readJson<{ jobs?: WorkflowImageJobStatus[] }>(statusResponse);
        job = statusData.jobs?.find((item) => item.requestId === requestId);
      } catch {
        continue;
      }
      if (!job) continue;
      if (job.status === "failed") throw new Error(getWorkflowApiErrorMessage({ error: job.error, errorCode: job.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE));
      if (job.status === "succeeded") {
        const images = Array.isArray(job.resultUrls) ? job.resultUrls.filter(Boolean) : [];
        if (images.length === 0) throw new Error("图片平台没有返回图片，且没有返回可用原因。");
        applyImageNodeResult(node, input, images, job.resultDimensions, job.credit, job.usage, job.reservedNames);
        return { images, imageDimensions: job.resultDimensions };
      }
      // queued / running: keep waiting card, ensure node stays in running state.
    }
  }, [applyImageNodeResult, workflowId]);

  const generateImageForNode = useCallback(async (node: WorkflowNode, input: { prompt: string; model: ModelName; settings: { ratio: string; resolution: string }; referenceImages: string[]; promptOptimization?: { originalPrompt: string; optimizedPrompt: string; attemptsUsed: number; optimizerModel: string } }) => {
    const modelPrompt = appendWorkflowReferenceHint(input.prompt, getReferenceImageNames(node, input.referenceImages));
    const requestId = createId("workflow_image");
    updateNode(node.id, { isRunning: true, error: undefined, images: [], visualSize: undefined, startedAt: Date.now(), imageRequestId: requestId });
    const submit = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: modelPrompt, model: input.model, settings: input.settings, referenceImages: input.referenceImages, count: 1, conversationId: workflowId, conversationTitle: workflowTitle, requestId, async: true, workflowId, workflowNodeId: node.id, flow: "workflow", metadata: { creditSource: "workflow_image_generation" } }) }).then((response) => readJson<{ jobId?: string; error?: string; errorCode?: string }>(response));
    if (!submit.jobId) throw new Error(getWorkflowApiErrorMessage({ error: submit.error, errorCode: submit.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE));
    return pollImageNode(node, requestId, input);
  }, [getReferenceImageNames, pollImageNode, updateNode, workflowId, workflowTitle]);

  const runImageNode = useCallback(async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() ?? "";
    const prompt = [ownPrompt, upstreamPrompt].filter(Boolean).join("\n\n").trim();
    if (Array.from(prompt).length > MAX_WORKFLOW_PROMPT_LENGTH) return updateNode(node.id, { error: `提示词超过 ${MAX_WORKFLOW_PROMPT_LENGTH} 字，请缩短输入框或连接的文本节点内容。` });
    if (!prompt) return updateNode(node.id, { error: "请先输入提示词，或连接一个文本节点。" });
    const model = getEnabledImageModel(node.data.model);
    const connectedUploads = getWorkflowConnectedInputUploads(stateRef.current, node.id);
    const uploadError = validateWorkflowUploadsForSubmit({ ...node, data: { ...node.data, model, uploads: mergeWorkflowUploadItems([...(node.data.uploads ?? []), ...connectedUploads]) } }, uploadRuleOverrides);
    if (uploadError) {
      onShowTip?.(uploadError);
      return updateNode(node.id, { error: uploadError });
    }
    const imageRatio = imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio ?? "16:9" : "16:9";
    const settings = { ratio: imageRatio, resolution: node.data.resolution ?? normalizeImageResolutionForModel(model, getSupportedImageResolutions(model)[0]) };
    updateNode(node.id, { isRunning: true, error: undefined, images: [], visualSize: undefined, startedAt: Date.now() });
    try {
      const referenceImages = [...getReferenceImages(node.id), ...getPromptReferenceUrls(prompt, node, "image")].filter((url, index, array) => array.indexOf(url) === index);
      await generateImageForNode(node, { prompt, model, settings, referenceImages });
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), imageRequestId: undefined });
    }
  }, [generateImageForNode, getEnabledImageModel, getInputText, getPromptReferenceUrls, getReferenceImages, onShowTip, updateNode, uploadRuleOverrides]);

  const runGptImageOptimizationRetry = useCallback(async (node: WorkflowNode, maxAttempts: number) => {
    if (!isWorkflowGptImageSafetyFailure(node)) return;
    if (optimizingImageNodesRef.current.has(node.id)) return;
    const upstreamPrompt = getInputText(node.id);
    const originalOwnPrompt = node.data.gptImageOptimizationOriginalPrompt?.trim() || node.data.prompt?.trim() || "";
    if (!originalOwnPrompt) return updateNode(node.id, { error: "缺少原提示词，无法进行安全改写。" });
    const originalPromptWithContext = [originalOwnPrompt, upstreamPrompt].filter(Boolean).join("\n\n").trim();
    if (Array.from(originalPromptWithContext).length > MAX_WORKFLOW_PROMPT_LENGTH) return updateNode(node.id, { error: `提示词超过 ${MAX_WORKFLOW_PROMPT_LENGTH} 字，请缩短输入框或连接的文本节点内容。` });
    const model = getEnabledImageModel(node.data.model);
    const imageRatio = imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio ?? "16:9" : "16:9";
    const settings = { ratio: imageRatio, resolution: node.data.resolution ?? normalizeImageResolutionForModel(model, getSupportedImageResolutions(model)[0]) };
    const connectedUploads = getWorkflowConnectedInputUploads(stateRef.current, node.id);
    const uploadError = validateWorkflowUploadsForSubmit({ ...node, data: { ...node.data, model, prompt: originalOwnPrompt, uploads: mergeWorkflowUploadItems([...(node.data.uploads ?? []), ...connectedUploads]) } }, uploadRuleOverrides);
    if (uploadError) return updateNode(node.id, { error: uploadError });

    let attemptedPrompts = [...(node.data.gptImageOptimizationAttemptPrompts ?? []), originalOwnPrompt].filter(Boolean);
    const seenPrompts = new Set(attemptedPrompts.map(normalizeWorkflowAttemptPrompt));
    const originalPromptKey = normalizeWorkflowAttemptPrompt(originalOwnPrompt);
    const previousImageAttempts = new Set(attemptedPrompts.map(normalizeWorkflowAttemptPrompt).filter((prompt) => prompt && prompt !== originalPromptKey)).size;
    let lastError = node.data.error ?? "";
    optimizingImageNodesRef.current.add(node.id);
    updateNode(node.id, { isRunning: true, error: undefined, images: [], visualSize: undefined, startedAt: Date.now(), gptImageOptimizationOriginalPrompt: originalOwnPrompt });

    try {
      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let optimizedPrompt = "";
        let optimizerModel = "local-fallback";
        try {
          const rewriteData = await fetch("/api/workflow-prompt-optimization/rewrite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ originalPrompt: originalOwnPrompt, failureReason: lastError, previousPrompts: attemptedPrompts, attemptIndex: attempt, maxAttempts, workflowId, workflowTitle, workflowNodeId: node.id, requestId: createId("workflow_prompt_opt") }),
          }).then((response) => readJson<{ optimizedPrompt?: string; optimizerModel?: string; credit?: CreditResult }>(response));
          onCredit?.(rewriteData.credit);
          const aiPrompt = rewriteData.optimizedPrompt?.trim() ?? "";
          if (aiPrompt && !seenPrompts.has(normalizeWorkflowAttemptPrompt(aiPrompt))) {
            optimizedPrompt = aiPrompt;
            optimizerModel = rewriteData.optimizerModel ?? "unknown";
          }
        } catch (error) {
          lastError = toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE);
        }

        if (!optimizedPrompt) {
          optimizedPrompt = getWorkflowFallbackSafetyPrompt(originalOwnPrompt, attempt, seenPrompts);
          optimizerModel = "local-fallback";
        }

        if (!optimizedPrompt) {
          lastError = "没有找到不重复的安全改写提示词，请手动调整提示词后再试。";
          updateNode(node.id, { gptImageOptimizationAttemptPrompts: attemptedPrompts });
          continue;
        }

        const normalized = normalizeWorkflowAttemptPrompt(optimizedPrompt);
        seenPrompts.add(normalized);
        attemptedPrompts = [...attemptedPrompts, optimizedPrompt];
        updateNode(node.id, { gptImageOptimizationAttemptPrompts: attemptedPrompts });

        try {
          const prompt = [optimizedPrompt, upstreamPrompt].filter(Boolean).join("\n\n").trim();
          const referenceImages = [...getReferenceImages(node.id), ...getPromptReferenceUrls(prompt, { ...node, data: { ...node.data, prompt: optimizedPrompt } }, "image")].filter((url, index, array) => array.indexOf(url) === index);
          await generateImageForNode(node, { prompt, model, settings, referenceImages, promptOptimization: { originalPrompt: originalOwnPrompt, optimizedPrompt, attemptsUsed: previousImageAttempts + attempt, optimizerModel } });
          return;
        } catch (error) {
          lastError = toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE);
          updateNode(node.id, { gptImageOptimizationAttemptPrompts: attemptedPrompts });
        }
      }
      } catch (error) {
        lastError = toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE);
      }
      updateNode(node.id, { isRunning: false, error: lastError || "AI 改写重试仍未成功，请调整提示词后再试。", gptImageOptimizationAttemptPrompts: attemptedPrompts, gptImageOptimizationOriginalPrompt: originalOwnPrompt, imageRequestId: undefined });
    } finally {
      optimizingImageNodesRef.current.delete(node.id);
    }
  }, [generateImageForNode, getEnabledImageModel, getInputText, getPromptReferenceUrls, getReferenceImages, onCredit, updateNode, uploadRuleOverrides, workflowId, workflowTitle]);

  const pollVideoNode = useCallback(async (node: WorkflowNode, taskId: string, prompt: string, model: ModelName, settings: { ratio?: string; resolution?: string; duration?: string }, requestId: string, initialUsage?: UsageMeta) => {
    let usage = initialUsage;
    let attempt = 0;
    while (true) {
      await new Promise((resolve) => window.setTimeout(resolve, videoPollIntervalMs));
      if (!pollMountedRef.current || loadedWorkflowIdRef.current !== workflowId) return;
      attempt += 1;
      let pollData: VideoApiResponse;
      let pollResponse: Response;
      try {
        pollResponse = await fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestIds: [requestId] }) });
      } catch (error) {
        updateNode(node.id, { isRunning: true, error: undefined, taskId });
        continue;
      }
      if (!pollResponse.ok && isTransientWorkflowVideoPollStatus(pollResponse.status)) {
        updateNode(node.id, { isRunning: true, error: undefined, taskId });
        continue;
      }
      const statusData = await readJson<{ jobs?: Array<{ status?: string; resultUrls?: string[]; reservedNames?: string[]; posterUrl?: string; error?: string; errorCode?: string; usage?: UsageMeta; credit?: CreditResult }> }>(pollResponse);
      const job = statusData.jobs?.[0];
      pollData = job ? { status: job.status, content: { video_url: job.resultUrls?.[0], poster_url: job.posterUrl }, error: job.error, errorCode: job.errorCode, usage: job.usage, credit: job.credit } as VideoApiResponse : { status: "running" } as VideoApiResponse;
      usage = pollData.usage ?? usage;
      const pollError = getWorkflowApiErrorMessage({ error: pollData.error, errorCode: pollData.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE);
      if (pollData.status === "failed" || pollData.error) throw new Error(pollError);
      const videoUrl = getVideoUrlFromResponse(pollData);
      if (isVideoDoneStatus(pollData.status) && videoUrl) {
        const posterUrl = getPosterUrlFromResponse(pollData);
        const chargedUsage = pollData.usage ?? usage;
        const generationUploads = getWorkflowGenerationUploadSnapshot(stateRef.current, node);
        updateNode(node.id, { prompt, videoUrl, posterUrl, videoCurrentTime: 0, generationUploads: generationUploads.length > 0 ? generationUploads : undefined, visualSize: undefined, isRunning: false, error: undefined, taskId: undefined, videoRequestId: undefined, mediaSystemNames: job?.reservedNames?.[0] ? { ...(node.data.mediaSystemNames ?? {}), [videoUrl]: job.reservedNames[0] } : node.data.mediaSystemNames });
        updateState((state) => ({ ...state, edges: state.edges.filter((edge) => edge.target !== node.id) }));
        onGeneratedMedia?.({ nodeId: node.id, kind: "video", urls: [videoUrl], reservedNames: job?.reservedNames, posterUrl, sourcePrompt: prompt, model, ratio: settings.ratio, resolution: settings.resolution, duration: settings.duration });
        onCredit?.({ ...pollData.credit, usage: chargedUsage });
        return;
      }
      // No timeout: backend worker owns the provider polling and only explicit provider failure fails.
      if (attempt >= videoMaxPollAttempts) updateNode(node.id, { isRunning: true, error: undefined, taskId });
    }
  }, [onCredit, onGeneratedMedia, updateNode, updateState, workflowId, workflowTitle]);

  const runVideoNode = useCallback(async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() ?? "";
    const prompt = [ownPrompt, upstreamPrompt].filter(Boolean).join("\n\n").trim();
    if (Array.from(prompt).length > MAX_WORKFLOW_PROMPT_LENGTH) return updateNode(node.id, { error: `提示词超过 ${MAX_WORKFLOW_PROMPT_LENGTH} 字，请缩短输入框或连接的文本节点内容。` });
    if (!prompt) return updateNode(node.id, { error: "请先输入视频提示词，或连接一个文本/图片节点。" });
    const model = getEnabledVideoModel(node.data.model);
    const videoReferenceMode = isWorkflowBytePlusSeedanceVideoModel(model) ? node.data.videoReferenceMode ?? "reference" : getWorkflowUploadRuleVideoReferenceMode(prompt);
    const connectedUploads = getWorkflowConnectedInputUploads(stateRef.current, node.id);
    const uploadError = validateWorkflowUploadsForSubmit({ ...node, data: { ...node.data, model, uploads: mergeWorkflowUploadItems([...(node.data.uploads ?? []), ...connectedUploads]) } }, uploadRuleOverrides, videoReferenceMode);
    if (uploadError) {
      onShowTip?.(uploadError);
      return updateNode(node.id, { error: uploadError });
    }
    const resolution = normalizeVideoResolutionForModel(model, node.data.resolution);
    const settings = { ratio: normalizeVideoRatioForModel(model, node.data.ratio, resolution), resolution, duration: node.data.duration ?? workflowVideoModels.find((item) => item.id === model)?.durations?.[0] ?? "5秒" };
    const requestId = createId("workflow_video");
    updateNode(node.id, { isRunning: true, error: undefined, videoUrl: undefined, posterUrl: undefined, videoCurrentTime: undefined, visualSize: undefined, startedAt: Date.now(), videoRequestId: requestId });
    try {
      const allReferenceImages = [...getReferenceImages(node.id), ...getPromptReferenceUrls(prompt, node, "image")].filter((url, index, array) => array.indexOf(url) === index);
      const referenceImages = isWorkflowBytePlusSeedanceVideoModel(model) ? getWorkflowEffectiveBytePlusVideoReferenceItems(allReferenceImages, videoReferenceMode) : allReferenceImages;
      const referenceVideos = [...getReferenceMediaUrls(node.id, "video"), ...getPromptReferenceUrls(prompt, node, "video")].filter((url, index, array) => array.indexOf(url) === index);
      const referenceAudios = [...getReferenceMediaUrls(node.id, "audio"), ...getPromptReferenceUrls(prompt, node, "audio")].filter((url, index, array) => array.indexOf(url) === index);
      if (referenceImages.length < allReferenceImages.length) onShowTip?.(getWorkflowBytePlusVideoReferenceLimitHint(videoReferenceMode));
      if (isWorkflowBytePlusSeedanceVideoModel(model) && videoReferenceMode === "first_frame" && referenceImages.length < 1) throw new Error("首帧生视频需要至少一张参考图");
      if (isWorkflowBytePlusSeedanceVideoModel(model) && videoReferenceMode === "first_last_frame" && referenceImages.length < 2) throw new Error("首尾帧生视频需要至少两张参考图");
      if (referenceAudios.length > 0 && referenceImages.length === 0 && referenceVideos.length === 0) throw new Error("上传音频需要同时提供参考图片或参考视频");
      const modelPrompt = appendWorkflowReferenceHint(prompt, getReferenceImageNames(node, referenceImages));
      const referenceImageNameByUrl = new Map<string, string>();
      for (const source of getIncomingNodes(node.id)) for (const url of source.data.images ?? []) if (url && source.data.mediaSystemNames?.[url]) referenceImageNameByUrl.set(url, source.data.mediaSystemNames[url]);
      for (const asset of referenceAssets) if (asset.url && asset.name) referenceImageNameByUrl.set(asset.url, asset.name);
      const referenceImageNames = referenceImages.map((url) => referenceImageNameByUrl.get(url) ?? "");
      const createVideoTask = (autoBytePlusAssetReview = false) => fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: modelPrompt, sourcePrompt: prompt, model, settings, referenceImages, referenceImageNames, referenceVideos, referenceAudios, referenceMode: videoReferenceMode, conversationId: workflowId, conversationTitle: workflowTitle, requestId, flow: "workflow", workflowId, workflowNodeId: node.id, metadata: { creditSource: "workflow_video_generation" }, autoBytePlusAssetReview }) }).then((response) => readJson<VideoApiResponse>(response));
      let createData = await createVideoTask();
      if (createData.status === "reviewing" && createData.autoBytePlusAssetReview?.triggered) {
        onShowTip?.(BYTEPLUS_AUTO_REVIEW_NOTICE);
        updateNode(node.id, { error: undefined });
        createData = await createVideoTask(true);
      }
      const taskId = getVideoTaskId(createData);
      if (!taskId) throw new Error(getWorkflowApiErrorMessage({ error: createData.error ?? "视频平台没有返回任务编号", errorCode: createData.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE));
      updateNode(node.id, { taskId });
      // Store the clean user prompt (without the appended reference-order hint) back to the node on success,
      // so "使用提示词" and the asset library sourcePrompt do not carry the long reference-order instruction.
      // Task creation above already used modelPrompt; polling only needs the taskId, so the poll-body prompt is harmless.
      await pollVideoNode(node, taskId, prompt, model, settings, requestId, createData.usage);
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), taskId: undefined, videoRequestId: undefined });
    }
  }, [getEnabledVideoModel, getInputText, getPromptReferenceUrls, getReferenceImages, getReferenceImageNames, getReferenceMediaUrls, getIncomingNodes, referenceAssets, onShowTip, pollVideoNode, updateNode, uploadRuleOverrides, workflowId, workflowTitle]);

  // Signature of the currently-loaded nodes that still look "in progress" (running, no result yet, no error).
  // The recovery effects below depend on this INSTEAD of a fixed timer, so they re-run the moment the async
  // workspace state actually finishes loading into the canvas (nodes present) rather than guessing a delay.
  // This removes the race where an early one-shot reconcile fired before nodes loaded, missed, and never
  // retried — which made an already-finished image sit on the waiting card until the slow server self-heal.
  const pendingRecoverySignature = useMemo(() => {
    const nodes = Array.isArray(value?.nodes) ? value.nodes : [];
    const parts: string[] = [];
    for (const node of nodes) {
      const data = node?.data ?? {};
      if (node?.kind === "image" && data.isRunning && !data.error && (data.images?.length ?? 0) === 0) {
        parts.push(`i:${node.id}:${data.imageRequestId ?? ""}`);
      } else if (node?.kind === "video" && data.isRunning && !data.error && !data.videoUrl) {
        parts.push(`v:${node.id}:${data.taskId ?? ""}:${data.videoRequestId ?? ""}`);
      }
    }
    return parts.sort().join("|");
  }, [value]);

  // Resume polling for video nodes that were still generating when the page was closed / the server was
  // redeployed (mirrors the conversation-flow recovery). Without this, a reloaded workflow keeps the node's
  // persisted isRunning/taskId but never polls again, so the node is stuck on the waiting card forever even
  // though the upstream model is still running. We reuse the persisted taskId + videoRequestId so no new task
  // is created and billing dedup stays correct.
  const resumeInterruptedVideoNodes = useCallback(() => {
    if (!pollMountedRef.current) return;
    const currentWorkflowId = workflowId;
    for (const node of stateRef.current.nodes) {
      if (node.kind !== "video") continue;
      const taskId = node.data.taskId;
      if (!node.data.isRunning || !taskId || node.data.videoUrl || node.data.error) continue;
      const resumeKey = `${currentWorkflowId}:${node.id}:${taskId}`;
      if (resumingVideoNodesRef.current.has(resumeKey)) continue;
      resumingVideoNodesRef.current.add(resumeKey);
      const model = getEnabledVideoModel(node.data.model);
      const resolution = normalizeVideoResolutionForModel(model, node.data.resolution);
      const settings = { ratio: normalizeVideoRatioForModel(model, node.data.ratio, resolution), resolution, duration: node.data.duration ?? workflowVideoModels.find((item) => item.id === model)?.durations?.[0] ?? "5秒" };
      const requestId = node.data.videoRequestId ?? createId("workflow_video");
      const prompt = node.data.prompt?.trim() ?? "";
      void pollVideoNode(node, taskId, prompt, model, settings, requestId)
        .catch((error) => updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), taskId: undefined, videoRequestId: undefined }))
        .finally(() => resumingVideoNodesRef.current.delete(resumeKey));
    }
  }, [getEnabledVideoModel, pollVideoNode, updateNode, workflowId]);

  useEffect(() => {
    const timer = window.setTimeout(() => resumeInterruptedVideoNodes(), 300);
    return () => window.clearTimeout(timer);
  }, [workflowId, pendingRecoverySignature, resumeInterruptedVideoNodes]);

  // Resume polling for image nodes interrupted by page close / refresh / redeploy. The backend job keeps
  // generating regardless; here we just re-attach a status poller so the node shows the result (or an
  // explicit failure) once done. Image generation previously had NO recovery, so an interrupted node was
  // stuck on the waiting card forever even though the backend had finished.
  const resumeInterruptedImageNodes = useCallback(() => {
    if (!pollMountedRef.current) return;
    const currentWorkflowId = workflowId;
    for (const node of stateRef.current.nodes) {
      if (node.kind !== "image") continue;
      if (optimizingImageNodesRef.current.has(node.id)) continue;
      const requestId = node.data.imageRequestId;
      if (!node.data.isRunning || !requestId || (node.data.images?.length ?? 0) > 0 || node.data.error) continue;
      const resumeKey = `${currentWorkflowId}:${node.id}:${requestId}`;
      if (resumingImageNodesRef.current.has(resumeKey)) continue;
      resumingImageNodesRef.current.add(resumeKey);
      const model = getEnabledImageModel(node.data.model);
      const imageRatio = imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio ?? "16:9" : "16:9";
      const settings = { ratio: imageRatio, resolution: node.data.resolution ?? normalizeImageResolutionForModel(model, getSupportedImageResolutions(model)[0]) };
      const input = { prompt: node.data.prompt?.trim() ?? "", model, settings };
      void pollImageNode(node, requestId, input)
        .catch((error) => updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), imageRequestId: undefined }))
        .finally(() => resumingImageNodesRef.current.delete(resumeKey));
    }
  }, [getEnabledImageModel, pollImageNode, updateNode, workflowId]);

  useEffect(() => {
    const timer = window.setTimeout(() => resumeInterruptedImageNodes(), 300);
    return () => window.clearTimeout(timer);
  }, [workflowId, pendingRecoverySignature, resumeInterruptedImageNodes]);

  // Robust fallback (#2): on open, ask the backend for all active/recent image jobs and align the canvas
  // nodes by workflowNodeId — WITHOUT relying on the node's persisted running-state. This covers the edge
  // where the user closed so fast the node's isRunning/imageRequestId hadn't been saved yet: the backend
  // job still knows which node it belongs to, so we can still show the result / failure / keep polling.
  const reconcileImageJobsFromBackend = useCallback(async () => {
    if (!pollMountedRef.current) return;
    const currentWorkflowId = workflowId;
    let jobs: WorkflowImageJobStatus[] | undefined;
    try {
      const response = await fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) });
      const data = await readJson<{ jobs?: WorkflowImageJobStatus[] }>(response);
      jobs = data.jobs;
    } catch {
      return;
    }
    if (!jobs || !pollMountedRef.current || loadedWorkflowIdRef.current !== currentWorkflowId) return;
    for (const job of jobs) {
      if (job.kind !== "image" || (job.workflowId && job.workflowId !== currentWorkflowId) || !job.workflowNodeId) continue;
      const node = stateRef.current.nodes.find((item) => item.id === job.workflowNodeId);
      if (!node || node.kind !== "image" || (node.data.images?.length ?? 0) > 0) continue;
      // A safety-rewrite retry is actively running for this node; the old failed job here is stale. Skip so we
      // don't flip the node back to the failed card while the rewrite loop is still generating a new image.
      if (optimizingImageNodesRef.current.has(node.id)) continue;
      const model = getEnabledImageModel(node.data.model);
      const imageRatio = imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio ?? "16:9" : "16:9";
      const settings = { ratio: imageRatio, resolution: node.data.resolution ?? normalizeImageResolutionForModel(model, getSupportedImageResolutions(model)[0]) };
      const input = { prompt: node.data.prompt?.trim() ?? "", model, settings };
      if (job.status === "succeeded") {
        const images = job.resultUrls?.filter(Boolean) ?? [];
        if (images.length > 0) applyImageNodeResult(node, input, images, job.resultDimensions, job.credit, job.usage, job.reservedNames);
      } else if (job.status === "failed") {
        if (node.data.error) continue;
        updateNode(node.id, { isRunning: false, error: getWorkflowApiErrorMessage({ error: job.error, errorCode: job.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE), imageRequestId: undefined });
      } else {
        const resumeKey = `${currentWorkflowId}:${node.id}:${job.requestId}`;
        if (resumingImageNodesRef.current.has(resumeKey)) continue;
        resumingImageNodesRef.current.add(resumeKey);
        updateNode(node.id, { isRunning: true, error: undefined, imageRequestId: job.requestId });
        void pollImageNode(node, job.requestId, input)
          .catch((error) => updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), imageRequestId: undefined }))
          .finally(() => resumingImageNodesRef.current.delete(resumeKey));
      }
    }
  }, [applyImageNodeResult, getEnabledImageModel, pollImageNode, updateNode, workflowId]);

  useEffect(() => {
    const timer = window.setTimeout(() => reconcileImageJobsFromBackend(), 400);
    return () => window.clearTimeout(timer);
  }, [workflowId, pendingRecoverySignature, reconcileImageJobsFromBackend]);

  const applyVideoNodeJobResult = useCallback((node: WorkflowNode, job: WorkflowVideoJobStatus, model: ModelName, settings: { ratio?: string; resolution?: string; duration?: string }) => {
    const videoUrl = job.resultUrls?.find(Boolean);
    if (!videoUrl) return false;
    const prompt = node.data.prompt?.trim() ?? job.prompt ?? "";
    const generationUploads = getWorkflowGenerationUploadSnapshot(stateRef.current, node);
    updateNode(node.id, { prompt, videoUrl, posterUrl: job.posterUrl, videoCurrentTime: 0, generationUploads: generationUploads.length > 0 ? generationUploads : undefined, visualSize: undefined, isRunning: false, error: undefined, taskId: undefined, videoRequestId: undefined, mediaSystemNames: job.reservedNames?.[0] ? { ...(node.data.mediaSystemNames ?? {}), [videoUrl]: job.reservedNames[0] } : node.data.mediaSystemNames });
    updateState((state) => ({ ...state, edges: state.edges.filter((edge) => edge.target !== node.id) }));
    onGeneratedMedia?.({ nodeId: node.id, kind: "video", urls: [videoUrl], reservedNames: job.reservedNames, posterUrl: job.posterUrl, sourcePrompt: prompt, model, ratio: settings.ratio, resolution: settings.resolution, duration: settings.duration });
    onCredit?.({ ...job.credit, usage: job.usage });
    return true;
  }, [onCredit, onGeneratedMedia, updateNode, updateState]);

  const reconcileVideoJobsFromBackend = useCallback(async () => {
    if (!pollMountedRef.current) return;
    const currentWorkflowId = workflowId;
    let jobs: WorkflowVideoJobStatus[] | undefined;
    try {
      const response = await fetch("/api/generation-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) });
      const data = await readJson<{ jobs?: WorkflowVideoJobStatus[] }>(response);
      jobs = data.jobs;
    } catch {
      return;
    }
    if (!jobs || !pollMountedRef.current || loadedWorkflowIdRef.current !== currentWorkflowId) return;
    for (const node of stateRef.current.nodes) {
      if (node.kind !== "video" || node.data.videoUrl) continue;
      const job = jobs.find((item) => item.kind === "video" && (item.workflowId === currentWorkflowId || !item.workflowId) && (item.workflowNodeId === node.id || item.requestId === node.data.videoRequestId));
      if (!job) continue;
      const model = getEnabledVideoModel(node.data.model);
      const resolution = normalizeVideoResolutionForModel(model, node.data.resolution);
      const settings = { ratio: normalizeVideoRatioForModel(model, node.data.ratio, resolution), resolution, duration: node.data.duration ?? workflowVideoModels.find((item) => item.id === model)?.durations?.[0] ?? "5秒" };
      if (job.status === "succeeded") {
        applyVideoNodeJobResult(node, job, model, settings);
      } else if (job.status === "failed") {
        if (!node.data.error) updateNode(node.id, { isRunning: false, error: getWorkflowApiErrorMessage({ error: job.error, errorCode: job.errorCode }, GENERIC_MEDIA_ERROR_MESSAGE), taskId: undefined, videoRequestId: undefined });
      } else {
        const taskId = node.data.taskId || job.providerTaskId;
        if (!taskId) continue;
        const resumeKey = `${currentWorkflowId}:${node.id}:${job.requestId}`;
        if (resumingVideoNodesRef.current.has(resumeKey)) continue;
        resumingVideoNodesRef.current.add(resumeKey);
        updateNode(node.id, { isRunning: true, error: undefined, taskId, videoRequestId: job.requestId });
        void pollVideoNode(node, taskId, node.data.prompt?.trim() ?? "", model, settings, job.requestId)
          .catch((error) => updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), taskId: undefined, videoRequestId: undefined }))
          .finally(() => resumingVideoNodesRef.current.delete(resumeKey));
      }
    }
  }, [applyVideoNodeJobResult, getEnabledVideoModel, pollVideoNode, updateNode, workflowId]);

  useEffect(() => {
    const timer = window.setTimeout(() => reconcileVideoJobsFromBackend(), 400);
    return () => window.clearTimeout(timer);
  }, [workflowId, pendingRecoverySignature, reconcileVideoJobsFromBackend]);

  // When a suspended/background tab becomes visible again (e.g. user closed the browser then reopened, or
  // switched away and back), the mount-time recovery effects do NOT re-fire because workflowId is unchanged.
  // Re-run all recovery paths on visibility so a finished backend job is reflected without a full reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      resumeInterruptedImageNodes();
      resumeInterruptedVideoNodes();
      void reconcileImageJobsFromBackend();
      void reconcileVideoJobsFromBackend();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [resumeInterruptedImageNodes, resumeInterruptedVideoNodes, reconcileImageJobsFromBackend, reconcileVideoJobsFromBackend]);

  // Safety-net: while ANY node still looks in-progress, periodically re-run the backend reconcile so a
  // terminal job (succeeded OR failed) is ALWAYS eventually reflected on the node — even if the one-shot
  // mount recovery raced (nodes/stateRef not loaded yet), the status fetch transiently failed, or the worker
  // finished after that single attempt, and the tab was never hidden/refocused. Without this, such a node
  // stays stuck on the waiting card forever although the backend job is already done. Stops (interval
  // cleared) as soon as no node is pending. Idempotent: applying a done/failed result is guarded, so repeats
  // are harmless.
  useEffect(() => {
    if (!pendingRecoverySignature) return;
    const interval = window.setInterval(() => {
      if (!pollMountedRef.current) return;
      resumeInterruptedImageNodes();
      resumeInterruptedVideoNodes();
      void reconcileImageJobsFromBackend();
      void reconcileVideoJobsFromBackend();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [pendingRecoverySignature, resumeInterruptedImageNodes, resumeInterruptedVideoNodes, reconcileImageJobsFromBackend, reconcileVideoJobsFromBackend]);


  // Keep workflow node display names in sync with the canonical library name (permanent 终身id or the
  // user's rename), resolved by URL from the asset store. Without this, a node keeps whatever name was
  // frozen into mediaSystemNames at generation/import time and drifts from the library after a rename.
  // mediaSystemNames is excluded from the "meaningful snapshot", so this never reorders the workflow.
  // NOTE: workflowAssets/referenceAssets are new array instances every render, so we key the effect off
  // a STABLE content signature (not the array/Map reference) and bail out when nothing actually changes,
  // otherwise updateState -> onChange -> re-render would loop forever and crash the canvas.
  const canonicalNameSignature = useMemo(() => {
    const parts: string[] = [];
    for (const asset of workflowAssets) if (asset.url && asset.name) parts.push(`${normalizeWorkflowMediaUrl(asset.url)}\u0000${asset.name}`);
    for (const asset of referenceAssets) if (asset.url && asset.name) parts.push(`${normalizeWorkflowMediaUrl(asset.url)}\u0000${asset.name}`);
    return parts.sort().join("\u0001");
  }, [workflowAssets, referenceAssets]);
  useEffect(() => {
    if (!canonicalNameSignature) return;
    const canonicalNameByUrl = new Map<string, string>();
    for (const part of canonicalNameSignature.split("\u0001")) {
      const sep = part.indexOf("\u0000");
      if (sep > 0) canonicalNameByUrl.set(part.slice(0, sep), part.slice(sep + 1));
    }
    // A node's own media URLs (generated images + generated video). We reconcile names for THESE urls, not
    // just the ones already present in mediaSystemNames — otherwise a node whose mediaSystemNames is empty
    // (e.g. legacy rows born before the unified write, or any edge that never wrote a name) can never pick
    // up its canonical library name and stays stuck on the generic "图片生成/视频生成" fallback forever.
    const nodeMediaUrls = (node: WorkflowNode) => {
      const urls: string[] = [];
      if (Array.isArray(node.data.images)) for (const url of node.data.images) if (url) urls.push(url);
      if (node.data.videoUrl) urls.push(node.data.videoUrl);
      return urls;
    };
    const needsUpdate = stateRef.current.nodes.some((node) => {
      const names = node.data.mediaSystemNames;
      return nodeMediaUrls(node).some((url) => {
        const canonical = canonicalNameByUrl.get(normalizeWorkflowMediaUrl(url));
        return Boolean(canonical && canonical !== names?.[url]);
      });
    });
    if (!needsUpdate) return;
    updateState((state) => {
      let changed = false;
      const nodes = state.nodes.map((node) => {
        const urls = nodeMediaUrls(node);
        if (urls.length === 0) return node;
        const names = node.data.mediaSystemNames;
        let nodeChanged = false;
        const next: Record<string, string> = { ...(names ?? {}) };
        for (const url of urls) {
          const canonical = canonicalNameByUrl.get(normalizeWorkflowMediaUrl(url));
          if (canonical && canonical !== next[url]) { next[url] = canonical; nodeChanged = true; }
        }
        if (!nodeChanged) return node;
        changed = true;
        return { ...node, data: { ...node.data, mediaSystemNames: next } };
      });
      return changed ? { ...state, nodes } : state;
    });
  }, [canonicalNameSignature, updateState]);

  const importingAssetsRef = useRef(false);
  useEffect(() => {
    if (!assetsToImport || assetsToImport.length === 0) return;
    if (importingAssetsRef.current) return;
    importingAssetsRef.current = true;
    const addedIds: string[] = [];
    for (const asset of assetsToImport) {
      const id = restoreWorkflowAssetToCanvas(asset, undefined, undefined, { skipFocus: true, allowDuplicate: true });
      if (id) addedIds.push(id);
    }
    // Lay imported nodes out in a neat 5-per-row grid (placed below any existing content) so
    // multiple imports never overlap each other.
    updateState((state) => {
      const imported = addedIds.map((id) => state.nodes.find((node) => node.id === id)).filter((node): node is WorkflowNode => Boolean(node));
      if (imported.length === 0) return state;
      const sizes = new Map(imported.map((node) => [node.id, getWorkflowNodeVisualSize(node)]));
      const cellW = Math.max(...imported.map((node) => sizes.get(node.id)!.w));
      const others = state.nodes.filter((node) => !addedIds.includes(node.id));
      const originX = 160;
      const originY = others.length > 0 ? Math.max(...others.map((node) => node.y + getWorkflowNodeVisualSize(node).h)) + WORKFLOW_NODE_GAP : 120;
      const cols = 5;
      const positions = new Map<string, { x: number; y: number }>();
      let rowY = originY;
      for (let i = 0; i < imported.length; i += cols) {
        const row = imported.slice(i, i + cols);
        const rowH = Math.max(...row.map((node) => sizes.get(node.id)!.h));
        row.forEach((node, col) => {
          const size = sizes.get(node.id)!;
          positions.set(node.id, { x: originX + col * (cellW + WORKFLOW_NODE_GAP) + (cellW - size.w) / 2, y: rowY });
        });
        rowY += rowH + WORKFLOW_NODE_GAP;
      }
      return { ...state, nodes: state.nodes.map((node) => positions.has(node.id) ? { ...node, x: positions.get(node.id)!.x, y: positions.get(node.id)!.y } : node) };
    });
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (editor && addedIds.length > 0) {
        const nodes = stateRef.current.nodes.filter((node) => addedIds.includes(node.id));
        editor.select(...addedIds.map((nodeId) => getShapeId(nodeId)));
        if (nodes.length === 1) focusWorkflowNodeInViewport(editor, nodes[0]);
        else zoomToWorkflowNodes(editor, nodes);
      }
    });
    onAssetsImported?.();
    importingAssetsRef.current = false;
  }, [assetsToImport, restoreWorkflowAssetToCanvas, updateState, onAssetsImported]);

  const runtime = useMemo<WorkflowRuntime>(() => ({ selectedNodeId, connectingFrom, connectingTo, multiConnectSources, connectionPointer, modelOptions, workflowTitle, updateNode, deleteNode, disconnectNodes, connectTo, setConnectingFrom, beginConnectionDrag, beginInputConnectionDrag, beginMultiConnectionDrag, runImageNode: (node) => void runImageNode(node), runGptImageOptimizationRetry: (node, maxAttempts) => void runGptImageOptimizationRetry(node, maxAttempts), runVideoNode: (node) => void runVideoNode(node), onGeneratedMedia, onShowTip, markNodeAction, onPreviewMedia, getImageDisplayUrl, getVideoPosterDisplayUrl, referenceAssets, referenceAssetsLoadStatus, referenceAssetCounts, onLoadReferenceAssets, onLoadMoreReferenceAssets, uploadRuleOverrides, getConnectedInputUploads, getInputTextLength, uploadFilesAsConnectedNodes }), [beginConnectionDrag, beginInputConnectionDrag, beginMultiConnectionDrag, connectTo, connectingFrom, connectingTo, multiConnectSources, connectionPointer, deleteNode, disconnectNodes, getConnectedInputUploads, getImageDisplayUrl, getInputTextLength, getVideoPosterDisplayUrl, markNodeAction, modelOptions, onGeneratedMedia, onLoadReferenceAssets, onLoadMoreReferenceAssets, onPreviewMedia, onShowTip, referenceAssets, referenceAssetsLoadStatus, referenceAssetCounts, runGptImageOptimizationRetry, runImageNode, runVideoNode, selectedNodeId, updateNode, uploadFilesAsConnectedNodes, uploadRuleOverrides, workflowTitle]);

  return (
    <WorkflowRuntimeContext.Provider value={runtime}>
        <div className="relative h-full min-h-full overflow-hidden bg-[#cccccc] text-[#111111] workflow-tldraw-shell workflow-lovart-skin" style={{ "--workflow-canvas-bg": canvasBackground } as CSSProperties} onContextMenu={handleWorkflowContextMenu} onPointerDownCapture={handleWorkflowPointerDownCapture} onDragOverCapture={(event) => { const types = event.dataTransfer.types; if (types.includes("application/x-flashmuse-workflow-asset") || types.includes("application/x-flashmuse-workflow-node") || types.includes("application/x-flashmuse-workflow-history-media") || types.includes("application/x-flashmuse-workflow-history-text") || types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDropCapture={handleWorkflowAssetDrop}>
        <style>{`.workflow-tldraw-shell .tl-watermark_SEE-LICENSE,.workflow-tldraw-shell [data-testid="tl-watermark-unlicensed"],.workflow-tldraw-shell [data-testid="tl-watermark-licensed"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;}.workflow-tldraw-shell .yinzao-tool-button-active+div{opacity:.9!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}`}</style>
        <Tldraw hideUi shapeUtils={workflowShapeUtils} bindingUtils={workflowBindingUtils} overlayUtils={workflowOverlayUtils} components={workflowTldrawComponents} overrides={workflowTldrawOverrides} options={workflowTldrawOptions} getShapeVisibility={getWorkflowShapeVisibility} onMount={handleMount} licenseKey="">
          <WorkflowCanvasStatusControls state={stateRef.current} tick={editorTick} canvasBackground={canvasBackground} onCanvasBackgroundChange={setCanvasBackground} isLayerPanelOpen={isLayerPanelOpen} onToggleLayerPanel={() => setIsLayerPanelOpen((current) => !current)} />
          <WorkflowSelectedNodeOverlay />
          <WorkflowMultiConnectHandle onBeginDrag={beginMultiConnectionDrag} isDragging={multiConnectSources.length > 0} />
          <WorkflowCustomContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onAddNode={addNode} onUploadNode={() => uploadNodeInputRef.current?.click()} onImportAsset={onOpenAssetImport} onUsePrompt={addNodeFromPrompt} />
        </Tldraw>
        <WorkflowDraftConnectionOverlay editor={editorRef.current} state={stateRef.current} tick={editorTick} connectingFrom={connectingFrom} connectingTo={connectingTo} multiConnectSources={multiConnectSources} connectionPointer={connectionPointer} />
        {isLayerPanelOpen ? <WorkflowLayerPanel state={stateRef.current} workflowAssets={workflowAssets} selectedNodeId={selectedNodeId} getImageDisplayUrl={getImageDisplayUrl} getVideoPosterDisplayUrl={getVideoPosterDisplayUrl} onClose={() => setIsLayerPanelOpen(false)} onSelectNode={(nodeId, focus) => { const editor = editorRef.current; const node = stateRef.current.nodes.find((item) => item.id === nodeId); if (!editor || !node || node.data.isHidden) return; editor.select(getShapeId(nodeId)); if (focus) focusWorkflowNodeInViewport(editor, node); else centerWorkflowNodeInViewport(editor, node); }} onReorderNode={reorderWorkflowNodeLayer} onRestoreAsset={restoreWorkflowAssetToCanvas} onRestoreTextNode={restoreHistoricalTextNodeToCanvas} onDeleteHistoricalTextNode={deleteHistoricalTextNode} onRestoreMediaNode={restoreHistoricalMediaNode} onDeleteMediaNode={deleteHistoricalMediaNode} onDeleteHistoricalAsset={deleteHistoricalWorkflowAsset} onToggleNodeLock={toggleWorkflowNodeLock} onToggleNodeHidden={toggleWorkflowNodeHidden} /> : null}
        <div className="pointer-events-auto absolute left-4 top-3 z-20 flex items-center gap-2 text-[#5c626b]">
          {onToggleLeftSidebar ? (
            <button type="button" onClick={onToggleLeftSidebar} className="flex h-8 w-8 items-center justify-center rounded-md text-[#5c626b] transition hover:bg-black/5 hover:text-[#30343a]" aria-label={leftSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"} title={leftSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"}>
              {leftSidebarVisible ? <RiLayoutLeft2Line className="h-[22px] w-[22px]" aria-hidden="true" /> : <RiLayoutLeftLine className="h-[22px] w-[22px]" aria-hidden="true" />}
            </button>
          ) : null}
          <div className="max-w-[260px] truncate text-[13px] font-semibold text-[#5c626b]">{workflowTitle || "Untitled"}</div>
        </div>
        {connectingFrom || connectingTo || multiConnectSources.length > 0 ? <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-medium text-white shadow-lg">拖到可连接节点完成连接<button type="button" onClick={() => { setConnectingFrom(""); setConnectingTo(""); setMultiConnectSources([]); setConnectionPointer(undefined); }} className="ml-3 text-white/70 hover:text-white">取消</button></div> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
        <div className="lovart-workflow-dock pointer-events-auto flex items-center gap-1 rounded-[14px] border border-white/72 bg-white/92 p-1.5 shadow-[0_16px_34px_rgba(0,0,0,0.16)] backdrop-blur-[16px]">
          <WorkflowDockButton label="文本输入" shortcut="T" onClick={() => addNode("text")}><RiTextBlock className="h-5 w-5 shrink-0" /></WorkflowDockButton>
          <WorkflowDockButton label="图片节点" shortcut="I" onClick={() => addNode("image")}><RiImageAiLine className="h-5 w-5 shrink-0" /></WorkflowDockButton>
          <WorkflowDockButton label="视频节点" shortcut="D" onClick={() => addNode("video")}><RiFilmAiLine className="h-5 w-5 shrink-0" /></WorkflowDockButton>
          <div className="mx-1 h-5 w-px bg-[#e5e5e5]" />
          <input ref={uploadNodeInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*,.txt,text/plain" onChange={(event) => { void handleUploadNodeFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <WorkflowDockButton label="从本地上传" onClick={() => uploadNodeInputRef.current?.click()}><RiUpload2Line className="h-5 w-5 shrink-0" /></WorkflowDockButton>
          {onOpenAssetImport ? <WorkflowDockButton label="从资产库导入" onClick={() => onOpenAssetImport()}><RiExportFill className="h-5 w-5 shrink-0" /></WorkflowDockButton> : null}
          <div className="mx-1 h-5 w-px bg-[#e5e5e5]" />
          <WorkflowDockButton label="缩小" shortcut="Ctrl -" onClick={() => editorRef.current?.zoomOut()}><RiZoomOutLine className="h-5 w-5 shrink-0" /></WorkflowDockButton>
          <WorkflowDockButton label="放大" shortcut="Ctrl +" onClick={() => editorRef.current?.zoomIn()}><RiZoomInLine className="h-5 w-5 shrink-0" /></WorkflowDockButton>
          <WorkflowDockButton label="定位节点" shortcut="Shift 1" onClick={() => { const editor = editorRef.current; if (editor) zoomToSelectedOrWorkflowNodes(editor, stateRef.current.nodes); }}><RiFocus3Line className="h-5 w-5 shrink-0" /></WorkflowDockButton>
          <WorkflowToolMenu activeTool={activeCanvasTool} onChange={setCanvasTool} />
        </div>
        </div>
        {stateRef.current.nodes.length === 0 ? <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"><div className="text-[22px] font-semibold text-[#8a8a8a]">从一个节点开始</div><div className="pointer-events-auto mt-6 flex flex-row flex-wrap items-stretch justify-center gap-4"><button type="button" onClick={() => addNode("text")} className="inline-flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] bg-[#111111] px-7 text-[15px] font-semibold text-white transition hover:bg-[#252525]"><RiTextBlock className="h-5 w-5 shrink-0" /> 文字输入</button><button type="button" onClick={() => addNode("image")} className="inline-flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] bg-[#111111] px-7 text-[15px] font-semibold text-white transition hover:bg-[#252525]"><RiImageAiLine className="h-5 w-5 shrink-0" /> 图片节点</button><button type="button" onClick={() => addNode("video")} className="inline-flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] bg-[#111111] px-7 text-[15px] font-semibold text-white transition hover:bg-[#252525]"><RiFilmAiLine className="h-5 w-5 shrink-0" /> 视频节点</button><button type="button" onClick={() => uploadNodeInputRef.current?.click()} className="inline-flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] bg-[#111111] px-7 text-[15px] font-semibold text-white transition hover:bg-[#252525]"><RiUpload2Line className="h-5 w-5 shrink-0" /> 从本地上传</button>{onOpenAssetImport ? <button type="button" onClick={() => onOpenAssetImport()} className="inline-flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] bg-[#111111] px-7 text-[15px] font-semibold text-white transition hover:bg-[#252525]"><RiExportFill className="h-5 w-5 shrink-0" /> 从资产库导入</button> : null}</div></div> : null}
      </div>
    </WorkflowRuntimeContext.Provider>
  );
}

function WorkflowHoverTip({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-[10001] mb-2 hidden -translate-x-1/2 items-center whitespace-nowrap rounded-[8px] bg-[#1f2329] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.24)] group-hover:flex">
      {label}{shortcut ? <span className="ml-2 text-white/45">{shortcut}</span> : null}
    </span>
  );
}

function WorkflowTipButton({ label, shortcut, onClick, className, children, wrapperClassName = "" }: { label: string; shortcut?: string; onClick: () => void; className: string; children: ReactNode; wrapperClassName?: string }) {
  const [suppressed, setSuppressed] = useState(false);
  return (
    <div className={`group relative flex ${wrapperClassName}`} onPointerLeave={() => setSuppressed(false)}>
      <button type="button" onClick={() => { setSuppressed(true); onClick(); }} aria-label={label} className={className}>{children}</button>
      {suppressed ? null : <WorkflowHoverTip label={label} shortcut={shortcut} />}
    </div>
  );
}

function WorkflowDockButton({ label, shortcut, onClick, children }: { label: string; shortcut?: string; onClick: () => void; children: ReactNode }) {
  return <WorkflowTipButton label={label} shortcut={shortcut} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#30343a] outline-none hover:bg-[#f0f0f0]">{children}</WorkflowTipButton>;
}

function normalizeWorkflowMediaUrl(url: string) {
  return url.split("?")[0].split("#")[0];
}

function WorkflowCanvasStatusControls({ state, tick, canvasBackground, onCanvasBackgroundChange, isLayerPanelOpen, onToggleLayerPanel }: { state: WorkflowCanvasState; tick: number; canvasBackground: string; onCanvasBackgroundChange: (color: string) => void; isLayerPanelOpen: boolean; onToggleLayerPanel: () => void }) {
  const editor = useEditor();
  void tick;
  const [openPanel, setOpenPanel] = useState<"background" | "minimap" | "zoom" | "">("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const zoomPercent = useValue("workflow-zoom-percent", () => Math.round(editor.getCamera().z * 100), [editor]);
  const isGridMode = useValue("workflow-grid-mode", () => editor.getInstanceState().isGridMode, [editor]);
  const backgroundOptions = [
    { label: "默认灰", value: "#cccccc" },
    { label: "浅灰", value: "#e2e2e2" },
    { label: "白色", value: "#f7f7f7" },
    { label: "深灰", value: "#b8b8b8" },
  ];

  useEffect(() => {
    if (!openPanel) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenPanel("");
    };
    window.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
  }, [openPanel]);

  return (
    <div ref={rootRef} className="pointer-events-auto absolute bottom-[5px] left-5 z-20 flex items-center gap-0.5 text-[12px] font-medium text-[#5c626b]">
      <div className="relative">
        <WorkflowTipButton label="画布背景" onClick={() => setOpenPanel((current) => current === "background" ? "" : "background")} className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-[#5c626b] hover:bg-black/5"><RiCheckboxBlankCircleLine className="h-4 w-4" /></WorkflowTipButton>
        {openPanel === "background" ? (
          <div className="absolute bottom-7 left-0 w-[176px] rounded-[12px] border border-black/8 bg-white p-2 text-[#333333] shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
            <div className="px-2 pb-2 text-[12px] font-semibold text-[#111111]">画布背景</div>
            {backgroundOptions.map((item) => (
              <button key={item.value} type="button" onClick={() => { onCanvasBackgroundChange(item.value); setOpenPanel(""); }} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] hover:bg-[#f3f3f3]">
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: item.value }} />
                <span className="flex-1">{item.label}</span>
                {canvasBackground === item.value ? <RiCheckLine className="h-4 w-4" /> : null}
              </button>
            ))}
            <button type="button" onClick={() => editor.updateInstanceState({ isGridMode: !isGridMode })} className="mt-1 flex h-8 w-full items-center justify-between rounded-lg px-2 text-left text-[12px] hover:bg-[#f3f3f3]">
              <span>显示网格</span>
              {isGridMode ? <RiCheckLine className="h-4 w-4" /> : null}
            </button>
          </div>
        ) : null}
      </div>
      <WorkflowTipButton label="图层" onClick={() => { setOpenPanel(""); onToggleLayerPanel(); }} className={`flex h-[30px] w-[30px] items-center justify-center rounded-md text-[#5c626b] hover:bg-black/5 ${isLayerPanelOpen ? "bg-black/5" : ""}`}><RiStackLine className="h-4 w-4" /></WorkflowTipButton>
      <div className="relative">
        <WorkflowTipButton label="小地图" onClick={() => setOpenPanel((current) => current === "minimap" ? "" : "minimap")} className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-[#5c626b] hover:bg-black/5"><RiRoadMapLine className="h-4 w-4" /></WorkflowTipButton>
        {openPanel === "minimap" ? (
          <div className="absolute bottom-7 left-0 overflow-hidden rounded-[10px] bg-white p-1 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
            <WorkflowMiniMap editor={editor} state={state} />
          </div>
        ) : null}
      </div>
      <span className="mx-1 h-3 w-px bg-black/12" />
      <div className="relative">
        <WorkflowTipButton label="缩放" onClick={() => setOpenPanel((current) => current === "zoom" ? "" : "zoom")} className="flex h-[30px] min-w-11 items-center justify-center rounded-md px-1.5 text-[12px] font-medium text-[#5c626b] hover:bg-black/5">{zoomPercent}%</WorkflowTipButton>
        {openPanel === "zoom" ? <WorkflowZoomMenu editor={editor} state={state} onClose={() => setOpenPanel("")} /> : null}
      </div>
    </div>
  );
}

function WorkflowZoomMenu({ editor, state, onClose }: { editor: Editor; state: WorkflowCanvasState; onClose: () => void }) {
  const zoomPercent = useValue("workflow-zoom-menu-percent", () => Math.round(editor.getCamera().z * 100), [editor]);
  const setZoom = (zoom: number) => {
    const center = editor.getViewportPageBounds().center;
    const screen = editor.getViewportScreenBounds();
    editor.setCamera({ x: screen.w / 2 / zoom - center.x, y: screen.h / 2 / zoom - center.y, z: zoom });
    onClose();
  };
  const items = [
    { label: "放大", shortcut: "Ctrl +", onClick: () => { editor.zoomIn(); onClose(); } },
    { label: "缩小", shortcut: "Ctrl -", onClick: () => { editor.zoomOut(); onClose(); } },
    { label: "显示画布所有元素", shortcut: "Shift + 1", onClick: () => { zoomToWorkflowNodes(editor, state.nodes); onClose(); } },
    { type: "divider" as const },
    { label: "缩放至25%", zoomPercent: 25, onClick: () => setZoom(0.25) },
    { label: "缩放至50%", zoomPercent: 50, onClick: () => setZoom(0.5) },
    { label: "缩放至100%", zoomPercent: 100, onClick: () => setZoom(1) },
    { label: "缩放至200%", zoomPercent: 200, onClick: () => setZoom(2) },
  ];

  return (
    <div className="absolute bottom-9 left-0 w-[200px] rounded-[12px] bg-white p-2 text-[#111111] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      {items.map((item, index) => item.type === "divider" ? <div key={index} className="my-2 h-px bg-[#eeeeee]" /> : (
        <button key={item.label} type="button" onClick={item.onClick} className={`flex h-[31px] w-full items-center justify-between rounded-[8px] px-2 text-left text-[13px] font-medium hover:bg-[#eeeeee] ${item.zoomPercent === zoomPercent ? "bg-[#eeeeee]" : ""}`}>
          <span>{item.label}</span>
          {item.shortcut ? <span className="text-[13px] font-normal text-[#b4b4b4]">{item.shortcut}</span> : null}
        </button>
      ))}
    </div>
  );
}

function WorkflowMiniMap({ editor, state }: { editor: Editor; state: WorkflowCanvasState }) {
  const viewport = useValue("workflow-minimap-viewport", () => editor.getViewportPageBounds(), [editor]);
  const width = 200;
  const height = 130;
  const padding = 10;
  const nodeRects = state.nodes.map((node) => ({ x: node.x, y: node.y, ...getWorkflowNodeVisualSize(node) }));
  const allRects = [...nodeRects, { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h }];
  const minX = Math.min(...allRects.map((rect) => rect.x)) - 80;
  const minY = Math.min(...allRects.map((rect) => rect.y)) - 80;
  const maxX = Math.max(...allRects.map((rect) => rect.x + rect.w)) + 80;
  const maxY = Math.max(...allRects.map((rect) => rect.y + rect.h)) + 80;
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight);
  const offsetX = (width - contentWidth * scale) / 2;
  const offsetY = (height - contentHeight * scale) / 2;
  const toMini = (x: number, y: number) => ({ x: offsetX + (x - minX) * scale, y: offsetY + (y - minY) * scale });
  const centerCanvas = (clientX: number, clientY: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    const pageX = minX + ((clientX - rect.left) / rect.width * width - offsetX) / scale;
    const pageY = minY + ((clientY - rect.top) / rect.height * height - offsetY) / scale;
    editor.centerOnPoint({ x: pageX, y: pageY });
  };
  const viewportPoint = toMini(viewport.x, viewport.y);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-[130px] w-[200px] cursor-grab rounded-[8px] bg-white active:cursor-grabbing"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        centerCanvas(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        centerCanvas(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    >
      <rect x="0" y="0" width={width} height={height} rx="8" fill="#ffffff" />
      {nodeRects.map((rect, index) => {
        const point = toMini(rect.x, rect.y);
        return <rect key={index} x={point.x} y={point.y} width={Math.max(5, rect.w * scale)} height={Math.max(4, rect.h * scale)} rx="1.5" fill="#e2e2e2" />;
      })}
      <rect x={viewportPoint.x} y={viewportPoint.y} width={Math.max(10, viewport.w * scale)} height={Math.max(8, viewport.h * scale)} rx="4" fill="rgba(80,80,80,0.06)" stroke="#d7d7d7" strokeWidth="1" />
    </svg>
  );
}

function WorkflowLayerPanel({ state, workflowAssets, selectedNodeId, getImageDisplayUrl, getVideoPosterDisplayUrl, onClose, onSelectNode, onReorderNode, onRestoreAsset, onRestoreTextNode, onDeleteHistoricalTextNode, onRestoreMediaNode, onDeleteMediaNode, onDeleteHistoricalAsset, onToggleNodeLock, onToggleNodeHidden }: { state: WorkflowCanvasState; workflowAssets: WorkflowAssetSummary[]; selectedNodeId: string; getImageDisplayUrl?: (url: string) => string; getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined; onClose: () => void; onSelectNode: (nodeId: string, focus?: boolean) => void; onReorderNode: (dragNodeId: string, targetNodeId: string, position: "before" | "after") => void; onRestoreAsset: (asset: WorkflowAssetSummary) => void; onRestoreTextNode: (node: WorkflowNode) => void; onDeleteHistoricalTextNode: (node: WorkflowNode) => void; onRestoreMediaNode: (node: WorkflowNode) => void; onDeleteMediaNode: (node: WorkflowNode) => void; onDeleteHistoricalAsset: (asset: WorkflowAssetSummary) => void; onToggleNodeLock: (nodeId: string) => void; onToggleNodeHidden: (nodeId: string) => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ nodeId: string; position: "before" | "after" } | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [historyHeight, setHistoryHeight] = useState(180);
  const [isHistoryResizing, setIsHistoryResizing] = useState(false);
  const [deletedHistoricalAssetIds, setDeletedHistoricalAssetIds] = useState<Set<string>>(() => new Set());
  const currentMediaUrls = new Set(state.nodes.flatMap((node) => [...(node.data.images ?? []), ...(node.data.videoUrl ? [node.data.videoUrl] : [])].map(normalizeWorkflowMediaUrl)));
  const workflowAssetByUrl = new Map(workflowAssets.map((asset) => [normalizeWorkflowMediaUrl(asset.url), asset]));
  const orderedNodes = [...state.nodes].reverse();
  const currentCanvasAssets = state.nodes.flatMap((node) => {
    const imageAssets = (node.data.images ?? []).map((url, index) => workflowAssetByUrl.get(normalizeWorkflowMediaUrl(url)) ?? { id: `${node.id}-image-${index}`, name: node.data.mediaSystemNames?.[url] ?? `Image ${index + 1}`, url, kind: "image" as const, nodeId: node.id, dimensions: node.data.imageDimensions?.[url], sourcePrompt: node.data.prompt, ratio: node.data.ratio, resolution: node.data.resolution });
    const videoAssets = node.data.videoUrl ? [workflowAssetByUrl.get(normalizeWorkflowMediaUrl(node.data.videoUrl)) ?? { id: `${node.id}-video`, name: node.data.mediaSystemNames?.[node.data.videoUrl] ?? "Video 1", url: node.data.videoUrl, posterUrl: node.data.posterUrl, kind: "video" as const, nodeId: node.id, sourcePrompt: node.data.prompt, ratio: node.data.ratio, resolution: node.data.resolution, duration: node.data.duration }] : [];
    return [...imageAssets, ...videoAssets].map((asset) => ({ ...asset, nodeId: node.id }));
  });
  const historicalAssets = workflowAssets.filter((asset) => !deletedHistoricalAssetIds.has(asset.id) && !currentMediaUrls.has(normalizeWorkflowMediaUrl(asset.url)));
  const historicalTextNodes = state.historicalTextNodes ?? [];
  const historicalAssetUrls = new Set(historicalAssets.map((asset) => normalizeWorkflowMediaUrl(asset.url)));
  const historicalMediaNodeEntries = (state.historicalMediaNodes ?? []).reduce<Array<{ node: WorkflowNode; asset: WorkflowAssetSummary }>>((items, node) => {
    const url = getWorkflowNodeHistoricalMediaUrl(node);
    if (!url) return items;
    const key = normalizeWorkflowMediaUrl(url);
    if (!key || currentMediaUrls.has(key) || historicalAssetUrls.has(key) || items.some((item) => normalizeWorkflowMediaUrl(item.asset.url) === key)) return items;
    const asset: WorkflowAssetSummary = {
      id: node.id,
      name: node.data.mediaSystemNames?.[url] ?? (node.kind === "video" ? "视频" : "图片"),
      url,
      posterUrl: node.data.posterUrl,
      kind: node.kind === "video" ? "video" : "image",
      nodeId: node.id,
      sourcePrompt: node.data.prompt,
      model: node.data.model,
      ratio: node.data.ratio,
      resolution: node.data.resolution,
      duration: node.data.duration,
      dimensions: node.kind === "video" ? node.data.videoDimensions : node.data.imageDimensions?.[url],
    };
    return [...items, { node, asset }];
  }, []);
  const hasHistory = historicalTextNodes.length > 0 || historicalAssets.length > 0 || historicalMediaNodeEntries.length > 0;
  const historyContentHeight = Math.max(0, historyHeight - 44);

  const startLayerDrag = (event: ReactDragEvent<HTMLElement>, nodeId: string) => {
    event.dataTransfer.setData("application/x-flashmuse-workflow-node", nodeId);
    event.dataTransfer.effectAllowed = "copyMove";
  };
  const updateLayerDropIndicator = (event: ReactDragEvent<HTMLElement>, targetNodeId: string) => {
    if (!event.dataTransfer.types.includes("application/x-flashmuse-workflow-node")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropIndicator((current) => current?.nodeId === targetNodeId && current.position === position ? current : { nodeId: targetNodeId, position });
  };
  const dropLayerAtIndicator = (event: ReactDragEvent<HTMLElement>, targetNodeId: string) => {
    const dragNodeId = event.dataTransfer.getData("application/x-flashmuse-workflow-node");
    if (!dragNodeId) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = dropIndicator?.nodeId === targetNodeId ? dropIndicator.position : event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropIndicator(null);
    onReorderNode(dragNodeId, targetNodeId, position);
  };
  const renderDropIndicator = (nodeId: string) => dropIndicator?.nodeId === nodeId ? <div className={`pointer-events-none absolute left-0 right-0 z-20 h-[2px] bg-[#111111] ${dropIndicator.position === "before" ? "top-[-1px]" : "bottom-[-1px]"}`} /> : null;
  const startHistoryResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const startY = event.clientY;
    const startHeight = historyHeight;
    setIsHistoryResizing(true);
    const resize = (moveEvent: PointerEvent) => {
      const maxHeight = Math.max(120, rect.height - 180);
      const nextHeight = startHeight + moveEvent.clientY - startY;
      setHistoryHeight(Math.max(96, Math.min(maxHeight, nextHeight)));
    };
    const stop = () => {
      setIsHistoryResizing(false);
      window.removeEventListener("pointermove", resize, true);
      window.removeEventListener("pointerup", stop, true);
    };
    window.addEventListener("pointermove", resize, true);
    window.addEventListener("pointerup", stop, true);
  };
  const deleteHistoricalAsset = (asset: WorkflowAssetSummary) => {
    setDeletedHistoricalAssetIds((current) => new Set(current).add(asset.id));
    onDeleteHistoricalAsset(asset);
  };

  return (
    <div ref={panelRef} onDragOver={(event) => event.stopPropagation()} onDrop={(event) => event.stopPropagation()} className="workflow-layer-panel pointer-events-auto absolute bottom-0 left-0 top-0 z-30 flex w-[274px] flex-col border-r border-[#e5e5e5] bg-white text-[#333333] shadow-[12px_0_28px_rgba(0,0,0,0.08)]">
      <div className="flex h-14 shrink-0 items-center justify-between px-5">
        <div className="text-[16px] font-semibold text-[#111111]">图层</div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-[#555555] hover:bg-[#f2f2f2]" aria-label="关闭图层"><RiCloseLine className="h-5 w-5" /></button>
      </div>
      <div className={`${isHistoryExpanded ? "pb-0" : "h-14 pb-0"} shrink-0 px-5 ${isHistoryResizing ? "" : "transition-[height] duration-150"}`} style={isHistoryExpanded ? { height: historyHeight } : undefined}>
        <div className="mb-3 flex h-8 items-center justify-between text-[12px] text-[#9aa3af]">
          <div className="flex items-center gap-2">
            <RiHistoryLine className="h-5 w-5" />
            <span>已删除的节点</span>
          </div>
          <button type="button" onClick={() => setIsHistoryExpanded((current) => !current)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#555555] transition hover:bg-[#f2f2f2]" aria-label={isHistoryExpanded ? "收起已删除的节点" : "展开已删除的节点"} title={isHistoryExpanded ? "收起已删除的节点" : "展开已删除的节点"}>
            <RiArrowDownSLine className={`h-4 w-4 transition-transform ${isHistoryExpanded ? "" : "-rotate-90"}`} />
          </button>
        </div>
        {isHistoryExpanded ? hasHistory ? (
          <div className="overflow-y-auto pr-1" style={{ height: historyContentHeight }}>
            <div className="ml-5 space-y-1">
              {historicalTextNodes.map((node) => <WorkflowHistoricalTextLayerRow key={node.id} node={node} onRestore={() => onRestoreTextNode(node)} onDelete={() => onDeleteHistoricalTextNode(node)} />)}
              {historicalMediaNodeEntries.map(({ node, asset }) => <WorkflowAssetLayerRow key={node.id} asset={asset} getImageDisplayUrl={getImageDisplayUrl} getVideoPosterDisplayUrl={getVideoPosterDisplayUrl} compact dragType="application/x-flashmuse-workflow-history-media" onRestore={() => onRestoreMediaNode(node)} onDelete={() => onDeleteMediaNode(node)} />)}
              {historicalAssets.map((asset) => <WorkflowAssetLayerRow key={asset.id} asset={asset} getImageDisplayUrl={getImageDisplayUrl} getVideoPosterDisplayUrl={getVideoPosterDisplayUrl} compact onRestore={() => onRestoreAsset(asset)} onDelete={() => deleteHistoricalAsset(asset)} />)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-[#c4c8d0]" style={{ height: historyContentHeight }}>
            <div className="flex items-center gap-3 opacity-60">
              <RiTextBlock className="h-6 w-6" />
              <RiImageAiLine className="h-6 w-6" />
              <RiFilmAiLine className="h-6 w-6" />
            </div>
            <div className="mt-2 text-[13px]">暂无已删除的节点</div>
            <div className="mt-1 text-[13px] text-[#aeb4bd]">删除后的节点在这里</div>
          </div>
        ) : null}
      </div>
      {isHistoryExpanded ? (
        <div role="separator" aria-label="调整已删除的节点高度" onPointerDown={startHistoryResize} className="group relative z-20 h-px shrink-0 cursor-row-resize bg-[#d0d5dd] transition hover:bg-[#98a2b3]" title="拖动调整已删除的节点高度">
          <div className="absolute left-0 right-0 top-0 h-[10px] bg-transparent" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c7ccd4] bg-white transition group-hover:border-[#98a2b3] group-hover:bg-[#f7f7f7]" />
        </div>
      ) : <div className="h-px shrink-0 bg-[#eeeeee]" />}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-2 flex items-center gap-2 text-[12px] text-[#9aa3af]">
          <RiNodeTree className="h-5 w-5" />
          <span>画布上的节点</span>
        </div>
        <div className="ml-5 space-y-1">
          {orderedNodes.length === 0 ? <div className="px-2 py-4 text-[13px] text-[#9a9a9a]">当前画布暂无节点</div> : orderedNodes.map((node) => {
            const nodeAssets = currentCanvasAssets.filter((asset) => asset.nodeId === node.id);
            if (nodeAssets.length > 0) {
              return <div key={node.id} className="relative space-y-1" draggable={!node.data.isLocked} onDragStart={(event) => startLayerDrag(event, node.id)} onDragEnd={() => setDropIndicator(null)} onDragOver={(event) => updateLayerDropIndicator(event, node.id)} onDrop={(event) => dropLayerAtIndicator(event, node.id)}>{renderDropIndicator(node.id)}{nodeAssets.map((asset) => <WorkflowAssetLayerRow key={`${node.id}-${asset.id}`} asset={asset} selected={selectedNodeId === node.id} getImageDisplayUrl={getImageDisplayUrl} getVideoPosterDisplayUrl={getVideoPosterDisplayUrl} compact isLocked={Boolean(node.data.isLocked)} isHidden={Boolean(node.data.isHidden)} onToggleLock={() => onToggleNodeLock(node.id)} onToggleHidden={() => onToggleNodeHidden(node.id)} onSelect={() => onSelectNode(node.id)} onFocus={() => onSelectNode(node.id, true)} />)}</div>;
            }
            const textHasContent = node.kind === "text" && getWorkflowTextNodeContent(node).trim();
            return (
              <div key={node.id} className="relative" draggable={!node.data.isLocked} onDragStart={(event) => startLayerDrag(event, node.id)} onDragEnd={() => setDropIndicator(null)} onDragOver={(event) => updateLayerDropIndicator(event, node.id)} onDrop={(event) => dropLayerAtIndicator(event, node.id)}>
                {renderDropIndicator(node.id)}
                <button type="button" onClick={() => onSelectNode(node.id)} onDoubleClick={() => onSelectNode(node.id, true)} className={`group flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left transition hover:bg-[#f3f4f6] ${selectedNodeId === node.id ? "bg-[#eef1f4]" : ""}`}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#6b7280]"><WorkflowLayerNodeIcon node={node} /></span>
                  <span className={`min-w-0 flex-1 truncate text-[12px] ${node.kind === "text" && getWorkflowTextNodeContent(node).trim() ? "text-[#111111]" : "text-[#6b7280]"}`}>{getWorkflowLayerNodeLabel(node)}</span>
                  {textHasContent ? <WorkflowLayerRowControls isLocked={Boolean(node.data.isLocked)} isHidden={Boolean(node.data.isHidden)} onToggleLock={() => onToggleNodeLock(node.id)} onToggleHidden={() => onToggleNodeHidden(node.id)} /> : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorkflowLayerNodeIcon({ node }: { node: WorkflowNode }) {
  if (node.kind === "image") return <RiImageAiLine className="h-4.5 w-4.5" />;
  if (node.kind === "video") return <RiFilmAiLine className="h-4.5 w-4.5" />;
  return <RiTextBlock className="h-4.5 w-4.5" />;
}

function getWorkflowLayerNodeLabel(node: WorkflowNode) {
  if (node.kind !== "text") return node.title || getNodeLabel(node.kind);
  return (node.data.text ?? node.data.prompt ?? node.data.outputText ?? "").trim() || node.title || getNodeLabel(node.kind);
}

function WorkflowHistoricalTextLayerRow({ node, onRestore, onDelete }: { node: WorkflowNode; onRestore: () => void; onDelete: () => void }) {
  const { open, toggle, close, containerRef } = useWorkflowRowMenu();
  return (
    <div draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-flashmuse-workflow-history-text", node.id); event.dataTransfer.effectAllowed = "copy"; }} className="group relative flex h-9 cursor-grab items-center gap-2 rounded-lg px-2 text-[12px] text-[#6b7280] hover:bg-[#f3f4f6] active:cursor-grabbing">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#6b7280]"><RiTextBlock className="h-4.5 w-4.5" /></span>
      <span className="min-w-0 flex-1 truncate text-[#111111]">{getWorkflowLayerNodeLabel(node)}</span>
      <span ref={containerRef} className="contents">
        <button type="button" onClick={(event) => { event.stopPropagation(); toggle(); }} className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#e8ebef] group-hover:flex" aria-label="历史文本菜单"><RiMoreLine className="h-4 w-4" /></button>
        {open ? <WorkflowHistoryRowMenu onRestore={onRestore} onDelete={onDelete} onClose={close} /> : null}
      </span>
    </div>
  );
}

function WorkflowAssetLayerRow({ asset, getImageDisplayUrl, getVideoPosterDisplayUrl, compact, onRestore, onDelete, onSelect, onFocus, selected, isLocked, isHidden, onToggleLock, onToggleHidden, dragType }: { asset: WorkflowAssetSummary; getImageDisplayUrl?: (url: string) => string; getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined; compact?: boolean; onRestore?: () => void; onDelete?: () => void; onSelect?: () => void; onFocus?: () => void; selected?: boolean; isLocked?: boolean; isHidden?: boolean; onToggleLock?: () => void; onToggleHidden?: () => void; dragType?: string }) {
  const { open, toggle, close, containerRef } = useWorkflowRowMenu();
  const previewUrl = asset.kind === "video" ? getVideoPosterDisplayUrl?.(asset.url, asset.posterUrl) : getImageDisplayUrl?.(asset.url);
  return (
    <div draggable={Boolean(onRestore)} onClick={onSelect} onDoubleClick={onFocus} onDragStart={(event) => { if (!onRestore) return; const key = dragType ?? "application/x-flashmuse-workflow-asset"; event.dataTransfer.setData(key, asset.id); if (key === "application/x-flashmuse-workflow-asset") event.dataTransfer.setData("text/plain", asset.id); event.dataTransfer.effectAllowed = "copy"; }} className={`group relative flex items-center gap-2 rounded-lg px-2 text-[12px] text-[#6b7280] ${compact ? "h-9" : "h-10"} ${onRestore ? "cursor-grab hover:bg-[#f3f4f6] active:cursor-grabbing" : onSelect ? "cursor-pointer hover:bg-[#f3f4f6]" : ""} ${selected ? "bg-[#eef1f4]" : ""}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#dfe3e8] bg-[#f8fafc] text-[#5c626b]">
        {previewUrl ? <WorkflowHoverImagePreview src={asset.kind === "image" ? asset.url : previewUrl} alt={asset.name} wrapperClassName="block h-full w-full"><img src={previewUrl} alt="" className="h-full w-full object-cover" draggable={false} /></WorkflowHoverImagePreview> : asset.kind === "video" ? <RiVideoLine className="h-4 w-4" /> : <RiImageAiLine className="h-4 w-4" />}
      </span>
      <span className={`min-w-0 flex-1 truncate ${asset.url ? "text-[#111111]" : ""}`}>{asset.name}</span>
      {onToggleLock && onToggleHidden ? <WorkflowLayerRowControls isLocked={Boolean(isLocked)} isHidden={Boolean(isHidden)} onToggleLock={onToggleLock} onToggleHidden={onToggleHidden} /> : null}
      {onRestore ? (
        <span ref={containerRef} className="contents">
          <button type="button" onClick={(event) => { event.stopPropagation(); toggle(); }} onPointerDown={(event) => event.stopPropagation()} className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#e8ebef] group-hover:flex" aria-label="历史资产菜单"><RiMoreLine className="h-4 w-4" /></button>
          {open && onDelete ? <WorkflowHistoryRowMenu onRestore={onRestore} onDelete={onDelete} onClose={close} /> : null}
        </span>
      ) : null}
    </div>
  );
}

function WorkflowLayerRowControls({ isLocked, isHidden, onToggleLock, onToggleHidden }: { isLocked: boolean; isHidden: boolean; onToggleLock: () => void; onToggleHidden: () => void }) {
  const showLockButton = !isHidden;
  const showHiddenButton = !isLocked;
  return (
    <span className={`ml-auto -mr-1 shrink-0 items-center gap-0 text-[#c7ccd4] ${isLocked || isHidden ? "flex" : "hidden group-hover:flex"}`}>
      {showLockButton ? (
        <button type="button" onClick={(event) => { event.stopPropagation(); onToggleLock(); }} onPointerDown={(event) => event.stopPropagation()} className="flex h-7 w-6 items-center justify-center rounded-md transition hover:bg-[#e8ebef] hover:text-[#6b7280]" aria-label={isLocked ? "解锁节点" : "锁定节点"} title={isLocked ? "解锁" : "锁定"}>
          {isLocked ? <RiLockLine className="h-4 w-4" /> : <RiLockUnlockLine className="h-4 w-4" />}
        </button>
      ) : null}
      {showHiddenButton ? (
        <button type="button" onClick={(event) => { event.stopPropagation(); onToggleHidden(); }} onPointerDown={(event) => event.stopPropagation()} className="flex h-7 w-6 items-center justify-center rounded-md transition hover:bg-[#e8ebef] hover:text-[#6b7280]" aria-label={isHidden ? "显示节点" : "隐藏节点"} title={isHidden ? "显示" : "隐藏"}>
          {isHidden ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
        </button>
      ) : null}
    </span>
  );
}

function WorkflowHistoryRowMenu({ onRestore, onDelete, onClose }: { onRestore: () => void; onDelete: () => void; onClose: () => void }) {
  return (
    <div className="absolute right-1 top-8 z-30 w-[132px] rounded-[10px] border border-[#e8e8e8] bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.16)]" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => { onRestore(); onClose(); }} className="flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] text-[#222222] hover:bg-[#f3f4f6]">恢复进画布</button>
      <button type="button" onClick={() => { onDelete(); onClose(); }} className="mt-1 flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] text-[#dc2626] hover:bg-[#fef2f2]">删除</button>
    </div>
  );
}

function WorkflowToolMenu({ activeTool, onChange }: { activeTool: "select" | "hand"; onChange: (tool: "select" | "hand") => void }) {
  const [open, setOpen] = useState(false);
  const Icon = activeTool === "hand" ? RiHand : RiCursorLine;
  const options = [
    { value: "select" as const, label: "选择", shortcut: "V", icon: RiCursorLine },
    { value: "hand" as const, label: "移动", shortcut: "H", icon: RiHand },
  ];

  return (
    <div className="relative" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1f2329] text-white outline-none" title={activeTool === "hand" ? "移动画布" : "选择"} aria-label={activeTool === "hand" ? "移动画布" : "选择"}>
        <Icon className="h-5 w-5 shrink-0" />
      </button>
      {open ? (
        <div className="absolute bottom-full left-1/2 w-[170px] -translate-x-1/2 rounded-[12px] bg-white p-2 text-[#111111] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
          {options.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button key={item.value} type="button" onClick={() => { onChange(item.value); setOpen(false); }} className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] font-medium hover:bg-[#eeeeee]">
                <ItemIcon className="h-4 w-4 text-[#30343a]" />
                <span className="flex-1">{item.label}</span>
                <span className="text-[12px] font-normal text-[#b4b4b4]">{item.shortcut}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function WorkflowDraftConnectionOverlay({ editor, state, tick, connectingFrom, connectingTo, multiConnectSources, connectionPointer }: { editor: Editor | null; state: WorkflowCanvasState; tick: number; connectingFrom?: string; connectingTo?: string; multiConnectSources?: string[]; connectionPointer?: { x: number; y: number } }) {
  void tick;
  if (!editor || (!connectingFrom && !connectingTo && !(multiConnectSources && multiConnectSources.length > 0)) || !connectionPointer) return null;
  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
  const container = editor.getContainer().getBoundingClientRect();
  const pagePointToOverlayPoint = (point: { x: number; y: number }) => {
    const screenPoint = editor.pageToScreen(point);
    return { x: screenPoint.x - container.left, y: screenPoint.y - container.top };
  };
  const getOutputPortPagePoint = (node: WorkflowNode) => {
    const size = getWorkflowNodeVisualSize(node);
    return { x: node.x + size.w, y: node.y + size.h / 2 };
  };
  const getInputPortPagePoint = (node: WorkflowNode) => {
    const size = getWorkflowNodeVisualSize(node);
    return { x: node.x, y: node.y + size.h / 2 };
  };
  const getConnectionPath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const distance = b.x - a.x;
    const control = Math.max(30, distance > 0 ? distance / 3 : Math.min(Math.abs(distance) + 30, 100));
    return `M ${a.x} ${a.y} C ${a.x + control} ${a.y}, ${b.x - control} ${b.y}, ${b.x} ${b.y}`;
  };
  const endpointRadius = 7;
  const renderEndpoint = (key: string, point: { x: number; y: number }) => <circle key={key} cx={point.x} cy={point.y} r={endpointRadius} fill="#ffffff" stroke="#d7dce2" strokeWidth={1.25} />;
  const renderPath = (key: string, a: { x: number; y: number }, b: { x: number; y: number }) => {
    return <g key={key}>
      <path d={getConnectionPath(a, b)} fill="none" stroke="#2f80ed" strokeWidth={2.25} strokeLinecap="round" strokeDasharray="7 6" />
      {renderEndpoint(`${key}-start`, a)}
      {renderEndpoint(`${key}-end`, b)}
    </g>;
  };
  return <svg className="pointer-events-none absolute inset-0 z-[40] h-full w-full overflow-visible">{(() => {
    const pointer = { x: connectionPointer.x - container.left, y: connectionPointer.y - container.top };
    if (multiConnectSources && multiConnectSources.length > 0) {
      return multiConnectSources.map((sourceId) => {
        const source = nodeById.get(sourceId);
        if (!source) return null;
        return renderPath(`workflow-multi-connection-${sourceId}`, pagePointToOverlayPoint(getOutputPortPagePoint(source)), pointer);
      });
    }
    const source = connectingFrom ? nodeById.get(connectingFrom) : undefined;
    if (source) {
      const a = pagePointToOverlayPoint(getOutputPortPagePoint(source));
      return renderPath("workflow-temp-connection", a, pointer);
    }
    const target = connectingTo ? nodeById.get(connectingTo) : undefined;
    if (!target) return null;
    const a = pointer;
    const b = pagePointToOverlayPoint(getInputPortPagePoint(target));
    return renderPath("workflow-temp-connection", a, b);
  })()}</svg>;
}

function WorkflowMultiConnectHandle({ onBeginDrag, isDragging }: { onBeginDrag: (sourceIds: string[], event: ReactPointerEvent) => void; isDragging: boolean }) {
  const editor = useEditor();
  const info = useValue("workflow-multi-connect-handle", () => {
    const selectedShapeIds = editor.getSelectedShapeIds();
    const nodeShapes = selectedShapeIds
      .map((id) => editor.getShape(id))
      .filter((shape): shape is WorkflowNodeShape => Boolean(shape) && shape!.type === "workflow_node");
    if (nodeShapes.length < 2) return null;
    const outputSourceIds = nodeShapes.filter((shape) => canWorkflowNodeOutput(shape.props.node)).map((shape) => shape.props.node.id);
    if (outputSourceIds.length === 0) return null;
    let maxRight = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const shape of nodeShapes) {
      const size = getWorkflowNodeVisualSize(shape.props.node);
      maxRight = Math.max(maxRight, shape.x + size.w);
      top = Math.min(top, shape.y);
      bottom = Math.max(bottom, shape.y + size.h);
    }
    const point = editor.pageToViewport({ x: maxRight, y: (top + bottom) / 2 });
    return { point, outputSourceIds };
  }, [editor]);

  if (!info) return null;
  const size = 36;
  return (
    <div className="pointer-events-none absolute z-[45] overflow-visible" style={{ left: info.point.x, top: info.point.y }}>
      <div className="absolute -translate-y-1/2" style={{ left: 18, top: 0 }}>
        <button
          type="button"
          onPointerDown={(event) => { event.stopPropagation(); onBeginDrag(info.outputSourceIds, event); }}
          className={`pointer-events-auto flex items-center justify-center rounded-full border-[4px] border-[#168cff] bg-white shadow-[0_4px_14px_rgba(22,140,255,0.35)] transition ${isDragging ? "ring-2 ring-[#168cff]/25" : ""} cursor-crosshair hover:bg-[#f0f8ff]`}
          style={{ width: size, height: size }}
          title="连接所有选中节点"
        >
          <span className="rounded-full bg-[#168cff]" style={{ width: size * 0.5, height: size * 0.5 }} />
          <span className="sr-only">连接所有选中节点</span>
        </button>
      </div>
    </div>
  );
}

function NodePort({ side, active, onPointerDown, onPointerEnter, onPointerLeave }: { side: "left" | "right"; active?: boolean; onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerEnter?: () => void; onPointerLeave?: () => void }) {
  const size = WORKFLOW_CONNECTION_PORT_SIZE;
  const hitWidth = size + WORKFLOW_CONNECTION_PORT_GAP;
  return <div className="absolute top-1/2 z-30 -translate-y-1/2 overflow-visible" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} style={{ width: hitWidth, height: size, left: side === "left" ? -hitWidth : undefined, right: side === "right" ? -hitWidth : undefined }}>
    <button type="button" onPointerDown={(event) => { event.stopPropagation(); onPointerDown?.(event); }} className={`absolute top-0 z-20 flex items-center justify-center rounded-full border-[4px] border-[#168cff] bg-white transition ${active ? "ring-2 ring-[#168cff]/20" : ""} ${onPointerDown ? "cursor-crosshair hover:bg-[#f0f8ff]" : "cursor-default"}`} style={{ width: size, height: size, left: side === "left" ? 0 : undefined, right: side === "right" ? 0 : undefined }} title={side === "left" ? "连接输入" : "连接输出"}>
      <span className="h-8 w-8 rounded-full bg-[#168cff]" />
      <span className="sr-only">{side === "left" ? "连接输入" : "连接输出"}</span>
    </button>
  </div>;
}

function cardBorderClassName(_selected?: boolean) { return "border-[#f5f5f5]"; }
function EmptyMediaCard({ kind, selected, height }: { kind: WorkflowNodeKind; selected?: boolean; height: number }) { const Icon = getNodeIcon(kind); const iconSize = Math.max(40, Math.min(220, height * 0.16)); return <div className={`flex w-full items-center justify-center border bg-[#e6e6e6] text-[#d1d1d1] ${cardBorderClassName(selected)}`} style={{ height }}><Icon style={{ width: iconSize, height: iconSize }} /></div>; }
function useWorkflowFixedScreenScale() {
  const editor = useEditor();
  return useValue("workflow-fixed-screen-scale", () => 1 / Math.max(0.01, editor.getCamera().z), [editor]);
}
function WaitingCard({ isImage, startedAt, selected, height }: { isImage: boolean; startedAt?: number; selected?: boolean; height: number }) {
  const fixedScale = useWorkflowFixedScreenScale();
  const inset = 14 * fixedScale;
  return <div className={`relative w-full overflow-hidden border bg-[#e6e6e6] text-left text-[#4f6f86] ${cardBorderClassName(selected)}`} style={{ height }}><div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" /><div className="absolute z-10 overflow-hidden" style={{ left: inset, right: inset, top: inset }}><div className="inline-flex max-w-full rounded-md bg-black/12 font-medium leading-none text-black/75 backdrop-blur-sm" style={{ fontSize: 13 * fixedScale, padding: `${4 * fixedScale}px ${10 * fixedScale}px` }}><span className="truncate">{getVideoWaitProgress(startedAt)}%{isImage ? "生成中" : "渲染中"}</span></div></div><div className="absolute z-10 overflow-hidden" style={{ left: inset, right: inset, bottom: inset }}><div className="truncate leading-none text-[#6f8fa3]" style={{ fontSize: 12 * fixedScale }}>已等待 {formatElapsedTime(startedAt)}</div></div></div>;
}
function FailedCard({ isImage, selected, height, error, onRetry, onOptimizationRetry: maybeOptimizationRetry }: { isImage: boolean; selected?: boolean; height: number; error?: string; onRetry?: () => void; onOptimizationRetry?: (maxAttempts: number) => void }) {
  const fixedScale = useWorkflowFixedScreenScale();
  const inset = 14 * fixedScale;
  const errorLineHeight = 20 * fixedScale;
  const errorMaxHeight = Math.max(errorLineHeight, height - inset * 2 - 44 * fixedScale);
  const hasOptimizationRetry = Boolean(maybeOptimizationRetry);
  const onOptimizationRetry = maybeOptimizationRetry ?? (() => undefined);
  const titleHeight = 26 * fixedScale;
  const middleHeight = hasOptimizationRetry ? 132 * fixedScale : 30 * fixedScale;
  const minErrorHeight = 42 * fixedScale;
  const availableHeight = Math.max(0, height - inset * 2);
  const showMiddle = availableHeight >= titleHeight + middleHeight + (error ? minErrorHeight : 0) + 34 * fixedScale;
  const showError = Boolean(error) && availableHeight >= titleHeight + minErrorHeight + 14 * fixedScale;
  const visibleErrorMaxHeight = Math.max(errorLineHeight, Math.min(82 * fixedScale, availableHeight - titleHeight - (showMiddle ? middleHeight : 0) - 18 * fixedScale));
  return (
    <div className={`relative flex w-full items-center justify-center overflow-hidden border bg-[#e6e6e6] text-[#777777] ${cardBorderClassName(selected)}`} style={{ height }}>
      <div className="absolute z-10 overflow-hidden" style={{ left: inset, right: inset, top: inset }}>
        <div className="inline-flex max-w-full items-center font-medium leading-none" style={{ gap: 8 * fixedScale, fontSize: 13 * fixedScale }}>
          <RiEmotionSadLine className="shrink-0" style={{ width: 20 * fixedScale, height: 20 * fixedScale }} />
          <span className="truncate">{isImage ? "图片生成失败" : "视频生成失败"}</span>
        </div>
      </div>
      {showMiddle ? <div className="absolute left-1/2 top-1/2 z-10 w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden px-4 text-center">
        {hasOptimizationRetry ? <div className="mx-auto flex max-w-[760px] flex-col items-center" style={{ gap: 12 * fixedScale }}>
          <div className="flex max-w-full items-start text-left text-[#555555]" style={{ gap: 8 * fixedScale, fontSize: 12 * fixedScale, lineHeight: `${18 * fixedScale}px` }}>
            <RiInformation2Line className="shrink-0 text-[#777777]" style={{ width: 16 * fixedScale, height: 16 * fixedScale, marginTop: 1 * fixedScale }} />
            <span>该模型会拒绝安全、隐私、未成年人、非自愿亲密内容、冒充或肖像滥用等请求。本次失败原因已在下方红字显示。你可以自行调整提示词，也可以由AI尝试安全改写后重试，系统会尽量保留原意和参考图，但不保证一定成功。</span>
          </div>
          <div className="flex flex-wrap justify-center" style={{ columnGap: 22 * fixedScale, rowGap: 10 * fixedScale }}>
            {[3, 5, 10].map((count) => <button key={count} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOptimizationRetry?.(count); }} className="inline-flex items-center whitespace-nowrap bg-transparent font-medium leading-none text-[#367cee] transition hover:text-[#2568d8]" style={{ gap: 4 * fixedScale, fontSize: 13 * fixedScale }}><RiResetLeftLine className="shrink-0" style={{ width: 14 * fixedScale, height: 14 * fixedScale }} /><span>AI改写重试{count}次</span></button>)}
          </div>
        </div> : <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onRetry?.(); }} className="inline-flex max-w-full items-center whitespace-nowrap bg-transparent font-medium leading-none text-[#367cee] transition hover:text-[#2568d8]" style={{ gap: 4 * fixedScale, fontSize: 13 * fixedScale }}><RiResetLeftLine className="shrink-0" style={{ width: 14 * fixedScale, height: 14 * fixedScale }} /><span className="truncate">修改后重试</span></button>}
      </div> : null}
      {showError ? <div className="absolute z-10 overflow-hidden" style={{ left: inset, right: inset, bottom: inset, maxHeight: visibleErrorMaxHeight }}>
        <div className="text-left text-red-500" style={{ fontSize: 12 * fixedScale, lineHeight: `${errorLineHeight}px`, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>{error}</div>
      </div> : null}
    </div>
  );
}
function isRightClickOrContextMenuEvent(event: SyntheticEvent) {
  const nativeEvent = event.nativeEvent as MouseEvent | PointerEvent | WheelEvent;
  return event.type === "contextmenu" || ("button" in nativeEvent && nativeEvent.button === 2);
}
function TextDisplayCard({ node, height, isEditing }: { node: WorkflowNode; selected?: boolean; height: number; isEditing: boolean }) {
  const editor = useEditor();
  const runtime = useWorkflowRuntime();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const value = node.data.text ?? node.data.prompt ?? node.data.outputText ?? "";
  const markTextEvent = (event: SyntheticEvent) => {
    if (!isEditing) return;
    if (isRightClickOrContextMenuEvent(event)) return;
    event.stopPropagation();
    editor.markEventAsHandled(event);
  };
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.currentTarget.value;
    runtime.updateNode(node.id, { text: nextValue, prompt: nextValue, outputText: undefined, error: undefined, isRunning: false });
  };

  useEffect(() => {
    if (!isEditing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
  }, [isEditing]);

  return (
    <div className="relative w-full overflow-hidden rounded-[20px] border-[5px] border-[#b8b8b8] bg-white" style={{ height }}>
      <textarea
        ref={textareaRef}
        value={value}
        placeholder="大段提示词或者剧本可以输入到这里..."
        readOnly={!isEditing}
        onChange={handleChange}
        onPointerDownCapture={markTextEvent}
        onPointerUpCapture={markTextEvent}
        onMouseDownCapture={markTextEvent}
        onMouseUpCapture={markTextEvent}
        onClickCapture={markTextEvent}
        onDoubleClickCapture={markTextEvent}
        onWheelCapture={(event) => { if (isEditing) event.stopPropagation(); }}
        className={`yinzao-workflow-text-scroll h-full w-full resize-none overflow-y-auto border-0 bg-transparent px-5 py-5 text-[16px] leading-7 text-[#222222] outline-none placeholder:text-[#a6a6a6] selection:bg-[#2f6df6] selection:text-white ${isEditing ? "cursor-text" : "cursor-move select-none"}`}
        style={{ font: "16px / 28px var(--font-geist-sans), Arial, Helvetica, sans-serif", pointerEvents: isEditing ? "all" : "none" }}
      />
    </div>
  );
}
function PreviewEyeButton({ label, onPreview }: { label: string; onPreview: () => void }) { return <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPreview(); }} className="absolute bottom-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_8px_20px_rgba(0,0,0,0.24)] backdrop-blur transition hover:bg-black/72" aria-label={label} title={label}><RiEyeLine className="h-4.5 w-4.5" /></button>; }
function UploadingNodeOverlay({ progress, width, height, previewUrl, isVideo }: { progress?: number; width: number; height: number; previewUrl?: string; isVideo?: boolean }) {
  const pct = Math.max(1, Math.min(99, Math.round(progress ?? 1)));
  const degrees = pct * 3.6;
  const diameter = Math.min(width, height) * 0.3;
  const ringThickness = Math.max(2, diameter * 0.1);
  const fontSize = diameter * 0.26;
  const src = previewUrl ? (/^(blob:|data:)/.test(previewUrl) ? previewUrl : getStaticMediaUrl(previewUrl) ?? previewUrl) : undefined;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
      {src ? (
        isVideo ? (
          <video src={src} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="上传预览" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
        )
      ) : null}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
      <div className="relative flex items-center justify-center rounded-full" style={{ width: diameter, height: diameter, background: `conic-gradient(#367cee ${degrees}deg, rgba(255,255,255,0.28) 0deg)` }}>
        <div className="absolute rounded-full bg-black/62" style={{ inset: ringThickness }} />
        <span className="relative font-semibold leading-none text-white" style={{ fontSize }}>{pct}%</span>
      </div>
    </div>
  );
}
function ImageDisplayCard({ node, selected, displayUrl, height }: { node: WorkflowNode; selected?: boolean; displayUrl?: string; height: number }) { const runtime = useWorkflowRuntime(); if (node.data.isRunning) return <WaitingCard isImage startedAt={node.data.startedAt} selected={selected} height={height} />; if (node.data.error) return <FailedCard isImage selected={selected} height={height} error={node.data.error} onRetry={() => runtime.runImageNode(node)} onOptimizationRetry={isWorkflowGptImageSafetyFailure(node) ? (count) => runtime.runGptImageOptimizationRetry(node, count) : undefined} />; const url = node.data.images?.[0]; if (url) return <div className={`relative w-full overflow-hidden border bg-[#e6e6e6] ${cardBorderClassName(selected)}`} style={{ height }}><img src={displayUrl ?? getStaticMediaUrl(url) ?? url} alt="生成图片" draggable={false} className="h-full w-full select-none object-cover" /></div>; return <EmptyMediaCard kind="image" selected={selected} height={height} />; }
function AudioDisplayCard({ node, selected, height }: { node: WorkflowNode; selected?: boolean; height: number }) { const url = node.data.audioUrl; const displayUrl = url ? getStaticMediaUrl(url) ?? url : undefined; return <div className="relative flex w-full items-center justify-center overflow-hidden rounded-[20px] border-[5px] border-[#b8b8b8] bg-white px-6" style={{ height }}>{displayUrl ? <audio src={displayUrl} controls className="w-full" /> : <EmptyMediaCard kind="audio" selected={selected} height={height} />}{node.data.uploadProgress !== undefined ? <UploadingNodeOverlay progress={node.data.uploadProgress} width={height} height={height} /> : null}</div>; }
function WorkflowInlineVideo({ node, url, onSelect }: { node: WorkflowNode; url: string; onSelect: () => void }) {
  const editor = useEditor();
  const runtime = useWorkflowRuntime();
  const lastSavedTimeRef = useRef(node.data.videoCurrentTime ?? 0);
  const displayUrl = getStaticMediaUrl(url) ?? url;
  const markVideoEvent = (event: SyntheticEvent) => {
    if (isRightClickOrContextMenuEvent(event)) return;
    event.stopPropagation();
    editor.markEventAsHandled(event);
  };
  const saveCurrentTime = (time: number, force = false) => {
    if (!Number.isFinite(time)) return;
    if (!force && Math.abs(time - lastSavedTimeRef.current) < 0.5) return;
    lastSavedTimeRef.current = time;
    runtime.updateNode(node.id, { videoCurrentTime: time });
  };
  const saveVideoMetadata = (video: HTMLVideoElement) => {
    const dimensions = video.videoWidth > 0 && video.videoHeight > 0 ? { width: video.videoWidth, height: video.videoHeight } : undefined;
    const durationSeconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
    if (!dimensions && !durationSeconds) return;
    runtime.updateNode(node.id, { videoDimensions: dimensions ?? node.data.videoDimensions, durationSeconds: durationSeconds ?? node.data.durationSeconds });
    runtime.onGeneratedMedia?.({
      nodeId: node.id,
      kind: "video",
      urls: [url],
      posterUrl: node.data.posterUrl,
      sourcePrompt: node.data.prompt ?? "",
      model: node.data.model,
      ratio: node.data.ratio,
      resolution: node.data.resolution,
      duration: node.data.duration,
      dimensions: dimensions ? { [url]: dimensions } : undefined,
      durationSeconds: durationSeconds ? { [url]: durationSeconds } : undefined,
      silent: true,
    });
  };

  return <div className="relative h-full w-full cursor-default bg-[#e6e6e6]" style={{ pointerEvents: "all" }}><video src={displayUrl} className="h-full w-full select-none object-cover" style={{ pointerEvents: "all", cursor: "default" }} draggable={false} controls playsInline preload="auto" onLoadedMetadata={(event) => saveVideoMetadata(event.currentTarget)} onDragStart={(event) => event.preventDefault()} onTimeUpdate={(event) => saveCurrentTime(event.currentTarget.currentTime)} onPause={(event) => saveCurrentTime(event.currentTarget.currentTime, true)} onSeeked={(event) => saveCurrentTime(event.currentTarget.currentTime, true)} onEnded={(event) => saveCurrentTime(event.currentTarget.currentTime, true)} onPointerDownCapture={markVideoEvent} onPointerUpCapture={markVideoEvent} onMouseDownCapture={markVideoEvent} onMouseUpCapture={markVideoEvent} onClickCapture={markVideoEvent} onDoubleClickCapture={markVideoEvent} /><div className="absolute left-0 right-0 top-0 z-10 cursor-default" style={{ bottom: 112, pointerEvents: "all" }} onDragStart={(event) => event.preventDefault()} onPointerDown={(event) => { if (event.button !== 2) onSelect(); }} /></div>;
}

function VideoDisplayCard({ node, selected, height, onSelect }: { node: WorkflowNode; selected?: boolean; height: number; onSelect: () => void }) { const runtime = useWorkflowRuntime(); if (node.data.isRunning) return <WaitingCard isImage={false} startedAt={node.data.startedAt} selected={selected} height={height} />; if (node.data.error) return <FailedCard isImage={false} selected={selected} height={height} error={node.data.error} onRetry={() => runtime.runVideoNode(node)} />; if (node.data.videoUrl) return <div className={`relative w-full overflow-hidden border bg-[#e6e6e6] ${cardBorderClassName(selected)}`} style={{ height }}><WorkflowInlineVideo node={node} url={node.data.videoUrl} onSelect={onSelect} /></div>; return <EmptyMediaCard kind="video" selected={selected} height={height} />; }

function getWorkflowEditableText(element: HTMLElement) {
  let text = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent ?? "";
        return;
      }
      if (child.nodeName === "BR") {
        if (!(child instanceof HTMLElement) || child.dataset.trailingBreak !== "true") text += "\n";
        return;
      }
      walk(child);
    });
  };
  walk(element);
  const normalizedText = text.replace(/\u00a0/g, " ");
  return normalizedText.replace(/\n/g, "") === "" ? "" : normalizedText;
}

function appendWorkflowEditorText(element: HTMLElement, text: string) {
  text.split("\n").forEach((line, index) => {
    if (index > 0) element.append(document.createElement("br"));
    if (line) element.append(document.createTextNode(line));
  });
}

function getWorkflowMentionRanges(value: string, validReferences: Set<string>) {
  const names = Array.from(validReferences).filter(Boolean).sort((a, b) => b.length - a.length);
  const ranges: Array<{ start: number; end: number }> = [];
  if (names.length === 0) return ranges;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "@") continue;
    const matchedName = names.find((name) => value.startsWith(`@${name}`, index));
    if (!matchedName) continue;
    const end = index + matchedName.length + 1;
    ranges.push({ start: index, end });
    index = end - 1;
  }
  return ranges;
}

function getWorkflowMentionRangeForDeletion(value: string, cursorOffset: number, direction: "backward" | "forward", validReferences: Set<string>) {
  const probeOffset = direction === "backward" ? cursorOffset - 1 : cursorOffset;
  if (probeOffset < 0 || probeOffset >= value.length) return undefined;
  return getWorkflowMentionRanges(value, validReferences).find((range) => probeOffset >= range.start && probeOffset < range.end);
}

function getWorkflowAtQueryAtCursor(text: string, cursorOffset: number) {
  const cursor = Math.min(Math.max(0, cursorOffset), text.length);
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/@([^@\s，。！？；;、]*)$/);
  if (!match) return null;
  return { index: cursor - match[0].length, query: match[1] ?? "", cursor };
}

function getWorkflowAtQueryAtCursorForReferences(text: string, cursorOffset: number, validReferences: Set<string>) {
  const query = getWorkflowAtQueryAtCursor(text, cursorOffset);
  if (!query) return null;
  if (query.query && validReferences.has(query.query)) return null;
  return query;
}

function getWorkflowSelectionTextOffset(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return getWorkflowEditableText(element).length;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return getWorkflowEditableText(element).length;

  let offset = 0;
  let found = false;
  const nodeTextLength = (node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
    if (node.nodeName === "BR") return node instanceof HTMLElement && node.dataset.trailingBreak === "true" ? 0 : 1;
    return Array.from(node.childNodes).reduce((sum, child) => sum + nodeTextLength(child), 0);
  };
  const walk = (node: Node) => {
    if (found) return;

    if (node instanceof HTMLElement && node.dataset.mention === "true") {
      offset += nodeTextLength(node);
      if (node.contains(range.startContainer)) found = true;
      return;
    }

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset;
      } else {
        Array.from(node.childNodes).slice(0, range.startOffset).forEach((child) => { offset += nodeTextLength(child); });
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE || node.nodeName === "BR") {
      offset += nodeTextLength(node);
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(element);
  return found ? offset : getWorkflowEditableText(element).length;
}

function setWorkflowSelectionTextOffset(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  let remaining = Math.max(0, offset);
  const placeCaret = (container: Node): boolean => {
    const children = Array.from(container.childNodes);
    for (const child of children) {
      if (child instanceof HTMLElement && child.dataset.mention === "true") {
        const length = child.textContent?.length ?? 0;
        if (remaining <= length) {
          const range = document.createRange();
          if (remaining <= 0) range.setStartBefore(child);
          else range.setStartAfter(child);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= length;
        continue;
      }

      if (child.nodeType === Node.TEXT_NODE) {
        const length = child.textContent?.length ?? 0;
        if (remaining <= length) {
          const range = document.createRange();
          range.setStart(child, remaining);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= length;
        continue;
      }
      if (child.nodeName === "BR") {
        if (remaining <= 1) {
          const parent = child.parentNode;
          if (!parent) return false;
          const range = document.createRange();
          range.setStart(parent, children.indexOf(child) + 1);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= 1;
        continue;
      }
      if (placeCaret(child)) return true;
    }
    return false;
  };
  if (placeCaret(element)) return;

  if (element.lastChild?.nodeName === "BR") {
    const range = document.createRange();
    range.setStart(element, element.childNodes.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderWorkflowEditorContent(element: HTMLElement, value: string, validReferences: Set<string>) {
  element.replaceChildren();
  if (!value) return;
  let cursor = 0;
  getWorkflowMentionRanges(value, validReferences).forEach((range) => {
    if (range.start > cursor) appendWorkflowEditorText(element, value.slice(cursor, range.start));
    const mention = document.createElement("span");
    mention.className = "text-[#4f7cff]";
    mention.dataset.mention = "true";
    mention.contentEditable = "false";
    mention.textContent = value.slice(range.start, range.end);
    element.append(mention);
    cursor = range.end;
  });
  if (cursor < value.length) appendWorkflowEditorText(element, value.slice(cursor));
  if (value.endsWith("\n")) {
    const trailingBreak = document.createElement("br");
    trailingBreak.dataset.trailingBreak = "true";
    element.append(trailingBreak);
  }
}

function shouldRenderWorkflowEditorContent(element: HTMLElement, value: string, validReferences: Set<string>) {
  if (getWorkflowEditableText(element) !== value) return true;
  const expectedMentions = getWorkflowMentionRanges(value, validReferences).length;
  const renderedMentions = element.querySelectorAll("[data-mention='true']").length;
  return expectedMentions !== renderedMentions;
}

function isWorkflowEditorScrolledToBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
}

function preserveWorkflowEditorScroll(element: HTMLElement, callback: () => void) {
  const wasAtBottom = isWorkflowEditorScrolledToBottom(element);
  const previousScrollTop = element.scrollTop;
  callback();
  element.scrollTop = wasAtBottom ? element.scrollHeight : previousScrollTop;
}

function renderWorkflowInlineFormatting(text: string) {
  const pattern = /(\*\*[^*]+\*\*|\[red\][\s\S]+?\[\/red\]|\[blue\][\s\S]+?\[\/blue\])/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const cleanText = (value: string) => value.replace(/\*\*/g, "").replace(/__/g, "").replace(/`/g, "");

  text.replace(pattern, (match, _token, index: number) => {
    if (index > lastIndex) nodes.push(cleanText(text.slice(lastIndex, index)));
    if (match.startsWith("**")) {
      nodes.push(<strong key={`${match}-${index}`} className="font-semibold text-[#111111]">{match.slice(2, -2)}</strong>);
    } else if (match.startsWith("[red]")) {
      nodes.push(<span key={`${match}-${index}`} className="rounded-md bg-[#fff1f1] px-1.5 py-0.5 text-[13px] font-semibold text-[#d36b63]">{match.slice(5, -6)}</span>);
    } else {
      nodes.push(<span key={`${match}-${index}`} className="rounded-md bg-[#eef5ff] px-1.5 py-0.5 text-[13px] font-semibold text-[#6f95d8]">{match.slice(6, -7)}</span>);
    }
    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < text.length) nodes.push(cleanText(text.slice(lastIndex)));
  return nodes.length > 0 ? nodes : cleanText(text);
}

function sanitizeWorkflowTextOutputForDisplay(content: string) {
  const raw = content.trim();
  let text = raw;
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw) as { content?: unknown; displayText?: unknown };
      text = typeof parsed.content === "string" ? parsed.content : typeof parsed.displayText === "string" ? parsed.displayText : raw;
    } catch {}
  }

  return sanitizeModelOutputText(text)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[{[][^\n]*$/gm, "")
    .replace(/\r\n|\n|\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/^```[\w-]*\s*$/gm, "")
    .replace(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function extractWorkflowTextContent(content: string | undefined) {
  const raw = (content ?? "").trim();
  if (!raw) return "";
  if (!raw.startsWith("{")) return raw;

  try {
    const parsed = JSON.parse(raw) as { content?: unknown; displayText?: unknown };
    if (typeof parsed.content === "string") return parsed.content;
    if (typeof parsed.displayText === "string") return parsed.displayText;
  } catch {}

  return raw;
}

function WorkflowFormattedText({ content }: { content: string }) {
  const displayContent = sanitizeWorkflowTextOutputForDisplay(content);
  const blocks = displayContent.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return null;

  const renderLine = (line: string, key: string, isFirstLine: boolean) => {
    const divider = /^-{3,}$/.test(line);
    const heading = line.match(/^(#{1,3})\s*(.*)$/);
    const boldHeading = line.match(/^\*\*([^*]{2,24})\*\*$/);
    const labeledListItem = line.match(/^(?:[-*]|\d+[.、])\s*(.{2,30}?[：:])\s*([\s\S]*)$/);
    const bulletItem = line.match(/^[-*]\s+([\s\S]+)$/);
    const plainHeading = isFirstLine && line.length <= 28 && !/[。！？.!?]$/.test(line);

    if (divider) return <hr key={key} className="my-3 border-[#d8d8d8]" />;
    if (heading || boldHeading || plainHeading) {
      const headingText = heading ? heading[2]?.trim() ?? "" : boldHeading ? boldHeading[1] : line;
      if (!headingText) return null;
      return <h2 key={key} className="pt-1 text-[17px] font-semibold leading-7 tracking-[-0.01em] text-[#111111]">{renderWorkflowInlineFormatting(headingText)}</h2>;
    }
    if (labeledListItem) {
      return <div key={key} className="flex gap-2"><span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#111111]" aria-hidden="true" /><p className="min-w-0 flex-1"><span className="font-semibold text-[#111111]">{renderWorkflowInlineFormatting(labeledListItem[1])}</span>{labeledListItem[2] ? renderWorkflowInlineFormatting(labeledListItem[2]) : null}</p></div>;
    }
    if (bulletItem) {
      return <div key={key} className="flex gap-2"><span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#111111]" aria-hidden="true" /><p className="min-w-0 flex-1">{renderWorkflowInlineFormatting(bulletItem[1])}</p></div>;
    }
    return <p key={key}>{renderWorkflowInlineFormatting(line)}</p>;
  };

  return <div className="space-y-3">{blocks.map((block, blockIndex) => <div key={blockIndex} className="space-y-2">{block.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line, lineIndex) => renderLine(line, `${blockIndex}-${lineIndex}`, blockIndex === 0 && lineIndex === 0))}</div>)}</div>;
}

function WorkflowUploadProgressOverlay({ progress }: { progress?: number }) {
  const value = Math.min(100, Math.max(0, Math.floor(progress ?? 0)));
  const degrees = value * 3.6;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `conic-gradient(#367cee ${degrees}deg, rgba(255,255,255,0.26) 0deg)` }}>
        <div className="absolute inset-[4px] rounded-full bg-black/62" />
        <span className="relative text-[11px] font-semibold leading-none text-white">{value}%</span>
      </div>
    </div>
  );
}

function WorkflowUploadIcon({ kind }: { kind: WorkflowUploadKind }) {
  if (kind === "video") return <RiVideoOnLine className="h-5 w-5" aria-hidden="true" />;
  if (kind === "audio") return <RiVoiceprintLine className="h-5 w-5" aria-hidden="true" />;
  if (kind === "document") return <RiFileTextLine className="h-5 w-5" aria-hidden="true" />;
  return <RiImageLine className="h-5 w-5" aria-hidden="true" />;
}

function WorkflowMentionEditor({ value, placeholder, running, maxHeight = 500, maxLength = MAX_WORKFLOW_PROMPT_LENGTH, validReferences, focusRequest, externalEditorRef, onChange, onRun, onPasteImages, onLimit, onCursorChange, onAtTrigger, onAtClose }: { value: string; placeholder: string; running?: boolean; maxHeight?: number; maxLength?: number; validReferences: Set<string>; focusRequest?: { offset: number; key: number }; externalEditorRef?: MutableRefObject<HTMLDivElement | null>; onChange: (value: string) => void; onRun: () => void; onPasteImages: (files: File[]) => void; onLimit: () => void; onCursorChange: (offset: number) => void; onAtTrigger: (query: { index: number; query: string; cursor: number }) => void; onAtClose: () => void }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const setEditorRef = useCallback((el: HTMLDivElement | null) => {
    editorRef.current = el;
    if (externalEditorRef) externalEditorRef.current = el;
  }, [externalEditorRef]);
  const isComposingRef = useRef(false);
  const scrollSnapshotRef = useRef<{ wasAtBottom: boolean; scrollTop: number } | null>(null);
  const handledFocusRequestKeyRef = useRef<number | null>(null);
  const isApplyingFocusRequestRef = useRef(false);
  const validReferencesKey = useMemo(() => Array.from(validReferences).sort().join("\n"), [validReferences]);

  const captureScroll = useCallback((element: HTMLElement) => {
    scrollSnapshotRef.current = { wasAtBottom: isWorkflowEditorScrolledToBottom(element), scrollTop: element.scrollTop };
  }, []);

  const restoreScroll = useCallback((element: HTMLElement) => {
    const snapshot = scrollSnapshotRef.current;
    if (!snapshot) return;
    const apply = () => { element.scrollTop = snapshot.wasAtBottom ? element.scrollHeight : snapshot.scrollTop; };
    apply();
    requestAnimationFrame(apply);
  }, []);

  const syncEditor = useCallback((nextValue: string, caretOffset?: number) => {
    const element = editorRef.current;
    if (!element) return;
    preserveWorkflowEditorScroll(element, () => {
      renderWorkflowEditorContent(element, nextValue, validReferences);
      setWorkflowSelectionTextOffset(element, caretOffset ?? nextValue.length);
    });
  }, [validReferences]);

  const commitInput = useCallback((rawValue: string, caretOffset: number, options?: { syncDom?: boolean }) => {
    if (running) return;
    const nextValue = Array.from(rawValue).slice(0, maxLength).join("");
    const nextCaretOffset = Math.min(caretOffset, nextValue.length);
    if (rawValue !== nextValue) onLimit();
    onCursorChange(nextCaretOffset);
    onChange(nextValue);
    const atQuery = getWorkflowAtQueryAtCursorForReferences(nextValue, nextCaretOffset, validReferences);
    if (atQuery) onAtTrigger(atQuery);
    else onAtClose();
    if (options?.syncDom || rawValue !== nextValue) syncEditor(nextValue, nextCaretOffset);
  }, [maxLength, onAtClose, onAtTrigger, onChange, onCursorChange, onLimit, running, syncEditor, validReferences]);

  useEffect(() => {
    const element = editorRef.current;
    if (!element || isComposingRef.current || !shouldRenderWorkflowEditorContent(element, value, validReferences)) return;
    const currentCaretOffset = getWorkflowSelectionTextOffset(element);
    preserveWorkflowEditorScroll(element, () => {
      renderWorkflowEditorContent(element, value, validReferences);
      setWorkflowSelectionTextOffset(element, Math.min(currentCaretOffset, value.length));
    });
  }, [validReferences, validReferencesKey, value]);

  useEffect(() => {
    const element = editorRef.current;
    if (!element || !focusRequest) return;
    if (handledFocusRequestKeyRef.current === focusRequest.key) return;
    handledFocusRequestKeyRef.current = focusRequest.key;
    isApplyingFocusRequestRef.current = true;
    element.focus();
    syncEditor(value, Math.min(focusRequest.offset, value.length));
    requestAnimationFrame(() => { isApplyingFocusRequestRef.current = false; });
  }, [focusRequest, syncEditor, value]);

  const syncCursorFromDom = useCallback(() => {
    if (running) return;
    if (isComposingRef.current) return;
    if (isApplyingFocusRequestRef.current) return;
    const element = editorRef.current;
    if (!element) return;
    const cursorOffset = getWorkflowSelectionTextOffset(element);
    onCursorChange(cursorOffset);
    const atQuery = getWorkflowAtQueryAtCursorForReferences(getWorkflowEditableText(element), cursorOffset, validReferences);
    if (atQuery) onAtTrigger(atQuery);
    else onAtClose();
  }, [onAtClose, onAtTrigger, onCursorChange, running, validReferences]);

  return (
    <div className="relative">
      {!value ? <div className="pointer-events-none absolute left-2 top-1 z-20 text-[14px] leading-6 text-[#b3b3b3]">{placeholder}</div> : null}
      <div
        ref={setEditorRef}
        contentEditable={!running}
        role="textbox"
        aria-multiline="true"
        aria-disabled={running}
        translate="no"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        suppressContentEditableWarning
        onCompositionStart={(event) => { captureScroll(event.currentTarget); isComposingRef.current = true; }}
        onCompositionEnd={(event) => { if (running) return; isComposingRef.current = false; const element = event.currentTarget; commitInput(getWorkflowEditableText(element), getWorkflowSelectionTextOffset(element)); restoreScroll(element); }}
        onBeforeInput={(event) => { if (running) return; captureScroll(event.currentTarget); }}
        onInput={(event) => { if (running) return; if (isComposingRef.current) return; const element = event.currentTarget; commitInput(getWorkflowEditableText(element), getWorkflowSelectionTextOffset(element)); restoreScroll(element); }}
        onPaste={(event) => {
          if (running) {
            event.preventDefault();
            return;
          }
          captureScroll(event.currentTarget);
          const files = Array.from(event.clipboardData.files ?? []);
          if (files.some((file) => file.type.startsWith("image/"))) {
            event.preventDefault();
            onPasteImages(files);
            return;
          }
          const text = event.clipboardData.getData("text/plain");
          if (!text) return;
          event.preventDefault();
          const element = event.currentTarget;
          const selectionOffset = getWorkflowSelectionTextOffset(element);
          const currentText = getWorkflowEditableText(element);
          const selection = window.getSelection();
          const selectedTextLength = selection?.rangeCount && element.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.getRangeAt(0).toString().length : 0;
          const nextText = `${currentText.slice(0, selectionOffset)}${text}${currentText.slice(selectionOffset + selectedTextLength)}`;
          commitInput(nextText, selectionOffset + text.length, { syncDom: true });
          restoreScroll(element);
        }}
        onKeyDown={(event) => {
          if (running) {
            event.preventDefault();
            return;
          }
          captureScroll(event.currentTarget);
          if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const element = event.currentTarget;
            const selection = window.getSelection();
            const hasRangeSelection = Boolean(selection?.rangeCount && element.contains(selection.getRangeAt(0).commonAncestorContainer) && selection.getRangeAt(0).toString().length > 0);
            if (!hasRangeSelection) {
              const currentText = getWorkflowEditableText(element);
              const cursorOffset = getWorkflowSelectionTextOffset(element);
              const mentionRange = getWorkflowMentionRangeForDeletion(currentText, cursorOffset, event.key === "Backspace" ? "backward" : "forward", validReferences);
              if (mentionRange) {
                event.preventDefault();
                const nextText = `${currentText.slice(0, mentionRange.start)}${currentText.slice(mentionRange.end)}`;
                commitInput(nextText, mentionRange.start, { syncDom: true });
                restoreScroll(element);
                return;
              }
            }
          }
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (!event.shiftKey) {
            onRun();
            return;
          }
          const element = event.currentTarget;
          const selectionOffset = getWorkflowSelectionTextOffset(element);
          const currentText = getWorkflowEditableText(element);
          commitInput(`${currentText.slice(0, selectionOffset)}\n${currentText.slice(selectionOffset)}`, selectionOffset + 1, { syncDom: true });
          restoreScroll(element);
        }}
        onKeyUp={syncCursorFromDom}
        onMouseUp={syncCursorFromDom}
        onFocus={syncCursorFromDom}
        className={`workflow-prompt-textarea min-h-[52px] w-full overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent px-2 py-1 outline-none selection:bg-[#2f6df6] selection:text-white ${running ? "cursor-not-allowed text-[#999999] caret-transparent" : "text-[#111111] caret-[#111111]"}`}
        style={{ maxHeight, font: "14px / 24px var(--font-geist-sans), Arial, Helvetica, sans-serif" }}
      />
    </div>
  );
}

function WorkflowInputToast({ message, exiting }: { message: string; exiting?: boolean }) {
  return <div className={`pointer-events-none inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#111111] px-3 text-[12px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)] ${exiting ? "yinzao-asset-upload-tip-exit" : "yinzao-asset-upload-tip-enter"}`}><span>{message}</span></div>;
}

function WorkflowPromptBox({ node, value, placeholder, maxPromptHeight, onChange, children, running, onRun }: { node: WorkflowNode; value: string; placeholder: string; maxPromptHeight?: number; onChange: (value: string) => void; children: ReactNode; running?: boolean; onRun: () => void }) {
  const runtime = useWorkflowRuntime();
  const [isReferenceMenuOpen, setIsReferenceMenuOpen] = useState(false);
  const [referenceGroupType, setReferenceGroupType] = useState("character_image");
  const [activeAtQuery, setActiveAtQuery] = useState<{ index: number; query: string; cursor: number } | null>(null);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [localTip, setLocalTip] = useState<{ message: string; exiting?: boolean }>();
  const suppressAtTriggerUntilRef = useRef(0);
  const editorElementRef = useRef<HTMLDivElement | null>(null);
  const uploadsRef = useRef<WorkflowUploadItem[]>(node.data.uploads ?? []);
  const localTipTimerRef = useRef<number | null>(null);
  const connectedUploads = runtime.getConnectedInputUploads(node.id);
  const connectedTextLength = runtime.getInputTextLength(node.id);
  const showVideoReferenceModeMenu = node.kind === "video" && isWorkflowBytePlusSeedanceVideoModel(node.data.model);
  const selectedVideoReferenceMode = node.data.videoReferenceMode ?? "reference";
  const uploadRule = getEffectiveWorkflowUploadRule(node, runtime.uploadRuleOverrides, showVideoReferenceModeMenu ? selectedVideoReferenceMode : undefined);
  const requiredImageReferenceCount = showVideoReferenceModeMenu ? selectedVideoReferenceMode === "first_last_frame" ? 2 : selectedVideoReferenceMode === "first_frame" ? 1 : 0 : 0;
  const changeVideoReferenceMode = (videoReferenceMode: WorkflowVideoReferenceMode) => {
    runtime.updateNode(node.id, { videoReferenceMode, ...pruneWorkflowUploadsForVideoReferenceMode(node, videoReferenceMode, runtime.uploadRuleOverrides) });
  };
  const uploadButtons: Array<{ label: string; icon: IconType; ariaLabel: string; kind: WorkflowUploadKind; hideCount?: boolean; multiple?: boolean }> = showVideoReferenceModeMenu && selectedVideoReferenceMode === "first_frame"
    ? [{ label: "首帧", icon: RiImageLine, ariaLabel: "上传首帧图片", kind: "image", hideCount: true, multiple: false }]
    : showVideoReferenceModeMenu && selectedVideoReferenceMode === "first_last_frame"
      ? [
        { label: "首帧", icon: RiImageLine, ariaLabel: "上传首帧图片", kind: "image", hideCount: true, multiple: false },
        { label: "尾帧", icon: RiImageLine, ariaLabel: "上传尾帧图片", kind: "image", hideCount: true, multiple: false },
      ]
      : [
        { label: "图片", icon: RiImageLine, ariaLabel: "上传图片", kind: "image" },
        { label: "视频", icon: RiVideoOnLine, ariaLabel: "上传视频", kind: "video" },
        { label: "音频", icon: RiVoiceprintLine, ariaLabel: "上传音频", kind: "audio" },
        { label: "文件", icon: RiFileTextLine, ariaLabel: "上传文件", kind: "document" },
      ];
  const uploads = node.data.uploads ?? [];
  const visibleUploads = mergeWorkflowUploadItems([...connectedUploads, ...uploads]);
  const currentImageReferenceCount = showVideoReferenceModeMenu ? mergeWorkflowUploadItems([...visibleUploads.filter((upload) => upload.kind === "image"), ...getWorkflowPromptReferenceUrls(value, node, runtime.referenceAssets, "image").map((url) => ({ id: `prompt-image-${url}`, kind: "image" as const, name: url, url, status: "ready" as const }))]).length : 0;
  const canRun = (Boolean(value.trim()) || connectedTextLength > 0) && !running && currentImageReferenceCount >= requiredImageReferenceCount;
  const uploadCounts = visibleUploads.reduce<Record<WorkflowUploadKind, number>>((counts, upload) => ({ ...counts, [upload.kind]: counts[upload.kind] + 1 }), { image: 0, document: 0, video: 0, audio: 0 });
  const useSlotUploadLayout = showVideoReferenceModeMenu && (selectedVideoReferenceMode === "first_frame" || selectedVideoReferenceMode === "first_last_frame");
  const visibleUploadButtons = useSlotUploadLayout
    ? uploadButtons.slice(Math.min(uploadCounts.image, uploadButtons.length))
    : uploadButtons.filter(({ kind }) => canShowWorkflowUploadButton(kind, visibleUploads, uploadRule));

  const showLocalTip = (message: string) => {
    if (localTipTimerRef.current !== null) window.clearTimeout(localTipTimerRef.current);
    setLocalTip({ message });
    localTipTimerRef.current = window.setTimeout(() => {
      setLocalTip((current) => current ? { ...current, exiting: true } : current);
      localTipTimerRef.current = window.setTimeout(() => {
        setLocalTip(undefined);
        localTipTimerRef.current = null;
      }, 100);
    }, 3000);
  };

  const runFromPromptBox = () => {
    if (!canRun) return;
    const uploadError = validateWorkflowUploadsForSubmit({ ...node, data: { ...node.data, uploads: mergeWorkflowUploadItems([...(node.data.uploads ?? []), ...connectedUploads]) } }, runtime.uploadRuleOverrides, showVideoReferenceModeMenu ? selectedVideoReferenceMode : undefined);
    if (uploadError) {
      showLocalTip(uploadError);
      return;
    }
    onRun();
  };

  useEffect(() => {
    const close = () => setIsReferenceMenuOpen(false);
    window.addEventListener("workflow-close-popups", close);
    return () => window.removeEventListener("workflow-close-popups", close);
  }, []);

  useEffect(() => () => {
    if (localTipTimerRef.current !== null) window.clearTimeout(localTipTimerRef.current);
  }, []);

  useEffect(() => {
    uploadsRef.current = node.data.uploads ?? [];
  }, [node.data.uploads]);

  // 读实时 DOM 光标(非滞后 state)；无编辑器/未聚焦时回退 cursorOffset。
  const getCurrentWorkflowCursor = () => {
    const editor = editorElementRef.current;
    if (!editor) return Math.min(Math.max(0, cursorOffset), value.length);
    return Math.min(Math.max(0, getWorkflowSelectionTextOffset(editor)), value.length);
  };
  // 与对话流一致：rAF 等 DOM 渲染出新内容后再 focus + 定位光标(确定的 offset)。
  const focusWorkflowEditorAt = (offset: number) => {
    requestAnimationFrame(() => {
      const editor = editorElementRef.current;
      if (!editor) return;
      editor.focus();
      setWorkflowSelectionTextOffset(editor, offset);
      setCursorOffset(offset);
    });
  };

  const insertReferenceText = (name: string) => {
    const referenceText = `@${name} `;
    // 插到当前光标处(打字触发的 @ 弹窗用 activeAtQuery 位置)；插完光标停在新 @文件名 之后。
    const cursor = activeAtQuery ? activeAtQuery.index : getCurrentWorkflowCursor();
    const insertEnd = activeAtQuery ? activeAtQuery.cursor : cursor;
    const maxOwnPromptLength = Math.max(0, MAX_WORKFLOW_PROMPT_LENGTH - connectedTextLength);
    const rawNext = `${value.slice(0, cursor)}${referenceText}${value.slice(insertEnd)}`;
    const nextValue = Array.from(rawNext).slice(0, maxOwnPromptLength).join("");
    if (nextValue.length < rawNext.length) showLocalTip("输入框和连接文本合计最多2000字");
    const nextOffset = Math.min(maxOwnPromptLength, cursor + referenceText.length);
    suppressAtTriggerUntilRef.current = Date.now() + 500;
    onChange(nextValue);
    setActiveAtQuery(null);
    setIsReferenceMenuOpen(false);
    focusWorkflowEditorAt(nextOffset);
  };
  const updateUploads = (updater: (uploads: WorkflowUploadItem[]) => WorkflowUploadItem[]) => {
    const nextUploads = updater(uploadsRef.current);
    uploadsRef.current = nextUploads;
    runtime.updateNode(node.id, { uploads: nextUploads });
  };
  const insertAssetReference = (asset: WorkflowReferenceAsset) => {
    const existingUpload = visibleUploads.find((upload) => upload.kind === "image" && upload.url === asset.url);
    const nextUpload: WorkflowUploadItem = existingUpload ?? { id: createId("workflow_upload_asset"), kind: "image", name: asset.name, url: asset.url, previewUrl: asset.thumbnailUrl, status: "ready", progress: 100 };
    const imageCount = visibleUploads.filter((upload) => upload.kind === "image").length;
    if (!existingUpload && imageCount >= uploadRule.image.maxCount) {
      showLocalTip(`当前模型最多支持 ${uploadRule.image.maxCount} 张参考图，不能上传更多图片`);
      setIsReferenceMenuOpen(false);
      return;
    }
    if (!existingUpload) updateUploads((uploads) => [...uploads, nextUpload]);
    insertReferenceText(getWorkflowUploadReferenceName(nextUpload));
  };
  const removeUpload = (uploadId: string) => {
    const removing = (node.data.uploads ?? []).find((upload) => upload.id === uploadId);
    if (removing?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removing.previewUrl);
    if (removing) onChange(removeWorkflowUploadReferenceText(value, getWorkflowUploadReferenceName(removing)));
    updateUploads((uploads) => uploads.filter((upload) => upload.id !== uploadId));
  };
  const handleUploadFiles = async (kind: WorkflowUploadKind, files: File[]) => {
    const kindRule = uploadRule[kind];
    if (!kindRule.enabled) {
      showLocalTip(kind === "image" ? "当前模型不支持上传图片" : kind === "video" ? "当前模型不支持上传视频" : kind === "audio" ? "当前模型不支持上传音频" : "当前模型不支持上传文件");
      return;
    }
    const tips = new Set<string>();
    const accepted: Array<{ file: File; media?: { durationSeconds?: number; dimensions?: { width: number; height: number } } }> = [];
    let acceptedCount = visibleUploads.filter((item) => item.kind === kind).length;
    let acceptedDuration = kind === "video" || kind === "audio" ? visibleUploads.filter((item) => item.kind === kind).reduce((sum, upload) => sum + getWorkflowUploadDuration(upload), 0) : 0;

    for (const file of files) {
      const detectedKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : getUploadKindFromFileName(file.name);
      const extension = getWorkflowFileExtension(file);

      if (detectedKind !== kind) {
        tips.add("没有符合当前类型和格式限制的文件");
        continue;
      }
      if (!kindRule.formats.includes(extension)) {
        tips.add(kind === "image" ? "当前模型不支持该图片格式" : kind === "video" ? "当前模型不支持该视频格式" : kind === "audio" ? "当前模型不支持该音频格式" : "当前模型不支持该文件格式");
        continue;
      }
      if (file.size > kindRule.maxSizeMb * 1024 * 1024) {
        tips.add(kind === "image" ? `当前模型支持的单张图片最大为 ${kindRule.maxSizeMb}MB` : kind === "video" ? `当前模型支持的单个视频最大为 ${kindRule.maxSizeMb}MB` : kind === "audio" ? `当前模型支持的单个音频最大为 ${kindRule.maxSizeMb}MB` : `当前模型支持的单个文件最大为 ${kindRule.maxSizeMb}MB`);
        continue;
      }
      if (acceptedCount >= kindRule.maxCount) {
        tips.add(kind === "image" ? `当前模型最多支持 ${kindRule.maxCount} 张参考图，不能上传更多图片` : kind === "video" ? `当前模型最多支持 ${kindRule.maxCount} 个参考视频` : kind === "audio" ? `当前模型最多支持 ${kindRule.maxCount} 个参考音频` : `当前类型最多支持 ${kindRule.maxCount} 个文件`);
        continue;
      }

      if (kind === "video" || kind === "audio") {
        try {
          const media = await readWorkflowMediaFileMetadata(file, kind);
          const durationError = validateWorkflowMediaDuration(kind === "video" ? "视频" : "音频", media.durationSeconds, kindRule);
          const dimensionError = kind === "video" ? validateWorkflowReferenceVideoDimensions(media.dimensions) : undefined;
          const nextDuration = acceptedDuration + (media.durationSeconds ?? 0);
          if (durationError) tips.add(durationError);
          else if (dimensionError) tips.add(dimensionError);
          else if (kindRule.maxTotalSeconds !== undefined && nextDuration > kindRule.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) tips.add(kind === "video" ? `参考视频总时长不能超过 ${kindRule.maxTotalSeconds} 秒` : `参考音频总时长不能超过 ${kindRule.maxTotalSeconds} 秒`);
          else {
            accepted.push({ file, media });
            acceptedCount += 1;
            acceptedDuration = nextDuration;
          }
        } catch (error) {
          tips.add(toUserErrorMessage(error, kind === "video" ? "视频信息读取失败" : "音频信息读取失败"));
        }
        continue;
      }

      accepted.push({ file });
      acceptedCount += 1;
    }

    if (tips.size > 0) showLocalTip(Array.from(tips)[0]);
    if (accepted.length === 0) {
      if (tips.size === 0) showLocalTip("没有符合当前类型和格式限制的文件");
      return;
    }
    runtime.uploadFilesAsConnectedNodes(node.id, accepted.map(({ file }) => file), showLocalTip);
  };
  const validReferenceNames = useMemo(() => new Set([...runtime.referenceAssets.map((asset) => asset.name), ...visibleUploads.filter((upload) => upload.status === "ready").map(getWorkflowUploadReferenceName)]), [runtime.referenceAssets, visibleUploads]);
  const referenceGroups = runtime.referenceAssets.reduce<{ type: string; label: string; assets: WorkflowReferenceAsset[] }[]>((groups, asset) => {
    const matched = !activeAtQuery?.query || asset.name.includes(activeAtQuery.query);
    const group = groups.find((item) => item.type === asset.groupType);
    if (group) {
      if (matched) group.assets.push(asset);
      return groups;
    }
    groups.push({ type: asset.groupType, label: asset.groupLabel, assets: matched ? [asset] : [] });
    return groups;
  }, []);
  const activeReferenceGroup = referenceGroups.find((group) => group.type === referenceGroupType && group.assets.length > 0) ?? referenceGroups.find((group) => group.assets.length > 0) ?? referenceGroups[0];
  const isReferenceAssetsLoading = runtime.referenceAssetsLoadStatus === "loading";
  // 只有"本地解析不了的 @mention"(即资产库里的引用，需要读库解析)才触发加载/转圈。
  // 连线到画布上的图/视频在 validReferenceNames 里，点它的 @文件名 直接插入蓝字，不读库、不转圈。
  const hasUnresolvedMention = useMemo(() => getWorkflowMentionNames(value).some((name) => !validReferenceNames.has(name)), [value, validReferenceNames]);
  const isWaitingForMentionReferences = hasUnresolvedMention && (runtime.referenceAssetsLoadStatus === "idle" || runtime.referenceAssetsLoadStatus === "loading");
  useEffect(() => {
    if (!hasUnresolvedMention) return;
    runtime.onLoadReferenceAssets?.();
  }, [hasUnresolvedMention, runtime.onLoadReferenceAssets]);
  const closeMenusIfOutsideMenu = (target: EventTarget | null) => {
    if (!(target as HTMLElement | null)?.closest("[data-workflow-menu]")) closeWorkflowPopups();
  };

  return (
    <div
      className="relative z-20 rounded-[26px] border-2 border-[#f1f2f2] bg-white/78 px-4 py-4 shadow-none backdrop-blur-[18px] transition focus-within:border-white/70 focus-within:shadow-[0_10px_32px_rgba(0,0,0,0.12)]"
      onPointerDownCapture={(event) => closeMenusIfOutsideMenu(event.target)}
      onClickCapture={(event) => closeMenusIfOutsideMenu(event.target)}
      onFocusCapture={(event) => closeMenusIfOutsideMenu(event.target)}
    >
      {localTip ? <div className="pointer-events-none absolute bottom-full left-1/2 z-[10000] mb-3 -translate-x-1/2"><WorkflowInputToast message={localTip.message} exiting={localTip.exiting} /></div> : null}
      <div className="mb-2 flex min-h-[76px] flex-wrap items-start gap-2 px-0.5">
        {!useSlotUploadLayout ? visibleUploadButtons.map(({ label, icon: Icon, ariaLabel, kind, hideCount, multiple = true }) => (
          <label key={label} style={{ backgroundColor: "#ededed" }} className="workflow-upload-chip flex h-[70px] w-[64px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] text-[#a7a7a7] transition" aria-label={ariaLabel} title={getWorkflowUploadAccept(uploadRule, kind)}>
            <input type="file" hidden multiple={multiple} accept={getWorkflowUploadAccept(uploadRule, kind)} onChange={(event) => { void handleUploadFiles(kind, Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            <span className="text-[12px] leading-none">{label}</span>
            {hideCount ? null : <span className="text-[10px] leading-none text-[#b5b5b5]">1-{uploadRule[kind].maxCount}</span>}
          </label>
        )) : null}
        {visibleUploads.map((upload) => {
          const referenceName = getWorkflowUploadReferenceName(upload);
          const canInsert = upload.status === "ready";
          const mediaSrc = getWorkflowUploadMediaSrc(upload);
          const isVisual = upload.kind === "image" || upload.kind === "video";
          const isConnectedUpload = upload.readonlySource === "connection";

          return (
            <div key={upload.id} className="group relative h-[70px] w-[64px] shrink-0 overflow-visible">
              <div className={`relative h-full w-full overflow-hidden rounded-[16px] border ${isVisual ? "border-[#e5e5e5] bg-[#f7f7f7]" : "border-[#e1e1e1] bg-white text-[#777777]"}`}>
                {isVisual ? (
                mediaSrc ? upload.kind === "video" ? (
                  <>
                    <video src={mediaSrc} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/58 text-white shadow-[0_4px_12px_rgba(0,0,0,0.22)]">
                      <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current" />
                    </div>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <WorkflowHoverImagePreview src={upload.url ?? mediaSrc} alt={upload.name} wrapperClassName="block h-full w-full"><img src={mediaSrc} alt={upload.name} className="h-full w-full object-cover" /></WorkflowHoverImagePreview>
                ) : <div className="flex h-full w-full items-center justify-center text-[#b5b5b5]"><WorkflowUploadIcon kind={upload.kind} /></div>
              ) : (
                <div className="flex h-full w-full items-center justify-center pb-[18px]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[#8a8a8a] [&>svg]:h-6 [&>svg]:w-6">
                    <WorkflowUploadIcon kind={upload.kind} />
                  </div>
                </div>
                )}
              <button type="button" disabled={!canInsert} onMouseDown={(event) => event.preventDefault()} onClick={() => insertReferenceText(referenceName)} className={`absolute inset-x-0 bottom-0 z-10 block truncate px-1.5 pb-0.5 pt-4 text-left font-medium leading-4 transition disabled:cursor-not-allowed disabled:opacity-75 ${isVisual ? "bg-gradient-to-t from-black/75 to-transparent text-white" : "text-[#555555]"}`}>
                <span className="text-[10px] leading-4">{canInsert ? `@${referenceName}` : upload.status === "error" ? "上传失败" : "上传中..."}</span>
              </button>
              {upload.status === "uploading" ? <WorkflowUploadProgressOverlay progress={upload.progress} /> : null}
              {upload.status === "error" && isVisual ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/58 px-2 text-center text-[12px] font-semibold text-white">上传失败</div> : null}
              </div>
              <button type="button" onClick={(event) => {
                event.stopPropagation();
                if (isConnectedUpload && upload.sourceNodeId) {
                  onChange(removeWorkflowUploadReferenceText(value, referenceName));
                  runtime.disconnectNodes(upload.sourceNodeId, node.id);
                  return;
                }
                removeUpload(upload.id);
              }} className="absolute right-[-5px] top-[-5px] z-30 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black text-white transition hover:bg-black" aria-label={isConnectedUpload ? "断开连接" : "移除上传文件"}>
                <RiCloseLine className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {useSlotUploadLayout ? visibleUploadButtons.map(({ label, icon: Icon, ariaLabel, kind, hideCount, multiple = true }) => (
          <label key={label} style={{ backgroundColor: "#ededed" }} className="workflow-upload-chip flex h-[70px] w-[64px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] text-[#a7a7a7] transition" aria-label={ariaLabel} title={getWorkflowUploadAccept(uploadRule, kind)}>
            <input type="file" hidden multiple={multiple} accept={getWorkflowUploadAccept(uploadRule, kind)} onChange={(event) => { void handleUploadFiles(kind, Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            <span className="text-[12px] leading-none">{label}</span>
            {hideCount ? null : <span className="text-[10px] leading-none text-[#b5b5b5]">1-{uploadRule[kind].maxCount}</span>}
          </label>
        )) : null}
      </div>
      {isWaitingForMentionReferences ? (
        <div className="flex min-h-[52px] items-center gap-2 px-2 py-1 text-[13px] leading-6 text-[#8a8a8a]" style={{ font: "14px / 24px var(--font-geist-sans), Arial, Helvetica, sans-serif" }}>
          <RiLoader4Line className="h-4 w-4 animate-spin text-[#367cee]" aria-hidden="true" />
          <span>加载引用资产...</span>
        </div>
      ) : (
        <WorkflowMentionEditor value={value} placeholder={placeholder} running={running} maxHeight={maxPromptHeight} maxLength={Math.max(0, MAX_WORKFLOW_PROMPT_LENGTH - connectedTextLength)} validReferences={validReferenceNames} externalEditorRef={editorElementRef} onChange={onChange} onRun={runFromPromptBox} onPasteImages={(files) => { void handleUploadFiles("image", files); }} onLimit={() => showLocalTip("输入框和连接文本合计最多2000字")} onCursorChange={setCursorOffset} onAtTrigger={(query) => { if (Date.now() < suppressAtTriggerUntilRef.current) return; runtime.onLoadReferenceAssets?.(); setActiveAtQuery(query); setIsReferenceMenuOpen(true); }} onAtClose={() => { setActiveAtQuery(null); setIsReferenceMenuOpen(false); }} />
      )}
      <div className="mt-3 flex min-w-0 flex-nowrap items-center justify-between gap-3 pb-0.5">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-[12px]">
          <div data-workflow-menu className="relative shrink-0" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { const shouldOpen = !isReferenceMenuOpen; closeWorkflowPopups(); setActiveAtQuery(null); if (shouldOpen) runtime.onLoadReferenceAssets?.(); setIsReferenceMenuOpen(shouldOpen); }} className={`yinzao-tool-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] p-0 text-[#777777] outline-none transition ${isReferenceMenuOpen ? "yinzao-tool-button-active" : ""}`} aria-label="引用资产">
              <span className="text-[15px] font-semibold leading-none">@</span>
            </button>
            {isReferenceMenuOpen ? (
              <div onScroll={(event) => { const el = event.currentTarget; if (!activeAtQuery?.query && activeReferenceGroup && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) { const serverCount = Number(runtime.referenceAssetCounts?.[activeReferenceGroup.type]); if (Number.isFinite(serverCount) && activeReferenceGroup.assets.length < serverCount) runtime.onLoadMoreReferenceAssets?.(activeReferenceGroup.type, activeReferenceGroup.assets.length); } }} className="absolute bottom-full left-0 z-[10000] mb-2 max-h-80 w-[380px] overflow-y-auto rounded-[12px] bg-white p-2 text-left shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
                <div className="px-2 pb-2 text-[12px] text-[#8a8a8a]">引用资产</div>
                {isReferenceAssetsLoading ? <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] font-medium text-[#367cee]"><RiLoader4Line className="h-[18px] w-[18px] animate-spin" /><span>加载中...</span></div> : null}
                {!isReferenceAssetsLoading ? <>
                  <div className="mb-2 flex flex-nowrap gap-1.5 px-1">
                    {referenceGroups.map((group) => {
                      const serverCount = Number(runtime.referenceAssetCounts?.[group.type]);
                      const count = Number.isFinite(serverCount) ? Math.max(serverCount, group.assets.length) : group.assets.length;
                      const isActive = activeReferenceGroup?.type === group.type;
                      return (
                        <button key={group.type} type="button" disabled={count === 0} onClick={() => setReferenceGroupType(group.type)} className={isActive ? "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#111111] px-2 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" : "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#f4f4f4] px-2 text-[12px] font-medium text-[#666666] transition hover:bg-[#ececec] disabled:cursor-not-allowed disabled:opacity-40"}>
                          <span className="whitespace-nowrap text-[12px] leading-none">{group.label}({count})</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeReferenceGroup?.assets.length > 0 ? activeReferenceGroup.assets.map((asset) => (
                    <button key={asset.id} type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); insertAssetReference(asset); }} className="flex h-12 w-full items-center gap-3 rounded-[8px] px-2 text-left transition hover:bg-[#f5f5f5]">
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-[8px] bg-[#eeeeee]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <WorkflowHoverImagePreview src={asset.url} alt={asset.name} wrapperClassName="block h-full w-full"><img src={asset.thumbnailUrl ?? asset.url} alt={asset.name} className="h-full w-full object-cover" /></WorkflowHoverImagePreview>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#222222]">@{asset.name}</div>
                        <div className="text-[11px] text-[#999999]">{asset.groupLabel}</div>
                      </div>
                    </button>
                  )) : <div className="flex h-20 items-center justify-center text-[13px] text-[#999999]">暂无可引用资产</div>}
                </> : null}
              </div>
            ) : null}
          </div>
          {children}
        </div>
        {showVideoReferenceModeMenu ? <WorkflowVideoReferenceModeMenu value={selectedVideoReferenceMode} onChange={changeVideoReferenceMode} /> : null}
        <button type="button" disabled={!canRun} onClick={runFromPromptBox} className="inline-flex h-9 w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#111111] text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white" aria-label="生成">
          {running ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiArrowUpLine className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
const workflowToolButtonClassName = "yinzao-tool-button inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-2.5 text-[13px] text-[#777777] outline-none transition";
function useWorkflowMenuOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("workflow-close-popups", close);
    return () => window.removeEventListener("workflow-close-popups", close);
  }, []);
  const toggle = () => { const shouldOpen = !open; closeWorkflowPopups(); setOpen(shouldOpen); };
  return { open, setOpen, toggle };
}
function useWorkflowRowMenu() {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  const containerRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const handle = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", handle, true);
    return () => window.removeEventListener("pointerdown", handle, true);
  }, [open, setOpen]);
  const close = () => setOpen(false);
  return { open, toggle, close, containerRef };
}

function WorkflowModelMenuSingle({ value, options, title, onChange, className = "", getIcon }: { value: ModelName; options: readonly (ConversationModel | GenerationModel)[]; title: string; onChange: (value: ModelName) => void; className?: string; getIcon?: (modelId: string) => typeof BytePlusIcon | typeof RiOpenaiFill | typeof RiGoogleFill | typeof RiTiktokFill | null }) {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  const SelectedIcon = getIcon?.(value) ?? getGenerationModelIcon(value);
  const selectedLabel = getModelLabel(options, value);
  const selectedGold = isGoldGenerationModel(value);
  return <div data-workflow-menu className={`relative min-w-0 ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={toggle} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} justify-start whitespace-nowrap`}><span className="flex min-w-0 flex-nowrap items-center gap-1.5">{SelectedIcon ? <SelectedIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /> : <AiGenerate3dIcon />}<span className={`min-w-0 truncate whitespace-nowrap font-medium ${selectedGold ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedLabel}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>{options.map((option) => { const ModelIcon = getIcon?.(option.id) ?? getGenerationModelIcon(option.id); const selected = option.id === value; const gold = isGoldGenerationModel(option.id); return <button key={option.id} type="button" onClick={() => { onChange(option.id as ModelName); setOpen(false); }} className={selected ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span className="flex min-w-0 items-center gap-2">{ModelIcon ? <ModelIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /> : <AiGenerate3dIcon />}<span className={`min-w-0 truncate ${gold ? "text-[#b8860b]" : ""}`}>{option.label}</span></span>{selected ? <RiCheckLine className="h-[18px] w-[18px] shrink-0 text-[#111111]" /> : null}</button>; })}</div> : null}</div>;
}

function WorkflowSettingsMenuSingle({ mode, model, ratio, resolution, ratios, resolutions, onChange, className = "" }: { mode: "image" | "video"; model?: ModelName; ratio: string; resolution: string; ratios: string[]; resolutions: string[]; onChange: (patch: { ratio?: string; resolution?: string }) => void; className?: string }) {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  const dimensions = mode === "image" ? getExpectedImageDimensions(model, resolution, ratio) : getExpectedVideoDimensions(model, resolution, ratio);
  return <div data-workflow-menu className={`relative ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={toggle} className={`relative ${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} pl-10`}><span className="flex min-w-0 flex-nowrap items-center gap-2"><span className="font-medium text-[#777777]">{ratio} /</span><span className="font-medium text-[#777777]">{resolution}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span><span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={ratio} /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[min(420px,calc(100vw-40px))] rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div><div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">{ratios.map((option) => <button key={option} type="button" onClick={() => { onChange({ ratio: option }); setOpen(false); }} className={option === ratio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}><RatioOptionIcon option={option} /><span className="text-[13px] font-medium leading-none">{option}</span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div><div className={`mt-2 grid rounded-[12px] bg-[#f6f6f6] py-1 ${mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2"} ${resolutions.length === 1 ? "grid-cols-1" : resolutions.length === 2 ? "grid-cols-2" : resolutions.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>{resolutions.map((option) => <button key={option} type="button" onClick={() => { onChange(mode === "video" ? { resolution: option, ratio: normalizeVideoRatioForModel(model, ratio, option) } : { resolution: option }); setOpen(false); }} className={option === resolution ? `flex h-[56px] items-center justify-center rounded-[10px] bg-white ${mode === "video" ? "px-2" : "px-4"} text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]` : `flex h-[56px] items-center justify-center rounded-[10px] ${mode === "video" ? "px-2" : "px-4"} text-[#666666] transition hover:bg-white/80`}><span className={`flex items-center ${mode === "video" ? "gap-1.5" : "gap-2"} whitespace-nowrap text-[13px] font-medium leading-none`}><CompactResolutionIcon option={option} mode={mode} /><span>{option}</span></span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">尺寸</div><div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3"><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">W</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.width)}</span></div><div className="flex h-[48px] w-[24px] items-center justify-center text-[#8a8a8a]">×</div><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">H</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.height)}</span></div><div className="text-[13px] font-medium text-[#8a8a8a]">PX</div></div></div> : null}</div>;
}

function WorkflowDurationMenuSingle({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  const sortedOptions = sortWorkflowDurationOptions(options);
  return <div data-workflow-menu className="relative" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={toggle} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""}`}><RiTimeLine className="h-[18px] w-[18px] shrink-0 text-[#777777]" /><span className="font-medium text-[#777777]">{value}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 max-h-[420px] min-w-[180px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">视频时长</div>{sortedOptions.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={option === value ? "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span className="flex items-center gap-2"><RiTimeLine className="h-[17px] w-[17px] shrink-0 text-[#777777]" /><span>{option}</span></span>{option === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" /> : null}</button>)}</div> : null}</div>;
}

function WorkflowVideoReferenceModeMenu({ value, onChange }: { value: WorkflowVideoReferenceMode; onChange: (value: WorkflowVideoReferenceMode) => void }) {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  const SelectedIcon = workflowVideoReferenceModeOptions.find((option) => option.value === value)?.icon ?? RiImageCircleLine;
  return <div data-workflow-menu className="relative" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={toggle} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""}`}><SelectedIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /><span className="font-medium text-[#777777]">{getWorkflowVideoReferenceModeLabel(value)}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></button>{open ? <div className="absolute bottom-full right-0 z-[10000] mb-2 min-w-[180px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">参考模式</div>{workflowVideoReferenceModeOptions.map((option) => { const OptionIcon = option.icon; return <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} className={option.value === value ? "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span className="flex items-center gap-2"><OptionIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /><span>{option.label}</span></span>{option.value === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" /> : null}</button>; })}</div> : null}</div>;
}
function WorkflowSettingsMenuV2({ mode, model, ratio, resolution, ratios, resolutions, onChange, className = "" }: { mode: "image" | "video"; model?: ModelName; ratio: string; resolution: string; ratios: string[]; resolutions: string[]; onChange: (patch: { ratio?: string; resolution?: string }) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const resolutionGridClassName = mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2";
  const resolutionButtonPaddingClassName = mode === "video" ? "px-2" : "px-4";
  const resolutionLabelGapClassName = mode === "video" ? "gap-1.5" : "gap-2";
  const dimensions = mode === "image" ? getExpectedImageDimensions(model, resolution, ratio) : getExpectedVideoDimensions(model, resolution, ratio);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("workflow-close-popups", close);
    return () => window.removeEventListener("workflow-close-popups", close);
  }, []);

  return <div className={`relative ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`relative ${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} pl-10`}><span className="flex min-w-0 flex-nowrap items-center gap-2"><span className="font-medium text-[#777777]">{ratio} /</span><span className="font-medium text-[#777777]">{resolution}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span><span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={ratio} /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[min(420px,calc(100vw-40px))] rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div><div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">{ratios.map((option) => <button key={option} type="button" onClick={() => onChange({ ratio: option })} className={option === ratio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}><RatioOptionIcon option={option} /><span className="text-[13px] font-medium leading-none">{option}</span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div><div className={`mt-2 grid ${resolutionGridClassName} rounded-[12px] bg-[#f6f6f6] py-1 ${resolutions.length === 1 ? "grid-cols-1" : resolutions.length === 2 ? "grid-cols-2" : resolutions.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>{resolutions.map((option) => <button key={option} type="button" onClick={() => onChange(mode === "video" ? { resolution: option, ratio: normalizeVideoRatioForModel(model, ratio, option) } : { resolution: option })} className={option === resolution ? `flex h-[56px] items-center justify-center rounded-[10px] bg-white ${resolutionButtonPaddingClassName} text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]` : `flex h-[56px] items-center justify-center rounded-[10px] ${resolutionButtonPaddingClassName} text-[#666666] transition hover:bg-white/80`}><span className={`flex items-center ${resolutionLabelGapClassName} whitespace-nowrap text-[13px] font-medium leading-none`}><CompactResolutionIcon option={option} mode={mode} /><span>{option}</span></span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">尺寸</div><div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3"><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">W</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.width)}</span></div><div className="flex h-[48px] w-[24px] items-center justify-center text-[#8a8a8a]"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M4 4L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></div><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">H</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.height)}</span></div><div className="text-[13px] font-medium text-[#8a8a8a]">PX</div></div></div> : null}</div>;
}
function getGenerationModelIcon(modelId: string) { if (modelId.startsWith("byteplus:") || modelId.startsWith("byteplus/") || modelId.startsWith("ep-")) return BytePlusIcon; if (modelId.startsWith("openai/")) return RiOpenaiFill; if (modelId.startsWith("google/")) return RiGoogleFill; if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return RiTiktokFill; return null; }
function isGoldGenerationModel(modelId: string) { return modelId === "openai/gpt-5.4-image-2" || modelId === "bytedance/seedance-2.0" || modelId === "byteplus:video.seedance-2-0"; }
function getModelLabel(options: readonly (ConversationModel | GenerationModel)[], value: string) { return options.find((item) => item.id === value)?.label ?? value; }
function AiGenerate3dIcon({ className = "h-[18px] w-[18px] shrink-0 text-[#777777]" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" /></svg>; }
function RatioOptionIcon({ option }: { option: string }) { const meta = ratioCardMeta[option] ?? ratioCardMeta["1:1"]; if (meta.icon === "spark") return <RiShining2Line className="h-[18px] w-[18px] shrink-0 text-[#777777]" />; return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0 text-[#777777]"><rect x={(18 - Number(meta.width)) / 2} y={(18 - Number(meta.height)) / 2} width={meta.width} height={meta.height} rx="2.2" stroke="currentColor" strokeWidth="1.4" /></svg>; }
function CompactResolutionIcon({ option, mode }: { option?: string; mode: "image" | "video" }) { if (mode === "video") return <span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[3px] bg-[#111111] px-1 text-[9px] font-bold leading-none text-white">{option === "480p" ? "SD" : option === "1080p" ? "FHD" : option === "4K" ? "4K" : "HD"}</span>; return <span className="inline-flex h-4 min-w-5 items-center justify-center rounded-[3px] border border-[#d5d5d5] px-1 text-[9px] font-bold leading-none text-[#777777]">{option ?? "1K"}</span>; }
function WorkflowModelMenu({ value, options, title, onChange, className = "" }: { value: ModelName; options: readonly (ConversationModel | GenerationModel)[]; title: string; onChange: (value: ModelName) => void; className?: string }) { const [open, setOpen] = useState(false); const SelectedIcon = getGenerationModelIcon(value); const selectedLabel = getModelLabel(options, value); const selectedGold = isGoldGenerationModel(value); return <div className={`relative min-w-0 ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} w-full max-w-none justify-start whitespace-nowrap`}><span className="flex min-w-0 flex-nowrap items-center gap-2">{SelectedIcon ? <SelectedIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /> : <AiGenerate3dIcon />}<span className={`min-w-0 truncate whitespace-nowrap font-medium ${selectedGold ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedLabel}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>{options.map((option) => { const ModelIcon = getGenerationModelIcon(option.id); const selected = option.id === value; const gold = isGoldGenerationModel(option.id); return <button key={option.id} type="button" onClick={() => { onChange(option.id as ModelName); setOpen(false); }} className={selected ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span className="flex min-w-0 items-center gap-2">{ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" /> : <AiGenerate3dIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" />}<span className={`min-w-0 truncate text-[13px] ${gold ? "text-[#b8860b]" : ""}`}>{option.label}</span></span>{selected ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" /> : null}</button>; })}</div> : null}</div>; }
function WorkflowSettingsMenu({ mode, ratio, resolution, ratios, resolutions, onChange, className = "" }: { mode: "image" | "video"; ratio: string; resolution: string; ratios: string[]; resolutions: string[]; onChange: (patch: { ratio?: string; resolution?: string }) => void; className?: string }) { const [open, setOpen] = useState(false); const isSmartSettings = mode === "image" && ratio === "智能比例"; const resolutionGridClassName = mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2"; return <div className={`relative ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`relative ${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} pl-10`}><span className="flex min-w-0 flex-nowrap items-center gap-2"><span className="font-medium text-[#777777]">{ratio} /</span><span className="font-medium text-[#777777]">{resolution}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span><span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={ratio} /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[min(420px,calc(100vw-40px))] rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div><div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">{ratios.map((option) => <button key={option} type="button" onClick={() => onChange({ ratio: option })} className={option === ratio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}><RatioOptionIcon option={option} /><span className="text-[13px] font-medium leading-none">{option === "智能比例" ? "智能" : option}</span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div><div className={`mt-2 grid ${resolutionGridClassName} rounded-[12px] bg-[#f6f6f6] py-1 ${resolutions.length === 1 ? "grid-cols-1" : resolutions.length === 2 ? "grid-cols-2" : resolutions.length === 3 ? "grid-cols-3" : "grid-cols-4"} ${isSmartSettings ? "opacity-45" : ""}`}>{resolutions.map((option) => <button key={option} type="button" disabled={isSmartSettings} onClick={() => onChange({ resolution: option })} className={option === resolution ? "flex h-[56px] items-center justify-center gap-2 rounded-[10px] bg-white px-2 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)] disabled:cursor-not-allowed" : "flex h-[56px] items-center justify-center gap-2 rounded-[10px] px-2 text-[#666666] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:hover:bg-transparent"}><CompactResolutionIcon option={option} mode={mode} /><span className="whitespace-nowrap text-[13px] font-medium leading-none">{option}</span></button>)}</div></div> : null}</div>; }
function WorkflowDurationMenu({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { const [open, setOpen] = useState(false); return <div className="relative" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""}`}><RiTimeLine className="h-[18px] w-[18px] shrink-0 text-[#777777]" /><span className="font-medium text-[#777777]">{value}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 max-h-[420px] min-w-[180px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">视频时长</div>{options.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={option === value ? "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span>{option}</span>{option === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" /> : null}</button>)}</div> : null}</div>; }
function ImageNodeEditor({ node, modelOptions, promptMaxHeight, onChange, onRun }: { node: WorkflowNode; modelOptions: WorkflowModelOptions; promptMaxHeight?: number; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) { const model = modelOptions.imageModels.some((item) => item.id === node.data.model) ? node.data.model ?? DEFAULT_IMAGE_MODEL : (modelOptions.imageModels[0]?.id as ModelName | undefined) ?? DEFAULT_IMAGE_MODEL; const supportedResolutions = getSupportedImageResolutions(model); const ratio = imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio as string : "16:9"; return <div className="space-y-2"><WorkflowPromptBox node={node} value={node.data.prompt ?? ""} placeholder="输入提示词，也可以连接文本节点" maxPromptHeight={promptMaxHeight} onChange={(value) => onChange(node.id, { prompt: value })} running={node.data.isRunning} onRun={onRun}><WorkflowModelMenuSingle value={model} options={modelOptions.imageModels} title="选择模型" onChange={(value) => onChange(node.id, { model: value, ratio, resolution: normalizeImageResolutionForModel(value, node.data.resolution), ...pruneWorkflowUploadsForModel(node, value) })} className="w-[190px] shrink-0" /><WorkflowSettingsMenuSingle mode="image" model={model} ratio={ratio} resolution={node.data.resolution ?? supportedResolutions[0]} ratios={imageRatioOptions} resolutions={supportedResolutions} onChange={(patch) => onChange(node.id, patch)} className="shrink-0" /></WorkflowPromptBox></div>; }
function VideoNodeEditor({ node, modelOptions, promptMaxHeight, onChange, onRun }: { node: WorkflowNode; modelOptions: WorkflowModelOptions; promptMaxHeight?: number; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) { const model = modelOptions.videoModels.some((item) => item.id === node.data.model) ? node.data.model ?? DEFAULT_VIDEO_MODEL : (modelOptions.videoModels[0]?.id as ModelName | undefined) ?? DEFAULT_VIDEO_MODEL; const supportedResolutions = getSupportedVideoResolutions(model); const resolution = normalizeVideoResolutionForModel(model, node.data.resolution); const supportedRatios = getSupportedVideoRatios(model, resolution); const ratio = (supportedRatios as readonly string[]).includes(node.data.ratio ?? "") ? node.data.ratio as string : supportedRatios[0]; const durationOptions = modelOptions.videoModels.find((item) => item.id === model)?.durations ?? fallbackVideoDurationOptions; return <div className="space-y-2"><WorkflowPromptBox node={node} value={node.data.prompt ?? ""} placeholder="输入提示词，也可以连接文本节点" maxPromptHeight={promptMaxHeight} onChange={(value) => onChange(node.id, { prompt: value })} running={node.data.isRunning} onRun={onRun}><WorkflowModelMenuSingle value={model} options={modelOptions.videoModels} title="选择模型" onChange={(value) => { const nextResolution = normalizeVideoResolutionForModel(value, node.data.resolution); onChange(node.id, { model: value, resolution: nextResolution, ratio: normalizeVideoRatioForModel(value, ratio, nextResolution), duration: value === DEFAULT_WORKFLOW_VIDEO_MODEL ? "8秒" : modelOptions.videoModels.find((item) => item.id === value)?.durations?.[0] ?? "5秒" }); }} className="w-[190px] shrink-0" /><WorkflowSettingsMenuSingle mode="video" model={model} ratio={ratio} resolution={resolution} ratios={supportedRatios} resolutions={supportedResolutions} onChange={(patch) => onChange(node.id, patch)} className="shrink-0" /><WorkflowDurationMenuSingle value={node.data.duration ?? durationOptions[0]} options={durationOptions} onChange={(value) => onChange(node.id, { duration: value })} /></WorkflowPromptBox></div>; }
