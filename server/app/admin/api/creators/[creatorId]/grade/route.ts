import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const { creatorId } = await params;
  const adminRole = req.headers.get("x-admin-role");
  if (adminRole !== "superadmin") return NextResponse.json({ message: "superadmin only" }, { status: 403 });

  const { grade } = await req.json() as { grade: string };
  const validGrades = ["NEWBIE", "NORMAL", "POPULAR", "TOP"];
  if (!validGrades.includes(grade)) {
    return NextResponse.json({ message: "유효하지 않은 등급" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("creators")
    .update({ grade })
    .eq("id", creatorId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
