-- wantsome Phase 5 — 신고 & 유저 차단 & 푸시 토큰 & 스토리지
-- Supabase SQL Editor에서 실행하세요.

-- 1) reports
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID REFERENCES users(id),
  target_id       UUID REFERENCES users(id),
  call_session_id UUID REFERENCES call_sessions(id),
  category        TEXT NOT NULL
    CHECK (category IN ('UNDERAGE', 'ILLEGAL_RECORD', 'PROSTITUTION', 'HARASSMENT', 'FRAUD', 'OTHER')),
  description     TEXT,
  status          TEXT DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED')),
  auto_action     TEXT,
  admin_note      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert" ON reports;
CREATE POLICY "reports_insert" ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_select_self" ON reports;
CREATE POLICY "reports_select_self" ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- 2) user_blocks (차단)
CREATE TABLE IF NOT EXISTS user_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID REFERENCES users(id),
  blocked_id  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_self" ON user_blocks;
CREATE POLICY "blocks_self" ON user_blocks
  USING (auth.uid() = blocker_id);

-- 3) push_token (users 테이블에 컬럼 추가)
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token)
  WHERE push_token IS NOT NULL;

-- 4) suspended_until, deleted_at는 001_initial.sql에 이미 포함되어 있으나 혹시 없을 경우를 위해
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 5) Storage 버킷 생성
-- 주의: Supabase 대시보드 → Storage에서 직접 생성하거나 아래 SQL 실행
INSERT INTO storage.buckets (id, name, public)
  VALUES ('profiles', 'profiles', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('id-cards', 'id-cards', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('contracts', 'contracts', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('banners', 'banners', true)
  ON CONFLICT (id) DO NOTHING;

-- 6) Storage RLS 정책
DROP POLICY IF EXISTS "profiles_upload" ON storage.objects;
CREATE POLICY "profiles_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "profiles_read" ON storage.objects;
CREATE POLICY "profiles_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'profiles');

DROP POLICY IF EXISTS "profiles_update" ON storage.objects;
CREATE POLICY "profiles_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "idcards_upload" ON storage.objects;
CREATE POLICY "idcards_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'id-cards' AND auth.uid()::text = (storage.foldername(name))[1]);
