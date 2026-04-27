# 40. 빌드·배포·환경변수·도메인 감사

감사일: 2026-04-26
범위: EAS 빌드 설정, 환경변수, Vercel 배포, DNS, CI/CD, 모니터링, 시크릿 관리, 빌드 산출물 git 추적

---

## 종합 판정

| 등급 | 항목 수 | 설명 |
|:---:|:---:|---|
| BLOCKER (출시 불가) | 5 | 지금 안 하면 빌드/결제/인증 전체 불능 |
| CRITICAL (출시 전 필수) | 7 | 보안·결제 사고 직결 |
| HIGH (출시 직후 필수) | 6 | 운영 안정성·법적 의무 |
| MEDIUM (단기 개선) | 8 | 성능·보안 강화 |

---

## A. EAS 빌드 설정 (`eas.json`)

**판정: BLOCKER (iOS) + CRITICAL (Android)**

### A-1. BLOCKER — iOS production 빌드 설정 누락

현재 `eas.json` production 섹션에 iOS 관련 설정이 전무하다.

| 필수 항목 | 현재 값 | 필요 조치 |
|---|---|---|
| `ios.appleId` | 미설정 | App Store Connect 계정 이메일 |
| `ios.ascAppId` | 미설정 | App Store Connect 앱 ID (숫자) |
| `ios.appleTeamId` | 미설정 | Apple Developer Team ID (10자리) |
| `credentialsSource` | 미설정 | `"remote"` 또는 `"local"` 명시 필요 |

Android도 동일하게 `credentialsSource` 미지정. EAS Credentials 서비스가 keystore를 주입하더라도 명시적 선언 없이는 빌드 환경에 따라 debug keystore를 그대로 사용할 수 있다.

```jsonc
// eas.json production 섹션에 추가 필요 (예시)
"production": {
  "credentialsSource": "remote",
  "ios": {
    "appleId": "YOUR_APPLE_ID@example.com",
    "ascAppId": "1234567890",
    "appleTeamId": "XXXXXXXXXX"
  },
  ...
}
```

### A-2. BLOCKER — `calls/tick` Cron 스케줄 오류

`vercel.json`의 `/api/calls/tick` 스케줄이 `"0 3 * * *"` (매일 03:00 1회)로 되어 있으나, 코드 주석 및 설계 의도는 **매분 실행**이다. 영상통화 포인트 차감이 전혀 이루어지지 않아 통화 중 포인트 소진 없이 무제한 통화가 가능한 상태다.

```jsonc
// server/vercel.json 현재
{ "path": "/api/calls/tick", "schedule": "0 3 * * *" }

// 올바른 값
{ "path": "/api/calls/tick", "schedule": "* * * * *" }
```

Vercel Pro 플랜에서만 분 단위 Cron이 지원된다. Hobby 플랜이면 업그레이드가 선행되어야 한다.

### A-3. 환경변수 빌드별 분리 상태

| 환경 | API_BASE_URL | Supabase | Agora | PortOne |
|---|---|---|---|---|
| development | localhost:3000 | 프로덕션 DB | 프로덕션 App ID | 미설정 |
| preview | api.wantsome.kr | 프로덕션 DB | 프로덕션 App ID | 미설정 |
| staging | api-staging.wantsome.kr | 프로덕션 DB | 프로덕션 App ID | 미설정 |
| production | api.wantsome.kr | 프로덕션 DB | 프로덕션 App ID | 미설정 |

**문제점:**
- development·preview·staging 모두 프로덕션 Supabase를 바라봄 — 테스트 데이터가 실 DB를 오염시킬 위험
- EXPO_PUBLIC_PORTONE_STORE_ID, EXPO_PUBLIC_PORTONE_CHANNEL_KEY 전 환경 미설정
- `eas.json` `env` 블록에 EXPO_PUBLIC_SUPABASE_ANON_KEY가 평문 하드코딩됨 (EAS Secret 미활용, git 이력에 노출)

---

## B. EAS 환경변수 (Secret) 인벤토리

**판정: CRITICAL — 결제·인증 키 미등록**

