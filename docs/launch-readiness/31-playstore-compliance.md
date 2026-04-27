# 31. Play Store 컴플라이언스 감사

감사일: 2026-04-26  
앱: `kr.wantsome.app` — React Native 0.83.2 / Expo SDK 55  
빌드 증거: `android/app/build/intermediates/merged_manifests/debug/.../AndroidManifest.xml`, `android/app/build/outputs/logs/manifest-merger-debug-report.txt`

---

## 종합 판정

| 등급 | 항목 수 | 설명 |
|:---:|:---:|---|
| CRITICAL (출시 거절) | 3 | 즉시 차단 가능성 높음 |
| HIGH (정책 위반) | 5 | 출시 후 경고·계정 정지 위험 |
| MEDIUM (개선 권고) | 6 | 조만간 대응 필요 |
| INFO | 4 | 확인·문서화 필요 |

---

## A. Target SDK 35 필수 (Play 정책: 2026년 8월 기준)

**판정: PASS (현행) / 선제 주의**

| 항목 | 실제값 | 기준 |
|---|---|---|
| targetSdkVersion | **36** | ≥ 35 필요 |
| compileSdkVersion | 36 | ≥ 35 |
| minSdkVersion | 24 | 적정 |

- 증거: `react-native/gradle/libs.versions.toml` — `targetSdk = "36"`, `compileSdk = "36"`, `minSdk = "24"`
- 병합 매니페스트: `<uses-sdk android:targetSdkVersion="36" android:minSdkVersion="24" />`
- `app/build.gradle`에 직접 값이 없고 `rootProject.ext.targetSdkVersion`을 참조; expo-modules-autolinking이 react-native의 version catalog로부터 36을 주입
- `app.json`의 `android.targetSdkVersion` 키는 **없음** — Expo managed workflow에서는 version catalog 우선
- **현재는 정책 통과이나**, `app.json`에 명시적 값이 없어 react-native 버전 변경 시 의도치 않게 낮아질 위험 존재 → `app.json`에 `"targetSdkVersion": 36` 명시 권고

---

## B. Play Console Data Safety 폼

**판정: HIGH — 선언 항목 실제 코드와 불일치 위험**

코드에서 수집·사용 확인된 데이터:

| 데이터 유형 | 수집 여부 | 근거 파일 |
|---|---|---|
| 전화번호 | O | `app/(auth)/phone-verify.tsx` — Supabase OTP |
| 닉네임 | O | `server/app/api/auth/phone-login/route.ts` — users upsert |
| 프로필 사진 | O | `expo-image-picker`, `creators/upload-id` API |
| 생년월일 | 클라이언트 계산용으로만, 서버 미저장 | `app/(auth)/age-check.tsx:145` — "서버에 저장되지 않음" |
| 결제 정보 (Purchase Token) | O | `verify-iap/route.ts:118` — `p_purchase_token` DB 저장 |
| 포인트 잔액·거래 내역 | O | `point_charges` 테이블 |
| 영상/음성 (통화·라이브) | 전송 O, 서버 저장 여부 불명 | Agora RTC P2P/CDN |
| 기기 토큰 (FCM) | O | `server/app/api/push/register/route.ts` |
| 신원증명 이미지 (Red 자격) | O | `creators/upload-id` API |
| 화면 캡처 감지 | O | `DETECT_SCREEN_CAPTURE` 권한 (API 34+) |

**문제점:**
1. 영상·음성 데이터가 Agora 서버를 경유하는 경우 "제3자와 공유" 선언 필요 (Data Safety 섹션 "Data shared")
2. 신원증명 이미지(신분증) 업로드 — 정부 발급 ID 수집은 Play에서 별도 민감 데이터 선언 필요
3. `age_verified`는 기기에만 저장(AsyncStorage)이므로 Data Safety 불필요하나, 이 로직이 서버 검증 없이 우회 가능하다는 별도 보안 이슈 존재 (Phase 1C 기지정 이슈)
4. 광고 ID 수집 여부 미확인 — firebase-messaging 포함 시 수집될 수 있음

---

## C. 권한 사용 정당성

**판정: CRITICAL (2건) + HIGH (1건)**

병합된 최종 매니페스트(`merged_manifests/debug/.../AndroidManifest.xml`) 기준 전수 분석:

### C-1. CRITICAL — FOREGROUND_SERVICE 타입 미선언 (Android 14+)

