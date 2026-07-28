"use client";

/**
 * 后台「失败排查」页 —— 排查线上红字（生成失败）的专用工作台。
 *
 * 设计目标不是"再做一个好看的排行"，而是**把排查一条红字所需的信息一次性给全**，
 * 让人不用再来回切页面 / 手写 SQL。对应方法论：handover/07-red-error-triage-and-archive.md。
 *
 * 每条原因给的四件事：
 *   ① 还在流血吗（最近 7 天有没有新发生）→ 决定"该修"还是"该归档"
 *   ② 是不是兜底桶（从文案本身查不出根因，必须回 .runtime 日志捞原文）
 *   ③ 涉及哪些模型 / 哪些入口（只在一个入口出 = 大概率"该统一却分叉了"）
 *   ④ 样本 requestId（可一键复制，拿去 grep 诊断日志）
 *
 * 纯展示 + 前端筛选，绝不写库。归档动作仍只由 scripts/archive-resolved-generation-failures.mjs 执行。
 */

import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import {
  RiAlarmWarningLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCheckboxCircleLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiFilterLine,
  RiHeartPulseLine,
  RiInboxArchiveLine,
  RiQuestionLine,
  RiShieldCheckLine,
  RiUser3Line,
} from "react-icons/ri";
import type { FailureTriageData, FailureTriageReason } from "@/lib/admin-failure-triage";

const n = (value: number) => value.toLocaleString("en-US");

// ⚠️ 这一页**不在客户端做任何日期格式化** —— 服务器与浏览器时区/时钟不同会触发
// hydration mismatch（React #418，2026-07-28 部署测试服时踩到）。所有日期都由
// src/lib/admin-failure-triage.ts 在服务端预格式化成 *Label 字符串传进来。

function KpiCard({ icon: Icon, label, value, note, splits, tone = "#367cee" }: {
  icon: IconType;
  label: string;
  value: string;
  note?: string;
  splits?: Array<{ label: string; value: string }>;
  tone?: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-[#777777]">{label}</div>
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ backgroundColor: `${tone}1a`, color: tone }}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[#111111]">{value}</div>
      {splits && splits.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#9a9a9a]">
          {splits.map((split) => (
            <span key={split.label}>{split.label} <span className="font-medium text-[#555555]">{split.value}</span></span>
          ))}
        </div>
      ) : null}
      {note ? <div className="mt-2 text-[12px] text-[#9a9a9a]">{note}</div> : null}
    </div>
  );
}

