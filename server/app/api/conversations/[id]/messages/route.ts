/**
 * GET  /api/conversations/[id]/messages — 메시지 목록 (커서 페이지네이션)
 * POST /api/conversations/[id]/messages — 메시지 전송
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
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

  // 권한 확인
  const { data: conv } = await admin
    .from("conversations")
    .select("consumer_id, creator_id")
    .eq("id", convId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ message: "채팅방 없음" }, { status: 404 });
  if (conv.consumer_id !== authUser.id && conv.creator_id !== authUser.id) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor"); // last message created_at (ISO)
  let query = admin
    .from("messages")
    .select("id, sender_id, content, is_read, created_at")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: messages } = await query;
  const reversed = (messages ?? []).reverse();

  return NextResponse.json({
    messages: reversed,
    hasMore: (messages ?? []).length === 30,
    nextCursor: (messages ?? []).length > 0 ? messages![0].created_at : null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: convId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { content } = await req.json() as { content: string };
  if (!content?.trim()) return NextResponse.json({ message: "내용을 입력하세요" }, { status: 400 });

  const admin = createSupabaseAdmin();

  // 권한 확인
  const { data: conv } = await admin
    .from("conversations")
    .select("consumer_id, creator_id, consumer_unread, creator_unread")
    .eq("id", convId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ message: "채팅방 없음" }, { status: 404 });
  if (conv.consumer_id !== authUser.id && conv.creator_id !== authUser.id) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }

  const isConsumer = authUser.id === conv.consumer_id;
  const recipientId = isConsumer ? conv.creator_id : conv.consumer_id;

  // 메시지 INSERT
  const { data: msg } = await admin.from("messages")
    .insert({ conversation_id: convId, sender_id: authUser.id, content: content.trim() })
    .select("id, sender_id, content, is_read, created_at")
    .single();

  // conversations 업데이트 (last_message, unread)
  const unreadField = isConsumer ? "creator_unread" : "consumer_unread";
  const currentUnread = isConsumer ? (conv.creator_unread ?? 0) : (conv.consumer_unread ?? 0);
  await admin.from("conversations").update({
    last_message: content.trim().slice(0, 100),
    last_message_at: new Date().toISOString(),
    [unreadField]: currentUnread + 1,
  }).eq("id", convId);

  // 수신자 알림
  const { data: senderInfo } = await admin.from("users").select("nickname").eq("id", authUser.id).maybeSingle();
  await admin.from("notifications").insert({
    user_id: recipientId,
    type: "dm",
    title: `${senderInfo?.nickname ?? "누군가"}님의 메시지`,
    body: content.trim().slice(0, 80),
    data: { conversation_id: convId },
  });

  return NextResponse.json({ message: msg }, { status: 201 });
}
