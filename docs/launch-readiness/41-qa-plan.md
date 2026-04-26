# 41. 출시 전 QA 테스트 계획

작성일: 2026-04-26 / 갱신: 2026-04-27 (PR-1~9 + PR-1.5 머지 후)
기준 코드: main 브랜치 (USER-TODO 최종본 커밋 시점)
범위: React Native + Expo SDK 55 (iOS/Android) + Next.js(Vercel) + Supabase
출시 목표: D-1 체크리스트(섹션 H) 37개 항목 모두 YES 시 출시 가능

> **D-1 체크리스트 사용법** (섹션 H): PR-1~9 코드 변경은 이미 반영되었으므로,
> 각 항목은 (a) 빌드 결과, (b) USER-TODO.md 외부 작업 완료 여부, (c) 실기기 골든패스 결과로 YES/NO 기입.
> NO 1건이라도 있으면 출시 보류.
>
> PR별 머지 매핑:
> - PR-1·1.5 (결제·webhook): H1-1~5, H4-3
> - PR-2 (RLS·DB): H4-2, H4-4, H1-4
> - PR-3 (인증·age-verify): H1-8, H3-4
> - PR-4 (라이브): H1-6·7·9·10
> - PR-5 (iOS): H2-1·5·6·10
> - PR-6 (Android): H4-5
> - PR-7 (한국 법규): H3-1·2·3·5
> - PR-8 (가격 정책): H2-2·3·12, H5-4
> - PR-9 (클라이언트): H4-6, H5-5

---

## 분류 기준

- **[BLOCK]** 출시 차단 — 이 테스트가 실패하면 배포 금지
- **[CRIT]** Critical 회귀 — Phase 1B/2에서 확인된 취약점 재현 방지
- **[REG]** 일반 회귀 — 기능 정상 동작 확인
- **자동(E2E)** — Maestro 또는 Detox 스크립트로 자동화 가능
- **수동** — 실기기/어드민 UI 직접 조작 필요

---

## A. 골든패스 E2E 테스트 (출시 차단 테스트)

> 아래 시나리오 중 단 하나라도 실패하면 배포를 진행하지 않는다.

### A1. 신규 가입 → 첫 통화 → 결제 [BLOCK] [자동(E2E)]

| 단계 | 행위 | 검증 포인트 |
|------|------|-------------|
| 1 | 앱 설치 → age-check 화면 진입 | 만 19세 미만 생년월일 입력 시 가입 차단 메시지 표시. **서버 `users.is_adult_verified` 미세팅 시 이후 모든 유료 기능 진입 차단 확인 (현재 Critical: 클라 단독 검증)** |
| 2 | 전화번호 입력 → OTP 인증 | OTP 수신 및 6자리 코드 검증 성공 |
| 3 | 약관 동의 화면 | 이용약관 링크 → WebBrowser 열림 확인 (현재 "준비 중" 토스트 아님). 개인정보처리방침 링크 동작 확인 |
| 4 | 모드 선택 — consumer | 프로필 닉네임/사진 입력 완료 후 홈 탭 진입 |
| 5 | 크리에이터 목록 → 크리에이터 선택 → 통화 요청 | 통화 요청 API 호출, 상대방 수신 화면 노출 |
| 6 | 크리에이터 수락 → Agora RTC 연결 | Agora 채널 join 성공. `AGORA_APP_CERTIFICATE` 설정 확인 — null 토큰으로 연결 시도 시 500 반환 확인 |
| 7 | 통화 중 분당 차감 | 1분 경과 후 consumer.points 감소 확인 (blue: 2,000P / red: 3,000P 정책). 잔액 < 2분치 시 low_points 경고 팝업 노출 |
| 8 | 잔액 부족 → 통화 자동 종료 | consumer.points = 0 도달 시 통화 자동 종료. call_sessions.status = 'ended' 확인 |
| 9 | 통화 종료 → creator_earning 정산 | `creator_earning = floor(points_charged * 0.35)` 확인. DB creators.total_earnings 증가 |
| 10 | 포인트 충전 → IAP 흐름 | App Store / Play Store 결제 시트 호출 확인. storeId가 코드 `constants/products.ts`와 ASC 등록 ID 일치 확인 |
| 11 | 영수증 검증 | Apple: StoreKit 2 JWS 또는 `/verifyReceipt` 서버 검증 후 포인트 지급. Google: `purchases.products.get` purchaseState=0 확인. **위조 토큰 전송 시 포인트 미지급 확인 [CRIT]** |
| 12 | 첫충전 보너스 | 첫 충전 시 1.5배 지급 (현행 코드 *2 → *1.5 수정 후 검증). `first_charge_deadline` 24시간 이내 확인 |

