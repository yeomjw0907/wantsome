# 23. Live Room (1:N) 보안·무결성 감사

요약: 🔴 출시 차단 다수 — 송출 권한 우회 시나리오, 미성년자 진입 무방어, 분쟁 증거 부재, 입장료 환불 누락, 라이브 매출이 정산에서 누락. 17+ 등급 출시 심사 통과 어려움.

범위: 1:N 라이브룸 전 영역 (Agora 토큰 발급 / join / chat / gift / moderation / 자동 종료 / 청소년 보호 / PG 심사 영향)
대상 코드: `server/app/api/live/**`, `server/lib/agora.ts`, `server/lib/live.ts`, `server/supabase/migrations/012_live.sql`, `014_live_runtime_fixes.sql`, `app/(app)/live/[roomId].tsx`, `server/app/api/gifts/route.ts`, `server/app/api/reports/route.ts`, `server/app/api/settlements/run/route.ts`

---

## 🔴 Critical (출시 차단)

### C1. 송출 권한이 서버측 상태로 강제되지 않음 — 시청자 publisher 우회 가능
- 위치: [server/app/api/live/rooms/[id]/start/route.ts:33,45](../../server/app/api/live/rooms/[id]/start/route.ts), [server/app/api/live/rooms/[id]/join/route.ts:43,52](../../server/app/api/live/rooms/[id]/join/route.ts), [server/lib/agora.ts:30-58](../../server/lib/agora.ts)
- 분석:
  - host는 `room.host_id === user.id` 검증 후 `generateAgoraToken(..., "publisher")` 발급 (start:33,45).
  - viewer는 host가 아님이 확인된 뒤 `generateAgoraToken(..., "subscriber")` 발급 (join:43,52).
  - 표면적으로는 OK. **그러나 실제 위반 시나리오는 클라이언트 강제(`ClientRoleType.ClientRoleBroadcaster`)**가 아니라 채널 자체의 RTC role 메타. Agora SDK에서 토큰이 `SUBSCRIBER`로 발급된 경우 **publish API 호출은 RTC 단에서 거부**되므로 1차 방어선은 OK.
  - **그러나 [server/lib/agora.ts:35-39](../../server/lib/agora.ts)의 개발 모드(no-token mode)** — `AGORA_APP_CERTIFICATE` 미설정 시 토큰 `null` 반환. join 라우트는 `agoraToken === null`을 500으로 차단([join:53-55](../../server/app/api/live/rooms/[id]/join/route.ts))하지만, **Vercel preview/staging 환경에 certificate가 빠지면 토큰 자체가 없어 모든 클라이언트가 `appId`만으로 publisher 권한 채널에 접속 가능**.
- 시나리오: certificate 환경변수 누락된 staging/Vercel 미리보기에 외부인이 채널명만 알아내면 (`live_${roomId 12자리}`, [server/lib/live.ts:76-78](../../server/lib/live.ts)) 카메라 송출 가능. roomId는 `/api/live/rooms` GET에서 모두 공개([server/app/api/live/rooms/route.ts:67-69](../../server/app/api/live/rooms/route.ts))되며 채널명은 결정적(deterministic).
- 출시 영향: **App/Play 심사 시 임의 송출 가능 환경 노출 시 Sex/Adult 심의 위반 가능** — 17+로도 거부 사유.
- 권고: production 배포 전 `AGORA_APP_CERTIFICATE` 누락 시 라우트 자체를 500이 아닌 build-time fail-fast로. 채널명을 random secret으로 변경.

### C2. Agora certificate 누락 시 채널이 무인증 (인증 없는 publish 허용)
- 위치: [server/lib/agora.ts:35-39](../../server/lib/agora.ts)
- 분석: certificate 미설정이 단지 warn 후 token=null 반환. 이 상태로 운영 시 Agora 채널이 인증 없는 모드로 동작.
- 시나리오: 운영 환경 환경변수 누락 → 누구든 Agora App ID만으로 channelName에 publisher로 접속.
- 권고: `if (process.env.NODE_ENV === 'production' && !AGORA_APP_CERTIFICATE) throw` 형태의 빌드 가드.

