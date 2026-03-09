# API — 예약통화 & 통화 시그널링

---

## 예약통화 전체 플로우

```
[소비자]                          [서버]                        [크리에이터]
    │                               │                               │
    ├─ POST /api/reservations ──────▶│                               │
    │  (예약 + 예약금 차감)           ├─ reservations INSERT          │
    │                               ├─ 크리에이터 푸시 알림 ─────────▶│
    │                               │                               ├─ 예약 수락/거절
    │                               │◀── POST /api/reservations/:id/respond ─┤
    │                               ├─ 소비자 푸시 알림 ──────────────▶│
    │                               │                               │
    │  [예약 시간 10분 전]            │                               │
    │◀── 푸시: "통화 10분 전입니다" ──┤─ 크리에이터 푸시도 ────────────▶│
    │                               │                               │
    │  [예약 시간]                   │                               │
    ├─ POST /api/calls/start ───────▶│                               │
    │  (예약 통화 시작)              │                               │
    │                               │                               │
    │  [예약 시간 + 10분]            │                               │
    │  크리에이터 미응답 시           ├─ Cron: 노쇼 자동 처리          │
    │◀── 환불 처리 + 푸시 ───────────┤                               │
```

---

## POST /api/reservations
예약 생성 + 예약금 차감

```ts
// Request
{
  creator_id:    string,
  reserved_at:   string,   // ISO datetime
  duration_min:  30 | 60,
  mode:          'blue' | 'red',
  type:          'standard' | 'premium'
}

// Response
{ reservation_id: string, deposit_points: number }

// Logic
1. 소비자 포인트 >= deposit_points 확인
   - 30분: 5,000P / 1시간: 10,000P / 프리미엄: 20,000P
2. 해당 크리에이터 동시간 예약 중복 확인
3. reservations INSERT (status='pending')
4. 소비자 포인트 차감 (deposit_points)
5. 크리에이터에게 푸시 알림
   제목: "예약 통화 요청이 왔어요 📅"
   내용: "{소비자닉네임}님이 {날짜 시간} 예약을 요청했어요"
6. Slack #운영-알림 기록
```

---

## POST /api/reservations/:id/respond
크리에이터 예약 수락/거절

```ts
// Request
{ action: 'accept' | 'reject', reject_reason?: string }

// Response
{ success: boolean }

// Logic (accept)
1. reservations.status = 'confirmed'
2. 소비자에게 푸시: "예약이 확정됐습니다 ✅"
3. 소비자에게 푸시 예약 (10분 전, Vercel Cron이 처리)

// Logic (reject)
1. reservations.status = 'cancelled'
2. 소비자 포인트 환불 (deposit_points 전액)
3. 소비자에게 푸시: "예약이 취소됐습니다. 포인트가 환불됐습니다."
```

---

## GET /api/reservations
예약 목록 조회 (크리에이터/소비자 공통)

```ts
// Query: { role: 'creator' | 'consumer', status?: string }

// Response
{
  reservations: [{
    id, consumer_id, creator_id,
    reserved_at, duration_min, mode,
    deposit_points, status,
    consumer: { nickname, profile_img },
    creator:  { display_name, profile_img }
  }]
}
```

---

## DELETE /api/reservations/:id
예약 취소 (소비자, 통화 1시간 전까지만)

```ts
// Logic
1. reserved_at - NOW() > 1시간 확인 (이하면 취소 불가)
2. reservations.status = 'cancelled'
3. 소비자 포인트 환불
4. 크리에이터 푸시: "예약이 취소됐습니다"
```

---

## Vercel Cron 추가 (vercel.json에 반영)

```json
// 기존 4개에 추가
{
  "path": "/api/reservations/remind",
  "schedule": "* * * * *"
},
{
  "path": "/api/reservations/noshow",
  "schedule": "* * * * *"
}
```

### /api/reservations/remind (매 분 실행)
```ts
// 10분 후 예약 있는 소비자 + 크리에이터에게 알림
SELECT * FROM reservations
WHERE status = 'confirmed'
  AND reserved_at BETWEEN NOW() + INTERVAL '9 minutes' AND NOW() + INTERVAL '10 minutes'
  AND reminded_at IS NULL;

// 알림 후 reminded_at = NOW() 업데이트
// reservations 테이블에 reminded_at TIMESTAMPTZ 컬럼 추가 필요
```

