import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const { push_token } = await req.json() as { push_token: string | null };

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("users")
    .update({ push_token: push_token ?? null })
    .eq("id", authUser.id);

  if (error) {
    return NextResponse.json({ message: "업데이트 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
