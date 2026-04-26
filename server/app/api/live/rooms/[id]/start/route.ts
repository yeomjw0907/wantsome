import { NextRequest, NextResponse } from "next/server";
import { AGORA_APP_ID, generateAgoraToken, isAgoraConfigured } from "@/lib/agora";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser, makeLiveChannelName } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(
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
  const { data: room } = await admin
    .from("live_rooms")
    .select("id, host_id, status, scheduled_end_at, agora_channel, started_at")
    .eq("id", id)
    .single();

  if (!room) {
    return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  }
  if (room.host_id !== user.id) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }
  if (!["ready", "live"].includes(room.status)) {
    return NextResponse.json({ message: "시작할 수 없는 상태입니다." }, { status: 400 });
  }
  if (!AGORA_APP_ID || !isAgoraConfigured()) {
    return NextResponse.json({ message: "Agora 설정이 완료되지 않았습니다." }, { status: 500 });
  }

  const channelName = room.agora_channel || makeLiveChannelName(id);
  const uid = Math.floor(Math.random() * 100000) + 1;
  let agoraToken: string;
  try {
    agoraToken = await generateAgoraToken(channelName, uid, "publisher");
  } catch (err) {
    return NextResponse.json(
      { message: "Agora 토큰 생성 실패", detail: (err as Error).message },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();

  if (room.status === "ready") {
    await admin
      .from("live_rooms")
      .update({
        status: "live",
        agora_channel: channelName,
        started_at: now,
      })
      .eq("id", id);

    await admin.from("creators").update({ is_live_now: true }).eq("id", user.id);
  }

  await admin.from("live_room_participants").upsert(
    {
      room_id: id,
      user_id: user.id,
      role: "host",
      status: "joined",
      paid_points: 0,
      joined_at: room.started_at ?? now,
      left_at: null,
      join_ack_at: now,
      blocked_until_room_end: false,
      refund_status: "none",
    },
    { onConflict: "room_id,user_id" },
  );

  return NextResponse.json({
    room_id: id,
    status: "live",
    role: "host",
    agora_channel: channelName,
    agora_token: agoraToken,
    agora_app_id: AGORA_APP_ID,
    scheduled_end_at: room.scheduled_end_at,
  });
}
