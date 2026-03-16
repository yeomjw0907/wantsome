# 05. 인앱결제 (IAP) 연동

> **선행 조건:** 사업자 등록 ✅, Apple Developer Program ($99) ✅, Google Play Console ($25) ✅
> **소요 시간:** iOS 2~3일 (심사) + Android 1일
> **비용:** Apple 30% / Google 15~30% 수수료
> **왜 필요한가:** 현재 포인트 충전이 mock 상태. 실결제 없이는 앱스토어 심사 통과 불가.

---

## 현재 상태

현재 `app/(app)/charge/index.tsx`에서 결제 버튼을 누르면:
- `POST /api/payments/verify-iap` 호출
- 서버에서 receipt 검증 로직이 있으나 실제 영수증이 없어 동작 안 함

IAP 연동 후에는 실제 Apple/Google 결제창이 열리고, 결제 완료 후 포인트가 충전됩니다.

---

## iOS App Store IAP

### Step I-1. App Store Connect — 인앱구매 상품 생성

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) 로그인
2. **My Apps** → wantsome 앱 선택 (없으면 먼저 생성)
3. 좌측 메뉴 → **In-App Purchases** → **+** 클릭

각 상품 생성:

| 상품 ID | 타입 | 가격 | 포인트 |
|---------|------|------|--------|
| `kr.wantsome.app.points.1000` | 소모성 | ₩1,100 | 1,000P |
| `kr.wantsome.app.points.3000` | 소모성 | ₩3,300 | 3,000P |
| `kr.wantsome.app.points.5000` | 소모성 | ₩5,500 | 5,500P (10% 보너스) |
| `kr.wantsome.app.points.10000` | 소모성 | ₩10,900 | 11,000P (10% 보너스) |
| `kr.wantsome.app.points.30000` | 소모성 | ₩32,000 | 33,000P (10% 보너스) |

각 상품 입력:
```
Reference Name: 포인트 1,000
Product ID: kr.wantsome.app.points.1000
Type: Consumable (소모성)
Price: ₩1,100 (Tier 2)
Display Name (KO): 1,000 포인트
Description (KO): wantsome 서비스 이용을 위한 포인트 1,000개
```

### Step I-2. Sandbox 테스트 계정 생성

1. App Store Connect → **Users and Access** → **Sandbox Testers**
2. **+** 클릭 → 테스트 계정 생성:
   ```
   First Name: 테스트
   Last Name: 유저
   Email: sandbox-tester@wantsome.kr (실제 존재 안해도 됨)
   Password: TestUser2025!
   ```
3. 실기기에서 **설정 → App Store → Sandbox 계정** 로그인

### Step I-3. 앱 코드 수정 필요

현재 `expo-in-app-purchases` 또는 `react-native-iap` 설치 및 연동 필요.

> ⚠️ **Claude(AI)에게 요청:** "IAP 실결제 연동해줘" 메시지와 함께 이 파일 내용 공유

**설치할 패키지:**
```bash
npx expo install expo-in-app-purchases
# 또는
npm install react-native-iap
```

**구현할 파일:**
- `app/(app)/charge/index.tsx` — 상품 목록 로드 + 구매 버튼
- `server/app/api/payments/verify-iap/route.ts` — Apple 영수증 서버 검증

---

## Android Google Play IAP

### Step G-1. Google Play Console — 앱 생성

