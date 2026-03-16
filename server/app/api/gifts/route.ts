/**
 * POST /api/gifts — 통화 중 포인트 선물
 * GET  /api/gifts?creator_id=xxx — 크리에이터가 받은 선물 내역
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const GIFT_OPTIONS = [100, 300, 500, 1000, 3000, 5000] as const;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { call_session_id, to_creator_id, amount, message } = await req.json() as {
    call_session_id: string;
    to_creator_id: string;
    amount: number;
    message?: string;
  };

  if (!call_session_id || !to_creator_id || !amount) {
    return NextResponse.json({ message: "필수 값 누락" }, { status: 400 });
  }
  if (!GIFT_OPTIONS.includes(amount as (typeof GIFT_OPTIONS)[number])) {
    return NextResponse.json({ message: `선물 금액은 ${GIFT_OPTIONS.join("/")} 중 하나여야 합니다.` }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 진행 중인 통화 세션 확인
  const { data: session } = await admin
    .from("call_sessions")
    .select("id, consumer_id, status")
    .eq("id", call_session_id)
    .eq("status", "active")
    .single();

  if (!session) {
    return NextResponse.json({ message: "진행 중인 통화 세션이 아닙니다." }, { status: 400 });
  }
  if (session.consumer_id !== user.id) {
    return NextResponse.json({ message: "본인 통화만 선물 가능합니다." }, { status: 403 });
  }

  // 포인트 차감 (users.points)
  const { data: userRow } = await admin
    .from("users")
    .select("points, nickname")
    .eq("id", user.id)
    .single();

  const currentPoints = (userRow as any)?.points ?? 0;
  if (currentPoints < amount) {
    return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
  }

  // 포인트 차감 + 선물 기록 (트랜잭션 대신 순차 실행)
  const { error: deductErr } = await admin
    .from("users")
    .update({ points: currentPoints - amount })
    .eq("id", user.id);

  if (deductErr) return NextResponse.json({ message: deductErr.message }, { status: 500 });

  const { data: gift, error: giftErr } = await admin
    .from("gifts")
    .insert({
      call_session_id,
      from_user_id: user.id,
      to_creator_id,
      amount,
      message: message?.slice(0, 50) ?? null,
    })
    .select("id, amount, message, created_at")
    .single();

  if (giftErr) return NextResponse.json({ message: giftErr.message }, { status: 500 });

  // ─── Realtime 시그널 — 크리에이터 화면에 선물 이팩트 표시 ───
  await admin.from("call_signals").insert({
    session_id: call_session_id,
    type: "gift_received",
    to_user_id: to_creator_id,
    from_user_id: user.id,
    payload: {
      amount,
      from_nickname: (userRow as any)?.nickname ?? "익명",
    },
  }).then(null, () => null); // non-blocking

  return NextResponse.json({ success: true, gift, remaining_points: currentPoints - amount });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const isSent = searchParams.get("sent") === "1"; // 내가 보낸 선물 조회 (소비자용)

  const admin = createSupabaseAdmin();

  let query;
  if (isSent) {
    // 소비자: 내가 보낸 선물 + 받은 크리에이터 정보
    query = admin
      .from("gifts")
      .select("id, amount, message, created_at, to_creator_id, creators!to_creator_id(display_name, profile_image_url)")
      .eq("from_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
  } else if (sessionId) {
    // 특정 통화 세션의 선물 목록
    query = admin
      .from("gifts")
      .select("id, amount, message, created_at, from_user_id, users!from_user_id(nickname, profile_img)")
      .eq("call_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(50);
  } else {
    // 크리에이터: 내가 받은 선물 + 보낸 유저 정보
    query = admin
      .from("gifts")
      .select("id, amount, message, created_at, from_user_id, users!from_user_id(nickname, profile_img)")
      .eq("to_creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ gifts: data ?? [] });
}
