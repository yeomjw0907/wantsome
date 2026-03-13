/**
 * 크리에이터 대시보드
 * - 온라인 토글 (Realtime 반영)
 * - 수익 카드 3개 (오늘 / 이번달 / 전체)
 * - 등급 프로그레스 바
 * - 정산 내역 리스트
 * - 예약 관리
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCreatorStore } from "@/stores/useCreatorStore";

interface Earnings {
  today: number;
  month: number;
  total: number;
  monthly_minutes: number;
}

interface Settlement {
  id: string;
  year_month: string;
  total_points: number;
  gross_amount: number;
  tax_amount: number;
  net_amount: number;
  status: "pending" | "paid";
  created_at: string;
}

interface Reservation {
  id: string;
  reserved_at: string;
  duration_min: number;
  mode: "blue" | "red";
  deposit_points: number;
  status: "pending" | "confirmed" | "cancelled" | "noshow";
  consumer: { nickname: string; profile_img: string | null };
}

const GRADE_ICON: Record<string, string> = {
  "신규": "leaf-outline",
  "일반": "star-outline",
  "인기": "flame-outline",
  "탑":   "trophy-outline",
};

const GRADE_THRESHOLDS = [
  { grade: "신규", min: 0,    max: 500,  color: "#8E8EA0" },
  { grade: "일반", min: 500,  max: 1500, color: "#4D9FFF" },
  { grade: "인기", min: 1500, max: 9999, color: "#FF9800" },
  { grade: "탑",  min: 9999, max: 9999, color: "#FF6B9D" },
];

function getGradeInfo(minutes: number) {
  if (minutes >= 1500) return { current: GRADE_THRESHOLDS[2], next: GRADE_THRESHOLDS[3], progress: 1 };
  if (minutes >= 500) {
    const progress = (minutes - 500) / (1500 - 500);
    return { current: GRADE_THRESHOLDS[1], next: GRADE_THRESHOLDS[2], progress };
  }
  const progress = minutes / 500;
  return { current: GRADE_THRESHOLDS[0], next: GRADE_THRESHOLDS[1], progress };
}

export default function CreatorDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { isOnline, setIsOnline, myProfile } = useCreatorStore();

  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // 예정 방송 일정
  type Schedule = { id: string; scheduled_at: string; note: string | null };
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const creatorId = user?.id;

  const loadSchedules = async () => {
    if (!creatorId) return;
    try {
      const res = await apiCall<{ schedules: Schedule[] }>(`/api/creators/${creatorId}/schedules`);
      setSchedules(res.schedules ?? []);
    } catch { /* 무시 */ }
  };

  const handleAddSchedule = async () => {
    if (!scheduleDate.trim() || !creatorId) return;
    setScheduleSaving(true);
    try {
      await apiCall(`/api/creators/${creatorId}/schedules`, {
        method: "POST",
        body: JSON.stringify({ scheduled_at: scheduleDate, note: scheduleNote }),
      });
      setShowScheduleModal(false);
      setScheduleDate("");
      setScheduleNote("");
      await loadSchedules();
      Toast.show({ type: "success", text1: "방송 일정이 등록됐습니다! 📅" });
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "등록 실패" });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    if (!creatorId) return;
    try {
      await apiCall(`/api/creators/${creatorId}/schedules?schedule_id=${scheduleId}`, { method: "DELETE" });
      setSchedules((s) => s.filter((x) => x.id !== scheduleId));
    } catch { /* 무시 */ }
  };

  const loadData = useCallback(async () => {
    if (!creatorId) return;
    try {
      const [earningsData, settlementsData, reservationsData] = await Promise.all([
        apiCall<Earnings>(`/api/creators/${creatorId}/earnings`),
        apiCall<{ settlements: Settlement[] }>(`/api/creators/${creatorId}/settlements`),
        apiCall<{ reservations: Reservation[] }>(`/api/reservations?role=creator`),
      ]);
      setEarnings(earningsData);
      setSettlements(settlementsData.settlements ?? []);
      setReservations(
        reservationsData.reservations?.filter((r) => r.status === "pending") ?? []
      );
      loadSchedules();
    } catch {
      Toast.show({ type: "error", text1: "데이터를 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [creatorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleOnline = async (value: boolean) => {
    if (!creatorId || togglingOnline) return;
    setTogglingOnline(true);
    try {
      await apiCall(`/api/creators/${creatorId}/online`, {
        method: "PATCH",
        body: JSON.stringify({ is_online: value }),
      });
      setIsOnline(value);
      Toast.show({
        type: "success",
        text1: value ? "온라인 전환" : "오프라인 전환",
        text2: value ? "피드에 노출됩니다." : "피드에서 숨겨집니다.",
      });
    } catch {
      Toast.show({ type: "error", text1: "상태 변경에 실패했습니다." });
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleReservationResponse = async (
    reservationId: string,
    action: "accept" | "reject"
  ) => {
    try {
      await apiCall(`/api/reservations/${reservationId}/respond`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      Toast.show({
        type: "success",
        text1: action === "accept" ? "예약을 수락했습니다." : "예약을 거절했습니다.",
      });
      setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    } catch {
      Toast.show({ type: "error", text1: "처리에 실패했습니다." });
    }
  };

  const formatKRW = (points: number) =>
    `₩${Math.floor(points).toLocaleString()}`;

  const gradeInfo = getGradeInfo(earnings?.monthly_minutes ?? 0);

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor="#FF6B9D"
        />
      }
    >
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
          </TouchableOpacity>
          <Text className="text-navy text-lg font-bold">크리에이터 대시보드</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(creator)/onboarding/account")}>
          <Ionicons name="settings-outline" size={22} color="#1B2A4A" />
        </TouchableOpacity>
      </View>

      {/* 온라인 토글 카드 */}
      <View className="mx-4 mt-4 bg-white rounded-3xl p-5 shadow-card">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              className={`w-12 h-12 rounded-2xl items-center justify-center ${
                isOnline ? "bg-green-50" : "bg-gray-50"
              }`}
            >
              <View
                className={`w-4 h-4 rounded-full ${
                  isOnline ? "bg-green-400" : "bg-gray-300"
                }`}
              />
            </View>
            <View>
              <Text className="text-navy font-bold text-base">
                {isOnline ? "온라인" : "오프라인"}
              </Text>
              <Text className="text-gray-500 text-xs mt-0.5">
                {isOnline ? "소비자에게 노출 중" : "피드에 표시 안됨"}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={togglingOnline}
            trackColor={{ false: "#C8C8D8", true: "#FF6B9D" }}
            thumbColor="white"
          />
        </View>
      </View>

      {/* 수익 카드 3개 */}
      <View className="mx-4 mt-4 flex-row gap-3">
        {[
          { label: "오늘 수익", value: formatKRW(earnings?.today ?? 0), icon: "sunny-outline" as const, color: "#FF9800" },
          { label: "이번달",   value: formatKRW(earnings?.month ?? 0),  icon: "calendar-outline" as const, color: "#4D9FFF" },
          { label: "누적 수익", value: formatKRW(earnings?.total ?? 0), icon: "wallet-outline" as const, color: "#22C55E" },
        ].map((card) => (
          <View key={card.label} className="flex-1 bg-white rounded-2xl p-4 items-center">
            <Ionicons name={card.icon} size={20} color={card.color} style={{ marginBottom: 4 }} />
            <Text className="text-navy font-bold text-sm">{card.value}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">{card.label}</Text>
          </View>
        ))}
      </View>

      {/* 등급 카드 */}
      <View className="mx-4 mt-4 bg-white rounded-3xl p-5">
        <View className="flex-row items-center gap-2 mb-4">
          <Ionicons name="bar-chart-outline" size={18} color="#1B2A4A" />
          <Text className="text-navy font-bold text-base">등급 현황</Text>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <View className="w-10 h-10 rounded-2xl items-center justify-center" style={{ backgroundColor: gradeInfo.current.color + "20" }}>
              <Ionicons name={(GRADE_ICON[gradeInfo.current.grade] ?? "star-outline") as any} size={20} color={gradeInfo.current.color} />
            </View>
            <View>
              <Text className="text-navy font-bold">{gradeInfo.current.grade}</Text>
              <Text className="text-gray-400 text-xs">
                {earnings?.monthly_minutes ?? 0}분 / 이번달
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-gray-400 text-xs">다음 등급</Text>
            {gradeInfo.next && (
              <View className="flex-row items-center gap-1">
                <Ionicons name={(GRADE_ICON[gradeInfo.next.grade] ?? "trophy-outline") as any} size={13} color={gradeInfo.next.color} />
                <Text className="text-sm font-semibold" style={{ color: gradeInfo.next.color }}>
                  {gradeInfo.next.grade}
                </Text>
              </View>
            )}
            {!gradeInfo.next && <Text className="text-sm font-semibold" style={{ color: "#FF6B9D" }}>탑 선정</Text>}
          </View>
        </View>

        {/* 프로그레스 바 */}
        <View className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, gradeInfo.progress * 100)}%`,
              backgroundColor: gradeInfo.current.color,
            }}
          />
        </View>

        {gradeInfo.current.grade !== "탑" && (
          <Text className="text-gray-400 text-xs mt-2">
            다음 등급까지{" "}
            {Math.max(0, (gradeInfo.next?.min ?? 0) - (earnings?.monthly_minutes ?? 0))}분 필요
          </Text>
        )}
      </View>

      {/* 예약 관리 */}
      {reservations.length > 0 && (
        <View className="mx-4 mt-4 bg-white rounded-3xl p-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="calendar-outline" size={18} color="#1B2A4A" />
            <Text className="text-navy font-bold text-base">예약 요청 ({reservations.length})</Text>
          </View>
          {reservations.map((res) => (
            <View
              key={res.id}
              className="border border-gray-100 rounded-2xl p-4 mb-3"
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-navy font-semibold text-sm">
                  {res.consumer.nickname}님
                </Text>
                <View className={`rounded-full px-2 py-0.5 ${res.mode === "blue" ? "bg-bluebell" : "bg-red-light"}`}>
                  <Text className={`text-xs font-semibold ${res.mode === "blue" ? "text-blue" : "text-red"}`}>
                    {res.mode === "blue" ? "파란불" : "빨간불"}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1 mb-1">
                <Ionicons name="calendar-outline" size={11} color="#8E8EA0" />
                <Text className="text-gray-500 text-xs">{new Date(res.reserved_at).toLocaleString("ko-KR")}</Text>
              </View>
              <View className="flex-row items-center gap-1 mb-3">
                <Ionicons name="time-outline" size={11} color="#8E8EA0" />
                <Text className="text-gray-500 text-xs">{res.duration_min}분 · 예약금 {res.deposit_points.toLocaleString()}P</Text>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 bg-gray-100 rounded-xl py-2.5 items-center"
                  onPress={() => handleReservationResponse(res.id, "reject")}
                >
                  <Text className="text-gray-600 text-sm font-semibold">거절</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-pink rounded-xl py-2.5 items-center"
                  onPress={() => handleReservationResponse(res.id, "accept")}
                >
                  <Text className="text-white text-sm font-semibold">수락</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 예정 방송 일정 */}
      <View className="mx-4 mt-4 bg-white rounded-3xl p-5">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={18} color="#1B2A4A" />
            <Text className="text-navy font-bold text-base">예정 방송</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowScheduleModal(true)}
            style={{ backgroundColor: "#FF6B9D", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>+ 일정 추가</Text>
          </TouchableOpacity>
        </View>
        {schedules.length === 0 ? (
          <Text className="text-gray-400 text-sm text-center py-3">예정된 방송이 없습니다</Text>
        ) : schedules.map((s) => {
          const dt = new Date(s.scheduled_at);
          const dateStr = `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours().toString().padStart(2,"0")}:${dt.getMinutes().toString().padStart(2,"0")}`;
          return (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F0F7FF", borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 }}>
              <Ionicons name="time-outline" size={16} color="#4D9FFF" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#1B2A4A" }}>{dateStr}</Text>
                {s.note && <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{s.note}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleCancelSchedule(s.id)}>
                <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* 일정 추가 모달 */}
      <Modal visible={showScheduleModal} transparent animationType="slide" onRequestClose={() => setShowScheduleModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setShowScheduleModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1B2A4A", marginBottom: 4 }}>📅 방송 일정 추가</Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>팬들에게 방송 예정 시간을 알려보세요</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>날짜/시간 (ISO 형식)</Text>
              <TextInput
                value={scheduleDate}
                onChangeText={setScheduleDate}
                placeholder="예) 2026-03-20T21:00:00"
                placeholderTextColor="#C8C8D8"
                style={{ height: 44, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, fontSize: 13, color: "#1B2A4A", marginBottom: 12 }}
              />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>메모 (선택)</Text>
              <TextInput
                value={scheduleNote}
                onChangeText={setScheduleNote}
                placeholder="예) 오늘 밤 9시에 만나요 🌙"
                placeholderTextColor="#C8C8D8"
                maxLength={100}
                style={{ height: 44, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, fontSize: 13, color: "#1B2A4A", marginBottom: 20 }}
              />
              <TouchableOpacity
                onPress={handleAddSchedule}
                disabled={scheduleSaving || !scheduleDate.trim()}
                style={{ height: 48, borderRadius: 24, backgroundColor: scheduleDate.trim() ? "#FF6B9D" : "#E5E7EB", alignItems: "center", justifyContent: "center" }}
              >
                {scheduleSaving ? <ActivityIndicator color="white" /> : (
                  <Text style={{ color: scheduleDate.trim() ? "white" : "#9CA3AF", fontWeight: "700", fontSize: 15 }}>등록하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 정산 내역 */}
      <View className="mx-4 mt-4 bg-white rounded-3xl p-5 mb-6">
        <View className="flex-row items-center gap-2 mb-4">
          <Ionicons name="card-outline" size={18} color="#1B2A4A" />
          <Text className="text-navy font-bold text-base">정산 내역</Text>
        </View>
        {settlements.length === 0 ? (
          <Text className="text-gray-400 text-sm text-center py-4">
            아직 정산 내역이 없습니다.
          </Text>
        ) : (
          settlements.slice(0, 6).map((s) => (
            <View
              key={s.id}
              className="flex-row items-center justify-between py-3 border-b border-gray-50"
            >
              <View>
                <Text className="text-navy text-sm font-semibold">{s.year_month}</Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  {s.total_points.toLocaleString()}P 통화
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-navy font-bold text-sm">
                  {formatKRW(s.net_amount)}
                </Text>
                <View
                  className={`rounded-full px-2 py-0.5 mt-1 ${
                    s.status === "paid" ? "bg-green-50" : "bg-yellow-50"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      s.status === "paid" ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {s.status === "paid" ? "완료" : "대기"}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