function CardShell({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[#111111]">{title}</h2>
          {subtitle ? <div className="mt-0.5 text-[12px] leading-5 text-[#9a9a9a]">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0 text-[12px] text-[#888888]">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Tag({ children, tone = "#888888" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className="inline-flex items-center rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${tone}18`, color: tone }}>
      {children}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-[6px] border border-[#e6e6e6] px-1.5 py-0.5 text-[11px] text-[#666666] transition hover:border-[#111111] hover:text-[#111111]"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      <RiFileCopyLine className="h-3 w-3" aria-hidden="true" />
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function FailureTrend({ trend }: { trend: FailureTriageData["trend"] }) {
  const max = Math.max(1, ...trend.map((point) => point.image + point.video));
  return (
    <>
      <div className="flex h-[150px] items-end gap-[3px] border-b border-[#eeeeee] pb-1">
        {trend.map((point) => {
          const total = point.image + point.video;
          return (
            <div key={point.label} className="group relative flex min-w-0 flex-1 flex-col justify-end" title={`${point.label} 失败 ${total} 条（图片 ${point.image} / 视频 ${point.video}）`}>
              <div className="w-full rounded-t-[3px] bg-[#f0a020]" style={{ height: `${(point.video / max) * 130}px` }} />
              <div className="w-full bg-[#e05656]" style={{ height: `${(point.image / max) * 130}px` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[#999999]">
        <span>{trend[0]?.label}</span>
        <span>{trend[Math.floor(trend.length / 2)]?.label}</span>
        <span>{trend[trend.length - 1]?.label}</span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[12px] text-[#888888]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e05656]" />图片失败</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f0a020]" />视频失败</span>
        <span className="text-[#bbbbbb]">（含已归档，看的是「真实发生过多少次」）</span>
      </div>
    </>
  );
}

function ReasonRow({ item, maxTotal }: { item: FailureTriageReason; maxTotal: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#f2f2f2] last:border-b-0">
      <button type="button" className="flex w-full items-start gap-3 px-1 py-3 text-left transition hover:bg-[#fafafa]" onClick={() => setOpen((value) => !value)}>
        <span className="mt-0.5 w-[54px] shrink-0 text-right text-[15px] font-semibold text-[#111111]">{n(item.total)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] leading-5 text-[#222222]">{item.reason}</span>
            {item.isFallbackBucket ? <Tag tone="#8b5cf6">兜底桶 · 需回日志捞原文</Tag> : null}
            {item.stillBleeding ? <Tag tone="#e05656">近 7 天仍在发生</Tag> : <Tag tone="#18a058">已停止发生</Tag>}
            {item.moderationCount > 0 ? <Tag tone="#f0a020">审核类 {item.moderationCount}</Tag> : null}
          </span>
          <span className="mt-1.5 block h-[5px] w-full overflow-hidden rounded-full bg-[#f2f2f2]">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (item.total / maxTotal) * 100)}%`, backgroundColor: item.stillBleeding ? "#e05656" : "#c9c9c9" }} />
          </span>
          <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#999999]">
            <span>今日 <b className="font-medium text-[#555555]">{item.today}</b></span>
            <span>近 7 天 <b className="font-medium text-[#555555]">{item.last7Days}</b></span>
            <span>影响用户 <b className="font-medium text-[#555555]">{item.affectedUsers}</b></span>
            <span>首次 {item.firstAtLabel}</span>
            <span>最后 {item.lastAtLabel}（{item.lastAtAgoLabel}）</span>
            <span>{item.models.map((model) => model.label).join("、") || "-"}</span>
            <span>{item.sources.map((source) => `${source.label} ${source.count}`).join(" / ")}</span>
          </span>
        </span>
        <span className="mt-1 shrink-0 text-[#aaaaaa]">{open ? <RiArrowUpSLine className="h-4 w-4" /> : <RiArrowDownSLine className="h-4 w-4" />}</span>
      </button>
      {open ? (
        <div className="mb-3 ml-[66px] rounded-[12px] border border-[#eeeeee] bg-[#fafafa] p-3 text-[12px] leading-5 text-[#555555]">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>类型：{item.kinds.map((kind) => `${kind.label} ${kind.count}`).join(" / ") || "-"}</span>
            <span>模型：{item.models.map((model) => `${model.label} ${model.count}`).join(" / ") || "-"}</span>
            <span>入口：{item.sources.map((source) => `${source.label} ${source.count}`).join(" / ") || "-"}</span>
          </div>
          {item.isFallbackBucket ? (
            <div className="mt-2 rounded-[8px] bg-[#f4efff] px-2.5 py-2 text-[11px] leading-5 text-[#6b4bb8]">
              ⚠️ 这条是<b className="font-semibold">兜底文案</b>，不是根因 —— 所有没被识别的错误都落进它。真实原因只在服务器
              <code className="mx-1 rounded bg-white px-1">.runtime/*-diagnostics-log.jsonl</code>
              里，拿下面的 requestId 去 grep。⭐ 另一个兜底桶也要一起查（同一根因常同时污染两个）。
            </div>
          ) : null}
          <div className="mt-2 text-[11px] font-medium text-[#888888]">最近样本（拿 requestId 去诊断日志捞原文）</div>
          <div className="mt-1 space-y-1">
            {item.samples.length > 0 ? item.samples.map((sample, index) => (
              <div key={`${sample.requestId ?? "none"}-${index}`} className="flex items-center gap-2">
                <span className="w-[92px] shrink-0 text-[11px] text-[#999999]">{sample.createdAtLabel}</span>
                <code className="min-w-0 flex-1 truncate rounded bg-white px-1.5 py-0.5 text-[11px] text-[#333333]">{sample.requestId ?? "（无 requestId，只能靠 failureReason 匹配）"}</code>
                <span className="shrink-0 text-[11px] text-[#999999]">{sample.model} · {sample.source}</span>
                {sample.requestId ? <CopyButton text={sample.requestId} /> : null}
              </div>
            )) : <div className="text-[11px] text-[#aaaaaa]">无样本</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "bleeding", label: "近 7 天仍在发生" },
  { key: "fallback", label: "兜底桶（查不出根因）" },
  { key: "stopped", label: "已停止发生（可考虑归档）" },
  { key: "moderation", label: "审核类" },
] as const;

export function AdminFailureTriagePanel({ data }: { data: FailureTriageData }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [keyword, setKeyword] = useState("");

  const reasons = useMemo(() => {
    const kw = keyword.trim();
    return data.reasons.filter((item) => {
      if (kw && !item.reason.includes(kw) && !item.models.some((model) => model.label.includes(kw))) return false;
      if (filter === "bleeding") return item.stillBleeding;
      if (filter === "fallback") return item.isFallbackBucket;
      if (filter === "stopped") return !item.stillBleeding;
      if (filter === "moderation") return item.moderationCount > 0;
      return true;
    });
  }, [data.reasons, filter, keyword]);

  const maxTotal = Math.max(1, ...data.reasons.map((item) => item.total));
  const { summary } = data;
  const weekDelta = summary.last7DaysPending - summary.prev7DaysPending;
  const bleedingCount = data.reasons.filter((item) => item.stillBleeding).length;
  const stoppedCount = data.reasons.length - bleedingCount;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">失败排查</h1>
          <div className="mt-2 max-w-[900px] text-[12px] leading-5 text-[#888888]">
            生成失败（红字）的排查工作台。⭐ 铁律：<b className="text-[#555555]">失败原因里的文案不等于根因</b> —— 「服务器繁忙，请稍候再试.....」和「请求失败，请稍后再试。」是两个<b className="text-[#555555]">兜底桶</b>，
            所有没被识别的错误都落进它们，必须拿 requestId 回服务器 <code className="rounded bg-[#f2f2f2] px-1">.runtime/*-diagnostics-log.jsonl</code> 捞真实原文。
            查清并修掉一批后，往 <code className="rounded bg-[#f2f2f2] px-1">scripts/archive-resolved-generation-failures.mjs</code> 加规则并跑 <code className="rounded bg-[#f2f2f2] px-1">--apply</code> 归档（本页只读，不会改库）。
          </div>
        </div>
      </div>

      {!data.hasData ? (
        <div className="rounded-[18px] border border-[#eeeeee] bg-white p-10 text-center text-[13px] text-[#999999]">
          暂无失败事件数据（GenerationEvent 表为空或迁移尚未执行）。
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              icon={RiAlarmWarningLine}
              tone="#e05656"
              label="待排查失败事件"
              value={n(summary.pending)}
              splits={[{ label: "原因种类", value: `${n(summary.pendingReasonCount)} 种` }, { label: "影响用户", value: `${n(summary.affectedUsers)} 人` }]}
              note={`还在流血 ${bleedingCount} 种 · 已停止 ${stoppedCount} 种`}
            />
            <KpiCard
              icon={RiEyeOffLine}
              tone="#8b5cf6"
              label="兜底桶（排查盲区）"
              value={`${n(summary.fallbackTotal)}`}
              splits={data.fallbackBuckets.map((bucket) => ({ label: bucket.label.startsWith("服务器繁忙") ? "服务器繁忙" : "请求失败", value: n(bucket.total) }))}
              note={`占待排查 ${summary.fallbackRate}% —— 这个数越大，说明我们对线上失败越"看不见"`}
            />
            <KpiCard
              icon={RiHeartPulseLine}
              tone="#f0a020"
              label="今日新增失败"
              value={n(summary.todayPending)}
              splits={[{ label: "昨日", value: n(summary.yesterdayPending) }, { label: "近 7 天", value: n(summary.last7DaysPending) }]}
              note={`较上一个 7 天 ${weekDelta === 0 ? "持平" : weekDelta > 0 ? `多 ${n(weekDelta)} 条` : `少 ${n(-weekDelta)} 条`}`}
            />
            <KpiCard
              icon={RiInboxArchiveLine}
              tone="#18a058"
              label="已归档（根因已处理）"
              value={n(summary.resolved)}
              splits={[{ label: "审核类待排查", value: n(summary.moderationTotal) }]}
              note="归档 = 根因已修好、或已从兜底桶拆成明确文案"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              icon={RiCheckboxCircleLine}
              tone="#367cee"
              label="图片生成失败率"
              value={summary.imageTotal > 0 ? `${((summary.imageFailed / summary.imageTotal) * 100).toFixed(1)}%` : "-"}
              splits={[{ label: "失败", value: n(summary.imageFailed) }, { label: "总请求", value: n(summary.imageTotal) }]}
            />
            <KpiCard
              icon={RiCheckboxCircleLine}
              tone="#e0669a"
              label="视频生成失败率"
              value={summary.videoTotal > 0 ? `${((summary.videoFailed / summary.videoTotal) * 100).toFixed(1)}%` : "-"}
              splits={[{ label: "失败", value: n(summary.videoFailed) }, { label: "总请求", value: n(summary.videoTotal) }]}
            />
            <KpiCard
              icon={RiShieldCheckLine}
              tone="#f0a020"
              label="审核 / 内容策略类"
              value={n(summary.moderationTotal)}
              note="平台或模型拒绝交付。这类我们改不了，按铁律不归档、就该一直亮着"
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
            <CardShell title="失败趋势（近 30 天）" subtitle="堆叠：图片 + 视频。突然一根很高的柱子 = 那天有人连续踩同一个坑，优先去查">
              <FailureTrend trend={data.trend} />
            </CardShell>
            <CardShell title="两个兜底桶" subtitle="⭐ 同一个根因会因为调用处传不传 fallback 而同时污染两个，查任何一类都要两个桶一起查">
              <div className="space-y-3">
                {data.fallbackBuckets.map((bucket) => (
                  <div key={bucket.label} className="rounded-[12px] border border-[#eeeeee] bg-[#fafafa] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] text-[#444444]">{bucket.label}</span>
                      <span className="shrink-0 text-[16px] font-semibold text-[#8b5cf6]">{n(bucket.total)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#999999]">今日 {bucket.today} · 近 7 天 {bucket.last7Days}</div>
                  </div>
                ))}
                <div className="rounded-[10px] bg-[#f4efff] px-2.5 py-2 text-[11px] leading-5 text-[#6b4bb8]">
                  ⚠️ 从日志 <code className="rounded bg-white px-1">grep -c</code> 数出来的行数 ≠ 待排查事件数：
                  同一个 requestId 可能有几十行日志、而且最终可能重试成功了（<code className="rounded bg-white px-1">status=success</code>，后台里根本不占位）。
                  拿到日志计数必须回 DB 按 requestId 核对 status。
                </div>
              </div>
            </CardShell>
          </div>

          <CardShell
            title={`待排查失败原因（${n(reasons.length)} / ${n(data.reasons.length)} 种）`}
            subtitle="⭐ 排序刻意不是纯按条数：先把「近 7 天仍在发生」的排上去（那才是现在还在坑用户的）。点任意一行展开样本 requestId"
            right={<span>共 {n(summary.pending)} 条事件</span>}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <RiFilterLine className="h-4 w-4 text-[#aaaaaa]" aria-hidden="true" />
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`rounded-[8px] px-2.5 py-1 text-[12px] transition ${filter === item.key ? "bg-[#111111] text-white" : "bg-[#f2f2f2] text-[#666666] hover:bg-[#e8e8e8]"}`}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索原因 / 模型"
                className="ml-auto h-8 w-[220px] rounded-[8px] border border-[#e6e6e6] px-2.5 text-[12px] outline-none focus:border-[#111111]"
              />
            </div>
            {reasons.length > 0 ? (
              <div>{reasons.map((item) => <ReasonRow key={item.reason} item={item} maxTotal={maxTotal} />)}</div>
            ) : (
              <div className="py-8 text-center text-[13px] text-[#999999]">没有符合条件的失败原因</div>
            )}
          </CardShell>

          <div className="grid grid-cols-3 gap-5">
            <CardShell title="按模型（待排查）" subtitle={"带失败率，只看失败数会把「用得多」当成「有问题」"}>
              {data.byModel.length > 0 ? (
                <div className="space-y-2">
                  {data.byModel.slice(0, 12).map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2 border-b border-[#f5f5f5] pb-2 last:border-b-0 last:pb-0">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[#444444]">{item.label}</span>
                      <span className="shrink-0 text-[11px] text-[#999999]">兜底 {item.fallback}</span>
                      <span className="shrink-0 text-[11px] text-[#999999]">{item.failRate}%</span>
                      <span className="w-[46px] shrink-0 text-right text-[13px] font-semibold text-[#111111]">{n(item.total)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="py-8 text-center text-[13px] text-[#999999]">暂无数据</div>}
            </CardShell>
            <CardShell title="按入口（待排查）" subtitle={"⭐ 只在某一个入口出 = 大概率「该统一却分叉了」（对话流 / 工作流 / 资产库 / Agent 本该同一套代码）"}>
              {data.bySource.length > 0 ? (
                <div className="space-y-2">
                  {data.bySource.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2 border-b border-[#f5f5f5] pb-2 last:border-b-0 last:pb-0">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[#444444]">{item.label}</span>
                      <span className="shrink-0 text-[11px] text-[#999999]">兜底 {item.fallback}</span>
                      <span className="w-[46px] shrink-0 text-right text-[13px] font-semibold text-[#111111]">{n(item.total)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="py-8 text-center text-[13px] text-[#999999]">暂无数据</div>}
            </CardShell>
            <CardShell title="失败最多的用户" subtitle="同一个人连续踩同一个坑 = 一个可复现场景，最容易查清">
              {data.topUsers.length > 0 ? (
                <div className="space-y-2">
                  {data.topUsers.map((item) => (
                    <div key={item.userId} className="border-b border-[#f5f5f5] pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <RiUser3Line className="h-3.5 w-3.5 shrink-0 text-[#bbbbbb]" aria-hidden="true" />
                          <span className="truncate text-[12px] text-[#444444]">{item.label}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold text-[#111111]">{n(item.total)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[#aaaaaa]">{item.userId} · {item.topReason}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="py-8 text-center text-[13px] text-[#999999]">暂无数据</div>}
            </CardShell>
          </div>

          <CardShell
            title={`已归档（${n(data.resolved.length)} 类 / ${n(summary.resolved)} 条）`}
            subtitle="根因已查清并修掉、或已从兜底桶拆成明确文案。文字保留但划掉，随时可追溯；不计入上面的待排查数量"
            right={<span className="inline-flex items-center gap-1"><RiQuestionLine className="h-3.5 w-3.5" />归档由脚本执行，本页只读</span>}
          >
            {data.resolved.length > 0 ? (
              <div className="space-y-3">
                {data.resolved.map((item) => (
                  <div key={`${item.reason}-${item.note}`} className="border-b border-[#f5f5f5] pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1 text-[13px] leading-5 text-[#999999] line-through">{item.reason}</span>
                      <span className="shrink-0 text-[13px] font-semibold text-[#aaaaaa]">{n(item.total)}</span>
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-[#8a8a8a]">{item.note}</div>
                    <div className="mt-0.5 text-[11px] text-[#bbbbbb]">最后发生 {item.lastAtLabel} · 归档于 {item.resolvedAtLabel}</div>
                  </div>
                ))}
              </div>
            ) : <div className="py-8 text-center text-[13px] text-[#999999]">还没有归档过任何失败原因</div>}
          </CardShell>
        </div>
      )}
    </>
  );
}
