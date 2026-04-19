# wantsome — 문서

`docs/` 폴더는 API·화면·DB·가이드 등 프로젝트 문서를 두는 곳입니다.

---

## 폴더 구조

| 경로 | 설명 |
|------|------|
| [**setup/**](setup/) | **운영자 셋업 가이드 — 외부 서비스 연동 순서대로** |
| [context/](context/) | 프로젝트 개요, 비즈니스 규칙, 스토어, 앱 초기화, 배포 등 |
| [api/](api/) | 인증, 통화, 결제, 크리에이터, 예약 API 스펙 |
| [screens/](screens/) | 화면별 스펙 (온보딩, 피드, 통화, 충전, 프로필 등) |
| [database/](database/) | DB 스키마 (users, creators, calls, points 등) |
| [design/](design/) | 디자인 시스템 (컬러, 타이포, 컴포넌트) |
| [legal/](legal/) | 약관, 크리에이터 계약 |
| [admin/](admin/) | 관리자 페이지·기능 |
| [distribution-guide.md](distribution-guide.md) | APK/TestFlight 빌드·배포 전체 가이드 |
| [GUIDE_*.md](.) | 가이드 (API 서버, 소셜 로그인, Android 에뮬레이터 등) |
| [todo.md](todo.md) | 내일/단기 할 일 정리 |

### setup/ 폴더 상세

| 파일 | 내용 | 선행 조건 |
|------|------|-----------|
| [setup/README.md](setup/README.md) | 전체 체크리스트 + 진행 순서 | — |
| [setup/01_business.md](setup/01_business.md) | 사업자 등록 (홈택스) | — |
| [setup/02_twilio-sms.md](setup/02_twilio-sms.md) | Twilio SMS OTP 설정 | — |
| [setup/03_social-login.md](setup/03_social-login.md) | Google/Apple/카카오 로그인 | — |
| [setup/04_portone-pass.md](setup/04_portone-pass.md) | PortOne PASS 본인인증 | 사업자 등록 |
| [setup/05_iap.md](setup/05_iap.md) | 인앱결제 (App Store/Google Play) | 사업자 등록 |
| [setup/06_store-submission.md](setup/06_store-submission.md) | 앱스토어 제출 체크리스트 | IAP 연동 |
| [setup/07_push.md](setup/07_push.md) | 푸시 알림 (FCM/APNs) | — |
| [setup/08_nhn-sms.md](setup/08_nhn-sms.md) | NHN Cloud SMS 전환 (8원/건) | 사업자 등록 |

---

## 버전 이력

버전은 여기 README에 기록합니다. 기능 단위로 요약해 적습니다.

### 1.0.0 (진행 중)

- **앱 기반**: Expo SDK 55, Expo Router, NativeWind, Zustand
- **앱 초기화**: 시스템 상태 → 버전 → 온보딩 → 세션 → users/me → 라우팅
- **온보딩**: 스플래시, 로그인(소셜), 약관, 본인인증(테스트), 역할/모드/프로필, 첫충전 프로모
- **예외 화면**: 점검, 업데이트 필수, 정지, 미성년자
- **메인 피드**: 2컬럼 그리드, 스탠다드/프리미엄 탭(blue/red), CreatorCard, 무한스크롤, Realtime is_online
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

*주식회사 98점7도 · 원썸(wantsome)*
