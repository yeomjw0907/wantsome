# wantsome — 문서

`docs/` 폴더는 API·화면·DB·가이드 등 프로젝트 문서를 두는 곳입니다.

---

## 폴더 구조

| 경로 | 설명 |
|------|------|
| [context/](context/) | 프로젝트 개요, 비즈니스 규칙, 스토어, 앱 초기화, 배포 등 |
| [api/](api/) | 인증, 통화, 결제, 크리에이터, 예약 API 스펙 |
| [screens/](screens/) | 화면별 스펙 (온보딩, 피드, 통화, 충전, 프로필 등) |
| [database/](database/) | DB 스키마 (users, creators, calls, points 등) |
| [design/](design/) | 디자인 시스템 (컬러, 타이포, 컴포넌트) |
| [legal/](legal/) | 약관, 크리에이터 계약 |
| [admin/](admin/) | 관리자 페이지·기능 |
| [GUIDE_*.md](.) | 가이드 (API 서버, 소셜 로그인, Android 에뮬레이터 등) |
| [todo.md](todo.md) | 내일/단기 할 일 정리 |

---

## 버전 이력

버전은 여기 README에 기록합니다. 기능 단위로 요약해 적습니다.

### 1.0.0 (진행 중)

- **앱 기반**: Expo SDK 55, Expo Router, NativeWind, Zustand
- **앱 초기화**: 시스템 상태 → 버전 → 온보딩 → 세션 → users/me → 라우팅
- **온보딩**: 스플래시, 로그인(소셜), 약관, 본인인증(테스트), 역할/모드/프로필, 첫충전 프로모
- **예외 화면**: 점검, 업데이트 필수, 정지, 미성년자
- **메인 피드**: 2컬럼 그리드, 파란불/빨간불 탭, CreatorCard, 무한스크롤, Realtime is_online
- **포인트 충전**: 상품 카드, 첫충전 배너·2배, IAP 연동(verify-iap), mock 결제
- **프로필**: 보유 포인트, 포인트 충전 진입, 닉네임
- **API 서버**: Next.js 15 — system/status, auth/social-login, verify-identity, users/me, creators/feed, payments/verify-iap, payments/products, users/:id/points
- **DB**: users, system_config, ci_blacklist, point_charges (Supabase)
- **가이드**: API 서버, 소셜 로그인, Android 에뮬레이터

### 예정

- 영상통화 (Agora, calls API, call 화면)
- 예약 (목록·상세·확정/거절)
- 크리에이터 대시보드
- 관리자

---

*원썸 컴퍼니 (WS Company)*
