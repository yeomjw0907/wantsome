/**
 * GET /api/users/[id]/stats — 유저 통계 조회 (크리에이터 전용)
 * 인커밍 화면 + 유저 프로필에서 사용
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function avgOf(values: (number | null | undefined)[]): number {
  const defined = values.filter((v): v is number => typeof v === "number");
  if (defined.length === 0) return 0;
  return Math.round((defined.reduce((s, v) => s + v, 0) / defined.length) * 10) / 10;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();

  // 조회자가 크리에이터인지 확인
  const { data: callerRow } = await admin
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  const isCreator = ["creator", "both", "admin", "superadmin"].includes(callerRow?.role ?? "");
  if (!isCreator) {
    return NextResponse.json({ message: "크리에이터만 조회할 수 있습니다." }, { status: 403 });
  }

  // 유저 기본 stats (캐시 컬럼) — newly added columns need explicit cast
  type UserStatsRow = { avg_rating: number | null; total_calls: number | null; avg_call_duration_sec: number | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRow } = (await (admin as any)
    .from("users")
    .select("avg_rating, total_calls, avg_call_duration_sec")
    .eq("id", id)
    .single()) as { data: UserStatsRow | null };

  // 통화 기록 히스토그램 (실시간 집계)
  const { data: callStats } = await admin
    .from("call_sessions")
    .select("duration_sec")
    .eq("consumer_id", id)
    .eq("status", "ended");

  const histogram = { under_15s: 0, under_1m: 0, under_3m: 0, over_3m: 0 };
  for (const { duration_sec: d } of callStats ?? []) {
    if (typeof d !== "number") continue; // null duration_sec 방어
    if (d < 15) histogram.under_15s++;
    else if (d < 60) histogram.under_1m++;
    else if (d < 180) histogram.under_3m++;
    else histogram.over_3m++;
  }

  // 카테고리별 평균 (user_ratings) — Korean column names need explicit cast
  type RatingRow = { rating_호감: number | null; rating_신뢰: number | null; rating_매너: number | null; rating_매력: number | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ratings } = (await (admin as any)
    .from("user_ratings")
    .select("rating_호감, rating_신뢰, rating_매너, rating_매력")
    .eq("consumer_id", id)) as { data: RatingRow[] | null };

  const category_ratings = {
    호감: avgOf((ratings ?? []).map((r) => r.rating_호감)),
    신뢰: avgOf((ratings ?? []).map((r) => r.rating_신뢰)),
    매너: avgOf((ratings ?? []).map((r) => r.rating_매너)),
    매력: avgOf((ratings ?? []).map((r) => r.rating_매력)),
  };

  return NextResponse.json({
    avg_rating: userRow?.avg_rating ?? 0,
    total_calls: userRow?.total_calls ?? 0,
    avg_call_duration_sec: userRow?.avg_call_duration_sec ?? 0,
    histogram,
    category_ratings,
  });
}
