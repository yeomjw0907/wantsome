# DB — creators & creator_profiles

## creators (활동 정보)

```sql
CREATE TABLE creators (
  id               UUID PRIMARY KEY REFERENCES users(id),
  display_name     TEXT NOT NULL,
  bio              TEXT,
  grade            TEXT DEFAULT '신규',         -- 신규|일반|인기|탑
  settlement_rate  NUMERIC DEFAULT 0.75,        -- 정산율 (론칭: 0.75 단일)
  is_online        BOOLEAN DEFAULT FALSE,
  mode_blue        BOOLEAN DEFAULT TRUE,
  mode_red         BOOLEAN DEFAULT FALSE,
  monthly_minutes  INTEGER DEFAULT 0,           -- 월간 누적 통화 분수
  grade_updated    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creators_online ON creators(is_online);
CREATE INDEX idx_creators_grade ON creators(grade);
```

## creator_profiles (온보딩 심사)

```sql
CREATE TABLE creator_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID UNIQUE REFERENCES users(id),
  status               TEXT DEFAULT 'PENDING',
  -- PENDING | APPROVED | REJECTED | SUSPENDED

  -- 프로필
  display_name         TEXT,
  bio                  TEXT,
  profile_image_url    TEXT,
  active_modes         TEXT[],                  -- ['BLUE', 'RED']

  -- 신분증 (크리에이터 인증 뱃지)
  id_card_path         TEXT,                    -- private bucket 경로
  id_card_verified_at  TIMESTAMPTZ,

  -- 계좌 (AES-256 암호화 저장)
  bank_code            VARCHAR(10),
  account_number       TEXT,                    -- 암호화된 값
  account_holder       VARCHAR(20),
  account_verified_at  TIMESTAMPTZ,

  -- 용역계약서 전자서명
  contract_signed_at   TIMESTAMPTZ,
  contract_pdf_path    TEXT,                    -- private bucket 경로
  contract_ip          VARCHAR(45),

  -- 관리자 심사
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  rejection_reason     TEXT,

  created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

## RLS 정책

```sql
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

-- 피드 조회: 모든 인증 유저
CREATE POLICY "creators_read" ON creators FOR SELECT
  USING (auth.role() = 'authenticated');

-- 수정: 본인만
CREATE POLICY "creators_update_self" ON creators FOR UPDATE
  USING (auth.uid() = id);

ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

-- 본인만 조회/수정
CREATE POLICY "creator_profiles_self" ON creator_profiles
  USING (auth.uid() = user_id);
```

## 등급 자동 갱신 (매월 15일 Cron)

```sql
-- 일반: 월 500분+
UPDATE creators SET grade = '일반', settlement_rate = 0.60
WHERE monthly_minutes >= 500 AND monthly_minutes < 1500 AND grade = '신규';

-- 인기: 월 1500분+
UPDATE creators SET grade = '인기', settlement_rate = 0.65
WHERE monthly_minutes >= 1500;

-- 월 초기화
UPDATE creators SET monthly_minutes = 0;
```
