-- 019_creators_missing_columns.sql
-- creators 테이블에 피드/통화 API가 참조하는 누락 컬럼 추가

-- categories: 크리에이터 분위기 태그 (예: ['청순', '큐티'])
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_creators_categories ON creators USING GIN(categories);

-- is_approved: 관리자 승인 여부 (false면 calls/start에서 차단)
-- 기존 크리에이터는 기본 true (소급 승인)
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT TRUE;

-- red_mode 크리에이터 진입 통제를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_creators_approved_online ON creators(is_approved, is_online);
