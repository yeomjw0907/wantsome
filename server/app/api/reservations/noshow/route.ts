import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

// Vercel Cron: 매 분 실행
// 예약 시간 + 10분 경과 + confirmed 상태 → 노쇼 처리
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const now = new Date();
  const cutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  const { data: noshows, error } = await admin
    .from("reservations")
    .select("id, consumer_id, creator_id, deposit_points, reserved_at")
    .eq("status", "confirmed")
    .lt("reserved_at", cutoff);

  if (error || !noshows || noshows.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const res of noshows) {
    await admin
      .from("reservations")
      .update({ status: "noshow", noshow_at: now.toISOString() })
      .eq("id", res.id);

    const compensation = Math.floor(res.deposit_points * 0.5);
    await admin.rpc("add_points", {
      p_user_id: res.creator_id,
      p_amount: compensation,
      p_reason: `noshow_compensation:${res.id}`,
    }).then(null, () => null);

    await sendPushToUser(admin, res.consumer_id, {
      title: "크리에이터가 나타나지 않았습니다",
      body: "다음 이용 시 포인트 혜택을 드립니다.",
    });

    await sendPushToUser(admin, res.creator_id, {
      title: "노쇼로 처리됐습니다",
      body: `예약금의 50% (${compensation.toLocaleString()}P)가 지급됩니다.`,
    });

    processed++;
  }

  return NextResponse.json({ processed });
}