`eas.json`의 `env` 블록에 값이 직접 기입되어 있어 git 이력에 노출된다. 아래 항목은 EAS Secret (대시보드 → Secrets) 또는 EAS 환경변수 UI에서 관리해야 한다.

### EAS Secret 등록 필요 항목

| 변수명 | 현재 상태 | 비고 |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | eas.json 평문 하드코딩 (git 노출) | EAS Secret으로 이전 |
| `EXPO_PUBLIC_AGORA_APP_ID` | eas.json 평문 하드코딩 (git 노출) | EAS Secret으로 이전 |
| `EXPO_PUBLIC_PORTONE_STORE_ID` | 전 환경 미설정 | EAS Secret 등록 필요 |
| `EXPO_PUBLIC_PORTONE_CHANNEL_KEY` | 전 환경 미설정 | EAS Secret 등록 필요 |
| `EXPO_PUBLIC_API_BASE_URL` | eas.json에 값 있음 (환경별 정상) | Secret 불필요, 현재 방식 유지 가능 |
| `EXPO_PUBLIC_SUPABASE_URL` | eas.json 평문 하드코딩 | 공개 엔드포인트이므로 허용 범위. 단, git 이력 확인 |

**EXPO_PUBLIC_* 는 앱 번들에 평문 포함되므로 서버 전용 시크릿을 절대 넣지 말 것.** 현재 코드에서 이 패턴 위반은 발견되지 않음.

---

## C. Vercel 환경변수

**판정: BLOCKER (3건) + CRITICAL (4건)**

`server/.env`는 `.gitignore`에 포함되어 git 추적에서 제외되어 있으나, 실제 값이 로컬 파일에만 존재하고 **Vercel 프로덕션 환경변수로 등록되었는지 확인 불가** — 팀이 수동으로 등록했는지 반드시 검증 필요.

### C-1. BLOCKER — PORTONE_API_SECRET 미설정 시 인증 우회 활성화

`server/app/api/auth/verify-identity/route.ts:38` 및 `:82`:

```typescript
// PORTONE_API_SECRET이 없으면 아무 identityVerificationId로도 인증 통과
if (identityVerificationId === "test-portone-id" || !process.env.PORTONE_API_SECRET) {
  // is_verified = true 저장
}
```

프로덕션에서 이 변수가 미설정이면 **임의 사용자가 본인인증을 우회하고 is_verified = true를 획득**한다. 청소년 차단, Red 크리에이터 자격 검증 전체가 무력화된다.

### C-2. BLOCKER — ACCOUNT_ENCRYPT_KEY zero-key fallback

`server/app/api/creators/register/route.ts:9`:

```typescript
const key = Buffer.from(process.env.ACCOUNT_ENCRYPT_KEY ?? "0".repeat(64), "hex");
```

ACCOUNT_ENCRYPT_KEY 미설정 시 AES-256-GCM 키가 64개의 '0' 문자(= 32바이트 전부 0x30)로 고정된다. 이 키로 암호화된 계좌번호는 사실상 평문과 동일하다. 현재 `server/.env`에는 값이 존재하나, Vercel 환경변수로 등록 여부를 반드시 확인해야 한다.

### C-3. BLOCKER — APPLE_IAP_SHARED_SECRET / GOOGLE_SERVICE_ACCOUNT_JSON 미설정

`server/.env`에 두 값 모두 빈 문자열. `server/.env.example`도 동일. IAP 영수증 서버 검증(Apple Receipt Validation, Google Play Developer API)이 구현되어 있더라도 키가 없으면 동작하지 않는다.

### Vercel 프로덕션 등록 체크리스트

