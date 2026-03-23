import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ModerationAction = "kick" | "mute_user" | "unmute_user" | "lock_chat" | "unlock_chat";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = verifyAdminSession(req);
  if (!adminUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: ModerationAction;
    target_user_id?: string;
    reason?: string;
  };

  if (!body.action) {
    return NextResponse.json({ message: "action 값이 필요합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const roomRes = await admin
    .from("live_rooms")
    .select("id, host_id, scheduled_end_at, chat_locked")
    .eq("id", id)
    .single();

  if (!roomRes.data) {
    return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  }

  const room = roomRes.data;
  const reason = body.reason?.trim() || null;

  if (body.action === "lock_chat" || body.action === "unlock_chat") {
    await admin.from("live_rooms").update({
      chat_locked: body.action === "lock_chat",
      chat_locked_by: body.action === "lock_chat" ? adminUser.id : null,
      chat_locked_at: body.action === "lock_chat" ? new Date().toISOString() : null,
    }).eq("id", id);

    await admin.from("live_moderation_actions").insert({
      room_id: id,
      target_user_id: null,
      actor_user_id: adminUser.id,
      actor_role: "admin",
      action: body.action,
      reason,
    });

    return NextResponse.json({ success: true, chat_locked: body.action === "lock_chat" });
  }

  if (!body.target_user_id) {
    return NextResponse.json({ message: "target_user_id 값이 필요합니다." }, { status: 400 });
  }
  if (body.target_user_id === room.host_id) {
    return NextResponse.json({ message: "호스트에게는 해당 조치를 할 수 없습니다." }, { status: 400 });
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
    return NextResponse.json({ message: "관리자에게는 해당 조치를 할 수 없습니다." }, { status: 400 });
  }

  if (body.action === "kick") {
    await admin
      .from("live_room_participants")
      .update({
        status: "kicked",
        left_at: new Date().toISOString(),
        blocked_until_room_end: true,
      })
      .eq("room_id", id)
      .eq("user_id", body.target_user_id);
  }

  if (body.action === "mute_user") {
    await admin
      .from("live_room_participants")
      .update({
        chat_muted_until: room.scheduled_end_at,
        chat_muted_by: adminUser.id,
        chat_muted_reason: reason,
      })
      .eq("room_id", id)
      .eq("user_id", body.target_user_id);
  }

  if (body.action === "unmute_user") {
    await admin
      .from("live_room_participants")
      .update({
        chat_muted_until: null,
        chat_muted_by: null,
        chat_muted_reason: null,
      })
      .eq("room_id", id)
      .eq("user_id", body.target_user_id);
  }

  await admin.from("live_moderation_actions").insert({
    room_id: id,
    target_user_id: body.target_user_id,
    actor_user_id: adminUser.id,
    actor_role: "admin",
    action: body.action,
    reason,
  });

  return NextResponse.json({ success: true });
}
