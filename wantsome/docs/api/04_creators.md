# API — 크리에이터 & 정산 & 온보딩

## GET /api/creators/feed
피드용 크리에이터 목록

```ts
// Query
{ mode: 'blue' | 'red', page: number, limit: 20 }

// Response
{ creators: Creator[], total: number, hasMore: boolean }

// 정렬: 온라인 우선 → 탑 → 인기 → 일반 → 신규
// ORDER BY is_online DESC, grade_order ASC
```

---

## PATCH /api/creators/:id/online
온라인 상태 변경

```ts
// Request
{ is_online: boolean }

// Response
{ success: boolean }
// Supabase Realtime으로 피드 실시간 반영
```

---

## GET /api/creators/:id/earnings
수익 조회

```ts
// Response
{
  today: number,       // 당일 points_charged × settlement_rate
  month: number,       // 이번달 누적
  total: number,       // 전체 누적
  monthly_minutes: number
}
```

---

## POST /api/settlements/request
정산 신청 (매월 15일 Vercel Cron 자동 실행)

```ts
// vercel.json
{ "path": "/api/settlements/run", "schedule": "0 9 15 * *" }

// Logic
1. 전월 completed 세션 집계
   total_points = SUM(points_charged) WHERE creator_id AND month
2. gross_amount = total_points × settlement_rate
3. tax_amount   = gross_amount × 0.033
4. net_amount   = gross_amount - tax_amount
5. settlements INSERT
6. 관리자 슬랙 알림 (초기: 수동 이체)
```

---

## 크리에이터 온보딩 API

### POST /api/creators/sign-contract
용역계약서 전자서명 저장

```ts
// Request
{ userId: string, signatureImage: string, ip: string }  // signatureImage: base64

// Logic
1. 서명 이미지 + 계약서 텍스트 → PDF 생성
2. Supabase private bucket 업로드
3. creator_profiles.contract_signed_at, contract_pdf_path, contract_ip 업데이트
```

### POST /api/creators/upload-id
신분증 업로드 (크리에이터 인증 뱃지)

```ts
// Request: multipart/form-data { userId, file }

// Logic
1. private bucket 'id-cards/{userId}/{timestamp}.jpg' 업로드
2. creator_profiles.id_card_path 업데이트
```

### POST /api/creators/verify-account
계좌 실명조회 (PortOne)

```ts
// Request
{ userId: string, bankCode: string, accountNumber: string }

// Response
{ success: boolean, accountHolder: string }

// Logic
1. PortOne 계좌 실명조회 API 호출
2. 본인인증 verified_name과 대조
3. 일치 → account_number(암호화), account_holder 저장
```

### PATCH /api/admin/creators/:id/approve
관리자 승인

```ts
// Request
{ action: 'APPROVE' | 'REJECT', reason?: string }

// Logic (APPROVE)
1. creator_profiles.status = 'APPROVED'
2. creators 테이블 INSERT (활동 시작)
3. Expo Push Notification 발송 "크리에이터 심사가 완료됐습니다 🎉"

// Logic (REJECT)
1. creator_profiles.status = 'REJECTED', rejection_reason 저장
2. Push "재제출 요청: {reason}"
```

---

## 신고 API

### POST /api/reports
신고 접수

```ts
// Request
{
  reporter_id: string,
  target_id: string,
  call_session_id?: string,
  category: 'UNDERAGE'|'ILLEGAL_RECORD'|'PROSTITUTION'|'HARASSMENT'|'FRAUD'|'OTHER',
  description?: string
}

// Logic
1. reports INSERT
2. UNDERAGE | ILLEGAL_RECORD | PROSTITUTION →
   users.suspended_until = '9999-12-31' (즉시 정지)
   슬랙 긴급 웹훅 발송
3. 기타 → 관리자 일일 요약 슬랙
```
