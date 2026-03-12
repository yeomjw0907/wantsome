import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const grade = searchParams.get("grade") ?? "all";
  const online = searchParams.get("online") ?? "all";

  const admin = createSupabaseAdmin();

  let query = admin
    .from("creators")
    .select(`
      id, user_id, display_name, profile_image_url, grade, is_online,
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

  return NextResponse.json({ creators: creators ?? [] });
}
