# 20. Backend Security 감사

요약: RLS·SECURITY DEFINER·인증 흐름 전반에서 출시 블로커 다수. `users.points`/`role`을 클라이언트가 직접 변조 가능한 수준의 RLS 결함과 더미 본인인증 백도어가 공존.
범위:
- 본 것: `server/supabase/{001..008}.sql`, `server/supabase/migrations/{009..020}.sql`, `server/middleware.ts`, `server/lib/{supabase,adminAuth,rateLimit,agora,logger}.ts`, 결제·통화·라이브·예약·굿즈·선물·DM·푸시·신원인증·어드민(approve/reject/admins/system/points/settlements/upload/push) 핵심 라우트 30+, `eas.json`, 클라 `lib/supabase.ts`.
- 안 본 것: `posts/*`, `notifications/*`, `favorites`, `check-in`, `banners` 일부, `admin/api/me`, `admin/api/products`, `admin/api/banners`, `admin/api/users`, `admin/api/reports/[id]/action`, `admin/api/live/rooms/*`, `creators/[id]/online|profile|earnings|reviews|posts|schedules|slots|availability` (시간 제약).
- DB에서 실제 적용된 정책 dump는 미수집(코드/마이그레이션 정적 분석만). `products`/`orders`/`gifts`/`conversations`/`messages`/`notifications`/`push_tokens` 테이블은 마이그레이션 SQL이 저장소에 없어 RLS 상태 미확인.

---

## Critical (출시 블로커)

- [ ] **users 테이블의 `FOR ALL` 단일 RLS 정책이 클라이언트 직접 변조 허용** | 위치: `server/supabase/001_initial.sql:50-52` | 근거: `CREATE POLICY "users_self" ON users FOR ALL USING (auth.uid() = id)` — UPDATE에 컬럼 화이트리스트가 없어 `points`, `is_first_charged`, `role`, `is_verified`, `red_mode`, `blue_mode`, `birth_date`, `ci`, `verified_at`, `suspended_until`, `deleted_at` 등 **모든 컬럼이 본인 행에 한해 자유 변경 가능**. 클라이언트는 `EXPO_PUBLIC_SUPABASE_ANON_KEY`(`eas.json:19,32,42,55`)와 자기 access_token을 가지고 있어 서버 우회 가능. | 시나리오: ① 로그인 후 클라가 `supabase.from('users').update({ points: 999_999_999, role: 'superadmin', is_verified: true, red_mode: true }).eq('id', me)` 호출 → ② RLS 통과 → ③ 무한 포인트 + 어드민 패널 진입(미들웨어가 users.role을 신뢰) + 본인인증 바이패스 + Red 모드 진입. 결제·정산·접근통제 전체가 무효화됨. | 수정: users는 service_role만 UPDATE/INSERT 가능하게 정책 분할(`FOR SELECT USING (auth.uid()=id)`만 남기고 `FOR UPDATE`/`INSERT`/`DELETE` 정책 삭제). 변경이 필요한 모든 클라 흐름은 이미 서버 API 경유 중이므로 회귀 영향 적음. 별개로 닉네임/프로필/푸시토큰 자기 수정만 허용하려면 컬럼 화이트리스트 트리거 또는 별도 RPC(SECURITY DEFINER)로 분리.

- [ ] **creators의 `creators_self FOR ALL` 정책이 `settlement_rate` 자가 변조 허용** | 위치: `server/supabase/003_calls.sql:24-26` (003이 먼저 실행되어 정책이 잔존; 004에는 `creators_update_self FOR UPDATE`만 새로 만들고 003의 FOR ALL을 DROP하지 않음) | 근거: `CREATE POLICY "creators_self" ON creators FOR ALL USING (auth.uid() = id)` — 본인 행의 `settlement_rate`, `is_approved`, `live_enabled`, `grade`, `mode_red`, `is_busy`, `monthly_minutes`, `total_earnings`까지 자유 UPDATE 가능. | 시나리오: ① 크리에이터가 `update creators set settlement_rate=1.5, is_approved=true, live_enabled=true, grade='탑' where id=me` → ② 다음 정산 사이클(`server/app/api/settlements/run/route.ts:72,75`)에서 `Math.floor(totalPoints * 1.5)` 적용 → ③ 정산 금액이 매출보다 큰 손실. is_approved=true 셀프 승인으로 심사 우회. | 수정: 003의 `creators_self` DROP, 004 정책도 `FOR UPDATE WITH CHECK`에 column 제한 트리거 또는 service_role-only로 변경. SET 가능 컬럼은 `is_online`, `mode_blue` 정도로 제한.

