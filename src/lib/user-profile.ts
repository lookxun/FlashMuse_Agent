import { prisma } from "@/lib/prisma";

export const supportedUserLanguages = ["简体中文", "繁体中文"] as const;
export type SupportedUserLanguage = (typeof supportedUserLanguages)[number];

export type UserProfilePayload = {
  nickname?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  language?: string | null;
  notifyOnGenerationComplete?: boolean | null;
  autoSaveHistory?: boolean | null;
  previewWheelZoom?: boolean | null;
  previewWheelFlip?: boolean | null;
  defaultWorkspacePanel?: string | null;
  defaultImageModel?: string | null;
  defaultImageRatio?: string | null;
  defaultImageResolution?: string | null;
  defaultVideoModel?: string | null;
  defaultVideoRatio?: string | null;
  defaultVideoResolution?: string | null;
  defaultVideoDuration?: string | null;
  defaultAudioModel?: string | null;
  defaultAudioVoice?: string | null;
  defaultAudioEmotion?: string | null;
};

const workspacePanelValues = ["chat", "workflow", "assets"] as const;

function normalizeWorkspacePanel(value: unknown): string {
  return workspacePanelValues.includes(value as (typeof workspacePanelValues)[number]) ? (value as string) : "chat";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeUserLanguage(value: unknown): SupportedUserLanguage {
  return supportedUserLanguages.includes(value as SupportedUserLanguage) ? value as SupportedUserLanguage : "简体中文";
}

export function getUserProfileFromUser(user: {
  id: string;
  email: string;
  passwordHash?: string | null;
  nickname?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  language?: string | null;
  notifyOnGenerationComplete?: boolean | null;
  autoSaveHistory?: boolean | null;
  previewWheelZoom?: boolean | null;
  previewWheelFlip?: boolean | null;
  defaultWorkspacePanel?: string | null;
  defaultImageModel?: string | null;
  defaultImageRatio?: string | null;
  defaultImageResolution?: string | null;
  defaultVideoModel?: string | null;
  defaultVideoRatio?: string | null;
  defaultVideoResolution?: string | null;
  defaultVideoDuration?: string | null;
  defaultAudioModel?: string | null;
  defaultAudioVoice?: string | null;
  defaultAudioEmotion?: string | null;
  credits?: number | null;
  generalModeEnabled?: boolean | null;
  generatedImageCount?: number | null;
  generatedVideoCount?: number | null;
}) {
  return {
    id: user.id,
    email: user.email,
    hasPassword: Boolean(user.passwordHash),
    nickname: user.nickname?.trim() || user.email,
    phone: user.phone?.trim() || "",
    avatarUrl: user.avatarUrl?.trim() || "",
    language: normalizeUserLanguage(user.language),
    notifyOnGenerationComplete: user.notifyOnGenerationComplete ?? true,
    autoSaveHistory: user.autoSaveHistory ?? true,
    previewWheelZoom: user.previewWheelZoom ?? true,
    previewWheelFlip: user.previewWheelFlip ?? true,
    defaultWorkspacePanel: normalizeWorkspacePanel(user.defaultWorkspacePanel),
    defaultImageModel: user.defaultImageModel?.trim() || "",
    defaultImageRatio: user.defaultImageRatio?.trim() || "",
    defaultImageResolution: user.defaultImageResolution?.trim() || "",
    defaultVideoModel: user.defaultVideoModel?.trim() || "",
    defaultVideoRatio: user.defaultVideoRatio?.trim() || "",
    defaultVideoResolution: user.defaultVideoResolution?.trim() || "",
    defaultVideoDuration: user.defaultVideoDuration?.trim() || "",
    defaultAudioModel: user.defaultAudioModel?.trim() || "",
    defaultAudioVoice: user.defaultAudioVoice?.trim() || "",
    defaultAudioEmotion: user.defaultAudioEmotion?.trim() || "",
    credits: user.credits ?? 0,
    generalModeEnabled: user.generalModeEnabled ?? false,
    generatedImageCount: user.generatedImageCount ?? 0,
    generatedVideoCount: user.generatedVideoCount ?? 0,
  };
}

/**
 * 生成媒体总数（用户中心「生成图片 X 张 / 生成视频 Y 段」的唯一权威）。
 *
 * 规则：只数模型生成的（= 扣过积分的）图片和视频，上传的素材不算。判定用 sourceKind
 * （非空列，`*_upload_*` 就是上传，生成的是 `*_generation*`），比 promptSource 可空更稳。
 * 用户删掉的仍然计入——它当时确实生成过、也扣过费；归档(archivedAt)的数据清理行不计。
 *
 * 注意：User.generatedImageCount / generatedVideoCount 这两个老列历史上从未被累加过（一直是 0，
 * 这就是用户中心显示 0 张 0 段的原因），所以一律现算，不再读那两列。
 */
export async function getUserGeneratedMediaCounts(userId: string) {
  const rows = await prisma.mediaAsset.groupBy({
    by: ["mediaType"],
    where: { userId, archivedAt: null, mediaType: { in: ["image", "video"] }, sourceKind: { not: { contains: "upload" } } },
    _count: { _all: true },
  });
  const countOf = (mediaType: string) => rows.find((row) => row.mediaType === mediaType)?._count._all ?? 0;
  return { generatedImageCount: countOf("image"), generatedVideoCount: countOf("video") };
}

/** 用户资料 + 现算的生成数量。/api/auth/me 与 /api/user-profile 统一走这里，别再各自拼一套。 */
export async function getUserProfileWithGeneratedCounts(user: Parameters<typeof getUserProfileFromUser>[0]) {
  const counts = await getUserGeneratedMediaCounts(user.id);
  // 与后台一致：取「老列」与「现算值」的较大者（老列历史上从未累加，真实用户恒为 0；
  // 只有造数据的测试账号有值，这样不会把它们的数字抹成 0）。
  return {
    ...getUserProfileFromUser(user),
    generatedImageCount: Math.max(user.generatedImageCount ?? 0, counts.generatedImageCount),
    generatedVideoCount: Math.max(user.generatedVideoCount ?? 0, counts.generatedVideoCount),
  };
}

export function normalizeUserProfileInput(input: UserProfilePayload) {
  const nickname = Array.from(cleanText(input.nickname)).slice(0, 8).join("");
  const phone = cleanText(input.phone).slice(0, 40);
  const avatarUrl = cleanText(input.avatarUrl).slice(0, 1000);

  return {
    nickname: nickname || null,
    phone: phone || null,
    avatarUrl: avatarUrl || null,
    language: normalizeUserLanguage(input.language),
    notifyOnGenerationComplete: typeof input.notifyOnGenerationComplete === "boolean" ? input.notifyOnGenerationComplete : true,
    autoSaveHistory: typeof input.autoSaveHistory === "boolean" ? input.autoSaveHistory : true,
    previewWheelZoom: typeof input.previewWheelZoom === "boolean" ? input.previewWheelZoom : true,
    previewWheelFlip: typeof input.previewWheelFlip === "boolean" ? input.previewWheelFlip : true,
    defaultWorkspacePanel: normalizeWorkspacePanel(input.defaultWorkspacePanel),
    defaultImageModel: cleanText(input.defaultImageModel).slice(0, 120),
    defaultImageRatio: cleanText(input.defaultImageRatio).slice(0, 40),
    defaultImageResolution: cleanText(input.defaultImageResolution).slice(0, 40),
    defaultVideoModel: cleanText(input.defaultVideoModel).slice(0, 120),
    defaultVideoRatio: cleanText(input.defaultVideoRatio).slice(0, 40),
    defaultVideoResolution: cleanText(input.defaultVideoResolution).slice(0, 40),
    defaultVideoDuration: cleanText(input.defaultVideoDuration).slice(0, 40),
    defaultAudioModel: cleanText(input.defaultAudioModel).slice(0, 120),
    defaultAudioVoice: cleanText(input.defaultAudioVoice).slice(0, 160),
    defaultAudioEmotion: cleanText(input.defaultAudioEmotion).slice(0, 40),
  };
}

export function extractLegacyUserProfileFromWorkspaceState(state: unknown): UserProfilePayload | null {
  if (!state || typeof state !== "object") return null;

  const source = state as Record<string, unknown>;
  const profile: UserProfilePayload = {};

  if (typeof source.userNickname === "string") profile.nickname = source.userNickname;
  if (typeof source.userPhone === "string") profile.phone = source.userPhone;
  if (typeof source.userAvatarUrl === "string") profile.avatarUrl = source.userAvatarUrl;
  if (typeof source.userLanguage === "string") profile.language = source.userLanguage;
  if (typeof source.notifyOnGenerationComplete === "boolean") profile.notifyOnGenerationComplete = source.notifyOnGenerationComplete;
  if (typeof source.autoSaveHistory === "boolean") profile.autoSaveHistory = source.autoSaveHistory;
  if (typeof source.previewWheelZoom === "boolean") profile.previewWheelZoom = source.previewWheelZoom;
  if (typeof source.previewWheelFlip === "boolean") profile.previewWheelFlip = source.previewWheelFlip;

  return Object.keys(profile).length > 0 ? profile : null;
}

export function stripUserProfileFromWorkspaceState(state: unknown) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;

  const nextState = { ...(state as Record<string, unknown>) };
  delete nextState.userNickname;
  delete nextState.userPhone;
  delete nextState.userAvatarUrl;
  delete nextState.userLanguage;
  delete nextState.notifyOnGenerationComplete;
  delete nextState.autoSaveHistory;
  delete nextState.previewWheelZoom;
  delete nextState.previewWheelFlip;
  return nextState;
}

export async function migrateLegacyUserProfileFromWorkspace(userId: string, state: unknown) {
  const legacyProfile = extractLegacyUserProfileFromWorkspaceState(state);
  if (!legacyProfile) return;

  const data = normalizeUserProfileInput(legacyProfile);
  await prisma.user.update({ where: { id: userId }, data });
}
