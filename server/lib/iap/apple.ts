/**
 * Apple App Store Server API 영수증 검증
 *
 * docs:
 *  - https://developer.apple.com/documentation/appstoreserverapi
 *  - https://github.com/apple/app-store-server-library-node
 *
 * 환경변수:
 *  - APPLE_ISSUER_ID    (App Store Connect → Users and Access → Integrations → Issuer ID)
 *  - APPLE_KEY_ID       (API Key의 Key ID)
 *  - APPLE_PRIVATE_KEY  (.p8 파일 PEM 내용, 줄바꿈 \n)
 *  - APPLE_BUNDLE_ID    (예: kr.wantsome.app)
 *  - APPLE_ENVIRONMENT  (Production | Sandbox)
 */

// 동적 import — 라이브러리 미설치 환경에서도 모듈 로드는 가능하게
type AppleClientModule = typeof import("@apple/app-store-server-library");

let _module: AppleClientModule | null = null;
async function loadAppleLib(): Promise<AppleClientModule | null> {
  if (_module) return _module;
  try {
    _module = await import("@apple/app-store-server-library");
    return _module;
  } catch {
    return null;
  }
}

export type AppleVerifyResult =
  | { ok: true; productId: string; transactionId: string; environment: string; bundleId: string }
  | { ok: false; reason: string };

/**
 * transactionId로 Apple App Store Server API에 transaction 조회 + 검증
 *
 * @param transactionId  expo-iap의 purchase.transactionId
 * @param expectedStoreId  PRODUCTS에서 매핑한 storeId (예: kr.wantsome.app.point_5500)
 */
export async function verifyAppleTransaction(
  transactionId: string,
  expectedStoreId: string,
): Promise<AppleVerifyResult> {
  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const bundleId = process.env.APPLE_BUNDLE_ID;
  const envName = (process.env.APPLE_ENVIRONMENT || "Production").toLowerCase();

  if (!issuerId || !keyId || !privateKey || !bundleId) {
    return { ok: false, reason: "Apple IAP credentials not configured" };
  }

  const lib = await loadAppleLib();
  if (!lib) {
    return { ok: false, reason: "@apple/app-store-server-library not installed" };
  }

  const { AppStoreServerAPIClient, Environment } = lib;
  const env = envName === "sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;

  try {
    // .p8 PEM은 \n 이스케이프되어 들어올 수 있으니 복원
    const normalizedKey = privateKey.replace(/\\n/g, "\n");

    const client = new AppStoreServerAPIClient(
      normalizedKey,
      keyId,
      issuerId,
      bundleId,
      env,
    );

    // Apple API 호출 — 응답 자체가 Apple 서버에서 TLS로 직접 옴
    const response = (await (client as unknown as {
      getTransactionInfo: (id: string) => Promise<{ signedTransactionInfo?: string }>;
    }).getTransactionInfo(transactionId));

    const jws = response?.signedTransactionInfo;
    if (!jws) {
      return { ok: false, reason: "Empty signedTransactionInfo from Apple" };
    }

    const payload = decodeJwsPayload(jws);
    if (!payload) {
      return { ok: false, reason: "Failed to decode JWS payload" };
    }

    // 핵심 검증 항목
    if (payload.bundleId !== bundleId) {
      return { ok: false, reason: `bundleId mismatch: ${payload.bundleId} vs ${bundleId}` };
    }
    if (payload.productId !== expectedStoreId) {
      return { ok: false, reason: `productId mismatch: ${payload.productId} vs ${expectedStoreId}` };
    }
    if (payload.transactionId !== transactionId && payload.originalTransactionId !== transactionId) {
      return { ok: false, reason: "transactionId mismatch" };
    }
    // 환불·취소 등 비정상 종료 검사
    if (payload.revocationDate || payload.revocationReason !== undefined) {
      return { ok: false, reason: "Transaction revoked" };
    }

    return {
      ok: true,
      productId: payload.productId,
      transactionId: payload.transactionId ?? transactionId,
      environment: payload.environment ?? envName,
      bundleId: payload.bundleId,
    };
  } catch (err) {
    return { ok: false, reason: `Apple API error: ${(err as Error).message}` };
  }
}

/**
 * JWS Compact Serialization 의 payload 부분만 디코드 (서명 검증 X)
 * Apple API의 직접 응답은 TLS로 신뢰 가능하므로 payload만 추출.
 * (Server-to-Server Notification은 별도 webhook에서 SignedDataVerifier로 서명 검증)
 */
function decodeJwsPayload(jws: string): {
  bundleId?: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  environment?: string;
  revocationDate?: number;
  revocationReason?: number;
  type?: string;
  inAppOwnershipType?: string;
  purchaseDate?: number;
} | null {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}