### C3. 청소년 보호: 라이브 입장 시 연령 게이트 부재
- 위치: 없음 (검증 부재)
  - 클라 단독: [app/(auth)/age-check.tsx:65](../../app/(auth)/age-check.tsx) — AsyncStorage `age_verified` 만 저장
  - 서버 그렙 결과: `server/` 전체에서 `age_verified | date_of_birth | birthdate | age_check` 0 hits
  - 라이브 join: [server/app/api/live/rooms/[id]/join/route.ts](../../server/app/api/live/rooms/[id]/join/route.ts) — 연령 검증 없음
- 시나리오:
  1. 미성년자가 age-check 화면에서 거짓 입력 → AsyncStorage clear 후 재시작도 우회 가능.
  2. 가족 폰으로 로그인 후 라이브 입장 → 17+ 콘텐츠에 미성년자 노출, 적발 시 방통위 신고/앱 마켓 제재.
- 출시 영향: 한국 방통위 「인터넷 멀티미디어방송사업법 시행령」 + Apple App Store 5.1.1 위반 우려. 17+ 등급으로도 KYC 또는 본인인증 기반 연령 확인 미존재 시 거부 가능성 높음.
- 권고:
  - 서버 `users.adult_verified BOOLEAN` 컬럼 + 본인인증(휴대폰) 시점에 만 19세 검증.
  - join 라우트에서 `if (!user.adult_verified) return 403`.
  - 라이브 화면에 "본 라이브는 만 19세 이상 시청가" 배지 노출.

### C4. 호스트 force_end / admin force_end 시 시청자 입장료 미환불
- 위치:
  - 호스트 종료: [server/app/api/live/rooms/[id]/end/route.ts:31-43](../../server/app/api/live/rooms/[id]/end/route.ts)
  - 어드민 강제 종료: [server/app/admin/api/live/rooms/[id]/end/route.ts:26-39](../../server/app/admin/api/live/rooms/[id]/end/route.ts)
  - 자동 종료(스케줄 만료): [server/app/api/live/tick/route.ts:82-96](../../server/app/api/live/tick/route.ts)
- 분석: 세 종료 경로 모두 participants를 `status='left'`로만 업데이트할 뿐, `paid_points`에 대한 환불 RPC(`increment_user_points`) 호출이 없음. 환불은 오직 `join_ack_at IS NULL` 타임아웃 케이스만 ([live/tick:24-74](../../server/app/api/live/tick/route.ts)).
- 시나리오:
  1. 시청자 50,000P 결제하고 정상 ack 완료 → 5분 뒤 호스트 강제 종료 → 환불 0원.
  2. 어드민이 부적절 콘텐츠로 강제 종료 → 시청자 손실 그대로.
- 출시 영향: 전자상거래법 17조 청약철회 + 한국소비자원 분쟁 직결. PG/카드사 심사 시 환불 정책 가시화 미흡으로 **위험업종 분류 위험**.
- 권고: 종료 시 미사용 시간 비례 환불 또는 강제 종료는 전액 환불(서비스 약관에 명시). RPC `live_refund_on_end(p_room_id)` 신설.

### C5. 라이브 매출(입장료 + 선물)이 월별 정산에서 누락
- 위치: [server/app/api/settlements/run/route.ts:55-63](../../server/app/api/settlements/run/route.ts)
- 분석: 정산 합산이 `call_sessions.points_charged` 단일 소스. 라이브 입장료(`live_room_participants.paid_points`), 라이브 선물(`gifts.amount` where `live_room_id IS NOT NULL`)이 합산 대상에 포함되지 않음.
- 시나리오: 호스트가 5명 × 50,000P = 250,000P 입장료 받아도 정산서에 0원으로 잡힘 → 회계·세무 분쟁, 호스트 대량 이탈.
- 출시 영향: 첫 정산일(매월 15일)에 발견되면 즉시 신뢰 붕괴. PG 심사 시 매출/정산 무결성 검증 실패.
- 권고: settlements/run에 라이브 매출 SUM + creator_earnings 별도 테이블/컬럼 적재.

