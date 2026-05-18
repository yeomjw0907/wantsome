# 🚀 오늘의 출시 외부 등록 워크스루

> 작성일: 2026-05-18  
> 출발 조건: 사업자등록증 ✅ / Apple Developer Program ✅ / Google Play Console ✅  
> 오늘 목표: **App Store Connect + Play Console 신규 앱 등록 + IAP 6개 + Firebase/Pub-Sub + PortOne PG 신청 접수**  
> ⚠️ PortOne PG 실제 승인은 ~30일 소요 — 오늘은 **접수 완료**가 목표

---

## 진행 순서 (병렬 가능)

```
[직렬]
  단계 1. App Store Connect 새 앱 등록 ────┐
  단계 2. Apple API Key + APNs Key        │
  단계 3. Firebase 프로젝트 + JSON 다운  ──┼─→ [코드측] eas.json / google-services.json 교체
  단계 4. Google Cloud Service Acct + Pub/Sub
  단계 5. Play Console 새 앱 + IAP + RTDN 연결
  단계 6. PortOne 가맹점 신청 접수
```

| 단계 | 예상 소요 | 비고 |
|---|---|---|
| 1. App Store Connect | 30~45분 | 가장 입력 많음 |
| 2. Apple Keys | 20분 | 결과 .p8 파일 잘 보관 |
| 3. Firebase | 15~20분 | google-services.json 다운로드 |
| 4. Google Cloud | 30~45분 | Pub/Sub Topic + Subscription |
| 5. Play Console | 30~45분 | RTDN topic 입력 시 단계 4 결과 사용 |
| 6. PortOne 접수 | 20~30분 | 사업자등록증 PDF + 사이트 URL |
| **합계** | **3~4시간** | 점심 포함 반나절 |

---

## 단계 1. App Store Connect — 새 앱 등록

🔗 https://appstoreconnect.apple.com/apps → **+ → New App**

### 1-A. 앱 생성 폼

| 항목 | 입력값 |
|---|---|
| Platforms | **iOS** ✓ |
| Name | `wantsome` |
| Primary Language | **Korean** |
| Bundle ID | `kr.wantsome.app` (드롭다운에서 선택) |
| SKU | `wantsome-kr-v1` |
| User Access | **Full Access** |

> Bundle ID가 드롭다운에 안 보이면 [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list)에서 먼저 `kr.wantsome.app` 등록. 기존 Sign in with Apple 작업으로 이미 등록되어 있을 가능성 높음.

### 1-B. App Information

- **Subtitle (선택)**: `크리에이터와의 1:1 프리미엄 영상통화` (30자 이내)
- **Category**:
  - Primary: **Entertainment**
  - Secondary: **Social Networking**
- **Content Rights**: "Does your app contain ... third-party content?" → **No** (자체 콘텐츠) 또는 "Yes" + 권리 확보 명시

### 1-C. ⚠️ Age Rating (재정의)

`docs/setup/06_store-submission.md`의 기존 "Sexual: Frequent/Intense" 안내는 폐기. 컨셉 문서와 충돌하므로 아래로 진행:

| 질문 | 선택 |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | **None** |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | **Infrequent/Mild** |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use | None |
| Gambling | None |
| User-Generated Content | **Yes** |

→ 결과: **17+** (UGC 사유)

### 1-D. App Privacy

`https://api.wantsome.kr/privacy` URL 입력. Privacy Nutrition Label은 다음 데이터 유형 체크:

| 항목 | Linked | Tracking |
|---|---|---|
| Name | ✅ | ❌ |
| Email Address | ✅ | ❌ |
| Phone Number | ✅ | ❌ |
| User ID | ✅ | ❌ |
| Purchase History | ✅ | ❌ |
| Photos or Videos | ✅ | ❌ |
| Audio Data | ✅ | ❌ |
| Video Data | ✅ | ❌ |
| Device ID | ✅ | ❌ |
| Crash Data | ❌ (Not Linked) | ❌ |
| Performance Data | ❌ | ❌ |
| Other Diagnostic Data | ❌ | ❌ |

(`app.json` `NSPrivacyCollectedDataTypes`와 정합)

### 1-E. IAP 6개 등록

**Features → In-App Purchases → +** → 각 항목 **Consumable** 으로 6개 생성.

