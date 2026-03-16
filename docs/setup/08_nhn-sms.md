# 08. NHN Cloud SMS 전환 (Twilio → NHN Cloud Toast)

> **선행 조건:** 사업자 등록 완료 ✅, Twilio 현재 사용 중
> **소요 시간:** 1~2일 (발신번호 심사 포함)
> **비용:** 8원/건 (Twilio 62원/건 대비 **7.7배 절감**)
> **왜 필요한가:** Twilio는 임시 해결책. 규모 확장 시 SMS 비용이 크게 줄어듦.

---

## 비용 비교

| 건수/월 | Twilio ($0.045) | NHN Cloud (8원) | 절감액 |
|---------|-----------------|-----------------|--------|
| 1,000건 | 62,000원 | 8,000원 | 54,000원 |
| 5,000건 | 310,000원 | 40,000원 | 270,000원 |
| 10,000건 | 620,000원 | 80,000원 | 540,000원 |

---

## Step 1. NHN Cloud 계정 생성

1. [console.nhncloud.com](https://console.nhncloud.com) 접속
2. **회원가입** (법인/사업자 계정)
3. 회원가입 시 사업자 정보 입력:
   ```
   사업자등록번호: [홈택스 발급번호]
   대표자명: [이름]
   회사명: 원썸
   ```

---

## Step 2. SMS 서비스 신청

1. NHN Cloud Console → **상품 이용** → **SMS** 검색 → **바로 이용**
2. 프로젝트 선택 또는 신규 생성:
   ```
   프로젝트명: wantsome
   ```
3. **Notification** → **SMS** → **서비스 활성화**

---

## Step 3. 발신번호 등록 (중요)

한국 통신법상 SMS 발신번호는 반드시 사전 등록 필요.

1. SMS 콘솔 → **발신번호 관리** → **발신번호 등록**
2. 유형 선택:
   - **대표번호** (권장): 사업자 대표 전화번호
   - 또는 **일반번호**: 본인 명의 번호
3. 제출 서류:
   - 사업자등록증
   - 통신서비스 이용증명원 (해당 번호의 명의자 증명)
4. 심사: **1~3영업일**
5. 승인 완료 후 발신번호 사용 가능

```
등록 발신번호 예시: 02-xxxx-xxxx 또는 010-xxxx-xxxx
```

---

## Step 4. API 키 발급

1. NHN Cloud Console → 우측 상단 **계정** → **API 보안 설정**
2. **User Access Key ID** + **Secret Access Key** 발급
3. SMS 콘솔 → **앱키(AppKey)** 확인:

```
AppKey: xxxxxxxxxxxxxxxxxxx
SecretKey: xxxxxxxxxxxxxxxxxxx
```

---

## Step 5. Supabase Custom SMS Provider 설정

Supabase는 Twilio 외에 **Custom SMS Provider** (Edge Function)를 지원합니다.

### 5-1. Edge Function 생성

`server/supabase/functions/sms-provider/index.ts` 파일 생성:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const NHN_APP_KEY = Deno.env.get("NHN_APP_KEY")!
const NHN_SECRET_KEY = Deno.env.get("NHN_SECRET_KEY")!
const NHN_SENDER = Deno.env.get("NHN_SENDER_NUMBER")! // 등록된 발신번호

serve(async (req) => {
  const { phone, otp } = await req.json()

  const body = {
    body: `[wantsome] 인증번호: ${otp} (5분 이내 입력)`,
    sendNo: NHN_SENDER,
    recipientList: [{ internationalRecipientNo: phone }]
  }

  const res = await fetch(
    `https://api-sms.cloud.toast.com/sms/v3.0/appKeys/${NHN_APP_KEY}/sender/sms`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Secret-Key": NHN_SECRET_KEY,
      },
      body: JSON.stringify(body),
    }
  )

  const data = await res.json()

  if (data.header?.isSuccessful) {
    return new Response(JSON.stringify({ messageId: data.body?.data?.requestId }))
  } else {
    return new Response(
      JSON.stringify({ error: data.header?.resultMessage }),
      { status: 400 }
    )
  }
})
```

### 5-2. Edge Function 배포

```bash
cd server
supabase functions deploy sms-provider --project-ref ftnfdtvaxsvosdyjdxfq
```

환경 변수 설정:
```bash
supabase secrets set NHN_APP_KEY=xxxxxxxxxxx --project-ref ftnfdtvaxsvosdyjdxfq
supabase secrets set NHN_SECRET_KEY=xxxxxxxxxxx --project-ref ftnfdtvaxsvosdyjdxfq
supabase secrets set NHN_SENDER_NUMBER=0212345678 --project-ref ftnfdtvaxsvosdyjdxfq
```

### 5-3. Supabase Phone Provider 변경

Supabase Dashboard → **Authentication** → **Providers** → **Phone**:

```
SMS provider: Custom
Endpoint: https://ftnfdtvaxsvosdyjdxfq.supabase.co/functions/v1/sms-provider
```

기존 Twilio 설정 제거 후 **Save**.

---

## Step 6. 테스트

1. 앱에서 전화번호 로그인 시도
2. NHN Cloud Console → **SMS** → **발송 목록** → 발송 기록 확인
3. 수신된 SMS의 발신번호가 등록 번호인지 확인

---

## 완료 체크

- [ ] NHN Cloud 사업자 계정 생성
- [ ] SMS 서비스 활성화
- [ ] 발신번호 등록 신청 → 심사 완료 (1~3일)
- [ ] API AppKey / SecretKey 확인 및 저장
- [ ] Edge Function 작성 + 배포
- [ ] Edge Function 환경 변수 3개 설정
- [ ] Supabase Phone Provider → Custom으로 변경
- [ ] 앱에서 SMS 수신 테스트 ✅
- [ ] NHN Cloud 발송 목록에서 성공 확인 ✅
- [ ] Twilio 계정 및 번호 해지 (비용 절감)
