"use client";

import { useMemo, useState, useTransition } from "react";
import { RiSearchLine } from "react-icons/ri";
import { SmallStat, UserAvatar, type AdminUserRow } from "@/app/admin/admin-users-panel";

/**
 * 后台「帐号功能管理」。
 *
 * 布局照抄「用户管理」，但**只管功能开关**：去掉了积分 / 最近IP / 最后登录时间 / 状态四列，
 * 也不带展开详情与各种弹窗（那些属于用户管理的职责，别在这里复制第二份）。
 *
 * 三个开关：
 *  - 通用模式    → User.generalModeEnabled（老功能，本页只是多一个入口）
 *  - 解除限制    → User.unlockLimitsEnabled（2026-07-30 从全局开关改成按账号）
 *  - 后台白名单  → `.env.local` 的 ADMIN_EMAILS（不在 User 表上）
 *
 * 标题栏那三个总开关是**批量操作**：一键把当前所有账号设成同一个值，之后仍可单独调。
 */

export type AdminAccountFeatureRow = Pick<AdminUserRow, "id" | "email" | "nickname" | "phone" | "avatarUrl"> & {
  generalModeEnabled: boolean;
  unlockLimitsEnabled: boolean;
  adminWhitelisted: boolean;
};

export type AdminAccountFeatureStats = {
  totalUsers: number;
  generalModeUsers: number;
  unlockLimitsUsers: number;
  whitelistUsers: number;
};

type FeatureKey = "generalMode" | "unlockLimits" | "adminWhitelist";

const PAGE_SIZE = 15;

