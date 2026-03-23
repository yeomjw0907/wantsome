import React, { useEffect, useState } from "react";
import { BackHandler, Image, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import RatingModal from "@/components/RatingModal";

export default function CreatorSummaryScreen() {
  const router = useRouter();
  const { sessionId, durationSec, creatorEarning, consumerId, consumerName, consumerAvatar } =
    useLocalSearchParams<{
      sessionId: string;
      durationSec: string;
      creatorEarning: string;
      consumerId: string;
      consumerName: string;
      consumerAvatar: string;
    }>();

  const [ratingVisible, setRatingVisible] = useState(false);

  const sec = Number(durationSec ?? 0);
  const earning = Number(creatorEarning ?? 0);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;

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

  const goDM = async () => {
    if (!consumerId || !sessionId) return;
    try {
      const res = await apiCall<{ conversation_id: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          call_session_id: sessionId,
          target_user_id: consumerId,
          content: "통화 감사합니다 :)",
        }),
      });
      router.replace(`/messages/${res.conversation_id}` as any);
    } catch (error) {
      console.error("[creator summary dm]", error);
      Toast.show({ type: "error", text1: "DM을 열지 못했어요." });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <View style={{ alignItems: "center", paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 }}>
        {consumerAvatar ? (
          <Image
            source={{ uri: consumerAvatar }}
            style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }}
          />
        ) : (
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#F3F4F6",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="person" size={36} color="#9CA3AF" />
          </View>
        )}
        <Text style={{ color: "#6B7280", fontSize: 15 }}>{consumerName ?? "유저"}</Text>
        <Text style={{ color: "#1B2A4A", fontSize: 21, fontWeight: "700", marginTop: 4 }}>
          통화가 종료되었습니다
        </Text>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          borderRadius: 20,
          backgroundColor: "#F8F8FA",
          paddingHorizontal: 24,
          paddingVertical: 20,
          gap: 16,
        }}
      >
        <Row label="통화 시간">
          <Text style={{ color: "#111827", fontWeight: "600", fontSize: 15 }}>
            {min}분 {remSec}초
          </Text>
        </Row>
        <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />
        <Row label="획득 포인트(정산 전)">
          <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 15 }}>
            +{earning.toLocaleString()}P
          </Text>
        </Row>
        <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />
        <Row label="정산 주기">
          <Text style={{ color: "#6B7280", fontWeight: "500", fontSize: 14 }}>매월 10일 정산</Text>
        </Row>
      </View>

      <View style={{ marginHorizontal: 20, marginTop: 16, flexDirection: "row", gap: 10 }}>
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
      </View>

      <View style={{ position: "absolute", bottom: 48, left: 20, right: 20 }}>
        <TouchableOpacity
          style={{ backgroundColor: "#4A90E2", borderRadius: 20, paddingVertical: 16, alignItems: "center" }}
          onPress={goHome}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>메인으로</Text>
        </TouchableOpacity>
      </View>

      <RatingModal
        visible={ratingVisible}
        callSessionId={sessionId ?? ""}
        targetId={consumerId ?? ""}
        targetName={consumerName ?? "유저"}
        targetAvatar={consumerAvatar ?? null}
        direction="user"
        onClose={() => setRatingVisible(false)}
      />
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ color: "#6B7280", fontSize: 14 }}>{label}</Text>
      {children}
    </View>
  );
}
