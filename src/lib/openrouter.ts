import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import type { ConversationModel, ModelName } from "@/lib/models";
import { DEFAULT_IMAGE_MODEL, getExpectedImageDimensions, getImageModelRule, models, resolveImageSettingsForModel } from "@/lib/models";
import { getLocalImageDimensions, saveGeneratedAsset, type ImageDimensions } from "@/lib/local-assets";

export type ChatRequest = {
  model: ModelName;
  mode: "agent" | "chat" | "image" | "video";
  messages: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
  originalPrompt?: string;
  settings?: {
    ratio?: string;
    resolution?: string;
    style?: string;
    duration?: string;
  };
};

export type IntentClassification = {
  intent: "agent" | "image" | "video" | "prompt" | "clarify";
  confidence: number;
  reason: string;
};

export type AgentReplyIntent = "chat" | "film_knowledge" | "creative_consult" | "creative_structure" | "off_topic";
export type AssetTargetType = "character_image" | "scene_image" | "shot_image" | "shot_video" | "other";
export type SuggestionItem = {
  label: string;
  action?: string;
  assetTargetType?: AssetTargetType;
};
type SuggestionInput = string | SuggestionItem;

export type ChatResponse = {
  content: string;
  model?: string;
  intent?: AgentReplyIntent;
  suggestions?: SuggestionItem[];
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const execFileAsync = promisify(execFile);
const CHINA_MODEL_PREFIXES = [
  "qwen/",
  "deepseek/",
  "bytedance-seed/",
];
const MODELS_PER_PROVIDER = 3;

function getProviderId(modelId: string) {
  return modelId.split("/")[0] ?? modelId;
}

type OpenRouterImage = {
  image_url?: { url?: string };
  url?: string;
};

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      images?: OpenRouterImage[];
    };
  }>;
  images?: Array<{ image_url?: { url?: string }; url?: string }>;
  data?: Array<{ url?: string; b64_json?: string }>;
};

type OpenRouterMessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type OpenRouterErrorResponse = {
  error?: {
    message?: string;
    code?: number | string;
  };
};

type OpenRouterModelResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    architecture?: {
      modality?: string;
    };
  }>;
};

type StructuredAgentReply = {
  content?: string;
  intent?: AgentReplyIntent;
  suggestions?: SuggestionInput[];
};

const agentReplyIntents: AgentReplyIntent[] = ["chat", "film_knowledge", "creative_consult", "creative_structure", "off_topic"];

const assetTargetTypes: AssetTargetType[] = ["character_image", "scene_image", "shot_image", "shot_video", "other"];
const fallbackAgentSuggestions: SuggestionInput[] = ["让我写一个短剧故事", "讲讲电影是怎么做出来的", { label: "帮我拆一版分镜", assetTargetType: "shot_image" }];

function getOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Yinzao",
  };
}

function getCurlCommand() {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function toCurlHeaderArgs(headers: Record<string, string>) {
  return Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
}

async function curlPostJson<T>(url: string, headers: Record<string, string>, body: unknown, fallback: string) {
  const bodyPath = join(tmpdir(), `yinzao-openrouter-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);

  await writeFile(bodyPath, JSON.stringify(body));

  try {
    const { stdout } = await execFileAsync(
      getCurlCommand(),
      ["-sS", "-L", "-X", "POST", ...toCurlHeaderArgs(headers), "--data-binary", `@${bodyPath}`, "-w", "\n%{http_code}", url],
      { encoding: "utf8", maxBuffer: 120 * 1024 * 1024 },
    );
    const separatorIndex = stdout.lastIndexOf("\n");
    const text = separatorIndex >= 0 ? stdout.slice(0, separatorIndex) : stdout;
    const status = Number(separatorIndex >= 0 ? stdout.slice(separatorIndex + 1).trim() : 0);

    if (status < 200 || status >= 300) {
      try {
        const data = JSON.parse(text) as OpenRouterErrorResponse;
        throw new Error(`${fallback}：${data.error?.message ?? text}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith(fallback)) throw error;
        throw new Error(`${fallback}：${text}`);
      }
    }

    return JSON.parse(text) as T;
  } finally {
    await unlink(bodyPath).catch(() => undefined);
  }
}