### C6. 분쟁/신고 증거: 라이브 녹화 또는 캡처 보존 메커니즘 0
- 위치: 없음. `recording | record_session | recording_url | cloud_recording` 0 hits in `server/`
- 분석:
  - Agora Cloud Recording 미사용.
  - 채팅 로그는 `live_chat_messages` 테이블 보존(OK).
  - 비디오/오디오 분쟁 증거 0.
- 시나리오:
  1. 시청자가 호스트의 부적절 행위 신고 → 사후 검증 자료 영상 없음 → 처리 불가.
  2. 방통위 행정조사·수사기관 협조 요청 → 증거 부재로 사업자 책임 가중.
- 출시 영향: 17+ 출시(특히 카메라 ON 1:N) 시 방심위 자율심의 권고에 따라 **녹화 보관 의무화 권고 대상**. PG 심사 시 분쟁대응체계 미흡.
- 권고: Agora Cloud Recording 또는 호스트 측 자동 녹화 후 S3/Supabase Storage 30일 보관. 신고 발생 시 90일 연장. 약관 명시.

### C7. 라이브 신고를 신고 테이블에 매핑할 수 없음 (live_room_id 컬럼 부재)
- 위치:
  - 신고 API: [server/app/api/reports/route.ts:51-95](../../server/app/api/reports/route.ts) — payload에 `call_session_id`만, `live_room_id` 미지원
  - 테이블 스키마: [server/supabase/006_reports.sql:5-15](../../server/supabase/006_reports.sql) — `call_session_id UUID REFERENCES call_sessions(id)`만 존재
- 시나리오: 시청자가 라이브 중 호스트 신고 → reports.call_session_id NULL로 저장 → 어떤 라이브에서 어떤 시점에 발생했는지 추적 불가 → 90% 처리 불가.
- 출시 영향: 1:N 라이브의 신고 처리 거버넌스 형해화. PG/심사기관 가이드 위반 가능성.
- 권고: `reports.live_room_id UUID REFERENCES live_rooms(id)` 추가, 신고 API 페이로드 확장, 어드민 페이지 라이브 단위 신고 조회.

### C8. 정지된 사용자(suspended_until)가 라이브 입장/방송 가능
- 위치: [server/lib/live.ts:172-187](../../server/lib/live.ts) — `getAuthenticatedUser`에서 `deleted_at`만 검사, `suspended_until` 미검사
- 분석: 신고 API가 critical 카테고리에서 `suspended_until = '9999-12-31'` 적용([reports/route.ts:113-116](../../server/app/api/reports/route.ts))하나, 라이브 join/start/chat/gift 어디에서도 이 값을 확인하지 않음.
- 시나리오: PROSTITUTION 신고로 정지된 호스트가 즉시 라이브 시작/시청자 입장 → 정지 무력화.
- 권고: `getAuthenticatedUser`에서 `if (suspended_until && new Date(suspended_until) > now) return null`. 라이브 라우트 join/start/chat/gift/extend 모두 적용.

---

## 🟠 High

### H1. 입장료 50,000P 정책 과다
- 위치: [server/lib/live.ts:3](../../server/lib/live.ts), [server/supabase/migrations/012_live.sql:15,154](../../server/supabase/migrations/012_live.sql)
- 분석: 1P=1원 환산 시 라이브 1회 입장료 50,000원. SOOP/치지직 풍선 평균/Twitch sub와 비교 시 5~10배 과다.
- 영향: 첫 충전 보너스(2배)로 결제 유도해도 실사용자 진입 장벽. PG 심사 시 "고가 1회 결제" → 위험업종 시그널.
- 권고: 5,000~10,000P. `system_config.live_entry_fee_points`로 운영자가 즉시 변경 가능 (이미 [getLiveConfig](../../server/lib/live.ts:85)가 DB값 우선 — 마이그레이션 update만 필요).

