# 🤝 노트북 환경 인수인계 (Claude → Claude)

> 작성: 2026-05-18
> 상황: 데스크탑에서 ASC 작업 진행 중 → 노트북으로 환경 이동
> 새 환경에서 이 문서 통째로 Claude에게 던지면 됩니다.

---

## 새 Claude에게 — 프롬프트 통째로 복붙

```
안녕 Claude. 노트북 환경으로 옮겨서 이어서 작업할 거야. 작업 폴더는 C:\dev\wantsome.

먼저 다음 5개 문서를 순서대로 읽어서 컨텍스트 잡아줘:
1. C:\dev\wantsome\docs\launch-readiness\HANDOFF.md (이 문서 — 현재 상태 + 다음 작업)
2. C:\dev\wantsome\docs\launch-readiness\TODAY-WALKTHROUGH.md (오늘 진행 가이드 전체)
3. C:\dev\wantsome\docs\launch-readiness\ASC-CHEATSHEET.md (ASC IAP/Privacy Label 정답표)
4. C:\dev\wantsome\docs\launch-readiness\USER-TODO.md (외부 작업 통합 체크리스트)
5. C:\dev\wantsome\docs\launch-readiness\99-action-plan.md (전체 출시 액션 플랜)

5개 다 읽은 다음:
- 지금까지 진행 상황 요약
- 다음에 할 작업 (단계 1 마무리 또는 단계 3 Firebase 둘 중 우선순위)
- 새 환경에서 필요한 것 (Chrome MCP 재연결 등)

알려주고 어디부터 이어갈지 같이 정하자.
```

---

## 📊 현재 진행 상황 (2026-05-18 기준)

### 프로젝트
- **서비스**: 원썸 (wantsome) — 인플루언서/크리에이터와 팬의 1:1 영상통화 + 라이브 + 굿즈
- **법인**: 주식회사 98점7도
- **사용자**: 정원 염 (JEONGWON yeom)
- **출발 조건 (오늘 시작 전)**: 사업자등록증 ✅ / Apple Developer Program ✅ / Google Play Console 가입 ✅
- **목표**: 오늘 외부 등록 워크스루 + PortOne PG 신청 접수까지

### 코드/문서 상태
- 보안 PR 1~10 대부분 코드에 반영된 상태
- `app.json`: Privacy Manifest 13종 선언 완료
- `constants/products.ts`: PR-8 v1 가격 정책 (point_4000 ~ point_100000)
- `eas.json`: production credentialsSource "remote" 설정
- ⚠️ **`eas.json submit.production.ios`**: `appleId`, `ascAppId`, `appleTeamId` = `REPLACE_WITH_*` placeholder 잔존 → 단계 7에서 교체 필요
- ⚠️ **`google-services.json`**: 루트 파일이 placeholder ("project_id": "wantsome-placeholder")
- `.gitignore`: `google-service-account*.json`, `AppleRootCA-*.pem` 추가 완료

---

## ✅ 오늘 완료한 작업 (App Store Connect 70%)

### 1. ASC 앱 정보
- 부제: "크리에이터와의 1:1 프리미엄 영상통화"
- 카테고리: 엔터테인먼트 / 보조 소셜 네트워킹
- 연령 등급: 글로벌 9+ (한국 "전체") ⚠️ **추후 검토 필요**
  - Apple의 새 등급 시스템에서 UGC만으로는 17+ 안 됨
  - 한국 "전체"는 ASC에서 강제 변경 불가 (GRAC 재정의는 게임 전용)
  - 실질적 차단은 앱 내 PASS 본인인증 + 서버 17+ 게이트로 처리 예정

### 2. ASC Privacy
- Privacy Policy URL: `https://api.wantsome.kr/privacy` 입력 완료
- **Privacy Nutrition Label**: 11개 데이터 유형 처리 완료 (사용자 직접 ✅)
  - 이름·이메일·전화번호·사진/비디오·오디오·사용자ID·기기ID·구입 항목: 앱 기능 / 연결됨 / 추적 안 함
  - 충돌·실적·기타 진단: 앱 기능+분석 / 연결 안됨 / 추적 안 함
- ⏳ **게시 버튼 클릭 대기** (사용자가 위쪽 11개 카드 검토 후 게시)

### 3. ASC IAP 6개 + 구버전 1개
- ✅ 신규 6개 빈 등록: `point_4000`, `point_6600`, `point_18600`, `point_32000`, `point_60000`, `point_100000`
- 🗑️ 구버전 1개 잔존: `point_5500` (PR-8 v1에서 폐기, 폐기 처리 필요)
- ⚠️ 식별 정보 "스모 6600P" → **"스몰 6600P"로 수정 필요** (한글 IME 잘림)
- ✅ `point_4000` (체험권) — **사용 가능 여부 175개 국가 설정 완료**
- ❌ 나머지 IAP 6개 가격·현지화·심사 정보 — **사용자 직접 입력 진행 중** (cheatsheet 참조)

