"use client";

import { useState } from "react";
import { IoCloseOutline, IoSendOutline, IoTimeOutline } from "react-icons/io5";
import {
  addAllowedSender,
  cancelScheduledBroadcast,
  getAdminBroadcastSends,
  getSenderPermissions,
  markRequestSent,
  rejectBroadcastRequest,
  removeAllowedSender,
  scheduleBroadcast,
  sendCustomBroadcast,
  supabase,
} from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { BroadcastRequest, Club, EventRow, ScheduledBroadcast } from "@/lib/types";
import { useData } from "@/lib/useData";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Modal,
  Select,
  SkeletonRows,
  StatusBadge,
  TextArea,
  Toggle,
  useToast,
} from "@/components/ui";

type ComposerState = {
  title: string;
  body: string;
  message: string;
  eventId: string;
  clubId: string;
  includeInApp: boolean;
  includeSender: boolean;
  mode: "now" | "later";
  scheduledFor: string;
  requestId: number | null;
};

const EMPTY: ComposerState = {
  title: "",
  body: "",
  message: "",
  eventId: "",
  clubId: "",
  includeInApp: true,
  includeSender: false,
  mode: "now",
  scheduledFor: "",
  requestId: null,
};

export default function BroadcastCenterPage() {
  const toast = useToast();
  const [c, setC] = useState<ComposerState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<BroadcastRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<ScheduledBroadcast | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");

  const permissions = useData("sender-permissions", getSenderPermissions);

  const pending = useData("pending-requests", async () => {
    const { data, error } = await supabase
      .from("broadcast_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as BroadcastRequest[];
  });

  const scheduled = useData("scheduled-broadcasts", async () => {
    const { data, error } = await supabase
      .from("scheduled_broadcasts")
      .select("*")
      .order("scheduled_for", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ScheduledBroadcast[];
  });

  const sends = useData("broadcast-sends", getAdminBroadcastSends);

  const events = useData("bc-events", async () => {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, date")
      .gte("date", new Date().toISOString())
      .order("date", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return data as Pick<EventRow, "id" | "title" | "date">[];
  });

  const clubs = useData("bc-clubs", async () => {
    const { data, error } = await supabase.from("clubs").select("id, name").order("name").limit(1000);
    if (error) throw new Error(error.message);
    return data as Pick<Club, "id" | "name">[];
  });

  const upcoming = scheduled.data?.filter((s) => s.status === "scheduled") ?? [];
  const history = scheduled.data?.filter((s) => s.status !== "scheduled") ?? [];

  const loadRequest = (r: BroadcastRequest) => {
    setC({
      ...EMPTY,
      title: r.title,
      body: r.body,
      message: r.message ?? "",
      eventId: r.event_id ? String(r.event_id) : "",
      mode: r.suggested_send_at && new Date(r.suggested_send_at) > new Date() ? "later" : "now",
      scheduledFor: r.suggested_send_at
        ? toLocalInput(new Date(r.suggested_send_at))
        : "",
      requestId: r.id,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const doSend = async () => {
    setBusy(true);
    try {
      if (c.mode === "later") {
        const when = new Date(c.scheduledFor);
        if (!c.scheduledFor || when <= new Date())
          throw new Error("Scheduled time must be in the future.");
        await scheduleBroadcast({
          title: c.title.trim(),
          body: c.body.trim(),
          message: c.message.trim() || null,
          eventId: c.eventId ? Number(c.eventId) : null,
          clubId: c.clubId ? Number(c.clubId) : null,
          includeInApp: c.includeInApp,
          includeSender: c.includeSender,
          scheduledFor: when,
          requestId: c.requestId,
        });
        toast(`Broadcast scheduled for ${fmtDateTime(when.toISOString())}.`);
      } else {
        const res = await sendCustomBroadcast({
          pushTitle: c.title.trim(),
          pushBody: c.body.trim(),
          message: c.message.trim() || null,
          eventId: c.eventId ? Number(c.eventId) : null,
          clubId: c.clubId ? Number(c.clubId) : null,
          includeInApp: c.includeInApp,
          includeSender: c.includeSender,
        });
        if (c.requestId != null) await markRequestSent(c.requestId);
        toast(
          `Broadcast sent — ${res.recipients} recipients, ${res.pushSent} pushes, ${res.notified} in-app.`
        );
        sends.refresh();
      }
      setC(EMPTY);
      pending.refresh();
      scheduled.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Broadcast failed.", "error");
    } finally {
      setBusy(false);
      setConfirmSend(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Broadcast Center</h1>
        <p className="text-sm text-subtle">
          Push notifications to every Quad user — handle with care.
        </p>
      </div>

      {pending.data && pending.data.length > 0 && (
        <Card title={`Approval queue (${pending.data.length})`} padded={false}>
          <ul>
            {pending.data.map((r) => (
              <li key={r.id} className="flex items-start gap-4 border-b border-hairline/60 px-5 py-4 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="mt-0.5 text-sm text-subtle">{r.body}</p>
                  {r.message && (
                    <p className="mt-1 rounded-lg bg-field px-2.5 py-1.5 text-xs text-subtle">
                      Note: {r.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    From {r.requester_email ?? "unknown"} · {fmtDateTime(r.created_at)}
                    {r.suggested_send_at ? ` · suggested ${fmtDateTime(r.suggested_send_at)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="primary" onClick={() => loadRequest(r)}>
                    Review & send
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRejecting(r);
                      setRejectNote("");
                      setRejectError(null);
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title={
            c.requestId != null ? `Compose — reviewing request #${c.requestId}` : "Compose broadcast"
          }
          action={
            c.requestId != null && (
              <Button className="h-8 text-xs" onClick={() => setC(EMPTY)}>
                <IoCloseOutline /> Clear request
              </Button>
            )
          }
        >
          {permissions.data && !permissions.data.canSend ? (
            <ErrorNote text="Your account is not on the allowed-senders list for broadcasts." />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!c.title.trim() || !c.body.trim()) {
                  toast("Push title and body are required.", "error");
                  return;
                }
                if (c.mode === "now") setConfirmSend(true);
                else doSend();
              }}
              className="space-y-4"
            >
              <Field label="Push title">
                <Input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} maxLength={80} required />
              </Field>
              <Field label="Push body">
                <TextArea value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} maxLength={200} required />
              </Field>
              <Field label="In-app message (optional)" hint="Defaults to the push body if left empty.">
                <TextArea value={c.message} onChange={(e) => setC({ ...c, message: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Linked event (optional)">
                  <Select value={c.eventId} onChange={(e) => setC({ ...c, eventId: e.target.value })}>
                    <option value="">None</option>
                    {(events.data ?? []).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} · {fmtDateTime(ev.date)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Linked club (optional)">
                  <Select value={c.clubId} onChange={(e) => setC({ ...c, clubId: e.target.value })}>
                    <option value="">None</option>
                    {(clubs.data ?? []).map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2.5">
                  <span className="text-sm text-subtle">In-app notification</span>
                  <Toggle checked={c.includeInApp} onChange={(v) => setC({ ...c, includeInApp: v })} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2.5">
                  <span className="text-sm text-subtle">Also send to me</span>
                  <Toggle checked={c.includeSender} onChange={(v) => setC({ ...c, includeSender: v })} />
                </label>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex rounded-lg bg-field p-1">
                  {(["now", "later"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setC({ ...c, mode: m })}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        c.mode === m ? "bg-card text-ink shadow-sm" : "text-subtle hover:text-ink"
                      }`}
                    >
                      {m === "now" ? "Send now" : "Schedule"}
                    </button>
                  ))}
                </div>
                {c.mode === "later" && (
                  <Field label="Send at">
                    <Input
                      type="datetime-local"
                      value={c.scheduledFor}
                      onChange={(e) => setC({ ...c, scheduledFor: e.target.value })}
                      required
                    />
                  </Field>
                )}
                <Button type="submit" variant="primary" busy={busy} className="ml-auto">
                  {c.mode === "now" ? <IoSendOutline /> : <IoTimeOutline />}
                  {c.mode === "now" ? "Send to everyone" : "Schedule broadcast"}
                </Button>
              </div>
            </form>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={`Scheduled (${upcoming.length})`} padded={false}>
            {scheduled.loading && !scheduled.data ? (
              <div className="p-5"><SkeletonRows rows={3} /></div>
            ) : upcoming.length === 0 ? (
              <EmptyState text="Nothing scheduled." />
            ) : (
              <ul>
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 border-b border-hairline/60 px-5 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.title}</p>
                      <p className="truncate text-sm text-subtle">{s.body}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        Sends {fmtDateTime(s.scheduled_for)}
                        {s.request_id ? ` · from request #${s.request_id}` : ""}
                      </p>
                    </div>
                    <Button variant="destructive" onClick={() => setCanceling(s)}>
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Allowed senders" padded={false}>
            {permissions.loading && !permissions.data ? (
              <div className="p-5"><SkeletonRows rows={2} /></div>
            ) : !permissions.data?.canManage ? (
              <p className="px-5 py-4 text-sm text-muted">
                Only the app owner can manage the allowed-senders list.
              </p>
            ) : (
              <>
                <ul>
                  <li className="flex items-center justify-between border-b border-hairline/60 px-5 py-2.5">
                    <span className="text-sm">{permissions.data.email}</span>
                    <Badge tone="maroon">owner</Badge>
                  </li>
                  {(permissions.data.allowedSenders ?? []).map((email) => (
                    <li key={email} className="flex items-center justify-between border-b border-hairline/60 px-5 py-2.5">
                      <span className="text-sm">{email}</span>
                      <Button
                        variant="ghost"
                        className="!h-7 !px-2 !text-destructive"
                        onClick={async () => {
                          try {
                            await removeAllowedSender(email);
                            toast("Sender removed.");
                            permissions.refresh();
                          } catch (e) {
                            toast(e instanceof Error ? e.message : "Failed.", "error");
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex gap-2 p-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!senderEmail.includes("@")) return;
                    try {
                      await addAllowedSender(senderEmail.trim().toLowerCase());
                      toast("Sender added.");
                      setSenderEmail("");
                      permissions.refresh();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Failed.", "error");
                    }
                  }}
                >
                  <Input
                    type="email"
                    placeholder="email@elon.edu"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                  />
                  <Button type="submit" variant="primary" disabled={!senderEmail.includes("@")}>
                    Add
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Immediate send history" padded={false}>
          {sends.loading && !sends.data ? (
            <div className="p-5"><SkeletonRows rows={4} /></div>
          ) : (sends.data ?? []).length === 0 ? (
            <EmptyState text="No broadcasts sent yet." />
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {(sends.data ?? []).map((s, i) => (
                <li key={i} className="border-b border-hairline/60 px-5 py-3 last:border-0">
                  <p className="line-clamp-2 text-sm">{s.message}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {fmtDateTime(s.sent_at)} · {s.recipients} recipients
                    {s.sender_email ? ` · by ${s.sender_email}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Scheduled history" padded={false}>
          {history.length === 0 ? (
            <EmptyState text="No past scheduled broadcasts." />
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {history
                .slice()
                .sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for))
                .map((s) => (
                  <li key={s.id} className="border-b border-hairline/60 px-5 py-3 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{s.title}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-subtle">{s.body}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {s.sent_at ? `Sent ${fmtDateTime(s.sent_at)}` : `Was scheduled for ${fmtDateTime(s.scheduled_for)}`}
                      {s.recipients != null ? ` · ${s.recipients} recipients` : ""}
                      {s.push_sent != null ? ` · ${s.push_sent} pushes` : ""}
                    </p>
                    {s.error && <p className="mt-1 text-xs text-destructive">Error: {s.error}</p>}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      {confirmSend && (
        <ConfirmDialog
          title="Send broadcast now"
          message={
            <>
              This immediately pushes <strong>&ldquo;{c.title}&rdquo;</strong> to every Quad
              user with notifications enabled. There is no undo.
            </>
          }
          confirmWord="send"
          actionLabel="Send broadcast"
          onConfirm={doSend}
          onClose={() => setConfirmSend(false)}
        />
      )}

      {rejecting && (
        <Modal title={`Reject request — ${rejecting.title}`} onClose={() => setRejecting(null)}>
          <div className="space-y-4">
            <Field label="Note to the requester (optional)">
              <TextArea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Why is this being rejected?"
              />
            </Field>
            {rejectError && <ErrorNote text={rejectError} />}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setRejecting(null)}>Cancel</Button>
              <Button
                variant="destructive"
                busy={rejectBusy}
                onClick={async () => {
                  setRejectBusy(true);
                  setRejectError(null);
                  try {
                    await rejectBroadcastRequest(rejecting.id, rejectNote.trim() || null);
                    toast("Request rejected.");
                    setRejecting(null);
                    pending.refresh();
                  } catch (e) {
                    setRejectError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setRejectBusy(false);
                  }
                }}
              >
                Reject request
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {canceling && (
        <ConfirmDialog
          title="Cancel scheduled broadcast"
          message={
            <>
              Cancel <strong>{canceling.title}</strong> (scheduled for{" "}
              {fmtDateTime(canceling.scheduled_for)})? It will not be sent.
            </>
          }
          actionLabel="Cancel broadcast"
          onConfirm={async () => {
            await cancelScheduledBroadcast(canceling.id);
            toast("Broadcast canceled.");
            scheduled.refresh();
          }}
          onClose={() => setCanceling(null)}
        />
      )}
    </div>
  );
}

function toLocalInput(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
