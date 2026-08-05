import { existsSync, statSync, createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { appendTransferLog, computeKbps } from "@/lib/transfer-log";

const execFileAsync = promisify(execFile);
const GENERATED_ROOT = join(process.cwd(), "public", "generated");
// ⛔ 阿里侧拉取器是唯一实现，禁止在这里内联第二份分片逻辑（补数据脚本也读同一个文件）。
const ALI_PULL_SCRIPT_PATH = join(process.cwd(), "deploy", "ali-parallel-pull.sh");

type AliSyncResult = {
  enabled: boolean;
  ok: boolean;
  syncedUrls: string[];
  error?: string;
};

function getAliSyncConfig() {
  return {
    enabled: process.env.ALI_SYNC_GENERATED_ENABLED === "true",
    host: process.env.ALI_SYNC_HOST ?? "",
    user: process.env.ALI_SYNC_USER || "root",
    port: process.env.ALI_SYNC_PORT || "22",
    keyPath: process.env.ALI_SYNC_SSH_KEY || "/root/.ssh/flashmuse_to_ali_ed25519",
    destinationRoot: process.env.ALI_SYNC_DEST_ROOT || "/var/www/flashmuse-static/generated",
    // ⭐ 阿里能访问到的「腾讯 generated 基地址」。没配就退回单流 rsync（见下面的兜底）。
    //   正式服 http://119.28.116.16:5000/generated  测试服 http://119.28.116.16:5001/generated
    pullBaseUrl: (process.env.ALI_SYNC_PULL_BASE_URL ?? "").replace(/\/$/, ""),
    // 实测最优 16（4→147KB/s、8→357、16→461、32→329）。⛔ 别调到 32。
    concurrency: clampInt(process.env.ALI_SYNC_CONCURRENCY, 16, 1, 24),
    chunkBytes: clampInt(process.env.ALI_SYNC_CHUNK_BYTES, 1048576, 65536, 8388608),
    chunkRetry: clampInt(process.env.ALI_SYNC_CHUNK_RETRY, 3, 1, 8),
    chunkTimeoutSeconds: clampInt(process.env.ALI_SYNC_CHUNK_TIMEOUT, 120, 10, 600),
    // 整批的墙钟上限：1.16GB 补数据是脚本干的，这里只处理单次生成的几个文件。
    totalTimeoutMs: clampInt(process.env.ALI_SYNC_TOTAL_TIMEOUT_MS, 600_000, 30_000, 3_600_000),
  };
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toGeneratedRelativePath(publicUrl: string) {
  const cleanUrl = publicUrl.split("?")[0].split("#")[0];
  if (!cleanUrl.startsWith("/generated/")) return undefined;
  const relativePath = cleanUrl.replace(/^\/generated\//, "").replace(/\\/g, "/");
  if (!relativePath || relativePath.startsWith("../") || relativePath.includes("/../")) return undefined;
  return relativePath;
}

function md5OfFile(filePath: string) {
  return new Promise<string | undefined>((resolve) => {
    try {
      const hash = createHash("md5");
      const stream = createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", () => resolve(undefined));
    } catch {
      resolve(undefined);
    }
  });
}

function classifyRelativePath(relativePath: string) {
  if (relativePath.includes("/videos/")) return "video";
  if (relativePath.includes("video-posters/")) return "video-poster";
  if (relativePath.includes("thumbnails/")) return "thumbnail";
  if (relativePath.includes("/images/")) return "image";
  if (relativePath.includes("/files/")) return "document";
  return "other";
}

/**
 * 生成媒体同步到阿里静态镜像。
 *
 * 2026-08-04 重写：原来是 `rsync -azR` **单流**推过去，而这条跨境链路丢包 20~25%，
 * 单流只有 15~30 KB/s → 20MB 视频必然撞 120s 超时（线上实测 aliSynced 成功 43 / 失败 79，
 * 失败的几乎全是视频）。现在改成「阿里侧并发分片 HTTP 拉取」，16 并发实测 461 KB/s（30 倍）。
 *
 * ⭐ 语义不变：调用方（openrouter.ts / media-save-queue.ts）不用改。
 * ⭐ 兜底：没配 ALI_SYNC_PULL_BASE_URL 时退回原来的单流 rsync（保证升级期间不炸）。
 */
export async function syncGeneratedFilesToAli(publicUrls: Array<string | undefined>, options?: { requestId?: string; userId?: string; model?: string }): Promise<AliSyncResult> {
  const config = getAliSyncConfig();
  const uniqueRelativePaths = Array.from(new Set(
    publicUrls
      .map((url) => url ? toGeneratedRelativePath(url) : undefined)
      .filter((path): path is string => Boolean(path)),
  ));
  const existingRelativePaths = uniqueRelativePaths.filter((relativePath) => existsSync(join(GENERATED_ROOT, relativePath)));

  if (!config.enabled || !config.host || existingRelativePaths.length === 0) {
    return { enabled: config.enabled, ok: !config.enabled || existingRelativePaths.length === 0, syncedUrls: [] };
  }

  if (!config.pullBaseUrl) {
    // ⚠️ 兜底路径：仍是单流 rsync（慢），只在 env 没配好时走到。日志里能一眼看出来。
    return syncViaRsyncFallback(config, existingRelativePaths, options);
  }

  return syncViaParallelPull(config, existingRelativePaths, options);
}

async function syncViaParallelPull(
  config: ReturnType<typeof getAliSyncConfig>,
  relativePaths: string[],
  options?: { requestId?: string; userId?: string; model?: string },
): Promise<AliSyncResult> {
  const startedAt = Date.now();
  let script: string;
  try {
    script = await readFile(ALI_PULL_SCRIPT_PATH, "utf8");
  } catch (error) {
    // 脚本缺失（镜像没带 deploy/）→ 退回 rsync，别让同步整体失败。
    void appendTransferLog({ event: "ali-sync-failed", ok: false, via: "parallel-pull", error: `pull script unreadable: ${error instanceof Error ? error.message : String(error)}` });
    return syncViaRsyncFallback(config, relativePaths, options);
  }

  // 清单：相对路径|字节数|md5（md5 让阿里侧能做「已存在就跳过」和「拼装后校验」）
  const manifestLines: string[] = [];
  let plannedBytes = 0;
  for (const relativePath of relativePaths) {
    const absolutePath = join(GENERATED_ROOT, relativePath);
    let size = 0;
    try {
      size = statSync(absolutePath).size;
    } catch {
      continue;
    }
    const md5 = await md5OfFile(absolutePath);
    plannedBytes += size;
    manifestLines.push(`${relativePath}|${size}|${md5 ?? ""}`);
  }
  if (manifestLines.length === 0) return { enabled: true, ok: true, syncedUrls: [] };

  const manifestB64 = Buffer.from(manifestLines.join("\n"), "utf8").toString("base64");
  const payload = [
    `FM_PULL_BASE=${shellSingleQuote(config.pullBaseUrl)}`,
    `FM_DEST_ROOT=${shellSingleQuote(config.destinationRoot)}`,
    `FM_MANIFEST_B64=${shellSingleQuote(manifestB64)}`,
    `FM_CONCURRENCY=${config.concurrency}`,
    `FM_CHUNK_BYTES=${config.chunkBytes}`,
    `FM_CHUNK_RETRY=${config.chunkRetry}`,
    `FM_CHUNK_TIMEOUT=${config.chunkTimeoutSeconds}`,
    "export FM_PULL_BASE FM_DEST_ROOT FM_MANIFEST_B64 FM_CONCURRENCY FM_CHUNK_BYTES FM_CHUNK_RETRY FM_CHUNK_TIMEOUT",
    script,
  ].join("\n");

  const sshArgs = [
    "-i", config.keyPath,
    "-p", config.port,
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    // ⚠️ 这条链路 SSH 握手实测 4~12 秒（丢包导致 SYN 只能 RTO 翻倍等），别给 10 秒。
    "-o", "ConnectTimeout=30",
    "-o", "ServerAliveInterval=15",
    `${config.user}@${config.host}`,
    "bash", "-s",
  ];

  try {
    const { stdout } = await execFileAsyncWithInput("ssh", sshArgs, payload, config.totalTimeoutMs);
    const { syncedRelativePaths, failed, summary } = parsePullOutput(stdout);

    for (const line of failed) {
      void appendTransferLog({
        event: "ali-sync-failed", ok: false, via: "parallel-pull",
        kind: classifyRelativePath(String(line.rel ?? "")), path: String(line.rel ?? ""),
        bytes: numberOrUndefined(line.bytes), durationMs: numberOrUndefined(line.ms),
        chunks: numberOrUndefined(line.chunks), retries: numberOrUndefined(line.retries),
        concurrency: config.concurrency, chunkBytes: config.chunkBytes,
        error: String(line.error ?? "unknown"),
        requestId: options?.requestId, userId: options?.userId, model: options?.model,
      });
    }
    for (const line of summary.files) {
      const bytes = numberOrUndefined(line.bytes);
      const durationMs = numberOrUndefined(line.ms);
      void appendTransferLog({
        event: line.skipped ? "ali-sync-skipped" : "ali-sync-file", ok: true, via: "parallel-pull",
        kind: classifyRelativePath(String(line.rel ?? "")), path: String(line.rel ?? ""),
        bytes, durationMs,
        kbps: numberOrUndefined(line.kbps) ?? (bytes !== undefined && durationMs !== undefined ? computeKbps(bytes, durationMs) : undefined),
        chunks: numberOrUndefined(line.chunks), retries: numberOrUndefined(line.retries),
        concurrency: config.concurrency, chunkBytes: config.chunkBytes,
        requestId: options?.requestId, userId: options?.userId, model: options?.model,
        extra: line.reason ? { reason: line.reason } : undefined,
      });
    }

    const totalMs = Date.now() - startedAt;
    const ok = failed.length === 0;
    void appendTransferLog({
      event: "ali-sync-summary", ok, via: "parallel-pull",
      bytes: numberOrUndefined(summary.total?.bytes) ?? plannedBytes,
      durationMs: totalMs,
      kbps: numberOrUndefined(summary.total?.kbps) ?? computeKbps(plannedBytes, totalMs),
      concurrency: config.concurrency, chunkBytes: config.chunkBytes,
      total: numberOrUndefined(summary.total?.total) ?? manifestLines.length,
      okCount: numberOrUndefined(summary.total?.ok),
      skippedCount: numberOrUndefined(summary.total?.skipped),
      failedCount: numberOrUndefined(summary.total?.failed) ?? failed.length,
      requestId: options?.requestId, userId: options?.userId, model: options?.model,
    });

    if (!ok) {
      return { enabled: true, ok: false, syncedUrls: syncedRelativePaths.map((relativePath) => `/generated/${relativePath}`), error: `parallel-pull failed for ${failed.length}/${manifestLines.length} file(s): ${String(failed[0]?.error ?? "")}`.slice(0, 300) };
    }
    return { enabled: true, ok: true, syncedUrls: syncedRelativePaths.map((relativePath) => `/generated/${relativePath}`) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void appendTransferLog({
      event: "ali-sync-failed", ok: false, via: "parallel-pull",
      bytes: plannedBytes, durationMs: Date.now() - startedAt,
      concurrency: config.concurrency, chunkBytes: config.chunkBytes,
      total: manifestLines.length, error: message,
      requestId: options?.requestId, userId: options?.userId, model: options?.model,
    });
    return { enabled: true, ok: false, syncedUrls: [], error: message.slice(0, 300) };
  }
}

/** 原来的单流 rsync 推送：只在没配 ALI_SYNC_PULL_BASE_URL / 拉取器脚本缺失时兜底。 */
async function syncViaRsyncFallback(
  config: ReturnType<typeof getAliSyncConfig>,
  relativePaths: string[],
  options?: { requestId?: string; userId?: string; model?: string },
): Promise<AliSyncResult> {
  const startedAt = Date.now();
  const sshArgs = [
    "-i", config.keyPath,
    "-p", config.port,
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=30",
  ];
  const sshCommand = ["ssh", ...sshArgs].join(" ");
  const target = `${config.user}@${config.host}`;
  let plannedBytes = 0;
  for (const relativePath of relativePaths) {
    try { plannedBytes += statSync(join(GENERATED_ROOT, relativePath)).size; } catch { /* ignore */ }
  }

  try {
    await execFileAsync("ssh", [...sshArgs, target, "mkdir", "-p", config.destinationRoot], { timeout: 60_000, maxBuffer: 1024 * 1024 });
    await execFileAsync("rsync", ["-azR", "--partial", "--timeout=600", "-e", sshCommand, ...relativePaths, `${target}:${config.destinationRoot}/`], { cwd: GENERATED_ROOT, timeout: config.totalTimeoutMs, maxBuffer: 2 * 1024 * 1024 });
    const durationMs = Date.now() - startedAt;
    void appendTransferLog({
      event: "ali-sync-fallback-rsync", ok: true, via: "rsync",
      bytes: plannedBytes, durationMs, kbps: computeKbps(plannedBytes, durationMs),
      total: relativePaths.length, requestId: options?.requestId, userId: options?.userId, model: options?.model,
      extra: { reason: "ALI_SYNC_PULL_BASE_URL not configured" },
    });
    return { enabled: true, ok: true, syncedUrls: relativePaths.map((relativePath) => `/generated/${relativePath}`) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void appendTransferLog({
      event: "ali-sync-fallback-rsync", ok: false, via: "rsync",
      bytes: plannedBytes, durationMs: Date.now() - startedAt,
      total: relativePaths.length, error: message,
      requestId: options?.requestId, userId: options?.userId, model: options?.model,
    });
    return { enabled: true, ok: false, syncedUrls: [], error: message.slice(0, 300) };
  }
}

type PullLine = Record<string, unknown>;

function parsePullOutput(stdout: string) {
  const syncedRelativePaths: string[] = [];
  const failed: PullLine[] = [];
  const files: PullLine[] = [];
  let total: PullLine | undefined;

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("{")) continue;
    let parsed: PullLine;
    try {
      parsed = JSON.parse(line) as PullLine;
    } catch {
      continue;
    }
    if (parsed.event === "ali-pull-summary") { total = parsed; continue; }
    if (parsed.event === "ali-pull-fatal") { failed.push({ ...parsed, rel: "", error: parsed.error }); continue; }
    if (parsed.event !== "ali-pull-file") continue;
    if (parsed.ok === true) {
      files.push(parsed);
      if (typeof parsed.rel === "string") syncedRelativePaths.push(parsed.rel);
    } else {
      failed.push(parsed);
    }
  }
  return { syncedRelativePaths, failed, summary: { files, total } };
}

function numberOrUndefined(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 单引号包裹并转义，安全塞进 shell 赋值语句 */
function shellSingleQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** execFile 不支持 stdin，这里手动接管：把 payload 写进子进程 stdin。 */
function execFileAsyncWithInput(file: string, args: string[], input: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(file, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      // ⚠️ 拉取器「有文件失败」时退出码是 1，但 stdout 里的 JSON 仍然有效、要拿来记日志。
      //   所以不能一见 error 就丢掉 stdout。
      if (error && !stdout) {
        reject(new Error(`${error.message}${stderr ? ` | ${String(stderr).slice(0, 200)}` : ""}`));
        return;
      }
      resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(input);
  });
}
