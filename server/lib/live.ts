import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";

export const LIVE_ENTRY_FEE_POINTS = 50000;
export const LIVE_VIEWER_LIMIT = 10;
export const LIVE_JOIN_ACK_TIMEOUT_SEC = 10;
export const LIVE_MAX_EXTENSION_COUNT = 2;

export const LIVE_ROOM_STATUSES = ["ready", "live", "ended", "cancelled"] as const;
export type LiveRoomStatus = (typeof LIVE_ROOM_STATUSES)[number];

export const LIVE_PARTICIPANT_ROLES = ["host", "viewer", "admin"] as const;
export type LiveParticipantRole = (typeof LIVE_PARTICIPANT_ROLES)[number];

export const LIVE_PARTICIPANT_STATUSES = ["joined", "left", "kicked"] as const;
export type LiveParticipantStatus = (typeof LIVE_PARTICIPANT_STATUSES)[number];

export interface LiveConfig {
  entryFeePoints: number;
  viewerLimit: number;
  maxExtensionCount: number;
  joinAckTimeoutSec: number;
}

export interface LiveUserContext {
  id: string;
  role: string;
  nickname: string | null;
  profile_img: string | null;
}

export interface LiveRoomRecord {
  id: string;
  host_id: string;
  title: string;
  thumbnail_url: string | null;
  entry_fee_points: number;
  viewer_limit: number;
  planned_duration_min: number;
  scheduled_end_at: string;
  status: LiveRoomStatus;
  agora_channel: string | null;
  started_at: string | null;
  ended_at: string | null;
  extension_count: number;
  chat_locked?: boolean;
  chat_locked_by?: string | null;
  chat_locked_at?: string | null;
  created_at?: string;
}

export interface LiveParticipantRecord {
  id: string;
  room_id: string;
  user_id: string;
  role: LiveParticipantRole;
  status: LiveParticipantStatus;
  paid_points: number;
  joined_at: string | null;
  left_at: string | null;
  join_ack_at: string | null;
  blocked_until_room_end: boolean;
  refund_status: "none" | "pending" | "refunded";
  chat_muted_until: string | null;
  chat_muted_by: string | null;
  chat_muted_reason: string | null;
}

export function makeLiveChannelName(roomId: string): string {
  return `live_${roomId.replace(/-/g, "").slice(0, 12)}`;
}

export function buildScheduledEndAt(plannedDurationMin: number): string {
  const now = Date.now();
  return new Date(now + plannedDurationMin * 60 * 1000).toISOString();
}

export async function getLiveConfig(): Promise<LiveConfig> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("system_config")
    .select("key, value")
    .in("key", [
      "live_entry_fee_points",
      "live_viewer_limit",
      "live_max_extension_count",
      "live_join_ack_timeout_sec",
    ]);

  const map = new Map((data ?? []).map((row) => [row.key, row.value]));

  return {
    entryFeePoints: Number(map.get("live_entry_fee_points") ?? LIVE_ENTRY_FEE_POINTS),
    viewerLimit: Number(map.get("live_viewer_limit") ?? LIVE_VIEWER_LIMIT),
    maxExtensionCount: Number(map.get("live_max_extension_count") ?? LIVE_MAX_EXTENSION_COUNT),
    joinAckTimeoutSec: Number(map.get("live_join_ack_timeout_sec") ?? LIVE_JOIN_ACK_TIMEOUT_SEC),
  };
}

export async function getAuthenticatedUser(token: string) {
  const supabase = createSupabaseClient(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const admin = createSupabaseAdmin();
  const { data: userRow } = await admin
    .from("users")
    .select("id, role, nickname, profile_img, deleted_at")
    .eq("id", user.id)
    .single();

  if (!userRow || userRow.deleted_at) return null;

  return userRow as LiveUserContext & { deleted_at?: string | null };
}

export function isAdminRole(role: string | null | undefined) {
  return role === "admin" || role === "superadmin";
}

export function canModerateRoom(actorRole: LiveParticipantRole | null | undefined) {
  return actorRole === "host" || actorRole === "admin";
}

export function isMuteActive(chatMutedUntil: string | null | undefined) {
  if (!chatMutedUntil) return false;
  return new Date(chatMutedUntil).getTime() > Date.now();
}
