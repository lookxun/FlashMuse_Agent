/**
 * 深度动作捕捉（RunningHub DepthCrafter）的**输出规格唯一权威**。
 *
 * 🗣️ 用户 2026-09-12 拍板：成品**不再跟源视频同尺寸** —— 统一 480p 档，
 *    只支持 16:9 / 4:3 / 1:1（竖版 9:16 / 3:4），其它比例贴最近的一档。
 * ⛔ 别退回「对齐源像素」那套（`snapDimensionsToDepthCrafter`）：上游那台 GPU 有硬上限，
 *    1280×704 × 123 帧必挂（`CUDA error: invalid configuration argument`），896×512 立刻成功。
 *
 * ⭐ 真机实测（本地直打 `www.runninghub.ai`，workflow 1868729320020787201，30fps）：
 *   | 输出        | 秒 / 帧        | 结果 |
 *   |-------------|----------------|------|
 *   | 896×512     | 25 / 750 ×2    | ✅   |
 *   | 896×512     | 30 / 900       | ❌ VRAM OOM |
 *   | 1216×512    | 15 / 450       | ✅   |
 *   | 1216×512    | 20 / 600       | ❌ VRAM OOM |
 *   → 所以 21:9（1216×512）整档砍掉，上限定在 **25 秒**。
 *
 * ⭐⭐ 真正决定会不会 OOM 的是**帧数**（= 秒 × fps），不是秒数。
 *    所以 `DEPTH_MAX_FPS` 必须和 `MAX_DEPTH_SECONDS` 一起看：60fps 的源视频跑 25 秒
 *    就是 1500 帧，远超实测通过的 750 帧 → 必挂。
 */

/** 上游那条工作流真正会处理的秒数上限（`frame_load_cap = min(这个数, 源时长) × fps`）。
 *  ⛔ 扣费秒数必须按同一把尺截断（`getEffectiveVideoDurationSeconds` 已对齐），否则就是多收。 */
export const MAX_DEPTH_SECONDS = 25;

/** 送给上游的帧率上限。⛔ 别放大：帧数 = 秒 × fps，而 750 帧才是实测通过的天花板。
 *  ⚠️ 降 fps 不改变成品时长（VideoCombine 用同一个 fps 合片），所以不影响按秒收费。 */
export const DEPTH_MAX_FPS = 30;

/** 实测通过的帧数天花板（= 25 × 30）。仅用于说明上面两个常量的关系，⛔ 别拿它去截断内容
 *  （截了内容却按秒收钱就是多收；把 fps 压到 30 之后这个数天然不会被超过）。 */
export const MAX_DEPTH_FRAMES = MAX_DEPTH_SECONDS * DEPTH_MAX_FPS;

/** 界面/账本上记的分辨率档位（短边 512，落在 480p 这一档）。 */
export const DEPTH_OUTPUT_RESOLUTION = "480p";

/** 唯一的输出尺寸表：短边 512、长边对齐 64。⛔ 加档位前先在 RunningHub 上真跑 25 秒。 */
export const DEPTH_RATIO_PRESETS = [
  { label: "16:9", width: 896, height: 512 },
  { label: "4:3", width: 704, height: 512 },
  { label: "1:1", width: 512, height: 512 },
  { label: "3:4", width: 512, height: 704 },
  { label: "9:16", width: 512, height: 896 },
] as const;

function pickClosestPreset(width?: number, height?: number) {
  const srcW = Number(width) || 0;
  const srcH = Number(height) || 0;
  const ratio = srcW > 0 && srcH > 0 ? srcW / srcH : 16 / 9;
  let best: (typeof DEPTH_RATIO_PRESETS)[number] = DEPTH_RATIO_PRESETS[0];
  let bestErr = Number.POSITIVE_INFINITY;
  for (const preset of DEPTH_RATIO_PRESETS) {
    const err = Math.abs(preset.width / preset.height - ratio);
    if (err < bestErr - 1e-9) {
      best = preset;
      bestErr = err;
    }
  }
  return best;
}

/**
 * 源视频尺寸 → 我们真正要送给上游的输出尺寸。
 * ⭐ 五个档位各自都是不动点（把 896×512 再喂进来还是 896×512），所以"拿上次的输出当输入"也安全
 *    —— 重试路径里客户端传来的 `videoDimensions` 已经是输出档，这一点必须成立。
 */
export function fitVideoDepthOutputSize(width?: number, height?: number) {
  const preset = pickClosestPreset(width, height);
  return { width: preset.width, height: preset.height };
}

export function closestVideoDepthRatioLabel(width?: number, height?: number) {
  return pickClosestPreset(width, height).label;
}

/** 送给上游的帧率（源视频 fps 封顶到 `DEPTH_MAX_FPS`，拿不到就用它）。 */
export function resolveVideoDepthFps(fps?: number) {
  const safe = typeof fps === "number" && Number.isFinite(fps) && fps > 0 ? fps : DEPTH_MAX_FPS;
  return Math.min(DEPTH_MAX_FPS, safe);
}
