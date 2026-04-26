-- 022_atomic_point_operations.sql
--
-- 동시성 안전한 포인트/재고 차감 함수 추가
--
-- 배경: 기존 코드는 read-modify-write 패턴 (consumer.points - amount)으로
--   동시 요청 시 lost update 가능. 발견된 race condition 위치:
--   - server/app/api/calls/tick/route.ts:145 (분당 차감)
--   - server/app/api/gifts/route.ts:85, 159 (선물)
--   - server/app/api/conversations/route.ts:166 (채팅방 unlock)
--   - server/app/api/orders/route.ts:98, 127 (주문 + 재고)
--
-- 기존 deduct_points는 부족 시 GREATEST(0, points - X)로 무조건 차감 →
-- 사용자 잔액이 의도와 다르게 0으로 떨어짐. 안전한 try_* 함수로 대체.

-- ────────────────────────────────────────────────────────────
-- 1) try_deduct_points: 잔액 충분 시 차감, 부족 시 거절
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION try_deduct_points(
  p_user_id UUID,
  p_amount  INTEGER
) RETURNS TABLE (success BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_balance INTEGER;
  v_current     INTEGER;
BEGIN
  -- 입력 검증
  IF p_amount IS NULL OR p_amount <= 0 THEN
    SELECT points INTO v_current FROM users WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, COALESCE(v_current, 0);
    RETURN;
  END IF;

  -- 원자적 차감: WHERE points >= p_amount 조건이 false면 0 rows updated
  UPDATE users
  SET points = points - p_amount
  WHERE id = p_user_id
    AND points >= p_amount
  RETURNING points INTO v_new_balance;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_new_balance;
  ELSE
    -- 잔액 부족 또는 사용자 미존재
    SELECT points INTO v_current FROM users WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, COALESCE(v_current, 0);
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2) try_decrement_stock: 재고 충분 시 차감, 부족 시 거절
--    (stock = -1은 무제한, 차감 없이 성공)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION try_decrement_stock(
  p_product_id UUID,
  p_quantity   INTEGER
) RETURNS TABLE (success BOOLEAN, new_stock INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_stock     INTEGER;
  v_current_stock INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    SELECT stock INTO v_current_stock FROM products WHERE id = p_product_id;
    RETURN QUERY SELECT FALSE, COALESCE(v_current_stock, 0);
    RETURN;
  END IF;

  -- 무제한 재고 (-1) 우선 처리
  SELECT stock INTO v_current_stock FROM products WHERE id = p_product_id;

  IF v_current_stock IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  IF v_current_stock = -1 THEN
    RETURN QUERY SELECT TRUE, -1;
    RETURN;
  END IF;

  -- 원자적 차감
  UPDATE products
  SET stock = stock - p_quantity
  WHERE id = p_product_id
    AND stock >= p_quantity
  RETURNING stock INTO v_new_stock;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_new_stock;
  ELSE
    RETURN QUERY SELECT FALSE, v_current_stock;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3) increment_stock: 주문 실패 시 재고 원자적 복구 (race-safe rollback)
--    무제한 재고(-1)는 변경 X
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_stock(
  p_product_id UUID,
  p_quantity   INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN;
  END IF;

  UPDATE products
  SET stock = stock + p_quantity
  WHERE id = p_product_id
    AND stock >= 0; -- 무제한 (-1)은 변경 안 함
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 권한: authenticated에는 부여 X (서비스 롤 전용)
-- ────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION try_deduct_points(UUID, INTEGER)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION try_decrement_stock(UUID, INTEGER)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_stock(UUID, INTEGER)      FROM PUBLIC;

-- ────────────────────────────────────────────────────────────
-- 4) 기존 RPC 함수의 search_path 명시 (Phase 10 advisor 'function_search_path_mutable')
--    - 새로 추가된 try_* 함수는 위에서 이미 SET search_path 적용
--    - 결제 critical RPC만 본 PR에서 처리. 나머지 (live_join_deduct_points 등)는 PR-2에서 일괄
-- ────────────────────────────────────────────────────────────
ALTER FUNCTION verify_iap_charge(UUID, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION end_call_atomic(UUID, TIMESTAMPTZ, INTEGER, INTEGER, UUID, UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION deduct_points(UUID, INTEGER, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION add_points(UUID, INTEGER, TEXT)
  SET search_path = public, pg_temp;
