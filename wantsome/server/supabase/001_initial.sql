-- wantsome API 4단계 — 최소 스키마
-- Supabase SQL Editor에서 순서대로 실행하세요.

-- 1) system_config (앱 설정 / 점검 / 버전)
CREATE TABLE IF NOT EXISTS system_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config (key, value, updated_at) VALUES
  ('maintenance_mode',        'false',                                        NOW()),
  ('maintenance_message',     '서비스 점검 중입니다.',                          NOW()),
  ('maintenance_eta',         '',                                             NOW()),
  ('first_charge_bonus_rate', '100',                                          NOW()),
  ('first_charge_hours',      '72',                                           NOW()),
  ('cs_url',                  '',                                             NOW()),
  ('min_version_ios',         '1.0.0',                                       NOW()),
  ('min_version_android',     '1.0.0',                                        NOW()),
  ('force_update_message',   '새 버전이 출시됐습니다. 업데이트 후 이용해주세요.', NOW())
ON CONFLICT (key) DO NOTHING;

-- 2) users (auth.users.id와 1:1 매칭)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  phone         TEXT UNIQUE,
  nickname      TEXT NOT NULL DEFAULT '유저',
  profile_img   TEXT,
  role          TEXT DEFAULT 'consumer' CHECK (role IN ('consumer', 'creator', 'both', 'admin', 'superadmin')),
  is_verified   BOOLEAN DEFAULT FALSE,
  ci            TEXT UNIQUE,
  birth_date    DATE,
  verified_name TEXT,
  verified_at   TIMESTAMPTZ,
  blue_mode     BOOLEAN DEFAULT TRUE,
  red_mode      BOOLEAN DEFAULT FALSE,
  points        INTEGER DEFAULT 0,
  first_charge_deadline TIMESTAMPTZ,
  is_first_charged      BOOLEAN DEFAULT FALSE,
  suspended_until       TIMESTAMPTZ,
  deleted_at            TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_ci ON users(ci);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_self" ON users;
CREATE POLICY "users_self" ON users
  FOR ALL USING (auth.uid() = id);

-- 3) ci_blacklist (서버 전용)
CREATE TABLE IF NOT EXISTS ci_blacklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci         TEXT UNIQUE NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ci_blacklist ENABLE ROW LEVEL SECURITY;
-- RLS로 인해 service_role만 접근 가능 (anon/authenticated 정책 없음)
