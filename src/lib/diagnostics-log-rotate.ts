// 诊断日志（.runtime/*.jsonl）大小轮转的唯一实现（2026-08-02 审计 2.5）。
// 这三个日志原来只追加、永不轮转，既是唯一排错依据、又是磁盘炸掉的帮凶。
// 策略：单文件超过 20MB 就轮转：当前 → .1 → .2 … → .7，只留 7 代备份（约 2 个月）。
// 诊断日志永远不许阻塞主流程：任何失败都吞掉（与三个调用方原有的 catch 语义一致）。

import { appendFile, rename, stat, unlink } from "node:fs/promises";

const MAX_DIAGNOSTICS_LOG_BYTES = 20 * 1024 * 1024;
const MAX_DIAGNOSTICS_LOG_BACKUPS = 7;

async function rotateDiagnosticsLog(logPath: string) {
  await unlink(`${logPath}.${MAX_DIAGNOSTICS_LOG_BACKUPS}`).catch(() => undefined);
  for (let index = MAX_DIAGNOSTICS_LOG_BACKUPS - 1; index >= 1; index -= 1) {
    await rename(`${logPath}.${index}`, `${logPath}.${index + 1}`).catch(() => undefined);
  }
  await rename(logPath, `${logPath}.1`).catch(() => undefined);
}

export async function appendDiagnosticsJsonl(logPath: string, line: string) {
  try {
    const info = await stat(logPath).catch(() => null);
    if (info && info.size > MAX_DIAGNOSTICS_LOG_BYTES) {
      await rotateDiagnosticsLog(logPath);
    }
    await appendFile(logPath, line, "utf8");
  } catch {
    // Diagnostics must never block requests.
  }
}
