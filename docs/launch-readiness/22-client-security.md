# 22. Mobile Client Security 감사

요약: Critical 2건 (Agora no-token 모드 프로덕션 가드 미확인 + 연령 검증 클라 단독), High 4건, Medium 4건, Info 3건 확인.
범위: 본 것 — A~N 전 영역 (소스 코드, .env, app.json, .gitignore, dist 디렉터리, git 추적 여부). 안 본 것 — EAS 빌드 서버 환경변수 실제값, iOS/Android 스토어 제출 빌드 바이너리 내부.

---

## Critical

- [ ] **[연령 게이트 클라이언트 단독 처리]** | `app/(auth)/age-check.tsx:65` | 생년월일 계산을 클라에서만 수행 후 `AsyncStorage.setItem("age_verified", "true")`로 저장. 서버에 전송·검증하지 않음. AsyncStorage는 암호화되지 않으므로 루팅/탈옥 기기에서 `age_verified` 값을 직접 주입하면 미성년자가 17+ 콘텐츠(영상통화, 라이브, 신분증 요구 기능 포함)에 진입 가능. `useAppInit.ts:117`에서도 `AsyncStorage.getItem("age_verified")`로만 판단. 법적 의무(정보통신망법 제42조) 위반 리스크. iOS·Android 양쪽 동일 취약. | 수정: 서버 `/api/users/me` 또는 별도 엔드포인트에 `birth_date`를 전송해 서버가 19세 여부 검증 후 users 테이블에 `is_age_verified` 컬럼으로 저장; 클라이언트는 해당 필드로 판단하고 AsyncStorage 플래그는 보조 캐시로만 사용.

- [ ] **[Agora no-token 모드 프로덕션 가드 부재]** | `server/lib/agora.ts:35`, `server/app/api/calls/[id]/accept/route.ts:43` | `AGORA_APP_CERTIFICATE`가 설정되지 않으면 `generateAgoraToken()` → `null` 반환, `accept` 라우트가 `agora_token: null`을 클라이언트에 반환. 클라이언트 `call/[sessionId].tsx:308`에서 `agoraToken ?? ""`로 fallback해 빈 토큰으로 채널 조인 시도. Agora "no-token mode"는 App ID만 알면 누구든 해당 채널에 참여 가능한 상태. 프로덕션 EAS 환경변수에 Certificate가 실제로 설정되어 있는지 코드상으론 보장되지 않음. 코드맵 `G~L:137`에도 명시된 위험. iOS·Android 동일. | 수정: `server/lib/agora.ts`에서 Certificate 미설정 시 서버가 500/503으로 응답하도록 guard 추가; 프로덕션 환경변수 체크리스트에 `AGORA_APP_CERTIFICATE` 필수 항목으로 명시.

---

## High

- [ ] **[Supabase 세션 토큰 AsyncStorage 저장]** | `lib/supabase.ts:8` | `createClient` 옵션 `storage: AsyncStorage`로 세션 토큰(JWT access\_token + refresh\_token)을 AsyncStorage에 평문 저장. Android의 경우 루팅 기기에서 앱 데이터 디렉터리 접근 시 토큰 탈취 가능. iOS는 Jailbreak 기기 동일 위험. `expo-secure-store`는 프로젝트 전체에서 임포트된 파일 없음(Grep 확인). | 수정: Supabase 클라이언트 storage를 `expo-secure-store` 기반 adapter로 교체(`LargeSecureStore` 패턴 — 토큰 크기 초과 대응 필요).

- [ ] **[useAuthStore 유저 정보 AsyncStorage 평문 저장]** | `stores/useAuthStore.ts:55-59` | Zustand persist 미들웨어가 `user` 객체 전체(id, nickname, role, is\_verified, blue\_mode, red\_mode 등)를 AsyncStorage `"auth-storage"` 키에 JSON 직렬화 저장. 민감 PII는 아니나 role·is\_verified 값을 기기에서 직접 조작하면 UI 레벨 권한 우회 가능(실제 API는 서버 토큰으로 검증하므로 서버 사이드 영향은 제한적이나 UI 게이트 우회 가능). iOS·Android 동일. | 수정: SecureStore 이전 또는 최소한 role/is\_verified를 로컬 저장하지 않고 앱 재시작 시 `/api/users/me`에서 fetch.

