/**
 * Google Play Real-Time Developer Notifications (RTDN) webhook
 *
 * Setup:
 *  1) Google Cloud Pub/Sub topic 생성 (예: wantsome-rtdn)
 *  2) Pub/Sub push subscription 생성:
 *     - Endpoint: https://api.wantsome.kr/api/payments/google-rtdn
 *     - Authentication: 서비스 계정 + OIDC token (audience = endpoint URL)
 *  3) Play Console → 앱 → Monetize setup → RTDN 에 topic 등록
 *
 * 처리 범위 (현재 PR):
 *  - Pub/Sub envelope 디코드
 *  - subscription/oneTimeProductNotification 분류
 *  - point_charges.status 마크 (REFUND, REVOKE)
 *  - admin_logs 기록
 *
 * 자동 포인트 회수는 별도 PR (현재는 status 마크 + 운영 알림).
 *
 * ⚠️ Pub/Sub OIDC token 검증은 후속 PR에서 추가
 *    (Authorization: Bearer <JWT> 헤더 audience/issuer 검증)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PubSubEnvelope = {
  message?: {
    data?: string; // base64
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};

type RtdnPayload = {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  oneTimeProductNotification?: {
    version?: string;
    notificationType?: number; // 1 = PURCHASED, 2 = CANCELED
    purchaseToken?: string;
    sku?: string;
  };
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  voidedPurchaseNotification?: {
    purchaseToken?: string;
    orderId?: string;
    productType?: number; // 1 = subscription, 2 = one-time
    refundType?: number;  // 1 = full, 2 = quantity-based
  };
  testNotification?: { version?: string };
};

export async function POST(req: NextRequest) {
  let envelope: PubSubEnvelope;
  try {
    envelope = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const data = envelope.message?.data;
  if (!data) {
    return NextResponse.json({ message: "Missing message.data" }, { status: 400 });
  }

  let payload: RtdnPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch (err) {
    return NextResponse.json(
      { message: `Invalid base64/JSON: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const expectedPackage = process.env.GOOGLE_PACKAGE_NAME;
  if (expectedPackage && payload.packageName && payload.packageName !== expectedPackage) {
    return NextResponse.json({ message: "packageName mismatch" }, { status: 400 });
  }

  if (payload.testNotification) {
    return NextResponse.json({ ok: true, test: true });
  }

  const admin = createSupabaseAdmin();

  // 환불 알림: voidedPurchaseNotification 또는 oneTimeProductNotification.notificationType=2 (CANCELED)
  let purchaseTokenForRefund: string | null = null;
  let action = "GOOGLE_RTDN";

  if (payload.voidedPurchaseNotification?.purchaseToken) {
    purchaseTokenForRefund = payload.voidedPurchaseNotification.purchaseToken;
    action = "GOOGLE_RTDN_VOIDED";
  } else if (
    payload.oneTimeProductNotification?.notificationType === 2 &&
    payload.oneTimeProductNotification?.purchaseToken
  ) {
    purchaseTokenForRefund = payload.oneTimeProductNotification.purchaseToken;
    action = "GOOGLE_RTDN_CANCELED";
  }

  // ⚠️ 컬럼명: 002 스키마에서 `iap_receipt` (017 RPC가 p_purchase_token을 이 컬럼에 저장)
  // 멱등성: 이미 REFUNDED 상태인 row는 재마킹 안 함 (Pub/Sub at-least-once 방어)
  if (purchaseTokenForRefund) {
    await admin
      .from("point_charges")
      .update({ status: "REFUNDED" })
      .eq("iap_receipt", purchaseTokenForRefund)
      .neq("status", "REFUNDED");
  }

  // 운영 로그
  await admin
    .from("admin_logs")
    .insert({
      action,
      target_type: "iap",
      target_id: purchaseTokenForRefund,
      detail: {
        packageName: payload.packageName,
        eventTimeMillis: payload.eventTimeMillis,
        oneTimeProductNotification: payload.oneTimeProductNotification,
        voidedPurchaseNotification: payload.voidedPurchaseNotification,
        subscriptionNotification: payload.subscriptionNotification,
        messageId: envelope.message?.messageId,
      },
    })
    .then(null, () => null);

  return NextResponse.json({ ok: true });
}
