"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { IoRefreshOutline, IoStatsChartOutline, IoTvOutline } from "react-icons/io5";
import { getInsightsTimeseries, supabase } from "@/lib/api";
import { eventEnd, fmtDateTime, fmtNum, fmtTimeAgo } from "@/lib/format";
import type { EventRow, InsightsPoint, Post } from "@/lib/types";
import { useData } from "@/lib/useData";
import { DeltaChip } from "@/components/charts";
import { Button, Card, EmptyState, Skeleton, Thumb } from "@/components/ui";

// One "worth knowing" fact, derived from real data — no invented tracking.
function Highlight({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{eyebrow}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function TodayPage() {
  // Same keys + queries as Campus Insights → shared useData cache, so
  // switching between the two pages is instant.
  const events = useData("events", async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*, rsvps(count)")
      .order("date", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data as EventRow[]).map((e) => ({
      ...e,
      going: e.rsvps?.[0]?.count ?? 0,
    }));
  });
  const posts = useData("posts", async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, image, created_at, club_id, type, user_id, event_id, clubs(name, image)")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return data as unknown as Post[];
  });
  const week = useData("series-week", () => {
    const now = new Date();
    return getInsightsTimeseries(new Date(now.getTime() - 7 * 86400_000), now, "day");
  });
  const weekPrev = useData("series-week-prev", () => {
    const now = new Date();
    return getInsightsTimeseries(
      new Date(now.getTime() - 14 * 86400_000),
      new Date(now.getTime() - 7 * 86400_000),
      "day"
    );
  });

  // Hero facts: what's on today/this week, live now, and up next.
  const glance = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400_000);
    const all = events.data ?? [];
    const thisWeek = all.filter((e) => {
      const d = new Date(e.date);
      return eventEnd(e) >= now && d <= in7;
    });
    const today = thisWeek
      .filter((e) => new Date(e.date).toDateString() === now.toDateString())
      .sort((a, b) => a.date.localeCompare(b.date));
    const live = all.filter((e) => e.is_live && eventEnd(e) >= now);
    const byDay = new Map<string, number>();
    for (const e of thisWeek) {
      const day = new Date(e.date).toLocaleDateString(undefined, { weekday: "long" });
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const busiest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const next = thisWeek
      .filter((e) => new Date(e.date) > now)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const mostAnticipated = [...thisWeek].sort((a, b) => b.going - a.going)[0];
    const freshPosts = (posts.data ?? []).filter(
      (p) => new Date(p.created_at).getTime() > now.getTime() - 86400_000
    );
    const dateLine = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return { weekCount: thisWeek.length, today, live, busiest, next, mostAnticipated, freshPosts, dateLine };
  }, [events.data, posts.data]);

  // ponytail: derived from the 40 most recent posts — plenty at campus scale.
  const hotClub = useMemo(() => {
    const cutoff = new Date().getTime() - 7 * 86400_000;
    const counts = new Map<number, { n: number; name: string | null; image: string | null }>();
    for (const p of posts.data ?? []) {
      if (p.club_id == null || new Date(p.created_at).getTime() < cutoff) continue;
      const cur = counts.get(p.club_id) ?? {
        n: 0,
        name: p.clubs?.name ?? null,
        image: p.clubs?.image ?? null,
      };
      cur.n++;
      counts.set(p.club_id, cur);
    }
    return [...counts.values()].sort((a, b) => b.n - a.n)[0] ?? null;
  }, [posts.data]);

  const sumKey = (rows: InsightsPoint[] | undefined, key: keyof InsightsPoint) =>
    (rows ?? []).reduce((a, r) => a + Number(r[key] ?? 0), 0);

  const momentum: { key: keyof InsightsPoint; label: string }[] = [
    { key: "signups", label: "Signups" },
    { key: "rsvps", label: "Going" },
    { key: "follows", label: "Club follows" },
    { key: "posts", label: "Posts" },
    { key: "invites", label: "Invites sent" },
  ];

  const refreshAll = () => {
    events.refresh();
    posts.refresh();
    week.refresh();
    weekPrev.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Today at a Glance</h1>
          <p className="text-sm text-subtle">{glance.dateLine}</p>
        </div>
        <Button onClick={refreshAll} busy={events.refreshing}>
          <IoRefreshOutline /> Refresh
        </Button>
        <Link href="/insights">
          <Button>
            <IoStatsChartOutline /> Campus Insights
          </Button>
        </Link>
        <Link href="/display">
          <Button variant="primary">
            <IoTvOutline /> Display mode
          </Button>
        </Link>
      </div>

      {/* The one bold element on the page: brand maroon spent on "right now". */}
      <section className="rounded-card bg-gradient-to-r from-[#73000A] to-[#9a2733] px-6 py-5 text-white shadow-md">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
              This week on campus
            </p>
            {events.loading && !events.data ? (
              <Skeleton className="mt-2 h-8 w-64 bg-white/20" />
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold leading-tight">
                  {glance.weekCount === 0
                    ? "No events scheduled this week"
                    : `${glance.weekCount} event${glance.weekCount === 1 ? "" : "s"} this week${
                        glance.today.length ? ` · ${glance.today.length} today` : ""
                      }`}
                </p>
                <p className="mt-1 truncate text-sm text-white/70">
                  {glance.next
                    ? `Next up: ${glance.next.title} · ${fmtDateTime(glance.next.date)}`
                    : glance.weekCount === 0
                      ? "A quiet week — a good time to line something up."
                      : "Nothing else scheduled after today."}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {glance.live.length === 0 ? (
              <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm text-white/70">
                Nothing live right now
              </span>
            ) : (
              glance.live.slice(0, 3).map((e) => (
                <span
                  key={e.id}
                  className="flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-white" />
                  </span>
                  {e.title} — live now
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Highlight eyebrow="Most anticipated this week">
          {events.loading && !events.data ? (
            <Skeleton className="h-10 w-full" />
          ) : glance.mostAnticipated ? (
            <div className="flex items-center gap-3">
              <Thumb src={glance.mostAnticipated.image} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{glance.mostAnticipated.title}</p>
                <p className="text-xs text-subtle">
                  {fmtNum(glance.mostAnticipated.going)} going · {fmtDateTime(glance.mostAnticipated.date)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No upcoming events this week.</p>
          )}
        </Highlight>
        <Highlight eyebrow="Busiest day ahead">
          {events.loading && !events.data ? (
            <Skeleton className="h-10 w-full" />
          ) : glance.busiest ? (
            <div>
              <p className="text-sm font-semibold">{glance.busiest[0]}</p>
              <p className="text-xs text-subtle">
                {glance.busiest[1]} event{glance.busiest[1] === 1 ? "" : "s"} scheduled
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">Nothing on the calendar this week.</p>
          )}
        </Highlight>
        <Highlight eyebrow="Most active club · 7 days">
          {posts.loading && !posts.data ? (
            <Skeleton className="h-10 w-full" />
          ) : hotClub ? (
            <div className="flex items-center gap-3">
              <Thumb src={hotClub.image} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{hotClub.name ?? "Unknown club"}</p>
                <p className="text-xs text-subtle">
                  {hotClub.n} post{hotClub.n === 1 ? "" : "s"} this week
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No club posts in the last 7 days.</p>
          )}
        </Highlight>
      </div>

      {/* Momentum: this 7 days vs the 7 before. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {momentum.map((m) => (
          <div key={m.key} className="rounded-card border border-hairline bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              {m.label} · 7d
            </p>
            {week.loading && !week.data ? (
              <Skeleton className="mt-1.5 h-6 w-16" />
            ) : (
              <div className="mt-0.5 flex items-baseline gap-2">
                <p className="text-xl font-bold tabular-nums">{fmtNum(sumKey(week.data, m.key))}</p>
                {weekPrev.data && (
                  <DeltaChip
                    current={sumKey(week.data, m.key)}
                    previous={sumKey(weekPrev.data, m.key)}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Today's schedule" padded={false}>
          {events.loading && !events.data ? (
            <div className="p-5"><Skeleton className="h-40 w-full" /></div>
          ) : glance.today.length === 0 ? (
            <EmptyState text="No events today — the calendar is clear." />
          ) : (
            <ul>
              {glance.today.map((e) => (
                <li key={e.id} className="flex items-center gap-3 border-b border-hairline/60 px-5 py-3 last:border-0">
                  <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-subtle">
                    {fmtTime(e.date)}
                  </span>
                  <Thumb src={e.image} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted">{e.location ?? "Location TBA"}</p>
                  </div>
                  {e.is_live && (
                    <span className="flex items-center gap-1.5 rounded-full bg-maroon-light px-2.5 py-1 text-[11px] font-semibold text-maroon">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-maroon opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-maroon" />
                      </span>
                      Live
                    </span>
                  )}
                  <span className="text-sm font-semibold tabular-nums">{fmtNum(e.going)} going</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Fresh activity · last 24 hours" padded={false}>
          {posts.loading && !posts.data ? (
            <div className="p-5"><Skeleton className="h-40 w-full" /></div>
          ) : glance.freshPosts.length === 0 ? (
            <EmptyState text="No posts in the last 24 hours." />
          ) : (
            <ul>
              {glance.freshPosts.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-start gap-3 border-b border-hairline/60 px-5 py-3 last:border-0">
                  <Thumb src={p.image ?? p.clubs?.image} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.clubs?.name ?? "Unknown club"}</p>
                    <p className="line-clamp-1 text-sm text-subtle">{p.caption ?? "(no caption)"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{fmtTimeAgo(p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
