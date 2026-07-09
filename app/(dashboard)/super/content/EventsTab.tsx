"use client";

import { useMemo, useState } from "react";
import { IoPencilOutline, IoTrashOutline } from "react-icons/io5";
import { adminDeleteEvent, adminUpdateEvent, supabase } from "@/lib/api";
import { fmtDateTime, fmtNum } from "@/lib/format";
import type { Club, EventRow } from "@/lib/types";
import { useData } from "@/lib/useData";
import { Badge, Button, Card, ConfirmDialog, SkeletonRows, Thumb, useToast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { EditModal } from "./editModal";

type EventWithGoing = EventRow & { going: number };

export function EventsTab() {
  const toast = useToast();
  const [editing, setEditing] = useState<EventWithGoing | null>(null);
  const [deleting, setDeleting] = useState<EventWithGoing | null>(null);

  const events = useData("sa-events", async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*, rsvps(count)")
      .order("date", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data as EventRow[]).map((e) => ({ ...e, going: e.rsvps?.[0]?.count ?? 0 }));
  });

  const clubs = useData("sa-clubs-names", async () => {
    const { data, error } = await supabase.from("clubs").select("id, name").limit(1000);
    if (error) throw new Error(error.message);
    return data as Pick<Club, "id" | "name">[];
  });

  const clubName = useMemo(() => {
    const m = new Map((clubs.data ?? []).map((c) => [c.id, c.name]));
    return (id: number | null) => (id == null ? "—" : (m.get(id) ?? `#${id}`));
  }, [clubs.data]);

  return (
    <Card padded={false}>
      <div className="p-5">
        {events.loading && !events.data ? (
          <SkeletonRows rows={8} />
        ) : (
          <DataTable
            rows={events.data ?? []}
            rowKey={(e) => e.id}
            searchable
            searchFn={(e, q) =>
              e.title.toLowerCase().includes(q) ||
              (e.location ?? "").toLowerCase().includes(q) ||
              clubName(e.club_id).toLowerCase().includes(q)
            }
            csvName="quad-events.csv"
            columns={[
              {
                key: "title",
                label: "Event",
                render: (e) => (
                  <span className="flex items-center gap-2">
                    <Thumb src={e.image} size={28} />
                    <span className="font-medium">{e.title}</span>
                    {e.is_live && <Badge tone="maroon">LIVE</Badge>}
                  </span>
                ),
                sortValue: (e) => e.title.toLowerCase(),
                csvValue: (e) => e.title,
              },
              {
                key: "club",
                label: "Club",
                render: (e) => <span className="text-subtle">{clubName(e.club_id)}</span>,
                sortValue: (e) => clubName(e.club_id),
                csvValue: (e) => clubName(e.club_id),
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
                key: "actions",
                label: "",
                align: "right",
                render: (e) => (
                  <span className="flex justify-end gap-1">
                    <Button variant="ghost" className="!h-8 !px-2" title="Edit" onClick={() => setEditing(e)}>
                      <IoPencilOutline />
                    </Button>
                    <Button
                      variant="ghost"
                      className="!h-8 !px-2 !text-destructive"
                      title="Delete"
                      onClick={() => setDeleting(e)}
                    >
                      <IoTrashOutline />
                    </Button>
                  </span>
                ),
              },
            ]}
          />
        )}
      </div>

      {editing && (
        <EditModal
          title={`Edit event — ${editing.title}`}
          initial={editing as unknown as Record<string, unknown>}
          fields={[
            { key: "title", label: "Title", kind: "text" },
            { key: "host", label: "Host", kind: "text" },
            { key: "description", label: "Description", kind: "textarea" },
            { key: "date", label: "Starts", kind: "datetime" },
            { key: "end_date", label: "Ends", kind: "datetime" },
            { key: "location", label: "Location", kind: "text" },
            { key: "room", label: "Room", kind: "text" },
            { key: "image", label: "Image URL", kind: "text" },
            { key: "external_link", label: "External link", kind: "text" },
            { key: "is_live", label: "Live now", kind: "boolean" },
            { key: "rsvps_enabled", label: "RSVPs enabled", kind: "boolean" },
            { key: "members_only", label: "Members only", kind: "boolean" },
          ]}
          onSave={async (patch) => {
            await adminUpdateEvent(editing.id, patch);
            toast("Event updated.");
            events.refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete event"
          message={
            <>
              This permanently deletes <strong>{deleting.title}</strong> and its RSVPs,
              saves, and notifications. This cannot be undone.
            </>
          }
          confirmWord="delete"
          actionLabel="Delete event"
          onConfirm={async () => {
            await adminDeleteEvent(deleting.id);
            toast("Event deleted.");
            events.refresh();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}
