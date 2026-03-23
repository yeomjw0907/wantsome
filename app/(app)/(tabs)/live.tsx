import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall, BASE_URL } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";
import type {
  LiveCreateRoomResponse,
  LiveEligibilityResponse,
  LiveRoomsResponse,
  LiveRoomListItem,
  LiveStartRoomResponse,
} from "@/types/live";

const DURATION_OPTIONS = [
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
] as const;

async function uploadThumbnail(uri: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("로그인이 필요합니다.");
  }

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: `live-thumbnail-${Date.now()}.jpg`,
    type: "image/jpeg",
  } as any);

  const response = await fetch(`${BASE_URL}/api/live/upload-thumbnail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "썸네일 업로드에 실패했습니다.");
  }

  const data = await response.json();
  return data.url as string;
}

function formatCountdown(iso: string) {
  const remainMs = new Date(iso).getTime() - Date.now();
  if (remainMs <= 0) {
    return "곧 종료";
  }
  const totalMin = Math.floor(remainMs / 60000);
  const hour = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return hour > 0 ? `${hour}시간 ${min}분 남음` : `${min}분 남음`;
}

export default function LiveTabScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [rooms, setRooms] = useState<LiveRoomListItem[]>([]);
  const [eligibility, setEligibility] = useState<LiveEligibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<30 | 60>(30);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [eligibilityRes, roomsRes] = await Promise.all([
        apiCall<LiveEligibilityResponse>("/api/live/eligibility"),
        apiCall<LiveRoomsResponse>("/api/live/rooms"),
      ]);
      setEligibility(eligibilityRes);
      setRooms(roomsRes.rooms ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "라이브 정보를 불러오지 못했습니다.";
      Toast.show({ type: "error", text1: "라이브", text2: message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const pickThumbnail = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("권한 필요", "썸네일 업로드를 위해 사진 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });

    if (!result.canceled) {
      setThumbnailUri(result.assets[0]?.uri ?? null);
    }
  };

  const handleCreateAndStart = async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2 || trimmedTitle.length > 50) {
      Alert.alert("제목 확인", "방송 제목은 2자 이상 50자 이하로 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      let thumbnailUrl: string | undefined;
      if (thumbnailUri) {
        thumbnailUrl = await uploadThumbnail(thumbnailUri);
      }

      const createRes = await apiCall<LiveCreateRoomResponse>("/api/live/rooms", {
        method: "POST",
        body: JSON.stringify({
          title: trimmedTitle,
          planned_duration_min: duration,
          thumbnail_url: thumbnailUrl,
        }),
      });

      const startRes = await apiCall<LiveStartRoomResponse>(`/api/live/rooms/${createRes.room_id}/start`, {
        method: "POST",
      });

      setModalVisible(false);
      setTitle("");
      setDuration(30);
      setThumbnailUri(null);
      await loadData();

      router.push({
        pathname: "/live/[roomId]",
        params: {
          roomId: startRes.room_id,
          role: "host",
          agoraChannel: startRes.agora_channel,
          agoraToken: startRes.agora_token,
          agoraAppId: startRes.agora_app_id,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "라이브 시작에 실패했습니다.";
      Toast.show({ type: "error", text1: "라이브", text2: message });
    } finally {
      setSubmitting(false);
    }
  };

  const renderRoom = ({ item }: { item: LiveRoomListItem }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        router.push({
          pathname: "/live/[roomId]",
          params: { roomId: item.id },
        })
      }
      style={{
        backgroundColor: "#fff",
        marginHorizontal: 16,
        marginBottom: 14,
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#F1F1F5",
      }}
    >
      <View style={{ height: 190, backgroundColor: "#F4F4F8" }}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="videocam" size={32} color="#C0C0CC" />
          </View>
        )}
        <View
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            backgroundColor: "#FF4566",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 99,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>LIVE</Text>
        </View>
        <View
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            backgroundColor: "rgba(17,24,39,0.72)",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 99,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
            {item.viewer_count}/{item.viewer_limit}
          </Text>
        </View>
      </View>

      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 13, color: "#6B7280" }}>{item.host_name}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: "#FF6B9D", fontWeight: "700" }}>
            입장료 {item.entry_fee_points.toLocaleString()}P
          </Text>
          <Text style={{ fontSize: 12, color: "#6B7280" }}>{formatCountdown(item.scheduled_end_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F8FA" }}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" />}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <View
              style={{
                backgroundColor: "#111827",
                borderRadius: 24,
                padding: 20,
                gap: 14,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>라이브</Text>
                  <Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 6, fontSize: 13 }}>
                    썸네일만 보고 입장 여부를 결정할 수 있습니다.
                  </Text>
                </View>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="radio" size={26} color="#FF6B9D" />
                </View>
              </View>

              {user && ["creator", "both"].includes(user.role) && (
                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: 18,
                    padding: 16,
                    gap: 10,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>호스트 메뉴</Text>
                  <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12 }}>
                    {eligibility?.eligible
                      ? "라이브 권한이 활성화되어 있습니다."
                      : eligibility?.reason ?? "관리자 승인 후 라이브를 시작할 수 있습니다."}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={!eligibility?.eligible || eligibility?.is_live_now}
                    onPress={() => setModalVisible(true)}
                    style={{
                      backgroundColor: !eligibility?.eligible || eligibility?.is_live_now ? "rgba(255,255,255,0.14)" : "#FF6B9D",
                      borderRadius: 16,
                      paddingVertical: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {eligibility?.is_live_now ? "이미 방송 중입니다" : "방송 시작"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={{ marginTop: 20, marginBottom: 12, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>진행 중 라이브</Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>{rooms.length}개 방송</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: 120, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#FF6B9D" />
            </View>
          ) : (
            <View style={{ paddingVertical: 100, alignItems: "center", gap: 10 }}>
              <Ionicons name="radio-outline" size={28} color="#C0C0CC" />
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>현재 진행 중인 라이브가 없습니다.</Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "84%",
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>라이브 시작</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>방송 제목</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="예: 오늘 밤 고민상담"
                  maxLength={50}
                  style={{
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    fontSize: 14,
                    color: "#111827",
                  }}
                />
              </View>

              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>예정 시간</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {DURATION_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setDuration(option.value)}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 14,
                        alignItems: "center",
                        backgroundColor: duration === option.value ? "#111827" : "#F3F4F6",
                      }}
                    >
                      <Text style={{ color: duration === option.value ? "#fff" : "#374151", fontWeight: "700" }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>썸네일</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={pickThumbnail}
                  style={{
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    borderRadius: 18,
                    overflow: "hidden",
                    height: 180,
                    backgroundColor: "#F8F8FA",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {thumbnailUri ? (
                    <Image source={{ uri: thumbnailUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: "center", gap: 8 }}>
                      <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                      <Text style={{ color: "#6B7280", fontSize: 13 }}>미등록 시 프로필 이미지가 사용됩니다.</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 16,
                  padding: 16,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 12, color: "#6B7280" }}>운영 고정값</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>입장료 50,000P · 최대 10명 · 연장 최대 2회</Text>
              </View>

              <TouchableOpacity
                disabled={submitting}
                onPress={handleCreateAndStart}
                style={{
                  backgroundColor: submitting ? "#F3F4F6" : "#FF6B9D",
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <Text style={{ color: submitting ? "#9CA3AF" : "#fff", fontWeight: "700" }}>
                  {submitting ? "생성 중..." : "바로 시작"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
