import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PER_MIN_RATES = { blue: 900, red: 1300 } as const;
const PAGE_SIZE = 20;

export type FeedMode = "blue" | "red";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authClient = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authError,
  } = await authClient.auth.getUser(token);
  if (authError || !authUser) {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode     = (searchParams.get("mode") ?? "blue") as FeedMode;
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit    = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)));
  const category = searchParams.get("category") ?? ""; // 카테고리 필터

  if (mode !== "blue" && mode !== "red") {
    return NextResponse.json({ message: "Invalid mode" }, { status: 400 });
  }

  const column = mode === "blue" ? "mode_blue" : "mode_red";
  const admin = createSupabaseAdmin();

  let query = admin
    .from("creators")
    .select(
      `id, display_name, grade, is_online, mode_blue, mode_red,
       settlement_rate, monthly_minutes, created_at, avg_rating, categories,
       users!inner(nickname, profile_img, is_verified)`
    )
    .eq(column, true);

  // 카테고리 필터 (콤마 구분 → 배열 변환, OR 조건)
  if (category && category !== "전체") {
    const cats = category.split(",").map((c) => c.trim()).filter(Boolean);
    if (cats.length > 0) {
      query = query.overlaps("categories", cats);
    }
  }

  const { data: rows, error } = await query
    .order("is_online", { ascending: false })
    .order("created_at", { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ creators: [], total: 0, hasMore: false }, { status: 200 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const creators = (rows ?? []).map((r: any) => {
    const u = r.users ?? {};
    return {
      id:               r.id,
      display_name:     r.display_name ?? u.nickname ?? "크리에이터",
      profile_image_url: u.profile_img ?? null,
      grade:            r.grade ?? "신규",
      is_online:        r.is_online ?? false,
      mode_blue:        r.mode_blue ?? true,
      mode_red:         r.mode_red ?? false,
      settlement_rate:  r.settlement_rate ?? 0.75,
      monthly_minutes:  r.monthly_minutes ?? 0,
      is_verified:      u.is_verified ?? false,
      avg_rating:       r.avg_rating ?? 0,
      categories:       r.categories ?? [],
      rate_per_min:     PER_MIN_RATES[mode],
    };
  });

  return NextResponse.json({ creators, total: creators.length, hasMore: creators.length >= limit });
}