- [ ] **`SECURITY DEFINER` 함수 전부 `SET search_path` 누락 → 권한 상승 가능** | 위치: `server/supabase/migrations/014_live_runtime_fixes.sql:6-24, 26-180` (`increment_user_points`, `live_join_room`), `server/supabase/005_reservations.sql:49-56,59-71` (`add_points`, `deduct_points`). `verify_iap_charge`/`end_call_atomic`은 SECURITY DEFINER 미지정이라 INVOKER 실행이지만 admin client에서 호출되므로 영향은 적음. | 근거: SECURITY DEFINER 함수에 `SET search_path = public, pg_temp` 등이 없어 호출자가 자기 search_path를 조작하면(또는 동명 함수/테이블을 자기 스키마에 만들면) 함수 본문이 의도치 않은 객체를 참조. PostgreSQL/Supabase 보안 가이드에서 명시 필수 항목. | 시나리오: 사용자가 자기 schema에 `users` 뷰를 만들고 search_path 선두로 두면 `live_join_room`/`add_points`가 그 뷰를 읽고/쓰게 만들 수 있음(Supabase는 기본적으로 사용자 스키마 생성 권한이 제한되나, 정책 미설정으로 안전 마진이 없음). `add_points`는 SECURITY DEFINER이므로 해당 우회 시 임의 사용자 포인트 증감 가능. | 수정: 모든 SECURITY DEFINER 함수에 `SET search_path = public, pg_temp` 또는 fully qualified name 사용. 동시에 `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO service_role` 검토.

- [ ] **본인인증 verify-identity의 dev 백도어가 운영에서도 동작** | 위치: `server/app/api/auth/verify-identity/route.ts:81-101` | 근거: `if (identityVerificationId === "test-portone-id" || !process.env.PORTONE_API_SECRET)` 분기에서 **CI/birth_date 검증 없이** `is_verified=true`로 update. PORTONE_API_SECRET이 prod env에 누락되거나 회전 중이면 모든 사용자가 `{"identityVerificationId":"test-portone-id"}` 한 줄로 19+ 인증 통과. line:38-69 fallback 모드도 `!process.env.PORTONE_API_SECRET`이 게이트라 운영에서 secret 미설정 시 클라가 보낸 birth_date 그대로 신뢰. | 시나리오: ① 운영 배포에 PORTONE_API_SECRET 누락 또는 misspell → ② 17세 사용자가 `POST /api/auth/verify-identity {fallback:true, birth_date:'2000-01-01'}` → ③ is_verified=true. Red 모드/통화/라이브 19+ 게이트가 무력화 → 청소년보호법 위반·앱스토어 reject. | 수정: ① "test-portone-id" 분기 NODE_ENV !== 'production' 가드 또는 완전 삭제. ② PORTONE_API_SECRET 미설정 시 503 fail-closed로 변경(현재 fail-open). ③ fallback은 `process.env.ALLOW_BIRTHDATE_FALLBACK === 'true'`처럼 명시 opt-in.

- [ ] **verify-identity 토큰 무효 시에도 body.userId로 IDOR** | 위치: `server/app/api/auth/verify-identity/route.ts:22-34` | 근거: `let userId = body.userId ?? null; const token = ...; if (token) { const { data:{ user }, error } = await supabase.auth.getUser(token); if (!error && user) userId = user.id; }` — 토큰이 있어도 invalid면 userId가 갱신되지 않고 body.userId가 그대로 사용됨. 그 다음 `if (!userId) 401` 만 체크. | 시나리오: 공격자가 임의 user UUID(crator_profiles 어드민 view 등에서 노출되는 ID)로 `{"userId":"<victim>", "identityVerificationId":"test-portone-id"}` 호출 → 위 백도어와 결합해 **다른 사용자 계정을 19+ 인증 처리** + ci/birth_date까지 임의 값으로 덮어쓰기. | 수정: token 없거나 검증 실패 시 401 즉시 반환, body.userId 입력 자체를 제거(legacy 인터페이스 폐기).

