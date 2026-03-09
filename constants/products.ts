/**
 * 포인트 충전 상품 — docs/context/02_business_rules.md 기준
 * 1P = 1원, 첫충전 72h 내 2배
 */
export const PRODUCTS = [
  { id: "POINT_01", name: "체험권 🌱", price: 4900, points: 5500, bonus: 0.12 },
  { id: "POINT_02", name: "스몰 ☕", price: 9900, points: 11500, bonus: 0.16 },
  { id: "POINT_03", name: "미디엄 🎯", price: 19900, points: 24000, bonus: 0.21 },
  { id: "POINT_04", name: "라지 🔥", price: 39900, points: 50000, bonus: 0.25 },
  { id: "POINT_05", name: "프리미엄 💎", price: 79900, points: 105000, bonus: 0.31 },
  { id: "POINT_06", name: "VIP 👑", price: 149000, points: 200000, bonus: 0.34 },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

/** 분당 단가 (P) — 변경 금지 */
export const PER_MIN_RATES = {
  blue: 900,
  red: 1300,
} as const;
