"use client";

import { Fragment, useMemo, useState } from "react";
import { RiArrowDownSLine, RiArrowRightSLine, RiSearchLine } from "react-icons/ri";
import { getCachedAdminDetail, setCachedAdminDetail } from "./admin-detail-cache";
import { AdminDetailLoading, AdminHistoryDialog, AdminMediaDialog, DetailItem, SmallStat, type AdminMediaDialogType, type AdminMediaItem, type AdminUserRow } from "./admin-users-panel";
import { CreditCategoryDialog, CreditFlowDialog, type AdminCreditCategoryDetail, type AdminCreditFlowItem, type AdminCreditUser } from "./admin-credits-panel";

const PAGE_SIZE = 15;

export type AdminRecordSummary = {
  id: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
  conversationCount: number;
  conversationDeletedCount: number;
  workflowCount: number;
  workflowDeletedCount: number;
  imageGenerationCount: number;
  imageGenerationDeletedCount: number;
  videoGenerationCount: number;
  videoGenerationDeletedCount: number;
  uploadImageCount: number;
  uploadImageDeletedCount: number;
  uploadFileCount: number;
  uploadFileDeletedCount: number;
  latestRecordTs: number;
};

type AdminRecordDetail = {
  user: AdminUserRow;
  creditUser: AdminCreditUser;
};

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function conversationImageCount(user: AdminUserRow) {
  return user.mediaItems.filter((item) => item.type === "image" && !item.isUploadedAsset).length;
}

function CountWithDeleted({ total, deleted }: { total: number; deleted: number }) {
  return <span>{formatNumber(total)}{deleted > 0 ? <span className="ml-1 text-red-500">({formatNumber(deleted)})</span> : null}</span>;
}

function RecordUserAvatar({ user }: { user: AdminRecordSummary }) {
  if (user.avatarUrl) {
    return (
      <div className="h-9 w-9 overflow-hidden rounded-full bg-[#f1f1f1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt={user.nickname || user.email} className="h-full w-full object-cover" />
      </div>
    );
  }

  const initial = user.email.endsWith("@flashmuse.test") ? "?" : (user.nickname || user.email || "用").trim().slice(0, 1).toUpperCase();

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfe7f4] bg-[#edf4ff] text-[13px] font-semibold text-[#367cee]">
      {initial}
    </div>
  );
}

function makeUploadCategory(id: string, title: string, items: AdminCreditFlowItem[]): AdminCreditCategoryDetail[] {
  return [{ id, title, totalCredits: 0, totalUsd: 0, totalCny: 0, items: [...items].sort((left, right) => right.createdAtTs - left.createdAtTs) }];
}

function normalizeRecordMediaUrl(url: string) {
  return url.split("?")[0].split("#")[0];
}

function makeCreditLookup(items: AdminCreditFlowItem[]) {
  const map = new Map<string, AdminCreditFlowItem>();
  const setPreferred = (key: string, item: AdminCreditFlowItem) => {
    const existing = map.get(key);
    if (!existing || (existing.credits === 0 && item.credits > 0)) map.set(key, item);
  };

  for (const item of items) {
    if (item.isUploadRecord) continue;
    if (item.requestId) setPreferred(item.requestId, item);
    if (!item.url) continue;
    setPreferred(item.url, item);
    setPreferred(normalizeRecordMediaUrl(item.url), item);
  }

  return map;
}

