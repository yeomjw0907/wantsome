/**
 * 영상통화 화면
 * - Agora RTC 연결 (react-native-agora)
 * - 원격 영상 풀스크린 + 로컬 영상 PiP
 * - 타이머 + 잔여 포인트 실시간 표시
 * - 하단 컨트롤: 카메라 전환 / 마이크 / 종료 / 신고
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  usePreventScreenCapture,
  addScreenshotListener,
} from "expo-screen-capture";
import Toast from "react-native-toast-message";
import {
  createAgoraRtcEngine,
  IRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
} from "react-native-agora";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useCallStore } from "@/stores/useCallStore";
import { usePointStore } from "@/stores/usePointStore";
import { useAuthStore } from "@/stores/useAuthStore";
import ReportBottomSheet from "@/components/ReportBottomSheet";

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
  const userId = useAuthStore((s) => s.user?.id);

  const engineRef = useRef<IRtcEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isEndingRef = useRef(false);

  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const rate = Number(perMinRate ?? 900);
  const isLowPoints = points < rate * 5;
  const isCriticalPoints = points < rate;

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
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
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
        {/* 타이머 */}
        <View className="bg-black/50 rounded-full px-3 py-1">
          <Text className="text-white font-bold text-base tracking-widest">
            {formatTime(elapsed)}
          </Text>
        </View>

        {/* 잔여 포인트 */}
        <View className={`rounded-full px-3 py-1 ${isCriticalPoints ? "bg-red-600" : isLowPoints ? "bg-yellow-500" : "bg-black/50"}`}>
          <Text className="text-white font-bold text-sm">
            {points.toLocaleString()}P
          </Text>
        </View>
      </View>

      {/* 포인트 경고 배너 */}
      {isLowPoints && (
        <View className="absolute top-28 left-5 right-5 bg-yellow-500/90 rounded-xl px-4 py-3">
          <Text className="text-black font-bold text-sm text-center">
            {isCriticalPoints
              ? "⚠️ 포인트가 거의 소진됐습니다. 곧 통화가 종료됩니다."
              : `⚠️ 잔여 포인트 ${Math.floor(points / rate)}분치 남았습니다.`}
          </Text>
        </View>
      )}

      {/* 신고 버튼 (우상단) */}
      <TouchableOpacity
        className="absolute top-14 right-4 w-10 h-10 items-center justify-center rounded-full bg-black/40"
        onPress={() => setShowReport(true)}
      >
        <Text className="text-lg">🚩</Text>
      </TouchableOpacity>

      {/* 하단 컨트롤 바 */}
      <View className="absolute bottom-10 left-0 right-0">
        <View className="flex-row justify-center items-center gap-8 bg-black/60 mx-6 rounded-2xl py-4 px-6">
          {/* 카메라 전환 */}
          <TouchableOpacity
            className="w-14 h-14 rounded-full bg-white/20 items-center justify-center"
            onPress={flipCamera}
          >
            <Ionicons name="camera-reverse" size={26} color="white" />
          </TouchableOpacity>

          {/* 마이크 토글 */}
          <TouchableOpacity
            className={`w-14 h-14 rounded-full items-center justify-center ${isMuted ? "bg-white/80" : "bg-white/20"}`}
            onPress={toggleMute}
          >
            <Ionicons
              name={isMuted ? "mic-off" : "mic"}
              size={26}
              color={isMuted ? "#000" : "white"}
            />
          </TouchableOpacity>

          {/* 통화 종료 (빨간 원형) */}
          <TouchableOpacity
            className="w-16 h-16 rounded-full bg-red-500 items-center justify-center"
            onPress={confirmEnd}
            disabled={isEnding}
          >
            <Ionicons name="call" size={28} color="white" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 신고 바텀시트 */}
      <ReportBottomSheet
        visible={showReport}
        targetId={creatorId ?? ""}
        callSessionId={sessionId}
        onClose={() => setShowReport(false)}
      />
    </View>
  );
}
