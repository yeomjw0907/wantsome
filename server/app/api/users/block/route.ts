import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as { target_id: string };
  if (!body.target_id) {
    return NextResponse.json({ message: "target_id 필수" }, { status: 400 });
  }
  if (body.target_id === authUser.id) {
    return NextResponse.json({ message: "자신을 차단할 수 없습니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("user_blocks")
    .upsert({
      user_id: authUser.id,
      blocked_user_id: body.target_id,
      created_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,blocked_user_id",
    });

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: "차단 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as { target_id: string };
  if (!body.target_id) {
    return NextResponse.json({ message: "target_id 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("user_blocks")
    .delete()
    .eq("user_id", authUser.id)
    .eq("blocked_user_id", body.target_id);

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: "차단 해제 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