1. [play.google.com/console](https://play.google.com/console) 로그인
2. **Create app** 클릭:
   ```
   App name: wantsome
   Default language: Korean
   App or Game: App
   Free or Paid: Free
   ```
3. 정책 동의 → **Create app**

### Step G-2. 콘텐츠 등급 설정

1. 앱 → **Policy** → **App content** → **Content ratings**
2. 설문 작성:
   - 카테고리: Entertainment
   - 성인 콘텐츠: YES (성인 영상통화 플랫폼)
   - 결과: **Adult Only (AO)** 또는 **Mature 17+** 예상

### Step G-3. 인앱상품 생성

1. 앱 → **Monetize** → **Products** → **In-app products** → **Create product**

각 상품 생성:

| 상품 ID | 가격 | 포인트 |
|---------|------|--------|
| `kr.wantsome.app.points.1000` | ₩1,100 | 1,000P |
| `kr.wantsome.app.points.3000` | ₩3,300 | 3,000P |
| `kr.wantsome.app.points.5000` | ₩5,500 | 5,500P |
| `kr.wantsome.app.points.10000` | ₩10,900 | 11,000P |
| `kr.wantsome.app.points.30000` | ₩32,000 | 33,000P |

각 상품:
```
Product ID: kr.wantsome.app.points.1000
Name: 1,000 포인트
Description: wantsome 서비스 이용을 위한 포인트 1,000개
Status: Active
```

### Step G-4. Google Play Billing 서비스 계정 생성

서버에서 영수증을 검증하려면 서비스 계정 필요:

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 선택
2. **APIs & Services** → **Enable APIs** → **Google Play Android Developer API** 활성화
3. **IAM & Admin** → **Service Accounts** → **Create Service Account**:
   ```
   Name: wantsome-play-billing
   Role: Service Account User
   ```
4. 서비스 계정 → **Keys** → **Add Key** → **JSON** 다운로드
5. Google Play Console → **Setup** → **API access** → 서비스 계정 연결 → 권한: **Finance**

6. 다운로드한 JSON 파일 → `server/google-service-account.json` 에 저장 (`.gitignore`에 추가!)

### Step G-5. 환경 변수 추가

Vercel → wantsome 서버 → Settings → Environment Variables:

```env
GOOGLE_SERVICE_ACCOUNT_KEY=[google-service-account.json 파일 내용을 한 줄로 변환]
```

또는 파일 경로 방식:
```env
GOOGLE_APPLICATION_CREDENTIALS=./google-service-account.json
```

---

## 포인트 상품 테이블 (Supabase)

IAP 상품 ID와 포인트를 연결하는 테이블:

```sql
-- Supabase SQL Editor에서 실행
INSERT INTO point_products (sku, store, points, price_krw, bonus_points, is_active) VALUES
  ('kr.wantsome.app.points.1000',  'ios',     1000,  1100,  0,    true),
  ('kr.wantsome.app.points.3000',  'ios',     3000,  3300,  0,    true),
  ('kr.wantsome.app.points.5000',  'ios',     5000,  5500,  500,  true),
  ('kr.wantsome.app.points.10000', 'ios',     10000, 10900, 1000, true),
  ('kr.wantsome.app.points.30000', 'ios',     30000, 32000, 3000, true),
  ('kr.wantsome.app.points.1000',  'android', 1000,  1100,  0,    true),
  ('kr.wantsome.app.points.3000',  'android', 3000,  3300,  0,    true),
  ('kr.wantsome.app.points.5000',  'android', 5000,  5500,  500,  true),
  ('kr.wantsome.app.points.10000', 'android', 10000, 10900, 1000, true),
  ('kr.wantsome.app.points.30000', 'android', 30000, 32000, 3000, true);
```

---

## 완료 체크

**iOS:**
- [ ] App Store Connect 인앱구매 상품 5개 생성 (Active 상태)
- [ ] Sandbox 테스트 계정 생성
- [ ] 앱 코드 IAP 연동 (Claude에게 요청)
- [ ] 실기기 Sandbox 테스트 ✅

**Android:**
- [ ] Google Play Console 앱 생성
- [ ] 콘텐츠 등급 설정 (성인)
- [ ] 인앱상품 5개 생성 (Active)
- [ ] 서비스 계정 생성 + JSON 키 발급
- [ ] Vercel 환경 변수 추가
- [ ] 앱 코드 IAP 연동 (Claude에게 요청)
- [ ] 내부 테스트 트랙에서 결제 테스트 ✅

**공통:**
- [ ] Supabase `point_products` 테이블 데이터 입력
