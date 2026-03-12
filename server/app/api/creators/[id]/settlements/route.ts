import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data: settlements, error } = await admin
    .from("settlements")
    .select("*")
    .eq("creator_id", id)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ settlements: settlements ?? [] });
}
