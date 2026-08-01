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
  // ⛔⛔ 3 个 multipart 大上传路由**故意排除**在 middleware 之外（2026-08-02 加）：
  // Next 16 只要请求命中 middleware（新版叫 proxy），就会**克隆并整份缓冲 body 到内存**，
  // 且默认上限 10MB —— 超出部分被静默截断，`request.formData()` 直接解析失败，
  // 用户看到的是毫无信息的 500「文件上传失败，请稍后再试。」
  // （视频规则允许 200MB、音频 15MB，全都因此挂掉过。）
  // 而这个 middleware **压根不读 body**（只给响应加 x-app-version 头），
  // 为它缓冲 200MB 视频纯属浪费 → 排除后既不截断、也不吃内存，严格优于调大上限。
  //
  // ⚠️ 代价（有意接受）：这 3 个路由的响应**没有 x-app-version 头**。
  //   版本提示条（version-update-notifier）是给 window.fetch 打补丁、从任意响应读这个头，
  //   全站 /api/models、/api/workspace-state、/api/media-save-status 等高频流量都带它，不缺这 3 个。
  // ⚠️ 以后新增 multipart 上传路由，记得把名字加进下面这个负向断言名单。
  matcher: ["/api/:path((?!upload-file|asset-upload-temp|upload-image).*)"],
};
