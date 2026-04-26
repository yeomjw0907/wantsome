# 사용자 직접 작업 TODO — 출시 전

> 작성: 2026-04-26
> 본 문서는 **코드 외부에서 사용자가 직접 진행해야 할 모든 작업**을 모은 체크리스트입니다.
> 각 항목 옆에 [난이도/예상시간/필수여부]가 명시되어 있습니다.

---

## 🔴 PR-1 머지 직후 즉시 (출시 차단 위험)

### 1. CRON_SECRET 생성 + Vercel 환경변수 등록 [쉬움 / 3분 / **필수**]
Vercel cron이 server API 호출 시 Authorization 헤더로 사용.

**작업**:
1. 값 생성: `openssl rand -hex 32` (또는 임의 long string)
2. Vercel Dashboard → Project → Settings → Environment Variables → `CRON_SECRET` 등록
3. (옵션) Supabase Vault에도 동일 값 — pg_cron 사용 시에만 필요. **Vercel cron 사용 시 불필요**

> 📌 **Vercel Pro 사용 결정 (2026-04-26)**: pg_cron 마이그레이션은 보존되지만 활성화하지 않음. Vercel cron 사용.

---

### 2. ~~pg_cron Job 등록~~ [Vercel cron 사용 시 SKIP]
PR-2 commit 7에서 `server/vercel.json`에 cron 7개 정의 복원.
**별도 작업 없음** — Vercel 배포 시 자동 등록·실행.

