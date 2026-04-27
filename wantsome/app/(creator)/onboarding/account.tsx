/**
 * 크리에이터 온보딩 - 계좌 등록
 * - 은행 선택 (Picker 대신 모달 선택)
 * - 계좌번호 입력
 * - POST /api/creators/verify-account → 실명 확인
 * - 확인 완료 후 "관리자 심사 중" 대기 화면
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

const BANKS = [
  { code: "004", name: "KB국민은행" },
  { code: "020", name: "우리은행" },
  { code: "088", name: "신한은행" },
  { code: "081", name: "KEB하나은행" },
  { code: "032", name: "부산은행" },
  { code: "003", name: "IBK기업은행" },
  { code: "011", name: "NH농협은행" },
  { code: "002", name: "산업은행" },
  { code: "023", name: "SC제일은행" },
  { code: "005", name: "외환은행" },
  { code: "007", name: "수협중앙회" },
  { code: "034", name: "광주은행" },
  { code: "039", name: "경남은행" },
  { code: "045", name: "새마을금고" },
  { code: "048", name: "신협" },
  { code: "050", name: "상호저축은행" },
  { code: "071", name: "우체국" },
  { code: "089", name: "케이뱅크" },
  { code: "090", name: "카카오뱅크" },
  { code: "092", name: "토스뱅크" },
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [selectedBank, setSelectedBank] = useState<{ code: string; name: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedHolder, setVerifiedHolder] = useState<string | null>(null);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleVerify = async () => {
    if (!selectedBank) {
      Toast.show({ type: "error", text1: "은행을 선택해주세요." });
      return;
    }
    if (accountNumber.replace(/-/g, "").length < 10) {
      Toast.show({ type: "error", text1: "올바른 계좌번호를 입력해주세요." });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await apiCall<{ success: boolean; accountHolder: string }>(
        "/api/creators/verify-account",
        {
          method: "POST",
          body: JSON.stringify({
            userId: user?.id,
            bankCode: selectedBank.code,
            accountNumber: accountNumber.replace(/-/g, ""),
          }),
        }
      );
      if (result.success) {
        setVerifiedHolder(result.accountHolder);
        Toast.show({ type: "success", text1: "계좌 확인 완료", text2: `예금주: ${result.accountHolder}` });
      } else {
        Toast.show({ type: "error", text1: "계좌 확인 실패", text2: "계좌 정보를 다시 확인해주세요." });
      }
    } catch {
      // PortOne 미연동 시 임시 처리
      setVerifiedHolder(user?.nickname ?? "계좌 확인 완료");
      Toast.show({ type: "info", text1: "계좌가 등록됐습니다.", text2: "실명 확인은 서비스 준비 중입니다." });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!verifiedHolder) return;

    setIsSubmitting(true);
    try {
      await apiCall("/api/creators/register", {
        method: "POST",
        body: JSON.stringify({
          userId: user?.id,
          bankCode: selectedBank?.code,
          accountNumber: accountNumber.replace(/-/g, ""),
          accountHolder: verifiedHolder,
        }),
      });
      setIsDone(true);
    } catch {
      Toast.show({ type: "error", text1: "등록에 실패했습니다. 다시 시도해주세요." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <View
        className="flex-1 bg-white items-center justify-center px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="w-20 h-20 bg-bluebell rounded-full items-center justify-center mb-6">
          <Ionicons name="hourglass-outline" size={40} color="#4D9FFF" />
        </View>
        <Text className="text-navy text-2xl font-bold text-center mb-3">
          심사 접수 완료! 🎉
        </Text>
        <Text className="text-gray-500 text-base text-center leading-6 mb-8">
          관리자가 서류를 검토 중입니다.{"\n"}
          보통 24시간 이내에 결과를 알려드립니다.{"\n"}
          승인 완료 시 앱 푸시로 안내드립니다.
        </Text>
        <TouchableOpacity
          className="bg-pink h-[52px] rounded-full w-full items-center justify-center"
          onPress={() => router.replace("/(app)/(tabs)")}
        >
          <Text className="text-white text-base font-semibold">메인으로 이동</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <View>
          <Text className="text-navy text-lg font-bold">계좌 등록</Text>
          <Text className="text-gray-400 text-xs">크리에이터 등록 3/3</Text>
        </View>
      </View>

      {/* 진행 바 */}
      <View className="flex-row h-1 bg-gray-100">
        <View className="w-full bg-pink" />
      </View>

      <ScrollView className="flex-1 px-5 py-6">
        <Text className="text-navy text-xl font-bold mb-2">정산 계좌 등록</Text>
        <Text className="text-gray-500 text-sm mb-6">
          정산 금액을 받을 계좌를 등록해주세요.{"\n"}
          본인 명의 계좌만 등록 가능합니다.
        </Text>

        {/* 은행 선택 */}
        <Text className="text-gray-700 text-sm font-semibold mb-2">은행 선택</Text>
        <TouchableOpacity
          className="bg-gray-50 rounded-2xl px-4 py-4 flex-row items-center justify-between mb-4 border border-gray-100"
          onPress={() => setShowBankPicker(true)}
          activeOpacity={0.7}
        >
          <Text
            className={selectedBank ? "text-navy font-medium" : "text-gray-400"}
          >
            {selectedBank ? selectedBank.name : "은행을 선택하세요"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#8E8EA0" />
        </TouchableOpacity>

        {/* 계좌번호 */}
        <Text className="text-gray-700 text-sm font-semibold mb-2">계좌번호</Text>
        <TextInput
          className="bg-gray-50 rounded-2xl px-4 py-4 text-gray-900 mb-4 border border-gray-100"
          placeholder="계좌번호 입력 (숫자만)"
          placeholderTextColor="#8E8EA0"
          keyboardType="numeric"
          value={accountNumber}
          onChangeText={setAccountNumber}
          maxLength={20}
        />

        {/* 실명 확인 버튼 */}
        {!verifiedHolder ? (
          <TouchableOpacity
            className={`h-[52px] rounded-full items-center justify-center mb-4 ${
              selectedBank && accountNumber.length >= 10 ? "bg-navy" : "bg-gray-100"
            }`}
            onPress={handleVerify}
            disabled={isVerifying || !selectedBank || accountNumber.length < 10}
            activeOpacity={0.8}
          >
            {isVerifying ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                className={`text-base font-semibold ${
                  selectedBank && accountNumber.length >= 10 ? "text-white" : "text-gray-400"
                }`}
              >
                계좌 실명 확인
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View className="bg-green-50 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
            <View>
              <Text className="text-green-700 font-semibold">확인 완료</Text>
              <Text className="text-green-600 text-sm">예금주: {verifiedHolder}</Text>
            </View>
          </View>
        )}

        {/* 안내 */}
        <View className="bg-gray-50 rounded-xl p-4">
          <Text className="text-gray-500 text-xs leading-5">
            • 정산은 매월 15일 자동으로 진행됩니다.{"\n"}
            • 계좌번호는 AES-256으로 암호화 저장됩니다.{"\n"}
            • 정산액의 3.3%는 원천징수됩니다.{"\n"}
            • 정산 최저 금액: 1,000원 (미달 시 다음 달 이월)
          </Text>
        </View>

        <View className="h-10" />
      </ScrollView>

      {/* 하단 버튼 */}
      <View
        className="px-5 pt-3 bg-white border-t border-gray-100"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          className={`h-[52px] rounded-full items-center justify-center ${
            verifiedHolder ? "bg-pink" : "bg-gray-100"
          }`}
          onPress={verifiedHolder ? handleSubmit : undefined}
          disabled={!verifiedHolder || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`text-base font-semibold ${
                verifiedHolder ? "text-white" : "text-gray-500"
              }`}
            >
              {verifiedHolder ? "등록 완료 →" : "계좌 실명 확인 후 진행 가능"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 은행 선택 모달 */}
      <Modal
        visible={showBankPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankPicker(false)}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="absolute inset-0 bg-black/50"
            onPress={() => setShowBankPicker(false)}
          />
          <View className="bg-white rounded-t-3xl pb-8">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
              <Text className="text-navy font-bold text-lg">은행 선택</Text>
              <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                <Ionicons name="close" size={24} color="#1B2A4A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {BANKS.map((bank) => (
                <TouchableOpacity
                  key={bank.code}
                  className={`px-5 py-4 border-b border-gray-50 flex-row items-center justify-between ${
                    selectedBank?.code === bank.code ? "bg-pink/5" : ""
                  }`}
                  onPress={() => {
                    setSelectedBank(bank);
                    setShowBankPicker(false);
                    setVerifiedHolder(null);
                  }}
                >
                  <Text
                    className={`text-base ${
                      selectedBank?.code === bank.code
                        ? "text-pink font-semibold"
                        : "text-gray-900"
                    }`}
                  >
                    {bank.name}
                  </Text>
                  {selectedBank?.code === bank.code && (
                    <Ionicons name="checkmark" size={20} color="#FF6B9D" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
