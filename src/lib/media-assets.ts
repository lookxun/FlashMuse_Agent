import fs from "node:fs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SavedMediaJob = {
  userId?: string;
  status?: string;
  remoteUrl?: string;
  localUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
};

const MAX_INDEXED_MEDIA_URL_LENGTH = 4_000;
const OWN_GENERATED_HOST_RE = /^https?:\/\/(101\.47\.19\.109|101\.37\.129\.164|main\.venusface\.com|api\.venusface\.com|ali\.venusface\.com|static\.venusface\.com)(\/generated\/.*)$/i;

export function normalizeMediaAssetUrl(value: string) {
  const trimmed = value.trim();
  const ownGenerated = trimmed.match(OWN_GENERATED_HOST_RE);
  return (ownGenerated ? ownGenerated[2] : trimmed).split("?")[0].split("#")[0];
}

export function isPersistableMediaAssetUrl(value: string) {
  const url = value.trim();
  if (!url || url.startsWith("data:")) return false;
  return normalizeMediaAssetUrl(url).length <= MAX_INDEXED_MEDIA_URL_LENGTH;
}

function normalizeMediaAssetUrlForMatch(value: string | undefined) {
  return typeof value === "string" ? normalizeMediaAssetUrl(value).replace(/^https?:\/\/[^/]+/i, "") : "";
}

function readMediaSaveJobs(): SavedMediaJob[] {
  const file = ".runtime/media-save-jobs.json";
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed as SavedMediaJob[] : parsed && typeof parsed === "object" && Array.isArray((parsed as { jobs?: unknown }).jobs) ? (parsed as { jobs: SavedMediaJob[] }).jobs : [];
  } catch {
    return [];
  }
}

function findSavedJobsByLocalUrl(userId: string, localUrl: string) {
  const localKey = normalizeMediaAssetUrlForMatch(localUrl);
  if (!localKey) return [];
  return readMediaSaveJobs().filter((job) => {
    if (job.status !== "saved" || !job.remoteUrl || !job.localUrl) return false;
    if (job.userId && job.userId !== userId) return false;
    return normalizeMediaAssetUrlForMatch(job.localUrl) === localKey;
  });
}

function findSavedJobByRemoteUrl(userId: string, remoteUrl: string) {
  const remoteKey = normalizeMediaAssetUrl(remoteUrl);
  if (!remoteKey) return undefined;
  return readMediaSaveJobs().find((job) => {
    if (job.status !== "saved" || !job.remoteUrl || !job.localUrl) return false;
    if (job.userId && job.userId !== userId) return false;
    return job.remoteUrl === remoteUrl || normalizeMediaAssetUrl(job.remoteUrl) === remoteKey;
  });
}

export function resolvePersistableMediaAssetUrl(userId: string, url: string, options: { posterUrl?: string; thumbnailUrl?: string } = {}) {
  const ownGenerated = url.trim().match(OWN_GENERATED_HOST_RE);
  const inputUrl = ownGenerated ? ownGenerated[2] : url;
  const isRemote = /^https?:\/\//i.test(inputUrl);
  const savedJob = isRemote ? findSavedJobByRemoteUrl(userId, inputUrl) : undefined;
  if (isRemote && !savedJob?.localUrl) return undefined;

  const resolvedUrl = savedJob?.localUrl ?? inputUrl;
  if (!isPersistableMediaAssetUrl(resolvedUrl)) return undefined;

  return {
    url: resolvedUrl,
    normalizedUrl: normalizeMediaAssetUrl(resolvedUrl),
    originalUrl: savedJob?.remoteUrl,
    posterUrl: savedJob?.posterUrl ?? options.posterUrl,
    thumbnailUrl: savedJob?.thumbnailUrl ?? options.thumbnailUrl,
  };
}

