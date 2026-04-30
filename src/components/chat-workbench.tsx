"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Angry,
  ArrowDownToLine,
  Check,
  Copy,
  Ellipsis,
  Film,
  FolderOpen,
  ImageIcon,
  MessageSquareMore,
  MessageCircleX,
  MoonStar,
  PanelLeft,
  PanelLeftDashed,
  Plus,
  Pin,
  RefreshCw,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, type ModelName } from "@/lib/models";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
  requestId?: string;
  images?: string[];
  videoUrl?: string;
  statusText?: string;
  error?: string;
  mode?: WorkMode;
};

type VideoTaskState = {
  taskId: string;
  status: string;
  videoUrl?: string;
  error?: string;
};

type ChatPayloadMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

type PendingGeneration = {
  id: string;
  mode: WorkMode;
  model: ModelName;
  messages: ChatPayloadMessage[];
  settings?: GenerationSettings;
  prompt?: string;
  taskId?: string;
  referenceImages?: string[];
};

type WorkMode = "agent" | "image" | "video";

type UploadedImage = {
  id: string;
  name: string;
  url: string;
};

type GenerationSettings = {
  ratio?: string;
  resolution?: string;
  style?: string;
  duration?: string;
};

type ControlMenuName = "ratio" | "resolution" | "style" | "duration";
type ModeMenuName = "mode";

type WorkSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  videoTask: VideoTaskState | null;
  draftInput?: string;
  uploadedFiles?: string[];
  uploadedImages?: UploadedImage[];
  pendingRequest?: PendingGeneration | null;
};

type ApiError = string | { message?: string };
type IntentMode = "image" | "video";
type IntentClassification = {
  intent?: "agent" | "image" | "video" | "prompt" | "clarify";
  confidence?: number;
  reason?: string;
};
type IntentMemoryRule = {
  id: string;
  mode: IntentMode;
  keywords: string[];
  source: string;
  hits: number;
  updatedAt: number;
};
type FeedbackKind = "like" | "dislike" | "wrong" | "wrong_mode" | "regenerate" | "copy";
type FeedbackLogEntry = {
  id: string;
  createdAt: number;
  kind: FeedbackKind;
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  messageType: "text" | "image" | "video";
  executionMode?: WorkMode;
  activeMode: WorkMode;
  context: Array<{ role: "user" | "assistant"; content: string }>;
  message: Pick<Message, "content" | "images" | "videoUrl" | "statusText" | "error" | "mode">;
  intentMemoryRules: IntentMemoryRule[];
};

const STORAGE_KEY = "yinzao-sessions-v2";
const ACTIVE_SESSION_KEY = "yinzao-active-session-v1";
const INTENT_MEMORY_KEY = "yinzao-intent-memory-v1";
const FEEDBACK_LOG_KEY = "yinzao-feedback-log-v1";
const MAX_PERSISTED_SESSIONS = 30;
const MAX_INTENT_MEMORY_RULES = 50;
const MAX_FEEDBACK_LOGS = 300;
const MAX_UPLOADED_IMAGES = 5;
const FAST_VIDEO_POLL_INTERVAL_MS = 10000;
const SLOW_VIDEO_POLL_INTERVAL_MS = 30000;
const FAST_VIDEO_POLL_ATTEMPTS = 12;
const MAX_VIDEO_POLL_ATTEMPTS = 18;
const MIN_TYPING_DURATION_MS = 1000;
const MAX_TYPING_DURATION_MS = 8000;
const INTENT_KEYWORDS = [
  "图中人",
  "这张图",
  "刚才那张图",
  "镜头",
  "运镜",
  "动起来",
  "视频",
  "短片",
  "动画",
  "生视频",
  "生成视频",
  "图生视频",
  "生图",
  "生成图片",
  "出图",
  "做图",
  "画图",
  "人物",
  "角色",
  "男女主",
  "男主",
  "女主",
  "主角",
  "海报",
  "封面",
  "插画",
  "立绘",
  "场景",
];

const initialMessages: Message[] = [
  {
    id: "seed-1",
    role: "assistant",
    content: "你好，我是映造。告诉我你想生成什么，我会像创作助手一样帮你整理并直接出结果。",
    createdAt: Date.now(),
  },
];

const quickActions = [
  { title: "高级感产品海报", description: "适合电商主图、上新视觉和品牌海报" },
  { title: "扩写图片提示词", description: "把一句想法整理成完整可生成描述" },
  { title: "5 秒人物出场视频", description: "生成镜头、动作、氛围更完整的视频提示" },
  { title: "治愈系插画封面", description: "适合社媒封面、故事插图和视觉草案" },
];

const videoStatusLabels: Record<string, string> = {
  creating: "正在创建视频任务",
  queued: "视频排队中，通常需要 1-5 分钟",
  running: "视频生成中",
  processing: "视频生成中",
  succeeded: "视频已生成完成",
  success: "视频已生成完成",
  completed: "视频已生成完成",
  complete: "视频已生成完成",
  done: "视频已生成完成",
  failed: "视频生成失败",
  error: "视频生成失败",
  expired: "视频任务已过期",
};

const imageStatusLabels = {
  creating: "正在生成图片，结果出来后会直接显示在这里",
  failed: "图片生成失败",
};

const ratioOptions = ["9:16", "16:9", "1:1"];
const resolutionOptions = ["1K", "2K", "4K"];
const styleOptions = ["写实风格", "2D风格", "3D风格"];
const durationOptions = ["5秒", "10秒", "15秒"];
const modeOptions: Array<{ label: string; value: WorkMode }> = [
  { label: "Agent 模式", value: "agent" },
  { label: "图片模式", value: "image" },
  { label: "视频模式", value: "video" },
];

function ThinkingIndicator() {
  return (
    <div className="flex min-h-[300px] items-start justify-start">
      <div className="flex items-center gap-2 px-0 py-1 text-sm text-[#6f6f6f]">
        <HaloPulseIndicator />
        <span>映造正在思考</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a] [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a] [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a]" />
        </span>
      </div>
    </div>
  );
}

function InlineLoadingDots() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a] [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a] [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a]" />
    </span>
  );
}

function HaloPulseIndicator() {
  return (
    <span className="relative mr-1 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
      <span className="absolute h-2.5 w-2.5 animate-ping rounded-full border border-[#6d4aff] opacity-45 [animation-duration:1.15s]" />
      <span className="absolute h-3.5 w-3.5 animate-ping rounded-full border border-[#b6a6ff] opacity-25 [animation-delay:0.25s] [animation-duration:1.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#6d4aff]" />
    </span>
  );
}

