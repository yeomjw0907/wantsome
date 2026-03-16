# 06. 앱스토어 제출 가이드

> **선행 조건:** IAP 연동 ✅, 테스트 계정 준비 ✅, 스크린샷 준비 ✅
> **소요 시간:** iOS 심사 1~3일 / Android 심사 1~3일
> **첫 심사 거절 가능성:** 성인 콘텐츠 앱은 심사가 까다로움 (이 가이드대로 준비하면 최소화)

---

## iOS App Store 제출

### Step I-1. 앱 정보 작성 (App Store Connect)

[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → 앱 → **App Information**:

```
Name: wantsome
Subtitle: 크리에이터와의 프리미엄 영상통화
Bundle ID: kr.wantsome.app
SKU: wantsome-kr-v1
Primary Language: Korean
Category: Entertainment
Secondary Category: Social Networking
```

**Age Rating: 17+**
- 설정 위치: App Information → Age Rating → **Edit**
- 설문:
  - Cartoon or Fantasy Violence: None
  - Realistic Violence: None
  - Sexual Content or Nudity: **Frequent/Intense** (성인 영상통화)
  - Profanity or Crude Humor: None
  - Mature/Suggestive Themes: **Frequent/Intense**
  - Horror/Fear Themes: None
  - Medical/Treatment Information: None
  - Alcohol/Tobacco/Drugs: None
  - Gambling: None
- 결과: **17+** (성인 앱)

### Step I-2. 개인정보처리방침 / 이용약관

```
Privacy Policy URL: https://api.wantsome.kr/privacy
Terms of Use URL: https://api.wantsome.kr/terms
```

### Step I-3. 스크린샷 준비

필요한 사이즈:

| 기기 | 해상도 | 필수 여부 |
|------|--------|-----------|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320 × 2868 px | ✅ 필수 |
| iPhone 6.7" (iPhone 15 Plus) | 1290 × 2796 px | 권장 |
| iPhone 6.5" (iPhone 11 Pro Max) | 1242 × 2688 px | 권장 |
| iPad Pro 12.9" (6세대) | 2064 × 2752 px | iPad 지원 시 |

**촬영해야 할 화면 (최소 4장, 권장 8~10장):**

```
1. 홈 피드 — 크리에이터 목록 (최소 8명 이상 있어야 함)
2. 크리에이터 프로필 — 사진, 소개, 통화 버튼
3. 통화 화면 — 영상통화 중 화면 (실제 통화 스크린샷)
4. 포인트 충전 화면 — 상품 목록
5. 성인 인증 화면 — 연령 확인 절차
6. DM/채팅 화면 (있으면)
7. 예약 화면 (있으면)
```

> ⚠️ 스크린샷에 반드시 실제 크리에이터와 콘텐츠가 있어야 합니다.
> 빈 피드나 "데이터 없음" 상태로 제출하면 거절됩니다.

**스크린샷 촬영 방법:**
```bash
# iOS 시뮬레이터에서 촬영
xcrun simctl io booted screenshot screenshot.png

# 또는 실기기: 전원 + 볼륨UP 동시에
```

**스크린샷 편집 (선택):**
- Figma, Canva 등으로 기기 프레임 씌우기
- 앱 기능 설명 텍스트 오버레이 (한국어)

### Step I-4. 심사 노트 (Review Notes) 작성

App Store Connect → 앱 → **Review Notes** (심사관을 위한 안내):

```
[테스트 계정]
소비자 계정:
  Email: reviewer-consumer@wantsome.kr
  Password: Review2025!

크리에이터 계정:
  Email: reviewer-creator@wantsome.kr
  Password: Review2025!

[테스트 포인트]
- 소비자 계정에 50,000 포인트가 충전되어 있습니다.
- 홈 피드에서 크리에이터 목록을 확인할 수 있습니다.

[연령 확인 절차]
- 앱 최초 실행 시 생년월일 입력 화면이 표시됩니다.
- 만 19세 이상 생년월일을 입력해주세요. (예: 1990년 1월 1일)

[포인트 결제 테스트]
- 설정 > Sandbox 계정에서 Apple Sandbox 계정을 사용하면 실결제 없이 테스트 가능합니다.
- Sandbox 계정: sandbox-tester@wantsome.kr / TestUser2025!

[성인 콘텐츠 관련]
- 본 앱은 만 19세 이상 성인 대상 영상통화 서비스입니다.
- 앱 실행 시 연령 확인 절차가 있으며, 미성년자 이용 시 즉시 차단됩니다.
- 통화 중 신고 기능이 제공됩니다. (통화 화면 우상단 신고 버튼)

[기술 지원]
Email: support@wantsome.kr
```

### Step I-5. Supabase에 심사용 계정 생성

Supabase Dashboard → **Authentication** → **Users** → **Add user**:

**소비자 계정:**
```
Email: reviewer-consumer@wantsome.kr
Password: Review2025!
Email Confirm: true (확인 완료 처리)
```

SQL Editor에서 포인트 추가:
```sql
UPDATE users SET points = 50000
WHERE id = (SELECT id FROM auth.users WHERE email = 'reviewer-consumer@wantsome.kr');
```

**크리에이터 계정:**
```
Email: reviewer-creator@wantsome.kr
Password: Review2025!
```

SQL Editor에서 크리에이터 설정:
```sql
UPDATE users SET
  role = 'creator',
  is_verified = true,
  nickname = '테스트 크리에이터',
  bio = '안녕하세요! 테스트 크리에이터입니다.'
WHERE id = (SELECT id FROM auth.users WHERE email = 'reviewer-creator@wantsome.kr');
```

### Step I-6. EAS Build + Submit

```bash
# iOS 빌드
eas build --platform ios --profile production

# 빌드 완료 후 TestFlight 제출
eas submit --platform ios

# 또는 Expo 대시보드에서 "Submit to App Store" 클릭
```

자세한 빌드 가이드: `docs/distribution-guide.md`

---

## Android Google Play 제출

### Step G-1. 앱 콘텐츠 정보 작성

Google Play Console → 앱 → **App content**:

**Privacy policy:**
```
https://api.wantsome.kr/privacy
```

**App access:**
- 일부 기능에 로그인 필요 → **All or some functionality is restricted**
- 심사용 계정 정보 입력 (iOS와 동일)

**Ads:**
- 광고 없음 → **No, my app does not contain ads**

**Content ratings:**
- 설문 완료 → 성인(18+) 등급 획득

**Target audience:**
- Adults only (18+)
- Does your app target children? → **No**

**Data safety:**
Google Play 데이터 보안 섹션 작성:

| 데이터 유형 | 수집 | 공유 | 필수 |
|-------------|------|------|------|
| 이메일 주소 | ✅ | ❌ | ✅ |
| 전화번호 | ✅ | ❌ | ✅ |
| 사용자 ID | ✅ | ❌ | ✅ |
| 앱 활동 | ✅ | ❌ | ✅ |
| 구매 기록 | ✅ | ❌ | ✅ |
| 사진/동영상 | ❌ | ❌ | — |

**Government apps:**
- 해당 없음

### Step G-2. 앱 설명 작성

**짧은 설명 (80자 이내):**
```
크리에이터와의 프리미엄 1:1 영상통화 플랫폼 | 만 19세 이상
```

**전체 설명 (4,000자 이내):**
```
wantsome은 크리에이터와 팬을 연결하는 프리미엄 영상통화 플랫폼입니다.

[주요 기능]
• 1:1 영상통화 — 좋아하는 크리에이터와 직접 통화
• 블루 모드 — 일반 영상통화
• 레드 모드 — 성인 전용 영상통화 (만 19세 이상)
• 예약 시스템 — 원하는 시간에 크리에이터 예약
• 포인트 결제 — 간편한 인앱 포인트 충전

[안전한 서비스]
• 연령 인증 — 만 19세 이상만 이용 가능
• 통화 녹화 방지 — 개인정보 보호
• 신고 시스템 — 부적절한 행동 즉시 신고
• 24시간 모니터링

[이용 안내]
• 본 서비스는 만 19세 이상 성인만 이용 가능합니다.
• 미성년자 이용 시 즉시 이용이 제한됩니다.

개인정보처리방침: https://api.wantsome.kr/privacy
이용약관: https://api.wantsome.kr/terms
고객센터: support@wantsome.kr
```

### Step G-3. 스크린샷

Android 스크린샷:

| 항목 | 규격 |
|------|------|
| 전화 스크린샷 | 최소 1080 × 1920 px, 최대 8장 |
| 7인치 태블릿 | (선택) |
| 10인치 태블릿 | (선택) |
| Feature Graphic | 1024 × 500 px (필수) |

### Step G-4. 앱 번들 업로드

```bash
# Android AAB 빌드
eas build --platform android --profile production

# 빌드 완료 후 .aab 파일 다운로드
# Google Play Console → Testing → Internal testing → Upload
```

---

## 공통 — 앱 설명 (한/영)

### 한국어 (기본)
이미 위에 작성

### 영어 (App Store 필수)
```
wantsome — Premium 1:1 Video Call Platform

Connect with your favorite creators through premium 1:1 video calls.

KEY FEATURES
• 1:1 Video Calls — Direct calls with creators
• Blue Mode — General video calling
• Red Mode — Adult-only video calling (19+ only)
• Booking System — Schedule calls in advance
• Point System — Easy in-app point purchases

SAFETY
• Age Verification — 19+ only
• Screen Recording Prevention
• Report System — Instant reporting of inappropriate behavior

This service is for adults aged 19 and above only.

Privacy Policy: https://api.wantsome.kr/privacy
Terms of Service: https://api.wantsome.kr/terms
Support: support@wantsome.kr
```

---

## 완료 체크

**iOS:**
- [ ] App Store Connect 앱 정보 입력 (이름, 설명, 카테고리)
- [ ] 연령 등급 17+ 설정
- [ ] 개인정보처리방침 / 이용약관 URL 입력
- [ ] 스크린샷 준비 (6.9" 필수)
- [ ] 심사용 계정 Supabase에 생성 (소비자 50,000P, 크리에이터 verified)
- [ ] Review Notes 작성
- [ ] IAP 상품 Active 확인
- [ ] EAS build + submit
- [ ] TestFlight 내부 테스터 10명 이상 테스트 ✅
- [ ] App Store 심사 제출 ✅

**Android:**
- [ ] Google Play Console 앱 정보 입력
- [ ] 콘텐츠 등급 설정 (성인 18+)
- [ ] 데이터 보안 섹션 작성
- [ ] 개인정보처리방침 URL 입력
- [ ] 스크린샷 준비 + Feature Graphic
- [ ] IAP 상품 Active 확인
- [ ] EAS build → AAB 업로드
- [ ] 내부 테스트 트랙 → 외부 테스트 → 프로덕션 단계적 진행 ✅
