import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SETTLEMENT_RATE = 0.75;    // 기본 정산율 75%
const WITHHOLDING_RATE = 0.033;  // 원천징수 3.3%

// Vercel Cron: 매월 15일 09:00 실행
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const now = new Date();

  // 전달 기준 (15일 실행 → 전달 정산)
  const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const targetMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const period = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const periodStart = `${period}-01T00:00:00Z`;
  const periodEnd = `${targetYear}-${String(targetMonth + 1 > 12 ? 1 : targetMonth + 1).padStart(2, "0")}-01T00:00:00Z`;

  // 승인된 크리에이터 조회
  const { data: creators, error: creatorErr } = await admin
    .from("creator_profiles")
    .select("user_id")
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

    // 해당 월 종료된 통화 수익 합산
    const { data: sessions } = await admin
      .from("call_sessions")
      .select("total_points")
      .eq("creator_id", creator.user_id)
      .eq("status", "ENDED")
      .gte("ended_at", periodStart)
      .lt("ended_at", periodEnd);

    const totalPoints = (sessions ?? []).reduce((sum, s) => sum + (s.total_points ?? 0), 0);

    if (totalPoints === 0) {
      skipped++;
      continue;
    }

    // 정산 금액 계산 (1P = 1원)
    const settlementAmount = Math.floor(totalPoints * SETTLEMENT_RATE);
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
      slackLines.push(`• ${creator.user_id.slice(0, 8)}… → ${netAmount.toLocaleString()}원 (세전: ${settlementAmount.toLocaleString()}원)`);
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
    }).catch(() => null);
  }

  return NextResponse.json({ success: true, period, processed, skipped });
}
