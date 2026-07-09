"use client";

import { useMemo, useState } from "react";
import { IoRefreshOutline } from "react-icons/io5";
import { supabase } from "@/lib/api";
import { eventEnd, fmtDateTime, fmtNum } from "@/lib/format";
import type { EventRow } from "@/lib/types";
import { useData } from "@/lib/useData";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Card, Skeleton, Tabs, Thumb } from "@/components/ui";

type EventWithGoing = EventRow & { going: number };

export default function EventsPage() {
  const [tab, setTab] = useState("upcoming");

  const events = useData("events-directory", async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*, rsvps(count), clubs(name)")
      .order("date", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data as EventWithGoing[]).map((e) => ({
      ...e,
      going: e.rsvps?.[0]?.count ?? 0,
    }));
  });

  const rows = useMemo(() => {
    const now = new Date();
    const all = events.data ?? [];
    if (tab === "upcoming")
      return all.filter((e) => eventEnd(e) >= now).sort((a, b) => a.date.localeCompare(b.date));
    if (tab === "past")
      return all.filter((e) => eventEnd(e) < now).sort((a, b) => b.date.localeCompare(a.date));
    return [...all].sort((a, b) => b.date.localeCompare(a.date));
  }, [events.data, tab]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Events</h1>
          <p className="text-sm text-subtle">
            Every event on Quad with live going counts
          </p>
        </div>
        <Tabs
          tabs={[
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past" },
            { key: "all", label: "All" },
          ]}
          active={tab}
          onChange={setTab}
        />
        <Button onClick={events.refresh} busy={events.refreshing}>
          <IoRefreshOutline /> Refresh
        </Button>
      </div>

      <Card>
        {events.loading && !events.data ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            searchable
            searchFn={(e, q) =>
              e.title.toLowerCase().includes(q) ||
              (e.clubs?.name ?? "").toLowerCase().includes(q) ||
              (e.location ?? "").toLowerCase().includes(q) ||
              (e.host ?? "").toLowerCase().includes(q)
            }
            csvName={`quad-events-${tab}.csv`}
            emptyText={tab === "upcoming" ? "No upcoming events." : "No events here."}
            columns={[
              {
                key: "title",
                label: "Event",
                render: (e) => (
                  <span className="flex items-center gap-2">
                    <Thumb src={e.image} size={28} />
                    <span className="font-medium">{e.title}</span>
                    {e.members_only && <Badge>members only</Badge>}
                  </span>
                ),
                sortValue: (e) => e.title.toLowerCase(),
                csvValue: (e) => e.title,
              },
              {
                key: "club",
                label: "Club / Host",
                render: (e) => (
                  <span className="text-subtle">{e.clubs?.name ?? e.host ?? "—"}</span>
                ),
                sortValue: (e) => (e.clubs?.name ?? e.host ?? "").toLowerCase(),
                csvValue: (e) => e.clubs?.name ?? e.host,
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
                render: (e) => (
                  <span className="text-subtle">
                    {[e.location, e.room].filter(Boolean).join(" · ") || "—"}
                  </span>
                ),
                sortValue: (e) => e.location ?? "",
                csvValue: (e) => [e.location, e.room].filter(Boolean).join(" · "),
              },
              {
                key: "going",
                label: "Going",
                align: "right",
                render: (e) => fmtNum(e.going),
                sortValue: (e) => e.going,
                csvValue: (e) => e.going,
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