```xml
<!-- 현재 선언 -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />

<!-- Agora 서비스 (병합됨) -->
<service
    android:name="io.agora.rtc2.extensions.MediaProjectionMgr$LocalScreenSharingService"
    android:foregroundServiceType="mediaProjection" >
</service>
```

**문제:**
- `FOREGROUND_SERVICE` 권한 선언은 있으나 영상통화·마이크 사용 foreground service에 **`android:foregroundServiceType="camera"` 및 `"microphone"` 선언이 없음**
- Android 14 (API 34) 이상에서는 foreground service type을 `<service>` 태그와 `<uses-permission>` 양쪽에 모두 명시해야 함 (Play 정책 및 OS 강제 적용)
- Agora의 `LocalScreenSharingService`에는 `foregroundServiceType="mediaProjection"`이 있으나, 1:1 영상통화 세션을 유지하는 서비스에 `camera` + `microphone` type이 없음
- `FOREGROUND_SERVICE_CAMERA`, `FOREGROUND_SERVICE_MICROPHONE` 권한도 미선언
- **Play Store는 Android 14 대상 앱에서 이 누락 시 리뷰 거절 또는 설치 후 크래시**

**필요 추가:**
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
```
그리고 해당 서비스 선언에:
```xml
android:foregroundServiceType="camera|microphone"
```

### C-2. CRITICAL — SYSTEM_ALERT_WINDOW (오버레이) 권한

```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
```

- 병합 매니페스트에 실제 선언됨 (main + debug 양쪽)
- Google Play는 이 권한 사용 시 **명시적 정당화 심사**를 요구함 (Play 정책: Special app access)
- 통화 수신(incoming call) 화면 표시 등의 용도라면 정당하나, `app/(app)/call/incoming.tsx`에서 실제로 `SYSTEM_ALERT_WINDOW`를 사용하는지 코드상 확인 필요
- React Native 개발모드 도구(`DevSettingsActivity`)로 인해 자동 포함된 가능성 있음 — **릴리즈 빌드에서 제거 또는 정당화 문서 준비 필수**

### C-3. HIGH — READ_MEDIA_IMAGES maxSdkVersion 오류

```xml
<uses-permission
    android:name="android.permission.READ_MEDIA_IMAGES"
    android:maxSdkVersion="33"
    android:minSdkVersion="33" />
```

- `maxSdkVersion="33"`으로 설정됨 — API 34+(Android 14+)에서는 이 권한이 없는 것과 동일
- Android 14+에서 사진 라이브러리 접근 시 `READ_MEDIA_IMAGES`의 부분 접근 권한(`READ_MEDIA_VISUAL_USER_SELECTED`) 대응이 필요
- expo-image-picker가 내부적으로 처리할 수 있으나, 버전에 따라 `READ_MEDIA_VISUAL_USER_SELECTED` 선언이 없으면 Android 14 기기에서 사진 선택기가 시스템 picker로 fallback

### C-4. 전체 권한 목록 정당성 평가

| 권한 | 위험등급 | 사용처 | 판정 |
|---|---|---|---|
| `CAMERA` | 위험 | Agora 영상통화 | PASS |
| `RECORD_AUDIO` | 위험 | Agora 음성 | PASS |
| `POST_NOTIFICATIONS` | 위험 | expo-notifications | PASS |
| `READ_EXTERNAL_STORAGE` maxSdkVersion=32 | 위험 | API ≤32 사진 접근 | PASS |
| `WRITE_EXTERNAL_STORAGE` maxSdkVersion=32 | 위험 | API ≤32 저장 | PASS |
| `READ_MEDIA_IMAGES` minSdk=33, maxSdk=33 | 위험 | API 33 사진 접근 | MEDIUM (API 34 미대응) |
| `DETECT_SCREEN_CAPTURE` | 일반 | expo-screen-capture | PASS |
| `SYSTEM_ALERT_WINDOW` | 특별 | 불명확 | CRITICAL |
| `FOREGROUND_SERVICE` | 일반 | Agora | PASS |
| `FOREGROUND_SERVICE_MEDIA_PROJECTION` | 일반 | Agora 화면공유 | PASS |
| `BLUETOOTH` | 위험(API 31+) | Agora 블루투스 오디오 | MEDIUM — API 31+ `BLUETOOTH_CONNECT` 필요 |
| `RECEIVE_BOOT_COMPLETED` | 일반 | 알림 재등록 | PASS |
| `VIBRATE` | 일반 | 알림 진동 | PASS |
| `WAKE_LOCK` | 일반 | Firebase | PASS |
| `MODIFY_AUDIO_SETTINGS` | 일반 | Agora | PASS |

**추가 발견 — `BLUETOOTH` (API 31+ 분리):**
병합 매니페스트에 `android.permission.BLUETOOTH`만 있고 `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN`이 없음. API 31+ 기기에서 Bluetooth 오디오 라우팅 시 필요하다면 추가 선언 및 정당화 필요.

---

## D. Play Billing

**판정: HIGH — 서버 측 Google Play 영수증 검증 미구현**

### D-1. Billing Library 버전

- `expo-iap@4.2.1` → `openiap-google:2.1.0` (openiap-versions.json 확인)
- openiap-google 2.1.0은 Google Play Billing Library **7.x** 기반 (Google BillingClient 7.0은 2024년 출시, v6+ 요건 충족)
- 앱 manifest에 `com.android.vending.BILLING` 권한 선언 확인 (`expo-iap/android/src/main/AndroidManifest.xml`)
- **Play Billing Library 버전 요건: PASS** (v6+ 충족)

### D-2. 서버 측 영수증 검증 (CRITICAL)

`server/app/api/payments/verify-iap/route.ts` 전체 검토 결과:

```typescript
// line 118: purchase_token을 DB에 저장하지만
p_purchase_token: purchase_token || null,

