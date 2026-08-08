import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { generateAnnouncementRunId } from "@/lib/announcement";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function requireAdmin() {
  const email = await getCurrentAdminEmail();
  return email && isAdminEmail(email) ? email : null;
}

// 顶部公告：全局一条（固定 key='global'）。三种动作：
//  - action="open"  开启这一次投放：生成新 runId、enabled=true。
//  - action="close" 结束这一次投放：enabled=false，并往发布历史记一条（时间/文案/该次 runId）。
//  - action="save"  仅保存草稿文案（关闭态下编辑），不动 enabled、不记历史。
export async function POST(request: Request) {
  const adminEmail = await requireAdmin();
  if (!adminEmail) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = body.action === "open" || body.action === "close" ? body.action : "save";
  const content = typeof body.content === "string" ? body.content.slice(0, 500) : "";
  const trimmed = content.trim();

  try {
    if (action === "open") {
      if (trimmed.length === 0) return NextResponse.json({ error: "公告内容为空" }, { status: 400 });
      const runId = generateAnnouncementRunId();
      await prisma.$executeRaw`
        INSERT INTO "Announcement" ("id", "key", "content", "enabled", "currentRunId", "updatedAt")
        VALUES (${randomUUID()}, ${"global"}, ${content}, ${true}, ${runId}, NOW())
        ON CONFLICT ("key") DO UPDATE SET "content" = EXCLUDED."content", "enabled" = true, "currentRunId" = EXCLUDED."currentRunId", "updatedAt" = NOW()
      `;
      return NextResponse.json({ ok: true, runId });
    }

    if (action === "close") {
      // 读出这一次投放的 runId、文案与开启时刻，落一条历史后再关闭。
      // ⭐ updatedAt 就是本次「开启」那一刻（开启时写 NOW()，开启期间文案锁定不会再被写），
      //    历史表那一列在后台显示为「发公告时间」→ 必须用它，⛔ 不能用 createdAt 默认值（那是关闭时刻）。
      const rows = await prisma.$queryRaw<Array<{ content: string; currentRunId: string | null; updatedAt: Date }>>`
        SELECT "content", "currentRunId", "updatedAt" FROM "Announcement" WHERE "key" = 'global' LIMIT 1
      `;
      const runId = rows[0]?.currentRunId ?? null;
      const runContent = (rows[0]?.content ?? content).trim();
      const publishedAt = rows[0]?.updatedAt ?? new Date();
      if (runId && runContent.length > 0) {
        try {
          await prisma.$executeRaw`
            INSERT INTO "AnnouncementHistory" ("id", "version", "content", "createdAt")
            VALUES (${randomUUID()}, ${runId}, ${runContent}, ${publishedAt})
          `;
        } catch {
          /* 历史记录失败不影响关闭本身 */
        }
      }
      await prisma.$executeRaw`
        UPDATE "Announcement" SET "enabled" = false, "currentRunId" = NULL, "updatedAt" = NOW() WHERE "key" = 'global'
      `;
      return NextResponse.json({ ok: true });
    }

    // action === "save"：仅更新草稿文案（不改 enabled / runId）。
    await prisma.$executeRaw`
      INSERT INTO "Announcement" ("id", "key", "content", "enabled", "updatedAt")
      VALUES (${randomUUID()}, ${"global"}, ${content}, ${false}, NOW())
      ON CONFLICT ("key") DO UPDATE SET "content" = EXCLUDED."content", "updatedAt" = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}
