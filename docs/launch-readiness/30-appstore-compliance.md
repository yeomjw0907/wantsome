# 30. iOS App Store 컴플라이언스 감사

요약: **Critical 6건 / High 7건 / Medium 5건 / Info 4건 / 미확인 4건**  
범위: iOS 17+ Privacy Manifest, App Store Review Guidelines, Info.plist, ATS, ATT, Background Modes, 메타데이터, IAP 등록, EAS 빌드 설정, 17+ 콘텐츠 가이드라인, 콘텐츠 권리  
기준 코드: main 브랜치 61ee659 (2026-04-26)  
작성: mobile-developer

---

## 분류 기준

- **Critical**: 자동/즉각 거절 사유
- **High**: 거절 가능성 높음, 출시 전 필수 해결
- **Medium**: 거절 가능성 있음, 강력 권고
- **Info**: 참고·권고
- **미확인**: 코드로 확인 불가, 수동 검증 필요

---

## A. iOS Privacy Manifest

### [CRITICAL-A1] NSPrivacyTrackingDomains 미선언 — Privacy Manifest 불완전
- **파일**: `app.json:34-61`
- **현황**: `privacyManifests.NSPrivacyAccessedAPITypes` 4종 선언 존재 (UserDefaults CA92.1, FileTimestamp C617.1, DiskSpace E174.1, SystemBootTime 35F9.1). 그러나 `NSPrivacyTracking` 및 `NSPrivacyTrackingDomains` 키 자체가 없음. Expo SDK 55의 Managed Workflow에서 `privacyManifests`는 `app.json`을 통해 `PrivacyInfo.xcprivacy`로 변환됨. 추적 도메인을 사용하지 않더라도 Apple은 키를 명시적으로 `false` 또는 빈 배열로 선언할 것을 요구.
- **시나리오**: EAS 빌드 바이너리를 App Store Connect에 업로드하면 "ITMS-91053: Missing API declaration" 또는 Privacy Manifest 검증 오류로 업로드 자체가 차단됨.
- **수정 방향**: `app.json`의 `ios.privacyManifests`에 다음 추가:
  ```json
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyCollectedDataTypes": []
  ```
- **근거**: Apple Privacy Manifest Required Reasons API (2024-05 이후 의무)

### [CRITICAL-A2] NSPrivacyCollectedDataTypes 미선언 — 수집 데이터 유형 공개 누락
- **파일**: `app.json:34-61`
- **현황**: 앱이 휴대폰번호, 닉네임, 프로필 사진, 통화 이력, 결제 기록, 위치(미사용) 등을 수집하나 `NSPrivacyCollectedDataTypes` 배열이 전혀 선언되지 않음.
- **시나리오**: App Store Connect Privacy Nutrition Label 작성 시 실제 수집 항목과 Manifest 불일치 → 심사관 지적 또는 배포 후 신고.
- **수정 방향**: 수집 항목을 `NSPrivacyCollectedDataTypes` 배열로 명시. 최소 필요 항목: 전화번호 (`NSPrivacyCollectedDataTypePhoneNumber`), 사용자 ID (`NSPrivacyCollectedDataTypeUserID`), 앱 활동 (`NSPrivacyCollectedDataTypeAppInteractions`), 구매 기록 (`NSPrivacyCollectedDataTypePurchaseHistory`).
- **근거**: App Store Review Guidelines 5.1.2, Apple Privacy Manifest spec

### [INFO-A3] ios/ 네이티브 디렉터리 미존재 — Managed Workflow 확인
- **현황**: `ios/` 디렉터리가 존재하지 않음 (EAS Managed Workflow로 EAS 서버에서 빌드). Expo의 `app.json privacyManifests` 키가 EAS Build 시 자동으로 `PrivacyInfo.xcprivacy`를 생성하는지 Expo SDK 55 릴리즈노트에서 반드시 확인 필요.
- **수정 방향**: `npx expo prebuild --platform ios` 후 생성된 `ios/wantsome/PrivacyInfo.xcprivacy` 내용을 검수.

---

## B. App Store Review Guidelines 직접 점검

