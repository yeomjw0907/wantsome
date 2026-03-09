/**
 * 충전 상품 — 앱 constants/products.ts와 동기화 유지
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

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(productId: string): (typeof PRODUCTS)[number] | undefined {
  return PRODUCT_MAP.get(productId as ProductId);
}
