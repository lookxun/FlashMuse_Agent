import { NextResponse } from "next/server";
import { saveUploadedImageAsset } from "@/lib/local-assets";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { image?: string };
    const image = body.image?.trim();

    if (!image) {
      return NextResponse.json({ error: "缺少图片" }, { status: 400 });
    }

    const url = await saveUploadedImageAsset(image);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