// Google Play 서버 API 검증 호출 없음
// 즉, 클라이언트가 전달한 purchase_token을 Google API로 검증하지 않음
```

- **Google Play Developer API (`purchases.products.get`)를 호출하는 코드가 없음**
- `GOOGLE_SERVICE_ACCOUNT_JSON`이 환경변수로 정의되어 있으나 (`docs/11-codemap.md:83`) 실제 verify-iap 라우트에서 사용하지 않음
- 이는 Phase 1B에서 이미 Critical로 분류된 이슈와 동일
- **공격 시나리오**: 조작된 purchase_token + 유효한 product_id를 POST하면 포인트 무제한 충전 가능
- Google Play 정책상 서버 검증 미구현은 직접 거절 사유는 아니나, 사기 결제·환불 분쟁에서 Google 측 보호를 받지 못함
- **idempotency_key가 있어 동일 키 재사용은 방어하나, 새로운 가짜 키로는 반복 가능**

### D-3. 구독(Subscription) 미사용

- 포인트는 모두 일회성 소모형 상품 (`PRODUCTS` 배열, `isConsumable: true`)
- 구독 상품 없음 → Play Console에서 구독 섹션 비워두면 됨 (PASS)

### D-4. 가격 정책

- IAP 상품 6종 (5,500P ~ 200,000P), 가격 8,800원 ~ 286,000원
- `constants/products.ts`에 하드코딩 — Play Console 등록 가격과 일치해야 함
- 앱 내 가격 표시가 Play Console 등록가와 다를 경우 리뷰 거절

---

## E. 17+ 콘텐츠 등급 신고

**판정: HIGH — IARC 설문 정확성 검토 필수**

### E-1. UGC 모더레이션 정책

- 1:1 영상통화 + 1:N 라이브: **User-Generated Content (UGC) 포함**
- Play 정책상 UGC 앱은 모더레이션 메커니즘 필수 선언
- 코드 확인: `server/app/admin/api/live/rooms/[id]/moderation/route.ts` — 관리자 모더레이션 API 존재
- 사용자 신고: `ReportBottomSheet` 컴포넌트 (`app/(app)/call/[sessionId].tsx:52`) — 신고 UI 존재
- **PASS** (모더레이션 도구 존재) — 단, Play 제출 시 모더레이션 정책 URL 및 인-앱 신고 기능 명시 필요

### E-2. 데이팅/성인 콘텐츠 카테고리

- "17+ 라이브 영상통화 + 굿즈" 서비스 성격상 Play Console에서 **"성인 콘텐츠"** IARC 설문 정직 신고 필요
- 성적 콘텐츠를 허용하는 경우 Play의 Sexual Content 정책 명시 준수 필요
- 국내 앱 특성상 청소년보호법 대상 여부에 따라 `adult-only` 앱으로 Play에 등록 시 검색 노출 제한 감수해야 함

---

## F. Foreground Service (영상통화·라이브)

**판정: CRITICAL — 항목 C-1과 동일, 별도 요약**

병합 매니페스트 기준:
- `FOREGROUND_SERVICE` 권한: 선언됨
- `FOREGROUND_SERVICE_MEDIA_PROJECTION` 권한: 선언됨 (화면 공유용)
- **`FOREGROUND_SERVICE_CAMERA` 권한: 미선언**
- **`FOREGROUND_SERVICE_MICROPHONE` 권한: 미선언**
- Agora의 `LocalScreenSharingService`는 `foregroundServiceType="mediaProjection"` — 화면 공유 전용
- 영상통화(camera + microphone) foreground service에 대한 type 선언 없음

**Android 14 (API 34) 이상 적용 규칙**: `android:foregroundServiceType`이 없는 foreground service는 시작 시 `MissingForegroundServiceTypeException` 발생 → **통화 중 앱 강제 종료**

---

## G. App Bundle (.aab)

**판정: PASS**

```json
// eas.json production
"android": {
  "buildType": "app-bundle"
}
```

- 프로덕션 빌드: `.aab` 형식 — Play Store 제출 요건 충족
- `preview`, `development` 빌드는 `.apk` (내부 배포용) — 문제없음

### G-1. ProGuard/R8

```gradle
// android/app/build.gradle:69
def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
```

- **`android.enableMinifyInReleaseBuilds` 기본값 `false`**
- `gradle.properties`에 해당 프로퍼티 없음 → **릴리즈 빌드에서 minify(R8) 비활성화**
- 코드 난독화 미적용 → 리버스 엔지니어링 위험 (보안 이슈)
- `shrinkResources`도 동일하게 비활성화

**권고**: `gradle.properties`에 `android.enableMinifyInReleaseBuilds=true`, `android.enableShrinkResourcesInReleaseBuilds=true` 추가

---

## H. 백그라운드 위치 / Notification

**판정: PASS**

- `POST_NOTIFICATIONS` 권한: 병합 매니페스트에 선언됨
- FCM push: `ExpoFirebaseMessagingService`, `FirebaseMessagingService` 정상 등록
- 백그라운드 위치 권한 없음 — 위치 기능 미사용, 문제 없음
- `RECEIVE_BOOT_COMPLETED`: 알림 재등록 용도, 정당화 가능

---

## I. 청소년/14세 미만 차단

**판정: HIGH — 서버 검증 없는 연령 차단**

### I-1. 연령 차단 로직

```typescript
// app/(auth)/age-check.tsx:65
await AsyncStorage.setItem("age_verified", "true");
```

- 만 19세 계산을 클라이언트에서만 수행, **서버 전송 없음**
- AsyncStorage는 앱 삭제 후 재설치, 루팅된 기기에서 조작 가능
- 법적 요건: 대한민국 정보통신망법상 **만 14세 미만은 법정대리인 동의 필요**, 만 19세 미만은 청소년 유해 서비스 이용 불가
- 현재 구현은 사용자가 허위 생년월일 입력 시 차단 불가

### I-2. Designed for Families

- `app.json`에 "Designed for Families" 관련 설정 없음
- 17+ 등급 앱은 DFF 프로그램 참여 불가 — 올바름

### I-3. 본인인증(PASS) 미구현

- `app/(auth)/verify.tsx` 파일 존재하나 PortOne PASS 인증 실제 구현 여부 별도 확인 필요
- 본인인증이 구현되지 않은 경우 연령 차단이 사실상 무력화

---

## J. PortOne / 외부 결제

**판정: PASS (굿즈) / 확인 필요 (디지털 상품)**

| 결제 유형 | 수단 | 판정 |
|---|---|---|
| 포인트 충전 (디지털) | Google Play Billing (expo-iap) | PASS — 올바른 IAP |
| 굿즈 구매 (실물) | PortOne | PASS — 실물 상품은 Play Billing 적용 제외 |
| 영상통화·라이브 포인트 차감 | 서버 내부 처리 | PASS — IAP로 구매한 포인트 사용 |

**한국 제3자 결제 정책 (2023년 Play 정책 개정):**
- 한국에서는 Play 외 결제 수단 제공 가능하나, "사용자에게 명확히 Play Billing보다 불리하지 않아야 함" 조건
- 굿즈는 실물이므로 제3자 결제(PortOne) 사용 정당 — 문제없음
- **디지털 추가 콘텐츠(예: 프리미엄 굿즈 중 디지털 다운로드)가 있다면 IAP 필수**
- 현재 `shop.tsx`의 카테고리 중 `digital` 카테고리 존재 → 디지털 굿즈를 포인트로 구매하는 경우 Play Billing 경유 포인트이므로 허용. PortOne 직결제라면 정책 위반

---

## K. 16KB Page Size (Android 15+)

**판정: MEDIUM — 네이티브 라이브러리 검증 미완료**

- Android 15부터 16KB 페이지 크기 지원 기기 증가
- **react-native-agora@4.6.2**: Agora의 네이티브 .so 라이브러리가 16KB page size로 컴파일되었는지 확인 필요 (Agora SDK 4.3.0+ 지원 공식 발표 여부 확인 요망)
- **expo-iap@4.2.1 / openiap-google@2.1.0**: Google Play Billing Library 자체는 AAR 형태로 16KB 지원하나, openiap-google 빌드 환경 확인 필요
- EAS 클라우드 빌드 환경에서 NDK 27.1.12297006 사용 (`ExpoRootProjectPlugin.kt:31`) — NDK 27은 16KB 빌드 지원
- `gradle.properties`: `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` — arm64-v8a 포함, 16KB 지원 가능
- `expo.useLegacyPackaging=false` — 올바름 (16KB 지원을 위해 false 필수)

**액션 필요**: Agora SDK 릴리즈 노트에서 16KB page size 지원 버전 확인 후 필요시 업그레이드

---

## L. EAS 빌드 설정

**판정: CRITICAL — 릴리즈 서명 키 미설정**

### L-1. 서명 설정

```gradle
// android/app/build.gradle:114-115
release {
    signingConfig signingConfigs.debug  // ← 릴리즈 빌드가 debug.keystore 사용!
```

- **프로덕션 릴리즈 빌드가 `debug.keystore`로 서명됨**
- EAS 빌드 시 EAS Credentials 서비스가 keystoreを주입하면 이 값이 재정의되지만, `eas.json`에 `credentialsSource` 미지정
- `eas.json` production 섹션에 `"credentialsSource": "remote"` 또는 `"local"` 명시 필요
- Play App Signing을 사용하는 경우 Google이 최종 서명하므로 upload key 관리 필요

### L-2. google-services.json (CRITICAL)

```json
// google-services.json (루트):
{
  "project_info": {
    "project_number": "000000000000",
    "project_id": "wantsome-placeholder"
  },
  "client": [{
    "client_info": {
      "mobilesdk_app_id": "1:000000000000:android:0000000000000000"
    },
    "api_key": [{ "current_key": "placeholder" }]
  }]
}
```

- **google-services.json이 플레이스홀더 값**
- FCM 푸시 알림, Firebase Crashlytics, Play 서비스 연동이 모두 동작하지 않음
- 실제 Firebase 프로젝트의 `google-services.json`으로 교체 필수
- `android/app/google-services.json`도 동일 플레이스홀더일 가능성 (동일 디렉터리에 두 파일 존재)
- `eas.json`의 `googleServicesFile` 미지정 → EAS 빌드에서 실제 파일 주입 방법 확인 필요

### L-3. EAS Submit 설정

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-service-account.json",
      "track": "internal"
    }
  }
}
```

- `google-service-account.json` 경로 지정됨 — 파일 존재 여부 확인 필요 (git에 커밋 금지)
- `track: "internal"` — 내부 테스트 트랙 제출 설정, 올바름

---

## M. 본인인증 (PASS) 처리

**판정: MEDIUM**

- `app/(auth)/verify.tsx` 파일 존재 — 내부 구현 확인 필요
- PortOne PASS SDK는 WebView 기반으로 동작하는 경우가 많으며, `expo-web-browser` 사용 중 (`expo-web-browser@55.0.10`)
- Android 15와의 호환성: WebView 기반 PASS 인증은 OS 버전 의존성 낮음
- 단, PortOne v2 Android SDK가 별도 네이티브 모듈인 경우 `package.json`에 의존성 없음 → WebView 방식으로 처리 중으로 추정
- **본인인증 미완료 시 연령 검증이 사실상 무력 (항목 I와 연계)**

---

## N. 정통망법 / 청소년 보호 (Korea)

**판정: HIGH**

### N-1. 청소년 유해매체물 신고

- 17+ 영상통화·라이브 서비스는 청소년보호법상 **청소년 유해매체물** 해당 가능
- 방통위에 청소년 유해매체물 결정 신청 및 사업자 신고 의무 확인 필요
- Play Store 앱 등록 시 "연령 제한" 설정과 별개로 한국 법령 준수 필요

### N-2. 14세 미만 가입 시 법정대리인 동의

- 현재 구현: 만 19세 미만 차단 (클라이언트 계산)
- 14세 미만 차단 로직은 서버에 없음
- 법적으로는 만 14세 이상~19세 미만도 청소년 유해 서비스 이용 불가
- **서버 측 연령 검증 없이 AsyncStorage 우회로 14세 미만 가입 가능**

---

## 우선순위별 조치 요약

### CRITICAL (출시 전 필수)

| # | 항목 | 위치 | 조치 |
|---|---|---|---|
| C1 | Foreground Service type 미선언 | `android/app/src/main/AndroidManifest.xml` | `FOREGROUND_SERVICE_CAMERA`, `FOREGROUND_SERVICE_MICROPHONE` 권한 추가 및 서비스 `foregroundServiceType` 선언 |
| L2 | google-services.json 플레이스홀더 | `google-services.json` (루트) | 실제 Firebase 프로젝트 파일로 교체 |
| L1 | 릴리즈 서명 debug.keystore | `android/app/build.gradle:115` | EAS Credentials 설정 또는 production signingConfig 별도 구성 |

### HIGH (출시 직후 또는 동시)

| # | 항목 | 위치 | 조치 |
|---|---|---|---|
| C2 | SYSTEM_ALERT_WINDOW 정당화 | 병합 매니페스트 | 실사용 여부 확인, 불필요시 제거 |
| D2 | Google Play 영수증 서버 검증 미구현 | `verify-iap/route.ts` | Google Play Developer API 호출 구현 |
| B | Data Safety 선언 불완전 | Play Console | Agora 제3자 공유, 신분증 이미지 수집 선언 |
| I | 연령 검증 서버 미확인 | `age-check.tsx`, `phone-verify.tsx` | 서버 측 연령 검증 또는 PASS 본인인증 연계 |
| N | 청소년보호법 준수 | 서비스 전반 | 법률 검토 후 방통위 신고 여부 확인 |

### MEDIUM (단기 개선)

| # | 항목 | 조치 |
|---|---|---|
| G1 | R8/ProGuard 비활성화 | `gradle.properties`에 `android.enableMinifyInReleaseBuilds=true` |
| C3 | READ_MEDIA_VISUAL_USER_SELECTED | Android 14+ 부분 사진 접근 권한 추가 |
| C4 | BLUETOOTH → BLUETOOTH_CONNECT | API 31+ 권한 분리 대응 |
| K | 16KB page size Agora 확인 | Agora 4.6.x 릴리즈 노트 확인 |
| A | app.json targetSdkVersion 미명시 | `"targetSdkVersion": 36` 명시 |
| M | PASS 본인인증 구현 확인 | `app/(auth)/verify.tsx` 내부 구현 검토 |

---

## 참조 파일 경로

| 파일 | 용도 |
|---|---|
| `android/app/src/main/AndroidManifest.xml` | 소스 매니페스트 |
| `android/app/build/intermediates/merged_manifests/debug/.../AndroidManifest.xml` | 실제 빌드 병합 결과 |
| `android/app/build/outputs/logs/manifest-merger-debug-report.txt` | 의존성 매니페스트 병합 로그 |
| `node_modules/react-native/gradle/libs.versions.toml` | targetSdk=36, compileSdk=36, minSdk=24 출처 |
| `node_modules/expo-iap/openiap-versions.json` | openiap-google 2.1.0 (Billing Library 7.x) |
| `node_modules/expo-iap/android/src/main/AndroidManifest.xml` | com.android.vending.BILLING 권한 |
| `google-services.json` | 플레이스홀더 확인 |
| `android/app/build.gradle` | signingConfig debug 사용 확인 |
| `eas.json` | production buildType=app-bundle, credentialsSource 미지정 |
| `app/(auth)/age-check.tsx` | 클라이언트 단독 연령 검증 |
| `server/app/api/payments/verify-iap/route.ts` | Google 영수증 검증 미구현 |
