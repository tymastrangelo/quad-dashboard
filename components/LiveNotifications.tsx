"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  IoCalendarOutline,
  IoCloseOutline,
  IoHeartOutline,
  IoImagesOutline,
  IoNotificationsOutline,
  IoPersonAddOutline,
  IoRadioOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { getClubFollowerCounts, supabase } from "@/lib/api";
import { fmtTimeAgo } from "@/lib/format";
import { Toggle } from "@/components/ui";

// Live campus activity, detected by polling + diffing (no realtime infra,
// same RLS-safe reads the pages already use). One poll per minute:
// new users (profiles count), new posts, new events, events going live,
// follow deltas, and "going" milestones — individual goings/invites are
// deliberately not notified, only milestone crossings.
const POLL_MS = 60_000;
const MILESTONES = [10, 25, 50, 100, 250];
const STORAGE_KEY = "quad-live-notifications";
const MAX_STORED = 50;

type Kind = "user" | "post" | "event" | "live" | "follow" | "milestone";

export type LiveNotification = { id: number; kind: Kind; text: string; time: number };

const KIND_ICONS: Record<Kind, typeof IoPersonAddOutline> = {
  user: IoPersonAddOutline,
  post: IoImagesOutline,
  event: IoCalendarOutline,
  live: IoRadioOutline,
  follow: IoHeartOutline,
  milestone: IoSparklesOutline,
};

type Ctx = {
  items: LiveNotification[];
  unread: number;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  markRead: () => void;
  clear: () => void;
};

const LiveCtx = createContext<Ctx | null>(null);

export function useLiveNotifications() {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error("useLiveNotifications must be used inside LiveNotificationsProvider");
  return ctx;
}

type Snapshot = {
  users: number;
  followSum: number;
  postMax: string;
  eventMax: string;
  liveIds: Set<number>;
  going: Map<number, number>;
};

