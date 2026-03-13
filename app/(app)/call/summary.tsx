/**
 * 통화 종료 요약 화면
 * - 통화 시간, 차감 포인트, 잔여 포인트 표시
 * - 3분 이상 통화 시 예약 통화 유도
 * - 잔여 5분치 미만 시 충전 버튼 표시
 * - 통화 종료 직후 평점 모달 자동 표시
 */
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, BackHandler } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePointStore } from "@/stores/usePointStore";
import { apiCall } from "@/lib/api";
import RatingModal from "@/components/RatingModal";
import Toast from "react-native-toast-message";

export default function CallSummaryScreen() {
  const router = useRouter();
  const {
    sessionId,
    durationSec,
    pointsCharged,
    creatorId,
    creatorName,
    creatorAvatar,
  } = useLocalSearchParams<{
    sessionId: string;
    durationSec: string;
    pointsCharged: string;
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
  }>();

  const { points } = usePointStore();

  const sec = Number(durationSec ?? 0);
  const charged = Number(pointsCharged ?? 0);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;

  const perMinRate = min > 0 ? Math.round(charged / min) : 900;
  const isLowPoints = points < perMinRate * 5;
  const showReservation = min >= 3;

  // 평점 모달: 통화 종료 직후 자동 표시 (60초 이상 통화 시)
  const [ratingVisible, setRatingVisible] = useState(false);

  useEffect(() => {
    if (sec >= 60) {
      // 약간의 딜레이 후 표시 (화면 전환 완료 후)
      const t = setTimeout(() => setRatingVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [sec]);

  // 하드웨어 뒤로가기 차단
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => handler.remove();
  }, []);

  const goHome = () => router.replace("/(app)/(tabs)");
  const goCharge = () => router.push("/(app)/charge");
  const goReservation = () => router.push("/(app)/(tabs)/messages" as any);
  const goCreator = () => {
    if (creatorId) router.push(`/creator/${creatorId}` as any);
  };
  const goDM = async () => {
    if (!creatorId) return;
    try {
      const res = await apiCall<{ id: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          creator_id: creatorId,
          message: "안녕하세요! 통화 잘 했어요 😊",
        }),
      });
      router.replace(`/messages/${res.id}` as any);
    } catch {
      Toast.show({ type: "error", text1: "DM 개설에 실패했습니다." });
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* 상단 크리에이터 정보 */}
      <View className="items-center pt-16 pb-8 px-6">
        {creatorAvatar ? (
          <Image
            source={{ uri: creatorAvatar }}
            className="w-20 h-20 rounded-full mb-4"
          />
        ) : (
          <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
            <Ionicons name="person" size={36} color="#999" />
          </View>
        )}
        <Text className="text-gray-500 text-base">{creatorName ?? "크리에이터"}</Text>
        <Text className="text-gray-900 text-xl font-bold mt-1">통화가 종료됐습니다</Text>
      </View>

      {/* 통화 정보 카드 */}
      <View className="mx-5 rounded-2xl bg-[#F8F8FA] px-6 py-5 gap-4">
        <Row label="통화 시간">
          <Text className="text-gray-900 font-semibold text-base">
            {min}분 {remSec}초
          </Text>
        </Row>
        <View className="h-px bg-gray-200" />
        <Row label="차감 포인트">
          <Text className="text-red-500 font-bold text-base">
            -{charged.toLocaleString()}P
          </Text>
        </Row>
        <View className="h-px bg-gray-200" />
        <Row label="잔여 포인트">
          <Text className="text-gray-900 font-semibold text-base">
            {points.toLocaleString()}P
          </Text>
        </Row>
      </View>

      {/* 재통화 / DM / 예약 3-버튼 CTA */}
      <View style={{ marginHorizontal: 20, marginTop: 16 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* 다시 통화 */}
          <TouchableOpacity
            onPress={goCreator}
            style={{
              flex: 1, backgroundColor: "#FFF0F5",
              borderRadius: 16, paddingVertical: 14,
              alignItems: "center", gap: 4,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>♡</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#FF6B9D" }}>다시 통화</Text>
          </TouchableOpacity>

          {/* DM 보내기 */}
          <TouchableOpacity
            onPress={goDM}
            style={{
              flex: 1, backgroundColor: "#EFF6FF",
              borderRadius: 16, paddingVertical: 14,
              alignItems: "center", gap: 4,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#4D9FFF" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#4D9FFF" }}>DM 보내기</Text>
          </TouchableOpacity>

          {/* 예약하기 */}
          <TouchableOpacity
            onPress={goReservation}
            style={{
              flex: 1, backgroundColor: "#F0FFF4",
              borderRadius: 16, paddingVertical: 14,
              alignItems: "center", gap: 4,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color="#22C55E" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#22C55E" }}>예약하기</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 하단 버튼 */}
      <View className="absolute bottom-12 left-5 right-5 gap-3">
        {isLowPoints && (
          <TouchableOpacity
            className="bg-gray-100 rounded-2xl py-4 items-center"
            onPress={goCharge}
          >
            <Text className="text-gray-700 font-semibold text-base">충전하러 가기</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          className="bg-[#4A90E2] rounded-2xl py-4 items-center"
          onPress={goHome}
        >
          <Text className="text-white font-bold text-base">메인으로</Text>
        </TouchableOpacity>
      </View>

      {/* 평점 모달 */}
      <RatingModal
        visible={ratingVisible}
        callSessionId={sessionId ?? ""}
        creatorId={creatorId ?? ""}
        creatorName={creatorName ?? "크리에이터"}
        creatorAvatar={creatorAvatar ?? null}
        onClose={() => setRatingVisible(false)}
      />
    </View>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-gray-500 text-base">{label}</Text>
      {children}
    </View>
  );
}
