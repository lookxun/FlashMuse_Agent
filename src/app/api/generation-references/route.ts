import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildJobReferenceItems, getGenerationJobByMediaUrl } from "@/lib/generation-jobs";

export const runtime = "nodejs";

// 唯一权威：按一张【生成媒体的 url】从 GenerationJob 读它真正用过的参考素材（图/视频/音频 url + 显示名）。
// 预览页右侧参考缩略图统一走它——对话流/资产库(角色/场景/道具/分镜)/工作流生成的图都没有可靠的画布/消息副本，
// 参考只权威地存在 GenerationJob 里，必须从数据库读，禁止靠 sourcePrompt 的 @名去猜（会因改名/未加载而丢）。
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => undefined) as { mediaUrl?: string } | undefined;
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl : "";
  if (!mediaUrl) return NextResponse.json({ references: [] });

  const job = await getGenerationJobByMediaUrl(user.id, mediaUrl);
  if (!job) return NextResponse.json({ references: [] });

  return NextResponse.json({ references: buildJobReferenceItems(job) });
}