| 변수명 | server/.env 상태 | 등록 필요 여부 |
|---|---|---|
| `SUPABASE_URL` | 값 있음 | Vercel 등록 확인 필요 |
| `SUPABASE_ANON_KEY` | 값 있음 | Vercel 등록 확인 필요 |
| `NEXT_PUBLIC_SUPABASE_URL` | 값 있음 | Vercel 등록 확인 필요 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 값 있음 | Vercel 등록 확인 필요 |
| `SUPABASE_SERVICE_ROLE_KEY` | 값 있음 | Vercel 등록 확인 필요 |
| `AGORA_APP_ID` | 값 있음 | Vercel 등록 확인 필요 |
| `AGORA_APP_CERTIFICATE` | 값 있음 | Vercel 등록 확인 필요 |
| `CRON_SECRET` | 값 있음 | Vercel 등록 확인 필요 |
| `ACCOUNT_ENCRYPT_KEY` | 값 있음 | Vercel 등록 확인 필요 |
| `PORTONE_API_SECRET` | **빈 문자열** | **즉시 등록 필수** |
| `PORTONE_STORE_ID` | 빈 문자열 | 등록 필요 |
| `PORTONE_CHANNEL_KEY` | 빈 문자열 | 등록 필요 |
| `APPLE_IAP_SHARED_SECRET` | **빈 문자열** | **즉시 등록 필수** |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **빈 문자열** | **즉시 등록 필수** |
| `SLACK_WEBHOOK_URL` | 미정의 | 정산 알림용, 등록 필요 |

---

## D. 도메인 / DNS / SSL

**판정: HIGH — 설정 미완료**

### D-1. DNS 설정 현황

| 도메인 | 용도 | 현재 설정 | 필요 조치 |
|---|---|---|---|
| `wantsome.kr` | 랜딩 페이지 또는 앱 링크 | 확인 불가 (코드에 미등장) | Vercel 또는 별도 호스팅 연결 필요 |
| `api.wantsome.kr` | Next.js 서버 (Vercel) | CNAME 예정 | Vercel 도메인 등록 + DNS CNAME 설정 |

`app.json`의 iOS/Android bundleIdentifier가 `kr.wantsome.app`이므로 도메인 방향성은 일관성 있음.

### D-2. SSL

Vercel은 Let's Encrypt를 자동 프로비저닝하므로 도메인만 연결하면 SSL은 자동 발급된다.

### D-3. Security Headers — 미설정

`server/next.config.ts`가 빈 설정이며, `middleware.ts`는 `/admin` 경로만 처리한다. API 응답에 보안 헤더가 전혀 없다.

누락된 헤더:

```
Strict-Transport-Security (HSTS)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy (최소한 api 경로)
```

`next.config.ts`의 `headers()` 또는 `middleware.ts`에서 모든 응답에 추가해야 한다.

---

## E. Vercel 프로젝트 설정

**판정: CRITICAL (Cron 오류) + MEDIUM (리전, Function timeout)**

### E-1. Cron 설정 (`server/vercel.json`)

| 경로 | 현재 스케줄 | 올바른 스케줄 | 문제 |
|---|---|---|---|
| `/api/calls/tick` | `0 3 * * *` (매일 1회) | `* * * * *` (매분) | **BLOCKER — 포인트 차감 불능** |
| `/api/live/tick` | `*/5 * * * *` (5분) | `*/1 * * * *` 또는 `*/5 * * * *` | ACK 타임아웃 10초인데 5분 간격 — 환불 지연 크게 발생 가능 |
| `/api/settlements/run` | `0 9 15 * *` | 동일 | 정상 |
| `/api/creators/update-grades` | `0 0 1 * *` | 동일 | 정상 |
| `/api/reports/daily-summary` | `0 9 * * *` | 동일 | 정상 |
| `/api/reservations/remind` | `0 8 * * *` | 동일 | 정상 |
| `/api/reservations/noshow` | `0 4 * * *` | 동일 | 정상 |

`vercel.json`의 Cron은 UTC 기준이다. 한국 시간(KST = UTC+9) 환산 확인 필요:
- `settlements/run`: `0 9 15 * *` UTC → 한국 18:00 KST 실행 (의도 09:00 KST라면 `0 0 15 * *` UTC로 변경 필요)

### E-2. Function Timeout

현재 `vercel.json`에 `functions` 섹션이 없다. Vercel 기본 Function timeout은 **10초** (Hobby) 또는 **60초** (Pro)이다. `settlements/run`은 크리에이터 수에 따라 수십 초 소요 가능. Pro 플랜이라면 `vercel.json`에 명시 권고:

