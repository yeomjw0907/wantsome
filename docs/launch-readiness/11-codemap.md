# 11. Code Map — 결제·인증·민감 경로 인벤토리

요약: ✅ 매핑 완료. Phase 1·2 에이전트들이 file:line으로 바로 점프할 baseline.
범위: React Native/Expo 클라(루트) + Next.js 서버(`server/`) + Supabase
**제외**: `wantsome/` 사본 디렉터리 (이전 워크트리 잔재, 라이브 서버 미사용)

---

## A. 결제·포인트 경로

### IAP 검증·포인트 지급
- [verify-iap POST](../../server/app/api/payments/verify-iap/route.ts:10) — Bearer 검증 → idempotency 체크 → RPC `verify_iap_charge`
  - 첫충전 2배 보너스: line:100~107
  - 레이트 제한: 유저당 1시간 5회 (line:58)
- [verify_iap_charge RPC](../../server/supabase/migrations/017_atomic_transactions.sql:7) — point_charges INSERT + users.points UPDATE 원자적

### 포인트 차감 위치
| 경로 | 위치 | 차감 단위 |
|---|---|---|
| 영상통화 분당 차감 | [calls/tick/route.ts:145](../../server/app/api/calls/tick/route.ts:145) | PER_MIN_RATES (blue 900P/red 1300P) |
| 통화 종료 정산 | [end_call_atomic RPC](../../server/supabase/migrations/017_atomic_transactions.sql:62) | points_charged |
| 라이브 입장 | [live/rooms/[id]/join/route.ts:58](../../server/app/api/live/rooms/[id]/join/route.ts:58) | LIVE_ENTRY_FEE_POINTS = 50,000P [(server/lib/live.ts:3)](../../server/lib/live.ts:3) |
| 선물 (통화) | [gifts/route.ts:85](../../server/app/api/gifts/route.ts:85) | [100, 300, 500, 1000, 3000, 5000]P |
| 선물 (라이브) | [gifts/route.ts:157](../../server/app/api/gifts/route.ts:157) | 동일 |
| 예약 보증금 | [reservations/route.ts:143](../../server/app/api/reservations/route.ts:143) | calcReservationDeposit() |
| 굿즈 결제 | [orders/route.ts:98](../../server/app/api/orders/route.ts:98) | 상품 가격 |
| 채팅방 unlock | [conversations/route.ts:82](../../server/app/api/conversations/route.ts:82) | 500P (DB system_config) |

### 포인트 환불 경로
- 라이브 ACK 타임아웃 환불: [live/tick/route.ts:46](../../server/app/api/live/tick/route.ts:46) → `increment_user_points`
- 예약 실패 롤백: [reservations/route.ts:170](../../server/app/api/reservations/route.ts:170) → `add_points`
- 굿즈 주문 실패 롤백: [orders/route.ts:120](../../server/app/api/orders/route.ts:120)

### 정산 계산 (creator_earning)
- 분당 정산: [calls/tick/route.ts:116](../../server/app/api/calls/tick/route.ts:116) `Math.floor(points_charged * settlement_rate)`
- 통화 종료 정산: [calls/[id]/end/route.ts:51](../../server/app/api/calls/[id]/end/route.ts:51)
- 월별 정산: [settlements/run/route.ts:10](../../server/app/api/settlements/run/route.ts:10) (Vercel Cron 매월 15일)
  - **⚠️ DEFAULT_SETTLEMENT_RATE = 0.55** (line:7) — DB default 0.5와 불일치 (Phase 1B Critical)

### Idempotency 사용
- IAP: idempotency_key 중복 체크 [verify-iap:68](../../server/app/api/payments/verify-iap/route.ts:68)
- 통화 종료: end_call_atomic 내 ended 상태 체크

---

## B. 인증·권한 경로

### 로그인
- [phone-login POST](../../server/app/api/auth/phone-login/route.ts:11) — Bearer → users upsert, first_charge_deadline 72h 세팅
- social-login: server/app/api/auth/social-login/route.ts

### 미들웨어 (역할 기반)
- [middleware.ts:19](../../server/middleware.ts:19)
  - /admin: sb-access-token 쿠키 검증 (line:30)
  - role: admin / superadmin (line:58~59)
  - **Superadmin 전용**: /admin/points, /admin/system, /admin/admins (line:5)
  - 헤더 주입: x-admin-role, x-admin-id (line:75~77)

### 서비스 롤 (RLS 우회 위험 지점)
- [createSupabaseAdmin()](../../server/lib/supabase.ts:15) — SUPABASE_SERVICE_ROLE_KEY 사용
- 사용 위치 점검 필요 (Phase 1A 우선)

### 본인인증·연령
- [age-check screen](../../app/(auth)/age-check.tsx:30) — 만 19세 클라이언트 계산, **AsyncStorage에만 저장 (서버 미전송)** ⚠️
- [phone-verify screen](../../app/(auth)/phone-verify.tsx) — OTP
- 신분증 (Red 자격): [creators/upload-id](../../server/app/api/creators/upload-id/route.ts), [creators/verify-account](../../server/app/api/creators/verify-account/route.ts), [admin approve](../../server/app/admin/api/creators/[id]/approve/route.ts)

---

## C. 클라이언트 시크릿·환경변수

