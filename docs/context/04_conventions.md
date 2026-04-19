# wantsome — 코딩 컨벤션 & 공통 패턴

> 화면마다 일관성을 유지하기 위한 규칙입니다.
> 에러 처리, 로딩, 토스트, API 호출 패턴을 반드시 이 파일 기준으로 구현하세요.

---

## 토스트 메시지

**라이브러리:** `react-native-toast-message`

```ts
import Toast from 'react-native-toast-message'

// 성공
Toast.show({ type: 'success', text1: '충전 완료', text2: '5,500P가 지급됐습니다.' })

// 에러
Toast.show({ type: 'error', text1: '오류', text2: '잠시 후 다시 시도해주세요.' })

// 정보
Toast.show({ type: 'info', text1: '알림', text2: '포인트가 부족합니다.' })
```

**app/_layout.tsx 최상단에 반드시 추가:**
```tsx
import Toast from 'react-native-toast-message'
// ... 
return (
  <>
    <Stack />
    <Toast />
  </>
)
```

---

## 로딩 상태

**전체 화면 로딩:**
```tsx
import { ActivityIndicator, View } from 'react-native'

if (isLoading) return (
  <View className="flex-1 items-center justify-center bg-white">
    <ActivityIndicator size="large" color="#FF6B9D" />
  </View>
)
```

**버튼 내 로딩:**
```tsx
<TouchableOpacity
  className="bg-pink h-[52px] rounded-full items-center justify-center"
  disabled={isLoading}
  onPress={handleSubmit}
>
  {isLoading
    ? <ActivityIndicator color="white" />
    : <Text className="text-white text-base font-semibold">확인</Text>
  }
</TouchableOpacity>
```

---

## API 호출 패턴

**lib/api.ts — 기본 클라이언트:**
```ts
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

export async function apiCall<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      // TODO: Authorization 헤더 추가 (Supabase JWT)
    },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.message ?? '서버 오류가 발생했습니다.')
  }

  return res.json()
}
```

**화면에서 사용:**
```ts
const [isLoading, setIsLoading] = useState(false)

const handleCharge = async () => {
  setIsLoading(true)
  try {
    const result = await apiCall('/api/payments/verify-iap', {
      method: 'POST',
      body: JSON.stringify({ ... }),
    })
    usePointStore.getState().setPoints(result.new_balance)
    Toast.show({ type: 'success', text1: '충전 완료' })
  } catch (err) {
    Toast.show({ type: 'error', text1: '충전 실패', text2: err.message })
  } finally {
    setIsLoading(false)
  }
}
```

---

## 에러 처리 규칙

| 에러 코드 | 처리 방법 |
|---------|---------|
| `UNDERAGE` | 서비스 이용 불가 화면으로 이동 (뒤로 가기 불가) |
| `BANNED` | "이용이 제한된 계정입니다" 화면 (뒤로 가기 불가) |
| `INSUFFICIENT_POINTS` | 충전 화면으로 이동 유도 토스트 |
| `CREATOR_OFFLINE` | "크리에이터가 오프라인입니다" 토스트 |
| `IAP_VERIFY_FAIL` | "결제 검증 실패, 고객센터 문의" 토스트 |
| 그 외 서버 에러 | "잠시 후 다시 시도해주세요" 토스트 |

---

## 공통 컴포넌트 목록

> 아래 컴포넌트는 새로 만들지 말고 반드시 재사용할 것

| 컴포넌트 | 파일 | 용도 |
|---------|------|------|
| `PrimaryButton` | components/ui/PrimaryButton.tsx | Pink CTA 버튼 (로딩 상태 포함) |
| `CreatorCard` | components/CreatorCard.tsx | 피드 카드 |
| `ModeTab` | components/ModeTab.tsx | 스탠다드/프리미엄 탭 (내부 blue/red) |
| `ReportBottomSheet` | components/ReportBottomSheet.tsx | 신고 시트 |
| `PointBadge` | components/ui/PointBadge.tsx | 포인트 표시 뱃지 |

**PrimaryButton 구현:**
```tsx
// components/ui/PrimaryButton.tsx
interface Props {
  label: string
  onPress: () => void
  isLoading?: boolean
  disabled?: boolean
}

export function PrimaryButton({ label, onPress, isLoading, disabled }: Props) {
  return (
    <TouchableOpacity
      className="bg-pink h-[52px] rounded-full items-center justify-center mx-4"
      onPress={onPress}
      disabled={isLoading || disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {isLoading
        ? <ActivityIndicator color="white" />
        : <Text className="text-white text-base font-semibold">{label}</Text>
      }
    </TouchableOpacity>
  )
}
```

---

## 네비게이션 패턴

```ts
import { router } from 'expo-router'

// 이동
router.push('/(app)/(tabs)')
router.replace('/(auth)/login')   // 뒤로 가기 불가 (로그아웃 후 등)

// 파라미터 전달
router.push({ pathname: '/call/[sessionId]', params: { sessionId: '...' } })
```

---

## Supabase Realtime 구독 패턴

```ts
useEffect(() => {
  const channel = supabase
    .channel('creators-online')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'creators',
      filter: 'is_online=eq.true',
    }, (payload) => {
      useCreatorStore.getState().updateOnlineStatus(
        payload.new.id,
        payload.new.is_online
      )
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [])
```

---

## 파일 네이밍 규칙

```
컴포넌트:  PascalCase   → CreatorCard.tsx
훅:        camelCase    → useCreatorFeed.ts
유틸:      camelCase    → formatPoints.ts
상수:      camelCase    → products.ts
타입:      PascalCase   → types/Creator.ts
```

---

## 절대 하지 말 것

- `any` 타입 사용 금지
- 포인트 클라이언트 단독 차감 금지 (서버 응답 기준으로만)
- `console.log` 커밋 금지
- store 안에서 API 직접 호출 금지
- 하드코딩된 컬러값 금지 → 반드시 NativeWind 토큰 사용
- 새 store 임의 생성 금지 → `03_stores.md` 기준 4개만
