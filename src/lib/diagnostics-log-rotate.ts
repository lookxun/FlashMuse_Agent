// 诊断日志（.runtime/*.jsonl）大小轮转的唯一实现（2026-08-02 审计 2.5）。
// 这三个日志原来只追加、永不轮转，既是唯一排错依据、又是磁盘炸掉的帮凶。
// 策略：单文件超过 20MB 就先改名成 <file>.1（只保留一代，旧的 .1 被覆盖），再追加。
// 诊断日志永远不许阻塞主流程：任何失败都吞掉（与三个调用方原有的 catch 语义一致）。

import { appendFile, rename, stat } from "node:fs/promises";

const MAX_DIAGNOSTICS_LOG_BYTES = 20 * 1024 * 1024;

export async function appendDiagnosticsJsonl(logPath: string, line: string) {
  try {
    const info = await stat(logPath).catch(() => null);
    if (info && info.size > MAX_DIAGNOSTICS_LOG_BYTES) {
      await rename(logPath, `${logPath}.1`).catch(() => undefined);
    }
    await appendFile(logPath, line, "utf8");
  } catch {
    // Diagnostics must never block requests.
  }
}
