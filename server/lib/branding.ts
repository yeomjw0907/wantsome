/**
 * 대외 브랜딩·법인 표기 (서버). 루트 constants/branding.ts 와 문구 동기 유지.
 */
export const SERVICE_NAME = "원썸";
export const COMPANY_LEGAL_NAME = "주식회사 98점7도";

export const MODE_LABEL = {
  blue: "스탠다드",
  red: "프리미엄",
} as const;

export function formatModeLabel(mode: "blue" | "red"): string {
  return MODE_LABEL[mode];
}
