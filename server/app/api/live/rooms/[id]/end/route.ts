import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/live";

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
  const { data: room } = await admin
    .from("live_rooms")
    .select("id, host_id, status")
    .eq("id", id)
    .single();

  if (!room) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  if (room.host_id !== user.id) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  if (!["ready", "live"].includes(room.status)) {
    return NextResponse.json({ message: "이미 종료된 라이브입니다." }, { status: 400 });
  }

  const endedAt = new Date().toISOString();

  // 1) 라이브 종료 마크
  await admin.from("live_rooms").update({
    status: "ended",
    ended_at: endedAt,
  }).eq("id", id);

  // 2) 시청자 입장료 환불 (atomic RPC) — joined viewer의 paid_points 만큼 복구
  //    refund_status가 'none'인 row만 처리 (멱등)
  const { data: refundResult } = await admin
    .rpc("live_refund_viewers", { p_room_id: id })
    .single() as unknown as {
      data: { refunded_count: number; total_refunded: number } | null;
    };

  // 3) 호스트 라이브 상태 해제
  await admin.from("creators").update({ is_live_now: false }).eq("id", user.id);

  // 4) 환불 안 된 (호스트 등) 참가자 left 마크
  //    RPC가 refund 처리한 viewer는 이미 status='left'로 변경됨
  await admin
    .from("live_room_participants")
    .update({ status: "left", left_at: endedAt })
    .eq("room_id", id)
    .eq("status", "joined");

  return NextResponse.json({
    success: true,
    ended_at: endedAt,
    refunded_count: refundResult?.refunded_count ?? 0,
    total_refunded: refundResult?.total_refunded ?? 0,
  });
}
