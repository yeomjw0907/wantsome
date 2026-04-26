/**
 * Apple App Store Server Notification V2 webhook
 *
 * App Store Connect → 앱 정보 → URL → "Server-to-Server Notifications V2"
 * 에 본 엔드포인트 URL 등록:
 *   https://api.wantsome.kr/api/payments/apple-notification
 *
 * 보안 정책 (fail-closed):
 *  - APPLE_ROOT_CAS_PEM 환경변수에 Apple Root CA 인증서들 concat 시
 *    SignedDataVerifier로 정식 서명 검증
 *  - 미설정 시: payload 디코드까진 하지만 point_charges.status 마킹은 skip
 *    + admin_logs에 'APPLE_NOTIFICATION_UNVERIFIED' 기록 (위조 가능 입력은 신뢰 X)
 *
 * 자동 포인트 회수 (사용 안 한 잔액 차감)는 별도 PR.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 동적 import — 라이브러리 미설치 환경에서도 모듈 로드는 가능하게
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

/** Apple Root CA 인증서를 환경변수에서 로드 (PEM 형식 concat) */
function loadAppleRootCAs(): Buffer[] | null {
  const pemBundle = process.env.APPLE_ROOT_CAS_PEM;
  if (!pemBundle) return null;
  // -----BEGIN CERTIFICATE----- ... -----END CERTIFICATE----- 단위로 분리
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
  // 1) Apple Root CA로 SignedDataVerifier 정식 검증 시도
  // 2) 실패/미설정 → unverified 모드 (status 마킹 안 함)
  // ────────────────────────────────────────────────────────────
  let verifiedNotification: AppleNotificationPayload | null = null;
  let verified = false;
  let verifyError: string | null = null;

  const rootCAs = loadAppleRootCAs();
  const lib = await loadAppleLib();
  const expectedBundleId = process.env.APPLE_BUNDLE_ID;
  const envName = (process.env.APPLE_ENVIRONMENT || "Production").toLowerCase();

  if (rootCAs && lib && expectedBundleId) {
    try {
      const env = envName === "sandbox" ? lib.Environment.SANDBOX : lib.Environment.PRODUCTION;
      const verifier = new lib.SignedDataVerifier(
        rootCAs,
        true, // enableOnlineChecks (OCSP)
        env,
        expectedBundleId,
        undefined,
      );
      verifiedNotification = (await (verifier as unknown as {
        verifyAndDecodeNotification: (p: string) => Promise<AppleNotificationPayload>;
      }).verifyAndDecodeNotification(signedPayload));
      verified = true;
    } catch (err) {
      verifyError = (err as Error).message;
    }
  }

  // 검증 실패 또는 cert 미설정 시 payload 디코드 fallback (마킹은 skip)
  const notification =
    verifiedNotification ?? decodeJwsPayload<AppleNotificationPayload>(signedPayload);

  if (!notification) {
    return NextResponse.json({ message: "Invalid notification JWS" }, { status: 400 });
  }

  if (expectedBundleId && notification.data?.bundleId !== expectedBundleId) {
    return NextResponse.json({ message: "bundleId mismatch" }, { status: 400 });
  }

  // signedTransactionInfo도 JWS (위 verifier 결과의 transaction info는 이미 검증됨)
  const txInfo = notification.data?.signedTransactionInfo
    ? decodeJwsPayload<AppleTransactionPayload>(notification.data.signedTransactionInfo)
    : null;

  const notificationType = notification.notificationType ?? "UNKNOWN";
  const subtype = notification.subtype ?? null;
  const transactionId = txInfo?.transactionId ?? txInfo?.originalTransactionId ?? null;
  const productId = txInfo?.productId ?? null;

  const admin = createSupabaseAdmin();

  // 환불·취소·만료 류 status 마크 — 검증된 webhook에 한해서만
  // 멱등성: 이미 REFUNDED 상태인 row는 재마킹 안 함 (webhook 반복 POST 방어)
  if (verified && transactionId && isRefundOrRevoke(notificationType, subtype)) {
    await admin
      .from("point_charges")
      .update({ status: "REFUNDED" })
      .eq("iap_receipt", transactionId)
      .neq("status", "REFUNDED");
  }

  // 운영 로그 (verified / unverified 구분)
  await admin
    .from("admin_logs")
    .insert({
      action: verified ? "APPLE_NOTIFICATION" : "APPLE_NOTIFICATION_UNVERIFIED",
      target_type: "iap",
      target_id: transactionId,
      detail: {
        verified,
        verifyError,
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