- [ ] **CRON_SECRET 미설정 시 `Bearer undefined`로 우회** | 위치: 7개 cron endpoint — `server/app/api/calls/tick/route.ts:21`, `live/tick/route.ts:11`, `settlements/run/route.ts:12`, `reservations/noshow/route.ts:20`, `reservations/remind/route.ts:11`, `reports/daily-summary/route.ts:9`, `creators/update-grades/route.ts:25` | 근거: `if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)` — CRON_SECRET이 운영에서 누락되면 `Bearer undefined` 헤더 한 줄로 정산/통화 종료/환불 cron을 외부에서 트리거 가능. settlements/run은 멱등이지만 `creator_settlements upsert`의 onConflict 보호로 같은 period 재실행은 스킵. 그러나 `calls/tick`은 **임의 시점에 active 통화 강제 종료/포인트 차감 트리거 가능** → 통화 중인 모든 사용자에 차감/종료 신호 폭탄. | 시나리오: 공격자가 `curl -X POST https://api.wantsome.kr/api/calls/tick -H 'authorization: Bearer undefined'` 반복 호출 → tick 로직이 매 호출마다 분당 차감을 또 적용(cron은 1분 간격 가정이지만 코드는 분당 차감을 강제 → 1분 사이 100회 호출 시 100분치 차감) → 단시간에 모든 active 통화 강제 종료. | 수정: 모든 cron 핸들러 시작에 `if (!process.env.CRON_SECRET) return 503` 추가, 또는 비교 시 `process.env.CRON_SECRET && authHeader === Bearer..` 양쪽 체크. 동시에 calls/tick은 마지막 차감 시각을 세션에 기록하고 60초 미만 재차감 방지(현재 동일 분 내 다중 호출 방지 안 됨).

- [ ] **rate_limits 테이블 RLS 미설정 + checkRateLimit fail-open** | 위치: `server/supabase/migrations/018_rate_limits.sql:4-9` (ENABLE ROW LEVEL SECURITY 없음), `server/lib/rateLimit.ts:23,27` (`if (error) return true`) | 근거: 테이블 RLS 비활성 + check_rate_limit 함수 SECURITY DEFINER 미지정. anon key 사용자가 직접 `delete from rate_limits where key='iap:<me>'`를 실행해 자기 카운트 리셋 가능. 또한 DB 오류/네트워크 fail 시 무조건 통과. | 시나리오: ① 공격자가 client에서 `supabase.from('rate_limits').delete().eq('key', 'iap:<me>')` 반복 → ② IAP 검증 5/시간 제한 무력화 → idempotency_key만 회전하면 무한 IAP 영수증 검증 시도(서버 SLA/비용 폭탄). DM 30회/분 제한도 동일하게 무력화. | 수정: `ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY` (정책 없음 → service_role 전용), check_rate_limit에 SECURITY DEFINER + search_path 설정, rateLimit.ts는 fail-closed로 변경(또는 회로차단기 짧은 TTL).

- [ ] **system_config 테이블 RLS 미설정** | 위치: `server/supabase/001_initial.sql:5-21` (RLS enable 누락), `012_live.sql:153-158`, `007_admin.sql:67-76` | 근거: 마이그레이션에 `ALTER TABLE system_config ENABLE ROW LEVEL SECURITY` 또는 정책 없음. `dm_unlock_points`(`server/app/api/conversations/route.ts:147-152` 참조), `live_entry_fee_points`, `first_charge_bonus_rate`, `withholding_rate`, `min_version_ios`, `maintenance_mode` 등 가격·게이트가 전부 들어있음. | 시나리오: anon key + 자기 토큰으로 `supabase.from('system_config').update({value:'1'}).eq('key','dm_unlock_points')` → DM unlock 1포인트로 변경 → 곧바로 자기 DM 시도(서버는 system_config를 신뢰) → 사실상 무료. `live_entry_fee_points`도 동일. `maintenance_mode='true'`로 자가 서비스 마비도 가능. | 수정: `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY system_config_read FOR SELECT USING (auth.role() = 'authenticated')`(또는 미인증도 OK), UPDATE/INSERT/DELETE 정책 없음(=service_role 전용). 어드민 변경은 이미 `/admin/api/system` 경유 중이므로 무영향.

