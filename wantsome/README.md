# wantsome

> 크리에이터와 팬을 연결하는 **성인 영상통화 플랫폼** (만 19세 이상)

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2055-000020?logo=expo)](https://expo.dev)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-배포중-black?logo=vercel)](https://vercel.com)

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [버전 히스토리](#버전-히스토리)
5. [로컬 개발 환경 세팅](#로컬-개발-환경-세팅)
6. [주요 문서](#주요-문서)
7. [환경 변수](#환경-변수)
8. [미구현 항목 (로드맵)](#미구현-항목-로드맵)

---

## 프로젝트 개요

**wantsome**은 크리에이터(방송인)와 팬(소비자)이 1:1 영상통화로 연결되는 플랫폼입니다.

| 구분 | 내용 |
|------|------|
| 서비스 | 1:1 영상통화 (블루/레드 모드), 예약, 쇼핑, 포인트 결제 |
| 대상 | 만 19세 이상 성인 |
| 플랫폼 | iOS + Android (Expo) |
| 결제 | App Store IAP / Google Play Billing (포인트 방식) |
| 통화 | Agora RTC (WebRTC 기반, AES-128 암호화) |
| 인증 | Supabase Auth (Google/Apple/카카오/전화번호 OTP) |
| 성인인증 | 생년월일 입력 (임시) → PortOne PASS 본인인증 (사업자 등록 후) |

---

## 기술 스택

### 앱 (React Native)
| 패키지 | 용도 |
|--------|------|
| Expo SDK 55 | 빌드 / OTA / EAS |
| Expo Router v4 | 파일 기반 라우팅 |
| NativeWind + Tailwind | 스타일링 |
| Zustand | 전역 상태 (auth, point, call) |
| Supabase JS v2 | Auth + Realtime + Storage |
| Agora RTC | 영상통화 |
| expo-web-browser | OAuth / PortOne PASS 플로우 |
| react-native-toast-message | 토스트 알림 (커스텀 다크 테마) |

### 서버 (Next.js API)
| 패키지 | 용도 |
|--------|------|
| Next.js 15 (App Router) | API 라우트 + 어드민 웹 |
| Supabase Admin Client | RLS 우회, 서버 작업 |
| PortOne v2 API | PASS 본인인증 (사업자 등록 후) |
| Vercel | 서버 배포 + Cron Jobs |

### 인프라
| 서비스 | 용도 |
|--------|------|
| Supabase | DB (PostgreSQL) + Auth + Storage |
| Vercel | 서버 호스팅 |
| Agora | 영상통화 인프라 |
| Twilio | SMS OTP (62원/건, 한국 +82) |
| PortOne | PASS 본인인증 (사업자 등록 후 활성화) |

---

## 프로젝트 구조

```
wantsome/
├── app/                        # Expo Router 페이지
│   ├── (auth)/                 # 인증 플로우
│   │   ├── login.tsx           # 소셜/전화번호 로그인 선택
│   │   ├── phone-login.tsx     # 전화번호 입력 + OTP 발송
│   │   ├── phone-verify.tsx    # OTP 인증
│   │   ├── verify.tsx          # 성인인증 (fallback/PASS 이중모드)
│   │   ├── terms.tsx           # 약관 동의
│   │   ├── role.tsx            # 소비자/크리에이터 선택
│   │   └── profile.tsx         # 초기 프로필 설정
│   └── (app)/                  # 메인 앱
│       ├── (tabs)/             # 탭 네비게이션 (홈/탐색/DM/마이)
│       ├── call/               # 영상통화 화면
│       ├── charge/             # 포인트 충전
│       └── creator/            # 크리에이터 프로필/대시보드
├── server/                     # Next.js (API + 어드민)
│   ├── app/
│   │   ├── api/auth/           # 인증 API
│   │   ├── api/calls/          # 통화 세션 API
│   │   ├── api/payments/       # 결제 API
│   │   ├── api/reports/        # 신고 API
│   │   ├── admin/              # 어드민 대시보드
│   │   ├── privacy/            # 개인정보처리방침
│   │   └── terms/              # 이용약관
│   └── lib/                    # 서버 유틸 (supabase, agora, push)
├── components/                 # 공용 UI 컴포넌트
├── stores/                     # Zustand 스토어
├── lib/                        # 클라이언트 유틸 (api.ts, supabase.ts)
└── docs/                       # 개발 문서
```

---

## 버전 히스토리

### v1.4.0 — 2026-03-16 `현재`
**PASS 성인인증 이중 모드 + 전화번호 저장 + 배포 문서**

- `verify.tsx` 완전 재작성: fallback(생년월일 입력) / portone(PASS WebBrowser) 이중 모드
  - 마운트 시 `GET /api/auth/identity-verification-status` → 모드 자동 결정
  - 이미 인증된 유저는 화면 스킵, role로 직행
  - `PORTONE_API_SECRET` 환경 변수 추가 시 코드 변경 없이 PASS 모드 자동 전환
- **NEW** `identity-verification-status` API: portone/fallback 모드 + `is_already_verified` 반환
- **NEW** `create-identity-verification` API: PortOne v2 인증 URL 생성 (사업자 등록 후 동작)
- `verify-identity` API: Authorization 헤더 기반 인증 + CI 중복 계정 방지 + **만 19세** 기준 수정
- `phone-login` API: `users.phone` 저장 추가
- `phone-verify`: 이미 가입된 번호 오류 토스트 처리
- `docs/distribution-guide.md`: Twilio SMS 설정 + NHN Cloud 전환 안내 + PortOne 환경 변수 가이드 추가

---

### v1.3.0 — 2026-03-15
**전화번호 로그인 + 약관/개인정보처리방침 + 배포 가이드**

- **전화번호 로그인** 전체 구현
  - `phone-login.tsx`: 한국 번호 포맷터 + E.164 변환 + Supabase OTP 발송
  - `phone-verify.tsx`: 6자리 OTP 입력 + 60초 재발송 쿨다운
  - `server/api/auth/phone-login`: JWT 검증 + users upsert + 첫충전 데드라인 세팅
  - `login.tsx`: 전화번호 버튼 + 구분선 추가
- **소셜 로그인** points/first_charge 응답 필드 추가
- **이용약관** (`/terms`): 13개 조항 완성 — 연령(만 19세), 포인트정책, 금지행위 표, 준거법
- **개인정보처리방침** (`/privacy`): 수집 항목, 위탁업체, 영상통화 비저장 원칙, 보유기간 표
- **배포 가이드** (`docs/distribution-guide.md`): APK/TestFlight 전체 프로세스, EAS 설정, 심사 체크리스트

---

### v1.2.0 — 2026-03-15
**앱스토어 심사 대응 + 토스트 디자인 개선**

- **커스텀 토스트** (`components/CustomToast.tsx`): 반투명 다크 + 컬러 스트라이프 (success/error/info)
- **통화 중 신고 기능**: 신고 버튼 → `POST /api/reports`
- **연령 게이팅** (`age-check.tsx`): 앱 최초 실행 시 생년월일 확인
- **결제 동의 모달** (`charge/index.tsx`): 포인트 구매 전 명시적 동의 UI
- **화면 녹화 방지**: `expo-screen-capture` 적용

---

### v1.1.0 — 2026-03-14
**서버 전체 구현 + Expo SDK 55 호환**

- **어드민 대시보드** (`server/app/admin/`): 대시보드, 유저, 크리에이터, 신고, 포인트, 배너, 시스템 관리
- **API 라우트 전체 구현**: calls, payments, reports, creators, posts, products, schedules, agora-token
- **Vercel Cron**: 예약 알림, 노쇼 처리, 포인트 정산 자동화
- **Expo SDK 55** 호환 패키지 버전 정리
- **Metro bundler**: `android/.cxx` 경로 감시 오류 수정

---

### v1.0.0 — 2026-03-09 ~ 2026-03-13
**플랫폼 전체 초기 구현 (Phase 1~6)**

#### Phase 1 — 초기 커밋 (2026-03-09)
- 프로젝트 초기화: Expo Router + NativeWind + Supabase + Agora 기본 설정
- 스플래시/온보딩/로그인 화면

#### Phase 2 — 크리에이터 온보딩 (2026-03-12)
- 크리에이터 신청 플로우 + 대시보드
- 소비자/크리에이터 역할 선택 (`role.tsx`)
- Supabase DB 스키마 v1 (users, creators, calls, points)

#### Phase 3 — 예약 통화 시스템 (2026-03-12)
- 네이버 예약 스타일 슬롯 선택 UI
- 예약 CRUD API + 노쇼/준비완료 처리 Cron

#### Phase 4 — 프로필/설정/이력 (2026-03-12)
- 마이페이지, 통화 이력, 포인트 이력, 설정 화면
- 크리에이터 공개 프로필 페이지

#### Phase 5 — 어드민 패널 (2026-03-12)
- Next.js 어드민 대시보드 초기 구현
- 유저/크리에이터/신고 관리

#### Phase 6 — 앱스토어 준비 (2026-03-12~13)
- 통화 화면 캡처 방지 (`expo-screen-capture`)
- `lib/api.ts`: Supabase Bearer 토큰 자동 주입 + 개발 환경 LAN IP 자동 감지
- PortOne 서비스 랜딩 페이지 (`server/app/portone/`)
- **피드 시스템**: 인스타그램형 포스트 카드/그리드/캐러셀
- **쇼핑탭**: 상품 목록/상세/구매 내역
- **즐겨찾기**: 온라인 상태 푸시 알림 연동
- **DM 시스템**: Supabase Realtime 기반 채팅
- **홈 개선**: 주간/월간 인기 순위 섹션
- **한줄 리뷰**: 크리에이터 평점 + 코멘트
- **카테고리 필터**: 병렬/다중 선택 + 피드 정렬
- **어드민 쇼핑 관리**: 상품/포스트/주문(환불) 페이지
- **선물 시스템**: 통화 중 선물 + 후원 이팩트 + 잔액 부족 UX
- **배너/체크인**: 홈 배너 + 출석 체크인
- **알림센터**: 앱 내 알림 목록

---

## 로컬 개발 환경 세팅

### 필수 조건
```bash
node -v   # v20 이상
```

### 앱 실행
```bash
cd /c/Users/yeomj/OneDrive/Desktop/wantsome
npm install

# Metro + Expo 실행
npx expo start --android   # 또는 --ios
```

### API 서버 실행
```bash
cd server
npm install
npm run dev   # http://localhost:3000
```

### Android 에뮬레이터에서 API 서버 연결
```bash
# adb reverse로 에뮬레이터 → 호스트 포트 포워딩
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:3000 tcp:3000   # API 서버
```

> 자세한 내용: `docs/GUIDE_ANDROID_EMULATOR.md`

---

## 주요 문서

| 문서 | 경로 |
|------|------|
| 배포 가이드 (APK/TestFlight) | `docs/distribution-guide.md` |
| Android 에뮬레이터 가이드 | `docs/GUIDE_ANDROID_EMULATOR.md` |
| API 서버 가이드 | `docs/GUIDE_API_SERVER.md` |
| 소셜 로그인 설정 | `docs/GUIDE_SOCIAL_LOGIN.md` |
| DB 스키마 | `docs/database/` |
| API 명세 | `docs/api/` |
| 화면 설계 | `docs/screens/` |
| 이용약관 | `https://api.wantsome.kr/terms` |
| 개인정보처리방침 | `https://api.wantsome.kr/privacy` |

---

## 환경 변수

### 앱 (`.env.local`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://ftnfdtvaxsvosdyjdxfq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_API_BASE_URL=https://api.wantsome.kr
EXPO_PUBLIC_AGORA_APP_ID=<agora-app-id>
```

### 서버 (Vercel 환경 변수)
```env
SUPABASE_URL=https://ftnfdtvaxsvosdyjdxfq.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
AGORA_APP_ID=<agora-app-id>
AGORA_APP_CERTIFICATE=<agora-certificate>
SLACK_WEBHOOK_URL=<slack-webhook>

# PortOne (사업자 등록 후 추가 → verify.tsx 자동으로 PASS 모드 전환)
PORTONE_API_SECRET=<portone-secret>
PORTONE_STORE_ID=<store-id>
PORTONE_CHANNEL_KEY=<channel-key>
```

---

## 미구현 항목 (로드맵)

| 우선순위 | 항목 | 선행 조건 |
|----------|------|-----------|
| P0 | **IAP 실결제 연동** (App Store / Google Play Billing) | 스토어 계정 |
| P0 | **PortOne PASS 본인인증** 활성화 | 사업자 등록 |
| P1 | **부가통신사업자 신고** (방통위) | 사업자 등록 |
| P1 | **PortOne 본인인증** 환경 변수 추가 | PortOne 계약 |
| P1 | **Twilio → NHN Cloud Toast** SMS 전환 (8원/건) | 사업자 등록 |
| P2 | **앱스토어 스크린샷** — 실제 크리에이터 피드 | 크리에이터 모집 |
| P2 | **앱 설명** 한국어/영어 버전 | — |
| P3 | **푸시 알림** (notifications 테이블 + FCM/APNs) | — |

---

## 연락처

- 서비스 문의: support@wantsome.kr
- 개인정보: privacy@wantsome.kr
- 도메인: wantsome.kr
- Bundle ID: kr.wantsome.app
