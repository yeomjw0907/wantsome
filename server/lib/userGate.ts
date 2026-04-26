/**
 * 사용자 게이트 헬퍼
 *
 * critical 경로(통화·라이브·선물·채팅·예약 등) 진입 전 검증:
 *  - 사용자 존재 + deleted_at 없음
 *  - suspended_until 미래 아님
 *  - birth_date 19세+ (KST 기준)
 *  - (옵션) is_verified=true (PortOne 본인인증 완료)
 *
 * 사용:
 *   import { assertUserGate } from "@/lib/userGate";
 *   const reject = await assertUserGate(admin, userId);
 *   if (reject) return reject;
 */

import { NextResponse } from "next/server";
import type { createSupabaseAdmin } from "@/lib/supabase";
import { calcAgeKST } from "@/lib/ageGate";

type AdminClient = ReturnType<typeof createSupabaseAdmin>;

export interface UserGateOptions {
  /** PortOne 본인인증 완료 강제 (기본 false — birth_date만 검증) */
  requireVerified?: boolean;
}

/**
 * 게이트 검사 — 통과 시 null, 실패 시 NextResponse 반환 (호출처가 그대로 return)
 */
export async function assertUserGate(
  admin: AdminClient,
  userId: string,
  options: UserGateOptions = {},
): Promise<NextResponse | null> {
  const { data: u } = await admin
    .from("users")
    .select("id, is_verified, birth_date, suspended_until, deleted_at")
    .eq("id", userId)
    .single();

  if (!u || u.deleted_at) {
    return NextResponse.json(
      { error: "USER_NOT_FOUND", message: "사용자를 찾을 수 없습니다" },
      { status: 404 },
    );
  }

  // 정지된 계정 차단
  if (u.suspended_until && new Date(u.suspended_until) > new Date()) {
    return NextResponse.json(
      { error: "SUSPENDED", message: "정지된 계정입니다", suspended_until: u.suspended_until },
      { status: 403 },
    );
  }

  // 1차 연령 게이트 — birth_date 미설정 시 차단 (age-check 진행 필요)
  if (!u.birth_date) {
    return NextResponse.json(
      { error: "AGE_VERIFICATION_REQUIRED", message: "연령 확인이 필요합니다" },
      { status: 403 },
    );
  }
  const age = calcAgeKST(u.birth_date);
  if (Number.isNaN(age) || age < 19) {
    return NextResponse.json(
      { error: "UNDERAGE", message: "만 19세 이상만 이용 가능합니다" },
      { status: 403 },
    );
  }

  // 2차 게이트 — PortOne 본인인증 강제 (옵션)
  if (options.requireVerified && !u.is_verified) {
    return NextResponse.json(
      { error: "IDENTITY_VERIFICATION_REQUIRED", message: "본인인증이 필요합니다" },
      { status: 403 },
    );
  }

  return null;
}