### [HIGH-B1] Age Rating 설문 — "Sexual Content or Nudity: Frequent/Intense" 선언이 컨셉과 충돌
- **파일**: `docs/setup/06_store-submission.md:30`
- **현황**: 제출 가이드에 "Sexual Content or Nudity: Frequent/Intense (성인 영상통화)"로 작성되어 있음. 그러나 프로젝트 컨셉 메모(`project_wantsome_concept.md:18`)에서 "성인채팅 아님 — 마케팅/심사에서 '성인 콘텐츠 앱' 메시지 절대 금지"를 명확히 지시함. 두 문서가 직접 충돌.
- **시나리오**: "Frequent/Intense Sexual Content"를 선언하면 Apple이 Section 1.1.4(Objectionable Content) 또는 별도 성인앱 심사 트랙(App Store Guidelines 1.1.4)에 배정할 수 있음. 이 등급을 선택하면 성인 콘텐츠 전용 심사 기준이 적용되어 사실상 통과 불가(Apple은 음란물 앱을 허용하지 않음). 잘못된 등급 신고 자체도 거부 사유(4.3).
- **수정 방향**: 실제 앱 콘텐츠(인플루언서 1:1 영상통화, 라이브 방송 — 노출·성적 콘텐츠 없음)에 맞게 설문 재작성. 권장 설문:
  - Sexual Content or Nudity: **None**
  - Mature/Suggestive Themes: **Infrequent/Mild** (성인 간 영상통화 서맥)
  - Profanity: None
  - User-Generated Content: YES (결과: 17+)
- **근거**: App Store Review Guidelines 1.1, 1.1.4, Age Rating 설문 정책

### [CRITICAL-B2] 5.1.1(v) 계정 삭제 기능 — 존재하나 진입 경로 접근성 부족
- **파일**: `app/(app)/settings/withdraw.tsx:1-179`, `server/app/api/users/me/route.ts:100-142`
- **현황**: 계정 삭제(회원 탈퇴) 화면이 구현되어 있고 `DELETE /api/users/me`가 Supabase Auth까지 삭제함. 진입 경로: 설정 화면 → "계정 관리" 섹션 → "회원 탈퇴" 메뉴. 기술적으로는 존재.
- **추가 우려**: `app/(app)/settings/index.tsx:147-148`에서 "차단 목록" 메뉴가 `Toast.show({ text1: "차단 목록 기능은 곧 추가됩니다." })`로 미구현 상태. 차단 기능은 서버(`server/app/api/users/block/route.ts`)에 API는 있으나 앱 UI가 없음.
- **시나리오**: 심사관이 차단 목록을 찾았을 때 "곧 추가됩니다" 토스트가 뜨면 미완성 앱으로 간주, 4.0(Design) 또는 2.1(Performance) 거부.
- **수정 방향**: 차단 목록 UI를 출시 전 완성하거나, 메뉴 자체를 제거하고 크리에이터 프로필 화면에서 차단 액션으로 대체.
- **근거**: App Store Review Guidelines 5.1.1(v), 2.1, 4.0

### [CRITICAL-B3] 3.1.1 IAP — 굿즈(실물) PG 결제를 앱 내에서 직접 노출 시 규정 위반
- **파일**: `app/(app)/(tabs)/shop.tsx:27`, `docs/launch-readiness/00-pricing-policy.md:20` (J. 굿즈 단계적 운영 — v1 OFF)
- **현황**: 정책문서 기준 굿즈는 v1 출시 시 feature flag로 UI 가림. 그러나 `shop.tsx`에 카테고리 필터에 `"adult"` 라벨(line:27)을 `"프리미엄"`으로 표시하는 코드가 존재하며, 굿즈 주문 API(`orders/route.ts:98`)는 포인트 차감으로 처리됨. 포인트 충전이 IAP이고 포인트로 굿즈를 구매하면 실물상품을 IAP 결제로 처리하는 구조가 됨 — Apple은 물리적 상품은 IAP 대상이 아니나, 포인트→굿즈 경로는 "IAP 우회"로 해석될 위험 없음(Apple Guidelines 3.1.5(a): "Goods and services not used in the app" is exempt from IAP). **단, 앱 내에서 외부 결제(PortOne)로 직접 연결하는 버튼이나 링크가 있으면 3.1.1 위반**.
- **현재 코드**: 굿즈 화면이 v1 OFF이므로 즉각적 위반 없음. 그러나 v1.1 오픈 시 PortOne WebView 결제 흐름이 어떻게 구현되느냐가 결정적. 현재 app/ 코드에는 PortOne 굿즈 결제 연동 코드가 없음 (미구현).
- **시나리오**: PortOne PG를 앱 내 WebView로 결제하는 것은 3.1.1 위반이 아님(실물 상품 면제). 단, 앱 설명·UI에서 "앱 내 결제"로 오해될 경우 심사관 질의 가능.
- **수정 방향**: 굿즈 결제 구현 시 리뷰 노트에 "물리적 상품 — IAP 면제 대상" 명시. feature flag 확실히 OFF 상태로 v1 제출.
- **근거**: App Store Review Guidelines 3.1.1, 3.1.5(a)

