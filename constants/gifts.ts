/**
 * 선물 단가 — 가격 정책 v1 (00-pricing-policy.md D, 옵션 C 별풍선 멘탈).
 *
 * 단일 source of truth. 클라이언트(call/live/history)와 서버(api/gifts) 모두
 * 이 모듈에서만 import. 추가/제거는 본 파일에서만 변경.
 */

export type GiftItem = {
  /** 포인트 단가 (P) */
  amount: number;
  /** UI 라벨 */
  label: string;
  /** 이모지 — 칩·channel signal */
  emoji: string;
  /** 별풍선 환산 (UI 부가 안내) */
  star: number;
};

export const GIFTS = [
  { amount: 100,   label: "하트",     emoji: "💗", star: 1 },
  { amount: 300,   label: "장미",     emoji: "🌹", star: 3 },
  { amount: 500,   label: "부케",     emoji: "💐", star: 5 },
  { amount: 1000,  label: "다이아",   emoji: "💎", star: 10 },
  { amount: 2000,  label: "별빛",     emoji: "⭐", star: 20 },
  { amount: 5000,  label: "왕관",     emoji: "👑", star: 50 },
  { amount: 10000, label: "슈퍼스타", emoji: "🌟", star: 100 },
] as const satisfies readonly GiftItem[];

export const GIFT_AMOUNTS = GIFTS.map((g) => g.amount) as readonly number[];

export function getGift(amount: number): GiftItem | undefined {
  return GIFTS.find((g) => g.amount === amount);
}

export function isValidGiftAmount(amount: number): boolean {
  return GIFT_AMOUNTS.includes(amount);
}
