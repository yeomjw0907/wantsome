# DB — users & ci_blacklist

## users

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT UNIQUE,                    -- PASS 인증 완료 번호
  nickname      TEXT NOT NULL,
  profile_img   TEXT,                           -- Supabase Storage URL
  role          TEXT DEFAULT 'consumer',        -- consumer | creator | both
  -- 본인인증
  is_verified   BOOLEAN DEFAULT FALSE,
  ci            TEXT UNIQUE,                    -- 연계정보 (중복가입 방지)
  birth_date    DATE,                           -- 연령 체크용
  verified_name TEXT,
  verified_at   TIMESTAMPTZ,
  -- 모드
  blue_mode     BOOLEAN DEFAULT TRUE,
  red_mode      BOOLEAN DEFAULT FALSE,          -- 프리미엄(red) 동의 여부
  -- 포인트
  points        INTEGER DEFAULT 0,
  -- 첫충전
  first_charge_deadline TIMESTAMPTZ,           -- 가입 후 72시간
  is_first_charged      BOOLEAN DEFAULT FALSE,
  -- 메타
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_users_ci ON users(ci);
CREATE INDEX idx_users_phone ON users(phone);
```

## ci_blacklist

```sql
CREATE TABLE ci_blacklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci         TEXT UNIQUE NOT NULL,   -- 영구 정지된 유저의 CI
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## RLS 정책

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 본인만 조회/수정 가능
CREATE POLICY "users_self" ON users
  USING (auth.uid() = id);

-- ci_blacklist는 서버사이드(service_role)만 접근
ALTER TABLE ci_blacklist ENABLE ROW LEVEL SECURITY;
```