### [CRITICAL-B4] 3.1.3(b) 한국 제3자 결제 Entitlement — 미적용
- **파일**: `app.json:19-62`, `eas.json`
- **현황**: PortOne PG를 통한 포인트 결제 또는 굿즈 결제를 한국 앱 내에서 제공할 경우, 한국 공정거래법 개정(2021)에 따라 Apple은 한국 개발자에게 `com.apple.developer.storekit.external-purchase` Entitlement를 제공. 이를 사용 시 Apple에 별도 신청 후 Entitlement 파일에 추가해야 함. 현재 `app.json`에 해당 entitlement 없음.
- **현황 평가**: 포인트 충전이 IAP(Apple 30% 수수료)로만 처리되고 PortOne이 실물 굿즈에만 사용된다면 이 Entitlement는 불필요. **단, 이 분류가 실제로 코드·UX에서 명확하게 분리되어야 함**. 굿즈 v1 OFF이므로 현재는 위반 없음.
- **수정 방향**: 굿즈 오픈 시 Apple의 한국 제3자 결제 Entitlement 신청 여부를 법무 검토 후 결정. 리뷰 노트에 "한국 전자상거래법에 따라 실물 상품은 PG 결제 사용" 명시.
- **근거**: App Store Review Guidelines 3.1.3(b), Apple Korea External Purchase Entitlement

### [HIGH-B5] 1.1.1 / 1.4 사용자 안전 — 라이브 신고 기능 미구현, 차단 UI 미완성
- **파일**: `app/(app)/live/[roomId].tsx` (전체 검색 결과 신고 관련 0 hits), `app/(app)/settings/index.tsx:147-148`, `docs/launch-readiness/23-live-room-security.md:74-80` (C7)
- **현황**:
  - 1:1 영상통화: `ReportBottomSheet` 컴포넌트 정상 구현 (`call/[sessionId].tsx:613-619, 822-828`)
  - 라이브 방송: 신고 버튼/기능 코드 전체 0 hits. `live/[roomId].tsx` 전체를 검색해도 "신고", "report", "flag" 관련 UI 없음
  - 차단 목록 UI: `settings/index.tsx:148` "곧 추가됩니다" 토스트만
  - 서버 신고 API의 `live_room_id` 컬럼 부재로 라이브 신고 자체가 DB에서 추적 불가 (23-live-room-security.md C7)
- **시나리오**: 심사관이 라이브 방송 화면에서 신고 기능을 찾지 못함 → 1.4.1(Physical Harm), 5.1.1(User Safety) 위반 → 거부. 17+ 등급 앱에서 UGC(User-Generated Content) 포함 시 신고/모더레이션 도구는 필수 요건.
- **수정 방향**: 라이브 화면에 신고 버튼 추가 + Reports API에 `live_room_id` 지원 추가. 차단 목록 UI 완성 또는 메뉴 제거.
- **근거**: App Store Review Guidelines 1.4.1, 5.1.1, UGC Policy

### [HIGH-B6] 5.1.2 데이터 수집/공개 — 이용약관·개인정보처리방침 링크 미동작
- **파일**: `app/(app)/settings/index.tsx:164-175`
- **현황**: 설정 화면의 "이용약관"(`line:165`)과 "개인정보처리방침"(`line:172`) 메뉴 모두 `Toast.show({ text1: "준비 중입니다." })`로 구현. 실제 URL(`https://api.wantsome.kr/terms`, `https://api.wantsome.kr/privacy`)이 서버에 존재하나 앱 내에서 연결 안 됨.
- **시나리오**: App Store Connect 제출 시 Privacy Policy URL은 입력 가능. 그러나 심사관이 앱 내에서 이용약관·개인정보처리방침에 접근하려 할 때 "준비 중입니다"를 보면 4.0 미완성 앱 판정 → 거부.
- **수정 방향**: WebBrowser.openBrowserAsync 또는 Linking.openURL로 해당 URL로 연결.
- **근거**: App Store Review Guidelines 5.1.2, 5.1.1(v)

### [HIGH-B7] 4.3 스팸/유사 앱 — 기존 서비스(캠톡) 직접 언급 내부 문서
- **파일**: `docs/launch-readiness/00-pricing-policy.md:10` ("사용자 가격은 캠톡 매칭"), `docs/setup/06_store-submission.md:5` ("성인 콘텐츠 앱은 심사가 까다로움")
- **현황**: 내부 문서에서 캠톡 모방을 직접 언급. 이것 자체는 심사 거부 사유가 아니나, App Store Connect 메타데이터(설명, 키워드)에 경쟁사 이름이 포함되거나 "캠톡과 동일" 류 문구가 포함되면 4.3 위반.
- **수정 방향**: App Store 메타데이터 검토 — 경쟁사 이름 0, 앱의 고유 차별점(인플루언서 플랫폼, 예약 시스템, 굿즈 마켓) 강조.
- **근거**: App Store Review Guidelines 4.3

---

## C. Info.plist 권한 사용 텍스트