---

### A2. 라이브 입장 → 시청 → 환불 [BLOCK] [자동(E2E) 부분]

| 단계 | 행위 | 검증 포인트 |
|------|------|-------------|
| 1 | 라이브 목록 → 라이브 입장 | `POST /api/live/rooms/{id}/join` 호출. consumer.points -= LIVE_ENTRY_FEE_POINTS 확인 (정책 확정 후 금액 검증) |
| 2 | ACK 정상 전송 | `join_ack_at` 세팅 확인. 환불 미발생 확인 |
| 3 | ACK 미전송 시뮬레이션 (10초 대기) | tick 실행 후 `refund_status = 'refunded'`. consumer.points 복원 확인 [CRIT] |
| 4 | 채팅 메시지 발송 | live_chat_messages 저장 및 실시간 수신 확인 |
| 5 | 선물 발송 (라이브 중) | consumer.points 차감 확인. `GIFT_OPTIONS` 금액 [100, 300, 500, 1000, 2000, 5000, 10000]P 범위 외 금액 전송 시 거부 확인 |
| 6 | 호스트 강제 종료 | `status='left'`인 viewer 전원에게 `paid_points` 환불 확인. **현재 Critical: 미구현 상태** [BLOCK] |
| 7 | 어드민 강제 종료 | 위와 동일 환불 확인 |
| 8 | 라이브 선물 월 정산 포함 | `settlements/run` 실행 후 라이브 선물 + 입장료 합산 확인. **현재 Critical: 누락 상태** [BLOCK] |

---

### A3. 굿즈 주문 [v1.1 이후 — 출시 시점 OFF] [수동]

> v1 출시 시 feature flag OFF 확인이 핵심. 주문 흐름 자체는 v1.1 QA 시점에 실행.

| 단계 | 행위 | 검증 포인트 |
|------|------|-------------|
| 1 | shop.tsx UI | v1 출시 빌드에서 굿즈 탭이 완전히 숨겨짐 (feature flag OFF) 확인 |
| 2 | (v1.1) 상품 조회 → 장바구니 → 결제 | PortOne PG WebView 호출 확인 |
| 3 | (v1.1) 카드/카카오페이/네이버페이/토스페이 결제 | 각 결제 수단 성공·실패 분기 처리 확인 |
| 4 | (v1.1) 환불 요청 | 청약철회 7일 이내 환불. 전자상거래법 제17조 모달 표시 확인 |
| 5 | (v1.1) 재고 race condition | 재고 1인 상품에 동시 2건 주문 시 1건만 성공, 나머지 환불 [CRIT] |

---

### A4. 크리에이터 정산 [BLOCK] [수동]

