import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  experimental: {
    // 兜底放行中型 JSON body（2026-08-02 加）：命中 proxy（旧名 middleware）的请求会被 Next 克隆并缓冲 body，
    // 默认上限 10MB。base64/JSON 老路上传（10MB 文件 ≈ 13.3MB JSON）和 workspace-state 的大画布
    // JSON 都可能越过 10MB → 提到 32mb。⛔ 不许再调大：这个缓冲是 per-request 占内存的，
    // 本机还跑着另外两个项目；真正的 multipart 大文件已走 src/proxy.ts 的排除名单（不缓冲）。
    proxyClientMaxBodySize: "32mb",
  },
  serverExternalPackages: ["ffmpeg-static", "sharp", "@imgly/background-removal-node", "onnxruntime-node"],
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/workspace",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // 首页轮播 logo/视频等静态资源：给长缓存，避免每次切换视频都回源验证导致黑闪。
        // 文件名/版本变化时靠 ?v= 查询串或文件名自然失效。
        source: "/home-assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // 生成媒体(内容 hash 命名，实际不可变)：长缓存，减少跨境重复回源。
        source: "/generated/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