function mergeMediaAssetPatch(keeper: Record<string, any>, duplicate: Record<string, any>) {
  return {
    creditLedgerId: keeper.creditLedgerId || duplicate.creditLedgerId,
    costSource: keeper.costSource || duplicate.costSource,
    chargedUsd: keeper.chargedUsd || duplicate.chargedUsd || 0,
    chargedCny: keeper.chargedCny || duplicate.chargedCny || 0,
    chargedCredits: keeper.chargedCredits || duplicate.chargedCredits || 0,
    promptTokens: keeper.promptTokens || duplicate.promptTokens || 0,
    completionTokens: keeper.completionTokens || duplicate.completionTokens || 0,
    totalTokens: keeper.totalTokens || duplicate.totalTokens || 0,
    costShareCount: keeper.costShareCount || duplicate.costShareCount,
    costShareIndex: keeper.costShareIndex || duplicate.costShareIndex,
    requestId: keeper.requestId || duplicate.requestId,
    model: keeper.model || duplicate.model,
    modelProvider: keeper.modelProvider || duplicate.modelProvider,
    ratio: keeper.ratio || duplicate.ratio,
    resolution: keeper.resolution || duplicate.resolution,
    imageSize: keeper.imageSize || duplicate.imageSize,
    videoDuration: keeper.videoDuration || duplicate.videoDuration,
    generationSettings: keeper.generationSettings || duplicate.generationSettings,
    previewMeta: keeper.previewMeta || duplicate.previewMeta,
    sourcePrompt: keeper.sourcePrompt || duplicate.sourcePrompt,
    promptSource: keeper.promptSource || duplicate.promptSource,
    reversePrompt: keeper.reversePrompt || duplicate.reversePrompt,
    conversationId: keeper.conversationId || duplicate.conversationId,
    messageId: keeper.messageId || duplicate.messageId,
    workflowId: keeper.workflowId || duplicate.workflowId,
    workflowNodeId: keeper.workflowNodeId || duplicate.workflowNodeId,
    workspaceKind: keeper.workspaceKind || duplicate.workspaceKind,
    workspaceId: keeper.workspaceId || duplicate.workspaceId,
    firstSeenAt: keeper.firstSeenAt && duplicate.firstSeenAt && keeper.firstSeenAt < duplicate.firstSeenAt ? keeper.firstSeenAt : duplicate.firstSeenAt || keeper.firstSeenAt,
  } satisfies Prisma.MediaAssetUpdateInput;
}

async function findMediaByUrlCandidates(userId: string, url: string) {
  const normalized = normalizeMediaAssetUrl(url);
  const pathOnly = normalizeMediaAssetUrlForMatch(url);
  const candidates = Array.from(new Set([normalized, pathOnly].filter(Boolean)));
  if (candidates.length === 0) return undefined;
  return prisma.mediaAsset.findFirst({ where: { userId, OR: [{ normalizedUrl: { in: candidates } }, { url: { in: candidates } }] } });
}

export async function canonicalizeSavedMediaJobForUser(userId: string, job: SavedMediaJob) {
  if (job.status !== "saved" || !job.remoteUrl || !job.localUrl) return;
  if (job.userId && job.userId !== userId) return;
  await canonicalizeSavedMediaUrl(userId, job.localUrl, { remoteUrl: job.remoteUrl, thumbnailUrl: job.thumbnailUrl, posterUrl: job.posterUrl });
}

export async function canonicalizeSavedMediaUrl(userId: string, localUrl: string, options: { remoteUrl?: string; thumbnailUrl?: string; posterUrl?: string } = {}) {
  const localNormalized = normalizeMediaAssetUrl(localUrl);
  if (!localNormalized) return;
  const jobs = options.remoteUrl ? [{ ...options, status: "saved", localUrl }] : findSavedJobsByLocalUrl(userId, localUrl);
  if (jobs.length === 0) return;

  for (const job of jobs) {
    if (!job.remoteUrl) continue;
    const localMedia = await prisma.mediaAsset.findUnique({ where: { userId_normalizedUrl: { userId, normalizedUrl: localNormalized } } });
    const remoteMedia = await findMediaByUrlCandidates(userId, job.remoteUrl);
    if (!remoteMedia || remoteMedia.archivedAt) continue;

    if (!localMedia || localMedia.id === remoteMedia.id) {
      await prisma.mediaAsset.update({
        where: { id: remoteMedia.id },
        data: {
          url: localUrl,
          normalizedUrl: localNormalized,
          originalUrl: remoteMedia.originalUrl || job.remoteUrl,
          thumbnailUrl: job.thumbnailUrl || remoteMedia.thumbnailUrl,
          posterUrl: job.posterUrl || remoteMedia.posterUrl,
        },
      });
      continue;
    }

    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: localMedia.id }, data: { ...mergeMediaAssetPatch(localMedia, remoteMedia), originalUrl: localMedia.originalUrl || job.remoteUrl, thumbnailUrl: localMedia.thumbnailUrl || job.thumbnailUrl || undefined, posterUrl: localMedia.posterUrl || job.posterUrl || undefined } }),
      prisma.userAssetState.updateMany({ where: { mediaAssetId: remoteMedia.id }, data: { hiddenAt: new Date(), hiddenReason: "duplicate_remote_url" } }),
      prisma.mediaAsset.update({ where: { id: remoteMedia.id }, data: { archivedAt: new Date(), archiveReason: "duplicate_remote_url", duplicateOfMediaAssetId: localMedia.id } }),
    ]);
  }
}
