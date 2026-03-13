/**
 * GET  /api/favorites         — 내 즐겨찾기 크리에이터 목록
 * POST /api/favorites         — 즐겨찾기 추가/제거 (토글)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuth(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return { authUser: null, error: "Unauthorized" };
  const client = createSupabaseClient(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { authUser: null, error: "Invalid token" };
  return { authUser: user, error: null };
}

export async function GET(req: NextRequest) {
  const { authUser, error } = await getAuth(req);
  if (!authUser) return NextResponse.json({ message: error }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data, error: dbErr } = await admin
    .from("favorites")
    .select(`
      creator_id,
      creators!inner(
        id, display_name, grade, is_online, mode_blue, mode_red, avg_rating, categories,
        users!inner(nickname, profile_img, is_verified)
      )
    `)
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ message: dbErr.message }, { status: 500 });

  const favorites = (data ?? []).map((row: any) => {
    const c = row.creators ?? {};
    const u = c.users ?? {};
    return {
      id: c.id,
      display_name: c.display_name ?? u.nickname ?? "크리에이터",
      profile_image_url: u.profile_img ?? null,
      grade: c.grade ?? "신규",
      is_online: c.is_online ?? false,
      mode_blue: c.mode_blue ?? true,
      mode_red: c.mode_red ?? false,
      is_verified: u.is_verified ?? false,
      avg_rating: c.avg_rating ?? 0,
      categories: c.categories ?? [],
    };
  });

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const { authUser, error } = await getAuth(req);
  if (!authUser) return NextResponse.json({ message: error }, { status: 401 });

  const { creator_id } = await req.json() as { creator_id: string };
  if (!creator_id) return NextResponse.json({ message: "creator_id required" }, { status: 400 });

  const admin = createSupabaseAdmin();

  // 이미 즐겨찾기인지 확인
  const { data: existing } = await admin
    .from("favorites")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("creator_id", creator_id)
    .single();

  if (existing) {
    // 제거
    await admin.from("favorites").delete().eq("user_id", authUser.id).eq("creator_id", creator_id);
    return NextResponse.json({ favorited: false });
  } else {
    // 추가
    await admin.from("favorites").insert({ user_id: authUser.id, creator_id });
    return NextResponse.json({ favorited: true });
  }
}
