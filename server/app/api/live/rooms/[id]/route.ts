import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser, isAdminRole, isMuteActive } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await getAuthenticatedUser(token);
  if (!user) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data: room, error } = await admin
    .from("live_rooms")
    .select(`
      id, host_id, title, thumbnail_url, entry_fee_points, viewer_limit, planned_duration_min,
      scheduled_end_at, status, started_at, ended_at, extension_count, chat_locked,
      users!live_rooms_host_id_fkey (
        nickname, profile_img
      ),
      creators!inner (
        display_name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !room) {
    return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  }

  const roomRecord = room as any;
  const creatorProfile = Array.isArray(roomRecord.creators) ? roomRecord.creators[0] : roomRecord.creators;
  const hostUser = Array.isArray(roomRecord.users) ? roomRecord.users[0] : roomRecord.users;

  const [viewerCountRes, participantRes] = await Promise.all([
    admin
      .from("live_room_participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", id)
      .eq("role", "viewer")
      .eq("status", "joined"),
    admin
      .from("live_room_participants")
      .select("role, status, paid_points, blocked_until_room_end, chat_muted_until")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const participant = participantRes.data as any;
  const isKicked = participant?.status === "kicked" && participant?.blocked_until_room_end;
  const isJoined = participant?.status === "joined";

  return NextResponse.json({
    id: roomRecord.id,
    host: {
      id: roomRecord.host_id,
      name: creatorProfile?.display_name ?? hostUser?.nickname ?? "크리에이터",
      avatar_url: hostUser?.profile_img ?? null,
    },
    title: roomRecord.title,
    thumbnail_url: roomRecord.thumbnail_url ?? hostUser?.profile_img ?? null,
    entry_fee_points: roomRecord.entry_fee_points,
    viewer_limit: roomRecord.viewer_limit,
    viewer_count: viewerCountRes.count ?? 0,
    planned_duration_min: roomRecord.planned_duration_min,
    scheduled_end_at: roomRecord.scheduled_end_at,
    status: roomRecord.status,
    extension_count: roomRecord.extension_count ?? 0,
    can_join: roomRecord.status === "live" && !isKicked,
    is_kicked: Boolean(isKicked),
    is_joined: Boolean(isJoined),
    role: isAdminRole(user.role) ? "admin" : participant?.role ?? null,
    chat_locked: roomRecord.chat_locked ?? false,
    is_muted: isMuteActive(participant?.chat_muted_until),
  });
}
