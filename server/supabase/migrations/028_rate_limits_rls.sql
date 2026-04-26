-- 028_rate_limits_rls.sql
--
-- rate_limits 테이블 RLS 활성화 + check_rate_limit search_path 명시
--
-- 발견된 문제 (Phase 1A Critical R5):
--   1) 018_rate_limits.sql 에 ALTER TABLE ... ENABLE ROW LEVEL SECURITY 누락
--      → anon이 직접 row INSERT/UPDATE/DELETE로 카운트 리셋 가능
--      → 결제 검증 5회/h 제한 우회 가능
--   2) check_rate_limit 함수 SECURITY DEFINER + search_path 미설정
--      (Phase 10 advisor 'function_search_path_mutable')
--
-- 해결:
--   1) RLS enable (정책 없음 → service_role 전용)
--   2) check_rate_limit 함수에 SECURITY DEFINER + SET search_path 명시

-- ────────────────────────────────────────────────────────────
-- 1) RLS 활성화
-- ────────────────────────────────────────────────────────────
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 정책 추가 안 함 → anon/authenticated 모두 차단
-- check_rate_limit RPC는 SECURITY DEFINER로 우회

-- ────────────────────────────────────────────────────────────
-- 2) check_rate_limit 함수 search_path + SECURITY DEFINER 명시
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO rate_limits (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  DELETE FROM rate_limits
  WHERE key = p_key
    AND window_start < v_window_start - (p_window_seconds * 2 * INTERVAL '1 second');

  RETURN v_count <= p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
