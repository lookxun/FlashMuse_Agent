import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { getBearerToken, verifyUploadToken } from "@/lib/upload-token";
import { toUserErrorMessage } from "@/lib/error-message";
import { appendUploadDiagnosticsLog } from "@/lib/upload-diagnostics-log";
import { assembleUploadChunks, clearUploadChunks, saveUploadChunk, sweepStaleUploadChunks } from "@/lib/upload-chunks";
import { POST as uploadFilePost } from "../upload-file/route";
import { POST as assetUploadTempPost } from "../asset-upload-temp/route";

// M034 分片上传入口。两种请求都打到本路由：
//   1) 传一片：POST，query ?uploadId&index&total，body = 该片原始字节（application/octet-stream）。
//   2) 拼装：  POST ?assemble=1，JSON body { uploadId, totalChunks, target, fileName, mimeType,
//              originalContentHash, fields{...} }。收齐后拼成完整 Buffer、校验整体哈希，
//              重建成一个等价的 multipart 请求，**原样交给既有的 /api/upload-file 或
//              /api/asset-upload-temp 的 POST 处理**（零逻辑复制：校验/去重/落库/命名/阿里同步全复用）。
//
// ⭐ 客户端每片独立请求 + 失败只重传那一片 → 跨境丢包时不再"一卡就整包 205 秒"。
// ⛔ 本路由已在 src/proxy.ts 的 matcher 里排除（同其它大上传路由，否则被 Next 的 body 缓冲截断）。

const allowedUploadOrigins = new Set([
  "http://101.37.129.164",
  "https://ali.venusface.com",
  "https://static.venusface.com",
  "https://main.venusface.com",
  "https://api.venusface.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.UPLOAD_CORS_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
]);

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return allowedUploadOrigins.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" }
    : {};
}

async function getUploadUserId(request: Request) {
  return verifyUploadToken(getBearerToken(request.headers.get("authorization")))?.userId ?? (await getCurrentUser())?.id;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

type AssembleBody = {
  uploadId?: string;
  totalChunks?: number;
  target?: "image" | "file";
  fileName?: string;
  mimeType?: string;
  originalContentHash?: string;
  fields?: Record<string, string>;
};

export async function POST(request: Request) {
  const headers = getCorsHeaders(request);
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const url = new URL(request.url);
  const isAssemble = url.searchParams.get("assemble") === "1";
  let userId: string | undefined;
  try {
    userId = await getUploadUserId(request);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401, headers });

    // 机会性清理孤儿分片目录（不阻塞主流程）。
    void sweepStaleUploadChunks();

    if (!isAssemble) {
      // —— 传一片 ——
      const uploadId = url.searchParams.get("uploadId")?.trim() ?? "";
      const index = Number(url.searchParams.get("index"));
      if (!uploadId) return NextResponse.json({ error: "缺少上传标识" }, { status: 400, headers });
      const buffer = Buffer.from(await request.arrayBuffer());
      await saveUploadChunk(userId, uploadId, index, buffer);
      return NextResponse.json({ ok: true }, { headers });
    }

    // —— 拼装并交给既有上传处理 ——
    const body = (await request.json()) as AssembleBody;
    const uploadId = body.uploadId?.trim() ?? "";
    const totalChunks = body.totalChunks ?? 0;
    const target = body.target === "image" ? "image" : "file";
    const fileName = body.fileName?.trim() || "upload";
    const mimeType = body.mimeType?.trim() || "application/octet-stream";
    if (!uploadId || totalChunks <= 0) return NextResponse.json({ error: "缺少拼装参数" }, { status: 400, headers });

    let assembled: Buffer;
    try {
      assembled = await assembleUploadChunks(userId, uploadId, totalChunks);
    } catch (error) {
      void appendUploadDiagnosticsLog({ event: "upload-chunk-assemble-missing", requestId, userId, status: 409, durationMs: Date.now() - startedAt, error, extra: { uploadId, totalChunks } });
      // 缺片：让客户端知道要重传（返回 409 + 明确信号，客户端按缺失索引重发）。
      return NextResponse.json({ error: "分片不完整，请重试", incomplete: true }, { status: 409, headers });
    }

    // 整体哈希校验：拼出来的字节必须和客户端上传前算的原始文件哈希一致，否则说明有片损坏/错位。
    if (body.originalContentHash) {
      const actual = createHash("sha256").update(assembled).digest("hex");
      if (actual !== body.originalContentHash) {
        await clearUploadChunks(userId, uploadId);
        void appendUploadDiagnosticsLog({ event: "upload-chunk-hash-mismatch", requestId, userId, status: 409, durationMs: Date.now() - startedAt, extra: { uploadId, expected: body.originalContentHash, actual } });
        return NextResponse.json({ error: "上传校验失败，请重试", incomplete: true }, { status: 409, headers });
      }
    }

    // 重建成一个等价 multipart 请求，交给目标路由的 POST（复用其全部校验/去重/落库逻辑）。
    const file = new File([new Uint8Array(assembled)], fileName, { type: mimeType });
    const forwardForm = new FormData();
    forwardForm.append(target === "image" ? "image" : "file", file, fileName);
    for (const [key, value] of Object.entries(body.fields ?? {})) {
      if (typeof value === "string") forwardForm.append(key, value);
    }
    const forwardHeaders: Record<string, string> = { "x-request-id": requestId };
    const auth = request.headers.get("authorization");
    if (auth) forwardHeaders.authorization = auth;
    const origin = request.headers.get("origin");
    if (origin) forwardHeaders.origin = origin;
    const targetPath = target === "image" ? "/api/asset-upload-temp" : "/api/upload-file";
    const forwardRequest = new Request(new URL(targetPath, url.origin), { method: "POST", headers: forwardHeaders, body: forwardForm });

    const response = target === "image" ? await assetUploadTempPost(forwardRequest) : await uploadFilePost(forwardRequest);
    await clearUploadChunks(userId, uploadId);

    // 透传目标响应体+状态，但换上本路由自己的 CORS 头（目标是内部调用，其 CORS 头针对的是 forwardRequest 的 origin）。
    const payload = await response.json().catch(() => ({}));
    void appendUploadDiagnosticsLog({ event: "upload-chunk-assemble-success", requestId, userId, status: response.status, durationMs: Date.now() - startedAt, extra: { uploadId, totalChunks, target, bytes: assembled.byteLength } });
    return NextResponse.json(payload, { status: response.status, headers });
  } catch (error) {
    const message = toUserErrorMessage(error, "文件上传失败，请稍后再试。");
    void appendUploadDiagnosticsLog({ event: isAssemble ? "upload-chunk-assemble-failed" : "upload-chunk-put-failed", requestId, userId, status: 500, durationMs: Date.now() - startedAt, error, extra: { userMessage: message } });
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
