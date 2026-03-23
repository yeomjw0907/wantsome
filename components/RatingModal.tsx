/**
 * 통화 종료 후 평가 모달
 * - 4개 카테고리(호감/신뢰/매너/매력) 별점
 * - direction: "creator" (유저→크리에이터) | "user" (크리에이터→유저)
 * - 1개 이상 카테고리 선택 시 제출 가능, 전부 미선택 시 건너뛰기
 */
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";

const CATEGORIES = ["호감", "신뢰", "매너", "매력"] as const;
type Category = (typeof CATEGORIES)[number];

interface Props {
  visible: boolean;
  callSessionId: string;
  targetId: string;
  targetName: string;
  targetAvatar: string | null;
  direction: "creator" | "user";
  onClose: () => void;
}

export default function RatingModal({
  visible,
  callSessionId,
  targetId,
  targetName,
  targetAvatar,
  direction,
  onClose,
}: Props) {
  const [ratings, setRatings] = useState<Record<Category, number>>({
    호감: 0, 신뢰: 0, 매너: 0, 매력: 0,
  });
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const hasAny = CATEGORIES.some((c) => ratings[c] > 0);

  const setStar = (cat: Category, star: number) => {
    setRatings((prev) => ({ ...prev, [cat]: star }));
  };

  const handleSubmit = async () => {
    if (!hasAny) { onClose(); return; }
    setLoading(true);
    try {
      const endpoint = direction === "creator" ? "/api/ratings" : "/api/ratings/user";
      const targetKey = direction === "creator" ? "creator_id" : "consumer_id";
      await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify({
          call_session_id: callSessionId,
          [targetKey]: targetId,
          rating_호감: ratings.호감 || undefined,
          rating_신뢰: ratings.신뢰 || undefined,
          rating_매너: ratings.매너 || undefined,
          rating_매력: ratings.매력 || undefined,
          ...(direction === "creator" && comment.trim() ? { comment: comment.trim() } : {}),
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

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{
          flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <View style={{
            backgroundColor: "white", borderRadius: 24, padding: 24,
            width: "100%", maxWidth: 340,
          }}>
            {/* 아바타 */}
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: "#D1E4F8", overflow: "hidden", marginBottom: 8,
              }}>
                {targetAvatar ? (
                  <Image source={{ uri: targetAvatar }} style={{ width: 60, height: 60 }} />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person" size={28} color="#4D9FFF" />
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#1B2A4A" }}>
                통화는 어떠셨나요?
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                {targetName}님과의 통화를 평가해주세요
              </Text>
            </View>

            {/* 카테고리별 별점 */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
              {CATEGORIES.map((cat) => (
                <View key={cat} style={{
                  flexDirection: "row", alignItems: "center",
                  justifyContent: "space-between", paddingVertical: 6,
                }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B2A4A", width: 36 }}>
                    {cat}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setStar(cat, star)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={star <= ratings[cat] ? "star" : "star-outline"}
                          size={28}
                          color={star <= ratings[cat] ? "#F59E0B" : "#D1D5DB"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ fontSize: 12, color: "#9CA3AF", width: 20, textAlign: "right" }}>
                    {ratings[cat] > 0 ? ratings[cat] : ""}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* 한줄 리뷰 (유저→크리에이터 방향만) */}
            {direction === "creator" && hasAny && (
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="한줄 리뷰를 남겨주세요 (선택)"
                placeholderTextColor="#C8C8D8"
                maxLength={100}
                style={{
                  marginTop: 12,
                  height: 40,
                  borderWidth: 1.5,
                  borderColor: "#E5E7EB",
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  fontSize: 13,
                  color: "#1B2A4A",
                }}
              />
            )}

            {/* 버튼 */}
            <View style={{ marginTop: 16, gap: 8 }}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={{
                  height: 48, borderRadius: 24,
                  backgroundColor: hasAny ? "#FF6B9D" : "#E5E7EB",
                  alignItems: "center", justifyContent: "center",
                }}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{
                    color: hasAny ? "white" : "#9CA3AF",
                    fontSize: 15, fontWeight: "700",
                  }}>
                    {hasAny ? "평가 완료" : "나중에 할게요"}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
