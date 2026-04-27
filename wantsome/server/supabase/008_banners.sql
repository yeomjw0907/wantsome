-- wantsome Phase 8 — 배너/프로모션 테이블
-- Supabase SQL Editor에서 실행하세요.

-- 1) banners (배너/프로모션)
CREATE TABLE IF NOT EXISTS banners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  subtitle    TEXT,
  image_url   TEXT,
  link_url    TEXT,
  type        TEXT DEFAULT 'PROMO' CHECK (type IN ('PROMO', 'NOTICE', 'EVENT')),
  is_active   BOOLEAN DEFAULT true,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active, sort_order);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- 누구나 활성 배너 조회 가능
DROP POLICY IF EXISTS "banners_read" ON banners;
CREATE POLICY "banners_read" ON banners
  FOR SELECT USING (is_active = true);

-- service_role만 쓰기
-- (admin 패널은 service_role key 사용)

-- 2) ci_blacklist (신분증 CI 블랙리스트)
-- 테이블이 이미 존재하지만 ci_hash 컬럼이 없을 경우 안전하게 처리
DO $$
BEGIN
  -- ci_blacklist 테이블이 없으면 생성
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ci_blacklist'
  ) THEN
    CREATE TABLE ci_blacklist (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ci_hash     TEXT NOT NULL UNIQUE,
      reason      TEXT,
      added_by    UUID REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- 테이블은 있지만 ci_hash 컬럼이 없으면 추가
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'ci_blacklist'
        AND column_name  = 'ci_hash'
    ) THEN
      ALTER TABLE ci_blacklist ADD COLUMN ci_hash TEXT;
      ALTER TABLE ci_blacklist ADD CONSTRAINT ci_blacklist_ci_hash_key UNIQUE (ci_hash);
    END IF;
    -- reason 컬럼이 없으면 추가
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'ci_blacklist'
        AND column_name  = 'reason'
    ) THEN
      ALTER TABLE ci_blacklist ADD COLUMN reason TEXT;
    END IF;
    -- added_by 컬럼이 없으면 추가
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'ci_blacklist'
        AND column_name  = 'added_by'
    ) THEN
      ALTER TABLE ci_blacklist ADD COLUMN added_by UUID REFERENCES users(id);
    END IF;
  END IF;
END $$;

-- 인덱스 생성 (이미 있으면 스킵)
CREATE INDEX IF NOT EXISTS idx_ci_blacklist_hash ON ci_blacklist(ci_hash);
ALTER TABLE ci_blacklist ENABLE ROW LEVEL SECURITY;
-- service_role만 접근

-- 3) 기본 배너 샘플
INSERT INTO banners (title, subtitle, type, is_active, sort_order) VALUES
  ('첫 충전 100% 보너스', '처음 충전하면 2배로 받아요!', 'PROMO', true, 1),
  ('크리에이터 모집 중', '지금 신청하고 수익을 창출하세요', 'EVENT', true, 2)
ON CONFLICT DO NOTHING;
