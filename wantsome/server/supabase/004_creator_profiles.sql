-- wantsome Phase 2 — creators & creator_profiles
-- Supabase SQL Editor에서 실행하세요.

-- 1) creators (활동 정보)
CREATE TABLE IF NOT EXISTS creators (
  id               UUID PRIMARY KEY REFERENCES users(id),
  display_name     TEXT NOT NULL,
  bio              TEXT,
  profile_image_url TEXT,
  grade            TEXT DEFAULT '신규' CHECK (grade IN ('신규', '일반', '인기', '탑')),
  settlement_rate  NUMERIC DEFAULT 0.75,
  is_online        BOOLEAN DEFAULT FALSE,
  mode_blue        BOOLEAN DEFAULT TRUE,
  mode_red         BOOLEAN DEFAULT FALSE,
  monthly_minutes  INTEGER DEFAULT 0,
  grade_updated_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creators_online ON creators(is_online);
CREATE INDEX IF NOT EXISTS idx_creators_grade ON creators(grade);

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creators_read" ON creators;
CREATE POLICY "creators_read" ON creators FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "creators_update_self" ON creators;
CREATE POLICY "creators_update_self" ON creators FOR UPDATE
  USING (auth.uid() = id);

-- 2) creator_profiles (온보딩 심사)
CREATE TABLE IF NOT EXISTS creator_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID UNIQUE REFERENCES users(id),
  status               TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),

  -- 프로필
  display_name         TEXT,
  bio                  TEXT,
  profile_image_url    TEXT,
  active_modes         TEXT[],

  -- 신분증
  id_card_path         TEXT,
  id_card_uploaded_at  TIMESTAMPTZ,
  id_card_verified_at  TIMESTAMPTZ,

  -- 계좌 (AES-256-GCM 암호화 저장)
  bank_code            VARCHAR(10),
  bank_name            TEXT,
  account_number_enc   TEXT,
  account_holder       VARCHAR(20),
  account_verified_at  TIMESTAMPTZ,

  -- 계약서
  contract_signed_at   TIMESTAMPTZ,
  contract_pdf_path    TEXT,
  contract_ip          VARCHAR(45),

  -- 관리자 심사
  submitted_at         TIMESTAMPTZ,
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  rejection_reason     TEXT,

  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_profiles_self" ON creator_profiles;
CREATE POLICY "creator_profiles_self" ON creator_profiles
  USING (auth.uid() = user_id);

-- 3) creator_settlements (월별 정산)
CREATE TABLE IF NOT EXISTS creator_settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID REFERENCES users(id),
  period           TEXT NOT NULL,            -- 'YYYY-MM'
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
CREATE INDEX IF NOT EXISTS idx_settlements_status ON creator_settlements(status);

ALTER TABLE creator_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlements_self" ON creator_settlements;
CREATE POLICY "settlements_self" ON creator_settlements
  FOR SELECT USING (auth.uid() = creator_id);

-- 4) users 테이블 role 값에 CREATOR_PENDING 추가
-- (이미 check constraint가 없다면 자유롭게 사용 가능)

-- 5) add missing columns to users if not already present
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'consumer';
