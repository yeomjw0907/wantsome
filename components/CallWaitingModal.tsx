/**
 * 소비자 통화 연결 대기 모달
 * - POST /api/calls/start 후 크리에이터 응답 대기
 * - 30초 카운트다운 → 자동 취소
 * - Supabase Realtime으로 call_accepted / call_rejected 감지
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

interface CallWaitingModalProps {
  visible: boolean;
  sessionId: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  perMinRate: number;
  onClose: () => void;
}

const WAIT_TOTAL = 30;

export default function CallWaitingModal({
  visible,
  sessionId,
  creatorId,
  creatorName,
  creatorAvatar,
  perMinRate,
  onClose,
}: CallWaitingModalProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [timeLeft, setTimeLeft] = useState(WAIT_TOTAL);
  const [isCancelling, setIsCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ─── 펄스 애니메이션 ───
  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible]);

  // ─── 30초 카운트다운 ───
  useEffect(() => {
    if (!visible) return;
    setTimeLeft(WAIT_TOTAL);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleCancel();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current!); };
  }, [visible, sessionId]);

  // ─── Realtime 신호 구독 ───
  useEffect(() => {
    if (!visible || !user?.id || !sessionId) return;

    const channel = supabase
      .channel(`waiting-${sessionId}`)
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
          if (signal.session_id !== sessionId) return;

          if (signal.type === "call_accepted") {
            clearInterval(timerRef.current!);
            onClose();
            router.push({
              pathname: "/call/[sessionId]",
              params: {
                sessionId,
                agoraChannel: String(signal.payload.agora_channel ?? ""),
                agoraToken: String(signal.payload.agora_token ?? ""),
                agoraAppId: String(signal.payload.agora_app_id ?? ""),
                perMinRate: String(perMinRate),
                creatorId,
                creatorName,
                creatorAvatar: creatorAvatar ?? "",
              },
            });
          }

          if (signal.type === "call_rejected") {
            clearInterval(timerRef.current!);
            Toast.show({ type: "error", text1: "통화 거절", text2: "크리에이터가 거절했습니다." });
            onClose();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [visible, sessionId, user?.id]);

  const handleCancel = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await apiCall(`/api/calls/${sessionId}/cancel`, { method: "POST" });
    } catch { /* ignore */ }
    onClose();
  }, [sessionId, isCancelling]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "rgba(27,42,74,0.96)" }}
      >
        {/* 프로필 + 펄스 */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {creatorAvatar ? (
            <Image
              source={{ uri: creatorAvatar }}
              className="w-24 h-24 rounded-full border-2 border-white/40"
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="person" size={40} color="white" />
            </View>
          )}
        </Animated.View>

        <Text className="text-white text-xl font-bold mt-5">
          {creatorName}
        </Text>
        <Text className="text-white/60 text-base mt-1">연결 중...</Text>
        <Text className="text-white/40 text-sm mt-2">{timeLeft}초</Text>

        <Text className="text-white/40 text-sm mt-1">
          {perMinRate.toLocaleString()}P/분
        </Text>

        {/* 취소 버튼 */}
        <TouchableOpacity
          className="mt-10 border border-white/30 rounded-2xl px-8 py-3"
          onPress={handleCancel}
          disabled={isCancelling}
        >
          <Text className="text-white/80 font-semibold">통화 취소</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
