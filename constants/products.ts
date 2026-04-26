/**
 * 포인트 충전 상품 — docs/context/02_business_rules.md 기준
 * 1P = 1원, 첫충전 72h 내 2배
 *
 * storeId: App Store Connect / Google Play Console에 등록한 인앱 상품 ID
 */
// 가격 = ceil(포인트 / 0.7 / 1100) × 1100  (Apple KRW 티어 단위)
// 스토어 30% 수수료 후 회사 실수령 ≥ 지급 포인트가 되도록 역산
//
// PR-8 가격 정책 v1 (2026-04-27 확정, docs/launch-readiness/00-pricing-policy.md):
// 단위는 캠톡 매칭으로 재배열 (4000/6600/18600/32000/60000/100000P).
// 모든 storeId 변경됨 — App Store Connect / Play Console에 신규 등록 필수.
export const PRODUCTS = [
  { id: "POINT_01", storeId: "kr.wantsome.app.point_4000",   name: "체험권 🌱",   price: 6600,   points: 4000,   bonus: 0 },
  { id: "POINT_02", storeId: "kr.wantsome.app.point_6600",   name: "스몰 ☕",     price: 9900,   points: 6600,   bonus: 0 },
  { id: "POINT_03", storeId: "kr.wantsome.app.point_18600",  name: "미디엄 🎯",  price: 27500,  points: 18600,  bonus: 0 },
  { id: "POINT_04", storeId: "kr.wantsome.app.point_32000",  name: "라지 🔥",    price: 46200,  points: 32000,  bonus: 0 },
  { id: "POINT_05", storeId: "kr.wantsome.app.point_60000",  name: "프리미엄 💎", price: 85800,  points: 60000,  bonus: 0 },
  { id: "POINT_06", storeId: "kr.wantsome.app.point_100000", name: "VIP 👑",     price: 143000, points: 100000, bonus: 0 },
] as const;

export const STORE_ID_TO_PRODUCT_ID = Object.fromEntries(
  PRODUCTS.map((p) => [p.storeId, p.id])
) as Record<string, string>;

export type ProductId = (typeof PRODUCTS)[number]["id"];

/** 분당 단가 (P) — 가격 정책 v1 (00-pricing-policy.md A) */
export const PER_MIN_RATES = {
  blue: 2000,
  red: 3000,
} as const;
