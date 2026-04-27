# 99. 통합 출시 액션 플랜 — Critical 분류 + PR 분할

작성일: 2026-04-26
출시 목표: ASAP → **2~3주 연기 권장** (Critical 35건 + High 50건 처리 필요)

---

## TL;DR

총 4단계 감사로 **Critical 35건 + High 50건 + Medium 26건** 발견. ASAP 출시 시 **24시간 내 회사 폐업 위험** 시나리오 5건 이상 존재.

**가장 치명적 6가지** (이것만으로도 출시 불가):
1. **`calls/tick` cron 하루 1회 = 무한 무료 통화** ([vercel.json:3](../../server/vercel.json:3))
2. **IAP 영수증 미검증 = 임의 문자열로 200,000P 무한 지급** ([verify-iap/route.ts:110](../../server/app/api/payments/verify-iap/route.ts:110))
3. **users RLS = `points = 999999999` 셀프 변조 가능** ([001_initial.sql:50](../../server/supabase/migrations/001_initial.sql:50))
4. **iOS Privacy Manifest 미선언 = 업로드 차단 (ITMS-91053)**
5. **debug.keystore로 release 서명 = Android 거절** ([android/app/build.gradle](../../android/app/build.gradle))
6. **사업자 정보 placeholder + 통신판매업 미신고 = 전상법 13조 위반**

---

## 출시 일정 재추정

```
Week 1 (Day 1-7) : Critical PR 4~5개 작성 — 결제/RLS/인증/라이브/iOS/Android
Week 2 (Day 8-14): Critical PR 검수 (휴먼 + AI) → main 머지, QA 1차
Week 3 (Day 15-21): High 처리, 메타데이터·스크린샷, EAS 빌드, PG 심사 마무리
Week 4 (Day 22-28): 앱스토어 제출 → 심사 1-3일 → 출시 + 모니터링
```

PG 심사 ~30일과 겹치므로 추가 지연 없음.

---

## Critical 35건 — 영역별 통합

### 결제·정산 (12건) ⭐ 최우선
- 🔴 P1. IAP 영수증 서버 검증 부재 ([21:1](21-payment-flow.md))
- 🔴 P2. 정산율 4종 불일치 (0.5/0.55/0.5 DB/0.35 정책) ([21](21-payment-flow.md))
- 🔴 P3. tick 분당 차감 race (read-modify-write) ([21](21-payment-flow.md))
- 🔴 P4. 선물 race condition ([21](21-payment-flow.md))
- 🔴 P5. 채팅방 unlock race ([21](21-payment-flow.md))
- 🔴 P6. 첫충전 보너스 race (4배 가능) ([21](21-payment-flow.md))
- 🔴 P7. **calls/tick cron 하루 1회 버그** ([40](40-build-deploy.md))
- 🔴 P8. Apple/Google 환불 S2S webhook 미구현 ([21](21-payment-flow.md))
- 🔴 P9. 라이브 환불 RPC 부재 (호스트 강제 종료 시 50,000P 손실) ([23](23-live-room-security.md))
- 🔴 P10. 월 정산이 라이브/선물 매출 누락 ([23](23-live-room-security.md))
- 🔴 P11. 굿즈 재고 음수 race ([21](21-payment-flow.md))
- 🔴 P12. 예약 보증금 중복 차감 race ([21](21-payment-flow.md))

### RLS·DB 보안 (8건)
- 🔴 R1. users RLS 셀프 변조 (`FOR ALL USING auth.uid()=id`) ([20](20-backend-security.md))
- 🔴 R2. creators_self FOR ALL 잔존 (셀프 승인 가능) ([20](20-backend-security.md))
- 🔴 R3. system_config RLS 비활성화 ([10](10-supabase-advisors.md))
- 🔴 R4. RPC 함수 10개 search_path 미설정 ([10](10-supabase-advisors.md))
- 🔴 R5. rate_limits RLS 누락 + checkRateLimit fail-open ([20](20-backend-security.md))
- 🔴 R6. orders/gifts/conversations 비원자 update double-spend ([20](20-backend-security.md))
- 🔴 R7. Storage 버킷 3개 listing 허용 (live-thumbnails/post-images/profiles) ([10](10-supabase-advisors.md))
- 🔴 R8. CRON_SECRET 미설정 시 cron 7개 우회 ([20](20-backend-security.md))

