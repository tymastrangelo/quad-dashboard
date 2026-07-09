"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  IoAddOutline,
  IoArrowBackOutline,
  IoTrashOutline,
  IoWarningOutline,
} from "react-icons/io5";
import {
  adminAddElonAdmin,
  adminDeleteUser,
  adminGetUserDetail,
  adminGrantClubAdmin,
  adminRemoveElonAdmin,
  adminRevokeClubAdmin,
  supabase,
} from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { Club } from "@/lib/types";
import { useData } from "@/lib/useData";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [grantClubId, setGrantClubId] = useState("");
  const [confirming, setConfirming] = useState<null | "delete" | "elon-add" | "elon-remove">(null);
  const [revoking, setRevoking] = useState<{ club_id: number; name: string } | null>(null);

  const user = useData(`user-${id}`, () => adminGetUserDetail(id));
  const clubs = useData("all-club-names", async () => {
    const { data, error } = await supabase.from("clubs").select("id, name").order("name").limit(1000);
    if (error) throw new Error(error.message);
    return data as Pick<Club, "id" | "name">[];
  });

  const u = user.data;

  if (user.error)
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorNote text={user.error} />
      </div>
    );

  return (
    <div className="space-y-5">
      <BackLink />

      {!u ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start gap-4">
              <Avatar src={u.avatar_url} name={u.full_name ?? u.email} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold">{u.full_name ?? "(no name)"}</h1>
                  {u.is_super_admin && <Badge tone="maroon">super admin</Badge>}
                  {u.is_elon_admin && !u.is_super_admin && <Badge tone="gold">elon admin</Badge>}
                  {u.is_tester && <Badge>tester</Badge>}
                </div>
                <p className="text-sm text-subtle">{u.email}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                  <Item label="Joined" value={fmtDate(u.created_at)} />
                  <Item label="Last sign-in" value={u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : "never"} />
                  <Item label="Email verified" value={u.email_confirmed_at ? "yes" : "no"} />
                  <Item label="Push notifications" value={u.has_push_token ? "registered" : "not registered"} />
                  <Item label="Timezone" value={u.timezone ?? "—"} />
                </dl>
              </div>
              {!u.is_super_admin && (
                <div className="flex shrink-0 flex-col gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirming(u.is_elon_admin ? "elon-remove" : "elon-add")}
                  >
                    {u.is_elon_admin ? "Remove Elon admin" : "Make Elon admin"}
                  </Button>
                  <Button variant="destructive" onClick={() => setConfirming("delete")}>
                    <IoTrashOutline /> Delete account
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card title={`Club admin roles (${u.admin_roles.length})`} padded={false}>
              <ul>
                {u.admin_roles.map((r) => (
                  <li key={r.club_id} className="flex items-center gap-2 border-b border-hairline/60 px-5 py-2.5 last:border-0">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                    <Badge>{r.role}</Badge>
                    <Button
                      variant="ghost"
                      className="!h-7 !px-2 !text-destructive"
                      onClick={() => setRevoking({ club_id: r.club_id, name: r.name })}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
              {u.admin_roles.length === 0 && <EmptyState text="Not a club admin." />}
              <div className="flex gap-2 border-t border-hairline p-4">
                <Select value={grantClubId} onChange={(e) => setGrantClubId(e.target.value)} className="flex-1">
                  <option value="">Grant admin of…</option>
                  {(clubs.data ?? [])
                    .filter((c) => !u.admin_roles.some((r) => r.club_id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
                <Button
                  variant="primary"
                  disabled={!grantClubId}
                  onClick={async () => {
                    try {
                      await adminGrantClubAdmin(u.id, Number(grantClubId));
                      toast("Club admin granted.");
                      setGrantClubId("");
                      user.refresh();
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Failed to grant.", "error");
                    }
                  }}
                >
                  <IoAddOutline /> Grant
                </Button>
              </div>
            </Card>

            <Card title={`Clubs followed (${u.memberships.length})`} padded={false}>
              {u.memberships.length === 0 ? (
                <EmptyState text="Not following any clubs." />
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {u.memberships.map((m) => (
                    <li key={m.club_id} className="flex items-center justify-between gap-2 border-b border-hairline/60 px-5 py-2.5 last:border-0">
                      <span className="min-w-0 truncate text-sm">{m.name}</span>
                      <span className="shrink-0 text-xs text-muted">{fmtDate(m.joined_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Going (${u.rsvps.length})`} padded={false}>
              {u.rsvps.length === 0 ? (
                <EmptyState text="Hasn't marked going on any events." />
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {u.rsvps.map((r) => (
                    <li key={`${r.event_id}-${r.rsvped_at}`} className="border-b border-hairline/60 px-5 py-2.5 last:border-0">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted">event {fmtDateTime(r.date)} · marked going {fmtDate(r.rsvped_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {confirming === "delete" && u && (
        <ConfirmDialog
          title="Delete account"
          message={
            <span className="flex items-start gap-2">
              <IoWarningOutline className="mt-0.5 shrink-0 text-destructive" size={18} />
              <span>
                This permanently deletes <strong>{u.email}</strong> — their profile,
                going responses, posts, follows, and notifications. The user is signed out
                everywhere and this cannot be undone.
              </span>
            </span>
          }
          confirmWord={u.email}
          actionLabel="Delete account forever"
          onConfirm={async () => {
            await adminDeleteUser(u.id);
            toast("Account deleted.");
            router.push("/super/users");
          }}
          onClose={() => setConfirming(null)}
        />
      )}

      {confirming === "elon-add" && u && (
        <ConfirmDialog
          title="Make Elon admin"
          message={
            <>
              Add <strong>{u.email}</strong> to the Elon admin allowlist? They get
              access to Campus Insights and can request broadcasts.
            </>
          }
          actionLabel="Add to allowlist"
          onConfirm={async () => {
            await adminAddElonAdmin(u.email);
            toast("Added to Elon admin allowlist.");
            user.refresh();
          }}
          onClose={() => setConfirming(null)}
        />
      )}

      {confirming === "elon-remove" && u && (
        <ConfirmDialog
          title="Remove Elon admin"
          message={
            <>
              Remove <strong>{u.email}</strong> from the Elon admin allowlist? They lose
              dashboard access immediately.
            </>
          }
          actionLabel="Remove"
          onConfirm={async () => {
            await adminRemoveElonAdmin(u.email);
            toast("Removed from Elon admin allowlist.");
            user.refresh();
          }}
          onClose={() => setConfirming(null)}
        />
      )}

      {revoking && u && (
        <ConfirmDialog
          title="Revoke club admin"
          message={
            <>
              Revoke this user&apos;s admin role for <strong>{revoking.name}</strong>?
            </>
          }
          actionLabel="Revoke"
          onConfirm={async () => {
            await adminRevokeClubAdmin(u.id, revoking.club_id);
            toast("Club admin revoked.");
            user.refresh();
          }}
          onClose={() => setRevoking(null)}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/super/users"
      className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-ink"
    >
      <IoArrowBackOutline /> All users
    </Link>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
