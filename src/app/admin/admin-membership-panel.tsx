"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RiArrowDownSLine, RiArrowRightSLine, RiCheckLine, RiCloseLine, RiFileCopyLine, RiLeafLine, RiSearchLine, RiSeedlingLine, RiShining2Fill, RiTreeLine } from "react-icons/ri";
import { DetailItem, SmallStat, UserAvatar } from "@/app/admin/admin-users-panel";
import { useBodyScrollLock } from "@/components/use-body-scroll-lock";
import { ModelIcon } from "@/components/model-icon";
import {
  MEMBERSHIP_FIRST_MONTH_DISCOUNT_PERIODS,
  MEMBERSHIP_IMAGE_RESOLUTIONS,
  MEMBERSHIP_PERIOD_LABELS,
  MEMBERSHIP_PERIODS,
  MEMBERSHIP_SYSTEM_ENABLED,
  MEMBERSHIP_TIER_LABELS,
  MEMBERSHIP_TIERS,
  MEMBERSHIP_VIDEO_RESOLUTIONS,
  DEFAULT_MEMBERSHIP_SETTINGS,
  type CreditPack,
  type MembershipFirstMonthDiscountPeriod,
  type MembershipImageResolution,
  type MembershipSettings,
  type MembershipTier,
  type MembershipVideoResolution,
} from "@/lib/membership";
import { getDemoRechargeHistory, ledgerToMembershipCharge, type CreditChargeRecord, type MembershipChargeRecord } from "@/lib/membership-purchase-records";

export type AdminMembershipRow = {
  id: string;
  email: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  credits: number;
  membershipTier: MembershipTier;
  membershipPeriod: string;
  membershipExpiresAtLabel: string;
  membershipCredits: number;
};

type MembershipModelOption = { id: string; label: string };

const PAGE_SIZE = 15;

function MembershipTierBadge({ tier }: { tier: MembershipTier }) {
  const Icon = tier === "pro" ? RiTreeLine : tier === "standard" ? RiSeedlingLine : RiLeafLine;
  const shell = tier === "pro"
    ? "border-[#e4d0a4] bg-[linear-gradient(100deg,#fffdf8_0%,#fbf4e4_54%,#f3e4c0_100%)] text-[#c9a227]"
    : tier === "standard"
      ? "border-[#cfd6de] bg-[linear-gradient(100deg,#ffffff_0%,#f7f9fb_54%,#e8eef4_100%)] text-[#9aa8b6]"
      : "border-[#e1cbb6] bg-[linear-gradient(100deg,#ffffff_0%,#fbfaf7_54%,#f2eee6_100%)] text-[#c6b19d]";
  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-[6px] border px-2 text-[12px] font-medium leading-none ${shell}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {MEMBERSHIP_TIER_LABELS[tier]}
    </span>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function SettingSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function NumberField({ value, disabled, onChange, onBlur, widthClass = "w-[88px]" }: { value: number; disabled?: boolean; onChange: (value: number) => void; onBlur?: () => void; widthClass?: string }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "") || 0))}
      onBlur={onBlur}
      className={`h-8 ${widthClass} rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-center text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]`}
    />
  );
}

function LockedNumberRow({ label, value, locked, pending, onValue, onLock, onBlur }: { label: string; value: number; locked: boolean; pending: boolean; onValue: (value: number) => void; onLock: (locked: boolean) => void; onBlur: () => void }) {
  return (
    <div className="flex h-8 items-center justify-between gap-3">
      <span className="text-[#777777]">{label}</span>
      <div className="flex items-center gap-2">
        <NumberField value={value} disabled={pending || locked || !MEMBERSHIP_SYSTEM_ENABLED} onChange={onValue} onBlur={onBlur} />
        <SettingSwitch checked={locked} disabled={pending || !MEMBERSHIP_SYSTEM_ENABLED} onChange={onLock} ariaLabel={`${label}开关`} />
      </div>
    </div>
  );
}

function toggleListValue<T extends string>(list: T[], value: T, checked: boolean) {
  if (checked) return list.includes(value) ? list : [...list, value];
  return list.filter((item) => item !== value);
}

