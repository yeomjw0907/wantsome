# DB 012 `live` migration

실제 마이그레이션 파일:
- `server/supabase/migrations/012_live.sql`

이 마이그레이션은 `1:N 유료 라이브` 기능을 위한 스키마를 추가한다.

## creators 확장

```sql
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS live_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_enabled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_live_now BOOLEAN NOT NULL DEFAULT false;
```

- `live_enabled`: 관리자 승인형 라이브 권한
- `live_enabled_at`, `live_enabled_by`: 권한 부여 이력
- `is_live_now`: 현재 방송 중 여부

## live_rooms

```sql
CREATE TABLE IF NOT EXISTS live_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  entry_fee_points INTEGER NOT NULL DEFAULT 50000,
  viewer_limit INTEGER NOT NULL DEFAULT 10,
  planned_duration_min INTEGER NOT NULL CHECK (planned_duration_min IN (30, 60)),
  scheduled_end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'live', 'ended', 'cancelled')),
  agora_channel TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  extension_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- 방 기본 정보
- 입장료 `50,000P`
- 유료 시청자 정원 `10`
- 예정 시간 `30분 / 1시간`
- 연장 횟수 저장

추가 컬럼:

```sql
ALTER TABLE live_rooms
  ADD COLUMN IF NOT EXISTS chat_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_locked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS chat_locked_at TIMESTAMPTZ;
```

- 방 전체 채팅 잠금 상태 저장

## live_room_participants

```sql
CREATE TABLE IF NOT EXISTS live_room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('host', 'viewer', 'admin')),
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'left', 'kicked')),
  paid_points INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  join_ack_at TIMESTAMPTZ,
  blocked_until_room_end BOOLEAN NOT NULL DEFAULT false,
  refund_status TEXT NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'pending', 'refunded')),
  chat_muted_until TIMESTAMPTZ,
  chat_muted_by UUID REFERENCES users(id),
  chat_muted_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);
```

- host / viewer / admin 역할 구분
- 입장료 납부 금액 저장
- `join_ack_at`: 환불 판단용 실제 입장 확인 시각
- `blocked_until_room_end`: 강퇴 후 재입장 금지
- `chat_muted_*`: 개인 채팅 금지 상태

## live_chat_messages

```sql
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('host', 'viewer', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- 라이브 채팅 로그

## live_moderation_actions

```sql
CREATE TABLE IF NOT EXISTS live_moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  actor_role TEXT NOT NULL CHECK (actor_role IN ('host', 'admin')),
  action TEXT NOT NULL CHECK (action IN ('kick', 'mute_user', 'unmute_user', 'lock_chat', 'unlock_chat', 'force_end')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- 강퇴
- 개인 mute / unmute
- 전체 채팅 잠금 / 해제
- 관리자 강제 종료

## live_extensions

```sql
CREATE TABLE IF NOT EXISTS live_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  added_duration_min INTEGER NOT NULL CHECK (added_duration_min IN (30, 60)),
  previous_end_at TIMESTAMPTZ NOT NULL,
  new_end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- 라이브 연장 이력 저장

## gifts 확장

```sql
ALTER TABLE gifts
  ADD COLUMN IF NOT EXISTS live_room_id UUID REFERENCES live_rooms(id) ON DELETE SET NULL;

ALTER TABLE gifts
  DROP CONSTRAINT IF EXISTS gifts_target_context_check;

ALTER TABLE gifts
  ADD CONSTRAINT gifts_target_context_check
  CHECK (
    (call_session_id IS NOT NULL AND live_room_id IS NULL)
    OR (call_session_id IS NULL AND live_room_id IS NOT NULL)
  );
```

- 선물은 `1:1 통화` 또는 `라이브` 둘 중 하나에만 귀속

## 운영 고정값

```sql
INSERT INTO system_config (key, value, updated_at) VALUES
  ('live_entry_fee_points', '50000', NOW()),
  ('live_viewer_limit', '10', NOW()),
  ('live_max_extension_count', '2', NOW()),
  ('live_join_ack_timeout_sec', '10', NOW())
ON CONFLICT (key) DO NOTHING;
```

기본 정책:
- 입장료 `50,000P`
- 유료 시청자 정원 `10명`
- 연장 최대 `2회`
- join ack 타임아웃 `10초`

## Realtime publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE live_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE live_room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE live_moderation_actions;
```

- 라이브 상태
- 참여자 상태
- 채팅
- 운영 액션

위 테이블들을 Realtime 대상으로 추가한다.
