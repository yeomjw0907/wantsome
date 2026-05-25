# 원썸(wantsome) 출시 인수인계 — 노트북 이어가기용

> 작성: 2026-05-26 (데스크탑 세션). 비밀키 값은 이 문서에 없음(파일/Vercel 참조).

## 0. 한 줄 현황
iOS 프로덕션 빌드가 App Store Connect에 업로드 완료(처리중). 서버 결제검증 env/코드 정리 완료(푸시·배포만 남음). 다음 큰 일은 **ASC 앱 심사 제출 준비(스크린샷·메타데이터)**.

## 1. 핵심 식별자 (비밀 아님)
- 앱: 원썸(wantsome) / iOS Bundle ID = `kr.wantsome.app` / Android package = `kr.wantsome.app`
- Apple 개발자: ID `yeomjw0907@naver.com`, Team `HULDGG4S79` (JEONGWON yeom, Individual)
- ASC App ID: `6762510444`  (TestFlight: https://appstoreconnect.apple.com/apps/6762510444/testflight/ios )
- Apple IAP(App Store Server API) Key ID: `6WU2K8RJ3Y` / APNs Key ID: `4R87F7BSV5`
- EAS Submit용 ASC API Key: `8HRM7366VY` (EAS 서버 관리)
- 빌드: v1.0.0 / Build 1 / IPA: https://expo.dev/artifacts/eas/76C4Q9S8svJ58imAYQsP9n.ipa
- Provisioning Profile `MDNUVM78LX`, Distribution Cert serial `65962F86AC8D9876EAC35DEF44DD2534` (만료 2027-05-25)
- Expo 계정: `@yeomjungwon` (project: wantsome)
- Firebase: project `wantsome-4c3b0` (number 554690638493)
- GCP 서비스계정: `wantsome-play-billing@wantsome-4c3b0.iam.gserviceaccount.com`
- Google Play 개발자: 원썸컴퍼니 (account 8590258685249335838)
- Vercel: project `wantsome_platform`, team slug `garden-yeoms-projects`, **루트 디렉토리 = `server/`**, 도메인 `api.wantsome.kr`
- IAP 상품(소모성, _v2 접미사): storeId 는 `constants/products.ts` 참고. 가격(KRW): 6600/9900/27500/46200/85800/143000

## 2. 오늘 완료된 것 (DONE)
- 코드 typecheck/빌드 점검 통과
- `eas.json` iOS submit 정보(appleId/ascAppId/appleTeamId), android serviceAccountKeyPath 설정
- `app.json`: `ios.config.usesNonExemptEncryption=false` (export compliance 자동), EAS가 expo-updates(updates.url/runtimeVersion) 자동 추가
- `.gitattributes`(EOL 정규화), `google-services.json`(실값) 배치/커밋
- Apple: App Store Server API 키, APNs 키 발급 / 번들ID에 **Push Notifications capability ON+저장**
- iOS 프로덕션 **빌드 성공 → ASC 업로드(eas submit) 완료** (Build 1 처리중)
- Vercel 환경변수 9개 입력(Production·Sensitive, 값 sha256 검증):
  APPLE_PRIVATE_KEY, APPLE_ROOT_CAS_PEM, APPLE_BUNDLE_ID(=kr.wantsome.app), APPLE_ENVIRONMENT(=Production),
  APPLE_KEY_ID(=6WU2K8RJ3Y), APPLE_ISSUER_ID, GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_PACKAGE_NAME(=kr.wantsome.app),
  GOOGLE_RTDN_SENDER_EMAIL
- `server/lib/iap/apple.ts`: 트랜잭션 검증에 **Sandbox/Production 폴백** 추가(심사 IAP 대응). typecheck 0 에러.
- PortOne(다날) PG 가맹점 신청 접수(약 30일 critical path)

## 3. 지금 바로 해야 할 것 (커밋·푸시)
미커밋 변경: `app.json`, `package.json`, `package-lock.json`, `server/lib/iap/apple.ts`
```
cd <repo>
git add app.json package.json package-lock.json server/lib/iap/apple.ts
git commit -m "fix(iap): Apple 검증 Sandbox/Production 폴백 + EAS expo-updates 설정"
git push
```
→ Vercel 자동 배포(코드+env 9개 반영). 배포 성공 시 **서버 결제검증 라인 완성**.

## 4. 다음 단계 (우선순위 순)
### A. ASC 앱 심사 제출 준비 (오늘의 다음 목표)
1. **스크린샷**: Android Studio 에뮬레이터(또는 시뮬레이터)에서 주요 화면 캡처 → ASC에 6.7"/6.5" 등 요구 사이즈 업로드
2. App 정보: 설명, 키워드, 지원 URL, 마케팅 URL, **개인정보처리방침 URL**, 카테고리, 연령등급
3. **Privacy Nutrition Label 게시** (단계 3 미완)
4. **IAP 6개 메타데이터 + 심사용 스크린샷** 첨부, 상태 "심사 준비 완료"
5. 빌드 선택: Build 1 (처리 끝나면 선택 가능)
6. Export compliance: 이미 처리(usesNonExemptEncryption=false)
7. **App Store Server Notifications V2 URL 등록 확인**: `https://api.wantsome.kr/api/payments/apple-notification`
8. 심사 제출

### B. 서버 env 잔여 (값 준비되면)
- `GOOGLE_RTDN_AUDIENCE`: GCP Pub/Sub push 구독 OIDC audience (아래 C에서 결정)
- `PORTONE_STORE_ID` / `PORTONE_CHANNEL_KEY` / `PORTONE_API_SECRET`: 다날 채널키 발급 후
  - (참고) `PORTONE_SECRET_KEY`는 별도 — 본인인증용. Vercel에 이미 있는지 확인 필요.

### C. GCP RTDN (단계 4 후반)
- Pub/Sub Topic `wantsome-rtdn` 생성 + Push Subscription(OIDC) → endpoint `https://api.wantsome.kr/api/payments/google-rtdn`
- 서비스계정 권한 부여, Play Console에 RTDN topic 연결
- SA 키 생성은 org policy `iam.disableServiceAccountKeyCreation` 영향 받았던 이력 있음(사용자가 off 처리함)

### D. Android (2주+ 소요)
- Play 본인확인: 개발자명/주소 증빙(염정원 / 인천 연수구 송도동 자이하버뷰 2단지 203-202; 90일 이내 주소 증빙 문서)
- 본인확인 통과 → 앱 등록 + IAP + RTDN → **신규 계정 14일 비공개 테스트** → 프로덕션
- `eas submit --platform android` 에 `google-service-account.json` 필요(= secrets/ 안의 SA json, gitignore)

## 5. 비밀키 파일 (gitignored — git으로 안 옮겨짐)
`secrets/` 폴더 (전부 .gitignore):
- `SubscriptionKey_6WU2K8RJ3Y.p8`  → Vercel APPLE_PRIVATE_KEY (입력완료)
- `AuthKey_4R87F7BSV5.p8`           → Expo eas credentials APNs (등록완료)
- `AppleRootCA-G3.pem`              → Vercel APPLE_ROOT_CAS_PEM (입력완료)
- `wantsome-4c3b0-c698c3dc9f58.json` / `GOOGLE_SERVICE_ACCOUNT_JSON.min.txt` → Vercel GOOGLE_SERVICE_ACCOUNT_JSON (입력완료) + 루트 `google-service-account.json`(eas submit android용)
- `README.md` (키↔용도 매핑, Issuer ID 등 식별자 포함)
- (정리됨) `vercel-import.env`, `google-json.env` 는 0바이트로 비움 — 무시/삭제 가능
> 노트북에서 **Android eas submit** 할 때만 `google-service-account.json` 필요. 그 외 ASC 심사 제출은 비밀키 불필요.

## 6. 노트북 환경 체크리스트
- [ ] repo `git pull` (위 3번 push 이후 최신화)
- [ ] 브라우저 로그인: Apple(yeomjw0907@naver.com), Vercel(yeomjw0907@naver.com), Google(Play/GCP)
- [ ] Android Studio + 에뮬레이터 (스크린샷용)
- [ ] (Android 단계에서만) Node + `npm i -g eas-cli`, `eas login`(@yeomjungwon), secrets/ 키 파일 복사
- [ ] Cowork에서 이 repo 폴더(C:\dev\wantsome 등) 연결

## 7. 알려진 함정
- **파일 마운트 unlink 차단**: `rm` 실패함 → 삭제 대신 0바이트로 비우거나 rename. 큰 파일은 Edit/Write 툴이 truncate 사고 낸 적 있어 `bash cat >`/python으로 쓰는 게 안전.
- **ASC localization 저장 실패 = display name에 이모지** 들어가면 에러. 평문만.
- **삭제된 IAP product ID는 Apple이 영구 점유** → `_v2` 접미사 사용중.
- Apple 계정 잠김(-20209) 이력 → iforgot로 해제 완료.
