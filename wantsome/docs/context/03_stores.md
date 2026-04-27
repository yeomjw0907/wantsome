# wantsome — Zustand Store 구조

> 모든 전역 상태는 이 파일 기준으로 구현합니다.
> store를 새로 만들거나 필드를 추가할 때 반드시 여기를 먼저 확인하세요.

---

## stores/useAuthStore.ts

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface User {
  id: string
  nickname: string
  profile_img: string | null
  role: 'consumer' | 'creator' | 'both'
  is_verified: boolean       // 본인인증 완료 여부
  blue_mode: boolean
  red_mode: boolean
  suspended_until: string | null
}

interface AuthStore {
  user: User | null
  isLoggedIn: boolean
  isOnboarded: boolean       // 온보딩 완료 여부 (AsyncStorage 연동)

  // Actions
  setUser: (user: User) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
  setOnboarded: (v: boolean) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      isOnboarded: false,

      setUser: (user) => set({ user, isLoggedIn: true }),
      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
      logout: () => set({ user: null, isLoggedIn: false }),
      setOnboarded: (v) => set({ isOnboarded: v }),
    }),
    {
      name: 'auth-storage',
      storage: {
        getItem: async (k) => JSON.parse((await AsyncStorage.getItem(k)) ?? 'null'),
        setItem: async (k, v) => AsyncStorage.setItem(k, JSON.stringify(v)),
        removeItem: async (k) => AsyncStorage.removeItem(k),
      },
    }
  )
)
```

---

## stores/usePointStore.ts

```ts
import { create } from 'zustand'

interface PointStore {
  points: number
  firstChargeDeadline: string | null  // ISO 날짜 (72h 카운트다운)
  isFirstCharged: boolean

  // Actions
  setPoints: (points: number) => void
  addPoints: (amount: number) => void
  deductPoints: (amount: number) => void
  setFirstChargeInfo: (deadline: string | null, isCharged: boolean) => void
}

export const usePointStore = create<PointStore>((set) => ({
  points: 0,
  firstChargeDeadline: null,
  isFirstCharged: false,

  setPoints: (points) => set({ points }),
  addPoints: (amount) => set((s) => ({ points: s.points + amount })),
  deductPoints: (amount) => set((s) => ({ points: Math.max(0, s.points - amount) })),
  setFirstChargeInfo: (deadline, isCharged) =>
    set({ firstChargeDeadline: deadline, isFirstCharged: isCharged }),
}))
```

---

## stores/useCallStore.ts

```ts
import { create } from 'zustand'

type CallStatus = 'idle' | 'connecting' | 'active' | 'ended'

interface CallStore {
  status: CallStatus
  sessionId: string | null
  agoraChannel: string | null
  agoraToken: string | null
  perMinRate: number         // 900 or 1300
  durationSec: number        // 통화 경과 초
  pointsCharged: number      // 현재까지 차감된 포인트

  // Actions
  startCall: (params: {
    sessionId: string
    agoraChannel: string
    agoraToken: string
    perMinRate: number
  }) => void
  tickDuration: () => void   // 1초마다 호출
  endCall: () => void
}

export const useCallStore = create<CallStore>((set) => ({
  status: 'idle',
  sessionId: null,
  agoraChannel: null,
  agoraToken: null,
  perMinRate: 900,
  durationSec: 0,
  pointsCharged: 0,

  startCall: (params) => set({ ...params, status: 'active', durationSec: 0, pointsCharged: 0 }),
  tickDuration: () => set((s) => ({ durationSec: s.durationSec + 1 })),
  endCall: () => set({ status: 'ended', sessionId: null, agoraChannel: null, agoraToken: null }),
}))
```

---

## stores/useCreatorStore.ts

```ts
import { create } from 'zustand'

interface Creator {
  id: string
  display_name: string
  profile_image_url: string | null
  grade: '신규' | '일반' | '인기' | '탑'
  is_online: boolean
  mode_blue: boolean
  mode_red: boolean
  settlement_rate: number
  monthly_minutes: number
}

interface CreatorStore {
  // 피드
  feedBlue: Creator[]
  feedRed: Creator[]
  isLoading: boolean
  hasMoreBlue: boolean
  hasMoreRed: boolean

  // 내 크리에이터 프로필 (크리에이터 유저만)
  myProfile: Creator | null
  isOnline: boolean

  // Actions
  setFeed: (mode: 'blue' | 'red', creators: Creator[], hasMore: boolean) => void
  appendFeed: (mode: 'blue' | 'red', creators: Creator[], hasMore: boolean) => void
  updateOnlineStatus: (creatorId: string, isOnline: boolean) => void
  setMyProfile: (profile: Creator) => void
  setIsOnline: (v: boolean) => void
  setLoading: (v: boolean) => void
}

export const useCreatorStore = create<CreatorStore>((set) => ({
  feedBlue: [],
  feedRed: [],
  isLoading: false,
  hasMoreBlue: true,
  hasMoreRed: true,
  myProfile: null,
  isOnline: false,

  setFeed: (mode, creators, hasMore) =>
    set(mode === 'blue'
      ? { feedBlue: creators, hasMoreBlue: hasMore }
      : { feedRed: creators, hasMoreRed: hasMore }),

  appendFeed: (mode, creators, hasMore) =>
    set((s) => mode === 'blue'
      ? { feedBlue: [...s.feedBlue, ...creators], hasMoreBlue: hasMore }
      : { feedRed: [...s.feedRed, ...creators], hasMoreRed: hasMore }),

  updateOnlineStatus: (creatorId, isOnline) =>
    set((s) => ({
      feedBlue: s.feedBlue.map((c) => c.id === creatorId ? { ...c, is_online: isOnline } : c),
      feedRed:  s.feedRed.map((c)  => c.id === creatorId ? { ...c, is_online: isOnline } : c),
    })),

  setMyProfile: (profile) => set({ myProfile: profile }),
  setIsOnline: (v) => set({ isOnline: v }),
  setLoading: (v) => set({ isLoading: v }),
}))
```

---

## 사용 규칙

- store는 위 4개만 사용. 임의로 새 store 만들지 말 것
- 서버 데이터 패칭은 store 안에 넣지 말 것 → API 호출은 컴포넌트/훅에서
- `useAuthStore`는 persist 적용 → 앱 재시작 후에도 로그인 유지
- 포인트는 서버 응답 기준으로만 업데이트 (`setPoints`) — 클라이언트 단독 차감 금지
