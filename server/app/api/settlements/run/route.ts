import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { assertCronSecret } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

const WITHHOLDING_RATE = 0.033;  // 원천징수 3.3%
const DEFAULT_SETTLEMENT_RATE = 0.35;  // 정산 정책 v1: 사용자 결제 P × 0.35 (Apple 30% 후 net 50/50)

// Vercel Cron: 매월 15일 00:00 UTC (= KST 09:00) 실행
export async function GET(req: NextRequest) {
  const unauthorized = assertCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createSupabaseAdmin();
  const now = new Date();

  // 전달 기준 (15일 실행 → 전달 정산)
  const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const targetMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const period = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const periodStart = `${period}-01T00:00:00Z`;
  // periodEnd: 다음 월 1일. 12월 → 다음 해 1월로 연도 정정 (PR-1 AI 리뷰 fix)
  const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
  const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00Z`;

  // 승인된 크리에이터 + 개인별 정산율 조회
  const { data: creators, error: creatorErr } = await admin
    .from("creator_profiles")
    .select("user_id, creators!inner(settlement_rate)")
    .eq("status", "APPROVED");

  if (creatorErr || !creators) {
    return NextResponse.json({ message: "크리에이터 조회 실패" }, { status: 500 });
  }

  let processed = 0;
  let skipped = 0;
  const slackLines: string[] = [];

  for (const creator of creators) {
    // 이미 해당 월 정산 생성됐는지 확인
    const { data: existing } = await admin
      .from("creator_settlements")
      .select("id")
      .eq("creator_id", creator.user_id)
      .eq("period", period)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // ── 매출 합산 (3개 채널) ───────────────────────────────────────
    // 1) 영상통화: call_sessions.points_charged (status='ended')
    const { data: sessions } = await admin
      .from("call_sessions")
      .select("points_charged")
      .eq("creator_id", creator.user_id)
      .eq("status", "ended")
      .gte("ended_at", periodStart)
      .lt("ended_at", periodEnd);

    const callPoints = (sessions ?? []).reduce((sum, s) => sum + (s.points_charged ?? 0), 0);

    // 2) 라이브 입장료: live_room_participants.paid_points
    //    refund_status != 'refunded' + room.host_id = creator + room.status='ended' + ended_at in period
    const { data: liveParticipants } = await admin
      .from("live_room_participants")
      .select("paid_points, role, refund_status, live_rooms!inner(host_id, status, ended_at)")
      .eq("live_rooms.host_id", creator.user_id)
      .eq("live_rooms.status", "ended")
      .gte("live_rooms.ended_at", periodStart)
      .lt("live_rooms.ended_at", periodEnd)
      .eq("role", "viewer")
      .neq("refund_status", "refunded");

    const livePoints = (liveParticipants ?? []).reduce(
      (sum, p) => sum + ((p as unknown as { paid_points: number }).paid_points ?? 0),
      0,
    );

    // 3) 선물: gifts.amount (to_creator_id = creator)
    const { data: gifts } = await admin
      .from("gifts")
      .select("amount")
      .eq("to_creator_id", creator.user_id)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd);

    const giftPoints = (gifts ?? []).reduce(
      (sum, g) => sum + ((g as unknown as { amount: number }).amount ?? 0),
      0,
    );

    const totalPoints = callPoints + livePoints + giftPoints;

    if (totalPoints === 0) {
      skipped++;
      continue;
    }

    // 크리에이터별 정산율 (creators.settlement_rate), 없으면 기본값 적용
    const creatorData = creator as unknown as { user_id: string; creators: { settlement_rate: number } | null };
    const settlementRate = creatorData.creators?.settlement_rate ?? DEFAULT_SETTLEMENT_RATE;

    // 정산 금액 계산 (1P = 1원)
    const settlementAmount = Math.floor(totalPoints * settlementRate);
    const taxAmount = Math.floor(settlementAmount * WITHHOLDING_RATE);
    const netAmount = settlementAmount - taxAmount;

    const { error: insertErr } = await admin
      .from("creator_settlements")
      .upsert({
        creator_id: creator.user_id,
        period,
        total_points: totalPoints,
        settlement_amount: settlementAmount,
        tax_amount: taxAmount,
        net_amount: netAmount,
        status: "PENDING",
        created_at: now.toISOString(),
      }, { onConflict: "creator_id,period" });

    if (!insertErr) {
      processed++;
      slackLines.push(
        `• ${creator.user_id.slice(0, 8)}… → ${netAmount.toLocaleString()}원 ` +
        `(세전: ${settlementAmount.toLocaleString()}원, ` +
        `통화: ${callPoints.toLocaleString()}P / 라이브: ${livePoints.toLocaleString()}P / 선물: ${giftPoints.toLocaleString()}P)`,
      );
    }
  }

  // Slack 정산 알림
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl && processed > 0) {
    await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `💰 ${period} 정산 생성 완료\n• 처리: ${processed}명 / 스킵: ${skipped}명\n${slackLines.slice(0, 10).join("\n")}${slackLines.length > 10 ? `\n외 ${slackLines.length - 10}명` : ""}`,
      }),
    }).then(null, () => null);
  }

  return NextResponse.json({ success: true, period, processed, skipped });
}
