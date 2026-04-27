-- 010_users_add_email.sql
-- users 테이블에 email 컬럼 추가
-- admin API에서 users.email을 쿼리하지만 컬럼이 없어 500 에러 발생하던 문제 해결

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- 실제 Supabase Auth 사용자는 auth.users에서 이메일 복사
UPDATE users u
SET email = au.email
FROM auth.users au
WHERE u.id = au.id;

-- 더미 사용자들(auth.users에 없음)은 닉네임 기반 테스트 이메일 생성
UPDATE users
SET email = REPLACE(nickname, ' ', '') || '@test.com'
WHERE email IS NULL;
