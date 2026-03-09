# DB — call_sessions & reservations

## call_sessions

```sql
CREATE TABLE call_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID REFERENCES users(id),
  creator_id      UUID REFERENCES creators(id),
  agora_channel   TEXT NOT NULL,               -- Agora 채널명
  mode            TEXT NOT NULL,               -- 'blue' | 'red'
  status          TEXT DEFAULT 'active',       -- active | ended | cancelled
  per_min_rate    INTEGER NOT NULL,            -- 900 or 1300
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_sec    INTEGER DEFAULT 0,
  points_charged  INTEGER DEFAULT 0,           -- 최종 차감 포인트
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_status ON call_sessions(status);
CREATE INDEX idx_sessions_consumer ON call_sessions(consumer_id);
CREATE INDEX idx_sessions_creator ON call_sessions(creator_id);
```

## reservations

```sql
CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID REFERENCES users(id),
  creator_id      UUID REFERENCES creators(id),
  reserved_at     TIMESTAMPTZ NOT NULL,        -- 예약 시간
  duration_min    INTEGER NOT NULL,            -- 30 | 60
  deposit_points  INTEGER NOT NULL,            -- 예약금 차감 포인트
  -- 30분: 5,000P / 1시간: 10,000P / 프리미엄: 20,000P
  mode            TEXT NOT NULL,               -- 'blue' | 'red'
  status          TEXT DEFAULT 'pending',
  -- pending | confirmed | completed | noshow | cancelled
  noshow_at       TIMESTAMPTZ,                 -- 노쇼 처리 시각
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservations_creator ON reservations(creator_id, reserved_at);
```

## 노쇼 자동 처리 (Vercel Cron)

```sql
-- 예약 시간 +10분 경과 시 노쇼 처리
UPDATE reservations
SET status = 'noshow', noshow_at = NOW()
WHERE status = 'confirmed'
  AND reserved_at + INTERVAL '10 minutes' < NOW();

-- 노쇼 발생 시 크리에이터에게 예약금 50% 지급 (별도 로직)
```
