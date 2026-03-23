# DB 014 `live_runtime_fixes` migration

실제 마이그레이션 파일:
- `server/supabase/migrations/014_live_runtime_fixes.sql`

이 마이그레이션은 라이브 런타임 안정성을 보강합니다.

## 추가 함수

### `increment_user_points`

```sql
increment_user_points(p_user_id uuid, p_amount integer)
```

- 라이브 입장 실패 환불용 포인트 증가 함수
- 현재 포인트를 원자적으로 증가시키고 `remaining_points`를 반환합니다.

### `live_join_room`

```sql
live_join_room(p_room_id uuid, p_user_id uuid, p_is_admin boolean default false)
```

- 라이브 입장 처리 전용 함수
- 한 번의 DB 함수 호출 안에서 아래를 모두 처리합니다.
  - 방 상태 확인
  - 강퇴 상태 확인
  - 정원 확인
  - viewer 포인트 차감
  - `live_room_participants` upsert

반환값:

```sql
success boolean
error_code text
charged_points integer
remaining_points integer
role text
```

대표 `error_code`:
- `ROOM_NOT_FOUND`
- `ROOM_NOT_LIVE`
- `CHANNEL_NOT_READY`
- `KICKED`
- `ROOM_FULL`
- `INSUFFICIENT_POINTS`

## 해결 대상

- 라이브 입장 시 정원 확인과 포인트 차감이 분리되어 있던 문제
- 동시 입장 시 정원 초과/이중 과금 가능성
- `increment_user_points`, `live_join_room` 함수 부재로 인한 런타임 500 가능성

## 적용 후 기대 효과

- viewer 입장이 `정원 + 과금 + participant 갱신`까지 원자 처리됩니다.
- `join-ack` 실패 환불이 실제 DB 함수에 의존해 정상 동작합니다.
- 라이브 라우트가 마이그레이션 기준 스키마와 맞물리게 됩니다.
