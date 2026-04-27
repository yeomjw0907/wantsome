# 00. 가격·정산 정책 v1 (확정)

요약: ✅ 출시 전 확정. 5인 cofounder 합의 기반. **변경 시 PR + 5인 합의** 필수.
범위: 충전·분당·선물·정산·메시지·등급·로드맵

---

## 핵심 원칙

1. **사용자 가격은 캠톡 매칭** (인지 부담 0)
2. **정산은 코드값 0.35, 메시지는 "수수료 차감 후 50/50"** (Apple 30% 후 net 50/50이라 거짓 아님)
3. **포인트 충전 공식 `ceil(P/0.7/1100)×1100`** — Apple 수수료 100% 보전 + KRW 티어 ceil
4. **포인트 = 디지털 사용 (IAP), 굿즈 = 실물 (PG)** — 결제 트랙 분리
5. **5인 cofounder 동등 20%, 운영비 대표 부담 (수익 우선 차감)**

---

## A. 분당 통화 단가

| 모드 | UI 라벨 | **변경 후** | 현재 코드 | 변경 위치 |
|---|---|---:|---:|---|
| blue | 스탠다드 | **2,000P** | 900P | [constants/products.ts:25](../../constants/products.ts:25) |
| red | 프리미엄 | **3,000P** | 1,300P | 동일 |

레드 모드 조건 (자격):
- 신분증 인증 필수
- 평점 4.5+ + 누적 통화 100분+
- 응답시간 30초 보장 (미달 시 5,000P 사용자 보상)

---

## B. 정산율

| 항목 | 값 |
|---|---|
| **코드값** | `settlement_rate = 0.35` (현재 0.5에서 변경) |
| **계산식** | `creator_earning = floor(points_charged * 0.35)` (변경 없음) |
| **인플 측 메시지** | "수수료 차감 후 회사와 50:50 분배" |
| **DB default 통일** | [016_settlement_rate_to_50.sql](../../server/supabase/migrations/016_settlement_rate_to_50.sql) → 0.35로 |
| **코드 default 통일** | [settlements/run:7](../../server/app/api/settlements/run/route.ts:7) `0.55 → 0.35` |

---

## C. 충전 패키지 (캠톡 매칭 재배열)

가격 공식 그대로, 단위만 캠톡 매칭으로 재배열:

| ID | 포인트 | 가격 (재계산) | storeId |
|---|---:|---:|---|
| POINT_01 | 4,000P | TBD (≈₩6,600) | `kr.wantsome.app.point_4000` |
| POINT_02 | 6,600P | TBD (≈₩11,000) | `kr.wantsome.app.point_6600` |
| POINT_03 | 18,600P | TBD (≈₩29,700) | `kr.wantsome.app.point_18600` |
| POINT_04 | 32,000P | TBD (≈₩50,600) | `kr.wantsome.app.point_32000` |
| POINT_05 | 60,000P | TBD (≈₩94,600) | `kr.wantsome.app.point_60000` |
| POINT_06 | 100,000P | TBD (≈₩158,400) | `kr.wantsome.app.point_100000` |

**TBD**: PR에서 정확한 가격 계산 후 확정. `App Store Connect`의 KRW 티어 + ÷0.7 ceil 적용.

---

## D. 선물 단가 (옵션 C — 별풍선 멘탈)

| 이름 | 이모지 | P | 별풍선 환산 |
|---|---|---:|---:|
| 하트 | 💗 | 100 | 1개 |
| 장미 | 🌹 | 300 | 3개 |
| 부케 | 💐 | 500 | 5개 |
| 다이아 | 💎 | 1,000 | 10개 |
| 별빛 | ⭐ | 2,000 | 20개 |
| 왕관 | 👑 | 5,000 | 50개 |
| 슈퍼스타 | 🌟 | 10,000 | 100개 |

**통합 필수**: [GIFT_ITEMS](../../app/(app)/call/[sessionId].tsx:55), [GIFT_TIERS](../../app/(app)/history/gifts.tsx:23), [GIFT_OPTIONS (라이브)](../../app/(app)/live/[roomId].tsx:50), [GIFT_OPTIONS (서버)](../../server/app/api/gifts/route.ts:6) — 단일 source of truth로 통합

---

## E. 메시지 모델 — 하이브리드

- **채팅방 unlock**: 500P (현행 유지) — DB `system_config.dm_unlock_points` 조정 가능
- **슈퍼메시지**: 50P (신규) — 강조 표시 + 상단 노출, 선택형

---

## F. 첫충전 보너스

- 현재: 2배 / 72시간
- **변경**: **1.5배 / 24시간**
- 위치: [verify-iap:106](../../server/app/api/payments/verify-iap/route.ts:106) `pointsToAdd = isFirst ? product.points * 2 : product.points` → `* 1.5`
- 마감 deadline: [phone-login:48](../../server/app/api/auth/phone-login/route.ts:48) 72h → 24h

---

