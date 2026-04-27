export const GIFT_AMOUNTS = [100, 300, 500, 1000, 3000, 5000] as const;
export type GiftAmount = (typeof GIFT_AMOUNTS)[number];

export function isValidGiftAmount(amount: number): amount is GiftAmount {
  return (GIFT_AMOUNTS as readonly number[]).includes(amount);
}