### /api/reservations/noshow (매 분 실행)
```ts
// 예약 시간 + 10분 경과 + confirmed 상태인 예약 → 노쇼 처리
UPDATE reservations
SET status = 'noshow', noshow_at = NOW()
WHERE status = 'confirmed'
  AND reserved_at + INTERVAL '10 minutes' < NOW();

// 노쇼 처리 후:
// 1. 소비자 환불 없음 (예약금 몰수)
// 2. 크리에이터에게 예약금 50% 지급
//    → point_charges INSERT (type='noshow_compensation')
//    → creators에게 settlements 누적
// 3. 소비자 푸시: "크리에이터가 나타나지 않았습니다. 다음 이용 시 포인트 혜택을 드립니다."
// 4. 크리에이터 푸시: "노쇼로 처리됐습니다. 예약금 50%가 지급됩니다."
```

---

## reservations 테이블 컬럼 추가

```sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reject_reason TEXT;
```

---

## 통화 시그널링 — Supabase Realtime 채널 설계

> Agora = 통화 영상/음성 전송
> Supabase Realtime = 통화 전 신호 (누가 전화했어, 수락/거절)

### 채널 구조

```
call_signals 테이블 (Realtime 전용)
  → 크리에이터가 구독
  → 소비자가 신호 INSERT → 크리에이터 앱에 즉시 수신
```

```sql
CREATE TABLE call_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES call_sessions(id),
  to_user_id   UUID REFERENCES users(id),   -- 수신자 (크리에이터)
  from_user_id UUID REFERENCES users(id),   -- 발신자 (소비자)
  type         TEXT NOT NULL,
  -- 'incoming_call' | 'call_accepted' | 'call_rejected' | 'call_cancelled' | 'call_ended'
  payload      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_to_user ON call_signals(to_user_id, created_at);

-- RLS: 본인 수신 신호만 조회 가능
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals_self" ON call_signals
  FOR SELECT USING (auth.uid() = to_user_id);
```

### 신호 흐름

```
[소비자가 통화 버튼 탭]
  1. POST /api/calls/start
     → call_sessions INSERT (status='pending')
     → call_signals INSERT { type: 'incoming_call', to: creator_id }

[크리에이터 앱 — 항상 Realtime 구독 중]
  2. call_signals 변경 감지 (type='incoming_call')
     → 수신 화면 표시 (IncomingCallScreen)

[크리에이터 수락]
  3. POST /api/calls/:id/accept
     → call_sessions.status = 'active'
     → call_signals INSERT { type: 'call_accepted', to: consumer_id }
     → 소비자 앱: 수락 신호 감지 → Agora 채널 입장

[크리에이터 거절]
  3'. POST /api/calls/:id/reject
     → call_sessions.status = 'rejected'
     → call_signals INSERT { type: 'call_rejected', to: consumer_id }
     → 소비자 앱: 거절 신호 감지 → 안내 토스트

[소비자 취소 (30초 내)]
  3''. POST /api/calls/:id/cancel
      → call_signals INSERT { type: 'call_cancelled', to: creator_id }
```

### 크리에이터 앱 Realtime 구독 코드

```ts
// hooks/useCallSignal.ts
// 앱 포그라운드/백그라운드 관계없이 항상 구독

export function useCallSignal() {
  const router = useRouter()

  useEffect(() => {
    const channel = supabase
      .channel('call-signals')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `to_user_id=eq.${myUserId}`,
      }, (payload) => {
        const signal = payload.new

        if (signal.type === 'incoming_call') {
          // 수신 화면으로 이동
          router.push({
            pathname: '/call/incoming',
            params: {
              sessionId:      signal.session_id,
              consumerName:   signal.payload.consumer_nickname,
              consumerAvatar: signal.payload.consumer_avatar,
              mode:           signal.payload.mode,
            }
          })
        }

        if (signal.type === 'call_cancelled') {
          // 이미 수신 화면이면 닫기
          router.back()
          Toast.show({ type: 'info', text1: '통화가 취소됐습니다' })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}

// 소비자도 동일한 패턴으로 구독
// type: 'call_accepted' | 'call_rejected' 감지
```

### call_signals payload 구조

```ts
// incoming_call payload
{
  consumer_nickname: string,
  consumer_avatar:   string,
  mode:              'blue' | 'red',
  per_min_rate:      900 | 1300,
}

// call_accepted payload
{
  agora_channel: string,
  agora_token:   string,
}
```