function mediaItemToFlowItem(item: AdminMediaItem, index: number, creditLookup?: Map<string, AdminCreditFlowItem>): AdminCreditFlowItem {
  const isUpload = Boolean(item.isUploadedAsset);
  const creditItem = (item.requestId ? creditLookup?.get(item.requestId) : undefined) ?? creditLookup?.get(item.url) ?? creditLookup?.get(normalizeRecordMediaUrl(item.url));

  return {
    id: item.id || `${item.url}-${index}`,
    requestId: item.id || `${item.url}-${index}`,
    kind: item.type,
    systemName: item.systemName || item.name || "",
    displayName: item.name || item.systemName || (item.type === "video" ? `视频${index + 1}` : `图片${index + 1}`),
    url: item.url,
    status: "success",
    errorText: item.isDeleted ? "用户已删除" : undefined,
    deletedAtLabel: item.deletedAtLabel,
    credits: creditItem?.credits ?? 0,
    expectedCredits: creditItem?.expectedCredits,
    totalTokens: creditItem?.totalTokens ?? 0,
    usd: creditItem?.usd ?? 0,
    cny: creditItem?.cny ?? 0,
    count: 1,
    model: creditItem?.model ?? item.model,
    parameters: isUpload ? item.type === "image" ? "对话流上传" : "对话流上传文件" : [item.model, item.ratio, [item.size, item.resolution].filter((value) => value && value !== "-").join(" "), item.type === "video" ? item.duration : ""].filter((value) => value && value !== "-").join(" | "),
    isUploadRecord: isUpload,
    isChargeDisabled: creditItem?.isChargeDisabled,
    isCreditMissing: !isUpload && !creditItem,
    isCostUnavailable: Boolean(creditItem && !creditItem.isChargeDisabled && creditItem.status !== "failed" && creditItem.credits === 0 && creditItem.usd === 0 && creditItem.cny === 0),
    isReversePrompt: item.isReversePrompt,
    promptText: item.prompt,
    promptConstraints: item.promptConstraints,
    createdAtLabel: item.createdAtTs ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAtTs)) : "-",
    createdAtTs: item.createdAtTs ?? 0,
  };
}

function workspaceConversationGeneratedItems(user: AdminUserRow, creditUser: AdminCreditUser | undefined, kind: "image" | "video") {
  const creditLookup = makeCreditLookup((creditUser?.conversationCreditDetails ?? []).flatMap((conversation) => conversation.mediaItems).filter((item) => item.kind === kind));
  return user.mediaItems.filter((item) => item.type === kind && !item.isUploadedAsset).map((item, index) => mediaItemToFlowItem(item, index, creditLookup));
}

function workspaceAssetGeneratedImageItems(user: AdminUserRow, creditUser: AdminCreditUser | undefined) {
  const creditLookup = makeCreditLookup((creditUser?.assetGenerationCreditDetails ?? []).flatMap((category) => category.items).filter((item) => item.kind === "image"));
  return user.assetMediaItems.filter((item) => item.type === "image" && !item.isUploadedAsset).map((item, index) => mediaItemToFlowItem(item, index, creditLookup));
}

function makeGeneratedCategories(user: AdminUserRow, creditUser: AdminCreditUser | undefined) {
  return [
    makeUploadCategory("conversation-generated-images", "对话流生成图片列表", workspaceConversationGeneratedItems(user, creditUser, "image"))[0],
    makeUploadCategory("conversation-generated-videos", "对话流生成视频列表", workspaceConversationGeneratedItems(user, creditUser, "video"))[0],
    makeUploadCategory("asset-generated-images", "资产库生成图片列表", workspaceAssetGeneratedImageItems(user, creditUser))[0],
  ];
}

function uploadRecordToFlowItem(record: NonNullable<AdminUserRow["uploadRecords"]>[number]): AdminCreditFlowItem {
  const kindLabel = record.kind === "image" ? "上传图片" : record.kind === "video" ? "上传视频" : record.kind === "audio" ? "上传音频" : "上传文档";
  return {
    id: record.id,
    requestId: record.id,
    kind: record.kind === "image" ? "image" : record.kind === "video" ? "video" : "file",
    systemName: record.name || kindLabel,
    displayName: record.name || kindLabel,
    url: record.url,
    status: "success",
    errorText: record.isDeleted ? "用户已删除" : undefined,
    deletedAtLabel: record.deletedAtLabel,
    credits: 0,
    totalTokens: 0,
    usd: 0,
    cny: 0,
    count: 1,
    model: "-",
    parameters: kindLabel,
    isUploadRecord: true,
    createdAtLabel: record.createdAtLabel ?? "-",
    createdAtTs: record.createdAtTs ?? 0,
  };
}