### H2. 채팅 rate-limit / 도배 방지 부재
- 위치: [server/app/api/live/rooms/[id]/chat/route.ts:93-135](../../server/app/api/live/rooms/[id]/chat/route.ts)
- 분석: 메시지 길이 200자 자르기는 있으나 횟수 제한 없음. 그렙 결과 `rate.?limit | rateLimit` 0 hits in `server/app/api/live`.
- 시나리오: 봇이 1초당 수십 회 INSERT → 10명 viewer 정원 채팅 도배 → 방송 무력화.
- 권고: per-user 1초당 1메시지, 1분당 10메시지 (Redis or PG 윈도우).

### H3. 금지어 / 욕설 필터 부재
- 위치: 없음. `profanity | filter_word | badword | 금지어` 0 hits.
- 분석: 채팅 INSERT 전 어떠한 필터도 적용되지 않음.
- 출시 영향: 방심위 통신심의규정 + 청소년보호법 위반 콘텐츠 노출.
- 권고: 최소 한국어 욕설 사전(예: badwords-ko) 통합 + 자동 mute 정책.

### H4. 강퇴 시 입장료 환불 정책 명확하지 않음
- 위치: [server/app/api/live/rooms/[id]/kick/route.ts:44-52](../../server/app/api/live/rooms/[id]/kick/route.ts), [server/supabase/migrations/014_live_runtime_fixes.sql:84-92](../../server/supabase/migrations/014_live_runtime_fixes.sql)
- 분석: 강퇴 시 `status='kicked'`, `blocked_until_room_end=true` 만 처리. 환불은 자동/수동 어느 경로도 없음.
- 시나리오: 호스트가 정당한 사유 없이 입장료 받은 시청자를 강퇴 → 이중 손실(입장료 + 차단). 분쟁 직행.
- 권고: 강퇴 시 자동 전액 환불 + 어드민 사후 검수. 또는 어드민 강퇴만 환불, 호스트 강퇴는 사유 필수 + 환불 없음 (약관 명시).

### H5. 채팅 메시지 RLS — 종료된 라이브 채팅이 모든 인증 사용자에게 노출
- 위치: [server/supabase/migrations/012_live.sql:88-90](../../server/supabase/migrations/012_live.sql) — `live_chat_messages_read_authenticated` (`USING (auth.role() = 'authenticated')`)
- 분석: 인증된 모든 사용자가 어떤 종료된 라이브의 채팅이든 SELECT 가능. 라우트 GET([chat/route.ts:38](../../server/app/api/live/rooms/[id]/chat/route.ts))은 `participant.status==='joined'` 검증을 강제하지만 **클라이언트가 직접 Supabase를 콜할 경우 RLS만으로는 차단 불가**.
- 권고: RLS를 `EXISTS (SELECT 1 FROM live_room_participants WHERE room_id=... AND user_id=auth.uid() AND status='joined')` 로 강화.

### H6. 화면 녹화 방지 미적용 (라이브 화면)
- 위치: [app/(app)/live/[roomId].tsx](../../app/(app)/live/[roomId].tsx) — `usePreventScreenCapture` 사용 grep 0 hits
  - 1:1 통화는 적용됨: [app/(app)/call/[sessionId].tsx:28,173](../../app/(app)/call/[sessionId].tsx) `usePreventScreenCapture()`
- 영향: 시청자가 호스트 화면 녹화 → 무단 재배포 → 호스트 인격권/저작권 침해.
- 권고: 1:1 통화와 동일하게 `usePreventScreenCapture()` 적용. iOS는 차단 불가하므로 호스트에 알림(`addScreenshotListener`).

