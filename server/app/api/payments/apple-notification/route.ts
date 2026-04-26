/**
 * Apple App Store Server Notification V2 webhook
 *
 * App Store Connect → 앱 정보 → URL → "Server-to-Server Notifications V2"
 * 에 본 엔드포인트 URL 등록:
 *   https://api.wantsome.kr/api/payments/apple-notification
 *
 * 보안 정책 (FAIL-CLOSED — 재검수 결과 반영):
 *  - APPLE_ROOT_CAS_PEM / @apple/app-store-server-library / APPLE_BUNDLE_ID
 *    하나라도 미설정 → 503. payload 디코드·DB 쓰기·로그 일체 안 함.
 *  - 서명 검증 실패 → 401. payload 디코드·DB 쓰기·로그 일체 안 함.
 *    (admin_logs.target_id가 attacker-controlled 입력으로 오염되는 것 방지)
 *  - 서명 검증 성공 시에만 환불 마킹 + admin_logs 기록.
 *
 * Apple은 webhook 실패 시 재시도하므로 503/401 반환은 안전.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AppleLib = typeof import("@apple/app-store-server-library");
let _appleLib: AppleLib | null = null;
async function loadAppleLib(): Promise<AppleLib | null> {
  if (_appleLib) return _appleLib;
  try {
    _appleLib = await import("@apple/app-store-server-library");
    return _appleLib;
  } catch {
    return null;
  }
}

function loadAppleRootCAs(): Buffer[] | null {
  const pemBundle = process.env.APPLE_ROOT_CAS_PEM;
  if (!pemBundle) return null;
  const matches = pemBundle.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!matches || matches.length === 0) return null;
  return matches.map((pem) => Buffer.from(pem, "utf8"));
}

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

  // ────────────────────────────────────────────────────────────
  // FAIL-CLOSED 1단계: env 미설정이면 즉시 503 (디코드·로그 안 함)
  // ────────────────────────────────────────────────────────────
  const rootCAs = loadAppleRootCAs();
  const lib = await loadAppleLib();
  const expectedBundleId = process.env.APPLE_BUNDLE_ID;
  const envName = (process.env.APPLE_ENVIRONMENT || "Production").toLowerCase();

  if (!rootCAs || !lib || !expectedBundleId) {
    return NextResponse.json(
      { message: "Webhook signature verification not configured" },
      { status: 503 },
    );
  }

  // ────────────────────────────────────────────────────────────
  // FAIL-CLOSED 2단계: 서명 검증 실패하면 401 (디코드 안 함)
  // ────────────────────────────────────────────────────────────
  let notification: AppleNotificationPayload;
  try {
    const env = envName === "sandbox" ? lib.Environment.SANDBOX : lib.Environment.PRODUCTION;
    const verifier = new lib.SignedDataVerifier(
      rootCAs,
      true, // enableOnlineChecks (OCSP)
      env,
      expectedBundleId,
      undefined,
    );
    notification = await (verifier as unknown as {
      verifyAndDecodeNotification: (p: string) => Promise<AppleNotificationPayload>;
    }).verifyAndDecodeNotification(signedPayload);
  } catch (err) {
    return NextResponse.json(
      { message: "Signature verification failed", detail: (err as Error).message },
      { status: 401 },
    );
  }

  if (notification.data?.bundleId !== expectedBundleId) {
    return NextResponse.json({ message: "bundleId mismatch" }, { status: 400 });
  }

  // signedTransactionInfo도 JWS — 같은 verifier로 검증
  let txInfo: AppleTransactionPayload | null = null;
  if (notification.data?.signedTransactionInfo) {
    try {
      const env = envName === "sandbox" ? lib.Environment.SANDBOX : lib.Environment.PRODUCTION;
      const txVerifier = new lib.SignedDataVerifier(
        rootCAs,
        true,
        env,
        expectedBundleId,
        undefined,
      );
      txInfo = await (txVerifier as unknown as {
        verifyAndDecodeTransaction: (p: string) => Promise<AppleTransactionPayload>;
      }).verifyAndDecodeTransaction(notification.data.signedTransactionInfo);
    } catch {
      // verified notification 안의 tx info 검증 실패는 비정상이지만 상위 notification은 신뢰 가능
      txInfo = null;
    }
  }

  const notificationType = notification.notificationType ?? "UNKNOWN";
  const subtype = notification.subtype ?? null;
  const transactionId = txInfo?.transactionId ?? null;
  const originalTransactionId = txInfo?.originalTransactionId ?? null;
  const productId = txInfo?.productId ?? null;

  const admin = createSupabaseAdmin();

  // 환불·취소·만료 류 status 마크 — 검증 통과한 webhook만 진입
  // verify-iap는 transactionId를 iap_receipt로 저장하지만 안전을 위해
  // originalTransactionId도 OR-매칭하여 갱신 (구독 도입 대비)
  if (isRefundOrRevoke(notificationType, subtype) && (transactionId || originalTransactionId)) {
    const candidates = [transactionId, originalTransactionId].filter(Boolean) as string[];
    const { data: updated, error: updErr } = await admin
      .from("point_charges")
      .update({ status: "REFUNDED" })
      .in("iap_receipt", candidates)
      .neq("status", "REFUNDED")
      .select("id");

    if (updErr || !updated || updated.length === 0) {
      // 매칭 row 없음 — 이미 REFUNDED이거나 transaction을 모르는 경우
      // 운영 가시성을 위해 별도 액션으로 로그
      await admin
        .from("admin_logs")
        .insert({
          action: "APPLE_REFUND_NO_MATCH",
          target_type: "iap",
          target_id: transactionId ?? originalTransactionId,
          detail: { notificationType, subtype, transactionId, originalTransactionId, productId },
        })
        .then(null, () => null);
    }
  }

  await admin
    .from("admin_logs")
    .insert({
      action: "APPLE_NOTIFICATION",
      target_type: "iap",
      target_id: transactionId,
      detail: {
        verified: true,
        notificationType,
        subtype,
        transactionId,
        originalTransactionId,
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
  if (type === "DID_FAIL_TO_RENEW") return false;
  // CONSUMPTION_REQUEST는 환불 알림이 아니라 Apple이 판매자에게 사용 데이터 제공을 요청하는 알림.
  // 별도 응답 API(sendConsumptionInformation)로 처리해야 하며, 여기서 REFUNDED 마킹하면 안 됨.
  if (type === "EXPIRED" && subtype === "VOLUNTARY") return true;
  return false;
}