### [INFO-C1] NSCameraUsageDescription — 사용 목적 단일, 신분증 업로드 목적 누락
- **파일**: `app.json:24`
- **현황**: `"NSCameraUsageDescription": "영상통화를 위해 카메라 접근이 필요합니다."` — 영상통화 목적만 명시. 크리에이터 신분증 촬영(`app/(creator)/onboarding/id-card.tsx`)에도 카메라를 사용하므로 모든 사용 목적을 서술해야 함.
- **수정 방향**: `"영상통화 및 크리에이터 신분증 촬영을 위해 카메라 접근이 필요합니다."`
- **근거**: App Store Review Guidelines 5.1.1

### [INFO-C2] expo-image-picker 플러그인 권한 텍스트와 infoPlist 중복 선언
- **파일**: `app.json:93-96` (expo-image-picker 플러그인 권한), `app.json:26-27` (infoPlist NSPhotoLibraryUsageDescription)
- **현황**: `NSPhotoLibraryUsageDescription`이 `ios.infoPlist`(line:26)와 expo-image-picker 플러그인(line:93) 두 곳에 선언. 내용이 동일하므로 충돌 없음. 그러나 중복 선언은 혼동을 줄 수 있음.
- **수정 방향**: 한 곳(infoPlist)만 유지하거나 플러그인 선언 제거.

### [MEDIUM-C3] NSUserTrackingUsageDescription 미선언 — ATT 판단 필요
- **파일**: `app.json:19-62`
- **현황**: ATT 프롬프트 관련 코드 없음. Agora SDK, Supabase가 IDFA(광고 식별자)를 사용하는지 불명확. Expo SDK 55의 expo-notifications는 기본적으로 IDFA를 사용하지 않으나, 미래에 광고/분석 SDK 추가 시 즉시 필수.
- **수정 방향**: Agora, Supabase, expo-notifications의 Privacy Manifest를 점검하여 IDFA 사용 여부 확인. 사용 안 한다면 미선언 OK. 불확실하면 `NSUserTrackingUsageDescription`을 선언하고 ATT 프롬프트 추가 권장.
- **근거**: App Tracking Transparency (ATT) Framework

---

## D. ATS (App Transport Security)

### [INFO-D1] ATS — 명시적 예외 없음, 개발 모드 HTTP 폴백 위험
- **파일**: `app.json:19-62` (NSAllowsArbitraryLoads 없음), `lib/api.ts:12-43` (22-client-security.md Medium 항목)
- **현황**: `app.json`에 `NSAllowsArbitraryLoads` 선언 없음 → 기본 ATS 강제(OK). 다만 `lib/api.ts`에서 `__DEV__` 모드에서 `http://` LAN IP로 폴백하는 코드가 존재. EAS production 빌드에서 `__DEV__ = false`이므로 실제 배포 바이너리에서는 발생하지 않음.
- **평가**: 현재 상태 통과. 빌드 확인만 필요.

---

## E. ATT (App Tracking Transparency)

### [MEDIUM-E1] ATT 미구현 — 광고/분석 SDK 사용 여부 미확인
- **파일**: `app.json` 전체, `package.json`
- **현황**: Firebase Analytics, Amplitude, Mixpanel 등 광고·분석 SDK 없음 확인. Agora SDK(`react-native-agora`)가 내부적으로 IDFA를 수집하는지는 바이너리 레벨에서만 확인 가능.
- **수정 방향**: EAS 빌드 후 `xcrun instruments` 또는 Privacy Report로 IDFA 액세스 여부 확인. IDFA 미사용이 확인되면 ATT 불필요. 확인 전까지 미확인 처리.

---

## F. 배경 모드 (Background Modes)

### [MEDIUM-F1] voip 백그라운드 모드 미선언 — 1:1 영상통화 백그라운드 유지 불가
- **파일**: `app.json:29-32`
- **현황**: `UIBackgroundModes: ["audio", "remote-notification"]` 선언. `voip` 모드 없음. Agora RTC 기반 영상통화는 백그라운드 유지를 위해 `voip` 모드가 필요. `audio` 모드만으로는 영상통화 중 홈 버튼 누를 때 통화가 중단됨.
- **시나리오**: 사용자가 영상통화 중 다른 앱으로 전환하면 Agora 엔진이 멈추고 통화 끊김 → 포인트 계속 차감 → 분쟁.
- **수정 방향**: `app.json ios.infoPlist.UIBackgroundModes`에 `"voip"` 추가. iOS에서 VoIP 앱은 PushKit(CallKit) 연동 권장. 심사관에게 리뷰 노트에서 사용 목적 명시 필요.
- **근거**: Apple Human Interface Guidelines — Live Communications, App Store Review Guidelines 2.5.4

---

## G. 메타데이터 + 스크린샷