## G. 라이브룸 입장료

- 현재 하드코드: `LIVE_ENTRY_FEE_POINTS = 50,000P` ([server/lib/live.ts:3](../../server/lib/live.ts:3))
- 정책 미반영. 검토 필요 (50,000P = ₩50,000은 너무 비쌈, 5,000P~10,000P 권장)
- **결정 사항**: PR 시 별도 논의

---

## H. 추천인 시스템 (출시 D-Day부터)

- 친구 결제액의 10% 추천인 보상 (캠톡 모방)
- 친구 첫충전 +50% 보너스 (acquisition)
- 신규 코드/UI 필요

---

## I. 인플 등급 시스템

| 등급 | 조건 | 노출·정산 |
|---|---|---|
| 브론즈 | 가입 시 | 기본, 정산 35% |
| 실버 | 30일·통화 200분+ | +20% 노출, 정산 37% |
| 골드 | 60일·평점 4.0+ | +50% 노출, 정산 39%, **레드 자격** |
| 플래티넘 | 90일·통화 1,000분+ | 홈 상단, 정산 41% |

---

## J. 굿즈 단계적 운영

| 시점 | 상태 |
|---|---|
| v1 (출시일) | **OFF** (feature flag로 UI 가림) |
| v1.1 (D+14) | 인플 1~2명 시범 입점 |
| v1.5 (D+60) | 인플 굿즈 전체 오픈 |
| v2 (D+180) | 원썸 자체 굿즈 |

수수료: 인플 70% / 회사 30% (마켓플레이스 표준)

---

## K. 출시 후 로드맵

| 시점 | 액션 |
|---|---|
| D-Day | 추천인·등급·30일 정산 보장·Whale 식별 ON |
| D+14 | 굿즈 시범 |
| D+30 | 가격 fine-tuning (데이터 기반) |
| D+60 | VIP 구독 (월 ₩9,900) + 굿즈 전체 |
| D+90 | 등급 전 활성화, MRR ₩30M 목표 |
| D+180 | 원썸 자체 굿즈 |

---

## L. KPI 베이스라인

| 지표 | D+30 | D+60 | D+90 |
|---|---:|---:|---:|
| MAU | 5,000 | 15,000 | 30,000 |
| Paying User Ratio | 5% | 6% | 7% |
| ARPPU | ₩30,000 | ₩40,000 | ₩50,000 |
| 인플 등록 | 50 | 150 | 300 |
| 인플 30일 retention | 60% | 70% | 75% |
| 분당 평균 마진 | ₩600+ | ₩700+ | ₩800+ |

---

## 변경 PR 액션 리스트

이 정책을 코드에 반영하기 위한 변경 항목 (출시 전 별도 PR 1~2개로 묶음):

### 코드 변경
- [ ] [constants/products.ts:25](../../constants/products.ts:25) — PER_MIN_RATES 수정 (900→2000, 1300→3000)
- [ ] [constants/products.ts:9](../../constants/products.ts:9) — PRODUCTS 6개 캠톡 매칭으로 재배열 + 가격 재계산
- [ ] [server/lib/products.ts:5](../../server/lib/products.ts:5) — 동일 동기화
- [ ] [server/supabase/migrations/N_settlement_rate_to_35.sql](../../server/supabase/migrations) — 신규 마이그레이션 (settlement_rate 0.5 → 0.35)
- [ ] [server/app/api/settlements/run/route.ts:7](../../server/app/api/settlements/run/route.ts:7) — DEFAULT_SETTLEMENT_RATE 0.55 → 0.35
- [ ] [server/app/api/payments/verify-iap/route.ts:106](../../server/app/api/payments/verify-iap/route.ts:106) — 첫충전 *2 → *1.5
- [ ] [server/app/api/auth/phone-login/route.ts:48](../../server/app/api/auth/phone-login/route.ts:48) — 72h → 24h
- [ ] GIFT_ITEMS/TIERS/OPTIONS 통합 + 옵션 C 적용
- [ ] [server/lib/live.ts:3](../../server/lib/live.ts:3) — LIVE_ENTRY_FEE_POINTS 정책 반영
- [ ] 슈퍼메시지 50P UI/API 신규 추가
- [ ] 추천인 시스템 신규 추가
- [ ] 인플 등급 시스템 신규 추가
- [ ] 굿즈 feature flag (출시 v1 OFF)

### 문서 정리
- [ ] [docs/app-store-iap-copy.md](../../docs/app-store-iap-copy.md) — storeId·가격 갱신
- [ ] [CHECKLIST.md](../../CHECKLIST.md) — 하트팩 잔재 정정
- [ ] [wantsome/](../../wantsome) — 사본 디렉터리 삭제 (별도 PR 권장)

### 외부 작업
- [ ] App Store Connect — 인앱 상품 6개 신규 등록 (storeId 변경된 것)
- [ ] Google Play Console — 동일
- [ ] PortOne 가맹점 신청 (사업자등록 후)