| Product ID | Reference Name | Price Tier (KRW) | 화면 표시 |
|---|---|---:|---|
| `kr.wantsome.app.point_4000`   | 체험권 4000P     | ₩6,600   | 체험권 🌱 |
| `kr.wantsome.app.point_6600`   | 스몰 6600P       | ₩9,900   | 스몰 ☕ |
| `kr.wantsome.app.point_18600`  | 미디엄 18600P    | ₩27,500  | 미디엄 🎯 |
| `kr.wantsome.app.point_32000`  | 라지 32000P      | ₩46,200  | 라지 🔥 |
| `kr.wantsome.app.point_60000`  | 프리미엄 60000P  | ₩85,800  | 프리미엄 💎 |
| `kr.wantsome.app.point_100000` | VIP 100000P      | ₩143,000 | VIP 👑 |

**Localizations** — Korean 추가 후 `docs/app-store-iap-copy.md`의 표시 이름/설명 그대로 복붙.

**Review Information**:
```
앱 내 '포인트 충전' 화면(하단 탭 또는 마이페이지)에서 본 상품을 선택하면 인앱 결제 플로우가 시작됩니다.
포인트는 크리에이터와의 영상통화·라이브 입장료·선물 등 앱 내 유료 기능에 사용되는 가상 재화입니다.
구매 직전 모달에서 환불·청약철회 제한 안내(전자상거래법 17조 2항 5호)에 별도 동의를 받습니다.
미사용 포인트는 7일 이내 100% 환불 가능합니다.

심사용 계정: App Review 정보에 별도 기재.
```

### 체크
- [ ] 새 앱 생성 완료 → **ASC App ID 확보** (URL의 숫자 ID, 예: `6470000000`)
- [ ] Apple Team ID 메모 (developer.apple.com → Membership)
- [ ] Apple ID 이메일 (App Store Connect 로그인 계정)
- [ ] IAP 6개 모두 "Ready to Submit" 상태
- [ ] Age Rating 17+ 결과 확인

---

## 단계 2. Apple Keys + Server Notification URL

### 2-A. App Store Server API Key (영수증 검증용)

🔗 https://appstoreconnect.apple.com/access/integrations/api → **App Store Connect API**

- **Active Keys → Generate API Key** (App Manager 권한)
- Key Name: `wantsome-iap-verify`
- Access: **App Manager**
- 다운로드: **`.p8` 파일** (한 번만 다운로드 가능, 잘 보관)
- 메모할 값:
  - `APPLE_ISSUER_ID` (페이지 상단)
  - `APPLE_KEY_ID` (생성된 키 옆)

### 2-B. APNs Key

🔗 https://developer.apple.com/account/resources/authkeys/list → **+** (Keys)

- Key Name: `wantsome-apns`
- Capabilities: **Apple Push Notifications service (APNs)** ✓
- 다운로드 `.p8` (별도 — IAP 키와 다른 파일)
- **Expo Credentials에 업로드**: https://expo.dev/accounts/yeomjungwon/projects/wantsome/credentials
  - iOS → Push Key → Upload existing key

### 2-C. App Store Server Notification V2 URL 등록

ASC → 앱 → **App Information → App Store Server Notifications**:
- Production Server URL: `https://api.wantsome.kr/api/payments/apple-notification`
- Sandbox Server URL: 동일
- Version: **Version 2**

### 2-D. Sign in with Apple Capability (이미 완료된 듯)

ASC → 앱 → **App Information** → **Sign in with Apple** Enable 확인.

### 2-E. Apple Root CA G3 다운로드

`https://www.apple.com/certificateauthority/` → AppleRootCA-G3 (`.cer`) 다운.

로컬에서 PEM 변환:
```bash
openssl x509 -in AppleRootCA-G3.cer -inform DER -out AppleRootCA-G3.pem
cat AppleRootCA-G3.pem | awk '{printf "%s\\n", $0}' > AppleRootCA-G3.escaped.txt
```
escaped 내용을 Vercel env `APPLE_ROOT_CAS_PEM`에 붙여넣기.

### 체크
- [ ] `wantsome-iap-verify.p8` 다운로드 + 안전한 경로 보관 (1Password 등)
- [ ] `APPLE_ISSUER_ID`, `APPLE_KEY_ID` 메모
- [ ] APNs `.p8` → Expo Credentials 업로드 완료
- [ ] ASSN V2 URL 등록 완료
- [ ] AppleRootCA-G3.pem 확보

