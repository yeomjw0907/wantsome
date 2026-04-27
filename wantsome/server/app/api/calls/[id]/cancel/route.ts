import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data: session } = await admin
    .from("call_sessions")
    .select("consumer_id, creator_id, status")
    .eq("id", sessionId)
    .single();

  if (!session) return NextResponse.json({ message: "세션 없음" }, { status: 404 });
  if (session.consumer_id !== authUser.id) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }
  if (!["pending", "active"].includes(session.status)) {
    return NextResponse.json({ message: "취소 불가 상태" }, { status: 400 });
  }

  await admin
    .from("call_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);

  await admin.from("call_signals").insert({
    session_id: sessionId,
    to_user_id: session.creator_id,
    from_user_id: authUser.id,
    type: "call_cancelled",
    payload: {},
  });

  return NextResponse.json({ success: true });
}
