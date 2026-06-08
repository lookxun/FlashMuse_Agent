import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const GENERATED_ROOT = join(process.cwd(), "public", "generated");

type AliSyncResult = {
  enabled: boolean;
  ok: boolean;
  syncedUrls: string[];
  error?: string;
};

function getAliSyncConfig() {
  return {
    enabled: process.env.ALI_SYNC_GENERATED_ENABLED === "true",
    host: process.env.ALI_SYNC_HOST ?? "",
    user: process.env.ALI_SYNC_USER || "root",
    port: process.env.ALI_SYNC_PORT || "22",
    keyPath: process.env.ALI_SYNC_SSH_KEY || "/root/.ssh/flashmuse_to_ali_ed25519",
    destinationRoot: process.env.ALI_SYNC_DEST_ROOT || "/var/www/flashmuse-static/generated",
  };
}

function toGeneratedRelativePath(publicUrl: string) {
  const cleanUrl = publicUrl.split("?")[0].split("#")[0];
  if (!cleanUrl.startsWith("/generated/")) return undefined;
  const relativePath = cleanUrl.replace(/^\/generated\//, "").replace(/\\/g, "/");
  if (!relativePath || relativePath.startsWith("../") || relativePath.includes("/../")) return undefined;
  return relativePath;
}

export async function syncGeneratedFilesToAli(publicUrls: Array<string | undefined>) {
  const config = getAliSyncConfig();
  const uniqueRelativePaths = Array.from(new Set(
    publicUrls
      .map((url) => url ? toGeneratedRelativePath(url) : undefined)
      .filter((path): path is string => Boolean(path)),
  ));
  const existingRelativePaths = uniqueRelativePaths.filter((relativePath) => existsSync(join(GENERATED_ROOT, relativePath)));

  if (!config.enabled || !config.host || existingRelativePaths.length === 0) {
    return { enabled: config.enabled, ok: !config.enabled || existingRelativePaths.length === 0, syncedUrls: [] } satisfies AliSyncResult;
  }

  const sshArgs = [
    "-i", config.keyPath,
    "-p", config.port,
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=10",
  ];
  const sshCommand = ["ssh", ...sshArgs].join(" ");
  const target = `${config.user}@${config.host}`;

  try {
    await execFileAsync("ssh", [...sshArgs, target, "mkdir", "-p", config.destinationRoot], { timeout: 30_000, maxBuffer: 1024 * 1024 });
    await execFileAsync("rsync", ["-azR", "-e", sshCommand, ...existingRelativePaths, `${target}:${config.destinationRoot}/`], { cwd: GENERATED_ROOT, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
    return { enabled: true, ok: true, syncedUrls: existingRelativePaths.map((relativePath) => `/generated/${relativePath}`) } satisfies AliSyncResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { enabled: true, ok: false, syncedUrls: [], error: message.slice(0, 300) } satisfies AliSyncResult;
  }
}