### H7. 채팅·선물 시점 mute 상태 미체크 (선물은 우회)
- 위치: [server/app/api/gifts/route.ts:144-153](../../server/app/api/gifts/route.ts)
- 분석: 선물 라우트는 participant.status='joined'만 체크하고 `chat_muted_until`은 무시. mute된 viewer가 선물 + custom message로 채팅 우회 INSERT([gifts:182-190](../../server/app/api/gifts/route.ts) — `live_chat_messages` 직접 INSERT).
- 시나리오: 호스트가 mute한 시청자가 100P 선물에 욕설 메시지 첨부 → 채팅창에 그대로 노출.
- 권고: 선물 라우트에서 `isMuteActive(chat_muted_until)` 체크. message 미리보기에도 동일 필터.

### H8. live_room_participants RLS — 시청자가 자기 참여 row만 보지 못해도 다른 viewer 정원 조회는 server 한정
- 위치: [012_live.sql:66-72](../../server/supabase/migrations/012_live.sql)
- 분석: 정책 `live_room_participants_write_self`(FOR ALL)가 위험. **DELETE/UPDATE도 USING auth.uid()=user_id만**으로 통과. 시청자가 자기 row를 직접 status='left' 처리 후 환불 우회 가능.
- 시나리오: viewer가 input ack 직후(즉시 환불 받지 않는 상태) `UPDATE live_room_participants SET status='left' WHERE user_id=me`. 이후 `paid_points` 그대로 두고 호스트가 종료 → 별도 환불 청구.
- 권고: 정책을 INSERT WITH CHECK(self), SELECT USING(self)만 허용. UPDATE/DELETE는 service_role/RPC로만.

---

## 🟡 Medium

### M1. uid가 1~100,000 random — 충돌 가능성
- 위치: [join/route.ts:51](../../server/app/api/live/rooms/[id]/join/route.ts), [start/route.ts:44](../../server/app/api/live/rooms/[id]/start/route.ts)
- 분석: `Math.floor(Math.random() * 100000) + 1`. 1방에 시청자 ≤10이라 충돌 확률은 낮으나, 같은 방을 2회 join하는 케이스에서 toggling 가능.
- 권고: `crypto.randomUUID()` 해시 → uint32 또는 `users.id` 결정적 해시.

### M2. Agora 토큰 1시간 고정 만료 — 라이브 1시간 + 연장 시나리오 끊김
- 위치: [server/lib/agora.ts:44](../../server/lib/agora.ts) — `expireTime = now + 3600`
- 분석: 라이브 30/60분 + 최대 2회 연장 시 총 최대 180분. 1시간 만료 시 publisher/subscriber 모두 RTC 끊김. 클라에 토큰 갱신 로직 없음.
- 시나리오: 1시간 라이브 + 1시간 연장 = 호스트가 60분 시점에 끊김 → 라이브 강제 종료, 시청자 환불 분쟁(C4).
- 권고: 토큰 만료를 `scheduled_end_at + 30m`으로 동적. 또는 `/refresh-token` 엔드포인트 + 클라 갱신.

### M3. 호스트가 본인 라이브에 다중 publisher start 가능
- 위치: [server/app/api/live/rooms/[id]/start/route.ts:33-79](../../server/app/api/live/rooms/[id]/start/route.ts)
- 분석: status가 `ready` 또는 `live` 모두 시작 허용. 동일 host가 두 디바이스에서 start API를 동시 호출하면 양 디바이스 publisher 토큰 발급. Agora는 같은 channel + 다른 uid를 publisher 둘 허용.
- 영향: 한 라이브에 두 화면 송출 — 의도 미정의.
- 권고: 진행중(`live`) 상태에서 start 재호출은 토큰만 재발급, 새 publish 차단(같은 uid 강제).

