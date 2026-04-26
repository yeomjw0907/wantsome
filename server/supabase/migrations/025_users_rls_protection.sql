-- 025_users_rls_protection.sql
--
-- users 테이블 RLS 강화: 민감 컬럼 셀프 변조 차단
--
-- 발견된 문제 (Phase 1A Critical R1):
--   기존 정책: CREATE POLICY "users_self" ON users FOR ALL USING (auth.uid() = id);
--   → 사용자가 anon key로 자기 행의 모든 컬럼 변경 가능
--   → points = 999999999, role = 'admin', is_verified = true,
--     red_mode = true, suspended_until = NULL 등 임의 변조
--
-- 해결:
--   1) RLS 정책을 SELECT / UPDATE 분리 (INSERT/DELETE는 service_role만)
--   2) BEFORE UPDATE TRIGGER로 민감 컬럼 변경 차단 (service_role 우회)

-- ────────────────────────────────────────────────────────────
-- 1) 기존 FOR ALL 정책 제거, SELECT / UPDATE 분리
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_self" ON users;
DROP POLICY IF EXISTS "users_select_self" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;

CREATE POLICY "users_select_self" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT / DELETE 정책 없음 → service_role 전용
-- (phone-login 등 서버는 createSupabaseAdmin() 사용)

-- ────────────────────────────────────────────────────────────
-- 2) 민감 컬럼 변경 차단 트리거
--
-- 사용자가 nickname / profile_img / phone 정도는 직접 변경 가능하나
-- points / role / is_verified / red_mode / blue_mode / is_first_charged /
-- first_charge_deadline / suspended_until / ci / verified_* / birth_date /
-- deleted_at 은 서버(service_role)만 변경 가능
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_user_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- service_role은 모든 변경 허용 (서버 RPC, admin API 등)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- authenticated (일반 사용자)의 자기 행 UPDATE — 민감 컬럼 차단
  IF NEW.points          IS DISTINCT FROM OLD.points          THEN
    RAISE EXCEPTION 'points 변경은 서버만 가능합니다';
  END IF;
  IF NEW.role            IS DISTINCT FROM OLD.role            THEN
    RAISE EXCEPTION 'role 변경은 서버만 가능합니다';
  END IF;
  IF NEW.is_verified     IS DISTINCT FROM OLD.is_verified     THEN
    RAISE EXCEPTION 'is_verified 변경은 서버만 가능합니다';
  END IF;
  IF NEW.red_mode        IS DISTINCT FROM OLD.red_mode        THEN
    RAISE EXCEPTION 'red_mode 변경은 서버만 가능합니다';
  END IF;
  IF NEW.blue_mode       IS DISTINCT FROM OLD.blue_mode       THEN
    RAISE EXCEPTION 'blue_mode 변경은 서버만 가능합니다';
  END IF;
  IF NEW.is_first_charged IS DISTINCT FROM OLD.is_first_charged THEN
    RAISE EXCEPTION 'is_first_charged 변경은 서버만 가능합니다';
  END IF;
  IF NEW.first_charge_deadline IS DISTINCT FROM OLD.first_charge_deadline THEN
    RAISE EXCEPTION 'first_charge_deadline 변경은 서버만 가능합니다';
  END IF;
  IF NEW.suspended_until IS DISTINCT FROM OLD.suspended_until THEN
    RAISE EXCEPTION 'suspended_until 변경은 서버만 가능합니다';
  END IF;
  IF NEW.ci              IS DISTINCT FROM OLD.ci              THEN
    RAISE EXCEPTION 'ci 변경은 서버만 가능합니다';
  END IF;
  IF NEW.verified_name   IS DISTINCT FROM OLD.verified_name   THEN
    RAISE EXCEPTION 'verified_name 변경은 서버만 가능합니다';
  END IF;
  IF NEW.verified_at     IS DISTINCT FROM OLD.verified_at     THEN
    RAISE EXCEPTION 'verified_at 변경은 서버만 가능합니다';
  END IF;
  IF NEW.birth_date      IS DISTINCT FROM OLD.birth_date      THEN
    RAISE EXCEPTION 'birth_date 변경은 서버만 가능합니다';
  END IF;
  IF NEW.deleted_at      IS DISTINCT FROM OLD.deleted_at      THEN
    RAISE EXCEPTION 'deleted_at 변경은 서버만 가능합니다';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_sensitive ON users;
CREATE TRIGGER trg_protect_user_sensitive
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION protect_user_sensitive_fields();
