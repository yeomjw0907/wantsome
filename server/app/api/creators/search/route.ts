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

  let q = admin
    .from("creators")
    .select(
      `id, display_name, grade, is_online, mode_blue, mode_red, avg_rating, profile_image_url`,
    )
    .ilike("display_name", `%${query}%`);

  if (mode === "red") {
    q = q.eq("mode_red", true);
  } else {
    q = q.or("mode_blue.is.null,mode_blue.eq.true");
  }

  const { data: rows, error } = await q
    .order("is_online", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const creatorRows = rows ?? [];
  const ids = creatorRows.map((r: { id: string }) => r.id);
  type UserRow = {
    id: string;
    profile_img: string | null;
    is_verified: boolean | null;
  };
  const userById = new Map<string, UserRow>();
  if (ids.length > 0) {
    const { data: userRows, error: uErr } = await admin
      .from("users")
      .select("id, profile_img, is_verified")
      .in("id", ids);
    if (!uErr && userRows) {
      for (const u of userRows as UserRow[]) {
        userById.set(u.id, u);
      }
    }
  }

  const creators = creatorRows.map((row: any) => {
    const user = userById.get(row.id);

    return {
      id: row.id,
      display_name: row.display_name ?? "크리에이터",
      profile_image_url: user?.profile_img ?? row.profile_image_url ?? null,
      grade: row.grade ?? "루키",
      is_online: row.is_online ?? false,
      mode_blue: row.mode_blue ?? true,
      mode_red: row.mode_red ?? false,
      is_verified: user?.is_verified ?? false,
      avg_rating: row.avg_rating ?? 0,
      rate_per_min: mode === "red" ? 1300 : 900,
    };
  });

  return NextResponse.json({ creators });
}