### M4. 채팅 메시지에 HTML/링크 이스케이프 없음
- 위치: [chat/route.ts:104-131](../../server/app/api/live/rooms/[id]/chat/route.ts)
- 분석: 200자 trim만. 클라이언트 렌더링이 RN `<Text>`라 XSS 직접 위험은 낮으나, 어드민 웹 패널/푸시 알림 뷰에서 렌더 시 위험.
- 권고: 입력 단계 sanitize + 외부 URL 자동 추출 차단(필요 시 화이트리스트).

### M5. 입장료 차감 후 채널 토큰 발급 실패 시 환불 누락 윈도우
- 위치: [join/route.ts:52-74](../../server/app/api/live/rooms/[id]/join/route.ts)
- 분석: 토큰 발급(line:52)이 RPC 차감(line:58) 이전이라 OK처럼 보이나, 실제로는 토큰만 받고 클라가 ack 안 하면 [live/tick:33-74](../../server/app/api/live/tick/route.ts)가 환불. 단, `agora_channel`이 join 직전 호스트가 종료해 NULL이 되는 race 상황에 차감 후 토큰 발급 흐름은 RPC 시점에 status 검증하므로 OK. 그러나 RPC 성공 후 **응답 직전 서버 크래시 시 클라는 charged_points 모름** → 사용자가 다시 입장 시 RPC가 `v_already_paid`로 막아 추가 차감 안 함(OK). 환불은 ack 타임아웃이 처리.
- 권고: 응답에 거래 ID 포함, 클라가 충전 잔액과 비교 가능.

### M6. join_ack_at NULL 시점 환불은 viewer만, admin/host 케이스 미정의
- 위치: [live/tick:24-31](../../server/app/api/live/tick/route.ts) — `eq("role", "viewer")` 한정
- 분석: admin role도 ack 타임아웃 발생 가능하나 무시. 0원이라 환불 손실은 없으나 status가 `joined`로 영속 → 통계 왜곡.
- 권고: admin도 status='left' 정리.

### M7. host_id가 users(id)이지만 creators 권한 검사가 별도
- 위치: [rooms/route.ts:118-138](../../server/app/api/live/rooms/route.ts)
- 분석: host = `users.id`, 라이브 권한은 `creators.live_enabled`. 호스트가 creator approval 취소되면 `live_enabled=false`로 새 라이브는 막히나 **이미 진행 중 라이브는 계속됨**. 또한 host가 deleted_at으로 비활성화되어도 진행 중 라이브 종료 트리거 없음.
- 권고: admin이 live_enabled=false 토글 시 진행 중 라이브 자동 종료 + 환불.

### M8. live_chat_messages에 sender_role을 클라가 영향 미치지 않으나, 서버에서 access.role 그대로 저장 — admin/host 표기 신뢰
- 위치: [chat/route.ts:127](../../server/app/api/live/rooms/[id]/chat/route.ts) — `sender_role: access.role`
- 분석: access.role 산출은 server측이라 OK. 다만 RLS write 정책(`auth.uid() = sender_id`)과 함께 sender_role 위조 시도 차단 보강 필요.
- 권고: DB 레벨 trigger로 sender_role 재계산.

---

## ℹ Info / 관찰

- live_join_room RPC가 `SECURITY DEFINER`이고 row lock(`FOR UPDATE`) 보유 → 동시 입장에서 viewer_limit 정확.
- `gifts_target_context_check`로 1:1 vs 라이브 컨텍스트 배타성 보장.
- moderation 액션 audit log: `live_moderation_actions` 테이블에 actor/대상/사유 기록(OK). 단, RLS read는 모든 인증 사용자 허용([012_live.sql:111-114](../../server/supabase/migrations/012_live.sql)) — 내부 사유 노출 위험 (관찰).
- 호스트는 자기 라이브에 선물 못 보내게 차단됨([gifts:140-142](../../server/app/api/gifts/route.ts)) — OK.
- 본인 신고 차단([reports:72-74](../../server/app/api/reports/route.ts)) — OK.

