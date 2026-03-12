import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Vercel Cron: 매일 09:00 실행
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = yesterday.toISOString().slice(0, 10) + "T00:00:00Z";
  const dayEnd = yesterday.toISOString().slice(0, 10) + "T23:59:59Z";

  // 어제 신규 신고 건수
  const { count: newReports } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  // 어제 자동 정지된 건수
  const { count: autoSuspended } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("auto_action", "SUSPENDED")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  // 현재 PENDING 신고 총수
  const { count: pendingTotal } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");

  // 어제 긴급 신고 (UNDERAGE, ILLEGAL_RECORD)
  const { data: urgentReports } = await admin
    .from("reports")
    .select("id, category, target_id")
    .in("category", ["UNDERAGE", "ILLEGAL_RECORD"])
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  // 어제 통화 통계
  const { data: callStats } = await admin
    .from("call_sessions")
    .select("duration_sec, total_points")
    .eq("status", "ENDED")
    .gte("ended_at", dayStart)
    .lte("ended_at", dayEnd);

  const totalCalls = callStats?.length ?? 0;
  const totalMinutes = Math.floor(
    (callStats ?? []).reduce((sum, s) => sum + (s.duration_sec ?? 0), 0) / 60
  );
  const totalRevenue = (callStats ?? []).reduce((sum, s) => sum + (s.total_points ?? 0), 0);

  // 어제 신규 가입자
  const { count: newUsers } = await admin
    .from("users")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  // Slack 일일 리포트 발송
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const reportDate = yesterday.toISOString().slice(0, 10);

  if (slackUrl) {
    const urgentText = urgentReports && urgentReports.length > 0
      ? `\n🚨 *긴급 신고 ${urgentReports.length}건* — 즉시 확인 필요`
      : "";

    await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: [
          `📊 *wantsome 일일 리포트 — ${reportDate}*`,
          ``,
          `👤 신규 가입: ${newUsers ?? 0}명`,
          `📞 통화: ${totalCalls}건 / ${totalMinutes}분 / ${totalRevenue.toLocaleString()}P`,
          `🚩 신규 신고: ${newReports ?? 0}건 (자동정지: ${autoSuspended ?? 0}건)`,
          `📋 처리 대기 신고: ${pendingTotal ?? 0}건`,
          urgentText,
        ].filter(Boolean).join("\n"),
      }),
    }).then(null, () => null);
  }

  return NextResponse.json({
    success: true,
    date: reportDate,
    newUsers: newUsers ?? 0,
    totalCalls,
    totalMinutes,
    totalRevenue,
    newReports: newReports ?? 0,
    pendingTotal: pendingTotal ?? 0,
    urgentCount: urgentReports?.length ?? 0,
  });
}
