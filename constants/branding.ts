/**
 * 대외 브랜딩·법인 표기 (앱). server/lib/branding.ts 와 문구 동기 유지.
 */
export const SERVICE_NAME = "원썸";
export const COMPANY_LEGAL_NAME = "주식회사 98점7도";

/** UI 표기용 (API/DB 키 blue | red 는 그대로) */
export const MODE_LABEL = {
  blue: "스탠다드",
  red: "프리미엄",
} as const;

export type ModeKey = keyof typeof MODE_LABEL;

export function formatModeLabel(mode: "blue" | "red"): string {
  return MODE_LABEL[mode];
}
