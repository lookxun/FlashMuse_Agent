export const APP_TIME_ZONE = "Asia/Shanghai";

const pad2 = (n: number) => String(n).padStart(2, "0");

function beijingParts(value: Date) {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function formatBeijingDateTime(
  value: Date | string | number | null | undefined,
  options?: { withSeconds?: boolean; short?: boolean },
) {
  if (value == null || value === "") return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  if (options?.short) {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: APP_TIME_ZONE,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...(options?.withSeconds ? { second: "2-digit" as const } : {}),
      hour12: false,
    }).format(date);
  }
  return date
    .toLocaleString("zh-CN", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...(options?.withSeconds ? { second: "2-digit" as const } : {}),
      hour12: false,
    })
    .replace(/\//g, "-");
}

export function formatBeijingMessageTime(value?: number) {
  const parts = beijingParts(new Date(value ?? Date.now()));
  return `${parts.year}/${parts.month}/${parts.day} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatBeijingCreditLastActiveTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString("zh-CN", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const nowParts = beijingParts(new Date());
  const dateParts = beijingParts(date);
  if (dateParts.year === nowParts.year) {
    return date.toLocaleDateString("zh-CN", { timeZone: APP_TIME_ZONE, month: "2-digit", day: "2-digit" });
  }
  return String(dateParts.year);
}

export function beijingDayKey(value: Date) {
  const parts = beijingParts(value);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function beijingDayLabel(value: Date) {
  const parts = beijingParts(value);
  return `${pad2(parts.month)}/${pad2(parts.day)}`;
}

export function startOfBeijingDay(value = new Date()) {
  const parts = beijingParts(value);
  return new Date(`${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T00:00:00+08:00`);
}

export function addBeijingDays(value: Date, days: number) {
  const parts = beijingParts(value);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return new Date(`${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}T00:00:00+08:00`);
}

export function formatBeijingStamp(value = new Date()) {
  const parts = beijingParts(value);
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}${pad2(parts.hour)}${pad2(parts.minute)}${pad2(parts.second)}`;
}

export function formatBeijingMdHm(value: Date) {
  const parts = beijingParts(value);
  return `${pad2(parts.month)}/${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}