### 인증·본인인증 (4건)
- 🔴 A1. age-check 클라 단독 (정통망법 42조 위반) ([22](22-client-security.md))
- 🔴 A2. verify-identity 백도어 `"test-portone-id"` + IDOR ([20](20-backend-security.md))
- 🔴 A3. PORTONE_API_SECRET 미설정 시 fail-open ([40](40-build-deploy.md))
- 🔴 A4. ACCOUNT_ENCRYPT_KEY zero-key fallback ([20](20-backend-security.md))

### 라이브룸 (4건)
- 🔴 L1. Agora 채널명 결정적 (외부 publish 가능) ([23](23-live-room-security.md))
- 🔴 L2. AGORA_APP_CERTIFICATE 미설정 시 무인증 publish ([22](22-client-security.md), [23](23-live-room-security.md))
- 🔴 L3. 라이브 입장 시 서버 연령 검증 0 ([23](23-live-room-security.md))
- 🔴 L4. suspended 사용자 라이브 입장/방송 가능 ([23](23-live-room-security.md))

### iOS App Store (4건)
- 🔴 I1. Privacy Manifest 미선언 (ITMS-91053) ([30](30-appstore-compliance.md))
- 🔴 I2. 차단 목록 UI 미구현 (Apple 2.1) ([30](30-appstore-compliance.md))
- 🔴 I3. 라이브 신고 기능 전무 (Apple 1.4.1) ([30](30-appstore-compliance.md))
- 🔴 I4. iOS EAS 빌드 설정 전무 (appleId/ascAppId/teamId) ([40](40-build-deploy.md))

### Android Play Store (3건)
- 🔴 N1. Foreground Service 타입 미선언 (Android 14+) ([31](31-playstore-compliance.md))
- 🔴 N2. google-services.json placeholder ([31](31-playstore-compliance.md))
- 🔴 N3. release를 debug.keystore로 서명 ([31](31-playstore-compliance.md))

### 한국 법규 (5건)
- 🔴 K1. 사업자정보 placeholder (전상법 13조) ([32](32-legal-korea.md))
- 🔴 K2. 통신판매업 신고 미완료 ([32](32-legal-korea.md))
- 🔴 K3. 약관 vs 홈페이지 환불정책 모순 (전상법 17조 6항) ([32](32-legal-korea.md))
- 🔴 K4. /youth 페이지 404 (청소년보호법) ([32](32-legal-korea.md))
- 🔴 K5. 개인정보처리방침 위탁업체 누락 ([32](32-legal-korea.md))

---

## PR 분할 계획 (총 9개)

### PR-1: 결제·정산 보안 핵심 [Critical P1, P2, P3, P4, P5, P6, P7, P8] ⭐ 가장 우선
**브랜치**: `fix/payment-critical-security`
**소요**: 2~3일
**검수**: 휴먼 + code-reviewer + debugger 시나리오 추론
**변경 파일**:
- [server/app/api/payments/verify-iap/route.ts](../../server/app/api/payments/verify-iap/route.ts) — Apple/Google API로 영수증 검증 추가
- 신규 [server/app/api/payments/apple-notification/route.ts](../../server/app/api/payments/apple-notification/route.ts) — App Store Server Notification V2
- 신규 [server/app/api/payments/google-rtdn/route.ts](../../server/app/api/payments/google-rtdn/route.ts) — Real-Time Developer Notifications
- [server/app/api/calls/tick/route.ts](../../server/app/api/calls/tick/route.ts) — atomic UPDATE로 race fix
- [server/app/api/gifts/route.ts](../../server/app/api/gifts/route.ts) — atomic UPDATE
- [server/app/api/conversations/route.ts](../../server/app/api/conversations/route.ts) — atomic UPDATE
- [server/app/api/payments/verify-iap/route.ts:106](../../server/app/api/payments/verify-iap/route.ts:106) — 첫충전 *1.5 + 24h
- [server/app/api/auth/phone-login/route.ts:48](../../server/app/api/auth/phone-login/route.ts:48) — first_charge_deadline 24h
- [server/app/api/settlements/run/route.ts:7](../../server/app/api/settlements/run/route.ts:7) — DEFAULT 0.55 → 0.35
- 신규 마이그레이션 — settlement_rate DB default 0.5 → 0.35
- [server/vercel.json:3](../../server/vercel.json:3) — `"0 3 * * *"` → `"* * * * *"`

