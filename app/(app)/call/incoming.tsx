/**
 * 크리에이터 통화 수신 화면
 * - 소비자 프로필 + 모드 뱃지 + 분당 요금
 * - 인라인 유저 통계 (⭐ 평점 / 🕐 평균통화 / 📞 총통화횟수)
 * - "상세보기" 탭 시 histogram + 4카테고리 펼침
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
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import {
  usePreventScreenCapture,
  addScreenshotListener,
} from "expo-screen-capture";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";

const TIMER_TOTAL = 30;
const RING_SIZE = 120;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type DetailStats = {
  avg_rating: number;
  total_calls: number;
  avg_call_duration_sec: number;
  histogram: {
    under_15s: number;
    under_1m: number;
    under_3m: number;
    over_3m: number;
  };
  category_ratings: {
    호감: number;
    신뢰: number;
    매너: number;
    매력: number;
  };
};

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

export default function IncomingCallScreen() {
  usePreventScreenCapture();

  useEffect(() => {
    const sub = addScreenshotListener(() => {
      Toast.show({
        type: "error",
        text1: "캡처 금지",
        text2: "통화 화면은 캡처할 수 없습니다.",
      });
    });
    return () => sub.remove();
  }, []);

  const router = useRouter();
  const {
    sessionId,
    consumerId,
    consumerName,
    consumerAvatar,
    mode,
    perMinRate,
    consumerAvgRating,
    consumerTotalCalls,
    consumerAvgDurationSec,
  } = useLocalSearchParams<{
    sessionId: string;
    consumerId: string;
    consumerName: string;
    consumerAvatar: string;
    mode: string;
    perMinRate: string;
    consumerAvgRating: string;
    consumerTotalCalls: string;
    consumerAvgDurationSec: string;
  }>();

  const [timeLeft, setTimeLeft] = useState(TIMER_TOTAL);
  const [isProcessing, setIsProcessing] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ref로 처리 중 여부를 추적 — 타이머 콜백 stale closure 방어
  const isProcessingRef = useRef(false);

  const [expanded, setExpanded] = useState(false);
  const [detailStats, setDetailStats] = useState<DetailStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const isBlue = mode === "blue";
  const rate = Number(perMinRate ?? 900);
  const avgRating = Number(consumerAvgRating ?? 0);
  const totalCalls = Number(consumerTotalCalls ?? 0);
  const avgDurSec = Number(consumerAvgDurationSec ?? 0);

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
          // state 업데이터 밖에서 비동기로 실행 (React concurrent mode 안전)
          if (!isProcessingRef.current) {
            setTimeout(() => {
              if (!isProcessingRef.current) {
                isProcessingRef.current = true;
                setIsProcessing(true);
                apiCall(`/api/calls/${sessionId}/reject`, { method: "POST" })
                  .catch(() => {})
                  .finally(() => router.back());
              }
            }, 0);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current!); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toggleDetail = async () => {
    if (!expanded && !detailStats && consumerId) {
      setStatsLoading(true);
      try {
        const stats = await apiCall<DetailStats>(`/api/users/${consumerId}/stats`);
        setDetailStats(stats);
      } catch { /* ignore */ } finally {
        setStatsLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  const handleAccept = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
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
          isHost: "true",
          consumerId: consumerId ?? "",
          consumerName: consumerName ?? "",
          consumerAvatar: consumerAvatar ?? "",
        },
      });
    } catch (e) {
      console.error("[accept]", e);
      isProcessingRef.current = false;
      setIsProcessing(false);
      router.back();
    }
  };

  const handleReject = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
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
      <View className="items-center gap-4 w-full">
        {/* 링 타이머 + 프로필 사진 */}
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={STROKE}
              fill="none"
            />
          </Svg>
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

        {/* ─── 인라인 유저 통계 ─── */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 14,
          paddingVertical: 10,
          paddingHorizontal: 20,
          width: "100%",
        }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#F59E0B", fontSize: 13, fontWeight: "700" }}>
              ⭐ {avgRating > 0 ? avgRating.toFixed(1) : "-"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>평점</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.15)" }} />
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
              🕐 {avgDurSec > 0 ? formatDuration(avgDurSec) : "-"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>평균통화</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.15)" }} />
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
              📞 {totalCalls > 0 ? `${totalCalls}회` : "-"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2 }}>총통화</Text>
          </View>
        </View>

        {/* 상세 보기 토글 */}
        {consumerId ? (
          <TouchableOpacity
            onPress={toggleDetail}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              {expanded ? "접기" : "상세 보기"}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={12}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>
        ) : null}

        {/* 상세 통계 펼침 */}
        {expanded && (
          <View style={{
            width: "100%",
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: 14,
          }}>
            {statsLoading ? (
              <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" />
            ) : detailStats ? (
              <>
                {/* 히스토그램 */}
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", marginBottom: 8 }}>
                  통화 시간 분포
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                  {[
                    { label: "15초미만", val: detailStats.histogram.under_15s },
                    { label: "1분미만", val: detailStats.histogram.under_1m },
                    { label: "3분미만", val: detailStats.histogram.under_3m },
                    { label: "3분이상", val: detailStats.histogram.over_3m },
                  ].map((item) => (
                    <View key={item.label} style={{ flex: 1, alignItems: "center" }}>
                      <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>{item.val}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2, textAlign: "center" }}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* 카테고리 평점 */}
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", marginBottom: 8 }}>
                  카테고리 평점
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["호감", "신뢰", "매너", "매력"] as const).map((cat) => {
                    const val = detailStats.category_ratings[cat];
                    return (
                      <View key={cat} style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ color: "#F59E0B", fontSize: 13, fontWeight: "700" }}>
                          {val > 0 ? val.toFixed(1) : "-"}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>{cat}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" }}>
                통계 정보가 없습니다
              </Text>
            )}
          </View>
        )}

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