- [ ] **products/orders/gifts/conversations/messages/notifications/push_tokens 테이블의 RLS·스키마 SQL 부재** | 위치: 저장소 검색에서 `CREATE TABLE products|orders|gifts|conversations|messages|notifications|push_tokens` 매칭 0건 (`server/supabase/`, `migrations/` 전수). 코드는 이 테이블들에 의존(`server/app/api/orders/route.ts`, `gifts/route.ts`, `conversations/route.ts`, `push/register/route.ts:22` 등) | 근거: Supabase Studio에서 직접 만들었거나 별도 마이그레이션이 빠진 상태. RLS·정책 상태 정적 분석 불가. anon key로 직접 select/insert/update가 열려 있을 수 있음. | 시나리오 (RLS 없는 경우 가정): ① anon이 `products.update({price:1})` 직접 → ② 굿즈 1포인트로 결제. ② `orders.update({status:'completed'})` → 결제 없이 주문 완료로 위조. ③ `messages.select` 모든 사용자 DM 열람. ④ `push_tokens.select` 전 사용자 토큰 유출 → 임의 푸시 발송 도구로 Expo 보내기(EXPO_ACCESS_TOKEN 없을 때 인증 없이 발송 가능). | 수정: 즉시 Supabase Dashboard에서 7개 테이블의 RLS/정책 상태를 dump하고 누락된 마이그레이션 파일을 추가. 모든 테이블 RLS enable + 본인 식별 컬럼(user_id/from_user_id/sender_id/consumer_id/creator_id) 기준 self-only 정책. 가격·status 등 변조 위험 컬럼은 service_role-only 업데이트.

- [ ] **포인트 차감의 read-modify-write race condition (멀티 트랜잭션 double-spend)** | 위치: `server/app/api/orders/route.ts:93-105`, `server/app/api/gifts/route.ts:54-92,144-164`, `server/app/api/conversations/route.ts:154-166`, `server/app/api/calls/tick/route.ts:144-148` | 근거: 모두 `select points` → `update points = X - amount` 패턴. FOR UPDATE 없음. RPC `deduct_points`(011/005)는 서버 함수 내 `UPDATE GREATEST(0, points - p_amount)` 한 문장이라 양호하지만 위 라우트들은 RPC를 안 쓰고 직접 update. | 시나리오: ① 사용자 잔액 1000P. ② 동시에 `POST /api/gifts {amount:1000}` × 2회 동시 발사. ③ 둘 다 select에서 1000을 읽고, 둘 다 `update points = 0` 실행. ④ 결과: 1000P로 2000P 가치 선물 전송 + 잔액 0. orders도 동일. conversations unlock 500P × N 동시 호출로 여러 채팅방 무료 unlock 가능. | 수정: `deduct_points`/`add_points` RPC 또는 새 RPC `try_spend_points(user_id, amount, reason)`로 통일 (RPC 안에서 `UPDATE ... WHERE points >= amount RETURNING ... `로 원자적 차감 + 부족 시 false 반환). 모든 차감/충전 경로를 RPC로 강제.

---

## High (출시 전 수정)

- [ ] **users.role 값 대소문자 불일치 → silent fail** | 위치: `server/app/admin/api/creators/[id]/approve/route.ts:30` (`update users set role='CREATOR'`), `push/send/route.ts:31` (`eq('role', 'CREATOR')`) | 근거: 001_initial.sql:29 `role CHECK (role IN ('consumer','creator','both','admin','superadmin'))` — 대문자 'CREATOR' 위반. update가 CHECK 위반으로 throw 또는 0 row affected이고 코드는 error 무시(`await admin.from('users').update(...)` 결과 미확인). 최근 fix commit "fix: status 대소문자 오류 + 유효하지 않은 role 값 수정"에서 다른 곳은 고쳤으나 approve/push/send는 잔존. | 시나리오: 관리자 승인 후 user role이 consumer 그대로 → 크리에이터 권한 검증(creators 테이블 join은 OK이나 일부 push 타깃·통계 누락) 어긋남. push/send에서 `target='CREATOR'` 선택하면 대상자 0명. | 수정: `role: 'creator'` 소문자로 통일 + admin/api/push/send body.target enum도 소문자. 그리고 `update().select()` 또는 status code 확인을 추가해 update 실패를 감지.

