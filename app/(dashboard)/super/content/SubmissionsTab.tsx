"use client";

import { useState } from "react";
import { IoCheckmarkOutline, IoCloseOutline } from "react-icons/io5";
import { approveClubSubmission, rejectClubSubmission } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { ClubSubmission } from "@/lib/types";
import { Button, Card, ConfirmDialog, EmptyState, SkeletonRows, Thumb, useToast } from "@/components/ui";

export function SubmissionsTab({
  submissions,
  loading,
  onChanged,
}: {
  submissions: ClubSubmission[];
  loading: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [approving, setApproving] = useState<ClubSubmission | null>(null);
  const [rejecting, setRejecting] = useState<ClubSubmission | null>(null);

  return (
    <Card title="Pending club registrations" padded={false}>
      {loading && submissions.length === 0 ? (
        <div className="p-5"><SkeletonRows /></div>
      ) : submissions.length === 0 ? (
        <EmptyState text="No pending club submissions." />
      ) : (
        <ul>
          {submissions.map((s) => (
            <li key={s.id} className="flex items-start gap-4 border-b border-hairline/60 px-5 py-4 last:border-0">
              <Thumb src={s.image_url} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="mt-0.5 line-clamp-3 text-sm text-subtle">{s.description ?? "(no description)"}</p>
                <p className="mt-1 text-xs text-muted">
                  {s.category ? `${s.category} · ` : ""}
                  {s.contact_email ? `${s.contact_email} · ` : ""}
                  {s.website ? `${s.website} · ` : ""}
                  submitted {fmtDateTime(s.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="primary" onClick={() => setApproving(s)}>
                  <IoCheckmarkOutline /> Approve
                </Button>
                <Button variant="destructive" onClick={() => setRejecting(s)}>
                  <IoCloseOutline /> Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {approving && (
        <ConfirmDialog
          title="Approve club submission"
          message={
            <>
              This creates <strong>{approving.name}</strong> as an active club in the app,
              visible to all users.
            </>
          }
          actionLabel="Approve & create club"
          onConfirm={async () => {
            await approveClubSubmission(approving.id);
            toast(`"${approving.name}" approved and created.`);
            onChanged();
          }}
          onClose={() => setApproving(null)}
        />
      )}

      {rejecting && (
        <ConfirmDialog
          title="Reject club submission"
          message={
            <>
              Reject <strong>{rejecting.name}</strong>? The submitter will see the status
              change in the app.
            </>
          }
          actionLabel="Reject"
          onConfirm={async () => {
            await rejectClubSubmission(rejecting.id);
            toast("Submission rejected.");
            onChanged();
          }}
          onClose={() => setRejecting(null)}
        />
      )}
    </Card>
  );
}