### PR-2: RLS 전면 정비 [Critical R1~R8]
**브랜치**: `fix/rls-and-rpc-security`
**소요**: 2~3일
**검수**: 휴먼 + code-reviewer + Supabase advisor 재확인
**변경 파일**:
- 신규 마이그레이션 1개 — users RLS 분리 (`SELECT` 자기, `UPDATE` 자기 + role/points/red_mode 컬럼 차단)
- 신규 마이그레이션 — creators_self DROP, 003 정책 정리
- 신규 마이그레이션 — system_config RLS enable + admin 정책
- 신규 마이그레이션 — rate_limits RLS + service_role 정책
- 신규 마이그레이션 — RPC 10개 ALTER FUNCTION ... SET search_path = public, pg_temp
- Storage 정책 (Supabase 콘솔) — listing 비활성화

### PR-3: 인증·본인인증 [Critical A1~A4]
**브랜치**: `fix/auth-identity-security`
**소요**: 2일
**검수**: 휴먼 + code-reviewer
**변경 파일**:
- [server/app/api/auth/verify-identity/route.ts](../../server/app/api/auth/verify-identity/route.ts) — 백도어 제거 + IDOR fix
- [app/(auth)/age-check.tsx](../../app/(auth)/age-check.tsx) — 서버 검증 추가
- 신규 [server/app/api/auth/age-verify/route.ts](../../server/app/api/auth/age-verify/route.ts)
- [server/lib/account-encrypt.ts](../../server/lib) — zero-key fallback 제거 (env 미설정 시 throw)
- [server/app/api/calls/tick/route.ts](../../server/app/api/calls/tick/route.ts) + 다른 cron 6개 — CRON_SECRET 강제 검증
- PortOne 응답 status 검증 추가

### PR-4: 라이브룸 보안 [Critical L1~L4 + I3 + Live High]
**브랜치**: `fix/live-room-security`
**소요**: 2~3일
**검수**: 휴먼 + code-reviewer
**변경 파일**:
- [server/lib/agora.ts](../../server/lib/agora.ts) — 채널명 random salt + cert 미설정 시 throw
- [server/app/api/live/rooms/[id]/join/route.ts](../../server/app/api/live/rooms/[id]/join/route.ts) — 서버 연령 검증 + suspended 차단
- 신규 [server/app/api/live/rooms/[id]/refund/route.ts](../../server/app/api/live/rooms/[id]/refund/route.ts) — 호스트 강제 종료 시 일제 환불
- [server/app/api/settlements/run/route.ts](../../server/app/api/settlements/run/route.ts) — live 입장료/선물 매출 합산
- 신규 마이그레이션 — `reports.live_room_id` 컬럼
- [app/(app)/live/[roomId].tsx](../../app/(app)/live/[roomId].tsx) — 신고 버튼 + 모더레이션 UI
- [server/lib/live.ts:3](../../server/lib/live.ts:3) — LIVE_ENTRY_FEE_POINTS 50,000 → 5,000

### PR-5: iOS Compliance [Critical I1, I2, I4]
**브랜치**: `fix/ios-compliance`
**소요**: 2일
**검수**: 휴먼 + mobile-developer
**변경 파일**:
- [app.json](../../app.json) — `ios.privacyManifests` 추가 (NSPrivacyTracking, NSPrivacyCollectedDataTypes)
- [app/(app)/settings/index.tsx:148](../../app/(app)/settings/index.tsx:148) — 차단 목록 UI 구현 (서버 API 같이)
- 신규 [server/app/api/users/blocks/](../../server/app/api/users/blocks) — 차단 CRUD
- [eas.json](../../eas.json) — submit.production.ios 입력 (사용자 입력 필요: appleId, ascAppId, teamId)
- 신고 기능은 PR-4와 통합

