# DB — point_charges & settlements

## point_charges

```sql
CREATE TABLE point_charges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  product_id   TEXT NOT NULL,
  -- POINT_01 ~ POINT_06
  amount_krw   INTEGER NOT NULL,               -- 결제금액 (원)
  points       INTEGER NOT NULL,               -- 지급 포인트 (보너스 포함)
  bonus        INTEGER DEFAULT 0,              -- 보너스 포인트
  is_first     BOOLEAN DEFAULT FALSE,          -- 첫충전 여부 (2배 이벤트)
  platform     TEXT,                           -- 'ios' | 'android'
  iap_receipt  TEXT,                           -- 영수증 검증값
  idempotency_key TEXT UNIQUE,                 -- 이중 충전 방지
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_charges_user ON point_charges(user_id, created_at);
```

## settlements

```sql
CREATE TABLE settlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID REFERENCES creators(id),
  period_month  TEXT NOT NULL,                 -- '2026-03'
  total_points  INTEGER DEFAULT 0,             -- 해당 월 총 포인트
  gross_amount  INTEGER DEFAULT 0,             -- 세전 정산액 (원)
  tax_amount    INTEGER DEFAULT 0,             -- 원천징수 3.3%
  net_amount    INTEGER DEFAULT 0,             -- 실지급액
  status        TEXT DEFAULT 'pending',        -- pending | paid
  paid_at       TIMESTAMPTZ,
  bank_code     TEXT,                          -- 정산 시점 계좌 스냅샷
  account_number TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(creator_id, period_month)
);
```

## 충전 상품 상수 (constants/products.ts)

```ts
export const PRODUCTS = [
  { id: 'POINT_01', name: '체험권 🌱', price: 4900,   points: 5500,   bonus: 0.12 },
  { id: 'POINT_02', name: '스몰 ☕',   price: 9900,   points: 11500,  bonus: 0.16 },
  { id: 'POINT_03', name: '미디엄 🎯', price: 19900,  points: 24000,  bonus: 0.21 },
  { id: 'POINT_04', name: '라지 🔥',   price: 39900,  points: 50000,  bonus: 0.25 },
  { id: 'POINT_05', name: '프리미엄 💎',price: 79900, points: 105000, bonus: 0.31 },
  { id: 'POINT_06', name: 'VIP 👑',    price: 149000, points: 200000, bonus: 0.34 },
] as const;
```
