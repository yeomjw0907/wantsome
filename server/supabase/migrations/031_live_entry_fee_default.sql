-- 031_live_entry_fee_default.sql
--
-- 라이브룸 입장료 정책 v1 반영: 50,000P → 5,000P
--
-- 배경 (Phase 1D 발견):
--   server/lib/live.ts 의 LIVE_ENTRY_FEE_POINTS = 50000 은 ₩50,000으로 너무 비쌈
--   캠톡·SOOP 라이브 평균 입장료(0~5,000원)와 격차 큼 → 진입 장벽
--   정책 [docs/launch-readiness/00-pricing-policy.md] G섹션 권장 5,000P
--
-- 변경:
--   1) lib/live.ts 상수 변경 (코드 PR-4 c3 commit)
--   2) system_config.live_entry_fee_points = '5000' 등록 (DB가 truth source)

INSERT INTO system_config (key, value, updated_at)
VALUES ('live_entry_fee_points', '5000', NOW())
ON CONFLICT (key) DO UPDATE
  SET value = '5000',
      updated_at = NOW()
  WHERE system_config.value IN ('50000', '');
-- WHERE 조건: 이미 운영자가 다른 값으로 설정했다면 그 값 보존
