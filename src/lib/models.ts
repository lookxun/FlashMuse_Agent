export type ConversationModel = {
  label: string;
  id: string;
};

export const models: ConversationModel[] = [
  { label: "Seed 2.0 Lite", id: "bytedance-seed/seed-2.0-lite" },
] as const;

export const DEFAULT_CHAT_MODEL = "bytedance-seed/seed-2.0-lite";
export const DEFAULT_IMAGE_MODEL = "bytedance-seed/seedream-4.5";
export const DEFAULT_VIDEO_MODEL = "google/veo-3.1-lite";

export type ModelName = string;

export function isModelName(value: unknown): value is ModelName {
  return typeof value === "string" && value.length > 0 && value.length < 120 && /^[a-zA-Z0-9~._:/-]+$/.test(value);
}