### [HIGH-G1] "성인 영상통화" 메시지 제출 문서에 잔존 — 컨셉 충돌
- **파일**: `docs/setup/06_store-submission.md:110-111`, `docs/context/00_repo_readme.md:4` ("성인 영상통화 플랫폼"), `docs/legal/01_terms.md:110` ("성인 영상통화 서비스는 합법적인 성인 콘텐츠에 한합니다")
- **현황**: 제출 가이드 Review Notes에 "본 앱은 만 19세 이상 성인 대상 영상통화 서비스입니다" 문구 존재. 컨셉 메모에서 "일반 엔터테인먼트/소셜 카테고리, 성인 콘텐츠 앱 포지셔닝 금지" 명시와 직접 충돌.
- **약관 문제**: `docs/legal/01_terms.md:110` — "성인 영상통화 서비스는 합법적인 성인 콘텐츠에 한합니다"는 앱 내 성인 콘텐츠를 허용하는 것처럼 읽힘. 실제 앱이 성인 콘텐츠를 허용하지 않는다면 이 조항이 심사관에게 오해를 줄 수 있음.
- **분당 요금 스테일**: `docs/legal/01_terms.md:27` — "스탠다드(blue) 모드: 900P/분, 프리미엄(red) 모드: 1,300P/분" → 가격 정책(00-pricing-policy.md)은 2000P/3000P로 변경 예정. 약관 가격과 실제 가격 불일치.
- **수정 방향**: Review Notes에서 "성인" 키워드 제거, "인플루언서·크리에이터와의 1:1 영상통화 플랫폼 (17+ 이용자 생성 콘텐츠)"로 재작성. 약관의 가격과 성인 콘텐츠 허용 조항 수정.
- **근거**: App Store Review Guidelines 1.1, 1.1.4, 5.2.1

### [MEDIUM-G2] 스크린샷 미준비, 필수 사이즈 변경 (6.9" 필수)
- **파일**: `docs/setup/06_store-submission.md:51-55`
- **현황**: 제출 가이드에 스크린샷 목록만 있고 실제 스크린샷 파일 없음. 2026년 기준 Apple이 요구하는 필수 사이즈는 6.9"(iPhone 16 Pro Max, 1320×2868px). 스크린샷에 실제 크리에이터 데이터가 있어야 함(지침 명시).
- **수정 방향**: EAS dev 빌드 또는 시뮬레이터에서 최소 4장 촬영. 빈 피드 상태 절대 금지.

### [INFO-G3] 카테고리 선택 — Entertainment + Social Networking (OK)
- **파일**: `docs/setup/06_store-submission.md:21-22`
- **현황**: Primary: Entertainment, Secondary: Social Networking. 데이팅 카테고리 미사용. 적절.

---

## H. 인앱구매 등록

### [CRITICAL-H1] App Store Connect 등록 Product ID와 코드 Product ID 불일치
- **파일**: `constants/products.ts:10-15` (코드), `docs/app-store-iap-copy.md:27-117` (ASC 등록 예정), `docs/setup/05_iap.md:32-35` (구버전 ID)
- **현황**: 세 문서가 서로 다른 Product ID를 사용:

  | 소스 | Product ID 예시 |
  |---|---|
  | `constants/products.ts` (코드 현행) | `kr.wantsome.app.point_5500` |
  | `docs/app-store-iap-copy.md` (ASC 등록용) | `kr.wantsome.app.points_5500` (언더바 복수형) |
  | `docs/setup/05_iap.md` (구버전) | `kr.wantsome.app.points.1000` (점 구분, 구상품) |

  코드의 `storeId`(`kr.wantsome.app.point_5500`)와 ASC 등록 문서의 ID(`kr.wantsome.app.points_5500`)가 불일치 (`point_` vs `points_`).

- **시나리오**: App Store Connect에 `kr.wantsome.app.points_5500`을 등록하고 코드가 `kr.wantsome.app.point_5500`으로 `requestPurchase`를 호출하면 "Product not found" 오류 → 결제 0건 → 핵심 기능 동작 불가 → 심사 즉시 거절.
- **수정 방향**: 코드 `constants/products.ts`의 storeId 또는 ASC 등록 Product ID 중 하나를 통일. 통일 후 ASC에 6개 상품 등록(현재 미등록 추정).
- **근거**: App Store Review Guidelines 3.1.1, IAP 필수 동작 테스트

### [CRITICAL-H2] 가격 정책 미반영 — 코드·문서·ASC 세 곳이 모두 다른 가격
- **파일**: `constants/products.ts:10-15`, `docs/app-store-iap-copy.md:127-134`, `docs/launch-readiness/00-pricing-policy.md:49-56`
- **현황**:

  | 소스 | 1번 상품 가격 | 포인트 |
  |---|---|---|
  | `constants/products.ts:10` | ₩8,800 | 5,500P |
  | `docs/app-store-iap-copy.md:129` | ₩4,900 | 5,500P |
  | `00-pricing-policy.md:51` | TBD (≈₩6,600) | 4,000P |

  세 소스 모두 불일치. 가격 정책(Phase 0) 변경 PR이 아직 코드에 미반영.

