import { create } from "zustand";

export interface Creator {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  grade: "신규" | "일반" | "인기" | "탑";
  is_online: boolean;
  mode_blue: boolean;
  mode_red: boolean;
  settlement_rate: number;
  monthly_minutes: number;
}

interface CreatorStore {
  feedBlue: Creator[];
  feedRed: Creator[];
  isLoading: boolean;
  hasMoreBlue: boolean;
  hasMoreRed: boolean;
  myProfile: Creator | null;
  isOnline: boolean;
  setFeed: (mode: "blue" | "red", creators: Creator[], hasMore: boolean) => void;
  appendFeed: (mode: "blue" | "red", creators: Creator[], hasMore: boolean) => void;
  updateOnlineStatus: (creatorId: string, isOnline: boolean) => void;
  setMyProfile: (profile: Creator | null) => void;
  setIsOnline: (v: boolean) => void;
  setLoading: (v: boolean) => void;
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
    set(
      mode === "blue"
        ? { feedBlue: creators, hasMoreBlue: hasMore }
        : { feedRed: creators, hasMoreRed: hasMore }
    ),
  appendFeed: (mode, creators, hasMore) =>
    set((s) =>
      mode === "blue"
        ? { feedBlue: [...s.feedBlue, ...creators], hasMoreBlue: hasMore }
        : { feedRed: [...s.feedRed, ...creators], hasMoreRed: hasMore }
    ),
  updateOnlineStatus: (creatorId, isOnline) =>
    set((s) => ({
      feedBlue: s.feedBlue.map((c) =>
        c.id === creatorId ? { ...c, is_online: isOnline } : c
      ),
      feedRed: s.feedRed.map((c) =>
        c.id === creatorId ? { ...c, is_online: isOnline } : c
      ),
    })),
  setMyProfile: (profile) => set({ myProfile: profile }),
  setIsOnline: (v) => set({ isOnline: v }),
  setLoading: (v) => set({ isLoading: v }),
}));
