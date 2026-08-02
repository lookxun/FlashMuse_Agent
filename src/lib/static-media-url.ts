// 静态媒体地址唯一权威（2026-08-02 从 chat-workbench.tsx 收敛，供对话流与工作流画布共用）。
// 背景：工作流画布（workflow-tldraw-canvas-inner.tsx）原本有一个同名空函数 getStaticMediaUrl
// （两个分支都 return url），导致工作流画布从未应用静态域名 / 刚上传源回退 / ?v= 缓存破除。
// 对话流与工作流必须走同一份实现，禁止再各写一份。

import { isRecentUploadOrigin } from "@/lib/recent-upload-origin";

export const staticAssetBaseUrl = (process.env.NEXT_PUBLIC_STATIC_BASE_URL ?? "").replace(/\/$/, "");
export const uploadApiBaseUrl = (process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ?? "").replace(/\/$/, "");
export const primaryAppBaseUrl = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL ?? "").replace(/\/$/, "");
export const defaultProductionUploadApiBaseUrl = "https://api.venusface.com";

export function toLocalGeneratedUrl(url: string) {
  if (/^https?:\/\/(101\.47\.19\.109|101\.37\.129\.164|main\.venusface\.com|api\.venusface\.com|ali\.venusface\.com|static\.venusface\.com)\/generated\//i.test(url)) {
    return url.replace(/^https?:\/\/(101\.47\.19\.109|101\.37\.129\.164|main\.venusface\.com|api\.venusface\.com|ali\.venusface\.com|static\.venusface\.com)/i, "");
  }
  return url;
}

export function withMediaVersion(url: string, version?: string) {
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}

export function shouldUseStaticAssetBaseUrl() {
  if (!staticAssetBaseUrl || typeof window === "undefined") return Boolean(staticAssetBaseUrl);

  try {
    const currentHost = window.location.host;
    const currentHostname = window.location.hostname;
    const staticHost = new URL(staticAssetBaseUrl).host;
    const uploadHost = uploadApiBaseUrl ? new URL(uploadApiBaseUrl).host : "";
    const primaryHost = primaryAppBaseUrl ? new URL(primaryAppBaseUrl).host : "";
    if (currentHostname === "main.venusface.com" || currentHostname === "api.venusface.com" || currentHostname === "101.47.19.109") return false;
    if (currentHost === staticHost || currentHost === uploadHost || currentHost === primaryHost) return false;
  } catch {
    return Boolean(staticAssetBaseUrl);
  }

  return true;
}

export function getStaticMediaUrl(url: string | undefined, version?: string) {
  if (!url) return url;
  const normalizedUrl = toLocalGeneratedUrl(url);
  // 本会话刚上传的媒体：阿里镜像可能还没同步好，一律读腾讯主源，保证成功即可播放/看封面。刷新后走正常读取。
  if (normalizedUrl.startsWith("/generated/") && isRecentUploadOrigin(normalizedUrl)) {
    const isLocalDev = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const originBase = isLocalDev ? "" : (uploadApiBaseUrl || defaultProductionUploadApiBaseUrl);
    return withMediaVersion(`${originBase}${normalizedUrl}`, version);
  }
  if (!shouldUseStaticAssetBaseUrl() || !normalizedUrl.startsWith("/generated/")) return withMediaVersion(normalizedUrl, version);
  return withMediaVersion(`${staticAssetBaseUrl}${normalizedUrl}`, version);
}
