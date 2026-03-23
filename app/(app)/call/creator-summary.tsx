/**
 * 크리에이터 통화 종료 요약 화면
 * - 통화 시간, 획득 포인트(정산 전), 정산 안내
 * - 60초 이상 통화 시 유저 평가 모달 자동 표시
 * - 버튼: 홈으로, DM 보내기
 */
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, BackHandler } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RatingModal from "@/components/RatingModal";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";

export default function CreatorSummaryScreen() {
  const router = useRouter();
  const {
    sessionId,
    durationSec,
    creatorEarning,
    consumerId,
    consumerName,
    consumerAvatar,
  } = useLocalSearchParams<{
    sessionId: string;
    durationSec: string;
    creatorEarning: string;
    consumerId: string;
    consumerName: string;
    consumerAvatar: string;
  }>();

  const sec = Number(durationSec ?? 0);
  const earning = Number(creatorEarning ?? 0);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;

  // 평가 모달: 60초 이상 통화 시 자동 표시
  const [ratingVisible, setRatingVisible] = useState(false);

  useEffect(() => {
    if (sec >= 60) {
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

  const goDM = async () => {
    if (!consumerId) return;
    try {
      const res = await apiCall<{ id: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          consumer_id: consumerId,
          message: "통화 감사했어요 😊",
        }),
      });
      router.replace(`/messages/${res.id}` as any);
    } catch {
      Toast.show({ type: "error", text1: "DM 개설에 실패했습니다." });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      {/* 상단 유저 정보 */}
      <View style={{ alignItems: "center", paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 }}>
        {consumerAvatar ? (
          <Image
            source={{ uri: consumerAvatar }}
            style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }}
          />
        ) : (
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: "#F3F4F6", alignItems: "center",
            justifyContent: "center", marginBottom: 16,
          }}>
            <Ionicons name="person" size={36} color="#9CA3AF" />
          </View>
        )}
        <Text style={{ color: "#6B7280", fontSize: 15 }}>{consumerName ?? "유저"}</Text>
        <Text style={{ color: "#1B2A4A", fontSize: 21, fontWeight: "700", marginTop: 4 }}>
          통화가 종료됐습니다
        </Text>
      </View>

      {/* 통화 정보 카드 */}
      <View style={{
        marginHorizontal: 20, borderRadius: 20,
        backgroundColor: "#F8F8FA", paddingHorizontal: 24, paddingVertical: 20, gap: 16,
      }}>
        <Row label="통화 시간">
          <Text style={{ color: "#111827", fontWeight: "600", fontSize: 15 }}>
            {min}분 {remSec}초
          </Text>
        </Row>
        <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />
        <Row label="획득 포인트 (정산 전)">
          <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 15 }}>
            +{earning.toLocaleString()}P
          </Text>
        </Row>
        <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />
        <Row label="정산 시기">
          <Text style={{ color: "#6B7280", fontWeight: "500", fontSize: 14 }}>
            매월 10일 정산
          </Text>
        </Row>
      </View>

      {/* CTA 버튼 */}
      <View style={{ marginHorizontal: 20, marginTop: 16, flexDirection: "row", gap: 10 }}>
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
      </View>

      {/* 메인으로 버튼 */}
      <View style={{ position: "absolute", bottom: 48, left: 20, right: 20 }}>
        <TouchableOpacity
          style={{ backgroundColor: "#4A90E2", borderRadius: 20, paddingVertical: 16, alignItems: "center" }}
          onPress={goHome}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>메인으로</Text>
        </TouchableOpacity>
      </View>

      {/* 유저 평가 모달 */}
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