function getLocalEnvValue(name: string) {
  const envPath = join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) return undefined;

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith(`${name}=`));

  return line?.split("=").slice(1).join("=").trim();
}

function getOpenRouterApiKey() {
  return getLocalEnvValue("OPENROUTER_API_KEY") || process.env.OPENROUTER_API_KEY;
}

function getMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

function toDataUrlIfLocalPublicAsset(url: string) {
  if (!url.startsWith("/generated/")) return url;

  const filePath = join(process.cwd(), "public", url.replace(/^\//, ""));
  if (!existsSync(filePath)) return url;

  const data = readFileSync(filePath);
  return `data:${getMimeType(filePath)};base64,${data.toString("base64")}`;
}

function toOpenRouterContent(text: string, images?: string[]): OpenRouterMessageContent {
  const safeImages = images?.filter(Boolean).map(toDataUrlIfLocalPublicAsset) ?? [];

  if (safeImages.length === 0) return text;

  return [
    { type: "text", text: text || "请分析这张图片。" },
    ...safeImages.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
}

function normalizeSuggestionItem(item: SuggestionInput): SuggestionItem | null {
  if (typeof item === "string") {
    const label = item.trim().replace(/^[-\d.、\s]+/, "");
    return label ? { label } : null;
  }

  const label = item.label?.trim().replace(/^[-\d.、\s]+/, "");
  if (!label) return null;

  return {
    label,
    action: typeof item.action === "string" ? item.action : undefined,
    assetTargetType: assetTargetTypes.includes(item.assetTargetType as AssetTargetType) ? item.assetTargetType : undefined,
  };
}

function normalizeSuggestions(items?: SuggestionInput[]) {
  const suggestions = (items ?? [])
    .map(normalizeSuggestionItem)
    .filter((item): item is SuggestionItem => Boolean(item))
    .filter((item, index, array) => array.findIndex((suggestion) => suggestion.label === item.label) === index)
    .slice(0, 5);

  return suggestions.length >= 3 ? suggestions : [...suggestions, ...fallbackAgentSuggestions.map(normalizeSuggestionItem).filter((item): item is SuggestionItem => Boolean(item))].filter((item, index, array) => array.findIndex((suggestion) => suggestion.label === item.label) === index).slice(0, 5);
}

function parseStructuredAgentReply(text: string): Required<Pick<ChatResponse, "content" | "intent" | "suggestions">> {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;

  try {
    const data = JSON.parse(jsonText) as StructuredAgentReply;
    const intent = data.intent && agentReplyIntents.includes(data.intent) ? data.intent : "chat";
    const content = typeof data.content === "string" && data.content.trim() ? data.content.trim() : text.trim();

    return {
      content,
      intent,
      suggestions: normalizeSuggestions(data.suggestions),
    };
  } catch {
    return {
      content: text.trim(),
      intent: "chat",
      suggestions: normalizeSuggestions(),
    };
  }
}

async function getOpenRouterError(response: Response, fallback: string) {
  const text = await response.text();

  try {
    const data = JSON.parse(text) as OpenRouterErrorResponse;
    const message = data.error?.message ?? text;
    const code = data.error?.code ?? response.status;

    if (response.status === 401 || code === 401 || message.toLowerCase().includes("user not found")) {
      return "OpenRouter API Key 无效或已过期。请更新 .env.local 里的 OPENROUTER_API_KEY，然后重新启动项目。";
    }

    if (response.status === 403 || code === 403 || message.toLowerCase().includes("not available in your region")) {
      return "当前模型在你的地区不可用。我已把默认模型改成自动选择，请重新启动项目后再试。";
    }

    return `${fallback}：${message}`;
  } catch {
    return `${fallback}：${text}`;
  }
}

export async function sendToOpenRouter(request: ChatRequest): Promise<ChatResponse> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("缺少 OpenRouter API Key");
  }

  const settingsText = request.settings
    ? [
        request.settings.ratio ? `比例：${request.settings.ratio}` : "",
        request.settings.resolution ? `分辨率：${request.settings.resolution}` : "",
        request.settings.style ? `风格：${request.settings.style}` : "",
        request.settings.duration ? `时长：${request.settings.duration}` : "",
      ]
        .filter(Boolean)
        .join("，")
    : "";
  const systemPrompt =
    request.mode === "agent"
      ? "你是映造，一个影片/短剧创作 Agent。你的专业方向是电影知识、影片制作、短剧创作、剧本、人物、分镜、镜头、摄影、剪辑、提示词、生图和生视频。你要先满足用户当前问题，再通过建议按钮把用户自然引导到影片/短剧创作。请判断回复类型：chat=普通聊天；film_knowledge=电影史、电影理论、影片制作知识、导演摄影剪辑等知识问答；creative_consult=创作咨询和方案建议；creative_structure=故事梗概、剧本、人物小传、分镜、镜头表、提示词整理；off_topic=明显偏离影片创作的问题。创作流程是：故事概念 -> 扩展故事 -> 改成文字分镜 -> 生成主角图片 -> 生成场景图片 -> 做成图片分镜 -> 做成视频。用户问知识时，suggestions 用 2-3 个当前问题延展 + 1-2 个转创作按钮。用户进入创作后，suggestions 用 2-3 个修改当前内容按钮 + 1-2 个下一步创作按钮。suggestions 必须是对象数组，每项包含 label，并在生成类按钮上加 assetTargetType：生成角色图=character_image，生成场景图=scene_image，生成分镜图片=shot_image，生成分镜视频/做成视频=shot_video，其它不确定=other。故事阶段按钮要能改冲突、人物出场、反转，并推进到文字分镜。文字分镜阶段必须按镜头编号写清画面、人物、动作、景别、镜头、氛围、时长；引导到生成角色、场景、第一镜图片。图片分镜必须一镜一张图，几个镜头就是几张图，建议逐镜生成：先第一镜，再下一镜。角色图生成后要引导生成三视图；场景图生成后要引导生成多角度参考。若上下文里有多版角色/场景，提醒用户用 @ 指定版本，例如 @男主第2版。普通聊天和偏离主题问题正文要短；film_knowledge、creative_consult、creative_structure 必须详细且结构化。结构化正文使用 Markdown 风格：大标题用 ##，小标题用 ###，重点用 **加粗**，列表用 -，必要分隔用单独一行 ---，重要风险用 [red]...[/red]，可执行建议用 [blue]...[/blue]。不要在正文里输出“下一步调整方向”。每次都必须给 3-5 个 suggestions，按钮文字 6-18 个中文左右，不要编号，尽量用动词开头。只返回 JSON，不要输出 JSON 之外的文字。"
      : request.mode === "chat"
        ? "你是映造，一个中文 AI 创作助手。请像豆包一样自然对话，结合上下文回答用户问题。没有明确要求生成图片或视频时，不要输出生图或生视频提示词。输出要排版清楚：超过 3 段的回答必须使用标题；大标题用 ## 标题；小标题用 ### 标题；明显分成几个部分时，用单独一行 --- 分隔；用空行分段；重点用 **加粗**；列表用 - 开头；重要风险或必须注意的内容用 [red]注意内容[/red]；可执行建议、下一步、推荐方案用 [blue]建议内容[/blue]；颜色标记要少用，不要整段染色。"
        : "你是一个中文创作助手。你要根据上下文和用户上传的图片，把口语需求整理成适合生图或生视频的提示词。图片模式下，把上传图片当作参考图，保留用户强调的主体、人物、构图或风格，并把带有视频、镜头、动画、运镜、时序等表达改写成适合单帧画面的描述，最终仍然只能输出图片提示词；视频模式下，把上传图片当作首帧或视觉参考，描述主体动作、镜头运动和画面变化，并把偏静态海报或单张图片需求改写成可执行的视频提示词。除 Agent 模式外，用户当前选择的模式优先级最高，不能因为原始文字里写了视频或图片就切换模式。请直接输出简短、清晰、可执行的中文结果，不要输出标题、说明、建议按钮或额外解释。";
  const finalInstruction =
    request.mode === "agent"
      ? "请基于上下文回复最新用户。返回严格 JSON：{\"intent\":\"chat|film_knowledge|creative_consult|creative_structure|off_topic\",\"content\":\"正文\",\"suggestions\":[{\"label\":\"按钮文字\",\"action\":\"可选动作\",\"assetTargetType\":\"character_image|scene_image|shot_image|shot_video|other\"}]}。普通聊天简短；电影/影片制作知识、创作方案、剧本分镜提示词整理必须结构化且详细。正文不要出现“下一步调整方向”。suggestions 必须 3-5 个，并符合：问答阶段=问题延展+转创作；创作阶段=修改当前内容+下一步创作；生成角色图用 character_image，生成场景图用 scene_image，生成图片分镜用 shot_image，生成分镜视频或做成视频用 shot_video。"
      : request.mode === "chat"
        ? "请基于上下文自然回答用户。"
      : request.mode === "video"
        ? `当前模式：视频${settingsText ? `。生成参数：${settingsText}` : ""}。用户当前是手动选择视频生成模式，这个模式优先级最高，不能改成图片模式。即使用户原话更像海报、封面、一张图、图片，也要把需求改写成视频提示词。请基于上下文，只输出最终可直接用于视频生成的完整提示词。必须包含：主体外貌/身份、场景、动作变化、镜头运动、光线氛围、画面风格；若用户原话偏静态，要补出合理的动作与镜头变化。控制在 80-160 个中文字符。不要解释，不能说自己无法生成，不能让用户复制到其它工具，不能输出标题或“视频提示词：”前缀。`
        : `当前模式：图片${settingsText ? `。生成参数：${settingsText}` : ""}。用户当前是手动选择图片生成模式，这个模式优先级最高，不能改成视频模式。即使用户原话里出现“视频”“一段”“镜头”“运镜”“动起来”“动画”等词，也必须把需求改写成适合单帧图片生成的提示词：保留主体、动作瞬间、场景、构图、氛围、风格，把时序和镜头语言改成定格画面表达。请基于上下文，只输出最终可直接用于图片生成的提示词，不要解释，不能说自己无法生成，不能让用户复制到其它工具，不能输出“通用生图提示词”之类的说明。`;

  const headers = getOpenRouterHeaders(apiKey);
  const body = {
    model: request.model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...request.messages.map((message) => ({
        role: message.role,
        content: toOpenRouterContent(message.content, message.images),
      })),
      {
        role: "user",
        content: finalInstruction,
      },
    ],
    temperature: 0.7,
  };
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let data: {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    try {
      data = await curlPostJson<typeof data>(OPENROUTER_URL, headers, body, "OpenRouter 请求失败");
    } catch {
      throw new Error(await getOpenRouterError(response, "OpenRouter 请求失败"));
    }
  } else {
    data = (await response.json()) as typeof data;
  }

  const rawContent = data.choices?.[0]?.message?.content ?? "";

  if (request.mode === "agent") {
    const parsed = parseStructuredAgentReply(rawContent);

    return {
      ...parsed,
      model: data.model,
    };
  }

  return {
    content: rawContent,
    model: data.model,
  };
}

