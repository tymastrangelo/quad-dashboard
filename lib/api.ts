"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  ActivityPoint,
  AdminUserDetail,
  AdminUserRow,
  BroadcastSend,
  ClubEngagementPoint,
  CronJob,
  InsightsPoint,
  InsightsTotals,
  SenderPermissions,
  SuperAdminRow,
} from "@/lib/types";

const supabase = createClient();
export { supabase };

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ---- Insights (elon-gated in SQL) ----

export async function getInsightsTotals(): Promise<InsightsTotals> {
  return unwrap(await supabase.rpc("get_campus_insights_totals"));
}

export async function getInsightsTimeseries(
  start: Date,
  end: Date,
  bucket: "day" | "week" | "month"
): Promise<InsightsPoint[]> {
  return unwrap(
    await supabase.rpc("get_campus_insights_timeseries", {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_bucket: bucket,
    })
  );
}

export async function getClubFollowerCounts(): Promise<
  { club_id: number; follower_count: number }[]
> {
  return unwrap(await supabase.rpc("get_club_follower_counts"));
}

// ---- Analytics (super-gated in SQL) ----

export async function getActivityTimeseries(start: Date, end: Date): Promise<ActivityPoint[]> {
  return unwrap(
    await supabase.rpc("get_activity_timeseries", {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    })
  );
}

export async function getClubEngagement(
  clubId: number,
  start: Date,
  end: Date,
  bucket: "day" | "week" | "month"
): Promise<ClubEngagementPoint[]> {
  return unwrap(
    await supabase.rpc("get_club_engagement_timeseries", {
      p_club_id: clubId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_bucket: bucket,
    })
  );
}

// ---- User administration (super-gated in SQL) ----

export async function adminGetUsers(
  search: string,
  limit: number,
  offset: number
): Promise<AdminUserRow[]> {
  return unwrap(
    await supabase.rpc("admin_get_users", {
      p_search: search || null,
      p_limit: limit,
      p_offset: offset,
    })
  );
}

export async function adminGetUserDetail(userId: string): Promise<AdminUserDetail> {
  return unwrap(await supabase.rpc("admin_get_user_detail", { p_user_id: userId }));
}

export async function adminGrantClubAdmin(userId: string, clubId: number) {
  unwrap(await supabase.rpc("admin_grant_club_admin", { p_user_id: userId, p_club_id: clubId }));
}

export async function adminRevokeClubAdmin(userId: string, clubId: number) {
  unwrap(await supabase.rpc("admin_revoke_club_admin", { p_user_id: userId, p_club_id: clubId }));
}

export async function adminAddElonAdmin(email: string) {
  unwrap(await supabase.rpc("admin_add_elon_admin", { p_email: email }));
}

export async function adminRemoveElonAdmin(email: string) {
  unwrap(await supabase.rpc("admin_remove_elon_admin", { p_email: email }));
}

export async function adminListSuperAdmins(): Promise<SuperAdminRow[]> {
  return unwrap(await supabase.rpc("admin_list_super_admins"));
}

// ---- Content management (super-gated in SQL) ----

export async function adminUpdateClub(id: number, patch: Record<string, unknown>) {
  unwrap(await supabase.rpc("admin_update_club", { p_club_id: id, p_patch: patch }));
}
export async function adminDeleteClub(id: number) {
  unwrap(await supabase.rpc("admin_delete_club", { p_club_id: id }));
}
export async function adminUpdateEvent(id: number, patch: Record<string, unknown>) {
  unwrap(await supabase.rpc("admin_update_event", { p_event_id: id, p_patch: patch }));
}
export async function adminDeleteEvent(id: number) {
  unwrap(await supabase.rpc("admin_delete_event", { p_event_id: id }));
}
export async function adminUpdatePost(id: number, patch: Record<string, unknown>) {
  unwrap(await supabase.rpc("admin_update_post", { p_post_id: id, p_patch: patch }));
}
export async function adminDeletePost(id: number) {
  unwrap(await supabase.rpc("admin_delete_post", { p_post_id: id }));
}
export async function approveClubSubmission(id: number): Promise<number> {
  return unwrap(await supabase.rpc("approve_club_submission", { p_submission_id: id }));
}
export async function rejectClubSubmission(id: number) {
  unwrap(await supabase.rpc("admin_reject_club_submission", { p_submission_id: id }));
}

