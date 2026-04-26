import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { assertCronSecret } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

// Vercel Cron: 매일 23:00 UTC (= KST 08:00) 실행
// 10분 후 예약 있는 소비자 + 크리에이터에게 알림
export async function GET(req: NextRequest) {
  const unauthorized = assertCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createSupabaseAdmin();

  const now = new Date();
  const windowStart = new Date(now.getTime() + 9 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const { data: reservations, error } = await admin
    .from("reservations")
    .select("id, consumer_id, creator_id, reserved_at")
    .eq("status", "confirmed")
    .gte("reserved_at", windowStart)
    .lte("reserved_at", windowEnd)
    .is("reminded_at", null);

  if (error || !reservations || reservations.length === 0) {
    return NextResponse.json({ reminded: 0 });
  }

  let reminded = 0;

  for (const res of reservations) {
    const reservedTime = new Date(res.reserved_at).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await sendPushToUsers(admin, [res.consumer_id, res.creator_id], {
      title: "📅 통화 10분 전입니다",
      body: `${reservedTime} 예약 통화가 10분 후 시작됩니다.`,
    });

    await admin
      .from("reservations")
      .update({ reminded_at: now.toISOString() })
      .eq("id", res.id);

    reminded++;
  }

  return NextResponse.json({ reminded });
}
