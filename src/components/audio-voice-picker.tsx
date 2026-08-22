"use client";

import { AUDIO_VOICE_LANGS, getAudioVoicePreviewUrl, type AudioVoiceLang, type AudioVoiceOption } from "@/lib/audio-voices";
import { AudioWaveformPlayer } from "@/components/audio-waveform-player";
import { VideoPlayBadge } from "@/components/video-play-badge";

export function AudioVoicePicker({
  langs,
  activeLang,
  onSelectLang,
  voices,
  selectedVoiceId,
  onPick,
}: {
  langs: typeof AUDIO_VOICE_LANGS;
  activeLang: AudioVoiceLang;
  onSelectLang: (lang: AudioVoiceLang) => void;
  voices: AudioVoiceOption[];
  selectedVoiceId?: string;
  onPick: (voice: AudioVoiceOption) => void;
}) {
  return (
    <div className="flex w-[560px] max-w-[86vw] flex-col overflow-hidden rounded-[12px] bg-white p-2 shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
      <style>{`
        .audio-voice-scroll{scrollbar-width:thin;scrollbar-color:#c7c7c7 transparent;}
        .audio-voice-scroll::-webkit-scrollbar{width:8px;-webkit-appearance:none;}
        .audio-voice-scroll::-webkit-scrollbar-thumb{background-color:#c7c7c7;border-radius:8px;}
        .audio-voice-scroll::-webkit-scrollbar-track{background:transparent;}
      `}</style>
      <div className="px-1 pb-2 text-[12px] font-medium text-[#8a8a8a]">选择音色</div>
      <div className="flex h-[378px] items-stretch">
        <div className="audio-voice-scroll w-[128px] shrink-0 space-y-0.5 overflow-y-auto border-r border-[#eee] pr-1.5">
          {langs.map((lang) => {
            const isActive = lang.value === activeLang;
            return (
              <button
                key={lang.value}
                type="button"
                onClick={() => onSelectLang(lang.value)}
                className={isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-2 text-left" : "flex h-9 w-full items-center rounded-lg px-2 text-left transition hover:bg-[#ececec]"}
              >
                <span className={isActive ? "min-w-0 flex-1 truncate text-[12px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[12px] font-medium text-[#444444]"}>{lang.label}</span>
              </button>
            );
          })}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="audio-voice-scroll absolute inset-0 overflow-y-auto pl-2">
            {voices.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[#999]">暂无音色</div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {voices.map((voice) => {
                  const selected = voice.id === selectedVoiceId;
                  const previewUrl = getAudioVoicePreviewUrl(voice);
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => onPick(voice)}
                      className={selected ? "group relative aspect-square overflow-hidden rounded-[8px] border-2 border-[#367cee] bg-[#f4f4f4] text-left" : "group relative aspect-square overflow-hidden rounded-[8px] border-2 border-transparent bg-[#f4f4f4] text-left"}
                    >
                      {previewUrl ? (
                        <div className="h-full w-full overflow-hidden">
                          <AudioWaveformPlayer key={previewUrl} url={previewUrl} variant="card" hideTime />
                        </div>
                      ) : (
                        <VideoPlayBadge size="sm" />
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-8 bg-gradient-to-t from-black/75 to-transparent" />
                      <span className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 z-30 truncate text-[12px] font-medium leading-none text-white">{voice.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