function RechargeHistoryDialog({
  user,
  kind,
  history,
  onClose,
}: {
  user: AdminMembershipRow;
  kind: "membership" | "credits";
  history: { membership: MembershipChargeRecord[]; credits: CreditChargeRecord[] };
  onClose: () => void;
}) {
  useBodyScrollLock(true);
  const [adminGrants, setAdminGrants] = useState<MembershipChargeRecord[] | null>(null);
  const [paidCredits, setPaidCredits] = useState<CreditChargeRecord[] | null>(null);
  const [copiedOrderNo, setCopiedOrderNo] = useState("");
  const copyOrderNo = (orderNo: string) => {
    void navigator.clipboard?.writeText(orderNo).then(() => {
      setCopiedOrderNo(orderNo);
      window.setTimeout(() => setCopiedOrderNo((current) => (current === orderNo ? "" : current)), 1000);
    }).catch(() => undefined);
  };
  useEffect(() => {
    if (kind !== "membership") return;
    let cancelled = false;
    void fetch(`/admin/api/membership/grants?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { grants?: Array<{ id: string; createdAt: string; credits: number; metadata?: Record<string, unknown> | null }> }) => {
        if (cancelled) return;
        const rows = (data.grants ?? []).map(ledgerToMembershipCharge).filter((item): item is MembershipChargeRecord => Boolean(item));
        setAdminGrants(rows);
      })
      .catch(() => {
        if (!cancelled) setAdminGrants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, user.id]);
  useEffect(() => {
    if (kind !== "credits") return;
    let cancelled = false;
    void fetch(`/admin/api/membership/credit-orders?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { credits?: CreditChargeRecord[] }) => {
        if (cancelled) return;
        setPaidCredits(Array.isArray(data.credits) ? data.credits : []);
      })
      .catch(() => {
        if (!cancelled) setPaidCredits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, user.id]);
  const membershipRows = [...history.membership, ...(adminGrants ?? [])].sort((left, right) => right.at.localeCompare(left.at));
  const creditRows = paidCredits ?? [];
  const title = kind === "membership" ? "会员充值" : "积分充值";
  const displayName = user.nickname || user.email;
  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overscroll-contain bg-black/42 px-8 py-8 backdrop-blur-[4px]">
      <div className="flex h-[min(720px,calc(100vh-64px))] w-[min(1180px,calc(100vw-64px))] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <header className="relative flex h-[60px] shrink-0 items-center border-b border-[#eeeeee] px-6 pr-14">
          <div className="truncate text-[14px] font-semibold text-[#111111]">{displayName} · {title}</div>
          <button type="button" onClick={onClose} className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label={`关闭${title}`}>
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {kind === "membership" ? (
            membershipRows.length > 0 ? (
              <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
                <thead className="text-[#888888]">
                  <tr>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">订单号</th>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">开通时间</th>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">档位</th>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">周期</th>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">标价</th>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">实付</th>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">折扣</th>
                    <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">已发放积分</th>
                    <th className="border-b border-[#eeeeee] py-2 font-medium">到期</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipRows.map((item) => (
                    <tr key={item.orderNo} className="text-[#333333]">
                      <td className="border-b border-[#f2f2f2] py-3 pr-3 font-mono text-[12px] text-[#555555]">{item.orderNo}</td>
                      <td className="border-b border-[#f2f2f2] py-3 pr-3 text-[#777777]">{item.at}</td>
                      <td className="border-b border-[#f2f2f2] py-3 pr-3"><MembershipTierBadge tier={item.tier} /></td>
                      <td className="border-b border-[#f2f2f2] py-3 pr-3">{item.period}</td>
                      <td className="border-b border-[#f2f2f2] py-3 pr-3">¥{item.listPriceCny}</td>
                      <td className={`border-b border-[#f2f2f2] py-3 pr-3 ${item.adminGrant ? "font-medium text-red-500" : ""}`}>{item.adminGrant ? "后台赠送" : `¥${item.paidCny}`}</td>
                      <td className="border-b border-[#f2f2f2] py-3 pr-3 text-[#888888]">{item.discountLabel}</td>
                      <td className="border-b border-[#f2f2f2] py-3 pr-3">{formatNumber(item.creditsGranted)}</td>
                      <td className="border-b border-[#f2f2f2] py-3 text-[#777777]">{item.expiresAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="py-16 text-center text-[13px] text-[#999999]">暂无会员充值</div>
          ) : creditRows.length > 0 ? (
            <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
              <thead className="text-[#888888]">
                <tr>
                  <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">订单号</th>
                  <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">时间</th>
                  <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">实付</th>
                  <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">到账积分</th>
                  <th className="border-b border-[#eeeeee] py-2 pr-3 font-medium">汇率</th>
                  <th className="border-b border-[#eeeeee] py-2 font-medium">付款情况</th>
                </tr>
              </thead>
              <tbody>
                {creditRows.map((item) => {
                  const payStatus = item.payStatus ?? "unpaid";
                  const payLabel = payStatus === "paid" ? "付款成功" : payStatus === "pending" ? "待支付" : "未付款";
                  const payClass = payStatus === "paid" ? "text-[#22a06b]" : payStatus === "pending" ? "text-[#d4a017]" : "text-[#e24c4c]";
                  return (
                  <tr key={item.orderNo} className="text-[#333333]">
                    <td className="border-b border-[#f2f2f2] py-3 pr-3 font-mono text-[12px] text-[#555555]">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{item.orderNo}</span>
                        <button type="button" onClick={() => copyOrderNo(item.orderNo)} className="flex h-5 w-5 shrink-0 items-center justify-center text-[#888888]" aria-label={copiedOrderNo === item.orderNo ? "已复制" : "复制订单编号"}>
                          {copiedOrderNo === item.orderNo ? <RiCheckLine className="h-3.5 w-3.5 text-[#111111]" /> : <RiFileCopyLine className="h-3.5 w-3.5" />}
                        </button>
                      </span>
                    </td>
                    <td className="border-b border-[#f2f2f2] py-3 pr-3 text-[#777777]">{item.at}</td>
                    <td className="border-b border-[#f2f2f2] py-3 pr-3">¥{item.payCny}</td>
                    <td className="border-b border-[#f2f2f2] py-3 pr-3">{formatNumber(item.credits)}</td>
                    <td className="border-b border-[#f2f2f2] py-3 pr-3 text-[#888888]">{item.rateLabel}</td>
                    <td className={`border-b border-[#f2f2f2] py-3 font-medium ${payClass}`}>{payLabel}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <div className="py-16 text-center text-[13px] text-[#999999]">暂无积分充值</div>}
        </div>
      </div>
    </div>
  );
}

const GRANT_PERIODS: Array<{ id: "monthly" | "quarter" | "year"; label: string }> = [
  { id: "monthly", label: "月卡" },
  { id: "quarter", label: "季卡" },
  { id: "year", label: "年卡" },
];

function GrantMembershipDialog({ user, top, left, onClose }: { user: AdminMembershipRow; top: number; left: number; onClose: () => void }) {
  useBodyScrollLock(true);
  const [period, setPeriod] = useState<"monthly" | "quarter" | "year">("monthly");
  const [tier, setTier] = useState<MembershipTier>("standard");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const submit = () => {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/admin/api/membership/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, tier, period }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(data.error || "赠送失败");
        return;
      }
      window.location.reload();
    });
  };
  return (
    <div className="fixed inset-0 z-[11000] overscroll-contain" onMouseDown={onClose}>
      <div className="absolute w-[420px] -translate-y-1/2 rounded-[12px] bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.22)]" style={{ top, left }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[#222222]">{user.nickname || "未设置昵称"}</div>
            <div className="mt-0.5 truncate text-[12px] text-[#888888]">{user.email}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#222222]">
            <RiShining2Fill className="h-4 w-4 text-[#555555]" aria-hidden="true" />
            {formatNumber(user.credits)}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {GRANT_PERIODS.map((item) => (
            <div key={item.id} className="flex flex-col items-center gap-2 rounded-[10px] border border-[#eeeeee] bg-[#fafafa] px-2 py-3">
              <div className="text-[13px] font-medium text-[#222222]">{item.label}</div>
              <SettingSwitch checked={period === item.id} onChange={() => setPeriod(item.id)} ariaLabel={item.label} />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {MEMBERSHIP_TIERS.map((item) => (
            <div key={item} className="flex flex-col items-center gap-2 rounded-[10px] border border-[#eeeeee] px-2 py-3">
              <MembershipTierBadge tier={item} />
              <SettingSwitch checked={tier === item} onChange={() => setTier(item)} ariaLabel={MEMBERSHIP_TIER_LABELS[item]} />
            </div>
          ))}
        </div>
        {message ? <div className="mt-3 text-center text-[12px] text-red-500">{message}</div> : null}
        <button type="button" disabled={isPending} onClick={submit} className="mt-5 flex h-10 w-full items-center justify-center rounded-[8px] bg-[#111111] text-[13px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#cfcfcf]">
          {isPending ? "保存中..." : "确定"}
        </button>
      </div>
    </div>
  );
}

function MembershipUserList({ users, query }: { users: AdminMembershipRow[]; query: string }) {
  const [page, setPage] = useState(1);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(() => new Set());
  const [historyDialog, setHistoryDialog] = useState<{ user: AdminMembershipRow; kind: "membership" | "credits" } | null>(null);
  const [grantPopover, setGrantPopover] = useState<{ user: AdminMembershipRow; top: number; left: number } | null>(null);
  const [adminGrantCounts, setAdminGrantCounts] = useState<Record<string, number>>({});
  const [paidCreditStats, setPaidCreditStats] = useState<Record<string, { count: number; credits: number }>>({});
  useEffect(() => {
    setPage(1);
  }, [query]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/admin/api/membership/credit-orders", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { counts?: Record<string, { count: number; credits: number }> }) => {
        if (cancelled || !data.counts) return;
        setPaidCreditStats(data.counts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const toggleExpandedUser = (userId: string) => {
    setExpandedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    if (adminGrantCounts[userId] === undefined) {
      void fetch(`/admin/api/membership/grants?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { grants?: unknown[] }) => {
          setAdminGrantCounts((current) => ({ ...current, [userId]: Array.isArray(data.grants) ? data.grants.length : 0 }));
        })
        .catch(() => {
          setAdminGrantCounts((current) => ({ ...current, [userId]: 0 }));
        });
    }
  };
  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => [user.id, user.email, user.nickname ?? "", user.phone ?? ""].some((item) => item.toLowerCase().includes(keyword)));
  }, [query, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filteredUsers.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredUsers.length);
  const standardCount = users.filter((user) => user.membershipTier === "standard").length;
  const proCount = users.filter((user) => user.membershipTier === "pro").length;

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <SmallStat label="用户数" value={formatNumber(users.length)} tone="blue" />
        <SmallStat label="标准会员" value={formatNumber(standardCount)} />
        <SmallStat label="高级会员" value={formatNumber(proCount)} />
      </div>

      <div className="mt-3 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-[13px]">
          <thead className="bg-[#fafafa] text-[#777777]">
            <tr>
              <th className="w-[44px] border-b border-[#eeeeee] py-3 pl-6 pr-0 font-medium" />
              <th className="w-[135px] border-b border-[#eeeeee] py-3 pl-2 pr-4 font-medium">用户ID</th>
              <th className="w-[290px] border-b border-[#eeeeee] px-4 py-3 font-medium">用户</th>
              <th className="w-[120px] border-b border-[#eeeeee] px-4 py-3 font-medium">积分</th>
              <th className="border-b border-[#eeeeee] px-4 py-3 font-medium">会员档</th>
              <th className="border-b border-[#eeeeee] px-4 py-3 font-medium">周期</th>
              <th className="border-b border-[#eeeeee] px-4 py-3 font-medium">到期时间</th>
              <th className="border-b border-[#eeeeee] px-4 py-3 font-medium">会员积分</th>
              <th className="w-[106px] border-b border-[#eeeeee] py-3 pl-4 pr-8 font-medium" />
            </tr>
          </thead>
          <tbody>
            {pagedUsers.length > 0 ? (
              pagedUsers.map((user) => {
                const isExpanded = expandedUserIds.has(user.id);
                const history = getDemoRechargeHistory(user.email);
                const paidCredit = paidCreditStats[user.id] ?? { count: 0, credits: 0 };
                const permanentRemaining = Math.max(0, user.credits - user.membershipCredits);
                const rechargeCredits = Math.min(paidCredit.credits, permanentRemaining);
                const giftedCredits = Math.max(0, permanentRemaining - rechargeCredits);
                return (
                <Fragment key={user.id}>
                  <tr className="cursor-pointer text-[#333333] transition hover:bg-[#fcfcfc]" onClick={() => toggleExpandedUser(user.id)}>
                    <td className="border-b border-[#f2f2f2] py-3 pl-6 pr-0 text-left">
                      <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpandedUser(user.id); }} className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label={isExpanded ? "收起充值记录" : "展开充值记录"}>
                        {isExpanded ? <RiArrowDownSLine className="h-5 w-5" /> : <RiArrowRightSLine className="h-5 w-5" />}
                      </button>
                    </td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-2 pr-4 font-mono text-[12px] text-[#777777]">{user.id}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-[#222222]">{user.email}</div>
                          <div className="mt-0.5 truncate text-[12px] text-[#888888]">{user.nickname || "未设置昵称"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 font-medium">{formatNumber(user.credits)}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3"><MembershipTierBadge tier={user.membershipTier} /></td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-[#777777]">{user.membershipPeriod || "—"}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-[#777777]">{user.membershipExpiresAtLabel}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3">{formatNumber(user.membershipCredits)}</td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-3 pr-8 text-right">
                      <button type="button" disabled={!MEMBERSHIP_SYSTEM_ENABLED} onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setGrantPopover({ user, top: rect.top + rect.height / 2, left: Math.max(12, rect.left - 432) }); }} className="h-7 whitespace-nowrap rounded-[7px] border border-[#e7e7e7] bg-white px-2.5 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]"><span style={{ fontSize: 12 }}>调会员</span></button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[#fbfbfb]">
                      <td colSpan={9} className="border-b border-[#f2f2f2] px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <div className="grid grid-cols-4 gap-[5px] px-1 py-1 text-left">
                          <div className="space-y-px">
                            <DetailItem label="当前档位" value={MEMBERSHIP_TIER_LABELS[user.membershipTier]} />
                            <DetailItem label="周期" value={user.membershipPeriod || "—"} />
                            <DetailItem label="到期时间" value={user.membershipExpiresAtLabel} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="总积分" value={formatNumber(user.credits)} />
                            <DetailItem label="会员积分" value={formatNumber(user.membershipCredits)} />
                            <DetailItem label="充值积分" value={formatNumber(rechargeCredits)} />
                            <DetailItem label="赠送积分" value={formatNumber(giftedCredits)} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="会员充值" value={`${history.membership.length + (adminGrantCounts[user.id] ?? 0)} 笔`} onClick={MEMBERSHIP_SYSTEM_ENABLED ? () => setHistoryDialog({ user, kind: "membership" }) : undefined} />
                            <DetailItem label="积分充值" value={`${paidCredit.count} 笔`} onClick={() => setHistoryDialog({ user, kind: "credits" })} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[13px] text-[#999999]">
                  当前没有匹配用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex min-w-[1180px] items-center justify-between px-1 py-1 text-[13px] text-[#777777]">
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
      {historyDialog ? <RechargeHistoryDialog user={historyDialog.user} kind={historyDialog.kind} history={{ membership: getDemoRechargeHistory(historyDialog.user.email).membership, credits: [] }} onClose={() => setHistoryDialog(null)} /> : null}
      {grantPopover ? <GrantMembershipDialog user={grantPopover.user} top={grantPopover.top} left={grantPopover.left} onClose={() => setGrantPopover(null)} /> : null}
    </>
  );
}

function MembershipSettingsPanel({
  initialSettings,
  imageModels,
  videoModels,
}: {
  initialSettings: MembershipSettings;
  imageModels: MembershipModelOption[];
  videoModels: MembershipModelOption[];
}) {
  const [draft, setDraft] = useState(initialSettings ?? DEFAULT_MEMBERSHIP_SETTINGS);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  // updater 里只把「要保存的那份」记进 ref，真正发请求在下面的 effect 里做（updater 必须是纯函数）。
  const pendingSaveRef = useRef<MembershipSettings | null>(null);

  useEffect(() => {
    setDraft(initialSettings ?? DEFAULT_MEMBERSHIP_SETTINGS);
  }, [initialSettings]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/admin/api/membership-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { settings?: MembershipSettings }) => {
        if (cancelled || !data.settings) return;
        setDraft(data.settings);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = (next: MembershipSettings) => {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/membership-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: next }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; settings?: MembershipSettings };
        if (!response.ok || !data.settings) throw new Error(data.error || "保存失败");
        setDraft(data.settings);
        setMessage("已保存");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  // ⛔ 副作用（save = 发 POST）**不许写在 setState updater 里**：React 可能重跑 updater → 重复提交。
  // 唯一正解：updater 里只把「要保存的那份」记进 ref，draft 落地后由这个 effect 真正提交。
  useEffect(() => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    save(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const patchTier = (tier: MembershipTier, patch: Partial<MembershipSettings["tiers"][MembershipTier]>, saveNow = false) => {
    setDraft((current) => {
      const next: MembershipSettings = {
        ...current,
        tiers: {
          ...current.tiers,
          [tier]: { ...current.tiers[tier], ...patch },
        },
      };
      if (saveNow) pendingSaveRef.current = next;
      return next;
    });
  };

  const patchDiscount = (period: MembershipFirstMonthDiscountPeriod, patch: Partial<MembershipSettings["firstMonthDiscounts"][MembershipFirstMonthDiscountPeriod]>, saveNow = false) => {
    setDraft((current) => {
      const next: MembershipSettings = {
        ...current,
        firstMonthDiscounts: {
          ...current.firstMonthDiscounts,
          [period]: { ...current.firstMonthDiscounts[period], ...patch },
        },
      };
      if (saveNow) pendingSaveRef.current = next;
      return next;
    });
  };

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="text-[13px] text-[#888888]">三档权益、模型开关、连续包月首月折扣。改完即时保存，全站生成链路一起吃。</div>
        {message ? <div className="text-[13px] text-[#777777]">{message}</div> : null}
      </div>

      <div className="mb-5 rounded-[12px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="text-[16px] font-semibold">连续包月首月折扣</div>
        <div className="mt-1 text-[13px] text-[#888888]">只作用于连续包月 / 包季 / 包年。百分比按折算，87 = 8.7折。每账号每种周期只用一次，支付接上后再卡。</div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {MEMBERSHIP_FIRST_MONTH_DISCOUNT_PERIODS.map((period) => {
            const discount = draft.firstMonthDiscounts[period];
            if (!discount) return null;
            return (
              <div key={period} className="rounded-[10px] border border-[#f0f0f0] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-medium">{MEMBERSHIP_PERIOD_LABELS[period]}</div>
                  <SettingSwitch checked={discount.enabled} disabled={isPending || !MEMBERSHIP_SYSTEM_ENABLED} onChange={(checked) => patchDiscount(period, { enabled: checked }, true)} ariaLabel={`${MEMBERSHIP_PERIOD_LABELS[period]}首月折扣`} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-[#777777]">折扣（折×10）</span>
                   <NumberField value={discount.percent} disabled={isPending || discount.enabled || !MEMBERSHIP_SYSTEM_ENABLED} onChange={(value) => patchDiscount(period, { percent: value })} onBlur={() => patchDiscount(period, { percent: discount.percent }, true)} />
                </div>
                <div className="mt-2 text-[12px] text-[#999999]">{discount.enabled ? `限时${(discount.percent / 10).toFixed(1).replace(/\.0$/, "")}折` : "未开启"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
          {MEMBERSHIP_TIERS.map((tier) => {
          const config = draft.tiers[tier];
          if (!config) return null;
          return (
            <div key={tier} className="rounded-[12px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
              <div className="text-[16px] font-semibold">{MEMBERSHIP_TIER_LABELS[tier]}</div>
              <div className="mt-4 space-y-3 text-[13px]">
                <LockedNumberRow
                  label="每月积分"
                  value={config.monthlyCredits}
                  locked={config.monthlyCreditsLocked}
                  pending={isPending}
                  onValue={(value) => patchTier(tier, { monthlyCredits: value })}
                  onLock={(locked) => patchTier(tier, { monthlyCreditsLocked: locked }, true)}
                  onBlur={() => patchTier(tier, { monthlyCredits: config.monthlyCredits }, true)}
                />
                <LockedNumberRow
                  label="¥10 兑换积分"
                  value={config.creditsPerCny * 10}
                  locked={config.creditsPerCnyLocked}
                  pending={isPending}
                  onValue={(value) => patchTier(tier, { creditsPerCny: Math.max(1, Math.floor(value / 10)) })}
                  onLock={(locked) => patchTier(tier, { creditsPerCnyLocked: locked }, true)}
                  onBlur={() => patchTier(tier, { creditsPerCny: config.creditsPerCny }, true)}
                />
                <LockedNumberRow
                  label="同时生成（并发）"
                  value={config.concurrency}
                  locked={config.concurrencyLocked}
                  pending={isPending}
                  onValue={(value) => patchTier(tier, { concurrency: value })}
                  onLock={(locked) => patchTier(tier, { concurrencyLocked: locked }, true)}
                  onBlur={() => patchTier(tier, { concurrency: config.concurrency }, true)}
                />
                {MEMBERSHIP_PERIODS.map((period) => {
                  const price = config.prices[period];
                  const empty = tier === "free";
                  return (
                    <div key={period} className="flex h-8 items-center justify-between gap-3">
                      <span className="text-[#777777]">{MEMBERSHIP_PERIOD_LABELS[period]}价格</span>
                      {empty ? (
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-[88px] rounded-[8px] border border-transparent" />
                          <div className="h-5 w-9" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <NumberField value={price.priceCny} disabled={isPending || price.locked || !MEMBERSHIP_SYSTEM_ENABLED} onChange={(value) => patchTier(tier, { prices: { ...config.prices, [period]: { ...price, priceCny: value } } })} onBlur={() => patchTier(tier, { prices: config.prices }, true)} />
                          <SettingSwitch checked={price.locked} disabled={isPending || !MEMBERSHIP_SYSTEM_ENABLED} onChange={(locked) => patchTier(tier, { prices: { ...config.prices, [period]: { ...price, locked } } }, true)} ariaLabel={`${MEMBERSHIP_PERIOD_LABELS[period]}价格开关`} />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div>
                  <div className="mb-2 text-[#777777]">图片画质</div>
                  <div className="flex flex-wrap gap-2">
                    {MEMBERSHIP_IMAGE_RESOLUTIONS.map((item) => (
                      <label key={item} className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#eeeeee] px-2 py-1 text-[12px]">
                        <input
                          type="checkbox"
                          checked={config.imageResolutions.includes(item)}
                          disabled={isPending || !MEMBERSHIP_SYSTEM_ENABLED}
                          onChange={(event) => patchTier(tier, { imageResolutions: toggleListValue(config.imageResolutions, item as MembershipImageResolution, event.target.checked) }, true)}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[#777777]">视频画质</div>
                  <div className="flex flex-wrap gap-2">
                    {MEMBERSHIP_VIDEO_RESOLUTIONS.map((item) => (
                      <label key={item} className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#eeeeee] px-2 py-1 text-[12px]">
                        <input
                          type="checkbox"
                          checked={config.videoResolutions.includes(item)}
                          disabled={isPending || !MEMBERSHIP_SYSTEM_ENABLED}
                          onChange={(event) => patchTier(tier, { videoResolutions: toggleListValue(config.videoResolutions, item as MembershipVideoResolution, event.target.checked) }, true)}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[#777777]">图片模型</div>
                  <div className="space-y-1">
                    {imageModels.map((model) => (
                      <div key={model.id} className="flex items-center justify-between gap-2 rounded-[8px] px-1 py-1 hover:bg-[#fafafa]">
                        <span className="flex min-w-0 items-center gap-2">
                          <ModelIcon modelId={model.id} />
                          <span className="truncate">{model.label}</span>
                        </span>
                        <SettingSwitch
                          checked={config.allowedImageModelIds.includes(model.id)}
                          disabled={isPending || !MEMBERSHIP_SYSTEM_ENABLED}
                          onChange={(checked) => patchTier(tier, { allowedImageModelIds: toggleListValue(config.allowedImageModelIds, model.id, checked) }, true)}
                          ariaLabel={`${MEMBERSHIP_TIER_LABELS[tier]}-${model.label}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[#777777]">视频模型</div>
                  <div className="space-y-1">
                    {videoModels.map((model) => (
                      <div key={model.id} className="flex items-center justify-between gap-2 rounded-[8px] px-1 py-1 hover:bg-[#fafafa]">
                        <span className="flex min-w-0 items-center gap-2">
                          <ModelIcon modelId={model.id} />
                          <span className="truncate">{model.label}</span>
                        </span>
                        <SettingSwitch
                          checked={config.allowedVideoModelIds.includes(model.id)}
                          disabled={isPending || !MEMBERSHIP_SYSTEM_ENABLED}
                          onChange={(checked) => patchTier(tier, { allowedVideoModelIds: toggleListValue(config.allowedVideoModelIds, model.id, checked) }, true)}
                          ariaLabel={`${MEMBERSHIP_TIER_LABELS[tier]}-${model.label}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CreditPackSettingsPanel({ initialPacks }: { initialPacks: CreditPack[] }) {
  const [draft, setDraft] = useState(initialPacks);
  const [payCnyDrafts, setPayCnyDrafts] = useState(() => initialPacks.map((item) => String(item.payCny)));
  const [creditsDrafts, setCreditsDrafts] = useState(() => initialPacks.map((item) => String(item.credits)));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const pendingSaveRef = useRef<CreditPack[] | null>(null);

  useEffect(() => {
    setDraft(initialPacks);
    setPayCnyDrafts(initialPacks.map((item) => String(item.payCny)));
    setCreditsDrafts(initialPacks.map((item) => String(item.credits)));
  }, [initialPacks]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/admin/api/credit-pack-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { packs?: CreditPack[] }) => {
        if (cancelled || !Array.isArray(data.packs) || data.packs.length === 0) return;
        setDraft(data.packs);
        setPayCnyDrafts(data.packs.map((item) => String(item.payCny)));
        setCreditsDrafts(data.packs.map((item) => String(item.credits)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = (next: CreditPack[]) => {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/credit-pack-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packs: next }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; packs?: CreditPack[] };
        if (!response.ok || !data.packs) throw new Error(data.error || "保存失败");
        setDraft(data.packs);
        setPayCnyDrafts(data.packs.map((item) => String(item.payCny)));
        setCreditsDrafts(data.packs.map((item) => String(item.credits)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  useEffect(() => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    save(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const patchPack = (index: number, patch: Partial<CreditPack>, saveNow = false) => {
    setDraft((current) => {
      const next = current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
      if (saveNow) pendingSaveRef.current = next;
      return next;
    });
  };

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="text-[13px] text-[#888888]">8 档积分包的价格和到账积分。改完即时保存，前台充值页和下单一起吃。最低价 0.01 元。</div>
        {message ? <div className="text-[13px] text-[#777777]">{message}</div> : null}
      </div>
      <div className="rounded-[12px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 border-b border-[#f0f0f0] pb-3 text-[13px] text-[#888888]">
          <div className="w-10">档位</div>
          <div className="w-[88px] text-center">价格（元）</div>
          <div className="w-[88px] text-center">积分</div>
        </div>
        <div className="divide-y divide-[#f5f5f5]">
          {draft.map((pack, index) => (
            <div key={index} className="flex items-center gap-3 py-3">
              <div className="w-10 text-[13px] text-[#555555]">{index + 1}</div>
              <input
                type="text"
                inputMode="decimal"
                value={payCnyDrafts[index] ?? String(pack.payCny)}
                disabled={isPending || pack.locked}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d.]/g, "");
                  setPayCnyDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? raw : item)));
                }}
                onBlur={() => {
                  const next = Number(payCnyDrafts[index]);
                  patchPack(index, { payCny: Number.isFinite(next) ? next : pack.payCny }, true);
                }}
                className="h-8 w-[88px] rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-center text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
              />
              <input
                type="text"
                inputMode="numeric"
                value={creditsDrafts[index] ?? String(pack.credits)}
                disabled={isPending || pack.locked}
                onChange={(event) => {
                  const raw = event.target.value.replace(/\D/g, "");
                  setCreditsDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? raw : item)));
                }}
                onBlur={() => {
                  const next = Number(creditsDrafts[index]);
                  patchPack(index, { credits: Number.isFinite(next) ? Math.floor(next) : pack.credits }, true);
                }}
                className="h-8 w-[88px] rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-center text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
              />
              <SettingSwitch checked={pack.locked} disabled={isPending} onChange={(locked) => patchPack(index, { locked }, true)} ariaLabel={`档位${index + 1}锁定`} />
              <span className="text-[13px] text-[#888888]">{(() => {
                const pay = Number(payCnyDrafts[index]);
                const credits = Number(creditsDrafts[index]);
                if (!Number.isFinite(pay) || pay <= 0 || !Number.isFinite(credits) || credits <= 0) return "1元=—积分";
                const rate = credits / pay;
                const shown = Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/\.?0+$/, "");
                return `1元=${shown}积分`;
              })()}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function AdminMembershipPanel({
  users,
  settings,
  creditPacks,
  imageModels,
  videoModels,
}: {
  users: AdminMembershipRow[];
  settings: MembershipSettings;
  creditPacks: CreditPack[];
  imageModels: MembershipModelOption[];
  videoModels: MembershipModelOption[];
}) {
  const [view, setView] = useState<"users" | "settings" | "credits">("users");
  const [query, setQuery] = useState("");
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          {([
            { key: "users" as const, label: "充值列表" },
            { key: "settings" as const, label: "会员设置" },
            { key: "credits" as const, label: "积分设置" },
          ]).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={`relative ${view === item.key ? "text-[#111111]" : "text-[#bbbbbb] hover:text-[#777777]"}`}
            >
              <span className="text-[24px] font-semibold tracking-[-0.03em]">{item.label}</span>
              {view === item.key ? <span className="absolute inset-x-0 -bottom-1 h-1 bg-[#367cee]" /> : null}
            </button>
          ))}
        </div>
        {view === "users" ? (
          <div className="flex h-9 w-[240px] items-center rounded-[9px] border border-[#e9e9e9] bg-white px-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID / 邮箱 / 昵称 / 手机"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#222222] outline-none placeholder:text-[#b0b0b0]"
            />
            <RiSearchLine className="ml-2 h-4 w-4 shrink-0 text-[#999999]" />
          </div>
        ) : null}
      </div>
      {view === "users" ? <MembershipUserList users={users} query={query} /> : view === "settings" ? <MembershipSettingsPanel key="membership-settings" initialSettings={settings} imageModels={imageModels} videoModels={videoModels} /> : <CreditPackSettingsPanel key="credit-pack-settings" initialPacks={creditPacks} />}
    </div>
  );
}
