-- 032_live_refund_viewers.sql
--
-- 라이브룸 종료 시 시청자 입장료 환불 RPC
--
-- 발견된 문제 (Phase 1D Critical):
--   호스트/어드민 강제 종료 시 시청자가 입장료(현행 5,000P) 그대로 잃음
--   분쟁 + 신뢰 손상 위험. 자동 환불 RPC 누락
--
-- 정책 v1:
--   - 호스트가 라이브 종료(end POST) 시 모든 joined 시청자 전액 환불
--   - 어드민 강제 종료 시도 동일 (별도 admin/api/live/rooms/[id]/end)
--   - 환불 단위는 paid_points 그대로 (부분 환불 X)
--   - 멱등성: 이미 refunded 인 참가자는 재환불 X

CREATE OR REPLACE FUNCTION live_refund_viewers(p_room_id UUID)
RETURNS TABLE(refunded_count INTEGER, total_refunded INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_total INTEGER := 0;
  participant RECORD;
BEGIN
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
    -- 포인트 복구 (atomic)
    UPDATE users
    SET points = points + participant.paid_points
    WHERE id = participant.user_id;

    -- 참가자 refund_status 마크 + status 'left'
    UPDATE live_room_participants
    SET refund_status = 'refunded',
        status = 'left',
        left_at = NOW()
    WHERE room_id = p_room_id
      AND user_id = participant.user_id;

    v_count := v_count + 1;
    v_total := v_total + participant.paid_points;
  END LOOP;

  RETURN QUERY SELECT v_count, v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION live_refund_viewers(UUID) FROM PUBLIC;
