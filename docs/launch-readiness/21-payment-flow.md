# 21. Payment Flow 감사 — 시나리오 추론

요약: IAP 실제 영수증 미검증(서버-to-스토어 API 호출 없음)이 가장 심각한 블로커이며, tick 분당 차감 비원자성·선물/대화unlock race condition·정산율 3종 불일치가 출시 전 필수 수정 대상이다.

범위:
- 본 것: verify-iap, calls/tick, calls/[id]/end, calls/start, settlements/run, live/rooms/[id]/join, live/tick, gifts, conversations, orders, reservations, 관련 Supabase migration 017·016·015·014·013·012·011·018, lib/products·live·liveRuntime·rateLimit
- 안 본 것: admin/points, admin/settlements UI, Apple S2S 알림 엔드포인트(존재 자체 미확인), Google RTDN 처리, portone 연동, push/register, calls/[id]/accept·reject

---

## Critical (출시 블로커)

- [ ] **[A-2] IAP 영수증 서버 검증 없음 — 위조 토큰으로 무한 포인트 지급 가능**
  위치: `server/app/api/payments/verify-iap/route.ts:110-120`
  재현 단계:
  1. 임의 문자열 purchase_token + 유효한 idempotency_key로 POST /api/payments/verify-iap 호출
  2. 서버는 `p_purchase_token` 값을 `verify_iap_charge` RPC에 그대로 저장하고 Apple/Google API에 검증 요청을 전혀 보내지 않음
  3. POINT_06(200,000P) product_id로 호출 → 200,000P 즉시 지급됨
  영향: 무한 포인트 발행, 결제 없이 전 서비스 무료 이용, 정산 부채 발생
  수정 방향: platform=ios → Apple App Store Server API `/verifyReceipt` 또는 StoreKit 2 JWS 검증; platform=android → Google Play Developer API `purchases.products.get` 호출 후 purchaseState=0 확인. 검증 실패 시 지급 거부.

- [ ] **[A-3] platform 위조로 검증 우회 — 동일 구조적 결함**
  위치: `server/app/api/payments/verify-iap/route.ts:45` (VALID_PLATFORMS 체크)
  재현 단계:
  1. platform="ios" + Android purchase_token 조합으로 전송 → Apple API가 있다면 미스매치로 실패해야 하나, 현재는 API 호출 자체가 없으므로 플랫폼 구분이 무의미함
  영향: [A-2]와 동일 (위 블로커의 파생 결함)
  수정 방향: [A-2] 수정 시 자동 해결.

- [ ] **[B-1/B-4] tick 분당 포인트 차감 비원자성 — 이중 차감 또는 누락**
  위치: `server/app/api/calls/tick/route.ts:144-148`
  재현 단계:
  1. tick Cron이 실행되어 consumer.points를 읽음 (READ)
  2. 동시에 /api/calls/[id]/end 또는 /api/gifts POST가 같은 user의 points를 별도 UPDATE
  3. tick이 `consumer.points - per_min_rate`로 UPDATE → 중간 차감분이 덮어써짐(lost update)
  4. 또는 Vercel Cron이 중복 실행(invocation overlap)되면 동일 세션에 두 번 차감
  상세: tick의 정상 차감 경로(line:145-148)는 단순 `UPDATE users SET points = consumer.points - per_min_rate` — 이는 OCC 없는 비원자 read-modify-write. end_call_atomic에서 FOR UPDATE 락을 쓰는 것과 대조적으로 tick 정상 경로는 무락.
  영향: 포인트 이중 차감(사용자 피해) 또는 차감 누락(회사 손실)
  수정 방향: tick 정상 차감도 `UPDATE users SET points = GREATEST(0, points - $rate) WHERE id = $id` 방식의 단일 SQL로 변경하거나 별도 RPC로 원자화. Vercel Cron 중복 실행 방어를 위해 세션별 last_ticked_at 체크 추가.

