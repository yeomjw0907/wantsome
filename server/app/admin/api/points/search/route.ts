import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (adminRole !== "superadmin") return NextResponse.json({ message: "superadmin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ users: [] });

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("users")
    .select("id, nickname, points, email, role")
    .ilike("nickname", `%${q}%`)
    .is("deleted_at", null)
    .limit(10);

  return NextResponse.json({ users: data ?? [] });
}
