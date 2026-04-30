import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { ConversationModel, ModelName } from "@/lib/models";
import { DEFAULT_IMAGE_MODEL, models } from "@/lib/models";
import { saveGeneratedAsset } from "@/lib/local-assets";

export type ChatRequest = {
  model: ModelName;
  mode: "agent" | "chat" | "image" | "video";
  messages: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
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

function getOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Yinzao",
  };
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

export async function sendToOpenRouter(request: ChatRequest) {
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
      ? "你是映造的 Agent 创作助手。默认回答要短，像正常聊天一样一问一答，不要为了显得完整而一次输出很多段。用户只是打招呼、闲聊、确认你在不在时，只回复 1 句自然中文，不要标题、列表、分隔线或下一步方向。你面向目标不明确的用户，通过自然对话帮助用户逐步明确创作目标。你会理解用户上传的图片，能根据图片内容给出分析、改图建议、参考图生图方案、首帧生视频方案、剧本、文字分镜和提示词。信息不足时主动追问最关键的 1 个问题。不要声称已经完成实际生成，除非系统后续真的返回了图片或视频结果；用户明确要求生图或生视频时，前端会自动进入对应生成流程，你只需要整理清晰可执行的生成描述。只有回答超过 3 段时才使用标题；大标题用 ## 标题；小标题用 ### 标题；明显分成几个部分时，用单独一行 --- 分隔；用空行分段；重点用 **加粗**；列表用 - 开头；重要风险或必须注意的内容用 [red]注意内容[/red]；可执行建议、下一步、推荐方案用 [blue]建议内容[/blue]；颜色标记要少用，不要整段染色。你需要持续判断用户是否需要方向引导：只有用户明显犹豫、不确定、频繁改来改去、同时提出多个方向、或上下文显示他需要你帮他做选择，才可以在回答最后给出 ### 下一步调整方向，并列出 2-5 个可选方向；如果用户表达清楚、只是打招呼、只是执行或继续细化，就不要输出这个栏目。"
      : request.mode === "chat"
        ? "你是映造，一个中文 AI 创作助手。请像豆包一样自然对话，结合上下文回答用户问题。没有明确要求生成图片或视频时，不要输出生图或生视频提示词。输出要排版清楚：超过 3 段的回答必须使用标题；大标题用 ## 标题；小标题用 ### 标题；明显分成几个部分时，用单独一行 --- 分隔；用空行分段；重点用 **加粗**；列表用 - 开头；重要风险或必须注意的内容用 [red]注意内容[/red]；可执行建议、下一步、推荐方案用 [blue]建议内容[/blue]；颜色标记要少用，不要整段染色。"
       : "你是一个中文创作助手。你要根据上下文和用户上传的图片，把口语需求整理成适合生图或生视频的提示词。图片模式下，把上传图片当作参考图，保留用户强调的主体、人物、构图或风格；视频模式下，把上传图片当作首帧或视觉参考，描述主体动作、镜头运动和画面变化。请直接输出简短、清晰、可执行的中文结果。输出要排版清楚：超过 3 段的回答必须使用标题；大标题用 ## 标题；小标题用 ### 标题；明显分成几个部分时，用单独一行 --- 分隔；用空行分段；重点用 **加粗**；列表用 - 开头；重要风险或必须注意的内容用 [red]注意内容[/red]；可执行建议、下一步、推荐方案用 [blue]建议内容[/blue]；颜色标记要少用，不要整段染色。你需要判断是否有必要给用户方向引导：用户犹豫、不确定或频繁修改时，可以在最后给出 ### 下一步调整方向，并列出 2-5 个可选方向，不要超过 5 个，每项控制在 20 字以内；用户目标明确时不要输出这个栏目。";
  const finalInstruction =
    request.mode === "agent"
      ? "请基于上下文推进创作。能一句话回答就一句话回答，不要拆成很多段。用户只是打招呼或闲聊时，只回复 1 句；目标不清楚时只追问 1 个关键问题；目标清楚时再给创作方案、剧本/分镜/提示词建议。只有用户确实需要选择时才给下一步方向。"
      : request.mode === "chat"
        ? "请基于上下文自然回答用户。"
      : request.mode === "video"
        ? `当前模式：视频。实际生成强制使用 4 秒、720p${settingsText ? `；用户选择参数仅作创意参考：${settingsText}` : ""}。请基于上下文，只输出最终可直接用于视频生成的完整提示词。用户原始需求很短或很模糊时，必须主动补全为完整视频描述，至少包含：主体外貌/身份、场景、动作变化、镜头运动、光线氛围、画面风格。控制在 80-160 个中文字符。不要解释，不能说自己无法生成，不能让用户复制到其它工具，不能输出标题或“视频提示词：”前缀。`
        : `当前模式：图片${settingsText ? `。生成参数：${settingsText}` : ""}。请基于上下文，只输出最终可直接用于生成的提示词。不要解释，不能说自己无法生成，不能让用户复制到其它工具，不能输出“通用生图提示词”之类的说明。`;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "OpenRouter 请求失败"));
  }

  const data = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    content: data.choices?.[0]?.message?.content ?? "",
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

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "OpenRouter 意图分类失败"));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

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

export async function generateOpenRouterImage(prompt: string, referenceImages: string[] = []) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("缺少 OpenRouter API Key");
  }

  const hasReferenceImages = referenceImages.length > 0;
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model: process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
      messages: [
        {
          role: "user",
          content: toOpenRouterContent(
            hasReferenceImages ? `请参考上传图片生成新图片，尽量保留关键主体和用户要求。中文提示词：${prompt}` : `请根据以下中文提示词生成一张图片：${prompt}`,
            referenceImages,
          ),
        },
      ],
      modalities: ["image"],
    }),
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "OpenRouter 图片生成失败"));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string; images?: OpenRouterImage[] } }>;
  };
  const images = data.choices?.[0]?.message?.images?.map((image) => image.image_url?.url).filter((url): url is string => Boolean(url)) ?? [];
  const localImages = await Promise.all(images.map((image) => saveGeneratedAsset(image, "image")));

  return {
    content: data.choices?.[0]?.message?.content ?? "",
    images: localImages,
  };
}