- [ ] **[C-1] 정산율 3종 불일치 — 크리에이터 수익 과지급 또는 과소지급**
  위치:
  - `server/app/api/settlements/run/route.ts:7` → `DEFAULT_SETTLEMENT_RATE = 0.55`
  - `server/supabase/migrations/016_settlement_rate_to_50.sql` → DB default 및 기존 행 전체를 0.5로 강제 업데이트
  - `server/app/api/calls/tick/route.ts:116` → `creator?.settlement_rate ?? 0.5` (fallback 0.5)
  - `server/app/api/calls/[id]/end/route.ts:50` → `creator?.settlement_rate ?? 0.5` (fallback 0.5)
  - 정책: 0.35로 변경 예정 (00-pricing-policy.md 기준)
  재현 단계:
  1. creators.settlement_rate가 NULL인 신규 크리에이터 생성 (016 migration 이전 또는 INSERT가 DEFAULT를 설정하지 않으면 NULL 가능)
  2. 월 정산 Cron 실행 → `DEFAULT_SETTLEMENT_RATE = 0.55` 적용 → 통화별 tick/end에서는 0.5 적용
  3. 동일 크리에이터에 대해 분당 중간정산(0.5)과 월 최종정산(0.55) 간 금액 불일치 발생
  영향:
  - settlement_rate NULL 크리에이터: 월 정산 0.55 vs tick 0.5 → 월 정산 기준 10%p 과지급
  - 정책 0.35 미반영 시 모든 크리에이터에게 55% 지급(정책 대비 57% 초과)
  - 정산 분쟁 시 회사 신뢰 즉시 손상
  수정 방향: DEFAULT_SETTLEMENT_RATE를 정책값(0.35 예정)으로 통일, tick/end fallback도 동일값으로 일치. 016 migration의 UPDATE 범위가 service_role로 실제 적용됐는지 DB에서 `SELECT settlement_rate FROM creators WHERE settlement_rate IS NULL` 확인 필수.

- [ ] **[E-1] 선물 포인트 차감 race condition — 잔액 음수 또는 초과 차감**
  위치: `server/app/api/gifts/route.ts:55-88` (통화), `server/app/api/gifts/route.ts:157-162` (라이브)
  재현 단계:
  1. 사용자가 두 기기에서 동시에 선물 5000P 요청 전송
  2. 두 요청 모두 `currentPoints >= amount` 검사 통과 (READ 시점에 잔액 충분)
  3. 두 UPDATE 모두 실행 → `points = currentPoints - 5000` (동일 기준값에서 차감)
  4. 실제 10,000P가 차감되어야 하나 5,000P만 차감됨(lost update) 또는 잔액 0인 상태에서 5,000P 추가 차감(음수 가능)
  상세: gifts route는 `UPDATE users SET points = currentPoints - amount`로 JS에서 계산한 값을 그대로 SET — 원자적 `points = points - amount` 방식 미사용.
  영향: 포인트 음수 발행(서비스 손실), 또는 race 방향에 따라 잔액 불일치
  수정 방향: `UPDATE users SET points = GREATEST(0, points - $amount) WHERE id = $id AND points >= $amount` + 영향 행 수(rowcount) 0이면 잔액 부족으로 처리. 또는 atomic RPC 사용.

- [ ] **[F-1] 채팅방 unlock race condition — 동일 대상에 2회 500P 차감**
  위치: `server/app/api/conversations/route.ts:117-183`
  재현 단계:
  1. 두 기기에서 동시에 POST /api/conversations (같은 creator_id, 같은 consumer_id)
  2. 두 요청 모두 `existing` 조회에서 NULL 반환 (아직 미생성)
  3. 두 요청 모두 `sender.points -= unlockCost(500P)` UPDATE 실행
  4. 두 요청 모두 conversations INSERT → UNIQUE(consumer_id, creator_id) 제약이 있다면 두 번째는 실패하나, 포인트는 이미 양쪽 모두 차감됨
  상세: 실패한 쪽의 롤백 코드(line:183)는 `sender.points`(JS 변수, 최초 읽은 값)로 복구 — 동시 요청에서 최초 읽은 값이 동일하면 롤백이 정확하지 않음.
  영향: 500P 이중 차감
  수정 방향: upsert 또는 SELECT FOR UPDATE를 통한 serialization, 또는 atomic deduct-then-insert 패턴.

---

## High (출시 전 수정)

