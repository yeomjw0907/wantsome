import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PER_MIN_RATES = { blue: 900, red: 1300 } as const;
const PAGE_SIZE = 20;

export type FeedMode = "blue" | "red";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "blue") as FeedMode;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)));
  const category = searchParams.get("category") ?? "";

  if (mode !== "blue" && mode !== "red") {
    return NextResponse.json({ message: "Invalid mode" }, { status: 400 });
  }

  const column = mode === "blue" ? "mode_blue" : "mode_red";
  const admin = createSupabaseAdmin();

  let query = admin
    .from("creators")
    .select(
      `id, display_name, grade, is_online, mode_blue, mode_red, profile_image_url,
       settlement_rate, monthly_minutes, created_at, avg_rating, categories,
       users(nickname, profile_img, is_verified)`,
    )
    .eq(column, true);

  if (category && category !== "전체") {
    const categories = category
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (categories.length > 0) {
      query = query.overlaps("categories", categories);
    }
  }

  const { data: rows, error } = await query
    .order("is_online", { ascending: false })
    .order("created_at", { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ creators: [], total: 0, hasMore: false });
    }

    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const creators = (rows ?? []).map((row: any) => {
    const user = Array.isArray(row.users) ? row.users[0] ?? {} : row.users ?? {};

    return {
      id: row.id,
      display_name: row.display_name ?? user.nickname ?? "크리에이터",
      profile_image_url: user.profile_img ?? row.profile_image_url ?? null,
      grade: row.grade ?? "루키",
      is_online: row.is_online ?? false,
      mode_blue: row.mode_blue ?? true,
      mode_red: row.mode_red ?? false,
      settlement_rate: row.settlement_rate ?? 0.5,
      monthly_minutes: row.monthly_minutes ?? 0,
      is_verified: user.is_verified ?? false,
      avg_rating: row.avg_rating ?? 0,
      categories: row.categories ?? [],
      rate_per_min: PER_MIN_RATES[mode],
    };
  });

  return NextResponse.json({
    creators,
    total: creators.length,
    hasMore: creators.length >= limit,
  });
}
