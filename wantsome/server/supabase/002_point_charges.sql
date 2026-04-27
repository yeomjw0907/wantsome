-- wantsome — point_charges (충전 내역, 이중 충전 방지)
-- Supabase SQL Editor에서 실행하세요. 001_initial.sql 이후 실행.

CREATE TABLE IF NOT EXISTS point_charges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  product_id      TEXT NOT NULL,
  amount_krw      INTEGER NOT NULL,
  points          INTEGER NOT NULL,
  bonus           INTEGER DEFAULT 0,
  is_first        BOOLEAN DEFAULT FALSE,
  platform        TEXT,
  iap_receipt     TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charges_user ON point_charges(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_charges_idempotency ON point_charges(idempotency_key);

ALTER TABLE point_charges ENABLE ROW LEVEL SECURITY;

-- 서버(service_role)만 INSERT/SELECT. 클라이언트는 접근 불가.
-- (정책 없음 = authenticated/anon 접근 불가)
