import { NextResponse } from "next/server";
import { createOpenRouterVideoTask, getOpenRouterHeaders, getOpenRouterVideoTask, getRequiredOpenRouterApiKey } from "@/lib/openrouter-video";
import { saveGeneratedAsset } from "@/lib/local-assets";

function getCreateTaskId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const preferredKeys = ["taskId", "task_id", "taskID", "id", "generationId", "generation_id"];

  for (const key of preferredKeys) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number") return String(item);
  }

  const priorityContainers = ["data", "result", "task", "content", "payload"];
  for (const key of priorityContainers) {
    const taskId = getCreateTaskId(record[key]);
    if (taskId) return taskId;
  }

  return undefined;
}

function normalizeVideoStatus(status: unknown) {
  if (typeof status === "number") {
    if (status === 0) return "queued";
    if (status === 1) return "running";
    if (status === 2) return "succeeded";
    if (status === 3) return "failed";
    if (status === 4) return "cancelled";
  }

  if (typeof status === "string") {
    const value = status.trim().toLowerCase();
    if (value === "pending") return "queued";
    if (value === "in_progress" || value === "processing") return "running";
    if (value === "completed" || value === "complete" || value === "done") return "succeeded";
    return value;
  }

  return undefined;
}

function getVideoErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const success = record.success;
  const code = record.code;
  const message = record.msg ?? record.message ?? record.error;

  if (success === false || (typeof code === "string" && code !== "0" && code !== "200")) {
    return [
      typeof code === "string" || typeof code === "number" ? `code=${code}` : "",
      typeof message === "string" ? message : "视频平台返回失败",
    ]
      .filter(Boolean)
      .join("，");
  }

  if (typeof message === "string" && message.trim()) return message.trim();
  if (message && typeof message === "object" && typeof (message as { message?: unknown }).message === "string") return (message as { message: string }).message;

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedMessage = getVideoErrorMessage(record[key]);
    if (nestedMessage) return nestedMessage;
  }

  return undefined;
}

function getTaskStatus(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const status = normalizeVideoStatus(record.status ?? record.state ?? record.taskStatus ?? record.task_status);
  if (status) return status;

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedStatus = getTaskStatus(record[key]);
    if (nestedStatus) return nestedStatus;
  }

  return undefined;
}

function getVideoUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value) && /(\.mp4|\.mov|\.webm)(\?|$)/i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && /^https?:\/\//.test(item)) return item;

      const videoUrl = getVideoUrl(item);
      if (videoUrl) return videoUrl;
    }

    return undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const keys = ["video_url", "videoUrl", "url", "video", "outputUrl", "output_url", "message", "unsigned_urls", "urls"];

  for (const key of keys) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }

  for (const item of Object.values(record)) {
    const videoUrl = getVideoUrl(item);
    if (videoUrl) return videoUrl;
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      model?: string;
      taskId?: string;
      referenceImages?: string[];
      settings?: { ratio?: string; resolution?: string; duration?: string };
    };

    const taskId = body.taskId?.trim();
    const prompt = body.prompt?.trim();

    if (taskId) {
      const task = await getOpenRouterVideoTask(taskId);
      const videoError = getVideoErrorMessage(task);

      if (videoError) {
        return NextResponse.json({ ...task, status: "failed", error: { message: videoError } });
      }

      const status = getTaskStatus(task) ?? normalizeVideoStatus(task.status) ?? "running";
      const videoUrl = getVideoUrl(task);

      if ((status === "succeeded" || status === "success" || status === "completed" || status === "complete") && videoUrl) {
        let localVideoUrl = videoUrl;

        try {
          const needsOpenRouterAuth = videoUrl.startsWith("https://openrouter.ai/api/v1/videos/");
          localVideoUrl = await saveGeneratedAsset(videoUrl, "video", needsOpenRouterAuth ? { headers: getOpenRouterHeaders(getRequiredOpenRouterApiKey()) } : undefined);
        } catch {
          localVideoUrl = videoUrl;
        }

        return NextResponse.json({
          ...task,
          status: "succeeded",
          content: {
            ...task.content,
            video_url: localVideoUrl,
            remote_video_url: videoUrl,
          },
        });
      }

      return NextResponse.json({ ...task, status, content: { ...task.content, video_url: videoUrl } });
    }

    if (!prompt) {
      return NextResponse.json({ error: "缺少提示词" }, { status: 400 });
    }

    const task = await createOpenRouterVideoTask(prompt, Array.isArray(body.referenceImages) ? body.referenceImages : [], body.settings, body.model);
    const videoError = getVideoErrorMessage(task);

    if (videoError) {
      return NextResponse.json({ error: `OpenRouter 视频任务创建失败：${videoError}`, raw: task }, { status: 502 });
    }

    const id = task.polling_url ?? task.pollingUrl ?? getCreateTaskId(task);

    if (!id) {
      return NextResponse.json({ error: "视频接口已调用，但返回里没有找到任务编号。", raw: task }, { status: 502 });
    }

    return NextResponse.json({ ...task, id, job_id: getCreateTaskId(task) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
