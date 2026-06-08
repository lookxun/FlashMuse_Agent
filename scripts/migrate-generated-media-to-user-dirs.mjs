import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename, dirname, join } from "node:path";

nextEnv.loadEnvConfig(process.cwd());

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
  try {
    const list = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8" }));
    const app = list.find((item) => item.name === "flashmuse") ?? list[0];
    if (app?.pm2_env?.DATABASE_URL) process.env.DATABASE_URL = app.pm2_env.DATABASE_URL;
  } catch {}
}

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const PUBLIC_ROOT = join(process.cwd(), "public");
const GENERATED_ROOT = join(PUBLIC_ROOT, "generated");
const BACKUP_DIR = join(process.cwd(), ".runtime", "migration-backups");
const MIGRATABLE_ROOTS = new Set(["images", "videos", "upload_image", "video-posters", "image-thumbnails", "files"]);
const STATIC_HOSTS = ["101.47.19.109", "101.37.129.164"];

function safeUserId(userId) {
  return String(userId).replace(/[^A-Za-z0-9_-]/g, "_");
}

function splitUrlParts(value) {
  const hashIndex = value.indexOf("#");
  const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  return {
    path: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash,
    query: queryIndex >= 0 ? beforeHash.slice(queryIndex) : "",
    hash,
  };
}

function toGeneratedPath(value) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/generated/")) return splitUrlParts(value);
  try {
    const url = new URL(value);
    if (!STATIC_HOSTS.includes(url.hostname)) return undefined;
    if (!url.pathname.startsWith("/generated/")) return undefined;
    return { path: url.pathname, query: url.search, hash: url.hash };
  } catch {
    return undefined;
  }
}

function getLegacyGeneratedRoot(path) {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "generated") return undefined;
  if (parts[1] === "users") return undefined;
  return parts[1];
}

function getMigratedPath(path, userId) {
  const root = getLegacyGeneratedRoot(path);
  if (!root || !MIGRATABLE_ROOTS.has(root)) return undefined;
  const rest = path.replace(`/generated/${root}/`, "");
  if (!rest || rest.includes("..")) return undefined;
  return `/generated/users/${safeUserId(userId)}/${root}/${rest}`;
}

function getFilePath(publicUrl) {
  return join(PUBLIC_ROOT, publicUrl.replace(/^\//, ""));
}

async function copyIfExists(oldUrl, newUrl, counters) {
  const sourcePath = getFilePath(oldUrl);
  const targetPath = getFilePath(newUrl);
  if (!existsSync(sourcePath)) {
    counters.missingFiles += 1;
    return false;
  }
  if (existsSync(targetPath)) {
    counters.existingFiles += 1;
    return true;
  }
  if (APPLY) {
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
  counters.copiedFiles += 1;
  return true;
}

function addMappingForValue(value, userId, mappings) {
  const parsed = toGeneratedPath(value);
  if (!parsed) return;
  const migratedPath = getMigratedPath(parsed.path, userId);
  if (!migratedPath) return;
  const migratedValue = `${migratedPath}${parsed.query}${parsed.hash}`;
  mappings.set(value, migratedValue);
  mappings.set(parsed.path, migratedPath);

  if (parsed.path.startsWith("/generated/videos/")) {
    const fileName = basename(parsed.path).replace(/\.(mp4|webm|mov)$/i, ".jpg");
    if (fileName !== basename(parsed.path)) {
      const oldPoster = `/generated/video-posters/${fileName}`;
      const newPoster = `/generated/users/${safeUserId(userId)}/video-posters/${fileName}`;
      mappings.set(oldPoster, newPoster);
    }
  }
}

function collectMappings(value, userId, mappings) {
  if (typeof value === "string") {
    addMappingForValue(value, userId, mappings);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMappings(item, userId, mappings));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectMappings(item, userId, mappings));
  }
}

function replaceDeep(value, mappings) {
  if (typeof value === "string") return mappings.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, mappings));
  if (value && typeof value === "object") {
    let changed = false;
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const nextKey = mappings.get(key) ?? key;
      const nextValue = replaceDeep(item, mappings);
      if (nextKey !== key || nextValue !== item) changed = true;
      next[nextKey] = nextValue;
    }
    return changed ? next : value;
  }
  return value;
}

async function backupJson(name, data) {
  if (!APPLY) return;
  await mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(join(BACKUP_DIR, `${timestamp}-${name}.json`), JSON.stringify(data, null, 2));
}

async function migrateUser(user, counters) {
  const workspace = user.workspace;
  const ledgers = user.creditLedgers ?? [];
  const mappings = new Map();

  if (workspace?.state) collectMappings(workspace.state, user.id, mappings);
  ledgers.forEach((ledger) => collectMappings(ledger.metadata, user.id, mappings));

  if (mappings.size === 0) return;

  for (const [oldValue, newValue] of mappings) {
    const oldParsed = toGeneratedPath(oldValue);
    const newParsed = toGeneratedPath(newValue);
    if (!oldParsed || !newParsed) continue;
    await copyIfExists(oldParsed.path, newParsed.path, counters);
  }

  if (workspace?.state) {
    const nextState = replaceDeep(workspace.state, mappings);
    if (nextState !== workspace.state) {
      counters.updatedWorkspaces += 1;
      if (APPLY) await prisma.userWorkspaceState.update({ where: { userId: user.id }, data: { state: nextState } });
    }
  }

  for (const ledger of ledgers) {
    if (!ledger.metadata) continue;
    const nextMetadata = replaceDeep(ledger.metadata, mappings);
    if (nextMetadata !== ledger.metadata) {
      counters.updatedLedgers += 1;
      if (APPLY) await prisma.creditLedger.update({ where: { id: ledger.id }, data: { metadata: nextMetadata } });
    }
  }

  counters.usersWithMappings += 1;
  counters.mappings += mappings.size;
}

async function main() {
  const users = await prisma.user.findMany({
    include: {
      workspace: true,
      creditLedgers: true,
    },
  });

  await backupJson("user-workspaces", users.map((user) => ({ userId: user.id, email: user.email, state: user.workspace?.state ?? null })));
  await backupJson("credit-ledgers", users.flatMap((user) => user.creditLedgers.map((ledger) => ({ id: ledger.id, userId: user.id, metadata: ledger.metadata }))));

  const counters = {
    users: users.length,
    usersWithMappings: 0,
    mappings: 0,
    copiedFiles: 0,
    existingFiles: 0,
    missingFiles: 0,
    updatedWorkspaces: 0,
    updatedLedgers: 0,
  };

  for (const user of users) await migrateUser(user, counters);
  console.log(JSON.stringify({ apply: APPLY, ...counters }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
