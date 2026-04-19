# 화면 — 크리에이터 대시보드 & 온보딩

## 대시보드 스펙

| 요소 | 상세 |
|------|------|
| 배경 | #F8F8FA Gray-50 |
| 온라인 토글 | 크게, 상단 고정 |
| 오늘 수익 | 당일 포인트 × 정산율 (원 환산) |
| 이번달 누적 | 월간 수익 + 통화 시간 |
| 등급 현황 | 현재 등급 + 다음 등급까지 필요 분수 프로그레스 바 |
| 정산 내역 | 월별 리스트 (대기/완료) |
| 예약 관리 | 예약 목록 + 확정/거절 버튼 |

## Cursor 프롬프트

```
@docs/context/02_business_rules.md
@docs/design/01_design_system.md
@docs/api/04_creators.md
@docs/database/002_creators.sql.md

크리에이터 대시보드와 온보딩을 구현해줘.

파일:
- app/(creator)/dashboard/index.tsx
- app/(creator)/onboarding/contract.tsx
- app/(creator)/onboarding/id-card.tsx
- app/(creator)/onboarding/account.tsx

[대시보드]
1. 온라인 토글
   PATCH /api/creators/:id/online → Supabase Realtime으로 피드 반영

2. 수익 카드 3개 (오늘 / 이번달 / 전체)
   GET /api/creators/:id/earnings

3. 등급 프로그레스 바
   신규(0분) → 일반(500분) → 인기(1500분) → 탑(선정)
   현재 monthly_minutes 기준 진행률 표시

4. 정산 내역 리스트
   settlements 테이블, 월별, pending/paid 상태 표시

5. 예약 관리
   reservations 테이블, confirmed/거절 버튼

[크리에이터 온보딩]
contract.tsx:
- 용역계약서 전문 ScrollView (끝까지 스크롤 시 서명란 활성)
- react-native-signature-canvas 손서명 컴포넌트
- 서명 완료 → POST /api/creators/sign-contract

id-card.tsx:
- "크리에이터 인증 뱃지 획득" 포지셔닝 (신분증 제출 아님)
- 혜택 안내: 검색 상단 노출 + 프리미엄(red) 모드 활성화
- expo-image-picker 카메라/갤러리
- POST /api/creators/upload-id

account.tsx:
- 은행 선택 (Picker) + 계좌번호 입력
- POST /api/creators/verify-account → 실명 확인 즉시 표시
- 확인 완료 후 "관리자 심사 중" 대기 화면 (24시간 안내)
```
