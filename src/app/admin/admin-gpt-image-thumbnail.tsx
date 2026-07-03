"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PreviewPosition = { left: number; top: number; width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPreviewPosition(rect: DOMRect): PreviewPosition {
  const margin = 16;
  const gap = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(560, Math.max(260, viewportWidth - margin * 2));
  const height = Math.min(520, Math.max(220, viewportHeight - margin * 2));
  const top = clamp(rect.top, margin, Math.max(margin, viewportHeight - height - margin));

  if (rect.right + gap + width <= viewportWidth - margin) {
    return { left: rect.right + gap, top, width, height };
  }
  if (rect.left - gap - width >= margin) {
    return { left: rect.left - gap - width, top, width, height };
  }
  if (rect.bottom + gap + height <= viewportHeight - margin) {
    return { left: clamp(rect.left, margin, viewportWidth - width - margin), top: rect.bottom + gap, width, height };
  }
  return { left: clamp(rect.left, margin, viewportWidth - width - margin), top: Math.max(margin, rect.top - gap - height), width, height };
}

export function AdminGptImageThumbnail({ imageUrl }: { imageUrl: string }) {
  const thumbRef = useRef<HTMLImageElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PreviewPosition | null>(null);

  const updatePosition = useCallback(() => {
    const rect = thumbRef.current?.getBoundingClientRect();
    if (rect) setPosition(getPreviewPosition(rect));
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!position) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [position, updatePosition]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={thumbRef}
        src={imageUrl}
        alt="优化成功图"
        className="h-[72px] w-[110px] rounded-[8px] border border-[#eeeeee] object-cover"
        onMouseEnter={updatePosition}
        onMouseMove={updatePosition}
        onMouseLeave={() => setPosition(null)}
      />
      {mounted && position ? createPortal(
        <div
          className="pointer-events-none fixed z-[1000] rounded-[12px] border border-[#eeeeee] bg-white p-2 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          style={{ left: position.left, top: position.top }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="优化成功大图" className="rounded-[8px] object-contain" style={{ maxWidth: position.width, maxHeight: position.height }} />
        </div>,
        document.body,
      ) : null}
    </>
  );
}