---

## ❓ 미확인 (수동 검증 필요)

- **U1.** Apple App Review에 "1:N 라이브 + 카메라 ON + 입장료" 모델로 17+ 통과 사례 확인 필요. (현재 PG 사전심사 보고서에 별도 우려 없음으로 보이나, App Review 5.1.1·1.4.1 가이드라인은 별개)
- **U2.** Agora Cloud Recording 라이선스/요금/한국 리전 보관 정책 — 도입 결정 필요.
- **U3.** Supabase RLS Advisor 결과(10-supabase-advisors.md blocked 상태) — `live_room_participants` UPDATE 정책이 실제 어떻게 운영되는지 자동 조사 미실행.
- **U4.** 한국 방통위 인터넷개인방송 가이드 적용 여부 — 인터넷방송사업자(IPTV) 등록 의무 검토. (개인 1:N 모델은 2024년 가이드 기준 회색지대)
- **U5.** 본인인증/연령확인 SDK(NICE/KCP 등) 통합 시 cost 및 출시 일정 영향.

---

## 출시 권장 게이트 (체크리스트)

| 우선 | 항목 | 차단성 |
|---|---|---|
| 1 | C2 production AGORA_APP_CERTIFICATE 강제 | 출시 차단 |
| 2 | C3 서버측 adult_verified + join 게이트 | 출시 차단 |
| 3 | C4 종료 시 환불 정책 + RPC | 출시 차단 |
| 4 | C7 reports.live_room_id 추가 | 출시 차단 |
| 5 | C8 suspended_until 강제 | 출시 차단 |
| 6 | C5 라이브 매출 정산 합산 | 첫 정산일 전 |
| 7 | C6 녹화 보관 | 17+ 심사 + 분쟁 대비 |
| 8 | H1 입장료 5,000~10,000P 인하 | PG 심사 우호 |
| 9 | H2 채팅 rate-limit + H3 욕설 필터 | 17+ 심사 |
| 10 | H4 강퇴 환불 정책 약관 명시 | 분쟁 대비 |
| 11 | H5 채팅 RLS 강화 | 정보 누출 방어 |
| 12 | H6 라이브 화면 녹화 방지 | 호스트 권리 |
| 13 | H7 mute 우회(선물 채팅) | 모더레이션 |
| 14 | H8 participants UPDATE RLS 차단 | 무결성 |
| 15 | M1~M8 | 안정성 |

---

## PG 심사 영향 평가

- "1:N 라이브 + 입장료" 단일 결제 50,000원은 한국 카드사·PG 심사 가이드(매월 갱신) 기준 **고가/일회성 디지털재화**로 분류, 일부 PG는 위험업종 추가 심사. (정확한 PG 등급은 별도 PG 사전 합의 필요)
- 출시 시 가시화 필요:
  - 구체적 환불 정책 (C4, H4 해결 후 약관/가이드 페이지)
  - 신고/모더레이션 가시 페이지 (C7 해결 + admin 라이브별 신고 페이지)
  - 17+ 가시 배지 + 본인인증 (C3)
  - 분쟁 시 영상 증거 보관 정책 (C6)
- 위 4가지 충족 시 PG 심사 통과 가능성 상승.

---

## 17+ 출시 심사 영향

- Apple 5.1.1, 5.1.2 — 본인확인 없는 연령게이트는 통과 어려움 (C3).
- Apple 1.4.1, 4.0 — 모더레이션 도구 가시화·신고 24h 응답 정책 명시 필요 (C7, H2, H3).
- Google Play "User-Generated Content" — 신고/차단/콘텐츠 정책 + 24h 처리 (C7).
- 결론: C3, C6, C7, H3 미해결 시 17+ 등급으로도 거부 가능성 높음.

---

작성자: code-reviewer
범위 코드 mtime: 2026-04-26 시점 main 브랜치 (61ee659)
