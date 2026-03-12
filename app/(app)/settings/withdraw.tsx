/**
 * 회원 탈퇴 화면
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";

const WITHDRAW_WARNINGS = [
  "보유한 포인트가 모두 소멸됩니다.",
  "예약된 통화가 있으면 자동으로 취소됩니다.",
  "탈퇴 후 같은 계정으로 재가입이 제한될 수 있습니다.",
  "소비자의 통화 기록 및 결제 내역은 관련 법령에 따라 일정 기간 보관됩니다.",
  "크리에이터의 미정산 수익은 탈퇴 후 지급이 어려울 수 있습니다.",
];

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { points } = usePointStore();

  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const isConfirmed = nickname === user?.nickname && agreed;

  const handleWithdraw = () => {
    Alert.alert(
      "정말 탈퇴하시겠습니까?",
      "탈퇴 후에는 복구가 불가능합니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "탈퇴",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await apiCall("/api/users/me", { method: "DELETE" });
              await logout();
              Toast.show({ type: "success", text1: "탈퇴가 완료됐습니다." });
              router.replace("/(auth)/login" as never);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "탈퇴에 실패했습니다.";
              Toast.show({ type: "error", text1: msg });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold">회원 탈퇴</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 경고 헤더 */}
        <View className="bg-red/10 rounded-2xl p-4 mb-6 flex-row gap-3">
          <Ionicons name="warning" size={22} color="#FF5C7A" />
          <View className="flex-1">
            <Text className="text-red font-bold text-base mb-1">탈퇴 전 확인해주세요</Text>
            <Text className="text-red/70 text-sm">탈퇴 후 계정 정보를 복구할 수 없습니다.</Text>
          </View>
        </View>

        {/* 포인트 잔액 경고 */}
        {points > 0 && (
          <View className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
            <Text className="text-yellow-800 font-semibold text-sm mb-1">
              💰 보유 포인트: {points.toLocaleString()}P
            </Text>
            <Text className="text-yellow-700 text-xs">
              탈퇴 시 모든 포인트가 소멸됩니다. 포인트는 환불되지 않습니다.
            </Text>
          </View>
        )}

        {/* 탈퇴 안내 사항 */}
        <View className="bg-white rounded-2xl p-4 mb-6">
          <Text className="text-navy font-bold text-sm mb-3">탈퇴 시 처리 사항</Text>
          {WITHDRAW_WARNINGS.map((warning, idx) => (
            <View key={idx} className="flex-row gap-2 mb-2">
              <Text className="text-gray-400 text-sm">•</Text>
              <Text className="text-gray-600 text-sm flex-1">{warning}</Text>
            </View>
          ))}
        </View>

        {/* 동의 체크박스 */}
        <TouchableOpacity
          className="flex-row items-center gap-3 mb-6 p-4 bg-white rounded-2xl"
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.7}
        >
          <View
            className={`w-6 h-6 rounded-md border-2 items-center justify-center ${
              agreed ? "bg-pink border-pink" : "bg-white border-gray-200"
            }`}
          >
            {agreed && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
          <Text className="text-gray-700 text-sm flex-1">
            위 내용을 모두 확인했으며, 탈퇴에 동의합니다.
          </Text>
        </TouchableOpacity>

        {/* 닉네임 확인 입력 */}
        <View className="bg-white rounded-2xl p-4 mb-8">
          <Text className="text-navy font-semibold text-sm mb-2">
            탈퇴를 확인하려면 닉네임을 입력해주세요
          </Text>
          <Text className="text-gray-400 text-xs mb-3">
            현재 닉네임: <Text className="font-semibold text-gray-600">{user?.nickname}</Text>
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-navy text-sm"
            placeholder="닉네임 입력"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* 탈퇴 버튼 */}
        <TouchableOpacity
          className={`h-[52px] rounded-full items-center justify-center ${
            isConfirmed ? "bg-red" : "bg-gray-100"
          }`}
          onPress={isConfirmed ? handleWithdraw : undefined}
          disabled={isLoading || !isConfirmed}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`text-base font-semibold ${
                isConfirmed ? "text-white" : "text-gray-400"
              }`}
            >
              {isConfirmed ? "회원 탈퇴" : "닉네임을 입력하고 동의해주세요"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}
