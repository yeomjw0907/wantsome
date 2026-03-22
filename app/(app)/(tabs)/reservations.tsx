/**
 * 예약 통화 탭
 * - 소비자: 내 예약 목록 (upcoming / past)
 * - 크리에이터: 동일 화면 (creator role로 조회)
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

interface Reservation {
  id: string;
  consumer_id: string;
  creator_id: string;
  reserved_at: string;
  duration_min: number;
  mode: "blue" | "red";
  type: "standard" | "premium";
  deposit_points: number;
  status: "pending" | "confirmed" | "cancelled" | "noshow" | "completed";
  reject_reason: string | null;
  creator: { display_name: string; profile_image_url: string | null } | null;
  consumer: { nickname: string; profile_img: string | null } | null;
}

const STATUS_CONFIG = {
  pending: { label: "대기중", color: "#F59E0B", bg: "#FFFBEB" },
  confirmed: { label: "확정", color: "#22C55E", bg: "#F0FDF4" },
  cancelled: { label: "취소됨", color: "#8E8EA0", bg: "#F5F5F8" },
  noshow: { label: "노쇼", color: "#FF5C7A", bg: "#FFF1F3" },
  completed: { label: "완료", color: "#4D9FFF", bg: "#EFF6FF" },
} as const;

function ReservationCard({
  item,
  isCreator,
  onCancel,
}: {
  item: Reservation;
  isCreator: boolean;
  onCancel: (id: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const reservedDate = new Date(item.reserved_at);
  const isPast = reservedDate < new Date();
  const canCancel = !isCreator && ["pending", "confirmed"].includes(item.status) && !isPast;

  const otherName = isCreator
    ? item.consumer?.nickname ?? "소비자"
    : item.creator?.display_name ?? "크리에이터";

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
      {/* 상단: 날짜 + 상태 */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-navy text-base font-bold">
          {reservedDate.toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
            weekday: "short",
          })}{" "}
          {reservedDate.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: statusCfg.bg }}
        >
          <Text className="text-xs font-semibold" style={{ color: statusCfg.color }}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* 상대방 */}
      <View className="flex-row items-center gap-1 mb-2">
        <Ionicons name={isCreator ? "person-outline" : "person"} size={13} color="#6B7280" />
        <Text className="text-gray-700 text-sm">{otherName}</Text>
      </View>

      {/* 통화 정보 뱃지 */}
      <View className="flex-row gap-2 mb-3">
        <View className="bg-bluebell rounded-lg px-2.5 py-1">
          <Text className="text-blue text-xs font-medium">{item.duration_min}분</Text>
        </View>
        <View
          className="rounded-lg px-2.5 py-1"
          style={{ backgroundColor: item.mode === "blue" ? "#EFF6FF" : "#FFF1F3" }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: item.mode === "blue" ? "#4D9FFF" : "#FF5C7A" }}
          >
            {item.mode === "blue" ? "파란불" : "빨간불"}
          </Text>
        </View>
        <View className="bg-gray-50 rounded-lg px-2.5 py-1">
          <Text className="text-gray-600 text-xs">예약금 {item.deposit_points.toLocaleString()}P</Text>
        </View>
      </View>

      {/* 거절 사유 */}
      {item.status === "cancelled" && item.reject_reason && (
        <Text className="text-gray-400 text-xs mb-3">사유: {item.reject_reason}</Text>
      )}

      {/* 확정 안내 */}
      {item.status === "confirmed" && !isPast && (
        <View className="bg-green-50 rounded-xl p-3 mb-2">
          <View className="flex-row items-center justify-center gap-1">
            <Ionicons name="checkmark-circle" size={13} color="#15803D" />
            <Text className="text-green-700 text-xs">예약 확정 · 예약 시간에 앱을 열어주세요</Text>
          </View>
        </View>
      )}

      {/* 취소 버튼 */}
      {canCancel && (
        <TouchableOpacity
          className="border border-gray-200 rounded-xl py-2.5 items-center mt-1"
          onPress={() => onCancel(item.id)}
          activeOpacity={0.7}
        >
          <Text className="text-gray-500 text-sm">예약 취소</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ReservationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const isCreator = user?.role === "creator";

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const loadReservations = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const role = isCreator ? "creator" : "consumer";
      const data = await apiCall<{ reservations: Reservation[] }>(
        `/api/reservations?role=${role}`
      );
      setReservations(data.reservations ?? []);
    } catch {
      Toast.show({ type: "error", text1: "예약 목록을 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isCreator]);

  useEffect(() => { loadReservations(); }, [loadReservations]);

  const handleCancel = (reservationId: string) => {
    Alert.alert("예약 취소", "예약을 취소하시겠습니까? 포인트는 환불됩니다.", [
      { text: "유지", style: "cancel" },
      {
        text: "취소",
        style: "destructive",
        onPress: async () => {
          try {
            await apiCall(`/api/reservations/${reservationId}`, { method: "DELETE" });
            Toast.show({ type: "success", text1: "예약이 취소됐습니다." });
            loadReservations();
          } catch {
            Toast.show({ type: "error", text1: "취소에 실패했습니다." });
          }
        },
      },
    ]);
  };

  const now = new Date();
  const upcoming = reservations.filter(
    (r) => new Date(r.reserved_at) >= now && !["cancelled", "noshow"].includes(r.status)
  );
  const past = reservations.filter(
    (r) => new Date(r.reserved_at) < now || ["cancelled", "noshow"].includes(r.status)
  );
  const displayList = activeTab === "upcoming" ? upcoming : past;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="bg-white px-5 pb-4 border-b border-gray-100">
        <Text className="text-navy text-xl font-bold mt-4 mb-4">예약 통화</Text>
        <View className="flex-row bg-gray-100 rounded-2xl p-1">
          {(["upcoming", "past"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2 rounded-xl items-center ${activeTab === tab ? "bg-white" : ""}`}
              onPress={() => setActiveTab(tab)}
            >
              <Text className={`text-sm font-semibold ${activeTab === tab ? "text-navy" : "text-gray-400"}`}>
                {tab === "upcoming"
                  ? `예정${upcoming.length > 0 ? ` (${upcoming.length})` : ""}`
                  : "지난 예약"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : displayList.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: "#FF6B9D20" }}>
            <Ionicons name="calendar-outline" size={28} color="#FF6B9D" />
          </View>
          <Text className="text-navy font-bold text-lg mb-2">
            {activeTab === "upcoming" ? "예정된 예약이 없어요" : "지난 예약이 없어요"}
          </Text>
          <Text className="text-gray-400 text-sm text-center">
            {activeTab === "upcoming"
              ? "크리에이터 프로필에서 예약 통화를 신청해보세요"
              : "예약 통화 내역이 여기에 표시됩니다"}
          </Text>
          {activeTab === "upcoming" && (
            <TouchableOpacity
              className="mt-6 bg-pink rounded-full px-6 py-3"
              onPress={() => router.push("/(app)/(tabs)" as never)}
              activeOpacity={0.8}
            >
              <Text className="text-white text-sm font-semibold">크리에이터 둘러보기</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadReservations(true)}
              tintColor="#FF6B9D"
            />
          }
          renderItem={({ item }) => (
            <ReservationCard item={item} isCreator={isCreator} onCancel={handleCancel} />
          )}
        />
      )}
    </View>
  );
}
