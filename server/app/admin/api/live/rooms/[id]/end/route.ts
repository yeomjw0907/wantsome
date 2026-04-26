import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = verifyAdminSession(req);
  if (!adminUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createSupabaseAdmin();
  const roomRes = await admin.from("live_rooms").select("host_id").eq("id", id).single();

  if (!roomRes.data) {
    return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  }

  const now = new Date().toISOString();

  // 1) 라이브 종료 마크
  await admin.from("live_rooms").update({
    status: "ended",
    ended_at: now,
  }).eq("id", id);

  // 2) 시청자 입장료 환불 (atomic RPC) — 강제 종료라 시청자 죄 없음, 전액 환불
  const { data: refundResult } = await admin
    .rpc("live_refund_viewers", { p_room_id: id })
    .single() as unknown as {
      data: { refunded_count: number; total_refunded: number } | null;
    };

  // 3) 호스트 상태 해제
  await admin.from("creators").update({ is_live_now: false }).eq("id", roomRes.data.host_id);

  // 4) 환불 안 된 참가자 left 마크
  await admin
    .from("live_room_participants")
    .update({
      status: "left",
      left_at: now,
    })
    .eq("room_id", id)
    .eq("status", "joined");

  // 5) 모더레이션 로그
  await admin.from("live_moderation_actions").insert({
    room_id: id,
    target_user_id: roomRes.data.host_id,
    actor_user_id: adminUser.id,
    actor_role: "admin",
    action: "force_end",
    reason: "관리자 강제 종료",
  });

  return NextResponse.json({
    success: true,
    ended_at: now,
    refunded_count: refundResult?.refunded_count ?? 0,
    total_refunded: refundResult?.total_refunded ?? 0,
  });
}
