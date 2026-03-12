-- wantsome Phase 3 — 예약통화 (reservations)
-- Supabase SQL Editor에서 실행하세요.

-- 1) reservations
CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID REFERENCES users(id),
  creator_id      UUID REFERENCES users(id),
  reserved_at     TIMESTAMPTZ NOT NULL,
  duration_min    INTEGER NOT NULL CHECK (duration_min IN (30, 60)),
  mode            TEXT NOT NULL CHECK (mode IN ('blue', 'red')),
  type            TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard', 'premium')),
  deposit_points  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'noshow', 'completed')),
  reject_reason   TEXT,
  reminded_at     TIMESTAMPTZ,
  noshow_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_consumer ON reservations(consumer_id, reserved_at);
CREATE INDEX IF NOT EXISTS idx_reservations_creator ON reservations(creator_id, reserved_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status, reserved_at);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 소비자: 본인 예약 조회
DROP POLICY IF EXISTS "reservations_consumer" ON reservations;
CREATE POLICY "reservations_consumer" ON reservations FOR SELECT
  USING (auth.uid() = consumer_id);

-- 크리에이터: 본인 예약 조회
DROP POLICY IF EXISTS "reservations_creator" ON reservations;
CREATE POLICY "reservations_creator" ON reservations FOR SELECT
  USING (auth.uid() = creator_id);

-- 예약 생성 (소비자)
DROP POLICY IF EXISTS "reservations_insert" ON reservations;
CREATE POLICY "reservations_insert" ON reservations FOR INSERT
  WITH CHECK (auth.uid() = consumer_id);

-- 수정 (소비자 취소, 크리에이터 응답)
DROP POLICY IF EXISTS "reservations_update" ON reservations;
CREATE POLICY "reservations_update" ON reservations FOR UPDATE
  USING (auth.uid() = consumer_id OR auth.uid() = creator_id);

-- 2) add_points RPC (정산/환불용)
CREATE OR REPLACE FUNCTION add_points(p_user_id UUID, p_amount INTEGER, p_reason TEXT DEFAULT '')
RETURNS VOID AS $$
BEGIN
  UPDATE users SET points = points + p_amount WHERE id = p_user_id;
  INSERT INTO point_charges (user_id, amount, status, method, created_at)
  VALUES (p_user_id, p_amount, 'PAID', p_reason, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) deduct_points RPC
CREATE OR REPLACE FUNCTION deduct_points(p_user_id UUID, p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_points INTEGER;
BEGIN
  SELECT points INTO current_points FROM users WHERE id = p_user_id FOR UPDATE;
  IF current_points < p_amount THEN
    RETURN FALSE;
  END IF;
  UPDATE users SET points = points - p_amount WHERE id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