---

## 단계 3. Firebase 프로젝트 + google-services.json

🔗 https://console.firebase.google.com → **프로젝트 만들기**

### 3-A. 프로젝트 생성
- 프로젝트 이름: `wantsome` (또는 `98dot7do`)
- Google Analytics: **사용** (선택, 데이터로케이션 KR)

### 3-B. Android 앱 추가
- 패키지 이름: **`kr.wantsome.app`**
- 닉네임: `wantsome Android`
- SHA-1: (지금은 비워두고 EAS Managed Credentials 잡힌 후 추가 가능)

→ **`google-services.json` 다운로드** → Repo 루트의 `google-services.json` 교체

> 권장 흐름 (EAS Secret File):
> ```bash
> # 다운받은 파일 작업 폴더로 이동
> mv ~/Downloads/google-services.json ./google-services.json
> 
> # 검증
> npm run android:check-firebase  # placeholder 잡히면 통과
> 
> # EAS Secret으로 업로드 (커밋 대신 권장)
> eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
>   --type file --value ./google-services.json
> ```

### 3-C. (선택) Cloud Messaging 활성화
- 콘솔 → 톱니바퀴 → 프로젝트 설정 → Cloud Messaging 탭 → APNs 인증 키 업로드 (단계 2-B의 .p8)

### 체크
- [ ] Firebase 프로젝트 생성 완료
- [ ] Android 앱 `kr.wantsome.app` 추가
- [ ] `google-services.json` 다운로드 + 루트 교체
- [ ] EAS Secret `GOOGLE_SERVICES_JSON` 등록 (권장)

---

## 단계 4. Google Cloud — Service Account + Pub/Sub RTDN

🔗 https://console.cloud.google.com → 단계 3에서 만든 Firebase 프로젝트 선택

### 4-A. Service Account 생성
- IAM & Admin → Service Accounts → **+ Create**
- Name: `wantsome-play-billing`
- Role: **Pub/Sub Publisher** + (Play Console 측에서 별도 권한 부여)
- → 생성된 SA → **Keys → Add Key → JSON** → 다운로드

### 4-B. JSON Key를 한 줄 minified로 변환

```bash
# 다운로드한 JSON
node -e "console.log(JSON.stringify(require('./wantsome-play-billing-XXXX.json')))" \
  | tee google-service-account-min.json
```

→ 이 한 줄 문자열을 Vercel env `GOOGLE_SERVICE_ACCOUNT_JSON` 에 통째로 입력.

> ⚠️ JSON 파일을 git에 커밋 금지. `.gitignore`에 `google-service-account*.json` 추가 권고.

### 4-C. EAS submit 용 파일 배치
`eas.json submit.production.android.serviceAccountKeyPath = "./google-service-account.json"` 이미 설정됨. JSON 키 원본 파일을 **`./google-service-account.json`** 이름으로 루트에 두면 됨 (git 무시 필수).

### 4-D. Pub/Sub Topic + Subscription

- Pub/Sub → **Topics → Create** → Name: `wantsome-rtdn`
- → Topic 클릭 → **Subscriptions → Create** 
  - Name: `wantsome-rtdn-sub`
  - Delivery type: **Push**
  - Endpoint URL: `https://api.wantsome.kr/api/payments/google-rtdn`
  - Enable authentication: **OIDC token** + Service account: `wantsome-play-billing`
  - Audience: `https://api.wantsome.kr/api/payments/google-rtdn`

→ Vercel env에 `GOOGLE_RTDN_AUDIENCE` = 동일 URL 입력.

### 4-E. Topic Publisher 권한 부여
Topic → Permissions → Add → `google-play-developer-notifications@system.gserviceaccount.com` → **Pub/Sub Publisher**

### 체크
- [ ] Service Account `wantsome-play-billing` 생성 + JSON Key 다운
- [ ] JSON minified → Vercel env `GOOGLE_SERVICE_ACCOUNT_JSON`
- [ ] 원본 JSON → 루트 `google-service-account.json` (gitignore)
- [ ] Pub/Sub Topic `wantsome-rtdn` 생성
- [ ] Push Subscription 생성 + OIDC token 설정
- [ ] Google 시스템 SA에 Publisher 권한 부여

---

