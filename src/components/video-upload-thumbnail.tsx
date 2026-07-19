"use client";

import { useState } from "react";
import { RiVideoLine } from "react-icons/ri";

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
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/58 text-white shadow-[0_4px_12px_rgba(0,0,0,0.22)]">
        <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current" />
      </div>
    </>
  );
}
