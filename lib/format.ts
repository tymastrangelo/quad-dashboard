export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTimeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
}

export type RangeKey = "30d" | "90d" | "semester" | "all";

export const RANGE_LABELS: Record<RangeKey, string> = {
  "30d": "30 days",
  "90d": "90 days",
  semester: "Semester",
  all: "All time",
};

// Semester start: fall ≈ Aug 15, spring ≈ Jan 10. App launched fall 2025.
export function rangeToDates(range: RangeKey): {
  start: Date;
  end: Date;
  bucket: "day" | "week" | "month";
} {
  const end = new Date();
  if (range === "30d")
    return { start: new Date(Date.now() - 30 * 86400_000), end, bucket: "day" };
  if (range === "90d")
    return { start: new Date(Date.now() - 90 * 86400_000), end, bucket: "week" };
  if (range === "semester") {
    const now = new Date();
    const start =
      now.getMonth() >= 7
        ? new Date(now.getFullYear(), 7, 15)
        : new Date(now.getFullYear(), 0, 10);
    return { start, end, bucket: "week" };
  }
  return { start: new Date(2025, 7, 1), end, bucket: "month" };
}

export function eventEnd(e: { date: string; end_date: string | null }): Date {
  return e.end_date
    ? new Date(e.end_date)
    : new Date(new Date(e.date).getTime() + 2 * 3600_000);
}
