# 사용자 직접 작업 TODO — 출시 전 (최종본)

> 최종 갱신: 2026-04-27
> 본 문서는 PR-1 ~ PR-9 + PR-1.5 hotfix 머지 완료 후, **코드 외부에서 사용자(이용자가 직접 처리)가 진행해야 할 작업**만 모은 통합 체크리스트입니다.
>
> 각 항목 옆 `[난이도/예상시간/필수 여부]` 표기.
> 외부 의존성 큰 항목은 **PG 심사 30일·Apple 심사 1~3일**과 병렬 진행 권장.

---

## 🔴 P0 — 출시 차단 (외부 계정·시크릿·DB 입력)

### 1. 외부 계정 가입 [중간 / 1~2일 + 결제 즉시 / 필수]

| 서비스 | 비용 | 상태 메모 |
|---|---|---|
| Apple Developer Program | $99/년 | ✅ 보유 (사용자 확인) |
| Google Play Console | $25 1회 | 🔴 가입 필요 |
| Firebase 프로젝트 | 무료 | 🔴 생성 + `google-services.json` 다운로드 |
| Google Cloud Console | 무료 | 🔴 Service Account + Pub/Sub topic |
| PortOne (구 아임포트) | 무료 신청 | 🔴 가맹점 신청 (사업자등록증 필요, 심사 ~2주) |
| Sentry (선택) | 5K event/month 무료 | 🟢 D-Day~D+7 사이 셋업 |

**Apple 측 체크리스트** (보유 계정 기준):
- [ ] App Store Connect → 새 앱 등록 (Bundle ID `kr.wantsome.app`, Primary Language 한국어)
- [ ] **API Key 생성** (Users and Access → Integrations) — Key ID + Issuer ID + .p8
- [ ] **APNs Key 생성** (Certificates → Keys → +, Push Notifications 체크) — .p8
- [ ] **Sign in with Apple** Capability 활성화
- [ ] **App Store Server Notification V2 URL 등록**:
  - Production: `https://api.wantsome.kr/api/payments/apple-notification`
  - (선택) Sandbox: 동일 URL
