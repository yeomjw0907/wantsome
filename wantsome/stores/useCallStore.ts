import { create } from "zustand";

export type CallStatus = "idle" | "connecting" | "active" | "ended";

interface CallStore {
  status: CallStatus;
  sessionId: string | null;
  agoraChannel: string | null;
  agoraToken: string | null;
  perMinRate: number;
  durationSec: number;
  pointsCharged: number;
  startCall: (params: {
    sessionId: string;
    agoraChannel: string;
    agoraToken: string;
    perMinRate: number;
  }) => void;
  tickDuration: () => void;
  endCall: () => void;
}

export const useCallStore = create<CallStore>((set) => ({
  status: "idle",
  sessionId: null,
  agoraChannel: null,
  agoraToken: null,
  perMinRate: 900,
  durationSec: 0,
  pointsCharged: 0,
  startCall: (params) =>
    set({
      ...params,
      status: "active",
      durationSec: 0,
      pointsCharged: 0,
    }),
  tickDuration: () => set((s) => ({ durationSec: s.durationSec + 1 })),
  endCall: () =>
    set({
      status: "ended",
      sessionId: null,
      agoraChannel: null,
      agoraToken: null,
    }),
}));
