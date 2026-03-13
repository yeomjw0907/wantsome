import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  logout: () => void;
  setOnboarded: (v: boolean) => void;
}

const asyncStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
  removeItem: (name: string) => AsyncStorage.removeItem(name),
};

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
      name: "auth-storage",
      storage: createJSONStorage(() => asyncStorage),
    }
  )
);
