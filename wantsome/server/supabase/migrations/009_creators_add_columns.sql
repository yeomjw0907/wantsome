-- 009_creators_add_columns.sql
-- creators 테이블에 누락된 컬럼 추가
-- is_busy: 통화 중 여부 (call start/end 라우트에서 사용)
-- total_calls: 누적 통화 수 (어드민 크리에이터 목록 표시)
-- total_earnings: 누적 수익 포인트 (어드민 크리에이터 목록 표시)

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS is_busy        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_calls    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings INTEGER NOT NULL DEFAULT 0;
