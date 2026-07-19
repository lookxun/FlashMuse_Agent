export const IMAGE_UPLOAD_ACCEPT = ".jpg,.jpeg,.png,.webp";
export const IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
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