- [ ] **ACCOUNT_ENCRYPT_KEY fallback이 zero key** | 위치: `server/app/api/creators/register/route.ts:9` | 근거: `Buffer.from(process.env.ACCOUNT_ENCRYPT_KEY ?? "0".repeat(64), "hex")` — 환경변수 미설정 시 32바이트 0 키로 AES-256-GCM 암호화. zero key는 사실상 평문과 동일(누구나 복호화). | 시나리오: 운영 배포에 ACCOUNT_ENCRYPT_KEY 누락 → 모든 크리에이터 계좌번호가 zero-key 암호화로 DB 저장 → DB 유출 시 계좌번호 평문화 가능. 또한 로컬 dev에서 만든 데이터를 prod로 export 시 동일 zero key 적용으로 검증 어려움. | 수정: env 미설정 시 throw로 fail-closed. `crypto.scrypt(...)` 또는 KMS 연동. 기존 zero-key 데이터 마이그레이션 스크립트 추가.

- [ ] **PORTONE 콜백 redirect URL이 검증 없는 deep link** | 위치: `server/app/api/auth/create-identity-verification/route.ts:62` | 근거: `redirectUrl=wantsome://auth/verify-callback` 고정. 그러나 verify-identity의 검증이 백도어 + IDOR로 약해 redirect 자체보다는 위 issue 의존. PortOne API 응답 검증에서 status/state 필드 확인 누락(line 113-141 — birthDate만 검사). | 시나리오: 검증된 identityVerificationId가 사실은 status='FAILED'/'CANCELLED'여도 birthDate만 있으면 통과. PortOne 정책상 실패 케이스도 birthDate 노출 시 우회 가능성. | 수정: PortOne 응답의 `status === 'VERIFIED'` 명시 검사 추가 + verifiedAt 비교 + storeId 일치 확인.

- [ ] **`reservations` 테이블 update 정책이 양쪽 OR로 너무 광범위** | 위치: `server/supabase/005_reservations.sql:43-46` | 근거: `FOR UPDATE USING (auth.uid() = consumer_id OR auth.uid() = creator_id)` — 컬럼 제한 없어 status를 양쪽이 자유롭게 변경. 클라가 직접 RLS로 status를 'completed'/'noshow' 등으로 임의 전이 가능. WITH CHECK 부재. | 시나리오: 소비자가 confirmed 예약을 취소 정책 회피해 status='completed'로 마킹 → 보증금 환불 로직 우회(서버 API는 status 전이별 환불 처리하지만 클라 직접 update는 그 로직 우회). | 수정: 003 `reservations_self FOR ALL` 정책도 함께 정리 후, status·deposit_points·reject_reason 변경은 service_role-only로(API 경유). client 가능 컬럼은 사실상 없음.

- [ ] **call_sessions의 INSERT/UPDATE 정책 부재 + ENABLE RLS만** | 위치: `server/supabase/003_calls.sql:53-59` | 근거: SELECT 정책만 있고 INSERT/UPDATE/DELETE 정책 없음 → RLS 활성화 상태에서 anon은 거부되므로 동작상 안전(서버만 service_role로 변경). 그러나 다른 테이블과 패턴이 다르고, **클라이언트가 access_token으로 직접 `update call_sessions set status='ended'`**를 시도해도 정책 없어 차단됨 — 양호. 단 코드가 변경되어 INSERT 정책 누락된 채 anon 접근 의존하는 새 흐름이 생기면 깨질 수 있음(low risk). | 시나리오: 현재는 영향 없으나 정책 명시성 부족 — service_role 외 모든 변경 차단을 명시화 권장. | 수정: `CREATE POLICY call_sessions_no_write ON call_sessions FOR ALL USING (false)` 또는 명시 deny 정책 추가.

- [ ] **point_charges 정책 부재로 사용자가 본인 결제 내역 조회 불가** | 위치: `server/supabase/002_point_charges.sql:21-24` | 근거: ENABLE RLS만 + 정책 없음 → service_role 전용. 사용자는 결제 내역을 직접 조회 못 하고 서버 API(`users/me/charges/route.ts`)로만 가능. **이 자체는 양호**(서버만 INSERT). 하지만 UI 노출 시 admin client 우회(`createSupabaseAdmin`) 사용 중 — 양호. | 시나리오: 변조 위험 없음. 다만 service_role 호출이 RLS 우회이므로 verify-iap에서 임의 user_id 조작 시 IDOR 가능. line:53 `user_id !== authUser.id`로 차단 — 양호. | 수정: 추가 작업 불필요. (참고용 기록)

