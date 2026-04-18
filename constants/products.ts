/**
 * 포인트 충전 상품 — docs/context/02_business_rules.md 기준
 * 1P = 1원, 첫충전 72h 내 2배
 *
 * storeId: App Store Connect / Google Play Console에 등록한 인앱 상품 ID
 */
// 가격 = ceil(포인트 / 0.7 / 1100) × 1100  (Apple KRW 티어 단위)
// 스토어 30% 수수료 후 회사 실수령 ≥ 지급 포인트가 되도록 역산
export const PRODUCTS = [
  { id: "POINT_01", storeId: "kr.wantsome.app.point_5500",   name: "체험권 🌱",   price: 8800,   points: 5500,   bonus: 0 },
  { id: "POINT_02", storeId: "kr.wantsome.app.point_11500",  name: "스몰 ☕",     price: 16500,  points: 11500,  bonus: 0 },
  { id: "POINT_03", storeId: "kr.wantsome.app.point_24000",  name: "미디엄 🎯",  price: 35200,  points: 24000,  bonus: 0 },
  { id: "POINT_04", storeId: "kr.wantsome.app.point_50000",  name: "라지 🔥",    price: 71500,  points: 50000,  bonus: 0 },
  { id: "POINT_05", storeId: "kr.wantsome.app.point_105000", name: "프리미엄 💎", price: 150700, points: 105000, bonus: 0 },
  { id: "POINT_06", storeId: "kr.wantsome.app.point_200000", name: "VIP 👑",     price: 286000, points: 200000, bonus: 0 },
] as const;

export const STORE_ID_TO_PRODUCT_ID = Object.fromEntries(
  PRODUCTS.map((p) => [p.storeId, p.id])
) as Record<string, string>;

export type ProductId = (typeof PRODUCTS)[number]["id"];

/** 분당 단가 (P) — 변경 금지 */
export const PER_MIN_RATES = {
  blue: 900,
  red: 1300,
} as const;
