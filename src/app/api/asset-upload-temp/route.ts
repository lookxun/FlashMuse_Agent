import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { commitTemporaryUploadedImage, deleteTemporaryUploadedImage, saveTemporaryUploadedImageBuffer } from "@/lib/local-assets";
import { toUserErrorMessage } from "@/lib/error-message";
import { getBearerToken, verifyUploadToken } from "@/lib/upload-token";
import { appendUploadDiagnosticsLog } from "@/lib/upload-diagnostics-log";
import { recordUploadEvent } from "@/lib/analytics-events";
import { syncGeneratedFilesToAli } from "@/lib/ali-sync";
import { prisma } from "@/lib/prisma";
import { resolveUploadName } from "@/lib/upload-name";
import { validateImageUploadFile } from "@/lib/image-upload-validation";

/** 按内容哈希查以前上传过的同一张图（字节完全一致），命中就复用其地址+权威名、不重复落库。 */
async function findDedupImage(userId: string, contentHash: string) {
  const existing = await prisma.mediaAsset.findFirst({
    where: { userId, contentHash, mediaType: "image", archivedAt: null, userStates: { some: { deletedAt: null, hiddenAt: null } } },
    select: { url: true, systemName: true, initialName: true, userStates: { where: { userId }, select: { currentName: true }, take: 1 } },
    orderBy: { firstSeenAt: "asc" },
  });
  if (!existing) return undefined;
  const name = existing.userStates[0]?.currentName?.trim() || existing.systemName?.trim() || existing.initialName?.trim() || undefined;
  return { url: existing.url, name };
}

const allowedUploadOrigins = new Set([
  "http://101.37.129.164",
  "http://101.47.19.109",
  "https://ali.venusface.com",
  "https://static.venusface.com",
  "https://main.venusface.com",
  "https://api.venusface.com",
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
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let userId: string | undefined;
  let fileName: string | undefined;
  let mimeType: string | undefined;
  let fileSize: number | undefined;
  let forceReencode = false;
  try {
    userId = await getUploadUserId(request);
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-start", requestId, userId, extra: { origin: request.headers.get("origin"), contentLength: request.headers.get("content-length"), contentType: request.headers.get("content-type"), userAgent: request.headers.get("user-agent") } });
    if (!userId) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-unauthorized", requestId, status: 401, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "请先登录" }, { status: 401, headers });
    }
    const formData = await request.formData();
    const file = formData.get("image");
    forceReencode = formData.get("forceReencode") === "1";
    if (!(file instanceof File)) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-missing-file", requestId, userId, forceReencode, status: 400, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "缺少图片" }, { status: 400, headers });
    }
    fileName = file.name;
    mimeType = file.type || "image/jpeg";
    fileSize = file.size;
    const validationError = validateImageUploadFile(file);
    if (validationError) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-invalid-file", requestId, userId, fileName, mimeType, fileSize, forceReencode, status: 400, durationMs: Date.now() - startedAt, extra: { userMessage: validationError } });
      return NextResponse.json({ error: validationError }, { status: 400, headers });
    }
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-file-received", requestId, userId, fileName, mimeType, fileSize, forceReencode, durationMs: Date.now() - startedAt });
    const originalBuffer = Buffer.from(await file.arrayBuffer());
    // 内容哈希（原始字节，转码前）：判定"同一文件"用。
    const contentHash = createHash("sha256").update(originalBuffer).digest("hex");
    // 命中以前上传过的同一张图 → 直接复用旧地址，不再落盘/不建新记录。
    // 仅当调用方显式带 dedup=1 才判重（目前只有对话流接线；资产库/工作流不带 → 不受影响）。
    const wantDedup = formData.get("dedup") === "1";
    const dedup = wantDedup ? await findDedupImage(userId, contentHash) : undefined;
    if (dedup) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-dedup-hit", requestId, userId, fileName, status: 200, durationMs: Date.now() - startedAt, extra: { url: dedup.url, contentHash } });
      return NextResponse.json({ duplicate: true, url: dedup.url, name: dedup.name, contentHash }, { headers });
    }
    const result = await saveTemporaryUploadedImageBuffer(originalBuffer, mimeType, { userId, forceReencode, diagnostics: { requestId, fileName, fileSize } });
    // 服务端权威预分配显示名（去扩展名 + 全局唯一 + 同图复用同名），前端上传当下即可显示，
    // 最终入库 media-assets POST 会再权威定名（非并发场景结果一致）。
    const resolvedName = (await resolveUploadName({ userId, originalFileName: fileName, contentHash }).catch(() => undefined))?.name;
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-success", requestId, userId, fileName, mimeType, fileSize, forceReencode, token: result.token, status: 200, durationMs: Date.now() - startedAt });
    void recordUploadEvent({ userId, kind: "image", status: "success", bytes: fileSize });
    return NextResponse.json({ ...result, contentHash, name: resolvedName }, { headers });
  } catch (error) {
    const message = toUserErrorMessage(error, "图片上传失败，请稍后再试。");
    console.error("[upload] asset-upload-temp post failed", { requestId, userId, fileName, mimeType, fileSize, forceReencode, error });
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-post-failed", requestId, userId, fileName, mimeType, fileSize, forceReencode, status: 500, durationMs: Date.now() - startedAt, error, extra: { userMessage: message } });
    // "需要转码" 是两步式上传的探测信号(forceReencode=false 时)，前端会自动带 forceReencode=1 重试，
    // 不是真正的上传失败，也不算一次上传，故不计入 UploadEvent，避免同一文件被记成"失败+成功"两次。
    const isReencodeProbe = !forceReencode && /转码|reencode/i.test(message);
    if (!isReencodeProbe) {
      void recordUploadEvent({ userId, kind: "image", status: "failed", reason: /转码|reencode/i.test(message) ? "reencode" : /超时|timeout/i.test(message) ? "timeout" : "other", bytes: fileSize });
    }
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}

