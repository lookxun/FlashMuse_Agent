import { getCurrentUser, jsonError } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { migrateLegacyUserProfileFromWorkspace, stripUserProfileFromWorkspaceState } from "@/lib/user-profile";
import { compactWorkspaceState, hasJsonChanged, mergeUnloadedSessions, replaceLegacyMediaUrls, summarizeWorkspaceState } from "@/lib/workspace-state-cleanup";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  const summaryOnly = new URL(request.url).searchParams.get("summary") === "1";

  const workspace = await prisma.userWorkspaceState.findUnique({
    where: { userId: user.id },
  });

  if (workspace?.state) {
    await migrateLegacyUserProfileFromWorkspace(user.id, workspace.state);
    const cleanState = compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(workspace.state)));
    if (hasJsonChanged(workspace.state, cleanState)) {
      await prisma.userWorkspaceState.update({ where: { userId: user.id }, data: { state: cleanState as Prisma.InputJsonValue } });
    }
    return Response.json({ state: summaryOnly ? summarizeWorkspaceState(cleanState) : cleanState });
  }

  return Response.json({ state: null });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("工作区数据无效");

  await migrateLegacyUserProfileFromWorkspace(user.id, body);
  const existing = await prisma.userWorkspaceState.findUnique({ where: { userId: user.id } });
  const mergedBody = existing?.state ? mergeUnloadedSessions(body, existing.state) : body;
  const cleanBody = compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(mergedBody)));

  await prisma.userWorkspaceState.upsert({
    where: { userId: user.id },
    update: { state: cleanBody as Prisma.InputJsonValue },
    create: { userId: user.id, state: cleanBody as Prisma.InputJsonValue },
  });

  return Response.json({ ok: true });
}
