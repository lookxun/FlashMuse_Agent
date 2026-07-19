import { execFile } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import type { MediaUploadMetadata } from "@/lib/media-upload-validation";

const execFileAsync = promisify(execFile);

/** Uses the bundled ffmpeg binary so upload rules are enforced from the actual file, not browser-provided metadata. */
export async function probeUploadedMedia(buffer: Buffer, extension: string, kind: "video" | "audio"): Promise<MediaUploadMetadata | undefined> {
  const { default: ffmpegPath } = await import("ffmpeg-static");
  if (!ffmpegPath) return undefined;
  const path = join(tmpdir(), `flashmuse-upload-${randomUUID()}.${extension || "bin"}`);
  try {
    await writeFile(path, buffer);
    const output = await execFileAsync(ffmpegPath, ["-hide_banner", "-i", path], { maxBuffer: 2 * 1024 * 1024 })
      .then((result) => `${result.stdout}${result.stderr}`)
      .catch((error: { stdout?: string; stderr?: string }) => `${error.stdout ?? ""}${error.stderr ?? ""}`);
    const duration = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const durationSeconds = duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : undefined;
    if (kind === "audio") return { durationSeconds };
    const videoLine = output.split("\n").find((line) => /Stream #.*Video:/.test(line));
    const size = videoLine?.match(/,\s*(\d{2,5})x(\d{2,5})/);
    const fps = videoLine?.match(/,\s*([\d.]+)\s*fps/);
    const videoCodec = videoLine?.match(/Video:\s*([^,\s]+)/)?.[1]?.toLowerCase();
    const audioLine = output.split("\n").find((line) => /Stream #.*Audio:/.test(line));
    const audioCodec = audioLine?.match(/Audio:\s*([^,\s]+)/)?.[1]?.toLowerCase();
    return { durationSeconds, width: size ? Number(size[1]) : undefined, height: size ? Number(size[2]) : undefined, fps: fps ? Number(fps[1]) : undefined, videoCodec, audioCodec };
  } finally {
    await rm(path, { force: true }).catch(() => undefined);
  }
}
