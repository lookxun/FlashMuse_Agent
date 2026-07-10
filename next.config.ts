import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  serverExternalPackages: ["ffmpeg-static", "sharp"],
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
