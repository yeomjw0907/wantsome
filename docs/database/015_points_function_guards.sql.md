# 015_points_function_guards.sql

## 목적
- 예약 취소/거절/노쇼 환불과 포인트 보정 흐름에서 사용하는 `add_points` 함수 존재를 저장소 기준으로 보장합니다.

## 변경 사항
- `add_points(p_user_id uuid, p_amount integer, p_reason text default '')` 함수 추가
- 음수 입력은 `GREATEST(p_amount, 0)`로 방어

## 영향 범위
- 예약 취소/거절/노쇼 환불
- 향후 포인트 보정 로직
