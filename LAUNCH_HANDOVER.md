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

---

# ═══ DAY 2 UPDATE (2026-05-26) ═══

## 오늘 추가로 끝낸 것
- **Vercel 환경변수 9개 입력 완료** (Apple 6 + Google 3, 값 sha256 검증). 보류: GOOGLE_RTDN_AUDIENCE, PORTONE 3종.
- **서버 배포 성공 (commit 0684c93, READY)** — 아래 3개가 프로덕션(api.wantsome.kr)에 반영됨:
  1. `verify-identity` 생년월일 **폴백 복구** (PortOne 미설정 시) — 연령확인 막힘 해결
  2. `apple.ts` Sandbox/Production 폴백 (IAP 심사 대응)
  3. env 9개
- **연령확인 정상 작동 확인** (아이폰 TestFlight에서 생년월일 → 통과 ✓)
- **TestFlight 내부 테스터 그룹 "Internal Testers" 생성 + 본인(yeomjw0907@naver.com) 추가** → 아이폰에서 원썸 설치/실행 가능
- **스크린샷 4장 확보**: 홈, 마이페이지(프로필), 포인트 충전, 구매확인 다이얼로그 (실제 iOS 화면)

## 오늘 발견한 이슈 / 함정
- **package.json & package-lock.json 에 trailing NUL 바이트** 가 붙어 Vercel 빌드가 1차 실패했음(JSON parse error). → NUL 제거 후 재배포로 해결(0684c93). **이 작업 마운트는 파일 쓸 때 가끔 꼬리에 \x00 을 붙이므로, 파일 수정 후 반드시 `python -c "json.load(...)"` 또는 NUL 검사로 검증할 것.**
- **카카오 로그인 KOE004 (앱 관리자 설정 오류)** — 카카오 개발자 콘솔 설정 문제. 애플/구글 로그인은 정상이라 급하진 않음. 카카오 콘솔에서 카카오로그인 활성화 / 플랫폼(iOS 번들ID kr.wantsome.app) 등록 / 앱키 일치 확인 필요.
- 영상통화·라이브 화면 스크린샷은 실제 송출 크리에이터가 있어야 캡처 가능 → **이번 제출엔 제외**, 업데이트로 추후 추가.

