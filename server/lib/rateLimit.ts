import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * 레이트 리밋 체크
 * @param key      식별 키 (예: "iap:user_id", "call_start:user_id")
 * @param limit    윈도우 내 최대 허용 횟수
 * @param windowSec 윈도우 크기 (초)
 * @returns true = 허용, false = 차단
 *
 * 정책: fail-closed
 *  - DB 오류 / 예외 → false (차단)
 *  - 결제·인증 등 critical 경로에서 fail-open이면 무제한 호출 가능 (자금 손실)
 *  - 운영 모니터링: rate_limits 테이블 INSERT 실패율 알림
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSec,
    });
    if (error) {
      console.error("[rateLimit] check_rate_limit RPC error:", error);
      return false; // fail-closed
    }
    return data === true;
  } catch (err) {
    console.error("[rateLimit] check_rate_limit exception:", err);
    return false; // fail-closed
  }
}

/** 429 응답 반환 헬퍼 */
export function rateLimitExceeded(retryAfterSec = 60): NextResponse {
  return NextResponse.json(
    { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
