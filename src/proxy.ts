import { NextResponse, type NextRequest } from "next/server";
import { APP_VERSION } from "@/lib/app-version";

// ⭐⭐ 唯一权威：「哪些 /api 接口**可以**被缓存」。除了这里列出的，其余全部强制 no-store。
//
// 为什么必须在这里统一加（2026-08-09 正式服真实事故）：
// 顶部公告文案改了以后，用户刷新时**在新旧两个版本之间来回跳**，甚至过几秒自动变回旧文案。
// 根因不是数据库、不是我们的代码逻辑 —— 而是 `/api/announcement` 和 `/api/auth/me` 的响应
// **一个 Cache-Control 都没有**（也没有 Expires / Last-Modified）。
// 按 RFC 9111，这种 200 GET 响应允许任何共享缓存**自行用启发式过期决定缓存多久** →
// 用户侧的运营商 / 公司网关透明代理就存了一份很旧的副本。
// ⛔ 代码里 `fetch(url, { cache: "no-store" })` **治不了这个** —— 那只约束浏览器自己的 HTTP 缓存，
//    中间代理只看**响应头**。所以防线必须在服务端响应头上。
// ⭐ 判据（二值）：`curl -sI <接口>` 看有没有 Cache-Control。没有 = 允许被别人随便缓存。
// ⛔ 在数据中心 / 干净浏览器里**永远复现不出来**（那条链路上没有透明缓存）→
//    别因为"我这边测 20/20 都对"就认为没问题。
const CACHEABLE_API_PATHS = [
  // 缩略图是内容寻址的（url 变了才会变），阿里正式那份 nginx 故意缓存它 30 天，
  // 且路由自己会返回 `public, max-age=31536000, immutable` —— ⛔ 绝不能被下面的 no-store 覆盖。
  "/api/media-thumbnail",
];

function isCacheableApiPath(pathname: string) {
  return CACHEABLE_API_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

// 给所有 /api/* 响应带上「已发布版本号」响应头。前端（version-update-notifier）搭在已有请求流量上
// 读取此头，与自己 bundle 里打死的版本对比，服务端更高就弹「发现新版本」提示条。
//
// ⭐ 为什么用 PUBLISHED_APP_VERSION 而不是直接 APP_VERSION：
// APP_VERSION 是构建时打进镜像的，新容器一起来就是新版；但此时阿里静态镜像可能还没同步完，
// 用户此刻点刷新会因 chunk 尚未就绪而白屏。所以线上用运行时环境变量 PUBLISHED_APP_VERSION 作为
// 「已完全部署（含静态同步）后才置为新版」的信号——部署最后一步才 set 它 + force-recreate，
// 保证「提示条弹出时 = 静态资源已就绪 = 刷新必正常」。
// 本地开发（非 production）没有该变量时回退到 APP_VERSION，方便即时看到效果。
// （Next 16 已把 middleware 文件约定改名 proxy，本文件即原 middleware.ts，2026-08-02 迁移。）
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const published = process.env.PUBLISHED_APP_VERSION?.trim();
  const advertise = published || (process.env.NODE_ENV !== "production" ? APP_VERSION : "");
  if (advertise) response.headers.set("x-app-version", advertise);

  // 除白名单外，所有 /api 响应一律禁止任何缓存（浏览器 + 中间代理）。
  // `Pragma` / `Expires` 是给只认 HTTP/1.0 的老代理看的，一起给，成本为零。
  if (!isCacheableApiPath(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }
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
  // ⭐ 负向断言用「整段匹配」（`(?:$|/)`，2026-08-02 从纯前缀匹配改过来）：
  //   只排除 upload-file / asset-upload-temp / upload-image 这三个路由本身及其子路径，
  //   不会误伤将来可能出现的 /api/upload-filex、/api/upload-files 这类撞前缀的新路由。
  matcher: ["/api/:path((?!(?:upload-file|asset-upload-temp|upload-image|upload-chunk)(?:$|/)).*)"],
};
