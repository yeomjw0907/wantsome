# wantsome — Expo EAS Build 설정

> 네이티브 모듈 (PortOne, Agora) 사용으로 Expo Go 불가
> 반드시 Development Build 사용해야 함

---

## eas.json

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "http://localhost:3000",
        "EXPO_PUBLIC_SUPABASE_URL": "",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "",
        "EXPO_PUBLIC_AGORA_APP_ID": "",
        "EXPO_PUBLIC_PORTONE_STORE_ID": "",
        "EXPO_PUBLIC_PORTONE_CHANNEL_KEY": ""
      }
    },
    "staging": {
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api-staging.wantsome.kr"
      }
    },
    "production": {
      "distribution": "store",
      "channel": "production",
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api.wantsome.kr"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "",
        "ascAppId": "",
        "appleTeamId": ""
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## app.json 핵심 설정

```json
{
  "expo": {
    "name": "wantsome",
    "slug": "wantsome",
    "version": "1.0.0",
    "scheme": "wantsome",
    "orientation": "portrait",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "kr.wantsome.app",
      "buildNumber": "1",
      "supportsTablet": false,
      "infoPlist": {
        "NSCameraUsageDescription": "영상통화를 위해 카메라 접근이 필요합니다.",
        "NSMicrophoneUsageDescription": "영상통화를 위해 마이크 접근이 필요합니다.",
        "NSPhotoLibraryUsageDescription": "프로필 사진 등록을 위해 사진 접근이 필요합니다.",
        "NSFaceIDUsageDescription": "본인인증을 위해 Face ID 접근이 필요합니다."
      }
    },
    "android": {
      "package": "kr.wantsome.app",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "VIBRATE"
      ],
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      ["expo-camera", { "cameraPermission": "영상통화를 위해 카메라 접근이 필요합니다." }],
      ["expo-av", { "microphonePermission": "영상통화를 위해 마이크 접근이 필요합니다." }],
      "expo-router",
      "expo-notifications",
      "@react-native-seoul/kakao-login"
    ]
  }
}
```

---

## 빌드 명령어

```bash
# 개발 빌드 (iOS 시뮬레이터)
eas build --profile development --platform ios

# 개발 빌드 (Android APK)
eas build --profile development --platform android

# 스테이징 빌드 (내부 테스트)
eas build --profile staging --platform all

# 프로덕션 빌드 (앱스토어 제출)
eas build --profile production --platform all

# 앱스토어 제출
eas submit --profile production --platform ios
eas submit --profile production --platform android

# OTA 업데이트 (JS 코드만 변경 시)
eas update --channel production --message "버그 수정"
```

---

## 개발 환경 세팅 순서 (처음 시작할 때)

```bash
# 1. EAS CLI 설치
npm install -g eas-cli

# 2. EAS 로그인
eas login

# 3. 프로젝트 초기화
eas init

# 4. Development Build 생성 (최초 1회)
eas build --profile development --platform ios

# 5. 빌드된 앱 시뮬레이터에 설치 후
npx expo start --dev-client
```

---

## OTA 업데이트 정책

```
네이티브 코드 변경 시 → EAS Build 필요 (앱스토어 재심사)
  - 새 네이티브 패키지 추가
  - app.json 변경
  - 권한 추가

JS/TS 코드만 변경 시 → eas update (즉시 반영, 심사 불필요)
  - 버그 수정
  - UI 변경
  - 비즈니스 로직 변경
```