### EXPO_PUBLIC_* (클라 노출)
- EXPO_PUBLIC_API_BASE_URL ([app/lib/api.ts](../../lib/api.ts))
- EXPO_PUBLIC_SUPABASE_URL ([app/lib/supabase.ts](../../lib/supabase.ts))
- EXPO_PUBLIC_SUPABASE_ANON_KEY (위 파일)
- EXPO_PUBLIC_AGORA_APP_ID ([call/[sessionId].tsx](../../app/(app)/call/[sessionId].tsx), [live/[roomId].tsx](../../app/(app)/live/[roomId].tsx))
- EXPO_PUBLIC_PORTONE_STORE_ID, EXPO_PUBLIC_PORTONE_CHANNEL_KEY (.env.local)

### 서버 전용 (커밋 금지)
- SUPABASE_SERVICE_ROLE_KEY
- AGORA_APP_CERTIFICATE ([server/lib/agora.ts:13](../../server/lib/agora.ts:13))
- CRON_SECRET ([calls/tick:21](../../server/app/api/calls/tick/route.ts:21), [live/tick:11](../../server/app/api/live/tick/route.ts:11), [settlements/run:12](../../server/app/api/settlements/run/route.ts:12))
- APPLE_IAP_SHARED_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON
- PORTONE_SECRET (예정)
- SLACK_WEBHOOK_URL ([settlements/run:99](../../server/app/api/settlements/run/route.ts:99))

### AsyncStorage
- `age_verified` — [age-check.tsx](../../app/(auth)/age-check.tsx) — **서버 검증 없음** (Phase 1C)

---

## D. 라이브룸 (1:N, Agora)

- 생성: server/app/api/live/rooms/route.ts
- 시작: server/app/api/live/rooms/[id]/start/route.ts
- 입장 + 차감: [live/rooms/[id]/join/route.ts:17](../../server/app/api/live/rooms/[id]/join/route.ts:17) RPC `live_join_room`
- 환불 (ACK 타임아웃 10s): [live/tick/route.ts:24](../../server/app/api/live/tick/route.ts:24)
- 자동 종료: [live/tick/route.ts:76](../../server/app/api/live/tick/route.ts:76)
- 어드민 모더레이션: server/app/admin/api/live/rooms/[id]/moderation/route.ts

상태 전이: `ready → live (start) → ended (tick auto / end)`
참가자 role: host / viewer / admin

---

## E. 1:1 영상통화 (Agora)

- 시작: server/app/api/calls/start/route.ts
- 분당 tick: [calls/tick/route.ts:18](../../server/app/api/calls/tick/route.ts:18) (Vercel Cron 매분)
  - pending timeout 30초 (line:29~57)
  - active 차감 (line:145)
  - low_points 경고: 잔액 < 2분치 (line:152~165)
- 종료: server/app/api/calls/[id]/end/route.ts
- 분당 단가: [constants/products.ts:25](../../constants/products.ts:25)
- Agora 토큰 생성: [server/lib/agora.ts:30](../../server/lib/agora.ts:30) — 1시간 유효, role publisher/subscriber

---

## F. 굿즈·주문

- 공개 조회: server/app/api/products/route.ts
- 어드민 등록: server/app/admin/api/products/route.ts
- 주문 생성: [orders/route.ts:49](../../server/app/api/orders/route.ts:49)
  - 포인트 확인 + 차감 + 주문 INSERT + 재고 UPDATE
  - 롤백 (line:120)
- 환불 (어드민): server/app/admin/api/orders/[id]/refund/route.ts

---

## G~L. 그 외 (요약)

- **약관/PIP**: [server/app/terms/page.tsx](../../server/app/terms/page.tsx), [server/app/privacy/page.tsx](../../server/app/privacy/page.tsx) — Phase 2F 검증
- **푸시**: server/app/api/push/register/route.ts — push_tokens 테이블 upsert
- **어드민**: /admin/* — middleware.ts 권한 검증
  - admin/api/{points, creators, orders, settlements, reports, users, system, live, admins, banners}
- **정산**: 월 15일 09:00 Cron, 원천징수 3.3% (`WITHHOLDING_RATE`)
- **Agora 토큰**: 개발모드 certificate 없으면 null ([server/lib/agora.ts:35](../../server/lib/agora.ts:35))

---

## 보안·컴플라이언스 우려 지점 (Phase 1·2 입력)

| 우선순위 | 영역 | 위치 | 우려 |
|:---:|---|---|---|
| 🔴 | 결제 | [settlements/run:7](../../server/app/api/settlements/run/route.ts:7) | DEFAULT_SETTLEMENT_RATE 0.55 vs DB 0.5 불일치 |
| 🔴 | 결제 | 정책상 0.35 변경 필요 | 가격 정책 변경 PR 진행 중 |
| 🟠 | 인증 | [age-check.tsx](../../app/(auth)/age-check.tsx) | 클라 단독 연령 검증, 서버 검증 없음 |
| 🟠 | 결제 | [createSupabaseAdmin](../../server/lib/supabase.ts:15) 호출 위치 전수 검토 | RLS 우회 정당성 |
| 🟠 | 라이브 | LIVE_ENTRY_FEE_POINTS 50,000P 하드코드 | 가격 정책에 미반영 (낮춰야 할 가능성) |
| 🟡 | UX | GIFT_ITEMS vs GIFT_TIERS 불일치 | 통화 시점/히스토리 라벨 다름 |
| 🟡 | 정합 | [docs/app-store-iap-copy.md](../../docs/app-store-iap-copy.md) | storeId·가격 stale |
| 🟡 | 정리 | [wantsome/](../../wantsome) | 사본 디렉터리 잔재 |
