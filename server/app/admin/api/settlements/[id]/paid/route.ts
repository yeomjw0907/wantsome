import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // superadmin만
  if (adminRole !== "superadmin") {
    return NextResponse.json({ message: "superadmin만 가능합니다." }, { status: 403 });
  }

  const admin = createSupabaseAdmin();

  const { data: settlement, error: fetchErr } = await admin
    .from("creator_settlements")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !settlement) {
    return NextResponse.json({ message: "정산을 찾을 수 없습니다." }, { status: 404 });
  }

  if (settlement.status === "PAID") {
    return NextResponse.json({ message: "이미 처리됐습니다." }, { status: 409 });
  }

  const { error } = await admin
    .from("creator_settlements")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      paid_by: adminId,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ message: "처리 실패" }, { status: 500 });

  // 크리에이터 푸시 알림
  await sendPushToUser(admin, settlement.creator_id, {
    title: "정산이 완료됐습니다 💰",
    body: `${Number(settlement.net_amount).toLocaleString()}원이 등록된 계좌로 입금됐습니다.`,
  });

  // 관리자 로그
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "SETTLEMENT_PAID",
    target_type: "settlement",
    target_id: id,
    detail: { creator_id: settlement.creator_id, net_amount: settlement.net_amount },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
