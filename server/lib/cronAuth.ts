import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel Cron 호출 인증
 *
 * 보안 정책 (fail-closed):
 *  - CRON_SECRET 미설정 시 즉시 500 반환 (env 누락으로 인한 우회 차단)
 *    예전 패턴: `Bearer ${process.env.CRON_SECRET}` → undefined 시 "Bearer undefined"
 *    공격자가 Authorization: Bearer undefined 보내면 통과되던 버그
 *  - CRON_SECRET 길이 16자 미만 거절 (너무 약한 시크릿)
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
  if (!secret || secret.length < 16) {
    console.error("[cronAuth] CRON_SECRET not configured or too short (< 16 chars)");
    return NextResponse.json(
      { message: "Server misconfigured" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return null;
}
