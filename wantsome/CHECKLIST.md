# wantsome — 앱스토어 배포 체크리스트

> 마지막 업데이트: 2025-03
> 개발 완성도: ~85%

---

## 🔴 필수 — 앱스토어 제출 전 완료해야 함

### 1. 사업자 등록 + PortOne 연동
- [ ] 사업자 등록 (개인사업자 or 법인) — 온라인 홈택스(hometax.go.kr)
- [ ] PortOne 계정 생성 (https://portone.io) → PASS 본인인증 채널 신청
- [ ] `app/(auth)/verify.tsx` 의 `handleVerify()` 함수에 PortOne SDK 연동
  ```
  파일: app/(auth)/verify.tsx
  현재 상태: __DEV__에서만 인증 스킵, 프로덕션에서 Toast만 노출
  할 일: PortOne IMP.certification() 연동 후 identityVerificationId → /api/auth/verify-identity 전달
  ```

### 2. Apple Developer Program
- [ ] Apple Developer Program 가입 ($99/년) — https://developer.apple.com
- [ ] App Store Connect에서 앱 등록
  - App Name: wantsome (원썸)
  - Bundle ID: `kr.wantsome.app`
  - SKU: wantsome-kr
- [ ] **Sign in with Apple** 활성화 (Identifiers → App ID → Capabilities)
- [ ] APNs Key 생성 (Certificates → Keys → +) → Supabase Dashboard에 등록

### 3. Google Play Console
- [ ] Google Play Console 계정 ($25 1회) — https://play.google.com/console
- [ ] 앱 등록 — Package: `kr.wantsome.app`
- [ ] Firebase 프로젝트 생성 → `google-services.json` 다운로드 → 프로젝트 루트에 추가
  ```
  파일 위치: /google-services.json (app.json의 android.googleServicesFile 경로)
  현재 app.json: android.googleServicesFile = "./google-services.json" (파일 없음)
  ```
- [ ] FCM 서버 키 → Supabase Dashboard / Expo 대시보드에 등록

### 4. 소셜 로그인 설정
#### Google OAuth
- [ ] Google Cloud Console (https://console.cloud.google.com) → OAuth 2.0 클라이언트 ID 생성
- [ ] 앱 유형: iOS + Android 각각 생성
- [ ] `.env.local` 에 `EXPO_PUBLIC_GOOGLE_CLIENT_ID` 추가
- [ ] Supabase Dashboard → Authentication → Providers → Google 활성화 + Client ID/Secret 입력

#### Apple OAuth
- [ ] Supabase Dashboard → Authentication → Providers → Apple 활성화
- [ ] Apple Developer에서 Service ID 생성 → Client ID / Key ID / Private Key 입력

#### Kakao OAuth
- [ ] Kakao Developers (https://developers.kakao.com) → 앱 등록
- [ ] 플랫폼: iOS (Bundle ID), Android (패키지명) 등록
- [ ] REST API 키 → Supabase Auth Provider 설정
- [ ] Kakao SDK 설치: `npx expo install @react-native-kakao/core` (현재 미설치)

### 5. EAS Build 설정
- [ ] `eas.json` → `submit.production.ios` 에 입력:
  ```json
  {
    "appleId": "your@apple.id",
    "ascAppId": "1234567890",   // App Store Connect 앱 ID
    "appleTeamId": "XXXXXXXXXX" // 10자리 Team ID
  }
  ```
- [ ] EAS 환경변수 설정 (`eas env:create`):
  ```
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  EXPO_PUBLIC_API_BASE_URL (= https://api.wantsome.kr)
  EXPO_PUBLIC_AGORA_APP_ID
  EXPO_PUBLIC_PORTONE_STORE_ID
  EXPO_PUBLIC_PORTONE_CHANNEL_KEY
  ```

### 6. IAP (인앱결제) 연동
- [ ] App Store Connect → 인앱 구매 상품 등록 (포인트 상품별)
  | 상품명 | 포인트 | 가격 |
  |--------|--------|------|
  | 하트팩 소 | 1,000P | ₩1,200 |
  | ... | ... | ... |
- [ ] Google Play Console → 인앱 상품 등록 (동일 상품 구성)
- [ ] `server/app/api/payments/verify-iap/route.ts` 완성 (현재 스텁)
  - iOS: App Store Server API 영수증 검증
  - Android: Google Play Developer API 검증

### 7. 개인정보처리방침 / 이용약관 작성
- [ ] `server/app/privacy/page.tsx` — 실제 내용으로 교체 (현재 스켈레톤)
- [ ] `server/app/terms/page.tsx` — 실제 내용으로 교체 (현재 스켈레톤)
- [ ] 법무사 검토 권장
- [ ] 배포 URL:
  - 개인정보처리방침: `https://api.wantsome.kr/privacy`
  - 이용약관: `https://api.wantsome.kr/terms`
- [ ] App Store Connect 앱 정보에 URL 입력

### 8. 앱스토어 메타데이터
- [ ] 앱 이름: `wantsome - 원썸`
- [ ] 부제목(iOS): `크리에이터와 함께하는 특별한 순간`
- [ ] 설명 (한국어, 4000자 이내)
- [ ] 키워드 (iOS, 100자): 화상통화, 크리에이터, 라이브, 원썸, ...
- [ ] 스크린샷: iPhone 6.7인치(필수), iPad(선택)
  - 최소 3장, 최대 10장
  - 앱 주요 화면 캡처 (홈피드, 크리에이터 프로필, 통화화면 등)
- [ ] 앱 아이콘: 1024×1024px (App Store Connect 업로드용)
- [ ] 카테고리: 소셜 네트워킹 (또는 엔터테인먼트)

### 9. 연령 등급 설정
- [ ] iOS: App Store Connect → 앱 등급 → **17+** (성인 콘텐츠, 성인 테마)
- [ ] Android: Google Play → 콘텐츠 등급 → **성인 (18+)**
- [ ] 성인 콘텐츠 포함 여부 정직하게 신고 (허위 신고 시 앱 삭제 위험)

---

## 🟡 권장 — 출시 직후 가능

### 10. 알림 시스템 완성
- [ ] APNs + FCM 설정 완료 후 `notifications` 테이블 활용
- [ ] Expo Push Notification 서비스 연동 (`push_tokens` 테이블 있음)
- [ ] 알림 유형: 예약 알림, 선물 수신, 포인트 충전 완료

### 11. 고객센터(CS) 연결
- [ ] 이메일 주소 확정 → `app/(app)/settings/index.tsx` "고객센터" 버튼에 연결
- [ ] 또는 채널톡(channel.io) / 카카오 비즈채널 연동

### 12. Agora 토큰 서버 강화
- [ ] 현재: App ID만으로 접속 (보안 취약)
- [ ] 개선: Agora Token Server 구축 → 임시 토큰 발급 방식으로 변경
- [ ] 참고: Agora Token Builder (server/app/api/calls/ 에 토큰 발급 엔드포인트 추가)

### 13. 어드민 누락 페이지
- [ ] `/admin/points` — 포인트 충전 내역 관리
- [ ] `/admin/banners` — 홈 배너 관리
- [ ] `/admin/system` — 시스템 설정 (점검 모드 등)
- [ ] `/admin/admins` — 관리자 계정 관리
- [ ] `/admin/cs` — CS 문의 관리

### 14. Vercel 프로덕션 환경변수
- [ ] Vercel Dashboard → Settings → Environment Variables 에 추가:
  ```
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  AGORA_APP_ID
  AGORA_APP_CERTIFICATE
  PORTONE_SECRET
  CRON_SECRET
  ```
- [ ] Vercel 도메인: `api.wantsome.kr` → `wantsome-server.vercel.app` CNAME 연결

---

## ✅ 완료된 항목

- [x] Bundle ID: `kr.wantsome.app` (iOS & Android)
- [x] Expo SDK 55 + 모든 플러그인 설정
- [x] Supabase 프로젝트 설정 (ftnfdtvaxsvosdyjdxfq)
- [x] Agora App ID + Certificate 설정
- [x] 앱 아이콘 / 스플래시 / 알림 아이콘
- [x] 화면 녹화 방지 (expo-screen-capture)
- [x] wantsome.kr 도메인 확보
- [x] 주요 기능 구현 (피드, 화상통화, 예약, 쇼핑, 선물, 채팅)
- [x] 어드민 패널 기본 구조 (대시보드, 크리에이터, 유저, 리포트, 정산)
- [x] DB 스키마 완성 (migrations 001~011)
- [x] 더미 데이터 (크리에이터 5명, 포스트 8개, 상품 8개)
- [x] 테스트 우회 버튼 `__DEV__` 처리 완료
- [x] 개인정보처리방침/이용약관 스켈레톤 페이지 생성

---

## 🗓️ 예상 남은 작업 기간

| 항목 | 예상 소요 |
|------|-----------|
| 사업자 등록 | 1~2주 |
| Apple/Google 개발자 등록 | 1~3일 (심사 대기 포함) |
| 소셜 로그인 연동 | 1~2일 |
| PortOne 연동 | 1~2일 (사업자 등록 후) |
| IAP 연동 | 2~3일 |
| 법적 문서 작성 | 1~2주 (법무사 검토 포함) |
| 앱스토어 심사 | iOS 1~3일, Android 수 시간~1일 |
