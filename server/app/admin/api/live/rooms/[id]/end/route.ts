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

  // status 마크 + 환불 + audit + left 마크를 단일 RPC 안에서 처리 (race-safe)
  const { data: endResult, error: endErr } = await admin
    .rpc("live_end_with_refund", { p_room_id: id, p_actor_id: adminUser.id })
    .single() as unknown as {
      data: { prev_status: string; refunded_count: number; total_refunded: number } | null;
      error: { message: string } | null;
    };

  if (endErr || !endResult) {
    return NextResponse.json(
      { message: "라이브 강제 종료 실패", detail: endErr?.message ?? "unknown" },
      { status: 500 },
    );
  }

  // 호스트 상태 해제
  await admin.from("creators").update({ is_live_now: false }).eq("id", roomRes.data.host_id);

  // 모더레이션 로그 (RPC 안 audit과 별개 — 관리자 액션 추적)
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
    ended_at: new Date().toISOString(),
    refunded_count: endResult.refunded_count,
    total_refunded: endResult.total_refunded,
  });
}