- [ ] **gifts/orders/conversations에서 audit log 부재** | 위치: 위 라우트들 — 포인트 차감/충전 로그 없음. point_charges는 IAP만 기록. | 근거: gifts/orders/conversations unlock/reservations deposit 모두 `users.points` 직접 수정만 하고 ledger 없음. 분쟁/환불 시 재구성 불가. | 시나리오: 사용자가 "선물 누른 적 없는데 포인트 빠졌다" 클레임 → 증거 부재. 정산 분쟁 발생 시 어드민 수동 추적 어려움. | 수정: 단일 `point_ledger` 테이블 도입(amount, reason, ref_id, ref_type, before, after) — 모든 차감 RPC가 동시 INSERT. 출시 전 어렵다면 v1.1 마일스톤.

- [ ] **AGORA 토큰이 1시간 유효 + 채널명 예측 가능** | 위치: `server/lib/agora.ts:23,44` | 근거: `makeChannelName = call_${sessionId 앞 12자}` — sessionId UUID는 노출되므로 채널명 예측 가능. 토큰은 1시간 유효(line:44). 1:1 통화 평균 5~10분에 비해 너무 길어 소비자/크리에이터 종료 후에도 다른 사용자가 같은 sessionId 알면 토큰 재발급(`accept`/`join` 라우트 재호출)으로 조인 가능. | 시나리오: 통화 종료 후 ended 상태가 되면 accept/end는 차단되지만, **start route에서 받은 token은 1시간 동안 Agora 측에서 유효**. 권한 escalation은 어렵지만 Agora측 비용/모니터링 누수. | 수정: 토큰 expire를 통화 평균 + 마진(예: 30분)으로 단축, 또는 통화 종료 시 Agora REST API로 명시 revoke. live는 60분 방송이라 별개 처리.

- [ ] **클라 IDOR — `live/rooms/[id]/join`이 입장 횟수 제한 없음 + 호스트가 자기 방 자가 입장 차단만 있음** | 위치: `server/app/api/live/rooms/[id]/join/route.ts:43-45` | 근거: 호스트 자기 차단 외 ban·suspended 검증 없음. 정지된 사용자(`suspended_until`)도 입장 가능. live_join_room RPC도 user.suspended_until 검사 없음(`014:74-126`). | 시나리오: 정지 처리된 악성 사용자가 라이브에 들어와 채팅 도배·악성 행동. | 수정: getAuthenticatedUser에서 suspended_until 검사 + RPC에 v_user.suspended_until > now() 시 거부.

---

## Medium (출시 직후)

- [ ] **upload-id가 magic byte 검증 없이 `image/*` 헤더만 신뢰** | `server/app/api/creators/upload-id/route.ts:29` — file.type은 클라가 보낸 값. 임의 바이너리를 image/png로 라벨해 업로드 가능. private bucket이라 영향은 admin 검토 시 한정. 수정: `file-type` 패키지로 magic byte 확인.

- [ ] **`posts/upload-image`/`admin/upload`도 동일** | line:38, line:25 — 동일 패턴. public bucket이라 XSS/SVG 스크립트 업로드 위험. 수정: 허용 ext 화이트리스트(jpg/jpeg/png/webp), SVG 차단, magic byte.

- [ ] **conversations.GET에서 `.or()` 인젝션 가능 패턴** | `server/app/api/conversations/route.ts:44` `consumer_id.eq.${authUser.id},creator_id.eq.${authUser.id}` — authUser.id는 supabase.auth.getUser 검증값이라 UUID 형식만 들어오나, 일반 패턴으로 `.or()` 문자열 보간은 잠재적 PostgREST query 인젝션 벡터. UUID 외 입력은 없지만 향후 동일 패턴이 사용자 입력으로 확장되면 위험. 수정: `.or(`...`)` 대신 두 개의 query 후 union, 또는 입력 sanitize.

- [ ] **deduct_points RPC에 잔액 부족 검증 없음** | `server/supabase/migrations/011_fixes.sql:4-14` `UPDATE users SET points = GREATEST(0, points - p_amount)` — 잔액 < amount이어도 0까지만 차감되고 성공 반환. reservations/route.ts:144는 위에서 `userData.points < depositPoints` 체크 후 호출하나 race로 동시 차감 시 음수 방지만 됨. 005_reservations.sql:59-71의 원본 deduct_points는 `RETURN FALSE`로 부족 시 거부했으나 011에서 이 검증이 사라짐. | 수정: deduct_points를 `RETURNS BOOLEAN`으로 복원 + amount 부족 시 false 반환, 호출자가 false면 throw.

