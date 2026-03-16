# wantsome — 운영자 셋업 체크리스트

> 이 폴더는 **코드 작업 없이 운영자가 직접 외부 서비스를 세팅**해야 하는 작업들을 정리합니다.
> 순서대로 진행하세요. 선행 조건이 완료되지 않으면 다음 단계가 불가합니다.

---

## 진행 순서 & 현황

| 순서 | 파일 | 작업 | 선행 조건 | 상태 |
|------|------|------|-----------|------|
| 1 | [01_business.md](01_business.md) | 사업자 등록 | — | ⏳ 진행 전 |
| 2 | [02_twilio-sms.md](02_twilio-sms.md) | Twilio SMS 설정 (OTP) | — | ⏳ 진행 전 |
| 3 | [03_social-login.md](03_social-login.md) | Google/Apple/카카오 로그인 | — | ⏳ 진행 전 |
| 4 | [04_portone-pass.md](04_portone-pass.md) | PortOne PASS 본인인증 | 사업자 등록 ✅ | ⏳ 대기 |
| 5 | [05_iap.md](05_iap.md) | 인앱결제 (App Store + Google Play) | 사업자 등록 ✅ | ⏳ 대기 |
| 6 | [06_store-submission.md](06_store-submission.md) | 앱스토어 제출 | IAP 연동 ✅ | ⏳ 대기 |
| 7 | [07_push.md](07_push.md) | 푸시 알림 (FCM/APNs) | — | ⏳ 진행 전 |
| 8 | [08_nhn-sms.md](08_nhn-sms.md) | NHN Cloud SMS 전환 | 사업자 등록 ✅ | ⏳ 대기 |

---

## 지금 당장 할 수 있는 것 (사업자 등록 없이)

- [ ] **[02] Twilio SMS** — 계정 생성 + Supabase 전화번호 인증 활성화
- [ ] **[03] 소셜 로그인** — Google OAuth + 카카오 설정 (Apple은 유료 개발자 계정 필요)
- [ ] **[07] 푸시 알림** — Firebase 프로젝트 생성 + Expo 설정

## 사업자 등록 후 해야 하는 것

- [ ] **[01] 사업자 등록** (이 모든 것의 선행 조건)
- [ ] **[04] PortOne PASS** — 성인인증 실제 연동
- [ ] **[05] IAP** — 앱스토어 실결제 연동
- [ ] **[06] 앱스토어 제출**
- [ ] **[08] NHN Cloud SMS** — Twilio보다 7.7배 저렴 (8원/건)

---

## 핵심 계정/URL 정리

| 서비스 | 콘솔 URL | 목적 |
|--------|----------|------|
| Supabase | https://supabase.com/dashboard | DB, Auth, Storage |
| Vercel | https://vercel.com/dashboard | 서버 배포 |
| Twilio | https://console.twilio.com | SMS OTP |
| Google Cloud | https://console.cloud.google.com | Google 로그인 |
| Apple Developer | https://developer.apple.com | iOS 배포, Apple 로그인 |
| 카카오 Developers | https://developers.kakao.com | 카카오 로그인 |
| PortOne | https://console.portone.io | 본인인증 + 결제 |
| App Store Connect | https://appstoreconnect.apple.com | iOS 앱 제출 |
| Google Play Console | https://play.google.com/console | Android 앱 제출 |
| Firebase | https://console.firebase.google.com | 푸시 알림 (FCM) |
| NHN Cloud | https://console.nhncloud.com | SMS (사업자 후) |
| 홈택스 | https://www.hometax.go.kr | 사업자 등록 |

---

*최종 업데이트: 2026-03-16*
