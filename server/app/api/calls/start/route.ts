import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { assertUserGate } from "@/lib/userGate";

export const dynamic = "force-dynamic";

const PER_MIN_RATE: Record<string, number> = {
  blue: 900,
  red: 1300,
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser(token);

  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = (await req.json()) as {
    creator_id: string;
    mode: "blue" | "red";
  };

  const { creator_id, mode } = body;
  if (!creator_id || !["blue", "red"].includes(mode)) {
    return NextResponse.json({ message: "creator_id, mode 필수" }, { status: 400 });
  }

  // 레이트 리밋: 유저당 1분에 10회
  const allowed = await checkRateLimit(`call_start:${authUser.id}`, 10, 60);
  if (!allowed) return rateLimitExceeded(60);

  const perMinRate = PER_MIN_RATE[mode];
  const admin = createSupabaseAdmin();

  // 통화 시작 게이트: 19세+ + 미정지 + PortOne 본인인증 완료
  const gateReject = await assertUserGate(admin, authUser.id, { requireVerified: true });
  if (gateReject) return gateReject;

  const { data: consumer } = await admin
    .from("users")
    .select("points")
    .eq("id", authUser.id)
    .single();

  if (!consumer || consumer.points < perMinRate) {
    return NextResponse.json({ message: "포인트가 부족합니다" }, { status: 400 });
  }

  const { data: creator } = await admin
    .from("creators")
    .select("is_online, is_busy, is_live_now, is_approved, display_name, profile_img")
    .eq("id", creator_id)
    .single();

  if (!creator || !creator.is_approved) {
    return NextResponse.json({ message: "크리에이터를 찾을 수 없습니다" }, { status: 404 });
  }
  if (!creator.is_online) {
    return NextResponse.json({ message: "크리에이터가 오프라인 상태입니다" }, { status: 400 });
  }
  if (creator.is_busy) {
    return NextResponse.json(
      { message: "크리에이터가 현재 통화 중입니다. DM 또는 예약을 이용해 주세요." },
      { status: 400 },
    );
  }
  if (creator.is_live_now) {
    return NextResponse.json({ message: "해당 크리에이터는 현재 라이브 중입니다." }, { status: 400 });
  }

  type ConsumerInfo = { nickname: string | null; profile_img: string | null; avg_rating: number | null; total_calls: number | null; avg_call_duration_sec: number | null };
  const { data: consumerInfo } = await (admin
    .from("users")
    .select("nickname, profile_img, avg_rating, total_calls, avg_call_duration_sec")
    .eq("id", authUser.id)
    .single() as unknown as Promise<{ data: ConsumerInfo | null; error: unknown }>);

  const { data: session, error: sessionErr } = await admin
    .from("call_sessions")
    .insert({
      consumer_id: authUser.id,
      creator_id,
      agora_channel: "",
      mode,
      status: "pending",
      per_min_rate: perMinRate,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    logger.error("calls/start session insert error", { error: sessionErr?.message });
    return NextResponse.json({ message: "세션 생성 실패" }, { status: 500 });
  }

  await admin.from("call_signals").insert({
    session_id: session.id,
    to_user_id: creator_id,
    from_user_id: authUser.id,
    type: "incoming_call",
    payload: {
      consumer_id: authUser.id,
      consumer_nickname: consumerInfo?.nickname ?? "유저",
      consumer_avatar: consumerInfo?.profile_img ?? null,
      mode,
      per_min_rate: perMinRate,
      consumer_avg_rating: consumerInfo?.avg_rating ?? 0,
      consumer_total_calls: consumerInfo?.total_calls ?? 0,
      consumer_avg_duration_sec: consumerInfo?.avg_call_duration_sec ?? 0,
    },
  });

  // 크리에이터 앱이 백그라운드일 때도 수신 알림 전달
  await sendPushToUser(admin, creator_id, {
    title: "📞 전화가 왔어요",
    body: `${consumerInfo?.nickname ?? "유저"}님이 전화를 걸었어요`,
    data: { type: "incoming_call", session_id: session.id, mode },
  });

  return NextResponse.json({
    session_id: session.id,
    per_min_rate: perMinRate,
  });
}
