/**
 * 예약 통화 생성 화면 (네이버 예약 스타일)
 *
 * 1. 달력 — 예약 가능한 날 하이라이트
 * 2. 날짜 선택 → 해당 날 시간 슬롯 표시
 * 3. 슬롯 + 통화시간(30/60분) + 모드(blue/red) 선택
 * 4. 예약금 확인 → [예약하기]
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";

type Slot = { datetime: string; available: boolean };

const DEPOSIT_MAP: Record<string, number> = {
  "30_standard": 5000,
  "60_standard": 10000,
  "60_premium": 20000,
};

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function isoToLocalDate(iso: string) {
  // "2026-03-18T20:00:00.000Z" → local Date
  return new Date(iso);
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

  // 달력 상태
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // 선택 상태
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<30 | 60>(30);
  const [mode, setMode] = useState<"blue" | "red">("blue");
  const [submitting, setSubmitting] = useState(false);

  const depositKey = `${durationMin}_standard`;
  const depositPoints = DEPOSIT_MAP[depositKey] ?? 5000;

  // 슬롯 로드 (현재달 + 다음달)
  const loadSlots = useCallback(async () => {
    if (!creatorId) return;
    setSlotsLoading(true);
    try {
      const from = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
      // 다음달 말일까지
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
      const to = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const res = await apiCall<{ slots: Slot[] }>(
        `/api/creators/${creatorId}/slots?from=${from}&to=${to}`
      );
      setSlots(res.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [creatorId, viewYear, viewMonth]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // 날짜별 사용가능 슬롯 맵
  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      if (!s.available) continue;
      const d = formatDate(new Date(s.datetime));
      if (!map[d]) map[d] = [];
      map[d].push(s);
    }
    return map;
  }, [slots]);

  // 해당 달 달력 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [viewYear, viewMonth]);

  const goMonthPrev = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
    setSelectedDate(null); setSelectedSlot(null);
  };
  const goMonthNext = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
    setSelectedDate(null); setSelectedSlot(null);
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
        text1: "예약 요청이 전송됐습니다 📅",
        text2: "크리에이터가 수락하면 확정됩니다.",
      });
      router.back();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "예약 실패",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDaySlots = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FF" }}>
      {/* 헤더 */}
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
          <Image
            source={{ uri: creatorAvatar }}
            style={{ width: 34, height: 34, borderRadius: 17 }}
          />
        ) : (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#FF6B9D", alignItems: "center", justifyContent: "center" }}>
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
        {/* 달력 */}
        <View style={{ margin: 16, backgroundColor: "white", borderRadius: 20, padding: 18 }}>
          {/* 월 이동 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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

          {/* 요일 헤더 */}
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {DAY_LABELS.map((l, i) => (
              <Text
                key={l}
                style={{
                  flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600",
                  color: i === 0 ? "#EF4444" : i === 6 ? "#3B82F6" : "#9CA3AF",
                }}
              >
                {l}
              </Text>
            ))}
          </View>

          {/* 날짜 그리드 */}
          {slotsLoading ? (
            <ActivityIndicator color="#FF6B9D" style={{ paddingVertical: 24 }} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {calendarDays.map((day, idx) => {
                if (!day) return <View key={`empty-${idx}`} style={{ width: "14.28%", aspectRatio: 1 }} />;
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
                    <View style={{
                      width: 34, height: 34, borderRadius: 17,
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: isSelected ? "#FF6B9D" : hasSlots && !isPast ? "#FFF0F5" : "transparent",
                    }}>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: hasSlots && !isPast ? "700" : "400",
                        color: isSelected ? "white"
                          : isPast ? "#D1D5DB"
                          : hasSlots ? "#FF6B9D"
                          : dow === 0 ? "#EF4444" : dow === 6 ? "#3B82F6" : "#6B7280",
                      }}>
                        {day}
                      </Text>
                    </View>
                    {hasSlots && !isPast && !isSelected && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#FF6B9D", marginTop: 1 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 시간 슬롯 */}
        {selectedDate && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: "white", borderRadius: 20, padding: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#1B2A4A", marginBottom: 12 }}>
              {viewMonth + 1}월 {parseInt(selectedDate.split("-")[2])}일 예약 가능 시간
            </Text>
            {selectedDaySlots.length === 0 ? (
              <Text style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", paddingVertical: 12 }}>
                이 날은 예약 가능한 시간이 없습니다.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {selectedDaySlots.map((slot) => {
                  const timeLabel = formatTimeHHMM(slot.datetime);
                  const isChosen = selectedSlot === slot.datetime;
                  return (
                    <TouchableOpacity
                      key={slot.datetime}
                      onPress={() => setSelectedSlot(slot.datetime)}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 9,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: isChosen ? "#FF6B9D" : "#E5E7EB",
                        backgroundColor: isChosen ? "#FFF0F5" : "white",
                      }}
                    >
                      <Text style={{
                        fontSize: 14,
                        fontWeight: isChosen ? "700" : "400",
                        color: isChosen ? "#FF6B9D" : "#374151",
                      }}>
                        {timeLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* 옵션 선택 */}
        {selectedSlot && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: "white", borderRadius: 20, padding: 18, gap: 16 }}>
            {/* 통화 시간 */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280", marginBottom: 10 }}>통화 시간</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {([30, 60] as const).map((min) => {
                  const pts = DEPOSIT_MAP[`${min}_standard`];
                  return (
                    <TouchableOpacity
                      key={min}
                      onPress={() => setDurationMin(min)}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 14,
                        borderWidth: 2,
                        borderColor: durationMin === min ? "#FF6B9D" : "#E5E7EB",
                        backgroundColor: durationMin === min ? "#FFF0F5" : "white",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: durationMin === min ? "#FF6B9D" : "#374151" }}>
                        {min}분
                      </Text>
                      <Text style={{ fontSize: 12, color: durationMin === min ? "#FF6B9D" : "#9CA3AF", marginTop: 2 }}>
                        {pts.toLocaleString()}P
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 모드 선택 */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280", marginBottom: 10 }}>통화 모드</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setMode("blue")}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 14,
                    borderWidth: 2,
                    borderColor: mode === "blue" ? "#3B82F6" : "#E5E7EB",
                    backgroundColor: mode === "blue" ? "#EFF6FF" : "white",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: mode === "blue" ? "#3B82F6" : "#374151" }}>🔵 파란불</Text>
                  <Text style={{ fontSize: 11, color: mode === "blue" ? "#3B82F6" : "#9CA3AF", marginTop: 2 }}>일반 통화</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMode("red")}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 14,
                    borderWidth: 2,
                    borderColor: mode === "red" ? "#EF4444" : "#E5E7EB",
                    backgroundColor: mode === "red" ? "#FEF2F2" : "white",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: mode === "red" ? "#EF4444" : "#374151" }}>🔴 빨간불</Text>
                  <Text style={{ fontSize: 11, color: mode === "red" ? "#EF4444" : "#9CA3AF", marginTop: 2 }}>프리미엄</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 예약 요약 + 버튼 */}
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: "#6B7280", fontSize: 13 }}>예약금 (확정 시 차감)</Text>
              <Text style={{ color: "#FF6B9D", fontSize: 14, fontWeight: "700" }}>
                {depositPoints.toLocaleString()}P
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 14 }}>
              ※ 크리에이터 수락 후 예약이 확정됩니다. 예약금은 지금 즉시 차감됩니다.
            </Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                height: 52, borderRadius: 26, backgroundColor: "#FF6B9D",
                alignItems: "center", justifyContent: "center",
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

        {/* 가용시간 미설정 안내 */}
        {!slotsLoading && slots.length === 0 && (
          <View style={{ margin: 16, alignItems: "center", paddingVertical: 32 }}>
            <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12, textAlign: "center" }}>
              크리에이터가 아직 예약 가능한 시간을{"\n"}설정하지 않았습니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