function makeAllUploadCategories(user: AdminUserRow | undefined) {
  const records = user?.uploadRecords ?? [];
  const byKind = (kind: "image" | "video" | "audio" | "document") => records.filter((record) => record.kind === kind).map(uploadRecordToFlowItem);
  return [
    { id: "upload-images", title: "上传图片列表", totalCredits: 0, totalUsd: 0, totalCny: 0, items: byKind("image") },
    { id: "upload-videos", title: "上传视频列表", totalCredits: 0, totalUsd: 0, totalCny: 0, items: byKind("video") },
    { id: "upload-audios", title: "上传音频列表", totalCredits: 0, totalUsd: 0, totalCny: 0, items: byKind("audio") },
    { id: "upload-documents", title: "上传文档列表", totalCredits: 0, totalUsd: 0, totalCny: 0, items: byKind("document") },
  ] as AdminCreditCategoryDetail[];
}

export function AdminRecordsPanel({ summaries }: { summaries: AdminRecordSummary[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(() => new Set());
  const [detailsByUserId, setDetailsByUserId] = useState<Record<string, AdminRecordDetail>>({});
  const [loadingUserIds, setLoadingUserIds] = useState<Set<string>>(() => new Set());
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [historyUser, setHistoryUser] = useState<AdminUserRow | null>(null);
  const [mediaDialog, setMediaDialog] = useState<{ userId: string; userLabel: string; mediaType: AdminMediaDialogType } | null>(null);
  const [creditFlowUser, setCreditFlowUser] = useState<AdminCreditUser | null>(null);
  const [assetCreditUser, setAssetCreditUser] = useState<AdminCreditUser | null>(null);
  const [promptToolUser, setPromptToolUser] = useState<AdminCreditUser | null>(null);
  const [generatedListDialog, setGeneratedListDialog] = useState<{ user: AdminCreditUser; categories: AdminCreditCategoryDetail[]; initialCategoryId: string } | null>(null);
  const [uploadDialog, setUploadDialog] = useState<{ user: AdminCreditUser; categories: AdminCreditCategoryDetail[]; initialCategoryId: string } | null>(null);
  const [loadingDialogTitle, setLoadingDialogTitle] = useState<string | null>(null);

  const rows = useMemo(() => summaries.slice().sort((left, right) => right.latestRecordTs - left.latestRecordTs), [summaries]);

  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((user) => `${user.id} ${user.email} ${user.nickname ?? ""}`.toLowerCase().includes(value));
  }, [query, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filteredRows.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);
  const stats = {
    conversations: rows.reduce((sum, row) => sum + row.conversationCount, 0),
    workflows: rows.reduce((sum, row) => sum + row.workflowCount, 0),
    images: rows.reduce((sum, row) => sum + row.imageGenerationCount, 0),
    videos: rows.reduce((sum, row) => sum + row.videoGenerationCount, 0),
  };
  const isDetailLoading = loadingUserIds.size > 0;

  const fetchUserDetail = async (userId: string, mode: "records" | "full" | "media") => {
    const cached = getCachedAdminDetail<AdminRecordDetail>(userId, mode);
    if (cached) return cached;
    const response = await fetch(`/admin/api/records/user-detail?userId=${encodeURIComponent(userId)}${mode === "full" ? "" : `&mode=${mode}`}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "加载失败");
    const detail = payload.detail as AdminRecordDetail;
    setCachedAdminDetail(userId, mode, detail);
    return detail;
  };

  const loadUserDetail = async (userId: string) => {
    if (detailsByUserId[userId] || loadingUserIds.has(userId)) return;
    setLoadingUserIds((current) => new Set(current).add(userId));
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });

    try {
      const detail = await fetchUserDetail(userId, "records");
      setDetailsByUserId((current) => ({ ...current, [userId]: detail }));
    } catch (error) {
      setDetailErrors((current) => ({ ...current, [userId]: error instanceof Error ? error.message : "加载失败" }));
    } finally {
      setLoadingUserIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  };

  const openHistoryDialog = async (userId: string) => {
    const existingDetail = detailsByUserId[userId];
    if (existingDetail?.user.conversations.some((conversation) => conversation.messages.length > 0)) {
      setHistoryUser(existingDetail.user);
      return;
    }

    setLoadingUserIds((current) => new Set(current).add(userId));
    setLoadingDialogTitle("正在加载历史对话...");
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });

    try {
      const detail = await fetchUserDetail(userId, "full");
      setDetailsByUserId((current) => ({ ...current, [userId]: detail }));
      setHistoryUser(detail.user);
    } catch (error) {
      setDetailErrors((current) => ({ ...current, [userId]: error instanceof Error ? error.message : "加载失败" }));
    } finally {
      setLoadingUserIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      setLoadingDialogTitle(null);
    }
  };

  const loadFullDetailForDialog = async (userId: string, title: string) => {
    const existingDetail = detailsByUserId[userId];
    if (existingDetail?.user.mediaItems.length || existingDetail?.user.assetMediaItems.length || existingDetail?.creditUser.conversationCreditDetails.length || existingDetail?.creditUser.assetGenerationCreditDetails.length) return existingDetail;
    setLoadingUserIds((current) => new Set(current).add(userId));
    setLoadingDialogTitle(title);
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    try {
      const detail = await fetchUserDetail(userId, "full");
      setDetailsByUserId((current) => ({ ...current, [userId]: detail }));
      return detail;
    } catch (error) {
      setDetailErrors((current) => ({ ...current, [userId]: error instanceof Error ? error.message : "加载失败" }));
      return undefined;
    } finally {
      setLoadingUserIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      setLoadingDialogTitle(null);
    }
  };

  const loadMediaDetailForDialog = async (userId: string, title: string) => {
    setLoadingUserIds((current) => new Set(current).add(userId));
    setLoadingDialogTitle(title);
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    try {
      const response = await fetch(`/admin/api/records/user-detail?userId=${encodeURIComponent(userId)}&mode=uploads`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "加载失败");
      return payload.detail as AdminRecordDetail;
    } catch (error) {
      setDetailErrors((current) => ({ ...current, [userId]: error instanceof Error ? error.message : "加载失败" }));
      return undefined;
    } finally {
      setLoadingUserIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      setLoadingDialogTitle(null);
    }
  };

  const toggleExpandedUser = (userId: string) => {
    if (isDetailLoading && !loadingUserIds.has(userId)) return;
    setExpandedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
        void loadUserDetail(userId);
      }
      return next;
    });
  };

  const openGeneratedListDialog = async (userId: string, initialCategoryId: string) => {
    const detail = await loadFullDetailForDialog(userId, "正在加载生成列表...");
    if (!detail) return;
    setGeneratedListDialog({ user: detail.creditUser, categories: makeGeneratedCategories(detail.user, detail.creditUser), initialCategoryId });
  };

  const openMediaDialogForUser = (userId: string, userLabel: string, mediaType: AdminMediaDialogType) => {
    setMediaDialog({ userId, userLabel, mediaType });
  };

  const openAllUploadDialog = async (userId: string, initialCategoryId: string) => {
    const detail = await loadMediaDetailForDialog(userId, "正在加载上传记录...");
    if (!detail) return;
    setUploadDialog({ user: detail.creditUser, categories: makeAllUploadCategories(detail.user), initialCategoryId });
  };

  const openCreditDialogForUser = async (userId: string, type: "conversation" | "asset" | "prompt") => {
    const detail = await loadFullDetailForDialog(userId, "正在加载积分明细...");
    if (!detail) return;
    if (type === "conversation") setCreditFlowUser(detail.creditUser);
    if (type === "asset") setAssetCreditUser(detail.creditUser);
    if (type === "prompt") setPromptToolUser(detail.creditUser);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">生成记录</h1>
        <div className="flex h-9 w-[240px] items-center rounded-[9px] border border-[#e9e9e9] bg-white px-3">
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ID / 邮箱 / 昵称" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#222222] outline-none placeholder:text-[#b0b0b0]" />
          <RiSearchLine className="ml-2 h-4 w-4 shrink-0 text-[#999999]" aria-hidden="true" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SmallStat label="历史对话总数" value={formatNumber(stats.conversations)} tone="blue" />
        <SmallStat label="工作流总数" value={formatNumber(stats.workflows)} tone="blue" />
        <SmallStat label="图片生成总数" value={formatNumber(stats.images)} />
        <SmallStat label="视频生成总数" value={formatNumber(stats.videos)} />
      </div>

      <section className="mt-3 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-[13px]">
          <thead className="bg-[#fafafa] text-[#777777]">
            <tr>
              <th className="w-[44px] border-b border-[#eeeeee] py-3 pl-6 pr-0 font-medium" />
              <th className="w-[135px] border-b border-[#eeeeee] py-3 pl-2 pr-3 font-medium">ID号</th>
              <th className="w-[290px] border-b border-[#eeeeee] px-4 py-3 font-medium">用户</th>
              <th className="w-[152px] border-b border-[#eeeeee] px-4 py-3 text-left font-medium">历史对话</th>
              <th className="w-[152px] border-b border-[#eeeeee] px-4 py-3 text-left font-medium">工作流</th>
              <th className="w-[152px] border-b border-[#eeeeee] px-4 py-3 text-left font-medium">图片生成</th>
              <th className="w-[152px] border-b border-[#eeeeee] py-3 pl-4 pr-8 text-left font-medium">视频生成</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((summary) => {
              const isExpanded = expandedUserIds.has(summary.id);
              const detail = detailsByUserId[summary.id];
              const user = detail?.user;
              const creditUser = detail?.creditUser;
              const isLoading = loadingUserIds.has(summary.id);
              const error = detailErrors[summary.id];
              const isRowDisabled = isDetailLoading && !isLoading;
              const generatedConversationImages = isExpanded && user ? workspaceConversationGeneratedItems(user, creditUser, "image") : [];
              const generatedConversationVideos = isExpanded && user ? workspaceConversationGeneratedItems(user, creditUser, "video") : [];
              const generatedAssetImages = isExpanded && user ? workspaceAssetGeneratedImageItems(user, creditUser) : [];
              const conversationImageTotal = user?.conversationImageCount ?? generatedConversationImages.length;
              const conversationVideoTotal = user?.conversationVideoCount ?? generatedConversationVideos.length;
              const assetImageTotal = user?.assetImageCount ?? generatedAssetImages.length;
              return (
                <Fragment key={summary.id}>
                  <tr onClick={() => toggleExpandedUser(summary.id)} className={`text-[#333333] transition ${isRowDisabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-[#fcfcfc]"}`}>
                    <td className="border-b border-[#f2f2f2] py-3 pl-6 pr-0 text-left">
                      <button type="button" disabled={isRowDisabled} onClick={(event) => { event.stopPropagation(); toggleExpandedUser(summary.id); }} className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111] disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#777777]" aria-label={isExpanded ? "收起生成记录" : "展开生成记录"}>
                        {isExpanded ? <RiArrowDownSLine className="h-5 w-5" /> : <RiArrowRightSLine className="h-5 w-5" />}
                      </button>
                    </td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-2 pr-3 font-mono text-[12px] text-[#777777]">{summary.id}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <RecordUserAvatar user={summary} />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-[#222222]">{summary.email}</div>
                          <div className="mt-0.5 truncate text-[12px] text-[#888888]">{summary.nickname || "未设置昵称"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-left font-medium"><CountWithDeleted total={summary.conversationCount} deleted={summary.conversationDeletedCount} /></td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-left font-medium"><CountWithDeleted total={summary.workflowCount} deleted={summary.workflowDeletedCount} /></td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-left font-medium"><CountWithDeleted total={summary.imageGenerationCount} deleted={summary.imageGenerationDeletedCount} /></td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-4 pr-8 text-left font-medium"><CountWithDeleted total={summary.videoGenerationCount} deleted={summary.videoGenerationDeletedCount} /></td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[#fbfbfb]">
                      <td colSpan={7} className="border-b border-[#f2f2f2] px-4 py-4">
                        {!detail ? error ? <div className="px-3 py-5 text-center text-[13px] text-red-500">加载失败：{error}</div> : isLoading ? <AdminDetailLoading label="正在加载详细记录..." /> : <AdminDetailLoading label="正在准备详细记录..." /> : (
                        <div className="grid grid-cols-4 gap-[5px] px-1 py-1 text-left">
                          <div className="space-y-px">
                            <DetailItem label="历史对话" value={formatNumber(user.conversationCount)} onClick={() => void openHistoryDialog(user.id)} />
                            <DetailItem label="工作区保存" value={user.workspaceSaved ? user.workspaceUpdatedAtLabel : "未保存"} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="资产库图片" value={formatNumber(assetImageTotal)} onClick={() => openMediaDialogForUser(user.id, user.nickname || user.email, "asset_image")} />
                            <DetailItem label="上传图片" value={formatNumber(user.uploadImageCount ?? 0)} onClick={() => void openAllUploadDialog(user.id, "upload-images")} />
                            <DetailItem label="上传视频" value={formatNumber(user.uploadVideoCount ?? 0)} onClick={() => void openAllUploadDialog(user.id, "upload-videos")} />
                            <DetailItem label="上传音频" value={formatNumber(user.uploadAudioCount ?? 0)} onClick={() => void openAllUploadDialog(user.id, "upload-audios")} />
                            <DetailItem label="上传文档" value={formatNumber(user.uploadDocumentCount ?? 0)} onClick={() => void openAllUploadDialog(user.id, "upload-documents")} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="对话流图片" value={formatNumber(conversationImageTotal)} onClick={() => openMediaDialogForUser(user.id, user.nickname || user.email, "image")} />
                            <DetailItem label="对话流视频" value={formatNumber(conversationVideoTotal)} onClick={() => openMediaDialogForUser(user.id, user.nickname || user.email, "video")} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="工作流图片" value={formatNumber(user.workflowImageCount ?? 0)} onClick={() => openMediaDialogForUser(user.id, user.nickname || user.email, "workflow_image")} />
                            <DetailItem label="工作流视频" value={formatNumber(user.workflowVideoCount ?? 0)} onClick={() => openMediaDialogForUser(user.id, user.nickname || user.email, "workflow_video")} />
                          </div>
                        </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {pagedRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-[#999999]">暂无生成记录</td></tr> : null}
          </tbody>
        </table>
      </section>

      <div className="mt-4 flex min-w-[1180px] items-center justify-between px-1 py-1 text-[13px] text-[#777777]">
        <span>共 {formatNumber(filteredRows.length)} 条，当前显示 {rangeStart}-{rangeEnd} 条</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]"><span style={{ fontSize: 13 }}>上一页</span></button>
          <div className="min-w-[72px] text-center text-[#333333]">{safePage} / {totalPages}</div>
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]"><span style={{ fontSize: 13 }}>下一页</span></button>
        </div>
      </div>

      {historyUser ? <AdminHistoryDialog user={historyUser} onClose={() => setHistoryUser(null)} /> : null}
      {mediaDialog ? <AdminMediaDialog userId={mediaDialog.userId} userLabel={mediaDialog.userLabel} mediaType={mediaDialog.mediaType} onClose={() => setMediaDialog(null)} /> : null}
      {creditFlowUser ? <CreditFlowDialog user={creditFlowUser} onClose={() => setCreditFlowUser(null)} /> : null}
      {assetCreditUser ? <CreditCategoryDialog title="资产库消耗积分详细" user={assetCreditUser} categories={assetCreditUser.assetGenerationCreditDetails} onClose={() => setAssetCreditUser(null)} /> : null}
      {promptToolUser ? <CreditCategoryDialog title="反推/优化提示词消耗积分详细" user={promptToolUser} categories={promptToolUser.promptToolCreditDetails} onClose={() => setPromptToolUser(null)} /> : null}
      {generatedListDialog ? <CreditCategoryDialog title="生成列表" user={generatedListDialog.user} categories={generatedListDialog.categories} initialCategoryId={generatedListDialog.initialCategoryId} showPromptCopyColumn onClose={() => setGeneratedListDialog(null)} /> : null}
      {uploadDialog ? <CreditCategoryDialog title="上传记录" user={uploadDialog.user} categories={uploadDialog.categories} initialCategoryId={uploadDialog.initialCategoryId} showPromptCopyColumn onClose={() => setUploadDialog(null)} /> : null}
      {loadingDialogTitle ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/42 px-8 py-8 backdrop-blur-[4px]"><div className="w-[360px] rounded-[12px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]"><AdminDetailLoading label={loadingDialogTitle} /></div></div> : null}
    </>
  );
}