- [ ] **add_points/deduct_points의 `GREATEST(p_amount, 0)`/`GREATEST(0, ...)` 음수 입력 silent ignore** | `migrations/015:11`, `011:11` — p_amount=-1 같은 음수 보내면 0 처리. 의도일 수 있으나 호출자에서 음수 보내는 버그를 숨김. 수정: `IF p_amount < 0 THEN RAISE EXCEPTION ...`로 명시적 거부.

- [ ] **admin/api/system POST가 임의 key 추가 허용** | `server/app/admin/api/system/route.ts:25-38` — body 그대로 upsert. 알 수 없는 key를 수십 개 넣어 테이블 폭증. 영향은 superadmin만 가능하니 낮음. 수정: 화이트리스트 key 검증.

- [ ] **admin/api/admins POST에서 grantRole='superadmin' 허용** | `server/app/admin/api/admins/route.ts:48` — superadmin이 다른 사용자를 superadmin으로 승격 가능. 정책상 OK일 수 있으나 audit 강화 필요. 수정: superadmin 추가/제거 시 Slack 알림 의무화.

- [ ] **admin/api/users/[id]/suspend `days` 입력 검증 부재** | `route.ts:15-29` — `Number(days)` parse 안 함, days=0 또는 음수, 매우 큰 값 처리 미정의. 영구 정지는 -1로 superadmin 게이트. 수정: zod로 days >= 1 || days === -1.

- [ ] **rate_limits 정리 SQL이 쿼리 비용** | `migrations/018:43-45` — DELETE를 매 호출마다 실행. 인덱스는 있으나 high-traffic key에서 부담. medium-low. 수정: cron으로 분리.

- [ ] **logger가 stdout/stderr에 Bearer token 들어갈 위험** | `server/lib/logger.ts` — ctx에 무엇이든 직렬화. 호출처에서 Authorization 헤더를 ctx에 넣으면 Vercel logs로 유출. grep 결과 직접 token을 logger에 넣는 곳은 발견 안 됐으나 가드 필요. 수정: write() 전에 ctx 키 화이트리스트 또는 `Bearer\s+[A-Za-z0-9._-]+` redact.

- [ ] **CRON GET vs POST 혼용** | settlements/run, reports/daily-summary, reservations/remind, reservations/noshow, creators/update-grades는 GET; calls/tick, live/tick은 POST. 일관성 부족이고 GET cron은 외부에서 referer/log 노출 시 secret 일부 유출 위험(브라우저 history에 남음). 수정: 전부 POST 통일.

- [ ] **eas.json에 anon key 평문 커밋** | `eas.json:19,32,42,55` — anon key는 본질적으로 public이지만 secret 회전 시 코드 커밋 필요. 수정: EAS Secrets로 이전(distribution-guide.md:224 이미 가이드 있음 — 적용 필요).

- [ ] **Slack webhook URL fetch 실패 시 silent** | settlements/run, creators/register, creators/[id]/approve 등 — `.then(null, () => null)` 처리. 운영상 Slack 누락 시 모니터링 부재. 수정: logger.warn로 기록.

- [ ] **gifts.message 입력 검증이 50자 slice만** | gifts/route.ts:101,173 — `.slice(0,50)`만으로 XSS 위험은 아니나(클라 렌더 시점에 safe text 가정) 컨트롤 문자/이모지 정책 없음. medium-low.

- [ ] **conversations.POST에서 sender 권한 후 unlock 차감인데 sender_is_creator 케이스 처리** | line:174-175 — creator가 먼저 메시지 보내면 consumer_unread만 1, unlock_points 차감은 sender(=creator)에서. 정책상 creator가 unlock비용 내는 것이 의도인지 불명. 수정: 정책 명시 후 코드 정렬.

---

## Info / 잘 된 점

