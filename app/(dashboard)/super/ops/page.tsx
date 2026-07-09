"use client";

import {
  IoAlertCircle,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoRefreshOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { getActivityTimeseries, getCronHealth, supabase } from "@/lib/api";
import { fmtDateTime, fmtTimeAgo } from "@/lib/format";
import type { CronHttpCall, CronPipeline, ScheduledBroadcast } from "@/lib/types";
import { useData } from "@/lib/useData";
import { TrendChart } from "@/components/charts";
import { Button, Card, EmptyState, Skeleton, SkeletonRows } from "@/components/ui";

const PIPELINE_LABELS: Record<string, string> = {
  "send-event-reminders-every-10-min": "Event reminders",
  "send-admin-digest-every-15-min": "Admin digest",
  "process-scheduled-broadcasts-every-5-min": "Scheduled broadcasts",
};

// {"oneHourReminders":0,"sent":2} → "one hour reminders 0 · sent 2"
function summarizeBody(body: string | null): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const parts = Object.entries(parsed)
        .filter(([, v]) => ["number", "string", "boolean"].includes(typeof v))
        .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase().trim()} ${v}`);
      if (parts.length) return parts.join(" · ");
    }
  } catch {
    // not JSON — fall through to the raw snippet
  }
  return body.length > 90 ? body.slice(0, 90) + "…" : body;
}

// The card headline comes from the latest completed HTTP call; a request
// that hasn't landed yet (state "pending") shouldn't flip the status.
function headlineCall(calls: CronHttpCall[]): CronHttpCall | null {
  return calls.find((c) => c.state !== "pending") ?? null;
}

function PipelineCard({ p }: { p: CronPipeline }) {
  const head = headlineCall(p.http_calls);
  const cronOk = p.last_run == null || p.last_run.status === "succeeded";
  const state = !cronOk ? "error" : (head?.state ?? "none");

  const icon =
    state === "ok" ? (
      <IoCheckmarkCircle className="shrink-0 text-[#3d6b2f]" size={20} />
    ) : state === "error" ? (
      <IoCloseCircle className="shrink-0 text-destructive" size={20} />
    ) : state === "no_response" ? (
      <IoAlertCircle className="shrink-0 text-[#96731A]" size={20} />
    ) : (
      <IoTimeOutline className="shrink-0 text-muted" size={20} />
    );

  return (
    <div className="rounded-card border border-hairline bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {PIPELINE_LABELS[p.jobname] ?? p.jobname}
          </p>
          <p className="text-xs text-muted">
            <span className="font-mono">{p.schedule}</span>
            {!p.active && " · INACTIVE"}
          </p>
        </div>
        {icon}
      </div>

      <div className="mt-2 text-sm">
        {head == null ? (
          <p className="text-muted">No HTTP calls in the retention window yet.</p>
        ) : head.state === "ok" ? (
          <p className="text-subtle">
            <span className="font-medium text-ink">HTTP {head.status_code}</span>
            {" · "}
            {summarizeBody(head.body) ?? "ok"}
            <span className="text-muted"> · {fmtTimeAgo(head.created)}</span>
          </p>
        ) : head.state === "no_response" ? (
          <p className="text-[#7a6428]">
            Request sent {fmtTimeAgo(head.created)} — no response recorded (timeout or
            never completed).
          </p>
        ) : (
          <div className="text-destructive">
            <p className="font-medium">
              {head.status_code ? `HTTP ${head.status_code}` : (head.error_msg ?? "Request failed")}
              <span className="font-normal"> · {fmtTimeAgo(head.created)}</span>
            </p>
            {(head.error_msg || head.body) && (
              <p className="mt-0.5 line-clamp-2 break-all text-xs">
                {head.error_msg ?? head.body}
              </p>
            )}
          </div>
        )}
      </div>

      <p className={`mt-2 text-xs ${cronOk ? "text-muted" : "text-destructive"}`}>
        Cron:{" "}
        {p.last_run
          ? `${p.last_run.status} · ${fmtTimeAgo(p.last_run.start_time)}`
          : "no runs recorded"}
        {!cronOk && p.last_run?.return_message && ` — ${p.last_run.return_message}`}
      </p>

      {p.http_calls.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="border-b border-hairline text-left text-muted">
              <th className="py-1 pr-2 font-medium">Time</th>
              <th className="py-1 pr-2 font-medium">HTTP</th>
              <th className="py-1 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {p.http_calls.slice(0, 8).map((c) => (
              <tr key={c.request_id} className="border-b border-hairline/60 last:border-0">
                <td className="whitespace-nowrap py-1.5 pr-2 text-muted">
                  {fmtTimeAgo(c.created)}
                </td>
                <td
                  className={`py-1.5 pr-2 font-mono ${
                    c.state === "ok"
                      ? "text-[#3d6b2f]"
                      : c.state === "error"
                        ? "text-destructive"
                        : "text-[#7a6428]"
                  }`}
                >
                  {c.status_code ?? (c.state === "pending" ? "…" : "—")}
                </td>
                <td className="max-w-0 truncate py-1.5 text-subtle">
                  {c.state === "no_response"
                    ? "no response"
                    : c.state === "pending"
                      ? "in flight"
                      : (c.error_msg ?? summarizeBody(c.body) ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Pipeline health is derived from the edge functions' actual HTTP responses
// (cron_http_requests ⋈ net._http_response, via super-gated get_cron_health()).
// Cron-layer "succeeded" only means the SQL ran — net.http_post is async.
export default function OpsPage() {
  const cron = useData("cron-health", getCronHealth, { refreshMs: 60_000 });
  const activity = useData("ops-activity", () =>
    getActivityTimeseries(new Date(Date.now() - 30 * 86400_000), new Date())
  );
  const failures = useData("broadcast-failures", async () => {
    const { data, error } = await supabase
      .from("scheduled_broadcasts")
      .select("*")
      .eq("status", "error")
      .order("scheduled_for", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data as ScheduledBroadcast[];
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Ops & Health</h1>
          <p className="text-sm text-subtle">
            Notification pipelines by real HTTP outcome, volume, and delivery failures
          </p>
        </div>
        <Button
          onClick={() => {
            cron.refresh();
            activity.refresh();
            failures.refresh();
          }}
          busy={cron.refreshing}
        >
          <IoRefreshOutline /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cron.loading && !cron.data
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)
          : (cron.data ?? []).map((p) => <PipelineCard key={p.jobname} p={p} />)}
      </div>
      <p className="text-xs text-muted">
        HTTP responses are retained for ~6 hours — an empty call list means no runs
        landed in that window, not that the job never runs. Auto-refreshes every minute.
      </p>

      <Card title="Notifications sent per day (30 days)">
        {activity.loading && !activity.data ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <TrendChart
            data={activity.data ?? []}
            xKey="day"
            yKey="notifications_sent"
            name="Notifications"
            colorIndex={2}
            bucket="day"
            height={220}
          />
        )}
      </Card>

      <Card title="Failed scheduled broadcasts" padded={false}>
        {failures.loading && !failures.data ? (
          <div className="p-5"><SkeletonRows rows={2} /></div>
        ) : (failures.data ?? []).length === 0 ? (
          <EmptyState text="No delivery failures. 🎉" />
        ) : (
          <ul>
            {(failures.data ?? []).map((f) => (
              <li key={f.id} className="border-b border-hairline/60 px-5 py-3 last:border-0">
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted">was scheduled for {fmtDateTime(f.scheduled_for)}</p>
                <p className="mt-1 text-xs text-destructive">{f.error ?? "Unknown error"}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted">
        Raw edge-function logs aren&apos;t exposed to the browser — view them in the
        Supabase dashboard under Edge Functions → Logs.
      </p>
    </div>
  );
}
