# 07. 푸시 알림 설정 (FCM + APNs)

> **선행 조건:** 없음 (사업자 등록 불필요)
> **소요 시간:** 1~2시간
> **비용:** 무료 (Firebase 무료 플랜으로 충분)
> **왜 필요한가:** 즐겨찾기 크리에이터 온라인 알림, 예약 리마인더, 통화 수신 알림

---

## 현재 상태

- `lib/push.ts`: 푸시 토큰 등록/해제 로직 구현 완료
- `server/lib/push.ts`: Expo Push API 호출 로직 구현 완료
- **미완성**: Firebase 프로젝트 연결 + APNs 키 등록

---

## Firebase 프로젝트 설정

### Step F-1. Firebase 프로젝트 생성

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. 프로젝트 이름: `wantsome`
3. Google Analytics: 선택 사항 (연결 권장)
4. **Create project**

### Step F-2. Android 앱 추가

1. 프로젝트 → **Project Overview** → Android 아이콘 클릭
2. 패키지명: `kr.wantsome.app`
3. 앱 닉네임: `wantsome Android`
4. **Register app**
5. `google-services.json` 다운로드

   **저장 위치:** `wantsome/google-services.json` (루트에 이미 있음)
   > 기존 파일을 새로 다운로드한 파일로 교체

6. 다음 단계는 스킵 (Expo가 자동 처리)

### Step F-3. iOS 앱 추가

1. 프로젝트 → **Project Overview** → iOS 아이콘 클릭
2. Bundle ID: `kr.wantsome.app`
3. 앱 닉네임: `wantsome iOS`
4. **Register app**
5. `GoogleService-Info.plist` 다운로드

   **저장 위치:** `wantsome/GoogleService-Info.plist` (루트에 추가)

6. `app.json`에 추가:
   ```json
   {
     "expo": {
       "ios": {
         "googleServicesFile": "./GoogleService-Info.plist"
       },
       "android": {
         "googleServicesFile": "./google-services.json"
       }
     }
   }
   ```

---

## APNs 설정 (iOS 푸시)

### Step A-1. APNs 키 생성

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Keys**
2. **+** 클릭
3. Key Name: `wantsome-push`
4. **Apple Push Notifications service (APNs)** 체크 ✅
5. **Continue** → **Register** → **Download**

```
Key ID: XXXXXXXXXX
Team ID: XXXXXXXXXX (우측 상단)
다운로드 파일: AuthKey_XXXXXXXXXX.p8
```

> ⚠️ `.p8` 파일은 한 번만 다운로드 가능. 안전하게 보관 필수.

### Step A-2. Firebase에 APNs 키 등록

1. Firebase Console → 프로젝트 → **Project Settings** (⚙️)
2. **Cloud Messaging** 탭
3. **Apple app configuration** → **APNs authentication key**
4. **Upload** 클릭:
   ```
   APNs Auth Key: [다운로드한 .p8 파일 업로드]
   Key ID: [10자리 Key ID]
   Team ID: [10자리 Team ID]
   ```

---

## Expo 설정

### Step E-1. Expo 대시보드에서 FCM 키 등록

```bash
# Expo 계정 로그인
eas login

# FCM 서버 키 확인 (Firebase Console → Project Settings → Cloud Messaging → Server key)
# Legacy Server Key 복사

# EAS에 등록
eas push:android:upload --token [FCM_SERVER_KEY]
```

### Step E-2. EAS에 APNs 키 등록

```bash
eas push:ios:upload --key ./AuthKey_XXXXXXXXXX.p8
```

### Step E-3. `app.json` 알림 설정 확인

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#F43F5E",
          "sounds": ["./assets/notification.wav"]
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#F43F5E",
      "androidMode": "default",
      "androidCollapsedTitle": "wantsome"
    }
  }
}
```

> ⚠️ `assets/notification-icon.png` 파일 필요 (96×96 px, 흰색 아이콘, 투명 배경)

---

## 알림 유형별 트리거 포인트

| 알림 | 트리거 | 서버 파일 |
|------|--------|-----------|
| 즐겨찾기 크리에이터 온라인 | `users.is_online = true` | `/api/creators/online` |
| 예약 리마인더 | 예약 시간 30분 전 Cron | `/api/cron/schedule-reminders` |
| 통화 수신 | `POST /api/calls/start` | `/api/calls/start` |
| 예약 확정 | 크리에이터가 예약 수락 | `/api/reservations/[id]/accept` |

---

## 테스트

### Expo Push Notifications 테스트 도구

[expo.dev/notifications](https://expo.dev/notifications) 접속:

1. Expo 로그인
2. **Push Notification** 탭
3. Expo push token 입력 (앱에서 확인):
   ```javascript
   // 앱에서 토큰 확인
   const token = await Notifications.getExpoPushTokenAsync();
   console.log(token.data); // ExponentPushToken[xxx...]
   ```
4. 메시지 입력 → **Send notification**

### SQL로 특정 유저에게 테스트 발송

Supabase SQL Editor:
```sql
-- 본인 push_token 확인
SELECT id, nickname, push_token FROM users
WHERE id = (SELECT id FROM auth.users WHERE email = 'yeomjw0907@gmail.com');
```

서버 API 직접 호출:
```bash
curl -X POST https://api.wantsome.kr/api/push/test \
  -H "Authorization: Bearer [access_token]" \
  -H "Content-Type: application/json" \
  -d '{"title": "테스트", "body": "푸시 알림 테스트"}'
```

---

## 완료 체크

- [ ] Firebase 프로젝트 생성
- [ ] Android 앱 등록 → `google-services.json` 교체
- [ ] iOS 앱 등록 → `GoogleService-Info.plist` 추가
- [ ] `app.json` googleServicesFile 경로 추가
- [ ] APNs 키 생성 (.p8 파일 안전하게 저장)
- [ ] Firebase에 APNs 키 등록
- [ ] EAS에 FCM 서버 키 등록
- [ ] EAS에 APNs 키 등록
- [ ] `assets/notification-icon.png` 파일 생성 (96×96 흰색 아이콘)
- [ ] 앱 실제 기기에서 push_token 정상 수신 확인 ✅
- [ ] 테스트 푸시 발송 및 수신 확인 ✅
