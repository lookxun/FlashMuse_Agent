import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OUTPUT_PATH = join(process.cwd(), "image-size-test-results.md");
const execFileAsync = promisify(execFile);

const models = [
  {
    label: "Seedream 4.5",
    id: "bytedance-seed/seedream-4.5",
    resolutions: ["2K", "4K"],
    modalities: ["image"],
    sizeMode: "pixels",
    pixelMap: {
      "2K": { "16:9": [2560, 1440], "4:3": [2304, 1728], "1:1": [2048, 2048], "3:4": [1728, 2304], "9:16": [1440, 2560] },
      "4K": { "16:9": [5120, 2880], "4:3": [4608, 3456], "1:1": [4096, 4096], "3:4": [3456, 4608], "9:16": [2880, 5120] },
    },
  },
  { label: "Gemini 3.1 Flash Image Preview", id: "google/gemini-3.1-flash-image-preview", resolutions: ["1K", "2K", "4K"], modalities: ["image", "text"], sizeMode: "preset" },
  { label: "Gemini 3 Pro Image Preview", id: "google/gemini-3-pro-image-preview", resolutions: ["1K", "2K", "4K"], modalities: ["image", "text"], sizeMode: "preset" },
  { label: "GPT-5 Image", id: "openai/gpt-5-image", resolutions: ["1K", "2K", "4K"], modalities: ["image", "text"], sizeMode: "preset" },
  { label: "GPT-5.4 Image 2", id: "openai/gpt-5.4-image-2", resolutions: ["1K", "2K"], modalities: ["image", "text"], sizeMode: "preset" },
];

const ratios = ["16:9", "4:3", "1:1", "3:4", "9:16"];
const baseSides = { "1K": 1024, "2K": 2048, "4K": 4096 };
const ratioMap = { "16:9": [16, 9], "4:3": [4, 3], "1:1": [1, 1], "3:4": [3, 4], "9:16": [9, 16] };

function readEnvValue(name) {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const line = env.split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  return line?.split("=").slice(1).join("=").trim();
}

function expectedDimensions(model, resolution, ratio) {
  if (model.pixelMap?.[resolution]?.[ratio]) return model.pixelMap[resolution][ratio];
  const [rw, rh] = ratioMap[ratio];
  const base = baseSides[resolution];
  return rw >= rh ? [base, Math.round((base * rh) / rw)] : [Math.round((base * rw) / rh), base];
}

function requestSize(model, resolution, ratio) {
  if (model.sizeMode === "preset") return resolution;
  return expectedDimensions(model, resolution, ratio).join("x");
}

function getImageUrls(data) {
  return [
    ...(data.choices?.[0]?.message?.images?.map((image) => image.image_url?.url ?? image.url) ?? []),
    ...(data.images?.map((image) => image.image_url?.url ?? image.url) ?? []),
    ...(data.data?.map((item) => item.url) ?? []),
  ].filter(Boolean);
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
    offset += 2 + length;
  }
  return undefined;
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return undefined;
  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X") return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  if (format === "VP8 ") return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  if (format === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return undefined;
}

async function dimensionsFromUrl(url, headers) {
  let buffer;
  if (url.startsWith("data:")) {
    buffer = Buffer.from(url.split(",")[1] ?? "", "base64");
  } else {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) throw new Error(`download ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  }
  return pngDimensions(buffer) ?? jpegDimensions(buffer) ?? webpDimensions(buffer);
}

async function generateOne(apiKey, model, resolution, ratio) {
  const imageConfig = { aspect_ratio: ratio, size: requestSize(model, resolution, ratio) };
  const body = {
    model: model.id,
    messages: [{ role: "user", content: "A simple red apple centered on a plain light gray background, no text, clean product photo." }],
    modalities: model.modalities,
    image_config: imageConfig,
  };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Yinzao",
  };
  const response = await fetch(OPENROUTER_URL, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await response.text();
  let data;
  if (!response.ok) {
    const curlHeaders = Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
    try {
      const { stdout } = await execFileAsync(process.platform === "win32" ? "curl.exe" : "curl", ["-sS", "-L", "-X", "POST", ...curlHeaders, "--data-binary", JSON.stringify(body), OPENROUTER_URL], { maxBuffer: 50 * 1024 * 1024 });
      data = JSON.parse(stdout);
      if (data.error) throw new Error(JSON.stringify(data));
    } catch (curlError) {
      const message = curlError instanceof Error ? curlError.message : text;
      throw new Error(message.slice(0, 500));
    }
  } else {
    data = JSON.parse(text);
  }
  const imageUrl = getImageUrls(data)[0];
  if (!imageUrl) throw new Error("no image returned");
  const actual = await dimensionsFromUrl(imageUrl, headers);
  if (!actual) throw new Error("cannot read dimensions");
  return { requested: imageConfig, actual };
}

function markdownRow(cells) {
  return `| ${cells.map((cell) => String(cell).replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`;
}

const apiKey = readEnvValue("OPENROUTER_API_KEY");
if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY in .env.local");

const rows = [];
rows.push("# 图片模型尺寸实测结果");
rows.push("");
rows.push(`测试时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`);
rows.push("");
rows.push(markdownRow(["模型", "选择档位", "选择比例", "申请参数", "申请尺寸", "实际尺寸", "结果"]));
rows.push(markdownRow(["---", "---", "---", "---", "---", "---", "---"]));

for (const model of models) {
  for (const resolution of model.resolutions) {
    for (const ratio of ratios) {
      const expected = expectedDimensions(model, resolution, ratio);
      process.stdout.write(`Testing ${model.label} ${resolution} ${ratio} ... `);
      try {
        const result = await generateOne(apiKey, model, resolution, ratio);
        const actualText = `${result.actual[0]}×${result.actual[1]}`;
        const expectedText = `${expected[0]}×${expected[1]}`;
        const ok = actualText === expectedText ? "一致" : "不一致";
        rows.push(markdownRow([model.label, resolution, ratio, `modalities=${model.modalities.join("+")}; size=${result.requested.size}; aspect_ratio=${result.requested.aspect_ratio}`, expectedText, actualText, ok]));
        console.log(actualText, ok);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rows.push(markdownRow([model.label, resolution, ratio, `modalities=${model.modalities.join("+")}; size=${requestSize(model, resolution, ratio)}; aspect_ratio=${ratio}`, `${expected[0]}×${expected[1]}`, "生成失败", message.slice(0, 180)]));
        console.log("FAILED", message.slice(0, 120));
      }
      writeFileSync(OUTPUT_PATH, `${rows.join("\n")}\n`, "utf8");
    }
  }
}

console.log(`Wrote ${OUTPUT_PATH}`);