// `bulk`：该列表头是否显示「一键全开」总开关。
// ⛔ 后台白名单**故意不给总开关**（2026-07-30 用户要求隐藏）：一键全开等于让全站所有人都能进后台，
//    风险太高、又几乎没有真实使用场景。白名单只能一个一个点。
const featureColumns: Array<{ key: FeatureKey; label: string; field: keyof Pick<AdminAccountFeatureRow, "generalModeEnabled" | "unlockLimitsEnabled" | "adminWhitelisted">; bulk: boolean }> = [
  { key: "generalMode", label: "通用模式", field: "generalModeEnabled", bulk: true },
  { key: "unlockLimits", label: "解除限制", field: "unlockLimitsEnabled", bulk: true },
  { key: "adminWhitelist", label: "后台白名单", field: "adminWhitelisted", bulk: false },
];

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function FeatureSwitch({ checked, disabled, onClick, ariaLabel, title }: { checked: boolean; disabled?: boolean; onClick: () => void; ariaLabel: string; title?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}
      aria-label={ariaLabel}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function AdminAccountFeaturesPanel({ users, stats }: { users: AdminAccountFeatureRow[]; stats: AdminAccountFeatureStats }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  // 批量操作的确认弹框 / 出错提示，都用项目通用弹框样式（不用浏览器原生 confirm / alert）。
  const [bulkConfirm, setBulkConfirm] = useState<{ feature: FeatureKey; enabled: boolean; title: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matched = keyword
      ? users.filter((user) => [user.id, user.email, user.nickname ?? "", user.phone ?? ""].some((item) => item.toLowerCase().includes(keyword)))
      : users;
    // ⭐ 排序：开着的开关越多越靠前（用户要求）；同样多时按邮箱稳定排，避免每次刷新乱跳。
    return [...matched].sort((left, right) => {
      const rightCount = Number(right.generalModeEnabled) + Number(right.unlockLimitsEnabled) + Number(right.adminWhitelisted);
      const leftCount = Number(left.generalModeEnabled) + Number(left.unlockLimitsEnabled) + Number(left.adminWhitelisted);
      if (rightCount !== leftCount) return rightCount - leftCount;
      return left.email.localeCompare(right.email);
    });
  }, [query, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filteredUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredUsers.length);

  const enabledCountByFeature: Record<FeatureKey, number> = {
    generalMode: stats.generalModeUsers,
    unlockLimits: stats.unlockLimitsUsers,
    adminWhitelist: stats.whitelistUsers,
  };

  function toggleSingle(user: AdminAccountFeatureRow, feature: FeatureKey) {
    startTransition(async () => {
      const request =
        feature === "generalMode"
          ? { url: "/admin/api/users/general-mode", body: { userId: user.id, generalModeEnabled: !user.generalModeEnabled } }
          : feature === "unlockLimits"
            ? { url: "/admin/api/users/unlock-limits", body: { userId: user.id, unlockLimitsEnabled: !user.unlockLimitsEnabled } }
            : { url: "/admin/api/users/admin-whitelist", body: { userId: user.id, whitelisted: !user.adminWhitelisted } };
      const response = await fetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error || "操作失败，请重试");
        return;
      }
      window.location.reload();
    });
  }

  function toggleBulk(feature: FeatureKey, label: string) {
    const total = stats.totalUsers;
    const allEnabled = total > 0 && enabledCountByFeature[feature] >= total;
    const nextEnabled = !allEnabled;
    // ⭐ 用项目通用的确认弹框（样式对齐工作流「删除节点」那个：白卡片 + 右下"取消 / 黑色长按钮 确定"），
    //    不用浏览器原生 window.confirm（会显示 "localhost:3000 显示" 这种系统字样、样式也不统一）。
    setBulkConfirm({
      feature,
      enabled: nextEnabled,
      title: nextEnabled ? `打开全部帐号的「${label}」` : `关闭全部帐号的「${label}」`,
      message: nextEnabled
        ? `确定把全部 ${formatNumber(total)} 个帐号的「${label}」都打开吗？`
        : `确定把全部 ${formatNumber(total)} 个帐号的「${label}」都关闭吗？`,
    });
  }

  function runBulk(feature: FeatureKey, enabled: boolean) {
    startTransition(async () => {
      const response = await fetch("/admin/api/users/feature-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, enabled }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error || "操作失败，请重试");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">帐号功能管理</h1>
        <div className="flex h-9 w-[240px] items-center rounded-[9px] border border-[#e9e9e9] bg-white px-3">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="ID / 邮箱 / 昵称 / 手机"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#222222] outline-none placeholder:text-[#b0b0b0]"
          />
          <RiSearchLine className="ml-2 h-4 w-4 shrink-0 text-[#999999]" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SmallStat label="总用户数量" value={formatNumber(stats.totalUsers)} tone="blue" />
        <SmallStat label="通用模式开启" value={formatNumber(stats.generalModeUsers)} />
        <SmallStat label="解除限制开启" value={formatNumber(stats.unlockLimitsUsers)} />
        <SmallStat label="后台白名单" value={formatNumber(stats.whitelistUsers)} />
      </div>

      <div className="mt-3 min-w-[900px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-[13px]">
          <thead className="bg-[#fafafa] text-[#777777]">
            <tr>
              <th className="w-[150px] border-b border-[#eeeeee] py-3 pl-6 pr-4 font-medium">用户ID</th>
              <th className="w-[320px] border-b border-[#eeeeee] px-4 py-3 font-medium">用户</th>
              {/* ⭐ 每列表头右侧那个开关 = 该功能的总开关（一键把所有帐号全开/全关）。
                  放在表头是为了和下面每一行的单账号开关上下对齐，一眼看出"这一列全开"。 */}
              {featureColumns.map((column) => {
                const allEnabled = stats.totalUsers > 0 && enabledCountByFeature[column.key] >= stats.totalUsers;
                return (
                  <th key={column.key} className="w-[160px] border-b border-[#eeeeee] px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.bulk ? (
                        <FeatureSwitch
                          checked={allEnabled}
                          disabled={isPending || stats.totalUsers === 0}
                          onClick={() => toggleBulk(column.key, column.label)}
                          ariaLabel={`${column.label}总开关（一键全开）`}
                          title={allEnabled ? `点击关闭全部帐号的「${column.label}」` : `点击打开全部帐号的「${column.label}」`}
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedUsers.length > 0 ? (
              pagedUsers.map((user) => (
                <tr key={user.id} className="text-[#333333] transition hover:bg-[#fcfcfc]">
                  <td className="border-b border-[#f2f2f2] py-3 pl-6 pr-4 font-mono text-[12px] text-[#777777]">{user.id}</td>
                  <td className="border-b border-[#f2f2f2] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#222222]">{user.email}</div>
                        <div className="mt-0.5 truncate text-[12px] text-[#888888]">{user.nickname || "未设置昵称"}</div>
                      </div>
                    </div>
                  </td>
                  {featureColumns.map((column) => (
                    <td key={column.key} className="border-b border-[#f2f2f2] px-4 py-3">
                      <FeatureSwitch checked={Boolean(user[column.field])} disabled={isPending} onClick={() => toggleSingle(user, column.key)} ariaLabel={`${column.label}开关`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2 + featureColumns.length} className="px-4 py-12 text-center text-[13px] text-[#999999]">
                  当前没有匹配用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex min-w-[900px] items-center justify-between px-1 py-1 text-[13px] text-[#777777]">
        <div>
          共 {formatNumber(filteredUsers.length)} 条，当前显示 {rangeStart}-{rangeEnd} 条
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]">
            <span style={{ fontSize: 13 }}>上一页</span>
          </button>
          <div className="min-w-[72px] text-center text-[#333333]">
            {currentPage} / {totalPages}
          </div>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]">
            <span style={{ fontSize: 13 }}>下一页</span>
          </button>
        </div>
      </div>

      {/* 通用确认弹框：样式与工作流「删除节点」确认框一致（白卡片 + 右下"取消 / 黑色长按钮 确定"）。 */}
      {bulkConfirm ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-8 py-8 backdrop-blur-[2px]" onPointerDown={(event) => { if (event.target === event.currentTarget) setBulkConfirm(null); }}>
          <div className="w-[380px] rounded-[14px] bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
            <div className="text-[15px] font-semibold text-[#111111]">{bulkConfirm.title}</div>
            <div className="mt-3 whitespace-pre-line text-[13px] leading-6 text-[#555555]">{bulkConfirm.message}</div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkConfirm(null)} className="rounded-lg border border-[#ddd] px-4 py-2 text-[13px] text-[#444] hover:bg-[#f5f5f5]">取消</button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const target = bulkConfirm;
                  setBulkConfirm(null);
                  runBulk(target.feature, target.enabled);
                }}
                className="rounded-lg bg-[#111] px-12 py-2 text-[13px] font-medium text-white transition hover:bg-[#252525] disabled:cursor-not-allowed disabled:bg-[#cfcfcf]"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 出错提示：同一套弹框样式，只有一个「确定」按钮。 */}
      {errorMessage ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-8 py-8 backdrop-blur-[2px]" onPointerDown={(event) => { if (event.target === event.currentTarget) setErrorMessage(""); }}>
          <div className="w-[380px] rounded-[14px] bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
            <div className="text-[15px] font-semibold text-[#111111]">操作未完成</div>
            <div className="mt-3 whitespace-pre-line text-[13px] leading-6 text-[#555555]">{errorMessage}</div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setErrorMessage("")} className="rounded-lg bg-[#111] px-12 py-2 text-[13px] font-medium text-white transition hover:bg-[#252525]">确定</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
