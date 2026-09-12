import { getGenerationModelSelectHint, getEstimatedGenerationUsd, normalizeImageQuality, getEffectiveVideoDurationSeconds } from "@/lib/models";
import { withVideoUsdFallback } from "@/lib/video-usage-cost";
import { toUserErrorMessage } from "@/lib/error-message";
import { getSourceVideoOwnershipError } from "@/lib/video-source-asset";

let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fail += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} => ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

// ============ 1. 菜单副标题：GPT Image 2.5 必须显示真实区间「约2-4积分/张」 ============
// 真实扣费实测（1K + 默认画质 high）：16:9 $0.0286=2 积分 / 4:3 $0.0390=3 积分 / 1:1 $0.0528=4 积分。
const FLARE = "openai/gpt-image-2.5-flare";
const SUN = "openai/gpt-image-2.5-sunburst";
for (const [rate, cpc] of [[7.2, 10], [7, 10]] as const) {
  check(`hint flare @${rate}`, getGenerationModelSelectHint(FLARE, rate, cpc), "出图快·日常 · 约2-4积分/张");
  check(`hint sunburst @${rate}`, getGenerationModelSelectHint(SUN, rate, cpc), "精细·改图准 · 约2-4积分/张");
}
// 反向：别的模型一个字都不许变
check("hint gpt-5.4 unchanged", getGenerationModelSelectHint("openai/gpt-5.4-image-2", 7.2, 10), "精准·可4K·多参考图 · 约17积分/张");
check("hint recraft unchanged", getGenerationModelSelectHint("recraft/recraft-v4.1", 7.2, 10), "平面设计·高美学·短词出图 · 3积分/张");
check("hint seedream45 unchanged", getGenerationModelSelectHint("byteplus:conversation-image.seedream-4-5", 7.2, 10), "中文强·通用 · 3积分/张");

