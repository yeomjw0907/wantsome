/**
 * 연령 인증 화면
 * - 생년월일 입력 → 만 19세 이상만 서비스 이용 가능
 * - 통과 시 AsyncStorage "age_verified" = "true" 저장 → 로그인 화면으로
 * - 앱스토어 심사 필수 요건 (성인 콘텐츠 플랫폼)
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AgeCheckScreen() {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setError("");

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    if (!year || !month || !day || isNaN(y) || isNaN(m) || isNaN(d)) {
      setError("생년월일을 모두 입력해주세요.");
      return;
    }
    if (y < 1900 || y > 2020 || m < 1 || m > 12 || d < 1 || d > 31) {
      setError("올바른 생년월일을 입력해주세요.");
      return;
    }

    const birthDate = new Date(y, m - 1, d);
    const today = new Date();

    // 만 19세 계산
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    if (age < 19) {
      Alert.alert(
        "이용 불가",
        "원썸은 만 19세 이상만 이용할 수 있는 성인 서비스입니다.\n\n미성년자의 접근을 허용하지 않습니다.",
        [{ text: "확인" }]
      );
      return;
    }

    await AsyncStorage.setItem("age_verified", "true");
    router.replace("/(auth)/login");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-20 pb-10">
          {/* 아이콘 */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-pink/10 items-center justify-center mb-4">
              <Ionicons name="shield-checkmark" size={40} color="#F43F5E" />
            </View>
            <Text className="text-2xl font-bold text-navy text-center">
              연령 확인
            </Text>
            <Text className="text-gray-500 text-center mt-2 leading-6">
              원썸은 <Text className="font-semibold text-pink">만 19세 이상</Text>만{"\n"}
              이용할 수 있는 성인 서비스입니다.
            </Text>
          </View>

          {/* 생년월일 입력 */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-700 mb-3">
              생년월일을 입력해주세요
            </Text>
            <View className="flex-row gap-3">
              {/* 년도 */}
              <View className="flex-1">
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center text-lg font-semibold text-navy"
                  placeholder="년도"
                  placeholderTextColor="#C0C0C8"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={setYear}
                />
              </View>
              {/* 월 */}
              <View style={{ width: 72 }}>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center text-lg font-semibold text-navy"
                  placeholder="월"
                  placeholderTextColor="#C0C0C8"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={month}
                  onChangeText={setMonth}
                />
              </View>
              {/* 일 */}
              <View style={{ width: 72 }}>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center text-lg font-semibold text-navy"
                  placeholder="일"
                  placeholderTextColor="#C0C0C8"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={day}
                  onChangeText={setDay}
                />
              </View>
            </View>

            {error ? (
              <Text className="text-red text-sm mt-2 ml-1">{error}</Text>
            ) : null}
          </View>

          {/* 안내 문구 */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-8">
            <Text className="text-gray-500 text-sm leading-5">
              • 생년월일은 서버에 저장되지 않으며, 기기에만 보관됩니다.{"\n"}
              • 허위 입력 시 서비스 이용이 제한될 수 있습니다.{"\n"}
              • 만 19세 미만은 법적으로 이용이 불가합니다.
            </Text>
          </View>

          {/* 확인 버튼 */}
          <TouchableOpacity
            className="h-[56px] bg-pink rounded-full items-center justify-center"
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-bold">
              확인 및 계속하기
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
