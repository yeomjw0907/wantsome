import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { canModerateRoom, getAuthenticatedUser, isAdminRole, isMuteActive } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const room = await admin.from("live_rooms").select("host_id").eq("id", id).single();
  if (!room.data) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });

  const role = isAdminRole(user.role) ? "admin" : room.data.host_id === user.id ? "host" : null;
  if (!canModerateRoom(role)) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const { data: participants, error } = await admin
    .from("live_room_participants")
    .select(`
      id, room_id, user_id, role, status, paid_points, joined_at, left_at, join_ack_at,
      blocked_until_room_end, refund_status, chat_muted_until, chat_muted_by, chat_muted_reason,
      users!inner(nickname, profile_img)
    `)
    .eq("room_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    participants: (participants ?? []).map((item: any) => ({
      user_id: item.user_id,
      name: item.users?.nickname ?? "사용자",
      avatar_url: item.users?.profile_img ?? null,
      role: item.role,
      status: item.status,
      paid_points: item.paid_points,
      joined_at: item.joined_at,
      left_at: item.left_at,
      is_muted: isMuteActive(item.chat_muted_until),
      blocked_until_room_end: item.blocked_until_room_end,
      refund_status: item.refund_status,
    })),
  });
}
