-- 034_reports_live_room.sql
--
-- reports 테이블에 live_room_id 컬럼 추가 + LIVE_HARASSMENT 카테고리
--
-- 발견된 문제 (Phase 1D Critical / Apple 1.4.1):
--   라이브 콘텐츠 신고를 reports 테이블에 매핑할 컬럼 없음
--   → 라이브 도중 시청자가 호스트/다른 시청자 신고 불가능 → UGC 가이드 위반

-- 1) live_room_id 컬럼 추가
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS live_room_id UUID REFERENCES live_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_live_room ON reports(live_room_id)
  WHERE live_room_id IS NOT NULL;

-- 2) LIVE_HARASSMENT 카테고리 추가 (라이브 채팅 욕설/괴롭힘)
ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_category_check;

ALTER TABLE reports
  ADD CONSTRAINT reports_category_check
  CHECK (category IN (
    'UNDERAGE', 'ILLEGAL_RECORD', 'PROSTITUTION',
    'HARASSMENT', 'FRAUD', 'LIVE_HARASSMENT', 'SPAM', 'OTHER'
  ));
