/**
 * POST /api/calls/tick
 * Vercel Cron — 매 분 실행 (vercel.json 참고)
 *
 * 처리 내용:
 * 1. pending 세션 timeout (30초 초과) → 자동 취소
 * 2. active 세션 포인트 차감, 잔액 부족 시 강제 종료
 *    - 강제 종료 시 is_busy=false + monthly_minutes 집계 (버그 수정)
 * 3. active 세션 잔액 2분치 미만 시 low_points 경고 신호 발송
 *
 * ⚠️ Vercel Pro 플랜 필수 (Hobby는 분 단위 Cron 불가)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { assertCronSecret } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauthorized = assertCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createSupabaseAdmin();
  const now = new Date();

  // ─── ① pending 세션 timeout 처리 ─────────────────────────────────────────
  const pendingCutoff = new Date(now.getTime() - 30 * 1000).toISOString(); // 30초 전

  const { data: pendingSessions } = await admin
    .from("call_sessions")
    .select("id, consumer_id, creator_id")
    .eq("status", "pending")
    .lt("created_at", pendingCutoff);

  let pendingCancelled = 0;

  if (pendingSessions && pendingSessions.length > 0) {
    for (const ps of pendingSessions) {
      await admin
        .from("call_sessions")
        .update({ status: "cancelled" })
        .eq("id", ps.id);

      // 소비자에게 call_cancelled 신호 (크리에이터가 응답 안 함)
      await admin.from("call_signals").insert({
        session_id: ps.id,
        to_user_id: ps.consumer_id,
        from_user_id: ps.creator_id,
        type: "call_cancelled",
        payload: { reason: "no_response" },
      });

      pendingCancelled++;
    }
  }

  // ─── ② active 세션 처리 ──────────────────────────────────────────────────
  const { data: sessions } = await admin
    .from("call_sessions")
    .select("id, consumer_id, creator_id, per_min_rate, started_at, low_points_warned")
    .eq("status", "active");

  let processed = 0;
  let ended = 0;

  if (sessions && sessions.length > 0) {
    for (const session of sessions) {
      // 소비자 포인트 조회
      const { data: consumer } = await admin
        .from("users")
        .select("points")
        .eq("id", session.consumer_id)
        .single();

      if (!consumer) continue;

      const { per_min_rate } = session;

      if (consumer.points < per_min_rate) {
        // 포인트 부족 → 강제 종료
        const endedAt = now;
        const startedAt = session.started_at ? new Date(session.started_at) : endedAt;
        const duration_sec = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
        const minutes = Math.floor(duration_sec / 60);
        const points_charged = minutes * per_min_rate;

        // 핵심: 세션 종료 + 포인트 차감을 단일 DB 트랜잭션으로 처리
        const { data: rpcRows, error: rpcError } = await admin.rpc("end_call_atomic", {
          p_session_id:     session.id,
          p_ended_at:       endedAt.toISOString(),
          p_duration_sec:   duration_sec,
          p_points_charged: points_charged,
          p_consumer_id:    session.consumer_id,
          p_creator_id:     session.creator_id,
        });

        if (rpcError || !rpcRows || rpcRows.length === 0) {
          continue; // 실패 시 다음 세션으로 — 다음 tick에서 재시도됨
        }

        const { already_ended } = rpcRows[0] as { already_ended: boolean };
        if (already_ended) {
          ended++;
          continue;
        }

        // 비핵심 업데이트 — 실패해도 세션/포인트는 이미 원자적으로 처리됨
        const { data: creator } = await admin
          .from("creators")
          .select("monthly_minutes, settlement_rate")
          .eq("id", session.creator_id)
          .single();

        const creatorEarning = Math.floor(points_charged * (creator?.settlement_rate ?? 0.35));

        await Promise.all([
          admin.from("creators").update({
            is_busy: false,
            monthly_minutes: (creator?.monthly_minutes ?? 0) + minutes,
          }).eq("id", session.creator_id),

          admin.from("call_signals").insert([
            {
              session_id: session.id,
              to_user_id: session.consumer_id,
              from_user_id: session.creator_id,
              type: "call_ended",
              payload: { duration_sec, points_charged, reason: "insufficient_points" },
            },
            {
              session_id: session.id,
              to_user_id: session.creator_id,
              from_user_id: session.consumer_id,
              type: "call_ended",
              payload: { duration_sec, points_charged, creator_earning: creatorEarning, reason: "insufficient_points" },
            },
          ]),
        ]);

        ended++;
      } else {
        // 포인트 정상 → 1분치 atomic 차감 (race condition 방어)
        // try_deduct_points: 잔액 충분 시 차감 + true, 부족하면 변경 X + false
        const { data: deductRows } = await admin.rpc("try_deduct_points", {
          p_user_id: session.consumer_id,
          p_amount: per_min_rate,
        });

        if (!deductRows || !deductRows[0]?.success) {
          // 동시 차감(선물 등)으로 인한 미세한 race로 부족해진 경우
          // → 다음 tick에서 insufficient 분기로 종료 처리됨, 이번엔 skip
          continue;
        }

        const remainingAfterDeduct = deductRows[0].new_balance;

        // ③ low_points 경고: 잔액이 2분치 미만이고 아직 경고 안 보냈으면
        if (remainingAfterDeduct < per_min_rate * 2 && !session.low_points_warned) {
          await admin
            .from("call_sessions")
            .update({ low_points_warned: true })
            .eq("id", session.id);

          await admin.from("call_signals").insert({
            session_id: session.id,
            to_user_id: session.consumer_id,
            from_user_id: session.creator_id,
            type: "low_points",
            payload: { remaining_points: remainingAfterDeduct, per_min_rate },
          });
        }
      }

      processed++;
    }
  }

  return NextResponse.json({ pending_cancelled: pendingCancelled, processed, ended });
}
