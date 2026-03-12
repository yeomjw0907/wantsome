-- wantsome — 통화 관련 테이블
-- Supabase SQL Editor에서 실행하세요. 002_point_charges.sql 이후 실행.

-- ──────────────────────────────────────────
-- 1) creators (call_sessions 외래키 필요)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creators (
  id              UUID PRIMARY KEY REFERENCES users(id),
  display_name     TEXT NOT NULL,
  bio              TEXT,
  grade            TEXT DEFAULT '신규',         -- 신규|일반|인기|탑
  settlement_rate  NUMERIC DEFAULT 0.75,        -- 정산율 (론칭: 0.75 단일)
  is_online        BOOLEAN DEFAULT FALSE,
  mode_blue        BOOLEAN DEFAULT TRUE,
  mode_red         BOOLEAN DEFAULT FALSE,
  monthly_minutes  INTEGER DEFAULT 0,           -- 월간 누적 통화 분수
  grade_updated    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creators_online ON creators(is_online);
CREATE INDEX IF NOT EXISTS idx_creators_grade ON creators(grade);

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creators_self" ON creators;
CREATE POLICY "creators_self" ON creators
  FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "creators_read" ON creators;
CREATE POLICY "creators_read" ON creators FOR SELECT
  USING (auth.role() = 'authenticated');

-- ──────────────────────────────────────────
-- 2) call_sessions
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID NOT NULL REFERENCES users(id),
  creator_id      UUID NOT NULL REFERENCES creators(id),
  agora_channel   TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('blue','red')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','ended','rejected','cancelled')),
  per_min_rate    INTEGER NOT NULL CHECK (per_min_rate IN (900, 1300)),
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_sec    INTEGER DEFAULT 0,
  points_charged  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_status     ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_consumer   ON call_sessions(consumer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_creator    ON call_sessions(creator_id);

ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

-- 본인 세션만 조회 가능 (소비자 OR 크리에이터)
DROP POLICY IF EXISTS "sessions_self" ON call_sessions;
CREATE POLICY "sessions_self" ON call_sessions
  FOR SELECT USING (
    auth.uid() = consumer_id OR auth.uid() = creator_id
  );

-- ──────────────────────────────────────────
-- 3) call_signals (Realtime 시그널링 전용)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES users(id),
  from_user_id UUID NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL
                 CHECK (type IN (
                   'incoming_call','call_accepted','call_rejected',
                   'call_cancelled','call_ended'
                 )),
  payload      JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_to_user ON call_signals(to_user_id, created_at);

ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

-- 본인 수신 신호만 조회 가능
DROP POLICY IF EXISTS "signals_self" ON call_signals;
CREATE POLICY "signals_self" ON call_signals
  FOR SELECT USING (auth.uid() = to_user_id);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;

-- ──────────────────────────────────────────
-- 4) reservations
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID NOT NULL REFERENCES users(id),
  creator_id      UUID NOT NULL REFERENCES creators(id),
  reserved_at     TIMESTAMPTZ NOT NULL,
  duration_min    INTEGER NOT NULL CHECK (duration_min IN (30, 60)),
  deposit_points  INTEGER NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('blue','red')),
  type            TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard','premium')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','completed','noshow','cancelled')),
  reject_reason   TEXT,
  reminded_at     TIMESTAMPTZ,
  noshow_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_creator  ON reservations(creator_id, reserved_at);
CREATE INDEX IF NOT EXISTS idx_reservations_consumer ON reservations(consumer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status   ON reservations(status, reserved_at);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_self" ON reservations;
CREATE POLICY "reservations_self" ON reservations
  FOR ALL USING (
    auth.uid() = consumer_id OR auth.uid() = creator_id
  );
