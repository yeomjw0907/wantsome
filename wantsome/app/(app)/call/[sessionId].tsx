/**
 * 영상통화 화면
 * - Agora RTC 연결 (react-native-agora)
 * - 원격 영상 풀스크린 + 로컬 영상 PiP
 * - 타이머 + 잔여 포인트 실시간 표시
 * - 하단 컨트롤: 카메라 전환 / 마이크 / 종료 / 신고 / 채팅
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
  StatusBar,
  Modal,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  usePreventScreenCapture,
  addScreenshotListener,
} from "expo-screen-capture";
import Toast from "react-native-toast-message";
// Agora는 사용 시점에 동적 임포트 (라우트 트리 빌드 시 크래시 방지)
let createAgoraRtcEngine: any;
let RtcSurfaceView: any;
let ChannelProfileType: any;
let ClientRoleType: any;
type IRtcEngine = any;
try {
  const agora = require("react-native-agora");
  createAgoraRtcEngine = agora.createAgoraRtcEngine;
  RtcSurfaceView = agora.RtcSurfaceView;
  ChannelProfileType = agora.ChannelProfileType;
  ClientRoleType = agora.ClientRoleType;
} catch (e) {
  // Agora 네이티브 모듈 미로드 시 무시 (개발 환경)
}
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useCallStore } from "@/stores/useCallStore";
import { usePointStore } from "@/stores/usePointStore";
import { useAuthStore } from "@/stores/useAuthStore";
import ReportBottomSheet from "@/components/ReportBottomSheet";

// ─── 선물 아이템 정의 ────────────────────────────────────────────────────────
const GIFT_ITEMS = [
  { name: "하트",     emoji: "💗", points: 100  },
  { name: "별빛",     emoji: "⭐", points: 300  },
  { name: "장미",     emoji: "🌹", points: 500  },
  { name: "다이아",   emoji: "💎", points: 1000 },
  { name: "왕관",     emoji: "👑", points: 3000 },
  { name: "슈퍼스타", emoji: "🌟", points: 5000 },
] as const;

type GiftItemType = (typeof GIFT_ITEMS)[number];

// ─── GiftParticles: 아프리카TV 별풍선 스타일 이팩트 ──────────────────────────
function getGiftConfig(points: number) {
  if (points >= 5000) return { count: 18, size: 42 };
  if (points >= 3000) return { count: 14, size: 36 };
  if (points >= 1000) return { count: 10, size: 32 };
  if (points >= 500)  return { count: 8,  size: 28 };
  if (points >= 300)  return { count: 6,  size: 24 };
  return               { count: 4,  size: 20 };
}

const SPARKLE_EMOJIS = ["✨", "⭐", "🌟"];

function GiftParticles({
  amount,
  fromNickname,
  itemName,
  itemEmoji,
}: {
  amount: number;
  fromNickname: string;
  itemName: string;
  itemEmoji: string;
}) {
  const { count, size } = getGiftConfig(amount);
  const { width: SW, height: SH } = Dimensions.get("window");

  const particles = React.useRef(
    Array.from({ length: count }, (_, i) => ({
      y:       new Animated.Value(0),
      opacity: new Animated.Value(1),
      x:       (0.05 + Math.random() * 0.88) * SW - size / 2,
      // 아이템 이모지 2개 중 1개, 나머지는 스파클
      emoji:   i % 3 === 0 ? itemEmoji : SPARKLE_EMOJIS[i % SPARKLE_EMOJIS.length],
    }))
  ).current;

  const bannerOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(bannerOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    particles.forEach((p, i) => {
      Animated.sequence([
        Animated.delay(i * 55),
        Animated.parallel([
          Animated.timing(p.y, {
            toValue: -(SH * 0.72 + Math.random() * 120),
            duration: 2200 + Math.random() * 600,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 2600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 상단 배너 */}
      <Animated.View
        style={{
          position: "absolute",
          top: 104,
          left: 20,
          right: 20,
          backgroundColor: "rgba(255,107,157,0.92)",
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: "center",
          opacity: bannerOpacity,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 17 }}>
          🎉 {fromNickname}님이 {itemEmoji} {itemName}를 보냈어요!
        </Text>
      </Animated.View>

      {/* 파티클 */}
      {particles.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            bottom: 120,
            left: p.x,
            fontSize: size,
            opacity: p.opacity,
            transform: [{ translateY: p.y }],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

export default function CallScreen() {
  usePreventScreenCapture();

  // iOS: 스크린샷 감지 시 경고
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
    agoraChannel,
    agoraToken,
    agoraAppId,
    perMinRate,
    creatorId,
    creatorName,
    creatorAvatar,
  } = useLocalSearchParams<{
    sessionId: string;
    agoraChannel: string;
    agoraToken: string;
    agoraAppId: string;
    perMinRate: string;
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
  }>();

  const callStore = useCallStore();
  const { points } = usePointStore();
  const authUser = useAuthStore((s) => s.user);
  const userId = authUser?.id;

  /** 현재 사용자가 크리에이터인지 여부 */
  const isCreator = userId === creatorId;
  /** 채팅 발신자 표시 이름 */
  const chatDisplayName = isCreator
    ? (creatorName ?? "크리에이터")
    : ((authUser as any)?.nickname ?? (authUser as any)?.user_metadata?.nickname ?? "나");

  const engineRef = useRef<IRtcEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isEndingRef = useRef(false);
  const lowPointsWarnedRef = useRef(false);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [giftSending, setGiftSending] = useState(false);

  type GiftEffectItem = { id: number; amount: number; fromNickname: string; itemName: string; itemEmoji: string };
  const [giftEffects, setGiftEffects] = useState<GiftEffectItem[]>([]);

  // ─── 채팅 상태 ───
  type ChatMessage = { id: number; text: string; fromNickname: string; isOwn: boolean };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showChatInput, setShowChatInput] = useState(false);

  const rate = Number(perMinRate ?? 900);
  const isLowPoints = points < rate * 5;
  const isCriticalPoints = points < rate;

  const handleGift = async (item: GiftItemType) => {
    if (giftSending) return;
    if (points < item.points) {
      Toast.show({
        type: "error",
        text1: "포인트가 부족해요",
        text2: "통화 종료 후 포인트를 충전해주세요.",
      });
      return;
    }
    setGiftSending(true);
    try {
      const res = await apiCall<{ remaining_points: number }>("/api/gifts", {
        method: "POST",
        body: JSON.stringify({
          call_session_id: sessionId,
          to_creator_id: creatorId,
          amount: item.points,
        }),
      });
      usePointStore.getState().setPoints(res.remaining_points);
      setShowGift(false);
      Toast.show({ type: "success", text1: `${item.emoji} ${item.name} 선물 완료!` });
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "선물 실패" });
    } finally {
      setGiftSending(false);
    }
  };

  // ─── Agora 초기화 ───
  useEffect(() => {
    const init = async () => {
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;

      engine.initialize({
        appId: agoraAppId ?? process.env.EXPO_PUBLIC_AGORA_APP_ID ?? "",
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      engine.enableVideo();
      engine.startPreview();

      engine.addListener("onUserJoined", (_connection, uid) => {
        setRemoteUid(uid);
      });
      engine.addListener("onUserOffline", () => {
        setRemoteUid(null);
        handleEnd();
      });

      await engine.joinChannel(
        agoraToken ?? "",
        agoraChannel ?? "",
        0,
        { clientRoleType: ClientRoleType.ClientRoleBroadcaster }
      );

      callStore.startCall({
        sessionId,
        agoraChannel: agoraChannel ?? "",
        agoraToken: agoraToken ?? "",
        perMinRate: rate,
      });
    };

    init().catch(() => { /* Agora 초기화 실패 처리 */ });

    return () => {
      engineRef.current?.leaveChannel();
      engineRef.current?.release();
      engineRef.current = null;
    };
  }, []);

  // ─── 타이머 ───
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
      callStore.tickDuration();
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── 포인트 Realtime 구독 ───
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-points-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { points?: number };
          if (typeof updated.points === "number") {
            usePointStore.getState().setPoints(updated.points);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ─── call_signals Realtime 구독 ───
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`call-signals-${sessionId}`)
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
            to_user_id?: string;
            payload?: { amount: number; from_nickname: string };
          };
          switch (signal.type) {
            case "low_points":
              if (!lowPointsWarnedRef.current) {
                lowPointsWarnedRef.current = true;
                Toast.show({
                  type: "error",
                  text1: "⚠️ 포인트 부족 경고",
                  text2: "2분 이내에 통화가 종료됩니다. 포인트를 충전하세요.",
                  visibilityTime: 5000,
                });
              }
              break;
            case "call_cancelled":
              if (!isEndingRef.current) {
                handleEnd();
              }
              break;
            case "gift_received": {
              // 크리에이터 화면에만 이팩트 표시
              if (isCreator && signal.payload?.amount) {
                const amt = signal.payload.amount;
                const giftItem = GIFT_ITEMS.find((g) => g.points === amt);
                const effectId = Date.now();
                setGiftEffects((prev) => [
                  ...prev,
                  {
                    id: effectId,
                    amount: amt,
                    fromNickname: signal.payload!.from_nickname ?? "익명",
                    itemName: giftItem?.name ?? `${amt.toLocaleString()}P`,
                    itemEmoji: giftItem?.emoji ?? "💝",
                  },
                ]);
                setTimeout(() => {
                  setGiftEffects((prev) => prev.filter((e) => e.id !== effectId));
                }, 3500);
              }
              break;
            }
            default:
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // ─── 채팅 Broadcast 구독 ───
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`call-chat-${sessionId}`)
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        if (!payload?.from_user_id || payload.from_user_id === userId) return;
        const id = Date.now();
        setChatMessages((prev) => [
          ...prev.slice(-3),
          { id, text: payload.text, fromNickname: payload.from_nickname ?? "상대방", isOwn: false },
        ]);
        setTimeout(() => setChatMessages((prev) => prev.filter((m) => m.id !== id)), 8000);
      })
      .subscribe();
    chatChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      chatChannelRef.current = null;
    };
  }, [sessionId, userId]);

  // ─── 하드웨어 뒤로가기 차단 ───
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => handler.remove();
  }, []);

  // ─── 통화 종료 ───
  const handleEnd = useCallback(async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);

    if (timerRef.current) clearInterval(timerRef.current);
    engineRef.current?.leaveChannel();

    try {
      const result = await apiCall<{
        duration_sec: number;
        points_charged: number;
      }>(`/api/calls/${sessionId}/end`, { method: "POST" });

      callStore.endCall();

      router.replace({
        pathname: "/call/summary",
        params: {
          sessionId,
          durationSec: String(result.duration_sec),
          pointsCharged: String(result.points_charged),
          creatorId: creatorId ?? "",
          creatorName: creatorName ?? "",
          creatorAvatar: creatorAvatar ?? "",
        },
      });
    } catch {
      callStore.endCall();
      router.replace("/(app)/(tabs)");
    }
  }, [sessionId]);

  // ─── 채팅 전송 ───
  const sendChatMessage = useCallback(async () => {
    const text = chatInput.trim().slice(0, 100);
    if (!text) return;
    setChatInput("");

    // 내 화면에 즉시 표시
    const id = Date.now();
    setChatMessages((prev) => [
      ...prev.slice(-3),
      { id, text, fromNickname: "나", isOwn: true },
    ]);
    setTimeout(() => setChatMessages((prev) => prev.filter((m) => m.id !== id)), 8000);

    // 상대방에게 broadcast
    await chatChannelRef.current?.send({
      type: "broadcast",
      event: "chat_message",
      payload: { text, from_nickname: chatDisplayName, from_user_id: userId },
    });
  }, [chatInput, chatDisplayName, userId]);

  const confirmEnd = () => {
    Alert.alert("통화 종료", "통화를 종료하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "종료", style: "destructive", onPress: handleEnd },
    ]);
  };

  const toggleMute = () => {
    engineRef.current?.muteLocalAudioStream(!isMuted);
    setIsMuted((v) => !v);
  };

  const flipCamera = () => {
    engineRef.current?.switchCamera();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* 원격 영상 (풀스크린) */}
      {remoteUid !== null ? (
        <RtcSurfaceView
          canvas={{ uid: remoteUid }}
          style={{ flex: 1 }}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white text-base opacity-60">연결 중...</Text>
        </View>
      )}

      {/* 로컬 영상 PiP (우하단) */}
      <View className="absolute bottom-28 right-4 w-[100px] h-[140px] rounded-xl overflow-hidden border border-white/30">
        <RtcSurfaceView
          canvas={{ uid: 0 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* 상단 HUD */}
      <View className="absolute top-14 left-0 right-0 flex-row justify-between items-center px-5">
        <View className="bg-black/50 rounded-full px-3 py-1">
          <Text className="text-white font-bold text-base tracking-widest">
            {formatTime(elapsed)}
          </Text>
        </View>
        <View className={`rounded-full px-3 py-1 ${isCriticalPoints ? "bg-red-600" : isLowPoints ? "bg-yellow-500" : "bg-black/50"}`}>
          <Text className="text-white font-bold text-sm">
            {points.toLocaleString()}P
          </Text>
        </View>
      </View>

      {/* 포인트 경고 배너 */}
      {isLowPoints && (
        <View className="absolute top-28 left-5 right-5 bg-yellow-500/90 rounded-xl px-4 py-3 flex-row items-center gap-2">
          <Ionicons name="warning-outline" size={18} color="black" />
          <Text className="text-black font-bold text-sm flex-1">
            {isCriticalPoints
              ? "포인트가 거의 소진됐습니다. 곧 통화가 종료됩니다."
              : `잔여 포인트 ${Math.floor(points / rate)}분치 남았습니다.`}
          </Text>
        </View>
      )}

      {/* 신고 버튼 (우상단) */}
      <TouchableOpacity
        className="absolute top-14 right-4 w-10 h-10 items-center justify-center rounded-full bg-black/40"
        onPress={() => setShowReport(true)}
      >
        <Ionicons name="flag-outline" size={18} color="white" />
      </TouchableOpacity>

      {/* ─── 채팅 메시지 오버레이 ─────────────────────────────────────────── */}
      <View
        style={{
          position: "absolute",
          bottom: showChatInput ? 148 : 92,
          left: 12,
          right: 86,
        }}
        pointerEvents="none"
      >
        {chatMessages.map((m) => (
          <View
            key={m.id}
            style={{
              backgroundColor: "rgba(0,0,0,0.58)",
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 5,
              marginBottom: 5,
              alignSelf: "flex-start",
              maxWidth: "100%",
            }}
          >
            <Text style={{ color: m.isOwn ? "#FF6B9D" : "white", fontSize: 13 }}>
              <Text style={{ fontWeight: "700" }}>{m.fromNickname}</Text>: {m.text}
            </Text>
          </View>
        ))}
      </View>

      {/* ─── 채팅 입력창 (토글 시 표시) ──────────────────────────────────── */}
      {showChatInput && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : undefined}
          style={{ position: "absolute", bottom: 86, left: 12, right: 12 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="메시지 입력..."
              placeholderTextColor="rgba(255,255,255,0.38)"
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.72)",
                color: "white",
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 9,
                fontSize: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
              maxLength={100}
              returnKeyType="send"
              onSubmitEditing={sendChatMessage}
              autoFocus
            />
            <TouchableOpacity
              onPress={sendChatMessage}
              style={{
                width: 42,
                height: 42,
                backgroundColor: "#FF6B9D",
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-up" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ─── 하단 컨트롤 바 ──────────────────────────────────────────────── */}
      <View className="absolute bottom-10 left-0 right-0">
        <View className="flex-row justify-center items-center gap-5 bg-black/60 mx-5 rounded-2xl py-4 px-3">
          {/* 카메라 전환 */}
          <TouchableOpacity
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
            onPress={flipCamera}
          >
            <Ionicons name="camera-reverse" size={20} color="white" />
          </TouchableOpacity>

          {/* 마이크 토글 */}
          <TouchableOpacity
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isMuted ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
            onPress={toggleMute}
          >
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={20} color={isMuted ? "#000" : "white"} />
          </TouchableOpacity>

          {/* 통화 종료 */}
          <TouchableOpacity
            style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}
            onPress={confirmEnd}
            disabled={isEnding}
          >
            <Ionicons name="call" size={24} color="white" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>

          {/* 채팅 토글 버튼 (양측 모두) */}
          <TouchableOpacity
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: showChatInput ? "rgba(255,107,157,0.65)" : "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => setShowChatInput((v) => !v)}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="white" />
          </TouchableOpacity>

          {/* 선물 버튼 — 소비자만 */}
          {!isCreator && (
            <TouchableOpacity
              style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,107,157,0.2)", alignItems: "center", justifyContent: "center" }}
              onPress={() => setShowGift(true)}
            >
              <Text style={{ fontSize: 20 }}>💝</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── 선물 모달 — 소비자만 ──────────────────────────────────────────── */}
      {!isCreator && (
        <Modal visible={showGift} transparent animationType="slide" onRequestClose={() => setShowGift(false)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
            activeOpacity={1}
            onPress={() => setShowGift(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: "#1A1A2E", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 }}>
                <Text style={{ color: "white", fontSize: 16, fontWeight: "700", marginBottom: 4 }}>💝 선물 보내기</Text>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 20 }}>
                  {creatorName}님에게 선물을 보내보세요
                </Text>

                {/* 아이템 그리드 */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {GIFT_ITEMS.map((item) => {
                    const canAfford = points >= item.points;
                    return (
                      <TouchableOpacity
                        key={item.name}
                        onPress={() => handleGift(item)}
                        disabled={giftSending}
                        style={{
                          width: "30%",
                          alignItems: "center",
                          paddingVertical: 12,
                          borderRadius: 16,
                          backgroundColor: canAfford ? "rgba(255,107,157,0.18)" : "rgba(255,255,255,0.05)",
                          borderWidth: 1,
                          borderColor: canAfford ? "rgba(255,107,157,0.5)" : "rgba(255,255,255,0.1)",
                          opacity: canAfford ? 1 : 0.45,
                        }}
                      >
                        <Text style={{ fontSize: 28, marginBottom: 4 }}>{item.emoji}</Text>
                        <Text style={{ color: canAfford ? "white" : "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: 13 }}>
                          {item.name}
                        </Text>
                        <Text style={{ color: canAfford ? "#FF6B9D" : "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>
                          {item.points.toLocaleString()}P
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 보유 포인트 + 잔액 부족 안내 */}
                <View style={{ marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                    보유: {points.toLocaleString()}P
                  </Text>
                  {points < GIFT_ITEMS[0].points && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowGift(false);
                        Toast.show({ type: "info", text1: "통화 종료 후 포인트를 충전하세요." });
                      }}
                    >
                      <Text style={{ color: "#FF6B9D", fontSize: 12, fontWeight: "600" }}>
                        💰 잔액 부족 — 충전하러 가기
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 신고 바텀시트 */}
      <ReportBottomSheet
        visible={showReport}
        targetId={creatorId ?? ""}
        callSessionId={sessionId}
        onClose={() => setShowReport(false)}
      />

      {/* 선물 이팩트 오버레이 (크리에이터 수신 시) */}
      {giftEffects.map((effect) => (
        <GiftParticles
          key={effect.id}
          amount={effect.amount}
          fromNickname={effect.fromNickname}
          itemName={effect.itemName}
          itemEmoji={effect.itemEmoji}
        />
      ))}
    </View>
  );
}
