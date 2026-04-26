-- 023_disable_first_charge_event.sql
--
-- 첫충전 보너스 이벤트 비활성 (정책 변경, 2026-04-26)
--
-- 변경:
--   - 모든 사용자의 first_charge_deadline → NULL
--   - is_first_charged 컬럼은 그대로 (히스토리 보존)
--
-- 컬럼은 DROP하지 않음 — 향후 이벤트 재개 시 코드 복원만으로 동작
-- (DROP 후 ADD COLUMN은 백필 비용 + 다운타임 위험)

UPDATE users
SET first_charge_deadline = NULL
WHERE first_charge_deadline IS NOT NULL;
