import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getLiveHostProfile, isMuteActive, type LiveRoomRecord } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = verifyAdminSession(req);
  if (!adminUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createSupabaseAdmin();

  const [roomRes, participantsRes, chatRes, actionsRes, giftsRes] = await Promise.all([
    admin
      .from("live_rooms")
      .select(`
        id, host_id, title, thumbnail_url, entry_fee_points, viewer_limit,
        planned_duration_min, scheduled_end_at, status, started_at, ended_at, extension_count, chat_locked
      `)
      .eq("id", id)
      .single(),
    admin
      .from("live_room_participants")
      .select(`
        user_id, role, status, paid_points, joined_at, left_at, refund_status,
        blocked_until_room_end, chat_muted_until,
        users!inner(nickname, profile_img)
      `)
      .eq("room_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("live_chat_messages")
      .select(`
        id, sender_id, sender_role, message, created_at,
        users!inner(nickname)
      `)
      .eq("room_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    admin
      .from("live_moderation_actions")
      .select(`
        id, target_user_id, actor_user_id, actor_role, action, reason, created_at,
        actor:users!live_moderation_actions_actor_user_id_fkey(nickname),
        target:users!live_moderation_actions_target_user_id_fkey(nickname)
      `)
      .eq("room_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("gifts").select("amount, created_at").eq("live_room_id", id),
  ]);

  if (!roomRes.data) {
    return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  }

  const room = roomRes.data as unknown as LiveRoomRecord;
  const hostProfile = await getLiveHostProfile(admin, room.host_id);

  type ParticipantWithUser = { user_id: string; role: string; status: string; paid_points: number | null; joined_at: string | null; left_at: string | null; refund_status: string; blocked_until_room_end: boolean; chat_muted_until: string | null; users: { nickname: string | null; profile_img: string | null } | null };
  type ChatWithUser = { id: string; sender_id: string; sender_role: string; message: string; created_at: string; users: { nickname: string | null } | null };
  type ModerationWithUsers = { id: string; target_user_id: string; actor_user_id: string; actor_role: string; action: string; reason: string | null; created_at: string; actor: { nickname: string | null } | null; target: { nickname: string | null } | null };

  return NextResponse.json({
    room: {
      id: room.id,
      title: room.title,
      host_id: room.host_id,
      host_name: hostProfile.display_name ?? hostProfile.nickname ?? "크리에이터",
      host_avatar_url: hostProfile.avatar_url ?? null,
      thumbnail_url: room.thumbnail_url ?? hostProfile.thumbnail_fallback_url ?? null,
      entry_fee_points: room.entry_fee_points,
      viewer_limit: room.viewer_limit,
      planned_duration_min: room.planned_duration_min,
      scheduled_end_at: room.scheduled_end_at,
      status: room.status,
      started_at: room.started_at,
      ended_at: room.ended_at,
      extension_count: room.extension_count,
      chat_locked: room.chat_locked,
    },
    participants: (participantsRes.data ?? []).map((item) => {
      const p = item as unknown as ParticipantWithUser;
      return {
        user_id: p.user_id,
        name: p.users?.nickname ?? "사용자",
        avatar_url: p.users?.profile_img ?? null,
        role: p.role,
        status: p.status,
        paid_points: p.paid_points,
        joined_at: p.joined_at,
        left_at: p.left_at,
        refund_status: p.refund_status,
        blocked_until_room_end: p.blocked_until_room_end,
        is_muted: isMuteActive(p.chat_muted_until),
      };
    }),
    chat_messages: (chatRes.data ?? []).map((item) => {
      const m = item as unknown as ChatWithUser;
      return { id: m.id, sender_id: m.sender_id, sender_role: m.sender_role, sender_name: m.users?.nickname ?? "사용자", message: m.message, created_at: m.created_at };
    }),
    moderation_actions: (actionsRes.data ?? []).map((item) => {
      const a = item as unknown as ModerationWithUsers;
      return { id: a.id, target_user_id: a.target_user_id, target_name: a.target?.nickname ?? null, actor_user_id: a.actor_user_id, actor_name: a.actor?.nickname ?? "관리자", actor_role: a.actor_role, action: a.action, reason: a.reason, created_at: a.created_at };
    }),
    gift_points: (giftsRes.data ?? []).reduce((sum, item) => sum + ((item as unknown as { amount: number | null }).amount ?? 0), 0),
  });
}