| 단계 | 행위 | 검증 포인트 |
|------|------|-------------|
| 1 | 통화 종료 → call_sessions 기록 | `status='ended'`, `points_charged`, `creator_earning` 컬럼 모두 기록 확인 |
| 2 | settlements/run Cron 호출 | `CRON_SECRET` 올바른 헤더로만 허용. 빈 secret으로 호출 시 401 반환 확인 |
| 3 | 정산 금액 계산 | `settlement_amount = SUM(call_sessions.points_charged) * 0.35`. DEFAULT_SETTLEMENT_RATE = 0.35 적용 확인 |
| 4 | 라이브 매출 포함 | `live_room_participants.paid_points + gifts(live)` 정산 합산 확인 (현재 누락 [BLOCK]) |
| 5 | 원천징수 | `tax_amount = floor(settlement_amount * 0.033)`. `net_amount = settlement_amount - tax_amount` |
| 6 | 정산 중복 실행 방어 | 동일 period PAID 상태 정산에 Cron 재실행 시 금액 덮어쓰기 방지 확인 |
| 7 | 어드민 PAID 마크 | 어드민 `/admin/settlements` 에서 정산 PAID 처리 후 상태 변경 확인 |
| 8 | Slack 알림 | SLACK_WEBHOOK_URL로 정산 완료 알림 전송 확인 |

---

### A5. 어드민 흐름 [수동]

| 단계 | 행위 | 검증 포인트 |
|------|------|-------------|
| 1 | 신분증 인증 승인/거절 | `/admin/api/creators/{id}/approve` 호출. 승인 시 `creators.is_verified = true`. 미승인 크리에이터의 red 모드 접근 차단 확인 |
| 2 | 신고 처리 → 사용자 정지 | `/admin/api/reports` 조회. 라이브 신고 `live_room_id` 필드 포함 확인 (현재 누락 [BLOCK]) |
| 3 | 라이브 모더레이션 | `/admin/api/live/rooms/{id}/moderation` force_end 호출 후 시청자 환불 확인 |
| 4 | system_config 변경 | `dm_unlock_points` 변경 후 대화 unlock 비용 즉시 반영 확인 |
| 5 | 어드민 권한 분리 | `admin` role이 `/admin/points`, `/admin/system`, `/admin/admins`에 접근 시 403. `superadmin`만 허용 확인 |

---

## B. 회귀 테스트 (Critical 시나리오)

> Phase 1B에서 발견된 취약점이 수정 PR 이후 재발하지 않음을 보장한다.

### B1. IAP 영수증 위조 검증 [BLOCK] [자동(API)]

| 테스트 케이스 | 입력 | 기대 결과 |
|--------------|------|-----------|
| B1-1: 위조 token | `purchase_token: "fake-token-12345"`, 유효 `idempotency_key` | HTTP 400/422. 포인트 미지급. `verify-iap/route.ts`에서 Apple/Google API 실제 호출 확인 |
| B1-2: 동일 idempotency_key 동시 2회 | 동일 키로 200ms 간격 2회 POST | 1회만 성공. 2회 모두 point_charges INSERT 방지 (UNIQUE 제약 확인) |
| B1-3: 타 user_id 전송 | `user_id != authUser.id` | HTTP 403 반환. `verify-iap:53` IDOR 방어 동작 확인 |
| B1-4: Android token → iOS platform | `platform="ios"`, Android 영수증 | Apple 검증 실패 후 포인트 미지급 |
| B1-5: product_id 변조 | `product_id="POINT_06"` but POINT_01 구매 | 영수증의 실제 product_id와 비교 후 거부 |

---

### B2. 동시성 시나리오 [BLOCK] [자동(API)]

| 테스트 케이스 | 재현 방법 | 기대 결과 |
|--------------|-----------|-----------|
| B2-1: 통화 tick + 종료 동시 | tick Cron 실행 중 `/calls/{id}/end` 동시 호출 | `end_call_atomic` FOR UPDATE 락으로 이중 종료 방지. points 이중 차감 없음 |
| B2-2: 선물 동시 발송 (2기기) | 동시에 `POST /gifts` 5,000P × 2 | `UPDATE users SET points = GREATEST(0, points - amount) WHERE points >= amount` 원자적 적용. 음수 잔액 불가 |
| B2-3: 채팅방 unlock 동시 (2기기) | `POST /conversations` same consumer+creator 동시 2회 | 1회만 500P 차감. 두 번째는 기존 conversation 반환 또는 롤백 확인 |
| B2-4: 첫충전 보너스 TOCTOU | 2개 다른 idempotency_key로 동시 IAP 검증 | 보너스 1.5배 1회만 적용. 두 번째 요청은 is_first_charged=true 후 1배 적용 |
| B2-5: 굿즈 재고 race | 재고 1인 상품에 동시 2명 주문 | 1건만 성공. 실패 건 포인트 환불. products.stock < 0 불가 |
| B2-6: 라이브 입장 동시 | 같은 user 2기기 동시 join | `live_join_room` RPC 내 FOR UPDATE로 중복 차감 방지. 이미 joined 상태 처리 정책 확인 |

