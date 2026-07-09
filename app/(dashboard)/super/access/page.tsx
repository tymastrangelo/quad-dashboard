"use client";

import { useState } from "react";
import { IoAddOutline } from "react-icons/io5";
import {
  adminAddElonAdmin,
  adminListSuperAdmins,
  adminRemoveElonAdmin,
  adminSetAppFlag,
  supabase,
} from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { AppFlag } from "@/lib/types";
import { useData } from "@/lib/useData";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  SkeletonRows,
  Toggle,
  useToast,
} from "@/components/ui";

// Descriptions for known flags; unknown keys still render and toggle.
const FLAG_DESCRIPTIONS: Record<string, string> = {
  onboarding_suggestions:
    "Show suggested clubs/events during new-user onboarding in the mobile app.",
};

export default function AccessPage() {
  const toast = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);

  const flags = useData("app-flags", async () => {
    const { data, error } = await supabase.from("app_flags").select("*").order("key");
    if (error) throw new Error(error.message);
    return data as AppFlag[];
  });

  const elonAdmins = useData("elon-admins", async () => {
    const { data, error } = await supabase
      .from("elon_admins")
      .select("email, created_at")
      .order("email");
    if (error) throw new Error(error.message);
    return data as { email: string; created_at: string }[];
  });

  const superAdmins = useData("super-admins", adminListSuperAdmins);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Access & Flags</h1>
        <p className="text-sm text-subtle">Feature flags and dashboard access control</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Feature flags" padded={false}>
          {flags.loading && !flags.data ? (
            <div className="p-5"><SkeletonRows rows={2} /></div>
          ) : (flags.data ?? []).length === 0 ? (
            <EmptyState text="No feature flags defined." />
          ) : (
            <ul>
              {(flags.data ?? []).map((f) => (
                <li key={f.key} className="flex items-center gap-4 border-b border-hairline/60 px-5 py-3.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{f.key}</p>
                    <p className="text-xs text-subtle">
                      {FLAG_DESCRIPTIONS[f.key] ?? "No description."}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">Updated {fmtDateTime(f.updated_at)}</p>
                  </div>
                  <Toggle
                    checked={f.enabled}
                    disabled={togglingFlag === f.key}
                    onChange={async (v) => {
                      setTogglingFlag(f.key);
                      try {
                        await adminSetAppFlag(f.key, v);
                        toast(`${f.key} ${v ? "enabled" : "disabled"}.`);
                        flags.refresh();
                      } catch (e) {
                        toast(e instanceof Error ? e.message : "Failed to update flag.", "error");
                      } finally {
                        setTogglingFlag(null);
                      }
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Elon admin allowlist" padded={false}>
            {elonAdmins.loading && !elonAdmins.data ? (
              <div className="p-5"><SkeletonRows rows={2} /></div>
            ) : (
              <>
                {(elonAdmins.data ?? []).length === 0 ? (
                  <EmptyState text="No Elon admins yet — add a staff email below." />
                ) : (
                  <ul>
                    {(elonAdmins.data ?? []).map((a) => (
                      <li key={a.email} className="flex items-center justify-between gap-2 border-b border-hairline/60 px-5 py-2.5 last:border-0">
                        <span className="min-w-0 truncate text-sm">{a.email}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted">added {fmtDate(a.created_at)}</span>
                          <Button
                            variant="ghost"
                            className="!h-7 !px-2 !text-destructive"
                            onClick={() => setRemovingEmail(a.email)}
                          >
                            Remove
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex gap-2 border-t border-hairline p-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await adminAddElonAdmin(newEmail);
                      toast(`${newEmail.trim().toLowerCase()} added as Elon admin.`);
                      setNewEmail("");
                      elonAdmins.refresh();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Failed to add.", "error");
                    }
                  }}
                >
                  <Input
                    type="email"
                    placeholder="staff@elon.edu"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Button type="submit" variant="primary" disabled={!newEmail.includes("@")}>
                    <IoAddOutline /> Add
                  </Button>
                </form>
              </>
            )}
          </Card>

          <Card title="Super admins (read-only)" padded={false}>
            {superAdmins.loading && !superAdmins.data ? (
              <div className="p-5"><SkeletonRows rows={1} /></div>
            ) : (
              <ul>
                {(superAdmins.data ?? []).map((s) => (
                  <li key={s.user_id} className="flex items-center justify-between border-b border-hairline/60 px-5 py-2.5 last:border-0">
                    <span className="text-sm">{s.email}</span>
                    <Badge tone="maroon">since {fmtDate(s.created_at)}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-hairline px-5 py-3 text-xs text-muted">
              Super admin is granted directly in the database, never from the dashboard.
            </p>
          </Card>
        </div>
      </div>

      {removingEmail && (
        <ConfirmDialog
          title="Remove Elon admin"
          message={
            <>
              Remove <strong>{removingEmail}</strong> from the allowlist? They lose access
              to Campus Insights (app and dashboard) immediately.
            </>
          }
          actionLabel="Remove"
          onConfirm={async () => {
            await adminRemoveElonAdmin(removingEmail);
            toast("Removed from allowlist.");
            elonAdmins.refresh();
          }}
          onClose={() => setRemovingEmail(null)}
        />
      )}
    </div>
  );
}
