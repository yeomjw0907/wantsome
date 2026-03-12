/**
 * CallWaitingModal — 소비자가 통화 수락을 기다리는 동안 표시되는 모달
 * - 크리에이터가 수락 → call_accepted 신호 → 통화 화면으로 이동
 * - 크리에이터가 거절 → call_rejected 신호 → 모달 닫기 + 토스트
 * - 30초 타임아웃 → 자동 취소
 */
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useCallStore } from "@/stores/useCallStore";

const TIMEOUT_SEC = 30;

export function CallWaitingModal() {
  const router = useRouter();
  const {
    status,
    sessionId,
    agoraChannel,
    agoraToken,
    perMinRate,
    mode,
    creatorId,
    creatorName,
    creatorAvatar,
    confirmCall,
    reset,
  } = useCallStore();

  const [countdown, setCountdown] = useState(TIMEOUT_SEC);
  const [isCancelling, setIsCancelling] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const visible = status === "connecting";

  // 펄스 애니메이션
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  // 카운트다운
  useEffect(() => {
    if (!visible) {
      setCountdown(TIMEOUT_SEC);
      return;
    }
    setCountdown(TIMEOUT_SEC);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          handleCancel();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, sessionId]);

  // Realtime 구독 (call_accepted / call_rejected)
  useEffect(() => {
    if (!visible || !sessionId) return;

    const channel = supabase
      .channel(`waiting-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const signal = payload.new as {
            type: string;
            payload: Record<string, unknown>;
          };

          if (signal.type === "call_accepted") {
            confirmCall();
            router.replace({
              pathname: "/call/[sessionId]",
              params: {
                sessionId: sessionId!,
                channel: agoraChannel!,
                token: agoraToken!,
                myUid: "1",
                perMinRate: String(perMinRate),
                mode: mode ?? "blue",
                creatorId: creatorId ?? "",
                creatorName: creatorName ?? "",
                creatorAvatar: creatorAvatar ?? "",
              },
            });
          }

          if (signal.type === "call_rejected") {
            reset();
            Toast.show({ type: "info", text1: "통화를 거절했습니다." });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, sessionId]);

  async function handleCancel() {
    if (!sessionId || isCancelling) return;
    setIsCancelling(true);
    try {
      await apiCall(`/api/calls/${sessionId}/cancel`, { method: "POST" });
    } catch {}
    reset();
    setIsCancelling(false);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* 크리에이터 아바타 (펄스) */}
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            {creatorAvatar ? (
              <Image source={{ uri: creatorAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
            )}
          </Animated.View>

          <Text style={styles.name}>{creatorName ?? "크리에이터"}</Text>
          <Text style={styles.subtext}>연결 중...</Text>
          <Text style={styles.countdown}>{countdown}초</Text>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={isCancelling}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>통화 취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(27,42,74,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    marginBottom: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarFallback: {
    backgroundColor: "#4D6A9B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 40,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  subtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  countdown: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FF6B9D",
  },
  cancelBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  cancelText: {
    color: "#FFFFFF",
    fontSize: 15,
  },
});
