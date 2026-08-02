import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveUserAvatarAsset } from "@/lib/local-assets";
import { toUserErrorMessage } from "@/lib/error-message";

// 头像是 dataURL，15MB 字符 ≈ 10MB 二进制，对头像已经绰绰有余
// （2026-08-02 审计 2.8b：原来不登录、无大小限制，且每张都跑一次 ffmpeg = 匿名塞盘 + DoS）。
const MAX_AVATAR_DATA_URL_LENGTH = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "登录状态已失效，请重新登录后再试。" }, { status: 401 });
    }

    const body = (await request.json()) as { image?: string };
    const image = body.image?.trim();

    if (!image) return NextResponse.json({ error: "缺少图片" }, { status: 400 });
    if (image.length > MAX_AVATAR_DATA_URL_LENGTH) return NextResponse.json({ error: "图片太大，请换一张小一点的" }, { status: 400 });

    const url = await saveUserAvatarAsset(image);
    return NextResponse.json({ url });
  } catch (error) {
    const message = toUserErrorMessage(error, "头像上传失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
