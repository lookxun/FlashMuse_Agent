"use client";

/**
 * 运营概览（后台默认概览页）。纯展示组件，真实数据由服务端 getAdminOverviewData 计算后通过 data 传入。
 * 生成图片/视频分开统计，核心数据带总数并用小字拆分「对话流 / 工作流」。
 */

import { useState } from "react";
import type { IconType } from "react-icons";
import {
  RiUser3Line,
  RiPulseLine,
  RiBaseStationLine,
  RiImageAiLine,
  RiFilmAiLine,
  RiVipDiamondLine,
  RiChat3Line,
  RiFlowChart,
  RiCheckboxCircleLine,
  RiMoneyDollarCircleLine,
} from "react-icons/ri";
import type { AdminOverviewData, ShareItem, TrendPoint, RankItem } from "@/lib/admin-overview";

// ---------------------------------------------------------------------------
// 基础 UI 组件
// ---------------------------------------------------------------------------

function KpiCard({ icon: Icon, label, value, splits, note, tone = "#367cee" }: {
  icon: IconType;
  label: string;
  value: string;
  splits?: Array<{ label: string; value: string }>;
  note?: string;
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
            <span key={split.label}>
              {split.label} <span className="font-medium text-[#555555]">{split.value}</span>
            </span>
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
          {subtitle ? <div className="mt-0.5 text-[12px] text-[#9a9a9a]">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0 text-[12px] text-[#888888]">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyHint() {
  return <div className="py-8 text-center text-[13px] text-[#999999]">暂无数据</div>;
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex items-center gap-4 text-[12px] text-[#888888]">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function LineChart({ points, series }: { points: TrendPoint[]; series: Array<{ key: string; color: string }> }) {
  const width = 520;
  const height = 170;
  const maxValue = Math.max(1, ...points.flatMap((point) => series.map((line) => Number(point[line.key]) || 0)));
  const xStep = points.length > 1 ? width / (points.length - 1) : width;
  const toPath = (key: string) => points.map((point, index) => `${index * xStep},${height - ((Number(point[key]) || 0) / maxValue) * (height - 18) - 8}`).join(" ");

  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[170px] w-full overflow-visible">
        {series.map((line) => (
          <polyline key={line.key} points={toPath(line.key)} fill="none" stroke={line.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="mt-3 grid text-center text-[11px] text-[#999999]" style={{ gridTemplateColumns: `repeat(${Math.min(points.length, 7)}, minmax(0, 1fr))` }}>
        {points.slice(-7).map((point) => <span key={String(point.label)}>{String(point.label)}</span>)}
      </div>
    </>
  );
}

function GroupedBarChart({ points, series }: { points: TrendPoint[]; series: Array<{ key: string; color: string }> }) {
  const maxValue = Math.max(1, ...points.flatMap((point) => series.map((bar) => Number(point[bar.key]) || 0)));

  return (
    <>
      <div className="flex h-[180px] items-end gap-3 border-b border-[#eeeeee] pb-2">
        {points.map((point) => (
          <div key={String(point.label)} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-[150px] w-full items-end justify-center gap-1">
              {series.map((bar) => {
                const value = Number(point[bar.key]) || 0;
                return (
                  <div key={bar.key} className="flex w-1/2 flex-col items-center justify-end">
                    <div className="text-[10px] text-[#999999]">{value}</div>
                    <div className="w-full rounded-t-[5px]" style={{ height: `${Math.max(3, (value / maxValue) * 120)}px`, backgroundColor: bar.color }} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-[#999999]">
        {points.slice(-7).map((point) => <span key={String(point.label)}>{String(point.label)}</span>)}
      </div>
    </>
  );
}

function DistributionBars({ items }: { items: ShareItem[] }) {
  if (items.length === 0) return <EmptyHint />;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="text-[#555555]">{item.label}</span>
            <span className="font-semibold text-[#111111]">{item.value}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f1f1]">
            <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.tone }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankTable({ items }: { items: RankItem[] }) {
  return (
    <div className="space-y-2">
      {items.length > 0 ? items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f8f8f8] px-3 py-2 text-[13px]">
          <div className="min-w-0">
            <div className="truncate font-medium text-[#333333]">{index + 1}. {item.label}</div>
            {item.note ? <div className="mt-0.5 truncate text-[11px] text-[#999999]">{item.note}</div> : null}
          </div>
          <div className="shrink-0 font-semibold text-[#111111]">{item.value}</div>
        </div>
      )) : <EmptyHint />}
    </div>
  );
}

function StatList({ items }: { items: RankItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] text-[#555555]">{item.label}</div>
            {item.note ? <div className="mt-0.5 truncate text-[11px] text-[#aaaaaa]">{item.note}</div> : null}
          </div>
          <div className="shrink-0 text-[15px] font-semibold text-[#111111]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function MiniStatGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-[12px] bg-[#f8f8f8] p-3">
          <div className="text-[12px] text-[#777777]">{item.label}</div>
          <div className="mt-1.5 text-[20px] font-semibold text-[#111111]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function RetentionGrid({ items }: { items: Array<{ label: string; value: number; note: string }> }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-[12px] bg-[#f8f8f8] p-3 text-center">
          <div className="text-[12px] text-[#777777]">{item.label}</div>
          <div className="mt-2 text-[22px] font-semibold text-[#111111]">{item.value}%</div>
          <div className="mt-1 text-[11px] text-[#aaaaaa]">{item.note}</div>
        </div>
      ))}
    </div>
  );
}

function Funnel({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const prev = index === 0 ? item.value : items[index - 1].value;
        const stepRate = index === 0 ? 100 : prev > 0 ? Math.round((item.value / prev) * 100) : 0;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-[12px] text-[#555555]">{item.label}</div>
            <div className="relative h-8 flex-1 overflow-hidden rounded-[8px] bg-[#f1f1f1]">
              <div className="flex h-full items-center rounded-[8px] bg-gradient-to-r from-[#367cee] to-[#5b9bff] px-3 text-[12px] font-medium text-white" style={{ width: `${Math.max(12, (item.value / max) * 100)}%` }}>
                {item.value.toLocaleString("en-US")}
              </div>
            </div>
            <div className="w-12 shrink-0 text-right text-[12px] text-[#999999]">{stepRate}%</div>
          </div>
        );
      })}
    </div>
  );
}

function DonutShare({ items }: { items: ShareItem[] }) {
  if (items.length === 0) return <EmptyHint />;
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const stops = items.map((item, index) => {
    const startValue = items.slice(0, index).reduce((sum, prev) => sum + prev.value, 0);
    const start = (startValue / total) * 100;
    const end = ((startValue + item.value) / total) * 100;
    return `${item.tone} ${start}% ${end}%`;
  });
  return (
    <div className="flex items-center gap-5">
      <div className="h-28 w-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-white" />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-[#555555]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.tone }} />
              {item.label}
            </span>
            <span className="font-semibold text-[#111111]">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

const rangeOptions = [
  { key: "today", label: "今日" },
  { key: "7d", label: "近7日" },
  { key: "30d", label: "近30日" },
  { key: "all", label: "全部" },
] as const;

const n = (value: number) => value.toLocaleString("en-US");

export function AdminOverview2({ data }: { data: AdminOverviewData }) {
  const [range, setRange] = useState<(typeof rangeOptions)[number]["key"]>("7d");

  const sliced = <T,>(points: T[]) => {
    const count = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : points.length;
    return points.slice(-count);
  };

  const successItems = [
    { label: "图片生成成功率", value: data.success.imageRate, tone: "#18a058", note: `失败 ${n(data.success.imageFailed)} 次` },
    { label: "视频生成成功率", value: data.success.videoRate, tone: "#f0a020", note: `失败 ${n(data.success.videoFailed)} 次` },
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">运营概览</h1>
        </div>
      </div>

      {/* 第一排：用户 & 成本 */}
      <section className="grid grid-cols-4 gap-4">
        <KpiCard icon={RiUser3Line} label="注册用户总数" value={n(data.users.total)} note={`今日新增 ${data.users.today}`} tone="#367cee" />
        <KpiCard icon={RiPulseLine} label="活跃用户 DAU" value={n(data.users.dau)} splits={[{ label: "WAU", value: n(data.users.wau) }, { label: "MAU", value: n(data.users.mau) }]} tone="#18a058" />
        <KpiCard icon={RiBaseStationLine} label="当前在线人数" value={n(data.users.online)} note={`30分钟活跃 ${data.users.active30}`} tone="#f0a020" />
        <KpiCard icon={RiMoneyDollarCircleLine} label="累计消耗成本" value={`$${n(data.credits.usd)}`} note={`≈ ¥${n(data.credits.cny)}`} tone="#8b5cf6" />
      </section>

      <section className="mt-4 grid grid-cols-4 gap-4">
        <KpiCard icon={RiImageAiLine} label="累计生成图片" value={n(data.images.total)} splits={[{ label: "对话流", value: n(data.images.conversation) }, { label: "工作流", value: n(data.images.workflow) }]} tone="#367cee" />
        <KpiCard icon={RiFilmAiLine} label="累计生成视频" value={n(data.videos.total)} splits={[{ label: "对话流", value: n(data.videos.conversation) }, { label: "工作流", value: n(data.videos.workflow) }]} tone="#f0a020" />
        <KpiCard icon={RiVipDiamondLine} label="累计消耗积分" value={n(data.credits.consumedTotal)} note={`今日消耗 ${n(data.credits.todayConsumed)}`} tone="#e0669a" />
        <KpiCard icon={RiCheckboxCircleLine} label="生成成功率" value={data.success.hasData ? `${data.success.imageRate}%` : "—"} splits={data.success.hasData ? [{ label: "图片", value: `${data.success.imageRate}%` }, { label: "视频", value: `${data.success.videoRate}%` }] : undefined} note={data.success.hasData ? undefined : "上线后开始统计"} tone="#18a058" />
      </section>

      <section className="mt-4 grid grid-cols-4 gap-4">
        <KpiCard icon={RiChat3Line} label="历史对话总数" value={n(data.conversations.total)} note={`今日新增 ${data.conversations.today}`} tone="#367cee" />
        <KpiCard icon={RiFlowChart} label="历史工作流总数" value={n(data.workflows.total)} note={`今日新增 ${data.workflows.today}`} tone="#8b5cf6" />
        <KpiCard icon={RiImageAiLine} label="今日生成图片" value={n(data.images.today)} splits={[{ label: "对话流", value: n(data.images.todayConversation) }, { label: "工作流", value: n(data.images.todayWorkflow) }]} tone="#367cee" />
        <KpiCard icon={RiFilmAiLine} label="今日生成视频" value={n(data.videos.today)} splits={[{ label: "对话流", value: n(data.videos.todayConversation) }, { label: "工作流", value: n(data.videos.todayWorkflow) }]} tone="#f0a020" />
      </section>

      {/* 趋势（受下方时间范围控制） */}
      <div className="mt-8 mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#111111]">趋势分析</h2>
        <div className="flex items-center gap-1 rounded-[10px] border border-[#eeeeee] bg-white p-1">
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition ${range === option.key ? "bg-[#111111] text-white" : "text-[#666666] hover:bg-[#f3f3f3]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CardShell title="活跃 / 新增趋势" right={<Legend items={[{ label: "活跃用户", color: "#367cee" }, { label: "新增用户", color: "#f0a020" }]} />}>
          <LineChart points={sliced(data.activeTrend)} series={[{ key: "value", color: "#367cee" }, { key: "secondaryValue", color: "#f0a020" }]} />
        </CardShell>
        <CardShell title="成本消耗趋势" right={<Legend items={[{ label: "积分", color: "#367cee" }, { label: "美元", color: "#18a058" }]} />}>
          <LineChart points={sliced(data.costTrend)} series={[{ key: "credits", color: "#367cee" }, { key: "usd", color: "#18a058" }]} />
        </CardShell>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <CardShell title="生成图片趋势" subtitle="对话流 / 工作流 分开统计" right={<Legend items={[{ label: "对话流", color: "#367cee" }, { label: "工作流", color: "#8b5cf6" }]} />}>
          <GroupedBarChart points={sliced(data.imageTrend)} series={[{ key: "conversation", color: "#367cee" }, { key: "workflow", color: "#8b5cf6" }]} />
        </CardShell>
        <CardShell title="生成视频趋势" subtitle="对话流 / 工作流 分开统计" right={<Legend items={[{ label: "对话流", color: "#367cee" }, { label: "工作流", color: "#8b5cf6" }]} />}>
          <GroupedBarChart points={sliced(data.videoTrend)} series={[{ key: "conversation", color: "#367cee" }, { key: "workflow", color: "#8b5cf6" }]} />
        </CardShell>
      </div>

      {/* 运营 / 产品 */}
      <div className="mt-8 mb-3 flex items-center gap-4">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#111111]">运营与产品分析</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <CardShell title="功能使用分布" subtitle="按生成任务量占比">
          <DistributionBars items={data.featureUsage} />
        </CardShell>
        <CardShell title="模型调用占比">
          <DonutShare items={data.modelShare} />
        </CardShell>
        <CardShell title="生成成功率">
          {data.success.hasData ? (
            <div className="space-y-4">
              {successItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-[#555555]">{item.label}</span>
                    <span className="font-semibold text-[#111111]">{item.value}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f1f1]">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.tone }} />
                  </div>
                  <div className="mt-1 text-[11px] text-[#aaaaaa]">{item.note}</div>
                </div>
              ))}
            </div>
          ) : <EmptyHint />}
        </CardShell>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <CardShell title="用户留存" subtitle="按注册同期群统计">
          <RetentionGrid items={data.retention} />
        </CardShell>
        <CardShell title="转化漏斗" subtitle="注册 → 生成 → 工作流">
          <Funnel items={data.funnel} />
        </CardShell>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <CardShell title="人均指标">
          <MiniStatGrid items={data.perUser} />
        </CardShell>
        <CardShell title="积分健康度" subtitle="累计赠送 / 消耗 / 余额">
          <div className="space-y-3">
            <StatList items={[
              { label: "累计赠送积分", value: n(data.creditHealth.granted), note: `注册赠送 ${n(data.creditHealth.signup)} · 后台调整 ${n(data.creditHealth.adminAdjust)}` },
              { label: "累计消耗积分", value: n(data.creditHealth.consumed) },
              { label: "当前剩余余额", value: n(data.creditHealth.balance) },
            ]} />
            <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f1f1]">
              <div className="h-full rounded-full bg-[#367cee]" style={{ width: `${data.creditHealth.granted > 0 ? Math.min(100, Math.round((data.creditHealth.consumed / data.creditHealth.granted) * 100)) : 0}%` }} />
            </div>
            <div className="text-[11px] text-[#aaaaaa]">赠送积分已消耗 {data.creditHealth.granted > 0 ? Math.round((data.creditHealth.consumed / data.creditHealth.granted) * 100) : 0}%</div>
          </div>
        </CardShell>
        <CardShell title="工作流采纳率" subtitle="用过工作流的用户 / 活跃用户">
          <div className="flex h-full flex-col items-center justify-center py-2">
            <div className="text-[40px] font-semibold tracking-[-0.03em] text-[#8b5cf6]">{data.workflowAdoption.rate}%</div>
            <div className="mt-2 text-[12px] text-[#999999]">{n(data.workflowAdoption.used)} / {n(data.workflowAdoption.activeUsers)} 活跃用户</div>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#f1f1f1]">
              <div className="h-full rounded-full bg-[#8b5cf6]" style={{ width: `${data.workflowAdoption.rate}%` }} />
            </div>
          </div>
        </CardShell>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <CardShell title="今日活跃 新老用户占比">
          <DonutShare items={data.newVsOld} />
        </CardShell>
        <CardShell title="对话生成模式占比">
          <DistributionBars items={data.chatModeShare} />
        </CardShell>
        <CardShell title="参考素材使用比例">
          <DistributionBars items={data.referenceUsage} />
        </CardShell>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <CardShell title="上传成功率" subtitle="中国 → 马来西亚上传链路">
          {data.uploadHealth.hasData ? (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="text-[32px] font-semibold tracking-[-0.03em] text-[#18a058]">{data.uploadHealth.rate}%</div>
                <div className="pb-1.5 text-[12px] text-[#999999]">成功率</div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f1f1]">
                <div className="h-full rounded-full bg-[#18a058]" style={{ width: `${data.uploadHealth.rate}%` }} />
              </div>
              <StatList items={[
                { label: "上传总次数", value: n(data.uploadHealth.total) },
                { label: "失败次数", value: n(data.uploadHealth.failed), note: `超时 ${data.uploadHealth.timeout} · 转码失败 ${data.uploadHealth.reencode}` },
              ]} />
            </div>
          ) : <EmptyHint />}
        </CardShell>
        <CardShell title="重试与安全改写">
          <StatList items={data.retryStats} />
        </CardShell>
        <CardShell title="审核拦截细分" subtitle="最高频的失败类型">
          <RankTable items={data.moderationBreakdown.map((item) => ({ label: item.label, value: n(item.value) }))} />
        </CardShell>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <CardShell title="生成平均时长" subtitle="按模型">
          <RankTable items={data.latency} />
        </CardShell>
        <CardShell title="成本 Top 模型" subtitle="按实际花费（美元）">
          <RankTable items={data.costTop} />
        </CardShell>
        <CardShell title="计费异常记录" subtitle="用于发现计费漏洞">
          <StatList items={data.billingAnomaly} />
        </CardShell>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <CardShell title="模型调用次数" subtitle="全部模型 · 调用次数 / 失败次数">
          {data.modelCalls.length > 0 ? (
            <div className="space-y-2">
              {data.modelCalls.map((item, index) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f8f8f8] px-3 py-2 text-[13px]">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#333333]">{index + 1}. {item.label}</div>
                    {item.note ? <div className="mt-0.5 truncate text-[11px] text-[#999999]">{item.note}</div> : null}
                  </div>
                  <div className="shrink-0 font-semibold text-[#111111]">
                    {n(item.calls)}
                    <span className="text-[#999999]"> / </span>
                    <span className="text-[#e5484d]">{n(item.failed)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyHint />}
        </CardShell>
        <CardShell title="失败原因" subtitle="全部原因 · 从多到少">
          <RankTable items={data.failureTop.map((item) => ({ label: item.label, value: n(item.value) }))} />
        </CardShell>
        <div className="space-y-4">
          <CardShell title="最近活跃用户 Top 5">
            <RankTable items={data.activeUserTop.slice(0, 5)} />
          </CardShell>
          <CardShell title="消耗积分用户 Top 5">
            <RankTable items={data.creditUserTop.slice(0, 5)} />
          </CardShell>
        </div>
      </div>
    </>
  );
}