- **시나리오**: 코드에 표시된 가격(₩8,800)과 ASC 등록 가격(₩4,900)이 다르면 App Store 심사에서 "가격 정보 불일치"로 거부. 사용자에게도 잘못된 가격 표시.
- **수정 방향**: 가격 정책(00-pricing-policy.md)을 확정한 후 `constants/products.ts`, `docs/app-store-iap-copy.md`를 동기화하고, ASC 신규 등록 6개 상품의 정확한 KRW 티어 선택.
- **근거**: App Store Review Guidelines 3.1.1, 메타데이터 정확성

### [HIGH-H3] 첫충전 배너에 "2배" 표시 — 정책은 "1.5배"로 변경 예정
- **파일**: `app/(app)/charge/index.tsx:258-265` ("100% 보너스", "2배"), `docs/launch-readiness/00-pricing-policy.md:87` (1.5배로 변경)
- **현황**: 화면에서 "첫충전 100% 보너스 — 2배"로 표시. 정책 문서는 1.5배로 변경 결정. 코드 미반영 (`verify-iap/route.ts:106`도 `* 2` 그대로).
- **시나리오**: App Store에 표시된 프로모션 가격이 실제 지급 포인트와 다르면 소비자 기만 → 거부 또는 사후 신고.
- **수정 방향**: 가격 정책 PR 완료 후 배너 텍스트 + 서버 코드 동시 수정.

---

## I. EAS / 빌드 설정

### [HIGH-I1] EAS Production iOS 설정 미완 — Apple ID·Team ID·ASC App ID 없음
- **파일**: `eas.json:46-58` (production 섹션)
- **현황**: `eas.json`의 production 프로필에 `appleId`, `ascAppId`, `appleTeamId` 필드가 없음. 비교: `wantsome/eas.json:45-47`에는 세 필드가 빈 문자열(`""`)로라도 stub 존재. 현행 `eas.json`의 `submit.production` 섹션에 iOS submit 설정 자체가 없음.

  ```json
  // 현행 eas.json submit 섹션
  "submit": {
    "production": {
      "android": { ... }
      // iOS submit 설정 없음
    }
  }
  ```

- **시나리오**: `eas submit --platform ios`를 실행하면 Apple 자격증명이 없어 인터랙티브 입력을 요청하거나 실패. CI/CD 환경에서는 빌드 차단.
- **수정 방향**: `eas.json submit.production.ios` 추가:
  ```json
  "ios": {
    "appleId": "your@apple.id",
    "ascAppId": "YOUR_ASC_APP_ID",
    "appleTeamId": "YOUR_TEAM_ID"
  }
  ```
  또는 EAS Secret으로 관리.

### [MEDIUM-I2] EAS Production에 EXPO_PUBLIC_PORTONE_STORE_ID 미설정
- **파일**: `eas.json:46-58` (production env), `docs/launch-readiness/11-codemap.md:77`
- **현황**: `eas.json` production env에 `EXPO_PUBLIC_PORTONE_STORE_ID`, `EXPO_PUBLIC_PORTONE_CHANNEL_KEY`가 없음. 코드맵에서 `.env.local`에 존재한다고 명시하나, EAS 빌드는 `.env.local`을 읽지 않음.
- **수정 방향**: EAS Secret 또는 `eas.json` production env에 추가. 굿즈 v1 OFF이므로 즉각 출시 블로커는 아니나, PortOne 본인인증(`verify.tsx`)이 production 빌드에서 동작하지 않을 수 있음.

---

## J. 17+ 콘텐츠 가이드라인 충돌

### [CRITICAL-J1] 연령 게이트 클라이언트 단독 — 17+ UGC 앱 서버 검증 필수
- **파일**: `app/(auth)/age-check.tsx:65` (`AsyncStorage.setItem("age_verified", "true")`), `server/` 전체 — `age_verified` 0 hits
- **현황**: 만 19세 연령 확인이 클라이언트 계산 + AsyncStorage 저장으로만 처리. 서버에서 `users.adult_verified` 컬럼 없음, 라이브 join/call 엔드포인트에서 연령 검증 없음 (22-client-security.md Critical, 23-live-room-security.md C3).
- **시나리오**: 심사관이 앱을 설치 → age-check 화면에서 임의 날짜 입력(또는 앱 재설치로 우회) → 1:1 영상통화·라이브 입장 가능 → 17+ 연령 게이트가 형식적임을 심사관이 발견 → 5.1.1, 1.1.4 위반으로 거부. 한국 정보통신망법 제42조 위반 리스크.
- **수정 방향**: PortOne PASS 본인인증 연동 완료 후 서버 `users.is_adult_verified = true` 저장, call/live join API에서 게이트 추가. 미완성 시 Apple이 17+ UGC 앱에서 실질적 연령 확인 미비로 거부 가능성 높음.
- **근거**: App Store Review Guidelines 5.1.1, 1.4.1

