"use client";

import { useState } from "react";
import { IoSendOutline } from "react-icons/io5";
import { submitBroadcastRequest, supabase } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { BroadcastRequest, EventRow } from "@/lib/types";
import { useData } from "@/lib/useData";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  StatusBadge,
  TextArea,
  useToast,
} from "@/components/ui";

// Elon admins can't send pushes directly — they request a broadcast and the
// super admin approves/schedules it (same flow as the mobile app).
export default function BroadcastRequestsPage() {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [eventId, setEventId] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [busy, setBusy] = useState(false);

  const events = useData("upcoming-events", async () => {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, date")
      .gte("date", new Date().toISOString())
      .order("date", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return data as Pick<EventRow, "id" | "title" | "date">[];
  });

  const requests = useData("my-requests", async () => {
    const { data, error } = await supabase
      .from("broadcast_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data as BroadcastRequest[];
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast("Title and push body are required.", "error");
      return;
    }
    setBusy(true);
    try {
      await submitBroadcastRequest({
        title: title.trim(),
        body: body.trim(),
        message: message.trim() || null,
        eventId: eventId ? Number(eventId) : null,
        suggestedSendAt: sendAt ? new Date(sendAt) : null,
      });
      toast("Broadcast request submitted for approval.");
      setTitle("");
      setBody("");
      setMessage("");
      setEventId("");
      setSendAt("");
      requests.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to submit request.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Broadcast Requests</h1>
        <p className="text-sm text-subtle">
          Request a push notification to all Quad users — the app owner reviews and sends it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="New request">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Push title" hint="Shown as the notification headline.">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
            </Field>
            <Field label="Push body">
              <TextArea value={body} onChange={(e) => setBody(e.target.value)} maxLength={200} required />
            </Field>
            <Field label="Note to the reviewer (optional)" hint="Context for the super admin — not shown to users.">
              <TextArea value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Linked event (optional)">
                <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">None</option>
                  {(events.data ?? []).map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} · {fmtDateTime(ev.date)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Suggested send time (optional)">
                <Input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" variant="primary" busy={busy}>
              <IoSendOutline /> Submit request
            </Button>
          </form>
        </Card>

        <Card title="Your requests" padded={false}>
          {requests.loading && !requests.data ? (
            <div className="p-5"><SkeletonRows /></div>
          ) : (requests.data ?? []).length === 0 ? (
            <EmptyState text="No requests yet." />
          ) : (
            <ul>
              {(requests.data ?? []).map((r) => (
                <li key={r.id} className="border-b border-hairline/60 px-5 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-subtle">{r.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    Requested {fmtDateTime(r.created_at)}
                    {r.suggested_send_at ? ` · suggested ${fmtDateTime(r.suggested_send_at)}` : ""}
                    {r.sent_at ? ` · sent ${fmtDateTime(r.sent_at)}` : ""}
                  </p>
                  {r.status === "rejected" && r.review_note && (
                    <p className="mt-1 rounded-lg bg-field px-2.5 py-1.5 text-xs text-subtle">
                      Reviewer note: {r.review_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
