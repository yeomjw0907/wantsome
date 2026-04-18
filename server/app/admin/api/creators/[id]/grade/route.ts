import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminRole = req.headers.get("x-admin-role");
  if (adminRole !== "superadmin") return NextResponse.json({ message: "superadmin only" }, { status: 403 });

  const { grade } = await req.json() as { grade: string };

  const GRADE_RATES: Record<string, number> = {
    NEWBIE:  0.55,
    NORMAL:  0.65,
    POPULAR: 0.70,
    TOP:     0.75,
  };

  if (!(grade in GRADE_RATES)) {
    return NextResponse.json({ message: "유효하지 않은 등급" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("creators")
    .update({ grade, settlement_rate: GRADE_RATES[grade] })
    .eq("id", id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
