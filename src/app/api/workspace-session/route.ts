import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactWorkspaceState, hasJsonChanged, isRecord, replaceLegacyMediaUrls } from "@/lib/workspace-state-cleanup";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const sessionId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!sessionId) return jsonError("会话ID无效");

  const workspace = await prisma.userWorkspaceState.findUnique({ where: { userId: user.id } });
  if (!workspace?.state) return Response.json({ session: null });

  const cleanState = compactWorkspaceState(replaceLegacyMediaUrls(workspace.state));
  if (hasJsonChanged(workspace.state, cleanState)) {
    await prisma.userWorkspaceState.update({ where: { userId: user.id }, data: { state: cleanState as Prisma.InputJsonValue } });
  }

  const sessions = isRecord(cleanState) && Array.isArray(cleanState.sessions) ? cleanState.sessions : [];
  const session = sessions.find((item) => isRecord(item) && item.id === sessionId) ?? null;
  return Response.json({ session: session && isRecord(session) ? { ...session, messagesLoaded: true } : null });
}
