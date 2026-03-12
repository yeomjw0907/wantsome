import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser || authUser.id !== id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { is_online } = await req.json() as { is_online: boolean };
  if (typeof is_online !== "boolean") {
    return NextResponse.json({ message: "is_online 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("creators")
    .update({ is_online })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
