import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toUserErrorMessage } from "@/lib/error-message";
import { saveUploadedFileAsset } from "@/lib/local-assets";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { file?: string; name?: string };
    const file = body.file?.trim();
    if (!file) return NextResponse.json({ error: "缺少文件" }, { status: 400 });

    const user = await getCurrentUser();
    const url = await saveUploadedFileAsset(file, body.name || "file", { userId: user?.id });
    return NextResponse.json({ url });
  } catch (error) {
    const message = toUserErrorMessage(error, "文件上传失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
