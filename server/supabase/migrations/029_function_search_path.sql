-- 029_function_search_path.sql
--
-- 나머지 RPC 함수에 search_path 명시
--
-- 발견된 문제 (Phase 10 advisor 'function_search_path_mutable'):
--   SECURITY DEFINER 함수가 search_path를 명시하지 않으면
--   caller가 search_path를 조작해 동일 이름의 악성 함수로 redirect 가능
--
-- 이미 처리된 함수 (PR-1 022 + PR-2 028):
--   verify_iap_charge, end_call_atomic, deduct_points(UUID,INTEGER,TEXT),
--   add_points(UUID,INTEGER,TEXT), check_rate_limit
--
-- 본 마이그레이션에서 처리:
--   deduct_points(UUID, INTEGER)  — 005, 2-arg overload
--   increment_user_points          — 014
--   live_join_room                 — 014

ALTER FUNCTION deduct_points(UUID, INTEGER)
  SET search_path = public, pg_temp;

ALTER FUNCTION increment_user_points(UUID, INTEGER)
  SET search_path = public, pg_temp;

ALTER FUNCTION live_join_room(UUID, UUID, BOOLEAN)
  SET search_path = public, pg_temp;

-- ────────────────────────────────────────────────────────────
-- Supabase Studio에서 직접 만든 함수 (이 repo에 SQL 정의 없음)
--   advisor에서 발견됐으나 시그니처 미상 → 사용자가 Studio에서 ALTER
--
-- USER-TODO 항목 #17 참조:
--   - handle_new_user(...)
--   - update_creator_avg_rating(...)
--   - live_join_deduct_points(...) — live_join_room의 별도 함수일 수 있음
--
-- Studio → SQL Editor 에서 실행:
--   select pg_get_functiondef(oid) from pg_proc where proname = 'handle_new_user';
--   → 결과의 함수 시그니처를 보고 ALTER FUNCTION ... SET search_path = public, pg_temp;
-- ────────────────────────────────────────────────────────────
