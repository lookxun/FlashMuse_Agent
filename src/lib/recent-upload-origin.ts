// 刚上传的媒体第一时间只在腾讯主源，阿里镜像可能还没同步完。
// 本会话把这些 /generated 路径记下来，读取时一律走腾讯主源，保证"上传成功即可播放/看到封面"；
// 刷新页面后集合清空、文件也早已同步到阿里，自动回到正常（阿里镜像）读取。
// 对话流 / 工作流 / 资产库统一走它。

const recentUploadPaths = new Set<string>();

function toGeneratedPath(url: string | undefined) {
  if (!url) return undefined;
  const clean = url.split("?")[0].split("#")[0];
  const index = clean.indexOf("/generated/");
  return index >= 0 ? clean.slice(index) : undefined;
}

export function markRecentUploadOrigin(...urls: Array<string | undefined>) {
  urls.forEach((url) => {
    const path = toGeneratedPath(url);
    if (path) recentUploadPaths.add(path);
  });
}

export function isRecentUploadOrigin(url: string | undefined) {
  const path = toGeneratedPath(url);
  return path ? recentUploadPaths.has(path) : false;
}
