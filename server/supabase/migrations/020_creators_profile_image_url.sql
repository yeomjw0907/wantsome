-- 020_creators_profile_image_url.sql
-- creators 테이블에 profile_image_url 컬럼 추가
-- feed / ranking / search / live / posts 등 다수 API가 참조하나 컬럼 미존재로 쿼리 실패하던 문제 수정
-- users.profile_img와 별도로 크리에이터 전용 프로필 이미지 저장 (없으면 users.profile_img 폴백)
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