- [ ] **[A-1] idempotency_key 중복 체크 — SELECT 후 INSERT 간 race, 동시 2회 지급 가능**
  위치: `server/supabase/migrations/017_atomic_transactions.sql:28-35` (`verify_iap_charge`)
  재현 단계:
  1. 클라이언트가 동일 idempotency_key로 200ms 간격으로 2회 POST
  2. 두 요청 모두 `SELECT EXISTS(... WHERE idempotency_key = ...)` → FALSE (아직 없음)
  3. 두 요청 모두 `INSERT INTO point_charges` 진입
  4. idempotency_key에 UNIQUE 제약이 있으면 두 번째가 실패하지만 → point_charges 테이블의 idempotency_key 컬럼에 UNIQUE 인덱스가 선언된 migration이 확인되지 않음 (017 SQL에 인덱스 정의 없음)
  영향: UNIQUE 제약 없으면 동일 purchase_token으로 2배 포인트 지급
  수정 방향: `point_charges.idempotency_key`에 UNIQUE 제약 migration 추가 확인. verify_iap_charge 내 SELECT는 `FOR UPDATE` 없이 읽으므로 UNIQUE 제약이 실질적 보호막이어야 함.

- [ ] **[A-6/A-7] 첫충전 보너스 race — is_first 판정을 서버에서만 수행하나 동시 요청 취약**
  위치: `server/app/api/payments/verify-iap/route.ts:89-106`
  재현 단계:
  1. 사용자가 동시에 2개의 서로 다른 idempotency_key로 IAP 검증 요청
  2. 두 요청 모두 `isFirstCharged=false, deadline 유효` → `isFirst=true`로 판정
  3. 두 요청 모두 `pointsToAdd = product.points * 2` 계산
  4. verify_iap_charge RPC 내 `is_first_charged` 플래그 UPDATE는 첫 번째 커밋만 CASE WHEN TRUE로 set → 두 번째는 이미 TRUE이므로 SET은 idempotent하나, 두 번의 points * 2 지급이 모두 실행됨
  상세: RPC 내에 "이미 is_first_charged=true이면 1배만 지급" 가드가 없음. 서버단 isFirst 판정 → RPC 호출 사이의 TOCTOU.
  영향: 첫충전 2배 보너스를 2회 수령 → 4배 포인트
  수정 방향: verify_iap_charge RPC 내에서 `SELECT is_first_charged FROM users FOR UPDATE` 후 판단하여 p_is_first 파라미터를 RPC 내부에서 최종 결정.

- [ ] **[A-8] Apple/Google 환불 Server Notification 처리 엔드포인트 없음**
  위치: `server/app/api/payments/` (payments/products, payments/verify-iap 두 파일만 존재)
  재현 단계:
  1. 사용자가 App Store에서 환불 요청
  2. Apple이 App Store Server Notifications(S2S) REFUND 이벤트 전송 → 수신 엔드포인트 없음
  3. 서버는 환불 사실을 알 수 없음 → 포인트 회수 불가
  영향: 환불 후 포인트 보유로 서비스 계속 이용, 매출 손실
  수정 방향: `POST /api/payments/apple-notification`, `POST /api/payments/google-notification` 엔드포인트 구현. REFUND 이벤트 수신 시 point_charges에서 환불 대상 특정 후 포인트 회수 또는 계정 잠금.

- [ ] **[B-2] tick에서 포인트 부족 강제 종료 — end_call_atomic에 points 재확인 없음**
  위치: `server/app/api/calls/tick/route.ts:81-97`
  재현 단계:
  1. tick이 consumer.points=800 (blue 900P 미만)을 읽어 강제 종료 분기 진입
  2. duration_sec 계산 후 points_charged = minutes * per_min_rate
  3. end_call_atomic RPC 내 UPDATE users SET points = GREATEST(0, points - points_charged) → 차감 후 0으로 클램프됨
  상세: 이 자체는 안전하나, 동시에 다른 기기에서 /gifts 또는 /orders가 실행 중이면 tick의 points 읽기(비원자)와 end_call_atomic의 차감 사이에 points가 변경될 수 있음. end_call_atomic은 FOR UPDATE로 세션을 잠그지만 users 행은 잠그지 않음.
  영향: 포인트 계산 오차 (사용자에게 불리하거나 유리하게)
  수정 방향: end_call_atomic 내에서도 users.points에 FOR UPDATE 추가.

