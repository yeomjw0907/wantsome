import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q") ?? "";
  const grade  = searchParams.get("grade") ?? "all";
  const online = searchParams.get("online") ?? "all";

  const admin = createSupabaseAdmin();

  // 1) creators 테이블 (승인된 크리에이터)
  let query = admin
    .from("creators")
    .select(`
      id, display_name, profile_image_url, grade, is_online,
      mode_blue, mode_red, total_calls, total_earnings, created_at,
      users!inner(nickname, email, role, suspended_until, deleted_at)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) query = query.ilike("display_name", `%${q}%`);
  if (grade !== "all") query = query.eq("grade", grade);
  if (online === "online") query = query.eq("is_online", true);

  const { data: creators, error } = await query;
  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // 2) role=creator/both 이지만 creators 테이블에 없는 유저 (승인 대기 / 미승인)
  if (grade === "all" && online !== "online") {
    const existingIds = new Set((creators ?? []).map((c: any) => c.id));

    let usersQuery = admin
      .from("users")
      .select("id, nickname, email, role, suspended_until, deleted_at, created_at")
      .in("role", ["creator", "both"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (q) usersQuery = usersQuery.ilike("nickname", `%${q}%`);

    const { data: creatorUsers } = await usersQuery;

    const extra = (creatorUsers ?? [])
      .filter((u: any) => !existingIds.has(u.id))
      .map((u: any) => ({
        id: u.id,
        display_name: u.nickname,
        profile_image_url: null,
        grade: "NEWBIE",
        is_online: false,
        mode_blue: true,
        mode_red: false,
        total_calls: 0,
        total_earnings: 0,
        created_at: u.created_at,
        _pending: true,
        users: {
          nickname: u.nickname, email: u.email, role: u.role,
          suspended_until: u.suspended_until, deleted_at: u.deleted_at,
        },
      }));

    return NextResponse.json({ creators: [...(creators ?? []), ...extra] });
  }

  return NextResponse.json({ creators: creators ?? [] });
}
