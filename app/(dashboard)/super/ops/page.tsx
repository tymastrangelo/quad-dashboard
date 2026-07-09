"use client";

import { IoCheckmarkCircle, IoCloseCircle, IoRefreshOutline, IoTimeOutline } from "react-icons/io5";
import { adminGetCronHealth, getActivityTimeseries, supabase } from "@/lib/api";
import { fmtDateTime, fmtTimeAgo } from "@/lib/format";
import type { ScheduledBroadcast } from "@/lib/types";
import { useData } from "@/lib/useData";
import { TrendChart } from "@/components/charts";
import { Button, Card, EmptyState, Skeleton, SkeletonRows } from "@/components/ui";

// Ops & health from what's actually queryable with the anon key + RLS:
// pg_cron run outcomes (via super-gated RPC), notification volume, and
// scheduled-broadcast failures. Edge-function logs aren't reachable from the
// browser — the Supabase dashboard remains the place for raw logs.
export default function OpsPage() {
  const cron = useData("cron-health", adminGetCronHealth);
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
            Cron jobs, notification volume, and delivery failures
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
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : (cron.data ?? []).map((j) => {
              const ok = j.last_status === "succeeded";
              return (
                <div key={j.jobid} className="rounded-card border border-hairline bg-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-sm font-medium">{j.jobname}</p>
                    {j.last_status == null ? (
                      <IoTimeOutline className="shrink-0 text-muted" size={20} />
                    ) : ok ? (
                      <IoCheckmarkCircle className="shrink-0 text-[#3d6b2f]" size={20} />
                    ) : (
                      <IoCloseCircle className="shrink-0 text-destructive" size={20} />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    schedule <span className="font-mono">{j.schedule}</span>
                    {!j.active && " · INACTIVE"}
                  </p>
                  <p className="mt-2 text-sm text-subtle">
                    {j.last_start
                      ? `Last run ${fmtTimeAgo(j.last_start)} — ${j.last_status}`
                      : "No runs recorded."}
                  </p>
                  {j.last_message && !ok && (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive">{j.last_message}</p>
                  )}
                </div>
              );
            })}
      </div>

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