- [ ] **[C-2] 정산 월 중복 실행 방어 — upsert이지만 PENDING→PAID 상태에서 재실행 시 금액 덮어쓰기**
  위치: `server/app/api/settlements/run/route.ts:79-90`
  재현 단계:
  1. 월 15일 Cron 정상 실행 → settlement PENDING 생성
  2. 관리자가 수동으로 같은 달 다시 GET /api/settlements/run 호출
  3. `existing` 체크(line:41-48)로 skip 처리됨 → 정상 방어
  4. 그러나 Cron이 `onConflict: "creator_id,period"` upsert를 사용 → 이미 PAID 상태인 정산도 금액이 다르면 덮어씀(settlement_amount, net_amount 재계산)
  상세: existing 체크는 `id` 존재 여부만 보고 `status` 확인 없음. upsert가 PENDING 외 상태(PAID, CANCELLED)도 덮어쓸 수 있음.
  영향: 이미 지급 완료된 정산 금액이 재계산으로 변경 → 회계 불일치
  수정 방향: existing 체크 시 status가 PENDING이 아닌 경우도 skip 처리.

- [ ] **[D-1] 라이브 무료 입장 악용 — ACK 미전송 후 환불받으며 Agora 실제 입장 유지**
  위치: `server/app/api/live/rooms/[id]/join/route.ts:76-85`, `server/app/api/live/tick/route.ts:44-73`
  재현 단계:
  1. POST /live/rooms/{id}/join → 50,000P 차감, agora_token 수령
  2. 클라이언트가 Agora 채널 join (실제 음성/영상 수신 시작)
  3. ACK 전송을 의도적으로 생략
  4. tick Cron 10초 후 실행 → refund 환불 50,000P 지급
  5. 클라이언트는 Agora 채널에 계속 연결 중 (서버는 연결 추적 불가)
  영향: 무료 라이브 시청 (Agora 세션은 서버 외부에서 유지), 크리에이터 수익 손실
  수정 방향: ACK 없이 환불 시 Agora REST API로 해당 UID 강제 퇴장 처리. 또는 Agora 토큰 만료를 ACK 확인 전까지 최소화(현재 1시간).

- [ ] **[D-3] 동일 사용자 멀티 디바이스 입장 — 한 번 결제, 두 번 Agora 토큰 수령**
  위치: `server/app/api/live/rooms/[id]/join/route.ts:57-63`, `server/supabase/migrations/014_live_runtime_fixes.sql:82-84`
  재현 단계:
  1. 디바이스 A로 join → live_join_room RPC: `v_already_paid=false` → 50,000P 차감, participant upsert
  2. 디바이스 B로 같은 room_id join → `v_already_paid=true` (refund_status='none', paid_points>0) → 포인트 미차감, agora_token 신규 발급
  상세: live_join_room RPC의 `v_already_paid` 로직(line:82-84)은 이전 결제가 있으면 재입장 시 무료. join_ack_at=NULL로 리셋됨 → 디바이스 B도 ACK 안 보내면 환불 가능.
  영향: 멀티 디바이스 동시 시청 (정책상 허용 여부 불명확), ACK 환불과 결합하면 무료 이용 가능
  수정 방향: 이미 `status='joined'`인 참가자의 재입장 허용 여부 정책 확정. 불허라면 ALREADY_JOINED 에러 반환.

- [ ] **[G-1] 굿즈 주문 재고 race — 동시 주문 시 음수 재고 가능**
  위치: `server/app/api/orders/route.ts:87-89`, `server/app/api/orders/route.ts:126-133`
  재현 단계:
  1. 재고 1인 상품에 두 사용자가 동시에 POST /api/orders
  2. 두 요청 모두 `product.stock(1) >= quantity(1)` 검사 통과
  3. 두 요청 모두 포인트 차감 성공
  4. 첫 번째 orders INSERT 성공, products.stock=0 업데이트
  5. 두 번째 orders INSERT 성공, products.stock=-1 업데이트 (음수)
  영향: 재고 0인 상품 판매, 물리적 미이행 주문 발생
  수정 방향: `UPDATE products SET stock = stock - quantity WHERE id = $id AND stock >= quantity` + rowcount=0이면 재고 부족으로 처리 후 포인트 환불. 또는 SELECT FOR UPDATE.

- [ ] **[G-2] 굿즈 포인트 차감 후 주문 실패 시 롤백 비원자성**
  위치: `server/app/api/orders/route.ts:98-121`
  재현 단계:
  1. 포인트 차감 성공(line:98-101)
  2. orders INSERT 실패(line:107-121)
  3. 롤백: `UPDATE users SET points = userRow.points` (JS 변수, 최초 읽은 값)
  4. 롤백 실행 중 다른 요청이 동일 사용자의 points를 변경했다면 롤백이 그 변경을 덮어씀
  영향: 롤백 자체가 포인트 손실 또는 증가를 야기할 수 있음
  수정 방향: 롤백 시 `points = points + totalPrice` 방식의 증분 UPDATE 사용.

