/**
 * POST /api/reservations/[id]/ready
 * 예약 준비완료 마킹
 * - consumer면 consumer_ready_at 설정
 * - creator면 creator_ready_at 설정
 * - 상대방에게 push 알림
 * - 응답: { consumer_ready, creator_ready } — 앱에서 "지금 통화하기" 활성화에 사용
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  // 예약 조회 (본인 관련 예약인지 확인)
  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .select("id, consumer_id, creator_id, status, consumer_ready_at, creator_ready_at, reserved_at")
    .eq("id", id)
    .single();

  if (resErr || !reservation) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  // 참여자 확인
  const isConsumer = reservation.consumer_id === authUser.id;
  const isCreator  = reservation.creator_id  === authUser.id;

  if (!isConsumer && !isCreator) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  if (reservation.status !== "confirmed") {
    return NextResponse.json({ message: "확정된 예약만 준비완료를 설정할 수 있습니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updateField = isConsumer ? "consumer_ready_at" : "creator_ready_at";
  const alreadyReady = isConsumer ? reservation.consumer_ready_at : reservation.creator_ready_at;

  if (alreadyReady) {
    // 이미 준비완료 → 현재 상태만 반환
    return NextResponse.json({
      consumer_ready: !!reservation.consumer_ready_at,
      creator_ready:  !!reservation.creator_ready_at,
      already_set: true,
    });
  }

  // 준비완료 업데이트
  const { data: updated, error: updateErr } = await admin
    .from("reservations")
    .update({ [updateField]: now })
    .eq("id", id)
    .select("consumer_ready_at, creator_ready_at")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ message: "업데이트 실패" }, { status: 500 });
  }

  const consumerReady = !!updated.consumer_ready_at;
  const creatorReady  = !!updated.creator_ready_at;

  // 상대방에게 push 알림
  const otherUserId = isConsumer ? reservation.creator_id : reservation.consumer_id;
  const myLabel = isConsumer ? "소비자" : "크리에이터";

  await sendPushToUser(admin, otherUserId, {
    title: `${myLabel}가 준비됐어요! 🎉`,
    body: consumerReady && creatorReady
      ? "양쪽 모두 준비됐어요. 지금 통화를 시작하세요!"
      : "상대방이 예약 통화를 기다리고 있어요.",
  });

  return NextResponse.json({
    consumer_ready: consumerReady,
    creator_ready:  creatorReady,
    both_ready: consumerReady && creatorReady,
  });
}