## 단계 5. Google Play Console — 새 앱 등록

🔗 https://play.google.com/console → **앱 만들기**

### 5-A. 앱 만들기
- 앱 이름: `wantsome`
- 기본 언어: **한국어 (대한민국)**
- 앱 또는 게임: **앱**
- 무료/유료: **무료**
- 선언: 모두 체크

### 5-B. 패키지 등록 (App Bundle 첫 업로드 후 활성화)
- Bundle 패키지 이름: `kr.wantsome.app` (첫 .aab 업로드 시 자동 매핑)

### 5-C. 인앱 상품 6개 등록

**Monetize → Products → In-app products → Create product**

storeId / 이름 / 가격은 단계 1-E와 동일. 상품 유형 **Managed product (Consumable)**.

- 가격 입력 후 **Set price for other countries** → 한국 ₩가격 기준 자동 환산 또는 KR만 활성화.
- 각 상품 **Activate** 처리.

### 5-D. RTDN 연결

**Monetize setup** → **Real-time developer notifications** → Topic name 입력:
```
projects/<GCP-PROJECT-ID>/topics/wantsome-rtdn
```
**Send test notification** 클릭하여 `/api/payments/google-rtdn` 200 응답 확인.

### 5-E. API access (Service Account 연결)

**Setup → API access** → 단계 4-A에서 만든 service account 보임 → **Grant access**:
- Permissions: **View financial data** + **Manage orders and subscriptions**

### 5-F. App content (Data Safety / 등급)

`docs/setup/06_store-submission.md` 의 Step G-1 참고. **Adults only 18+, "성인 콘텐츠" 키워드 회피, UGC + 17+ 동일 사유로**:

- Privacy policy URL: `https://api.wantsome.kr/privacy`
- App access: 로그인 필요 → 심사 계정 정보 입력 (소비자/크리에이터 2개)
- Ads: No
- Content rating 설문 (IARC):
  - User-generated content: Yes
  - 성적 콘텐츠: **없음** (단계 1-C와 일관)
- Target audience: 18+ Only
- Data safety 폼: app.json 매니페스트와 일관되게 작성

### 체크
- [ ] Play Console 신규 앱 생성
- [ ] IAP 6개 등록 + Active
- [ ] RTDN topic 연결 + 테스트 알림 200 응답
- [ ] Service Account 권한 부여 완료
- [ ] App content 모든 섹션 ✓

---

## 단계 6. PortOne PG 가맹점 신청 접수

🔗 https://portone.io → **가입 → 가맹점 신청**

### 6-A. 필수 자료 준비
- 사업자등록증 PDF ✅ (이미 발급)
- 서비스 사이트 URL: `https://wantsome.kr` (또는 `https://api.wantsome.kr`)
- 앱 스토어 진행 상황 (스크린샷 또는 ASC URL — 단계 1 결과)
- 회사 인감/직인 (필요 시)

### 6-B. ⚠️ 업종 기재 (위험업종 분류 회피)

**아래 문구를 그대로 사용. "성인", "19+", "adult" 키워드 절대 사용 금지.**

```
[업종]
디지털 콘텐츠 — 인플루언서/크리에이터와 팬 간 1:1 영상통화 서비스 및 라이브 콘텐츠 플랫폼

[부가 업종]
인플루언서 자체 제작 굿즈 판매 (의류, 액세서리, 디지털 굿즈 등)

[서비스 개요]
- 크리에이터(인플루언서)와 팬이 앱 내에서 사전 예약 또는 즉시 매칭으로 영상통화
- 라이브 방송 시청 및 후원 (포인트 기반)
- 크리에이터 굿즈 마켓플레이스
- 만 17세 이상 사용자 대상 (UGC 정책 기반)
```

### 6-C. 결제 채널 신청

함께 신청:
- 카드 (PG)
- **카카오페이**
- **네이버페이**
- **토스페이**
- **PASS 본인인증** (개인정보보호법 만 19세 본인인증용)

### 6-D. 환불 정책 첨부

`server/app/terms/page.tsx` 의 환불 조항 또는 `docs/legal/01_terms.md` 5조 환불정책 그대로 첨부.

