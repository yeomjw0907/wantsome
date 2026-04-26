import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Vercel Cron 호출 인증
 *
 * 보안 정책 (fail-closed + timing-safe):
 *  - CRON_SECRET 미설정 또는 32자 미만 → 500 (.env.example는 64자 hex 권장)
 *  - timingSafeEqual로 비교 (timing attack 방어)
 *  - undefined 시 우회 차단
 *
 * 사용:
 *   export async function GET(req: NextRequest) {
 *     const unauthorized = assertCronSecret(req);
 *     if (unauthorized) return unauthorized;
 *     // ... cron logic
 *   }
 */
export function assertCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    console.error("[cronAuth] CRON_SECRET not configured or too short (< 32 chars)");
    return NextResponse.json(
      { message: "Server misconfigured" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader.length !== expected.length) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Timing-safe comparison
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return null;
}
