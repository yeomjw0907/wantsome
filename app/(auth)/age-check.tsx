/**
 * 연령 인증 화면
 * - 생년월일 입력 → 서버 검증 + users.birth_date 저장 → 만 19세 이상만 통과
 * - 1차 게이트 (self-attest). 2차는 PortOne 본인인증
 * - 앱스토어/Play 심사 시 연령 정책 명시
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
import { SERVICE_NAME } from "@/constants/branding";
import { apiCall } from "@/lib/api";

export default function AgeCheckScreen() {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

    const birthDateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    setSubmitting(true);
    try {
      // 서버 검증 + users.birth_date 저장 (정통망법/청소년보호법 게이트)
      await apiCall("/api/auth/age-verify", {
        method: "POST",
        body: JSON.stringify({ birth_date: birthDateStr }),
      });

      await AsyncStorage.setItem("age_verified", "true");
      router.replace("/(auth)/terms");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("UNDERAGE")) {
        Alert.alert(
          "이용 불가",
          `${SERVICE_NAME}은(는) 만 19세 이상만 가입·이용할 수 있습니다.\n\n미성년자는 이용할 수 없습니다.`,
          [{ text: "확인" }],
        );
      } else if (msg.includes("BIRTH_DATE_LOCKED")) {
        Alert.alert(
          "확인 필요",
          "이미 등록된 생년월일과 다릅니다. 변경하려면 본인인증을 진행해주세요.",
          [{ text: "확인" }],
        );
      } else {
        setError("연령 인증 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
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
              {SERVICE_NAME}은(는) <Text className="font-semibold text-pink">만 19세 이상</Text>만{"\n"}
              가입·이용할 수 있는 서비스입니다.
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
              • 생년월일은 청소년보호법에 따라 안전하게 보관됩니다.{"\n"}
              • 허위 입력 시 서비스 이용이 제한되며, 본인인증 단계에서 추가 검증됩니다.{"\n"}
              • 만 19세 미만은 법적으로 이용이 불가합니다.
            </Text>
          </View>

          {/* 확인 버튼 */}
          <TouchableOpacity
            className="h-[56px] bg-pink rounded-full items-center justify-center"
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={submitting}
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            <Text className="text-white text-base font-bold">
              {submitting ? "확인 중..." : "확인 및 계속하기"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
