"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import { RiAddLine, RiArrowDownSLine, RiArrowUpLine, RiCheckLine, RiCloseLine, RiCursorLine, RiEmotionSadLine, RiEyeLine, RiFileTextLine, RiFilmLine, RiFocus3Line, RiGoogleFill, RiHand, RiImageAiLine, RiLoader4Line, RiOpenaiFill, RiPlayLargeFill, RiResetLeftLine, RiShining2Line, RiTBoxLine, RiTimeLine, RiTiktokFill, RiVideoLine, RiZoomInLine, RiZoomOutLine } from "react-icons/ri";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, bytePlusVideoGenerationModels, frontendConversationModels, frontendImageGenerationModels, getSupportedImageResolutions, getSupportedVideoRatios, getSupportedVideoResolutions, imageGenerationModels, normalizeImageResolutionForModel, normalizeVideoRatioForModel, normalizeVideoResolutionForModel, videoGenerationModels, type ConversationModel, type GenerationModel, type ModelName } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";

export type WorkflowNodeKind = "text" | "image" | "video";

export type WorkflowNodeData = {
  text?: string;
  outputText?: string;
  prompt?: string;
  model?: ModelName;
  ratio?: string;
  resolution?: string;
  duration?: string;
  images?: string[];
  imageDimensions?: Record<string, { width: number; height: number }>;
  videoUrl?: string;
  posterUrl?: string;
  mediaSystemNames?: Record<string, string>;
  error?: string;
  isRunning?: boolean;
  taskId?: string;
  startedAt?: number;
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
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
};

type WorkflowModelOptions = {
  imageModels: readonly GenerationModel[];
  videoModels: readonly GenerationModel[];
};

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
  onGeneratedMedia?: (media: { nodeId: string; kind: "image" | "video"; urls: string[]; posterUrl?: string; sourcePrompt: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: Record<string, { width: number; height: number }> }) => void;
  onPreviewMedia?: (media: { nodeId: string; kind: "image" | "video"; url: string; posterUrl?: string; name: string; sourcePrompt?: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: { width: number; height: number } }) => void;
  getImageDisplayUrl?: (url: string) => string;
  getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined;
  enabledImageModelIds?: string[];
  enabledVideoModelIds?: string[];
};

