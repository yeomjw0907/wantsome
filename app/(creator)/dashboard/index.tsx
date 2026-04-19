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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { formatModeLabel } from "@/constants/branding";
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

  // 통화 가능 시간 (텍스트)
  const [availableTimes, setAvailableTimes] = useState("");
  const [showTimesModal, setShowTimesModal] = useState(false);
  const [timesSaving, setTimesSaving] = useState(false);

  // 예약 슬롯 설정
  type DayAvail = { day_of_week: number; start_time: string; end_time: string; slot_duration_min: number; is_active: boolean };
  const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
  const defaultAvailability: DayAvail[] = Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i, start_time: "20:00", end_time: "23:00", slot_duration_min: 30, is_active: false,
  }));
  const [availabilitySettings, setAvailabilitySettings] = useState<DayAvail[]>(defaultAvailability);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [availSaving, setAvailSaving] = useState(false);

  // 내 상품 + 판매 내역
  type MyProduct = { id: string; name: string; price: number; sold_count: number; images: string[] };
  type MyOrder = {
    id: string; created_at: string; quantity: number; total_price: number; status: string;
    products: { name: string } | null;
    users: { nickname: string; profile_img: string | null } | null;
  };
  const [myProducts, setMyProducts] = useState<MyProduct[]>([]);
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [shopTab, setShopTab] = useState<"products" | "orders">("products");
  const [totalRevenue, setTotalRevenue] = useState(0);

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
      const [earningsData, settlementsData, reservationsData, productsData, ordersData] = await Promise.all([
        apiCall<Earnings>(`/api/creators/${creatorId}/earnings`),
        apiCall<{ settlements: Settlement[] }>(`/api/creators/${creatorId}/settlements`),
        apiCall<{ reservations: Reservation[] }>(`/api/reservations?role=creator`),
        apiCall<{ products: MyProduct[] }>(`/api/creators/${creatorId}/products`).catch(() => ({ products: [] })),
        apiCall<{ orders: MyOrder[]; total_revenue: number }>(`/api/creators/${creatorId}/orders`).catch(() => ({ orders: [], total_revenue: 0 })),
      ]);
      setEarnings(earningsData);
      setSettlements(settlementsData.settlements ?? []);
      setReservations(
        reservationsData.reservations?.filter((r) => r.status === "pending") ?? []
      );
      setMyProducts(productsData.products ?? []);
      setMyOrders(ordersData.orders ?? []);
      setTotalRevenue(ordersData.total_revenue ?? 0);
      loadSchedules();
      // 통화 가능 시간 + 예약 슬롯 로드
      if (creatorId) {
        try {
          const [creatorData, availData] = await Promise.all([
            apiCall<{ available_times: string | null }>(`/api/creators/${creatorId}`),
            apiCall<{ availability: DayAvail[] }>(`/api/creators/${creatorId}/availability`).catch(() => ({ availability: [] })),
          ]);
          setAvailableTimes(creatorData.available_times ?? "");
          if (availData.availability && availData.availability.length > 0) {
            setAvailabilitySettings((prev) =>
              prev.map((d) => {
                const found = availData.availability.find((a: DayAvail) => a.day_of_week === d.day_of_week);
                return found ? { ...d, ...found } : d;
              })
            );
          }
        } catch { /* 무시 */ }
      }
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
                    {formatModeLabel(res.mode)}
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

      {/* 통화 가능 시간 설정 */}
      <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: "white", borderRadius: 24, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="time-outline" size={18} color="#1B2A4A" />
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1B2A4A" }}>통화 가능 시간</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowTimesModal(true)}
            style={{ backgroundColor: "#4D9FFF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>수정</Text>
          </TouchableOpacity>
        </View>
        {availableTimes ? (
          <View style={{ backgroundColor: "#F0F7FF", borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 13, color: "#1B2A4A", lineHeight: 20 }}>{availableTimes}</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowTimesModal(true)}
            style={{ borderWidth: 1.5, borderColor: "#E5E7EB", borderStyle: "dashed", borderRadius: 12, padding: 14, alignItems: "center" }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#C8C8D8" />
            <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>통화 가능 시간을 등록해 보세요</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 통화 가능 시간 모달 */}
      <Modal visible={showTimesModal} transparent animationType="slide" onRequestClose={() => setShowTimesModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setShowTimesModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1B2A4A", marginBottom: 4 }}>⏰ 통화 가능 시간</Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>소비자에게 언제 통화 가능한지 알려주세요</Text>
              <TextInput
                value={availableTimes}
                onChangeText={setAvailableTimes}
                placeholder={"예) 평일 오후 8시~11시\n주말 오후 2시~자정"}
                placeholderTextColor="#C8C8D8"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: "#1B2A4A", marginBottom: 20, textAlignVertical: "top" }}
              />
              <TouchableOpacity
                onPress={async () => {
                  if (!creatorId) return;
                  setTimesSaving(true);
                  try {
                    await apiCall(`/api/creators/${creatorId}/profile`, {
                      method: "PATCH",
                      body: JSON.stringify({ available_times: availableTimes || null }),
                    });
                    setShowTimesModal(false);
                    Toast.show({ type: "success", text1: "통화 가능 시간이 업데이트됐습니다 ⏰" });
                  } catch {
                    Toast.show({ type: "error", text1: "저장에 실패했습니다." });
                  } finally {
                    setTimesSaving(false);
                  }
                }}
                disabled={timesSaving}
                style={{ height: 48, borderRadius: 24, backgroundColor: "#4D9FFF", alignItems: "center", justifyContent: "center" }}
              >
                {timesSaving ? <ActivityIndicator color="white" /> : (
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>저장하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 예약 슬롯 설정 ── */}
      <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: "white", borderRadius: 24, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color="#1B2A4A" />
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1B2A4A" }}>예약 가능 시간 설정</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAvailModal(true)}
            style={{ backgroundColor: "#FF6B9D", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>수정</Text>
          </TouchableOpacity>
        </View>
        {availabilitySettings.some((d) => d.is_active) ? (
          <View style={{ gap: 6 }}>
            {availabilitySettings
              .filter((d) => d.is_active)
              .map((d) => (
                <View key={d.day_of_week} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF5F9", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ fontWeight: "700", color: "#FF6B9D", width: 20 }}>{DAY_LABELS[d.day_of_week]}</Text>
                  <Text style={{ fontSize: 13, color: "#1B2A4A" }}>{d.start_time} ~ {d.end_time}</Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>{d.slot_duration_min}분 단위</Text>
                </View>
              ))}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowAvailModal(true)}
            style={{ borderWidth: 1.5, borderColor: "#E5E7EB", borderStyle: "dashed", borderRadius: 12, padding: 14, alignItems: "center" }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#C8C8D8" />
            <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>예약 가능 요일/시간을 설정해 보세요</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 예약 슬롯 설정 모달 */}
      <Modal visible={showAvailModal} transparent animationType="slide" onRequestClose={() => setShowAvailModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setShowAvailModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <ScrollView style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 580 }}>
              <View style={{ padding: 24, paddingBottom: 40 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#1B2A4A", marginBottom: 4 }}>📅 예약 가능 시간 설정</Text>
                <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>소비자가 예약할 수 있는 요일과 시간대를 설정하세요 (30분 단위 슬롯 자동 생성)</Text>

                {availabilitySettings.map((day, idx) => (
                  <View key={day.day_of_week} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: day.is_active ? 8 : 0 }}>
                      <Switch
                        value={day.is_active}
                        onValueChange={(v) => setAvailabilitySettings((prev) =>
                          prev.map((d, i) => i === idx ? { ...d, is_active: v } : d)
                        )}
                        trackColor={{ false: "#C8C8D8", true: "#FF6B9D" }}
                        thumbColor="white"
                      />
                      <Text style={{ marginLeft: 10, fontWeight: "700", color: day.is_active ? "#1B2A4A" : "#9CA3AF", fontSize: 14, width: 36 }}>
                        {DAY_LABELS[day.day_of_week]}요일
                      </Text>
                    </View>
                    {day.is_active && (
                      <View style={{ flexDirection: "row", gap: 8, paddingLeft: 52 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>시작 시간</Text>
                          <TextInput
                            value={day.start_time}
                            onChangeText={(t) => setAvailabilitySettings((prev) =>
                              prev.map((d, i) => i === idx ? { ...d, start_time: t } : d)
                            )}
                            placeholder="20:00"
                            placeholderTextColor="#C8C8D8"
                            style={{ borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: "#1B2A4A" }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>종료 시간</Text>
                          <TextInput
                            value={day.end_time}
                            onChangeText={(t) => setAvailabilitySettings((prev) =>
                              prev.map((d, i) => i === idx ? { ...d, end_time: t } : d)
                            )}
                            placeholder="23:00"
                            placeholderTextColor="#C8C8D8"
                            style={{ borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: "#1B2A4A" }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>슬롯 단위</Text>
                          <TouchableOpacity
                            onPress={() => setAvailabilitySettings((prev) =>
                              prev.map((d, i) => i === idx ? { ...d, slot_duration_min: d.slot_duration_min === 30 ? 60 : 30 } : d)
                            )}
                            style={{ borderWidth: 1.5, borderColor: "#FF6B9D", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, alignItems: "center" }}
                          >
                            <Text style={{ fontSize: 13, color: "#FF6B9D", fontWeight: "700" }}>{day.slot_duration_min}분</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  onPress={async () => {
                    if (!creatorId) return;
                    setAvailSaving(true);
                    try {
                      await apiCall(`/api/creators/${creatorId}/availability`, {
                        method: "PUT",
                        body: JSON.stringify({ availability: availabilitySettings }),
                      });
                      setShowAvailModal(false);
                      Toast.show({ type: "success", text1: "예약 설정이 저장됐습니다 📅" });
                    } catch {
                      Toast.show({ type: "error", text1: "저장에 실패했습니다." });
                    } finally {
                      setAvailSaving(false);
                    }
                  }}
                  disabled={availSaving}
                  style={{ height: 48, borderRadius: 24, backgroundColor: "#FF6B9D", alignItems: "center", justifyContent: "center", marginTop: 8 }}
                >
                  {availSaving ? <ActivityIndicator color="white" /> : (
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>저장하기</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 내 상품 + 판매 내역 ── */}
      <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="bag-outline" size={18} color="#1B2A4A" />
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1B2A4A" }}>상품 & 판매</Text>
          </View>
          {totalRevenue > 0 && (
            <View style={{ backgroundColor: "#FFF0F5", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#FF6B9D" }}>
                총 수익 {totalRevenue.toLocaleString()}P
              </Text>
            </View>
          )}
        </View>

        {/* 서브탭 */}
        <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 3, marginBottom: 14 }}>
          {(["products", "orders"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setShopTab(tab)}
              style={{
                flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center",
                backgroundColor: shopTab === tab ? "#fff" : "transparent",
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: shopTab === tab ? "700" : "500", color: shopTab === tab ? "#1B2A4A" : "#9CA3AF" }}>
                {tab === "products" ? `내 상품 (${myProducts.length})` : `판매 내역 (${myOrders.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 내 상품 목록 */}
        {shopTab === "products" && (
          myProducts.length === 0 ? (
            <Text style={{ color: "#C8C8D8", fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
              등록된 상품이 없습니다.{"\n"}어드민에서 상품을 등록해주세요.
            </Text>
          ) : (
            myProducts.map((p) => (
              <View key={p.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F0F8", alignItems: "center" }}>
                <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "#F5F5FA", overflow: "hidden" }}>
                  {p.images[0] ? (
                    <Image source={{ uri: p.images[0] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="image-outline" size={20} color="#C8C8D8" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#1B2A4A" }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: "#FF6B9D", fontWeight: "700", marginTop: 2 }}>{p.price.toLocaleString()}P</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, color: "#9CA3AF" }}>판매 {p.sold_count}개</Text>
                </View>
              </View>
            ))
          )
        )}

        {/* 판매 내역 */}
        {shopTab === "orders" && (
          myOrders.length === 0 ? (
            <Text style={{ color: "#C8C8D8", fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
              아직 판매 내역이 없습니다.
            </Text>
          ) : (
            myOrders.slice(0, 10).map((o) => (
              <View key={o.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F0F8" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#1B2A4A" }} numberOfLines={1}>
                      {o.products?.name ?? "상품"}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                      {o.users?.nickname ?? "유저"} · {new Date(o.created_at).toLocaleDateString("ko-KR")}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF6B9D", marginLeft: 8 }}>
                    +{o.total_price.toLocaleString()}P
                  </Text>
                </View>
              </View>
            ))
          )
        )}
      </View>

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
