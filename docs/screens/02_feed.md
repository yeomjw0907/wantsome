# 화면 — 메인 피드

## 스펙

| 요소 | 상세 |
|------|------|
| 레이아웃 | 2컬럼 인스타그램형 그리드 |
| 상단 바 | wantsome 로고 \| 내 포인트 \| 알림 아이콘 |
| 모드 탭 | 🔵 스탠다드 / ⭐ 프리미엄 (프리미엄은 is_verified 등 조건) |
| 카드 | 1:1 정사각형, 사진 풀커버, 하단 그라데이션 |
| 정렬 | 온라인 우선 → 탑 → 인기 → 일반 → 신규 |
| 페이지네이션 | 무한스크롤 20개씩 |
| 실시간 | Supabase Realtime — is_online 변경 즉시 반영 |

## Cursor 프롬프트

```
@docs/context/01_project_overview.md
@docs/design/01_design_system.md
@docs/api/04_creators.md

메인 피드 화면을 구현해줘.

파일:
- app/(app)/(tabs)/index.tsx

구현 내용:
1. ModeTab 컴포넌트 (스탠다드/프리미엄 전환, 내부 키 blue/red)
   - 스탠다드 활성: 배경 #D1E4F8, 텍스트 #4D9FFF, 하단 border 2px
   - 프리미엄 활성: 배경 #FFEEF1, 텍스트 #FF5C7A
   - 프리미엄 탭: users.is_verified=true 이고 red_mode=true 유저만 접근

2. CreatorCard 컴포넌트 (components/CreatorCard.tsx)
   - 1:1 aspect ratio, border-radius 16px
   - 하단 그라데이션 오버레이 (transparent → rgba(0,0,0,0.65))
   - 좌상단: 온라인 초록 점
   - 우상단: 모드 뱃지 (#D1E4F8 배경+#4D9FFF 텍스트 or #FFEEF1+#FF5C7A)
   - 닉네임 + 인증뱃지(✅) + 분당단가 + 통화버튼(Pink 원형)

3. FlatList 2컬럼 무한스크롤
   - GET /api/creators/feed?mode=blue&page=1&limit=20
   - onEndReached 다음 페이지 로드

4. Supabase Realtime 구독
   - creators 테이블 is_online 변경 감지 → 카드 즉시 업데이트

5. Zustand useCreatorStore에 피드 상태 관리
```