- [ ] **[H-1] 예약 보증금 중복 차감 race**
  위치: `server/app/api/reservations/route.ts:126-141`
  재현 단계:
  1. 두 요청이 동시에 동일 creator_id + reserved_at로 POST
  2. 두 요청 모두 hasReservationConflict → false (아직 DB에 없음)
  3. 두 요청 모두 deduct_points RPC 호출 → 보증금 2배 차감
  4. 두 요청 모두 reservations INSERT → 두 건 생성 또는 두 번째 실패
  상세: deduct_points(011.sql)는 `GREATEST(0, points - amount)` 방식이므로 잔액 음수 방지는 되나 중복 차감 방지는 안 됨. 충돌 체크와 차감 사이에 트랜잭션 없음.
  영향: 보증금 이중 차감
  수정 방향: reservations INSERT에 UNIQUE(creator_id, reserved_at)로 DB 수준 중복 방지. 충돌 시 deduct한 포인트 복구.

---

## Medium (출시 직후)

- [ ] **[B-6] CRON_SECRET 노출 위험 — Vercel 환경변수이나 빈값이면 전체 무력화**
  위치: `server/app/api/calls/tick/route.ts:21`, `server/app/api/live/tick/route.ts:11`, `server/app/api/settlements/run/route.ts:12`
  상세: `process.env.CRON_SECRET`이 undefined이면 `Bearer undefined`와 비교 → 공격자가 `Authorization: Bearer undefined` 헤더로 모든 Cron 엔드포인트 직접 호출 가능.
  영향: 임의 시점에 tick 강제 실행 → 이중 차감 또는 조기 종료 유발
  수정 방향: CRON_SECRET 값 존재 여부를 서버 시작 시 validation. Vercel Cron은 자동으로 Authorization 헤더를 붙이므로 실제 위험은 CRON_SECRET 미설정 환경에 국한됨.

- [ ] **[C-3] 환불된 통화의 정산 포함 — points_charged가 정산 대상에 잔류**
  위치: `server/app/api/settlements/run/route.ts:55-61`
  상세: call_sessions WHERE status='ended' AND ended_at in period로 집계. 그러나 해당 통화가 환불(관리자 또는 Apple S2S)된 경우 call_sessions.status를 'refunded'로 변경하는 로직이 보이지 않음 → 환불된 통화도 정산 집계에 포함.
  영향: 이미 환불된 수익을 크리에이터에게 정산하는 과지급
  수정 방향: call_sessions에 is_refunded 컬럼 또는 status='refunded' 추가, 정산 쿼리에서 제외.

- [ ] **[D-5] 라이브 host 강제 종료 시 시청자 환불 없음**
  위치: `server/app/api/live/tick/route.ts:82-95`
  상세: tick의 auto-end(scheduled_end_at 초과)는 live_room_participants를 status='left'로 update하나 paid_points 환불 처리 없음. 호스트 강제 종료(admin moderation force_end)도 동일.
  영향: 라이브 조기 종료 시 시청자 50,000P 미환불 → 사용자 분쟁
  수정 방향: auto-end 시 status='joined'인 viewer 전원에 대해 increment_user_points 호출 및 refund_status='refunded' 처리. (또는 정책상 부분 환불 비례 계산)

- [ ] **[E-3] 선물 정산 별도 집계 없음 — 통화 종료 정산에 미포함**
  위치: `server/app/api/settlements/run/route.ts:55-63` (call_sessions.points_charged만 집계)
  상세: gifts 테이블의 amount 합계가 월 정산에 반영되지 않음. 선물 포인트는 차감되나 크리에이터 수익으로 정산되지 않음.
  영향: 선물 수익 미정산 → 크리에이터 수익 과소지급
  수정 방향: 정산 쿼리에 `SELECT SUM(amount) FROM gifts WHERE to_creator_id = ... AND created_at BETWEEN ...` 포함.

