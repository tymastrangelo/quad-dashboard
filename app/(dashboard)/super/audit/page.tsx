"use client";

import { useMemo, useState } from "react";
import { IoRefreshOutline } from "react-icons/io5";
import { supabase } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { AuditRow } from "@/lib/types";
import { useData } from "@/lib/useData";
import { Badge, Button, Card, EmptyState, Select, SkeletonRows } from "@/components/ui";

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const audit = useData("audit-log", async () => {
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = data as AuditRow[];
    // Resolve admin names via profiles (readable by authenticated staff).
    const adminIds = [...new Set(rows.map((r) => r.admin_id))];
    const names = new Map<string, string>();
    if (adminIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", adminIds);
      for (const p of (profiles ?? []) as { id: string; full_name: string | null }[])
        if (p.full_name) names.set(p.id, p.full_name);
    }
    return rows.map((r) => ({ ...r, admin_name: names.get(r.admin_id) ?? r.admin_id.slice(0, 8) }));
  });

  const actions = useMemo(
    () => [...new Set((audit.data ?? []).map((r) => r.action))].sort(),
    [audit.data]
  );
  const visible = (audit.data ?? []).filter((r) => !actionFilter || r.action === actionFilter);

  const actionTone = (action: string) =>
    action.includes("delete") || action.includes("reject")
      ? ("red" as const)
      : action.includes("add") || action.includes("grant") || action.includes("approve")
        ? ("green" as const)
        : ("neutral" as const);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Audit Log</h1>
          <p className="text-sm text-subtle">
            Every privileged super-admin write, recorded inside the database
          </p>
        </div>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="!w-56">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Button onClick={audit.refresh} busy={audit.refreshing}>
          <IoRefreshOutline /> Refresh
        </Button>
      </div>

      <Card padded={false}>
        {audit.loading && !audit.data ? (
          <div className="p-5"><SkeletonRows rows={8} /></div>
        ) : visible.length === 0 ? (
          <EmptyState text="No audit entries yet. Privileged writes will appear here." />
        ) : (
          <ul>
            {visible.map((r) => (
              <li
                key={r.id}
                className="cursor-pointer border-b border-hairline/60 px-5 py-3 last:border-0 hover:bg-card-alt"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={actionTone(r.action)}>{r.action}</Badge>
                  <span className="text-sm">
                    {r.target_type ? (
                      <>
                        {r.target_type} <span className="font-mono text-subtle">{r.target_id}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="ml-auto text-xs text-muted">
                    {r.admin_name} · {fmtDateTime(r.created_at)}
                  </span>
                </div>
                {expanded === r.id && Object.keys(r.detail ?? {}).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-field p-3 font-mono text-xs text-subtle">
                    {JSON.stringify(r.detail, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
