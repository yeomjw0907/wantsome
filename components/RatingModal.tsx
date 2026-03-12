/**
 * 통화 종료 후 평점 모달
 * - 별 1~5개 선택
 * - 스킵 가능
 */
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";

interface Props {
  visible: boolean;
  callSessionId: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  onClose: () => void;
}

export default function RatingModal({
  visible,
  callSessionId,
  creatorId,
  creatorName,
  creatorAvatar,
  onClose,
}: Props) {
  const [selected, setSelected] = useState(0);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async () => {
    if (selected === 0) { onClose(); return; }
    setLoading(true);
    try {
      await apiCall("/api/ratings", {
        method: "POST",
        body: JSON.stringify({
          call_session_id: callSessionId,
          creator_id:      creatorId,
          rating:          selected,
        }),
      });
      Toast.show({ type: "success", text1: "평가해주셔서 감사합니다! 💫" });
    } catch {
      // 이미 평가했거나 실패 시 무시
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const LABELS = ["", "별로예요", "그냥 그래요", "좋았어요", "정말 좋았어요", "최고예요! ✨"];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        <View style={{
          backgroundColor: "white",
          borderRadius: 24, padding: 28,
          width: "100%", maxWidth: 340,
          alignItems: "center",
        }}>
          {/* 크리에이터 아바타 */}
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: "#D1E4F8", overflow: "hidden", marginBottom: 12,
          }}>
            {creatorAvatar ? (
              <Image source={{ uri: creatorAvatar }} style={{ width: 64, height: 64 }} />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person" size={32} color="#4D9FFF" />
              </View>
            )}
          </View>

          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1B2A4A", marginBottom: 4 }}>
            통화는 어떠셨나요?
          </Text>
          <Text style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
            {creatorName}님과의 통화를 평가해주세요
          </Text>

          {/* 별점 */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setSelected(star)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={star <= selected ? "star" : "star-outline"}
                  size={36}
                  color={star <= selected ? "#FF6B9D" : "#C8C8D8"}
                />
              </TouchableOpacity>
            ))}
          </View>

          {selected > 0 && (
            <Text style={{ fontSize: 13, color: "#FF6B9D", fontWeight: "600", marginBottom: 16 }}>
              {LABELS[selected]}
            </Text>
          )}

          {/* 버튼 */}
          <View style={{ width: "100%", gap: 8 }}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={{
                height: 48, borderRadius: 24,
                backgroundColor: selected > 0 ? "#FF6B9D" : "#E5E7EB",
                alignItems: "center", justifyContent: "center",
              }}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{
                  color: selected > 0 ? "white" : "#9CA3AF",
                  fontSize: 15, fontWeight: "700",
                }}>
                  {selected > 0 ? "평가 완료" : "나중에 할게요"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={{ height: 36, alignItems: "center", justifyContent: "center" }}
              activeOpacity={0.7}
            >
              <Text style={{ color: "#9CA3AF", fontSize: 13 }}>건너뛰기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
