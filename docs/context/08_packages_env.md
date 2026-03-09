# wantsome — 패키지 의존성 & 환경변수 통합

---

## package.json (React Native / Expo 앱)

```json
{
  "name": "wantsome",
  "version": "1.0.0",
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "react": "18.2.0",
    "react-native": "0.74.0",

    "-- [인증/소셜로그인] --": "",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/auth-helpers-react": "^0.4.0",
    "@react-native-seoul/kakao-login": "^5.3.1",
    "@react-native-google-signin/google-signin": "^12.1.0",

    "-- [영상통화] --": "",
    "react-native-agora": "^4.3.0",
    "react-native-svg": "^15.2.0",

    "-- [결제 / 본인인증] --": "",
    "expo-in-app-purchases": "~14.5.0",
    "react-native-webview": "13.10.2",

    "-- [상태관리] --": "",
    "zustand": "^4.5.2",
    "@react-native-async-storage/async-storage": "1.23.1",

    "-- [UI / 스타일] --": "",
    "nativewind": "^4.0.1",
    "tailwindcss": "3.4.3",
    "expo-linear-gradient": "~13.0.2",
    "@expo/vector-icons": "^14.0.0",
    "react-native-bottom-sheet": "^4.6.1",
    "react-native-toast-message": "^2.2.0",
    "@gorhom/portal": "^1.0.14",

    "-- [미디어] --": "",
    "expo-camera": "~15.0.14",
    "expo-av": "~14.0.7",
    "expo-image-picker": "~15.0.7",
    "expo-image": "~1.12.12",

    "-- [알림] --": "",
    "expo-notifications": "~0.28.9",

    "-- [기타 유틸] --": "",
    "expo-constants": "~16.0.2",
    "expo-linking": "~6.3.1",
    "expo-status-bar": "~1.12.1",
    "expo-splash-screen": "~0.27.5",
    "react-native-signature-canvas": "^4.7.2",
    "compare-versions": "^6.1.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.0",
    "typescript": "~5.3.0"
  }
}
```

---

## package.json (Next.js API 서버)

```json
{
  "name": "wantsome-api",
  "version": "1.0.0",
  "dependencies": {
    "next": "15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",

    "-- [Supabase] --": "",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/auth-helpers-nextjs": "^0.10.0",

    "-- [Agora 토큰 생성] --": "",
    "agora-token": "^2.0.4",

    "-- [푸시 알림] --": "",
    "expo-server-sdk": "^3.7.0",

    "-- [암호화] --": "",
    "crypto": "built-in",

    "-- [PDF 생성 (계약서)] --": "",
    "@react-pdf/renderer": "^3.4.3",

    "-- [유틸] --": "",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

---

## 환경변수 통합 정리

> `01_project_overview.md`와 `07_vercel_deploy.md`의 내용을 이 파일로 통일합니다.
> 아래 두 파일이 정식 환경변수 레퍼런스입니다.

---

### .env.local (Expo 앱 — 개발용)

```env
# API 서버
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Agora
EXPO_PUBLIC_AGORA_APP_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# PortOne
EXPO_PUBLIC_PORTONE_STORE_ID=store-xxxxxxxx
EXPO_PUBLIC_PORTONE_CHANNEL_KEY=channel-key-xxxxxxxx
```

> `EXPO_PUBLIC_` 접두사 = 클라이언트에 노출됨 (공개키만)
> 비밀키는 절대 `EXPO_PUBLIC_` 사용 금지

---

### .env (Next.js API 서버)

```env
# ────────────── Supabase ──────────────
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # ⚠️ 서버사이드 전용, 절대 클라이언트 노출 금지

# ────────────── Agora ──────────────
AGORA_APP_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AGORA_APP_CERTIFICATE=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 토큰 생성용, 서버사이드 전용

# ────────────── PortOne ──────────────
PORTONE_API_SECRET=xxxx                 # 본인인증 서버 검증용
PORTONE_STORE_ID=store-xxxxxxxx
PORTONE_CHANNEL_KEY=channel-key-xxxxxxxx

# ────────────── 슬랙 웹훅 ──────────────
SLACK_WEBHOOK_URGENT=https://hooks.slack.com/...      # #긴급-신고
SLACK_WEBHOOK_CREATOR=https://hooks.slack.com/...     # #크리에이터-심사
SLACK_WEBHOOK_POINTS=https://hooks.slack.com/...      # #포인트-로그
SLACK_WEBHOOK_SETTLEMENT=https://hooks.slack.com/...  # #정산-알림
SLACK_WEBHOOK_REPORT=https://hooks.slack.com/...      # #매출-리포트
SLACK_WEBHOOK_OPS=https://hooks.slack.com/...         # #운영-알림

# ────────────── 보안 ──────────────
CRON_SECRET=랜덤32자리문자열              # Vercel Cron 보호
ENCRYPTION_KEY=랜덤32바이트헥스           # AES-256 계좌번호 암호화

# ────────────── Apple IAP ──────────────
APPLE_IAP_SHARED_SECRET=xxxx             # App Store Connect → 앱 → 구독 → 공유 시크릿

# ────────────── Google IAP ──────────────
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  # 한 줄로 직렬화
```

---

### 환경변수 발급처 가이드

| 변수 | 발급처 | 주의사항 |
|------|--------|---------|
| SUPABASE_URL / ANON_KEY | Supabase 대시보드 → Settings → API | ANON_KEY는 공개 가능 |
| SUPABASE_SERVICE_ROLE_KEY | 동일 | 절대 클라이언트 노출 금지 |
| AGORA_APP_ID | Agora Console → Project | 클라이언트 노출 가능 |
| AGORA_APP_CERTIFICATE | 동일 | 서버사이드 전용 |
| PORTONE_API_SECRET | PortOne 콘솔 → 상점 → API 보안 | 서버사이드 전용 |
| SLACK_WEBHOOK_* | Slack → 앱 → Incoming Webhooks | URL 노출 주의 |
| CRON_SECRET | 직접 생성 (openssl rand -base64 32) | Vercel 대시보드에도 동일 값 |
| ENCRYPTION_KEY | 직접 생성 (openssl rand -hex 32) | 분실 시 복호화 불가 |
| APPLE_IAP_SHARED_SECRET | App Store Connect → 앱 → 앱 내 구매 | |
| GOOGLE_SERVICE_ACCOUNT_JSON | Google Play Console → 설정 → API 액세스 | |

---

### vercel.json 최종 (Cron 전체)

```json
{
  "crons": [
    { "path": "/api/calls/tick",              "schedule": "* * * * *"   },
    { "path": "/api/reservations/remind",     "schedule": "* * * * *"   },
    { "path": "/api/reservations/noshow",     "schedule": "* * * * *"   },
    { "path": "/api/settlements/run",         "schedule": "0 9 15 * *"  },
    { "path": "/api/creators/update-grades",  "schedule": "0 0 1 * *"   },
    { "path": "/api/reports/daily-summary",   "schedule": "0 9 * * *"   }
  ]
}
```

> ⚠️ Vercel Hobby 플랜은 Cron 분당 실행 불가 → **Pro 플랜 필수** (월 $20)
> `/api/calls/tick`이 매 분 실행되므로 Pro 플랜 없이는 과금 안 됨
