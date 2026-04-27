/**
 * 전화번호 로그인 화면
 * - 전화번호 입력 → Supabase SMS OTP 발송
 * - 한국 번호 자동 포맷: 010-XXXX-XXXX → +82 10XXXXXXXX
 */
import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import Toast from "react-native-toast-message";

function formatKoreanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function toE164(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `+82${digits.slice(1)}`;
  }
  return `+${digits}`;
}

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 11);
    setPhone(formatKoreanPhone(digits));
  };

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      Toast.show({ type: "error", text1: "올바른 전화번호를 입력해주세요." });
      return;
    }

    setLoading(true);
    try {
      const e164 = toE164(phone);
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { channel: "sms" },
      });

      if (error) {
        Toast.show({ type: "error", text1: error.message });
        return;
      }

      Toast.show({ type: "success", text1: "인증번호가 발송되었습니다." });
      router.push({
        pathname: "/(auth)/phone-verify",
        params: { phone: e164 },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setLoading(false);
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
        <View className="flex-1 px-6 pt-16 pb-10">
          {/* 뒤로가기 */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2 mb-8"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
          </TouchableOpacity>

          {/* 헤더 */}
          <Text className="text-navy text-2xl font-bold mb-2">전화번호로 로그인</Text>
          <Text className="text-gray-500 mb-10 leading-6">
            전화번호로 인증번호를 받아 로그인하세요.{"\n"}
            소셜 계정과 동일한 계정으로 연동됩니다.
          </Text>

          {/* 전화번호 입력 */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">전화번호</Text>
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4">
              <Text className="text-navy font-semibold mr-2">🇰🇷 +82</Text>
              <TextInput
                className="flex-1 py-4 text-navy text-base font-semibold"
                placeholder="010-0000-0000"
                placeholderTextColor="#C0C0C8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={handlePhoneChange}
                maxLength={13}
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>
          </View>

          {/* 안내 */}
          <View className="bg-blue/10 rounded-2xl p-4 mb-8">
            <Text className="text-gray-600 text-sm leading-5">
              • SMS 인증 발송 시 문자 요금이 부과될 수 있습니다.{"\n"}
              • 인증번호는 5분간 유효합니다.{"\n"}
              • 문제가 있으면 소셜 로그인을 이용해주세요.
            </Text>
          </View>

          <TouchableOpacity
            className="h-[56px] bg-pink rounded-full items-center justify-center"
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.85}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">인증번호 받기</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
