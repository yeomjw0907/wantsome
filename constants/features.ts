/**
 * Feature flags — 가격 정책 v1.
 *
 * v1 출시 시 굿즈는 OFF (00-pricing-policy.md J 단계적 운영).
 * 환경변수로 제어 — EAS Secret 또는 eas.json env.
 *
 * 사용:
 *   import { GOODS_ENABLED } from "@/constants/features";
 *   if (!GOODS_ENABLED) return null;
 */

function flag(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return defaultValue;
  return v === "true" || v === "1";
}

/** 굿즈(실물) 마켓플레이스 활성화 — v1 OFF, D+14에 시범 ON */
export const GOODS_ENABLED = flag("EXPO_PUBLIC_GOODS_ENABLED", false);

/** 추천인 시스템 — v2 (D+30 이후 데이터 보고 설계) */
export const REFERRAL_ENABLED = flag("EXPO_PUBLIC_REFERRAL_ENABLED", false);

/** 인플 등급 시스템 — v2 (D+30 이후) */
export const TIER_SYSTEM_ENABLED = flag("EXPO_PUBLIC_TIER_SYSTEM_ENABLED", false);
