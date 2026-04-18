-- 017_atomic_transactions.sql
-- Atomic wrappers for critical multi-step operations that must not partially succeed.

-- ─── 1. IAP 포인트 지급 ────────────────────────────────────────────────────────
-- point_charges 기록 + users.points 업데이트를 단일 트랜잭션으로 처리.
-- 중복 실행 방지: idempotency_key 중복이면 현재 잔액 반환 후 조기 종료.
CREATE OR REPLACE FUNCTION verify_iap_charge(
  p_user_id         UUID,
  p_product_id      TEXT,
  p_amount_krw      INTEGER,
  p_points_to_add   INTEGER,
  p_bonus           INTEGER,
  p_is_first        BOOLEAN,
  p_platform        TEXT,
  p_purchase_token  TEXT,
  p_idempotency_key TEXT
) RETURNS TABLE(
  is_duplicate  BOOLEAN,
  new_balance   INTEGER,
  points_added  INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  v_exists      BOOLEAN;
  v_new_balance INTEGER;
BEGIN
  -- 멱등성 체크 (FOR UPDATE로 동시 실행 방지)
  SELECT EXISTS(
    SELECT 1 FROM point_charges WHERE idempotency_key = p_idempotency_key
  ) INTO v_exists;

  IF v_exists THEN
    SELECT points INTO v_new_balance FROM users WHERE id = p_user_id;
    RETURN QUERY SELECT TRUE, COALESCE(v_new_balance, 0), p_points_to_add;
    RETURN;
  END IF;

  -- 1단계: 충전 기록 먼저 삽입 (고유키 위반 시 전체 롤백)
  INSERT INTO point_charges (
    user_id, product_id, amount_krw, points, bonus,
    is_first, platform, iap_receipt, idempotency_key
  ) VALUES (
    p_user_id, p_product_id, p_amount_krw, p_points_to_add, p_bonus,
    p_is_first, p_platform, p_purchase_token, p_idempotency_key
  );

  -- 2단계: 포인트 + 첫충전 플래그 업데이트
  UPDATE users
  SET
    points           = points + p_points_to_add,
    is_first_charged = CASE WHEN p_is_first THEN TRUE ELSE is_first_charged END
  WHERE id = p_user_id
  RETURNING points INTO v_new_balance;

  RETURN QUERY SELECT FALSE, COALESCE(v_new_balance, 0), p_points_to_add;
END;
$$;


-- ─── 2. 통화 세션 종료 ────────────────────────────────────────────────────────
-- call_sessions 상태 변경 + 소비자 포인트 차감을 단일 트랜잭션으로 처리.
-- 세션이 이미 ended 상태면 멱등적으로 현재 값 반환.
CREATE OR REPLACE FUNCTION end_call_atomic(
  p_session_id    UUID,
  p_ended_at      TIMESTAMPTZ,
  p_duration_sec  INTEGER,
  p_points_charged INTEGER,
  p_consumer_id   UUID,
  p_creator_id    UUID
) RETURNS TABLE(
  already_ended  BOOLEAN,
  points_charged INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- 현재 세션 상태 확인 (FOR UPDATE로 동시 종료 경쟁 방지)
  SELECT status INTO v_current_status
  FROM call_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  -- active가 아닌 모든 상태(NULL=미존재, ended, cancelled, pending) → 안전하게 no-op 반환
  IF v_current_status IS DISTINCT FROM 'active' THEN
    RETURN QUERY SELECT TRUE, p_points_charged;
    RETURN;
  END IF;

  -- 1단계: 세션 종료 처리
  UPDATE call_sessions SET
    status        = 'ended',
    ended_at      = p_ended_at,
    duration_sec  = p_duration_sec,
    points_charged = p_points_charged
  WHERE id = p_session_id;

  -- 2단계: 소비자 포인트 차감 (0 미만 방지)
  IF p_points_charged > 0 THEN
    UPDATE users SET
      points = GREATEST(0, points - p_points_charged)
    WHERE id = p_consumer_id;
  END IF;

  RETURN QUERY SELECT FALSE, p_points_charged;
END;
$$;
