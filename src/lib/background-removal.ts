import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// 本地抠图（真透明 PNG）。
// 背景：两家出图 provider（OpenRouter 的 gpt-5.4-image-2 / BytePlus Seedream）在本环境都无法产出
// 真透明背景——gpt 直接拒绝 background:"transparent"（只接受 auto/opaque），Seedream 输出的 png 也没有
// alpha 通道。所以「去背景 / 编辑元素的透明主体层」改为在服务端本地跑抠图模型（@imgly/background-removal-node，
// 自带 onnx 分割模型），与 provider 无关，产出带 alpha 通道的透明 PNG，约 1~3 秒/张。
// onnxruntime-node 原生推理放在独立子进程里跑（见 scripts/remove-background-worker.mjs），
// 避免与主进程其它原生库冲突导致整进程崩溃。

const BG_TEMP_ROOT = join(process.cwd(), ".runtime", "bg-remove-temp");
const WORKER_PATH = join(process.cwd(), "scripts", "remove-background-worker.mjs");

// 把「自家 /generated 资产 url / 自家绝对 url」映射到本地 public 文件路径。
function resolveLocalAssetPath(url: string): string | undefined {
  if (url.startsWith("/generated/")) return join(process.cwd(), "public", url.replace(/^\//, ""));
  const m = url.match(/^https?:\/\/[^/]+(\/generated\/[^\s?#]+)/i);
  if (m && m[1].startsWith("/generated/")) return join(process.cwd(), "public", m[1].replace(/^\//, ""));
  return undefined;
}

// 把一个参考图来源（data url / 自家本地 /generated / 远程 url）读成 Buffer。
async function loadSourceBuffer(source: string): Promise<Buffer> {
  const url = source.trim();
  if (!url) throw new Error("抠图缺少源图片。");
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1] ?? "";
    return Buffer.from(base64, "base64");
  }
  const localPath = resolveLocalAssetPath(url);
  if (localPath && existsSync(localPath)) return readFileSync(localPath);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`读取源图片失败（HTTP ${resp.status}）。`);
  return Buffer.from(await resp.arrayBuffer());
}

/**
 * 对一张源图片做本地抠图，返回真透明 PNG 的 buffer。
 * source 可为 data url、自家 /generated 本地资产 url 或远程 url。
 */
export async function removeImageBackground(source: string): Promise<Buffer> {
  const input = await loadSourceBuffer(source);
  await mkdir(BG_TEMP_ROOT, { recursive: true });
  const id = randomUUID();
  const inputPath = join(BG_TEMP_ROOT, `${id}.in`);
  const outputPath = join(BG_TEMP_ROOT, `${id}.png`);
  try {
    await writeFile(inputPath, input);
    // 独立子进程跑抠图推理，崩溃/超时不影响主服务。给足内存与超时。
    await execFileAsync(process.execPath, [WORKER_PATH, inputPath, outputPath], {
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    if (!existsSync(outputPath)) throw new Error("抠图子进程未产出结果。");
    return await readFile(outputPath);
  } finally {
    await rm(inputPath, { force: true }).catch(() => undefined);
    await rm(outputPath, { force: true }).catch(() => undefined);
  }
}
