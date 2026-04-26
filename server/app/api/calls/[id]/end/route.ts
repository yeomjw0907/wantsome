import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data: session } = await admin
    .from("call_sessions")
    .select("consumer_id, creator_id, status, per_min_rate, started_at")
    .eq("id", sessionId)
    .single();

  if (!session) return NextResponse.json({ message: "세션 없음" }, { status: 404 });
  if (session.consumer_id !== authUser.id && session.creator_id !== authUser.id) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ message: "활성 세션이 아닙니다" }, { status: 400 });
  }

  const endedAt = new Date();
  const startedAt = session.started_at ? new Date(session.started_at) : endedAt;
  const duration_sec = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  const minutes = Math.floor(duration_sec / 60);
  const points_charged = minutes * session.per_min_rate;

  // 크리에이터 정산율 + 소비자 통계 병렬 조회
  // monthly_minutes는 read-then-write로 lost-update 위험이 있어 add_creator_minutes RPC로 atomic 처리
  type ConsumerStatsRow = { total_calls: number | null; avg_call_duration_sec: number | null };
  const [creatorRes, consumerRes] = await Promise.all([
    admin.from("creators").select("settlement_rate").eq("id", session.creator_id).single(),
    admin.from("users").select("total_calls, avg_call_duration_sec").eq("id", session.consumer_id).single() as unknown as Promise<{ data: ConsumerStatsRow | null }>,
  ]);
  const creator = creatorRes.data;
  const consumerRow = consumerRes.data;
  const settlement_rate = creator?.settlement_rate ?? 0.5;
  const creator_earning = Math.floor(points_charged * settlement_rate);

  // 핵심: 세션 종료 + 포인트 차감을 단일 DB 트랜잭션으로 처리
  const { data: rpcRows, error: rpcError } = await admin.rpc("end_call_atomic", {
    p_session_id:     sessionId,
    p_ended_at:       endedAt.toISOString(),
    p_duration_sec:   duration_sec,
    p_points_charged: points_charged,
    p_consumer_id:    session.consumer_id,
    p_creator_id:     session.creator_id,
  });

  if (rpcError || !rpcRows || rpcRows.length === 0) {
    return NextResponse.json({ message: "세션 종료 처리 실패" }, { status: 500 });
  }

  const { already_ended } = rpcRows[0] as { already_ended: boolean };
  if (already_ended) {
    return NextResponse.json({ duration_sec, points_charged, creator_earning });
  }

  // 이하 비핵심 업데이트 — 실패해도 세션/포인트는 이미 원자적으로 처리됨
  await Promise.all([
    // is_busy 해제와 monthly_minutes 누적 분리 (atomic UPDATE로 lost-update 방지)
    admin.from("creators").update({ is_busy: false }).eq("id", session.creator_id),

    minutes > 0
      ? admin.rpc("add_creator_minutes", {
          p_creator_id: session.creator_id,
          p_minutes: minutes,
        })
      : Promise.resolve(),

    // 소비자 통화 통계 업데이트
    consumerRow ? (() => {
      const prevTotal = consumerRow.total_calls ?? 0;
      const newTotal = prevTotal + 1;
      const newAvg = Math.round(((consumerRow.avg_call_duration_sec ?? 0) * prevTotal + duration_sec) / newTotal);
      type UserStatsUpdate = { total_calls: number; avg_call_duration_sec: number };
      return admin.from("users").update({ total_calls: newTotal, avg_call_duration_sec: newAvg } as unknown as UserStatsUpdate).eq("id", session.consumer_id);
    })() : Promise.resolve(),

    // 상대방에게 call_ended 신호
    admin.from("call_signals").insert({
      session_id: sessionId,
      to_user_id: authUser.id === session.consumer_id ? session.creator_id : session.consumer_id,
      from_user_id: authUser.id,
      type: "call_ended",
      payload: { duration_sec, points_charged, creator_earning },
    }),
  ]);

  return NextResponse.json({
    duration_sec,
    points_charged,
    creator_earning,
  });
}
