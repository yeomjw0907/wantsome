/**
 * PATCH /api/conversations/[id]/read — 읽음 처리 (내 unread 초기화)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: convId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
  if (error || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();

  const { data: conv } = await admin
    .from("conversations")
    .select("consumer_id, creator_id")
    .eq("id", convId)
    .maybeSingle();

  if (!conv) return NextResponse.json({ message: "채팅방 없음" }, { status: 404 });
  if (conv.consumer_id !== authUser.id && conv.creator_id !== authUser.id) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }

  const isConsumer = authUser.id === conv.consumer_id;
  const field = isConsumer ? "consumer_unread" : "creator_unread";

  await admin.from("conversations").update({ [field]: 0 }).eq("id", convId);

  // 메시지 읽음 처리
  await admin.from("messages")
    .update({ is_read: true })
    .eq("conversation_id", convId)
    .neq("sender_id", authUser.id);

  return NextResponse.json({ ok: true });
}
