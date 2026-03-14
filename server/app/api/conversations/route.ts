/**
 * GET  /api/conversations — 내 채팅 목록
 * POST /api/conversations — 채팅방 개설 + 첫 메시지 + 포인트 차감
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
  if (error || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();

  // 소비자이거나 크리에이터인 채팅방 모두 조회
  const { data: convs } = await admin
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

  return NextResponse.json({ conversations: convs ?? [] });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { creator_id, content } = await req.json() as { creator_id: string; content: string };
  if (!creator_id || !content?.trim()) {
    return NextResponse.json({ message: "creator_id, content 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 이미 채팅방이 존재하면 기존 방으로 메시지만 추가
  const { data: existing } = await admin
    .from("conversations")
    .select("id, creator_unread")
    .eq("consumer_id", authUser.id)
    .eq("creator_id", creator_id)
    .maybeSingle();

  if (existing) {
    // 기존 채팅방 — 포인트 차감 없이 메시지만
    await admin.from("messages").insert({
      conversation_id: existing.id,
      sender_id: authUser.id,
      content: content.trim(),
    });
    await admin.from("conversations").update({
      last_message: content.trim().slice(0, 100),
      last_message_at: new Date().toISOString(),
      creator_unread: (existing.creator_unread ?? 0) + 1,
    }).eq("id", existing.id);

    return NextResponse.json({ conversation_id: existing.id, is_new: false });
  }

  // 신규 채팅방 — 포인트 차감
  const { data: config } = await admin
    .from("system_config")
    .select("value")
    .eq("key", "dm_unlock_points")
    .maybeSingle();
  const unlockCost = config?.value ? Number(config.value) : 500;

  const { data: consumer } = await admin
    .from("users")
    .select("points")
    .eq("id", authUser.id)
    .single();
  if (!consumer || consumer.points < unlockCost) {
    return NextResponse.json({ message: `포인트가 부족합니다. (필요: ${unlockCost}P)` }, { status: 400 });
  }

  // 크리에이터 존재 확인
  const { data: creator } = await admin
    .from("creators")
    .select("id")
    .eq("id", creator_id)
    .maybeSingle();
  if (!creator) return NextResponse.json({ message: "크리에이터를 찾을 수 없습니다" }, { status: 404 });

  // 포인트 차감
  await admin.from("users")
    .update({ points: consumer.points - unlockCost })
    .eq("id", authUser.id);

  // 채팅방 생성
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({
      consumer_id: authUser.id,
      creator_id,
      unlock_points: unlockCost,
      creator_unread: 1,
      last_message: content.trim().slice(0, 100),
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (convErr || !conv) {
    // 롤백: 포인트 복원
    await admin.from("users").update({ points: consumer.points }).eq("id", authUser.id);
    return NextResponse.json({ message: "채팅방 생성 실패" }, { status: 500 });
  }

  // 첫 메시지
  await admin.from("messages").insert({
    conversation_id: conv.id,
    sender_id: authUser.id,
    content: content.trim(),
  });

  // 크리에이터에게 알림
  const { data: senderInfo } = await admin.from("users").select("nickname").eq("id", authUser.id).maybeSingle();
  await admin.from("notifications").insert({
    user_id: creator_id,
    type: "dm",
    title: "새 메시지가 도착했어요 💌",
    body: `${senderInfo?.nickname ?? "유저"}님이 처음으로 메시지를 보냈어요.`,
    data: { conversation_id: conv.id },
  });

  return NextResponse.json({ conversation_id: conv.id, is_new: true, points_charged: unlockCost }, { status: 201 });
}
