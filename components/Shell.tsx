"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  IoAlbumsOutline,
  IoAnalyticsOutline,
  IoCalendarOutline,
  IoKeyOutline,
  IoListOutline,
  IoLogOutOutline,
  IoMegaphoneOutline,
  IoPeopleCircleOutline,
  IoPeopleOutline,
  IoPulseOutline,
  IoSendOutline,
  IoStatsChartOutline,
} from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/role";
import { LiveNotificationsProvider, NotificationBell } from "@/components/LiveNotifications";
import { Badge } from "@/components/ui";

const NAV = [
  {
    section: "Insights",
    items: [
      { href: "/insights", label: "Campus Insights", icon: IoStatsChartOutline },
      { href: "/clubs", label: "Clubs", icon: IoPeopleCircleOutline },
      { href: "/events", label: "Events", icon: IoCalendarOutline },
      { href: "/broadcasts", label: "Broadcast Requests", icon: IoMegaphoneOutline },
    ],
  },
  {
    section: "Super Admin",
    superOnly: true,
    items: [
      { href: "/super/analytics", label: "Analytics+", icon: IoAnalyticsOutline },
      { href: "/super/content", label: "Content", icon: IoAlbumsOutline },
      { href: "/super/users", label: "Users", icon: IoPeopleOutline },
      { href: "/super/broadcasts", label: "Broadcast Center", icon: IoSendOutline },
      { href: "/super/access", label: "Access & Flags", icon: IoKeyOutline },
      { href: "/super/ops", label: "Ops & Health", icon: IoPulseOutline },
      { href: "/super/audit", label: "Audit Log", icon: IoListOutline },
    ],
  },
];

export function Shell({
  role,
  email,
  children,
}: {
  role: Role;
  email: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <LiveNotificationsProvider>
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-hairline bg-card">
        <div className="flex items-center gap-2.5 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Quad" className="size-9 shrink-0 rounded-xl" />
          <div>
            <p className="text-sm font-bold leading-tight">Quad</p>
            <p className="text-[11px] leading-tight text-muted">Admin Dashboard</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.filter((s) => !s.superOnly || role === "super").map((section) => (
            <div key={section.section} className="mt-4 first:mt-0">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                {section.section}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          active
                            ? "bg-maroon-light font-semibold text-maroon"
                            : "text-subtle hover:bg-field hover:text-ink"
                        }`}
                      >
                        <item.icon size={17} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pl-60">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-end gap-3 border-b border-hairline bg-card/90 px-6 backdrop-blur">
          <NotificationBell />
          <Badge tone={role === "super" ? "maroon" : "gold"}>
            {role === "super" ? "Super Admin" : "Elon Admin"}
          </Badge>
          <span className="max-w-56 truncate text-xs text-subtle">{email}</span>
          <button
            onClick={signOut}
            title="Sign out"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-subtle transition-colors hover:bg-field hover:text-ink"
          >
            <IoLogOutOutline size={17} />
            Sign out
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-6">{children}</main>
      </div>
    </div>
    </LiveNotificationsProvider>
  );
}
