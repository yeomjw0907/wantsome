import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const role = searchParams.get("role");

  const admin = createSupabaseAdmin();

  let query = admin
    .from("users")
    .select("id, nickname, role, points, created_at, deleted_at, suspended_until, is_verified")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.ilike("nickname", `%${q}%`);
  }
  if (role && role !== "all") {
    query = query.eq("role", role);
  }

  const { data: users, error } = await query;

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: users ?? [] });
}
