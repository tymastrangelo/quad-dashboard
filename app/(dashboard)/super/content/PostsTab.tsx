"use client";

import { useState } from "react";
import { IoPencilOutline, IoTrashOutline } from "react-icons/io5";
import { adminDeletePost, adminUpdatePost, supabase } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { Post } from "@/lib/types";
import { useData } from "@/lib/useData";
import { Button, Card, ConfirmDialog, SkeletonRows, Thumb, useToast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { EditModal } from "./editModal";

export function PostsTab() {
  const toast = useToast();
  const [editing, setEditing] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);

  const posts = useData("sa-posts", async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, image, created_at, club_id, type, user_id, event_id, clubs(name, image)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data as unknown as Post[];
  });

  return (
    <Card padded={false}>
      <div className="p-5">
        {posts.loading && !posts.data ? (
          <SkeletonRows rows={8} />
        ) : (
          <DataTable
            rows={posts.data ?? []}
            rowKey={(p) => p.id}
            searchable
            searchFn={(p, q) =>
              (p.caption ?? "").toLowerCase().includes(q) ||
              (p.clubs?.name ?? "").toLowerCase().includes(q)
            }
            csvName="quad-posts.csv"
            columns={[
              {
                key: "club",
                label: "Club",
                render: (p) => (
                  <span className="flex items-center gap-2">
                    <Thumb src={p.clubs?.image} size={28} />
                    <span className="font-medium">{p.clubs?.name ?? "—"}</span>
                  </span>
                ),
                sortValue: (p) => p.clubs?.name ?? "",
                csvValue: (p) => p.clubs?.name,
              },
              {
                key: "caption",
                label: "Caption",
                render: (p) => (
                  <span className="line-clamp-2 max-w-md text-subtle">{p.caption ?? "(no caption)"}</span>
                ),
                csvValue: (p) => p.caption,
              },
              {
                key: "image",
                label: "Image",
                render: (p) => <Thumb src={p.image} size={36} />,
              },
              {
                key: "created",
                label: "Posted",
                render: (p) => <span className="text-subtle">{fmtDateTime(p.created_at)}</span>,
                sortValue: (p) => p.created_at,
                csvValue: (p) => p.created_at,
              },
              {
                key: "actions",
                label: "",
                align: "right",
                render: (p) => (
                  <span className="flex justify-end gap-1">
                    <Button variant="ghost" className="!h-8 !px-2" title="Edit" onClick={() => setEditing(p)}>
                      <IoPencilOutline />
                    </Button>
                    <Button
                      variant="ghost"
                      className="!h-8 !px-2 !text-destructive"
                      title="Delete"
                      onClick={() => setDeleting(p)}
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
          title={`Edit post — ${editing.clubs?.name ?? `#${editing.id}`}`}
          initial={editing as unknown as Record<string, unknown>}
          fields={[
            { key: "caption", label: "Caption", kind: "textarea" },
            { key: "image", label: "Image URL", kind: "text" },
          ]}
          onSave={async (patch) => {
            await adminUpdatePost(editing.id, patch);
            toast("Post updated.");
            posts.refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete post"
          message={
            <>
              This permanently deletes this post by{" "}
              <strong>{deleting.clubs?.name ?? "unknown club"}</strong> along with its
              likes and comments. This cannot be undone.
            </>
          }
          confirmWord="delete"
          actionLabel="Delete post"
          onConfirm={async () => {
            await adminDeletePost(deleting.id);
            toast("Post deleted.");
            posts.refresh();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}
