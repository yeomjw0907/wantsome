# wantsome — 소셜 로그인 설정 가이드

> Google / Apple / 카카오 로그인을 쓰려면 아래 값들을 각 서비스에서 발급·설정한 뒤, Supabase와 앱에 넣어야 합니다.

---

## 1. 공통 — 앱에서 쓰는 주소

| 항목 | 값 | 비고 |
|------|-----|------|
| **앱 URL 스킴** | `wantsome` | app.json `scheme` (이미 설정됨) |
| **OAuth 리다이렉트 URL** | `wantsome://auth/callback` | 로그인 완료 후 돌아오는 주소 |

Supabase에서 **Redirect URLs**에 아래를 허용 목록에 추가해야 합니다.

- `wantsome://auth/callback`
- (개발용) `exp://127.0.0.1:8081/--/auth/callback` 등 필요 시

---

## 2. Supabase 대시보드 설정

**Authentication → URL Configuration**

| 설정 | 값 |
|------|-----|
| Site URL | `https://wantsome.kr` (또는 실제 도메인) |
| Redirect URLs | `wantsome://auth/callback` 한 줄 추가 후 저장 |

**Authentication → Providers** 에서 사용할 provider를 켜고, 아래 3번~5번에서 받은 값을 각각 입력합니다.

---

## 3. Google 로그인

### 3-1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. **APIs & Services → OAuth consent screen**
   - User Type: **External** (테스트 시 본인 이메일만 추가)
   - 앱 이름, 지원 이메일 등 입력 후 저장
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application** 1개 생성
     - Name: `wantsome-web` (이름은 자유)
     - **Authorized redirect URIs** 에 Supabase 콜백 추가:
       - `https://<YOUR_SUPABASE_REF>.supabase.co/auth/v1/callback`
       - 예: `https://csrulljusyqbbzijnber.supabase.co/auth/v1/callback`
   - **iOS** 1개 생성 (iOS 앱용)
     - Bundle ID: `kr.wantsome.app`
   - **Android** 1개 생성 (Android 앱용)
     - Package name: `kr.wantsome.app`
     - SHA-1: 키스토어 fingerprint (나중에 앱 서명 정리 후 추가)

### 3-2. Supabase에 넣을 값

**Authentication → Providers → Google**

| 필드 | 넣는 값 |
|------|---------|
| **Client ID (Web)** | Google Cloud에서 만든 **Web application** OAuth 클라이언트의 Client ID |
| **Client Secret (Web)** | 같은 Web application의 Client Secret |

- iOS/Android용 Client ID는 Supabase가 지원하면 별도 필드에, 아니면 Web 것만 넣어도 동작하는 경우가 많습니다. (문제 있으면 Supabase 문서 참고)

---

## 4. Apple 로그인 (Sign in with Apple)

### 4-1. Apple Developer

