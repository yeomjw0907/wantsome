import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Vercel Cron: 매월 1일 00:00 실행
// Grade thresholds (monthly_minutes 기준)
const GRADE_RULES = [
  { grade: "탑", minMinutes: 600 },
  { grade: "인기", minMinutes: 200 },
  { grade: "일반", minMinutes: 30 },
  { grade: "신규", minMinutes: 0 },
] as const;

function calcGrade(minutes: number): string {
  for (const rule of GRADE_RULES) {
    if (minutes >= rule.minMinutes) return rule.grade;
  }
  return "신규";
}

export async function GET(req: NextRequest) {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  // 지난 달의 월 계산 (이 크론은 월 1일에 실행되므로 전월 데이터 집계)
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStart = prevMonth.toISOString().slice(0, 7) + "-01T00:00:00Z";
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // 승인된 크리에이터 목록
  const { data: creators, error: creatorErr } = await admin
    .from("creator_profiles")
    .select("user_id")
    .eq("status", "APPROVED");

  if (creatorErr || !creators) {
    return NextResponse.json({ message: "크리에이터 조회 실패" }, { status: 500 });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const creator of creators) {
    // 지난 달 통화 분 합산
    const { data: sessions, error: sessErr } = await admin
      .from("call_sessions")
      .select("duration_sec")
      .eq("creator_id", creator.user_id)
      .eq("status", "ENDED")
      .gte("started_at", prevMonthStart)
      .lt("started_at", prevMonthEnd);

    if (sessErr) {
      errors.push(creator.user_id);
      continue;
    }

    const totalMinutes = Math.floor(
      (sessions ?? []).reduce((sum, s) => sum + (s.duration_sec ?? 0), 0) / 60
    );
    const newGrade = calcGrade(totalMinutes);

    const { error: updateErr } = await admin
      .from("creator_profiles")
      .update({
        grade: newGrade,
        monthly_minutes: totalMinutes,
        grade_updated_at: now.toISOString(),
      })
      .eq("user_id", creator.user_id);

    if (updateErr) {
      errors.push(creator.user_id);
    } else {
      updated++;
    }
  }

  return NextResponse.json({
    success: true,
    updated,
    errors: errors.length,
    month: prevMonth.toISOString().slice(0, 7),
  });
}
