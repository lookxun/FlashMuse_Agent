// ⭐ 图片上传格式/大小校验 —— 全平台唯一权威（对话流 · 工作流 · 资产库 · Agent 共用）。
//
// ⛔ 2026-07-29 收敛：以前这里和 upload-rules.ts 各有一份图片格式白名单，两套答案不一样 ——
//   · 这里（对话流/资产库走）：jpg / jpeg / png / webp
//   · upload-rules 的 bytePlusImageFormats（工作流拖拽走）：还多了 bmp / tiff / tif / gif / heic / heif
// 后者是照 BytePlus 官网抄的，**平台确实支持**（官方原文：Image formats: .jpeg, .png, .webp, .bmp,
// .tiff, .gif；Seedance 1.5 Pro / 2.0 系列还支持 .heic / .heif）。但我们**故意只放这四种**：
//   ① 资产是跨模型复用的 —— 同一张图今天喂 Seedance、明天 @ 给 GPT/Gemini（后者只吃 jpg/png/webp），
//      白名单必须取所有模型的**交集**，否则会在"换模型再用"时才炸。
//   ② tiff / heic / heif **浏览器 <img> 渲染不了** —— 传上去画布节点、缩略图、资产库、@引用全是破图，
//      是负收益。gif（动图只取一帧）、bmp（体积大）作为参考图也没有实际价值。
//   ③ 文件选择框的 accept 一直只给这四种，那条更宽的白名单只有"拖拽进工作流画布"能走到 = 隐藏的不一致。
// ⭐ 以后要放开 heic（iPhone 原图）必须先做"上传时转码成 jpg"，不要只改白名单。
export const IMAGE_UPLOAD_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;
export const IMAGE_UPLOAD_ACCEPT = IMAGE_UPLOAD_FORMATS.map((format) => `.${format}`).join(",");
export const IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * ⭐⭐ 上传图片的「体积过大就重新压一遍」阈值与质量（2026-07-29 加，修红字 A1）。
 *
 * 背景（正式服实测，别再猜）：用户传了一张 3072×4096 / **4.24MB** 的手机原图当参考图，
 * OpenAI 直接 400 `Invalid image file or mode for image 1` → 整单失败，用户 2 分钟里连点 6 次全灭。
 * 而全站参考图 **>3MB 的请求只有那 6 单、6/6 全失败**，成功过的最大只有 2.71MB。
 *
 * ⛔ 根因不是"图坏了"（那张图是标准 baseline / 8bit / 3 分量 YCbCr / 4:2:0 的正常 JPEG），而是
 * **我们该压没压**：`saveTemporaryUploadedImageBuffer` 里 `jpegNeedsReencode()` 只判**格式兼容性**
 * （分量数 + 采样因子），**完全不看体积** → 格式本来就兼容的 JPEG 走"原样写盘"分支，
 * 4.24MB 原图一个字节没压就存了下来，然后原样发给模型。
 *
 * ⭐ 实测同一张图用 sharp/ffmpeg 以约 90% 质量重压：**4444000 → 约 985KB**（尺寸一点没变）。
 * 所以**不需要动像素尺寸**，只要按质量压一遍就能落到历史成功区间内。
 *
 * ⚠️ 质量固定 90：这是"参考图保真"和"能被模型吃下"的折中，**与后台那套"生成图片压缩"设置
 * （high95 / standard80 / low60）是两件事，别混用** —— 那套管的是**我们生成出来的图**，
 * 这里管的是**用户上传进来的参考图**。
 */
export const IMAGE_UPLOAD_RECOMPRESS_OVER_BYTES = 2 * 1024 * 1024;
export const IMAGE_UPLOAD_RECOMPRESS_QUALITY = 90;

const allowedExtensions = new Set<string>(IMAGE_UPLOAD_FORMATS);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageUploadFile(file: Pick<File, "name" | "type" | "size">) {
  const fileName = file.name.split(/[\\/]/).pop() ?? "";
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = file.type.split(";", 1)[0]?.toLowerCase() ?? "";

  if (!allowedExtensions.has(extension) || (mimeType && !allowedMimeTypes.has(mimeType))) {
    return "仅支持 JPG、JPEG、PNG、WebP 格式的图片";
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) return "上传图片不能超过10MB";
  return undefined;
}
