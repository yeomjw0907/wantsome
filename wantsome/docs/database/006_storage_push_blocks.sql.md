# DB — Storage 버킷 & Push Token & 차단 & 통화 실패 처리

---

## Supabase Storage 버킷 구조

```
버킷 목록:
┌─────────────────┬─────────┬──────────────────────────────┐
│ 버킷명           │ 공개여부 │ 경로 구조                     │
├─────────────────┼─────────┼──────────────────────────────┤
│ profiles        │ public  │ profiles/{user_id}.jpg        │
│ id-cards        │ private │ id-cards/{user_id}/{ts}.jpg   │
│ contracts       │ private │ contracts/{user_id}/{ts}.pdf  │
│ banners         │ public  │ banners/{banner_id}.jpg       │
└─────────────────┴─────────┴──────────────────────────────┘
```

### Supabase Storage 정책 SQL

```sql
-- profiles 버킷: 본인만 업로드, 전체 공개 읽기
INSERT INTO storage.buckets (id, name, public) VALUES ('profiles', 'profiles', true);

CREATE POLICY "profiles_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "profiles_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'profiles');

-- id-cards 버킷: 본인 업로드, service_role만 읽기
INSERT INTO storage.buckets (id, name, public) VALUES ('id-cards', 'id-cards', false);

CREATE POLICY "idcards_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'id-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 읽기는 service_role만 (서버사이드에서만 접근)

-- contracts 버킷: 서버사이드만 (service_role)
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);

-- banners 버킷: 관리자 업로드, 전체 공개 읽기
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true);
```

---

## users 테이블 — push_token 추가

```sql
-- 푸시 토큰 저장
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  push_token TEXT;  -- Expo Push Token

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token)
  WHERE push_token IS NOT NULL;
```

### 푸시 토큰 등록 API

```ts
// PATCH /api/users/push-token
// Request: { push_token: string }
// Logic: users.push_token = token WHERE id = auth.uid()

// 앱에서 호출 시점:
// 1. 로그인 완료 후
// 2. 앱 포그라운드 복귀 시 (토큰 갱신)
```

### 푸시 발송 헬퍼

```ts
// lib/push.ts
import { Expo } from 'expo-server-sdk'

const expo = new Expo()

export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: object
) {
  const messages = tokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(token => ({ to: token, title, body, data, sound: 'default' }))

  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk)
  }
}

// 사용 예시
await sendPush(
  [user.push_token],
  '크리에이터 심사 완료',
  '심사가 승인됐습니다 🎉'
)
```

---

## 차단 기능

### user_blocks 테이블

```sql
CREATE TABLE user_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID REFERENCES users(id),  -- 차단한 유저
  blocked_id  UUID REFERENCES users(id),  -- 차단당한 유저
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);
```

### 차단 API

```ts
// POST /api/users/block
// Request: { blocked_id: string }
// Logic:
//   1. user_blocks INSERT
//   2. 피드에서 차단된 크리에이터 제외
//   3. 차단된 유저가 통화 시도 시 거절

// DELETE /api/users/block/:blocked_id
// 차단 해제
```

### 차단 적용 위치

```ts
// GET /api/creators/feed 쿼리에 차단 필터 추가
WHERE id NOT IN (
  SELECT blocked_id FROM user_blocks WHERE blocker_id = $userId
)
AND id NOT IN (
  SELECT blocker_id FROM user_blocks WHERE blocked_id = $userId
)
```

### RLS 정책

```sql
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_self" ON user_blocks
  USING (auth.uid() = blocker_id);
```

---

## 통화 연결 실패 처리

### 연결 실패 케이스별 처리

```
케이스 1: 크리에이터 수락 안 함 (30초 타임아웃)
  → call_sessions.status = 'no_answer'
  → 소비자 포인트 미차감
  → "크리에이터가 응답하지 않습니다" 토스트

케이스 2: 네트워크 끊김 (Agora 이벤트 감지)
  → Agora onUserOffline 이벤트 수신
  → /api/calls/:id/end 호출 (실제 연결된 시간만 과금)
  → "연결이 끊겼습니다" 토스트

케이스 3: 크리에이터가 통화 거절
  → call_sessions.status = 'rejected'
  → 소비자 포인트 미차감
  → "크리에이터가 통화를 거절했습니다" 토스트

케이스 4: 통화 시작 전 앱 종료
  → call_sessions.status = 'cancelled'
  → 소비자 포인트 미차감

케이스 5: 통화 중 앱 강제 종료
  → Cron tick에서 30분 이상 active 세션 자동 종료
  → 실제 duration 기준으로 과금
```

### call_sessions 상태 추가

```sql
-- status 값 전체
-- 'pending'    : 연결 요청 중 (크리에이터 수락 대기)
-- 'active'     : 통화 중
-- 'ended'      : 정상 종료
-- 'no_answer'  : 크리에이터 무응답 (30초 타임아웃)
-- 'rejected'   : 크리에이터 거절
-- 'cancelled'  : 소비자 취소
-- 'failed'     : 기술적 오류

ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS
  failure_reason TEXT;  -- 실패 사유 기록
```

### 크리에이터 수락/거절 API

```ts
// POST /api/calls/:id/accept   ← 크리에이터 수락
// POST /api/calls/:id/reject   ← 크리에이터 거절

// 수락 시:
//   call_sessions.status = 'active'
//   Supabase Realtime으로 소비자에게 수락 신호

// 거절 시:
//   call_sessions.status = 'rejected'
//   Supabase Realtime으로 소비자에게 거절 신호
//   소비자 포인트 미차감
```

### 30초 타임아웃 처리 (Cron tick에 포함)

```ts
// /api/calls/tick 에 추가
// pending 상태에서 30초 경과한 세션 자동 처리
UPDATE call_sessions
SET status = 'no_answer'
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 seconds';

// 30분 이상 active인 세션 (좀비 세션) 자동 종료
UPDATE call_sessions
SET status = 'ended', ended_at = NOW()
WHERE status = 'active'
  AND started_at < NOW() - INTERVAL '30 minutes'
  AND ended_at IS NULL;
```
