import { create } from "zustand";

interface PointStore {
  points: number;
  firstChargeDeadline: string | null;
  isFirstCharged: boolean;
  setPoints: (points: number) => void;
  addPoints: (amount: number) => void;
  deductPoints: (amount: number) => void;
  setFirstChargeInfo: (deadline: string | null, isCharged: boolean) => void;
  reset: () => void;
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
  reset: () =>
    set({
      points: 0,
      firstChargeDeadline: null,
      isFirstCharged: false,
    }),
}));