```json
"functions": {
  "app/api/settlements/run/route.ts": { "maxDuration": 300 },
  "app/api/calls/tick/route.ts": { "maxDuration": 30 }
}
```

### E-3. 리전 설정

`vercel.json`에 리전 미설정. 한국 사용자 대상 서비스는 `nrt1` (Tokyo) 또는 `icn1` (Incheon, 지원 시)을 우선 고려해야 한다. 미설정 시 Vercel 기본 리전(iad1, 버지니아)에서 응답하여 영상통화 Agora 토큰 생성 레이턴시가 증가한다.

```json
// vercel.json에 추가
"regions": ["nrt1"]
```

---

## F. Android 빌드

**판정: BLOCKER (이미 발견) + CRITICAL**

### F-1. BLOCKER — debug.keystore 서명 (31-playstore-compliance.md 재확인)

`android/app/build.gradle:115`:
```gradle
release {
    signingConfig signingConfigs.debug  // 릴리즈 빌드가 debug.keystore 사용
```

EAS `credentialsSource` 미지정으로 인해 EAS Credentials에서 keystore를 주입해도 이 설정이 재정의될지 보장되지 않는다. Play Store 제출 전 반드시 확인 필요.

### F-2. BLOCKER — google-services.json 플레이스홀더 (31-playstore-compliance.md 재확인)

`google-services.json`이 `project_id: "wantsome-placeholder"`, `mobilesdk_app_id: "1:000000000000:android:0000000000000000"` 값으로 git에 커밋되어 있다. 이 상태로 빌드된 앱은 FCM 푸시 알림, Firebase 연동이 전부 불능이다.

EAS 빌드에서 실제 파일을 주입하는 방법:
```json
// eas.json 각 환경 섹션에 추가
"android": {
  "googleServicesFile": "./google-services.production.json"
}
```
실제 `google-services.production.json`은 git에 커밋하지 않고 EAS Secret File로 관리해야 한다. 현재 `app.json`에는 `"googleServicesFile": "./google-services.json"`으로 루트 파일을 가리키고 있어 플레이스홀더가 그대로 사용된다.

### F-3. google-service-account.json 미존재

`eas.json` submit 섹션에 `"serviceAccountKeyPath": "./google-service-account.json"`이 지정되어 있으나, git ls-files 결과 해당 파일이 없다. `eas submit` 실행 전 파일 확보 필요 (EAS Secret File 또는 로컬 경로).

---

## G. iOS 빌드

**판정: HIGH**

### G-1. Privacy Manifest (PrivacyInfo.xcprivacy)

`app.json`에 `privacyManifests` 섹션이 설정되어 있고 4개 API 카테고리가 선언되어 있다.

| 선언된 API 카테고리 | 이유 코드 |
|---|---|
| NSPrivacyAccessedAPICategoryUserDefaults | CA92.1 |
| NSPrivacyAccessedAPICategoryFileTimestamp | C617.1 |
| NSPrivacyAccessedAPICategoryDiskSpace | E174.1 |
| NSPrivacyAccessedAPICategorySystemBootTime | 35F9.1 |

node_modules 내 xcprivacy 파일은 expo-notifications, expo-constants, async-storage 등 의존성에서 왔다. Expo SDK 55의 `prebuild` 과정에서 이들이 병합된다. **Agora SDK (react-native-agora)의 xcprivacy가 포함되는지 별도 확인 필요** — Agora iOS SDK가 UserDefaults, FileTimestamp 등을 사용하면 추가 선언 필요.

### G-2. APNs Key — Supabase Auth 연동

iOS 푸시 알림을 위해 APNs Auth Key (.p8)를 Supabase Dashboard (Authentication → Push Notifications) 에 등록해야 한다. EAS Push (Expo 자체 푸시 서비스)를 사용하는 경우에도 별도 APNs Key가 필요하다. 현재 설정 여부 코드에서 확인 불가 — Supabase 대시보드 직접 확인 필요.

### G-3. `UIBackgroundModes`