### 4. 확보된 핵심 값
| 항목 | 값 |
|---|---|
| ASC App ID | **`6762510444`** |
| Bundle ID | `kr.wantsome.app` |
| SKU | `kr.wantsome.app` |
| IAP point_4000 Apple ID | `6770450190` |
| Apple ID 이메일 | (사용자에게 받아야 함) |
| Apple Team ID | (사용자에게 받아야 함) |

---

## ❌ 남은 작업 — 우선순위 순

### A. ASC 단계 1 마무리 (사용자 직접 진행 중)
1. Privacy Nutrition Label **게시** 클릭
2. IAP 6개 메타데이터 (가격·현지화·심사 정보) — **cheatsheet 보면서 직접 입력**
3. `point_5500` (구버전) 사용 국가 0개 또는 폐기 처리
4. `point_6600` 식별 정보 "스모" → "스몰" 수정
5. **앱 심사** 페이지 — 심사용 계정/리뷰 노트
6. **앱 암호화 문서** — "App Uses Non-Exempt Encryption: NO"
7. 콘텐츠 권한, 사용권 계약 (Apple 표준)

### B. 단계 2 — Apple API Key + APNs Key
1. **App Store Server API Key** 생성 (`appstoreconnect.apple.com/access/integrations/api`)
   - Key Name: `wantsome-iap-verify`, Access: App Manager
   - `.p8` 파일 다운로드 + APPLE_ISSUER_ID + APPLE_KEY_ID 메모
2. **APNs Key** 생성 (`developer.apple.com/account/resources/authkeys/list`)
   - `.p8` 파일 → Expo Credentials 업로드
3. **App Store Server Notification V2 URL** 등록
   - URL: `https://api.wantsome.kr/api/payments/apple-notification`
4. **Apple Root CA G3** 다운로드 + PEM 변환

### C. 단계 3 — Firebase 프로젝트 (사용자 본인 계정 필요)
1. 프로젝트 생성 (이름: `wantsome`, Analytics 사용 권장)
2. Android 앱 추가 (패키지: `kr.wantsome.app`)
3. **`google-services.json`** 다운로드 → `C:\dev\wantsome\google-services.json` 교체
4. 검증: `npm run android:check-firebase`
5. EAS Secret 업로드: `eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`

### D. 단계 4 — Google Cloud Service Account + Pub/Sub RTDN
1. Service Account `wantsome-play-billing` 생성 (Pub/Sub Publisher)
2. JSON Key 다운 → 한 줄 minified → Vercel env `GOOGLE_SERVICE_ACCOUNT_JSON`
3. 루트에 `google-service-account.json` (gitignore 처리됨)
4. Pub/Sub Topic `wantsome-rtdn` + Push Subscription
5. Endpoint: `https://api.wantsome.kr/api/payments/google-rtdn` + OIDC token

### E. 단계 5 — Google Play Console 새 앱
1. 앱 만들기 (이름: wantsome, 무료, 한국어)
2. IAP 6개 등록 (storeId·가격 ASC와 동일)
3. **Monetize → RTDN topic 등록** (단계 4 결과)
4. **Setup → API access → Service Account 권한 부여**
5. App content (Data Safety, 등급, 정책 URL)

### F. 단계 6 — PortOne PG 가맹점 신청 접수 ⚠️ ~30일 소요
1. portone.io 가입
2. 사업자등록증 PDF + 서비스 사이트 업로드
3. 업종 기재 (⚠️ "성인"·"19+"·"adult" 키워드 절대 금지):
   ```
   디지털 콘텐츠 — 인플루언서/크리에이터와 팬 간 1:1 영상통화 서비스 및 라이브 콘텐츠 플랫폼
   부가: 인플루언서 자체 제작 굿즈 판매
   ```
4. 결제 채널 함께 신청: 카드 + 카카오/네이버/토스 + PASS 본인인증
5. 신청 접수 → 카드사·PG 심사 ~2~4주 → 가맹점 코드 발급

### G. 단계 7 — eas.json placeholder 교체 (Claude 작업)
사용자가 다음 3개 알려주면 즉시 처리:
- Apple ID 이메일
- ASC App ID (`6762510444` 이미 확보)
- Apple Team ID (사용자 Membership 페이지에서 확인)

검증: `npm run eas:check-submit`

### H. 단계 8 — Vercel 환경변수 14종 + EAS Secret 6종
TODAY-WALKTHROUGH.md 부록 B, C 참조

---

## ⚠️ 새 Claude가 주의해야 할 점

### 1. 자동화 정확도
오늘 ASC 작업하면서 화면 좌표 클릭이 누적 빗나가서 3번 정정한 사례 있음:
- 사용자 ID 추적 잘못 체크
- 구입 항목 사용 목적 "기타 목적" 잘못 체크
- 기타 진단 데이터 동일