function FeedbackButton({
  label,
  children,
  onClick,
  state = "idle",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  state?: "idle" | "success" | "error";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group relative flex h-8 w-8 items-center justify-center rounded-md text-[#8a8a8a] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
    >
      {state === "success" ? <Check className="h-4.5 w-4.5 text-[#111111]" strokeWidth={2} aria-hidden="true" /> : state === "error" ? <X className="h-4.5 w-4.5 text-[#111111]" strokeWidth={2} aria-hidden="true" /> : children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111111] px-3 py-2 text-[12px] font-medium leading-none text-white opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function ActiveMessageCircleXIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="block shrink-0" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.65 15L2 22l5.1-1.35A10 10 0 1 0 12 2Z" />
      <path d="m9 9 6 6M15 9l-6 6" fill="none" stroke="white" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ActiveAngryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="block shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="m7.5 8.5 3 1.5M16.5 8.5l-3 1.5M8 16s1.5-2 4-2 4 2 4 2" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="9" cy="12" r="1" fill="white" />
      <circle cx="15" cy="12" r="1" fill="white" />
    </svg>
  );
}

function getTypingDuration(content: string) {
  const length = Array.from(content).length;
  if (length === 0) return 0;

  return Math.min(MAX_TYPING_DURATION_MS, Math.max(MIN_TYPING_DURATION_MS, length * 28));
}

function getAssistantMessageIds(sessions: WorkSession[]) {
  return sessions.flatMap((session) => session.messages.filter((message) => message.role === "assistant").map((message) => message.id));
}

function TypewriterFormattedMessage({
  messageId,
  content,
  isComplete,
  onComplete,
  onTick,
}: {
  messageId: string;
  content: string;
  isComplete: boolean;
  onComplete: (messageId: string) => void;
  onTick: () => void;
}) {
  const characters = Array.from(content);
  const [visibleCount, setVisibleCount] = useState(isComplete ? characters.length : 0);
  const visibleContent = isComplete ? content : characters.slice(0, visibleCount).join("");

  useEffect(() => {
    const contentCharacters = Array.from(content);

    if (isComplete) {
      return;
    }

    if (contentCharacters.length === 0) {
      onComplete(messageId);
      return;
    }

    const startedAt = performance.now();
    const duration = getTypingDuration(content);
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const nextVisibleCount = Math.min(contentCharacters.length, Math.max(1, Math.floor(contentCharacters.length * progress)));

      setVisibleCount((current) => (current === nextVisibleCount ? current : nextVisibleCount));
      onTick();

      if (nextVisibleCount < contentCharacters.length) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      onComplete(messageId);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [content, isComplete, messageId, onComplete, onTick]);

  return (
    <>
      <FormattedMessage content={visibleContent} />
      {!isComplete ? <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-full bg-[#111111] align-[-2px]" aria-hidden="true" /> : null}
    </>
  );
}

function createSession(): WorkSession {
  return {
    id: crypto.randomUUID(),
    title: "新对话",
    updatedAt: Date.now(),
    messages: initialMessages,
    videoTask: null,
    draftInput: "",
    uploadedFiles: [],
    uploadedImages: [],
  };
}

function isEmptySession(session: WorkSession) {
  return session.title === "新对话" && session.messages.length <= 1 && !session.draftInput?.trim() && (session.uploadedFiles?.length ?? 0) === 0 && (session.uploadedImages?.length ?? 0) === 0;
}

function keepSingleEmptySession(sessions: WorkSession[]) {
  let hasEmptySession = false;

  return sessions.filter((session) => {
    if (!isEmptySession(session)) return true;
    if (hasEmptySession) return false;
    hasEmptySession = true;
    return true;
  });
}

function getPersistableSessions(sessions: WorkSession[]) {
  return keepSingleEmptySession(sessions)
    .slice(0, MAX_PERSISTED_SESSIONS)
    .map((session) => ({
      ...session,
      uploadedImages: undefined,
      pendingRequest: session.pendingRequest
        ? {
            ...session.pendingRequest,
            referenceImages: session.pendingRequest.referenceImages?.filter((url) => !url.startsWith("data:")),
            messages: session.pendingRequest.messages.map((message) => ({
              ...message,
              images: message.images?.filter((url) => !url.startsWith("data:")),
            })),
          }
        : session.pendingRequest,
      messages: session.messages.map((message) => {
        const images = message.images?.filter((url) => !url.startsWith("data:"));

        return {
          ...message,
          images: images && images.length > 0 ? images : undefined,
        };
      }),
    }));
}

function saveSessions(sessions: WorkSession[]) {
  const persistableSessions = getPersistableSessions(sessions);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistableSessions));
  } catch {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          persistableSessions.map((session) => ({
            ...session,
            uploadedImages: undefined,
            messages: session.messages.map((message) => ({ ...message, images: undefined })),
          })),
        ),
      );
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}

function getSessionTitle(text: string) {
  return text.length > 16 ? `${text.slice(0, 16)}...` : text;
}

function formatMessageTime(value?: number) {
  const date = new Date(value ?? Date.now());
  const pad = (item: number) => String(item).padStart(2, "0");

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatElapsedTime(startedAt?: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - (startedAt ?? now)) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getVideoWaitProgress(startedAt?: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - (startedAt ?? now)) / 1000));
  return Math.min(99, Math.max(1, Math.round((elapsedSeconds / 600) * 100)));
}

function isModelInfoQuestion(text: string) {
  const normalized = text.replace(/[\s，。？！?!.]/g, "");

  return /模型/.test(normalized) && /(什么|哪个|哪一个|哪种|用了|使用|当前|现在|是谁|名称|名字)/.test(normalized);
}

function isSimpleGreeting(text: string) {
  const normalized = text.replace(/[\s，。？！?!.、~～]/g, "").toLowerCase();

  return /^(你好|您好|hi|hello|哈喽|嗨|在吗|在不在)$/.test(normalized);
}