- [ ] **[dist-android-smoke 빌드 산출물 git 추적]** | `.gitignore` (dist/ 만 제외, dist-android-smoke/ 미포함) / `dist-android-smoke/_expo/static/js/android/entry-507d55f50b09beef37527c596bcf8039.hbc` git ls-files 확인 | `dist-android-smoke/` 디렉터리가 git에 커밋되어 있음. `.hbc`(Hermes bytecode) 번들에는 `EXPO_PUBLIC_*` 환경변수(SUPABASE\_ANON\_KEY, AGORA\_APP\_ID 등)가 빌드 시점 값으로 인라인된 상태. 이 파일이 공개 리포지터리에 있을 경우 키 노출. SUPABASE\_ANON\_KEY는 `EXPO_PUBLIC_*`이라 원래 클라이언트 노출 정상이지만, `.env`에 실제 값이 들어있고(`eyJhb...` 풀 JWT) 번들에도 그대로 포함. 빌드 산출물을 git에 두면 미래 rotate된 키도 히스토리에 남음. iOS 빌드 동일 패턴 우려. | 수정: `.gitignore`에 `dist-android-smoke/` 추가 후 `git rm -r --cached dist-android-smoke/` 실행.

- [ ] **[Agora Token 딥링크 파라미터 경유 — URL 노출]** | `app/(app)/call/[sessionId].tsx:192-212` | `agoraToken`, `agoraChannel`, `agoraAppId` 등 민감 파라미터를 `useLocalSearchParams`로 수신. Expo Router는 이 파라미터를 딥링크 URL 스킴(`wantsome://call/SESSION_ID?agoraToken=xxx`)으로 전달 가능한 구조. 외부 앱이 동일 스킴 딥링크를 intercept하거나 로그·crash 리포트에 URL이 남으면 Agora 토큰 노출. iOS·Android 동일. | 수정: Agora 접속 정보는 Realtime DB(Supabase `call_signals`)에서만 수신하도록 리팩터링; 딥링크 경로로는 sessionId만 전달.

---

## Medium

- [ ] **[API BASE_URL 개발 모드 HTTP 폴백]** | `lib/api.ts:12-43` | `__DEV__` 환경에서 LAN IP 감지 성공 시 `http://{LAN_IP}:3000`(평문 HTTP)으로 요청. 개발자 기기가 공용 네트워크에 연결된 상태에서 테스트하면 MITM 가능. 프로덕션(`__DEV__ = false`)에서는 `EXPO_PUBLIC_API_BASE_URL` 그대로 사용하므로 HTTPS가 보장되나, 프로덕션 빌드에 `http://` URL이 env에 설정될 경우 guard 없음. iOS ATS는 `http://` 차단하나 Android는 기본 허용. | 수정: 프로덕션 빌드 시 `BASE_URL`이 `https://`로 시작하는지 런타임 assert 추가.

- [ ] **[화면 녹화 방지 미적용 — 신분증 화면]** | `app/(creator)/onboarding/id-card.tsx` 전체 / `app/(app)/call/[sessionId].tsx:173`, `app/(app)/call/incoming.tsx:63` | 영상통화·수신 화면에는 `usePreventScreenCapture()` 적용 확인. 신분증 업로드 화면(`id-card.tsx`)에는 적용 없음. 신분증 사진이 화면에 표시된 상태(`<Image source={{ uri: imageUri }}>` line:186)에서 스크린 녹화가 가능하면 주민등록증/운전면허증 이미지 유출 위험. iOS·Android 양쪽 동일. | 수정: `id-card.tsx`에 `usePreventScreenCapture()` 추가.

- [ ] **[강제 업데이트 시스템 — 버전 비교 우회 가능성]** | `hooks/useAppInit.ts:87`, `server/app/api/system/status/route.ts:24` | 앱 버전은 `Constants.expoConfig?.version`(= `app.json` `version: "1.0.0"`)에서 읽음. Expo OTA 업데이트(`expo-updates`)로 JS 번들만 교체하면 네이티브 버전 필드가 바뀌지 않아 버전 비교 무력화 가능. 또한 `/api/system/status`는 인증 없이 호출 가능하고 클라이언트가 응답을 신뢰해 라우팅 결정하므로, 네트워크 MITM 가능 환경에서 `min_version_ios: "0.0.0"` 응답 주입 시 업데이트 강제 우회 가능. iOS·Android 동일. | 수정: 스토어 바이너리 버전 기반 강제 업데이트는 서버사이드 API에서 user-agent 파싱으로도 보완; OTA 배포 시 버전 정책 주의.