export function LiveNotificationsProvider({
  children,
  variant = "corner",
}: {
  children: ReactNode;
  variant?: "corner" | "banner";
}) {
  const [items, setItems] = useState<LiveNotification[]>([]);
  const [popups, setPopups] = useState<LiveNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [enabled, setEnabledState] = useState(
    () => typeof window === "undefined" || localStorage.getItem(STORAGE_KEY) !== "off"
  );
  const nextId = useRef(1);
  const snap = useRef<Snapshot | null>(null);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    localStorage.setItem(STORAGE_KEY, v ? "on" : "off");
  }, []);

  const push = useCallback((kind: Kind, text: string) => {
    const n: LiveNotification = { id: nextId.current++, kind, text, time: Date.now() };
    setItems((l) => [n, ...l].slice(0, MAX_STORED));
    setUnread((u) => u + 1);
    setPopups((p) => [...p, n]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== n.id)), 8000);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    snap.current = null; // fresh baseline after (re)enable — no stale-gap burst

    const poll = async () => {
      try {
        const [usersRes, postsRes, eventsRes, followCounts] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("posts")
            .select("id, created_at, clubs(name)")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("events")
            .select("id, title, is_live, created_at, rsvps(count)")
            .order("created_at", { ascending: false })
            .limit(100),
          getClubFollowerCounts(),
        ]);
        if (cancelled || usersRes.error || postsRes.error || eventsRes.error) return;

        const posts = (postsRes.data ?? []) as unknown as {
          id: number;
          created_at: string;
          clubs: { name: string | null } | null;
        }[];
        const events = (eventsRes.data ?? []) as unknown as {
          id: number;
          title: string;
          is_live: boolean;
          created_at: string;
          rsvps?: { count: number }[];
        }[];

        const cur: Snapshot = {
          users: usersRes.count ?? 0,
          followSum: followCounts.reduce((a, c) => a + c.follower_count, 0),
          postMax: posts[0]?.created_at ?? "",
          eventMax: events[0]?.created_at ?? "",
          liveIds: new Set(events.filter((e) => e.is_live).map((e) => e.id)),
          going: new Map(events.map((e) => [e.id, e.rsvps?.[0]?.count ?? 0])),
        };
        const prev = snap.current;
        snap.current = cur;
        if (!prev) return; // first poll is the baseline

        const newUsers = cur.users - prev.users;
        if (newUsers > 0)
          push("user", newUsers === 1 ? "A new user just joined Quad" : `${newUsers} new users just joined Quad`);
        for (const p of posts.filter((p) => prev.postMax && p.created_at > prev.postMax).slice(0, 3))
          push("post", `New post from ${p.clubs?.name ?? "a club"}`);
        for (const e of events.filter((e) => prev.eventMax && e.created_at > prev.eventMax).slice(0, 3))
          push("event", `New event: ${e.title}`);
        for (const e of events)
          if (e.is_live && !prev.liveIds.has(e.id)) push("live", `${e.title} is live now`);
        const newFollows = cur.followSum - prev.followSum;
        if (newFollows > 0)
          push("follow", newFollows === 1 ? "A club just got a new follower" : `${newFollows} new club follows`);
        for (const e of events) {
          const before = prev.going.get(e.id);
          if (before == null) continue;
          const after = cur.going.get(e.id) ?? 0;
          const hit = MILESTONES.filter((m) => before < m && after >= m).pop();
          if (hit) push("milestone", `${e.title} just hit ${hit} going`);
        }
      } catch {
        // polling is best-effort; next tick retries
      }
    };

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, push]);

  const markRead = useCallback(() => setUnread(0), []);
  const clear = useCallback(() => {
    setItems([]);
    setUnread(0);
  }, []);

  return (
    <LiveCtx.Provider value={{ items, unread, enabled, setEnabled, markRead, clear }}>
      {children}
      <div
        className={
          variant === "banner"
            ? "pointer-events-none fixed left-1/2 top-6 z-[90] flex w-[28rem] max-w-[90vw] -translate-x-1/2 flex-col gap-2"
            : "pointer-events-none fixed bottom-20 right-5 z-[90] flex w-80 flex-col gap-2"
        }
      >
        {popups.map((n) => {
          const Icon = KIND_ICONS[n.kind];
          return (
            <div
              key={n.id}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-card border border-hairline bg-card shadow-lg ${
                variant === "banner" ? "px-5 py-3 text-base" : "px-3.5 py-2.5 text-sm"
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-maroon-light text-maroon">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1 break-words">{n.text}</span>
              <button
                onClick={() => setPopups((p) => p.filter((x) => x.id !== n.id))}
                className="shrink-0 rounded-md p-1 text-muted hover:bg-field hover:text-ink"
                aria-label="Dismiss"
              >
                <IoCloseOutline size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </LiveCtx.Provider>
  );
}

// Header bell: unread badge, dropdown history, enable/disable toggle.
export function NotificationBell() {
  const { items, unread, enabled, setEnabled, markRead, clear } = useLiveNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markRead();
        }}
        title="Live notifications"
        className="relative rounded-lg p-2 text-subtle transition-colors hover:bg-field hover:text-ink"
      >
        <IoNotificationsOutline size={17} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-maroon text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-card border border-hairline bg-card shadow-xl">
          <header className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <span className="text-sm font-semibold">Live notifications</span>
            <Toggle checked={enabled} onChange={setEnabled} />
          </header>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              {enabled ? "Nothing yet — campus activity shows up here." : "Notifications are off."}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const Icon = KIND_ICONS[n.kind];
                return (
                  <li key={n.id} className="flex items-start gap-2.5 border-b border-hairline/60 px-4 py-2.5 last:border-0">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-maroon-light text-maroon">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{n.text}</span>
                      <span className="text-xs text-muted">{fmtTimeAgo(new Date(n.time).toISOString())}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 0 && (
            <footer className="border-t border-hairline px-4 py-2">
              <button onClick={clear} className="text-xs font-medium text-subtle hover:text-ink">
                Clear all
              </button>
            </footer>
          )}
        </div>
      )}
    </div>
  );
}
