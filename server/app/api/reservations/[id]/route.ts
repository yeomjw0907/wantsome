import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

// DELETE /api/reservations/:id — 소비자 예약 취소 (1시간 전까지)
export async function DELETE(
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

  const admin = createSupabaseAdmin();

  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .select("*")
    .eq("id", id)
    .eq("consumer_id", authUser.id)
    .single();

  if (resErr || !reservation) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!["pending", "confirmed"].includes(reservation.status)) {
    return NextResponse.json({ message: "취소할 수 없는 상태입니다." }, { status: 409 });
  }

  // 1시간 전까지만 취소 가능
  const timeUntilCall = new Date(reservation.reserved_at).getTime() - Date.now();
  if (timeUntilCall < 60 * 60 * 1000) {
    return NextResponse.json({ message: "예약 1시간 전에는 취소할 수 없습니다." }, { status: 422 });
  }

  await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id);

  // 포인트 환불
  await admin.rpc("add_points", {
    p_user_id: authUser.id,
    p_amount: reservation.deposit_points,
    p_reason: `reservation_cancel:${id}`,
  }).catch(() => null);

  // 크리에이터 푸시 알림
  await sendPushToUser(admin, reservation.creator_id, {
    title: "예약이 취소됐습니다",
    body: "소비자가 예약을 취소했습니다.",
  });

  return NextResponse.json({ success: true });
}
