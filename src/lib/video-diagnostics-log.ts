import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { appendDiagnosticsJsonl } from "@/lib/diagnostics-log-rotate";

type VideoDiagnosticReference = {
  index: number;
  kind: "asset" | "data" | "generated" | "remote" | "unknown";
  host?: string;
  pathTail?: string;
  length?: number;
  role?: string;
  status?: string;
  assetId?: string;
  error?: unknown;
};

type VideoDiagnosticEntry = {
  event: string;
  requestId?: string;
  conversationId?: string;
  conversationTitle?: string;
  model?: string;
  provider?: string;
  taskId?: string;
  referenceMode?: string;
  referenceCount?: number;
  assetReferenceCount?: number;
  settings?: unknown;
  promptLength?: number;
  references?: VideoDiagnosticReference[];
  autoReview?: unknown;
  error?: unknown;
  extra?: Record<string, unknown>;
};

const LOG_PATH = join(process.cwd(), ".runtime", "video-diagnostics-log.jsonl");

function cleanText(value: unknown, maxLength = 1000) {
  if (value === undefined || value === null) return undefined;
  const text = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getErrorDetails(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: cleanText(error.message),
      stackHead: cleanText(error.stack, 1200),
    };
  }
  return { message: cleanText(error) };
}

export function summarizeVideoReference(url: string, index: number, role?: string): VideoDiagnosticReference {
  if (!url) return { index, kind: "unknown", role };
  if (url.startsWith("asset://")) return { index, kind: "asset", assetId: url.slice("asset://".length), role };
  // ⭐ 必须和 `summarizeGeneratedReference`（generation-diagnostics-log.ts）保持同样的分类，
  // 否则同一条参考图在两个日志里长得不一样、排查时对不上。
  // 2026-07-29 踩过：这里缺 `data` 分支，base64 参考图被归成 `kind:"unknown"`，
  // 查 A5「参考素材不是可审核的公网地址」时只看到 unknown、看不出它其实是 dataURL，白绕一圈。
  if (url.startsWith("data:")) return { index, kind: "data", length: url.length, role };
  if (url.startsWith("/generated/")) {
    const parts = url.split("?")[0].split("/").filter(Boolean);
    return { index, kind: "generated", pathTail: parts.slice(-4).join("/"), role };
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      return { index, kind: "remote", host: parsed.hostname, pathTail: parts.slice(-3).join("/"), role };
    } catch {
      return { index, kind: "remote", role };
    }
  }
  return { index, kind: "unknown", role };
}

export async function appendVideoDiagnosticsLog(entry: VideoDiagnosticEntry) {
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendDiagnosticsJsonl(
      LOG_PATH,
      `${JSON.stringify({
        time: new Date().toISOString(),
        event: entry.event,
        requestId: cleanText(entry.requestId, 120),
        conversationId: cleanText(entry.conversationId, 120),
        conversationTitle: cleanText(entry.conversationTitle, 200),
        model: entry.model,
        provider: entry.provider,
        taskId: cleanText(entry.taskId, 160),
        referenceMode: entry.referenceMode,
        referenceCount: entry.referenceCount ?? entry.references?.length ?? 0,
        assetReferenceCount: entry.assetReferenceCount,
        settings: entry.settings,
        promptLength: entry.promptLength,
        references: entry.references?.map((reference) => ({ ...reference, error: getErrorDetails(reference.error) })),
        autoReview: entry.autoReview,
        error: getErrorDetails(entry.error),
        extra: entry.extra,
      })}\n`,
    );
  } catch {
    // Diagnostics must never block generation requests.
  }
}