`app.json`에 `["audio", "remote-notification"]`이 선언되어 있다. 영상통화 중 백그라운드 오디오를 위해 `audio` 모드는 정당하나, App Store 심사에서 실제 사용 여부를 확인한다. 통화 중 백그라운드 전환 시 오디오가 유지되는지 테스트 필요.

---

## H. CI/CD

**판정: HIGH — 파이프라인 없음**

`.github/workflows/` 디렉터리가 존재하지 않는다. 현재 배포 프로세스가 완전히 수동이다.

**출시 후 최소 구성 권고:**

```yaml
# .github/workflows/deploy.yml (예시)
on:
  push:
    branches: [main]
jobs:
  deploy-server:
    # vercel --prod (서버)
  build-android:
    # eas build --platform android --profile production
  build-ios:
    # eas build --platform ios --profile production
```

수동 배포는 시크릿 노출, 빌드 누락, 환경변수 불일치 위험이 높다. 출시 전이 아니더라도 최소한 Vercel의 Git 연동 자동 배포는 활성화해야 한다.

---

## I. Sentry / 로그 / 모니터링

**판정: HIGH — 에러 트래킹 없음**

| 항목 | 현재 상태 | 필요 조치 |
|---|---|---|
| Sentry / Bugsnag | 미설치 (package.json에 없음) | `@sentry/nextjs` + `@sentry/react-native` 설치 및 설정 |
| 구조적 로깅 | `server/lib/logger.ts` 존재 — 확인됨 | Vercel Log Drains 또는 Axiom 연동 고려 |
| 결제 사고 알림 | `SLACK_WEBHOOK_URL` — 정산 Cron에만 연결 | IAP 검증 실패, 포인트 이상 차감도 알림 추가 필요 |
| KPI 대시보드 | 미구성 | PostHog 또는 Amplitude 연동 (선택) |
| Vercel Analytics | 미설정 (`next.config.ts` 빈 설정) | `@vercel/analytics` 추가 권고 |

에러 트래킹 없이 프로덕션 운영 시 결제·통화 오류가 사용자 리포트 전까지 감지되지 않는다.

---

## J. 백업 / 복구

**판정: MEDIUM — Supabase 기본 정책 의존**

| 항목 | 현재 상태 | 권고 |
|---|---|---|
| Supabase DB 백업 | Supabase Pro 플랜 기본 제공 (일 1회 Point-in-Time Recovery 7일) | Pro 플랜 여부 확인, 필요 시 PITR 14일로 확장 |
| RTO (Recovery Time Objective) | 정의 없음 | 목표: 4시간 이내 |
| RPO (Recovery Point Objective) | 정의 없음 | 목표: 1시간 이내 (PITR 기준) |
| 재해 복구 절차 문서 | 없음 | 최소 Runbook 작성 필요 |
| creator_settlements 백업 | Supabase 자동 백업 포함 | 정산 데이터는 월 1회 수동 export 권고 |

---

## K. 시크릿 회전 정책

**판정: MEDIUM — 정책 없음**

| 시크릿 | 현재 노출 위험 | 권고 회전 주기 |
|---|---|---|
| SUPABASE_SERVICE_ROLE_KEY | git 이력 미노출 (server/.env gitignore) — 단, Vercel 등록 확인 필요 | 6개월 |
| AGORA_APP_CERTIFICATE | `server/.env`에 평문, gitignore 제외 | 6개월 |
| CRON_SECRET | `server/.env`에 평문, gitignore 제외 | 3개월 |
| ACCOUNT_ENCRYPT_KEY | `server/.env`에 평문, gitignore 제외. **회전 시 기존 암호화 계좌 재암호화 필요** | 1년 (신중하게) |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | `eas.json`에 평문 하드코딩, **git 이력에 노출됨** | anon key는 RLS가 방어선 — RLS 정책 검증 우선 |
| EXPO_PUBLIC_AGORA_APP_ID | `eas.json`에 평문 하드코딩, **git 이력에 노출됨** | Agora Console에서 허용 도메인/번들ID 제한 설정 필요 |

**시크릿 노출 시 대응 절차 (미작성):**
1. Supabase 대시보드에서 해당 키 즉시 rotate
2. Vercel 환경변수 업데이트 후 재배포
3. EAS Secret 업데이트 후 앱 재빌드
4. 사고 발생 시각, 범위, 대응 내역 문서화

