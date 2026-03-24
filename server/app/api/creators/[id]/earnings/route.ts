import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
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

  // 크리에이터 정보
  const { data: creator } = await admin
    .from("creators")
    .select("settlement_rate, monthly_minutes")
    .eq("id", id)
    .single();

  const settlement_rate = creator?.settlement_rate ?? 0.5;

  // 오늘 날짜 범위
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 이번달 시작
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // 오늘 수익
  const { data: todaySessions } = await admin
    .from("call_sessions")
    .select("points_charged")
    .eq("creator_id", id)
    .eq("status", "ended")
    .gte("ended_at", todayStart.toISOString())
    .lte("ended_at", todayEnd.toISOString());

  const todayPoints = (todaySessions ?? []).reduce(
    (sum, s) => sum + (s.points_charged ?? 0), 0
  );

  // 이번달 수익
  const { data: monthSessions } = await admin
    .from("call_sessions")
    .select("points_charged")
    .eq("creator_id", id)
    .eq("status", "ended")
    .gte("ended_at", monthStart.toISOString());

  const monthPoints = (monthSessions ?? []).reduce(
    (sum, s) => sum + (s.points_charged ?? 0), 0
  );

  // 전체 수익
  const { data: allSessions } = await admin
    .from("call_sessions")
    .select("points_charged")
    .eq("creator_id", id)
    .eq("status", "ended");

  const totalPoints = (allSessions ?? []).reduce(
    (sum, s) => sum + (s.points_charged ?? 0), 0
  );

  return NextResponse.json({
    today: Math.floor(todayPoints * settlement_rate),
    month: Math.floor(monthPoints * settlement_rate),
    total: Math.floor(totalPoints * settlement_rate),
    monthly_minutes: creator?.monthly_minutes ?? 0,
  });
}
