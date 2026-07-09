"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum } from "@/lib/format";
import { Skeleton } from "@/components/ui";

// Fixed categorical order (validated against #F6F4F1) — never cycled.
export const CHART_COLORS = ["#a3252e", "#96731a", "#1d6fc2", "#7c3aed"];

const AXIS_TICK = { fontSize: 11, fill: "#888888" };
const GRID = "#ece8e3";

function TooltipCard({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  labelFormatter?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-hairline bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-subtle">
        {labelFormatter ? labelFormatter(String(label)) : label}
      </p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-ink">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}: <span className="font-semibold">{fmtNum(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function tickDate(bucket: "day" | "week" | "month") {
  return (v: string) =>
    new Date(v).toLocaleDateString(undefined, {
      month: "short",
      day: bucket === "month" ? undefined : "numeric",
    });
}

// Single-series area chart (no legend — the title names the series).
export function TrendChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKey,
  name,
  colorIndex = 0,
  bucket = "week",
  height = 200,
}: {
  data: T[];
  xKey: keyof T & string;
  yKey: keyof T & string;
  name: string;
  colorIndex?: number;
  bucket?: "day" | "week" | "month";
  height?: number;
}) {
  const color = CHART_COLORS[colorIndex];
  const gid = `grad-${yKey}-${colorIndex}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={tickDate(bucket)}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(v: number) => fmtNum(v)}
          width={46}
        />
        <Tooltip
          content={<TooltipCard labelFormatter={tickDate(bucket)} />}
          cursor={{ stroke: "#d8d4cd", strokeDasharray: "3 3" }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gid})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Multi-series line chart with legend (≤ 4 series, fixed color order).
export function MultiTrendChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  bucket = "week",
  height = 260,
}: {
  data: T[];
  xKey: keyof T & string;
  series: { key: keyof T & string; label: string }[];
  bucket?: "day" | "week" | "month";
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={tickDate(bucket)}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(v: number) => fmtNum(v)}
          width={46}
        />
        <Tooltip
          content={<TooltipCard labelFormatter={tickDate(bucket)} />}
          cursor={{ stroke: "#d8d4cd", strokeDasharray: "3 3" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#666666" }}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={CHART_COLORS[i]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// KPI stat tile.
export function StatTile({
  label,
  value,
  icon,
  loading,
  sub,
  big = false,
}: {
  label: string;
  value: number | string | undefined;
  icon?: ReactNode;
  loading?: boolean;
  sub?: ReactNode;
  big?: boolean;
}) {
  return (
    <div className="rounded-card border border-hairline bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-medium uppercase tracking-wide text-subtle ${big ? "text-sm" : "text-xs"}`}
        >
          {label}
        </span>
        {icon && <span className="text-gold">{icon}</span>}
      </div>
      {loading && value == null ? (
        <Skeleton className={`mt-2 ${big ? "h-12 w-28" : "h-8 w-20"}`} />
      ) : (
        <p className={`mt-1 font-bold tabular-nums text-ink ${big ? "text-5xl" : "text-[28px]"}`}>
          {typeof value === "number" ? fmtNum(value) : (value ?? "—")}
        </p>
      )}
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// Growth delta chip for analytics ("vs previous period").
export function DeltaChip({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted">no data</span>;
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        up ? "text-[#3d6b2f]" : "text-[#b3261e]"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
      <span className="font-normal text-muted"> vs prev period</span>
    </span>
  );
}
