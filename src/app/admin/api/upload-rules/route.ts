import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import type { PromptLengthOverrides } from "@/lib/prompt-length";
import { getPromptLengthOverrides, getUploadRuleOverrides, updatePromptLengthOverrides, updateUploadRuleOverrides } from "@/lib/system-settings";
import type { UploadRuleOverrides } from "@/lib/upload-rules";

export const runtime = "nodejs";

function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET() {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ uploadRuleOverrides: getUploadRuleOverrides(), promptLengthOverrides: getPromptLengthOverrides() });
}

// ⭐ 上传数量（uploadRuleOverrides）与提示词字数（promptLengthOverrides）走同一个接口，
//    但**各自独立可选**：面板改哪个就只传哪个，另一个不传就保持原样。
// ⛔ 别把没传的那个当成 `{}` 写回去 —— 那等于把管理员另一半配置整份清空
//    （面板里「文字」和「文件数量」是两个不同的交互，很容易只带一个字段过来）。
export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const uploadRuleOverrides = isPlainObject(body.uploadRuleOverrides)
    ? await updateUploadRuleOverrides(body.uploadRuleOverrides as UploadRuleOverrides)
    : getUploadRuleOverrides();
  const promptLengthOverrides = isPlainObject(body.promptLengthOverrides)
    ? await updatePromptLengthOverrides(body.promptLengthOverrides as PromptLengthOverrides)
    : getPromptLengthOverrides();

  return NextResponse.json({ uploadRuleOverrides, promptLengthOverrides });
}
