import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  try {
    const { execSync } = await import("node:child_process");
    const apps = JSON.parse(execSync("pm2 jlist", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    const app = apps.find((item) => item?.name === "flashmuse") || apps[0];
    const url = app?.pm2_env?.env?.DATABASE_URL || app?.pm2_env?.DATABASE_URL;
    if (url) process.env.DATABASE_URL = url;
  } catch {}
}

const prisma = new PrismaClient();
const outputDir = path.join(process.cwd(), ".runtime", "deploy-checks");

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUrl(value) {
  return typeof value === "string" ? value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "") : "";
}

function hashValue(value) {
  return createHash("sha256").update(value || "").digest("hex").slice(0, 16);
}

function isStableLocalUrl(value) {
  const url = normalizeUrl(value);
  return url.startsWith("/generated/") || url.startsWith("/upload_image/");
}

function isRemoteProviderUrl(value) {
  return /^https?:\/\//.test(value || "") && !/^https?:\/\/(main|api|static|ali)\.venusface\.com\//.test(value || "");
}

function safeDisplayUrl(value) {
  const raw = typeof value === "string" ? value : "";
  const noQuery = raw.split("?")[0].split("#")[0];
  if (!/^https?:\/\//.test(noQuery)) return noQuery.slice(0, 180);
  try {
    const parsed = new URL(noQuery);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.slice(0, 180);
  } catch {
    return noQuery.slice(0, 180);
  }
}

function activeLegacyAssets(state) {
  if (!isRecord(state) || !Array.isArray(state.assets)) return [];
  return state.assets.filter((asset) => isRecord(asset) && typeof asset.url === "string" && asset.url && asset.type !== "trash" && !asset.deletedAt);
}

function addMediaRef(refs, context, url, kind, category) {
  if (typeof url !== "string" || !url) return;
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl && !/^https?:\/\//.test(url)) return;
  refs.push({ ...context, url, normalizedUrl, kind, category, stable: isStableLocalUrl(url), remote: isRemoteProviderUrl(url) });
}

function collectMessageRefs(row) {
  const message = row.messageJson;
  if (!isRecord(message)) return [];
  const refs = [];
  const context = { source: "WorkspaceMessage", userId: row.userId, sessionId: row.sessionId, messageId: row.messageId };
  if (Array.isArray(message.imageResultSlots)) {
    for (const slot of message.imageResultSlots.filter(isRecord)) if (slot.type === "image") addMediaRef(refs, context, slot.url, "image", "imageResultSlots");
  }
  if (Array.isArray(message.images)) for (const url of message.images) addMediaRef(refs, context, url, "image", "images");
  if (Array.isArray(message.imageReferences)) for (const item of message.imageReferences.filter(isRecord)) addMediaRef(refs, context, item.url, "image", "imageReferences");
  if (typeof message.videoUrl === "string") addMediaRef(refs, context, message.videoUrl, "video", "videoUrl");
  if (Array.isArray(message.videos)) for (const url of message.videos) addMediaRef(refs, context, url, "video", "videos");
  if (Array.isArray(message.uploadedFiles)) {
    for (const file of message.uploadedFiles) {
      if (typeof file === "string") addMediaRef(refs, context, file, "file", "uploadedFiles");
      else if (isRecord(file)) addMediaRef(refs, context, file.url || file.storageName, file.mediaKind || "file", "uploadedFiles");
    }
  }
  return refs;
}

function collectStateAssetRefs(row) {
  return activeLegacyAssets(row.state).map((asset) => {
    const type = typeof asset.type === "string" ? asset.type : "asset";
    const url = asset.url;
    return {
      source: "UserWorkspaceState.assets",
      userId: row.userId,
      sessionId: "",
      messageId: String(asset.id || ""),
      url,
      normalizedUrl: normalizeUrl(url),
      kind: /video/i.test(type) ? "video" : "image",
      category: type,
      stable: isStableLocalUrl(url),
      remote: isRemoteProviderUrl(url),
    };
  });
}

function countBy(rows, getKey) {
  return rows.reduce((result, row) => {
    const key = getKey(row);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function makeAssetEntry(row) {
  const media = row.mediaAsset;
  return {
    id: row.id,
    mediaId: media.id,
    userId: row.userId,
    category: row.currentCategory,
    deleted: Boolean(row.deletedAt),
    hidden: Boolean(row.hiddenAt),
    mediaType: media.mediaType,
    urlHash: hashValue(normalizeUrl(media.url)),
    url: safeDisplayUrl(media.url),
    name: row.currentName || media.initialName || media.systemName || "",
  };
}

async function snapshot(label) {
  const [assetRows, stateRows, messageRows, sessionRows, userCount] = await Promise.all([
    prisma.userAssetState.findMany({
      where: { hiddenAt: null, mediaAsset: { archivedAt: null } },
      include: { mediaAsset: true },
      orderBy: [{ userId: "asc" }, { currentCategory: "asc" }, { id: "asc" }],
    }),
    prisma.userWorkspaceState.findMany({ select: { userId: true, state: true } }),
    prisma.workspaceMessage.findMany({ select: { userId: true, sessionId: true, messageId: true, messageJson: true } }),
    prisma.workspaceSession.findMany({ select: { userId: true, sessionId: true, deletedAt: true } }),
    prisma.user.count(),
  ]);

  const activeAssetRows = assetRows.filter((row) => !row.deletedAt);
  const assetEntries = assetRows.map(makeAssetEntry);
  const mediaKeysByUser = new Map();
  for (const row of assetRows) {
    const keys = mediaKeysByUser.get(row.userId) || new Set();
    [row.mediaAsset.url, row.mediaAsset.normalizedUrl, row.mediaAsset.originalUrl].filter(Boolean).forEach((url) => keys.add(normalizeUrl(url)));
    mediaKeysByUser.set(row.userId, keys);
  }

  const mediaRefs = [...messageRows.flatMap(collectMessageRefs), ...stateRows.flatMap(collectStateAssetRefs)];
  const uniqueRefs = Array.from(new Map(mediaRefs.map((ref) => [`${ref.userId}|${ref.normalizedUrl}|${ref.source}|${ref.category}`, ref])).values());
  const stableMissing = uniqueRefs.filter((ref) => ref.stable && !mediaKeysByUser.get(ref.userId)?.has(ref.normalizedUrl));
  const remoteRefs = uniqueRefs.filter((ref) => ref.remote);

  const fallbackUsers = stateRows
    .map((row) => ({ userId: row.userId, oldActiveAssets: activeLegacyAssets(row.state), newAssetRows: assetRows.filter((asset) => asset.userId === row.userId).length }))
    .filter((row) => row.newAssetRows === 0 && row.oldActiveAssets.length > 0)
    .map((row) => ({ userId: row.userId, oldActiveAssets: row.oldActiveAssets.length, stableOldActiveAssets: row.oldActiveAssets.filter((asset) => isStableLocalUrl(asset.url)).length }));

  const result = {
    label,
    createdAt: new Date().toISOString(),
    totals: {
      users: userCount,
      userAssetStates: assetRows.length,
      visibleActiveAssets: activeAssetRows.length,
      workspaceStates: stateRows.length,
      workspaceMessages: messageRows.length,
      workspaceSessions: sessionRows.length,
      activeWorkspaceSessions: sessionRows.filter((row) => !row.deletedAt).length,
      mediaReferences: uniqueRefs.length,
      stableMediaReferences: uniqueRefs.filter((ref) => ref.stable).length,
      remoteProviderReferences: remoteRefs.length,
      stableMissingInNewTable: stableMissing.length,
      fallbackUsers: fallbackUsers.length,
    },
    assetsByCategory: countBy(activeAssetRows, (row) => row.currentCategory),
    assetsByUser: Object.fromEntries(
      Array.from(new Set(assetRows.map((row) => row.userId))).sort().map((userId) => {
        const rows = assetRows.filter((row) => row.userId === userId);
        return [userId, { total: rows.length, active: rows.filter((row) => !row.deletedAt).length, byCategory: countBy(rows.filter((row) => !row.deletedAt), (row) => row.currentCategory) }];
      }),
    ),
    assetListHash: hashValue(JSON.stringify(assetEntries.map((entry) => [entry.userId, entry.category, entry.deleted, entry.urlHash, entry.name]).sort())),
    fallbackUsers,
    stableMissing: {
      total: stableMissing.length,
      byKind: countBy(stableMissing, (ref) => `${ref.kind}:${ref.category}`),
      sample: stableMissing.slice(0, 50).map((ref) => ({ userId: ref.userId, source: ref.source, category: ref.category, kind: ref.kind, sessionId: ref.sessionId, messageId: ref.messageId, url: safeDisplayUrl(ref.url) })),
    },
    remoteProviderReferences: {
      total: remoteRefs.length,
      bySource: countBy(remoteRefs, (ref) => `${ref.source}:${ref.category}`),
    },
  };

  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${label}.json`);
  await writeFile(filePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(filePath);
  console.log(JSON.stringify({ label, totals: result.totals, assetsByCategory: result.assetsByCategory, assetListHash: result.assetListHash }, null, 2));
  return result;
}

function diffObjects(before = {}, after = {}) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  return keys.flatMap((key) => before[key] === after[key] ? [] : [{ key, before: before[key] ?? 0, after: after[key] ?? 0 }]);
}

async function compare(beforePath, afterPath) {
  const before = JSON.parse(await readFile(beforePath, "utf8"));
  const after = JSON.parse(await readFile(afterPath, "utf8"));
  const diffs = {
    totals: diffObjects(before.totals, after.totals),
    assetsByCategory: diffObjects(before.assetsByCategory, after.assetsByCategory),
    assetListHashChanged: before.assetListHash !== after.assetListHash,
    assetsByUser: [],
    stableMissingBefore: before.stableMissing?.total ?? 0,
    stableMissingAfter: after.stableMissing?.total ?? 0,
    fallbackUsersBefore: before.fallbackUsers?.length ?? 0,
    fallbackUsersAfter: after.fallbackUsers?.length ?? 0,
  };
  const userIds = Array.from(new Set([...Object.keys(before.assetsByUser || {}), ...Object.keys(after.assetsByUser || {})])).sort();
  for (const userId of userIds) {
    const left = before.assetsByUser?.[userId] || { total: 0, active: 0, byCategory: {} };
    const right = after.assetsByUser?.[userId] || { total: 0, active: 0, byCategory: {} };
    const categoryDiffs = diffObjects(left.byCategory, right.byCategory);
    if (left.total !== right.total || left.active !== right.active || categoryDiffs.length > 0) diffs.assetsByUser.push({ userId, before: left, after: right, categoryDiffs });
  }

  const failed = diffs.totals.some((item) => !["remoteProviderReferences"].includes(item.key)) || diffs.assetsByCategory.length > 0 || diffs.assetListHashChanged || diffs.assetsByUser.length > 0 || diffs.stableMissingAfter > diffs.stableMissingBefore || diffs.fallbackUsersAfter > 0;
  console.log(JSON.stringify({ ok: !failed, diffs }, null, 2));
  if (failed) process.exitCode = 2;
}

const [, , command, ...args] = process.argv;
if (command === "snapshot") {
  await snapshot(args[0] || `snapshot-${Date.now()}`);
} else if (command === "compare") {
  if (!args[0] || !args[1]) throw new Error("Usage: node scripts/prod-deploy-snapshot.mjs compare <before.json> <after.json>");
  await compare(args[0], args[1]);
} else {
  const scriptName = path.basename(fileURLToPath(import.meta.url));
  console.log(`Usage:\n  node scripts/${scriptName} snapshot <label>\n  node scripts/${scriptName} compare <before.json> <after.json>`);
}

await prisma.$disconnect();