function parseIntentClassification(text: string): IntentClassification {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;

  try {
    const data = JSON.parse(jsonText) as Partial<IntentClassification>;
    const intent = data.intent === "image" || data.intent === "video" || data.intent === "prompt" || data.intent === "clarify" || data.intent === "agent" ? data.intent : "agent";
    const confidence = typeof data.confidence === "number" ? Math.min(1, Math.max(0, data.confidence)) : 0;

    return {
      intent,
      confidence,
      reason: typeof data.reason === "string" ? data.reason : "AI 未返回明确原因",
    };
  } catch {
    return { intent: "agent", confidence: 0, reason: "AI 意图分类解析失败" };
  }
}

export async function classifyOpenRouterIntent(request: Pick<ChatRequest, "model" | "messages">): Promise<IntentClassification> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("缺少 OpenRouter API Key");
  }

  const headers = getOpenRouterHeaders(apiKey);
  const body = {
    model: request.model,
    messages: [
      {
        role: "system",
        content:
          "你是映造的意图分类器，只返回 JSON，不要输出其它文字。根据用户最新一句和上下文判断下一步应该做什么。intent 只能是 agent、image、video、prompt、clarify。image 表示用户要生成图片；video 表示用户明确要生成视频、镜头、动画、让图中人物动起来、图生视频；prompt 表示用户只要提示词优化；agent 表示普通创作讨论、改文案、想方案、泛泛地说来一段；clarify 表示图片和视频都可能，需要追问。注意：单独的“来一段”“写一段”“搞一段”不是视频意图，除非同时明确说视频、镜头、动画、动起来。返回格式：{\"intent\":\"video\",\"confidence\":0.92,\"reason\":\"原因\"}。",
      },
      ...request.messages.slice(-8).map((message) => ({ role: message.role, content: message.content })),
      {
        role: "user",
        content: "请分类最新用户意图，只返回 JSON。",
      },
    ],
    temperature: 0,
  };
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    try {
      data = await curlPostJson<typeof data>(OPENROUTER_URL, headers, body, "OpenRouter 意图分类失败");
    } catch {
      throw new Error(await getOpenRouterError(response, "OpenRouter 意图分类失败"));
    }
  } else {
    data = (await response.json()) as typeof data;
  }

  return parseIntentClassification(data.choices?.[0]?.message?.content ?? "");
}

