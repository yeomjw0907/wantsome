/**
 * 통화 시그널 훅 — 크리에이터 수신 신호 처리
 * - incoming_call  → 수신 화면으로 이동
 * - call_cancelled → 수신 화면에서 뒤로가기
 * - call_ended     → 강제 종료 처리 (포인트 소진 등)
 *
 * 소비자 수락/거절 신호(call_accepted, call_rejected)는
 * CallWaitingModal 내부에서 직접 처리한다.
 */
import { useEffect } from "react";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";

export function useCallSignal() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { reset, endCall, durationSec, pointsCharged } = useCallStore();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`call-signals-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `to_user_id=eq.${user.id}`,
        },
        (payload) => {
          const signal = payload.new as {
            type: string;
            session_id: string;
            payload: Record<string, unknown>;
          };

          if (signal.type === "incoming_call") {
            const p = signal.payload;
            router.push({
              pathname: "/call/incoming",
              params: {
                sessionId: signal.session_id,
                consumerName: (p.consumer_nickname as string) ?? "소비자",
                consumerAvatar: (p.consumer_avatar as string) ?? "",
                mode: (p.mode as string) ?? "blue",
                perMinRate: String(p.per_min_rate ?? 900),
              },
            });
          }

          if (signal.type === "call_cancelled") {
            Toast.show({ type: "info", text1: "통화가 취소됐습니다." });
            if (router.canGoBack()) router.back();
          }

          if (signal.type === "call_ended") {
            // 서버 강제 종료 (포인트 소진)
            const store = useCallStore.getState();
            endCall(store.pointsCharged);
            router.replace({
              pathname: "/call/summary",
              params: {
                sessionId: signal.session_id,
                durationSec: String(store.durationSec),
                pointsCharged: String(store.pointsCharged),
                creatorId: store.creatorId ?? "",
                creatorName: store.creatorName ?? "",
                creatorAvatar: store.creatorAvatar ?? "",
                perMinRate: String(store.perMinRate),
              },
            });
            Toast.show({ type: "error", text1: "포인트가 소진되어 통화가 종료됐습니다." });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
