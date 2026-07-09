"use client";

import { useMemo, useState } from "react";
import {
  getActivityTimeseries,
  getClubEngagement,
  getClubFollowerCounts,
  getInsightsTimeseries,
  supabase,
} from "@/lib/api";
import { fmtNum, RANGE_LABELS, rangeToDates, type RangeKey } from "@/lib/format";
import type { Club } from "@/lib/types";
import { useData } from "@/lib/useData";
import { DeltaChip, MultiTrendChart, TrendChart } from "@/components/charts";
import { Card, Select, Skeleton } from "@/components/ui";

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("90d");
  const { start, end, bucket } = useMemo(() => rangeToDates(range), [range]);
  const [clubId, setClubId] = useState<string>("");

  // DAU proxy derived from real activity tables (rsvps, posts, likes, comments,
  // follows, saves, join requests) — the app has no dedicated tracking.
  const activity = useData(`activity-${range}`, () =>
    getActivityTimeseries(start, end)
  );

  // Growth: current range vs the previous window of equal length.
  const growth = useData(`growth-${range}`, async () => {
    const spanMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - spanMs);
    const [cur, prev] = await Promise.all([
      getInsightsTimeseries(start, end, bucket),
      getInsightsTimeseries(prevStart, start, bucket),
    ]);
    const sum = (rows: typeof cur, key: "signups" | "rsvps" | "follows" | "posts") =>
      rows.reduce((a, r) => a + r[key], 0);
    return (["signups", "rsvps", "follows", "posts"] as const).map((key) => ({
      key,
      current: sum(cur, key),
      previous: sum(prev, key),
    }));
  });

  const clubs = useData("clubs-list", async () => {
    const [clubsRes, counts] = await Promise.all([
      supabase.from("clubs").select("id, name").order("name").limit(1000),
      getClubFollowerCounts(),
    ]);
    if (clubsRes.error) throw new Error(clubsRes.error.message);
    const byId = new Map(counts.map((c) => [c.club_id, c.follower_count]));
    return (clubsRes.data as Pick<Club, "id" | "name">[]).map((c) => ({
      ...c,
      followers: byId.get(c.id) ?? 0,
    }));
  });

  const selectedClub = clubId ? Number(clubId) : (clubs.data?.[0]?.id ?? null);
  const engagement = useData(
    `engagement-${selectedClub}-${range}`,
    async () =>
      selectedClub == null ? [] : getClubEngagement(selectedClub, start, end, bucket)
  );

  const GROWTH_LABELS: Record<string, string> = {
    signups: "Signups",
    rsvps: "Going",
    follows: "Follows",
    posts: "Posts",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Analytics+</h1>
          <p className="text-sm text-subtle">
            Deeper trends — activity is derived from going responses, posts, likes,
            comments, follows and saves (no tracking pixel exists).
          </p>
        </div>
        <div className="flex rounded-lg bg-field p-1">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === k ? "bg-card text-ink shadow-sm" : "text-subtle hover:text-ink"
              }`}
            >
              {RANGE_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {(growth.data ?? []).map((g) => (
          <div key={g.key} className="rounded-card border border-hairline bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">
              {GROWTH_LABELS[g.key]} ({RANGE_LABELS[range]})
            </p>
            <p className="mt-1 text-[28px] font-bold tabular-nums">{fmtNum(g.current)}</p>
            <DeltaChip current={g.current} previous={g.previous} />
          </div>
        ))}
        {growth.loading &&
          !growth.data &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Daily active users (activity proxy)">
          {activity.loading && !activity.data ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <TrendChart
              data={activity.data ?? []}
              xKey="day"
              yKey="active_users"
              name="Active users"
              colorIndex={0}
              bucket="day"
              height={220}
            />
          )}
        </Card>
        <Card title="Notifications sent per day">
          {activity.loading && !activity.data ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <TrendChart
              data={activity.data ?? []}
              xKey="day"
              yKey="notifications_sent"
              name="Notifications"
              colorIndex={2}
              bucket="day"
              height={220}
            />
          )}
        </Card>
      </div>

      <Card
        title="Club engagement drilldown"
        action={
          <Select
            value={String(selectedClub ?? "")}
            onChange={(e) => setClubId(e.target.value)}
            className="!w-72"
          >
            {(clubs.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({fmtNum(c.followers)} followers)
              </option>
            ))}
          </Select>
        }
      >
        {engagement.loading && !engagement.data ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <MultiTrendChart
            data={engagement.data ?? []}
            xKey="bucket"
            series={[
              { key: "follows", label: "New followers" },
              { key: "rsvps", label: "Going" },
              { key: "posts", label: "Posts" },
            ]}
            bucket={bucket}
          />
        )}
      </Card>
    </div>
  );
}