export async function getOpenRouterConversationModels(): Promise<ConversationModel[]> {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "OpenRouter 模型列表获取失败"));
  }

  const data = (await response.json()) as OpenRouterModelResponse;
  const providerCounts = new Map<string, number>();
  const remoteModels =
    data.data
      ?.filter((model) => model.id && model.architecture?.modality?.includes("text") && CHINA_MODEL_PREFIXES.some((prefix) => model.id?.startsWith(prefix)))
      .filter((model) => {
        const providerId = getProviderId(model.id ?? "");
        const count = providerCounts.get(providerId) ?? 0;

        if (count >= MODELS_PER_PROVIDER) return false;

        providerCounts.set(providerId, count + 1);
        return true;
      })
      .map((model) => ({
        id: model.id ?? "",
        label: model.name || model.id || "未知模型",
      })) ?? [];

  return [...models, ...remoteModels.filter((model) => !models.some((item) => item.id === model.id))];
}

type ImageGenerationOptions = {
  model?: string;
  settings?: {
    ratio?: string;
    resolution?: string;
  };
  count?: number;
};

function getImageRequestConfig(model: string, settings?: ImageGenerationOptions["settings"]) {
  const rule = getImageModelRule(model);
  const { resolution, ratio: aspectRatio } = resolveImageSettingsForModel(model, settings);
  const dimensions = getExpectedImageDimensions(model, resolution, aspectRatio);

  return {
    modalities: rule.modalities,
    targetDimensions: dimensions,
    imageConfig: {
      aspect_ratio: aspectRatio,
      image_size: resolution,
    },
  };
}

