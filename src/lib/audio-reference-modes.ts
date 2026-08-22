import { RiUserVoiceLine, RiVoiceprintLine } from "react-icons/ri";
import type { IconType } from "react-icons";
import { FISH_AUDIO_CLONE_MIN_SECONDS, type AudioReferenceMode } from "@/lib/upload-rules";

export type AudioReferenceModeOption = {
  value: AudioReferenceMode;
  label: string;
  description: string;
  icon: IconType;
};

export const audioReferenceModeOptions: AudioReferenceModeOption[] = [
  { value: "tts", label: "文本转换", description: "输入文案，用模型自带音色转成语音", icon: RiVoiceprintLine },
  { value: "clone", label: "音色克隆", description: `上传一段${FISH_AUDIO_CLONE_MIN_SECONDS}秒以上的语音，按这段声音读你的文案`, icon: RiUserVoiceLine },
];

export function getAudioReferenceModeOptions(): AudioReferenceModeOption[] {
  return audioReferenceModeOptions;
}

export function getAudioReferenceModeLabel(value?: AudioReferenceMode) {
  return audioReferenceModeOptions.find((option) => option.value === value)?.label ?? audioReferenceModeOptions[0].label;
}
