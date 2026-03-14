/**
 * POST /api/check-in        — 오늘 출석 체크인 (포인트 지급)
 * GET  /api/check-in/status — 오늘 체크인 여부 + streak (별도 route)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STREAK_POINTS: Record<number, number> = {
  1: 50, 2: 50, 3: 50, 4: 50, 5: 50, 6: 50, 7: 350,
};

function getTodayKST(): string {
  // KST = UTC+9
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
  if (error || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const today = getTodayKST();

  const { data: todayCheckin } = await admin
    .from("daily_checkins")
    .select("id, streak, points_awarded, created_at")
    .eq("user_id", authUser.id)
    .eq("checked_date", today)
    .maybeSingle();

  // 현재 streak (어제 체크인이 있으면 연속)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKST = new Date(yesterday.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: yesterdayCheckin } = await admin
    .from("daily_checkins")
    .select("streak")
    .eq("user_id", authUser.id)
    .eq("checked_date", yesterdayKST)
    .maybeSingle();

  const currentStreak = todayCheckin?.streak
    ?? (yesterdayCheckin ? (yesterdayCheckin.streak % 7) + 1 : 1);

  return NextResponse.json({
    checked_today: !!todayCheckin,
    streak: currentStreak,
    points_to_earn: STREAK_POINTS[currentStreak] ?? 50,
    today_checkin: todayCheckin ?? null,
  });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const today = getTodayKST();

  // 중복 체크인 방지
  const { data: existing } = await admin
    .from("daily_checkins")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("checked_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: "오늘 이미 체크인했습니다." }, { status: 409 });
  }

  // 어제 streak 확인
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKST = new Date(yesterday.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: prev } = await admin
    .from("daily_checkins")
    .select("streak")
    .eq("user_id", authUser.id)
    .eq("checked_date", yesterdayKST)
    .maybeSingle();

  const streak = prev ? (prev.streak % 7) + 1 : 1;
  const pointsAwarded = STREAK_POINTS[streak] ?? 50;

  // 체크인 INSERT
  await admin.from("daily_checkins").insert({
    user_id: authUser.id,
    checked_date: today,
    streak,
    points_awarded: pointsAwarded,
  });

  // 포인트 지급
  const { data: user } = await admin.from("users").select("points").eq("id", authUser.id).single();
  if (user) {
    await admin.from("users").update({ points: user.points + pointsAwarded }).eq("id", authUser.id);
  }

  // 알림
  const isWeekly = streak === 7;
  await admin.from("notifications").insert({
    user_id: authUser.id,
    type: "checkin",
    title: isWeekly ? "🎉 7일 연속 출석 달성!" : "🎁 출석 체크인 완료",
    body: isWeekly
      ? `7일 연속 출석 보너스 +${pointsAwarded}P 지급됐어요!`
      : `오늘 출석 체크인 +${pointsAwarded}P 지급됐어요! (${streak}일 연속)`,
    data: { streak, points_awarded: pointsAwarded },
  });

  return NextResponse.json({ streak, points_awarded: pointsAwarded }, { status: 201 });
}