### 6-E. 신청 후 트래킹
- 신청 접수 → 카드사 심사 → PG 입점 심사 → 가맹점 코드 발급 (총 ~2~4주)
- 결과 발급 시: `PORTONE_API_SECRET`, `EXPO_PUBLIC_PORTONE_STORE_ID`, `EXPO_PUBLIC_PORTONE_CHANNEL_KEY` 확보
- **구매안전서비스 이용확인증** 발급 — 통신판매업 신고에 필요

### 체크
- [ ] PortOne 회원가입
- [ ] 가맹점 신청서 제출 (업종 위 문구 그대로)
- [ ] 카드/카카오/네이버/토스/PASS 채널 함께 신청
- [ ] 신청 접수 확인 이메일 수신

---

## 부록 A. 메타데이터 (앱 설명)

### 한국어 (Subtitle/Promotional Text/Description)

**Subtitle (30자):**
```
크리에이터와의 1:1 프리미엄 영상통화
```

**Promotional Text (170자):**
```
인플루언서·크리에이터와 1:1 영상통화로 가까워지세요. 라이브 시청·후원, 굿즈 마켓까지 한 곳에서. 안전한 모더레이션과 신고 시스템으로 더 즐거운 경험.
```

**Description (4000자 이내):**
```
원썸(wantsome)은 인플루언서·크리에이터와 팬을 1:1 영상통화로 연결하는 프리미엄 콘텐츠 플랫폼입니다.

[주요 기능]
• 1:1 영상통화 — 좋아하는 크리에이터와 직접 통화하며 소통
• 라이브 시청 & 후원 — 실시간 라이브에서 댓글·선물로 참여
• 예약 시스템 — 원하는 시간에 크리에이터 미리 예약
• 굿즈 마켓 — 인플루언서의 자체 제작 굿즈 구매 (단계적 오픈)
• 포인트 충전 — 간편한 인앱 결제

[안전한 서비스]
• 본인인증 (PASS) — 만 17세 이상 본인 확인
• 신고 시스템 — 부적절한 행동 즉시 신고
• 24시간 모더레이션 운영
• 화면 캡처 방지 (개인정보 보호)

[이용 안내]
• 만 17세 이상 이용 가능
• 인앱 포인트는 7일 이내 100% 환불 가능 (미사용분)
• 결제 시 청약철회 제한 사항에 별도 동의

[고객 지원]
이메일: support@wantsome.kr
개인정보처리방침: https://api.wantsome.kr/privacy
이용약관: https://api.wantsome.kr/terms
청소년보호정책: https://api.wantsome.kr/youth
```

**Keywords (100자, App Store):**
```
크리에이터,인플루언서,영상통화,라이브,팬미팅,굿즈,예약,1:1,통화,소셜
```

### 영어 (App Store 필수)

**Subtitle:**
```
1:1 Video Calls with Creators
```

**Description:**
```
wantsome connects you with influencers and creators through 1:1 video calls.

[Key Features]
• 1:1 Video Calls with your favorite creators
• Live Streaming & Tipping in real time
• Booking System — schedule calls in advance
• Creator Goods Marketplace (rolling out gradually)
• Easy in-app point purchases

[Safety]
• Identity verification (17+)
• In-app reporting system
• 24/7 moderation
• Screen-capture protection

[Notes]
• Available for users 17 and older
• Unused points are 100% refundable within 7 days

Support: support@wantsome.kr
Privacy: https://api.wantsome.kr/privacy
Terms: https://api.wantsome.kr/terms
```

---

## 부록 B. Vercel 환경변수 14종

