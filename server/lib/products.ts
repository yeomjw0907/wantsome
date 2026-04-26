/**
 * 충전 상품 — 앱 constants/products.ts와 동기화 유지
 *
 * storeId: Apple/Google IAP에 등록된 product identifier
 *   - constants/products.ts와 동일한 형식 (kr.wantsome.app.point_<points>)
 *   - 검증 시 Apple/Google API에 보내는 ID
 */
// 가격 = ceil(포인트 / 0.7 / 1100) × 1100  (Apple KRW 티어 단위)
// PR-8 가격 정책 v1 — constants/products.ts와 동일 (단일 source of truth)
export const PRODUCTS = [
  { id: "POINT_01", storeId: "kr.wantsome.app.point_4000",   name: "체험권 🌱",   price: 6600,   points: 4000,   bonus: 0 },
  { id: "POINT_02", storeId: "kr.wantsome.app.point_6600",   name: "스몰 ☕",     price: 9900,   points: 6600,   bonus: 0 },
  { id: "POINT_03", storeId: "kr.wantsome.app.point_18600",  name: "미디엄 🎯",  price: 27500,  points: 18600,  bonus: 0 },
  { id: "POINT_04", storeId: "kr.wantsome.app.point_32000",  name: "라지 🔥",    price: 46200,  points: 32000,  bonus: 0 },
  { id: "POINT_05", storeId: "kr.wantsome.app.point_60000",  name: "프리미엄 💎", price: 85800,  points: 60000,  bonus: 0 },
  { id: "POINT_06", storeId: "kr.wantsome.app.point_100000", name: "VIP 👑",     price: 143000, points: 100000, bonus: 0 },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(productId: string): (typeof PRODUCTS)[number] | undefined {
  return PRODUCT_MAP.get(productId as ProductId);
}
