"use client";

import { useMemo, useState } from "react";
import {
  IoCalendarOutline,
  IoGlobeOutline,
  IoLogoFacebook,
  IoLogoInstagram,
  IoLogoTwitter,
  IoLogoYoutube,
  IoMailOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import { getClubFollowerCounts, supabase } from "@/lib/api";
import { eventEnd, fmtDate, fmtDateTime, fmtNum, fmtTimeAgo } from "@/lib/format";
import type { Club, EventRow, Post } from "@/lib/types";
import { useData } from "@/lib/useData";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Card, Modal, Skeleton, StatusBadge, Thumb } from "@/components/ui";

type ClubRow = Club & { followers: number };
type EventWithGoing = EventRow & { going: number };

const SOCIALS: { key: keyof Club; icon: typeof IoGlobeOutline; label: string }[] = [
  { key: "website", icon: IoGlobeOutline, label: "Website" },
  { key: "instagram", icon: IoLogoInstagram, label: "Instagram" },
  { key: "twitter", icon: IoLogoTwitter, label: "Twitter" },
  { key: "facebook", icon: IoLogoFacebook, label: "Facebook" },
  { key: "youtube", icon: IoLogoYoutube, label: "YouTube" },
];

export default function ClubsPage() {
  const [selected, setSelected] = useState<ClubRow | null>(null);

  const clubs = useData("clubs-directory", async () => {
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

  const events = useData("clubs-directory-events", async () => {
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

  const eventsByClub = useMemo(() => {
    const m = new Map<number, EventWithGoing[]>();
    for (const e of events.data ?? []) {
      if (e.club_id == null) continue;
      m.set(e.club_id, [...(m.get(e.club_id) ?? []), e]);
    }
    return m;
  }, [events.data]);

  const clubPosts = useData(`club-posts-${selected?.id ?? "none"}`, async () => {
    if (!selected) return [] as Post[];
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, image, created_at, club_id, type, user_id, event_id")
      .eq("club_id", selected.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return data as Post[];
  });

  const upcomingFor = (clubId: number) =>
    (eventsByClub.get(clubId) ?? [])
      .filter((e) => eventEnd(e) >= new Date())
      .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Clubs</h1>
          <p className="text-sm text-subtle">
            Every club on Quad — click one for its events, posts, and contacts
          </p>
        </div>
        <Button onClick={() => { clubs.refresh(); events.refresh(); }} busy={clubs.refreshing}>
          <IoRefreshOutline /> Refresh
        </Button>
      </div>

      <Card>
        {clubs.loading && !clubs.data ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <DataTable
            rows={clubs.data ?? []}
            rowKey={(c) => c.id}
            searchable
            searchFn={(c, q) =>
              c.name.toLowerCase().includes(q) ||
              (c.category ?? "").toLowerCase().includes(q) ||
              (c.contact_email ?? "").toLowerCase().includes(q)
            }
            csvName="quad-clubs.csv"
            onRowClick={setSelected}
            emptyText="No clubs yet."
            columns={[
              {
                key: "name",
                label: "Club",
                render: (c) => (
                  <span className="flex items-center gap-2">
                    <Thumb src={c.image} size={28} />
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
                render: (c) => (eventsByClub.get(c.id) ?? []).length,
                sortValue: (c) => (eventsByClub.get(c.id) ?? []).length,
                csvValue: (c) => (eventsByClub.get(c.id) ?? []).length,
              },
              {
                key: "upcoming",
                label: "Upcoming",
                align: "right",
                render: (c) => upcomingFor(c.id).length,
                sortValue: (c) => upcomingFor(c.id).length,
                csvValue: (c) => upcomingFor(c.id).length,
              },
              {
                key: "contact",
                label: "Contact",
                render: (c) => <span className="text-subtle">{c.contact_email ?? "—"}</span>,
                sortValue: (c) => c.contact_email ?? "",
                csvValue: (c) => c.contact_email,
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
        )}
      </Card>

      {selected && (
        <Modal title="Club details" onClose={() => setSelected(null)} wide>
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Thumb src={selected.image} size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">{selected.name}</h3>
                  {selected.category && <Badge tone="gold">{selected.category}</Badge>}
                  {selected.status && <StatusBadge status={selected.status} />}
                  {selected.is_private && <Badge>private</Badge>}
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-subtle">
                  {selected.description ?? selected.summary ?? "No description."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  {selected.contact_email && (
                    <span className="flex items-center gap-1">
                      <IoMailOutline /> {selected.contact_email}
                    </span>
                  )}
                  {selected.meeting_times && (
                    <span className="flex items-center gap-1">
                      <IoCalendarOutline /> {selected.meeting_times}
                    </span>
                  )}
                  <span>Created {fmtDate(selected.created_at)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {SOCIALS.filter((s) => selected[s.key]).map((s) => (
                    <a
                      key={s.key}
                      href={String(selected[s.key])}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-maroon hover:underline"
                    >
                      <s.icon size={14} /> {s.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tabular-nums">{fmtNum(selected.followers)}</p>
                <p className="text-xs text-muted">followers</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                  Upcoming events
                </h4>
                {upcomingFor(selected.id).length === 0 ? (
                  <p className="text-sm text-muted">No upcoming events.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {upcomingFor(selected.id).slice(0, 5).map((e) => (
                      <li key={e.id} className="flex items-center gap-2.5">
                        <Thumb src={e.image} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.title}</p>
                          <p className="truncate text-xs text-muted">
                            {fmtDateTime(e.date)}
                            {e.location ? ` · ${e.location}` : ""}
                          </p>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-subtle">
                          {fmtNum(e.going)} going
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                  Recent posts
                </h4>
                {clubPosts.loading && !clubPosts.data ? (
                  <Skeleton className="h-24 w-full" />
                ) : (clubPosts.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted">No posts yet.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {(clubPosts.data ?? []).map((p) => (
                      <li key={p.id} className="flex items-start gap-2.5">
                        <Thumb src={p.image} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-subtle">
                            {p.caption ?? "(no caption)"}
                          </p>
                          <p className="text-xs text-muted">{fmtTimeAgo(p.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
