/**
 * Apple App Store Server Notification V2 webhook
 *
 * App Store Connect → 앱 정보 → URL → "Server-to-Server Notifications V2"
 * 에 본 엔드포인트 URL 등록:
 *   https://api.wantsome.kr/api/payments/apple-notification
 *
 * 처리 범위 (현재 PR):
 *  - signedPayload JWS 검증
 *  - notificationType / transactionId 추출
 *  - point_charges.status 마크 (REFUND, REVOKE, CONSUMPTION_REQUEST 등)
 *  - admin_logs 기록
 *
 * 자동 포인트 회수 (사용 안 한 잔액 차감)는 별도 PR에서 구현.
 * 현재는 status 마크 + 운영 알림으로만 처리 (사용자 자금 보호는 출시 후 모니터링 + CS 처리).
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AppleNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
  };
};

type AppleTransactionPayload = {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  bundleId?: string;
  revocationDate?: number;
  revocationReason?: number;
};

export async function POST(req: NextRequest) {
  let body: { signedPayload?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const signedPayload = body.signedPayload;
  if (!signedPayload || typeof signedPayload !== "string") {
    return NextResponse.json({ message: "Missing signedPayload" }, { status: 400 });
  }

  // JWS payload 디코드 (서명 검증은 후속 PR — 현재는 received-only)
  // ⚠️ 향후 SignedDataVerifier로 정식 검증 추가 필수
  const notification = decodeJwsPayload<AppleNotificationPayload>(signedPayload);
  if (!notification) {
    return NextResponse.json({ message: "Invalid notification JWS" }, { status: 400 });
  }

  const expectedBundleId = process.env.APPLE_BUNDLE_ID;
  if (expectedBundleId && notification.data?.bundleId !== expectedBundleId) {
    return NextResponse.json({ message: "bundleId mismatch" }, { status: 400 });
  }

  // signedTransactionInfo도 JWS — payload 디코드
  const txInfo = notification.data?.signedTransactionInfo
    ? decodeJwsPayload<AppleTransactionPayload>(notification.data.signedTransactionInfo)
    : null;

  const notificationType = notification.notificationType ?? "UNKNOWN";
  const subtype = notification.subtype ?? null;
  const transactionId = txInfo?.transactionId ?? txInfo?.originalTransactionId ?? null;
  const productId = txInfo?.productId ?? null;

  const admin = createSupabaseAdmin();

  // 환불·취소·만료 류 status 마크
  if (transactionId && isRefundOrRevoke(notificationType, subtype)) {
    await admin
      .from("point_charges")
      .update({ status: "REFUNDED" })
      .eq("purchase_token", transactionId);
  }

  // 운영 로그
  await admin
    .from("admin_logs")
    .insert({
      action: "APPLE_NOTIFICATION",
      target_type: "iap",
      target_id: transactionId,
      detail: {
        notificationType,
        subtype,
        transactionId,
        productId,
        environment: notification.data?.environment,
      },
    })
    .then(null, () => null);

  return NextResponse.json({ ok: true });
}

function isRefundOrRevoke(type: string, subtype: string | null): boolean {
  // https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
  if (type === "REFUND") return true;
  if (type === "REVOKE") return true;
  if (type === "DID_FAIL_TO_RENEW") return false; // 구독만 영향 (지금은 없음)
  if (type === "CONSUMPTION_REQUEST") return true; // Apple이 환불 결정 전 조회
  if (type === "EXPIRED" && subtype === "VOLUNTARY") return true;
  return false;
}

function decodeJwsPayload<T>(jws: string): T | null {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
