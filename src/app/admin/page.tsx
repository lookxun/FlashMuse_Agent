import { getAdminEmails, isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { bytePlusImageGenerationModels, bytePlusVideoGenerationModels, imageGenerationModels, videoGenerationModels } from "@/lib/models";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AdminActivityTracker } from "./admin-activity-tracker";
import { AdminLogoutButton } from "./admin-logout-button";
import { AdminLoginForm } from "./admin-login-form";
import { AdminCreditsPanel, type AdminCreditUser } from "./admin-credits-panel";
import { AdminRecordsPanel, type AdminRecordSummary } from "./admin-records-panel";
import { AdminServerInfoPanel } from "./admin-server-info-panel";
import { AdminSystemSettingsPanel } from "./admin-system-settings-panel";
import { AdminGenerationSettingsPanel } from "./admin-generation-settings-panel";
import { AdminUploadRulesPanel } from "./admin-upload-rules-panel";
import { AdminOverview2 } from "./admin-overview-2";
import { getAdminOverviewData } from "@/lib/admin-overview";
import { AdminUsersPanel, type AdminUserRow } from "./admin-users-panel";
import { AdminGptImageThumbnail } from "./admin-gpt-image-thumbnail";
import { getCreditSettings } from "@/lib/credits";
import { getAdminSystemSettings, getUploadRuleOverrides } from "@/lib/system-settings";
import type { IconType } from "react-icons";
import { RiDashboardLine, RiFileList3Line, RiListSettingsLine, RiServerLine, RiSettingsLine, RiToggleLine, RiUser3Line, RiVipDiamondLine } from "react-icons/ri";

export const dynamic = "force-dynamic";

type AdminTab = "overview" | "users" | "credits" | "records" | "settings" | "generation" | "upload-rules" | "gpt-image-optimization" | "server";

const adminNavItems: Array<{ key: AdminTab; label: string; icon: IconType }> = [
  { key: "overview", label: "概览", icon: RiDashboardLine },
  { key: "users", label: "用户管理", icon: RiUser3Line },
  { key: "credits", label: "积分管理", icon: RiVipDiamondLine },
  { key: "records", label: "生成记录", icon: RiFileList3Line },
  { key: "settings", label: "模型开关", icon: RiToggleLine },
  { key: "generation", label: "系统设置", icon: RiSettingsLine },
  { key: "upload-rules", label: "上传规则", icon: RiListSettingsLine },
  { key: "gpt-image-optimization", label: "GPT生图优化", icon: RiFileList3Line },
  { key: "server", label: "服务器信息", icon: RiServerLine },
];

