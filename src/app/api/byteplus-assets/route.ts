import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createBytePlusAsset, getBytePlusAsset } from "@/lib/byteplus-assets";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";
import { normalizeMediaAssetUrl } from "@/lib/media-assets";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// 送审给平台的必须是**文件静态直链**：先过唯一权威归一化（剥自家主机前缀、把
// `/api/media-thumbnail?url=` 动态缩略图接口还原成原图），再按当前环境拼公网 base。
function toPublicAssetUrl(value: unknown) {
  const url = normalizeReferenceAssetUrl(value);
  if (!url) return "";
  if (url.startsWith("/generated/")) {
    const base = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL || process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "https://main.venusface.com").replace(/\/$/, "");
    return `${base}${url}`;
  }
  if (/^https?:\/\//i.test(url)) return url;
  return "";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as { url?: unknown; name?: unknown };
    const url = toPublicAssetUrl(body.url);
    if (!url) return NextResponse.json({ error: "素材地址无效" }, { status: 400 });

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const result = await createBytePlusAsset({ url, name, assetType: "Image", moderationStrategy: "Skip" });

    // ⭐⭐ 2026-08-02 审计复核补的一刀：**这个 id 必须落库**。
    //   原来手动送审只把 id 存在前端 state 里（`applyBytePlusAssetUpdate` 只改内存），
    //   而下面 GET 新加了「按 UserAssetState.bytePlusAssetId 校验归属」→ 不落库的话，
    //   用户点「刷新审核状态」永远拿到 404「素材不存在」= 手动审核这个功能直接废掉。
    //   落库口径与视频链路自动送审的 patchWorkspaceBytePlusAssets 完全一致（按 normalizedUrl 定位）。
    const normalizedUrl = normalizeMediaAssetUrl(normalizeReferenceAssetUrl(body.url));
    if (normalizedUrl && result.id) {
      await prisma.userAssetState.updateMany({
        where: { userId: user.id, mediaAsset: { normalizedUrl } },
        data: {
          bytePlusAssetId: result.id,
          bytePlusAssetGroupId: result.groupId,
          bytePlusAssetStatus: "Processing",
          bytePlusAssetError: null,
          bytePlusAssetUpdatedAt: new Date(),
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({ id: result.id, groupId: result.groupId, status: "Processing" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交素材审核失败";
    console.error("[byteplus-assets] create failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "缺少素材 ID" }, { status: 400 });

    // 2026-08-02 审计 2.8l：原来无归属校验，任何登录用户可查任意 asset id 的审核状态。
    const owned = await prisma.userAssetState.findFirst({ where: { userId: user.id, bytePlusAssetId: id }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "素材不存在" }, { status: 404 });

    const asset = await getBytePlusAsset(id);
    return NextResponse.json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询素材状态失败";
    console.error("[byteplus-assets] get failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
