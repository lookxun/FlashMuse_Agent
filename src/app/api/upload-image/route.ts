import { NextResponse } from "next/server";
import { saveUploadedImageAsset, saveUploadedImageBufferAsset } from "@/lib/local-assets";
import { toUserErrorMessage } from "@/lib/error-message";
import { getCurrentUser } from "@/lib/auth";
import { getBearerToken, verifyUploadToken } from "@/lib/upload-token";

const allowedUploadOrigins = new Set([
  "http://101.37.129.164",
  "http://101.47.19.109",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.UPLOAD_CORS_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
]);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowOrigin = allowedUploadOrigins.has(origin) ? origin : "";
  const headers: Record<string, string> = allowOrigin ? {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  } : {};
  return headers;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);
  try {
    const tokenUser = verifyUploadToken(getBearerToken(request.headers.get("authorization")));
    const currentUser = tokenUser ? null : await getCurrentUser();
    const userId = tokenUser?.userId ?? currentUser?.id;
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: corsHeaders });
    const contentType = request.headers.get("content-type") ?? "";
    let url = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("image");
      if (!(file instanceof File)) return NextResponse.json({ error: "缺少图片" }, { status: 400, headers: corsHeaders });
      const buffer = Buffer.from(await file.arrayBuffer());
      url = await saveUploadedImageBufferAsset(buffer, file.type || "image/jpeg", "upload_image", { userId });
    } else {
      const body = (await request.json()) as { image?: string };
      const image = body.image?.trim();
      if (!image) return NextResponse.json({ error: "缺少图片" }, { status: 400, headers: corsHeaders });
      url = await saveUploadedImageAsset(image, "upload_image", { userId });
    }

    return NextResponse.json({ url }, { headers: corsHeaders });
  } catch (error) {
    const message = toUserErrorMessage(error, "图片上传失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