### PR-6: Android Compliance [Critical N1, N2, N3]
**브랜치**: `fix/android-compliance`
**소요**: 1~2일
**검수**: 휴먼 + mobile-developer
**변경 파일**:
- [app.json](../../app.json) — android.permissions에 FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE; android.targetSdkVersion 35 명시
- AndroidManifest 또는 expo plugin — `<service android:foregroundServiceType="camera|microphone">`
- [android/app/build.gradle](../../android/app/build.gradle) — release.signingConfig를 release keystore로
- google-services.json — EAS Secret File로 실제 Firebase 파일 주입 (사용자 액션: Firebase 프로젝트 생성)

### PR-7: 한국 법규 [Critical K1~K5]
**브랜치**: `fix/legal-kr`
**소요**: 1~2일 (코드만; 통신판매업 신고는 사용자 외부 작업)
**검수**: 휴먼 검토 (법무 자문 권장)
**변경 파일**:
- [server/app/page.tsx:25](../../server/app/page.tsx:25) — 사업자정보 system_config 실제 값 (사용자 액션: 사업자등록 완료 후 입력)
- [server/app/terms/page.tsx](../../server/app/terms/page.tsx) — 환불정책 통일, 위탁업체 추가
- [server/app/privacy/page.tsx](../../server/app/privacy/page.tsx) — 위탁업체 (Apple, Google, Agora, Supabase, PortOne) 추가
- 신규 [server/app/youth/page.tsx](../../server/app/youth/page.tsx) — 청소년보호 페이지
- 결제 화면 청약철회 동의 체크박스 (전상법 17조 2항)

### PR-8: 가격 정책 코드 반영 [확정 정책]
**브랜치**: `feat/pricing-policy-v1`
**소요**: 2~3일
**검수**: 휴먼 + code-reviewer + 단위 테스트
**변경 파일**: ([00-pricing-policy.md](00-pricing-policy.md) 액션 리스트 그대로)
- [constants/products.ts:25](../../constants/products.ts:25) PER_MIN_RATES 2000/3000
- [constants/products.ts:9](../../constants/products.ts:9) PRODUCTS 캠톡 매칭 재배열
- [server/lib/products.ts](../../server/lib/products.ts) 동기화
- GIFT 4곳 통합 + 옵션 C
- 슈퍼메시지 50P UI/API
- 추천인 시스템 (신규 테이블 + UI)
- 인플 등급 시스템 (신규 컬럼 + 자동 승급 cron)
- 굿즈 feature flag (v1 OFF)
- [docs/app-store-iap-copy.md](../../docs/app-store-iap-copy.md) 재작성

### PR-9: 클라이언트 보안·정리 [High C1~C4 + 정리]
**브랜치**: `fix/client-security`
**소요**: 1~2일
**검수**: 휴먼 + mobile-developer
**변경 파일**:
- AsyncStorage → SecureStore (세션 토큰, useAuthStore)
- `dist-android-smoke/` git rm + .gitignore에 `dist*/` 추가
- [wantsome/](../../wantsome) 사본 디렉터리 git rm (별도 PR도 OK)
- [app/(app)/creator/upload-id](../../app/(creator)) 화면에 expo-screen-capture 적용

### PR-10 (선택): Supabase Performance + 운영 인프라
**브랜치**: `chore/perf-and-ops`
**소요**: 2일
**변경 파일**:
- 마이그레이션 — RLS `auth.uid()` → `(select auth.uid())` 자동 변환 (113개)
- 인덱스 추가 (`unindexed_foreign_keys` 16개) + 제거 (`unused_index` 46개)
- Sentry 설정 (클라 + 서버)
- 보안 헤더 (HSTS, X-Frame-Options 등) — server middleware
- HIBP leaked password protection 활성화 (Auth 콘솔)
- 패스워드 정책 강화 (8자 + 복잡도)
- mailer_otp_exp 600s

---

## 외부 작업 (코드 외 — 사용자가 진행)

