"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  IoAlbumsOutline,
  IoCalendarOutline,
  IoCheckmarkCircleOutline,
  IoDownloadOutline,
  IoHeartOutline,
  IoImagesOutline,
  IoPaperPlaneOutline,
  IoPeopleOutline,
  IoRefreshOutline,
  IoTvOutline,
} from "react-icons/io5";
import {
  getClubFollowerCounts,
  getInsightsTimeseries,
  getInsightsTotals,
  supabase,
} from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import {
  fmtDate,
  fmtDateTime,
  fmtNum,
  fmtTimeAgo,
  RANGE_LABELS,
  rangeToDates,
  eventEnd,
  type RangeKey,
} from "@/lib/format";
import type { Club, EventRow, Post } from "@/lib/types";
import { useData } from "@/lib/useData";
import { StatTile, TrendChart } from "@/components/charts";
import { DataTable } from "@/components/DataTable";
import { Button, Card, Modal, Skeleton, Thumb } from "@/components/ui";

export default function InsightsPage() {
  const [range, setRange] = useState<RangeKey>("90d");
  const { start, end, bucket } = useMemo(() => rangeToDates(range), [range]);
  const [tableModal, setTableModal] = useState<"clubs" | "events" | null>(null);

  const totals = useData("totals", getInsightsTotals);
  const series = useData(`series-${range}`, () =>
    getInsightsTimeseries(start, end, bucket)
  );
  const clubs = useData("clubs", async () => {
    const [clubsRes, counts] = await Promise.all([
      supabase.from("clubs").select("*").limit(1000),
      getClubFollowerCounts(),
    ]);
    if (clubsRes.error) throw new Error(clubsRes.error.message);
    const byId = new Map(counts.map((c) => [c.club_id, c.follower_count]));
    return (clubsRes.data as Club[]).map((c) => ({
      ...c,
      followers: byId.get(c.id) ?? 0,
    }));
  });
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

  const eventCountByClub = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of events.data ?? [])
      if (e.club_id != null) m.set(e.club_id, (m.get(e.club_id) ?? 0) + 1);
    return m;
  }, [events.data]);

  const topClubs = useMemo(
    () => [...(clubs.data ?? [])].sort((a, b) => b.followers - a.followers).slice(0, 10),
    [clubs.data]
  );
  const upcoming = useMemo(
    () =>
      (events.data ?? [])
        .filter((e) => eventEnd(e) >= new Date())
        .sort((a, b) => b.going - a.going),
    [events.data]
  );

  const refreshAll = () => {
    totals.refresh();
    series.refresh();
    clubs.refresh();
    events.refresh();
    posts.refresh();
  };

  const charts: { key: "signups" | "rsvps" | "follows" | "events_created" | "invites"; title: string; colorIndex: number }[] = [
    { key: "signups", title: "Signups", colorIndex: 0 },
    { key: "rsvps", title: "Going", colorIndex: 1 },
    { key: "follows", title: "Club follows", colorIndex: 2 },
    { key: "events_created", title: "Events created", colorIndex: 3 },
    { key: "invites", title: "Event invites sent", colorIndex: 2 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Campus Insights</h1>
          <p className="text-sm text-subtle">Engagement across the Quad app</p>
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
        <Button onClick={refreshAll} busy={totals.refreshing}>
          <IoRefreshOutline /> Refresh
        </Button>
        <Link href="/display">
          <Button variant="primary">
            <IoTvOutline /> Display mode
          </Button>
        </Link>
      </div>

      {/* Always one row: tiles spread to fill, and the row scrolls sideways
          instead of wrapping when the screen is too narrow. */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <StatTile className="min-w-40 shrink-0 grow basis-0" label="Users" value={totals.data?.users} loading={totals.loading} icon={<IoPeopleOutline size={18} />} />
        <StatTile className="min-w-40 shrink-0 grow basis-0" label="Clubs" value={totals.data?.clubs} loading={totals.loading} icon={<IoAlbumsOutline size={18} />} />
        <StatTile className="min-w-40 shrink-0 grow basis-0" label="Events" value={totals.data?.events} loading={totals.loading} icon={<IoCalendarOutline size={18} />} />
        <StatTile className="min-w-40 shrink-0 grow basis-0" label="Posts" value={totals.data?.posts} loading={totals.loading} icon={<IoImagesOutline size={18} />} />
        <StatTile className="min-w-40 shrink-0 grow basis-0" label="Follows" value={totals.data?.follows} loading={totals.loading} icon={<IoHeartOutline size={18} />} />
        <StatTile className="min-w-40 shrink-0 grow basis-0" label="Going" value={totals.data?.going} loading={totals.loading} icon={<IoCheckmarkCircleOutline size={18} />} />
        <StatTile className="min-w-40 shrink-0 grow basis-0" label="Invites sent" value={totals.data?.invites} loading={totals.loading} icon={<IoPaperPlaneOutline size={18} />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {charts.map((c) => (
          <Card key={c.key} title={`${c.title} per ${bucket}`}>
            {series.loading && !series.data ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <TrendChart
                data={series.data ?? []}
                xKey="bucket"
                yKey={c.key}
                name={c.title}
                colorIndex={c.colorIndex}
                bucket={bucket}
              />
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title="Top clubs by followers"
          action={
            <Button onClick={() => setTableModal("clubs")} className="h-8 text-xs">
              View all {clubs.data?.length ?? ""}
            </Button>
          }
          padded={false}
        >
          {clubs.loading && !clubs.data ? (
            <div className="p-5"><Skeleton className="h-64 w-full" /></div>
          ) : (
            <ul>
              {topClubs.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-hairline/60 px-5 py-2.5 last:border-0">
                  <span className="w-5 text-right text-xs font-semibold text-muted">{i + 1}</span>
                  <Thumb src={c.image} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted">{c.category ?? "Uncategorized"}</p>
                  </div>
                  <span className="text-xs text-subtle">{eventCountByClub.get(c.id) ?? 0} events</span>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums">
                    {fmtNum(c.followers)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Top upcoming events by going count"
          action={
            <Button onClick={() => setTableModal("events")} className="h-8 text-xs">
              View all {events.data?.length ?? ""}
            </Button>
          }
          padded={false}
        >
          {events.loading && !events.data ? (
            <div className="p-5"><Skeleton className="h-64 w-full" /></div>
          ) : upcoming.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No upcoming events.</p>
          ) : (
            <ul>
              {upcoming.slice(0, 10).map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 border-b border-hairline/60 px-5 py-2.5 last:border-0">
                  <span className="w-5 text-right text-xs font-semibold text-muted">{i + 1}</span>
                  <Thumb src={e.image} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted">
                      {fmtDateTime(e.date)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums">
                    {fmtNum(e.going)} going
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Recent posts"
        action={
          posts.data && (
            <Button
              className="h-8 text-xs"
              onClick={() =>
                downloadCsv("quad-posts.csv", posts.data ?? [], [
                  { label: "ID", value: (p) => p.id },
                  { label: "Club", value: (p) => p.clubs?.name ?? "" },
                  { label: "Caption", value: (p) => p.caption ?? "" },
                  { label: "Created", value: (p) => p.created_at },
                ])
              }
            >
              <IoDownloadOutline /> CSV
            </Button>
          )
        }
        padded={false}
      >
        {posts.loading && !posts.data ? (
          <div className="p-5"><Skeleton className="h-40 w-full" /></div>
        ) : (posts.data ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No posts yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2">
            {(posts.data ?? []).map((p) => (
              <li key={p.id} className="flex items-start gap-3 border-b border-hairline/60 px-5 py-3">
                <Thumb src={p.image ?? p.clubs?.image} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.clubs?.name ?? "Unknown club"}</p>
                  <p className="line-clamp-2 text-sm text-subtle">{p.caption ?? "(no caption)"}</p>
                  <p className="mt-0.5 text-xs text-muted">{fmtTimeAgo(p.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {tableModal === "clubs" && (
        <Modal title="All clubs" onClose={() => setTableModal(null)} wide>
          <DataTable
            rows={clubs.data ?? []}
            rowKey={(c) => c.id}
            searchable
            searchFn={(c, q) =>
              c.name.toLowerCase().includes(q) ||
              (c.category ?? "").toLowerCase().includes(q)
            }
            csvName="quad-clubs.csv"
            columns={[
              {
                key: "name",
                label: "Club",
                render: (c) => (
                  <span className="flex items-center gap-2">
                    <Thumb src={c.image} size={26} />
                    <span className="font-medium">{c.name}</span>
                  </span>
                ),
                sortValue: (c) => c.name.toLowerCase(),
                csvValue: (c) => c.name,
              },
              {
                key: "category",
                label: "Category",
                render: (c) => <span className="text-subtle">{c.category ?? "—"}</span>,
                sortValue: (c) => c.category ?? "",
                csvValue: (c) => c.category,
              },
              {
                key: "followers",
                label: "Followers",
                align: "right",
                render: (c) => fmtNum(c.followers),
                sortValue: (c) => c.followers,
                csvValue: (c) => c.followers,
              },
              {
                key: "events",
                label: "Events",
                align: "right",
                render: (c) => eventCountByClub.get(c.id) ?? 0,
                sortValue: (c) => eventCountByClub.get(c.id) ?? 0,
                csvValue: (c) => eventCountByClub.get(c.id) ?? 0,
              },
              {
                key: "created",
                label: "Created",
                render: (c) => <span className="text-subtle">{fmtDate(c.created_at)}</span>,
                sortValue: (c) => c.created_at,
                csvValue: (c) => c.created_at,
              },
            ]}
          />
        </Modal>
      )}

      {tableModal === "events" && (
        <Modal title="All events" onClose={() => setTableModal(null)} wide>
          <DataTable
            rows={events.data ?? []}
            rowKey={(e) => e.id}
            searchable
            searchFn={(e, q) =>
              e.title.toLowerCase().includes(q) ||
              (e.location ?? "").toLowerCase().includes(q) ||
              (e.host ?? "").toLowerCase().includes(q)
            }
            csvName="quad-events.csv"
            columns={[
              {
                key: "title",
                label: "Event",
                render: (e) => <span className="font-medium">{e.title}</span>,
                sortValue: (e) => e.title.toLowerCase(),
                csvValue: (e) => e.title,
              },
              {
                key: "date",
                label: "Date",
                render: (e) => <span className="text-subtle">{fmtDateTime(e.date)}</span>,
                sortValue: (e) => e.date,
                csvValue: (e) => e.date,
              },
              {
                key: "location",
                label: "Location",
                render: (e) => <span className="text-subtle">{e.location ?? "—"}</span>,
                sortValue: (e) => e.location ?? "",
                csvValue: (e) => e.location,
              },
              {
                key: "going",
                label: "Going",
                align: "right",
                render: (e) => fmtNum(e.going),
                sortValue: (e) => e.going,
                csvValue: (e) => e.going,
              },
              {
                key: "host",
                label: "Host",
                render: (e) => <span className="text-subtle">{e.host ?? "—"}</span>,
                sortValue: (e) => e.host ?? "",
                csvValue: (e) => e.host,
              },
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
