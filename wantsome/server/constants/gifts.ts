export const GIFT_OPTIONS = [100, 300, 500, 1000, 3000, 5000] as const;
export type GiftAmount = (typeof GIFT_OPTIONS)[number];
