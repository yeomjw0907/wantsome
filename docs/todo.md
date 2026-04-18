# wantsome — 출시 준비 체크리스트

> **최종 업데이트: 2026-04-18** — IAP·소셜 로그인·코드 기준 동기화
>
> **서비스 포지션:** 성인 플랫폼이 아니라 **인플루언서(크리에이터)와 팬이 1:1 영상통화**로 소통하는 서비스. 스토어 설명·심사 노트·등급 설문도 이에 맞게 작성한다.
>
> 🧑 = 사람이 직접 해야 하는 외부 계정/설정 작업  
> 🤖 = 코드/서버에서 처리하는 작업  
> ✅ = 완료

---

## 현재 출시 준비도: **약 40%** — 심사 제출 전 필수 작업 남음

---

# 🔴 지금 해야 할 것 (우선순위)

## [🧑] 1. 실제 IAP(인앱결제) — 스토어 등록 + 서버 환경변수

앱(`expo-iap`)은 이미 구매 → `/api/payments/verify-iap` 로 `purchase_token`·`product_id`를 보냅니다. `**dev_mock_receipt` 하드코딩은 현재 코드에 없음** (`app/(app)/charge/index.tsx` 기준).

다만 **서버는 아직 Apple/Google 공식 API로 영수증을 검증하지 않음**. 스토어에 상품만 올리고 끝이 아니라, 이후 **[🤖] 서버 영수증 검증 구현**이 필요합니다.

### 1-A. 반드시 맞출 것: 상품 ID = 코드와 동일

`constants/products.ts` / `server/lib/products.ts`와 **완전히 동일한 Product ID**로 스토어에 **소모형** 상품을 만듭니다. (예전 문서의 4종 `points_1000` 등은 **사용하지 않음**.)


| 앱 내부 ID  | 인앱 상품 ID (스토어 등록명)              | 가격(원) 참고 | 지급 포인트  |
| -------- | ------------------------------- | -------- | ------- |
| POINT_01 | `kr.wantsome.app.points_5500`   | 4,900    | 5,500   |
| POINT_02 | `kr.wantsome.app.points_11500`  | 9,900    | 11,500  |
| POINT_03 | `kr.wantsome.app.points_24000`  | 19,900   | 24,000  |
| POINT_04 | `kr.wantsome.app.points_50000`  | 39,900   | 50,000  |
| POINT_05 | `kr.wantsome.app.points_105000` | 79,900   | 105,000 |
| POINT_06 | `kr.wantsome.app.points_200000` | 149,000  | 200,000 |


가격·표시명은 스토어 정책에 맞게 조정 가능. **문자열 ID는 위와 통일**하는 것을 권장합니다.

### 1-B. Apple (iOS)

