-- 021_settlement_rate_to_35.sql
--
-- 정산 정책 v1: settlement_rate default 0.5 → 0.35
--
-- 배경:
--   현재 코드/DB의 settlement_rate=0.5는 "사용자 결제 P × 50%"이라
--   회사가 Apple/Google 수수료(30%) 100% 흡수 → 회사 net 분당 마진 박빙
--
-- 변경:
--   settlement_rate = 0.35
--   = "사용자 결제 P × 35%"
--   = Apple/Google 30% 차감 후 net에서 회사·인플 50/50 분배
--
-- 인플 측 메시지: "수수료 차감 후 회사와 50:50 분배" (거짓 아님)
--
-- 변경 적용 범위:
--   기존 0.5로 설정된 크리에이터만 0.35로 변경
--   특별 계약(예: 0.7) 또는 등급별 차등(향후 PR-8) 값은 보존

-- 1) creators 테이블 default 변경 (016에서 0.5로 변경된 것)
ALTER TABLE creators
  ALTER COLUMN settlement_rate SET DEFAULT 0.35;

UPDATE creators
SET settlement_rate = 0.35
WHERE settlement_rate IS NULL
   OR settlement_rate = 0.5;

-- 2) creator_profiles 테이블 default 변경 (004에서 0.5로 설정됨)
ALTER TABLE creator_profiles
  ALTER COLUMN settlement_rate SET DEFAULT 0.35;

UPDATE creator_profiles
SET settlement_rate = 0.35
WHERE settlement_rate IS NULL
   OR settlement_rate = 0.5;

-- 검증 쿼리 (실행 후 확인용 — 주석)
-- SELECT settlement_rate, COUNT(*) FROM creators GROUP BY 1;
-- SELECT settlement_rate, COUNT(*) FROM creator_profiles GROUP BY 1;