// ---- Flags ----

export async function adminSetAppFlag(key: string, enabled: boolean) {
  unwrap(await supabase.rpc("admin_set_app_flag", { p_key: key, p_enabled: enabled }));
}

// ---- Broadcasts ----

export async function submitBroadcastRequest(input: {
  title: string;
  body: string;
  message: string | null;
  eventId: number | null;
  suggestedSendAt: Date | null;
}): Promise<number> {
  return unwrap(
    await supabase.rpc("submit_broadcast_request", {
      p_title: input.title,
      p_body: input.body,
      p_message: input.message,
      p_event_id: input.eventId,
      p_suggested_send_at: input.suggestedSendAt?.toISOString() ?? null,
    })
  );
}

export async function scheduleBroadcast(input: {
  title: string;
  body: string;
  message: string | null;
  eventId: number | null;
  clubId: number | null;
  includeInApp: boolean;
  includeSender: boolean;
  scheduledFor: Date;
  requestId: number | null;
}): Promise<number> {
  return unwrap(
    await supabase.rpc("schedule_broadcast", {
      p_title: input.title,
      p_body: input.body,
      p_message: input.message,
      p_event_id: input.eventId,
      p_club_id: input.clubId,
      p_data: {},
      p_include_in_app: input.includeInApp,
      p_include_sender: input.includeSender,
      p_scheduled_for: input.scheduledFor.toISOString(),
      p_request_id: input.requestId,
    })
  );
}

export async function cancelScheduledBroadcast(id: number) {
  unwrap(await supabase.rpc("cancel_scheduled_broadcast", { p_id: id }));
}

export async function rejectBroadcastRequest(id: number, note: string | null) {
  unwrap(await supabase.rpc("admin_reject_broadcast_request", { p_id: id, p_note: note }));
}

export async function markRequestSent(id: number) {
  unwrap(await supabase.rpc("admin_mark_request_sent", { p_id: id }));
}

export async function getAdminBroadcastSends(): Promise<BroadcastSend[]> {
  return unwrap(await supabase.rpc("get_admin_broadcast_sends", { p_limit: 100 }));
}

export async function adminGetCronHealth(): Promise<CronJob[]> {
  return unwrap(await supabase.rpc("admin_get_cron_health"));
}

// ---- Edge functions (send-notifications actions, admin-delete-user) ----

async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError carries the response — surface the server's message.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = await ctx.json();
        throw new Error(parsed.error || parsed.details || error.message);
      } catch (e) {
        if (e instanceof Error && e.message !== error.message && !(e instanceof SyntaxError))
          throw e;
      }
    }
    throw new Error(error.message);
  }
  return data as T;
}

export async function getSenderPermissions(): Promise<SenderPermissions> {
  return invokeFn("send-notifications", { action: "get_sender_permissions" });
}

export async function addAllowedSender(email: string): Promise<string[]> {
  const res = await invokeFn<{ allowedSenders: string[] }>("send-notifications", {
    action: "add_allowed_sender",
    targetEmail: email,
  });
  return res.allowedSenders;
}

export async function removeAllowedSender(email: string): Promise<string[]> {
  const res = await invokeFn<{ allowedSenders: string[] }>("send-notifications", {
    action: "remove_allowed_sender",
    targetEmail: email,
  });
  return res.allowedSenders;
}

export async function sendCustomBroadcast(input: {
  pushTitle: string;
  pushBody: string;
  message: string | null;
  eventId: number | null;
  clubId: number | null;
  includeInApp: boolean;
  includeSender: boolean;
}): Promise<{ notified: number; pushSent: number; recipients: number }> {
  return invokeFn("send-notifications", {
    action: "send_custom_broadcast",
    pushTitle: input.pushTitle,
    pushBody: input.pushBody,
    ...(input.message ? { message: input.message } : {}),
    ...(input.eventId != null ? { eventId: input.eventId } : {}),
    ...(input.clubId != null ? { clubId: input.clubId } : {}),
    includeInApp: input.includeInApp,
    includeSender: input.includeSender,
  });
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await invokeFn("admin-delete-user", { userId });
}
