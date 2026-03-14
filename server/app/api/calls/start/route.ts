import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { generateAgoraToken, makeChannelName, AGORA_APP_ID } from "@/lib/agora";

export const dynamic = "force-dynamic";

const PER_MIN_RATE: Record<string, number> = {
  blue: 900,
  red: 1300,
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as {
    creator_id: string;
    mode: "blue" | "red";
  };
  const { creator_id, mode } = body;
  if (!creator_id || !["blue", "red"].includes(mode)) {
    return NextResponse.json({ message: "creator_id, mode 필수" }, { status: 400 });
  }

  const per_min_rate = PER_MIN_RATE[mode];
  const admin = createSupabaseAdmin();

  // 소비자 포인트 확인
  const { data: consumer } = await admin
    .from("users")
    .select("points")
    .eq("id", authUser.id)
    .single();
  if (!consumer || consumer.points < per_min_rate) {
    return NextResponse.json({ message: "포인트가 부족합니다" }, { status: 400 });
  }

  // 크리에이터 온라인/통화중 확인
  const { data: creator } = await admin
    .from("creators")
    .select("is_online, is_busy, is_approved, display_name, profile_img")
    .eq("id", creator_id)
    .single();
  if (!creator || !creator.is_approved) {
    return NextResponse.json({ message: "크리에이터를 찾을 수 없습니다" }, { status: 404 });
  }
  if (!creator.is_online) {
    return NextResponse.json({ message: "크리에이터가 오프라인 상태입니다" }, { status: 400 });
  }
  if (creator.is_busy) {
    return NextResponse.json({ message: "크리에이터가 현재 통화 중입니다. DM 또는 예약을 이용해 주세요." }, { status: 400 });
  }

  // 소비자 정보 (signal payload 용)
  const { data: consumerInfo } = await admin
    .from("users")
    .select("nickname, profile_img")
    .eq("id", authUser.id)
    .single();

  // call_sessions INSERT (pending 상태)
  const { data: session, error: sessionErr } = await admin
    .from("call_sessions")
    .insert({
      consumer_id: authUser.id,
      creator_id,
      agora_channel: "", // accept 시 확정
      mode,
      status: "pending",
      per_min_rate,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    console.error("[calls/start] session insert error:", sessionErr);
    return NextResponse.json({ message: "세션 생성 실패" }, { status: 500 });
  }

  // call_signals INSERT — 크리에이터에게 incoming_call 신호
  await admin.from("call_signals").insert({
    session_id: session.id,
    to_user_id: creator_id,
    from_user_id: authUser.id,
    type: "incoming_call",
    payload: {
      consumer_nickname: consumerInfo?.nickname ?? "유저",
      consumer_avatar: consumerInfo?.profile_img ?? null,
      mode,
      per_min_rate,
    },
  });

  return NextResponse.json({
    session_id: session.id,
    per_min_rate,
  });
}
