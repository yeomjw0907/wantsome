-- 030_rls_trigger_fixes.sql
--
-- PR-2 AI 리뷰 발견 사항 fix
--
-- [Critical 1] 트리거의 service_role 우회 체크 부정확
--   기존: current_setting('role', true) = 'service_role'
--   문제: PostgREST가 SET LOCAL role을 했을 때만 작동
--         서버 RPC가 다른 컨텍스트로 호출되면 잘못된 EXCEPTION
--   해결: Supabase 표준 auth.role() = 'service_role' 사용 + 다중 체크
--
-- [개선 2] 트리거 SECURITY DEFINER → SECURITY INVOKER
--   RAISE EXCEPTION만 하므로 invoker 권한으로 충분
--   DEFINER는 search_path 공격 노출면 증가 (명시했지만 원칙적으로 INVOKER 권장)
--
-- [개선 3] creators 트리거에 grade_updated / grade_updated_at 추가
--   003: grade_updated, 004: grade_updated_at 컬럼 — 둘 다 보호

-- ────────────────────────────────────────────────────────────
-- 1) users 트리거 재정의 — auth.role() 사용 + INVOKER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_user_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- service_role 우회 (다중 체크로 견고하게)
  IF auth.role() = 'service_role'
     OR current_setting('role', true) = 'service_role'
     OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

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

-- ────────────────────────────────────────────────────────────
-- 2) creators 트리거 재정의 — auth.role() + grade_updated 추가 + INVOKER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_creator_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('role', true) = 'service_role'
     OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.settlement_rate IS DISTINCT FROM OLD.settlement_rate THEN
    RAISE EXCEPTION 'settlement_rate 변경은 서버만 가능합니다';
  END IF;
  IF NEW.grade IS DISTINCT FROM OLD.grade THEN
    RAISE EXCEPTION 'grade 변경은 서버만 가능합니다';
  END IF;
  IF NEW.monthly_minutes IS DISTINCT FROM OLD.monthly_minutes THEN
    RAISE EXCEPTION 'monthly_minutes 변경은 서버만 가능합니다';
  END IF;

  -- grade_updated (003) / grade_updated_at (004) 둘 중 존재하는 컬럼 동적 보호
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'creators' AND column_name = 'grade_updated'
  ) AND to_jsonb(NEW)->>'grade_updated' IS DISTINCT FROM to_jsonb(OLD)->>'grade_updated' THEN
    RAISE EXCEPTION 'grade_updated 변경은 서버만 가능합니다';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'creators' AND column_name = 'grade_updated_at'
  ) AND to_jsonb(NEW)->>'grade_updated_at' IS DISTINCT FROM to_jsonb(OLD)->>'grade_updated_at' THEN
    RAISE EXCEPTION 'grade_updated_at 변경은 서버만 가능합니다';
  END IF;

  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3) creator_profiles 트리거 재정의 — auth.role() + INVOKER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_creator_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('role', true) = 'service_role'
     OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status 변경은 서버만 가능합니다';
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'approved_by 변경은 서버만 가능합니다';
  END IF;
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'approved_at 변경은 서버만 가능합니다';
  END IF;
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'rejection_reason 변경은 서버만 가능합니다';
  END IF;
  IF NEW.id_card_verified_at IS DISTINCT FROM OLD.id_card_verified_at THEN
    RAISE EXCEPTION 'id_card_verified_at 변경은 서버만 가능합니다';
  END IF;
  IF NEW.account_verified_at IS DISTINCT FROM OLD.account_verified_at THEN
    RAISE EXCEPTION 'account_verified_at 변경은 서버만 가능합니다';
  END IF;
  IF NEW.contract_signed_at IS DISTINCT FROM OLD.contract_signed_at THEN
    RAISE EXCEPTION 'contract_signed_at 변경은 서버만 가능합니다';
  END IF;
  IF NEW.contract_ip IS DISTINCT FROM OLD.contract_ip THEN
    RAISE EXCEPTION 'contract_ip 변경은 서버만 가능합니다';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'creator_profiles' AND column_name = 'settlement_rate'
  ) AND to_jsonb(NEW)->>'settlement_rate' IS DISTINCT FROM to_jsonb(OLD)->>'settlement_rate' THEN
    RAISE EXCEPTION 'settlement_rate 변경은 서버만 가능합니다';
  END IF;

  RETURN NEW;
END;
$$;
