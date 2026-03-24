import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim();
  const mode = searchParams.get("mode") ?? "blue";

  if (query.length < 1) {
    return NextResponse.json({ creators: [] });
  }

  const admin = createSupabaseAdmin();
  const column = mode === "red" ? "mode_red" : "mode_blue";

  const { data: rows, error } = await admin
    .from("creators")
    .select(
      `id, display_name, grade, is_online, mode_blue, mode_red, avg_rating, profile_image_url,
       users(profile_img, is_verified)`,
    )
    .eq(column, true)
    .ilike("display_name", `%${query}%`)
    .order("is_online", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const creators = (rows ?? []).map((row: any) => {
    const user = Array.isArray(row.users) ? row.users[0] ?? {} : row.users ?? {};

    return {
      id: row.id,
      display_name: row.display_name ?? "크리에이터",
      profile_image_url: user.profile_img ?? row.profile_image_url ?? null,
      grade: row.grade ?? "루키",
      is_online: row.is_online ?? false,
      mode_blue: row.mode_blue ?? true,
      mode_red: row.mode_red ?? false,
      is_verified: user.is_verified ?? false,
      avg_rating: row.avg_rating ?? 0,
      rate_per_min: mode === "red" ? 1300 : 900,
    };
  });

  return NextResponse.json({ creators });
}