(참고) pg_cron으로 다시 가려면 [024 마이그레이션 SQL](../../server/supabase/migrations/024_pg_cron_http_setup.sql) + [Vault setup](#) 활성화.

---

### 3. Apple Developer + ASC 설정 [중간 / 1~2일 / **필수**]
- [ ] Apple Developer Program 가입 ($99/년) — https://developer.apple.com
- [ ] App Store Connect → 새 앱 등록
  - Name: `wantsome - 원썸`
  - Bundle ID: `kr.wantsome.app`
  - SKU: `wantsome-kr`
  - Primary Language: 한국어
- [ ] **API Key 생성** (Users and Access → Integrations → API Keys → Generate)
  - Access: App Manager (또는 더 좁은 권한)
  - Key ID 복사 → `APPLE_KEY_ID`
  - Issuer ID 복사 → `APPLE_ISSUER_ID`
  - **.p8 파일 다운 (한 번만 가능)** → 내용 전체를 `APPLE_PRIVATE_KEY` 에 (줄바꿈 \n 이스케이프)
- [ ] **APNs Key 생성** (Certificates → Keys → +)
  - Push Notifications 체크
  - .p8 다운 → Supabase Dashboard → Auth → URL Configuration → Apple 또는 Expo 푸시 서비스에 등록
- [ ] **Sign in with Apple** 활성화 (Identifiers → App ID → Capabilities)
- [ ] **인앱구매 6개 신규 등록** (storeId: `kr.wantsome.app.point_5500` ~ `point_200000`)
  - 가격 + 표시명·설명: [docs/app-store-iap-copy.md](../../docs/app-store-iap-copy.md) 참조 (단 stale, PR-8에서 갱신 예정)

---

### 4. Apple Root CA 다운로드 + PEM 변환 [쉬움 / 5분 / **필수**]
Apple Server Notification V2 webhook 서명 검증용.

1. https://www.apple.com/certificateauthority/ 접속
2. **Apple Root CA - G3 Root** 다운 (.cer 파일)
3. PEM 변환:
   ```bash
   openssl x509 -in AppleRootCA-G3.cer -inform DER -out AppleRootCA-G3.pem
   ```
4. 추가 root CA도 필요 시 같은 방식으로
5. 모든 PEM 내용을 한 줄로 concat 후 `APPLE_ROOT_CAS_PEM` 환경변수에 저장
   ```
   -----BEGIN CERTIFICATE-----
   MIIC...
   -----END CERTIFICATE-----
   -----BEGIN CERTIFICATE-----
   MIIC...
   -----END CERTIFICATE-----
   ```

---

### 5. Google Cloud + Play Console + Firebase [중간 / 1~2일 / **필수**]
- [ ] Google Play Console 가입 ($25 1회) — https://play.google.com/console
- [ ] 앱 등록 — Package: `kr.wantsome.app`
- [ ] **Firebase 프로젝트 생성** → `google-services.json` 다운
  - 현재 [google-services.json](../../google-services.json)은 placeholder
  - EAS Secret File로 주입 (또는 직접 교체)
- [ ] **Service Account 생성** (Google Cloud Console → IAM → Service Accounts)
  - JSON Key 다운 → 내용 전체를 한 줄로 minify → `GOOGLE_SERVICE_ACCOUNT_JSON`
- [ ] Play Console → API access → 위 service account 연결
  - 권한: View financial data + Manage orders and subscriptions
- [ ] **인앱구매 6개 등록** (Apple과 동일 storeId, 동일 가격)
- [ ] **Pub/Sub topic 생성** (예: `wantsome-rtdn`)
- [ ] **Pub/Sub push subscription 생성**
  - Endpoint URL: `https://api.wantsome.kr/api/payments/google-rtdn`
  - Authentication: OIDC token + Service account
  - Audience: 위 Endpoint URL
  - 그 audience 값을 `GOOGLE_RTDN_AUDIENCE` 환경변수에 저장
  - service account email을 `GOOGLE_RTDN_SENDER_EMAIL`에 (옵션, 추가 보안)
- [ ] Play Console → Monetize setup → RTDN 에 Pub/Sub topic 등록

---

### 6. App Store Server Notification V2 URL 등록 [쉬움 / 5분 / **필수**]
- [ ] App Store Connect → 앱 정보 → "App Store Server Notifications V2"
- [ ] Production URL: `https://api.wantsome.kr/api/payments/apple-notification`
- [ ] (선택) Sandbox URL: 동일 (또는 별도 테스트 환경)
- [ ] Apple Bundle ID 확인: `kr.wantsome.app` → `APPLE_BUNDLE_ID`
- [ ] Environment 결정: `Production` 또는 `Sandbox` → `APPLE_ENVIRONMENT`

---

### 7. Vercel 환경변수 등록 [쉬움 / 15분 / **필수**]
Vercel Dashboard → Project → Settings → Environment Variables 에 추가:

```
# Supabase
SUPABASE_URL                    (Supabase project URL)
SUPABASE_SERVICE_ROLE_KEY       (service role key)

# Agora
AGORA_APP_ID
AGORA_APP_CERTIFICATE

# Cron
CRON_SECRET                     (위 1번에서 생성한 값)

# Apple IAP
APPLE_ISSUER_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY               (.p8 PEM, 줄바꿈 \n 이스케이프)
APPLE_BUNDLE_ID                 = kr.wantsome.app
APPLE_ENVIRONMENT               = Production
APPLE_ROOT_CAS_PEM              (Apple Root CA G3 PEM, 위 4번)

# Google IAP
GOOGLE_PACKAGE_NAME             = kr.wantsome.app
GOOGLE_SERVICE_ACCOUNT_JSON     (서비스 계정 JSON 한 줄)
GOOGLE_RTDN_AUDIENCE            (Pub/Sub audience URL)
GOOGLE_RTDN_SENDER_EMAIL        (옵션 — service account email)

# 기타
ACCOUNT_ENCRYPT_KEY             (32-byte base64 — openssl rand -base64 32)
SLACK_WEBHOOK_URL               (정산 알림용)
```

**전 환경**: Production / Preview / Development 모두에 동일 값 (또는 development는 Sandbox로).

---

### 8. EAS Secret 등록 [쉬움 / 10분 / **필수**]
클라이언트 환경변수.

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value "https://api.wantsome.kr"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_AGORA_APP_ID --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_PORTONE_STORE_ID --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_PORTONE_CHANNEL_KEY --value "..."

# google-services.json (Android Firebase)
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

---

### 9. eas.json iOS submit 설정 [쉬움 / 5분 / **필수**]
[eas.json](../../eas.json) 의 `submit.production.ios` 에 입력:
```json
"ios": {
  "appleId": "your-apple-id@email.com",
  "ascAppId": "1234567890",
  "appleTeamId": "XXXXXXXXXX"
}
```

---

### 10. 도메인 + DNS [쉬움 / 30분 / **필수**]
- [ ] `api.wantsome.kr` → Vercel CNAME 연결
- [ ] Vercel 인증서 자동 발급 확인 (HTTPS)
- [ ] Apple Root CA + Google RTDN URL이 모두 `https://api.wantsome.kr/...`로 일치하는지

---

## 🟠 PR-1 외 — PG 심사 / 사업자

### 11. 사업자등록 (법인) [중간 / 1~2주 / **필수**]
- [ ] 법인 등기 (주식회사 98점7도) — 법무사 의뢰 또는 직접
- [ ] 사업자등록 — 홈택스(hometax.go.kr)
  - 업종: 인플루언서 영상통화·라이브 콘텐츠·굿즈 판매 (정확한 코드는 세무사 자문)
- [ ] 통장 개설
- [ ] 사업자등록증 PDF 확보

---

### 12. PortOne PG 가맹점 신청 [중간 / 약 30일 / **필수**]
- [ ] PortOne 가입 (https://portone.io)
- [ ] 사업자등록증 + 서비스 사이트(https://wantsome.kr) 업로드
- [ ] 업종 기재: **"인플루언서 영상통화 + 라이브 콘텐츠 + 인플루언서/원썸 굿즈 판매"**
  - ⚠️ "성인 채팅" 키워드 절대 사용 금지 (위험업종 분류 위험)
- [ ] PG 입점심사 + 카드사 심사 (총 ~2주)
- [ ] **간편결제 채널** 함께 신청: 카카오페이 / 네이버페이 / 토스페이
- [ ] **PASS 본인인증 채널** 함께 신청
- [ ] 가맹점 승인 후:
  - PORTONE_API_SECRET → Vercel 환경변수
  - EXPO_PUBLIC_PORTONE_STORE_ID, EXPO_PUBLIC_PORTONE_CHANNEL_KEY → EAS Secret
  - **구매안전서비스 이용확인증** 발급 (PortOne에서)

---

### 13. 통신판매업 신고 [쉬움 / 1~3일 / **필수** (굿즈 판매 시)]
- [ ] 정부24 (gov.kr) 또는 관할 시·군·구청에서 신청
- [ ] 필요 서류:
  - 사업자등록증
  - 구매안전서비스 이용확인증 (위 12번)
- [ ] 신고번호 발급 후 [server/app/page.tsx](../../server/app/page.tsx) system_config 에 입력
  - business_number, ceo_name, address, ecommerce_registration_no, contact_phone, contact_email

---

## 🟢 PR-1 머지 후 — 권장 작업

### 14. system_config 데이터 입력 [쉬움 / 10분]
사업자 정보 + 운영 변수를 Supabase Studio에서 INSERT/UPDATE:

```sql
-- 사업자 정보 (PR-7 한국 법규에서 요구)
update system_config set value = '주식회사 98점7도' where key = 'company_name';
update system_config set value = '___-__-_____' where key = 'business_registration_number';
update system_config set value = '대표자명' where key = 'ceo_name';
update system_config set value = '___-____-____' where key = 'cs_phone';
update system_config set value = 'cs@wantsome.kr' where key = 'cs_email';
update system_config set value = '제____호' where key = 'ecommerce_registration_number';
update system_config set value = '서울시 ...' where key = 'company_address';

-- 운영 변수
update system_config set value = '500' where key = 'dm_unlock_points';
-- LIVE_ENTRY_FEE_POINTS는 server/lib/live.ts:3 에 하드코드 (PR-4에서 정책 반영 예정)
```

---

### 15. App Store / Play Store 메타데이터 + 스크린샷 [중간 / 2~3일]
- [ ] 앱 아이콘 1024x1024 (iOS)
- [ ] 스크린샷 (iOS 6.7" / 6.5" / 5.5", Android 폰/태블릿)
  - 홈피드, 크리에이터 프로필, 통화화면, 라이브, 굿즈 등 최소 3장
- [ ] 앱 설명 (한국어 4,000자 이내)
- [ ] 키워드 (iOS 100자)
- [ ] 카테고리: **소셜 네트워킹** 또는 **엔터테인먼트** (데이팅 카테고리 회피)
- [ ] **17+ 사유**: "이용자 생성 콘텐츠" / "암시적 성인 테마" 정도로 보수적 신고
  - "성인 콘텐츠" 키워드 0
- [ ] 개인정보처리방침 URL: `https://api.wantsome.kr/privacy`
- [ ] 이용약관 URL: `https://api.wantsome.kr/terms`

---

### 17. Supabase Studio에서 만든 함수의 search_path 설정 [쉬움 / 5분]
PR-2 029 마이그레이션은 repo에 SQL 정의가 있는 함수만 처리.
Supabase Studio에서 직접 생성된 함수는 시그니처를 모르므로 사용자가 직접:

Studio → SQL Editor 에서 시그니처 조회:
```sql
select proname, pg_get_function_arguments(oid) as args
from pg_proc
where proname in ('handle_new_user', 'update_creator_avg_rating', 'live_join_deduct_points')
  and pronamespace = 'public'::regnamespace;
```

각 함수에 대해 search_path 명시:
```sql
ALTER FUNCTION handle_new_user(<위에서 본 args>) SET search_path = public, pg_temp;
ALTER FUNCTION update_creator_avg_rating(<args>) SET search_path = public, pg_temp;
ALTER FUNCTION live_join_deduct_points(<args>) SET search_path = public, pg_temp;
```

검증: Phase 10 advisor 재실행해서 'function_search_path_mutable' 0건 확인.

### 18. Storage 버킷 listing 비활성 [쉬움 / 10분]
Phase 10 advisor의 'public_bucket_allows_listing' 3건 fix.
대상 버킷: `live-thumbnails`, `post-images`, `profiles`

Supabase Studio → Storage → 각 버킷 → Policies:
- 기존 정책 (예: "live_thumbnails_public_read") 유지하되
- LIST 권한은 service_role만 가능하도록 정책 수정
  또는 버킷을 private으로 변경 + signed URL 사용

권장: 단순 fix는 버킷 자체를 private으로 변경 후 클라가 signed URL 사용.
영향 범위가 클 경우 별도 PR로 처리.

### 19. PR-3 ~ PR-9 진행 [큰 작업]
PR-1·PR-2만으로는 출시 불가. 다음 PR들도 처리 필요:
- ~~[PR-2 RLS·DB 보안](99-action-plan.md#pr-2-rls-전면-정비-critical-r1r8)~~ — DONE (R1·R2·R3·R5 + RPC search_path)
- [PR-3 인증·본인인증](99-action-plan.md#pr-3-인증본인인증-critical-a1a4) — verify-identity 백도어 제거
- [PR-4 라이브룸 보안](99-action-plan.md#pr-4-라이브룸-보안-critical-l1l4--i3--live-high) — Agora 채널·신고
- [PR-5 iOS](99-action-plan.md#pr-5-ios-compliance-critical-i1-i2-i4) — Privacy Manifest 등
- [PR-6 Android](99-action-plan.md#pr-6-android-compliance-critical-n1-n2-n3) — Foreground Service 등
- [PR-7 한국 법규](99-action-plan.md#pr-7-한국-법규-critical-k1k5)
- [PR-8 가격 정책](99-action-plan.md#pr-8-가격-정책-코드-반영-확정-정책)
- [PR-9 클라이언트](99-action-plan.md#pr-9-클라이언트-보안정리-high-c1c4--정리)

---

## 📋 진행 체크리스트 (요약)

### Week 1 (PR-1 머지 직후)
- [ ] CRON_SECRET 생성 + Vercel 환경변수 (Vault는 옵션)
- [ ] ~~pg_cron job 7개 등록~~ → Vercel cron 자동 (PR-2 c7)
- [ ] Apple Developer 가입 + API Key + APNs Key
- [ ] Google Play Console + Firebase + Pub/Sub
- [ ] Apple Root CA 다운 + PEM 변환
- [ ] Vercel + EAS 환경변수 모두 등록
- [ ] eas.json 갱신
- [ ] 도메인 CNAME

### Week 2 (병렬)
- [ ] 사업자등록 시작 (없으면)
- [ ] PortOne 가맹점 신청
- [ ] system_config 데이터 입력
- [ ] PR-2 ~ PR-4 진행

### Week 3
- [ ] PR-5 ~ PR-9 진행
- [ ] PG 심사 진행 모니터링
- [ ] 통신판매업 신고
- [ ] 메타데이터·스크린샷

### Week 4
- [ ] PG 승인 확인
- [ ] EAS production build → 내부 테스트
- [ ] App Store / Play Store 제출
- [ ] 출시 + 모니터링