- [ ] **Apple Root CA 다운로드 + PEM 변환** (https://www.apple.com/certificateauthority/ → AppleRootCA-G3 .cer)
  ```bash
  openssl x509 -in AppleRootCA-G3.cer -inform DER -out AppleRootCA-G3.pem
  ```

---

### 2. IAP 인앱 상품 6개 신규 등록 (PR-8 정책 v1) [쉬움 / 30분 / 필수]

⚠️ **기존 storeId(point_5500/11500/24000/50000/105000/200000)는 폐기.** 신규 6개를 새로 등록.

| storeId | 표시 이름 | 가격 | 포인트 |
|---|---|---:|---:|
| `kr.wantsome.app.point_4000` | 체험권 🌱 | ₩6,600 | 4,000P |
| `kr.wantsome.app.point_6600` | 스몰 ☕ | ₩9,900 | 6,600P |
| `kr.wantsome.app.point_18600` | 미디엄 🎯 | ₩27,500 | 18,600P |
| `kr.wantsome.app.point_32000` | 라지 🔥 | ₩46,200 | 32,000P |
| `kr.wantsome.app.point_60000` | 프리미엄 💎 | ₩85,800 | 60,000P |
| `kr.wantsome.app.point_100000` | VIP 👑 | ₩143,000 | 100,000P |

- 상품 유형: **소모성(Consumable)**
- 표시 이름·설명·심사 노트는 [docs/app-store-iap-copy.md](../app-store-iap-copy.md) 그대로 복붙
- App Store Connect + Google Play Console **양쪽 모두** 동일하게 등록

---

### 3. Google Cloud + Pub/Sub + Firebase [중간 / 1~2일 / 필수]

- [ ] **Firebase 프로젝트 생성** (콘솔 https://console.firebase.google.com)
  - Android 앱 추가: package `kr.wantsome.app`
  - **`google-services.json` 다운로드**
  - 옵션 A: 루트의 `google-services.json` 직접 교체 (placeholder 검증: `npm run android:check-firebase`)
  - 옵션 B (권장): `eas secret:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`
- [ ] **Service Account 생성** (Google Cloud Console → IAM → Service Accounts)
  - 권한: View financial data + Manage orders and subscriptions (Play용)
  - JSON Key 다운 → 한 줄로 minify → `GOOGLE_SERVICE_ACCOUNT_JSON` Vercel env
- [ ] **Pub/Sub topic** (예: `wantsome-rtdn`) + **Push subscription** 생성
  - Endpoint: `https://api.wantsome.kr/api/payments/google-rtdn`
  - Authentication: OIDC token + Service account
  - **Audience**: 위 Endpoint URL → `GOOGLE_RTDN_AUDIENCE` env
- [ ] Play Console → Monetize setup → RTDN 에 위 topic 등록
- [ ] Play Console → API access → 위 service account 연결

---

### 4. Vercel 환경변수 등록 [쉬움 / 15분 / 필수]

Vercel Dashboard → Project → Settings → Environment Variables (Production / Preview / Development 모두):

```bash
# Supabase
SUPABASE_URL                    https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY       <service role key>

# Agora
AGORA_APP_ID                    <project app id>
AGORA_APP_CERTIFICATE           <project app certificate>  ⚠️ 미설정 시 통화 503

# Cron (Vercel 자동 cron 호출 시 Authorization 헤더로 사용)
CRON_SECRET                     openssl rand -hex 32

# Apple IAP
APPLE_ISSUER_ID                 <App Store Connect Issuer ID>
APPLE_KEY_ID                    <Key ID>
APPLE_PRIVATE_KEY               .p8 PEM 내용 (줄바꿈 \n 이스케이프)
APPLE_BUNDLE_ID                 kr.wantsome.app
APPLE_ENVIRONMENT               Production            (Sandbox 가능)
APPLE_ROOT_CAS_PEM              Apple Root CA G3 PEM 한 줄 concat ⚠️ 미설정 시 webhook 503

# Google IAP
GOOGLE_PACKAGE_NAME             kr.wantsome.app
GOOGLE_SERVICE_ACCOUNT_JSON     <service account JSON 한 줄 minified>
GOOGLE_RTDN_AUDIENCE            https://api.wantsome.kr/api/payments/google-rtdn  ⚠️ 미설정 시 webhook 503
GOOGLE_RTDN_SENDER_EMAIL        <service account email>  (옵션, 권고)

# 기타
ACCOUNT_ENCRYPT_KEY             openssl rand -base64 32   ⚠️ 미설정 시 정산계좌 등록 fail
SLACK_WEBHOOK_URL               https://hooks.slack.com/...
PORTONE_API_SECRET              <PortOne 가맹점 발급>      ⚠️ 미설정 시 본인인증 fail
```

⚠️ 굵게 표시된 환경변수는 **fail-closed** — 미설정 시 해당 기능 503/401 반환.

---

### 5. EAS Secret 등록 + Managed Credentials [쉬움 / 20분 / 필수]

```bash
# 클라이언트 환경변수
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value "https://api.wantsome.kr"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>"
eas secret:create --scope project --name EXPO_PUBLIC_AGORA_APP_ID --value "<app id>"
eas secret:create --scope project --name EXPO_PUBLIC_PORTONE_STORE_ID --value "<store id>"
eas secret:create --scope project --name EXPO_PUBLIC_PORTONE_CHANNEL_KEY --value "<channel key>"

# google-services.json EAS Secret File
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json

# Android Managed Credentials (release keystore 자동 생성·관리)
eas credentials --platform android
# → Production 프로필 선택 → "Set up a new keystore" 또는 "Use existing"
# eas.json의 credentialsSource: "remote"가 이미 설정됨 (PR-6)
```

> 굿즈 v1 OFF 유지하려면 `EXPO_PUBLIC_GOODS_ENABLED` 미설정 (기본 false). 활성화 시: `eas secret:create --name EXPO_PUBLIC_GOODS_ENABLED --value true`

---

### 6. eas.json iOS submit 실값 입력 [쉬움 / 5분 / 필수]

[eas.json](../../eas.json) `submit.production.ios` placeholder 교체:
```json
"ios": {
  "appleId": "your-apple-id@email.com",
  "ascAppId": "1234567890",
  "appleTeamId": "XXXXXXXXXX"
}
```

⚠️ **자동 가드 활성화됨**: `npm run eas:check-submit`이 placeholder 검출 시 빌드 실패.
EAS submit 전에 반드시 한 번 실행.

---

### 7. Supabase DB 입력 — system_config + settlement_rate [쉬움 / 15분 / 필수]

**a) 사업자정보·운영 변수** (Supabase Studio → SQL Editor):

```sql
-- 전상법 13조 사업자 정보 (PR-7 K1)
update system_config set value = '주식회사 98점7도'           where key = 'company_name';
update system_config set value = '___-__-_____'                where key = 'business_number';
update system_config set value = '대표자명'                    where key = 'ceo_name';
update system_config set value = '서울시 ...'                  where key = 'business_address';
update system_config set value = '___-____-____'              where key = 'cs_phone';
update system_config set value = 'cs@wantsome.kr'              where key = 'cs_email';
update system_config set value = '제____호'                    where key = 'telecom_sale_number';

-- 청소년보호책임자 (PR-7 K4 — 실명·이메일 필수, placeholder 잔존 시 정통망법 42조의3 위반)
update system_config set value = '<실제 책임자 성명>'           where key = 'youth_protection_officer';
update system_config set value = 'youth@wantsome.kr'           where key = 'youth_protection_email';
update system_config set value = '+82-__-____-____'           where key = 'youth_protection_phone';

-- 운영 변수
update system_config set value = '500'                         where key = 'dm_unlock_points';
```

> 만약 row 자체가 없으면 `INSERT INTO system_config (key, value) VALUES (...)` 사용.

**b) 기존 creator의 settlement_rate를 0.35로 갱신** (PR-8 가격 정책 v1):

