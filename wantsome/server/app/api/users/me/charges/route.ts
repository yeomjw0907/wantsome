import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const admin = createSupabaseAdmin();

  const { data: charges, error, count } = await admin
    .from("point_charges")
    .select("*", { count: "exact" })
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    charges: charges ?? [],
    total: count ?? 0,
    page,
    hasMore: (count ?? 0) > offset + limit,
  });
}