- [ ] **[푸시 토큰 로그아웃 시 삭제 누락]** | `stores/useAuthStore.ts:47-51`, `hooks/usePushNotifications.ts:52-55` | `logout()` 함수가 `supabase.auth.signOut()`만 호출하고 `/api/push/register` DELETE를 호출하지 않음. 기기에서 로그아웃해도 push\_tokens 테이블에 해당 기기의 Expo 푸시 토큰이 남아 있어, 이후 다른 계정으로 로그인하거나 계정 탈취 시 이전 사용자에게 알림 발송 가능. iOS·Android 동일. | 수정: `logout()` 내에서 `apiCall("/api/push/register", { method: "DELETE" })`를 signOut 전에 호출.

---

## Info

- [ ] **[console.log BASE_URL 프로덕션 빌드 포함 가능성]** | `lib/api.ts:48-51` | `__DEV__` guard 내부이나 Metro bundler에서 dead-code elimination이 완전 보장되지 않는 환경(특히 Hermes `__DEV__` 처리)에서는 로그 코드가 번들에 잔존할 수 있음. 영향 낮음 (BASE_URL은 EXPO_PUBLIC이라 원래 노출). | 수정: Metro `production` 모드에서 `__DEV__` 블록은 제거되나, 프로덕션 빌드 번들을 한 번 strings 검사로 확인 권장.

- [ ] **[app.json에 Universal Links / Associated Domains 미설정]** | `app.json` 전체 | `scheme: "wantsome"` 커스텀 URL 스킴만 설정. Universal Links(iOS `applinks:`) / App Links(Android `assetlinks.json`) 미구성. 커스텀 스킴은 다른 앱이 동일 스킴 등록으로 hijacking 가능하므로 결제 완료 콜백(`portone` 리다이렉트) 및 본인인증 콜백이 커스텀 스킴으로 돌아오는 경우 위험 가능. 콜백에 커스텀 스킴 사용 여부는 포트원 설정에 따라 다름 — 미확인. | 확인 필요: 포트원/본인인증 콜백 redirect\_url이 `wantsome://` 스킴인지 `https://` Universal Link인지 점검.

- [ ] **[Android READ/WRITE_EXTERNAL_STORAGE 권한 선언]** | `app.json:79-80` | `android.permission.READ_EXTERNAL_STORAGE`, `android.permission.WRITE_EXTERNAL_STORAGE` 권한 선언. Android 10+(API 29+) 대상에서 Scoped Storage 적용으로 이 권한은 대부분 불필요. Android 13+(API 33+)에서는 `READ_MEDIA_IMAGES`로 세분화해야 함. 불필요한 광범위 권한은 Play Store 심사 지연 및 사용자 신뢰 저하 요인. | 수정: 대상 SDK 버전과 expo-image-picker/react-native-agora의 실제 요구 권한을 재검토해 불필요 항목 제거.

---

## 미확인 (코드 직접 확인 불가)

| 항목 | 이유 |
|---|---|
| EAS 프로덕션 환경변수 실제값 (`AGORA_APP_CERTIFICATE` 설정 여부) | EAS 대시보드/CI 환경 접근 불가 |
| 포트원 콜백 redirect_url 스킴 (`http(s)` vs `wantsome://`) | 포트원 콘솔 설정 확인 필요 |
| Supabase `id-cards` 버킷 RLS 및 admin-only 접근 정책 | DB 직접 접근 불가 |
| iOS App Transport Security 예외 도메인 (`ExceptionDomains`) | 빌드된 `Info.plist` 미확인 (`app.json`에 명시 없으면 Expo 기본 적용) |
| Android `networkSecurityConfig` cleartext 설정 | Managed Workflow라 `AndroidManifest.xml` 직접 없음 |
| 인증 콜백 딥링크 데이터 검증 (portone, 본인인증) | 해당 화면 파일 부재 또는 미탐색 |
| Certificate Pinning | 클라이언트 코드 전반에 pinning 관련 코드 없음 — 미구현 확인, 위험도 판단은 위협 모델에 따라 다름 |
