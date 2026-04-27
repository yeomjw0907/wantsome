-- wantsome Phase 5 — 관리자 패널 (admin_logs, push_logs)
-- Supabase SQL Editor에서 실행하세요.

-- 1) admin_logs (관리자 액션 기록)
CREATE TABLE IF NOT EXISTS admin_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT,   -- 'user' | 'creator' | 'report' | 'settlement' | 'push'
  target_id   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_type, target_id);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
-- service_role만 접근 (no authenticated policy)

-- 2) push_logs (푸시 발송 기록)
CREATE TABLE IF NOT EXISTS push_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID REFERENCES users(id),
  target      TEXT NOT NULL,    -- 'all' | 'consumer' | 'CREATOR' | specific user_id
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  sent_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_logs_created ON push_logs(created_at DESC);

ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;
-- service_role만 접근

-- 3) 관리자 역할을 위한 users.role check 완화
-- (이미 001에서 TEXT이므로 따로 제약 없음)

-- 4) 정산 시스템 — creator_settlements (004에서 생성했으나 혹시 없을 경우)
CREATE TABLE IF NOT EXISTS creator_settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID REFERENCES users(id),
  period           TEXT NOT NULL,
  total_points     INTEGER DEFAULT 0,
  settlement_amount NUMERIC DEFAULT 0,
  tax_amount       NUMERIC DEFAULT 0,
  net_amount       NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID')),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(creator_id, period)
);

CREATE INDEX IF NOT EXISTS idx_settlements_creator ON creator_settlements(creator_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON creator_settlements(period, status);

ALTER TABLE creator_settlements ENABLE ROW LEVEL SECURITY;

-- 크리에이터: 본인 정산 조회
DROP POLICY IF EXISTS "settlements_creator_read" ON creator_settlements;
CREATE POLICY "settlements_creator_read" ON creator_settlements
  FOR SELECT USING (auth.uid() = creator_id);

-- 5) system_config 추가 키
INSERT INTO system_config (key, value, updated_at) VALUES
  ('company_name',       '원썸 컴퍼니',   NOW()),
  ('ceo_name',           '',               NOW()),
  ('business_number',    '',               NOW()),
  ('business_address',   '',               NOW()),
  ('cs_phone',           '',               NOW()),
  ('cs_email',           '',               NOW()),
  ('settlement_day',     '15',             NOW()),
  ('withholding_rate',   '0.033',          NOW())
ON CONFLICT (key) DO NOTHING;
