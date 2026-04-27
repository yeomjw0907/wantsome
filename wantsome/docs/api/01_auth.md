# API — 인증 & 본인인증

## POST /api/auth/social-login
소셜 로그인 후 유저 생성/조회

```ts
// Request
{ provider: 'kakao' | 'apple' | 'google', token: string }

// Response
{ user: User, is_new: boolean, access_token: string }

// Logic
1. Supabase Auth로 소셜 토큰 검증
2. users 테이블 upsert
3. 신규 유저 → first_charge_deadline = NOW() + 72h
```

---

## POST /api/auth/verify-identity
PortOne 본인인증 완료 처리

```ts
// Request
{ identityVerificationId: string, userId: string }

// Response
{ success: boolean, is_adult: boolean, verified_name: string }

// Logic
1. PortOne REST API로 인증결과 조회
   GET https://api.portone.io/identity-verifications/{id}
2. 만 18세 미만 → { error: 'UNDERAGE' } 반환
3. ci_blacklist 체크 → { error: 'BANNED' } 반환
4. users 테이블 업데이트:
   is_verified=true, ci, birth_date, verified_name, verified_at
```

```ts
// 연령 계산 헬퍼
function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
```

---

## 온보딩 플로우 순서

```
[1] splash (5초)
[2] 소셜 로그인 → /api/auth/social-login
[3] 공통 약관 동의 (필수 3개 + 선택 1개)
[4] 본인인증 → PortOne.requestIdentityVerification() → /api/auth/verify-identity
[5] 역할 선택 (소비자 / 크리에이터 / 둘 다)
    ↓ 소비자                    ↓ 크리에이터
[6A] 모드 선택 (🔵🔴)         [6B] 크리에이터 온보딩 (/api/creators/*)
[7A] 프로필 설정               [7B] 관리자 승인 대기
[8]  첫충전 유도 (소비자만, 72h 카운트다운)
[9]  메인 진입
```

---

## 주의사항

- PortOne SDK는 `react-native-webview` 의존 → **Expo Development Build 필요** (Expo Go 불가)
- CI 값은 절대 클라이언트에 노출 금지 → 서버사이드에서만 처리
- 본인인증 미완료 유저는 통화/충전 불가 (미들웨어에서 차단)
