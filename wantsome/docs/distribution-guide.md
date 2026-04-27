# wantsome 배포 가이드
## APK (Android) + TestFlight (iOS) 배포 완전 가이드

> 작성일: 2025-03-15 | 대상: wantsome 개발팀

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Android APK 빌드](#2-android-apk-빌드)
3. [iOS TestFlight 배포](#3-ios-testflight-배포)
4. [Expo Application Services (EAS) 설정](#4-expo-application-services-eas-설정)
5. [환경 변수 설정](#5-환경-변수-설정)
6. [테스트 계정 세팅](#6-테스트-계정-세팅)
7. [앱스토어 심사 체크리스트](#7-앱스토어-심사-체크리스트)
8. [문제 해결](#8-문제-해결)

---

## 1. 사전 준비

### 1.1 필수 계정

| 계정 | 용도 | URL |
|------|------|-----|
| Apple Developer Program ($99/년) | iOS 배포, TestFlight | developer.apple.com |
| Google Play Console ($25 일회) | Android 배포 | play.google.com/console |
| Expo 계정 | EAS Build | expo.dev |

### 1.2 로컬 환경

```bash
# Node.js 20+ 필수
node -v  # v20.x.x 이상

# Expo CLI 설치
npm install -g expo-cli eas-cli

# Expo 로그인
eas login

# 프로젝트 루트에서
cd /c/Users/yeomj/OneDrive/Desktop/wantsome
npm install
```

### 1.3 앱 설정 확인

`app.json` 에서 다음 항목을 확인하세요:

```json
{
  "expo": {
    "name": "wantsome",
    "slug": "wantsome",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "kr.wantsome.app",
      "buildNumber": "1"
    },
    "android": {
      "package": "kr.wantsome.app",
      "versionCode": 1
    }
  }
}
```

---

## 2. Android APK 빌드

### 2.1 방법 A: EAS Build (권장)

```bash
cd /c/Users/yeomj/OneDrive/Desktop/wantsome

# eas.json이 없으면 초기화
eas build:configure

# 내부 테스트용 APK (가장 빠름)
eas build --platform android --profile preview

# 완료 후 다운로드 링크가 Expo 대시보드에 표시됨
# https://expo.dev → 프로젝트 → Builds
```

`eas.json` 설정:
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### 2.2 방법 B: 로컬 빌드

```bash
# Android Studio + SDK 필수

# Expo prebuild로 android/ 폴더 생성
npx expo prebuild --platform android

# Gradle로 빌드
cd android
./gradlew assembleRelease

# APK 위치: android/app/build/outputs/apk/release/app-release.apk
```

### 2.3 APK 배포 방법

**방법 1 — Google Play 내부 테스트**
1. Play Console → 앱 선택 → 테스트 → 내부 테스터
2. APK/AAB 업로드
3. 테스터 이메일 추가 → 링크 공유

**방법 2 — Firebase App Distribution (무료, 빠름)**
```bash
npm install -g firebase-tools
firebase login

# firebase.json에 app_id 설정 후
firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
  --app <FIREBASE_APP_ID> \
  --groups "testers" \
  --release-notes "테스트 빌드 v1.0"
```

**방법 3 — 직접 APK 공유**
- APK 파일을 Google Drive에 업로드 후 링크 공유
- 설치 시 테스터 기기에서 "알 수 없는 앱 설치 허용" 필요

---

## 3. iOS TestFlight 배포

### 3.1 Apple Developer 설정

1. **App ID 등록**
   - developer.apple.com → Certificates, IDs & Profiles
   - Identifiers → App IDs → + 버튼
   - Bundle ID: `kr.wantsome.app`
   - Capabilities 체크: Push Notifications, Sign in with Apple

2. **배포 인증서 생성**
   ```bash
   eas credentials --platform ios
   # EAS가 자동으로 인증서 생성 및 관리
   ```

3. **App Store Connect에서 앱 생성**
   - appstoreconnect.apple.com
   - My Apps → + → New App
   - Platform: iOS, Name: wantsome, Bundle ID: kr.wantsome.app
   - **Content Rating 설정:** 17+ (성인 콘텐츠)

### 3.2 EAS로 iOS 빌드

```bash
# iOS 빌드 (TestFlight 배포용)
eas build --platform ios --profile production

# 빌드 완료 후 TestFlight 제출
eas submit --platform ios
# 또는 Expo 대시보드에서 "Submit to App Store" 클릭
```

`eas.json`:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### 3.3 TestFlight 테스터 초대

1. App Store Connect → 앱 → TestFlight 탭
2. 빌드 처리 완료 대기 (보통 15-30분)
3. **내부 테스터**: 팀원 최대 100명, 즉시 가능
4. **외부 테스터**: 최대 10,000명, Beta App Review 필요 (1-2일)
   - Add External Testers → 이메일 입력 또는 링크 공유

---

## 4. Expo Application Services (EAS) 설정

### 4.1 초기 설정

```bash
# EAS 로그인
eas login

# 프로젝트 초기화 (app.json에 projectId 추가됨)
eas init

# 전체 설정 확인
eas build:configure
```

### 4.2 환경 변수 (EAS Secret)

```bash
# Supabase 키 등록
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://ftnfdtvaxsvosdyjdxfq.supabase.co"

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "your-anon-key"

eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL \
  --value "https://api.wantsome.kr"

eas secret:create --scope project --name EXPO_PUBLIC_AGORA_APP_ID \
  --value "your-agora-app-id"
```

### 4.3 빌드 프로파일 전체

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "APP_STORE_CONNECT_APP_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## 5. 환경 변수 설정

### 5.1 앱 (.env.local)

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://ftnfdtvaxsvosdyjdxfq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# API 서버
EXPO_PUBLIC_API_BASE_URL=https://api.wantsome.kr

# Agora
EXPO_PUBLIC_AGORA_APP_ID=<agora-app-id>
```

### 5.2 서버 (Vercel 환경 변수)

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables:

```
SUPABASE_URL=https://ftnfdtvaxsvosdyjdxfq.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
AGORA_APP_CERTIFICATE=<agora-certificate>
SLACK_WEBHOOK_URL=<slack-webhook>
```

### 5.3 로컬 개발 (adb reverse 설정)

Android 에뮬레이터에서 로컬 서버 접근 시:

```bash
# 에뮬레이터 실행 후
adb reverse tcp:8081 tcp:8081  # Metro bundler
adb reverse tcp:3000 tcp:3000  # Next.js API 서버

# API 서버 실행
cd server && npm run dev

# Metro 번들러 실행
npx expo start --android
```

---

## 6. 테스트 계정 세팅

앱스토어 심사관이 직접 로그인해서 기능을 테스트합니다. 반드시 준비하세요.

### 6.1 Supabase에 데모 계정 생성

Supabase Dashboard → Authentication → Users → Add User:

**소비자 계정:**
- Email: `reviewer-consumer@wantsome.kr`
- Password: `Review2025!`
- 포인트: 50,000P (Supabase Table Editor에서 직접 설정)

**크리에이터 계정:**
- Email: `reviewer-creator@wantsome.kr`
- Password: `Review2025!`
- role: `creator`, is_verified: `true`
- 프로필 사진, 닉네임 설정

### 6.2 심사 노트 (Review Notes) 작성

앱스토어 제출 시 "Notes for Reviewer" 항목:

```
[테스트 계정]
소비자: reviewer-consumer@wantsome.kr / Review2025!
크리에이터: reviewer-creator@wantsome.kr / Review2025!

[테스트 포인트]
- 소비자 계정에 50,000포인트가 충전되어 있습니다.
- 크리에이터 계정으로 로그인 후 홈 피드에서 크리에이터를 확인할 수 있습니다.

[연령 확인]
- 앱 최초 실행 시 생년월일 입력 화면이 표시됩니다.
- 만 19세 이상 생년월일을 입력해주세요. (예: 1990년 1월 1일)

[포인트 결제 테스트]
- 현재 Sandbox 모드로 실제 결제 없이 테스트 가능합니다.
- IAP 테스트: 설정 > Sandbox 계정에서 Apple Sandbox 계정 사용

[기술 지원]
이메일: support@wantsome.kr
```

---

## 7. 앱스토어 심사 체크리스트

### 7.1 iOS App Store 필수 항목

- [x] **연령 등급:** 17+ 설정 (성인 콘텐츠)
- [x] **개인정보처리방침 URL:** `https://api.wantsome.kr/privacy`
- [x] **이용약관 URL:** `https://api.wantsome.kr/terms`
- [x] **연령 게이팅:** 앱 실행 시 생년월일 확인
- [x] **신고 기능:** 통화 중 신고 버튼 → `POST /api/reports`
- [x] **구매 동의 모달:** 포인트 구매 전 명시적 동의
- [x] **화면 녹화 방지:** expo-screen-capture 적용
- [x] **Sign in with Apple:** Apple 로그인 시 必
- [ ] **인앱 결제 연동:** IAP 실제 연동 필요 (현재 mock)
- [ ] **스크린샷:** 실제 크리에이터가 있는 화면으로 촬영 필요
- [ ] **앱 설명:** 한국어 + 영어 버전 준비

### 7.2 Google Play 필수 항목

- [x] **콘텐츠 등급:** 성인 18+ (설문 작성 필요)
- [x] **개인정보처리방침 URL:** `https://api.wantsome.kr/privacy`
- [x] **데이터 보안 섹션:** Google Play 콘솔에서 작성
- [x] **타겟 연령층:** 성인 (18세 이상)
- [ ] **인앱 결제:** Google Play Billing Library 연동

### 7.3 한국 시장 추가 항목

- [ ] **부가통신사업자 신고:** 방통위 (영상통화 서비스 제공)
- [ ] **정보통신서비스 제공자:** 사업자등록 필요
- [ ] **PortOne 본인인증:** 사업자등록 후 PASS 인증 연동

### 7.4 스크린샷 준비

| 플랫폼 | 필요 사이즈 |
|--------|------------|
| iPhone 6.9" | 1320 × 2868 px |
| iPhone 6.5" | 1242 × 2688 px |
| iPad Pro 12.9" | 2048 × 2732 px |
| Android 폰 | 1080 × 1920 px (최소) |

**준비해야 할 스크린샷 (최소 4장, 권장 10장):**
1. 홈/피드 화면 (크리에이터 목록)
2. 크리에이터 프로필
3. 통화 화면
4. 포인트 충전 화면
5. 연령 확인 화면

---

## 8. 문제 해결

### 빌드 오류

**"Unable to load script" Metro 오류**
```bash
# Metro 캐시 초기화
npx expo start --clear

# adb reverse 확인
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
```

**nativewind/reanimated 관련 오류**
```bash
# 현재 프로젝트는 patches/ 폴더의 stub을 사용합니다
# package.json의 nativewind 버전이 4.1.23인지 확인
npm ls nativewind
```

**EAS 빌드 실패**
```bash
# 로컬에서 prebuild로 사전 확인
npx expo prebuild --clean

# 빌드 로그 확인
eas build:list
eas build:view <BUILD_ID>
```

### iOS 관련

**"Missing compliance" 오류**
- App Store Connect → 앱 → TestFlight → 빌드 → 암호화 규정 준수 완료

**Sign in with Apple 미동작**
- developer.apple.com → Identifiers → App ID → Sign In with Apple 체크
- Supabase Dashboard → Authentication → Providers → Apple 활성화

### Android 관련

**"App not installed" 오류**
- 기존 디버그 APK와 서명 충돌 → 기존 앱 삭제 후 재설치

**구글 로그인 미동작**
- Google Cloud Console → OAuth 2.0 → Android 클라이언트 추가
- SHA-1 fingerprint: `keytool -list -v -keystore ~/.android/debug.keystore`

---

## 9. Twilio SMS 설정 (Supabase Phone Auth)

### 9.1 Twilio 계정 설정

1. [twilio.com](https://www.twilio.com) 회원가입
2. Console → **Account SID** + **Auth Token** 확인
3. Messaging → Services → **Create Messaging Service** → Service SID 확인
4. 한국(+82) 발신을 위해 Sender Pool에 번호 또는 Alphanumeric ID 추가

### 9.2 Supabase Phone Auth 활성화

```
Supabase Dashboard → Authentication → Providers → Phone

Enable Phone provider: ON
SMS provider: Twilio
Account SID: ACxxxxxxxxxxxxxxxx
Auth Token: xxxxxxxxxxxxxxxx
Message Service SID: MGxxxxxxxxxxxxxxxx
```

### 9.3 비용 (한국 +82 기준)

| 건수 | 단가 | 월 비용 |
|------|------|---------|
| 1건 | $0.045 (약 62원) | — |
| 월 1,000건 | 62원/건 | 약 62,000원 |
| 월 10,000건 | 62원/건 | 약 620,000원 |

### 9.4 사업자 등록 후 NHN Cloud Toast로 전환 (권장)

사업자 등록 완료 후 **NHN Cloud (Toast)** 사용 시 8원/건 → **약 7.7배 절감**

```bash
# Supabase Custom SMS Provider 설정 (Edge Function 프록시)
# 1. supabase/functions/sms-provider/index.ts 생성
# 2. NHN Cloud API 키 + 발신번호 세팅
# 3. Supabase Dashboard → Authentication → Providers → Phone
#    SMS provider: Custom → Edge Function URL 입력
```

### 9.5 PortOne PASS 본인인증 설정 (사업자 등록 후)

사업자 등록 완료 후 [PortOne 콘솔](https://console.portone.io)에서 설정:

```
1. 상점 생성 → Store ID 확인
2. 채널 연동 → NICE/KMC PASS 채널 추가 → Channel Key 확인
3. API 시크릿 발급

Vercel 환경 변수 추가:
PORTONE_API_SECRET=your-portone-secret
PORTONE_STORE_ID=store-xxxxx
PORTONE_CHANNEL_KEY=channel-key-xxxxx
```

**설정 후 동작:**
- `verify.tsx`가 자동으로 fallback 생년월일 입력 → PASS 본인인증 모드로 전환
- 코드 변경 불필요 — 환경 변수만 추가하면 됨

---

## 배포 커맨드 요약

```bash
# Android 내부 테스트 APK
eas build --platform android --profile preview

# iOS TestFlight
eas build --platform ios --profile production
eas submit --platform ios

# 둘 다 동시에
eas build --platform all --profile production
```

---

*문의: support@wantsome.kr*
