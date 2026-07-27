"use client";

import { useState } from "react";
import { RiVideoLine } from "react-icons/ri";
import { VideoPlayBadge } from "@/components/video-play-badge";

/** Shared compact preview for uploaded video references. */
export function VideoUploadThumbnail({ src, posterUrl, alt }: { src?: string; posterUrl?: string; alt: string }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const poster = posterUrl && !posterFailed ? posterUrl : undefined;

  if (videoFailed || (!src && !poster)) {
    return <div className="flex h-full w-full items-center justify-center text-[#8a8a8a]"><RiVideoLine className="h-7 w-7" aria-label="视频" /></div>;
  }

  return (
    <>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={alt} className="h-full w-full object-cover" onError={() => { setPosterFailed(true); if (!src) setVideoFailed(true); }} />
      ) : (
        <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" onError={() => setVideoFailed(true)} />
      )}
      <VideoPlayBadge size="sm" className="z-10" />
    </>
  );
}
