import { getCurrentUser } from "@/lib/auth";
import { getUserProfileWithGeneratedCounts } from "@/lib/user-profile";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// 公告是全局单行，/api/auth/me 每 5 秒被每个在线用户拉一次，这里加个短缓存，
// 保证全站每 5 秒最多查一次库（负载几乎为零），拿它当"准推送"的载体。
type AnnouncementPayload = { enabled: boolean; content?: string; version?: string };
let announcementCache: { value: AnnouncementPayload; at: number } | null = null;
const ANNOUNCEMENT_CACHE_MS = 5000;

async function getAnnouncementPayload(): Promise<AnnouncementPayload> {
  const now = Date.now();
  if (announcementCache && now - announcementCache.at < ANNOUNCEMENT_CACHE_MS) return announcementCache.value;
  let value: AnnouncementPayload = { enabled: false };
  try {
    const rows = await prisma.$queryRaw<Array<{ content: string; enabled: boolean; currentRunId: string | null }>>`
      SELECT "content", "enabled", "currentRunId" FROM "Announcement" WHERE "key" = 'global' LIMIT 1
    `;
    const row = rows[0];
    const content = (row?.content ?? "").trim();
    const version = row?.currentRunId ?? "";
    if (Boolean(row?.enabled) && content.length > 0 && version.length > 0) {
      value = { enabled: true, content, version };
    }
  } catch {
    value = { enabled: false };
  }
  announcementCache = { value, at: now };
  return value;
}

export async function GET() {
  const user = await getCurrentUser();

  return Response.json({
    user: user ? { ...(await getUserProfileWithGeneratedCounts(user)), isAdmin: isAdminEmail(user.email) } : null,
    announcement: await getAnnouncementPayload(),
  });
}
