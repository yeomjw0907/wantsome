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
 * 보안 정책 (FAIL-CLOSED — 재검수 결과 반영):
 *  - GOOGLE_RTDN_AUDIENCE 미설정 / google-auth-library 미설치 → 503
 *  - OIDC 토큰 누락 / 서명 검증 실패 / issuer/email 불일치 → 401
 *  - Pub/Sub은 401/503 반환 시 자동 재시도하므로 안전
 *  - 검증 통과 시에만 payload 디코드 + 환불 마킹 + admin_logs 기록
 *    (admin_logs.target_id가 attacker-controlled 입력으로 오염되는 것 방지)
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
  const expectedAudience = process.env.GOOGLE_RTDN_AUDIENCE;
  const expectedSenderEmail = process.env.GOOGLE_RTDN_SENDER_EMAIL; // optional
  const lib = await loadGoogleAuth();

  // ────────────────────────────────────────────────────────────
  // FAIL-CLOSED 1단계: env/lib 미설정이면 즉시 503
  // ────────────────────────────────────────────────────────────
  if (!expectedAudience || !lib) {
    return NextResponse.json(
      { message: "Webhook OIDC verification not configured" },
      { status: 503 },
    );
  }

  // ────────────────────────────────────────────────────────────
  // FAIL-CLOSED 2단계: OIDC 토큰 검증 실패하면 401 (디코드·DB 쓰기 안 함)
  // ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const oidcToken = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  if (!oidcToken) {
    return NextResponse.json({ message: "Missing Authorization Bearer token" }, { status: 401 });
  }

  try {
    const oauth = new lib.OAuth2Client();
    const ticket = await oauth.verifyIdToken({
      idToken: oidcToken,
      audience: expectedAudience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json({ message: "Empty OIDC payload" }, { status: 401 });
    }
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      return NextResponse.json({ message: `Invalid issuer: ${payload.iss}` }, { status: 401 });
    }
    if (expectedSenderEmail && payload.email !== expectedSenderEmail) {
      return NextResponse.json({ message: "Unexpected sender" }, { status: 401 });
    }
    if (!payload.email_verified) {
      return NextResponse.json({ message: "Sender email not verified" }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json(
      { message: `OIDC verify error: ${(err as Error).message}` },
      { status: 401 },
    );
  }

  // ────────────────────────────────────────────────────────────
  // 검증 통과 — 이제 payload 디코드 + DB 쓰기
  // ────────────────────────────────────────────────────────────
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

  if (purchaseTokenForRefund) {
    const { data: updated, error: updErr } = await admin
      .from("point_charges")
      .update({ status: "REFUNDED" })
      .eq("iap_receipt", purchaseTokenForRefund)
      .neq("status", "REFUNDED")
      .select("id");

    if (updErr || !updated || updated.length === 0) {
      await admin
        .from("admin_logs")
        .insert({
          action: "GOOGLE_REFUND_NO_MATCH",
          target_type: "iap",
          target_id: purchaseTokenForRefund,
          detail: { action, packageName: payload.packageName },
        })
        .then(null, () => null);
    }
  }

  await admin
    .from("admin_logs")
    .insert({
      action,
      target_type: "iap",
      target_id: purchaseTokenForRefund,
      detail: {
        verified: true,
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
