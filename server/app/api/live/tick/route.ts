import { NextRequest, NextResponse } from "next/server";
import { shouldRefundPendingAck } from "@/lib/liveRuntime";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getLiveConfig } from "@/lib/live";
import { logger } from "@/lib/logger";
import { assertCronSecret } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauthorized = assertCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createSupabaseAdmin();
  const config = await getLiveConfig();
  const now = new Date();
  const ackCutoff = new Date(now.getTime() - config.joinAckTimeoutSec * 1000).toISOString();

  let refunded = 0;
  let refund_failed = 0;
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
    if (!shouldRefundPendingAck({
      role: "viewer",
      status: "joined",
      refund_status: "none",
      join_ack_at: null,
      joined_at: participant.joined_at,
      ackCutoffIso: ackCutoff,
    })) {
      continue;
    }

    if ((participant.paid_points ?? 0) > 0) {
      const { error: refundError } = await admin.rpc("increment_user_points", {
        p_user_id: participant.user_id,
        p_amount: participant.paid_points,
      });

      if (refundError) {
        logger.error("live tick refund failed", {
          roomId: participant.room_id,
          userId: participant.user_id,
          points: participant.paid_points,
          error: refundError.message,
        });
        refund_failed++;
        continue;
      }
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

  return NextResponse.json({ refunded, refund_failed, auto_ended: autoEnded });
}