---

### B3. 정산율 변경 영향 [BLOCK] [자동(API)]

| 테스트 케이스 | 검증 포인트 |
|--------------|-------------|
| B3-1: settlement_rate DB 전체 0.35 적용 | `SELECT settlement_rate FROM creators WHERE settlement_rate != 0.35` — 결과 0건 |
| B3-2: tick 분당 정산 | `creator_earning = floor(points_charged * 0.35)` — tick route:116 fallback 0.5가 0.35로 변경 확인 |
| B3-3: end_call_atomic 정산 | 종료 시 `creator_earning = floor(points_charged * 0.35)` — end route:51 fallback 동일 확인 |
| B3-4: DEFAULT_SETTLEMENT_RATE | `settlements/run/route.ts:7` 값이 0.35인지 코드 리뷰 + 실행 결과 확인 |
| B3-5: NULL 크리에이터 정산 | `creators.settlement_rate = NULL`인 크리에이터 통화 종료 → fallback 0.35 적용 확인 |

---

### B4. RLS 변조 시도 [BLOCK] [자동(API)]

| 테스트 케이스 | 방법 | 기대 결과 |
|--------------|------|-----------|
| B4-1: anon key로 users.points UPDATE | `supabase.from('users').update({ points: 999999 })` with anon key | RLS 정책으로 거부 (0 rows affected) |
| B4-2: creators.settlement_rate 셀프 수정 | 크리에이터 본인이 자신의 settlement_rate UPDATE | RLS 거부 |
| B4-3: system_config 변조 | 일반 사용자 JWT로 `system_config` UPDATE | RLS 거부 |
| B4-4: 타 유저 point_charges 조회 | 본인 외 point_charges SELECT | RLS 거부 또는 빈 결과 |
| B4-5: CRON_SECRET 없이 tick 직접 호출 | `Authorization: Bearer undefined` 헤더로 `/api/calls/tick` POST | 401 반환 |

---

## C. 디바이스/OS 매트릭스 [수동]

> 한국어 단일 지원 기준. 각 OS+기기 조합에서 A1 골든패스 핵심 단계(가입, 통화 시작, 결제)를 수행한다.