### 즉시 시작 (Week 1)
1. **사업자등록 완료 → 사업자등록증 PDF 확보** (법인 등기 진행 중이면 완료 후)
2. **PortOne 가맹점 신청** (사업자등록증 + 서비스 사이트)
3. **Apple Developer Program 가입** ($99/년) — 출시 전 필수
4. **Google Play Console 가입** ($25 1회) — 출시 전 필수
5. **Firebase 프로젝트 생성 → google-services.json 다운**

### Week 2~3
6. **App Store Connect 앱 등록** (Bundle ID `kr.wantsome.app`)
7. **인앱구매 6개 신규 등록** (가격 정책 PR-8 반영)
8. **APNs Key 생성 → Supabase Auth + Expo 푸시**
9. **소셜 로그인 (Google, Apple, Kakao) Client ID 생성 + Supabase 등록**
10. **App Store / Play 메타데이터 + 스크린샷 6.7" / 6.5" / 5.5"**
11. **17+ Age Rating 설문 정확히 입력** ("성인 콘텐츠" 키워드 회피, 17+는 UGC 빈도 차원)
12. **PortOne 가맹점 승인 → 통신판매업 신고** (구매안전서비스 이용확인증 발급)
13. **APPLE_IAP_SHARED_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON 발급**

### Week 3~4
14. **Vercel 환경변수 등록** (10개+, 위 PR들에서 사용)
15. **EAS Secret 등록** (EXPO_PUBLIC_* 6개 + google-services.json secret file)
16. **api.wantsome.kr CNAME 연결** (Vercel)
17. **EAS production build → 내부 테스트 → 제출**

---

## D-1 출시 전 체크리스트 (37개)

[41-qa-plan.md](41-qa-plan.md)의 D-1 체크리스트 참조. NO 1건이라도 있으면 출시 보류.

---

## 출시 후 모니터링 (Day 0~30)

### Slack 실시간 알림 (가장 중요)
- IAP 영수증 검증 거절률 > 5%
- 음수 잔액 발생
- 정산율 정합성 (자동 alert: 0.35 외 값)
- 라이브 신고 신규 건
- 통화 비정상 종료율 > 10%
- Apple/Google 환불 webhook 수신 실패

### 일일 KPI (오전 회의 시)
- 신규 가입 / 활성 사용자 / 결제 사용자
- 통화 분/사용자 / ARPPU
- 인플 등록 / 인플 활동률
- Critical 버그 / 신고 건

### 분기별 (3개월 cofounder 재협상 시)
- 누적 회사 분담 운영비 (대표 부담분)
- ARPPU·LTV 분포
- Whale 비율 + 케어 효과
- 가격 fine-tuning 필요성

---

## 진행 절차

1. **사용자 승인 후** PR-1부터 순차 작성 (병렬 가능한 것은 동시)
2. 각 PR마다:
   - 별도 브랜치 → 변경 → 자기 점검
   - code-reviewer / debugger / mobile-developer 에이전트로 AI 검수
   - 사용자 휴먼 검수
   - 둘 다 통과 시 main 머지
3. PR-1, PR-2 머지 후 Supabase advisor 재실행 → 결과 확인
4. PR-5, PR-6 머지 후 EAS internal build → 내부 테스트
5. 모든 PR 머지 후 [41-qa-plan.md](41-qa-plan.md) 골든패스 + 회귀 테스트
6. 외부 작업 13~14개 완료 확인
7. 앱스토어 제출

---

## 주의 — 현실적 한계

- **법무 검토 권장**: PR-7 (한국 법규)는 변호사/법무사 검토 강력 권장. 약관·환불·청보법 위반 시 과태료 + 서비스 정지 위험.
- **회계·세무 자문**: 5인 cofounder 분배 + 인플 정산 원천징수 처리는 세무사 자문 권장.
- **PG 위험업종 회피**: PR-7 진행 후 PortOne 신청 시 "1:1 영상통화 + 라이브 콘텐츠 + 굿즈"로 정확히 기재. "성인" 키워드 절대 사용 금지.
- **Whale 보호**: 출시 직후 누적 충전 ₩1M+ 자동 식별 + CS 담당이 1:1 케어. 시스템 자동화는 D+30일 이후.
- **인플 30일 정산 보장**: 영업 2명이 직접 인플 풀 관리, D-Day~D+30일은 매일 인플 통화 시간 모니터링.
