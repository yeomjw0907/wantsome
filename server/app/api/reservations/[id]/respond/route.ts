import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as {
    action: "accept" | "reject";
    reject_reason?: string;
  };

  if (!body.action || !["accept", "reject"].includes(body.action)) {
    return NextResponse.json({ message: "action은 accept 또는 reject" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .select("*")
    .eq("id", id)
    .eq("creator_id", authUser.id)
    .single();

  if (resErr || !reservation) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  if (reservation.status !== "pending") {
    return NextResponse.json({ message: "이미 처리된 예약입니다." }, { status: 409 });
  }

  if (body.action === "accept") {
    // 크리에이터 더블부킹 체크: 기존 confirmed 예약과 ±30분 내 충돌 확인
    const reservedAt = new Date(reservation.reserved_at);
    const windowStart = new Date(reservedAt.getTime() - 30 * 60 * 1000).toISOString();
    const windowEnd   = new Date(reservedAt.getTime() + 30 * 60 * 1000).toISOString();

    const { data: conflicts } = await admin
      .from("reservations")
      .select("id")
      .eq("creator_id", authUser.id)
      .eq("status", "confirmed")
      .neq("id", id)
      .gte("reserved_at", windowStart)
      .lte("reserved_at", windowEnd)
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { message: "해당 시간에 이미 확정된 예약이 있습니다. 다른 시간대를 선택해주세요." },
        { status: 409 }
      );
    }

    await admin
      .from("reservations")
      .update({ status: "confirmed" })
      .eq("id", id);

    await sendPushToUser(admin, reservation.consumer_id, {
      title: "예약이 확정됐습니다 ✅",
      body: `${new Date(reservation.reserved_at).toLocaleString("ko-KR")} 통화가 확정됐어요`,
    });
  } else {
    await admin
      .from("reservations")
      .update({
        status: "cancelled",
        reject_reason: body.reject_reason ?? null,
      })
      .eq("id", id);

    await admin.rpc("add_points", {
      p_user_id: reservation.consumer_id,
      p_amount: reservation.deposit_points,
      p_reason: `reservation_refund:${id}`,
    }).then(null, () => null);

    await sendPushToUser(admin, reservation.consumer_id, {
      title: "예약이 취소됐습니다",
      body: "포인트가 환불됐습니다.",
    });
  }

  return NextResponse.json({ success: true });
}