// ============ 2. 预估闸门：画质倍数（真实扣费 1K 16:9：medium 1 / high 2 / xhigh 4 / max 8 积分） ============
// ⚠️ 预估基准用「1K 最贵比例（1:1）的 high」= $0.053，所以估出来会比 16:9 那一档高 —— 闸门宁高不低。
const credits = (usd: number) => Math.max(1, Math.round(usd * 70)); // 本地/测试服 7 × 10
for (const model of [FLARE, SUN]) {
  check(`est ${model} 1K medium`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", quality: "medium", count: 1 })), 1);
  check(`est ${model} 1K high`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", quality: "high", count: 1 })), 4);
  check(`est ${model} 1K xhigh`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", quality: "xhigh", count: 1 })), 7);
  check(`est ${model} 1K max`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", quality: "max", count: 1 })), 15);
  // 不传画质 → 按默认档 high 估
  check(`est ${model} 1K no-quality`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", count: 1 })), 4);
  // 非法画质字符串 → 归一化回 high（⛔ 不许变成 0 倍/放空闸门）
  check(`est ${model} 1K junk-quality`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", quality: "free-please", count: 1 })), 4);
  // 4 张线性
  check(`est ${model} 1K max x4`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", quality: "max", count: 4 })), 61);
  // ⭐ 预估必须 ≥ 真实扣费（闸门估低了等于没拦）：1K high 真实最贵 4 积分、1K max 真实最贵约 15
  check(`est ${model} 1K high >= real 4`, credits(getEstimatedGenerationUsd({ kind: "image", modelId: model, resolution: "1K", quality: "high", count: 1 })) >= 4, true);
}
// 反向：没配倍数表的模型，画质参数不许改变预估
const g54 = (q?: string) => getEstimatedGenerationUsd({ kind: "image", modelId: "openai/gpt-5.4-image-2", resolution: "1K", quality: q, count: 1 });
check("est gpt-5.4 quality ignored", [g54(), g54("low"), g54("max")], [0.24, 0.24, 0.24]);
check("est seedream quality ignored", getEstimatedGenerationUsd({ kind: "image", modelId: "byteplus:conversation-image.seedream-4-5", resolution: "2K", quality: "low", count: 1 }), 0.04);
// 反向：normalizeImageQuality 对 5.4 不认 xhigh/max
check("normalize xhigh on 5.4", normalizeImageQuality("xhigh", "openai/gpt-5.4-image-2"), "high");
check("normalize xhigh on 2.5", normalizeImageQuality("xhigh", FLARE), "xhigh");

// ============ 3. 兜底定价：⛔ 拿不到秒数绝不许变成 0（白送） ============
const usdOf = (model: string, settings: { resolution?: string; duration?: string } | undefined) =>
  withVideoUsdFallback(undefined, { model, settings })?.usd ?? 0;
check("depth 10s", Number(usdOf("runninghub:video.depthcrafter", { duration: "10秒" }).toFixed(4)), 0.2);
check("depth no duration -> 5s floor", Number(usdOf("runninghub:video.depthcrafter", { duration: undefined }).toFixed(4)), 0.1);
check("depth empty settings -> 5s floor", Number(usdOf("runninghub:video.depthcrafter", undefined).toFixed(4)), 0.1);
check("enhance 720p 5s", Number(usdOf("mediakit:video.enhance-generative", { resolution: "720p", duration: "5秒" }).toFixed(5)), 0.02894);
check("enhance 1080p 50s", Number(usdOf("mediakit:video.enhance-generative", { resolution: "1080p", duration: "50秒" }).toFixed(5)), 0.5787);
check("enhance no duration -> 5s floor", usdOf("mediakit:video.enhance-generative", { resolution: "1080p" }) > 0, true);
check("enhance fast 4K 25s", Number(usdOf("mediakit:video.enhance-fast", { resolution: "4K", duration: "25秒" }).toFixed(5)), 0.34433);
// 反向：上游给了成本就一个字不动
check("upstream cost wins", withVideoUsdFallback({ usd: 1.23 }, { model: "runninghub:video.depthcrafter", settings: { duration: "10秒" } })?.usd, 1.23);
// 反向：别的视频模型不受影响
check("seedance untouched", withVideoUsdFallback(undefined, { model: "byteplus:video.seedance-2-5", settings: { duration: "10秒" } }), undefined);
check("effective seconds enhance passthrough", getEffectiveVideoDurationSeconds("mediakit:video.enhance-generative", "47秒"), 47);

// ============ 4. 归属校验 ============
check("own asset ok", getSourceVideoOwnershipError("/generated/users/ID_1/videos/a.mp4", "ID_1"), undefined);
check("other user rejected", getSourceVideoOwnershipError("/generated/users/ID_2/videos/a.mp4", "ID_1"), "源视频必须来自当前账号");
check("legacy shared path ok", getSourceVideoOwnershipError("/generated/videos/a.mp4", "ID_1"), undefined);
check("absolute url of other user rejected", getSourceVideoOwnershipError("https://main.venusface.com/generated/users/ID_2/videos/a.mp4", "ID_1"), "源视频必须来自当前账号");

// ============ 5. 新红字文案必须幂等（toUserErrorMessage 在链路上会跑两遍） ============
const messages = [
  "画质增强未配置或已关闭，请在后台模型开关里填写 MediaKit API Key 并打开开关。",
  "画质增强没有返回任务编号",
  "画质增强任务提交失败",
  "画质增强上传源视频失败",
  "深度动作捕捉未配置或已关闭，请在后台快捷菜单开关里填写 RunningHub API Key 并打开开关。",
  "深度动作捕捉上传源视频失败",
  "深度动作捕捉失败",
  "查询深度动作捕捉任务失败",
  "源视频必须来自当前账号",
  "Allocation on device: CUDA out of memory",
  "CUDA error: invalid configuration argument Search for `cudaErrorInvalidConfiguration'",
  "torch.AcceleratorError",
  "job amk-tool-enhance-video-generative-xxx not found",
  "short side should be in [360, 1080]",
  "API Key不存在",
];
for (const raw of messages) {
  const a = toUserErrorMessage(raw);
  const b = toUserErrorMessage(a);
  const c = toUserErrorMessage(b);
  const ok = a === b && b === c;
  if (!ok) fail += 1;
  console.log(`${ok ? "OK  " : "FAIL"} idempotent: ${raw.slice(0, 28)} -> ${a.slice(0, 46)}${ok ? "" : ` | 2nd=${b.slice(0, 46)}`}`);
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
