/**
 * GET  /api/conversations
 * POST /api/conversations
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ConversationPostBody = {
  creator_id?: string;
  consumer_id?: string;
  target_user_id?: string;
  call_session_id?: string;
  content?: string;
  message?: string;
};

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data: conversations } = await admin
    .from("conversations")
    .select(`
      id, consumer_id, creator_id, unlock_points,
      consumer_unread, creator_unread, last_message, last_message_at, created_at,
      consumers:consumer_id (nickname, profile_img),
      creators:creator_id (display_name, is_online, is_busy,
        users:id (nickname, profile_img))
    `)
    .or(`consumer_id.eq.${authUser.id},creator_id.eq.${authUser.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return NextResponse.json({ conversations: conversations ?? [] });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const body = (await req.json()) as ConversationPostBody;
  const content = body.content?.trim() || body.message?.trim() || "";
  if (!content) {
    return NextResponse.json({ message: "content is required" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  let creatorId = body.creator_id ?? null;
  let consumerId: string | null = null;

  if (body.call_session_id) {
    const { data: session } = await admin
      .from("call_sessions")
      .select("id, consumer_id, creator_id, status")
      .eq("id", body.call_session_id)
      .single();

    if (!session) {
      return NextResponse.json({ message: "Call session not found" }, { status: 404 });
    }
    if (session.status !== "ended") {
      return NextResponse.json({ message: "Only ended calls can open DMs" }, { status: 400 });
    }
    if (session.consumer_id !== authUser.id && session.creator_id !== authUser.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const requestedTargetId =
      body.target_user_id ?? body.consumer_id ?? body.creator_id ?? null;
    const otherPartyId =
      session.consumer_id === authUser.id ? session.creator_id : session.consumer_id;

    if (requestedTargetId && requestedTargetId !== otherPartyId) {
      return NextResponse.json({ message: "Target must be the other call participant" }, { status: 403 });
    }

    creatorId = session.creator_id;
    consumerId = session.consumer_id;
  } else {
    if (!creatorId) {
      return NextResponse.json({ message: "creator_id or call_session_id is required" }, { status: 400 });
    }
    consumerId = authUser.id;
  }

  if (!creatorId || !consumerId) {
    return NextResponse.json({ message: "Invalid conversation participants" }, { status: 400 });
  }

  const senderIsCreator = authUser.id === creatorId;
  const senderIsConsumer = authUser.id === consumerId;
  if (!senderIsCreator && !senderIsConsumer) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data: creator } = await admin
    .from("creators")
    .select("id")
    .eq("id", creatorId)
    .maybeSingle();
  if (!creator) {
    return NextResponse.json({ message: "Creator not found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("conversations")
    .select("id, creator_unread, consumer_unread")
    .eq("consumer_id", consumerId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existing) {
    await admin.from("messages").insert({
      conversation_id: existing.id,
      sender_id: authUser.id,
      content,
    });

    const unreadPatch = senderIsCreator
      ? { consumer_unread: (existing.consumer_unread ?? 0) + 1 }
      : { creator_unread: (existing.creator_unread ?? 0) + 1 };

    await admin
      .from("conversations")
      .update({
        last_message: content.slice(0, 100),
        last_message_at: new Date().toISOString(),
        ...unreadPatch,
      })
      .eq("id", existing.id);

    return NextResponse.json({ conversation_id: existing.id, is_new: false });
  }

  const { data: config } = await admin
    .from("system_config")
    .select("value")
    .eq("key", "dm_unlock_points")
    .maybeSingle();
  const unlockCost = config?.value ? Number(config.value) : 500;

  const { data: sender } = await admin
    .from("users")
    .select("points, nickname")
    .eq("id", authUser.id)
    .single();
  if (!sender || sender.points < unlockCost) {
    return NextResponse.json(
      { message: `Insufficient points. Need ${unlockCost}P` },
      { status: 400 }
    );
  }

  await admin.from("users").update({ points: sender.points - unlockCost }).eq("id", authUser.id);

  const { data: conversation, error: conversationErr } = await admin
    .from("conversations")
    .insert({
      consumer_id: consumerId,
      creator_id: creatorId,
      unlock_points: unlockCost,
      creator_unread: senderIsConsumer ? 1 : 0,
      consumer_unread: senderIsCreator ? 1 : 0,
      last_message: content.slice(0, 100),
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (conversationErr || !conversation) {
    await admin.from("users").update({ points: sender.points }).eq("id", authUser.id);
    return NextResponse.json({ message: "Failed to create conversation" }, { status: 500 });
  }

  await admin.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: authUser.id,
    content,
  });

  const recipientId = senderIsCreator ? consumerId : creatorId;
  await admin.from("notifications").insert({
    user_id: recipientId,
    type: "dm",
    title: "New message",
    body: `${sender.nickname ?? "User"} sent you a message.`,
    data: { conversation_id: conversation.id },
  });

  return NextResponse.json(
    {
      conversation_id: conversation.id,
      is_new: true,
      points_charged: unlockCost,
    },
    { status: 201 }
  );
}
