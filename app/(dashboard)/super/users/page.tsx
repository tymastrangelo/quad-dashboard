"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IoSearchOutline } from "react-icons/io5";
import { adminGetUsers } from "@/lib/api";
import { fmtDate, fmtTimeAgo } from "@/lib/format";
import { useData, useDebounced } from "@/lib/useData";
import { Avatar, Badge, Button, Card, EmptyState, SkeletonRows } from "@/components/ui";

const PAGE_SIZE = 50;

export default function UsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const q = useDebounced(search.trim(), 350);

  const users = useData(`users-${q}-${page}`, () =>
    adminGetUsers(q, PAGE_SIZE, page * PAGE_SIZE)
  );
  const total = users.data?.[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Users</h1>
          <p className="text-sm text-subtle">
            {total ? `${total.toLocaleString()} accounts` : "All Quad accounts"}
          </p>
        </div>
        <div className="relative w-72">
          <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search name or email…"
            className="h-9 w-full rounded-lg border border-transparent bg-field pl-9 pr-3 text-sm outline-none transition focus:border-maroon/40 focus:bg-card focus:ring-2 focus:ring-maroon/30"
          />
        </div>
      </div>

      <Card padded={false}>
        {users.loading && !users.data ? (
          <div className="p-5"><SkeletonRows rows={10} /></div>
        ) : (users.data ?? []).length === 0 ? (
          <EmptyState text="No users match." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="px-5 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Joined</th>
                  <th className="px-3 py-2 font-medium">Last sign-in</th>
                  <th className="px-3 py-2 text-right font-medium">Follows</th>
                  <th className="px-3 py-2 text-right font-medium">RSVPs</th>
                  <th className="px-3 py-2 text-right font-medium">Admin of</th>
                  <th className="px-5 py-2 font-medium">Roles</th>
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/super/users/${u.id}`)}
                    className="cursor-pointer border-b border-hairline/60 last:border-0 hover:bg-card-alt"
                  >
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar src={u.avatar_url} name={u.full_name ?? u.email} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {u.full_name ?? "(no name)"}
                          </span>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-subtle">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-2.5 text-subtle">
                      {u.last_sign_in_at ? fmtTimeAgo(u.last_sign_in_at) : "never"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{u.clubs_followed}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{u.rsvp_count}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{u.club_admin_count}</td>
                    <td className="px-5 py-2.5">
                      <span className="flex gap-1">
                        {u.is_super_admin && <Badge tone="maroon">super</Badge>}
                        {u.is_elon_admin && !u.is_super_admin && <Badge tone="gold">elon</Badge>}
                        {u.is_tester && <Badge>tester</Badge>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3 text-xs text-subtle">
            <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <Button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
