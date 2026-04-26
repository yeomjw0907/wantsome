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
 * 보안 정책 (fail-closed):
 *  - GOOGLE_RTDN_AUDIENCE 환경변수 설정 시
 *    OAuth2Client.verifyIdToken(audience)로 정식 OIDC 검증
 *  - 미설정 시: payload 디코드까진 하지만 point_charges.status 마킹은 skip
 *    + admin_logs에 'GOOGLE_RTDN_UNVERIFIED' 기록 (위조 가능 입력은 신뢰 X)
 *
 * 자동 포인트 회수는 별도 PR.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 동적 import — 라이브러리 미설치 환경 보호
type GoogleAuthLib = typeof import("google-auth-library");
let _googleAuthLib: GoogleAuthLib | null = null;
async function loadGoogleAuth(): Promise<GoogleAuthLib | null> {
  if (_googleAuthLib) return _googleAuthLib;
  try {
    _googleAuthLib = await import("google-auth-library");
    return _googleAuthLib;
  } catch {
    return null;
  }
}

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
  // ────────────────────────────────────────────────────────────
  // 1) Pub/Sub OIDC token 검증 (Authorization: Bearer <JWT>)
  // 2) 검증 실패 / audience 미설정 → unverified 모드 (status 마킹 skip)
  // ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const oidcToken = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  const expectedAudience = process.env.GOOGLE_RTDN_AUDIENCE;
  const expectedSenderEmail = process.env.GOOGLE_RTDN_SENDER_EMAIL; // optional

  let verified = false;
  let verifyError: string | null = null;

  if (oidcToken && expectedAudience) {
    const lib = await loadGoogleAuth();
    if (!lib) {
      verifyError = "google-auth-library not installed";
    } else {
      try {
        const oauth = new lib.OAuth2Client();
        const ticket = await oauth.verifyIdToken({
          idToken: oidcToken,
          audience: expectedAudience,
        });
        const payload = ticket.getPayload();
        if (!payload) {
          verifyError = "Empty OIDC payload";
        } else if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
          verifyError = `Invalid issuer: ${payload.iss}`;
        } else if (expectedSenderEmail && payload.email !== expectedSenderEmail) {
          verifyError = `Unexpected sender: ${payload.email}`;
        } else if (!payload.email_verified) {
          verifyError = "Sender email not verified";
        } else {
          verified = true;
        }
      } catch (err) {
        verifyError = `OIDC verify error: ${(err as Error).message}`;
      }
    }
  } else if (!oidcToken) {
    verifyError = "Missing Authorization Bearer token";
  } else {
    verifyError = "GOOGLE_RTDN_AUDIENCE not configured";
  }

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

  // 컬럼명: 002 스키마에서 `iap_receipt`
  // 멱등성: 이미 REFUNDED 상태인 row는 재마킹 안 함 (Pub/Sub at-least-once 방어)
  // 검증되지 않은 webhook은 status 마킹 안 함 (외부 위조 방어)
  if (verified && purchaseTokenForRefund) {
    await admin
      .from("point_charges")
      .update({ status: "REFUNDED" })
      .eq("iap_receipt", purchaseTokenForRefund)
      .neq("status", "REFUNDED");
  }

  // 운영 로그 (verified / unverified 구분)
  await admin
    .from("admin_logs")
    .insert({
      action: verified ? action : `${action}_UNVERIFIED`,
      target_type: "iap",
      target_id: purchaseTokenForRefund,
      detail: {
        verified,
        verifyError,
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
