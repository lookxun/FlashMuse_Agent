import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createUploadToken } from "@/lib/upload-token";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  return NextResponse.json({ token: createUploadToken(user.id) });
}