1. [Apple Developer](https://developer.apple.com/) 로그인
2. **Certificates, Identifiers & Profiles → Identifiers**
   - App ID: `kr.wantsome.app` 에 **Sign in with Apple** Capability 활성화
3. **Identifiers → Services IDs** 에서 새 Service ID 생성
   - Description: `wantsome Sign in with Apple`
   - Identifier: `kr.wantsome.app.signin` (예시)
   - **Sign in with Apple** 체크 → Configure
     - Primary App ID: `kr.wantsome.app`
     - Domains: `csrulljusyqbbzijnber.supabase.co` (Supabase 프로젝트 도메인)
     - Return URLs: `https://csrulljusyqbbzijnber.supabase.co/auth/v1/callback`
4. **Keys** 에서 새 Key 생성
   - Key name: `wantsome-apple-signin`
   - **Sign in with Apple** 체크 → Configure → App ID 선택
   - Key ID, Team ID, Service ID, **.p8 파일** 다운로드 후 보관

### 4-2. Supabase에 넣을 값

**Authentication → Providers → Apple**

| 필드 | 넣는 값 |
|------|---------|
| **Services ID** | 위에서 만든 Service ID (예: `kr.wantsome.app.signin`) |
| **Secret Key** | .p8 파일 내용 전체 (-----BEGIN PRIVATE KEY----- ~ -----END PRIVATE KEY-----) |
| **Key ID** | Keys에서 생성한 Key의 Key ID |
| **Team ID** | Apple Developer 팀 ID |
| **Bundle ID** | `kr.wantsome.app` |

---

## 5. 카카오 로그인

### 5-1. Kakao Developers

1. [Kakao Developers](https://developers.kakao.com/) 로그인
2. **내 애플리케이션 → 애플리케이션 추가**
   - 앱 이름: wantsome
3. **앱 설정 → 앱 키** 에서 **REST API 키** 복사 (나중에 필요할 수 있음)
4. **제품 설정 → 카카오 로그인**
   - **활성화** ON
   - **Redirect URI** 등록:
     - `https://csrulljusyqbbzijnber.supabase.co/auth/v1/callback`
   - **동의 항목**에서 필요한 항목(프로필, 이메일 등) 설정
5. **앱 설정 → 플랫폼**
   - **Android**: 패키지명 `kr.wantsome.app`, 키 해시 추가(개발용/릴리즈용)
   - **iOS**: 번들 ID `kr.wantsome.app` 등록

### 5-2. Supabase에 넣을 값

Supabase는 기본 제공 Provider에 **Kakao**가 없을 수 있습니다. 있는 경우:

**Authentication → Providers → Kakao** (또는 해당 provider 이름)

| 필드 | 넣는 값 |
|------|---------|
| **Client ID** | Kakao 앱의 **REST API 키** (또는 Kakao에서 안내하는 OAuth Client ID) |
| **Client Secret** | Kakao 개발자 도구에서 발급하는 **Client Secret** (있을 경우) |

- Kakao가 Supabase 기본 목록에 없으면 **Custom OAuth** 또는 **Custom Provider**로 등록하는 방법을 Supabase 문서에서 확인하세요.

---

## 6. 앱 쪽에 넣을 값 정리

### 6-1. 환경 변수 (.env.local)

소셜 로그인만 쓰는 경우, **Supabase URL / anon key**만 있으면 됩니다. (이미 설정된 상태)

```env
EXPO_PUBLIC_SUPABASE_URL=https://csrulljusyqbbzijnber.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- Google/Apple/카카오 **클라이언트 ID·시크릿**은 Supabase 대시보드에만 넣고, 앱 코드·.env에는 넣지 않습니다.

### 6-2. app.json (이미 반영된 것)

- `scheme`: `wantsome` → `wantsome://` 딥링크 사용
- `ios.bundleIdentifier`: `kr.wantsome.app`
- `android.package`: `kr.wantsome.app`

위가 Google/Apple/카카오에 등록한 값과 같아야 합니다.

---

## 7. 체크리스트

설정 후 아래만 확인하면 됩니다.

- [ ] Supabase **Redirect URLs**에 `wantsome://auth/callback` 추가
- [ ] Google: Web OAuth 클라이언트 생성 후 Supabase Google Provider에 Client ID / Secret 입력
- [ ] Apple: Service ID, Key(.p8), Key ID, Team ID, Bundle ID Supabase Apple Provider에 입력
- [ ] 카카오: Redirect URI에 Supabase 콜백 URL 등록, Supabase에 Kakao(또는 해당 provider) 설정
- [ ] 앱 **실기기 또는 시뮬레이터**에서 로그인 버튼 탭 → 브라우저 열림 → 로그인 → 앱으로 복귀되는지 확인

---

## 8. 참고 링크

| 서비스 | URL |
|--------|-----|
| Supabase Auth 문서 | https://supabase.com/docs/guides/auth |
| Google OAuth 설정 | https://console.cloud.google.com/apis/credentials |
| Apple Sign in | https://developer.apple.com/sign-in-with-apple/ |
| Kakao 로그인 | https://developers.kakao.com/docs/latest/ko/kakaologin/common |

---

*문서 기준: wantsome 앱 (Expo Router, Supabase Auth, `wantsome://auth/callback`)*
