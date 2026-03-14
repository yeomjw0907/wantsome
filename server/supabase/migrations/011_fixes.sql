-- 011_fixes.sql
-- 1) deduct_points RPC에 p_reason 파라미터 추가 (add_points와 일관성 맞추기)
--    reservations/route.ts가 p_reason 포함해서 호출하는데 기존 함수에 없어 실패하던 문제 수정
CREATE OR REPLACE FUNCTION deduct_points(
  p_user_id UUID,
  p_amount   INTEGER,
  p_reason   TEXT DEFAULT ''
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE users
  SET points = GREATEST(0, points - p_amount)
  WHERE id = p_user_id;
END;
$$;

-- 2) point_charges에 status 컬럼 추가
--    어드민 대시보드가 WHERE status = 'PAID' 로 매출 집계하는데 컬럼 없어 42703 에러 발생
ALTER TABLE point_charges
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';
