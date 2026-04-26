# 원썸 출시 점검 대시보드

> 마지막 업데이트: 2026-04-26
> 출시 목표: ASAP (PG 심사 ~30일이 critical path)
> 사업자: 주식회사 98점7도 (법인) / 5인 cofounder 동등 20%

---

## Phase 진행 상황

| Phase | 상태 | 산출 |
|---|:---:|---|
| **0. Discovery & Triage** | ✅ 완료 | 10/11/12 |
| **1. 보안 감사** | ✅ 완료 | 20/21/22/23 |
| **2. 컴플라이언스 감사** | ✅ 완료 | 30/31/32 |
| **3. 운영 준비** | ✅ 완료 | 40/41 |
| **4. 통합 액션 플랜** | ✅ 완료 | **99** |

---

## 산출 파일

| 파일 | 영역 | 상태 |
|---|---|:---:|
| **[USER-TODO.md](USER-TODO.md)** | **사용자 직접 작업 체크리스트** | ✅ |
| [00-pricing-policy.md](00-pricing-policy.md) | 가격·정산 정책 (확정) | ✅ |
| [10-supabase-advisors.md](10-supabase-advisors.md) | Supabase advisor (Management API 직접) | ✅ |
| [11-codemap.md](11-codemap.md) | 결제·인증·민감 경로 인벤토리 | ✅ |
| [12-deps.md](12-deps.md) | npm/expo 의존성 감사 | ✅ |
| [20-backend-security.md](20-backend-security.md) | 백엔드 보안 (Phase 1A) | ✅ |
| [21-payment-flow.md](21-payment-flow.md) | 결제·동시성 (Phase 1B) | ✅ |
| [22-client-security.md](22-client-security.md) | 클라이언트 보안 (Phase 1C) | ✅ |
| [23-live-room-security.md](23-live-room-security.md) | 라이브룸 (Phase 1D) | ✅ |
| [30-appstore-compliance.md](30-appstore-compliance.md) | iOS (Phase 2D) | ✅ |
| [31-playstore-compliance.md](31-playstore-compliance.md) | Android (Phase 2E) | ✅ |
| [32-legal-korea.md](32-legal-korea.md) | 한국 법규 (Phase 2F) | ✅ |
| [40-build-deploy.md](40-build-deploy.md) | 운영 (Phase 3G) | ✅ |
| [41-qa-plan.md](41-qa-plan.md) | QA (Phase 3H) | ✅ |
| **[99-action-plan.md](99-action-plan.md)** | **통합 액션 플랜 + PR 9개 분할** | ✅ |

---

## 발견 — 분류 기준

- **🔴 Critical**: 출시 블로커
- **🟠 High**: 출시 전 수정 권장
- **🟡 Medium**: 출시 직후
- **🟢 Info**: 참고

## 누적 현황

| 단계 | Critical | High | Medium |
|---|---:|---:|---:|
| Phase 0 Discovery | 0 | 2 | 1 |
| Phase 1A Backend | 9 | 8 | — |
| Phase 1B Payment | 6 | 6 | 4 |
| Phase 1C Mobile | 2 | 4 | 4 |
| Phase 1D Live | 8 | 8 | — |
| Phase 10 Advisors | 1 (R3 중복) | 4 | 1 |
| Phase 2D iOS | 6 | 7 | 5 |
| Phase 2E Android | 3 | 5 | 6 |
| Phase 2F Legal | 5 | 6 | 6 |
| Phase 3G Build/Deploy | 5 (P7,A3,N2,N3,I4 중복) | 4 | 3 |
| Phase 3H QA | — | — | — |
| **합계 (중복 제거)** | **~35** | **~50** | **~26** |

**출시 권장 일정**: ASAP → **2~3주 연기** (PR 9개 처리 + 외부 작업 13~14개)
**가장 치명적 6가지**: cron 스케줄·IAP 미검증·users RLS·Privacy Manifest·debug.keystore·사업자정보 placeholder
