/**
 * 영상통화 화면 — Agora RTC
 * URL params: channel, token, myUid(1=소비자/2=크리에이터),
 *             perMinRate, mode, creatorId, creatorName, creatorAvatar
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from "react-native-agora";
import type { IRtcEngine } from "react-native-agora";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useCallStore } from "@/stores/useCallStore";
import { usePointStore } from "@/stores/usePointStore";

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? "";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    sessionId, channel, token, myUid,
    perMinRate, mode, creatorId, creatorName, creatorAvatar,
  } = useLocalSearchParams<{
    sessionId: string; channel: string; token: string; myUid: string;
    perMinRate: string; mode: string; creatorId: string;
    creatorName: string; creatorAvatar: string;
  }>();

  const { tickDuration, endCall, durationSec } = useCallStore();
  const { points } = usePointStore();
  const engineRef = useRef<IRtcEngine | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uid = Number(myUid) || 1;
  const rate = Number(perMinRate) || 900;
  const lowPoints = points < rate * 5;

  // Agora 초기화 + 채널 입장
  useEffect(() => {
    if (!channel || !token) return;
    const engine = createAgoraRtcEngine();
    engineRef.current = engine;
    engine.initialize({
      appId: AGORA_APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
    });
    engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
    engine.enableVideo();
    engine.startPreview();
    engine.addListener("onUserJoined", (_c: unknown, remUid: number) => setRemoteUid(remUid));
    engine.addListener("onUserOffline", (_c: unknown, remUid: number) =>
      setRemoteUid((p) => (p === remUid ? null : p)),
    );
    engine.addListener("onError", (err: number, msg: string) =>
      console.error("Agora error:", err, msg),
    );
    engine.joinChannel(token, channel, uid, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    });
    timerRef.current = setInterval(() => tickDuration(), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      engine.leaveChannel();
      engine.release();
      engineRef.current = null;
    };
  }, [channel, token]);

  const handleEnd = useCallback(async () => {
    if (isEnding || !sessionId) return;
    setIsEnding(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await apiCall<{
        duration_sec: number; points_charged: number; creator_earning: number;
      }>(`/api/calls/${sessionId}/end`, { method: "POST" });
      endCall(res.points_charged);
      router.replace({
        pathname: "/call/summary",
        params: {
          sessionId: sessionId!,
          durationSec: String(res.duration_sec),
          pointsCharged: String(res.points_charged),
          creatorId: creatorId ?? "",
          creatorName: creatorName ?? "",
          creatorAvatar: creatorAvatar ?? "",
          perMinRate: String(rate),
        },
      });
    } catch (e: unknown) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "오류가 발생했습니다." });
      setIsEnding(false);
    }
  }, [isEnding, sessionId]);

  return (
    <View style={s.container}>
      {/* 원격 영상 (풀스크린) */}
      {remoteUid !== null ? (
        <RtcSurfaceView canvas={{ uid: remoteUid }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.waitingBg]}>
          <Text style={s.waitingText}>상대방 연결 중...</Text>
        </View>
      )}

      {/* 로컬 영상 (PiP 우하단) */}
      <View style={[s.localVideo, { bottom: insets.bottom + 110 }]}>
        <RtcSurfaceView canvas={{ uid: 0 }} style={s.localVideoInner} />
      </View>

      {/* 상단 HUD */}
      <View style={[s.hud, { top: insets.top + 12 }]}>
        <Text style={s.timer}>{formatTime(durationSec)}</Text>
        <Text style={s.pointsLabel}>{points.toLocaleString()}P</Text>
      </View>

      {/* 포인트 경고 배너 */}
      {lowPoints && (
        <View style={s.warningBanner}>
          <Text style={s.warningText}>⚠️ 포인트가 얼마 남지 않았습니다.</Text>
        </View>
      )}

      {/* 신고 버튼 */}
      <TouchableOpacity
        style={[s.reportBtn, { top: insets.top + 12, right: 16 }]}
        activeOpacity={0.8}
      >
        <Text style={s.reportIcon}>🚩</Text>
      </TouchableOpacity>

      {/* 하단 컨트롤 바 */}
      <View style={[s.controls, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={s.ctrlBtn}
          onPress={() => engineRef.current?.switchCamera()}
          activeOpacity={0.8}
        >
          <Text style={s.ctrlIcon}>🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.ctrlBtn}
          onPress={() => {
            engineRef.current?.muteLocalAudioStream(!isMuted);
            setIsMuted((v) => !v);
          }}
          activeOpacity={0.8}
        >
          <Text style={s.ctrlIcon}>{isMuted ? "🔇" : "🎤"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.ctrlBtn, s.endBtn]}
          onPress={handleEnd}
          disabled={isEnding}
          activeOpacity={0.8}
        >
          <Text style={s.ctrlIcon}>📵</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  waitingBg: { alignItems: "center", justifyContent: "center", backgroundColor: "#1A1A1A" },
  waitingText: { color: "#FFFFFF", fontSize: 16, opacity: 0.7 },
  localVideo: {
    position: "absolute", right: 16, width: 120, height: 160,
    borderRadius: 12, overflow: "hidden", borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  localVideoInner: { width: "100%", height: "100%" },
  hud: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16,
  },
  timer: {
    color: "#FFFFFF", fontSize: 18, fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: 12,
  },
  pointsLabel: {
    color: "#FFD700", fontSize: 14, fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12,
  },
  warningBanner: {
    position: "absolute", top: 80, left: 16, right: 16,
    backgroundColor: "#F59E0B", borderRadius: 8, padding: 10, alignItems: "center",
  },
  warningText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  controls: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 24, paddingTop: 16, backgroundColor: "rgba(0,0,0,0.5)",
  },
  ctrlBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  endBtn: { backgroundColor: "#EF4444" },
  ctrlIcon: { fontSize: 24 },
  reportBtn: {
    position: "absolute", width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  reportIcon: { fontSize: 18 },
});