function getAdminTab(value: string | string[] | undefined): AdminTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "users" || tab === "credits" || tab === "records" || tab === "settings" || tab === "generation" || tab === "upload-rules" || tab === "gpt-image-optimization" || tab === "server") return tab;
  return "overview";
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function getUserLatestLoginActivity(user: { lastLoginAt: Date | null; sessions: Array<{ lastSeenAt: Date }> }) {
  const times = [user.lastLoginAt?.getTime() ?? 0, user.sessions[0]?.lastSeenAt?.getTime() ?? 0].filter((time) => time > 0);
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function formatAdminMediaName(systemName: string | undefined, userName: string | undefined, fallback: string) {
  const system = (systemName ?? "").trim();
  const user = (userName ?? "").trim();
  if (system && user && user !== system) return `${system} / ${user}`;
  return system || user || fallback;
}

function normalizeMediaUrlForAdmin(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getModelLabel(type: "image" | "video", modelId: string) {
  const models = type === "image" ? [...imageGenerationModels, ...bytePlusImageGenerationModels] : [...videoGenerationModels, ...bytePlusVideoGenerationModels];
  return models.find((model) => model.id === modelId)?.label ?? modelId;
}

function getDeletedAssetInfoMap(state: unknown) {
  void state;
  return new Map<string, { deletedAtLabel?: string }>();
}

function buildAdminWorkspaceState(state: unknown, sessionRows: Array<{ sessionId: string; title: string; updatedAt: Date; deletedAt: Date | null; messagesJson: unknown; summaryJson: unknown; usageSummary: unknown; memorySummary: unknown }>, messageRows: Array<{ sessionId: string; messageJson: unknown; createdAt: Date }>) {
  if (sessionRows.length === 0) return state;
  const messagesBySession = new Map<string, unknown[]>();
  for (const row of [...messageRows].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
    const messages = messagesBySession.get(row.sessionId) ?? [];
    messages.push(row.messageJson);
    messagesBySession.set(row.sessionId, messages);
  }

  const sessions = sessionRows.map((row) => {
    const summary = isRecord(row.summaryJson) ? row.summaryJson : {};
    const messages = messagesBySession.get(row.sessionId) ?? (Array.isArray(row.messagesJson) ? row.messagesJson : []);
    return {
      ...summary,
      id: row.sessionId,
      title: row.title,
      updatedAt: row.updatedAt.getTime(),
      deletedAt: row.deletedAt ? row.deletedAt.getTime() : undefined,
      messages,
      usageSummary: row.usageSummary,
      memorySummary: row.memorySummary,
    };
  });

  return { ...(isRecord(state) ? state : {}), sessions };
}

function isAdminVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function isVideoPosterLikeMedia(url: string, name: string, mediaType: string) {
  return mediaType !== "video" && (/\/video-posters\//.test(normalizeMediaUrlForAdmin(url)) || /^video_/i.test(name));
}

function getWorkspaceRecordsSummary(state: unknown) {
  const summary = {
    conversationCount: 0,
    conversationDeletedCount: 0,
    imageGenerationCount: 0,
    imageGenerationDeletedCount: 0,
    videoGenerationCount: 0,
    videoGenerationDeletedCount: 0,
    uploadImageCount: 0,
    uploadImageDeletedCount: 0,
    uploadFileCount: 0,
    uploadFileDeletedCount: 0,
    latestRecordTs: 0,
  };

  if (!isRecord(state)) return summary;

  const deletedAssetInfoMap = getDeletedAssetInfoMap(state);

  if (!Array.isArray(state.sessions)) return summary;
  summary.conversationCount = state.sessions.filter(isRecord).length;

  for (const session of state.sessions.filter(isRecord)) {
    if (finiteNumber(session.deletedAt) > 0) summary.conversationDeletedCount += 1;
    summary.latestRecordTs = Math.max(summary.latestRecordTs, finiteNumber(session.updatedAt), finiteNumber(session.createdAt));
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];

    for (const message of messages) {
      summary.latestRecordTs = Math.max(summary.latestRecordTs, finiteNumber(message.createdAt));
      if (message.role === "user") {
        const uploadedImages = getStringArray(message.images).filter((url) => /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(normalizeMediaUrlForAdmin(url)));
        summary.uploadImageCount += uploadedImages.length;
        const uploadedFiles = Array.isArray(message.uploadedFiles) ? message.uploadedFiles.length : 0;
        summary.uploadFileCount += uploadedFiles;
      }
      if (message.role !== "assistant") continue;

      const imageSlotUrls = Array.isArray(message.imageResultSlots)
        ? message.imageResultSlots.filter(isRecord).filter((slot) => slot.type === "image").map((slot) => getString(slot.url)).filter(Boolean)
        : [];
      const imageUrls = imageSlotUrls.length > 0 ? imageSlotUrls : getStringArray(message.images);
      for (const url of imageUrls) {
        summary.imageGenerationCount += 1;
        if (deletedAssetInfoMap.has(url) || deletedAssetInfoMap.has(normalizeMediaUrlForAdmin(url))) summary.imageGenerationDeletedCount += 1;
      }

      const videoUrl = getString(message.videoUrl);
      const videoUrls = videoUrl ? [...getStringArray(message.videos), videoUrl].filter((url, index, array) => array.indexOf(url) === index) : getStringArray(message.videos);
      for (const url of videoUrls) {
        summary.videoGenerationCount += 1;
        if (deletedAssetInfoMap.has(url) || deletedAssetInfoMap.has(normalizeMediaUrlForAdmin(url))) summary.videoGenerationDeletedCount += 1;
      }
    }
  }

  return summary;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMediaAssetRecordsSummary(assetStates: any[]) {
  const summary = { imageGenerationCount: 0, imageGenerationDeletedCount: 0, videoGenerationCount: 0, videoGenerationDeletedCount: 0, uploadImageCount: 0, uploadImageDeletedCount: 0, savedAssetCount: 0, latestRecordTs: 0 };
  for (const state of assetStates) {
    const media = state?.mediaAsset;
    if (!media?.url || media.archivedAt || state.hiddenAt) continue;
    const category = getString(state.currentCategory);
    const isDeleted = Boolean(state.deletedAt);
    const systemName = getString(media.systemName) || getString(media.initialName);
    const currentName = getString(state.currentName);
    const displayName = formatAdminMediaName(systemName, currentName && currentName !== systemName ? currentName : undefined, "媒体");
    if (isVideoPosterLikeMedia(media.url, displayName, getString(media.mediaType))) continue;

    const mediaType = media.mediaType === "video" || isAdminVideoUrl(media.url) ? "video" : "image";
    const isUpload = category === "conversation_uploads" || getString(media.sourceKind).includes("upload");
    const ts = media.firstSeenAt instanceof Date ? media.firstSeenAt.getTime() : media.createdAt instanceof Date ? media.createdAt.getTime() : 0;
    summary.latestRecordTs = Math.max(summary.latestRecordTs, ts, state.updatedAt instanceof Date ? state.updatedAt.getTime() : 0);
    summary.savedAssetCount += 1;
    if (isUpload && mediaType !== "video") {
      summary.uploadImageCount += 1;
      if (isDeleted) summary.uploadImageDeletedCount += 1;
    } else if (mediaType === "video") {
      summary.videoGenerationCount += 1;
      if (isDeleted) summary.videoGenerationDeletedCount += 1;
    } else {
      summary.imageGenerationCount += 1;
      if (isDeleted) summary.imageGenerationDeletedCount += 1;
    }
  }
  return summary;
}

function AdminShell({ adminEmail, activeTab, children }: { adminEmail: string; activeTab: AdminTab; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#111111]">
      <AdminActivityTracker />
      <div className="grid min-h-screen min-w-[1464px] grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-screen flex-col border-r border-[#e6e6e6] bg-white px-4 py-5">
          <div>
            <div className="mb-8 flex items-center gap-2 px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home-assets/logo.png" alt="闪念" className="h-9 w-9 rounded-[9px] object-contain" />
              <div>
                <div className="text-[15px] font-semibold leading-5">闪念后台</div>
                <div className="text-[11px] text-[#8a8a8a]">FlashMuse Admin</div>
              </div>
            </div>
            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link key={item.key} href={item.key === "overview" ? "/admin" : `/admin?tab=${item.key}`} className={`flex h-9 items-center gap-2 rounded-[9px] px-3 text-[13px] font-medium transition ${activeTab === item.key ? "bg-[#111111] text-white" : "text-[#555555] hover:bg-[#f1f1f1] hover:text-[#111111]"}`}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mt-auto rounded-[14px] border border-[#eeeeee] bg-[#fafafa] p-3">
            <div className="text-[12px] text-[#999999]">当前管理员</div>
            <div className="mt-1 truncate text-[13px] font-medium text-[#333333]">{adminEmail}</div>
            <AdminLogoutButton />
          </div>
        </aside>
        <section className="min-w-0 px-8 py-6">
          {children}
        </section>
      </div>
    </main>
  );
}


type AdminGptImageOptimizationCase = {
  id: string;
  attemptsUsed: number;
  originalPrompt: string;
  optimizedPrompt: string;
  imageUrl: string;
  sourceModel: string;
  optimizerModel: string;
  mediaName: string;
  parameterLine: string;
  createdAt: Date;
  user: { email: string; userId: string };
};

type GptImagePromptOptimizationCaseRow = {
  id: string;
  attemptsUsed: number;
  originalPrompt: string;
  optimizedPrompt: string;
  imageUrl: string;
  sourceModel: string;
  optimizerModel: string;
  createdAt: Date;
  user: { id: string; email: string };
  mediaSystemName: string | null;
  mediaInitialName: string | null;
  mediaCurrentName: string | null;
  mediaModel: string | null;
  mediaRatio: string | null;
  mediaResolution: string | null;
  mediaImageSize: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaPreviewMeta: unknown;
  mediaGenerationSettings: unknown;
};

function getGptImageOptimizationParameterLine(item: GptImagePromptOptimizationCaseRow & { userId: string; email: string }) {
  const previewMeta = isRecord(item.mediaPreviewMeta) ? item.mediaPreviewMeta : undefined;
  const generationSettings = isRecord(item.mediaGenerationSettings) ? item.mediaGenerationSettings : undefined;
  const model = getModelLabel("image", item.mediaModel || item.sourceModel);
  const ratio = item.mediaRatio || getString(previewMeta?.ratio) || getString(generationSettings?.ratio) || "-";
  const resolution = item.mediaResolution || getString(previewMeta?.resolution) || getString(generationSettings?.resolution) || "-";
  const size = item.mediaWidth && item.mediaHeight ? `${item.mediaWidth} × ${item.mediaHeight}` : item.mediaImageSize || getString(previewMeta?.sizeText) || "-";
  return [model, ratio, resolution, size].filter((value) => value && value !== "-").join(" / ") || "-";
}

function AdminGptImageOptimizationPanel({ cases }: { cases: AdminGptImageOptimizationCase[] }) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">GPT生图优化</h1>
        <div className="mt-2 text-[12px] leading-5 text-[#888888]">记录工作流 GPT-5.4 Image 2 安全改写重试后成功的案例。预览页和媒体表保存真实成功生图提示词。</div>
      </div>
      <section className="min-w-[1180px] overflow-visible rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[80px_360px_360px_250px_130px] rounded-t-[10px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] font-medium text-[#777777]">
          <div className="px-4 py-3">尝试次数</div>
          <div className="px-4 py-3">原提示词</div>
          <div className="px-4 py-3">AI成功提示词</div>
          <div className="px-4 py-3">信息</div>
          <div className="px-4 py-3">缩略图</div>
        </div>
        {cases.length > 0 ? cases.map((item) => (
          <div key={item.id} className="grid grid-cols-[80px_360px_360px_250px_130px] border-b border-[#f2f2f2] align-top text-[12px] leading-5 text-[#444444] last:border-b-0">
            <div className="px-4 py-4 font-semibold text-[#111111]">{item.attemptsUsed} 次</div>
            <div className="whitespace-pre-wrap break-words px-4 py-4 text-[#333333]">{item.originalPrompt}</div>
            <div className="whitespace-pre-wrap break-words px-4 py-4 text-[#111111]">{item.optimizedPrompt}</div>
            <div className="px-4 py-4">
              <div className="break-words text-[12px] font-semibold text-[#222222]">{item.mediaName}</div>
              <div className="mt-1 break-words text-[11px] text-[#777777]">{item.parameterLine}</div>
              <div className="mt-2 text-[11px] text-[#888888]">{formatDate(item.createdAt)}</div>
              <div className="mt-1 text-[11px] text-[#aaaaaa]">{item.user.email} / {item.user.userId}</div>
              <div className="mt-1 text-[11px] text-[#aaaaaa]">改写：{item.optimizerModel}</div>
            </div>
            <div className="px-4 py-4"><AdminGptImageThumbnail imageUrl={item.imageUrl} /></div>
          </div>
        )) : <div className="px-5 py-8 text-center text-[13px] text-[#999999]">暂无成功案例</div>}
      </section>
    </>
  );
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ tab?: string | string[] }> }) {
  const adminEmails = getAdminEmails();
  const currentAdminEmail = await getCurrentAdminEmail();
  const activeTab = getAdminTab((await searchParams)?.tab);

  if (!currentAdminEmail) {
    return <AdminLoginForm hasAdminEmails={adminEmails.length > 0} />;
  }

  if (!isAdminEmail(currentAdminEmail)) {
    return <AdminLoginForm hasAdminEmails={adminEmails.length > 0} initialMessage={`当前账号 ${currentAdminEmail} 不在后台白名单中，请使用管理员邮箱登录`} />;
  }

  if (activeTab === "settings") {
    const systemSettings = getAdminSystemSettings();
    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminSystemSettingsPanel settings={systemSettings} adminEmailCount={adminEmails.length} />
      </AdminShell>
    );
  }

  if (activeTab === "generation") {
    const systemSettings = getAdminSystemSettings();
    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminGenerationSettingsPanel settings={systemSettings} />
      </AdminShell>
    );
  }

  if (activeTab === "upload-rules") {
    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminUploadRulesPanel initialUploadRuleOverrides={getUploadRuleOverrides()} />
      </AdminShell>
    );
  }

  if (activeTab === "gpt-image-optimization") {
    const cases = await prisma.$queryRaw<Array<GptImagePromptOptimizationCaseRow & { userId: string; email: string }>>`SELECT c."id", c."attemptsUsed", c."originalPrompt", c."optimizedPrompt", c."imageUrl", c."sourceModel", c."optimizerModel", c."createdAt", c."userId", u."email", m."systemName" AS "mediaSystemName", m."initialName" AS "mediaInitialName", uas."currentName" AS "mediaCurrentName", m."model" AS "mediaModel", m."ratio" AS "mediaRatio", m."resolution" AS "mediaResolution", m."imageSize" AS "mediaImageSize", m."width" AS "mediaWidth", m."height" AS "mediaHeight", m."previewMeta" AS "mediaPreviewMeta", m."generationSettings" AS "mediaGenerationSettings" FROM "GptImagePromptOptimizationCase" c INNER JOIN "User" u ON u."id" = c."userId" LEFT JOIN "MediaAsset" m ON m."id" = c."mediaAssetId" OR (m."userId" = c."userId" AND m."normalizedUrl" = regexp_replace(split_part(split_part(c."imageUrl", '?', 1), '#', 1), '^https?://[^/]+', '')) LEFT JOIN "UserAssetState" uas ON uas."userId" = c."userId" AND uas."mediaAssetId" = m."id" ORDER BY c."createdAt" DESC LIMIT 200`;
    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminGptImageOptimizationPanel cases={cases.map((item) => ({
          id: item.id,
          attemptsUsed: item.attemptsUsed,
          originalPrompt: item.originalPrompt,
          optimizedPrompt: item.optimizedPrompt,
          imageUrl: item.imageUrl,
          sourceModel: item.sourceModel,
          optimizerModel: item.optimizerModel,
          mediaName: formatAdminMediaName(item.mediaSystemName ?? item.mediaInitialName ?? undefined, item.mediaCurrentName ?? undefined, "图片生成"),
          parameterLine: getGptImageOptimizationParameterLine(item),
          createdAt: item.createdAt,
          user: { email: item.email, userId: item.userId },
        }))} />
      </AdminShell>
    );
  }

  if (activeTab === "server") {
    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminServerInfoPanel />
      </AdminShell>
    );
  }

  if (activeTab === "users") {
    const [users, totalUsers, todayUsers, disabledUsers, userTotals] = await Promise.all([
      prisma.user.findMany({
        orderBy: { updatedAt: "desc" },
        take: 1000,
        include: {
          workspace: { select: { updatedAt: true } },
          workspaceSessions: { select: { deletedAt: true } },
          sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
          _count: { select: { sessions: true } },
        },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.user.count({ where: { disabled: true } }),
      prisma.user.aggregate({ _sum: { credits: true } }),
    ]);
    const normalUsers = totalUsers - disabledUsers;
    const rows: AdminUserRow[] = users.sort((left, right) => {
      const rightLoginTime = getUserLatestLoginActivity(right)?.getTime() ?? 0;
      const leftLoginTime = getUserLatestLoginActivity(left)?.getTime() ?? 0;
      if (rightLoginTime !== leftLoginTime) return rightLoginTime - leftLoginTime;
      return right.createdAt.getTime() - left.createdAt.getTime();
    }).map((user) => ({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      language: user.language,
      credits: user.credits,
      disabled: user.disabled,
      generalModeEnabled: user.generalModeEnabled,
      generatedImageCount: user.generatedImageCount,
      generatedVideoCount: user.generatedVideoCount,
      conversationCount: user.workspaceSessions.filter((session) => !session.deletedAt).length,
      consumedCredits: 0,
      consumedTokens: 0,
      consumedAmountLabel: "$0.0000 / ¥0.00",
      notifyOnGenerationComplete: user.notifyOnGenerationComplete,
      autoSaveHistory: user.autoSaveHistory,
      previewWheelZoom: user.previewWheelZoom,
      previewWheelFlip: user.previewWheelFlip,
      hasPassword: Boolean(user.passwordHash),
      createdAtLabel: formatDate(user.createdAt),
      updatedAtLabel: formatDate(user.updatedAt),
      lastLoginAtLabel: formatDate(getUserLatestLoginActivity(user)),
      lastLoginIp: user.lastLoginIp,
      lastLoginLocation: user.lastLoginLocation,
      lastLoginUserAgent: user.lastLoginUserAgent,
      workspaceSaved: Boolean(user.workspace),
      workspaceUpdatedAtLabel: formatDate(user.workspace?.updatedAt),
      sessionCount: user._count.sessions,
      lastSessionSeenAtLabel: formatDate(user.sessions[0]?.lastSeenAt),
      conversations: [],
      mediaItems: [],
      assetMediaItems: [],
    }));

    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminUsersPanel users={rows} stats={{ totalUsers, todayUsers, normalUsers, disabledUsers, totalCredits: userTotals._sum.credits || 0 }} />
      </AdminShell>
    );
  }

  if (activeTab === "credits") {
    const [users, creditSettings, creditLedgers, userTotals] = await Promise.all([
      prisma.user.findMany({ orderBy: { updatedAt: "desc" }, take: 1000, select: { id: true, email: true, nickname: true, avatarUrl: true, credits: true } }),
      getCreditSettings(),
      prisma.creditLedger.findMany({ orderBy: { createdAt: "desc" }, select: { userId: true, direction: true, kind: true, credits: true, totalTokens: true, usd: true, cny: true, createdAt: true } }),
      prisma.user.aggregate({ _sum: { credits: true } }),
    ]);
    const creditLedgersByUser = creditLedgers.reduce((map, ledger) => {
      const items = map.get(ledger.userId) ?? [];
      items.push(ledger);
      map.set(ledger.userId, items);
      return map;
    }, new Map<string, typeof creditLedgers>());
    const latestCreditTsByUser = creditLedgers.reduce((map, ledger) => {
      map.set(ledger.userId, Math.max(map.get(ledger.userId) ?? 0, ledger.createdAt.getTime()));
      return map;
    }, new Map<string, number>());
    const increasedCredits = creditLedgers.filter((item) => item.direction === "increase").reduce((sum, item) => sum + item.credits, 0);
    const rows: AdminCreditUser[] = users.map((user) => {
      const ledgers = creditLedgersByUser.get(user.id) ?? [];
      const consumed = ledgers.filter((item) => item.direction === "consume");
      return {
        id: user.id,
        userEmail: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        currentCredits: user.credits,
        giftedCredits: ledgers.filter((item) => item.direction === "increase").reduce((sum, item) => sum + item.credits, 0),
        signupGiftedCredits: ledgers.filter((item) => item.direction === "increase" && item.kind === "signup").reduce((sum, item) => sum + item.credits, 0),
        adminAdjustedGiftedCredits: ledgers.filter((item) => item.direction === "increase" && item.kind === "admin_adjust").reduce((sum, item) => sum + item.credits, 0),
        consumedCredits: consumed.reduce((sum, item) => sum + item.credits, 0),
        consumedTokens: consumed.reduce((sum, item) => sum + item.totalTokens, 0),
        consumedUsd: consumed.reduce((sum, item) => sum + item.usd, 0),
        consumedCny: consumed.reduce((sum, item) => sum + item.cny, 0),
        conversationConsumedCredits: 0,
        assetGenerationConsumedCredits: 0,
        promptToolConsumedCredits: 0,
        workflowConsumedCredits: 0,
        conversationCreditDetails: [],
        assetGenerationCreditDetails: [],
        promptToolCreditDetails: [],
        workflowCreditDetails: [],
        currentCreditDetails: [],
        lastActiveLabel: ledgers[0] ? formatShortDate(ledgers[0].createdAt) : "-",
      };
    }).sort((left, right) => {
      const timeDiff = (latestCreditTsByUser.get(right.id) ?? 0) - (latestCreditTsByUser.get(left.id) ?? 0);
      if (timeDiff !== 0) return timeDiff;
      return left.userEmail.localeCompare(right.userEmail);
    });

    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminCreditsPanel settings={{ usdToCnyRate: creditSettings.usdToCnyRate, creditsPerCny: creditSettings.creditsPerCny, signupCredits: creditSettings.signupCredits, chargeText: creditSettings.chargeText, chargeImage: creditSettings.chargeImage, chargeVideo: creditSettings.chargeVideo, chargePromptTool: creditSettings.chargePromptTool }} stats={{ totalUserCredits: userTotals._sum.credits || 0, increasedCredits }} rows={rows} />
      </AdminShell>
    );
  }

  if (activeTab === "records") {
    const [recordUsers, recordLedgers] = await Promise.all([
      prisma.user.findMany({
        orderBy: { updatedAt: "desc" },
        take: 1000,
        include: {
          workspace: { select: { state: true, updatedAt: true } },
          workspaceSessions: { orderBy: { updatedAt: "desc" }, select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, messagesJson: true, summaryJson: true, usageSummary: true, memorySummary: true } },
          workspaceMessages: { orderBy: { createdAt: "asc" }, select: { sessionId: true, messageJson: true, createdAt: true } },
          userAssetStates: { where: { hiddenAt: null, mediaAsset: { archivedAt: null } }, include: { mediaAsset: true }, orderBy: { updatedAt: "desc" } },
          workspaceWorkflows: { select: { deletedAt: true } },
        },
      }),
      prisma.creditLedger.findMany({ where: { direction: "consume" }, orderBy: { createdAt: "desc" }, select: { userId: true, createdAt: true } }),
    ]);

    const latestModelInteractionTsByUser = recordLedgers.reduce((map, ledger) => {
      map.set(ledger.userId, Math.max(map.get(ledger.userId) ?? 0, ledger.createdAt.getTime()));
      return map;
    }, new Map<string, number>());

    const summaries: AdminRecordSummary[] = recordUsers.map((user) => {
      const workspaceState = buildAdminWorkspaceState(user.workspace?.state, user.workspaceSessions, user.workspaceMessages);
      const recordSummary = getWorkspaceRecordsSummary(workspaceState);
      const mediaSummary = getMediaAssetRecordsSummary(user.userAssetStates);
      return {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        conversationCount: recordSummary.conversationCount,
        conversationDeletedCount: recordSummary.conversationDeletedCount,
        workflowCount: user.workspaceWorkflows.filter((workflow) => !workflow.deletedAt).length,
        workflowDeletedCount: user.workspaceWorkflows.filter((workflow) => Boolean(workflow.deletedAt)).length,
        imageGenerationCount: Math.max(user.generatedImageCount, mediaSummary.imageGenerationCount, recordSummary.imageGenerationCount),
        imageGenerationDeletedCount: mediaSummary.imageGenerationDeletedCount,
        videoGenerationCount: Math.max(user.generatedVideoCount, mediaSummary.videoGenerationCount, recordSummary.videoGenerationCount),
        videoGenerationDeletedCount: mediaSummary.videoGenerationDeletedCount,
        uploadImageCount: mediaSummary.uploadImageCount || recordSummary.uploadImageCount,
        uploadImageDeletedCount: mediaSummary.uploadImageDeletedCount,
        uploadFileCount: recordSummary.uploadFileCount,
        uploadFileDeletedCount: recordSummary.uploadFileDeletedCount,
        latestRecordTs: latestModelInteractionTsByUser.get(user.id) ?? 0,
      };
    });

    return (
      <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
        <AdminRecordsPanel summaries={summaries} />
      </AdminShell>
    );
  }

  const overviewData = await getAdminOverviewData();
  return (
    <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
      <AdminOverview2 data={overviewData} />
    </AdminShell>
  );
}