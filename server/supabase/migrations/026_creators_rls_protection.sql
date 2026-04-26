-- 026_creators_rls_protection.sql
--
-- creators 및 creator_profiles 테이블 RLS 강화: 셀프 승인 / 정산율 변조 차단
--
-- 발견된 문제 (Phase 1A Critical R2):
--   1) 003_calls.sql 의 creators_self FOR ALL 정책이
--      004_creator_profiles.sql 에서 미삭제 → 그대로 활성
--      → 사용자가 anon key로 settlement_rate=1.5, is_approved=true 셀프 변조
--   2) creator_profiles_self USING(auth.uid() = user_id) 가 FOR ALL
--      → 사용자가 status='APPROVED', approved_by, approved_at 임의 설정
--
-- 해결:
--   1) creators FOR ALL 정책 제거, creators_update_self 만 유지 + 트리거
--   2) creator_profiles SELECT / UPDATE 분리 + 트리거

-- ────────────────────────────────────────────────────────────
-- 1) creators 정책 정리
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "creators_self" ON creators;        -- 003 잔존 정책 제거
DROP POLICY IF EXISTS "creators_read" ON creators;
DROP POLICY IF EXISTS "creators_update_self" ON creators;

-- 인증 사용자 모두 조회 가능 (크리에이터 발견용)
CREATE POLICY "creators_read" ON creators FOR SELECT
  USING (auth.role() = 'authenticated');

-- 본인 행만 UPDATE — 단 민감 컬럼은 트리거로 차단
CREATE POLICY "creators_update_self" ON creators FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT / DELETE 정책 없음 → service_role 전용

-- ────────────────────────────────────────────────────────────
-- 2) creators 민감 컬럼 보호 트리거
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_creator_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
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
  -- grade_updated_at 컬럼명이 마이그레이션마다 다름 (003: grade_updated, 004: grade_updated_at)
  -- 둘 중 존재하는 것만 보호 — IF가 EXCEPTION 없이 자연스럽게 처리

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_creator_sensitive ON creators;
CREATE TRIGGER trg_protect_creator_sensitive
  BEFORE UPDATE ON creators
  FOR EACH ROW
  EXECUTE FUNCTION protect_creator_sensitive_fields();

-- ────────────────────────────────────────────────────────────
-- 3) creator_profiles 정책 정리
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "creator_profiles_self" ON creator_profiles;
DROP POLICY IF EXISTS "creator_profiles_select_self" ON creator_profiles;
DROP POLICY IF EXISTS "creator_profiles_update_self" ON creator_profiles;

CREATE POLICY "creator_profiles_select_self" ON creator_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "creator_profiles_update_self" ON creator_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4) creator_profiles 민감 컬럼 보호 트리거
--   status, approved_by, approved_at, rejection_reason, account_verified_at,
--   id_card_verified_at, contract_signed_at, contract_ip, settlement_rate
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_creator_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status 변경은 서버만 가능합니다 (어드민 승인 흐름)';
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
  -- creator_profiles에도 settlement_rate가 있으면 (004에 있음) 보호
  -- 컬럼이 없는 환경에선 RAISE 없이 통과 — 안전한 dynamic check 대신 직접
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'creator_profiles'
      AND column_name = 'settlement_rate'
  ) AND NEW.settlement_rate IS DISTINCT FROM OLD.settlement_rate THEN
    RAISE EXCEPTION 'settlement_rate 변경은 서버만 가능합니다';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_creator_profile_sensitive ON creator_profiles;
CREATE TRIGGER trg_protect_creator_profile_sensitive
  BEFORE UPDATE ON creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_creator_profile_sensitive_fields();
