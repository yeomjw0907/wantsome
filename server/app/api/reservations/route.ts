import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";
import { logger } from "@/lib/logger";
import {
  calcReservationDeposit,
  hasReservationConflict,
  isValidReservationDuration,
} from "@/lib/reservations";

export const dynamic = "force-dynamic";

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
    duration_min: number;
    mode: "blue" | "red";
    type?: "standard" | "premium";
  };

  if (!body.creator_id || !body.reserved_at || !body.duration_min || !body.mode) {
    return NextResponse.json({ message: "필수 항목 누락" }, { status: 400 });
  }

  // duration_min 검증: 10~60분, 5분 단위
  const durationMin = Number(body.duration_min);
  if (!isValidReservationDuration(durationMin)) {
    return NextResponse.json({ message: "예약 시간은 10~60분 사이 5분 단위여야 합니다." }, { status: 400 });
  }

  // 최소 2시간 리드타임 체크
  const reservedAtCheck = new Date(body.reserved_at);
  if (reservedAtCheck.getTime() - Date.now() < 2 * 60 * 60 * 1000) {
    return NextResponse.json(
      { message: "예약은 2시간 이전에 미리 신청해야 합니다." },
      { status: 422 }
    );
  }

  const depositPoints = calcReservationDeposit(durationMin, body.mode);

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

  // 크리에이터 동시간 예약 중복 확인 (duration 기반 실제 겹침)
  const newStart = new Date(body.reserved_at).getTime();
  const newEnd = newStart + durationMin * 60_000;
  const lookbackStart = new Date(newStart - 60 * 60_000).toISOString(); // 1시간 전부터
  const lookforwardEnd = new Date(newEnd).toISOString();

  const { data: candidates } = await admin
    .from("reservations")
    .select("id, reserved_at, duration_min")
    .eq("creator_id", body.creator_id)
    .in("status", ["pending", "confirmed"])
    .gte("reserved_at", lookbackStart)
    .lte("reserved_at", lookforwardEnd);

  if (hasReservationConflict(candidates ?? [], newStart, durationMin)) {
    return NextResponse.json({ message: "해당 시간에 이미 예약이 있습니다." }, { status: 409 });
  }

  const deductReason = `reservation_deposit:${authUser.id}:${body.creator_id}:${body.reserved_at}`;
  const { error: deductError } = await admin.rpc("deduct_points", {
    p_user_id: authUser.id,
    p_amount: depositPoints,
    p_reason: deductReason,
  });

  if (deductError) {
    return NextResponse.json({ message: "예약금 차감에 실패했습니다." }, { status: 500 });
  }

  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .insert({
      consumer_id: authUser.id,
      creator_id: body.creator_id,
      reserved_at: body.reserved_at,
      duration_min: durationMin,
      mode: body.mode,
      type: body.type ?? "standard",
      deposit_points: depositPoints,
      status: "pending",
    })
    .select()
    .single();

  if (resErr || !reservation) {
    const { error: refundError } = await admin.rpc("add_points", {
      p_user_id: authUser.id,
      p_amount: depositPoints,
      p_reason: `${deductReason}:rollback`,
    });

    if (refundError) {
      logger.error("reservations rollback failed", {
        userId: authUser.id,
        amount: depositPoints,
        error: refundError.message,
      });
    }

    return NextResponse.json({ message: "예약 생성 실패" }, { status: 500 });
  }

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
