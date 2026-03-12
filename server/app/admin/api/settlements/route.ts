import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period"); // YYYY-MM

  const admin = createSupabaseAdmin();

  let query = admin
    .from("creator_settlements")
    .select(`
      id,
      creator_id,
      period,
      total_points,
      settlement_amount,
      tax_amount,
      net_amount,
      status,
      paid_at,
      creator:creator_id (display_name, profile_image_url)
    `)
    .order("net_amount", { ascending: false });

  if (period) {
    query = query.eq("period", period);
  }

  const { data: settlements, error } = await query;

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ settlements: settlements ?? [] });
}
