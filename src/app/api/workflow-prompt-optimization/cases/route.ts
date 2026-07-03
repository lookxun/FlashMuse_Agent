import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { normalizeMediaAssetUrl } from "@/lib/media-assets";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength = 8000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = await request.json() as { workflowId?: unknown; workflowNodeId?: unknown; imageUrl?: unknown; thumbnailUrl?: unknown; sourceModel?: unknown; optimizerModel?: unknown; attemptsUsed?: unknown; originalPrompt?: unknown; optimizedPrompt?: unknown };
    const imageUrl = cleanString(body.imageUrl, 2000);
    const originalPrompt = cleanString(body.originalPrompt);
    const optimizedPrompt = cleanString(body.optimizedPrompt);
    const sourceModel = cleanString(body.sourceModel, 160);
    const optimizerModel = cleanString(body.optimizerModel, 160);
    const attemptsUsed = Math.max(1, Math.min(100, Math.floor(Number(body.attemptsUsed) || 1)));
    if (!imageUrl || !originalPrompt || !optimizedPrompt || !sourceModel || !optimizerModel) return NextResponse.json({ error: "参数不完整" }, { status: 400 });

    const normalizedUrl = normalizeMediaAssetUrl(imageUrl);
    const mediaRows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "MediaAsset" WHERE "userId" = ${user.id} AND "normalizedUrl" = ${normalizedUrl} LIMIT 1`;
    const id = `gptopt_${randomUUID()}`;
    await prisma.$executeRaw`INSERT INTO "GptImagePromptOptimizationCase" ("id", "userId", "workflowId", "workflowNodeId", "mediaAssetId", "imageUrl", "thumbnailUrl", "sourceModel", "optimizerModel", "attemptsUsed", "originalPrompt", "optimizedPrompt", "updatedAt") VALUES (${id}, ${user.id}, ${cleanString(body.workflowId, 160) || null}, ${cleanString(body.workflowNodeId, 160) || null}, ${mediaRows[0]?.id ?? null}, ${imageUrl}, ${cleanString(body.thumbnailUrl, 2000) || null}, ${sourceModel}, ${optimizerModel}, ${attemptsUsed}, ${originalPrompt}, ${optimizedPrompt}, NOW())`;
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存优化案例失败" }, { status: 500 });
  }
}
