import { NextResponse } from "next/server";
import { deleteLocalGeneratedAsset } from "@/lib/local-assets";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "缺少资源地址" }, { status: 400 });
    }

    await deleteLocalGeneratedAsset(url);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
