"use client";

import { useState } from "react";
import { IoPencilOutline, IoTrashOutline } from "react-icons/io5";
import { adminDeleteClub, adminUpdateClub, getClubFollowerCounts, supabase } from "@/lib/api";
import { fmtDate, fmtNum } from "@/lib/format";
import type { Club } from "@/lib/types";
import { useData } from "@/lib/useData";
import { Button, Card, ConfirmDialog, SkeletonRows, StatusBadge, Thumb, useToast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { EditModal } from "./editModal";

type ClubWithFollowers = Club & { followers: number };

export function ClubsTab() {
  const toast = useToast();
  const [editing, setEditing] = useState<ClubWithFollowers | null>(null);
  const [deleting, setDeleting] = useState<ClubWithFollowers | null>(null);

  const clubs = useData("sa-clubs", async () => {
    const [clubsRes, counts] = await Promise.all([
      supabase.from("clubs").select("*").order("name").limit(1000),
      getClubFollowerCounts(),
    ]);
    if (clubsRes.error) throw new Error(clubsRes.error.message);
    const byId = new Map(counts.map((c) => [c.club_id, c.follower_count]));
    return (clubsRes.data as Club[]).map((c) => ({ ...c, followers: byId.get(c.id) ?? 0 }));
  });

  return (
    <Card padded={false}>
      <div className="p-5">
        {clubs.loading && !clubs.data ? (
          <SkeletonRows rows={8} />
        ) : (
          <DataTable
            rows={clubs.data ?? []}
            rowKey={(c) => c.id}
            searchable
            searchFn={(c, q) =>
              c.name.toLowerCase().includes(q) || (c.category ?? "").toLowerCase().includes(q)
            }
            csvName="quad-clubs.csv"
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
                key: "status",
                label: "Status",
                render: (c) => <StatusBadge status={c.status ?? "—"} />,
                sortValue: (c) => c.status ?? "",
                csvValue: (c) => c.status,
              },
              {
                key: "visibility",
                label: "Visibility",
                render: (c) => (
                  <span className="text-subtle">{c.is_private ? "private" : (c.visibility ?? "public")}</span>
                ),
                sortValue: (c) => (c.is_private ? "private" : (c.visibility ?? "public")),
                csvValue: (c) => (c.is_private ? "private" : (c.visibility ?? "public")),
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
                key: "created",
                label: "Created",
                render: (c) => <span className="text-subtle">{fmtDate(c.created_at)}</span>,
                sortValue: (c) => c.created_at,
                csvValue: (c) => c.created_at,
              },
              {
                key: "actions",
                label: "",
                align: "right",
                render: (c) => (
                  <span className="flex justify-end gap-1">
                    <Button variant="ghost" className="!h-8 !px-2" title="Edit" onClick={() => setEditing(c)}>
                      <IoPencilOutline />
                    </Button>
                    <Button
                      variant="ghost"
                      className="!h-8 !px-2 !text-destructive"
                      title="Delete"
                      onClick={() => setDeleting(c)}
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
          title={`Edit club — ${editing.name}`}
          initial={editing as unknown as Record<string, unknown>}
          fields={[
            { key: "name", label: "Name", kind: "text" },
            { key: "category", label: "Category", kind: "text" },
            { key: "description", label: "Description", kind: "textarea" },
            { key: "summary", label: "Summary", kind: "textarea" },
            { key: "contact_email", label: "Contact email", kind: "text" },
            { key: "meeting_times", label: "Meeting times", kind: "text" },
            { key: "website", label: "Website", kind: "text" },
            { key: "instagram", label: "Instagram", kind: "text" },
            { key: "image", label: "Image URL", kind: "text" },
            { key: "status", label: "Status", kind: "select", options: ["Active", "Inactive"] },
            { key: "is_private", label: "Private club", kind: "boolean" },
          ]}
          onSave={async (patch) => {
            await adminUpdateClub(editing.id, patch);
            toast("Club updated.");
            clubs.refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete club"
          message={
            <>
              This permanently deletes <strong>{deleting.name}</strong> — including its
              events, posts, memberships, join requests, and notifications. This cannot
              be undone.
            </>
          }
          confirmWord={deleting.name}
          actionLabel="Delete club"
          onConfirm={async () => {
            await adminDeleteClub(deleting.id);
            toast("Club deleted.");
            clubs.refresh();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}
