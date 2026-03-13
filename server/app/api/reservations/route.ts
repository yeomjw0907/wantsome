import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

// 예약금 테이블
const DEPOSIT_MAP: Record<string, number> = {
  "30_standard": 5000,
  "60_standard": 10000,
  "60_premium": 20000,
};

// GET /api/reservations?role=consumer|creator&status=...
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? "consumer";
  const status = searchParams.get("status");

  const admin = createSupabaseAdmin();

  let query = admin
    .from("reservations")
    .select(`
      id,
      consumer_id,
      creator_id,
      reserved_at,
      duration_min,
      mode,
      type,
      deposit_points,
      status,
      reject_reason,
      consumer_ready_at,
      creator_ready_at,
      created_at,
      consumer:consumer_id (nickname, profile_img),
      creator:creator_id (display_name, profile_image_url)
    `)
    .order("reserved_at", { ascending: true });

  if (role === "creator") {
    query = query.eq("creator_id", authUser.id);
  } else {
    query = query.eq("consumer_id", authUser.id);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: reservations, error } = await query;

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ reservations: reservations ?? [] });
}

// POST /api/reservations — 예약 생성
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
    reserved_at: string;
    duration_min: 30 | 60;
    mode: "blue" | "red";
    type: "standard" | "premium";
  };

  if (!body.creator_id || !body.reserved_at || !body.duration_min || !body.mode) {
    return NextResponse.json({ message: "필수 항목 누락" }, { status: 400 });
  }

  const depositKey = `${body.duration_min}_${body.type ?? "standard"}`;
  const depositPoints = DEPOSIT_MAP[depositKey] ?? 5000;

  const admin = createSupabaseAdmin();

  // 소비자 포인트 확인
  const { data: userData } = await admin
    .from("users")
    .select("points, nickname, profile_img")
    .eq("id", authUser.id)
    .single();

  if (!userData || (userData.points ?? 0) < depositPoints) {
    return NextResponse.json({
      message: `포인트가 부족합니다. 필요: ${depositPoints.toLocaleString()}P`,
    }, { status: 422 });
  }

  // 크리에이터 동시간 예약 중복 확인 (±30분)
  const reservedAt = new Date(body.reserved_at);
  const windowStart = new Date(reservedAt.getTime() - 30 * 60 * 1000).toISOString();
  const windowEnd = new Date(reservedAt.getTime() + 30 * 60 * 1000).toISOString();

  const { data: conflicts } = await admin
    .from("reservations")
    .select("id")
    .eq("creator_id", body.creator_id)
    .in("status", ["pending", "confirmed"])
    .gte("reserved_at", windowStart)
    .lte("reserved_at", windowEnd)
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ message: "해당 시간에 이미 예약이 있습니다." }, { status: 409 });
  }

  // 예약 생성 + 포인트 차감 (트랜잭션)
  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .insert({
      consumer_id: authUser.id,
      creator_id: body.creator_id,
      reserved_at: body.reserved_at,
      duration_min: body.duration_min,
      mode: body.mode,
      type: body.type ?? "standard",
      deposit_points: depositPoints,
      status: "pending",
    })
    .select()
    .single();

  if (resErr) {
    return NextResponse.json({ message: "예약 생성 실패" }, { status: 500 });
  }

  // 포인트 차감
  await admin.rpc("deduct_points", {
    p_user_id: authUser.id,
    p_amount: depositPoints,
    p_reason: `reservation_deposit:${reservation.id}`,
  }).then(null, () => null);

  // 크리에이터에게 푸시 알림
  await sendPushToUser(admin, body.creator_id, {
    title: "예약 통화 요청이 왔어요 📅",
    body: `${userData.nickname}님이 ${new Date(body.reserved_at).toLocaleString("ko-KR")} 예약을 요청했어요`,
  });

  return NextResponse.json({
    reservation_id: reservation.id,
    deposit_points: depositPoints,
  }, { status: 201 });
}