export async function PATCH(request: Request) {
  const headers = getCorsHeaders(request);
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let userId: string | undefined;
  let token: string | undefined;
  try {
    userId = await getUploadUserId(request);
    if (!userId) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-unauthorized", requestId, status: 401, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "请先登录" }, { status: 401, headers });
    }
    const body = (await request.json()) as { token?: string };
    token = body.token;
    if (!token) {
      void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-missing-token", requestId, userId, status: 400, durationMs: Date.now() - startedAt });
      return NextResponse.json({ error: "缺少上传文件" }, { status: 400, headers });
    }
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-start", requestId, userId, token });
    const url = await commitTemporaryUploadedImage(token, { userId, diagnostics: { requestId } });
    // 同步到 Ali 本地镜像，避免 Ali 用户回源代理加载原图极慢(表现为读很久后灰屏)。
    void syncGeneratedFilesToAli([url]).catch(() => undefined);
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-success", requestId, userId, token, status: 200, durationMs: Date.now() - startedAt, extra: { url } });
    return NextResponse.json({ url }, { headers });
  } catch (error) {
    const message = toUserErrorMessage(error, "图片保存失败，请稍后再试。");
    console.error("[upload] asset-upload-temp patch failed", { requestId, userId, token, error });
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-patch-failed", requestId, userId, token, status: 500, durationMs: Date.now() - startedAt, error, extra: { userMessage: message } });
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}

export async function DELETE(request: Request) {
  const headers = getCorsHeaders(request);
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const userId = await getUploadUserId(request);
    if (!userId) return NextResponse.json({ ok: true }, { headers });
    const body = (await request.json().catch(() => ({}))) as { tokens?: string[] };
    await Promise.all((body.tokens ?? []).map((token) => deleteTemporaryUploadedImage(token, { userId })));
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-delete-success", requestId, userId, status: 200, durationMs: Date.now() - startedAt, extra: { tokenCount: body.tokens?.length ?? 0 } });
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    void appendUploadDiagnosticsLog({ event: "asset-upload-temp-delete-failed-ignored", requestId, status: 200, durationMs: Date.now() - startedAt });
    return NextResponse.json({ ok: true }, { headers });
  }
}