### [MEDIUM-J2] 라이브 화면 녹화 방지 미적용 (23-live-room-security.md H6과 연동)
- **파일**: `app/(app)/live/[roomId].tsx` (`usePreventScreenCapture` 0 hits), `app/(app)/call/[sessionId].tsx:28` (정상 적용)
- **현황**: 1:1 통화 화면은 `usePreventScreenCapture()` 적용. 라이브 방송 화면 미적용. 17+ 등급 앱에서 라이브 방송 캡처가 무단으로 재배포되면 호스트(크리에이터) 권리 침해 및 앱의 콘텐츠 보호 의무 위반.
- **수정 방향**: `live/[roomId].tsx` 상단에 `usePreventScreenCapture()` 추가. iOS는 시스템 차원에서 완전 차단 불가하므로 `addScreenshotListener`로 호스트에게 알림.

### [INFO-J3] 메타데이터 "성인" 키워드 노출 지점 목록
- **현황**: App Store Connect에 직접 입력되는 텍스트(앱 이름, 설명, 키워드, 리뷰 노트)에 "성인" 키워드가 없어야 함. 다음 내부 문서들이 실제 ASC 입력 시 복사될 위험이 있음:
  - `docs/setup/06_store-submission.md:110-111` — Review Notes 초안에 "성인 대상 영상통화 서비스" 포함
  - `docs/setup/06_store-submission.md:278` — 영문 설명에 "Red Mode — Adult-only video calling" 포함
- **수정 방향**: ASC 제출 전 Review Notes 초안과 앱 설명에서 "adult", "성인 콘텐츠" 제거. "17+ only", "age-verified users"로 대체.

---

## K. 앱 콘텐츠 권리

### [MEDIUM-K1] 크리에이터 프로필 사진·영상 권리 처리 불명확
- **파일**: `docs/legal/02_creator_contract.md`
- **현황**: 크리에이터 계약서가 존재하나 프로필 사진·영상통화 캡처의 저작권 및 앱 내 사용 권리에 대한 조항이 명시적인지 코드로 확인 불가. App Store Review Guidelines 5.2.1 — 제3자 저작물을 앱 내에서 사용하려면 라이선스 증빙 필요.
- **수정 방향**: 크리에이터 계약서에 "앱 내 프로필 이미지, 통화 썸네일 사용 동의" 조항 명시. 법무 검토.

### [INFO-K2] 굿즈 이미지 저작권 — v1 OFF, v1.1 이후 점검 필요
- **현황**: 굿즈 마켓플레이스 v1 OFF. v1.1 크리에이터 입점 시 상품 이미지 저작권 처리, 원썸 자체 굿즈 이미지 라이선스 정책 필요. 즉각 출시 영향 없음.

---

## 미확인 (수동 검증 필요)

| ID | 항목 | 확인 방법 |
|---|---|---|
| U1 | EAS Production 빌드에서 실제 `PrivacyInfo.xcprivacy` 생성 내용 | `npx expo prebuild --platform ios` 후 파일 검수 |
| U2 | Agora SDK `react-native-agora`의 IDFA 사용 여부 | 빌드 바이너리 Privacy Report 또는 Agora 공식 Privacy Manifest 확인 |
| U3 | App Store Connect에 기존 IAP 상품 등록 여부 (kr.wantsome.app.point_* 6개) | ASC 대시보드 직접 확인 |
| U4 | PortOne PASS 본인인증 production 환경 동작 여부 (`EXPO_PUBLIC_PORTONE_*` EAS Secret 설정) | EAS Secrets 대시보드 + 실기기 테스트 |

---

## 전체 요약표