| OS | 버전 | 기기 예시 | 필수 확인 항목 |
|----|------|-----------|----------------|
| iOS | 16.x | iPhone 12 | 통화 백그라운드 전환 시 voip 모드 동작. UIBackgroundModes 에 voip 포함 확인 |
| iOS | 17.x | iPhone 15 | Privacy Manifest 적용 (NSPrivacyTracking, NSPrivacyCollectedDataTypes) |
| iOS | 18.x | iPhone 16 Pro Max (6.9") | 스크린샷 필수 사이즈 확인. usePreventScreenCapture 동작 |
| Android | 13 | Pixel 6 | Foreground Service 알림 노출 확인. READ_MEDIA_IMAGES 권한 |
| Android | 14 | Samsung Galaxy S24 | 통화 중 배터리 최적화 예외 처리 |
| Android | 15 | Pixel 9 | google-services.json placeholder 실값 치환 확인 |

추가 확인:
- 소형 화면(iPhone SE, 375pt): 충전 모달·통화 UI 레이아웃 깨짐 없음
- 대형 태블릿(iPad): 지원 여부 미정이면 tablet layout crash 없음 확인

---

## D. 네트워크 시나리오 [수동]

| 시나리오 | 재현 방법 | 기대 결과 |
|---------|-----------|-----------|
| D1: 통화 중 네트워크 단절 | 통화 1분 경과 후 비행기 모드 전환 | Agora 자동 재연결 시도. 재연결 실패 시 통화 종료 처리 + 분당 차감 중단 확인 |
| D2: 약한 네트워크 (3G 시뮬레이션) | Charles Proxy로 대역폭 100kbps 제한 | IAP 결제 시트 타임아웃(10초 이상) 처리. 타임아웃 시 오류 메시지 + 결제 미완료 상태 유지 |
| D3: 결제 직전 백그라운드 진입 | 충전 모달 열린 상태에서 홈 버튼 | 앱 복귀 시 결제 상태 정상 복원. 이중 결제 없음 확인 |
| D4: 라이브 입장 중 단절 | join API 호출 직후 비행기 모드 | ACK 미전송으로 자동 환불 처리 확인. 10초 tick 후 refund_status='refunded' |
| D5: Supabase Realtime 단절 | 통화 중 Realtime WebSocket 강제 종료 | 재연결 후 통화 상태 동기화. 신호 채널(`call_signals`) 복원 확인 |

---

## E. 17+ 컴플라이언스 테스트 [BLOCK] [수동]

| 테스트 케이스 | 방법 | 기대 결과 |
|--------------|------|-----------|
| E1: 미성년자 가입 차단 | age-check에서 만 18세 생년월일 입력 | 가입 진행 불가 메시지. **서버에서도 `users.is_adult_verified = false`로 저장 필수** |
| E2: 클라이언트 우회 시도 | AsyncStorage `age_verified` 값 직접 `true` 세팅 후 라이브 입장 시도 | 서버 `/api/live/rooms/{id}/join`에서 `user.is_adult_verified` 체크 → 403 반환 |
| E3: 앱 재설치 후 우회 | age-check 통과 → 앱 재설치 → age-check 없이 진입 시도 | age-check 화면 재표시 또는 서버 gate로 차단 |
| E4: 라이브 입장 17+ 게이트 | 미검증 계정으로 `/api/live/rooms/{id}/join` 직접 호출 | HTTP 403. `"adult_verification_required"` 에러 코드 |
| E5: 1:1 통화 17+ 게이트 | 미검증 계정으로 통화 요청 | 서버에서 차단 또는 클라이언트 게이트 확인 |
| E6: 메타데이터 일관성 | App Store Connect 앱 설명 + Review Notes + 앱 내 약관 | "성인 콘텐츠", "성인 채팅", "adult" 키워드 0. "17+ 이용자 생성 콘텐츠"로 통일 |
| E7: 신분증 화면 캡처 방지 | 신분증 업로드 화면에서 스크린샷 시도 | usePreventScreenCapture 적용으로 캡처 차단 또는 경고 |

---

## F. PG 심사 대비 시나리오 [수동]

| 항목 | 확인 위치 | 합격 기준 |
|------|-----------|-----------|
| F1: 사업자등록번호 표기 | 앱 내 설정 → 회사 정보 / 서버 홈페이지 푸터 | `system_config.business_number`가 실제 사업자등록번호로 세팅. "-" 아님 |
| F2: 통신판매업 신고번호 | 홈페이지 푸터 + 약관 | 실제 신고번호 표기. 미신고 시 v1 굿즈 OFF 유지 필수 |
| F3: 대표자 및 CS 전화 | 홈페이지 푸터 | `ceo_name`, `cs_phone` 실값 |
| F4: 환불 정책 일관성 | 약관 `terms/page.tsx` + 홈페이지 `/refund` + IAP 모달 | 세 곳에서 동일 정책. 모순 없음. "미사용 7일 이내 100% / 사용 개시 후 청약철회 제한" |
| F5: 위험업종 키워드 | 앱 설명, 리뷰 노트, 약관, 결제 화면 | "성인 채팅", "성인 영상통화", "adult chat" 0건 |
| F6: 청소년 보호 정책 페이지 | `server/app/youth/page.tsx` | 404 아님. 청소년보호책임자 성명·연락처 포함 |
| F7: 이메일 표기 일관성 | 약관, PIP, 홈페이지 | support/privacy/cs 이메일 용도별 정리 또는 단일화 |
| F8: 원천징수 안내 | 크리에이터 정산 화면 또는 약관 | 3.3% 원천징수 명시. 종합소득세 신고 안내 |

---

## G. 자동화 vs 수동 분류

### 자동화 가능 (Maestro 또는 Detox + API 테스트)

| 범위 | 도구 | 우선순위 |
|------|------|---------|
| A1 골든패스 (가입~첫충전) 핵심 경로 | Maestro (모바일 UI) | 최우선 |
| A2 라이브 입장~ACK 타임아웃 환불 | Maestro | 최우선 |
| B1 IAP 영수증 위조 (API 레벨) | Jest + Supertest (서버 API) | 최우선 |
| B2 동시성 시나리오 (API 레벨) | k6 또는 Jest concurrent | 최우선 |
| B3 정산율 계산 검증 | Jest 단위 테스트 | 높음 |
| B4 RLS 변조 | Supabase JS client 스크립트 | 높음 |
| E1~E5 17+ 게이트 (API 레벨) | Supertest | 높음 |

**Maestro 추천 이유**: YAML 기반으로 Expo Managed Workflow에서 설정 부담이 낮음. iOS/Android 공통 스크립트 작성 가능.

**Detox 추천 조건**: 영상통화 UI 인터랙션(Agora 렌더링)이나 백그라운드 전환 테스트가 필요한 경우.

### 수동 (실기기/어드민 직접 조작 필요)

| 범위 | 이유 |
|------|------|
| A3 굿즈 주문 (v1.1) | PortOne WebView PG 결제 — 자동화 어려움 |
| A5 어드민 흐름 | 어드민 UI 스크린 플로우 |
| C 디바이스/OS 매트릭스 | 실기기 필수. 시뮬레이터로 대체 불가한 IAP, 카메라, 배경음 |
| D 네트워크 시나리오 | Charles Proxy / 비행기 모드 수동 조작 |
| F PG 심사 대비 | 사업자 정보 DB 입력, 약관 텍스트 검토 |
| E6 메타데이터 일관성 | ASC 대시보드 + 앱 내 문서 교차 검토 |

---

## H. 출시 D-1 QA 체크리스트

> 출시 하루 전 최종 점검. 담당자가 각 항목에 YES/NO를 기입하고 NO가 1건이라도 있으면 출시 보류.

### H1. Critical 결함 수정 완료

| # | 항목 | YES/NO | 담당 |
|---|------|--------|------|
| H1-1 | IAP 영수증 서버 검증 구현 완료 (Apple StoreKit 2 + Google Play) | | |
| H1-2 | 정산율 0.35 전체 통일 (DEFAULT_SETTLEMENT_RATE, tick fallback, end fallback, DB) | | |
| H1-3 | 선물/대화unlock race condition 원자적 UPDATE 수정 | | |
| H1-4 | idempotency_key UNIQUE 제약 migration 적용 확인 | | |
| H1-5 | 첫충전 보너스 TOCTOU 수정 (RPC 내부에서 FOR UPDATE 후 판단) | | |
| H1-6 | 라이브 호스트/어드민 강제 종료 시 시청자 환불 구현 | | |
| H1-7 | 라이브 선물 + 입장료 월 정산 포함 | | |
| H1-8 | 연령 게이트 서버 검증 (`users.is_adult_verified`) + 라이브/통화 진입 가드 | | |
| H1-9 | Agora no-token 모드 프로덕션 guard (certificate 미설정 시 500) | | |
| H1-10 | 라이브 신고 API에 `live_room_id` 컬럼 추가 + 신고 UI 구현 | | |

### H2. 앱스토어 컴플라이언스

| # | 항목 | YES/NO | 담당 |
|---|------|--------|------|
| H2-1 | Privacy Manifest (NSPrivacyTracking: false, NSPrivacyCollectedDataTypes 선언) | | |
| H2-2 | ASC IAP Product ID와 코드 storeId 일치 (6개 상품) | | |
| H2-3 | App Store Connect 6개 IAP 상품 Active 상태 | | |
| H2-4 | 이용약관·개인정보처리방침 링크 WebBrowser 연결 (토스트 제거) | | |
| H2-5 | 차단 목록 UI 완성 또는 메뉴 제거 | | |
| H2-6 | 라이브 방송 화면 신고 버튼 UI 구현 | | |
| H2-7 | Age Rating 설문 "Sexual Content: None" 재작성 | | |
| H2-8 | Review Notes에서 "성인" 키워드 제거 | | |
| H2-9 | UIBackgroundModes에 voip 추가 | | |
| H2-10 | EAS iOS Submit 설정 완성 (appleId, ascAppId, appleTeamId) | | |
| H2-11 | 스크린샷 6.9" (1320×2868px) 실제 데이터로 촬영 완료 | | |
| H2-12 | 첫충전 배너 "2배" → "1.5배" 수정 | | |

### H3. 법규 컴플라이언스

| # | 항목 | YES/NO | 담당 |
|---|------|--------|------|
| H3-1 | system_config 사업자 정보 실값 입력 (사업자번호, 대표자, CS 전화, 통신판매업 신고번호) | | |
| H3-2 | `/youth` 페이지 (청소년 보호 정책) 구현 완료, 404 아님 | | |
| H3-3 | 환불 정책 약관·홈페이지·모달 3곳 일관성 | | |
| H3-4 | 개인정보 수집·이용 동의 별도 체크박스 (필수/선택 분리) | | |
| H3-5 | 통신판매업 신고번호 앱·웹 표기 | | |

### H4. 인프라 및 보안

| # | 항목 | YES/NO | 담당 |
|---|------|--------|------|
| H4-1 | AGORA_APP_CERTIFICATE 프로덕션 환경변수 설정 확인 | | |
| H4-2 | CRON_SECRET 비어있지 않음 확인 | | |
| H4-3 | APPLE_IAP_SHARED_SECRET / GOOGLE_SERVICE_ACCOUNT_JSON 설정 | | |
| H4-4 | SUPABASE_SERVICE_ROLE_KEY Vercel 환경변수 설정 | | |
| H4-5 | google-services.json placeholder 실값 치환 (Android) | | |
| H4-6 | dist-android-smoke/ git 추적 제거 (`git rm --cached`) | | |
| H4-7 | EAS Production 환경변수 전체 확인 (EXPO_PUBLIC_* 포함) | | |

### H5. 기능 동작

| # | 항목 | YES/NO | 담당 |
|---|------|--------|------|
| H5-1 | 골든패스 A1 전 단계 통과 (실기기 iOS + Android 각 1대) | | |
| H5-2 | 골든패스 A2 전 단계 통과 | | |
| H5-3 | 골든패스 A4 정산 Cron 수동 실행 후 금액 정합성 확인 | | |
| H5-4 | 굿즈 탭 feature flag OFF 확인 | | |
| H5-5 | 신분증 화면 usePreventScreenCapture 적용 확인 | | |
| H5-6 | Supabase `age_verified` 서버 게이트 동작 확인 | | |

---

## I. 출시 후 모니터링 항목

> 출시 D-Day부터 Vercel/Supabase/외부 대시보드에서 실시간 모니터링. 아래 임계값(threshold) 초과 시 Slack 알림 트리거.

| 지표 | 측정 방법 | 경보 임계값 | 대응 |
|------|-----------|-------------|------|
| IAP 결제 성공률 (Apple) | App Store Connect 매출 리포트 / verify-iap 성공 카운트 | < 95% 시 경보 | 영수증 검증 로직 점검 |
| IAP 결제 성공률 (Google) | Play Console / verify-iap 성공 카운트 | < 95% 시 경보 | Google Play Developer API 응답 점검 |
| IAP 영수증 검증 거절률 | `verify-iap` HTTP 422/400 카운트 / 전체 요청 | > 5% 시 경보 | 위조 시도 IP 차단, 로그 분석 |
| 통화 평균 시간 | `call_sessions.duration_sec` 평균 | < 60초 (이상 하락 시) 경보 | UX 이슈 또는 강제 종료 버그 확인 |
| 통화 이중 차감 이벤트 | `call_sessions.points_charged` 이상 패턴 모니터링 | 동일 세션 2회 이상 차감 감지 즉시 경보 | tick 원자성 패치 롤아웃 |
| 정산율 정합성 | 월 정산 실행 후 `net_amount / points_charged` 집계 비율 | 0.35 ± 0.01 벗어날 시 경보 | DEFAULT_SETTLEMENT_RATE 코드 즉시 확인 |
| 라이브 입장료 환불률 | `live_room_participants.refund_status='refunded'` / 전체 | > 20% 시 경보 (ACK 타임아웃 과다) | 클라이언트 ACK 전송 로직 점검 |
| 라이브 조기 종료 환불 미처리 | 종료 이벤트 후 paid_points 환불 RPC 누락 감지 | 누락 1건 즉시 경보 | 수동 환불 처리 + 핫픽스 |
| 17+ 신고 건수 | `reports` 테이블 일별 집계 | > 10건/일 시 경보 | 어드민 즉시 검토, 해당 크리에이터 임시 정지 |
| 포인트 음수 잔액 | `users.points < 0` | 1건 감지 즉시 경보 | GREATEST(0, ...) 클램핑 패치 확인 |
| 서버 에러율 (5xx) | Vercel 함수 에러 로그 | > 1% 시 경보 | 로그 원인 분석 |
| Apple S2S Notification 환불 이벤트 | `/api/payments/apple-notification` 수신 | 환불 이벤트 처리 실패 즉시 경보 | 포인트 회수 수동 처리 |
| Google RTDN 환불 이벤트 | `/api/payments/google-notification` 수신 | 위와 동일 | 위와 동일 |

### 출시 D+1 ~ D+7 집중 점검 항목

- 매일 09:00: Supabase 대시보드에서 `users.points < 0` 건수 확인
- 매일 09:00: `point_charges` 중복 idempotency_key 건수 확인
- 매일 09:00: `call_sessions` 중 `creator_earning` = 0이지만 `points_charged` > 0인 건수 확인 (정산 누락)
- 매일 09:00: `live_room_participants` 중 `refund_status IS NULL`이면서 `join_ack_at IS NULL`인 건수 확인 (환불 누락)
- D+15: 첫 정산 Cron 실행 결과 수동 검토 (금액, 라이브 매출 포함 여부, 세율)

---

## 우선순위 요약

| 구분 | 항목 수 | 출시 블로커 여부 |
|------|---------|-----------------|
| [BLOCK] 골든패스 E2E | 5개 시나리오 (A1~A5) | 모두 통과 필수 |
| [BLOCK] Critical 회귀 (B1~B4) | 17개 케이스 | 모두 통과 필수 |
| [BLOCK] 17+ 컴플라이언스 (E) | 7개 케이스 | 모두 통과 필수 |
| [REG] 디바이스 매트릭스 (C) | 6개 OS+기기 | High 권고 |
| [REG] 네트워크 시나리오 (D) | 5개 | High 권고 |
| [REG] PG 심사 대비 (F) | 8개 | 출시 전 필수 |
| D-1 체크리스트 (H) | 37개 항목 | NO 1건 시 보류 |
| 출시 후 모니터링 (I) | 13개 지표 | 운영 필수 |

---

작성자: test-engineer  
기준 코드: main 브랜치 61ee659 (2026-04-26)  
참조 문서: 11-codemap.md, 21-payment-flow.md, 22-client-security.md, 23-live-room-security.md, 30-appstore-compliance.md, 32-legal-korea.md, 00-pricing-policy.md
