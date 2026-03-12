/**
 * 크리에이터 수신 화면
 * - 30초 타이머, 수락/거절 버튼
 * - 수락 → POST /api/calls/:id/accept → 통화 화면으로 이동
 * - 거절 → POST /api/calls/:id/reject → 뒤로가기
 */
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";

const TIMEOUT_SEC = 30;

export default function IncomingCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    sessionId,
    consumerName,
    consumerAvatar,
    mode,
    perMinRate,
  } = useLocalSearchParams<{
    sessionId: string;
    consumerName: string;
    consumerAvatar: string;
    mode: string;
    perMinRate: string;
  }>();

  const [countdown, setCountdown] = useState(TIMEOUT_SEC);
  const [isProcessing, setIsProcessing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isBlue = mode !== "red";
  const ratePerMin = Number(perMinRate) || 900;

  // 펄스 애니메이션
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // 30초 카운트다운 → 자동 취소(back)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          if (router.canGoBack()) router.back();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // call_cancelled 실시간 수신
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`incoming-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const sig = payload.new as { type: string };
          if (sig.type === "call_cancelled") {
            Toast.show({ type: "info", text1: "통화가 취소됐습니다." });
            if (router.canGoBack()) router.back();
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  async function handleAccept() {
    if (isProcessing || !sessionId) return;
    setIsProcessing(true);
    try {
      const res = await apiCall<{ agora_channel: string; agora_token: string }>(
        `/api/calls/${sessionId}/accept`,
        { method: "POST" },
      );
      router.replace({
        pathname: "/call/[sessionId]",
        params: {
          sessionId,
          channel: res.agora_channel,
          token: res.agora_token,
          myUid: "2",
          perMinRate: String(ratePerMin),
          mode: mode ?? "blue",
          creatorId: "",
          creatorName: consumerName ?? "",
          creatorAvatar: consumerAvatar ?? "",
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
      Toast.show({ type: "error", text1: msg });
      setIsProcessing(false);
    }
  }

  async function handleReject() {
    if (isProcessing || !sessionId) return;
    setIsProcessing(true);
    try {
      await apiCall(`/api/calls/${sessionId}/reject`, { method: "POST" });
    } catch {}
    if (router.canGoBack()) router.back();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 상단: 소비자 정보 */}
      <View style={styles.top}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          {consumerAvatar ? (
            <Image source={{ uri: consumerAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
        </Animated.View>

        <Text style={styles.name}>{consumerName ?? "소비자"}</Text>

        <View style={[styles.modeBadge, { backgroundColor: isBlue ? "#D1E4F8" : "#FFEEF1" }]}>
          <Text style={[styles.modeText, { color: isBlue ? "#4D9FFF" : "#FF5C7A" }]}>
            {isBlue ? "🔵 파란불" : "🔴 빨간불"}  {ratePerMin}P/분
          </Text>
        </View>

        <Text style={styles.subtext}>통화 요청이 왔습니다</Text>
      </View>

      {/* 카운트다운 */}
      <Text style={styles.countdown}>{countdown}초</Text>

      {/* 수락/거절 버튼 */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, styles.rejectBtn]}
          onPress={handleReject}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>📵</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.acceptBtn]}
          onPress={handleAccept}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1B2A4A",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  top: {
    alignItems: "center",
    gap: 12,
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 8,
  },
  modeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  subtext: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  countdown: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FF6B9D",
  },
  buttons: {
    flexDirection: "row",
    gap: 48,
  },
  btn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    backgroundColor: "#EF4444",
  },
  acceptBtn: {
    backgroundColor: "#22C55E",
  },
  btnIcon: {
    fontSize: 28,
  },
});