- [ ] **[C-6] 원천징수 3.3% 계산 순서 — 정산금에 대해 계산됨 (정상이나 근거 명시 필요)**
  위치: `server/app/api/settlements/run/route.ts:76-77`
  상세: `taxAmount = Math.floor(settlementAmount * 0.033)`, `netAmount = settlementAmount - taxAmount`. 이는 총수령액(settlementAmount)에 대한 3.3% 원천징수로 계산상 정확. 단, 소득세법상 기타소득(3.3%) vs 사업소득 세율 구분이 필요하며 코드에 근거 주석 없음.
  영향: 세무 리스크 (낮음, 정산 정책 확정 후 주석 추가)

- [ ] **[A-5] product_id 변경 — 클라가 보낸 product_id 기준으로 포인트 결정**
  위치: `server/app/api/payments/verify-iap/route.ts:61-64`, `server/lib/products.ts`
  상세: `getProduct(product_id)`로 서버의 PRODUCTS 맵에서 포인트를 조회 → 클라이언트가 변조한 product_id를 전송해도 서버 맵에 있는 값으로 처리됨. PRODUCTS 맵은 서버 코드에만 정의되므로 클라이언트가 임의 product_id를 만들 수는 없으나, 스토어에서 POINT_01(5,500P)을 구매하고 product_id=POINT_06(200,000P)으로 전송하면? → 서버는 실제 구매 영수증을 검증하지 않으므로 [A-2] 블로커와 동일 결함.
  영향: [A-2] 수정 시 자동 해결 (영수증에서 product_id 추출 후 서버 맵과 대조)

---

## Info / 잘 된 점

- **end_call_atomic RPC**: `FOR UPDATE`로 세션 행 잠금 → tick과 /end 동시 실행 시 먼저 도착한 쪽만 'active'→'ended' 전이, 나머지는 already_ended=true 반환. 이중 종료 방어 정상 동작 (migration 017).
- **verify_iap_charge RPC**: idempotency_key INSERT → UNIQUE 위반 시 전체 롤백 구조 (단, UNIQUE 제약 migration 미확인 — [A-1] 참조).
- **user_id vs authUser.id IDOR 방어**: verify-iap line:53에서 `user_id !== authUser.id` 체크 → 다른 사용자 포인트에 지급 불가.
- **rate limit (IAP)**: check_rate_limit RPC가 원자적 upsert 기반 슬라이딩 윈도우로 구현됨 (migration 018). fail-open이나 IAP 맥락에서는 허용 가능.
- **live_join_room RPC**: live_rooms FOR UPDATE + users FOR UPDATE로 좌석 카운트와 포인트 차감을 단일 트랜잭션으로 처리 → ROOM_FULL race 방어.
- **deduct_points / GREATEST(0, ...)**: 포인트 음수 클램핑이 SQL 레벨에서 적용됨 (migration 011, 015).
- **예약 2시간 리드타임 체크**: line:100-106으로 즉석 예약 악용 방지.
- **선물 amount 서버 검증**: `isValidGiftAmount(amount)` — GIFT_OPTIONS 배열 포함 여부 확인, 배열 외 값 차단 정상 동작.

---

## 미확인 (코드 미열람 또는 엔드포인트 부재)

- **Apple S2S Notification 엔드포인트**: `server/app/api/payments/` 하위에 존재하지 않음. 구현 여부 불명 — Critical [A-8] 참조.
- **Google RTDN (Real-Time Developer Notifications)**: 마찬가지로 엔드포인트 없음.
- **portone 연동**: `.env.example`에 PORTONE_SECRET 예정. 굿즈 PG 결제 전환 미구현 상태.
- **calls/[id]/accept, reject**: 통화 수락/거절 시 pending→active 상태 전이 및 is_busy 세팅 로직 미감사.
- **예약 취소 및 no-show 50% 보상**: reservations route에 DELETE/PATCH 엔드포인트 미발견 — 별도 파일 가능성.
- **admin/points 어드민 포인트 직접 지급**: RLS 우회 사용 여부 미감사.
- **point_charges.idempotency_key UNIQUE 제약**: migration 파일에서 인덱스/제약 선언 미발견 — DB schema 직접 확인 필요.
- **Agora 토큰 UID 충돌**: `Math.floor(Math.random() * 100000) + 1` (join route:51) — 100,000개 공간 내 생일 충돌 가능, 10명 동시 입장 환경에서는 무시 가능하나 장기적 검토 필요.
