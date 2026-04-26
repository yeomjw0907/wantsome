/**
 * GET /api/reservations/noshow
 * Vercel Cron — 매 분 실행
 *
 * 처리 내용:
 * 1. 예약 시간 + 10분 경과한 confirmed 예약 → 노쇼 처리
 *    - consumer_ready_at IS NULL → 소비자 노쇼 (크리에이터 50% 보상)
 *    - consumer_ready_at IS NOT NULL AND creator_ready_at IS NULL → 크리에이터 노쇼 (소비자 전액 환불 + noshow_count++)
 *    - 둘 다 NOT NULL → 양측 준비 완료 (completed 처리, CS 안내)
 * 2. 예약 시간이 지난 pending 예약 → 자동 취소 + 전액 환불
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";
import { assertCronSecret } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = assertCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createSupabaseAdmin();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  // ─── ① confirmed 예약 노쇼 처리 ─────────────────────────────────────────
  const { data: noshows } = await admin
    .from("reservations")
    .select("id, consumer_id, creator_id, deposit_points, reserved_at, consumer_ready_at, creator_ready_at")
    .eq("status", "confirmed")
    .lt("reserved_at", cutoff);

  let noshowProcessed = 0;

  if (noshows && noshows.length > 0) {
    for (const res of noshows) {
      const consumerReady = !!res.consumer_ready_at;
      const creatorReady  = !!res.creator_ready_at;

      if (consumerReady && creatorReady) {
        // 양측 모두 준비완료 → completed (통화는 시작됐을 것, CS 안내)
        await admin
          .from("reservations")
          .update({ status: "completed" })
          .eq("id", res.id);

        await sendPushToUser(admin, res.consumer_id, {
          title: "예약이 완료됐습니다",
          body: "문제가 있으시면 고객센터로 문의해주세요.",
        });
        await sendPushToUser(admin, res.creator_id, {
          title: "예약이 완료됐습니다",
          body: "문제가 있으시면 고객센터로 문의해주세요.",
        });

      } else if (!consumerReady) {
        // 소비자 노쇼 (consumer_ready_at IS NULL)
        await admin
          .from("reservations")
          .update({ status: "noshow", noshow_at: now.toISOString() } as unknown as { status: string })
          .eq("id", res.id);

        // 크리에이터에게 예약금 50% 보상
        const compensation = Math.floor(res.deposit_points * 0.5);
        if (compensation > 0) {
          await admin.rpc("add_points", {
            p_user_id: res.creator_id,
            p_amount: compensation,
            p_reason: `noshow_compensation:${res.id}`,
          }).then(null, () => null);
        }

        await sendPushToUser(admin, res.consumer_id, {
          title: "예약 시간이 지났습니다",
          body: `예약금(${res.deposit_points.toLocaleString()}P)은 환불되지 않습니다.`,
        });
        await sendPushToUser(admin, res.creator_id, {
          title: "소비자가 나타나지 않았습니다",
          body: `예약금의 50%(${compensation.toLocaleString()}P)가 지급됩니다.`,
        });

      } else {
        // 크리에이터 노쇼 (consumer_ready_at IS NOT NULL, creator_ready_at IS NULL)
        await admin
          .from("reservations")
          .update({ status: "noshow", noshow_at: now.toISOString() } as unknown as { status: string })
          .eq("id", res.id);

        // 소비자 예약금 전액 환불
        await admin.rpc("add_points", {
          p_user_id: res.consumer_id,
          p_amount: res.deposit_points,
          p_reason: `creator_noshow_refund:${res.id}`,
        }).then(null, () => null);

        // 크리에이터 noshow_count 증가
        const { data: c } = await admin
          .from("creators")
          .select("noshow_count")
          .eq("id", res.creator_id)
          .single();
        if (c != null) {
          await admin
            .from("creators")
            .update({ noshow_count: (c.noshow_count ?? 0) + 1 })
            .eq("id", res.creator_id);
        }

        await sendPushToUser(admin, res.consumer_id, {
          title: "크리에이터가 나타나지 않았습니다",
          body: `예약금 ${res.deposit_points.toLocaleString()}P가 전액 환불됩니다.`,
        });
        await sendPushToUser(admin, res.creator_id, {
          title: "예약에 나타나지 않아 노쇼 처리됐습니다",
          body: "노쇼 기록이 누적되면 계정 제재를 받을 수 있습니다.",
        });
      }

      noshowProcessed++;
    }
  }

  // ─── ② pending 예약 만료 자동 취소 ──────────────────────────────────────
  const { data: expiredPending } = await admin
    .from("reservations")
    .select("id, consumer_id, creator_id, deposit_points")
    .eq("status", "pending")
    .lt("reserved_at", now.toISOString());

  let pendingCancelled = 0;

  if (expiredPending && expiredPending.length > 0) {
    for (const res of expiredPending) {
      await admin
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", res.id);

      // 소비자 예약금 전액 환불 (크리에이터가 수락하지 않은 경우)
      await admin.rpc("add_points", {
        p_user_id: res.consumer_id,
        p_amount: res.deposit_points,
        p_reason: `pending_expired_refund:${res.id}`,
      }).then(null, () => null);

      await sendPushToUser(admin, res.consumer_id, {
        title: "예약이 자동 취소됐습니다",
        body: `크리에이터가 예약을 확인하지 않아 자동 취소됐습니다. 예약금 ${res.deposit_points.toLocaleString()}P가 환불됩니다.`,
      });
      await sendPushToUser(admin, res.creator_id, {
        title: "미확인 예약이 자동 취소됐습니다",
        body: "수락하지 않은 예약이 예약 시간 초과로 자동 취소됐습니다.",
      });

      pendingCancelled++;
    }
  }

  // ─── ③ 예약 15분 전 오버런 알림 ─────────────────────────────────────────
  const remindFrom = now.toISOString();
  const remindTo = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  const { data: upcoming } = await admin
    .from("reservations")
    .select("id, consumer_id, creator_id, reserved_at, reminder_sent_at")
    .eq("status", "confirmed")
    .gte("reserved_at", remindFrom)
    .lte("reserved_at", remindTo)
    .is("reminder_sent_at", null);

  let remindSent = 0;

  if (upcoming && upcoming.length > 0) {
    for (const res of upcoming) {
      // reminder_sent_at 먼저 기록 (중복 방지)
      await admin
        .from("reservations")
        .update({ reminder_sent_at: now.toISOString() } as unknown as { status: string })
        .eq("id", res.id);

      // 크리에이터 is_busy 확인
      const { data: creator } = await admin
        .from("creators")
        .select("is_busy")
        .eq("id", res.creator_id)
        .single();

      const isBusy = creator?.is_busy ?? false;

      // 소비자 알림
      await sendPushToUser(admin, res.consumer_id, {
        title: "예약 통화 15분 전 안내 📅",
        body: isBusy
          ? "크리에이터가 현재 통화 중입니다. 잠시 후 준비완료 버튼을 눌러주세요."
          : "15분 후 예약 통화가 시작됩니다. 준비완료 버튼을 눌러주세요.",
      });

      // 크리에이터 알림 (통화 중이면 경고 포함)
      await sendPushToUser(admin, res.creator_id, {
        title: isBusy ? "⚠️ 15분 후 예약이 있습니다!" : "예약 통화 15분 전입니다 📅",
        body: isBusy
          ? "현재 통화를 마무리하고 예약 통화를 준비해주세요."
          : "소비자가 연결을 기다리고 있습니다.",
      });

      remindSent++;
    }
  }

  return NextResponse.json({
    noshow_processed: noshowProcessed,
    pending_cancelled: pendingCancelled,
    reminders_sent: remindSent,
  });
}
