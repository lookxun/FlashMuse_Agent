// 上传秒回统一入口：客户端先按内容哈希（SHA-256，与服务端 createHash("sha256") 一致）预检，
// 命中"以前上传过的同一文件"直接复用旧地址，免去把整包再传一遍。对话流·工作流·资产库统一走它。

/** 计算文件原始字节的 SHA-256 十六进制串（与服务端一致）。非安全上下文/失败时返回 undefined，调用方自动跳过秒回。 */
export async function computeFileContentHashHex(file: File): Promise<string | undefined> {
  try {
    if (!globalThis.crypto?.subtle) return undefined;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

/** 按内容哈希向上传接口预检是否已存在同一文件；命中返回旧地址+权威名，否则 undefined。失败静默降级为正常上传。 */
export async function precheckUploadedFileDedup(uploadUrl: string, contentHash: string, token?: string): Promise<{ url: string; name?: string } | undefined> {
  try {
    const response = await fetch(`${uploadUrl}?contentHash=${encodeURIComponent(contentHash)}`, {
      method: "GET",
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { url?: string; name?: string };
    return data?.url ? { url: data.url, name: data.name } : undefined;
  } catch {
    return undefined;
  }
}