[Vercel Dashboard → Project → Settings → Environment Variables](https://vercel.com/dashboard)

```bash
# Supabase
SUPABASE_URL                    https://ftnfdtvaxsvosdyjdxfq.supabase.co
SUPABASE_SERVICE_ROLE_KEY       <대시보드에서 복사>

# Agora
AGORA_APP_ID                    da018cafb8f6474597d9caa388ddcf51
AGORA_APP_CERTIFICATE           <콘솔에서 발급 필요 — 미설정 시 통화 503>

# Cron
CRON_SECRET                     # 생성: openssl rand -hex 32

# Apple IAP (단계 2-A·2-E 결과)
APPLE_ISSUER_ID                 <ASC API Issuer ID>
APPLE_KEY_ID                    <Key ID>
APPLE_PRIVATE_KEY               <.p8 내용 (개행 \n 이스케이프)>
APPLE_BUNDLE_ID                 kr.wantsome.app
APPLE_ENVIRONMENT               Production
APPLE_ROOT_CAS_PEM              <단계 2-E PEM 한 줄 concat>

# Google IAP (단계 4·5 결과)
GOOGLE_PACKAGE_NAME             kr.wantsome.app
GOOGLE_SERVICE_ACCOUNT_JSON     <minified JSON 한 줄>
GOOGLE_RTDN_AUDIENCE            https://api.wantsome.kr/api/payments/google-rtdn

# 기타
ACCOUNT_ENCRYPT_KEY             # openssl rand -base64 32
SLACK_WEBHOOK_URL               <Slack 채널에서 발급>
PORTONE_API_SECRET              <PortOne 가맹점 승인 후 발급 — Week 3~4>
```

⚠️ Apple/Google 굵게 표시는 fail-closed — 미설정 시 결제 검증 503/401.

---

## 부록 C. EAS Secret 6종

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL       --value "https://api.wantsome.kr"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL       --value "https://ftnfdtvaxsvosdyjdxfq.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY  --value "<anon key>"
eas secret:create --scope project --name EXPO_PUBLIC_AGORA_APP_ID       --value "da018cafb8f6474597d9caa388ddcf51"
eas secret:create --scope project --name EXPO_PUBLIC_PORTONE_STORE_ID   --value "<PortOne 발급 후>"
eas secret:create --scope project --name EXPO_PUBLIC_PORTONE_CHANNEL_KEY --value "<PortOne 발급 후>"

# google-services.json (단계 3 결과)
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

---

## 부록 D. Supabase SQL — system_config 갱신 (단계 6 PG 승인 후 실행)

```sql
-- 사업자 정보 (실제값으로 교체)
update system_config set value = '주식회사 98점7도'   where key = 'company_name';
update system_config set value = '___-__-_____'       where key = 'business_number';
update system_config set value = '<대표자명>'         where key = 'ceo_name';
update system_config set value = '<서울시 ...>'       where key = 'business_address';
update system_config set value = '___-____-____'      where key = 'cs_phone';
update system_config set value = 'cs@wantsome.kr'     where key = 'cs_email';
update system_config set value = '제____호'           where key = 'telecom_sale_number';  -- 통판 신고 후

-- 청소년보호책임자 (정통망법 42조의3)
update system_config set value = '<실명>'             where key = 'youth_protection_officer';
update system_config set value = 'youth@wantsome.kr'  where key = 'youth_protection_email';
update system_config set value = '+82-__-____-____'   where key = 'youth_protection_phone';

-- 정산율 (PR-8 v1)
update creators set settlement_rate = 0.35
where settlement_rate is distinct from 0.35;
```

---

## 부록 E. 코드측 즉시 작업 (Claude가 병행)

| 항목 | 트리거 |
|---|---|
| `eas.json submit.production.ios.appleId/ascAppId/appleTeamId` 교체 | 단계 1 완료 후 ID 알려주면 즉시 |
| `google-services.json` 루트 교체 검증 | 단계 3 다운로드 후 |
| `.gitignore`에 `google-service-account*.json` 추가 | 단계 4 후 |
| `npm run eas:check-submit` 통과 확인 | 단계 7 직후 |
| IAP storeId 정합 검증 (`constants/products.ts` ↔ ASC/Play) | 단계 1·5 완료 후 |

---

## 오늘 종료 체크리스트

- [ ] 단계 1 — App Store Connect 새 앱 + IAP 6개 등록 완료
- [ ] 단계 2 — Apple API/APNs Key 발급 + ASSN V2 URL 등록
- [ ] 단계 3 — Firebase 프로젝트 + `google-services.json` 교체
- [ ] 단계 4 — GCP Service Account + Pub/Sub RTDN
- [ ] 단계 5 — Play Console 새 앱 + IAP + RTDN 연결
- [ ] 단계 6 — PortOne PG 신청 접수 (승인은 ~30일 대기)
- [ ] 단계 7 — `eas.json` placeholder 실값으로 교체

내일/모레 이어서:
- 변호사 자문 의뢰 (`USER-TODO.md` 12번)
- 메타데이터·스크린샷 촬영 (단계 1-D 데이터 채워야 가능)
- Sentry SDK 셋업 (선택)
- D-1 QA 골든패스 (`41-qa-plan.md`)
