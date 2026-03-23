-- 015_points_function_guards.sql
-- Ensure point-credit flows do not depend on ad-hoc database setup.

CREATE OR REPLACE FUNCTION add_points(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT ''
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE users
  SET points = points + GREATEST(p_amount, 0)
  WHERE id = p_user_id;
END;
$$;
