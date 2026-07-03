"use client";

type AdminDetailMode = "records" | "full" | "media" | "credits";

type AdminDetailCacheEntry = Partial<Record<AdminDetailMode, unknown>>;

declare global {
  interface Window {
    __flashmuseAdminDetailCache?: Map<string, AdminDetailCacheEntry>;
  }
}

function getCache() {
  if (typeof window === "undefined") return undefined;
  window.__flashmuseAdminDetailCache ??= new Map<string, AdminDetailCacheEntry>();
  return window.__flashmuseAdminDetailCache;
}

export function getCachedAdminDetail<T>(userId: string, mode: AdminDetailMode) {
  return getCache()?.get(userId)?.[mode] as T | undefined;
}

export function setCachedAdminDetail<T>(userId: string, mode: AdminDetailMode, detail: T) {
  const cache = getCache();
  if (!cache) return;
  const entry = cache.get(userId) ?? {};
  entry[mode] = detail;
  if (mode === "full") entry.records = detail;
  cache.set(userId, entry);
}
