import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getLiveConfig } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const config = await getLiveConfig();
  const now = new Date();
  const ackCutoff = new Date(now.getTime() - config.joinAckTimeoutSec * 1000).toISOString();

  let refunded = 0;
  let autoEnded = 0;

  const { data: pendingAcks } = await admin
    .from("live_room_participants")
    .select("room_id, user_id, paid_points, joined_at")
    .eq("role", "viewer")
    .eq("status", "joined")
    .eq("refund_status", "none")
    .is("join_ack_at", null)
    .lt("joined_at", ackCutoff);

  for (const participant of pendingAcks ?? []) {
    if ((participant.paid_points ?? 0) > 0) {
      const { data: userRow } = await admin
        .from("users")
        .select("points")
        .eq("id", participant.user_id)
        .single();

      await admin
        .from("users")
        .update({ points: (userRow?.points ?? 0) + participant.paid_points })
        .eq("id", participant.user_id);
    }

    await admin
      .from("live_room_participants")
      .update({
        status: "left",
        left_at: now.toISOString(),
        refund_status: "refunded",
      })
      .eq("room_id", participant.room_id)
      .eq("user_id", participant.user_id);

    refunded++;
  }

  const { data: expiredRooms } = await admin
    .from("live_rooms")
    .select("id, host_id")
    .eq("status", "live")
    .lt("scheduled_end_at", now.toISOString());

  for (const room of expiredRooms ?? []) {
    await admin.from("live_rooms").update({
      status: "ended",
      ended_at: now.toISOString(),
    }).eq("id", room.id);

    await admin.from("creators").update({ is_live_now: false }).eq("id", room.host_id);
    await admin
      .from("live_room_participants")
      .update({ status: "left", left_at: now.toISOString() })
      .eq("room_id", room.id)
      .eq("status", "joined");

    autoEnded++;
  }

  return NextResponse.json({ refunded, auto_ended: autoEnded });
}
