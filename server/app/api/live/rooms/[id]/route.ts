import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser, getLiveHostProfile, isAdminRole, isMuteActive, type LiveParticipantRecord } from "@/lib/live";

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
      scheduled_end_at, status, started_at, ended_at, extension_count, chat_locked
    `)
    .eq("id", id)
    .single();

  if (error || !room) {
    return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  }

  const hostProfile = await getLiveHostProfile(admin, room.host_id);

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

  const participant = participantRes.data as unknown as Pick<LiveParticipantRecord, "role" | "status" | "blocked_until_room_end" | "chat_muted_until"> | null;
  const isKicked = participant?.status === "kicked" && participant?.blocked_until_room_end;
  const isJoined = participant?.status === "joined";

  return NextResponse.json({
    id: room.id,
    host: {
      id: room.host_id,
      name: hostProfile.display_name ?? hostProfile.nickname ?? "크리에이터",
      avatar_url: hostProfile.avatar_url ?? null,
    },
    title: room.title,
    thumbnail_url: room.thumbnail_url ?? hostProfile.thumbnail_fallback_url ?? null,
    entry_fee_points: room.entry_fee_points,
    viewer_limit: room.viewer_limit,
    viewer_count: viewerCountRes.count ?? 0,
    planned_duration_min: room.planned_duration_min,
    scheduled_end_at: room.scheduled_end_at,
    status: room.status,
    extension_count: room.extension_count ?? 0,
    can_join: room.status === "live" && !isKicked,
    is_kicked: Boolean(isKicked),
    is_joined: Boolean(isJoined),
    role: room.host_id === user.id ? "host" : isAdminRole(user.role) ? "admin" : participant?.role ?? null,
    chat_locked: room.chat_locked ?? false,
    is_muted: isMuteActive(participant?.chat_muted_until),
  });
}
