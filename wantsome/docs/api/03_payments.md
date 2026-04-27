# API — 결제 & 포인트

## POST /api/payments/verify-iap
인앱결제 영수증 서버 검증 + 포인트 지급

```ts
// Request
{
  user_id: string,
  receipt: string,
  platform: 'ios' | 'android',
  product_id: string,          // POINT_01 ~ POINT_06
  idempotency_key: string      // 이중 충전 방지
}

// Response
{ success: boolean, points_added: number, new_balance: number }

// Logic
1. idempotency_key 중복 체크 → 이미 처리됐으면 기존 결과 반환
2. 플랫폼별 영수증 검증
   iOS:     POST https://buy.itunes.apple.com/verifyReceipt
   Android: Google Play Developer API purchases.products.get
3. 검증 실패 → 에러 반환
4. PRODUCTS 상수에서 points, bonus 조회
5. is_first = users.is_first_charged === false
6. 첫충전 시 points × 2
7. users.points += points
8. point_charges INSERT
9. 첫충전 완료 → is_first_charged = true
```

---

## GET /api/payments/products
충전 상품 목록 조회

```ts
// Response
{
  products: [{
    id: string,
    name: string,
    price_krw: number,
    points: number,
    bonus_rate: number,
    first_charge_points: number   // 첫충전 시 지급량
  }],
  is_first_available: boolean,    // 첫충전 이벤트 가능 여부
  first_charge_deadline: string | null
}
```

---

## GET /api/users/:id/points
잔여 포인트 조회

```ts
// Response
{
  points: number,
  first_charge_deadline: string | null,   // 72시간 카운트다운용
  is_first_charged: boolean
}
```

---

## 이중 충전 방지

```ts
// 클라이언트에서 idempotency_key 생성
const idempotencyKey = `${userId}_${productId}_${Date.now()}`;

// 서버에서 체크
const existing = await supabase
  .from('point_charges')
  .select('id')
  .eq('idempotency_key', idempotencyKey)
  .single();

if (existing.data) return existing.data; // 기존 결과 반환
```

---

## 첫충전 이벤트 로직

```
가입 시: first_charge_deadline = NOW() + 72시간
충전 화면: deadline 남은 시간 카운트다운 표시
첫충전 완료: is_first_charged = true → 이후 일반 충전
deadline 초과: 이벤트 만료 → 일반 충전만 가능
```
