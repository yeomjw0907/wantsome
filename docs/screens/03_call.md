# 화면 — 영상통화

## 스펙

| 요소 | 상세 |
|------|------|
| 레이아웃 | 크리에이터 영상 (풀스크린) + 내 영상 (PiP 우하단) |
| 배경 | #000000 블랙 |
| 상단 | 실시간 타이머 (MM:SS) + 잔여 포인트 |
| 하단 컨트롤 | 카메라 전환 / 마이크 ON·OFF / 통화 종료 (빨간) / 신고 🚩 |
| 포인트 경고 | 잔여 5분치 미만 → 경고 배너 슬라이드 인 |
| 자동 종료 | 서버에서 강제 종료 신호 → 종료 후 요약 화면 |

## Cursor 프롬프트

```
@docs/context/01_project_overview.md
@docs/context/02_business_rules.md
@docs/api/02_calls.md

영상통화 화면을 구현해줘.

파일:
- app/(app)/call/[sessionId].tsx

구현 내용:
1. Agora RTC 연결
   import { createAgoraRtcEngine } from 'react-native-agora'
   - POST /api/calls/start → { agora_channel, agora_token, per_min_rate } 수신
   - engine.joinChannel(agora_token, agora_channel, 0, {})
   - 원격 영상: RtcSurfaceView (풀스크린)
   - 로컬 영상: RtcSurfaceView (PiP, 우하단 120×160, border-radius 12)

2. 타이머
   - 통화 시작 시 setInterval 1초마다 카운트업
   - 상단 중앙에 흰색 타이머 표시

3. 포인트 실시간 표시
   - Supabase Realtime으로 users.points 구독
   - 잔여 포인트 < per_min_rate × 5 → 경고 배너 (Yellow, 슬라이드 인)
   - 잔여 포인트 < per_min_rate → "곧 통화가 종료됩니다" 표시

4. 통화 종료
   - 빨간 수화기 버튼 → POST /api/calls/:id/end
   - 종료 후 통화 요약 화면 (시간, 차감 포인트, 크리에이터 평점)

5. 하단 컨트롤 바 (반투명 블랙 배경)
   - 카메라 전환 (Ionicons: camera-reverse)
   - 마이크 토글 (Ionicons: mic / mic-off)
   - 통화 종료 (Ionicons: call, 빨간 배경 원형)
   - 신고 버튼 🚩 (우상단 고정)

6. 신고 버튼
   - 탭 시 ReportBottomSheet 오픈
   - 카테고리 선택 → POST /api/reports
```
