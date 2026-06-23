import { refreshCurrentAdminActivity } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const ok = await refreshCurrentAdminActivity();
  if (!ok) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true });
}
