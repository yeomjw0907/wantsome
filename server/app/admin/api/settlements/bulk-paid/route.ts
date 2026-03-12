import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

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
    .from("settlements")
    .update({ status: "PAID", paid_at: now, paid_by: adminId })
    .eq("period", body.period)
    .eq("status", "PENDING")
    .select();

  if (error) return NextResponse.json({ message: "처리 실패" }, { status: 500 });

  // 각 크리에이터에게 푸시 알림
  const creatorIds = (settlements ?? []).map((s) => s.creator_id);
  if (creatorIds.length > 0) {
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("user_id, token")
      .in("user_id", creatorIds);

    const settlementMap = new Map((settlements ?? []).map((s) => [s.creator_id, s.net_amount]));

    if (tokens && tokens.length > 0) {
      const messages = tokens.map((t) => ({
        to: t.token,
        title: "정산이 완료됐습니다 💰",
        body: `${(settlementMap.get(t.user_id) ?? 0).toLocaleString()}원이 입금됐습니다.`,
        sound: "default",
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      }).catch(() => null);
    }
  }

  return NextResponse.json({ success: true, processed: settlements?.length ?? 0 });
}
