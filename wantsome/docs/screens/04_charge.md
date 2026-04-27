# 화면 — 포인트 충전

## 스펙

| 요소 | 상세 |
|------|------|
| 배경 | #FFFFFF White |
| 상단 | 잔여 포인트 크게 표시 |
| 이벤트 배너 | 첫충전 100% 배너 + 72h 카운트다운 (첫충전 가능 유저만) |
| 상품 목록 | 6개 카드 세로 스크롤 |
| 카드 구성 | 상품명 + 결제금액 + 지급 포인트 + 보너스율 배지 |
| 첫충전 표시 | 카드에 "첫충전 2배" 배지, 포인트 2배값 표시 |

## Cursor 프롬프트

```
@docs/context/02_business_rules.md
@docs/design/01_design_system.md
@docs/api/03_payments.md
@docs/database/004_points.sql.md

포인트 충전 화면을 구현해줘.

파일:
- app/(app)/charge/index.tsx
- constants/products.ts (상품 목록 상수)

구현 내용:
1. 첫충전 배너 (조건부 렌더링)
   - useAuthStore의 first_charge_deadline 확인
   - 남은 시간 카운트다운 (HH:MM:SS)
   - deadline 지났거나 is_first_charged=true → 배너 숨김

2. 충전 상품 카드 (PRODUCTS 상수 기반)
   - 상품명 + 결제금액(원) + 지급 포인트 + 보너스율 배지(Pink)
   - 첫충전 가능 시 → "첫충전 2배" 배지 + 2배 포인트 표시
   - 탭 시 결제 진행

3. IAP 결제 플로우
   import * as InAppPurchases from 'expo-in-app-purchases'
   a. InAppPurchases.connectAsync()
   b. InAppPurchases.purchaseItemAsync(product.id)
   c. 영수증 수신 → POST /api/payments/verify-iap
   d. 성공 → usePointStore 업데이트 + "충전 완료" 토스트
   e. 실패 → 에러 메시지

4. idempotency_key 생성
   `${userId}_${productId}_${Date.now()}`

5. 충전 완료 후 포인트 잔액 즉시 갱신
   GET /api/users/:id/points → usePointStore 업데이트
```
