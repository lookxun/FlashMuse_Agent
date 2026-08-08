import { randomUUID } from "node:crypto";

// 一次公告投放 = 一个 run（从"开启开关"到"关闭开关"）。每次开启生成一个新的 runId，
// 前台用它记忆"用户是否关过这一次"，后台按 runId 单独统计这次投放的关闭人数。
// 换新一次(新 runId) → 关闭数从 0 起、用户重新看到公告。前台读取/关闭上报/后台统计三处共用。
export function generateAnnouncementRunId() {
  return randomUUID();
}
