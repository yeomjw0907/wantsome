import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "@/lib/secureStorage";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useCreatorStore } from "@/stores/useCreatorStore";
import { usePointStore } from "@/stores/usePointStore";

export interface User {
  id: string;
  nickname: string;
  profile_img: string | null;
  role: "consumer" | "creator" | "both";
  is_verified: boolean;
  blue_mode: boolean;
  red_mode: boolean;
  suspended_until: string | null;
  bio?: string | null;
  is_first_charged?: boolean;
  points?: number;
}

interface AuthStore {
  user: User | null;
  isLoggedIn: boolean;
  isOnboarded: boolean;
  setUser: (user: User) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => Promise<void>;
  setOnboarded: (v: boolean) => void;
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
      logout: async () => {
        // 푸시 토큰 정리 — 다음 사용자에게 이전 사용자 알림 가는 것 방지.
        // signOut 전에 호출 (인증 토큰 유효한 상태에서 서버 정리).
        await apiCall("/api/push/register", { method: "DELETE" }).catch(() => null);
        await supabase.auth.signOut().catch(() => null);
        usePointStore.getState().reset();
        useCreatorStore.getState().reset();
        set({ user: null, isLoggedIn: false });
      },
      setOnboarded: (v) => set({ isOnboarded: v }),
    }),
    {
      // PR-9: AsyncStorage 평문 저장 → SecureStore (iOS Keychain / Android EncryptedSharedPreferences).
      // role/is_verified를 평문 저장하면 루팅 기기에서 변조해 UI 게이트 우회 가능.
      name: "auth-storage",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
