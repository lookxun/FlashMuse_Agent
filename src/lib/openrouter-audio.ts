import { getConfiguredOpenRouterApiKey } from "@/lib/system-settings";
import { getAudioModelDefaultVoice, getAudioModelUsdPerChar } from "@/lib/models";
import { saveGeneratedAsset } from "@/lib/local-assets";
import { syncGeneratedFilesToAli } from "@/lib/ali-sync";
import { toUserErrorMessage } from "@/lib/error-message";
import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";

/**
 * ⭐ 语音生成（TTS）唯一调用层。走 OpenRouter 的专用接口 `POST /api/v1/audio/speech`
 * （OpenAI Audio Speech 兼容）：发 `{ model, input, voice?, response_format }`，
 * **返回的是原始音频字节流（不是 JSON）**，非 2xx 才返回 JSON 错误体。
 *
 * 设计要点：
 * - 音色（voice）按模型给默认值（models.ts 的 AUDIO_MODEL_MENU_INFO）；Fish 系没有固定音色表 →
 *   不传 voice、用供应商默认音色（其 playground 实测无音色选择、只有克隆）。
 * - 计费：TTS 按「字符数」计费；字节响应里没有 cost，所以按 `字符数 × 每字符美元` 兜底定价
 *   （每字符美元 = OpenRouter endpoints 实测单价，见 getAudioModelUsdPerChar）。
 * - 落地：把音频字节转成 data URL → saveGeneratedAsset(..., "audio") 存到本地 `/generated/.../audios/`，
 *   再同步阿里镜像；返回本地 url。
 */

const OPENROUTER_AUDIO_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";
const AUDIO_PROVIDER_TIMEOUT_MS = 3 * 60 * 1000;

function getOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "FlashMuse",
  };
}

export type GenerateAudioOptions = {
  model: string;
  voice?: string;
  emotion?: string;
  requestId?: string;
  userId?: string;
};

export type GenerateAudioResult = {
  url: string;
  characters: number;
  usage: { characters: number; usd: number };
  generationId?: string;
};

export async function generateOpenRouterAudio(text: string, options: GenerateAudioOptions): Promise<GenerateAudioResult> {
  const input = (text ?? "").trim();
  if (!input) throw new Error("缺少要转成语音的文字");
  const apiKey = getConfiguredOpenRouterApiKey();
  if (!apiKey) throw new Error("语音生成失败：未配置 OpenRouter 密钥。");

  const voice = options.voice ?? getAudioModelDefaultVoice(options.model);
  const body: Record<string, unknown> = {
    model: options.model,
    input,
    response_format: "mp3",
  };
  // Fish 系没有固定音色 → 不传 voice（用供应商默认音色）。其余模型传默认音色。
  if (voice) body.voice = voice;
  if (options.emotion) {
    body.provider = { options: { minimax: { emotion: options.emotion } } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUDIO_PROVIDER_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(OPENROUTER_AUDIO_SPEECH_URL, {
      method: "POST",
      headers: getOpenRouterHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("语音生成超时，请稍后再试。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const generationId = response.headers.get("X-Generation-Id") ?? undefined;

  if (!response.ok) {
    // 非 2xx：返回的是 JSON 错误体。
    const raw = await response.text().catch(() => "");
    let message = raw;
    try {
      const data = JSON.parse(raw) as { error?: { message?: string } };
      message = data.error?.message ?? raw;
    } catch {
      // keep raw
    }
    void appendGenerationDiagnosticsLog({
      event: "audio-provider-non-ok",
      requestId: options.requestId,
      userId: options.userId,
      mode: "audio",
      model: options.model,
      status: response.status,
      prompt: input,
      upstream: { url: OPENROUTER_AUDIO_SPEECH_URL, body: (raw ?? "").slice(0, 1800) },
    });
    throw new Error(`语音生成失败：${toUserErrorMessage(message || `HTTP ${response.status}`)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error("语音生成失败：平台没有返回音频。");
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:audio/mpeg;base64,${base64}`;
  const url = await saveGeneratedAsset(dataUrl, "audio", undefined, { userId: options.userId });
  void syncGeneratedFilesToAli([url], { requestId: options.requestId, userId: options.userId, model: options.model });

  const characters = [...input].length;
  const usd = characters * getAudioModelUsdPerChar(options.model);

  void appendGenerationDiagnosticsLog({
    event: "audio-provider-success",
    requestId: options.requestId,
    userId: options.userId,
    mode: "audio",
    model: options.model,
    prompt: input,
    extra: { characters, usd, voice: voice ?? "(default)", emotion: options.emotion ?? "(default)", bytes: arrayBuffer.byteLength, generationId },
  });

  return { url, characters, usage: { characters, usd }, generationId };
}
