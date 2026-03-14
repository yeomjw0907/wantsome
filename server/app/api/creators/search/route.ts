/**
 * GET /api/creators/search?q=닉네임&mode=blue|red
 * 닉네임으로 크리에이터 검색
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q    = (searchParams.get("q") ?? "").trim();
  const mode = searchParams.get("mode") ?? "blue";

  if (q.length < 1) {
    return NextResponse.json({ creators: [] });
  }

  const admin = createSupabaseAdmin();
  const column = mode === "red" ? "mode_red" : "mode_blue";

  const { data: rows, error } = await admin
    .from("creators")
    .select(`
      id, display_name, grade, is_online, mode_blue, mode_red, avg_rating,
      users!inner(profile_img, is_verified)
    `)
    .eq(column, true)
    .ilike("display_name", `%${q}%`)
    .order("is_online", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const creators = (rows ?? []).map((r: any) => {
    const u = r.users ?? {};
    return {
      id:               r.id,
      display_name:     r.display_name,
      profile_image_url: u.profile_img ?? null,
      grade:            r.grade ?? "신규",
      is_online:        r.is_online ?? false,
      mode_blue:        r.mode_blue ?? true,
      mode_red:         r.mode_red ?? false,
      is_verified:      u.is_verified ?? false,
      avg_rating:       r.avg_rating ?? 0,
      rate_per_min:     mode === "red" ? 1300 : 900,
    };
  });

  return NextResponse.json({ creators });
}
