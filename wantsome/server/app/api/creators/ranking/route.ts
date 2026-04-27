/**
 * GET /api/creators/ranking
 * ?mode=blue|red  &period=weekly|monthly|all  &limit=10
 * 통화 시간 기반 크리에이터 순위
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;

export async function GET(req: NextRequest) {
  // 랭킹은 공개 엔드포인트
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (token) {
    const authClient = createSupabaseClient(token);
    const { error: authErr } = await authClient.auth.getUser(token);
    if (authErr) return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "blue") as "blue" | "red";
  const period = (searchParams.get("period") ?? "weekly") as "weekly" | "monthly" | "all";
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));

  if (mode !== "blue" && mode !== "red") {
    return NextResponse.json({ message: "Invalid mode" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const modeColumn = mode === "blue" ? "mode_blue" : "mode_red";

  // 기간 기반 순위: call_sessions 집계
  if (period !== "all") {
    const days = period === "weekly" ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions, error: sessionErr } = await admin
      .from("call_sessions")
      .select("creator_id, duration_sec")
      .eq("status", "ended")
      .eq("mode", mode)
      .gte("ended_at", since)
      .not("duration_sec", "is", null);

    if (sessionErr) {
      return NextResponse.json({ message: sessionErr.message }, { status: 500 });
    }

    // creator_id 별 총 통화 시간 집계
    const totals: Record<string, number> = {};
    for (const s of sessions ?? []) {
      if (s.creator_id) {
        totals[s.creator_id] = (totals[s.creator_id] ?? 0) + (s.duration_sec ?? 0);
      }
    }

    const topIds = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topIds.length === 0) {
      // 기간 데이터 없으면 전체 순위로 대체
      return getAlltimeRanking(admin, modeColumn, limit, period);
    }

    const { data: creators, error: creatorsErr } = await admin
      .from("creators")
      .select(`id, display_name, grade, is_online, mode_blue, mode_red, users!inner(profile_img, is_verified)`)
      .eq(modeColumn, true)
      .in("id", topIds);

    if (creatorsErr) {
      return NextResponse.json({ message: creatorsErr.message }, { status: 500 });
    }

    // topIds 순서 유지 + rank 부여
    const ranked = topIds
      .map((id, idx) => {
        const c = (creators ?? []).find((cr: any) => cr.id === id);
        if (!c) return null;
        const u = (c as any).users ?? {};
        return {
          rank: idx + 1,
          id: c.id,
          display_name: c.display_name ?? "크리에이터",
          profile_image_url: u.profile_img ?? null,
          grade: c.grade ?? "신규",
          is_online: c.is_online ?? false,
          is_verified: u.is_verified ?? false,
          total_sec: totals[id] ?? 0,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ranking: ranked, period });
  }

  return getAlltimeRanking(admin, modeColumn, limit, period);
}

async function getAlltimeRanking(
  admin: ReturnType<typeof import("@/lib/supabase").createSupabaseAdmin>,
  modeColumn: string,
  limit: number,
  period: string
) {
  const { data: creators, error } = await admin
    .from("creators")
    .select(`id, display_name, grade, is_online, mode_blue, mode_red, monthly_minutes, users!inner(profile_img, is_verified)`)
    .eq(modeColumn, true)
    .order("monthly_minutes", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const ranked = (creators ?? []).map((c: any, idx: number) => {
    const u = c.users ?? {};
    return {
      rank: idx + 1,
      id: c.id,
      display_name: c.display_name ?? "크리에이터",
      profile_image_url: u.profile_img ?? null,
      grade: c.grade ?? "신규",
      is_online: c.is_online ?? false,
      is_verified: u.is_verified ?? false,
      total_sec: (c.monthly_minutes ?? 0) * 60,
    };
  });

  return NextResponse.json({ ranking: ranked, period });
}
