-- 014_live_runtime_fixes.sql
-- live runtime fixes:
-- 1) point refund helper
-- 2) atomic live join helper for seat limit + point deduction + participant upsert

CREATE OR REPLACE FUNCTION increment_user_points(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS TABLE(success BOOLEAN, remaining_points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points INTEGER;
BEGIN
  UPDATE users
  SET points = points + GREATEST(p_amount, 0)
  WHERE id = p_user_id
  RETURNING points INTO v_points;

  RETURN QUERY SELECT TRUE, COALESCE(v_points, 0);
END;
$$;

CREATE OR REPLACE FUNCTION live_join_room(
  p_room_id UUID,
  p_user_id UUID,
  p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  success BOOLEAN,
  error_code TEXT,
  charged_points INTEGER,
  remaining_points INTEGER,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room live_rooms%ROWTYPE;
  v_participant live_room_participants%ROWTYPE;
  v_role TEXT := CASE WHEN p_is_admin THEN 'admin' ELSE 'viewer' END;
  v_now TIMESTAMPTZ := NOW();
  v_points INTEGER := 0;
  v_charge INTEGER := 0;
  v_viewer_count INTEGER := 0;
  v_participant_exists BOOLEAN := FALSE;
  v_already_paid BOOLEAN := FALSE;
  v_is_currently_joined BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_room
  FROM live_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'ROOM_NOT_FOUND', 0, NULL::INTEGER, v_role;
    RETURN;
  END IF;

  IF v_room.status <> 'live' THEN
    RETURN QUERY SELECT FALSE, 'ROOM_NOT_LIVE', 0, NULL::INTEGER, v_role;
    RETURN;
  END IF;

  IF v_room.agora_channel IS NULL OR LENGTH(TRIM(v_room.agora_channel)) = 0 THEN
    RETURN QUERY SELECT FALSE, 'CHANNEL_NOT_READY', 0, NULL::INTEGER, v_role;
    RETURN;
  END IF;

  SELECT *
  INTO v_participant
  FROM live_room_participants
  WHERE room_id = p_room_id
    AND user_id = p_user_id
  FOR UPDATE;

  v_participant_exists := FOUND;
  v_already_paid := v_participant_exists
    AND COALESCE(v_participant.paid_points, 0) > 0
    AND COALESCE(v_participant.refund_status, 'none') <> 'refunded';
  v_is_currently_joined := v_participant_exists AND v_participant.status = 'joined';

  IF v_participant_exists
     AND v_participant.status = 'kicked'
     AND COALESCE(v_participant.blocked_until_room_end, FALSE) THEN
    RETURN QUERY SELECT FALSE, 'KICKED', 0, NULL::INTEGER, v_role;
    RETURN;
  END IF;

  IF v_role = 'viewer' THEN
    IF NOT v_is_currently_joined THEN
      SELECT COUNT(*)
      INTO v_viewer_count
      FROM live_room_participants
      WHERE room_id = p_room_id
        AND role = 'viewer'
        AND status = 'joined';

      IF v_viewer_count >= v_room.viewer_limit THEN
        RETURN QUERY SELECT FALSE, 'ROOM_FULL', 0, NULL::INTEGER, v_role;
        RETURN;
      END IF;
    END IF;

    SELECT points
    INTO v_points
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT v_already_paid THEN
      v_charge := v_room.entry_fee_points;

      IF COALESCE(v_points, 0) < v_charge THEN
        RETURN QUERY SELECT FALSE, 'INSUFFICIENT_POINTS', 0, COALESCE(v_points, 0), v_role;
        RETURN;
      END IF;

      UPDATE users
      SET points = points - v_charge
      WHERE id = p_user_id
      RETURNING points INTO v_points;
    END IF;
  ELSE
    SELECT points
    INTO v_points
    FROM users
    WHERE id = p_user_id;
  END IF;

  INSERT INTO live_room_participants (
    room_id,
    user_id,
    role,
    status,
    paid_points,
    joined_at,
    left_at,
    join_ack_at,
    blocked_until_room_end,
    refund_status
  )
  VALUES (
    p_room_id,
    p_user_id,
    v_role,
    'joined',
    CASE
      WHEN v_role = 'admin' THEN 0
      WHEN v_already_paid THEN COALESCE(v_participant.paid_points, 0)
      ELSE v_charge
    END,
    v_now,
    NULL,
    NULL,
    FALSE,
    'none'
  )
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    status = 'joined',
    paid_points = CASE
      WHEN EXCLUDED.role = 'admin' THEN live_room_participants.paid_points
      WHEN v_already_paid THEN live_room_participants.paid_points
      ELSE EXCLUDED.paid_points
    END,
    joined_at = EXCLUDED.joined_at,
    left_at = NULL,
    join_ack_at = NULL,
    blocked_until_room_end = FALSE,
    refund_status = 'none';

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_charge, COALESCE(v_points, 0), v_role;
END;
$$;
