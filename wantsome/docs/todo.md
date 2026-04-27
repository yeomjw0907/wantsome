# wantsome — 사용자(개발자) 할 일 목록

> AI(Claude)가 코드로 구현할 수 없는 **외부 서비스 계정/설정/등록** 작업입니다.
> 아래 항목들을 순서대로 완료해야 앱이 실제 동작합니다.

---

## 🔴 필수 (앱 동작에 필수)

### 1. Supabase 프로젝트 설정
- [x] [supabase.com](https://supabase.com) → 프로젝트 생성
- [x] `server/supabase/001_initial.sql` 실행 (users, creators, system_config 등)
- [x] `server/supabase/002_point_charges.sql` 실행
- [x] `server/supabase/003_calls.sql` 실행 (call_sessions, call_signals)
- [x] `server/supabase/004_creator_profiles.sql` 실행 (Phase 2에서 생성됨)
- [x] `server/supabase/005_reservations.sql` 실행 (Phase 3에서 생성됨)
- [x] `server/supabase/006_reports.sql` 실행
- [x] `server/supabase/007_admin.sql` 실행 (Phase 5에서 생성됨)
- [x] **Row Level Security(RLS)** 활성화 확인 (각 SQL 파일에 포함됨)
- [x] **Realtime** 활성화: `creators`, `call_signals`, `users` 테이블 → Supabase 대시보드 → Table Editor → Realtime 토글 ON
- [x] `system_config` 초기값 INSERT (docs/admin/01_admin_page.md 참고)
- [x] Storage 버킷 생성:
  - `id-cards` (private) — 크리에이터 신분증
  - `profile-images` (public) — 프로필 사진
  - `contracts` (private) — 계약서 PDF

### 2. Agora 설정
- [x] [agora.io](https://www.agora.io) → 계정 생성 → 프로젝트 생성
- [x] App ID 복사 → `.env` / `server/.env`에 `EXPO_PUBLIC_AGORA_APP_ID=` 입력
- [x] **App Certificate** 활성화 → `server/.env`에 `AGORA_APP_CERTIFICATE=` 입력
  - ⚠️ App Certificate가 없으면 토큰 없이 테스트는 가능하지만, 프로덕션에서는 반드시 필요
- [x] Agora 콘솔 → 사용량 확인 (무료 플랜: 월 10,000분)

### 3. 소셜 로그인 (Supabase Auth)
- [ ] Supabase 대시보드 → Authentication → Providers
  - **Google OAuth**:
    - Google Cloud Console → OAuth 2.0 클라이언트 ID 생성
    - Client ID, Client Secret → Supabase에 입력
    - 리디렉트 URL: `https://{your-project}.supabase.co/auth/v1/callback`
  - **Apple Sign In**:
    - Apple Developer → Certificates → Sign In with Apple 설정
    - App ID suffix, Team ID → Supabase에 입력
    - 로컬 테스트는 실제 디바이스 + Apple 계정 필요
  - **Kakao (선택)**:
    - [developers.kakao.com](https://developers.kakao.com) → 앱 생성
    - REST API 키 → Supabase Kakao 프로바이더에 입력
- [ ] `GUIDE_SOCIAL_LOGIN.md` 참고

### 4. 환경변수 설정
- [ ] `.env` 파일 생성 (`.env.example` 복사 후 값 입력):
  ```
  EXPO_PUBLIC_SUPABASE_URL=
  EXPO_PUBLIC_SUPABASE_ANON_KEY=
  EXPO_PUBLIC_AGORA_APP_ID=
  EXPO_PUBLIC_API_BASE_URL=https://your-server.vercel.app
  ```
- [ ] `server/.env` 파일 생성 (`server/.env.example` 복사 후 값 입력):
  ```
  SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  AGORA_APP_CERTIFICATE=
  PORTONE_API_SECRET=
  SLACK_WEBHOOK_URL=
  ```

### 5. API 서버 배포 (Vercel)
- [ ] [vercel.com](https://vercel.com) → 계정 생성 (GitHub 연동)
- [ ] `server/` 폴더를 Vercel 프로젝트로 배포
  - Root Directory: `server`
  - Framework: Next.js
- [ ] Vercel 대시보드 → Settings → Environment Variables → server/.env 값들 입력
- [ ] 배포 완료 후 URL → `.env`의 `EXPO_PUBLIC_API_BASE_URL` 업데이트
- [ ] `docs/context/07_vercel_deploy.md` 참고

---

## 🟡 권장 (프로덕션 필수)

### 6. PortOne V2 (본인인증 + 계좌 실명조회)
- [ ] [portone.io](https://portone.io) → 계정 생성 → 사업자 등록 필요
- [ ] Store ID, Channel Key → `.env`에 입력:
  ```
  EXPO_PUBLIC_PORTONE_STORE_ID=
  EXPO_PUBLIC_PORTONE_CHANNEL_KEY=
  PORTONE_API_SECRET=
  ```
- [ ] PASS 본인인증 채널 설정 (KG이니시스 또는 다날)
- [ ] 계좌 실명조회 API 연동
- [ ] ⚠️ **사업자등록증 필수** — 개인사업자 또는 법인 등록 후 PortOne 계약 가능

### 7. Apple Developer Program (iOS 배포)
- [ ] [developer.apple.com](https://developer.apple.com) → 연 $99 등록
- [ ] Bundle ID: `kr.wantsome.app` 등록
- [ ] 연령 등급: 17+ 설정 (성인 콘텐츠)
- [ ] App Store Connect → 앱 생성
- [ ] 개인정보처리방침 URL 필요: `https://wantsome.kr/privacy`
- [ ] Expo EAS 설정: `docs/context/06_eas_build.md` 참고

### 8. Google Play Console (Android 배포)
- [ ] [play.google.com/console](https://play.google.com/console) → 일회성 $25 등록
- [ ] Package Name: `kr.wantsome.app`
- [ ] 콘텐츠 등급: IARC 설문 → 성인(18+)
- [ ] 개인정보처리방침 URL 필요

### 9. Expo EAS (앱 빌드/배포)
- [ ] `npm install -g eas-cli`
- [ ] `eas login` → Expo 계정으로 로그인
- [ ] `eas build:configure`
- [ ] `eas build --platform ios` / `eas build --platform android`
- [ ] `docs/context/06_eas_build.md` 참고

---

## 🟢 선택 (운영 편의)

### 10. Slack 웹훅 설정
- [ ] Slack 워크스페이스 생성 또는 기존 워크스페이스 사용
- [ ] 채널 생성: `#긴급-신고`, `#크리에이터-심사`, `#포인트-로그`, `#정산-알림`, `#매출-리포트`, `#운영-알림`
- [ ] Slack App → Incoming Webhooks 활성화 → Webhook URL 복사
- [ ] `server/.env`에 `SLACK_WEBHOOK_URL=` 입력

### 11. Expo Push Notifications
- [ ] Expo 대시보드 → Push Notifications → 설정
- [ ] iOS: APNs 키 (.p8) → Expo 업로드
- [ ] Android: FCM 서버 키 → Expo 업로드
- [ ] 앱에서 `expo-notifications` 권한 요청 로직 이미 포함됨

### 12. 관리자 superadmin 계정 설정
- [ ] 서버 배포 후 본인 계정으로 로그인
- [ ] Supabase SQL Editor에서:
  ```sql
  UPDATE users SET role = 'superadmin' WHERE id = '당신의_user_id';
  ```
- [ ] 이후 관리자 패널 URL: `https://your-server.vercel.app/admin`에서 관리

### 13. 사업자 정보 system_config 입력
- [ ] 사업자 등록 완료 후 Supabase SQL Editor에서:
  ```sql
  UPDATE system_config SET value = '원썸 컴퍼니' WHERE key = 'company_name';
  UPDATE system_config SET value = '[대표자명]' WHERE key = 'ceo_name';
  UPDATE system_config SET value = '[사업자번호]' WHERE key = 'business_number';
  -- ... (docs/screens/07_profile_settings.md 참고)
  ```

---

## 📋 Claude(AI)가 구현한 기능 목록

> 아래는 이미 코드로 구현 완료된 기능입니다.

### 앱 (React Native / Expo)
- [x] 온보딩 전체 플로우 (splash → login → terms → verify → role → mode → profile → charge-promo)
- [x] 메인 피드 (2컬럼 그리드, 파란불/빨간불, 무한스크롤, Realtime)
- [x] 포인트 충전 화면 (IAP 연동, 첫충전 배너)
- [x] 영상통화 플로우 (start → incoming → accept/reject → call → summary)
- [x] ReportBottomSheet (신고 시스템)
- [x] 크리에이터 프로필 페이지
- [x] 크리에이터 온보딩 (계약서 서명, 신분증, 계좌)
- [x] 크리에이터 대시보드 (수익/등급/정산/예약)
- [x] 예약 탭 (목록, 상세, 수락/거절)
- [x] 내 프로필 탭 (충전 내역, 통화 기록)
- [x] 설정 (알림, 로그아웃, 탈퇴)

### 서버 (Next.js / Vercel)
- [x] 인증 API (social-login, verify-identity)
- [x] 영상통화 API (start, accept, reject, cancel, end, tick)
- [x] 결제 API (products, verify-iap)
- [x] 크리에이터 API (feed, online 토글, earnings)
- [x] 신고 API (/api/reports)
- [x] 예약 API (CRUD + cron)
- [x] 정산 API (run cron, update-grades)
- [x] 유저 API (me, points, charges, calls, delete)
- [x] 관리자 패널 (대시보드, 크리에이터 심사, 신고, 유저, 정산, 시스템)

---

*최종 업데이트: 2026-03-12 (Claude Code 자동 작성)*