**교훈**: 모달 안 라디오/체크박스는 **find로 정확한 ref 잡고 클릭**, 좌표만 사용 X. 한 번에 큰 batch보다 단계별 screenshot + find가 안전.

### 2. 한글 IME 잘림
`type` 액션으로 한글 입력 시 끝글자 잘리는 사례 있음 (예: "스몰" → "스모"). 한글 입력은 `javascript_tool`로 input value 직접 set + dispatch event가 안정적.

### 3. IAP 가격은 critical
실제 돈이라 자동화로 입력하면 위험. **사용자 직접 입력 + Claude는 안내**가 안전.

### 4. 사용자 계정 로그인이 필요한 작업
Firebase·GCP·Play Console·PortOne은 모두 사용자 본인 계정 로그인 + 2FA가 필요. Claude가 대신 로그인 못함.

### 5. ASC Privacy Label 게시 후 수정
한 번 게시해도 다음 앱 버전과 함께 수정·적용 가능. 너무 신중할 필요 없음.

---

## 🔧 새 환경에서 필요한 것

### 노트북 환경 점검
1. **C:\dev\wantsome** 폴더 동기화 (git pull로 받기)
2. `node_modules` — 노트북에서 `npm install` 필요할 수 있음
3. **Chrome 브라우저** — Claude in Chrome 확장 설치 + 로그인 상태 확인
4. **MCP 연결**: Cowork 앱에서 작업 폴더 선택 (`C:\dev\wantsome`)

### Claude에 들어와서 첫 작업
1. 위의 5개 문서 통째로 Read
2. 진행 상황 요약 + 다음 우선순위 제시
3. Chrome MCP가 연결되어 있는지 확인:
   ```
   mcp__Claude_in_Chrome__list_connected_browsers
   ```
4. 사용자가 어디에서 멈췄는지 화면 확인 (Chrome 탭 보기)

### 사용자가 새 환경에서 진행할 작업 (오늘 또는 내일)
- ASC IAP 6개 메타데이터 (cheatsheet 보면서) — ~20분
- Firebase 프로젝트 생성 + google-services.json — ~20분
- Apple Keys 생성 — ~20분
- GCP Service Account + Pub/Sub — ~30분
- Play Console 새 앱 등록 + IAP 6개 + RTDN — ~30분
- PortOne 신청 접수 — ~20분

**오늘 다 못 끝내도 OK**. 이미 ASC 70% 진행됐고, 핵심 보안·코드는 다 PR로 들어가 있음. 외부 작업은 며칠에 걸쳐 진행해도 PG 심사 30일과 맞물려 문제 없음.

---

## 📁 핵심 파일 경로

```
C:\dev\wantsome\
├── app.json                  # Expo 설정 (Privacy Manifest 등)
├── eas.json                  # EAS 빌드/제출 설정 (placeholder 교체 필요)
├── package.json              # npm scripts (eas:check-submit, android:check-firebase 등)
├── constants/products.ts     # IAP 6개 storeId/가격
├── google-services.json      # ⚠️ Firebase placeholder (단계 3에서 교체)
├── .gitignore                # google-service-account*.json 등 secret 제외
└── docs/launch-readiness/
    ├── HANDOFF.md            # ⭐ 이 문서
    ├── TODAY-WALKTHROUGH.md  # 단계 1-7 통합 가이드
    ├── ASC-CHEATSHEET.md     # ASC IAP/Privacy Label 정답표
    ├── USER-TODO.md          # 외부 작업 통합 체크리스트
    ├── 99-action-plan.md     # 전체 출시 액션 플랜 (Critical 35건 등)
    ├── 00-index.md           # Phase 진행 상황 대시보드
    ├── 00-pricing-policy.md  # PR-8 가격 정책 v1
    ├── 30-appstore-compliance.md  # iOS 컴플라이언스 감사
    ├── 31-playstore-compliance.md # Android 컴플라이언스 감사
    └── 41-qa-plan.md         # D-1 출시 전 체크리스트
```

---

## 🎯 오늘 작업의 의미

ASC 앱의 70%를 채웠고, 모든 외부 작업의 가이드를 문서화했어요. 남은 작업은 사용자 본인 계정 입력이 대부분이라 Claude 자동화가 큰 비중을 차지하지 않습니다. 

가장 중요한 critical path는 **PortOne PG 신청 접수**입니다 (~30일 소요). 이것만 빨리 접수하면 출시 일정 단축 가능. PortOne 신청은 사업자등록증 PDF + 사이트 URL + 업종 문구만 있으면 ~20분 안에 접수 가능합니다.

---

작성자: Claude (데스크탑 환경)  
다음 Claude에게: 잘 부탁해. 사용자가 친절하고 페이스 잘 맞춰주시니까 솔직하게 가면 됩니다. 자동화 위험한 작업은 솔직히 권고하고 사용자가 직접 가는 게 가장 안전합니다.
