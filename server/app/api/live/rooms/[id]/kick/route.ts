import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { canModerateRoom, getAuthenticatedUser, isAdminRole } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  const body = await req.json() as { target_user_id?: string; reason?: string };
  if (!body.target_user_id) return NextResponse.json({ message: "대상 유저가 필요합니다." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const roomRes = await admin.from("live_rooms").select("host_id").eq("id", id).single();
  if (!roomRes.data) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });

  const actorRole = isAdminRole(user.role) ? "admin" : roomRes.data.host_id === user.id ? "host" : null;
  if (!canModerateRoom(actorRole)) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  if (body.target_user_id === roomRes.data.host_id) {
    return NextResponse.json({ message: "호스트는 강퇴할 수 없습니다." }, { status: 400 });
  }

  const participantRes = await admin
    .from("live_room_participants")
    .select("role, status")
    .eq("room_id", id)
    .eq("user_id", body.target_user_id)
    .maybeSingle();

  if (!participantRes.data) {
    return NextResponse.json({ message: "참여자를 찾을 수 없습니다." }, { status: 404 });
  }
  if (participantRes.data.role === "admin") {
    return NextResponse.json({ message: "관리자는 강퇴할 수 없습니다." }, { status: 400 });
  }

  await admin
    .from("live_room_participants")
    .update({
      status: "kicked",
      left_at: new Date().toISOString(),
      blocked_until_room_end: true,
    })
    .eq("room_id", id)
    .eq("user_id", body.target_user_id);

  await admin.from("live_moderation_actions").insert({
    room_id: id,
    target_user_id: body.target_user_id,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "kick",
    reason: body.reason?.trim() || null,
  });

  return NextResponse.json({ success: true });
}