1. [App Store Connect](https://appstoreconnect.apple.com) → 해당 앱 → **기능** → **인앱 구매**
2. **소모형**으로 위 6개 Product ID 각각 생성
3. **앱 정보**(또는 앱 설정) → **공유 암호(App-Specific Shared Secret)** 생성
4. 배포 서버 `server/.env` (로컬이면 `server/.env.local` 등 실제 로드되는 파일):
  ```env
   APPLE_IAP_SHARED_SECRET=여기에_공유_암호
  ```
5. 참고: `server/.env.example`에 키 이름만 정리해 둠 — **실제 값은 커밋 금지**

### 1-C. Google (Android)

1. [Google Play Console](https://play.google.com/console) → 앱 → **수익 창출** → **인앱 상품** → 위와 **동일한 product ID**로 소모품 6개
2. [Google Cloud Console](https://console.cloud.google.com) → 서비스 계정 생성 → **JSON 키** 다운로드
3. Play Console에서 해당 서비스 계정에 **Google Play Android Developer API** 권한 연결 (공식 문서: “API 액세스” 단계)
4. `server/.env`:
  ```env
   GOOGLE_SERVICE_ACCOUNT_JSON=JSON_전체_한줄_또는_이스케이프
  ```
   (구현 시 **파일 경로**만 읽도록 바꿀 수 있음 — 검증 코드 작성 시 통일)

### 1-D. 서버 영수증 검증 (아직 미구현 → 출시 전 필수에 가깝음)

- **iOS:** `verifyReceipt` 또는 StoreKit 2 JWS 검증 + 공유 암호  
- **Android:** Play Developer API로 `purchaseToken` 검증  
- 현재 `server/app/api/payments/verify-iap/route.ts`는 **클라이언트가 보낸 정보만으로 DB 지급**하므로, 스토어 연동 후 **반드시 검증 단계 추가** 필요

---

## [🤖] 2. 서버 IAP 영수증 검증 구현

클라이언트는 이미 실제 구매 흐름 사용. **서버에서 Apple/Google에 영수증 검증** 후에만 `verify_iap_charge` RPC 호출하도록 변경.

---

## [🤖] 3. 관리자 API 권한 검증 추가 (보안)

`server/app/admin/api/`* 전체에 superadmin(또는 역할) 검증 없음 → 일반 유저 호출 위험.

---

## 🔴 CRITICAL — 앱스토어 심사 반려 사유

### [🧑] 4. 개인정보처리방침 + 이용약관 페이지 게시

- `https://wantsome.kr/privacy`, `https://wantsome.kr/terms`
- App Store Connect / Play Console 스토어 등록정보에 URL 입력

### [🧑] 5. Apple Developer Program + App Store Connect 앱

- 연 $99, Bundle ID `kr.wantsome.app` (✅ 식별자 작업은 아래 완료 기록 참고)
- 새 앱 생성 후 **연령 등급**은 App Store Connect 설문에서 **실제 기능·콘텐츠**에 맞게 선택 (영상통화·커뮤니티 등; “성인 전용 앱”으로 단정하지 말고 사실대로)

### [🧑] 6. Google Play Console

- 일회성 $25, 패키지 `kr.wantsome.app`
- **IARC** 설문에서 앱 내용에 맞는 등급·속성 선택 (인플루언서–팬 1:1 영상통화·예약·포인트 등; 과도한 성인 키워드 없이 사실대로)

---

## 🟠 HIGH — 출시 전 완료 필요

### [🧑] 7. 푸시 알림 (APNs 키 → Expo)

Apple Developer → **Keys** → APNs → `.p8` → [expo.dev](https://expo.dev) 프로젝트 Credentials에 업로드

### [🤖] 8. 푸시 백엔드 (FCM 발송)

`/api/push/register` 이후 실제 발송 로직

### [🧑] 9. Slack 웹훅

`server/.env` → `SLACK_WEBHOOK_URL=`

### [🤖] 10. 정산율 정책 vs 코드 일치

계약서 등급별 % vs DB/코드 50% 등 — 정책 확정 후 반영

### [🧑] 11. EAS Build + TestFlight

`eas build --platform ios|android --profile production` 등

---

## 🟡 MEDIUM

### [✅] 12. 소셜 로그인 Supabase 연동 — **완료**

Supabase **Authentication → Providers** 에서 **Email, Apple, Google, Kakao** 활성화 확인.  
(Apple은 **Secret Key = JWT** — `npm run apple:oauth-secret` 로 생성한 문자열 전체, **약 6개월마다 갱신**)

상세 단계는 **아래「완료 기록」** 참고.

### [✅] 13. API 커스텀 도메인 — **완료** (2026-04-18 점검)

- `api.wantsome.kr` DNS → A 레코드 `216.150.16.193`, `216.150.1.65` (Vercel 계열)
- `https://api.wantsome.kr` → **HTTP 200** 응답 확인
- `eas.json` 의 `preview` / `production` 에 `EXPO_PUBLIC_API_BASE_URL: "https://api.wantsome.kr"` 이미 설정됨 (`staging` 은 `https://api-staging.wantsome.kr` — 별도 스테이징 쓸 때만 해당)

### [🤖] 14. 트랜잭션 롤백

### [🤖] 15. 관리자 RBAC

### [🧑] 16. PortOne PASS (선택)

---

## 🟢 NICE TO HAVE

17–21 (구조화 로깅, any 제거, 레이트 리밋, SMS OTP, 사업자 정보) — 기존과 동일

---

## 🤖 Claude 요청 시 처리 가능 작업


| #     | 작업                  | 비고         |
| ----- | ------------------- | ---------- |
| 2     | IAP 서버 영수증 검증       | Apple+Play |
| 3     | 관리자 API 권한          |            |
| 8     | FCM 푸시 백엔드          |            |
| 10    | 정산율 + system_config |            |
| 14–15 | 트랜잭션 / RBAC         |            |


---

## 앱스토어 심사 제출 가능 조건 (요약)


| 항목                                   | 상태              |
| ------------------------------------ | --------------- |
| Supabase, Agora                      | ✅               |
| API 도메인 `api.wantsome.kr` + 앱 빌드 env | ✅               |
| 소셜 로그인 앱 + Supabase 대시보드             | ✅               |
| 실제 IAP (스토어 상품 + 서버 검증 + env)        | ❌               |
| 개인정보/약관 URL                          | ❌               |
| Apple/Google 개발자·스토어 계정 (앱 제출용)      | 부분 ✅ / 제출 절차 남음 |
| EAS 프로덕션 빌드                          | ❌               |
| APNs → Expo                          | ❌               |


---

# ✅ 완료·진행 기록 (아래로 모음)

## 사용자 직접 완료 (2026-04 기준)

- **Apple Developer Program** 유료 가입
- **App ID** `kr.wantsome.app` — **Sign In with Apple** (Primary, 서버 알림 URL 생략 가능)
- **Services ID** `kr.wantsome.app.signin` — Web 도메인 `ftnfdtvaxsvosdyjdxfq.supabase.co`, Return URL `https://ftnfdtvaxsvosdyjdxfq.supabase.co/auth/v1/callback`
- **Key** — Sign in with Apple용 `.p8` (Key ID 예: `WC5Y5XRK2S`), Supabase Apple Provider에 **Client IDs + JWT 형식 Secret Key** 입력 (레포 `npm run apple:oauth-secret` 참고)
- **Google** — Cloud OAuth 클라이언트 + Supabase Google Provider
- **Kakao** — REST API 키 + Redirect URI + Supabase Kakao Provider
- **Supabase 대시보드** — Sign In / Providers 에서 **Apple, Google, Kakao** 사용 설정
- **API 커스텀 도메인** — `api.wantsome.kr` (DNS·HTTPS 정상, `eas.json` 프로덕션/프리뷰 API URL과 일치)

## 이미 완료된 항목 (기존)

**인프라**

- Supabase 프로젝트 + 마이그레이션
- Agora App ID
- Vercel API 배포
- `wantsome.kr` 도메인

**앱 기능**

- 소셜 로그인 **코드**, 온보딩, 메인 피드, **크리에이터(인플루언서)–팬 1:1 영상통화**, 예약, 라이브, 쇼핑, 즐겨찾기, 신고, 크리에이터 온보딩, **포인트 충전 UI(expo-iap 연동)**, DM, 관리자 화면 다수, 정산 크론잡 등

---

*작업 완료 시 이 파일의 체크 상태·날짜를 갱신하세요.*