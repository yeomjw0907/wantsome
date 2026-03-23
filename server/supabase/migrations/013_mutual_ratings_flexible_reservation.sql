-- 013_mutual_ratings_flexible_reservation.sql
-- 양방향 4카테고리 평가 + 예약 시간 유연화

-- ─────────────────────────────────────────────
-- 1) creator_ratings: 단일 rating → 4카테고리
-- ─────────────────────────────────────────────
ALTER TABLE creator_ratings
  DROP COLUMN IF EXISTS rating,
  ADD COLUMN IF NOT EXISTS rating_호감 INTEGER CHECK (rating_호감 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_신뢰 INTEGER CHECK (rating_신뢰 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_매너 INTEGER CHECK (rating_매너 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_매력 INTEGER CHECK (rating_매력 BETWEEN 1 AND 5);

-- ─────────────────────────────────────────────
-- 2) user_ratings 신규 (크리에이터 → 유저)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id),
  creator_id      UUID NOT NULL REFERENCES users(id),
  consumer_id     UUID NOT NULL REFERENCES users(id),
  rating_호감     INTEGER CHECK (rating_호감 BETWEEN 1 AND 5),
  rating_신뢰     INTEGER CHECK (rating_신뢰 BETWEEN 1 AND 5),
  rating_매너     INTEGER CHECK (rating_매너 BETWEEN 1 AND 5),
  rating_매력     INTEGER CHECK (rating_매력 BETWEEN 1 AND 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(call_session_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ratings_consumer ON user_ratings(consumer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_ratings_creator  ON user_ratings(creator_id, created_at DESC);

ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- 크리에이터(평가자)만 insert/update
DROP POLICY IF EXISTS "user_ratings_creator_write" ON user_ratings;
CREATE POLICY "user_ratings_creator_write" ON user_ratings
  FOR ALL USING (auth.uid() = creator_id);

-- 소비자(피평가자)는 자신에 대한 평가만 read
DROP POLICY IF EXISTS "user_ratings_consumer_read" ON user_ratings;
CREATE POLICY "user_ratings_consumer_read" ON user_ratings
  FOR SELECT USING (auth.uid() = consumer_id);

-- ─────────────────────────────────────────────
-- 3) users 집계 컬럼 추가
-- ─────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avg_rating            NUMERIC         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_calls           INTEGER         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_call_duration_sec INTEGER         DEFAULT 0;

-- ─────────────────────────────────────────────
-- 4) creators avg_rating 컬럼 (이미 있으나 보장)
-- ─────────────────────────────────────────────
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0;

-- ─────────────────────────────────────────────
-- 5) reservations duration_min 제약 변경 (10~60, 5분 단위)
-- ─────────────────────────────────────────────
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_duration_min_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_duration_min_check
  CHECK (duration_min >= 10 AND duration_min <= 60 AND duration_min % 5 = 0);

-- ─────────────────────────────────────────────
-- 6) Realtime
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE user_ratings;
