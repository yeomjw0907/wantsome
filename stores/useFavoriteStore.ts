import { create } from "zustand";
import { apiCall } from "@/lib/api";

interface FavoriteStore {
  favoriteIds: Set<string>;
  isLoaded: boolean;
  load: () => Promise<void>;
  toggle: (creatorId: string) => Promise<boolean>;
  isFavorited: (creatorId: string) => boolean;
}

export const useFavoriteStore = create<FavoriteStore>((set, get) => ({
  favoriteIds: new Set(),
  isLoaded: false,

  load: async () => {
    try {
      const data = await apiCall<{ favorites: { id: string }[] }>("/api/favorites");
      set({
        favoriteIds: new Set(data.favorites.map((f) => f.id)),
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  toggle: async (creatorId: string) => {
    const prev = get().favoriteIds.has(creatorId);
    // 낙관적 업데이트
    set((s) => {
      const next = new Set(s.favoriteIds);
      if (prev) next.delete(creatorId);
      else next.add(creatorId);
      return { favoriteIds: next };
    });
    try {
      const res = await apiCall<{ favorited: boolean }>("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ creator_id: creatorId }),
      });
      return res.favorited;
    } catch {
      // 롤백
      set((s) => {
        const next = new Set(s.favoriteIds);
        if (prev) next.add(creatorId);
        else next.delete(creatorId);
        return { favoriteIds: next };
      });
      return prev;
    }
  },

  isFavorited: (creatorId: string) => get().favoriteIds.has(creatorId),
}));
