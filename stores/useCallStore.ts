import { create } from "zustand";

export type CallStatus = "idle" | "connecting" | "active" | "ended";

interface ConnectingParams {
  sessionId: string;
  agoraChannel: string;
  agoraToken: string;
  perMinRate: number;
  mode: "blue" | "red";
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
}

interface CallStore {
  status: CallStatus;
  sessionId: string | null;
  agoraChannel: string | null;
  agoraToken: string | null;
  perMinRate: number;
  mode: "blue" | "red";
  durationSec: number;
  pointsCharged: number;
  // 소비자 연결 대기 중 크리에이터 정보
  creatorId: string | null;
  creatorName: string | null;
  creatorAvatar: string | null;

  setConnecting: (params: ConnectingParams) => void;
  confirmCall: () => void;
  tickDuration: () => void;
  endCall: (pointsCharged: number) => void;
  reset: () => void;
}

export const useCallStore = create<CallStore>((set) => ({
  status: "idle",
  sessionId: null,
  agoraChannel: null,
  agoraToken: null,
  perMinRate: 900,
  mode: "blue",
  durationSec: 0,
  pointsCharged: 0,
  creatorId: null,
  creatorName: null,
  creatorAvatar: null,

  setConnecting: (params) =>
    set({
      status: "connecting",
      sessionId: params.sessionId,
      agoraChannel: params.agoraChannel,
      agoraToken: params.agoraToken,
      perMinRate: params.perMinRate,
      mode: params.mode,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      creatorAvatar: params.creatorAvatar,
      durationSec: 0,
      pointsCharged: 0,
    }),

  confirmCall: () => set({ status: "active" }),

  tickDuration: () => set((s) => ({ durationSec: s.durationSec + 1 })),

  endCall: (pointsCharged) => set({ status: "ended", pointsCharged }),

  reset: () =>
    set({
      status: "idle",
      sessionId: null,
      agoraChannel: null,
      agoraToken: null,
      perMinRate: 900,
      mode: "blue",
      durationSec: 0,
      pointsCharged: 0,
      creatorId: null,
      creatorName: null,
      creatorAvatar: null,
    }),
}));
