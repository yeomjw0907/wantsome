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

  const admin = createSupabaseAdmin();
  const roomRes = await admin.from("live_rooms").select("host_id").eq("id", id).single();
  if (!roomRes.data) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });

  const actorRole = isAdminRole(user.role) ? "admin" : roomRes.data.host_id === user.id ? "host" : null;
  if (!canModerateRoom(actorRole)) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });

  await admin.from("live_rooms").update({
    chat_locked: false,
    chat_locked_by: null,
    chat_locked_at: null,
  }).eq("id", id);

  await admin.from("live_moderation_actions").insert({
    room_id: id,
    target_user_id: null,
    actor_user_id: user.id,
    actor_role: actorRole,
    action: "unlock_chat",
    reason: null,
  });

  return NextResponse.json({ success: true });
}
