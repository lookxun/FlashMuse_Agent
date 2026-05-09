export type ConversationModel = {
  label: string;
  id: string;
};

export type GenerationModel = ConversationModel & {
  durations?: string[];
};

export const models: ConversationModel[] = [
  { label: "Seed 2.0 Lite", id: "bytedance-seed/seed-2.0-lite" },
] as const;

export const DEFAULT_CHAT_MODEL = "bytedance-seed/seed-2.0-lite";
export const imageGenerationModels: GenerationModel[] = [
  { label: "Seedream 4.5", id: "bytedance-seed/seedream-4.5" },
  { label: "Gemini 3.1 Flash Image Preview", id: "google/gemini-3.1-flash-image-preview" },
  { label: "Gemini 3 Pro Image Preview", id: "google/gemini-3-pro-image-preview" },
  { label: "GPT-5 Image", id: "openai/gpt-5-image" },
  { label: "GPT-5.4 Image 2", id: "openai/gpt-5.4-image-2" },
] as const;

export const videoGenerationModels: GenerationModel[] = [
  { label: "Seedance 2.0 Fast", id: "bytedance/seedance-2.0-fast", durations: ["5秒", "10秒", "15秒"] },
  { label: "Seedance 2.0", id: "bytedance/seedance-2.0", durations: ["5秒", "10秒", "15秒"] },
  { label: "Kling v3.0 Standard", id: "kwaivgi/kling-v3.0-std", durations: ["5秒", "10秒", "15秒"] },
  { label: "Kling v3.0 Pro", id: "kwaivgi/kling-v3.0-pro", durations: ["5秒", "10秒", "15秒"] },
  { label: "Kling Video O1", id: "kwaivgi/kling-video-o1", durations: ["5秒", "10秒", "15秒"] },
  { label: "Veo 3.1", id: "google/veo-3.1", durations: ["4秒", "6秒", "8秒"] },
  { label: "Sora 2 Pro", id: "openai/sora-2-pro", durations: ["4秒", "8秒", "12秒", "16秒", "20秒"] },
] as const;

export const DEFAULT_IMAGE_MODEL = imageGenerationModels[0].id;
export const DEFAULT_VIDEO_MODEL = videoGenerationModels[0].id;

export type ModelName = string;

export function isModelName(value: unknown): value is ModelName {
  return typeof value === "string" && value.length > 0 && value.length < 120 && /^[a-zA-Z0-9~._:/-]+$/.test(value);
}
