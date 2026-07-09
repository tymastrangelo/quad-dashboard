// Hand-rolled row types for the tables/RPCs this dashboard touches.
// profiles is column-locked (push_token, is_tester not granted) — never select *.

export type Club = {
  id: number;
  created_at: string;
  name: string;
  description: string | null;
  image: string | null;
  category: string | null;
  contact_email: string | null;
  meeting_times: string | null;
  short_name: string | null;
  status: string | null;
  visibility: string | null;
  summary: string | null;
  is_private: boolean | null;
  website: string | null;
  twitter: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
};

export type EventRow = {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  image: string | null;
  date: string;
  end_date: string | null;
  location: string | null;
  room: string | null;
  host: string | null;
  is_live: boolean;
  rsvps_enabled: boolean | null;
  members_only: boolean | null;
  club_id: number | null;
  external_link: string | null;
  rsvps?: { count: number }[];
  clubs?: { name: string | null } | null;
};

export type Post = {
  id: number;
  created_at: string;
  user_id: string | null;
  club_id: number;
  type: string;
  image: string | null;
  caption: string | null;
  event_id: number | null;
  clubs?: { name: string | null; image: string | null } | null;
};

export type BroadcastRequest = {
  id: number;
  requested_by: string;
  requester_email: string | null;
  title: string;
  body: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  event_id: number | null;
  suggested_send_at: string | null;
  review_note: string | null;
};

export type ScheduledBroadcast = {
  id: number;
  created_by: string;
  title: string;
  body: string;
  message: string | null;
  event_id: number | null;
  club_id: number | null;
  include_in_app: boolean;
  include_sender: boolean;
  scheduled_for: string;
  status: string;
  request_id: number | null;
  created_at: string;
  sent_at: string | null;
  recipients: number | null;
  push_sent: number | null;
  error: string | null;
};

export type ClubSubmission = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  website: string | null;
  contact_email: string | null;
  meeting_info: string | null;
  image_url: string | null;
  submitter_id: string | null;
  status: string;
  created_at: string;
};

export type AppFlag = { key: string; enabled: boolean; updated_at: string };

export type AuditRow = {
  id: number;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

// RPC result shapes
export type InsightsTotals = {
  users: number;
  clubs: number;
  events: number;
  posts: number;
  follows: number;
  going: number;
  upcoming_events: number;
  invites: number;
};

export type InsightsPoint = {
  bucket: string;
  signups: number;
  rsvps: number;
  follows: number;
  events_created: number;
  posts: number;
  invites: number;
};

export type ActivityPoint = {
  day: string;
  active_users: number;
  new_users: number;
  notifications_sent: number;
};

export type ClubEngagementPoint = {
  bucket: string;
  follows: number;
  rsvps: number;
  posts: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_tester: boolean;
  clubs_followed: number;
  rsvp_count: number;
  club_admin_count: number;
  is_elon_admin: boolean;
  is_super_admin: boolean;
  total_count: number;
};

export type AdminUserDetail = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_tester: boolean;
  timezone: string | null;
  has_push_token: boolean;
  is_elon_admin: boolean;
  is_super_admin: boolean;
  memberships: { club_id: number; name: string; joined_at: string }[];
  admin_roles: { club_id: number; name: string; role: string }[];
  rsvps: { event_id: number; title: string; date: string; rsvped_at: string }[];
};

export type CronHttpCall = {
  request_id: number;
  created: string;
  status_code: number | null;
  error_msg: string | null;
  body: string | null;
  state: "ok" | "error" | "no_response" | "pending";
};

export type CronPipeline = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: { status: string; start_time: string; return_message: string | null } | null;
  http_calls: CronHttpCall[];
};

export type BroadcastSend = {
  sent_at: string;
  message: string;
  sender_email: string | null;
  recipients: number;
};

export type SuperAdminRow = { user_id: string; email: string; created_at: string };

export type SenderPermissions = {
  email: string;
  isOwner: boolean;
  canSend: boolean;
  canManage: boolean;
  allowedSenders?: string[];
};
