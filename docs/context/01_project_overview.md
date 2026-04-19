# wantsome — 프로젝트 개요

> MEET SOMEONE SPECIAL
> 크리에이터·팬 1:1 영상통화 | 운영: 주식회사 98점7도 · 브랜드 원썸(wantsome)

---

## 서비스 정의

| 항목 | 내용 |
|------|------|
| 서비스명 | wantsome (원썸) |
| 카테고리 | 성인 소셜 / 라이브 영상통화 플랫폼 |
| 포지셔닝 | 캠톡 오마주 · 크리에이터 친화형 |
| 타겟 | 만 18세 이상 국내 성인 (소비자), 크리에이터 (여/남) |
| 핵심 가치 | 스탠다드(blue) / 프리미엄(red) 이중 모드 · 업계 최저 수수료 25% |

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | React Native (Expo SDK 51+) | Expo Router |
| 백엔드 API | Next.js 15 App Router | Vercel 배포 |
| 데이터베이스 | Supabase (PostgreSQL) | Realtime + Auth + Storage |
| 영상통화 | Agora RTC SDK | 아시아 40ms 초저지연 |
| 결제 (IAP) | expo-in-app-purchases | iOS/Android 인앱결제 |
| 결제 미들웨어 | PortOne V2 + KG이니시스 | 본인인증 + 커머스 |
| 상태관리 | Zustand | |
| 스타일링 | NativeWind (TailwindCSS) | |
| 알림 | Expo Notifications + FCM | |
| 배포 | Vercel + Expo EAS | |

---

## 폴더 구조 (Expo Router)

```
app/
├── (auth)/           # 온보딩, 로그인 (인증 불필요)
│   ├── splash.tsx
│   ├── login.tsx
│   ├── terms.tsx
│   ├── verify.tsx    # 본인인증
│   ├── role.tsx
│   ├── mode.tsx
│   └── profile.tsx
├── (app)/            # 메인 앱 (인증 필요)
│   ├── (tabs)/
│   │   ├── index.tsx       # 메인 피드
│   │   ├── reservations.tsx
│   │   └── profile.tsx
│   ├── call/[sessionId].tsx
│   └── charge/index.tsx
└── (creator)/        # 크리에이터 전용
    ├── onboarding/
    │   ├── contract.tsx
    │   ├── id-card.tsx
    │   └── account.tsx
    └── dashboard/index.tsx

components/           # 공통 컴포넌트
stores/               # Zustand stores
hooks/                # 커스텀 훅
lib/                  # API 클라이언트, 유틸
constants/            # 과금 단가, 상품 목록
docs/                 # 이 문서들
```

---

## 환경변수 (.env.example)

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 서버사이드 전용

# Agora
EXPO_PUBLIC_AGORA_APP_ID=
AGORA_APP_CERTIFICATE=          # 서버사이드 전용 (토큰 생성용)

# PortOne
PORTONE_API_SECRET=
EXPO_PUBLIC_PORTONE_STORE_ID=
EXPO_PUBLIC_PORTONE_CHANNEL_KEY=

# API
EXPO_PUBLIC_API_BASE_URL=https://api.wantsome.kr

# Slack (모더레이션 알림)
SLACK_WEBHOOK_URL=
```

---

## MVP 범위

| 기능 | MVP | v2 |
|------|-----|----|
| 회원가입 / 온보딩 | ✅ | |
| 본인인증 (PortOne PASS) | ✅ | |
| 포인트 충전 (IAP) | ✅ | |
| 크리에이터 탐색 피드 | ✅ | |
| 즉시 영상통화 | ✅ | |
| 예약 통화 | ✅ | |
| 크리에이터 정산 | ✅ | |
| 신고/모더레이션 | ✅ | |
| 크리에이터 인증 온보딩 | ✅ | |
| 쇼핑 (커머스) | | ✅ |
| 라이브 스트리밍 | | ✅ |

---

## 보안 원칙

- **과금 로직은 반드시 서버사이드** — 클라이언트에서 포인트 직접 차감 절대 금지
- **영수증 서버 검증 필수** — Apple/Google 공식 API 사용
- **Supabase RLS 활성화** — 모든 테이블에 Row Level Security 적용
- **계좌번호 AES-256 암호화** 저장
- **신분증 private bucket** — 관리자만 접근 가능
