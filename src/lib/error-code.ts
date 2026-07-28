import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { toUserErrorMessage } from "@/lib/error-message";

const ERROR_COUNTER_PATH = join(process.cwd(), ".runtime", "error-code-counter.txt");
let errorCodeQueue: Promise<unknown> = Promise.resolve();

function sanitizeErrorForLog(value: unknown) {
  const raw = value instanceof Error ? `${value.stack ?? value.message}` : typeof value === "string" ? value : JSON.stringify(value);
  return raw
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/sk-or-v1-[a-z0-9]+/gi, "sk-or-v1-[REDACTED]");
}

async function allocateNextErrorCode() {
  await mkdir(dirname(ERROR_COUNTER_PATH), { recursive: true });
  const currentText = await readFile(ERROR_COUNTER_PATH, "utf8").catch(() => "0");
  const next = Math.max(0, Number.parseInt(currentText.trim(), 10) || 0) + 1;
  await writeFile(ERROR_COUNTER_PATH, String(next));
  return `B_${next}`;
}

function nextErrorCode() {
  const task = errorCodeQueue.then(() => allocateNextErrorCode());
  errorCodeQueue = task.catch(() => undefined);
  return task;
}

// options.model：⭐ 只用于决定错误文案里能不能写"可由AI安全改写后重试"（只有 gpt-5.4-image-2 两款
// 有这个入口，见 models.ts 的 modelSupportsPromptSafetyRewrite）。图片链路必须传，视频链路不传即可。
export async function createCodedApiError(error: unknown, fallback: string, scope: string, options?: { model?: string }) {
  const message = toUserErrorMessage(error, fallback, options);
  const errorCode = await nextErrorCode();
  console.error(`[${errorCode}] ${scope}`, sanitizeErrorForLog(error));
  return { error: `(${errorCode}) ${message}`, errorCode };
}
