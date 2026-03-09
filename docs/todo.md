# 내일 할 일

단기로 진행할 작업을 정리합니다. 완료 시 체크하고, 필요하면 항목을 추가/수정합니다.

---

## 우선순위 1: 영상통화 (Call)

- [ ] **서버 API**
  - [ ] `POST /api/calls/start` — 소비자·크리에이터·모드 검증, 포인트 확인, Agora 토큰 발급, call_sessions INSERT
  - [ ] `POST /api/calls/:id/end` — 통화 종료, 시간·포인트 정산, users.points 차감, creators 수익 반영
  - [ ] (선택) `POST /api/calls/tick` — 주기적 포인트 차감·잔액 부족 시 종료
- [ ] **DB**
  - [ ] `call_sessions` 테이블 생성 (docs/database/003_calls.sql.md 기준)
- [ ] **앱**
  - [ ] `app/(app)/call/[sessionId].tsx` — Agora RTC 연결, 원격/로컬 영상, 타이머, 잔여 포인트·경고 배너
  - [ ] 하단 컨트롤: 카메라 전환, 마이크 ON/OFF, 통화 종료, 신고
  - [ ] 종료 후 요약 화면 (시간, 차감 포인트)
- [ ] **Agora**
  - [ ] Agora 프로젝트 생성, App ID·Certificate(또는 Token) 설정
  - [ ] `.env` / 서버 env에 `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` 등 반영

참고: [docs/screens/03_call.md](screens/03_call.md), [docs/api/02_calls.md](api/02_calls.md)

---

## 우선순위 2 (이후)

- [ ] **예약**: 예약 탭 화면, 목록·상세, 확정/거절 API 연동
- [ ] **크리에이터 대시보드**: 온라인 토글, 수익, 등급, 정산, 예약 관리
- [ ] **관리자**: 심사, 정산, 신고 처리

---

## 기타

- [ ] 소셜 로그인 Provider 설정 (Supabase Auth — Google/Apple/Kakao) — `GUIDE_SOCIAL_LOGIN.md` 참고
- [ ] (선택) 실제 IAP 영수증 검증 연동 (Apple/Google)

---

*마지막 수정: 문서 추가일 기준*
