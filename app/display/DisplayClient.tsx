"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IoArrowBackOutline } from "react-icons/io5";
import { getClubFollowerCounts, getInsightsTimeseries, getInsightsTotals, supabase } from "@/lib/api";
import { eventEnd, fmtDateTime, fmtNum } from "@/lib/format";
import type { Club, EventRow } from "@/lib/types";
import { useData } from "@/lib/useData";
import { StatTile, TrendChart } from "@/components/charts";
import { Card, Skeleton } from "@/components/ui";

const REFRESH_MS = 60_000; // silent revalidation; stale data stays visible

export function DisplayClient() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const totals = useData("d-totals", getInsightsTotals, { refreshMs: REFRESH_MS });
  const series = useData(
    "d-series",
    () => getInsightsTimeseries(new Date(Date.now() - 90 * 86400_000), new Date(), "week"),
    { refreshMs: REFRESH_MS }
  );
  const clubs = useData(
    "d-clubs",
    async () => {
      const [clubsRes, counts] = await Promise.all([
        supabase.from("clubs").select("id, name, image, category").limit(1000),
        getClubFollowerCounts(),
      ]);
      if (clubsRes.error) throw new Error(clubsRes.error.message);
      const byId = new Map(counts.map((c) => [c.club_id, c.follower_count]));
      return (clubsRes.data as Pick<Club, "id" | "name" | "image" | "category">[])
        .map((c) => ({ ...c, followers: byId.get(c.id) ?? 0 }))
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 5);
    },
    { refreshMs: REFRESH_MS }
  );
  const events = useData(
    "d-events",
    async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date, end_date, location, image, rsvps(count)")
        .gte("date", new Date(Date.now() - 86400_000).toISOString())
        .order("date", { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data as unknown as EventRow[])
        .filter((e) => eventEnd(e) >= new Date())
        .map((e) => ({ ...e, going: e.rsvps?.[0]?.count ?? 0 }))
        .slice(0, 5);
    },
    { refreshMs: REFRESH_MS }
  );

  const tiles = useMemo(
    () => [
      { label: "Users", value: totals.data?.users },
      { label: "Clubs", value: totals.data?.clubs },
      { label: "Events", value: totals.data?.events },
      { label: "Posts", value: totals.data?.posts },
      { label: "Follows", value: totals.data?.follows },
      { label: "Going", value: totals.data?.going },
      { label: "Invites sent", value: totals.data?.invites },
    ],
    [totals.data]
  );

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Quad" className="size-11 shrink-0 rounded-xl" />
            <h1 className="text-3xl font-bold">Quad · Campus Insights</h1>
          </div>
          <p className="mt-1 text-sm text-muted">
            Auto-refreshes every minute ·{" "}
            <Link href="/insights" className="inline-flex items-center gap-1 text-subtle underline-offset-2 hover:underline">
              <IoArrowBackOutline /> back to dashboard
            </Link>
          </p>
        </div>
        <p className="text-right text-2xl font-semibold tabular-nums text-subtle">
          {now
            ? now.toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : " "}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 xl:grid-cols-7">
        {tiles.map((t) => (
          <StatTile key={t.label} big label={t.label} value={t.value} loading={totals.loading} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Signups per week (90 days)">
          {series.loading && !series.data ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <TrendChart data={series.data ?? []} xKey="bucket" yKey="signups" name="Signups" colorIndex={0} height={240} />
          )}
        </Card>
        <Card title="Going per week (90 days)">
          {series.loading && !series.data ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <TrendChart data={series.data ?? []} xKey="bucket" yKey="rsvps" name="Going" colorIndex={1} height={240} />
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Top clubs by followers" padded={false}>
          {clubs.loading && !clubs.data ? (
            <div className="p-5"><Skeleton className="h-56 w-full" /></div>
          ) : (
            <ul>
              {(clubs.data ?? []).map((c, i) => (
                <li key={c.id} className="flex items-center gap-4 border-b border-hairline/60 px-6 py-3.5 last:border-0">
                  <span className="w-6 text-right text-lg font-bold text-gold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{c.name}</p>
                    <p className="truncate text-sm text-muted">{c.category ?? ""}</p>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{fmtNum(c.followers)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Next up on campus" padded={false}>
          {events.loading && !events.data ? (
            <div className="p-5"><Skeleton className="h-56 w-full" /></div>
          ) : (events.data ?? []).length === 0 ? (
            <p className="px-6 py-10 text-center text-muted">No upcoming events.</p>
          ) : (
            <ul>
              {(events.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center gap-4 border-b border-hairline/60 px-6 py-3.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{e.title}</p>
                    <p className="truncate text-sm text-muted">
                      {fmtDateTime(e.date)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{fmtNum(e.going)} going</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
