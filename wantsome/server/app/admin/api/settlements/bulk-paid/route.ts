import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (adminRole !== "superadmin") {
    return NextResponse.json({ message: "superadmin만 가능합니다." }, { status: 403 });
  }

  const body = await req.json() as { period: string };
  if (!body.period) return NextResponse.json({ message: "period 필수" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: settlements, error } = await admin
    .from("creator_settlements")
    .update({ status: "PAID", paid_at: now })
    .eq("period", body.period)
    .eq("status", "PENDING")
    .select();

  if (error) return NextResponse.json({ message: "처리 실패" }, { status: 500 });

  // 각 크리에이터에게 푸시 알림
  const creatorIds = (settlements ?? []).map((s) => s.creator_id);
  if (creatorIds.length > 0) {
    await sendPushToUsers(admin, creatorIds, {
      title: "정산이 완료됐습니다 💰",
      body: `${body.period} 정산이 입금됐습니다. 확인해보세요.`,
    });
  }

  return NextResponse.json({ success: true, processed: settlements?.length ?? 0 });
}