---

## L. 빌드 산출물 git 추적

**판정: CRITICAL — dist-android-smoke가 git에 커밋됨**

`git ls-files` 결과 `dist-android-smoke/` 디렉터리 전체가 git에 추적되고 있다. 커밋 이력:
- `9962c67 v1`, `28381d4 라이브 기능` — `dist-android-smoke/`가 추적됨

`dist/` 디렉터리도 git에 추적되는 것으로 확인됨.

**위험:**
1. 번들에 포함된 `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_AGORA_APP_ID` 값이 `.hbc` (Hermes Bytecode) 형태로 git에 영구 기록됨
2. 빌드 산출물이 git에 있으면 저장소 크기 급증, Clone 시간 증가
3. EAS OTA 업데이트 경로와 충돌 위험

**즉시 조치:**

```bash
# .gitignore에 이미 dist/ 가 있으나 기존 추적 파일 제거 필요
git rm -r --cached dist/ dist-android-smoke/ dist-web-smoke/
git commit -m "chore: remove tracked build artifacts from git"
```

이후 `.gitignore`에 아래 추가:
```
dist-android-smoke/
dist-web-smoke/
```

---

## M. 보안 헤더 / OWASP API Top 10 현황

**판정: MEDIUM**

| OWASP API | 상태 | 근거 |
|---|---|---|
| API1 Broken Object Level Auth | 부분 — 서버 JWT 검증 있음 | middleware.ts, Bearer 토큰 |
| API2 Broken Authentication | CRITICAL — PORTONE_API_SECRET 미설정 시 우회 | verify-identity/route.ts:82 |
| API3 Broken Object Property Level | 미검토 | 별도 감사 필요 |
| API4 Unrestricted Resource Consumption | IAP 레이트 제한 있음 (5회/1시간) | verify-iap/route.ts:58 |
| API5 Broken Function Level Auth | Admin 미들웨어 존재 | middleware.ts |
| API7 Server Side Request Forgery | SLACK_WEBHOOK_URL fetch — 외부 URL 고정이므로 위험 낮음 | settlements/run.ts:101 |
| API8 Security Misconfiguration | 보안 헤더 전무 | next.config.ts 빈 설정 |
| API10 Unsafe Consumption of APIs | PortOne fallback 우회 | verify-identity/route.ts:38 |

---

## 우선순위별 조치 요약

### BLOCKER — 이것 없이 출시 불가

| # | 항목 | 파일 위치 | 조치 |
|---|---|---|---|
| B1 | `calls/tick` Cron 스케줄 `0 3 * * *` → `* * * * *` | `server/vercel.json:3` | 스케줄 수정 + Vercel Pro 플랜 확인 |
| B2 | iOS EAS 빌드 설정 누락 (appleId, ascAppId, appleTeamId) | `eas.json` production | EAS 콘솔 또는 eas.json에 추가 |
| B3 | `credentialsSource` 미지정 (Android/iOS 양쪽) | `eas.json` | `"credentialsSource": "remote"` 추가 |
| B4 | `PORTONE_API_SECRET` 미설정 → 본인인증 전면 우회 | Vercel 환경변수 | PortOne 콘솔에서 키 발급 후 Vercel 등록 |
| B5 | google-services.json 플레이스홀더 → FCM 불능 | `google-services.json` | 실제 Firebase 파일 EAS Secret File로 주입 |

### CRITICAL — 출시 전 완료

