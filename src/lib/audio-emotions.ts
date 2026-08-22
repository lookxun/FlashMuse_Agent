export const AUDIO_EMOTION_DEFAULT_ID = "default";

export type AudioEmotionOption = { id: string; label: string };

const AUDIO_EMOTION_DEFAULT: AudioEmotionOption = { id: AUDIO_EMOTION_DEFAULT_ID, label: "默认" };

const MINIMAX_AUDIO_EMOTIONS: AudioEmotionOption[] = [
  { id: "happy", label: "高兴" },
  { id: "sad", label: "悲伤" },
  { id: "angry", label: "愤怒" },
  { id: "fearful", label: "恐惧" },
  { id: "disgusted", label: "厌恶" },
  { id: "surprised", label: "惊讶" },
  { id: "calm", label: "平静" },
];

const FISH_AUDIO_EMOTIONS: AudioEmotionOption[] = [
  { id: "happy", label: "高兴" },
  { id: "sad", label: "悲伤" },
  { id: "angry", label: "愤怒" },
  { id: "excited", label: "兴奋" },
  { id: "calm", label: "平静" },
  { id: "nervous", label: "紧张" },
  { id: "confident", label: "自信" },
  { id: "surprised", label: "惊讶" },
  { id: "satisfied", label: "满足" },
  { id: "delighted", label: "欣喜" },
  { id: "scared", label: "害怕" },
  { id: "worried", label: "担心" },
  { id: "upset", label: "难过" },
  { id: "frustrated", label: "沮丧" },
  { id: "depressed", label: "抑郁" },
  { id: "empathetic", label: "共情" },
  { id: "embarrassed", label: "尴尬" },
  { id: "disgusted", label: "厌恶" },
  { id: "moved", label: "感动" },
  { id: "proud", label: "骄傲" },
  { id: "relaxed", label: "放松" },
  { id: "grateful", label: "感激" },
  { id: "curious", label: "好奇" },
  { id: "sarcastic", label: "讽刺" },
];

import { isFishAudioModel } from "@/lib/models";

function isMiniMaxAudioModel(modelId?: string) {
  return modelId === "minimax/speech-2.8-hd";
}

export function isAudioEmotionSelectable(modelId?: string) {
  return isMiniMaxAudioModel(modelId) || isFishAudioModel(modelId);
}

export function getAudioEmotionsForModel(modelId?: string): AudioEmotionOption[] {
  if (isMiniMaxAudioModel(modelId)) return [AUDIO_EMOTION_DEFAULT, ...MINIMAX_AUDIO_EMOTIONS];
  if (isFishAudioModel(modelId)) return [AUDIO_EMOTION_DEFAULT, ...FISH_AUDIO_EMOTIONS];
  return [];
}

export function normalizeAudioEmotionForModel(modelId: string | undefined, emotionId: string | undefined): string {
  const emotions = getAudioEmotionsForModel(modelId);
  if (emotions.length === 0) return AUDIO_EMOTION_DEFAULT_ID;
  if (emotionId && emotions.some((emotion) => emotion.id === emotionId)) return emotionId;
  return AUDIO_EMOTION_DEFAULT_ID;
}

export function getAudioEmotionLabel(modelId: string | undefined, emotionId: string | undefined): string {
  const emotions = getAudioEmotionsForModel(modelId);
  return emotions.find((emotion) => emotion.id === emotionId)?.label ?? AUDIO_EMOTION_DEFAULT.label;
}

export function applyAudioEmotionToProviderInput(modelId: string | undefined, text: string, emotionId: string | undefined): string {
  if (!isFishAudioModel(modelId)) return text;
  const emotion = normalizeAudioEmotionForModel(modelId, emotionId);
  if (emotion === AUDIO_EMOTION_DEFAULT_ID) return text;
  return `[${emotion}] ${text}`;
}

export function getMiniMaxAudioEmotion(modelId: string | undefined, emotionId: string | undefined): string | undefined {
  if (!isMiniMaxAudioModel(modelId)) return undefined;
  const emotion = normalizeAudioEmotionForModel(modelId, emotionId);
  return emotion === AUDIO_EMOTION_DEFAULT_ID ? undefined : emotion;
}
