"use client";

import { useEffect, useRef } from "react";

export function AdminActivityTracker() {
  const activityPingRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    const recordActivity = () => {
      const now = Date.now();
      if (now - activityPingRef.current < 60_000) return;
      activityPingRef.current = now;
      void fetch("/admin/api/auth/activity", { method: "POST", cache: "no-store", keepalive: true }).then((response) => {
        if (!cancelled && response.status === 401) window.location.replace("/admin");
      }).catch(() => undefined);
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true, capture: true }));
    return () => {
      cancelled = true;
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity, { capture: true }));
    };
  }, []);

  return null;
}