- **verify-iap 흐름** | `server/app/api/payments/verify-iap/route.ts` — Bearer 검증 + body.user_id === authUser.id 일치 확인(line:53) + idempotency_key DB unique + RPC `verify_iap_charge`로 원자적 처리(017) + 첫충전 보너스 deadline 검증(line:103). race도 idempotency_key UNIQUE로 차단됨.
- **end_call_atomic RPC** | `migrations/017:62-105` — `SELECT ... FOR UPDATE` + status 검증 + 멱등 응답. 1:1 통화 종료 race 방어 양호.
- **live_join_room RPC** | `migrations/014:26-180` — 좌석 한도/이미 결제 여부/킥 체크/결제·참가자 upsert 원자적. INSUFFICIENT_POINTS·ROOM_FULL 등 코드 분기 명확.
- **idempotency_key 사용** | point_charges 테이블 unique constraint로 IAP 중복 방어.
- **미들웨어 헤더 주입 방어** | `server/middleware.ts:74-77` — 외부 x-admin-role 헤더를 덮어씀. set 명시 — 양호.
- **superadmin-only 분기** | middleware.ts:67-72 (path 기반) + admins/points/system 라우트 코드 레벨 검증(`adminRole !== 'superadmin' return 403`). 이중 방어 — 양호.
- **gifts에서 본인 통화/입장 검증** | gifts/route.ts:79-81, 144-153 — 본인 세션/참가자만 가능.
- **회원탈퇴 시 active 통화 가드** | `users/me/route.ts:113-122`.
- **AES-256-GCM 채택**(creator account) — 알고리즘 자체는 양호. 키 관리만 수정 필요.
- **Slack 알림에 마스킹** | creators/register/route.ts:80 — 계좌번호 끝 4자리만 노출.
- **rateLimit 슬라이딩 윈도우 RPC** | migrations/018 — 카운트 원자적 증가. 표면적 설계는 양호(RLS만 보강하면).
- **민감정보 console.log 발견 안 됨** | grep 결과 scripts 디렉터리 외에는 logger.ts 한 곳만(JSON 구조 로그) — 양호.
- **EXPO_PUBLIC_*는 anon key/Agora App ID/API base URL/PortOne store id만** — 모두 client 노출 정상 항목. AGORA_APP_CERTIFICATE는 EXPO_PUBLIC 아님 — 양호.
- **storage RLS** | profiles_upload/idcards_upload는 `auth.uid()::text = (storage.foldername(name))[1]` — 본인 폴더에만 업로드 가능. 양호.

---

## 미확인 (다른 도구 필요)

- **Supabase 실제 적용 RLS dump** | Supabase Studio 또는 `pg_dump --schema-only` 또는 `select * from pg_policies` 결과 필요. 마이그레이션 파일과 실제 DB가 다를 가능성(특히 003 vs 004의 creators 정책 잔존 여부, 그리고 products/orders/gifts/conversations/messages/notifications/push_tokens의 실제 RLS 상태).
- **products·orders·gifts·conversations·messages·notifications·push_tokens 테이블 정의** | 저장소에 마이그레이션 SQL이 없음. Supabase Studio에서 export 필요. 추정 외에 정확한 RLS·CHECK·FK 검증 불가.
- **CRON_SECRET·PORTONE_API_SECRET·ACCOUNT_ENCRYPT_KEY 운영 환경 실제 설정 여부** | Vercel env 콘솔 확인 필요. 코드상 누락 시 위험 시나리오만 분석.
- **PortOne identity verification 응답 형식** | PortOne v2 API 실제 응답 schema 확인 후 status 필드 추가 검증 필요.
- **Agora 토큰 권한 분리** | publisher/subscriber RTC 토큰의 role 변환 가능성, channel 종료 후 active session 강제 종료 RESTful 호출 가능 여부 — Agora 문서 별도 검증 필요.
- **eas.json EXPO_PUBLIC_SUPABASE_ANON_KEY와 prod Supabase 프로젝트의 anon key 일치 여부** | 회전 시 클라 빌드 영향. EAS Secrets 이행 후 값 동기화 검증 필요.
- **client 직접 supabase 호출 inventory** | app/ 트리에서 `from('users')`/`update`/`upsert` 패턴 전수조사로 RLS 결함이 즉시 익스플로잇 가능한지 결정. (현재 grep으로는 직접 변조 코드 없음 — 단 anon key 자체로 외부 도구로 호출 가능하므로 RLS 결함이 그대로 위험).
- **Vercel Cron 설정 (`vercel.json`)** | 7개 cron endpoint와 매핑·schedule 일치 여부, 각 엔드포인트 GET/POST 메서드 일관성.
- **admin/api/products·banners·users·reports·posts·live/rooms moderation** | 시간상 미검토. 어드민 패널 superadmin-only 분기 일관성 추가 점검 권장.
