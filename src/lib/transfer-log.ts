// 传输速度日志的唯一实现（2026-08-04 新增，🗣️ 用户要求：
// 「这些生成图片和视频的下载速度、同步速度什么的全部做成日志，要记录时间，
//   因为不同时间下载速度不一样，以后看日志再优化」）。
//
// 记两类事件（都带**绝对时间戳**，因为跨境链路速度按时段波动很大，事后要按小时聚合看）：
//   1. `provider-download` —— 供应商 → 腾讯（生成结果下载落地）
//   2. `ali-sync`         —— 腾讯 → 阿里（并发分片同步，逐文件 + 整批 summary）
//
// ⛔ 别再在别处自己 `appendFile` 写速度日志：轮转由 `diagnostics-log-rotate.ts` 统一负责
//   （超 20MB 转 .1），这也是既有三个 diagnostics 日志的约定。
// ⛔ 日志永远不许阻塞主流程：一律 `void appendTransferLog(...)`，内部吞掉所有异常。

import { join } from "node:path";

import { appendDiagnosticsJsonl } from "@/lib/diagnostics-log-rotate";

const TRANSFER_LOG_PATH = join(process.cwd(), ".runtime", "transfer-diagnostics-log.jsonl");

export type TransferLogEntry = {
  /** 传输方向/阶段 */
  event:
    | "provider-download"
    | "ali-sync-file"
    | "ali-sync-summary"
    | "ali-sync-skipped"
    | "ali-sync-failed"
    | "ali-sync-fallback-rsync";
  /** image / video / poster / thumbnail / static / home-assets / document ... */
  kind?: string;
  /** 相对路径或 /generated/... 地址（大文件排查时按它 grep） */
  path?: string;
  bytes?: number;
  durationMs?: number;
  /** KB/s，服务端算好存下来，省得事后再算 */
  kbps?: number;
  /** 并发数 / 分片数 / 重试次数：调参数时要按这三个维度对比 */
  concurrency?: number;
  chunks?: number;
  chunkBytes?: number;
  retries?: number;
  ok: boolean;
  error?: string;
  /** 走的哪条路：parallel-pull（新）/ rsync（兜底）/ provider */
  via?: string;
  requestId?: string;
  userId?: string;
  model?: string;
  /** 批次聚合字段（summary 用） */
  total?: number;
  okCount?: number;
  skippedCount?: number;
  failedCount?: number;
  extra?: Record<string, unknown>;
};

export async function appendTransferLog(entry: TransferLogEntry) {
  try {
    const now = Date.now();
    const line = `${JSON.stringify({
      // ⭐ 同时存 ISO 和毫秒：ISO 方便人读/按小时聚合，epoch 方便脚本算差值。
      ts: new Date(now).toISOString(),
      tsEpochMs: now,
      ...entry,
      error: entry.error ? entry.error.slice(0, 300) : undefined,
    })}\n`;
    await appendDiagnosticsJsonl(TRANSFER_LOG_PATH, line);
  } catch {
    // 日志绝不阻塞主流程。
  }
}

/** 字节数 + 耗时 → KB/s（耗时为 0 时返回 undefined，避免除零得到 Infinity 落进日志） */
export function computeKbps(bytes: number, durationMs: number) {
  if (!Number.isFinite(bytes) || !Number.isFinite(durationMs) || durationMs <= 0 || bytes <= 0) return undefined;
  return Math.round((bytes / (durationMs / 1000) / 1024) * 10) / 10;
}
