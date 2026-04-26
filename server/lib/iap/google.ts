/**
 * Google Play Developer API 영수증 검증
 *
 * docs:
 *  - https://developer.android.com/google/play/developer-api
 *  - https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
 *
 * 환경변수:
 *  - GOOGLE_PACKAGE_NAME           (예: kr.wantsome.app)
 *  - GOOGLE_SERVICE_ACCOUNT_JSON   (Service Account JSON 전체)
 */

// 동적 import (라이브러리 미설치 환경 보호)
type GoogleAuthModule = typeof import("google-auth-library");
let _googleAuthModule: GoogleAuthModule | null = null;
async function loadGoogleAuth(): Promise<GoogleAuthModule | null> {
  if (_googleAuthModule) return _googleAuthModule;
  try {
    _googleAuthModule = await import("google-auth-library");
    return _googleAuthModule;
  } catch {
    return null;
  }
}

export type GoogleVerifyResult =
  | { ok: true; orderId: string; purchaseTimeMillis: string; productId: string }
  | { ok: false; reason: string };

/**
 * purchaseToken 으로 Google Play Developer API에 product 구매 조회 + 검증
 *
 * @param purchaseToken  expo-iap의 purchase.purchaseToken (Android)
 * @param expectedStoreId  PRODUCTS에서 매핑한 storeId (예: kr.wantsome.app.point_5500)
 */
export async function verifyGooglePurchase(
  purchaseToken: string,
  expectedStoreId: string,
): Promise<GoogleVerifyResult> {
  const packageName = process.env.GOOGLE_PACKAGE_NAME;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!packageName || !serviceAccountJson) {
    return { ok: false, reason: "Google IAP credentials not configured" };
  }

  const lib = await loadGoogleAuth();
  if (!lib) {
    return { ok: false, reason: "google-auth-library not installed" };
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch (err) {
    return { ok: false, reason: `Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${(err as Error).message}` };
  }

  if (!credentials.client_email || !credentials.private_key) {
    return { ok: false, reason: "Service account JSON missing client_email/private_key" };
  }

  try {
    const auth = new lib.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      return { ok: false, reason: "Failed to get Google access token" };
    }

    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(packageName)}/purchases/products/` +
      `${encodeURIComponent(expectedStoreId)}/tokens/${encodeURIComponent(purchaseToken)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Google API ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      orderId?: string;
      purchaseTimeMillis?: string;
      // 0 = Purchased, 1 = Cancelled, 2 = Pending
      purchaseState?: number;
      // 0 = Yet to be acknowledged, 1 = Acknowledged
      acknowledgementState?: number;
      // 0 = Test, 1 = Promo, 2 = Rewarded
      purchaseType?: number;
      regionCode?: string;
    };

    if (data.purchaseState !== 0) {
      return { ok: false, reason: `Invalid purchaseState: ${data.purchaseState}` };
    }
    // 테스트/프로모 결제는 거절 (실제 매출 외)
    if (data.purchaseType !== undefined && data.purchaseType !== null) {
      return { ok: false, reason: `Non-real purchase (purchaseType ${data.purchaseType})` };
    }

    return {
      ok: true,
      orderId: data.orderId ?? "",
      purchaseTimeMillis: data.purchaseTimeMillis ?? "",
      productId: expectedStoreId,
    };
  } catch (err) {
    return { ok: false, reason: `Google verify error: ${(err as Error).message}` };
  }
}