| # | 항목 | 파일 위치 | 조치 |
|---|---|---|---|
| C1 | dist-android-smoke / dist git 추적 | git history | `git rm -r --cached dist/ dist-android-smoke/` |
| C2 | ACCOUNT_ENCRYPT_KEY zero-key fallback 위험 | `server/app/api/creators/register/route.ts:9` | Vercel 환경변수 등록 확인 |
| C3 | APPLE_IAP_SHARED_SECRET 미설정 | `server/.env`, Vercel | App Store Connect 공유 암호 발급 후 등록 |
| C4 | GOOGLE_SERVICE_ACCOUNT_JSON 미설정 | `server/.env`, Vercel | Play Console 서비스 계정 JSON 발급 후 등록 |
| C5 | google-service-account.json 미존재 | EAS submit | Play Console 서비스 계정 생성 후 EAS Secret File 등록 |
| C6 | live/tick 5분 간격 — ACK 환불 최대 5분 지연 | `server/vercel.json:5` | 스케줄 `* * * * *` 또는 `*/1 * * * *`으로 단축 권고 |
| C7 | settlements/run UTC 09:00 = KST 18:00 — 의도 확인 필요 | `server/vercel.json:6` | KST 09:00 원하면 `0 0 15 * *` UTC로 변경 |

### HIGH — 출시 직후 즉시

| # | 항목 | 조치 |
|---|---|---|
| H1 | Sentry 미설치 — 에러 트래킹 없음 | `@sentry/nextjs` + `@sentry/react-native` 설치 |
| H2 | GitHub Actions CI/CD 파이프라인 없음 | 최소 Vercel Git 연동 자동 배포 활성화 |
| H3 | Security Headers 전무 | `next.config.ts` headers() 또는 middleware.ts 추가 |
| H4 | APNs Key Supabase 등록 여부 미확인 | Supabase 대시보드 Auth → Push Notifications 확인 |
| H5 | EAS Secret 미활용 — eas.json에 평문 | anon key, Agora App ID를 EAS Secret으로 이전 |
| H6 | Vercel Function timeout 미설정 (settlements 실패 위험) | vercel.json functions 섹션 추가 |

### MEDIUM — 단기 개선

| # | 항목 | 조치 |
|---|---|---|
| M1 | Vercel 리전 미설정 | `vercel.json`에 `"regions": ["nrt1"]` 추가 |
| M2 | dev/preview/staging이 프로덕션 Supabase 사용 | 스테이징용 Supabase 프로젝트 분리 |
| M3 | Supabase PITR 정책 확인 | Pro 플랜 여부 + PITR 활성화 확인 |
| M4 | 시크릿 회전 정책 문서화 | Runbook 작성 |
| M5 | EXPO_PUBLIC_PORTONE_STORE_ID/CHANNEL_KEY 미설정 | PortOne 콘솔 발급 후 EAS Secret 등록 |
| M6 | Agora iOS xcprivacy 병합 여부 확인 | react-native-agora 릴리즈 노트 확인 |
| M7 | R8/ProGuard 비활성화 (31-playstore-compliance 연계) | `gradle.properties` minify 활성화 |
| M8 | KPI/Analytics 미구성 | PostHog 또는 Vercel Analytics 추가 |

---

## 참조 파일 경로

| 파일 | 관련 항목 |
|---|---|
| `C:\dev\wantsome\eas.json` | A, B, F |
| `C:\dev\wantsome\server\vercel.json` | E |
| `C:\dev\wantsome\server\.env` | C |
| `C:\dev\wantsome\server\.env.example` | C |
| `C:\dev\wantsome\.env.local` | B |
| `C:\dev\wantsome\.gitignore` | L |
| `C:\dev\wantsome\app.json` | G, F |
| `C:\dev\wantsome\server\middleware.ts` | D, M |
| `C:\dev\wantsome\server\next.config.ts` | D, M |
| `C:\dev\wantsome\server\app\api\auth\verify-identity\route.ts` | C-1 |
| `C:\dev\wantsome\server\app\api\creators\register\route.ts` | C-2 |
| `C:\dev\wantsome\server\app\api\calls\tick\route.ts` | A-2, E-1 |
| `C:\dev\wantsome\server\app\api\live\tick\route.ts` | E-1 |
| `C:\dev\wantsome\server\app\api\settlements\run\route.ts` | E-1 |
| `C:\dev\wantsome\server\lib\agora.ts` | C |
| `C:\dev\wantsome\server\lib\supabase.ts` | C |
| `C:\dev\wantsome\google-services.json` | F-2 |
| `C:\dev\wantsome\docs\launch-readiness\31-playstore-compliance.md` | F-1, F-2 |
