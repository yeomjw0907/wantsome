-- 035_atomic_creator_minutes.sql
--
-- creators.monthly_minutes에 atomic 증가 RPC 추가
--
-- 발견된 문제 (PR-1.5 hotfix, AI 재검수 H1):
--   server/app/api/calls/tick/route.ts:117-120
--   read-then-write 패턴: SELECT monthly_minutes → +minutes → UPDATE
--   동시에 두 세션이 종료되면 한쪽 증가분이 lost-update로 사라짐.
--   정산은 points_charged로 계산되어 영향 없으나, 등급/할당량 계산이 undercount됨.

CREATE OR REPLACE FUNCTION add_creator_minutes(
  p_creator_id UUID,
  p_minutes INTEGER
)
RETURNS TABLE(new_total INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RETURN QUERY SELECT COALESCE(monthly_minutes, 0) FROM creators WHERE id = p_creator_id;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE creators
  SET monthly_minutes = COALESCE(monthly_minutes, 0) + p_minutes
  WHERE id = p_creator_id
  RETURNING monthly_minutes;
END;
$$;

REVOKE ALL ON FUNCTION add_creator_minutes(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_creator_minutes(UUID, INTEGER) TO service_role;
