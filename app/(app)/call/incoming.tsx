/**
 * 크리에이터 통화 수신 화면
 * - 소비자 프로필 + 모드 뱃지 + 분당 요금
 * - 30초 링 타이머
 * - 수락(→ 통화 화면) / 거절
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Image,
  StatusBar,
  BackHandler,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { apiCall } from "@/lib/api";

const TIMER_TOTAL = 30;
const RING_SIZE = 120;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function IncomingCallScreen() {
  const router = useRouter();
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

  const [timeLeft, setTimeLeft] = useState(TIMER_TOTAL);
  const [isProcessing, setIsProcessing] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBlue = mode === "blue";
  const rate = Number(perMinRate ?? 900);

  // ─── 30초 타이머 ───
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: TIMER_TOTAL * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleReject();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current!); };
  }, []);

  // ─── 하드웨어 뒤로가기 차단 ───
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => handler.remove();
  }, []);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressAnim.stopAnimation();
  };

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopTimer();

    try {
      const result = await apiCall<{
        session_id: string;
        agora_channel: string;
        agora_token: string | null;
        agora_app_id: string;
        per_min_rate: number;
      }>(`/api/calls/${sessionId}/accept`, { method: "POST" });

      router.replace({
        pathname: "/call/[sessionId]",
        params: {
          sessionId,
          agoraChannel: result.agora_channel,
          agoraToken: result.agora_token ?? "",
          agoraAppId: result.agora_app_id,
          perMinRate: String(result.per_min_rate),
        },
      });
    } catch (e) {
      console.error("[accept]", e);
      setIsProcessing(false);
      router.back();
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopTimer();

    try {
      await apiCall(`/api/calls/${sessionId}/reject`, { method: "POST" });
    } catch { /* ignore */ }
    router.back();
  };

  // SVG 링 프로그레스
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  return (
    <View className="flex-1 bg-[#1B2A4A] items-center justify-between py-20 px-6">
      <StatusBar barStyle="light-content" backgroundColor="#1B2A4A" />

      {/* 상단: 프로필 + 정보 */}
      <View className="items-center gap-4">
        {/* 링 타이머 + 프로필 사진 */}
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
            {/* 배경 링 */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={STROKE}
              fill="none"
            />
          </Svg>
          {/* 진행 링 */}
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
          >
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={isBlue ? "#4A90E2" : "#E24A4A"}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </Svg>

          {/* 프로필 이미지 */}
          <View className="absolute inset-0 items-center justify-center">
            {consumerAvatar ? (
              <Image
                source={{ uri: consumerAvatar }}
                className="w-24 h-24 rounded-full border-2 border-white/40"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center">
                <Ionicons name="person" size={40} color="white" />
              </View>
            )}
          </View>
        </View>

        {/* 이름 + 뱃지 */}
        <Text className="text-white text-2xl font-bold mt-2">
          {consumerName ?? "유저"}
        </Text>

        <View className={`rounded-full px-3 py-1 ${isBlue ? "bg-blue-500/30" : "bg-red-500/30"}`}>
          <Text className={`text-sm font-semibold ${isBlue ? "text-blue-300" : "text-red-300"}`}>
            {isBlue ? "🔵 파란불" : "🔴 빨간불"} · {rate.toLocaleString()}P/분
          </Text>
        </View>

        <Text className="text-white/50 text-base mt-1">통화 요청이 왔습니다</Text>

        {/* 남은 시간 */}
        <Text className="text-white/40 text-sm">{timeLeft}초 후 자동 거절</Text>
      </View>

      {/* 하단 버튼 */}
      <View className="flex-row gap-16 items-center">
        {/* 거절 */}
        <View className="items-center gap-2">
          <TouchableOpacity
            className="w-16 h-16 rounded-full bg-red-500 items-center justify-center"
            onPress={handleReject}
            disabled={isProcessing}
          >
            <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
          <Text className="text-white/60 text-xs">거절</Text>
        </View>

        {/* 수락 */}
        <View className="items-center gap-2">
          <TouchableOpacity
            className="w-16 h-16 rounded-full bg-green-500 items-center justify-center"
            onPress={handleAccept}
            disabled={isProcessing}
          >
            <Ionicons name="call" size={28} color="white" />
          </TouchableOpacity>
          <Text className="text-white/60 text-xs">수락</Text>
        </View>
      </View>
    </View>
  );
}

// Animated.createAnimatedComponent로 SVG Circle에 애니메이션 적용
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
