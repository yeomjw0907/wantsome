# 03. 소셜 로그인 설정 (Google / Apple / 카카오)

> **선행 조건:** 없음 (Google/카카오), Apple Developer Program $99 결제 (Apple)
> **소요 시간:** Google 30분 / Apple 1시간 / 카카오 30분
> **비용:** Google/카카오 무료, Apple $99/년

---

## Google 로그인

### Step G-1. Google Cloud Console 프로젝트 생성

1. [console.cloud.google.com](https://console.cloud.google.com) 접속
2. 상단 프로젝트 드롭다운 → **New Project** 클릭
3. 프로젝트 이름: `wantsome` → **Create**

### Step G-2. OAuth 동의 화면 설정

1. 좌측 메뉴 → **APIs & Services** → **OAuth consent screen**
2. User Type: **External** 선택 → **Create**
3. 앱 정보 입력:
   ```
   App name: wantsome
   User support email: support@wantsome.kr
   App logo: (앱 로고 이미지 업로드)
   App domain:
     Application home page: https://wantsome.kr
     Privacy policy: https://api.wantsome.kr/privacy
     Terms of service: https://api.wantsome.kr/terms
   Developer contact email: support@wantsome.kr
   ```
4. **Save and Continue** (스코프 설정은 기본값 유지)
5. Test users: 본인 구글 계정 추가 → **Save and Continue**

### Step G-3. OAuth 클라이언트 ID 생성

1. 좌측 메뉴 → **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID** 클릭
3. Application type: **Web application**
4. 이름: `wantsome-supabase`
5. Authorized redirect URIs에 추가:
   ```
   https://ftnfdtvaxsvosdyjdxfq.supabase.co/auth/v1/callback
   ```
6. **Create** → **Client ID**와 **Client Secret** 복사

```
Client ID:     xxxxxx.apps.googleusercontent.com
Client Secret: GOCSPX-xxxxxxxxxxxxxxxx
```

### Step G-4. Supabase에 Google 설정 입력

1. Supabase Dashboard → **Authentication** → **Providers** → **Google**
2. **Enable Google provider**: ✅ ON
3. 값 입력:
   ```
   Client ID (for OAuth):  [위에서 복사한 Client ID]
   Client Secret:           [위에서 복사한 Client Secret]
   ```
4. **Save**

### Step G-5. Expo/Android SHA-1 설정 (Android 앱 배포 시)

```bash
# 디버그 키 SHA-1 확인
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# 출력에서 SHA1: 항목 복사
```

Google Cloud Console → **Credentials** → Android 클라이언트 추가:
```
Package name: kr.wantsome.app
SHA-1: [위에서 복사한 값]
```

---

## Apple 로그인

> ⚠️ **Apple Developer Program ($99/년) 결제 필수**

### Step A-1. Apple Developer 가입

1. [developer.apple.com](https://developer.apple.com) → **Account** → **Enroll**
2. Individual / Organization 선택 → $99 결제
3. 처리: 1~3영업일

### Step A-2. App ID에 Sign In with Apple 활성화

1. [developer.apple.com](https://developer.apple.com) 로그인
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. `kr.wantsome.app` 선택 (없으면 + 버튼으로 생성)
4. Capabilities 목록에서 **Sign In with Apple** 체크 ✅
5. **Save**

### Step A-3. Service ID 생성

1. **Identifiers** → **+** → **Services IDs** 선택
2. Description: `wantsome Sign In`
3. Identifier: `kr.wantsome.app.signin`
4. **Continue** → **Register**
5. 생성된 Service ID 클릭 → **Sign In with Apple** 체크
6. **Configure** 클릭:
   ```
   Primary App ID: kr.wantsome.app
   Domains: wantsome.kr
   Return URLs: https://ftnfdtvaxsvosdyjdxfq.supabase.co/auth/v1/callback
   ```
7. **Done** → **Continue** → **Save**

### Step A-4. Private Key 생성

1. **Keys** → **+** 클릭
2. Key Name: `wantsome-sign-in`
3. **Sign In with Apple** 체크 → **Configure** → Primary App ID: `kr.wantsome.app`
4. **Save** → **Continue** → **Register**
5. **Download** 클릭 (`.p8` 파일 — **한 번만 다운로드 가능, 안전하게 보관**)
6. Key ID 복사

```
Key ID:    XXXXXXXXXX
Team ID:   XXXXXXXXXX (우측 상단 계정 이름 옆)
.p8 파일: AuthKey_XXXXXXXXXX.p8
```

### Step A-5. Supabase에 Apple 설정 입력

1. Supabase Dashboard → **Authentication** → **Providers** → **Apple**
2. **Enable Apple provider**: ✅ ON
3. 값 입력:
   ```
   Service ID (client_id):  kr.wantsome.app.signin
   Team ID:                  [10자리 Team ID]
   Key ID:                   [10자리 Key ID]
   Private Key:              [.p8 파일 내용 전체 붙여넣기]
   ```
   > `.p8` 파일을 텍스트 에디터로 열면 `-----BEGIN PRIVATE KEY-----` 로 시작하는 내용이 있음. 전체 복사.
4. **Save**

---

## 카카오 로그인

### Step K-1. 카카오 Developers 앱 생성

1. [developers.kakao.com](https://developers.kakao.com) → 로그인
2. **내 애플리케이션** → **애플리케이션 추가하기**
3. 앱 정보:
   ```
   앱 이름: wantsome
   사업자명: 원썸 (또는 개인 이름)
   ```
4. 앱 아이콘 업로드 → **저장**

### Step K-2. 플랫폼 설정

앱 → **앱 설정** → **플랫폼**:

**Web 플랫폼 추가:**
```
사이트 도메인: https://wantsome.kr
```

**Android 플랫폼 추가:**
```
패키지명: kr.wantsome.app
키 해시: [아래 명령어로 확인]
```
```bash
# 디버그 키 해시 확인
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
```

**iOS 플랫폼 추가:**
```
번들 ID: kr.wantsome.app
```

### Step K-3. 카카오 로그인 활성화

앱 → **제품 설정** → **카카오 로그인** → **활성화 설정**: **ON**

**Redirect URI 추가:**
```
https://ftnfdtvaxsvosdyjdxfq.supabase.co/auth/v1/callback
```

### Step K-4. 동의항목 설정

앱 → **제품 설정** → **카카오 로그인** → **동의항목**:

| 항목 | 설정 |
|------|------|
| 닉네임 | 필수 동의 |
| 프로필 사진 | 선택 동의 |
| 카카오계정(이메일) | 선택 동의 |

### Step K-5. REST API 키 확인

앱 → **앱 설정** → **앱 키**:
```
REST API 키: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step K-6. Supabase에 카카오 설정 입력

1. Supabase Dashboard → **Authentication** → **Providers** → **Kakao**
2. **Enable Kakao provider**: ✅ ON
3. 값 입력:
   ```
   Client ID (REST API Key): [위에서 복사한 REST API 키]
   Client Secret:             (카카오는 선택사항 — 비워도 됨)
   ```
4. **Save**

---

## 테스트

각 소셜 로그인 설정 후 앱을 실행해서:

1. 로그인 화면 → 해당 소셜 버튼 클릭
2. OAuth 동의 화면 표시 확인
3. 로그인 성공 → 앱 메인으로 이동 확인
4. Supabase Dashboard → **Authentication** → **Users** 에서 유저 생성 확인

---

## 완료 체크

**Google:**
- [ ] Google Cloud 프로젝트 생성
- [ ] OAuth 동의 화면 설정
- [ ] OAuth 클라이언트 ID / Secret 발급
- [ ] Supabase Google Provider 활성화 + 저장
- [ ] 앱에서 Google 로그인 테스트 ✅

**Apple:**
- [ ] Apple Developer Program 등록 ($99)
- [ ] App ID에 Sign In with Apple 활성화
- [ ] Service ID 생성 + Redirect URL 설정
- [ ] Private Key (.p8) 발급 및 안전하게 보관
- [ ] Supabase Apple Provider 활성화 + 저장
- [ ] 실제 기기에서 Apple 로그인 테스트 ✅

**카카오:**
- [ ] 카카오 Developers 앱 생성
- [ ] 플랫폼 설정 (Web/Android/iOS)
- [ ] 카카오 로그인 활성화 + Redirect URI 등록
- [ ] 동의항목 설정
- [ ] REST API 키 확인
- [ ] Supabase Kakao Provider 활성화 + 저장
- [ ] 앱에서 카카오 로그인 테스트 ✅
