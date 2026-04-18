-- 018_rate_limits.sql
-- 슬라이딩 윈도우 레이트 리밋 테이블 + 원자적 체크 함수

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,
  CONSTRAINT rate_limits_pkey PRIMARY KEY (key, window_start)
);

-- 오래된 레코드 자동 정리를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON rate_limits (key, window_start);

-- ─────────────────────────────────────────────────────────────────────────────
-- check_rate_limit(key, limit, window_seconds)
--   반환값: TRUE  = 허용 (아직 limit 미초과)
--           FALSE = 차단 (limit 초과)
--
-- 원자적 upsert로 동시 요청에서도 정확한 카운트 보장
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  -- 현재 윈도우 시작 시각 계산 (윈도우 크기로 floor)
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  -- 카운트 원자적 증가 (없으면 1로 삽입, 있으면 +1)
  INSERT INTO rate_limits (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  -- 만료된 이전 윈도우 정리 (베스트에포트, 실패해도 무관)
  DELETE FROM rate_limits
  WHERE key = p_key
    AND window_start < v_window_start - (p_window_seconds * 2 * INTERVAL '1 second');

  RETURN v_count <= p_limit;
END;
$$;
