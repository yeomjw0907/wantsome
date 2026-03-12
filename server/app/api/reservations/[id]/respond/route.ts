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
    }).catch(() => null);

    await sendPushToUser(admin, reservation.consumer_id, {
      title: "예약이 취소됐습니다",
      body: "포인트가 환불됐습니다.",
    });
  }

  return NextResponse.json({ success: true });
}
