import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";
import { assertUserGate } from "@/lib/userGate";
import { GIFT_AMOUNTS, isValidGiftAmount } from "@/constants/gifts";

export const dynamic = "force-dynamic";

type GiftPayload = {
  call_session_id?: string | null;
  live_room_id?: string | null;
  to_creator_id?: string | null;
  amount: number;
  message?: string;
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authClient = createSupabaseClient(token);
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser(token);

  if (authErr || !user) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const { call_session_id, live_room_id, to_creator_id, amount, message } =
    (await req.json()) as GiftPayload;

  const hasCallContext = Boolean(call_session_id);
  const hasLiveContext = Boolean(live_room_id);
  if (hasCallContext === hasLiveContext) {
    return NextResponse.json(
      { message: "call_session_id 또는 live_room_id 중 하나만 전달해야 합니다." },
      { status: 400 },
    );
  }
  if (!amount || !isValidGiftAmount(amount)) {
    return NextResponse.json(
      { message: `선물 금액은 ${GIFT_AMOUNTS.join("/")} 중 하나여야 합니다.` },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();

  // 게이트: 19세+ + 미정지 (선물은 본인인증 옵션 없음)
  const gateReject = await assertUserGate(admin, user.id);
  if (gateReject) return gateReject;
  const { data: userRow } = await admin
    .from("users")
    .select("points, nickname")
    .eq("id", user.id)
    .single();

  const currentPoints = userRow?.points ?? 0;
  if (currentPoints < amount) {
    return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
  }

  let creatorId = to_creator_id ?? null;

  if (call_session_id) {
    const { data: session } = await admin
      .from("call_sessions")
      .select("id, consumer_id, creator_id, status")
      .eq("id", call_session_id)
      .eq("status", "active")
      .single();

    if (!session) {
      return NextResponse.json({ message: "진행 중인 통화 세션을 찾을 수 없습니다." }, { status: 400 });
    }
    if (session.consumer_id !== user.id) {
      return NextResponse.json({ message: "본인 통화에서만 선물을 보낼 수 있습니다." }, { status: 403 });
    }

    // 클라이언트가 to_creator_id를 보내더라도 항상 서버 검증된 session.creator_id를 사용
    // (임의 user를 to_creator_id로 지정해 정산 왜곡·spoofed signal 발송 방지)
    creatorId = session.creator_id;

    // atomic 차감 (race condition 방어)
    const { data: deductRows, error: deductErr } = await admin.rpc("try_deduct_points", {
      p_user_id: user.id,
      p_amount: amount,
    });

    if (deductErr) {
      return NextResponse.json({ message: deductErr.message }, { status: 500 });
    }
    if (!deductRows?.[0]?.success) {
      return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
    }
    const remainingPoints = deductRows[0].new_balance;

    const { data: gift, error: giftErr } = await admin
      .from("gifts")
      .insert({
        call_session_id,
        from_user_id: user.id,
        to_creator_id: creatorId,
        amount,
        message: message?.slice(0, 50) ?? null,
      })
      .select("id, amount, message, created_at")
      .single();

    if (giftErr) {
      return NextResponse.json({ message: giftErr.message }, { status: 500 });
    }

    await admin
      .from("call_signals")
      .insert({
        session_id: call_session_id,
        type: "gift_received",
        to_user_id: creatorId,
        from_user_id: user.id,
        payload: {
          amount,
          from_nickname: userRow?.nickname ?? "익명",
        },
      })
      .then(null, () => null);

    return NextResponse.json({
      success: true,
      gift,
      remaining_points: remainingPoints,
    });
  }

  const { data: room } = await admin
    .from("live_rooms")
    .select("id, host_id, status")
    .eq("id", live_room_id)
    .single();

  if (!room || room.status !== "live") {
    return NextResponse.json({ message: "진행 중인 라이브를 찾을 수 없습니다." }, { status: 400 });
  }
  if (room.host_id === user.id) {
    return NextResponse.json({ message: "호스트는 자신의 라이브에 선물을 보낼 수 없습니다." }, { status: 400 });
  }

  const { data: participant } = await admin
    .from("live_room_participants")
    .select("role, status")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .single();

  if (!participant || participant.status !== "joined") {
    return NextResponse.json({ message: "입장한 시청자만 선물을 보낼 수 있습니다." }, { status: 403 });
  }

  creatorId = room.host_id;

  // atomic 차감 (race condition 방어)
  const { data: liveDeductRows, error: deductErr } = await admin.rpc("try_deduct_points", {
    p_user_id: user.id,
    p_amount: amount,
  });

  if (deductErr) {
    return NextResponse.json({ message: deductErr.message }, { status: 500 });
  }
  if (!liveDeductRows?.[0]?.success) {
    return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
  }
  const liveRemainingPoints = liveDeductRows[0].new_balance;

  const { data: gift, error: giftErr } = await admin
    .from("gifts")
    .insert({
      live_room_id: room.id,
      from_user_id: user.id,
      to_creator_id: creatorId,
      amount,
      message: message?.slice(0, 50) ?? null,
    })
    .select("id, amount, message, created_at")
    .single();

  if (giftErr) {
    return NextResponse.json({ message: giftErr.message }, { status: 500 });
  }

  await admin
    .from("live_chat_messages")
    .insert({
      room_id: room.id,
      sender_id: user.id,
      sender_role: participant.role,
      message: message?.slice(0, 50) || `선물 ${amount}P`,
    })
    .then(null, () => null);

  return NextResponse.json({
    success: true,
    gift,
    remaining_points: liveRemainingPoints,
  });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authClient = createSupabaseClient(token);
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser(token);

  if (authErr || !user) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const liveRoomId = searchParams.get("live_room_id");
  const isSent = searchParams.get("sent") === "1";

  const admin = createSupabaseAdmin();

  let query;
  if (isSent) {
    query = admin
      .from("gifts")
      .select("id, amount, message, created_at, to_creator_id, live_room_id, call_session_id")
      .eq("from_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
  } else if (sessionId) {
    query = admin
      .from("gifts")
      .select("id, amount, message, created_at, from_user_id, users!from_user_id(nickname, profile_img)")
      .eq("call_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(50);
  } else if (liveRoomId) {
    query = admin
      .from("gifts")
      .select("id, amount, message, created_at, from_user_id, users!from_user_id(nickname, profile_img)")
      .eq("live_room_id", liveRoomId)
      .order("created_at", { ascending: false })
      .limit(50);
  } else {
    query = admin
      .from("gifts")
      .select("id, amount, message, created_at, from_user_id, users!from_user_id(nickname, profile_img)")
      .eq("to_creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ gifts: data ?? [] });
}