```sql
-- DB default는 코드값 0.35 (PR-1.5에서 적용). 기존 row만 일괄 갱신 필요.
update creators set settlement_rate = 0.35 where settlement_rate is distinct from 0.35;
```

---

### 8. Supabase Studio — search_path + Storage 정책 [쉬움 / 10분 / 필수]

PR-2 029 마이그레이션은 repo SQL 정의 함수만 처리. Studio에서 직접 만든 함수는 사용자가:

```sql
-- 1) Studio 생성 함수 시그니처 조회
select proname, pg_get_function_arguments(oid) as args
from pg_proc
where proname in ('handle_new_user','update_creator_avg_rating','live_join_deduct_points')
  and pronamespace = 'public'::regnamespace;

-- 2) 각 함수에 search_path 명시 (위 args 그대로)
ALTER FUNCTION handle_new_user(<args>) SET search_path = public, pg_temp;
ALTER FUNCTION update_creator_avg_rating(<args>) SET search_path = public, pg_temp;
ALTER FUNCTION live_join_deduct_points(<args>) SET search_path = public, pg_temp;
```

**Storage 버킷 listing 비활성** (PR-2 R7): Supabase Studio → Storage → 각 버킷 (`live-thumbnails`, `post-images`, `profiles`) → Policies에서 LIST 권한을 service_role 한정 또는 버킷을 private 변환.

---

### 9. 도메인 + DNS [쉬움 / 30분 / 필수]

- [ ] `api.wantsome.kr` → Vercel Project Domain 등록 + CNAME
- [ ] Vercel 인증서 자동 발급 확인 (HTTPS)
- [ ] Apple Server Notification URL + Google RTDN endpoint URL이 모두 `https://api.wantsome.kr/...`로 일치 확인

---

## 🟠 P1 — PG 심사·법적 의무 (출시 전 ~30일)

### 10. PortOne PG 가맹점 신청 [중간 / ~30일 / 필수]

