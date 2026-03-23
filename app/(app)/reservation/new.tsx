import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";

type Slot = { datetime: string; available: boolean };

const PER_MIN_RATE: Record<string, number> = { blue: 900, red: 1300 };
const DURATION_PRESETS = [10, 15, 20, 30, 45, 60] as const;
const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function calcDeposit(durationMin: number, mode: string): number {
  const rate = PER_MIN_RATE[mode] ?? 900;
  return Math.round(durationMin * rate * 0.1);
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTimeHHMM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ReservationNewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { creatorId, creatorName, creatorAvatar } = useLocalSearchParams<{
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
  }>();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [durationMin, setDurationMin] = useState<number>(10);
  const [mode, setMode] = useState<"blue" | "red">("blue");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const depositPoints = calcDeposit(durationMin, mode);

  const loadSlots = useCallback(async () => {
    if (!creatorId) return;
    setSlotsLoading(true);
    try {
      const from = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
      const to = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const res = await apiCall<{ slots: Slot[] }>(
        `/api/creators/${creatorId}/slots?from=${from}&to=${to}&duration_min=${durationMin}`
      );
      setSlots(res.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [creatorId, durationMin, viewMonth, viewYear]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [durationMin, mode]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const slot of slots) {
      if (!slot.available) continue;
      const dateKey = formatDate(new Date(slot.datetime));
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(slot);
    }
    return map;
  }, [slots]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i += 1) days.push(i);
    return days;
  }, [viewMonth, viewYear]);

  const selectedDaySlots = selectedDate ? slotsByDate[selectedDate] ?? [] : [];

  const goMonthPrev = () => {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
    } else {
      setViewMonth((month) => month - 1);
    }
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const goMonthNext = () => {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
    } else {
      setViewMonth((month) => month + 1);
    }
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const handleDayPress = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!slotsByDate[dateStr]) return;
    setSelectedDate(dateStr);
    setSelectedSlot(null);
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !creatorId) return;
    setSubmitting(true);
    try {
      await apiCall<{ reservation_id: string }>("/api/reservations", {
        method: "POST",
        body: JSON.stringify({
          creator_id: creatorId,
          reserved_at: selectedSlot,
          duration_min: durationMin,
          mode,
          type: "standard",
        }),
      });
      Toast.show({
        type: "success",
        text1: "예약 요청을 보냈어요",
        text2: "크리에이터가 수락하면 확정됩니다.",
      });
      router.back();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "예약에 실패했어요.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FF" }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: "white",
          borderBottomWidth: 1,
          borderBottomColor: "#F0F0F8",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        {creatorAvatar ? (
          <Image source={{ uri: creatorAvatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
        ) : (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "#FF6B9D",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
              {(creatorName ?? "?")[0]}
            </Text>
          </View>
        )}
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1B2A4A", flex: 1 }}>
          {creatorName} 예약 통화
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ margin: 16, backgroundColor: "white", borderRadius: 20, padding: 18 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <TouchableOpacity onPress={goMonthPrev} style={{ padding: 6 }}>
              <Ionicons name="chevron-back" size={20} color="#1B2A4A" />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1B2A4A" }}>
              {viewYear}년 {MONTH_NAMES[viewMonth]}
            </Text>
            <TouchableOpacity onPress={goMonthNext} style={{ padding: 6 }}>
              <Ionicons name="chevron-forward" size={20} color="#1B2A4A" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {DAY_LABELS.map((label, i) => (
              <Text
                key={label}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: "600",
                  color: i === 0 ? "#EF4444" : i === 6 ? "#3B82F6" : "#9CA3AF",
                }}
              >
                {label}
              </Text>
            ))}
          </View>

          {slotsLoading ? (
            <ActivityIndicator color="#FF6B9D" style={{ paddingVertical: 24 }} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <View key={`empty-${idx}`} style={{ width: "14.28%", aspectRatio: 1 }} />;
                }
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayDate = new Date(viewYear, viewMonth, day);
                const isPast = dayDate < today;
                const hasSlots = !!slotsByDate[dateStr];
                const isSelected = selectedDate === dateStr;
                const dow = dayDate.getDay();

                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => handleDayPress(day)}
                    disabled={isPast || !hasSlots}
                    style={{ width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected ? "#FF6B9D" : hasSlots && !isPast ? "#FFF0F5" : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: hasSlots && !isPast ? "700" : "400",
                          color: isSelected
                            ? "white"
                            : isPast
                              ? "#D1D5DB"
                              : hasSlots
                                ? "#FF6B9D"
                                : dow === 0
                                  ? "#EF4444"
                                  : dow === 6
                                    ? "#3B82F6"
                                    : "#6B7280",
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                    {hasSlots && !isPast && !isSelected && (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: "#FF6B9D",
                          marginTop: 1,
                        }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: "white", borderRadius: 20, padding: 18, gap: 16 }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280", marginBottom: 10 }}>통화 시간</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DURATION_PRESETS.map((min) => {
                const pts = calcDeposit(min, mode);
                const isChosen = durationMin === min;
                return (
                  <TouchableOpacity
                    key={min}
                    onPress={() => setDurationMin(min)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isChosen ? "#FF6B9D" : "#E5E7EB",
                      backgroundColor: isChosen ? "#FFF0F5" : "white",
                      alignItems: "center",
                      minWidth: 72,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: isChosen ? "#FF6B9D" : "#374151" }}>
                      {min}분
                    </Text>
                    <Text style={{ fontSize: 11, color: isChosen ? "#FF6B9D" : "#9CA3AF", marginTop: 2 }}>
                      예약금 {pts.toLocaleString()}P
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280", marginBottom: 10 }}>통화 모드</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setMode("blue")}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: mode === "blue" ? "#3B82F6" : "#E5E7EB",
                  backgroundColor: mode === "blue" ? "#EFF6FF" : "white",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: mode === "blue" ? "#3B82F6" : "#374151" }}>
                  블루 모드
                </Text>
                <Text style={{ fontSize: 11, color: mode === "blue" ? "#3B82F6" : "#9CA3AF", marginTop: 2 }}>
                  일반 통화
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode("red")}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: mode === "red" ? "#EF4444" : "#E5E7EB",
                  backgroundColor: mode === "red" ? "#FEF2F2" : "white",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: mode === "red" ? "#EF4444" : "#374151" }}>
                  레드 모드
                </Text>
                <Text style={{ fontSize: 11, color: mode === "red" ? "#EF4444" : "#9CA3AF", marginTop: 2 }}>
                  프리미엄
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {selectedDate && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: "white", borderRadius: 20, padding: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#1B2A4A", marginBottom: 12 }}>
              {viewMonth + 1}월 {parseInt(selectedDate.split("-")[2], 10)}일 예약 가능한 시작 시간
            </Text>
            <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
              {durationMin}분 통화를 기준으로 실제 예약 가능한 시간만 보여줍니다.
            </Text>
            {selectedDaySlots.length === 0 ? (
              <Text style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", paddingVertical: 12 }}>
                이 날짜에는 예약 가능한 시간이 없습니다.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {selectedDaySlots.map((slot) => {
                  const isChosen = selectedSlot === slot.datetime;
                  return (
                    <TouchableOpacity
                      key={slot.datetime}
                      onPress={() => setSelectedSlot(slot.datetime)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: isChosen ? "#FF6B9D" : "#E5E7EB",
                        backgroundColor: isChosen ? "#FFF0F5" : "white",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: isChosen ? "700" : "400",
                          color: isChosen ? "#FF6B9D" : "#374151",
                        }}
                      >
                        {formatTimeHHMM(slot.datetime)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {selectedSlot && (
          <View style={{ marginHorizontal: 16, marginBottom: 24, backgroundColor: "white", borderRadius: 20, padding: 18 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: "#6B7280", fontSize: 13 }}>예약 일시</Text>
              <Text style={{ color: "#1B2A4A", fontSize: 13, fontWeight: "600" }}>
                {selectedDate} {formatTimeHHMM(selectedSlot)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: "#6B7280", fontSize: 13 }}>통화 시간</Text>
              <Text style={{ color: "#1B2A4A", fontSize: 13, fontWeight: "600" }}>{durationMin}분</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: "#6B7280", fontSize: 13 }}>총 예상 비용</Text>
              <Text style={{ color: "#6B7280", fontSize: 13 }}>
                {(durationMin * (mode === "blue" ? 900 : 1300)).toLocaleString()}P
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: "#6B7280", fontSize: 13 }}>지금 차감 (예약금 10%)</Text>
              <Text style={{ color: "#FF6B9D", fontSize: 14, fontWeight: "700" }}>
                {depositPoints.toLocaleString()}P
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 14 }}>
              크리에이터가 수락해야 예약이 확정됩니다. 예약금은 지금 즉시 차감됩니다.
            </Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                height: 52,
                borderRadius: 26,
                backgroundColor: "#FF6B9D",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                  예약하기 · {depositPoints.toLocaleString()}P
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!slotsLoading && slots.length === 0 && (
          <View style={{ margin: 16, alignItems: "center", paddingVertical: 32 }}>
            <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12, textAlign: "center" }}>
              크리에이터가 아직 예약 가능한 시간을 등록하지 않았습니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