| ID | 영역 | 심각도 | 위치 | Apple 조항 |
|---|---|---|---|---|
| CRITICAL-A1 | Privacy Manifest NSPrivacyTracking 미선언 | Critical | app.json:34 | Privacy Manifest Required |
| CRITICAL-A2 | NSPrivacyCollectedDataTypes 미선언 | Critical | app.json:34 | 5.1.2 |
| CRITICAL-B2 | 차단 목록 UI 미완성(토스트만) | Critical | settings/index.tsx:148 | 5.1.1(v), 2.1 |
| CRITICAL-B3 | 굿즈 PG 결제 v1 OFF 확인 필요 | Critical | shop.tsx:27, 00-pricing-policy.md:J | 3.1.1 |
| CRITICAL-B4 | 한국 제3자 결제 Entitlement 미신청 | Critical | app.json 전체 | 3.1.3(b) |
| CRITICAL-H1 | ASC Product ID vs 코드 storeId 불일치 | Critical | constants/products.ts:10-15 | 3.1.1 |
| CRITICAL-H2 | 가격 세 소스 불일치 | Critical | constants/products.ts, app-store-iap-copy.md | 3.1.1 |
| CRITICAL-J1 | 연령 게이트 클라이언트 단독 | Critical | age-check.tsx:65 | 5.1.1, 1.4.1 |
| HIGH-B1 | Age Rating 설문 "Sexual/Intense" 컨셉 충돌 | High | docs/setup/06_store-submission.md:30 | 1.1, 1.1.4, 4.3 |
| HIGH-B5 | 라이브 신고 기능 없음 | High | live/[roomId].tsx (0 hits) | 1.4.1, 5.1.1 |
| HIGH-B6 | 이용약관·개인정보처리방침 링크 미동작 | High | settings/index.tsx:165-172 | 5.1.2 |
| HIGH-B7 | 캠톡 언급 내부문서 → ASC 메타데이터 유입 위험 | High | docs/setup/06_store-submission.md | 4.3 |
| HIGH-G1 | "성인 영상통화" 문구 Review Notes 초안 잔존 | High | docs/setup/06_store-submission.md:110 | 1.1, 5.2.1 |
| HIGH-H3 | 첫충전 배너 "2배" vs 정책 "1.5배" 불일치 | High | charge/index.tsx:258 | 3.1.1 |
| HIGH-I1 | EAS iOS Submit 설정 없음 | High | eas.json:submit | 빌드/제출 |
| MEDIUM-C3 | NSUserTrackingUsageDescription 미판단 | Medium | app.json | ATT Framework |
| MEDIUM-E1 | ATT 구현 여부 미확인 (Agora IDFA) | Medium | 미확인 | ATT |
| MEDIUM-F1 | voip 백그라운드 모드 미선언 | Medium | app.json:29-32 | 2.5.4 |
| MEDIUM-G2 | 스크린샷 미준비 | Medium | 없음 | 메타데이터 |
| MEDIUM-I2 | EAS Production PortOne 환경변수 미설정 | Medium | eas.json:production | 빌드 |
| MEDIUM-J2 | 라이브 화면 녹화 방지 미적용 | Medium | live/[roomId].tsx | 5.1.1 |
| MEDIUM-K1 | 크리에이터 사진 저작권 계약 불명확 | Medium | legal/02_creator_contract.md | 5.2.1 |
| INFO-A3 | ios/ 디렉터리 없음 — Managed Workflow 확인 | Info | ios/ 부재 | Privacy Manifest |
| INFO-C1 | NSCameraUsageDescription 신분증 목적 누락 | Info | app.json:24 | 5.1.1 |
| INFO-C2 | Photo 권한 중복 선언 | Info | app.json:26, 93 | — |
| INFO-D1 | ATS 현재 상태 OK | Info | app.json | ATS |
| INFO-G3 | 카테고리 Entertainment + Social Networking OK | Info | docs/setup/06_store-submission.md | — |
| INFO-J3 | "성인" 키워드 ASC 입력 시 유입 위험 | Info | docs/setup/06_store-submission.md:278 | 1.1.4 |
| INFO-K2 | 굿즈 이미지 저작권 v1 이후 점검 | Info | — | 5.2.1 |

---

## 출시 전 필수 액션 순위 (iOS 기준)

1. **[즉시]** CRITICAL-H1 — ASC Product ID ↔ 코드 storeId 통일, 6개 상품 신규 등록
2. **[즉시]** CRITICAL-H2 — 가격 정책 PR 완료 후 constants/products.ts + app-store-iap-copy.md 동기화
3. **[즉시]** CRITICAL-A1/A2 — app.json privacyManifests에 NSPrivacyTracking false + CollectedDataTypes 선언
4. **[즉시]** CRITICAL-J1 — PortOne PASS 본인인증 연동 완료 → 서버 adult_verified 게이트
5. **[즉시]** CRITICAL-B2 — 차단 목록 UI 완성 또는 메뉴 제거
6. **[즉시]** HIGH-B5 — 라이브 방송 신고 버튼 UI 구현
7. **[즉시]** HIGH-B6 — 이용약관·개인정보처리방침 WebBrowser로 연결
8. **[즉시]** HIGH-I1 — eas.json submit.production.ios 완성
9. **[즉시]** HIGH-B1 — Age Rating 설문 "Sexual/None" 재작성
10. **[제출 직전]** HIGH-G1 — Review Notes 초안에서 "성인" 키워드 제거
11. **[제출 직전]** MEDIUM-F1 — UIBackgroundModes에 voip 추가
12. **[제출 직전]** MEDIUM-G2 — 스크린샷 촬영 (실제 데이터로)
13. **[확인]** U1 — prebuild 후 PrivacyInfo.xcprivacy 생성 내용 검수
14. **[확인]** U3 — ASC IAP 상품 6개 Active 상태 확인

---

작성자: mobile-developer  
기준 코드: main 브랜치 61ee659 (2026-04-26)  
다음 단계: 31-playstore-compliance.md (Android), 32-legal-korea.md