function normalizeIntentText(text: string) {
  return text.replace(/[\s，。？！?!.、；;：“”"'（）()]/g, "").toLowerCase();
}

function getIntentKeywords(text: string) {
  const normalized = normalizeIntentText(text);
  return INTENT_KEYWORDS.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getCorrectionMode(text: string): IntentMode | null {
  const normalized = normalizeIntentText(text);

  if (/(不是|不对|错了|搞错|弄错|理解错).*(视频|镜头|动起来)|我(要|说的是|让你|叫你).*(视频|镜头|动起来)|应该.*(生视频|生成视频|做视频|出视频)/.test(normalized)) {
    return "video";
  }

  if (/(不是|不对|错了|搞错|弄错|理解错).*(图|图片|照片)|我(要|说的是|让你|叫你).*(图|图片|照片)|应该.*(生图|生成图片|做图|出图)/.test(normalized)) {
    return "image";
  }

  return null;
}

function getLastUserMessage(messages: Message[]) {
  return [...messages].reverse().find((message) => message.role === "user" && message.content.trim());
}

function getRememberedIntent(text: string, rules: IntentMemoryRule[]): IntentMode | null {
  const normalized = normalizeIntentText(text);
  const matchedRules = rules
    .filter((rule) => rule.keywords.length > 0 && rule.keywords.every((keyword) => normalized.includes(keyword.toLowerCase())))
    .sort((a, b) => b.keywords.length - a.keywords.length || b.hits - a.hits || b.updatedAt - a.updatedAt);

  return matchedRules[0]?.mode ?? null;
}

function upsertIntentMemoryRule(rules: IntentMemoryRule[], source: string, mode: IntentMode) {
  const keywords = getIntentKeywords(source);
  if (keywords.length === 0) return rules;

  const ruleKey = keywords.join("|");
  const existingRule = rules.find((rule) => rule.mode === mode && rule.keywords.join("|") === ruleKey);

  if (existingRule) {
    return rules.map((rule) => (rule.id === existingRule.id ? { ...rule, hits: rule.hits + 1, updatedAt: Date.now() } : rule));
  }

  return [
    {
      id: crypto.randomUUID(),
      mode,
      keywords,
      source: source.slice(0, 80),
      hits: 1,
      updatedAt: Date.now(),
    },
    ...rules,
  ].slice(0, MAX_INTENT_MEMORY_RULES);
}

function getHardGenerationMode(text: string): WorkMode | null {
  const normalized = normalizeIntentText(text);
  const wantsPromptOnly = /(提示词|咒语|prompt|优化|润色|改写|整理|扩写)/i.test(normalized);
  const wantsImageReviewOnly = /(看看|看下|分析|点评|评价|识别|描述|这是什么|哪里好|哪里不好|怎么改).*(图|图片|照片)|^(看看|看下|分析|点评|评价|识别|描述).*(这张|这个|图片|图)/.test(normalized);
  const hasImageTarget = /(图|图片|图像|照片|海报|插画|封面|头像|人物|角色|男女主|女主|男主|主角|场景|视觉|分镜|立绘|全身照|中景照|产品图)/.test(normalized);
  const hasVideoTarget = /(视频|短片|动画|片段|镜头|运镜|成片|影片|电影感|预告片|vlog|mv|动图|动态|转场|起幅|落幅|推拉摇移|首帧|尾帧|五秒|5秒|十秒|10秒|十五秒|15秒)/i.test(normalized);
  const generationIntent = /(生成|生|出|做|画|绘制|创作|产出|来一张|弄一张|搞一张|做一张|画一张|出一张|生成一张|落地)/.test(normalized);

  if (wantsImageReviewOnly && !hasVideoTarget) return null;

  if (!wantsPromptOnly && (/(生视频|生个视频|出视频|做视频|搞视频|弄视频|生成视频|视频生成|生成短片|生成动画|文生视频|图生视频|图片生视频|首帧生视频|转视频|动起来|让.+动起来|做成视频|生成一段视频|来一段视频|出一段视频|做一段视频|弄一段视频|搞一段视频)/i.test(normalized) || (hasVideoTarget && generationIntent))) {
    return "video";
  }

  if (!wantsPromptOnly && (/(生图|生个图|出图|做图|画图|绘图|文生图|图像生成|图片生成|生成图片|生成图像|AI绘图|AI生图)/i.test(normalized) || (hasImageTarget && generationIntent))) {
    return "image";
  }

  return null;
}

function getImageOnlyPrompt(mode: WorkMode) {
  if (mode === "image") return "请参考上传图片，生成一张保持主体一致、画面更完整的图片。";
  if (mode === "video") return "请把上传图片作为首帧，生成一段自然流畅的视频。";
  return "请分析这张图片，并告诉我可以怎么继续创作。";
}

function toChatPayloadMessages(messages: Message[]): ChatPayloadMessage[] {
  return messages
    .filter((message) => message.id !== "seed-1")
    .map((message) => ({
      role: message.role,
      content: message.content,
      images: message.images,
    }));
}

function isReferencingRecentImage(text: string) {
  const normalized = normalizeIntentText(text);
  return /(这张图|这张图片|这图|刚才那张|上一张|上面那张|图中|图片里|让它|让他|让她|动起来|首帧|参考图|用这张|按这张)/.test(normalized);
}

function getRecentReferenceImages(messages: Message[], text: string) {
  if (!isReferencingRecentImage(text)) return [];

  return [...messages]
    .reverse()
    .flatMap((message) => message.images ?? [])
    .filter(Boolean)
    .slice(0, MAX_UPLOADED_IMAGES);
}

function renderInlineFormatting(text: string) {
  const pattern = /(\*\*[^*]+\*\*|\[red\][\s\S]+?\[\/red\]|\[blue\][\s\S]+?\[\/blue\])/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  text.replace(pattern, (match, _token, index: number) => {
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

    if (match.startsWith("**")) {
      nodes.push(
        <strong key={`${match}-${index}`} className="font-semibold text-[#111111]">
          {match.slice(2, -2)}
        </strong>,
      );
    } else if (match.startsWith("[red]")) {
      nodes.push(
        <span key={`${match}-${index}`} className="rounded-md bg-[#fff1f1] px-1.5 py-0.5 text-[14px] font-semibold text-[#d36b63]">
          {match.slice(5, -6)}
        </span>,
      );
    } else {
      nodes.push(
        <span key={`${match}-${index}`} className="rounded-md bg-[#eef5ff] px-1.5 py-0.5 text-[14px] font-semibold text-[#6f95d8]">
          {match.slice(6, -7)}
        </span>,
      );
    }

    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : text;
}

function FormattedMessage({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (blocks.length === 0) return null;

  const renderLine = (line: string, key: string) => {
    const redCallout = line.match(/^\[red\]([\s\S]+)\[\/red\]$/);
    const blueCallout = line.match(/^\[blue\]([\s\S]+)\[\/blue\]$/);
    const divider = /^-{3,}$/.test(line);
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const boldHeading = line.match(/^\*\*([^*]{2,24})\*\*$/);

    if (divider) {
      return <hr key={key} className="my-4 border-[#e5e5e5]" />;
    }

    if (redCallout || blueCallout) {
      const isRed = Boolean(redCallout);
      return (
        <div key={key} className={isRed ? "rounded-xl bg-[#fff1f1] px-3 py-2 text-[14px] font-semibold leading-6 text-[#d36b63]" : "rounded-xl bg-[#eef5ff] px-3 py-2 text-[14px] font-semibold leading-6 text-[#6f95d8]"}>
          {redCallout?.[1] ?? blueCallout?.[1]}
        </div>
      );
    }

    if (heading) {
      const level = heading[1].length;

      if (level === 1) {
        return (
          <h1 key={key} className="pt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#111111]">
            {renderInlineFormatting(heading[2])}
          </h1>
        );
      }

      return level === 2 ? (
        <h2 key={key} className="pt-2 text-[19px] font-semibold leading-7 tracking-[-0.01em] text-[#111111]">
          {renderInlineFormatting(heading[2])}
        </h2>
      ) : (
        <h3 key={key} className="pt-1 text-[16px] font-semibold leading-6 text-[#111111]">
          {renderInlineFormatting(heading[2])}
        </h3>
      );
    }

    if (boldHeading) {
      return (
        <h3 key={key} className="pt-1 text-[16px] font-semibold leading-6 text-[#111111]">
          {boldHeading[1]}
        </h3>
      );
    }

    return <p key={key}>{renderInlineFormatting(line)}</p>;
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
        const isList = lines.every((line) => /^[-*]\s+/.test(line));

        if (isList) {
          return (
            <ul key={blockIndex} className="space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={`${blockIndex}-${lineIndex}`} className="list-disc">
                  {renderInlineFormatting(line.replace(/^[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <div key={blockIndex} className="space-y-2">
            {lines.map((line, lineIndex) => renderLine(line, `${blockIndex}-${lineIndex}`))}
          </div>
        );
      })}
    </div>
  );
}

async function readJson<T>(response: Response): Promise<T & { error?: ApiError }> {
  const data = (await response.json()) as T & { error?: ApiError };

  if (!response.ok) {
    const error = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(error ?? "请求失败，请稍后再试。");
  }

  return data;
}

function getMessageType(message: Message): "text" | "image" | "video" {
  if (message.videoUrl) return "video";
  if (message.images?.length) return "image";
  return "text";
}

function InlineVideoResult({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playVideo = () => {
    void videoRef.current?.play().catch(() => undefined);
  };

  const pauseVideo = () => {
    videoRef.current?.pause();
  };

  return (
    <div className="mt-3 inline-block max-w-full overflow-hidden rounded-xl border border-[#e5e5e5] bg-black shadow-sm">
      <video
        ref={videoRef}
        src={url}
        className="block max-h-[520px] w-auto max-w-full object-contain"
        controls
        loop
        muted
        playsInline
        preload="metadata"
        onMouseEnter={playVideo}
        onMouseLeave={pauseVideo}
        onFocus={playVideo}
        onBlur={pauseVideo}
      />
    </div>
  );
}

function readFileAsUploadedImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name || "粘贴图片",
        url: String(reader.result),
      });
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function copyImageToClipboard(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();

  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type || "image/png"]: blob,
    }),
  ]);
}

export function ChatWorkbench() {
  const selectedModel: ModelName = DEFAULT_CHAT_MODEL;
  const [mode, setMode] = useState<WorkMode>("agent");
  const [selectedRatio, setSelectedRatio] = useState(ratioOptions[1]);
  const [selectedResolution, setSelectedResolution] = useState(resolutionOptions[0]);
  const [selectedStyle, setSelectedStyle] = useState(styleOptions[0]);
  const [selectedDuration, setSelectedDuration] = useState(durationOptions[0]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [openSessionMenuId, setOpenSessionMenuId] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState("");
  const [sessionMenuPlacement, setSessionMenuPlacement] = useState<"top" | "bottom">("bottom");
  const [renamingSessionId, setRenamingSessionId] = useState("");
  const [renameInput, setRenameInput] = useState("");
  const [openControlMenu, setOpenControlMenu] = useState<ControlMenuName | ModeMenuName | "">("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [modelInfoSessionId, setModelInfoSessionId] = useState("");
  const [completedTypingMessageIds, setCompletedTypingMessageIds] = useState<Set<string>>(() => new Set());
  const [intentMemoryRules, setIntentMemoryRules] = useState<IntentMemoryRule[]>([]);
  const [feedbackLogs, setFeedbackLogs] = useState<FeedbackLogEntry[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<{ messageId: string; state: "success" | "error" } | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, "like" | "dislike">>({});
  const [messageIssueFeedback, setMessageIssueFeedback] = useState<Record<string, "wrong" | "wrong_mode">>({});
  const [uploadLimitTipVisible, setUploadLimitTipVisible] = useState(false);
  const [sendingSessionIds, setSendingSessionIds] = useState<Set<string>>(() => new Set());
  const [resolvingSessionIds, setResolvingSessionIds] = useState<Set<string>>(() => new Set());
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runningRequestIdsRef = useRef<Set<string>>(new Set());
  const sendingSessionIdsRef = useRef<Set<string>>(new Set());
  const typingScrollFrameRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const uploadLimitTipTimerRef = useRef<number | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const messages = activeSession?.messages ?? initialMessages;
  const activeInput = activeSession?.draftInput ?? "";
  const activeUploadedFiles = activeSession?.uploadedFiles ?? [];
  const activeUploadedImages = activeSession?.uploadedImages ?? [];
  const hasConversation = messages.length > 1;
  const activeIsResolving = activeSession ? resolvingSessionIds.has(activeSession.id) : false;
  const isThinking = activeIsResolving || (activeSession?.pendingRequest?.mode === "agent") || modelInfoSessionId === activeSession?.id;
  const activeHasPendingRequest = Boolean(activeSession?.pendingRequest);
  const activeIsSending = activeSession ? sendingSessionIds.has(activeSession.id) : false;

  const setSessionSending = useCallback((sessionId: string, isSending: boolean) => {
    if (isSending) {
      sendingSessionIdsRef.current.add(sessionId);
    } else {
      sendingSessionIdsRef.current.delete(sessionId);
    }

    setSendingSessionIds((current) => {
      const next = new Set(current);
      if (isSending) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return next;
    });
  }, []);

  const setSessionResolving = useCallback((sessionId: string, isResolving: boolean) => {
    setResolvingSessionIds((current) => {
      const next = new Set(current);
      if (isResolving) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return next;
    });
  }, []);

  const setActiveDraftInput = useCallback((value: string) => {
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? { ...session, draftInput: value } : session)));
  }, [activeSessionId]);

  const addActiveUploadedImages = useCallback((images: UploadedImage[]) => {
    if (images.length === 0) return;

    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              uploadedFiles: undefined,
              uploadedImages: [...(session.uploadedImages ?? []), ...images].slice(0, MAX_UPLOADED_IMAGES),
            }
          : session,
      ),
    );
  }, [activeSessionId]);

  const removeActiveUploadedImage = useCallback((imageId: string) => {
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).filter((image) => image.id !== imageId) } : session)));
  }, [activeSessionId]);

  const markTypingComplete = useCallback((messageId: string) => {
    setCompletedTypingMessageIds((current) => {
      if (current.has(messageId)) return current;

      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }, []);

  const keepTypingAtBottom = useCallback(() => {
    if (typingScrollFrameRef.current !== null) return;

    typingScrollFrameRef.current = window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      typingScrollFrameRef.current = null;
    });
  }, []);

  const rememberIntentCorrection = useCallback((source: string, targetMode: IntentMode) => {
    setIntentMemoryRules((current) => upsertIntentMemoryRule(current, source, targetMode));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? (JSON.parse(stored) as WorkSession[]) : [];
        const savedSessions = Array.isArray(parsed) && parsed.length > 0 ? parsed : [createSession()];
        const nextSessions = getPersistableSessions(savedSessions);
        const storedActiveSessionId = window.localStorage.getItem(ACTIVE_SESSION_KEY);
        const nextActiveSessionId = storedActiveSessionId && nextSessions.some((session) => session.id === storedActiveSessionId) ? storedActiveSessionId : nextSessions[0].id;
        setSessions(nextSessions);
        setActiveSessionId(nextActiveSessionId);
        setCompletedTypingMessageIds(new Set(getAssistantMessageIds(nextSessions)));
        const storedIntentMemory = window.localStorage.getItem(INTENT_MEMORY_KEY);
        const parsedIntentMemory = storedIntentMemory ? (JSON.parse(storedIntentMemory) as IntentMemoryRule[]) : [];
        setIntentMemoryRules(Array.isArray(parsedIntentMemory) ? parsedIntentMemory.slice(0, MAX_INTENT_MEMORY_RULES) : []);
        const storedFeedbackLogs = window.localStorage.getItem(FEEDBACK_LOG_KEY);
        const parsedFeedbackLogs = storedFeedbackLogs ? (JSON.parse(storedFeedbackLogs) as FeedbackLogEntry[]) : [];
        setFeedbackLogs(Array.isArray(parsedFeedbackLogs) ? parsedFeedbackLogs.slice(0, MAX_FEEDBACK_LOGS) : []);
      } catch {
        const session = createSession();
        setSessions([session]);
        setActiveSessionId(session.id);
        setCompletedTypingMessageIds(new Set(getAssistantMessageIds([session])));
        setIntentMemoryRules([]);
        setFeedbackLogs([]);
      } finally {
        setIsLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    saveSessions(sessions);
  }, [isLoaded, sessions]);

  useEffect(() => {
    if (!isLoaded || !activeSessionId) return;

    window.localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
  }, [activeSessionId, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(INTENT_MEMORY_KEY, JSON.stringify(intentMemoryRules));
    } catch {
      window.localStorage.removeItem(INTENT_MEMORY_KEY);
    }
  }, [intentMemoryRules, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(feedbackLogs));
    } catch {
      window.localStorage.removeItem(FEEDBACK_LOG_KEY);
    }
  }, [feedbackLogs, isLoaded]);

  useEffect(() => {
    return () => {
      if (typingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(typingScrollFrameRef.current);
      }
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      if (uploadLimitTipTimerRef.current !== null) {
        window.clearTimeout(uploadLimitTipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [activeSessionId, messages.length, isThinking]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      const element = chatScrollRef.current;
      if (!element) return;

      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      setShowScrollToBottom(distanceToBottom > 120);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeSessionId]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const updateScrollToBottomButton = () => {
    const element = chatScrollRef.current;
    if (!element) return;

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollToBottom(distanceToBottom > 120);
  };

  const toggleSessionMenu = (sessionId: string, button: HTMLButtonElement) => {
    setOpenSessionMenuId((current) => {
      if (current === sessionId) return "";

      const rect = button.getBoundingClientRect();
      const menuHeight = 128;
      const reservedBottom = 32;
      setSessionMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");

      return sessionId;
    });
  };

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "40px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
  }, [activeInput]);

  useEffect(() => {
    if (!openSessionMenuId) return;

    const closeMenu = () => setOpenSessionMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openSessionMenuId]);

  useEffect(() => {
    if (!openMessageMenuId) return;

    const closeMenu = () => setOpenMessageMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openMessageMenuId]);

  useEffect(() => {
    if (!openControlMenu) return;

    const closeMenu = () => setOpenControlMenu("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openControlMenu]);

  const renderControlMenu = (name: ControlMenuName, value: string, options: string[], onChange: (value: string) => void) => (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpenControlMenu((current) => (current === name ? "" : name))}
        className="h-8 w-20 rounded-full bg-[#f7f7f7] px-3 text-[12px] text-[#555555] outline-none ring-1 ring-[#e5e5e5] transition hover:bg-[#ececec]"
      >
        {value}
      </button>

      {openControlMenu === name ? (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-20 overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-white p-1 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpenControlMenu("");
              }}
              className={
                option === value
                  ? "block h-8 w-full whitespace-nowrap rounded-lg bg-[#ececec] px-3 text-left text-[12px] font-medium text-[#111111]"
                  : "block h-8 w-full whitespace-nowrap rounded-lg px-3 text-left text-[12px] text-[#555555] hover:bg-[#f4f4f4]"
              }
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const startNewSession = () => {
    setOpenSessionMenuId("");

    if (activeSession && isEmptySession(activeSession)) {
      return;
    }

    const existingEmptySession = sessions.find(isEmptySession);

    if (existingEmptySession) {
      setActiveSessionId(existingEmptySession.id);
      return;
    }

    const session = createSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
  };

  const pinSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const target = current.find((session) => session.id === sessionId);
      if (!target) return current;
      return [target, ...current.filter((session) => session.id !== sessionId)];
    });
  };

  const renameSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;

    setOpenSessionMenuId("");
    setRenamingSessionId(sessionId);
    setRenameInput(session.title);
  };

  const submitRenameSession = () => {
    const title = renameInput.trim();
    if (!title) return;

    setSessions((current) => current.map((item) => (item.id === renamingSessionId ? { ...item, title, updatedAt: Date.now() } : item)));
    setRenamingSessionId("");
    setRenameInput("");
  };

  const cancelRenameSession = () => {
    setRenamingSessionId("");
    setRenameInput("");
  };

  const deleteSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const nextSessions = current.filter((session) => session.id !== sessionId);
      const safeSessions = nextSessions.length > 0 ? nextSessions : [createSession()];

      if (sessionId === activeSessionId || !safeSessions.some((session) => session.id === activeSessionId)) {
        setActiveSessionId(safeSessions[0].id);
      }

      return safeSessions;
    });
  };

  const appendAssistantMessage = useCallback((sessionId: string, payload: Partial<Message> & Pick<Message, "content">) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? payload.requestId && payload.mode !== "video" && session.messages.some((message) => message.role === "assistant" && message.requestId === payload.requestId)
            ? session
            : {
                ...session,
                updatedAt: Date.now(),
                messages: [
                  ...session.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: payload.content,
                    createdAt: Date.now(),
                    requestId: payload.requestId,
                    images: payload.images,
                    videoUrl: payload.videoUrl,
                    statusText: payload.statusText,
                    error: payload.error,
                    mode: payload.mode,
                  },
                ],
              }
          : session,
      ),
    );
  }, []);

  const updateAssistantMessageByRequestId = useCallback((sessionId: string, requestId: string, payload: Partial<Message>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      ...payload,
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const updatePendingRequest = useCallback((sessionId: string, requestId: string, payload: Partial<PendingGeneration>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId && session.pendingRequest?.id === requestId
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: {
                ...session.pendingRequest,
                ...payload,
              },
            }
          : session,
      ),
    );
  }, []);

  const clearPendingRequest = useCallback((sessionId: string, requestId: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId && session.pendingRequest?.id === requestId
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: null,
            }
          : session,
      ),
    );
  }, []);

  const runGeneration = useCallback(async (sessionId: string, pendingRequest: PendingGeneration) => {
    if (runningRequestIdsRef.current.has(pendingRequest.id)) return;

    runningRequestIdsRef.current.add(pendingRequest.id);
    try {
      let prompt = pendingRequest.prompt;

      if (!prompt) {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: pendingRequest.model,
            mode: pendingRequest.mode,
            messages: pendingRequest.messages,
            settings: pendingRequest.settings,
          }),
        });

        const data = await readJson<{ content?: string; model?: string }>(response);
        prompt = data.content?.trim() || "暂时没有生成出可用内容，请换一种说法再试。";
        updatePendingRequest(sessionId, pendingRequest.id, { prompt });

        if (pendingRequest.mode === "agent") {
          appendAssistantMessage(sessionId, { content: prompt, mode: pendingRequest.mode, requestId: pendingRequest.id });
        }
      }

      if (pendingRequest.mode === "image" && prompt) {
        const imageResponse = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, referenceImages: pendingRequest.referenceImages }),
        });

        const imageData = await readJson<{ images?: string[] }>(imageResponse);
        const nextImages = imageData.images ?? [];

        if (nextImages.length === 0) {
          throw new Error("图片平台没有返回图片，请稍后再试。");
        }

        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: "我已经根据你的需求生成了一张图片，你可以直接查看结果。",
          images: nextImages,
          statusText: undefined,
          mode: pendingRequest.mode,
        });
      }

      if (pendingRequest.mode === "video" && prompt) {
        let taskId = pendingRequest.taskId;

        if (!taskId) {
          const taskResponse = await fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, referenceImages: pendingRequest.referenceImages, settings: pendingRequest.settings }),
          });

          const taskData = await readJson<{ id?: string; polling_url?: string; pollingUrl?: string }>(taskResponse);

          const openRouterTaskId = taskData.polling_url ?? taskData.pollingUrl ?? taskData.id;

          if (!openRouterTaskId) {
            throw new Error("视频平台没有返回任务编号");
          }

          taskId = openRouterTaskId;
          updatePendingRequest(sessionId, pendingRequest.id, { taskId });
          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: videoStatusLabels.queued });
          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    videoTask: { taskId: taskId ?? "", status: "queued" },
                  }
                : session,
            ),
          );
        }

        for (let i = 0; i < MAX_VIDEO_POLL_ATTEMPTS; i++) {
          const pollInterval = i < FAST_VIDEO_POLL_ATTEMPTS ? FAST_VIDEO_POLL_INTERVAL_MS : SLOW_VIDEO_POLL_INTERVAL_MS;
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          const pollResponse = await fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });

          const pollData = await readJson<{
            status?: string;
            content?: { video_url?: string };
            error?: { message?: string } | string;
          }>(pollResponse);

          const status = (pollData.status ?? "running").toLowerCase();
          const statusText = videoStatusLabels[status] ?? `视频状态：${status}`;

          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText });

          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    updatedAt: Date.now(),
                    videoTask: {
                      taskId: taskId ?? "",
                      status,
                      videoUrl: pollData.content?.video_url,
                    },
                  }
                : session,
            ),
          );

          if (["succeeded", "success", "completed", "complete", "done"].includes(status)) {
            if (!pollData.content?.video_url) {
              updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
                content: "视频平台返回已完成，但没有返回视频地址。",
                error: "视频生成完成但缺少视频链接，需要继续对接平台返回字段。",
                statusText: "视频缺少链接",
                mode: pendingRequest.mode,
              });
              break;
            }

            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
              content: "视频已经生成完成，你可以直接播放或打开查看。",
              videoUrl: pollData.content?.video_url,
              statusText: videoStatusLabels.succeeded,
              mode: pendingRequest.mode,
            });
            break;
          }

          if (["failed", "error", "expired"].includes(status)) {
            const errorMessage = typeof pollData.error === "string" ? pollData.error : pollData.error?.message;
            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
              content: "这次视频生成没有成功，你可以换一种描述再试。",
              error: errorMessage ?? videoStatusLabels[status],
              mode: pendingRequest.mode,
            });
            break;
          }

          if (i === MAX_VIDEO_POLL_ATTEMPTS - 1) {
            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
              content: "这个视频任务排队太久，这次先停止等待。",
              error: "这个任务排队太久，建议重试。",
              statusText: "视频生成超时",
              mode: pendingRequest.mode,
            });
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败，请稍后再试。";
      if (pendingRequest.mode === "video") {
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: "这次视频生成没有成功。",
          error: message,
          statusText: "视频生成失败",
          mode: pendingRequest.mode,
        });
      } else if (pendingRequest.mode === "image") {
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: "这次图片生成没有成功。",
          error: message,
          statusText: imageStatusLabels.failed,
          mode: pendingRequest.mode,
        });
      } else {
        appendAssistantMessage(sessionId, { content: message, error: message, mode: pendingRequest.mode, requestId: pendingRequest.id });
      }
    } finally {
      clearPendingRequest(sessionId, pendingRequest.id);
      runningRequestIdsRef.current.delete(pendingRequest.id);
    }
  }, [appendAssistantMessage, clearPendingRequest, updateAssistantMessageByRequestId, updatePendingRequest]);

  const resolveGenerationMode = useCallback(async (text: string, optimisticMessages: Message[]): Promise<WorkMode> => {
    const correctionMode = getCorrectionMode(text);
    if (correctionMode) return correctionMode;

    const rememberedMode = getRememberedIntent(text, intentMemoryRules);
    if (rememberedMode) return rememberedMode;

    const hardMode = getHardGenerationMode(text);
    if (hardMode) return hardMode;

    try {
      const response = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: optimisticMessages
            .filter((message) => message.id !== "seed-1")
            .map((message) => ({ role: message.role, content: message.content, images: message.images })),
        }),
      });

      const data = await readJson<IntentClassification>(response);
      const confidence = data.confidence ?? 0;

      if ((data.intent === "image" || data.intent === "video") && confidence >= 0.65) {
        return data.intent;
      }
    } catch {
      return "agent";
    }

    return "agent";
  }, [intentMemoryRules, selectedModel]);

  useEffect(() => {
    if (!isLoaded) return;

    sessions.forEach((session) => {
      if (!session.pendingRequest || runningRequestIdsRef.current.has(session.pendingRequest.id)) return;
      void runGeneration(session.id, session.pendingRequest);
    });
  }, [isLoaded, runGeneration, sessions]);

  const sendMessage = async () => {
    const rawText = activeInput.trim();
    if ((!rawText && activeUploadedImages.length === 0) || !activeSession || activeHasPendingRequest || sendingSessionIdsRef.current.has(activeSession.id)) return;

    const sessionId = activeSession.id;
    setSessionSending(sessionId, true);
    const uploadedReferenceImages = activeUploadedImages.map((image) => image.url);
    const referenceImages = uploadedReferenceImages.length > 0 ? uploadedReferenceImages : getRecentReferenceImages(activeSession.messages, rawText);
    const text = rawText || getImageOnlyPrompt(mode);
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, createdAt: Date.now(), images: referenceImages.length > 0 ? referenceImages : undefined };
    const optimisticMessages = [...activeSession.messages, userMessage];

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新对话" ? getSessionTitle(text) : session.title,
              updatedAt: Date.now(),
              messages: optimisticMessages,
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );

    if (isModelInfoQuestion(text)) {
      const selectedModelLabel = "Seed 2.0 Lite";
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新对话" ? getSessionTitle(text) : session.title,
                updatedAt: Date.now(),
                messages: optimisticMessages,
                draftInput: "",
              }
            : session,
        ),
      );
      setModelInfoSessionId(sessionId);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            mode: "agent",
            messages: [{ role: "user", content: "请返回一次模型探测结果。" }],
          }),
        });
        const data = await readJson<{ model?: string }>(response);
        appendAssistantMessage(sessionId, {
          content: data.model
            ? `当前选择：${selectedModelLabel}（${selectedModel}）。OpenRouter 本次实际路由到：${data.model}。`
            : `当前选择：${selectedModelLabel}（${selectedModel}）。OpenRouter 没有返回本次实际路由模型。`,
          mode: "agent",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "模型信息查询失败。";
        appendAssistantMessage(sessionId, { content: message, error: message, mode: "agent" });
      } finally {
        setModelInfoSessionId((current) => (current === sessionId ? "" : current));
        setSessionSending(sessionId, false);
      }
      return;
    }

    if (mode === "agent" && isSimpleGreeting(text) && referenceImages.length === 0) {
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新对话" ? getSessionTitle(text) : session.title,
                updatedAt: Date.now(),
                messages: [
                  ...optimisticMessages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "你好，我在。你想做图片、视频，还是先让我帮你整理创意？",
                    createdAt: Date.now(),
                    mode: "agent",
                  },
                ],
                draftInput: "",
                uploadedFiles: [],
                uploadedImages: [],
              }
            : session,
        ),
      );
      setSessionSending(sessionId, false);
      return;
    }

    const correctionMode = getCorrectionMode(text);
    const previousUserMessage = getLastUserMessage(activeSession.messages);

    if (correctionMode && previousUserMessage) {
      rememberIntentCorrection(previousUserMessage.content, correctionMode);
    }

    setSessionResolving(sessionId, true);

    let generationMode: WorkMode;

    try {
      generationMode = mode === "agent" ? await resolveGenerationMode(text, optimisticMessages) : mode;
    } catch {
      generationMode = "agent";
    }

    setSessionResolving(sessionId, false);

    const pendingRequest: PendingGeneration = {
      id: crypto.randomUUID(),
      model: selectedModel,
      mode: generationMode,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      settings:
        generationMode === "agent"
          ? undefined
          : {
              ratio: selectedRatio,
              resolution: selectedResolution,
              style: selectedStyle,
              duration: generationMode === "video" ? selectedDuration : undefined,
            },
      messages: toChatPayloadMessages(optimisticMessages),
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新对话" ? getSessionTitle(text) : session.title,
              updatedAt: Date.now(),
              messages: optimisticMessages,
              pendingRequest,
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );

    if (generationMode === "image") {
      appendAssistantMessage(sessionId, {
        content: "我已经开始生成图片，结果出来后会直接显示在这里。",
        statusText: imageStatusLabels.creating,
        mode: generationMode,
        requestId: pendingRequest.id,
      });
    }

    if (generationMode === "video") {
      appendAssistantMessage(sessionId, {
        content: "我已经开始生成视频，结果出来后会直接显示在这里。",
        statusText: videoStatusLabels.creating,
        mode: generationMode,
        requestId: pendingRequest.id,
      });
    }

    setSessionSending(sessionId, false);
    void runGeneration(sessionId, pendingRequest);
  };

  const addFeedbackLog = useCallback((kind: FeedbackKind, message: Message) => {
    if (!activeSession) return;

    const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
    const context = activeSession.messages
      .slice(Math.max(0, messageIndex - 6), messageIndex + 1)
      .map((item) => ({ role: item.role, content: item.content.slice(0, 1200) }));

    setFeedbackLogs((current) => [
      {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        kind,
        sessionId: activeSession.id,
        sessionTitle: activeSession.title,
        messageId: message.id,
        messageType: getMessageType(message),
        executionMode: message.mode,
        activeMode: mode,
        context,
        message: {
          content: message.content,
          images: message.images,
          videoUrl: message.videoUrl,
          statusText: message.statusText,
          error: message.error,
          mode: message.mode,
        },
        intentMemoryRules,
      },
      ...current,
    ].slice(0, MAX_FEEDBACK_LOGS));
  }, [activeSession, intentMemoryRules, mode]);

  const copyMessage = useCallback(async (message: Message) => {
    addFeedbackLog("copy", message);

    const showCopyFeedback = (state: "success" | "error") => {
      setCopyFeedback({ messageId: message.id, state });
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    };

    try {
      if (message.videoUrl) {
        showCopyFeedback("error");
        return;
      }

      if (message.images?.[0]) {
        await copyImageToClipboard(message.images[0]);
      } else {
        await navigator.clipboard.writeText(message.content);
      }

      showCopyFeedback("success");
    } catch {
      showCopyFeedback("error");
    }
  }, [addFeedbackLog]);

  const regenerateMessage = useCallback((message: Message) => {
    if (!activeSession || activeHasPendingRequest) return;

    addFeedbackLog("regenerate", message);

    const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
    const previousUserMessage = [...activeSession.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user");
    if (!previousUserMessage) return;

    const generationMode = message.mode ?? mode;
    const sessionId = activeSession.id;
    const replayMessages = activeSession.messages
      .slice(0, messageIndex)
      .filter((item) => item.id !== "seed-1")
      .map((item) => ({ role: item.role, content: item.content, images: item.images }));
    const referenceImages = previousUserMessage.images?.filter(Boolean);
    const pendingRequest: PendingGeneration = {
      id: crypto.randomUUID(),
      model: selectedModel,
      mode: generationMode,
      referenceImages: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
      settings:
        generationMode === "agent"
          ? undefined
          : {
              ratio: selectedRatio,
              resolution: selectedResolution,
              style: selectedStyle,
              duration: generationMode === "video" ? selectedDuration : undefined,
            },
      messages: replayMessages,
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: [...session.messages, { id: crypto.randomUUID(), role: "user", content: previousUserMessage.content, createdAt: Date.now() }],
              pendingRequest,
            }
          : session,
      ),
    );
    void runGeneration(sessionId, pendingRequest);
  }, [activeHasPendingRequest, activeSession, addFeedbackLog, mode, runGeneration, selectedDuration, selectedModel, selectedRatio, selectedResolution, selectedStyle]);

  const submitFeedback = useCallback((kind: FeedbackKind, message: Message) => {
    addFeedbackLog(kind, message);

    if (kind === "wrong_mode" && activeSession) {
      const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
      const previousUserMessage = [...activeSession.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user");
      const correctedMode: IntentMode = message.mode === "video" ? "image" : "video";

      if (previousUserMessage) {
        rememberIntentCorrection(previousUserMessage.content, correctedMode);
      }
    }
  }, [activeSession, addFeedbackLog, rememberIntentCorrection]);

  const copyMessageTextOnly = useCallback(async (message: Message) => {
    setOpenMessageMenuId("");

    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      setCopyFeedback({ messageId: message.id, state: "error" });
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    }
  }, []);

  const deleteAssistantMessage = useCallback((messageId: string) => {
    setOpenMessageMenuId("");
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.filter((message) => message.id !== messageId),
            }
          : session,
      ),
    );
  }, [activeSessionId]);

  const toggleReaction = useCallback((kind: "like" | "dislike", message: Message) => {
    setMessageReactions((current) => {
      const next = { ...current };

      if (next[message.id] === kind) {
        delete next[message.id];
        return next;
      }

      next[message.id] = kind;
      return next;
    });
    addFeedbackLog(kind, message);
  }, [addFeedbackLog]);

  const toggleIssueFeedback = useCallback((kind: "wrong" | "wrong_mode", message: Message) => {
    setMessageIssueFeedback((current) => {
      const next = { ...current };

      if (next[message.id] === kind) {
        delete next[message.id];
        return next;
      }

      next[message.id] = kind;
      return next;
    });
    submitFeedback(kind, message);
  }, [submitFeedback]);

  const addFilesToInput = useCallback(async (files: File[]) => {
    const allowedCount = MAX_UPLOADED_IMAGES - activeUploadedImages.length;
    const allImageFiles = files.filter((file) => file.type.startsWith("image/"));
    const imageFiles = allImageFiles.slice(0, Math.max(0, allowedCount));

    if (allImageFiles.length > allowedCount) {
      setUploadLimitTipVisible(true);
      if (uploadLimitTipTimerRef.current !== null) {
        window.clearTimeout(uploadLimitTipTimerRef.current);
      }
      uploadLimitTipTimerRef.current = window.setTimeout(() => {
        setUploadLimitTipVisible(false);
        uploadLimitTipTimerRef.current = null;
      }, 1500);
    }

    if (imageFiles.length === 0) return;

    const images = await Promise.all(imageFiles.map(readFileAsUploadedImage));
    addActiveUploadedImages(images);
  }, [activeUploadedImages.length, addActiveUploadedImages]);

  return (
    <section className={isSidebarCollapsed ? "grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white" : "grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white lg:grid-cols-[262px_minmax(0,1fr)]"}>
      <aside className={isSidebarCollapsed ? "hidden" : "hidden h-screen min-h-0 flex-col overflow-hidden border-r border-[#e5e5e5] bg-[#f9f9f9] px-3 py-4 lg:flex"}>
          <div className="mb-5 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6667ff] text-white">
            <MoonStar className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold leading-5 tracking-tight text-[#111111]">映造</div>
            <div className="mt-1 text-xs text-[#8a8a8a]">AI影片助手</div>
          </div>
        </div>
        <div className="mb-[22px] space-y-[5px]">
          <button type="button" className="flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]">
            <MessageSquareMore className="h-5 w-5 shrink-0 text-[#111111]" strokeWidth={1.7} aria-hidden="true" />
            <span className="text-[13px] leading-[1.2]">对话模式</span>
          </button>
          <button type="button" disabled className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#8a8a8a] transition hover:bg-[#ececec] disabled:cursor-not-allowed">
            <Workflow className="h-5 w-5 shrink-0 text-[#6f6f6f]" strokeWidth={1.7} aria-hidden="true" />
            <span className="text-[13px] leading-[1.2]">工作流模式</span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-[#8a8a8a] ring-1 ring-[#e3e3e3]">未开放</span>
          </button>
          <button type="button" disabled className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#8a8a8a] transition hover:bg-[#ececec] disabled:cursor-not-allowed">
            <FolderOpen className="h-5 w-5 shrink-0 text-[#6f6f6f]" strokeWidth={1.7} aria-hidden="true" />
            <span className="text-[13px] leading-[1.2]">资产管理</span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-[#8a8a8a] ring-1 ring-[#e3e3e3]">未开放</span>
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between px-2 text-xs text-[#8a8a8a]">
          <span>历史对话</span>
          <span>{sessions.length}</span>
        </div>
        <button
          type="button"
          onClick={startNewSession}
          className="relative mb-2 flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-[#cfcfcf] px-3 text-center font-medium text-[#111111] transition hover:border-[#b8b8b8] hover:bg-[#ececec]"
        >
          <span className="relative text-[13px] leading-[1.2]">
            <Plus className="absolute right-full top-1/2 mr-2 h-5 w-5 -translate-y-1/2 text-[#111111]" strokeWidth={1.7} aria-hidden="true" />
            新建对话
          </span>
        </button>
        <div className="yinzao-chat-scroll -mr-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-px pl-px pr-3 pt-px">
          {sessions.map((session) => {
            const isActive = session.id === activeSession?.id;
            const isMenuOpen = openSessionMenuId === session.id;
            const isSessionRunning = Boolean(session.pendingRequest) || modelInfoSessionId === session.id;

            return (
              <div key={session.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setOpenSessionMenuId("");
                  }}
                  className={
                    isActive
                      ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left"
                      : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"
                  }
                >
                  {isSessionRunning ? <HaloPulseIndicator /> : null}
                  <div className={isActive ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{session.title}</div>
                </button>

                <button
                  type="button"
                  aria-label="打开对话菜单"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSessionMenu(session.id, event.currentTarget);
                  }}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]"
                >
                  <Ellipsis className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </button>

                {isMenuOpen ? (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className={
                      sessionMenuPlacement === "top"
                        ? "absolute bottom-10 right-1 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                        : "absolute right-1 top-10 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                    }
                  >
                    <button type="button" onClick={() => pinSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                      <Pin className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                      <span>置顶</span>
                    </button>
                    <button type="button" onClick={() => renameSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                      <SquarePen className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                      <span>重命名</span>
                    </button>
                    <button type="button" onClick={() => deleteSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                      <span>删除</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="flex h-screen min-h-screen flex-col bg-white">
        <div className="relative z-30 flex h-[56px] shrink-0 items-center justify-center border-b border-[#eeeeee] bg-white px-14">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
            aria-label={isSidebarCollapsed ? "展开左侧栏" : "收起左侧栏"}
          >
            {isSidebarCollapsed ? <PanelLeft className="h-[22px] w-[22px]" strokeWidth={1.7} aria-hidden="true" /> : <PanelLeftDashed className="h-[22px] w-[22px]" strokeWidth={1.7} aria-hidden="true" />}
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-center">
            <div className="truncate text-[13px] font-medium leading-8 text-[#111111]">{activeSession?.title ?? "新对话"}</div>
            {activeSession ? (
              <button
                type="button"
                onClick={() => renameSession(activeSession.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
                aria-label="重命名当前对话"
              >
                <SquarePen className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              </button>
            ) : null}
          </div>

        </div>

        <div className="relative flex-1 overflow-hidden">
          <div ref={chatScrollRef} onScroll={updateScrollToBottomButton} className="yinzao-chat-scroll h-full overflow-y-auto bg-white px-4 py-8 pb-6 sm:px-6 lg:px-8">
          {!hasConversation ? (
            <div className="flex min-h-full flex-col items-center justify-center pb-8 pt-10 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f7f7f7] px-3 py-1.5 text-xs font-medium text-[#333333] ring-1 ring-[#e5e5e5]">
                <MoonStar className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                AI 创作工作台
              </div>
              <div className="mb-3 text-[32px] font-semibold tracking-[-0.03em] text-[#111111] sm:text-[38px]">今天想让映造帮你做什么？</div>
              <div className="max-w-2xl text-sm leading-7 text-[#6f6f6f]">
                你可以像聊天一样直接输入需求。图片、视频和生成结果都会在对话里连续显示，不再单独分栏。
              </div>

              <div className="mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
                {quickActions.map((action, index) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => setActiveDraftInput(action.title)}
                    className="group rounded-2xl border border-[#e5e5e5] bg-white px-4 py-4 text-left transition hover:bg-[#f7f7f7]"
                  >
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#f2f2f2] text-[#333333] transition group-hover:bg-[#e8e8e8]">
                      {index === 2 ? <Film className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> : <ImageIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
                    </div>
                    <div className="text-sm font-medium text-[#111111]">{action.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[#6f6f6f]">{action.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message) => {
                const isAssistantMessageComplete = message.role !== "assistant" || completedTypingMessageIds.has(message.id);
                const messageType = getMessageType(message);
                const reaction = messageReactions[message.id];
                const issueFeedback = messageIssueFeedback[message.id];
                const isActiveVideoPending = activeSession?.pendingRequest?.mode === "video" && message.requestId === activeSession.pendingRequest.id && !message.videoUrl && !message.error;
                const isActiveImagePending = activeSession?.pendingRequest?.mode === "image" && message.requestId === activeSession.pendingRequest.id && !message.images?.length && !message.error;
                const isActiveMediaPending = isActiveVideoPending || isActiveImagePending;

                return (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={message.role === "user" ? "max-w-[78%]" : "flex max-w-[86%] gap-3"}>
                    {message.role === "assistant" ? (
                      <div className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e5ddff] bg-[#f1ecff] text-[#6d4aff]">
                        <MoonStar className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                      </div>
                    ) : null}
                    <div className="min-w-0">
                    <div
                      className={
                        message.role === "user"
                          ? "rounded-xl bg-[#f4f4f4] px-5 py-3 text-sm leading-7 text-[#111111]"
                          : "px-0 py-1 text-sm leading-7 text-[#111111]"
                      }
                    >
                      {message.role === "assistant" ? (
                        <TypewriterFormattedMessage messageId={message.id} content={message.content} isComplete={isAssistantMessageComplete} onComplete={markTypingComplete} onTick={keepTypingAtBottom} />
                      ) : (
                        message.content
                      )}
                    </div>

                    {message.images?.length && isAssistantMessageComplete ? (
                      <div className="mt-3 space-y-3">
                        {message.images.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
                            <Image src={url} alt="生成图片" width={1344} height={768} unoptimized className="w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {message.videoUrl && isAssistantMessageComplete ? (
                      <InlineVideoResult url={message.videoUrl} />
                    ) : null}

                    {message.statusText && !message.videoUrl && isAssistantMessageComplete ? (
                      <div className="relative mt-3 h-[400px] w-[400px] max-w-full overflow-hidden rounded-xl border border-[#dceefa] bg-[#eaf7ff] text-sm text-[#4f6f86]">
                        {isActiveMediaPending ? (
                          <>
                            <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
                            <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
                            <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
                            <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
                            <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
                            <div className="relative z-10 ml-3 mt-3 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
                              {getVideoWaitProgress(message.createdAt, timerNow)}%{isActiveImagePending ? "生成中" : "渲染中"}
                            </div>
                            <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]">
                              {message.statusText}
                              <InlineLoadingDots />
                              <div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(message.createdAt, timerNow)}</div>
                            </div>
                          </>
                        ) : (
                          <div className="p-5">
                            {message.statusText}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {message.error && isAssistantMessageComplete ? <div className="mt-3 text-sm text-rose-500">{message.error}</div> : null}
                    {message.role === "assistant" && isAssistantMessageComplete ? (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <FeedbackButton label={copyFeedback?.messageId === message.id ? (copyFeedback.state === "success" ? "已复制" : "无法复制") : "复制"} state={copyFeedback?.messageId === message.id ? copyFeedback.state : "idle"} onClick={() => void copyMessage(message)}>
                          <Copy className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
                        </FeedbackButton>
                        <FeedbackButton label="重新生成" onClick={() => regenerateMessage(message)}>
                          <RefreshCw className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
                        </FeedbackButton>
                        {reaction !== "dislike" ? (
                          <FeedbackButton label={reaction === "like" ? "取消喜欢" : "喜欢"} onClick={() => toggleReaction("like", message)}>
                            <ThumbsUp className="h-4.5 w-4.5" fill={reaction === "like" ? "currentColor" : "none"} strokeWidth={1.8} aria-hidden="true" />
                          </FeedbackButton>
                        ) : null}
                        {reaction !== "like" ? (
                          <FeedbackButton label={reaction === "dislike" ? "取消不喜欢" : "不喜欢"} onClick={() => toggleReaction("dislike", message)}>
                            <ThumbsDown className="h-4.5 w-4.5" fill={reaction === "dislike" ? "currentColor" : "none"} strokeWidth={1.8} aria-hidden="true" />
                          </FeedbackButton>
                        ) : null}
                        {messageType === "text" ? (
                          <FeedbackButton label={issueFeedback === "wrong" ? "取消回答不对" : "回答不对"} onClick={() => toggleIssueFeedback("wrong", message)}>
                            {issueFeedback === "wrong" ? <ActiveMessageCircleXIcon /> : <MessageCircleX className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />}
                          </FeedbackButton>
                        ) : null}
                        {messageType !== "text" ? (
                          <FeedbackButton label={issueFeedback === "wrong_mode" ? "取消模式反馈" : "要图给视频或要视频给图"} onClick={() => toggleIssueFeedback("wrong_mode", message)}>
                            {issueFeedback === "wrong_mode" ? <ActiveAngryIcon /> : <Angry className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />}
                          </FeedbackButton>
                        ) : null}
                        <div className="relative" onClick={(event) => event.stopPropagation()}>
                          <FeedbackButton label="更多" onClick={() => setOpenMessageMenuId((current) => (current === message.id ? "" : message.id))}>
                            <Ellipsis className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
                          </FeedbackButton>

                          {openMessageMenuId === message.id ? (
                            <div className="absolute bottom-9 left-0 z-40 w-36 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                              <button type="button" onClick={() => void copyMessageTextOnly(message)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                                <Copy className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                                <span>复制文字</span>
                              </button>
                              <button type="button" onClick={() => deleteAssistantMessage(message.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                                <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                                <span>删除</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <span className="ml-[10px] text-[12px] leading-8 text-[#b0b0b0]">映造感谢反馈 {formatMessageTime(message.createdAt)}</span>
                      </div>
                    ) : null}
                    </div>
                  </div>
                </div>
                );
              })}
              {isThinking ? <ThinkingIndicator /> : null}
              <div className="h-[30px]" ref={messageEndRef} />
            </div>
          )}
          </div>

        </div>

        <div className="relative z-20 -mt-10 shrink-0 bg-transparent px-4 pb-3 sm:px-6 lg:px-8">
          {uploadLimitTipVisible ? (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111111] px-3 py-2 text-[12px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
              最多上传五张图片
            </div>
          ) : null}
          {showScrollToBottom ? (
            <button
              type="button"
              onClick={scrollToBottom}
              className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#d9d9d9] bg-white text-[#6f6f6f] shadow-[0_8px_18px_rgba(0,0,0,0.10)] transition hover:text-[#111111]"
              aria-label="定位到最新对话"
            >
              <ArrowDownToLine className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
          <div className="relative z-10 mx-auto max-w-[768px] rounded-[26px] border border-[#d9d9d9] bg-white px-4 py-3 shadow-[0_10px_32px_rgba(0,0,0,0.10)] transition focus-within:border-[#bdbdbd]">
            {activeUploadedImages.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2 px-2">
                {activeUploadedImages.map((image) => (
                  <div key={image.id} className="group relative h-[100px] w-[100px] overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]">
                    <Image src={image.url} alt={image.name} width={100} height={100} unoptimized className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeActiveUploadedImage(image.id)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                      aria-label="移除图片"
                    >
                      <X className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : activeUploadedFiles.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2 px-2">
                {activeUploadedFiles.map((fileName, index) => (
                  <span key={`${fileName}-${index}`} className="rounded-full bg-[#f4f4f4] px-3 py-1 text-[12px] text-[#555555] ring-1 ring-[#e5e5e5]">
                    {fileName}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={activeInput}
                onChange={(e) => setActiveDraftInput(e.target.value)}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files ?? []);
                  if (files.some((file) => file.type.startsWith("image/"))) {
                    void addFilesToInput(files);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                style={{ fontSize: "14px" }}
                className="min-h-10 max-h-[300px] w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-1 leading-6 text-[#111111] outline-none placeholder:text-[#8a8a8a]"
                placeholder="发送消息..."
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[12px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    void addFilesToInput(files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f7f7f7] text-[#555555] ring-1 ring-[#e5e5e5] transition hover:bg-[#ececec]"
                  aria-label="上传图片"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </button>

                <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setOpenControlMenu((current) => (current === "mode" ? "" : "mode"))}
                    className="h-8 w-24 rounded-full bg-[#f7f7f7] px-3 text-[12px] font-medium text-[#111111] outline-none ring-1 ring-[#e5e5e5] transition hover:bg-[#ececec]"
                  >
                    {modeOptions.find((option) => option.value === mode)?.label}
                  </button>

                  {openControlMenu === "mode" ? (
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-24 overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-white p-1 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                      {modeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setMode(option.value);
                            setOpenControlMenu("");
                          }}
                          className={
                            option.value === mode
                              ? "block h-8 w-full whitespace-nowrap rounded-lg bg-[#ececec] px-3 text-left text-[12px] font-medium text-[#111111]"
                              : "block h-8 w-full whitespace-nowrap rounded-lg px-3 text-left text-[12px] text-[#555555] hover:bg-[#f4f4f4]"
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {mode !== "agent" ? (
                  <>
                    <button type="button" className="h-8 max-w-[120px] truncate rounded-full bg-[#f7f7f7] px-3 text-[12px] text-[#555555] outline-none ring-1 ring-[#e5e5e5] transition hover:bg-[#ececec]">
                      {mode === "image" ? "普通图片模型" : "普通视频模型"}
                    </button>
                    {renderControlMenu("ratio", selectedRatio, ratioOptions, setSelectedRatio)}
                    {renderControlMenu("resolution", selectedResolution, resolutionOptions, setSelectedResolution)}
                    {renderControlMenu("style", selectedStyle, styleOptions, setSelectedStyle)}
                    {mode === "video" ? renderControlMenu("duration", selectedDuration, durationOptions, setSelectedDuration) : null}
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={sendMessage}
                disabled={activeHasPendingRequest || activeIsSending || (!activeInput.trim() && activeUploadedImages.length === 0)}
                className="inline-flex h-9 items-center rounded-full bg-[#111111] px-5 text-[12px] font-medium text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white"
              >
                {activeHasPendingRequest ? "生成中..." : activeIsSending ? "发送中..." : "发送"}
              </button>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-4 z-0 text-left text-[11px] leading-5 text-[#9a9a9a] sm:left-6 lg:left-8">
            <div>映造可能会出错。请核查重要信息。</div>
            <div>对话：{DEFAULT_CHAT_MODEL}</div>
            <div>图片：{DEFAULT_IMAGE_MODEL}</div>
            <div>视频：{DEFAULT_VIDEO_MODEL}</div>
          </div>
        </div>
      </section>

      {renamingSessionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="relative w-full max-w-[500px] rounded-xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
            <button type="button" onClick={cancelRenameSession} className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-900" aria-label="关闭重命名弹窗">
              <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div className="mb-3 text-sm font-medium text-slate-900">请重新编辑对话名称：</div>
            <input
              value={renameInput}
              onChange={(event) => setRenameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRenameSession();
                if (event.key === "Escape") cancelRenameSession();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition hover:border-[#bcd3ff] focus:border-[#2b65f5]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cancelRenameSession} className="h-9 w-20 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50">
                取消
              </button>
              <button type="button" onClick={submitRenameSession} className="h-9 w-20 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
