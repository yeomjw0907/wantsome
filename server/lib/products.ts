/**
 * 충전 상품 — 앱 constants/products.ts와 동기화 유지
 *
 * storeId: Apple/Google IAP에 등록된 product identifier
 *   - constants/products.ts와 동일한 형식 (kr.wantsome.app.point_<points>)
 *   - 검증 시 Apple/Google API에 보내는 ID
 */
// 가격 = ceil(포인트 / 0.7 / 1100) × 1100  (Apple KRW 티어 단위)
export const PRODUCTS = [
  { id: "POINT_01", storeId: "kr.wantsome.app.point_5500",   name: "체험권 🌱",   price: 8800,   points: 5500,   bonus: 0 },
  { id: "POINT_02", storeId: "kr.wantsome.app.point_11500",  name: "스몰 ☕",     price: 16500,  points: 11500,  bonus: 0 },
  { id: "POINT_03", storeId: "kr.wantsome.app.point_24000",  name: "미디엄 🎯",  price: 35200,  points: 24000,  bonus: 0 },
  { id: "POINT_04", storeId: "kr.wantsome.app.point_50000",  name: "라지 🔥",    price: 71500,  points: 50000,  bonus: 0 },
  { id: "POINT_05", storeId: "kr.wantsome.app.point_105000", name: "프리미엄 💎", price: 150700, points: 105000, bonus: 0 },
  { id: "POINT_06", storeId: "kr.wantsome.app.point_200000", name: "VIP 👑",     price: 286000, points: 200000, bonus: 0 },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(productId: string): (typeof PRODUCTS)[number] | undefined {
  return PRODUCT_MAP.get(productId as ProductId);
}
