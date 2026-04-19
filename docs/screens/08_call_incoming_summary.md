# 화면 — 통화 수신 & 통화 종료 요약

---

## 크리에이터 수신 화면 (IncomingCallScreen)

### 스펙

```
배경: #1B2A4A (Navy) 풀스크린

[상단]
  소비자 프로필 사진 (96px 원형)
  소비자 닉네임
  모드 뱃지 (🔵 스탠다드 / ⭐ 프리미엄)
  분당 요금 표시 (900P/분 or 1,300P/분)

[중간]
  "통화 요청이 왔습니다"
  수신 진동/벨소리 (Expo AV)

[하단 버튼]
  ┌─────────────────────────────┐
  │  [거절 🔴]     [수락 🟢]   │
  │  빨간 원형      초록 원형    │
  │  60px × 60px              │
  └─────────────────────────────┘

[자동 취소]
  30초 타이머 (링 애니메이션)
  → 30초 후 소비자 취소 신호 오거나 타임아웃 → 화면 자동 닫힘
```

### Cursor 프롬프트

```
@docs/api/05_reservations_signaling.md
@docs/design/01_design_system.md
@docs/context/02_business_rules.md

크리에이터 통화 수신 화면을 구현해줘.

파일: app/(app)/call/incoming.tsx

구현 내용:
1. useLocalSearchParams로 sessionId, consumerName, consumerAvatar, mode, perMinRate 수신

2. Navy 풀스크린 배경
   - 소비자 프로필 사진 (96px 원형, 흰 테두리)
   - 닉네임 (H1, White)
   - 모드 뱃지
   - "통화 요청이 왔습니다" (Body1, White 60% opacity)

3. 30초 링 타이머 (Animated.Value)
   - SVG 원형 프로그레스바 (react-native-svg)
   - 30초 후 자동으로 /api/calls/:id 상태 확인 후 화면 닫기

4. Expo AV 수신음
   await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
   const sound = await Audio.Sound.createAsync(require('@/assets/ringtone.mp3'))
   await sound.playAsync()
   → 컴포넌트 언마운트 시 sound.stopAsync() 호출

5. 하단 버튼 2개
   [거절] → POST /api/calls/:id/reject → router.back()
   [수락] → POST /api/calls/:id/accept
           → response의 { agora_channel, agora_token } 수신
           → router.replace('/call/[sessionId]')

6. Supabase Realtime 구독
   call_signals WHERE session_id = sessionId AND type = 'call_cancelled'
   → 취소 신호 수신 시 sound.stop() + router.back() + 토스트

주의:
- 수락/거절 버튼은 1회만 탭 가능 (isProcessing state로 중복 방지)
- 화면은 router.replace로 이동 (back 시 수신 화면으로 돌아오지 않게)
```

---

## 통화 종료 요약 화면 (CallSummary)

### 스펙

```
배경: #FFFFFF White

[상단]
  크리에이터 프로필 사진 (72px 원형)
  크리에이터 닉네임
  "통화가 종료됐습니다"

[통화 정보 카드] #F8F8FA 배경
  통화 시간:   14분 32초
  차감 포인트: -13,000P  (빨간 텍스트)
  잔여 포인트: 37,000P

[다음 예약 유도 카드]  ← 조건부 표시
  "또 만나고 싶으신가요?"
  [예약 통화하기] Secondary 버튼

[하단 CTA]
  [메인으로] Primary 버튼 → 피드로 이동
  [충전하기] (잔여 포인트 < 5분치일 때만 표시)
```

### Cursor 프롬프트

```
@docs/context/02_business_rules.md
@docs/design/01_design_system.md
@docs/api/02_calls.md

통화 종료 요약 화면을 구현해줘.

파일: app/(app)/call/summary.tsx

구현 내용:
1. useLocalSearchParams로 수신할 데이터:
   - sessionId, durationSec, pointsCharged, creatorId
   - creatorName, creatorAvatar

2. 통화 정보 표시
   - durationSec → "MM분 SS초" 포맷 변환
     const min = Math.floor(durationSec / 60)
     const sec = durationSec % 60
   - pointsCharged: 빨간 텍스트로 "-{n}P" 표시
   - usePointStore에서 현재 잔여 포인트 표시

3. 다음 예약 유도 (조건: 통화시간 >= 3분)
   [예약 통화하기] → router.push('/creator/[creatorId]')

4. 잔여 포인트 < per_min_rate × 5 이면
   [충전하러 가기] 버튼 추가 표시

5. [메인으로] → router.replace('/(app)/(tabs)')

6. 뒤로가기 차단
   BackHandler.addEventListener('hardwareBackPress', () => true)
   → 메인으로 버튼으로만 이동 가능

통화 화면(call/[sessionId].tsx)에서 호출 방법:
  router.replace({
    pathname: '/call/summary',
    params: {
      sessionId,
      durationSec:    callStore.durationSec,
      pointsCharged:  callStore.pointsCharged,
      creatorId:      creatorId,
      creatorName:    creatorName,
      creatorAvatar:  creatorAvatar,
    }
  })
```

---

## Supabase Realtime 소비자 수락/거절 대기 화면

> 소비자가 통화 버튼 탭 → 크리에이터 응답 대기 중 화면

### 스펙

```
배경: #1B2A4A (Navy) 반투명 오버레이 (기존 피드 위에)

[중앙]
  크리에이터 프로필 사진 (96px, 펄스 애니메이션)
  크리에이터 닉네임
  "연결 중..."
  30초 카운트다운

[취소]
  [통화 취소] Ghost 버튼 → POST /api/calls/:id/cancel
```

### Cursor 프롬프트

```
@docs/api/05_reservations_signaling.md
@docs/design/01_design_system.md

소비자 통화 연결 대기 화면을 구현해줘.

파일: components/CallWaitingModal.tsx
(피드 화면 위 Modal로 표시)

구현 내용:
1. Modal (transparent, animationType='fade')
   Navy 반투명 배경 (rgba(27,42,74,0.95))

2. 크리에이터 프로필 + "연결 중..." + 펄스 애니메이션
   Animated.loop(Animated.sequence([
     Animated.timing(scale, { toValue: 1.1, duration: 800 }),
     Animated.timing(scale, { toValue: 1.0, duration: 800 }),
   ]))

3. 30초 카운트다운
   setInterval 1초마다 감소
   0이 되면 자동으로 POST /api/calls/:id/cancel 호출

4. Supabase Realtime 구독
   call_signals WHERE session_id = sessionId AND to_user_id = myUserId
   → type='call_accepted' → 모달 닫기 + router.push('/call/[sessionId]') + Agora 채널 입장
   → type='call_rejected' → 모달 닫기 + "거절됐습니다" 토스트
   → type='call_cancelled' (크리에이터가 취소) → 모달 닫기

5. [통화 취소] 버튼
   → POST /api/calls/:id/cancel
   → 모달 닫기
```
