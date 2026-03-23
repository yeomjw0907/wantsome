import React, { useEffect, useState } from "react";
import { BackHandler, Image, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { usePointStore } from "@/stores/usePointStore";
import { apiCall } from "@/lib/api";
import RatingModal from "@/components/RatingModal";

export default function CallSummaryScreen() {
  const router = useRouter();
  const { sessionId, durationSec, pointsCharged, creatorId, creatorName, creatorAvatar } =
    useLocalSearchParams<{
      sessionId: string;
      durationSec: string;
      pointsCharged: string;
      creatorId: string;
      creatorName: string;
      creatorAvatar: string;
    }>();

  const { points } = usePointStore();
  const [ratingVisible, setRatingVisible] = useState(false);

  const sec = Number(durationSec ?? 0);
  const charged = Number(pointsCharged ?? 0);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  const perMinRate = min > 0 ? Math.round(charged / min) : 900;
  const isLowPoints = points < perMinRate * 5;
  const showReservation = min >= 3;

  useEffect(() => {
    if (sec >= 60) {
      const timer = setTimeout(() => setRatingVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [sec]);

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
    if (!creatorId || !sessionId) return;
    try {
      const res = await apiCall<{ conversation_id: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          call_session_id: sessionId,
          target_user_id: creatorId,
          content: "안녕하세요, 통화 즐거웠어요 :)",
        }),
      });
      router.replace(`/messages/${res.conversation_id}` as any);
    } catch (error) {
      console.error("[summary dm]", error);
      Toast.show({ type: "error", text1: "DM을 열지 못했어요." });
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="items-center pt-16 pb-8 px-6">
        {creatorAvatar ? (
          <Image source={{ uri: creatorAvatar }} className="w-20 h-20 rounded-full mb-4" />
        ) : (
          <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
            <Ionicons name="person" size={36} color="#999" />
          </View>
        )}
        <Text className="text-gray-500 text-base">{creatorName ?? "크리에이터"}</Text>
        <Text className="text-gray-900 text-xl font-bold mt-1">통화가 종료되었습니다</Text>
      </View>

      <View className="mx-5 rounded-2xl bg-[#F8F8FA] px-6 py-5 gap-4">
        <Row label="통화 시간">
          <Text className="text-gray-900 font-semibold text-base">
            {min}분 {remSec}초
          </Text>
        </Row>
        <View className="h-px bg-gray-200" />
        <Row label="차감 포인트">
          <Text className="text-red-500 font-bold text-base">-{charged.toLocaleString()}P</Text>
        </Row>
        <View className="h-px bg-gray-200" />
        <Row label="보유 포인트">
          <Text className="text-gray-900 font-semibold text-base">{points.toLocaleString()}P</Text>
        </Row>
      </View>

      <View style={{ marginHorizontal: 20, marginTop: 16 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={goCreator}
            style={{
              flex: 1,
              backgroundColor: "#FFF0F5",
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              gap: 4,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>📞</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#FF6B9D" }}>다시 통화</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goDM}
            style={{
              flex: 1,
              backgroundColor: "#EFF6FF",
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              gap: 4,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#4D9FFF" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#4D9FFF" }}>DM 보내기</Text>
          </TouchableOpacity>

          {showReservation && (
            <TouchableOpacity
              onPress={goReservation}
              style={{
                flex: 1,
                backgroundColor: "#F0FFF4",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                gap: 4,
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={20} color="#22C55E" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#22C55E" }}>예약하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="absolute bottom-12 left-5 right-5 gap-3">
        {isLowPoints && (
          <TouchableOpacity className="bg-gray-100 rounded-2xl py-4 items-center" onPress={goCharge}>
            <Text className="text-gray-700 font-semibold text-base">충전하러 가기</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity className="bg-[#4A90E2] rounded-2xl py-4 items-center" onPress={goHome}>
          <Text className="text-white font-bold text-base">메인으로</Text>
        </TouchableOpacity>
      </View>

      <RatingModal
        visible={ratingVisible}
        callSessionId={sessionId ?? ""}
        targetId={creatorId ?? ""}
        targetName={creatorName ?? "크리에이터"}
        targetAvatar={creatorAvatar ?? null}
        direction="creator"
        onClose={() => setRatingVisible(false)}
      />
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-gray-500 text-base">{label}</Text>
      {children}
    </View>
  );
}
