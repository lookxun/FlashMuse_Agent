import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserProfileWithGeneratedCounts, normalizeUserProfileInput, type UserProfilePayload } from "@/lib/user-profile";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  return Response.json({ user: await getUserProfileWithGeneratedCounts(user) });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => null) as UserProfilePayload | null;
  if (!body || typeof body !== "object") return jsonError("用户资料无效");

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: normalizeUserProfileInput(body),
  });

  // 保存后也带上现算的生成数量：前端 applyCurrentUserProfile 会整份覆盖本地状态，
  // 不带就会把「生成图片/生成视频」刷回 0。
  return Response.json({ user: await getUserProfileWithGeneratedCounts(updatedUser) });
}
