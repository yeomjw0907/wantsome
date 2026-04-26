-- 033_live_end_with_refund.sql
--
-- 라이브 종료 + 환불 통합 RPC (race-safe + audit log)
--
-- 발견된 문제 (PR-4 AI 리뷰 Critical/Should-fix):
--   1) live/end 가 status='ended' 마크 후 환불 RPC 호출 — 사이에 join 가능
--      → 시청자가 ended 직전에 join 해서 차감되고 환불 못 받는 race
--   2) live_refund_viewers RPC 가 audit log 없음 — 사용자 측 잔액 변동 추적 불가
--
-- 해결:
--   하나의 SECURITY DEFINER 함수로 lock → status 마크 → 환불 → audit 모두 처리

CREATE OR REPLACE FUNCTION live_end_with_refund(
  p_room_id  UUID,
  p_actor_id UUID
) RETURNS TABLE(
  prev_status     TEXT,
  refunded_count  INTEGER,
  total_refunded  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_total INTEGER := 0;
  v_prev_status TEXT;
  participant RECORD;
BEGIN
  -- 1) 라이브룸 row lock + 현재 status 확인
  SELECT status INTO v_prev_status
  FROM live_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF v_prev_status IS NULL THEN
    RAISE EXCEPTION 'room not found: %', p_room_id;
  END IF;

  -- 이미 종료된 방은 멱등 응답
  IF v_prev_status NOT IN ('ready', 'live') THEN
    RETURN QUERY SELECT v_prev_status, 0, 0;
    RETURN;
  END IF;

  -- 2) status 마크 — 이 시점 이후 join은 'live' 체크 실패로 거절됨
  UPDATE live_rooms
  SET status = 'ended', ended_at = NOW()
  WHERE id = p_room_id;

  -- 3) viewer 환불 (FOR UPDATE 행 잠금 + audit)
  FOR participant IN
    SELECT user_id, paid_points
    FROM live_room_participants
    WHERE room_id = p_room_id
      AND role = 'viewer'
      AND status = 'joined'
      AND COALESCE(refund_status, 'none') = 'none'
      AND COALESCE(paid_points, 0) > 0
    FOR UPDATE
  LOOP
    -- 포인트 복구
    UPDATE users
    SET points = points + participant.paid_points
    WHERE id = participant.user_id;

    -- 참가자 마크
    UPDATE live_room_participants
    SET refund_status = 'refunded',
        status = 'left',
        left_at = NOW()
    WHERE room_id = p_room_id AND user_id = participant.user_id;

    -- audit log (잔액 변동 추적)
    INSERT INTO admin_logs (action, target_type, target_id, detail)
    VALUES (
      'LIVE_REFUND',
      'live_room_participant',
      p_room_id::text || ':' || participant.user_id::text,
      jsonb_build_object(
        'room_id',     p_room_id,
        'user_id',     participant.user_id,
        'paid_points', participant.paid_points,
        'actor_id',    p_actor_id
      )
    );

    v_count := v_count + 1;
    v_total := v_total + participant.paid_points;
  END LOOP;

  -- 4) 남은 참가자(host/admin) left 마크
  UPDATE live_room_participants
  SET status = 'left', left_at = NOW()
  WHERE room_id = p_room_id AND status = 'joined';

  RETURN QUERY SELECT v_prev_status, v_count, v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION live_end_with_refund(UUID, UUID) FROM PUBLIC;