function isTransientImageError(message: string) {
  return /Internal Server Error|没有返回图片|\b500\b|\b502\b|\b503\b|\b504\b/i.test(message);
}

function isImageConfigError(message: string) {
  return /image_config|aspect_ratio|size/i.test(message);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenRouterImageUrls(data: OpenRouterChatCompletionResponse) {
  const choiceImages = data.choices?.[0]?.message?.images?.map((image) => image.image_url?.url ?? image.url).filter((url): url is string => Boolean(url)) ?? [];
  if (choiceImages.length > 0) return choiceImages;

  const rootImages = data.images?.map((image) => image.image_url?.url ?? image.url).filter((url): url is string => Boolean(url)) ?? [];
  if (rootImages.length > 0) return rootImages;

  const dataImages = data.data?.map((item) => item.url).filter((url): url is string => Boolean(url)) ?? [];
  return dataImages;
}

export async function generateOpenRouterImage(prompt: string, referenceImages: string[] = [], options: ImageGenerationOptions = {}) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("缺少 OpenRouter API Key");
  }

  const safeReferenceImages = referenceImages.filter(Boolean).slice(0, 3);
  const count = Math.min(4, Math.max(1, Math.floor(options.count ?? 1)));
  const model = options.model || process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const { modalities, imageConfig, targetDimensions } = getImageRequestConfig(model, options.settings);

  console.log("[image-generation] OpenRouter request params", {
    model,
    selectedRatio: options.settings?.ratio,
    selectedResolution: options.settings?.resolution,
    modalities,
    image_config: imageConfig,
    expected_dimensions: targetDimensions,
  });

  const createOne = async (useImageConfig = true) => {
    const body = {
      model,
      messages: [
        {
          role: "user",
          content: toOpenRouterContent(prompt, safeReferenceImages),
        },
      ],
      modalities,
      ...(useImageConfig ? { image_config: imageConfig } : {}),
    };
    const headers = getOpenRouterHeaders(apiKey);
    const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    });

    let data: OpenRouterChatCompletionResponse;

    if (!response.ok) {
      try {
        data = await curlPostJson<OpenRouterChatCompletionResponse>(OPENROUTER_URL, headers, body, "OpenRouter 图片生成失败");
      } catch {
        throw new Error(await getOpenRouterError(response, "OpenRouter 图片生成失败"));
      }
    } else {
      try {
        data = (await response.json()) as OpenRouterChatCompletionResponse;
      } catch (parseError) {
        const parseMessage = parseError instanceof Error ? parseError.message : "图片平台返回解析失败";
        throw new Error(`图片平台响应解析失败：${parseMessage}`);
      }
    }

    const images = getOpenRouterImageUrls(data);
    let localImages: string[] = [];

    try {
      localImages = await Promise.all(images.map(async (image) => {
        return saveGeneratedAsset(image, "image");
      }));
    } catch (saveError) {
      const saveMessage = saveError instanceof Error ? saveError.message : "";
      throw new Error(saveMessage || "图片已返回，但保存到本地失败");
    }

    if (localImages.length === 0) {
      throw new Error("图片平台没有返回图片");
    }

    const imageDimensions = Object.fromEntries(
      localImages
        .map((image) => [image, getLocalImageDimensions(image)] as const)
        .filter((item): item is readonly [string, ImageDimensions] => Boolean(item[1])),
    );

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      images: localImages,
      imageDimensions,
    };
  };

  const createOneWithRetry = async () => {
    try {
      return await createOne(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!isTransientImageError(message) || isImageConfigError(message)) throw error;

      await wait(1200);
      try {
        return await createOne(true);
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : "";
        if (!isTransientImageError(retryMessage) || isImageConfigError(retryMessage)) throw retryError;

        await wait(1600);
        return await createOne(true);
      }
    }
  };

  const results = await Promise.all(Array.from({ length: count }).map(() => createOneWithRetry()));

  return {
    content: results.map((item) => item.content).filter(Boolean).join("\n\n"),
    images: results.flatMap((item) => item.images),
    imageDimensions: Object.assign({}, ...results.map((item) => item.imageDimensions)),
  };
}
