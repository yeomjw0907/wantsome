import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";
  const category = searchParams.get("category");

  const admin = createSupabaseAdmin();

  let query = admin
    .from("reports")
    .select(`
      id,
      category,
      description,
      status,
      auto_suspended,
      created_at,
      reporter:reporter_id (nickname),
      target:target_id (nickname)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data: reports, error } = await query;

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: reports ?? [] });
}
