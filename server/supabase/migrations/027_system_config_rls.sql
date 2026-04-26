-- 027_system_config_rls.sql
--
-- system_config 테이블 RLS 활성화
--
-- 발견된 문제 (Phase 1A Critical R3 + Phase 10 advisor ERROR):
--   001_initial.sql 에 ALTER TABLE ... ENABLE ROW LEVEL SECURITY 누락
--   → anon key로 누구나 SELECT/INSERT/UPDATE/DELETE 가능
--   → dm_unlock_points = 0, maintenance_mode = 'true' 등 운영값 임의 변조
--
-- 해결:
--   1) RLS enable
--   2) 인증 여부 무관 SELECT 허용 (앱 시작 시 maintenance/version 조회 필요)
--   3) INSERT/UPDATE/DELETE는 service_role 전용 (정책 없음)

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 SELECT (anon 포함) — 점검·버전 정보 등 공개 OK
DROP POLICY IF EXISTS "system_config_public_read" ON system_config;
CREATE POLICY "system_config_public_read" ON system_config FOR SELECT
  USING (TRUE);

-- INSERT / UPDATE / DELETE 정책 없음 → service_role 전용
-- (어드민 페이지 변경 시 반드시 server admin API 경유)

-- ────────────────────────────────────────────────────────────
-- 추가: 다른 INFO 레벨 advisor 항목 정리
-- (rls_enabled_no_policy 의도된 항목들에 명시 정책 추가)
-- ────────────────────────────────────────────────────────────

-- point_charges: service_role 전용 (의도된 동작 — 명시화)
-- 정책 자체는 추가 안 함 (어차피 service_role만 접근). RLS는 이미 enabled.

-- rate_limits: 028에서 처리
-- admin_logs / push_logs / ci_blacklist: 의도된 service_role 전용
-- creator_availability: 어드민 + 본인만 SELECT 정책 검토 필요 → 별도 PR
