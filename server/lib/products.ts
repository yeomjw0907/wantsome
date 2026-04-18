/**
 * 충전 상품 — 앱 constants/products.ts와 동기화 유지
 */
// 가격 = ceil(포인트 / 0.7 / 1100) × 1100  (Apple KRW 티어 단위)
export const PRODUCTS = [
  { id: "POINT_01", name: "체험권 🌱",   price: 8800,   points: 5500,   bonus: 0 },
  { id: "POINT_02", name: "스몰 ☕",     price: 16500,  points: 11500,  bonus: 0 },
  { id: "POINT_03", name: "미디엄 🎯",  price: 35200,  points: 24000,  bonus: 0 },
  { id: "POINT_04", name: "라지 🔥",    price: 71500,  points: 50000,  bonus: 0 },
  { id: "POINT_05", name: "프리미엄 💎", price: 150700, points: 105000, bonus: 0 },
  { id: "POINT_06", name: "VIP 👑",     price: 286000, points: 200000, bonus: 0 },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(productId: string): (typeof PRODUCTS)[number] | undefined {
  return PRODUCT_MAP.get(productId as ProductId);
}
