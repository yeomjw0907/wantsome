# 화면 — 온보딩

## 플로우

```
splash → login → (연령 확인 age-check, 미완 시) → terms → verify → role → (mode | creator_onboarding) → profile → charge_promo → 메인
```

앱 재실행 시: 온보딩 완료 후 **세션이 있으나 age_verified 없음** → `age-check` (로그인 전 단독 연령 게이트는 사용하지 않음).

## 화면별 스펙

| 화면 | 파일 | 핵심 로직 |
|------|------|---------|
| Splash | (auth)/splash.tsx | 5초 후 자동 이동, 로고 애니메이션 |
| 소셜 로그인 | (auth)/login.tsx | 카카오/애플/구글, Supabase Auth |
| 약관 동의 | (auth)/terms.tsx | 필수 3개 미동의 시 Next 비활성 |
| 본인인증 | (auth)/verify.tsx | PortOne 웹뷰, 만 18세 미만 차단 |
| 역할 선택 | (auth)/role.tsx | 소비자/크리에이터/둘 다 |
| 모드 선택 | (앱 내 피드 등) | 프리미엄(red) 선택 시 추가 동의(해당 플로우가 있는 경우) |
| 프로필 설정 | (auth)/profile.tsx | 닉네임 + 사진 (Supabase Storage) |
| 첫충전 유도 | (auth)/charge-promo.tsx | 72h 카운트다운, 소비자만 |

## Cursor 프롬프트

```
@docs/context/01_project_overview.md
@docs/design/01_design_system.md
@docs/api/01_auth.md

온보딩 플로우를 구현해줘.

파일 목록:
- app/(auth)/splash.tsx        → Navy 배경, Pink 로고, 5초 후 /login 이동
- app/(auth)/login.tsx         → 카카오/애플/구글 버튼, Supabase Auth 소셜로그인
- app/(auth)/terms.tsx         → 약관 스크롤 리스트 (필수 3개 + 선택 1개), 전체동의 토글
- app/(auth)/verify.tsx        → PortOne.requestIdentityVerification() 웹뷰 호출
                                 완료 후 POST /api/auth/verify-identity
                                 만 18세 미만 → 차단 화면 이동
- app/(auth)/role.tsx          → 소비자 / 크리에이터 / 둘 다 선택 카드
- (선택) 모드 동의 UI        → 스탠다드/프리미엄 선택, 프리미엄 추가 동의 BottomSheet (라우트는 제품 버전에 맞게 조정)
- app/(auth)/profile.tsx       → 닉네임 입력 + expo-image-picker 프로필 사진
- app/(auth)/charge-promo.tsx  → 첫충전 100% 배너 + 카운트다운 타이머 (72h)

공통 규칙:
- NativeWind 스타일링 사용
- Zustand useAuthStore에 유저 상태 저장
- AsyncStorage에 온보딩 완료 플래그 저장
- 필수 약관 미동의 → Next 버튼 비활성
- 모든 화면 하단 Primary 버튼 (Pink, full radius)
```
