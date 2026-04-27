# 10. Supabase Advisors (보안·성능·Auth)

요약: Supabase Management API 직접 호출로 advisor 데이터 수집 완료. **보안 ERROR 1건 + WARN 14건**, **성능 WARN 113건**. Phase 1A 발견과 다수 일치 (강한 교차 검증).
범위: 프로젝트 `ftnfdtvaxsvosdyjdxfq` security/performance advisors + auth config

---

## 🔴 Critical (출시 블로커) — 보안 ERROR

### 1. `system_config` 테이블 RLS 비활성화
- **lint**: `rls_disabled_in_public`
- **위치**: public 스키마
- **영향**: anon key로 누구나 읽고 쓸 수 있음 → DM unlock 가격, 라이브 입장료, 시스템 설정 등 모든 운영값 변조 가능
- **시나리오**: 사용자가 클라에서 `system_config.dm_unlock_points = 0`으로 변경 → 이후 모든 채팅방 무료 unlock
- **해결**: RLS enable + service_role 전용 정책 또는 admin role 정책
- **Phase 1A 발견과 일치** (Backend Critical #8)

---

## 🟠 High (출시 전 수정 권장) — 보안 WARN

### 2. RPC 함수 `search_path` 불변성 미설정 (10개)
- **lint**: `function_search_path_mutable`
- **영향 함수**:
  - `verify_iap_charge` (결제!)
  - `end_call_atomic` (결제!)
  - `live_join_deduct_points` (결제!)
  - `deduct_points`, `add_points`, `increment_user_points` (결제!)
  - `check_rate_limit` (보안)
  - `handle_new_user` (회원가입)
  - `update_creator_avg_rating`
- **위험**: SECURITY DEFINER 함수의 `search_path`를 명시 안 하면 호출자가 `search_path`를 조작해 같은 이름의 악성 함수로 redirect 가능
- **해결**: 각 함수에 `SET search_path = public, pg_temp` 추가 후 ALTER FUNCTION으로 재정의
- **Phase 1A 발견과 일치** (Backend Critical #3)

### 3. Storage 버킷 listing 허용 (3개)
- **lint**: `public_bucket_allows_listing`
- **버킷**: `live-thumbnails`, `post-images`, `profiles`
- **위험**: 익명 사용자가 버킷 전체 파일 목록 조회 가능 → 다른 사용자 프로필·라이브 썸네일 정찰 가능
- **해결**: 버킷 정책에서 LIST 권한 제거, 직접 URL 접근만 허용

### 4. Leaked Password Protection 비활성화
- **lint**: `auth_leaked_password_protection`
- **위험**: HIBP(Have I Been Pwned) 유출 패스워드 검사 OFF — 사용자가 흔한 패스워드(`123456` 등) 가능
- **해결**: Auth 설정에서 활성화

### 5. 패스워드 정책 약함
- 현재: `password_min_length = 6`, `password_required_characters = null`
- 권장: 8자 이상 + 영문/숫자/특수 필수
- 현재 phone-login 위주라 영향 작지만 이메일 가입 가능하면 risk

### 6. OTP 만료 시간 과도
- `mailer_otp_exp: 3600s` (1시간)
- `sms_otp_exp: 60s` (OK)
- 권장: 메일 OTP 600s (10분)

---

## 🟡 Medium — 보안 INFO

### 7. RLS Enabled, No Policy (6 테이블)
- 테이블: `admin_logs`, `ci_blacklist`, `creator_availability`, `point_charges`, `push_logs`, `rate_limits`
- 의미: RLS는 켜져 있지만 정책 0개 → service_role만 접근 가능
- **`point_charges`는 의도된 것** (서버만 INSERT)
- **`rate_limits`도 의도된 것** (서버만 read/write)
- 나머지 4개 — 의도 확인 필요. 어드민 페이지에서 `admin_logs` 조회한다면 admin 정책 추가 필요

---

## 🔴 성능 — 출시 후 즉시 이슈 가능

### 8. `auth_rls_initplan` 57건
- **lint**: `auth_rls_initplan`
- **이슈**: RLS 정책에 `auth.uid()`, `current_setting()` 등이 매 행마다 평가됨 (initplan 미적용)
- **영향**: 큰 테이블 SELECT가 1000배까지 느려질 수 있음. 결제 조회·통화 이력·메시지 페이지 즉시 느려짐
- **해결**: 정책 SQL에서 `auth.uid()` → `(select auth.uid())`로 감싸기. 자동화 가능
- **출시 직후 사용자 늘면 즉시 발현**

### 9. `multiple_permissive_policies` 55건
- 같은 테이블에 PERMISSIVE 정책 다수 → OR 체인으로 매 쿼리 평가
- 해결: 통합 정책으로 단순화

### 10. `unused_index` 46건
- 사용 안 되는 인덱스 → 디스크 + INSERT 부하
- 해결: 분기별 검토 후 DROP

### 11. `unindexed_foreign_keys` 16건
- FK에 인덱스 없음 → JOIN/CASCADE DELETE 느림
- 해결: 자동 인덱스 추가 스크립트

### 12. `auth_db_connections_absolute` 1건
- DB 커넥션 한계 근접 — 서버 사이드 연결 풀 점검 필요

---

## Auth 설정 — 정상 항목

✅ `disable_signup: false` (서비스 운영 중)
✅ `jwt_exp: 3600s` (1시간 정상)
✅ `external_apple_enabled, external_google_enabled, external_kakao_enabled: true` (소셜 3개 정상)
✅ `mfa_totp_enroll_enabled: true` (TOTP 활성)
✅ `external_email_enabled: true` (이메일 가입 가능)
✅ `site_url: "wantsome://"`, `uri_allow_list: "wantsome://auth/callback,wantsome://**"` (딥링크 정상)
✅ `security_refresh_token_reuse_interval: 10` (재사용 감지 OK)
⚠️ `external_phone_enabled: false` — 그러나 코드에는 phone-login API 존재. **Phone OTP가 어디서 처리되는지 확인 필요** (직접 supabase.auth.signInWithOtp 사용한다면 활성화 필요)

---

## 액션 우선순위

### 출시 전 필수 (PR로 처리)
1. ✅ `system_config` RLS enable + admin 정책 (Critical)
2. ✅ RPC 함수 10개 `search_path` 고정
3. ✅ Storage 버킷 3개 listing 비활성화
4. ✅ HIBP leaked password protection enable
5. ✅ Phone provider 활성화 확인 또는 phone-login 대체 흐름 확정

### 출시 직후 (1~2주 내)
6. RLS initplan 최적화 — `(select auth.uid())` 감싸기 (자동화 가능)
7. 패스워드 정책 강화 (이메일 가입 사용 시)
8. `mailer_otp_exp` 600s로 단축

### 분기별
9. `unused_index` 검토 → DROP
10. `unindexed_foreign_keys` 검토 → 인덱스 추가
11. `multiple_permissive_policies` 통합

---

## 메모

- 본 데이터는 Supabase Management API 직접 호출 (`/v1/projects/{ref}/advisors/security`, `/performance`, `/config/auth`)로 수집
- 토큰은 사용 후 [revoke 권장](https://supabase.com/dashboard/account/tokens)
- MCP에 영구 등록하려면 시스템 env `SUPABASE_ACCESS_TOKEN` 설정 후 Claude 재시작
