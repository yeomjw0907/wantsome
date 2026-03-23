import { NextRequest, NextResponse } from "next/server";
import { AGORA_APP_ID, generateAgoraToken } from "@/lib/agora";
import { createSupabaseAdmin } from "@/lib/supabase";
import {
  getAuthenticatedUser,
  getLiveConfig,
  isAdminRole,
} from "@/lib/live";

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
  const [roomRes, config] = await Promise.all([
    admin
      .from("live_rooms")
      .select("id, host_id, status, agora_channel, entry_fee_points, viewer_limit")
      .eq("id", id)
      .single(),
    getLiveConfig(),
  ]);

  const room = roomRes.data as any;
  if (!room) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  if (room.status !== "live") return NextResponse.json({ message: "입장할 수 없는 상태입니다." }, { status: 400 });
  if (!room.agora_channel) return NextResponse.json({ message: "방송 채널이 준비되지 않았습니다." }, { status: 400 });
  if (room.host_id === user.id) return NextResponse.json({ message: "호스트는 방송 시작으로 입장합니다." }, { status: 400 });

  const [participantRes, viewerCountRes, pointsRes] = await Promise.all([
    admin
      .from("live_room_participants")
      .select("id, role, status, paid_points, blocked_until_room_end, refund_status")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("live_room_participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", id)
      .eq("role", "viewer")
      .eq("status", "joined"),
    admin
      .from("users")
      .select("points")
      .eq("id", user.id)
      .single(),
  ]);

  const participant = participantRes.data as any;
  if (participant?.status === "kicked" && participant?.blocked_until_room_end) {
    return NextResponse.json({ message: "강퇴된 라이브는 종료 전까지 재입장할 수 없습니다." }, { status: 403 });
  }

  const role = isAdminRole(user.role) ? "admin" : "viewer";
  const currentPoints = pointsRes.data?.points ?? 0;
  const alreadyPaid = participant?.paid_points > 0 && participant?.refund_status !== "refunded";
  const chargePoints = role === "admin" || alreadyPaid ? 0 : room.entry_fee_points;

  if (role === "viewer" && !alreadyPaid && (viewerCountRes.count ?? 0) >= room.viewer_limit) {
    return NextResponse.json({ message: "정원이 마감되었습니다." }, { status: 409 });
  }

  if (chargePoints > 0 && currentPoints < chargePoints) {
    return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
  }

  let remainingPoints = currentPoints;
  if (chargePoints > 0) {
    const { data: deductResult, error: deductError } = await admin
      .rpc("live_join_deduct_points", { p_user_id: user.id, p_amount: chargePoints })
      .single();

    if (deductError) {
      return NextResponse.json({ message: deductError.message }, { status: 500 });
    }
    if (!(deductResult as any)?.success) {
      return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
    }
    remainingPoints = (deductResult as any).remaining_points;
  }

  const now = new Date().toISOString();
  await admin.from("live_room_participants").upsert({
    room_id: id,
    user_id: user.id,
    role,
    status: "joined",
    paid_points: participant?.paid_points ?? chargePoints,
    joined_at: now,
    left_at: null,
    join_ack_at: null,
    blocked_until_room_end: false,
    refund_status: "none",
  }, { onConflict: "room_id,user_id" });

  const uid = Math.floor(Math.random() * 100000) + 1;
  const agoraToken = await generateAgoraToken(room.agora_channel, uid, "subscriber");

  return NextResponse.json({
    room_id: id,
    role,
    charged_points: chargePoints,
    remaining_points: remainingPoints,
    agora_channel: room.agora_channel,
    agora_token: agoraToken,
    agora_app_id: AGORA_APP_ID,
    join_ack_deadline_sec: config.joinAckTimeoutSec,
  });
}