- [ ] PortOne 가입 (https://portone.io)
- [ ] 사업자등록증 + 서비스 사이트(https://wantsome.kr) 업로드
- [ ] **업종 기재**: "인플루언서 영상통화 + 라이브 콘텐츠 + 인플루언서/원썸 굿즈 판매"
  - ⚠️ "성인 채팅", "19+ 콘텐츠" 키워드 **절대 사용 금지** (위험업종 분류 위험)
- [ ] PG 입점심사 + 카드사 심사 (~2주)
- [ ] **간편결제 채널**: 카카오페이 / 네이버페이 / 토스페이 함께 신청
- [ ] **PASS 본인인증 채널** 함께 신청
- [ ] 가맹점 승인 후:
  - `PORTONE_API_SECRET` → Vercel env
  - `EXPO_PUBLIC_PORTONE_STORE_ID`, `EXPO_PUBLIC_PORTONE_CHANNEL_KEY` → EAS Secret
  - **구매안전서비스 이용확인증** 발급 (PortOne에서)

---

### 11. 통신판매업 신고 (전상법 12조) [쉬움 / 1~3일 / 필수 (굿즈 활성화 후)]

- [ ] 정부24 (gov.kr) 또는 관할 시·군·구청에서 신청
- [ ] 필요 서류: 사업자등록증 + 구매안전서비스 이용확인증 (10번에서 발급)
- [ ] 신고번호 발급 후 system_config `telecom_sale_number`에 입력 (7-a 항목)
- [ ] **굿즈 v1 OFF 상태이면 즉시 신고는 선택**. 그러나 향후 굿즈 활성화 직전엔 필수.

---

### 12. 변호사 자문 — 약관·환불·청보법 [중간 / 1주 / **권장**]

PR-7에서 적용한 약관·개인정보처리방침·청소년보호정책은 audit 인용 조문 기반 자체 검토. 출시 직전 변호사 1회 검토 권장:

- [ ] terms 5조 환불정책의 "결제대행사 수수료 10%" 근거를 "회사 자율 정책" vs "콘진법" 중 명확화
- [ ] 17조 6항 청약철회 제한 표시 강화 — charge 모달 동의 체크박스 문구 검증
- [ ] terms 14조 관할법원 — 약관규제법 14조 해석 OK 확인
- [ ] PortOne 가맹점 약관 vs 회사 환불정책 조항 충돌 여부

---

### 13. App Store / Play Store 메타데이터 + 스크린샷 [중간 / 2~3일 / 필수]

- [ ] 앱 아이콘 1024×1024 (iOS)
- [ ] 스크린샷:
  - iOS: 6.7" / 6.5" / 5.5" (필수) — 홈피드, 크리에이터 프로필, 통화화면, 라이브, 차단 목록
  - Android: 폰 + 7" 태블릿 (선택)
- [ ] 앱 설명 (한국어 4,000자 이내)
- [ ] 키워드 (iOS 100자)
- [ ] **카테고리**: 소셜 네트워킹 또는 엔터테인먼트 (데이팅 카테고리 회피)
- [ ] **17+ 연령 등급 사유**: "이용자 생성 콘텐츠 (UGC)" / "암시적 성인 테마" 정도로 보수적
  - ⚠️ "성인 콘텐츠" 키워드 0건 (PortOne 가맹점 심사·Apple App Review 모두에 영향)
- [ ] 개인정보처리방침 URL: `https://api.wantsome.kr/privacy`
- [ ] 이용약관 URL: `https://api.wantsome.kr/terms`
- [ ] 청소년보호정책 URL: `https://api.wantsome.kr/youth` (PR-7 신설)
- [ ] **Data Safety 폼 (Play Console)**: PR-9 Privacy Manifest와 일치하게 작성 — Email/Phone/UserID/Photos/Audio/Video/Purchase/DeviceID/Diagnostic/Crash/Performance + 제3자 공유: Agora (영상·음성 무저장)

---

### 14. Sentry SDK 설치 (출시 직전 또는 D+7) [중간 / 2~3시간 / 권장]

PR-9에서 Privacy Manifest에 CrashData/PerformanceData 선언만 미리 함. 실제 SDK는 wizard 필요:

```bash
# 클라이언트
npx @sentry/wizard@latest -i reactNative
# → 자동으로 metro.config.js, app.json plugins, sentry.properties 추가

# 서버 (server/ 별도 wizard)
cd server && npx @sentry/wizard@latest -i nextjs

# DSN을 EAS Secret + Vercel env로 등록
EXPO_PUBLIC_SENTRY_DSN     <client DSN>
SENTRY_DSN                 <server DSN>
SENTRY_AUTH_TOKEN          <source map upload용>
```

---

## 🟢 P2 — 출시 후 모니터링 (D-Day 즉시)

### 15. Slack 실시간 알림 채널 [쉬움 / 30분]

운영 알림용 Slack workspace + 채널 + Incoming Webhook URL 발급 → `SLACK_WEBHOOK_URL` env. 자동 전송되는 알림:

- IAP 영수증 검증 거절률 > 5%
- 음수 잔액 발생 (race condition 의심)
- 정산율 정합성 오류 (0.35 외 값 등장)
- 라이브 신고 신규 접수
- 통화 비정상 종료율 > 10%
- Apple/Google webhook 매칭 실패 (`APPLE_REFUND_NO_MATCH`, `GOOGLE_REFUND_NO_MATCH`)

### 16. 일일 KPI 대시보드 [중간 / 1일]

Supabase Studio 또는 Metabase 등으로 매일 오전 회의 시 확인:

- 신규 가입 / DAU / MAU
- 결제 사용자 수 / ARPPU
- 통화 분 / 사용자
- 인플 등록 / 활동률
- Critical 버그·신고 건수

---

## ⏳ v1.1 / v2 Follow-up (출시 후 PR)

PR-8 슬림 결정에 따라 아래 항목은 **v1 출시에서 빠짐**. 데이터 보고 정확히 설계 후 별도 PR:

| 시점 | 항목 | 비고 |
|---|---|---|
| v1.1 (D+14) | 슈퍼메시지 50P UI/API | conversations 테이블 컬럼 추가 + UI |
| v1.1 (D+14) | 굿즈 시범 입점 (`EXPO_PUBLIC_GOODS_ENABLED=true`) | 인플 1~2명 |
| v2 (D+30) | 추천인 시스템 | referrals 테이블 + 보상 cron + UI |
| v2 (D+30) | 인플 등급 자동 승급 | creators.tier + 승급 cron + 차등 정산율 |
| v2 (D+60) | VIP 구독 (월 ₩9,900) | 정기결제 SDK + 구독 처리 |

---

## ⏳ Defer — 검수 follow-up (사용자 결정 필요)

| 출처 | 항목 | 영향 | 권장 처리 시점 |
|---|---|---|---|
| PR-1.5 | Apple `SignedDataVerifier` 일관 적용 (verify-iap) | 방어 깊이 +1 | v1.1 |
| PR-1.5 | OCSP cache (apple-notification verifier 인스턴스) | 트래픽 시 latency 개선 | v1.1 |
| PR-1.5 | `GOOGLE_RTDN_SENDER_EMAIL` 강제화 (env 미설정 → 503) | 보안 +1 | v1.1 |
| PR-9 | Agora token 딥링크 파라미터 제거 (`call/[sessionId]`) | call flow refactor | v1.1 |
| PR-9 | account.tsx에 usePreventScreenCapture (계좌번호 PII) | 보안 +1 | v1.1 |

---

## 진행 체크리스트 요약

### Week -2 ~ -1 (외부 작업 시작)
- [ ] Google Play Console 가입 ($25)
- [ ] Firebase 프로젝트 + google-services.json
- [ ] Apple App Store Connect 신규 앱 등록 + IAP 6개 등록
- [ ] PortOne 가맹점 신청 (가장 오래 걸림 — ~2주)
- [ ] 변호사 자문 의뢰

### Week 0 (코드 외 마무리)
- [ ] Vercel 환경변수 모두 등록 (#4)
- [ ] EAS Secret + Managed Credentials (#5)
- [ ] eas.json iOS placeholder 교체 + `npm run eas:check-submit` 통과 (#6)
- [ ] Supabase DB 입력 (#7) + Studio 함수 search_path (#8)
- [ ] 도메인 CNAME (#9)
- [ ] 메타데이터·스크린샷 (#13)

### D-1 (최종 점검)
- [ ] [41-qa-plan.md](41-qa-plan.md) D-1 체크리스트 전체 OK 확인
- [ ] EAS production build → TestFlight + Play Internal 내부 테스트 1회
- [ ] Slack 알림 1차 발송 확인 (#15)
- [ ] PG 승인 확인 + 구매안전서비스 이용확인증 보관

### D-Day
- [ ] App Store / Play Store 제출
- [ ] 심사 대응 (Apple ~24h, Google ~3d)
- [ ] 출시 직후 1시간 결제·통화·라이브 1회씩 manual smoke test

### D+7 (선택)
- [ ] Sentry SDK 설치 (#14)
- [ ] 첫 정산 cron 결과 확인 (월 1회)
- [ ] v1.1 follow-up PR 시작 (슈퍼메시지·Agora 딥링크 제거 등)
