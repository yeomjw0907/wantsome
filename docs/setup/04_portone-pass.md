# 04. PortOne PASS 본인인증 설정

> **선행 조건:** 사업자 등록 완료 ✅
> **소요 시간:** 계약 신청 1일 + 심사 3~5영업일
> **비용:** 건당 과금 (NICE/KMC 기준 약 100~200원/건)
> **왜 필요한가:** 현재 생년월일 입력(fallback 모드)으로 임시 성인 확인 중. PASS 연동 시 실명+나이 법적 인증으로 전환됨.

---

## 현재 상태 vs 목표

| 구분 | 현재 (Fallback) | 목표 (PASS) |
|------|----------------|-------------|
| 인증 방법 | 생년월일 직접 입력 | 통신사 PASS 앱 본인인증 |
| 법적 효력 | 없음 (자기신고) | 있음 (실명인증) |
| 위변조 가능성 | 있음 | 없음 |
| CI 중복 방지 | 없음 | 있음 |
| 전환 방법 | `PORTONE_API_SECRET` 환경 변수 추가만 하면 자동 전환 |

> ✅ **코드 변경 불필요** — 환경 변수 3개만 추가하면 `verify.tsx`가 자동으로 PASS 모드로 전환됩니다.

---

## Step 1. PortOne 콘솔 가입

1. [portone.io](https://portone.io) → **시작하기** 클릭
2. 회원가입 (이메일, 비밀번호)
3. 로그인 후 [console.portone.io](https://console.portone.io) 접속

---

## Step 2. 상점(Store) 생성

1. 콘솔 좌측 → **상점 관리** → **상점 추가**
2. 상점 정보 입력:
   ```
   상점명: wantsome
   사업자 유형: 개인사업자 / 법인 선택
   사업자등록번호: [홈택스에서 발급받은 번호]
   대표자명: [이름]
   사업장 주소: [주소]
   업태/종목: 정보통신업 / 온라인 플랫폼
   ```
3. **저장** → **Store ID** 확인:
   ```
   Store ID: store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

---

## Step 3. 채널 연동 (PASS 본인인증)

### 3-1. 본인인증 채널 추가

1. 콘솔 → **채널 관리** → **채널 추가**
2. PG사 선택: **NICE평가정보** 또는 **KMC한국모바일인증** 중 선택
   - NICE: 안정적, 많이 사용
   - KMC: 가격 저렴할 수 있음
3. 서비스 유형: **본인인증**

### 3-2. NICE 계약 (NICE 선택 시)

1. NICE평가정보에 직접 연락 또는 PortOne 콘솔에서 계약 신청
2. 제출 서류:
   - 사업자등록증 사본
   - 통장 사본 (정산용)
   - 이용 서비스 설명 (성인 영상통화 플랫폼)
3. 심사 완료 후 **MID(가맹점ID)** 발급
4. PortOne 콘솔 → 채널 → NICE MID 입력

### 3-3. Channel Key 확인

채널 생성 완료 후:
```
Channel Key: channel-key-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## Step 4. API Secret 발급

1. 콘솔 우측 상단 → **개발자** → **API Keys**
2. **V2 API Key** → **발급하기**
3. API Secret 복사:
   ```
   API Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   > ⚠️ 한 번만 표시됨. 반드시 즉시 저장.

---

## Step 5. 환경 변수 추가 (Vercel)

1. [vercel.com](https://vercel.com) → wantsome 서버 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 다음 3개 추가:

| Key | Value | 환경 |
|-----|-------|------|
| `PORTONE_API_SECRET` | `[Step 4에서 발급한 API Secret]` | Production, Preview |
| `PORTONE_STORE_ID` | `store-xxxxxxxxxx` | Production, Preview |
| `PORTONE_CHANNEL_KEY` | `channel-key-xxxxxxxxxx` | Production, Preview |

4. **Save** 클릭
5. **Deployments** → **Redeploy** (환경 변수 적용)

---

## Step 6. 활성화 확인

환경 변수 추가 후:

1. 앱 실행 → 로그인 → terms → **verify 화면**
2. 생년월일 입력 화면 대신 **"PASS로 본인인증"** 버튼이 표시되면 성공 ✅
3. PASS 버튼 클릭 → 통신사 PASS 앱 열림 → 인증 완료 확인

---

## Step 7. 로컬 개발 환경 설정

`server/.env.local` 파일에 추가:
```env
PORTONE_API_SECRET=your-api-secret
PORTONE_STORE_ID=store-xxxxxxxxxx
PORTONE_CHANNEL_KEY=channel-key-xxxxxxxxxx
```

---

## 인증 흐름 (기술 참고)

```
앱: POST /api/auth/create-identity-verification
    ↓
서버: PortOne API → 본인인증 세션 생성
    ↓ { identityVerificationId, url }
앱: WebBrowser.openAuthSessionAsync(url, "wantsome://auth/verify-callback")
    ↓ 사용자: PASS 앱에서 지문/생체 인증
서버: POST /api/auth/verify-identity { identityVerificationId }
    ↓
서버: PortOne API → 인증 결과 조회 (이름, 생년월일, CI)
    ↓ 만 19세 확인 + CI 중복 확인
서버: users 테이블 is_verified=true, ci=CI값 저장
    ↓
앱: 인증 완료 → role 화면으로 이동
```

---

## 완료 체크

- [ ] PortOne 콘솔 가입
- [ ] 상점 생성 → Store ID 확인
- [ ] NICE/KMC 채널 계약 → Channel Key 확인
- [ ] V2 API Secret 발급 및 저장
- [ ] Vercel 환경 변수 3개 추가 + Redeploy
- [ ] 앱에서 PASS 버튼 표시 확인 ✅
- [ ] 실제 PASS 인증 테스트 ✅
- [ ] Supabase users 테이블에 `is_verified=true`, `ci` 값 저장 확인 ✅
