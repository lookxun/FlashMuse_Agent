import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
// ⭐ 目录包含校验的唯一权威实现。本文件原来自己写了一份 `isInsideGenerated`（写得是对的，
//   而另外 6 处压根没写 → 2026-08-02 才发现能穿越读 .env.local）。现在收敛成一份，防止以后再漂移。
import { isInsideGeneratedRoot } from "@/lib/generated-asset-path";
// ⭐⭐ 缩略图生成的唯一实现（2026-08-04 收敛）。本文件原来自己拷了一份一字不差的
//   路径推导 + ffmpeg 调用（连 scale=256:256 / -q:v 5 / timeout 60s / maxBuffer 都一样）。
//   分叉的代价是真实的：那份**从来不同步阿里镜像** → 阿里侧上传图缩略图长期一张都没有
//   （2026-08-04 对齐两端时，缺的 75 个文件全是 image-thumbnails/upload_image/…）。
import { ensureGeneratedImageThumbnail } from "@/lib/local-assets";

const PUBLIC_ROOT = join(process.cwd(), "public");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif"]);

function toFallbackRedirect(request: Request, publicUrl: string) {
  return NextResponse.redirect(new URL(publicUrl, request.url), 307);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const publicUrl = requestUrl.searchParams.get("url")?.trim() ?? "";

  if (!publicUrl.startsWith("/generated/")) {
    return NextResponse.json({ error: "缩略图地址不正确" }, { status: 400 });
  }

  const cleanPublicUrl = publicUrl.split("?")[0].split("#")[0];
  const sourcePath = join(PUBLIC_ROOT, cleanPublicUrl.replace(/^\//, ""));

  // ⛔ 这两道校验刻意**留在路由**、没有下沉到共享实现里：只有这条路的入参来自用户，
  //    其余调用方（openrouter / media-save-queue）传的都是服务端自己刚落盘的地址。
  //    下沉会改变既有调用方的行为（例如给它们新加后缀白名单），收敛的前提是零行为变化。
  if (!isInsideGeneratedRoot(sourcePath) || !existsSync(sourcePath)) {
    return toFallbackRedirect(request, cleanPublicUrl);
  }

  const extension = extname(sourcePath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return toFallbackRedirect(request, cleanPublicUrl);
  }

  try {
    // ⭐ syncToAli: true —— 懒生成这条路必须自己同步阿里；生成图那条路是调用方把
    //   [localUrl, thumbnailUrl] 合成一次同步发的（理由见 local-assets 里的注释）。
    const thumbnail = await ensureGeneratedImageThumbnail(cleanPublicUrl, { syncToAli: true });
    // ffmpeg 不可用 / 源文件不存在 → 回落到原图（与收敛前的 `!ffmpegPath` 分支等价）。
    if (!thumbnail) return toFallbackRedirect(request, cleanPublicUrl);

    const body = await readFile(thumbnail.thumbnailPath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Thumbnail-Url": thumbnail.thumbnailPublicUrl,
      },
    });
  } catch (error) {
    console.warn("[media-thumbnail] failed to create thumbnail", { publicUrl: cleanPublicUrl, error });
    return toFallbackRedirect(request, cleanPublicUrl);
  }
}
