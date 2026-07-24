import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-version";

// 给所有 /api/* 响应带上「已发布版本号」响应头。前端（version-update-notifier）搭在已有请求流量上
// 读取此头，与自己 bundle 里打死的版本对比，服务端更高就弹「发现新版本」提示条。
//
// ⭐ 为什么用 PUBLISHED_APP_VERSION 而不是直接 APP_VERSION：
// APP_VERSION 是构建时打进镜像的，新容器一起来就是新版；但此时阿里静态镜像可能还没同步完，
// 用户此刻点刷新会因 chunk 尚未就绪而白屏。所以线上用运行时环境变量 PUBLISHED_APP_VERSION 作为
// 「已完全部署（含静态同步）后才置为新版」的信号——部署最后一步才 set 它 + force-recreate，
// 保证「提示条弹出时 = 静态资源已就绪 = 刷新必正常」。
// 本地开发（非 production）没有该变量时回退到 APP_VERSION，方便即时看到效果。
export function middleware() {
  const response = NextResponse.next();
  const published = process.env.PUBLISHED_APP_VERSION?.trim();
  const advertise = published || (process.env.NODE_ENV !== "production" ? APP_VERSION : "");
  if (advertise) response.headers.set("x-app-version", advertise);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
