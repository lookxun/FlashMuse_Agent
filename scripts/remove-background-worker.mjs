// 本地抠图子进程 worker。
// 背景：onnxruntime-node 原生推理若在 Next 主进程内跑，会与其它原生库（sharp/libvips 等）冲突并整进程崩溃。
// 因此把抠图放到独立 node 子进程里跑，崩溃只影响该子进程、不影响主服务。
// 用法：node scripts/remove-background-worker.mjs <inputPath> <outputPath>
import { readFile, writeFile } from "node:fs/promises";
import { removeBackground } from "@imgly/background-removal-node";

function detectImageMime(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "image/png";
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error("usage: remove-background-worker.mjs <inputPath> <outputPath>");
    process.exit(2);
  }
  const input = await readFile(inputPath);
  const blob = new Blob([new Uint8Array(input)], { type: detectImageMime(input) });
  const out = await removeBackground(blob, { output: { format: "image/png" } });
  await writeFile(outputPath, Buffer.from(await out.arrayBuffer()));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
