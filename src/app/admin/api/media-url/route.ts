import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";

type MediaSaveJob = {
  remoteUrl?: string;
  localUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
};

const JOBS_PATH = join(process.cwd(), ".runtime", "media-save-jobs.json");

function normalizeGeneratedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/generated/")) return parsed.pathname;
  } catch {
    if (url.startsWith("/generated/")) return url.split("?")[0].split("#")[0];
  }
  return undefined;
}

async function readMediaJobs() {
  try {
    const parsed = JSON.parse(await readFile(JOBS_PATH, "utf8")) as MediaSaveJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function redirectTo(url: string) {
  return new NextResponse(null, { status: 307, headers: { Location: url } });
}

export async function GET(request: Request) {
  const adminEmail = await getCurrentAdminEmail();
  if (!adminEmail || getAdminEmails().length === 0 || !isAdminEmail(adminEmail)) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const url = new URL(request.url).searchParams.get("url") ?? "";
  const variant = new URL(request.url).searchParams.get("variant") ?? "thumb";
  const generatedUrl = normalizeGeneratedUrl(url);
  if (generatedUrl) return redirectTo(generatedUrl);
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "无效媒体地址" }, { status: 400 });

  const jobs = await readMediaJobs();
  const normalizedRemoteUrl = url.split("#")[0];
  const job = jobs.find((item) => item.remoteUrl === url || item.remoteUrl?.split("#")[0] === normalizedRemoteUrl || item.remoteUrl?.split("?")[0] === url.split("?")[0]);
  const localUrl = variant === "original"
    ? normalizeGeneratedUrl(job?.localUrl ?? "") ?? normalizeGeneratedUrl(job?.posterUrl ?? "") ?? normalizeGeneratedUrl(job?.thumbnailUrl ?? "")
    : normalizeGeneratedUrl(job?.thumbnailUrl ?? "") ?? normalizeGeneratedUrl(job?.posterUrl ?? "") ?? normalizeGeneratedUrl(job?.localUrl ?? "");
  // ⚠️ 已知低危项（2026-08-02 审计 2.8i，有意保留）：查不到本地副本时会 307 回调用方给的远程 url
  //   = 开放重定向。但这是**仅管理员可用**的预览接口，回调的正是管理员自己要看的地址；
  //   改成 404 会让「还没本地化的媒体在后台无法预览」，故保留现状。
  return redirectTo(localUrl || url);
}