## 내일(3일차) 바로 할 일 — 우선순위
1. **스크린샷 4장을 `C:\dev\wantsome\screenshots\` 에 넣기** (아이폰→PC: 카카오톡 나와의 채팅 / 케이블 등). 파일 준비되면 Claude가 App Store 사이즈(6.9" 1290×2796)로 가공.
2. **ASC 등록정보 작성**: 앱 부제/설명/키워드/지원URL/개인정보처리방침URL/카테고리/연령등급 + **스크린샷 업로드**.
3. **Privacy Nutrition Label 게시**.
4. **IAP 6개** (체험권4000/스몰6600/미디엄18600/라지32000/프리미엄60000/VIP100000) 메타데이터 + 심사용 스크린샷 첨부, "심사 준비 완료".
5. **빌드 선택** (Build 1) + Export compliance(이미 처리) → **심사 제출**.
6. **App Store Server Notifications V2 URL 등록 확인**: https://api.wantsome.kr/api/payments/apple-notification
7. (여유되면) **카카오 KOE004** 카카오 콘솔에서 수정.

## 진행률 (대략)
- iOS 심사 제출까지: ~80% (스크린샷 업로드 + 등록문구 + Privacy + IAP첨부 + 제출만 남음)
- 백엔드/서버: ~95% (PortOne 본인인증 전환 + GCP RTDN만 남음, 둘 다 외부 승인 대기)
- Android: ~20% (Play 본인확인 + 14일 비공개 테스트, 2주+)
- PG(다날) 승인: 접수완료, 심사대기 ~30일
- **전체 종합 ≈ 60%**

## 커밋/배포 상태
- 최신 커밋: `0684c93` (origin/main, Vercel READY)
- 미커밋 변경: 없음 (working tree clean 예상). screenshots/ 폴더는 비어있음(.gitignore 아님 — 스크린샷 넣으면 커밋 주의).

## Google Play 신원확인 (추가 메모 — 2026-05-26)
- **Google Play 개발자 신원확인 계정: `yeomjw097@tcsa.co.kr`** (원썸컴퍼니 / account 8590258685249335838) 로 진행.
- **본인확인(개발자 identity verification) 현재 진행 중 (대기 상태)** — 통과해야 Android 앱 등록/제출 가능. (Android는 이후 14일 비공개 테스트까지 있어 2주+ 소요.)

## 작업 환경 메모
- **내일은 노트북으로 진행할 수도 있음.** 노트북이면: ① repo `git clone` 또는 `git pull` 로 최신화(이 .md 포함), ② 브라우저에 Apple(App Store Connect)·Vercel·Google·카카오 로그인, ③ 스크린샷 파일을 `screenshots\` 에 두기. (비밀키 secrets/ 는 gitignore라 노트북엔 따로 옮겨야 함 — 단, iOS 심사 제출엔 비밀키 불필요. Android eas submit 때만 google-service-account.json 필요.)

## 다날(PortOne) 본인확인서비스 계약 — 2026-05-26 메일 도착
담당: 이지호 <jiholee@danal.co.kr>

### 전체 프로세스
신청서 검수 → 일반(지류)계약 → 원천사 심사(1~2주) → 선납금(1개월치) 납부 → 연동정보 전달
→ 그 다음 Vercel `PORTONE_*` env 입력 + 본인인증 PASS 자동 전환

### 제출 서류 (업로드된 양식: secrets/ 또는 uploads/ 에 있음)
1. **DI/CI 제공 신청서** (`DI,CI 제공신청서_양식.docx`) → 작성 + 인감 날인 → PDF로 메일 회신
   - 제공요청정보: **DI + CI 둘 다 체크 필수**
   - 연동 방식: **"서버to서버_표준창"** (WEB통신 X)
   - 2페이지 체크리스트: 전부 Y
   - 담당자정보: 비워도 됨 (마스킹)
2. **본인확인프로세스** (`본인확인프로세스_양식.pptx`, 예시 PDF 참고) → 메일 회신
   - 본인확인 사용 절차 흐름도
   - 앱/홈페이지 내 **사업자정보 화면 실제 캡처**
   - 사업자 필수정보 5종 필수: **상호 / 주소 / 사업자등록번호 / 대표자명 / 유선전화번호**
3. **구비서류 (등기 발송, 법인)**
   - 계약서(`본인확인서비스 이용계약서.docx`) 2부 — 부칙 포함, 간인, **법인 인감 날인**
   - 사업자등록증 사본 1부
   - 법인 인감증명서 원본 1부
   - 법인 등기부등본 원본 1부
   - 보낼 주소: 경기도 성남시 분당구 분당로 55, 9층 다날 이지호

### ⚠️ 컴플라이언스 즉시 점검 (코드 작업 가능)
- 앱/웹 "사업자정보" 화면에 **유선전화번호(또는 인터넷전화)** 노출 필수. 휴대폰 번호는 불가.
- 5종 모두 노출 확인: 상호, 주소, 사업자등록번호, 대표자명, **유선전화**.
- 노출 위치 예시: 마이페이지 > 설정 > 약관/회사정보, 또는 풋터.
- → 내일 코드 점검 + 누락 시 수정 (출시 차단요소).

### 신청서 작성 메모 ((주)98점7도)
- 회사명: (주)98점7도
- 사업자등록번호 / 대표자명: 사업자등록증 참조 (uploads/사업자등록증_(주)98점7도.pdf 있음)
- 주소: 사업장 주소 (수원) 또는 송도(실 운영지) — 사업자등록증 기준으로
- 서비스명/URL: 원썸(wantsome) / 도메인 — 앱이면 "다날(APP)" 라벨

### 일정 영향
- 신청서·프로세스 양식 회신 + 계약서 등기 발송 → 원천사 심사 1~2주 → 연동정보 수령
- 즉, **PortOne PASS 본인인증 활성화까지 약 2~4주** 예상. 그 사이 iOS는 생년월일 폴백으로 운영.
