import { getCurrentUser } from "@/lib/auth";
import { getUserProfileWithGeneratedCounts } from "@/lib/user-profile";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  return Response.json({
    user: user ? { ...(await getUserProfileWithGeneratedCounts(user)), isAdmin: isAdminEmail(user.email) } : null,
  });
}
