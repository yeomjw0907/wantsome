# API — 영상통화

## POST /api/calls/start
통화 시작 → Agora 채널 생성 + 과금 시작

```ts
// Request
{ consumer_id: string, creator_id: string, mode: 'blue' | 'red' }

// Response
{
  session_id: string,
  agora_channel: string,
  agora_token: string,      // 서버사이드 생성 (AGORA_APP_CERTIFICATE 필요)
  per_min_rate: number      // 900 or 1300
}

// Logic
1. 소비자 포인트 ≥ per_min_rate 확인 → 부족 시 에러
2. 크리에이터 is_online 확인
3. Agora RTC 토큰 생성 (서버사이드)
4. call_sessions INSERT (status='active')
5. Response 반환
```

---

## POST /api/calls/:id/end
통화 종료 처리

```ts
// Request
{ session_id: string }

// Response
{ duration_sec: number, points_charged: number, creator_earning: number }

// Logic
1. ended_at = NOW(), duration_sec 계산
2. 초 단위 정산 (분 내림 적용: Math.floor(sec / 60))
3. points_charged = minutes × per_min_rate
4. 소비자 포인트 최종 차감
5. 크리에이터 수익 누적: points_charged × settlement_rate
6. creators.monthly_minutes += minutes
7. status = 'ended'
```

---

## POST /api/calls/tick
진행 중 통화 포인트 차감 (Vercel Cron, 1분마다)

```ts
// vercel.json
{
  "crons": [{ "path": "/api/calls/tick", "schedule": "* * * * *" }]
}

// Logic
1. status='active' 세션 전체 조회
2. 각 세션: 소비자 points -= per_min_rate
3. 잔여 < per_min_rate × 5 → Expo Push "5분 남았습니다"
4. 잔여 < per_min_rate → 강제 종료 처리 + /api/calls/:id/end 호출
```

---

## Agora 채널 토큰 생성 (서버사이드)

```ts
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export function generateAgoraToken(channelName: string, uid: number): string {
  const expireTime = Math.floor(Date.now() / 1000) + 3600; // 1시간
  return RtcTokenBuilder.buildTokenWithUid(
    process.env.EXPO_PUBLIC_AGORA_APP_ID!,
    process.env.AGORA_APP_CERTIFICATE!,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireTime
  );
}
```

---

## 포인트 부족 케이스

```
잔여 포인트 = 0         → 통화 시작 불가 ("포인트를 충전해주세요")
잔여 포인트 < 1분치     → 통화 시작 불가
잔여 포인트 < 5분치     → 통화 중 경고 배너 표시
통화 중 포인트 소진     → 자동 종료 + "포인트 충전 후 다시 통화하세요"
```
