# 화면 — 신고 & 모더레이션

## 신고 진입점 3곳

| 위치 | 트리거 | 파일 |
|------|--------|------|
| 통화 중 | 우상단 🚩 버튼 | call/[sessionId].tsx 내 |
| 통화 종료 후 | 평점 화면 내 신고 옵션 | components/CallSummary.tsx |
| 프로필 페이지 | 우상단 신고 버튼 | components/CreatorProfile.tsx |

## 신고 카테고리

| 코드 | 항목 | 자동 조치 |
|------|------|---------|
| UNDERAGE | 미성년자 의심 | 🔴 즉시 정지 + 긴급 슬랙 |
| ILLEGAL_RECORD | 불법 촬영 의심 | 🔴 즉시 정지 + 긴급 슬랙 |
| PROSTITUTION | 성매매 유도 | 🔴 즉시 정지 |
| HARASSMENT | 언어/성적 괴롭힘 | 🟡 24시간 내 검토 |
| FRAUD | 사기 | 🟡 24시간 내 검토 |
| OTHER | 기타 | 🟢 72시간 내 검토 |

## Cursor 프롬프트

```
@docs/api/04_creators.md
@docs/database/005_reports.sql.md
@docs/design/01_design_system.md

신고 시스템과 관리자 모더레이션 콘솔을 구현해줘.

파일:
- components/ReportBottomSheet.tsx    (앱 공통 신고 시트)
- app/(admin)/reports/index.tsx       (관리자 콘솔)

[ReportBottomSheet]
1. BottomSheet (react-native-bottom-sheet)
2. 신고 카테고리 6개 라디오 버튼
3. 기타 설명 TextInput (선택)
4. 신고하기 버튼 → POST /api/reports
5. 성공 → "신고가 접수됐습니다" 토스트 + 시트 닫힘

[관리자 콘솔 — /admin/reports]
1. 미처리 신고 목록 (status='PENDING')
   - 카테고리별 필터 탭
   - 신고 카드: 신고자/피신고자/카테고리/시각/설명

2. 신고 상세 탭 시
   - 피신고자 프로필 + 통화 세션 메타데이터
   - 조치 버튼: 경고 / 7일 정지 / 30일 정지 / 영구 정지 / 기각

3. 영구 정지 시
   PATCH /api/admin/reports/:id → BAN
   → users.suspended_until = '9999-12-31'
   → ci_blacklist INSERT

참고: 관리자 콘솔은 Next.js 웹으로 구현 (React Native 아님)
URL: admin.wantsome.kr (별도 배포)
```
