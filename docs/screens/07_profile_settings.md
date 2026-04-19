# 화면 — 크리에이터 프로필 & 내 프로필/설정

---

## 크리에이터 프로필 화면

### 스펙

| 요소 | 상세 |
|------|------|
| 진입 | 피드 카드 탭 |
| 배경 | #FFFFFF |
| 상단 | 풀 커버 프로필 사진 (3:4 비율) |
| 정보 | 닉네임 + 인증뱃지 + 등급 + 모드 뱃지 |
| 소개 | 한줄 소개 (bio) |
| 통계 | 총 통화 횟수, 평균 평점 (추후) |
| CTA | 즉시 통화 버튼 (파란/빨간 모드별) |
| 예약 | 예약 통화 버튼 |
| 신고 | 우상단 ... 메뉴 → 신고 / 차단 |

### Cursor 프롬프트

```
@docs/design/01_design_system.md
@docs/api/02_calls.md
@docs/api/04_creators.md
@docs/database/006_storage_push_blocks.sql.md

크리에이터 프로필 화면을 구현해줘.

파일:
- app/(app)/creator/[id].tsx

구현 내용:
1. 프로필 사진 상단 풀커버 (3:4)
   하단 그라데이션 오버레이
   닉네임 + 인증뱃지(✅) + 등급 표시

2. 모드 뱃지
   🔵 스탠다드 / ⭐ 프리미엄 (보유 모드 모두 표시)

3. 온라인 상태
   초록 점 + "지금 통화 가능" 텍스트
   오프라인이면 "오프라인" 회색

4. 즉시 통화 버튼
   POST /api/calls/start → call/[sessionId] 이동
   오프라인이면 비활성화

5. 예약 통화 버튼 → ReservationBottomSheet 오픈
   - 날짜/시간 선택
   - 예약 유형 선택 (30분/1시간/프리미엄)
   - 예약금 확인 후 [예약 확정]

6. 우상단 ... 메뉴
   - 신고하기 → ReportBottomSheet
   - 차단하기 → POST /api/users/block + 확인 다이얼로그
```

---

## 내 프로필 / 설정 화면

### 스펙 (소비자)

| 탭 | 내용 |
|------|------|
| 프로필 탭 | 사진 + 닉네임 + 포인트 잔액 |
| 충전 내역 | point_charges 목록 (날짜/상품/금액) |
| 통화 기록 | call_sessions 목록 (크리에이터/시간/차감 포인트) |
| 설정 | 알림, 모드 설정, 고객센터, 탈퇴 |

### 스펙 (크리에이터)

| 탭 | 내용 |
|------|------|
| 대시보드 탭 | 수익/통계 (기존 05_creator_dashboard.md) |
| 내 프로필 | 사진/소개 수정 |
| 정산 내역 | settlements 목록 |
| 설정 | 동일 |

### Cursor 프롬프트

```
@docs/design/01_design_system.md
@docs/api/03_payments.md
@docs/context/02_business_rules.md
@docs/database/006_storage_push_blocks.sql.md
@docs/context/05_app_init.md

내 프로필 & 설정 화면을 구현해줘.

파일:
- app/(app)/(tabs)/profile.tsx       (프로필 메인 탭)
- app/(app)/history/charges.tsx      (충전 내역)
- app/(app)/history/calls.tsx        (통화 기록)
- app/(app)/settings/index.tsx       (설정)
- app/(app)/settings/withdraw.tsx    (탈퇴)

[profile.tsx]
1. 상단: 프로필 사진 + 닉네임 + 포인트 잔액 크게
2. 첫충전 이벤트 배너 (deadline 남아있을 때만)
3. 메뉴 리스트:
   - 충전 내역
   - 통화 기록
   - 설정
   - 고객센터 (cs_url 웹뷰)
4. 크리에이터인 경우 → 대시보드 버튼 추가

[history/charges.tsx]
- GET /api/users/:id/charges
- FlatList: 날짜 / 상품명 / 결제금액 / 지급 포인트

[history/calls.tsx]
- GET /api/users/:id/calls
- FlatList: 크리에이터 사진+닉네임 / 날짜 / 통화시간 / 차감 포인트

[settings/index.tsx]
- 알림 ON/OFF 토글 (Expo Notifications 권한)
- 스탠다드/프리미엄 모드 설정
- 차단 목록 관리
- 고객센터
- 로그아웃
- 회원 탈퇴

[settings/withdraw.tsx]
탈퇴 전 체크사항 안내:
  - 잔여 포인트 소멸 안내 (잔액 표시)
  - 미정산 수익 있으면 경고
  - "정말 탈퇴하시겠습니까?" 확인 입력 (닉네임 타이핑)
  - DELETE /api/users/me → 소프트 딜리트
```

---

## 사업자 정보

> 약관 하단, 앱스토어 제출, PG사 계약에 필요한 정보

```
상호: 주식회사 98점7도
대표자: [대표자명 입력]
사업자등록번호: [등록 후 입력]
통신판매업신고번호: [신고 후 입력]
주소: [사업장 주소 입력]
이메일: contact@wantsome.kr
고객센터: [오픈채팅 URL 생기면 입력]
```

### 앱스토어 제출 시 필요 정보

```
App Store Connect:
  - Apple Developer Program 등록 (연 $99)
  - Bundle ID: kr.wantsome.app
  - 앱 카테고리: Social Networking
  - 연령 등급: 17+ (성인 콘텐츠)
  - 개인정보처리방침 URL: https://wantsome.kr/privacy
  - 지원 URL: https://wantsome.kr/support

Google Play Console:
  - 개발자 계정 등록 (일회성 $25)
  - Package Name: kr.wantsome.app
  - 앱 카테고리: Social
  - 콘텐츠 등급: IARC 설문 → 성인(18+)
  - 개인정보처리방침 URL: https://wantsome.kr/privacy
```

### system_config에 사업자 정보 추가

```sql
INSERT INTO system_config (key, value, updated_at) VALUES
  ('company_name',     '주식회사 98점7도',    NOW()),
  ('ceo_name',         '',              NOW()),
  ('business_number',  '',              NOW()),
  ('commerce_number',  '',              NOW()),
  ('company_address',  '',              NOW()),
  ('contact_email',    'contact@wantsome.kr', NOW())
ON CONFLICT (key) DO NOTHING;
```
