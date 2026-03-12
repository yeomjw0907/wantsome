/**
 * POST /api/calls/tick
 * Vercel Cron — 매 분 실행 (vercel.json 참고)
 * 활성 세션에서 포인트 차감, 잔액 부족 시 자동 종료
 *
 * ⚠️ Vercel Pro 플랜 필수 (Hobby는 분 단위 Cron 불가)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Vercel Cron 보호
  const cronSecret = req.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  // 활성 세션 전체 조회
  const { data: sessions } = await admin
    .from("call_sessions")
    .select("id, consumer_id, creator_id, per_min_rate, started_at")
    .eq("status", "active");

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  let ended = 0;

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
      const endedAt = new Date();
      const startedAt = session.started_at ? new Date(session.started_at) : endedAt;
      const duration_sec = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
      const minutes = Math.floor(duration_sec / 60);
      const points_charged = minutes * per_min_rate;

      await admin
        .from("call_sessions")
        .update({
          status: "ended",
          ended_at: endedAt.toISOString(),
          duration_sec,
          points_charged,
        })
        .eq("id", session.id);

      if (points_charged > 0) {
        await admin
          .from("users")
          .update({ points: Math.max(0, consumer.points - points_charged) })
          .eq("id", session.consumer_id);
      }

      // 양측 모두에게 call_ended 신호
      await admin.from("call_signals").insert([
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
          payload: { duration_sec, points_charged, reason: "insufficient_points" },
        },
      ]);

      ended++;
    } else {
      // 포인트 차감
      await admin
        .from("users")
        .update({ points: consumer.points - per_min_rate })
        .eq("id", session.consumer_id);
    }

    processed++;
  }

  return NextResponse.json({ processed, ended });
}
