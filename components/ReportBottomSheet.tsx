/**
 * 신고 바텀시트
 * - 통화 중 / 통화 후 요약 / 크리에이터 프로필에서 공통 사용
 * - 6개 카테고리 라디오 선택
 * - 기타 설명 텍스트 입력 (선택)
 * - POST /api/reports
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export type ReportCategory =
  | "UNDERAGE"
  | "ILLEGAL_RECORD"
  | "PROSTITUTION"
  | "HARASSMENT"
  | "FRAUD"
  | "OTHER";

interface ReportOption {
  category: ReportCategory;
  label: string;
  emoji: string;
  severity: "critical" | "high" | "normal";
}

const REPORT_OPTIONS: ReportOption[] = [
  { category: "UNDERAGE", label: "미성년자 의심", emoji: "🚨", severity: "critical" },
  { category: "ILLEGAL_RECORD", label: "불법 촬영 의심", emoji: "🎥", severity: "critical" },
  { category: "PROSTITUTION", label: "성매매 유도", emoji: "🚫", severity: "critical" },
  { category: "HARASSMENT", label: "언어/성적 괴롭힘", emoji: "⚠️", severity: "high" },
  { category: "FRAUD", label: "사기", emoji: "💸", severity: "high" },
  { category: "OTHER", label: "기타", emoji: "📝", severity: "normal" },
];

interface Props {
  visible: boolean;
  targetId: string;
  callSessionId?: string;
  onClose: () => void;
}

export default function ReportBottomSheet({
  visible,
  targetId,
  callSessionId,
  onClose,
}: Props) {
  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setSelected(null);
      setDescription("");
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!selected) {
      Toast.show({ type: "error", text1: "신고 유형을 선택해주세요." });
      return;
    }

    setIsLoading(true);
    try {
      await apiCall("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          target_id: targetId,
          call_session_id: callSessionId ?? null,
          category: selected,
          description: description.trim() || null,
        }),
      });
      Toast.show({
        type: "success",
        text1: "신고가 접수됐습니다",
        text2: "검토 후 조치하겠습니다.",
      });
      onClose();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "신고 실패",
        text2: "잠시 후 다시 시도해주세요.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: ReportOption["severity"]) => {
    if (severity === "critical") return "#FF5C7A";
    if (severity === "high") return "#FF9800";
    return "#8E8EA0";
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* 배경 오버레이 */}
        <Animated.View
          className="absolute inset-0 bg-black/60"
          style={{ opacity: backdropAnim }}
        >
          <TouchableOpacity className="flex-1" onPress={onClose} />
        </Animated.View>

        {/* 바텀시트 */}
        <Animated.View
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
          style={{
            transform: [{ translateY: slideAnim }],
            paddingBottom: Platform.OS === "ios" ? 34 : 24,
          }}
        >
          {/* 핸들 바 */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-gray-300" />
          </View>

          {/* 헤더 */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <Text className="text-navy text-lg font-bold">신고하기</Text>
            <TouchableOpacity
              className="w-8 h-8 items-center justify-center rounded-full bg-gray-100"
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 신고 카테고리 */}
            <View className="px-5 pt-4 gap-3">
              {REPORT_OPTIONS.map((option) => {
                const isSelected = selected === option.category;
                return (
                  <TouchableOpacity
                    key={option.category}
                    onPress={() => setSelected(option.category)}
                    className={`flex-row items-center px-4 py-3.5 rounded-2xl border-[1.5px] ${
                      isSelected
                        ? "border-pink bg-pink/5"
                        : "border-gray-100 bg-gray-50"
                    }`}
                    activeOpacity={0.7}
                  >
                    {/* 라디오 버튼 */}
                    <View
                      className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${
                        isSelected ? "border-pink" : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <View className="w-2.5 h-2.5 rounded-full bg-pink" />
                      )}
                    </View>

                    <Text className="text-base mr-2">{option.emoji}</Text>

                    <View className="flex-1">
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? "text-navy" : "text-gray-900"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </View>

                    {option.severity === "critical" && (
                      <View className="bg-red-50 rounded-full px-2 py-0.5">
                        <Text className="text-red text-xs font-bold">즉시 처리</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 설명 입력 */}
            <View className="px-5 pt-4">
              <Text className="text-gray-500 text-sm mb-2">
                추가 설명 (선택)
              </Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900 text-sm"
                placeholder="신고 내용을 자세히 적어주세요"
                placeholderTextColor="#8E8EA0"
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
                maxLength={200}
                textAlignVertical="top"
                style={{ minHeight: 80 }}
              />
              <Text className="text-gray-300 text-xs text-right mt-1">
                {description.length}/200
              </Text>
            </View>

            {/* 신고 버튼 */}
            <View className="px-5 pt-4 pb-2">
              <TouchableOpacity
                className={`h-[52px] rounded-full items-center justify-center ${
                  selected ? "bg-pink" : "bg-gray-100"
                }`}
                onPress={handleSubmit}
                disabled={!selected || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={selected ? "white" : "#8E8EA0"} />
                ) : (
                  <Text
                    className={`text-base font-semibold ${
                      selected ? "text-white" : "text-gray-500"
                    }`}
                  >
                    신고하기
                  </Text>
                )}
              </TouchableOpacity>

              <Text className="text-gray-400 text-xs text-center mt-3">
                허위 신고 시 서비스 이용이 제한될 수 있습니다.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
