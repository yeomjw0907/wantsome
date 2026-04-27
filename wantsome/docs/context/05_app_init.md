# wantsome — 앱 시작 플로우 & 딥링크 & 예외 화면

---

## 앱 시작 시 API 호출 순서 (필수)

```
앱 실행
  │
  ▼
[1] GET /api/system/status
    → maintenance_mode, min_version_ios/android, cs_url 조회
    │
    ├─ maintenance=true → 🔴 점검 화면 (이하 진행 중단)
    │
    ▼
[2] 버전 체크
    현재 앱 버전 < min_version
    → 🔴 강제 업데이트 화면 (이하 진행 중단)
    │
    ▼
[3] AsyncStorage에서 onboarding_completed 확인
    │
    ├─ false → 온보딩 플로우 (/splash)
    │
    ▼
[4] Supabase 세션 확인
    │
    ├─ 없음 → 로그인 화면 (/login)
    │
    ▼
[5] GET /api/users/me
    → 유저 정보, 포인트, 정지 여부 조회
    │
    ├─ suspended → 🔴 이용 제한 화면
    ├─ deleted   → 🔴 탈퇴 처리 화면
    │
    ▼
[6] 메인 피드 진입 ✅
```

```ts
// app/_layout.tsx 에서 구현
// hooks/useAppInit.ts

export function useAppInit() {
  const router = useRouter()

  useEffect(() => {
    async function init() {
      // 1. 시스템 상태 체크
      const status = await fetch('/api/system/status').then(r => r.json())

      if (status.maintenance_mode === 'true') {
        router.replace('/maintenance')
        return
      }

      // 2. 버전 체크
      const appVersion = Constants.expoConfig?.version ?? '1.0.0'
      const minVersion = Platform.OS === 'ios'
        ? status.min_version_ios
        : status.min_version_android

      if (compareVersions(appVersion, minVersion) < 0) {
        router.replace('/update-required')
        return
      }

      // 3. 온보딩 완료 여부
      const onboarded = await AsyncStorage.getItem('onboarding_completed')
      if (!onboarded) {
        router.replace('/(auth)/splash')
        return
      }

      // 4. 세션 확인
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/(auth)/login')
        return
      }

      // 5. 유저 상태 확인
      const user = await apiCall('/api/users/me')
      if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
        router.replace('/suspended')
        return
      }

      router.replace('/(app)/(tabs)')
    }

    init()
  }, [])
}
```

---

## 예외 화면 목록

### 🔴 미성년자 차단 화면 (/underage)
```
배경: Navy (#1B2A4A)

[아이콘: 자물쇠 🔒]

제목: "이용하실 수 없습니다"
설명: "wantsome은 만 18세 이상
      성인만 이용 가능한 서비스입니다.
      본인인증 결과 미성년자로 확인되어
      서비스 이용이 제한됩니다."

[앱 종료] 버튼만 표시 (뒤로가기 불가)
```

```ts
// app/(auth)/underage.tsx
// useEffect로 뒤로가기 차단
// BackHandler.addEventListener('hardwareBackPress', () => true)
```

### 🔴 점검 화면 (/maintenance)
```
배경: Navy (#1B2A4A)

[아이콘: 🔧]

제목: "서비스 점검 중"
설명: system_config.maintenance_message 표시
완료 예정: system_config.maintenance_eta 표시

[새로고침] 버튼 → /api/system/status 재조회
```

### 🔴 강제 업데이트 화면 (/update-required)
```
배경: Navy (#1B2A4A)

[아이콘: ⬆️]

제목: "업데이트가 필요합니다"
설명: system_config.force_update_message 표시

[지금 업데이트] 버튼
  → iOS: https://apps.apple.com/app/wantsome
  → Android: https://play.google.com/store/apps/details?id=kr.wantsome.app
```

### 🔴 이용 제한 화면 (/suspended)
```
배경: Navy (#1B2A4A)

[아이콘: 🚫]

제목: "이용이 제한되었습니다"
설명: suspended_until이 '9999-12-31'이면
      "계정이 영구 정지되었습니다."
      그 외엔
      "계정이 {날짜}까지 정지되었습니다."

[고객센터 문의] 버튼 → cs_url 웹뷰
```

### 🟡 포인트 부족 화면 (모달)
```
[팝업 모달]

제목: "포인트가 부족합니다"
설명: "현재 잔여: {points}P
      최소 필요: {per_min_rate}P"

[취소] [충전하러 가기 →]
```

---

## 딥링크 설계

### 앱 스킴
```
iOS/Android: wantsome://
웹: https://wantsome.kr/
```

### app.json 설정
```json
{
  "expo": {
    "scheme": "wantsome",
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [{ "scheme": "wantsome" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

### 딥링크 경로 목록

| 용도 | 딥링크 | 처리 |
|------|--------|------|
| 카카오 로그인 콜백 | `wantsome://auth/kakao` | Supabase Auth 처리 |
| PortOne 본인인증 콜백 | `wantsome://auth/verify` | 인증 완료 처리 |
| PortOne 결제 콜백 | `wantsome://payment/complete` | IAP 영수증 검증 |
| 크리에이터 프로필 | `wantsome://creator/{id}` | 프로필 화면 이동 |
| 충전 화면 | `wantsome://charge` | 충전 화면 이동 |

### 딥링크 핸들러
```ts
// app/_layout.tsx
import * as Linking from 'expo-linking'

const linking = {
  prefixes: ['wantsome://', 'https://wantsome.kr'],
  config: {
    screens: {
      'auth/kakao':          '(auth)/kakao-callback',
      'auth/verify':         '(auth)/verify-callback',
      'payment/complete':    '(app)/charge/complete',
      'creator/:id':         '(app)/creator/[id]',
      'charge':              '(app)/charge/index',
    }
  }
}
```

---

## /api/system/status 응답 구조

```ts
// GET /api/system/status
// 인증 불필요 (앱 시작 시 가장 먼저 호출)

Response {
  maintenance_mode:     string  // 'true' | 'false'
  maintenance_message:  string
  maintenance_eta:      string
  min_version_ios:      string  // '1.0.0'
  min_version_android:  string
  force_update_message: string
  cs_url:               string  // 오픈채팅 URL
}

// Supabase system_config 테이블에서 조회
// 캐시: 5분 (Vercel Edge Cache)
```
