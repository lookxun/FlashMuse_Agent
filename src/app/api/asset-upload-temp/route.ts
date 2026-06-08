import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { commitTemporaryUploadedImage, deleteTemporaryUploadedImage, saveTemporaryUploadedImageBuffer } from "@/lib/local-assets";
import { toUserErrorMessage } from "@/lib/error-message";
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
    "Access-Control-Allow-Methods": "POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  } : {};
  return headers;
}

async function getUploadUserId(request: Request) {
  const tokenUser = verifyUploadToken(getBearerToken(request.headers.get("authorization")));
  if (tokenUser?.userId) return tokenUser.userId;
  const user = await getCurrentUser();
  return user?.id;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = getCorsHeaders(request);
  try {
    const userId = await getUploadUserId(request);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401, headers });
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "缺少图片" }, { status: 400, headers });
    const result = await saveTemporaryUploadedImageBuffer(Buffer.from(await file.arrayBuffer()), file.type || "image/jpeg", { userId });
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json({ error: toUserErrorMessage(error, "图片上传失败，请稍后再试。") }, { status: 500, headers });
  }
}

export async function PATCH(request: Request) {
  const headers = getCorsHeaders(request);
  try {
    const userId = await getUploadUserId(request);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401, headers });
    const body = (await request.json()) as { token?: string };
    if (!body.token) return NextResponse.json({ error: "缺少上传文件" }, { status: 400, headers });
    const url = await commitTemporaryUploadedImage(body.token, { userId });
    return NextResponse.json({ url }, { headers });
  } catch (error) {
    return NextResponse.json({ error: toUserErrorMessage(error, "图片保存失败，请稍后再试。") }, { status: 500, headers });
  }
}

export async function DELETE(request: Request) {
  const headers = getCorsHeaders(request);
  try {
    const userId = await getUploadUserId(request);
    if (!userId) return NextResponse.json({ ok: true }, { headers });
    const body = (await request.json().catch(() => ({}))) as { tokens?: string[] };
    await Promise.all((body.tokens ?? []).map((token) => deleteTemporaryUploadedImage(token, { userId })));
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ ok: true }, { headers });
  }
}