type DragState = {
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PanState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const NODE_WIDTH = 320;
const NODE_HEIGHT_ESTIMATE = 430;
const CARD_WIDTH = 320;
const CARD_HEIGHT = 180;
const DEFAULT_STATE: WorkflowCanvasState = { nodes: [], edges: [] };
const imageRatioOptions = ["智能比例", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const fallbackVideoDurationOptions = ["5秒", "10秒", "15秒"];
const workflowVideoModels = [...videoGenerationModels, ...bytePlusVideoGenerationModels];
const videoPollIntervalMs = 10_000;
const videoMaxPollAttempts = 90;

const ratioCardMeta: Record<string, { icon: string; width: string; height: string }> = {
  智能比例: { icon: "spark", width: "16", height: "16" },
  "16:9": { icon: "rect", width: "18", height: "10" },
  "21:9": { icon: "rect", width: "18", height: "8" },
  "9:16": { icon: "rect", width: "10", height: "18" },
  "1:1": { icon: "rect", width: "14", height: "14" },
  "3:4": { icon: "rect", width: "12", height: "16" },
  "4:3": { icon: "rect", width: "16", height: "12" },
};

function normalizeZoom(value: number) {
  const clamped = Math.min(1.8, Math.max(0.4, value));
  if (Math.abs(clamped - 1) <= 0.04) return 1;
  return Number(clamped.toFixed(2));
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getNodeLabel(kind: WorkflowNodeKind) {
  if (kind === "text") return "文本生成";
  if (kind === "image") return "图片生成";
  return "视频生成";
}

function getNodeIcon(kind: WorkflowNodeKind) {
  if (kind === "text") return RiTBoxLine;
  if (kind === "image") return RiImageAiLine;
  return RiVideoLine;
}

function getDefaultNodeData(kind: WorkflowNodeKind): WorkflowNodeData {
  if (kind === "text") return { model: DEFAULT_CHAT_MODEL, prompt: "" };
  if (kind === "video") {
    const resolution = normalizeVideoResolutionForModel(DEFAULT_VIDEO_MODEL, getSupportedVideoResolutions(DEFAULT_VIDEO_MODEL)[0]);
    return { model: DEFAULT_VIDEO_MODEL, ratio: normalizeVideoRatioForModel(DEFAULT_VIDEO_MODEL, "16:9", resolution), resolution, duration: workflowVideoModels.find((model) => model.id === DEFAULT_VIDEO_MODEL)?.durations?.[0] ?? "5秒", prompt: "" };
  }
  const defaultImageModel = frontendImageGenerationModels.some((model) => model.id === DEFAULT_IMAGE_MODEL) ? DEFAULT_IMAGE_MODEL : frontendImageGenerationModels[0]?.id ?? DEFAULT_IMAGE_MODEL;
  const resolution = normalizeImageResolutionForModel(defaultImageModel, getSupportedImageResolutions(defaultImageModel)[0]);
  return { model: defaultImageModel, ratio: "智能比例", resolution, prompt: "" };
}

function normalizeState(value?: WorkflowCanvasState): WorkflowCanvasState {
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return DEFAULT_STATE;
  const nodes = value.nodes
    .filter((node) => node && typeof node.id === "string" && (node.kind === "text" || node.kind === "image" || node.kind === "video"))
    .map((node) => ({
      ...node,
      title: typeof node.title === "string" && node.title.trim() ? node.title : getNodeLabel(node.kind),
      x: Number.isFinite(node.x) ? node.x : 160,
      y: Number.isFinite(node.y) ? node.y : 120,
      data: { ...getDefaultNodeData(node.kind), ...(node.data && typeof node.data === "object" ? node.data : {}) },
    }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges.filter((edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const viewport = value.viewport && typeof value.viewport === "object"
    ? {
        x: Number.isFinite(value.viewport.x) ? value.viewport.x : 0,
        y: Number.isFinite(value.viewport.y) ? value.viewport.y : 0,
        zoom: normalizeZoom(Number.isFinite(value.viewport.zoom) ? value.viewport.zoom : 1),
      }
    : undefined;
  return { nodes, edges, viewport };
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data;
  return data as T;
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

function formatElapsedTime(startedAt?: number) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000));
  return `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
}

function getStaticMediaUrl(url: string | undefined) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

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
  error?: { message?: string };
  errorCode?: string;
};

export function WorkflowCanvas({ workflowId, value, onChange, workflowTitle, onCredit, onGeneratedMedia, onPreviewMedia, getImageDisplayUrl, getVideoPosterDisplayUrl, enabledImageModelIds, enabledVideoModelIds }: WorkflowCanvasProps) {
  const state = useMemo(() => normalizeState(value), [value]);
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
  const modelOptions = useMemo<WorkflowModelOptions>(() => ({ imageModels, videoModels }), [imageModels, videoModels]);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [pan, setPan] = useState(() => ({ x: state.viewport?.x ?? 0, y: state.viewport?.y ?? 0 }));
  const [zoom, setZoom] = useState(() => state.viewport?.zoom ?? 1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const effectiveTool = isSpaceDown ? "pan" : tool;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setPan({ x: state.viewport?.x ?? 0, y: state.viewport?.y ?? 0 });
    setZoom(state.viewport?.zoom ?? 1);
    setSelectedNodeId("");
  }, [workflowId]);

  useEffect(() => {
    const current = state.viewport ?? { x: 0, y: 0, zoom: 1 };
    if (current.x === pan.x && current.y === pan.y && current.zoom === zoom) return;
    onChange({ ...state, viewport: { x: pan.x, y: pan.y, zoom } });
  }, [pan.x, pan.y, zoom]);

  const updateState = (updater: (current: WorkflowCanvasState) => WorkflowCanvasState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    onChange(next);
  };

  const updateNode = (nodeId: string, patch: Partial<WorkflowNodeData>) => {
    updateState((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)),
    }));
  };

  const addNode = (kind: WorkflowNodeKind, position?: { x: number; y: number }) => {
    const index = state.nodes.length;
    const node: WorkflowNode = {
      id: createId("workflow_node"),
      kind,
      title: getNodeLabel(kind),
      x: position?.x ?? 160 + (index % 3) * 380,
      y: position?.y ?? 120 + Math.floor(index / 3) * 320,
      data: getDefaultNodeData(kind),
    };
    updateState((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeId(node.id);
  };

  const deleteNode = (nodeId: string) => {
    updateState((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      viewport: current.viewport,
    }));
    if (connectingFrom === nodeId) setConnectingFrom("");
    if (selectedNodeId === nodeId) setSelectedNodeId("");
  };

  const connectTo = (targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) return;
    updateState((current) => {
      if (current.edges.some((edge) => edge.source === connectingFrom && edge.target === targetId)) return current;
      return { ...current, edges: [...current.edges, { id: createId("workflow_edge"), source: connectingFrom, target: targetId }] };
    });
    setConnectingFrom("");
  };

  const startDrag = (node: WorkflowNode, event: ReactPointerEvent<HTMLDivElement>) => {
    if (effectiveTool === "pan") return;
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(node.id);
    setDragState({ nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panState) {
      setPan({ x: panState.originX + event.clientX - panState.startX, y: panState.originY + event.clientY - panState.startY });
      return;
    }
    if (!dragState) return;
    const nextX = dragState.originX + (event.clientX - dragState.startX) / zoom;
    const nextY = dragState.originY + (event.clientY - dragState.startY) / zoom;
    updateState((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === dragState.nodeId ? { ...node, x: nextX, y: nextY } : node)),
    }));
  };

  const endDrag = () => {
    setDragState(null);
    setPanState(null);
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest(".workflow-node,button,input,textarea,select")) setSelectedNodeId("");
    if (effectiveTool !== "pan") return;
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanState({ startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y });
  };

  const setZoomFromCenter = (nextZoom: number) => {
    const clamped = normalizeZoom(nextZoom);
    if (clamped === zoom) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.height / 2 : window.innerHeight / 2;
    const worldX = (centerX - pan.x) / zoom;
    const worldY = (centerY - pan.y) / zoom;
    setZoom(clamped);
    setPan({ x: centerX - worldX * clamped, y: centerY - worldY * clamped });
  };

  const fitNodesToView = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || state.nodes.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const padding = 120;
    const minX = Math.min(...state.nodes.map((node) => node.x));
    const minY = Math.min(...state.nodes.map((node) => node.y));
    const maxX = Math.max(...state.nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...state.nodes.map((node) => node.y + NODE_HEIGHT_ESTIMATE));
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const nextZoom = normalizeZoom(Math.min(1, Math.max(0.4, Math.min((rect.width - padding) / contentWidth, (rect.height - padding) / contentHeight))));
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    setZoom(nextZoom);
    setPan({ x: rect.width / 2 - contentCenterX * nextZoom, y: rect.height / 2 - contentCenterY * nextZoom });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable='true']")) return;
      if (event.key.toLowerCase() === "v") {
        setTool("select");
        return;
      }
      if (event.key.toLowerCase() === "f") {
        fitNodesToView();
        return;
      }
      if (event.code !== "Space") return;
      event.preventDefault();
      setIsSpaceDown(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setIsSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextZoom = normalizeZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({ x: mouseX - worldX * nextZoom, y: mouseY - worldY * nextZoom });
  };

  const getIncomingNodes = (nodeId: string) => state.edges.filter((edge) => edge.target === nodeId).map((edge) => state.nodes.find((node) => node.id === edge.source)).filter(Boolean) as WorkflowNode[];

  const getInputText = (nodeId: string) => {
    return getIncomingNodes(nodeId)
      .map((node) => {
        if (node.kind === "text") return node.data.outputText?.trim() || node.data.prompt?.trim() || node.data.text?.trim() || "";
        if (node.kind === "image") return node.data.prompt?.trim() ?? "";
        if (node.kind === "video") return node.data.prompt?.trim() ?? "";
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  };

  const getReferenceImages = (nodeId: string) => {
    const urls: string[] = [];
    for (const source of getIncomingNodes(nodeId)) {
      for (const url of source.data.images ?? []) {
        if (url && !urls.includes(url)) urls.push(url);
      }
    }
    return urls;
  };

  const getEnabledImageModel = (model?: ModelName) => (model && imageModels.some((item) => item.id === model) ? model : (imageModels[0]?.id as ModelName | undefined) ?? DEFAULT_IMAGE_MODEL);
  const getEnabledVideoModel = (model?: ModelName) => (model && videoModels.some((item) => item.id === model) ? model : (videoModels[0]?.id as ModelName | undefined) ?? DEFAULT_VIDEO_MODEL);

  const runTextNode = async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() || node.data.text?.trim() || "";
    const prompt = [upstreamPrompt, ownPrompt].filter(Boolean).join("\n\n").trim();
    if (!prompt) {
      updateNode(node.id, { error: "请先输入文本要求，或连接上游节点。" });
      return;
    }
    updateNode(node.id, { isRunning: true, error: undefined });
    try {
      const data = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: node.data.model ?? DEFAULT_CHAT_MODEL,
          mode: "agent",
          messages: [{ role: "user", content: prompt }],
          originalPrompt: prompt,
          conversationId: workflowId,
          conversationTitle: workflowTitle,
          requestId: createId("workflow_text"),
          metadata: { creditSource: "workflow_text_generation" },
        }),
      }).then((response) => readJson<{ content?: string; usage?: UsageMeta; credit?: CreditResult }>(response));
      updateNode(node.id, { outputText: data.content ?? "", isRunning: false, error: undefined });
      onCredit?.({ ...data.credit, usage: data.usage });
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error) });
    }
  };

  const runImageNode = async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() ?? "";
    const prompt = [upstreamPrompt, ownPrompt].filter(Boolean).join("\n\n").trim();
    if (!prompt) {
      updateNode(node.id, { error: "请先输入提示词，或连接一个文本节点。" });
      return;
    }

    const model = getEnabledImageModel(node.data.model);
    const settings = {
      ratio: node.data.ratio ?? "智能比例",
      resolution: node.data.resolution ?? normalizeImageResolutionForModel(model, getSupportedImageResolutions(model)[0]),
    };
    updateNode(node.id, { isRunning: true, error: undefined, images: [], startedAt: Date.now() });
    try {
      const data = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model,
          settings,
          referenceImages: getReferenceImages(node.id),
          count: 1,
          conversationId: workflowId,
          conversationTitle: workflowTitle,
          requestId: createId("workflow_image"),
          metadata: { creditSource: "workflow_image_generation" },
        }),
      }).then((response) => readJson<{ images?: string[]; imageDimensions?: Record<string, { width: number; height: number }>; usage?: UsageMeta; credit?: CreditResult }>(response));
      const images = data.images ?? [];
      updateNode(node.id, { images, imageDimensions: data.imageDimensions, isRunning: false, error: undefined });
      if (images.length > 0) onGeneratedMedia?.({ nodeId: node.id, kind: "image", urls: images, sourcePrompt: prompt, model, ratio: settings.ratio, resolution: settings.resolution, dimensions: data.imageDimensions });
      onCredit?.({ ...data.credit, usage: data.usage });
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error) });
    }
  };

  const pollVideoNode = async (node: WorkflowNode, taskId: string, prompt: string, model: ModelName, settings: { ratio?: string; resolution?: string; duration?: string }, requestId: string, initialUsage?: UsageMeta) => {
    let usage = initialUsage;
    for (let attempt = 0; attempt < videoMaxPollAttempts; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, videoPollIntervalMs));
      const pollData = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, prompt, model, settings, conversationId: workflowId, conversationTitle: workflowTitle, requestId, usage, metadata: { creditSource: "workflow_video_generation" } }),
      }).then((response) => readJson<VideoApiResponse>(response));
      usage = pollData.usage ?? usage;
      if (pollData.status === "failed" || pollData.error?.message) throw new Error(pollData.error?.message || "视频生成失败");
      const videoUrl = getVideoUrlFromResponse(pollData);
      if (isVideoDoneStatus(pollData.status) && videoUrl) {
        const posterUrl = getPosterUrlFromResponse(pollData);
        updateNode(node.id, { videoUrl, posterUrl, isRunning: false, error: undefined, taskId: undefined });
        onGeneratedMedia?.({ nodeId: node.id, kind: "video", urls: [videoUrl], posterUrl, sourcePrompt: prompt, model, ratio: settings.ratio, resolution: settings.resolution, duration: settings.duration });
        onCredit?.({ ...pollData.credit, usage: pollData.usage });
        return;
      }
    }
    throw new Error("视频生成超时，请稍后查看或重试。");
  };

  const runVideoNode = async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() ?? "";
    const prompt = [upstreamPrompt, ownPrompt].filter(Boolean).join("\n\n").trim();
    if (!prompt) {
      updateNode(node.id, { error: "请先输入视频提示词，或连接一个文本/图片节点。" });
      return;
    }
    const model = getEnabledVideoModel(node.data.model);
    const resolution = normalizeVideoResolutionForModel(model, node.data.resolution);
    const settings = {
      ratio: normalizeVideoRatioForModel(model, node.data.ratio, resolution),
      resolution,
      duration: node.data.duration ?? workflowVideoModels.find((item) => item.id === model)?.durations?.[0] ?? "5秒",
    };
    const requestId = createId("workflow_video");
    updateNode(node.id, { isRunning: true, error: undefined, videoUrl: undefined, posterUrl: undefined, startedAt: Date.now() });
    try {
      const createData = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model,
          settings,
          referenceImages: getReferenceImages(node.id),
          conversationId: workflowId,
          conversationTitle: workflowTitle,
          requestId,
          metadata: { creditSource: "workflow_video_generation" },
        }),
      }).then((response) => readJson<VideoApiResponse>(response));
      const taskId = getVideoTaskId(createData);
      if (!taskId) throw new Error("视频任务创建失败");
      updateNode(node.id, { taskId });
      await pollVideoNode(node, taskId, prompt, model, settings, requestId, createData.usage);
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error), taskId: undefined });
    }
  };

  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));

  return (
    <div className="relative h-full min-h-full overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#d8d8d8_1px,transparent_1px),linear-gradient(to_bottom,#d8d8d8_1px,transparent_1px),linear-gradient(to_right,#e9e9e9_1px,transparent_1px),linear-gradient(to_bottom,#e9e9e9_1px,transparent_1px)]"
        style={{
          backgroundSize: `${120 * zoom}px ${120 * zoom}px, ${120 * zoom}px ${120 * zoom}px, ${24 * zoom}px ${24 * zoom}px, ${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-[12px] border border-[#e5e5e5] bg-white/90 px-3 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mr-1 max-w-[220px] truncate text-[13px] font-semibold text-[#111111]">{workflowTitle}</div>
        <ToolbarButton onClick={() => addNode("text")} icon={<RiTBoxLine className="h-4 w-4" />} label="文本" />
        <ToolbarButton onClick={() => addNode("image")} icon={<RiImageAiLine className="h-4 w-4" />} label="图片" />
        <ToolbarButton onClick={() => addNode("video")} icon={<RiVideoLine className="h-4 w-4" />} label="视频" />
      </div>

      {connectingFrom ? (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-medium text-white shadow-lg">
          选择一个节点左侧的“+”完成连接
          <button type="button" onClick={() => setConnectingFrom("")} className="ml-3 text-white/70 hover:text-white">取消</button>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-[12px] border border-[#e5e5e5] bg-white/92 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur">
        <button type="button" onClick={() => setTool("select")} className={tool === "select" && !isSpaceDown ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[#367cee] text-white outline-none focus:outline-none" : "flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none"} title="选择节点（V)">
          <RiCursorLine className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setTool("pan")} className={effectiveTool === "pan" ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[#367cee] text-white outline-none focus:outline-none" : "flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none"} title="移动画布（空格）">
          <RiHand className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="mx-1 h-5 w-px bg-[#e5e5e5]" />
        <button type="button" onClick={() => setZoomFromCenter(zoom - 0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="缩小"><RiZoomOutLine className="h-5 w-5" aria-hidden="true" /></button>
        <button type="button" onClick={() => setZoomFromCenter(1)} className="h-9 min-w-12 rounded-lg px-2 text-[12px] font-semibold text-[#333333] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="重置缩放">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => setZoomFromCenter(zoom + 0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="放大"><RiZoomInLine className="h-5 w-5" aria-hidden="true" /></button>
        <div className="mx-1 h-5 w-px bg-[#e5e5e5]" />
        <button type="button" onClick={fitNodesToView} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="定位全部节点"><RiFocus3Line className="h-5 w-5" aria-hidden="true" /></button>
      </div>

      <div ref={canvasRef} className={effectiveTool === "pan" ? "absolute inset-0 z-10 cursor-grab active:cursor-grabbing" : "absolute inset-0 z-10"} onPointerDown={startPan} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={handleWheel}>
        {state.nodes.length === 0 ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e5e5e5] bg-white text-[#367cee] shadow-[0_10px_30px_rgba(15,23,42,0.08)]"><RiImageAiLine className="h-7 w-7" aria-hidden="true" /></div>
            <div className="text-[16px] font-semibold text-[#111111]">从一个节点开始</div>
            <div className="mt-2 text-[13px] text-[#8a8a8a]">文本、图片、视频节点都走对话流同一套生成链路。</div>
            <button type="button" onClick={() => addNode("text")} className="pointer-events-auto mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#367cee] px-4 text-[13px] font-semibold text-white transition hover:bg-[#286fe0]"><RiAddLine className="h-4 w-4" /> 添加文本节点</button>
          </div>
        ) : null}

        <div className="absolute left-0 top-0 h-[6000px] w-[6000px] origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <svg className="pointer-events-none absolute left-0 top-0 h-[6000px] w-[6000px] overflow-visible">
            {state.edges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;
              const x1 = source.x + NODE_WIDTH;
              const y1 = source.y + CARD_HEIGHT / 2 + 26;
              const x2 = target.x;
              const y2 = target.y + CARD_HEIGHT / 2 + 26;
              const mid = Math.max(60, Math.abs(x2 - x1) / 2);
              return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`} fill="none" stroke="#367cee" strokeWidth="2" strokeLinecap="round" />;
            })}
          </svg>

          {state.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const Icon = getNodeIcon(node.kind);
            const sourcePrompt = node.data.prompt?.trim() || node.data.text?.trim() || node.data.outputText?.trim() || workflowTitle;
            const imageUrl = node.data.images?.[0];
            const imageDisplayUrl = imageUrl ? getImageDisplayUrl?.(imageUrl) : undefined;
            const videoPosterDisplayUrl = node.data.videoUrl ? getVideoPosterDisplayUrl?.(node.data.videoUrl, node.data.posterUrl) : undefined;
            const imageMediaName = imageUrl ? node.data.mediaSystemNames?.[imageUrl] ?? "图片生成" : "图片生成";
            const videoMediaName = node.data.videoUrl ? node.data.mediaSystemNames?.[node.data.videoUrl] ?? "视频生成" : "视频生成";
            return (
              <div key={node.id} onPointerDown={(event) => startDrag(node, event)} className="workflow-node absolute flex w-[320px] flex-col overflow-visible" style={{ transform: `translate(${node.x}px, ${node.y}px)` }}>
                <div className="mb-2 flex h-6 cursor-grab items-center gap-1.5 active:cursor-grabbing">
                  <Icon className="h-4 w-4 text-[#367cee]" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-[#111111]">{getNodeLabel(node.kind)}</span>
                  {isSelected ? <button type="button" onClick={() => deleteNode(node.id)} className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-[#8a8a8a] hover:bg-[#e9e9e9] hover:text-[#111111]" aria-label="删除节点"><RiCloseLine className="h-4 w-4" /></button> : null}
                </div>

                <div className="relative">
                  {isSelected ? <NodePort side="left" onClick={() => connectTo(node.id)} /> : null}
                  {isSelected ? <NodePort side="right" onClick={() => setConnectingFrom(node.id)} /> : null}
                  {node.kind === "text" ? <TextDisplayCard node={node} selected={isSelected} /> : null}
                  {node.kind === "image" ? <ImageDisplayCard node={node} selected={isSelected} displayUrl={imageDisplayUrl} onPreview={imageUrl && onPreviewMedia ? () => onPreviewMedia({ nodeId: node.id, kind: "image", url: imageUrl, name: imageMediaName, sourcePrompt, model: node.data.model, ratio: node.data.ratio, resolution: node.data.resolution, dimensions: node.data.imageDimensions?.[imageUrl] }) : undefined} /> : null}
                  {node.kind === "video" ? <VideoDisplayCard node={node} selected={isSelected} posterDisplayUrl={videoPosterDisplayUrl} onPreview={node.data.videoUrl && onPreviewMedia ? () => onPreviewMedia({ nodeId: node.id, kind: "video", url: node.data.videoUrl as string, posterUrl: node.data.posterUrl, name: videoMediaName, sourcePrompt, model: node.data.model, ratio: node.data.ratio, resolution: node.data.resolution, duration: node.data.duration }) : undefined} /> : null}
                </div>

                {isSelected ? (
                  <div className="relative left-1/2 z-[9999] mt-3 w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[26px] border-0 bg-transparent px-0 py-0">
                    {node.kind === "text" ? <TextNodeEditor node={node} onChange={updateNode} onRun={() => void runTextNode(node)} /> : null}
                    {node.kind === "image" ? <ImageNodeEditor node={node} modelOptions={modelOptions} onChange={updateNode} onRun={() => void runImageNode(node)} /> : null}
                    {node.kind === "video" ? <VideoNodeEditor node={node} modelOptions={modelOptions} onChange={updateNode} onRun={() => void runVideoNode(node)} /> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NodePort({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#367cee] bg-white text-[#367cee] shadow-[0_6px_14px_rgba(54,124,238,0.22)] transition hover:bg-[#eef4ff] ${side === "left" ? "-left-3.5" : "-right-3.5"}`} title={side === "left" ? "连接输入" : "连接输出"}>
      <RiAddLine className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function ToolbarButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e7e7e7] bg-white px-2.5 text-[12px] font-medium text-[#333333] transition hover:border-[#d8d8d8] hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-45">{icon}{label}</button>;
}

function cardBorderClassName(selected?: boolean) {
  return selected ? "border-[#367cee]" : "border-[#e5e5e5]";
}

function EmptyMediaCard({ kind, selected }: { kind: WorkflowNodeKind; selected?: boolean }) {
  const Icon = getNodeIcon(kind);
  return <div className={`flex h-[180px] w-full items-center justify-center rounded-[14px] border bg-white text-[#9a9a9a] shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${cardBorderClassName(selected)}`}><Icon className="h-10 w-10" aria-hidden="true" /></div>;
}

function WaitingCard({ isImage, startedAt, selected }: { isImage: boolean; startedAt?: number; selected?: boolean }) {
  return (
    <div className={`relative h-[180px] w-full overflow-hidden rounded-[14px] border bg-[#eaf7ff] text-left text-sm text-[#4f6f86] ${cardBorderClassName(selected)}`}>
      <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
      <div className="absolute left-3 top-3 z-10 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">{getVideoWaitProgress(startedAt)}%{isImage ? "生成中" : "渲染中"}</div>
      <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]"><div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(startedAt)}</div></div>
    </div>
  );
}

function FailedCard({ isImage, selected }: { isImage: boolean; selected?: boolean }) {
  return <div className={`relative flex h-[180px] w-full items-center justify-center rounded-[14px] border bg-white text-[#777777] shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${cardBorderClassName(selected)}`}><div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none"><RiEmotionSadLine className="h-5 w-5" aria-hidden="true" /><span>{isImage ? "图片生成失败" : "视频生成失败"}</span></div><div className="inline-flex items-center gap-1 text-[13px] font-medium text-[#367cee]"><RiResetLeftLine className="h-3.5 w-3.5" aria-hidden="true" /><span>修改后重试</span></div></div>;
}

function TextDisplayCard({ node, selected }: { node: WorkflowNode; selected?: boolean }) {
  if (node.data.isRunning) return <div className={`flex h-[180px] w-full items-center justify-center rounded-[14px] border bg-white text-[#367cee] ${cardBorderClassName(selected)}`}><RiLoader4Line className="mr-2 h-5 w-5 animate-spin" />文本生成中...</div>;
  if (node.data.error) return <FailedCard isImage={false} selected={selected} />;
  if (node.data.outputText) return <div className={`h-[180px] w-full overflow-y-auto rounded-[14px] border bg-white p-4 text-[13px] leading-6 text-[#333333] shadow-[0_10px_24px_rgba(15,23,42,0.06)] whitespace-pre-wrap ${cardBorderClassName(selected)}`}>{node.data.outputText}</div>;
  return <div className={`flex h-[180px] w-full items-center justify-center rounded-[14px] border bg-white text-[#9a9a9a] shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${cardBorderClassName(selected)}`}><RiFileTextLine className="h-10 w-10" aria-hidden="true" /></div>;
}

function PreviewEyeButton({ label, onPreview }: { label: string; onPreview: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onPreview();
      }}
      className="absolute bottom-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_8px_20px_rgba(0,0,0,0.24)] backdrop-blur transition hover:bg-black/72"
      aria-label={label}
      title={label}
    >
      <RiEyeLine className="h-4.5 w-4.5" aria-hidden="true" />
    </button>
  );
}

function ImageDisplayCard({ node, selected, displayUrl, onPreview }: { node: WorkflowNode; selected?: boolean; displayUrl?: string; onPreview?: () => void }) {
  if (node.data.isRunning) return <WaitingCard isImage startedAt={node.data.startedAt} selected={selected} />;
  if (node.data.error) return <FailedCard isImage selected={selected} />;
  const url = node.data.images?.[0];
  if (url) return <div className={`relative h-[180px] w-full overflow-hidden rounded-[14px] border bg-[#f4f4f4] shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${cardBorderClassName(selected)}`}><img src={displayUrl ?? getStaticMediaUrl(url) ?? url} alt="生成图片" draggable={false} className="h-full w-full select-none object-cover" />{onPreview ? <PreviewEyeButton label="预览图片" onPreview={onPreview} /> : null}</div>;
  return <EmptyMediaCard kind="image" selected={selected} />;
}

function VideoDisplayCard({ node, selected, posterDisplayUrl, onPreview }: { node: WorkflowNode; selected?: boolean; posterDisplayUrl?: string; onPreview?: () => void }) {
  if (node.data.isRunning) return <WaitingCard isImage={false} startedAt={node.data.startedAt} selected={selected} />;
  if (node.data.error) return <FailedCard isImage={false} selected={selected} />;
  if (node.data.videoUrl) return (
    <div className={`relative h-[180px] w-full overflow-hidden rounded-[14px] border bg-black shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${cardBorderClassName(selected)}`}>
      {posterDisplayUrl ? <img src={posterDisplayUrl} alt="视频封面" draggable={false} className="h-full w-full select-none object-cover" /> : <video src={getStaticMediaUrl(node.data.videoUrl) ?? node.data.videoUrl} poster={getStaticMediaUrl(node.data.posterUrl) ?? node.data.posterUrl} className="h-full w-full select-none object-cover" draggable={false} playsInline preload="metadata" muted />}
      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/42 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-[4px]"><RiPlayLargeFill className="ml-0.5 h-6 w-6" aria-hidden="true" /></span>
      {onPreview ? <PreviewEyeButton label="预览视频" onPreview={onPreview} /> : null}
    </div>
  );
  return <EmptyMediaCard kind="video" selected={selected} />;
}

function WorkflowPromptBox({ value, placeholder, onChange, children, running, onRun }: { value: string; placeholder: string; onChange: (value: string) => void; children: ReactNode; running?: boolean; onRun: () => void }) {
  return (
    <div className="relative z-20 rounded-[26px] border-2 border-[#f1f2f2] bg-white/78 px-4 py-3 shadow-none backdrop-blur-[18px] transition focus-within:border-white/70 focus-within:shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!running && value.trim()) onRun();
        }}
        placeholder={placeholder}
        className="min-h-10 w-full resize-none border-0 bg-transparent px-2 py-1 text-[14px] leading-6 text-[#111111] outline-none placeholder:text-[#b3b3b3] selection:bg-[#2f6df6] selection:text-white"
      />
      <div className="mt-3 flex min-w-0 flex-nowrap items-center justify-between gap-3 pb-0.5">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-[12px]">
        <button type="button" className="yinzao-tool-button yinzao-tool-button-round inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#777777] transition" aria-label="添加素材">
          <RiAddLine className="h-4 w-4" aria-hidden="true" />
        </button>
        {children}
        <button type="button" className="yinzao-tool-button inline-flex h-9 shrink-0 items-center rounded-[8px] px-3.5 text-[#777777] outline-none transition" aria-label="引用资产">
          <span className="text-[15px] font-semibold leading-none">@</span>
        </button>
        </div>
        <button type="button" disabled={running || !value.trim()} onClick={onRun} className="inline-flex h-9 w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#111111] text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white" aria-label="生成">
          {running ? <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RiArrowUpLine className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

const workflowToolButtonClassName = "yinzao-tool-button inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-[13px] text-[#777777] outline-none transition";

function getGenerationModelIcon(modelId: string) {
  if (modelId.startsWith("byteplus:") || modelId.startsWith("byteplus/") || modelId.startsWith("ep-")) return BytePlusIcon;
  if (modelId.startsWith("openai/")) return RiOpenaiFill;
  if (modelId.startsWith("google/")) return RiGoogleFill;
  if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return RiTiktokFill;
  return null;
}

function isGoldGenerationModel(modelId: string) {
  return modelId === "openai/gpt-5.4-image-2" || modelId === "bytedance/seedance-2.0" || modelId === "byteplus:video.seedance-2-0";
}

function getModelLabel(options: readonly (ConversationModel | GenerationModel)[], value: string) {
  return options.find((item) => item.id === value)?.label ?? value;
}

function AiGenerate3dIcon({ className = "h-[18px] w-[18px] shrink-0 text-[#777777]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" />
    </svg>
  );
}

function RatioOptionIcon({ option }: { option: string }) {
  const meta = ratioCardMeta[option] ?? ratioCardMeta["1:1"];
  if (meta.icon === "spark") return <RiShining2Line className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" />;
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0 text-[#777777]"><rect x={(18 - Number(meta.width)) / 2} y={(18 - Number(meta.height)) / 2} width={meta.width} height={meta.height} rx="2.2" stroke="currentColor" strokeWidth="1.4" /></svg>;
}

function CompactResolutionIcon({ option, mode }: { option?: string; mode: "image" | "video" }) {
  if (mode === "video") return <span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[3px] bg-[#111111] px-1 text-[9px] font-bold leading-none text-white">{option === "480p" ? "SD" : option === "1080p" ? "FHD" : option === "4K" ? "4K" : "HD"}</span>;
  return <span className="inline-flex h-4 min-w-5 items-center justify-center rounded-[3px] border border-[#d5d5d5] px-1 text-[9px] font-bold leading-none text-[#777777]">{option ?? "1K"}</span>;
}

function WorkflowModelMenu({ value, options, title, onChange, className = "" }: { value: ModelName; options: readonly (ConversationModel | GenerationModel)[]; title: string; onChange: (value: ModelName) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = getGenerationModelIcon(value);
  const selectedLabel = getModelLabel(options, value);
  const selectedGold = isGoldGenerationModel(value);
  return (
    <div className={`relative min-w-0 ${className}`} onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => setOpen((current) => !current)} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} w-full max-w-none justify-start whitespace-nowrap`}>
        <span className="flex min-w-0 flex-nowrap items-center gap-2">
          {SelectedIcon ? <SelectedIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
          <span className={`min-w-0 truncate whitespace-nowrap font-medium ${selectedGold ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedLabel}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
          <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>
          {options.map((option) => {
            const ModelIcon = getGenerationModelIcon(option.id);
            const selected = option.id === value;
            const gold = isGoldGenerationModel(option.id);
            return (
              <button key={option.id} type="button" onClick={() => { onChange(option.id as ModelName); setOpen(false); }} className={selected ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}>
                <span className="flex min-w-0 items-center gap-2">{ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" />}<span className={`min-w-0 truncate text-[13px] ${gold ? "text-[#b8860b]" : ""}`}>{option.label}</span></span>
                {selected ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function WorkflowSettingsMenu({ mode, ratio, resolution, ratios, resolutions, onChange, className = "" }: { mode: "image" | "video"; ratio: string; resolution: string; ratios: string[]; resolutions: string[]; onChange: (patch: { ratio?: string; resolution?: string }) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const isSmartSettings = mode === "image" && ratio === "智能比例";
  const resolutionGridClassName = mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2";
  return (
    <div className={`relative ${className}`} onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => setOpen((current) => !current)} className={`relative ${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} pl-10`}>
        <span className="flex min-w-0 flex-nowrap items-center gap-2"><span className="font-medium text-[#777777]">{ratio} /</span><span className="font-medium text-[#777777]">{resolution}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" /></span>
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={ratio} /></span>
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[min(420px,calc(100vw-40px))] rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
          <div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div>
          <div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">
            {ratios.map((option) => <button key={option} type="button" onClick={() => onChange({ ratio: option })} className={option === ratio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}><RatioOptionIcon option={option} /><span className="text-[13px] font-medium leading-none">{option === "智能比例" ? "智能" : option}</span></button>)}
          </div>
          <div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div>
          <div className={`mt-2 grid ${resolutionGridClassName} rounded-[12px] bg-[#f6f6f6] py-1 ${resolutions.length === 1 ? "grid-cols-1" : resolutions.length === 2 ? "grid-cols-2" : resolutions.length === 3 ? "grid-cols-3" : "grid-cols-4"} ${isSmartSettings ? "opacity-45" : ""}`}>
            {resolutions.map((option) => <button key={option} type="button" disabled={isSmartSettings} onClick={() => onChange({ resolution: option })} className={option === resolution ? "flex h-[56px] items-center justify-center gap-2 rounded-[10px] bg-white px-2 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)] disabled:cursor-not-allowed" : "flex h-[56px] items-center justify-center gap-2 rounded-[10px] px-2 text-[#666666] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:hover:bg-transparent"}><CompactResolutionIcon option={option} mode={mode} /><span className="whitespace-nowrap text-[13px] font-medium leading-none">{option}</span></button>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkflowDurationMenu({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => setOpen((current) => !current)} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""}`}><RiTimeLine className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" /><span className="font-medium text-[#777777]">{value}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" /></button>
      {open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 max-h-[420px] min-w-[180px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">视频时长</div>{options.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={option === value ? "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span>{option}</span>{option === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" /> : null}</button>)}</div> : null}
    </div>
  );
}

function TextNodeEditor({ node, onChange, onRun }: { node: WorkflowNode; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) {
  const model = node.data.model ?? DEFAULT_CHAT_MODEL;
  return (
    <div className="space-y-2">
      <WorkflowPromptBox value={node.data.prompt ?? node.data.text ?? ""} placeholder="输入文本生成要求；也可以连接上游节点。" onChange={(value) => onChange(node.id, { prompt: value, text: value })} running={node.data.isRunning} onRun={onRun}>
        <WorkflowModelMenu value={model} options={frontendConversationModels} title="选择模型" onChange={(value) => onChange(node.id, { model: value })} className="w-[190px] shrink-0" />
      </WorkflowPromptBox>
      {node.data.error ? <div className="px-1 text-[12px] leading-5 text-red-500">{node.data.error}</div> : null}
    </div>
  );
}

function ImageNodeEditor({ node, modelOptions, onChange, onRun }: { node: WorkflowNode; modelOptions: WorkflowModelOptions; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) {
  const model = modelOptions.imageModels.some((item) => item.id === node.data.model) ? node.data.model ?? DEFAULT_IMAGE_MODEL : (modelOptions.imageModels[0]?.id as ModelName | undefined) ?? DEFAULT_IMAGE_MODEL;
  const supportedResolutions = getSupportedImageResolutions(model);
  return (
    <div className="space-y-2">
      <WorkflowPromptBox value={node.data.prompt ?? ""} placeholder="输入图片生成提示词；也可以连接文本节点。" onChange={(value) => onChange(node.id, { prompt: value })} running={node.data.isRunning} onRun={onRun}>
        <WorkflowModelMenu value={model} options={modelOptions.imageModels} title="选择模型" onChange={(value) => onChange(node.id, { model: value, resolution: normalizeImageResolutionForModel(value, node.data.resolution) })} className="w-[190px] shrink-0" />
        <WorkflowSettingsMenu mode="image" ratio={node.data.ratio ?? "智能比例"} resolution={node.data.resolution ?? supportedResolutions[0]} ratios={imageRatioOptions} resolutions={supportedResolutions} onChange={(patch) => onChange(node.id, patch)} className="shrink-0" />
      </WorkflowPromptBox>
      {node.data.error ? <div className="px-1 text-[12px] leading-5 text-red-500">{node.data.error}</div> : null}
    </div>
  );
}

function VideoNodeEditor({ node, modelOptions, onChange, onRun }: { node: WorkflowNode; modelOptions: WorkflowModelOptions; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) {
  const model = modelOptions.videoModels.some((item) => item.id === node.data.model) ? node.data.model ?? DEFAULT_VIDEO_MODEL : (modelOptions.videoModels[0]?.id as ModelName | undefined) ?? DEFAULT_VIDEO_MODEL;
  const supportedResolutions = getSupportedVideoResolutions(model);
  const resolution = normalizeVideoResolutionForModel(model, node.data.resolution);
  const supportedRatios = getSupportedVideoRatios(model, resolution);
  const durationOptions = modelOptions.videoModels.find((item) => item.id === model)?.durations ?? fallbackVideoDurationOptions;
  return (
    <div className="space-y-2">
      <WorkflowPromptBox value={node.data.prompt ?? ""} placeholder="输入视频生成提示词；也可以连接文本或图片节点。" onChange={(value) => onChange(node.id, { prompt: value })} running={node.data.isRunning} onRun={onRun}>
        <WorkflowModelMenu value={model} options={modelOptions.videoModels} title="选择模型" onChange={(value) => { const nextResolution = normalizeVideoResolutionForModel(value, node.data.resolution); onChange(node.id, { model: value, resolution: nextResolution, ratio: normalizeVideoRatioForModel(value, node.data.ratio, nextResolution), duration: modelOptions.videoModels.find((item) => item.id === value)?.durations?.[0] ?? "5秒" }); }} className="w-[190px] shrink-0" />
        <WorkflowSettingsMenu mode="video" ratio={node.data.ratio ?? supportedRatios[0]} resolution={resolution} ratios={supportedRatios} resolutions={supportedResolutions} onChange={(patch) => onChange(node.id, patch)} className="shrink-0" />
        <WorkflowDurationMenu value={node.data.duration ?? durationOptions[0]} options={durationOptions} onChange={(value) => onChange(node.id, { duration: value })} />
      </WorkflowPromptBox>
      {node.data.error ? <div className="px-1 text-[12px] leading-5 text-red-500">{node.data.error}</div> : null}
    </div>
  );
}
