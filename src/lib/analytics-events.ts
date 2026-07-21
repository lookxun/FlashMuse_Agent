import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * 运营概览埋点。使用原始 SQL 读写 GenerationEvent / UploadEvent 两张分析表，
 * 因为本地 Windows 常锁定 Prisma 查询引擎导致 `prisma generate` 失败，
 * 所以不依赖重新生成的 Prisma 客户端类型（与 GptImagePromptOptimizationCase 相同思路）。
 * 所有写入均为 fire-and-forget，绝不因埋点失败影响生成/上传主流程。
 */

export type GenerationEventSource = "conversation" | "workflow" | "asset" | "agent";

function mapCreditSourceToEventSource(creditSource: string | undefined): GenerationEventSource {
  if (!creditSource) return "conversation";
  if (creditSource.startsWith("workflow_")) return "workflow";
  if (creditSource === "character_image_generation" || creditSource === "scene_image_generation" || creditSource === "prop_image_generation" || creditSource === "shot_image_generation") return "asset";
  if (creditSource === "agent_image_generation" || creditSource === "agent_video_generation") return "agent";
  return "conversation";
}

function isModerationReason(reason: string | undefined) {
  if (!reason) return false;
  return /安全|敏感|隐私|审核|未成年|亲密|真人|privacy|sensitive|moderation|policy/i.test(reason);
}

export type RecordGenerationEventInput = {
  userId?: string;
  requestId?: string;
  kind: "image" | "video";
  creditSource?: string;
  model?: string;
  provider?: string;
  status: "success" | "failed";
  failureReason?: string;
  failureCode?: string;
  durationMs?: number;
  referenceImageCount?: number;
  referenceVideoCount?: number;
  referenceAudioCount?: number;
};

export async function recordGenerationEvent(input: RecordGenerationEventInput) {
  try {
    const id = randomUUID();
    const source = mapCreditSourceToEventSource(input.creditSource);
    const moderation = input.status === "failed" && isModerationReason(input.failureReason);
    const requestId = input.requestId ?? null;
    const durationMs = Number.isFinite(input.durationMs) ? Math.max(0, Math.floor(input.durationMs as number)) : null;
    const refImage = Math.max(0, Math.floor(input.referenceImageCount ?? 0));
    const refVideo = Math.max(0, Math.floor(input.referenceVideoCount ?? 0));
    const refAudio = Math.max(0, Math.floor(input.referenceAudioCount ?? 0));

    // requestId + kind 唯一：视频反复轮询、或重复请求只落一条；成功可覆盖先前失败。
    await prisma.$executeRaw`
      INSERT INTO "GenerationEvent" ("id", "userId", "requestId", "kind", "source", "model", "provider", "status", "failureReason", "failureCode", "moderation", "durationMs", "referenceImageCount", "referenceVideoCount", "referenceAudioCount", "createdAt")
      VALUES (${id}, ${input.userId ?? null}, ${requestId}, ${input.kind}, ${source}, ${input.model ?? null}, ${input.provider ?? null}, ${input.status}, ${input.failureReason ?? null}, ${input.failureCode ?? null}, ${moderation}, ${durationMs}, ${refImage}, ${refVideo}, ${refAudio}, NOW())
      ON CONFLICT ("requestId", "kind") DO UPDATE SET
        "status" = CASE WHEN "GenerationEvent"."status" = 'success' THEN "GenerationEvent"."status" ELSE EXCLUDED."status" END,
        "failureReason" = CASE WHEN EXCLUDED."status" = 'success' THEN NULL ELSE EXCLUDED."failureReason" END,
        "failureCode" = CASE WHEN EXCLUDED."status" = 'success' THEN NULL ELSE EXCLUDED."failureCode" END,
        "moderation" = CASE WHEN EXCLUDED."status" = 'success' THEN false ELSE EXCLUDED."moderation" END,
        "durationMs" = COALESCE(EXCLUDED."durationMs", "GenerationEvent"."durationMs"),
        "model" = COALESCE(EXCLUDED."model", "GenerationEvent"."model")
    `;
  } catch (error) {
    console.warn("[analytics] recordGenerationEvent failed", { requestId: input.requestId, kind: input.kind, error: error instanceof Error ? error.message : String(error) });
  }
}

export type RecordUploadEventInput = {
  userId?: string;
  kind?: string;
  status: "success" | "failed";
  reason?: string;
  bytes?: number;
};

export async function recordUploadEvent(input: RecordUploadEventInput) {
  try {
    const id = randomUUID();
    const bytes = Number.isFinite(input.bytes) ? Math.max(0, Math.floor(input.bytes as number)) : null;
    await prisma.$executeRaw`
      INSERT INTO "UploadEvent" ("id", "userId", "kind", "status", "reason", "bytes", "createdAt")
      VALUES (${id}, ${input.userId ?? null}, ${input.kind ?? "image"}, ${input.status}, ${input.reason ?? null}, ${bytes}, NOW())
    `;
  } catch (error) {
    console.warn("[analytics] recordUploadEvent failed", { status: input.status, error: error instanceof Error ? error.message : String(error) });
  }
}
