/**
 * Supabase Realtime — call_signals 구독 훅
 *
 * 크리에이터: incoming_call 수신 → 수신 화면으로 이동
 * 소비자: call_accepted / call_rejected / call_ended 수신
 */
import { useEffect } from "react";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";

type SignalType =
  | "incoming_call"
  | "call_accepted"
  | "call_rejected"
  | "call_cancelled"
  | "call_ended";

interface CallSignal {
  id: string;
  session_id: string;
  to_user_id: string;
  from_user_id: string;
  type: SignalType;
  payload: Record<string, unknown>;
}

interface UseCallSignalOptions {
  /** 종료 신호 수신 시 콜백 (통화 화면에서 사용) */
  onCallEnded?: (payload: Record<string, unknown>) => void;
  /** 수락 신호 수신 시 콜백 (소비자 대기 모달에서 사용) */
  onCallAccepted?: (payload: Record<string, unknown>, sessionId: string) => void;
}

export function useCallSignal(options: UseCallSignalOptions = {}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

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
          const signal = payload.new as CallSignal;

          switch (signal.type) {
            case "incoming_call": {
              // 크리에이터 전용: 수신 화면으로 이동
              if (user.role === "creator" || user.role === "both") {
                router.push({
                  pathname: "/call/incoming",
                  params: {
                    sessionId: signal.session_id,
                    consumerId: String(signal.payload.consumer_id ?? ""),
                    consumerName: String(signal.payload.consumer_nickname ?? "유저"),
                    consumerAvatar: String(signal.payload.consumer_avatar ?? ""),
                    mode: String(signal.payload.mode ?? "blue"),
                    perMinRate: String(signal.payload.per_min_rate ?? 900),
                    consumerAvgRating: String(signal.payload.consumer_avg_rating ?? 0),
                    consumerTotalCalls: String(signal.payload.consumer_total_calls ?? 0),
                    consumerAvgDurationSec: String(signal.payload.consumer_avg_duration_sec ?? 0),
                  },
                });
              }
              break;
            }

            case "call_accepted": {
              // 소비자 전용: 대기 모달 → 통화 화면
              if (options.onCallAccepted) {
                options.onCallAccepted(signal.payload, signal.session_id);
              }
              break;
            }

            case "call_rejected": {
              Toast.show({
                type: "error",
                text1: "통화 거절",
                text2: "크리에이터가 통화를 거절했습니다.",
              });
              break;
            }

            case "call_cancelled": {
              Toast.show({
                type: "info",
                text1: "통화 취소",
                text2: "통화가 취소됐습니다.",
              });
              // 크리에이터가 수신 화면에 있으면 닫기
              try { router.back(); } catch { /* ignore */ }
              break;
            }

            case "call_ended": {
              const p = signal.payload;
              if (p.warning) {
                // tick에서 발생한 잔액 경고 — onCallEnded로 전달
                if (options.onCallEnded) options.onCallEnded(p);
              } else {
                if (options.onCallEnded) options.onCallEnded(p);
              }
              break;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role]);
}
