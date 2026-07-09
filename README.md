# Quad Admin Dashboard

Web dashboard for the Quad campus events app (Elon University). Two roles, one login:

- **Elon admins** (Student Involvement staff, allowlisted in `elon_admins`) get **Campus Insights**: stat tiles, time-series charts, top clubs/events with searchable tables + CSV export, a recent-posts feed, a broadcast-request composer, and a fullscreen auto-refreshing **Display Mode** for an office TV.
- The **super admin** (`super_admins` table) additionally gets **Analytics+**, **Content management** (clubs/events/posts/club submissions), **User administration**, the **Broadcast Center**, **Access & Flags**, **Ops & Health**, and the **Audit Log**.

Stack: Next.js (App Router) + TypeScript + Tailwind CSS v4 + Recharts + `@supabase/ssr` cookie auth against the existing Supabase project (`hujewnquwyivlgnbprpc`). Same accounts as the mobile app; no signups from the dashboard.

## Setup

```bash
npm install          # if devDependencies are missing, check that NODE_ENV != production
npm run dev
```

`.env.local` (never committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://hujewnquwyivlgnbprpc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key, e.g. sb_publishable_…>
```

Both values come from the Supabase dashboard (Settings → API). Only the publishable/anon key is used — **the service-role key is never needed by this app** and must never appear in any env var here.

## How roles work

1. Email + password sign-in against the existing Supabase auth (`/login`).
2. `middleware.ts` refreshes the session cookie and requires a user for every route.
3. `app/(dashboard)/layout.tsx` resolves the role server-side via the `is_app_super_admin()` / `is_elon_admin()` RPCs; users with neither role land on a polite `/unauthorized` screen.
4. `app/(dashboard)/super/layout.tsx` re-verifies super admin server-side for every `/super/*` route.
5. **The database is the real boundary**: every privileged RPC re-checks the role in SQL (SECURITY DEFINER + `is_app_super_admin()`/`is_elon_admin()` gate), and `anon` has no EXECUTE grant on any dashboard RPC. The UI gates are convenience only.

Add/remove Elon admins in **Access & Flags** (or a user's detail page). Super admin is granted only by inserting into `super_admins` directly in the database — deliberately not possible from the dashboard.

## Deploying to Vercel

The owner deploys; nothing here auto-deploys.

1. Push this repo to GitHub and import it in Vercel (framework preset: **Next.js**; default build command `next build`, no special config).
2. Set the two environment variables above for Production (and Preview if you want preview logins to work).
3. Deploy. That's it — there are no server-only secrets, no cron jobs, and no custom serverless functions in this app.

## New Supabase objects created for this dashboard

All schema changes were applied as migrations through the Supabase MCP (`dashboard_*`, `fix_definer_view_and_revoke_anon_rpc_execute`, `revoke_public_execute_on_dashboard_rpcs`). Nothing in this repo contains SQL.

### Tables

| Object | Purpose |
|---|---|
| `admin_audit_log` | Audit trail. Insert-only from inside SECURITY DEFINER RPCs (client INSERT/UPDATE/DELETE revoked); SELECT policy: super admin only. |
| `club_submissions` | Club registration requests. The mobile `RegisterClubScreen` always inserted this shape but the table never existed — creating it also fixes that mobile flow. RLS: insert own, read own-or-super, update super. |
| `broadcast_requests.review_note` (new column) | Reviewer's rejection note, visible to the requesting Elon admin. |

### RPCs — Elon-admin gated (`is_elon_admin()` in SQL)

| Function | Purpose |
|---|---|
| `get_campus_insights_totals()` | Stat tiles: users, clubs, events, posts, follows (memberships ∪ club_admins), going, upcoming. |
| `get_campus_insights_timeseries(p_start, p_end, p_bucket)` | Day/week/month buckets of signups (from `auth.users.created_at` — profiles has no created_at), RSVPs, follows, events created, posts. |

### RPCs — super-admin gated (`is_app_super_admin()` in SQL; write RPCs audit via private `_audit()` helper)

| Function | Purpose |
|---|---|
| `get_activity_timeseries(p_start, p_end)` | DAU proxy (distinct users across rsvps/posts/likes/comments/follows/saves/join_requests per day), new users, notifications sent. No invented tracking. |
| `get_club_engagement_timeseries(p_club_id, …)` | Per-club follows/RSVPs/posts over time. |
| `admin_get_users(p_search, p_limit, p_offset)` | Paginated user directory with email, sign-in info, engagement counts, role flags. Never returns `push_token`. |
| `admin_get_user_detail(p_user_id)` | Full user detail (memberships, admin roles, RSVPs, `has_push_token` boolean only). |
| `admin_list_super_admins()` | Read-only super admin list. |
| `admin_get_cron_health()` | pg_cron jobs + latest run outcome for Ops & Health. |
| `get_admin_broadcast_sends(p_limit)` | History of immediate broadcasts, reconstructed from `admin_broadcast` notification rows. |
| `admin_update_club/event/post(id, p_patch jsonb)` | Partial updates; only allowlisted keys present in the patch are applied. Audited. |
| `admin_delete_club/event/post(id)` | Deletes with explicit cleanup of non-cascading FKs (`notifications.post_id`, orphan `events.club_id`). Audited. |
| `admin_grant_club_admin` / `admin_revoke_club_admin` | Club-admin role management. Audited. |
| `admin_add_elon_admin` / `admin_remove_elon_admin` | Elon allowlist management. Audited. |
| `admin_set_app_flag(p_key, p_enabled)` | Feature-flag upsert. Audited. |
| `admin_reject_broadcast_request(p_id, p_note)` / `admin_mark_request_sent(p_id)` | Request review flow. Audited. |
| `approve_club_submission(p_submission_id)` / `admin_reject_club_submission(p_submission_id)` | Creates the club from a submission / rejects it. `approve_club_submission` is the name the mobile screen already calls. Audited. |

`_audit(...)` is EXECUTE-revoked from `public`/`anon`/`authenticated` — only other definer functions can call it. All dashboard RPCs have EXECUTE revoked from `PUBLIC` and `anon` (grant-level denial before the in-function role gate even runs).

### Edge function

| Function | Purpose |
|---|---|
| `admin-delete-user` | Deletes a **target** user; caller must be in `super_admins` (verified server-side). Exists because the existing `delete-account` function is strictly self-service (target comes from the caller's JWT), so a super admin could not delete another account through it. Refuses to delete super admins. Mirrors `delete-account`'s cleanup steps and writes an audit row. |

### Pre-existing security fix applied

`public.all_users_with_profiles` was a SECURITY DEFINER view granted to `anon` — every user's name/avatar was readable **without authentication**, and as an auto-updatable definer view it allowed RLS-bypassing writes to `profiles`. It is now `security_invoker = true` with anon access revoked; the two mobile screens that use it (SharePost, InviteUsers) run authenticated and see exactly the same rows as before.

## Known production issues found during this build (not fixed — owner action needed)

**All three pg_cron jobs have never succeeded** (100 % failure rate: ~30k failed runs for `send-event-reminders`, ~3k for `process-scheduled-broadcasts`, ~1k for `send-admin-digest`). Two bugs in each stored command: the URL/token contain literal `{braces}` (unsubstituted template placeholders), and `'application/json'` is passed as `net.http_post`'s third positional argument (`params`, which expects JSON). Consequences: event reminders, admin digests, and **scheduled broadcasts are never delivered** — the dashboard's "Schedule" path stores rows that will not send until this is fixed ("Send now" works; it doesn't use cron). Ops & Health surfaces the failing runs live. Fix (run in the SQL editor, once per job, substituting each function slug):

```sql
select cron.alter_job(
  <jobid>,
  command := $cmd$
    select net.http_post(
      url     := 'https://hujewnquwyivlgnbprpc.supabase.co/functions/v1/<function-slug>',
      body    := '{}'::jsonb,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || '<service-role-key>',
        'Content-Type', 'application/json'
      )
    ) as request_id;
  $cmd$
);
```

(The service-role key is already stored inside the current broken commands in `cron.job` — reuse it, wrapped in quotes, without the braces.)

Also noted: the mobile `AdminClubSubmissionsScreen` gates on an `app_admins` table that doesn't exist; the dashboard's Submissions tab (super-admin gated) covers that flow, and `approve_club_submission` now exists for the mobile screen too.

## Notes & conventions

- `profiles` is column-locked: `push_token` and `is_tester` have no SELECT grant, so client queries must always name columns — never `select('*')` on profiles.
- Broadcast sends go through the `send-notifications` edge function (same as mobile); the allowed-senders list is enforced there (owner manages it). Scheduling uses `schedule_broadcast` / `cancel_scheduled_broadcast` RPCs.
- Feedback inbox was intentionally omitted: feedback goes out via the `feedback-email` edge function; no feedback table exists.
- Data fetching is client-side with the user's JWT (same trust model as the mobile app) using a small stale-while-revalidate hook (`lib/useData.ts`); Display Mode revalidates every 60 s silently, everything else refreshes manually.
- Chart palette (`#A3252E`, `#96731A`, `#1D6FC2`, `#7C3AED`) is a colorblind-safe, contrast-validated adaptation of the brand colors; brand maroon `#73000A` is reserved for UI chrome.
