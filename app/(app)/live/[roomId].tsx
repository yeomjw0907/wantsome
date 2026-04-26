import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import type {
  LiveChatMessage,
  LiveChatResponse,
  LiveJoinResponse,
  LiveParticipantsResponse,
  LiveRoomDetailResponse,
  LiveStartRoomResponse,
} from "@/types/live";

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
} catch {
  // Ignore on environments without native Agora bindings.
}

type SessionState = {
  role: "host" | "viewer" | "admin";
  agoraChannel: string;
  agoraToken: string;
  agoraAppId: string;
};

// 선물 단가 — constants/gifts.ts (단일 source of truth)
import { GIFT_AMOUNTS as GIFT_OPTIONS } from "@/constants/gifts";

function formatRemaining(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) {
    return "종료 예정";
  }
  const totalSec = Math.floor(diff / 1000);
  const hour = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hour > 0) {
    return `${hour}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function LiveRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    roomId: string;
    role?: "host" | "viewer" | "admin";
    agoraChannel?: string;
    agoraToken?: string;
    agoraAppId?: string;
  }>();
  const user = useAuthStore((state) => state.user);

  const roomId = params.roomId;
  const engineRef = useRef<IRtcEngine | null>(null);
  const hasJoinedAgoraRef = useRef(false);
  const ackSentRef = useRef(false);
  const extensionPromptRef = useRef<string | null>(null);

  const [detail, setDetail] = useState<LiveRoomDetailResponse | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [participants, setParticipants] = useState<LiveParticipantsResponse["participants"]>([]);
  const [sessionState, setSessionState] = useState<SessionState | null>(
    params.role && params.agoraChannel && params.agoraToken && params.agoraAppId
      ? {
          role: params.role,
          agoraChannel: params.agoraChannel,
          agoraToken: params.agoraToken,
          agoraAppId: params.agoraAppId,
        }
      : null,
  );
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  const isHost = sessionState?.role === "host" || detail?.host.id === user?.id;
  const isModerator = isHost || sessionState?.role === "admin";
  const canChat = Boolean(sessionState) && !detail?.is_muted && !(detail?.chat_locked && sessionState?.role === "viewer");

  const fetchDetail = useCallback(async () => {
    if (!roomId) {
      return;
    }

    const data = await apiCall<LiveRoomDetailResponse>(`/api/live/rooms/${roomId}`);
    setDetail(data);
    return data;
  }, [roomId]);

  const fetchChat = useCallback(async () => {
    if (!sessionState) {
      return;
    }
    const data = await apiCall<LiveChatResponse>(`/api/live/rooms/${roomId}/chat`);
    setMessages(data.messages ?? []);
  }, [roomId, sessionState]);

  const fetchParticipants = useCallback(async () => {
    if (!isModerator) {
      return;
    }
    const data = await apiCall<LiveParticipantsResponse>(`/api/live/rooms/${roomId}/participants`);
    setParticipants(data.participants ?? []);
  }, [isModerator, roomId]);

  const cleanupAgora = useCallback(async () => {
    hasJoinedAgoraRef.current = false;
    ackSentRef.current = false;
    setRemoteUid(null);
    try {
      await engineRef.current?.leaveChannel();
    } catch {}
    try {
      engineRef.current?.release();
    } catch {}
    engineRef.current = null;
  }, []);

  const connectAgora = useCallback(
    async (state: SessionState) => {
      if (!createAgoraRtcEngine || !ChannelProfileType || !ClientRoleType) {
        throw new Error("Agora 네이티브 모듈을 사용할 수 없습니다.");
      }
      if (hasJoinedAgoraRef.current) {
        return;
      }

      await cleanupAgora();
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      hasJoinedAgoraRef.current = true;

      engine.initialize({
        appId: state.agoraAppId || process.env.EXPO_PUBLIC_AGORA_APP_ID || "",
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      engine.enableVideo();

      if (state.role === "host") {
        engine.startPreview();
      }

      engine.addListener("onUserJoined", (_connection: unknown, uid: number) => {
        setRemoteUid(uid);
      });
      engine.addListener("onUserOffline", () => {
        setRemoteUid(null);
      });
      engine.addListener("onJoinChannelSuccess", async () => {
        if (state.role !== "host" && !ackSentRef.current) {
          ackSentRef.current = true;
          await apiCall(`/api/live/rooms/${roomId}/join-ack`, { method: "POST" }).catch(() => null);
        }
      });

      await engine.joinChannel(state.agoraToken, state.agoraChannel, 0, {
        clientRoleType:
          state.role === "host"
            ? ClientRoleType.ClientRoleBroadcaster
            : ClientRoleType.ClientRoleAudience,
      });
    },
    [cleanupAgora, roomId],
  );

  const ensureSession = useCallback(
    async (roomDetail: LiveRoomDetailResponse) => {
      if (sessionState || !user) {
        return;
      }

      if (roomDetail.host.id === user.id && ["ready", "live"].includes(roomDetail.status)) {
        const hostRes = await apiCall<LiveStartRoomResponse>(`/api/live/rooms/${roomId}/start`, {
          method: "POST",
        });
        const nextState: SessionState = {
          role: "host",
          agoraChannel: hostRes.agora_channel,
          agoraToken: hostRes.agora_token,
          agoraAppId: hostRes.agora_app_id,
        };
        setSessionState(nextState);
        return;
      }

      if (roomDetail.is_joined && roomDetail.role && roomDetail.role !== "host" && roomDetail.status === "live") {
        const joinRes = await apiCall<LiveJoinResponse>(`/api/live/rooms/${roomId}/join`, {
          method: "POST",
        });
        const nextState: SessionState = {
          role: joinRes.role,
          agoraChannel: joinRes.agora_channel,
          agoraToken: joinRes.agora_token,
          agoraAppId: joinRes.agora_app_id,
        };
        setSessionState(nextState);
      }
    },
    [roomId, sessionState, user],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const roomDetail = await fetchDetail();
        if (mounted && roomDetail) {
          await ensureSession(roomDetail);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "라이브 정보를 불러오지 못했습니다.";
        Toast.show({ type: "error", text1: "라이브", text2: errorMessage });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      cleanupAgora();
    };
  }, [cleanupAgora, ensureSession, fetchDetail]);

  useEffect(() => {
    if (!sessionState) {
      return;
    }

    connectAgora(sessionState).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : "영상 연결에 실패했습니다.";
      Toast.show({ type: "error", text1: "라이브", text2: errorMessage });
    });
  }, [connectAgora, sessionState]);

  useEffect(() => {
    if (!sessionState) {
      return;
    }
    fetchChat();
    fetchParticipants();

    const chatTimer = setInterval(fetchChat, 4000);
    const participantTimer = setInterval(fetchParticipants, 8000);
    const detailTimer = setInterval(() => {
      fetchDetail().catch(() => null);
    }, 10000);

    return () => {
      clearInterval(chatTimer);
      clearInterval(participantTimer);
      clearInterval(detailTimer);
    };
  }, [fetchChat, fetchDetail, fetchParticipants, sessionState]);

  useEffect(() => {
    if (!detail || !isHost || detail.status !== "live") {
      return;
    }

    const key = `${detail.id}:${detail.scheduled_end_at}`;
    const timer = setInterval(() => {
      const remaining = new Date(detail.scheduled_end_at).getTime() - Date.now();
      if (remaining <= 300000 && remaining > 0 && extensionPromptRef.current !== key) {
        extensionPromptRef.current = key;
        Alert.alert("라이브 연장", "종료 5분 전입니다. 연장하시겠습니까?", [
          {
            text: "30분",
            onPress: () => {
              apiCall(`/api/live/rooms/${roomId}/extend`, {
                method: "POST",
                body: JSON.stringify({ added_duration_min: 30 }),
              })
                .then(() => {
                  Toast.show({ type: "success", text1: "라이브", text2: "30분 연장되었습니다." });
                  fetchDetail().catch(() => null);
                })
                .catch((error) => {
                  Toast.show({
                    type: "error",
                    text1: "라이브",
                    text2: error instanceof Error ? error.message : "연장에 실패했습니다.",
                  });
                });
            },
          },
          {
            text: "1시간",
            onPress: () => {
              apiCall(`/api/live/rooms/${roomId}/extend`, {
                method: "POST",
                body: JSON.stringify({ added_duration_min: 60 }),
              })
                .then(() => {
                  Toast.show({ type: "success", text1: "라이브", text2: "1시간 연장되었습니다." });
                  fetchDetail().catch(() => null);
                })
                .catch((error) => {
                  Toast.show({
                    type: "error",
                    text1: "라이브",
                    text2: error instanceof Error ? error.message : "연장에 실패했습니다.",
                  });
                });
            },
          },
          { text: "유지", style: "cancel" },
        ]);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [detail, fetchDetail, isHost, roomId]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const response = await apiCall<LiveJoinResponse>(`/api/live/rooms/${roomId}/join`, {
        method: "POST",
      });
      setSessionState({
        role: response.role,
        agoraChannel: response.agora_channel,
        agoraToken: response.agora_token,
        agoraAppId: response.agora_app_id,
      });
      await fetchDetail();
      Toast.show({
        type: "success",
        text1: "라이브 입장",
        text2:
          response.charged_points > 0
            ? `${response.charged_points.toLocaleString()}P 차감 후 입장했습니다.`
            : "입장했습니다.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "라이브",
        text2: error instanceof Error ? error.message : "입장에 실패했습니다.",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      if (isHost) {
        await apiCall(`/api/live/rooms/${roomId}/end`, { method: "POST" });
      } else if (sessionState) {
        await apiCall(`/api/live/rooms/${roomId}/leave`, { method: "POST" });
      }
    } catch {
      // noop
    } finally {
      await cleanupAgora();
      router.back();
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !canChat) {
      return;
    }
    setSending(true);
    try {
      await apiCall(`/api/live/rooms/${roomId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: message.trim() }),
      });
      setMessage("");
      await fetchChat();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "채팅",
        text2: error instanceof Error ? error.message : "메시지 전송에 실패했습니다.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleGift = async (amount: number) => {
    try {
      await apiCall("/api/gifts", {
        method: "POST",
        body: JSON.stringify({ live_room_id: roomId, amount }),
      });
      setGiftOpen(false);
      Toast.show({ type: "success", text1: "선물", text2: `${amount.toLocaleString()}P 선물을 보냈습니다.` });
      fetchChat().catch(() => null);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "선물",
        text2: error instanceof Error ? error.message : "선물 전송에 실패했습니다.",
      });
    }
  };

  const handleModeration = async (
    action: "kick" | "mute" | "unmute" | "lock" | "unlock",
    targetUserId?: string,
  ) => {
    try {
      if (action === "lock" || action === "unlock") {
        await apiCall(`/api/live/rooms/${roomId}/${action === "lock" ? "chat-lock" : "chat-unlock"}`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } else {
        await apiCall(`/api/live/rooms/${roomId}/${action}`, {
          method: "POST",
          body: JSON.stringify({ target_user_id: targetUserId }),
        });
      }
      await Promise.all([fetchParticipants(), fetchDetail()]);
      Toast.show({ type: "success", text1: "운영", text2: "조치를 반영했습니다." });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "운영",
        text2: error instanceof Error ? error.message : "조치에 실패했습니다.",
      });
    }
  };

  const chatStatusText = useMemo(() => {
    if (!detail) {
      return "";
    }
    if (detail.is_muted) {
      return "채팅이 제한된 상태입니다.";
    }
    if (detail.chat_locked && sessionState?.role === "viewer") {
      return "운영자가 전체 채팅을 잠갔습니다.";
    }
    return "";
  }, [detail, sessionState?.role]);

  if (loading || !detail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {detail.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {detail.host.name} · {formatRemaining(detail.scheduled_end_at)}
          </Text>
        </View>
        {isModerator && (
          <TouchableOpacity onPress={() => setModerationOpen(true)} style={styles.headerIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.videoContainer}>
        {sessionState ? (
          isHost ? (
            RtcSurfaceView ? (
              <RtcSurfaceView canvas={{ uid: 0 }} style={{ flex: 1 }} />
            ) : (
              <View style={styles.videoFallback}>
                <Text style={styles.videoFallbackTitle}>호스트 송출 미리보기</Text>
                <Text style={styles.videoFallbackSub}>Agora 네이티브 모듈이 없는 환경입니다.</Text>
              </View>
            )
          ) : remoteUid !== null && RtcSurfaceView ? (
            <RtcSurfaceView canvas={{ uid: remoteUid }} style={{ flex: 1 }} />
          ) : (
            <View style={styles.videoFallback}>
              <Text style={styles.videoFallbackTitle}>호스트 화면 대기 중</Text>
              <Text style={styles.videoFallbackSub}>방송 연결이 완료되면 영상이 표시됩니다.</Text>
            </View>
          )
        ) : (
          <View style={styles.previewOnly}>
            <Text style={styles.previewLabel}>미입장 미리보기</Text>
            <Text style={styles.previewTitle}>{detail.title}</Text>
            <Text style={styles.previewSub}>입장 전에는 썸네일과 정보만 확인할 수 있습니다.</Text>
          </View>
        )}
      </View>

      <View style={styles.metaBar}>
        <Text style={styles.metaText}>
          입장료 {detail.entry_fee_points.toLocaleString()}P · {detail.viewer_count}/{detail.viewer_limit}명
        </Text>
        {detail.extension_count > 0 && <Text style={styles.metaAccent}>연장 {detail.extension_count}회</Text>}
      </View>

      {!sessionState ? (
        <View style={styles.joinPanel}>
          <Text style={styles.joinTitle}>{detail.host.name}님의 라이브</Text>
          <Text style={styles.joinDescription}>
            {detail.is_kicked
              ? "강퇴된 방은 종료 전까지 다시 입장할 수 없습니다."
              : `입장료 ${detail.entry_fee_points.toLocaleString()}P를 결제하면 채팅과 선물이 가능합니다.`}
          </Text>
          <TouchableOpacity
            disabled={!detail.can_join || joining}
            onPress={handleJoin}
            style={[styles.joinButton, (!detail.can_join || joining) && styles.joinButtonDisabled]}
          >
            <Text style={styles.joinButtonText}>
              {joining ? "입장 중..." : detail.is_kicked ? "입장 불가" : "입장하기"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 140, gap: 12 }}
          >
            {chatStatusText ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{chatStatusText}</Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>실시간 채팅</Text>
                <Text style={styles.sectionMeta}>{messages.length}개</Text>
              </View>
              <View style={{ gap: 10 }}>
                {messages.length === 0 ? (
                  <Text style={styles.emptyText}>아직 채팅이 없습니다.</Text>
                ) : (
                  messages.slice(-30).map((chat) => (
                    <View key={chat.id} style={styles.chatBubble}>
                      <Text style={styles.chatSender}>
                        {chat.sender_name} <Text style={styles.chatRole}>({chat.sender_role})</Text>
                      </Text>
                      <Text style={styles.chatMessage}>{chat.message}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {isModerator && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>참여자 관리</Text>
                  <TouchableOpacity
                    onPress={() => handleModeration(detail.chat_locked ? "unlock" : "lock")}
                    style={styles.inlineAction}
                  >
                    <Text style={styles.inlineActionText}>{detail.chat_locked ? "채팅 열기" : "채팅 잠금"}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 10 }}>
                  {participants.length === 0 ? (
                    <Text style={styles.emptyText}>참여자가 없습니다.</Text>
                  ) : (
                    participants.map((participant) => (
                      <View key={participant.user_id} style={styles.participantRow}>
                        <View>
                          <Text style={styles.participantName}>{participant.name}</Text>
                          <Text style={styles.participantMeta}>
                            {participant.role} · {participant.status}
                          </Text>
                        </View>
                        {participant.role === "viewer" && participant.status === "joined" ? (
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => handleModeration(participant.is_muted ? "unmute" : "mute", participant.user_id)}
                              style={styles.participantAction}
                            >
                              <Text style={styles.participantActionText}>
                                {participant.is_muted ? "mute 해제" : "mute"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleModeration("kick", participant.user_id)}
                              style={[styles.participantAction, styles.participantDanger]}
                            >
                              <Text style={[styles.participantActionText, { color: "#FF4566" }]}>강퇴</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={() => setGiftOpen(true)} style={styles.bottomIconButton}>
              <Ionicons name="gift-outline" size={20} color="#111827" />
            </TouchableOpacity>

            <View style={styles.chatInputWrapper}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={canChat ? "채팅을 입력하세요" : chatStatusText || "채팅 불가"}
                editable={canChat}
                style={styles.chatInput}
              />
            </View>

            <TouchableOpacity
              disabled={!canChat || sending || !message.trim()}
              onPress={handleSendMessage}
              style={[styles.sendButton, (!canChat || sending || !message.trim()) && styles.sendButtonDisabled]}
            >
              <Text style={styles.sendButtonText}>전송</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLeave} style={[styles.bottomIconButton, { marginLeft: 4 }]}>
              <Ionicons name={isHost ? "stop-circle-outline" : "log-out-outline"} size={20} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={giftOpen} transparent animationType="fade" onRequestClose={() => setGiftOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setGiftOpen(false)}>
          <View style={styles.giftModal}>
            <Text style={styles.giftTitle}>선물 보내기</Text>
            <View style={styles.giftGrid}>
              {GIFT_OPTIONS.map((gift) => (
                <TouchableOpacity key={gift} onPress={() => handleGift(gift)} style={styles.giftItem}>
                  <Text style={styles.giftAmount}>{gift.toLocaleString()}P</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={moderationOpen} transparent animationType="slide" onRequestClose={() => setModerationOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.moderationSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>운영 패널</Text>
              <TouchableOpacity onPress={() => setModerationOpen(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
              <TouchableOpacity
                onPress={() => handleModeration(detail.chat_locked ? "unlock" : "lock")}
                style={styles.sheetAction}
              >
                <Text style={styles.sheetActionText}>{detail.chat_locked ? "전체 채팅 열기" : "전체 채팅 잠금"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLeave} style={[styles.sheetAction, styles.sheetActionDanger]}>
                <Text style={[styles.sheetActionText, { color: "#FF4566" }]}>
                  {isHost ? "라이브 종료" : "관리 종료"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1020" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1020" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSubtitle: { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 4 },
  videoContainer: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#12192B",
    height: 280,
  },
  videoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  videoFallbackTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  videoFallbackSub: { color: "rgba(255,255,255,0.72)", fontSize: 13 },
  previewOnly: {
    flex: 1,
    padding: 28,
    justifyContent: "flex-end",
    backgroundColor: "#151C30",
  },
  previewLabel: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FF4566",
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 12,
  },
  previewTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  previewSub: { color: "rgba(255,255,255,0.72)", fontSize: 13, marginTop: 8 },
  metaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  metaText: { color: "rgba(255,255,255,0.82)", fontSize: 13 },
  metaAccent: { color: "#FF6B9D", fontSize: 13, fontWeight: "700" },
  joinPanel: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  joinTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  joinDescription: { fontSize: 14, color: "#6B7280", lineHeight: 21 },
  joinButton: {
    marginTop: 4,
    backgroundColor: "#FF6B9D",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  joinButtonDisabled: { backgroundColor: "#E5E7EB" },
  joinButtonText: { color: "#fff", fontWeight: "700" },
  noticeBox: {
    backgroundColor: "rgba(255,107,157,0.12)",
    borderRadius: 16,
    padding: 14,
  },
  noticeText: { color: "#FFE7F1", fontSize: 13, fontWeight: "600" },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: "#111827", fontSize: 16, fontWeight: "700" },
  sectionMeta: { color: "#6B7280", fontSize: 12 },
  emptyText: { color: "#9CA3AF", fontSize: 13 },
  chatBubble: {
    backgroundColor: "#F8F8FA",
    borderRadius: 14,
    padding: 12,
  },
  chatSender: { fontSize: 12, fontWeight: "700", color: "#111827" },
  chatRole: { color: "#9CA3AF", fontWeight: "500" },
  chatMessage: { fontSize: 14, color: "#374151", marginTop: 4, lineHeight: 20 },
  inlineAction: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  participantName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  participantMeta: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  participantAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  participantDanger: { borderColor: "#FFD5DD", backgroundColor: "#FFF4F7" },
  participantActionText: { fontSize: 12, color: "#374151", fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 22,
    gap: 8,
  },
  bottomIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  chatInputWrapper: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
  },
  chatInput: { height: 44, fontSize: 14, color: "#111827" },
  sendButton: {
    backgroundColor: "#FF6B9D",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendButtonDisabled: { backgroundColor: "#E5E7EB" },
  sendButtonText: { color: "#fff", fontWeight: "700" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  giftModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 16,
  },
  giftTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  giftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  giftItem: {
    width: "31%",
    backgroundColor: "#F8F8FA",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  giftAmount: { fontSize: 14, color: "#111827", fontWeight: "700" },
  moderationSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 16,
    maxHeight: "75%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  sheetAction: {
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    alignItems: "center",
  },
  sheetActionDanger: { backgroundColor: "#FFF4F7" },
  sheetActionText: { fontSize: 14, fontWeight: "700", color: "#111827" },
});
