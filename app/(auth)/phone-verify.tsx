/**
 * 전화번호 OTP 인증 화면
 * - Supabase verifyOtp로 인증 완료
 * - 완료 후 /api/auth/phone-login 호출 → users 테이블 upsert
 * - 신규 유저: 첫충전 데드라인 세팅 → age-check or terms 플로우
 */
import { useState, useRef, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";
import Toast from "react-native-toast-message";

interface PhoneLoginResponse {
  user: {
    id: string;
    nickname: string;
    profile_img: string | null;
    role: "consumer" | "creator" | "both";
    is_verified: boolean;
    blue_mode: boolean;
    red_mode: boolean;
    suspended_until: string | null;
  };
  is_new: boolean;
  points: number;
  first_charge_deadline: string | null;
  is_first_charged: boolean;
  access_token: string;
}

const RESEND_COOLDOWN = 60;

export default function PhoneVerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const setUser = useAuthStore((s) => s.setUser);
  const { setPoints, setFirstChargeInfo } = usePointStore();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (otp.length < 6) {
      Toast.show({ type: "error", text1: "6자리 인증번호를 입력해주세요." });
      return;
    }
    if (!phone) {
      Toast.show({ type: "error", text1: "전화번호 정보가 없습니다. 다시 시도해주세요." });
      router.back();
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });

      if (error || !data.session) {
        Toast.show({ type: "error", text1: error?.message ?? "인증에 실패했습니다." });
        return;
      }

      const accessToken = data.session.access_token;

      // users 테이블 upsert + 유저 정보 조회
      try {
        const res = await apiCall<PhoneLoginResponse>("/api/auth/phone-login", {
          method: "POST",
          body: JSON.stringify({ token: accessToken, phone }),
        });

        setUser(res.user);
        setPoints(res.points);
        setFirstChargeInfo(res.first_charge_deadline, res.is_first_charged);

        if (res.is_new) {
          const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
          setFirstChargeInfo(deadline, false);
        }
      } catch {
        // API 서버 미준비 시 세션만으로 진행
        setUser({
          id: data.session.user.id,
          nickname: phone ?? "유저",
          profile_img: null,
          role: "consumer",
          is_verified: false,
          blue_mode: true,
          red_mode: false,
          suspended_until: null,
        });
      }

      Toast.show({ type: "success", text1: "로그인되었습니다." });
      router.replace("/(auth)/terms");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !phone) return;
    setResendCooldown(RESEND_COOLDOWN);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { channel: "sms" },
      });
      if (error) {
        Toast.show({ type: "error", text1: error.message });
      } else {
        Toast.show({ type: "success", text1: "인증번호가 재발송되었습니다." });
      }
    } catch {
      Toast.show({ type: "error", text1: "재발송에 실패했습니다." });
    }
  };

  const displayPhone = phone
    ? phone.replace("+82", "0").replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")
    : "";

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
          <Text className="text-navy text-2xl font-bold mb-2">인증번호 입력</Text>
          <Text className="text-gray-500 mb-10 leading-6">
            <Text className="font-semibold text-navy">{displayPhone}</Text>
            {"\n"}으로 발송된 6자리 인증번호를 입력해주세요.
          </Text>

          {/* OTP 입력 */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">인증번호</Text>
            <TextInput
              ref={inputRef}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-navy text-xl font-bold text-center tracking-widest"
              placeholder="000000"
              placeholderTextColor="#C0C0C8"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, ""))}
              returnKeyType="done"
              onSubmitEditing={handleVerify}
              autoFocus
            />
          </View>

          {/* 재발송 */}
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0}
            className="mb-8 self-center"
          >
            <Text
              className="text-sm"
              style={{ color: resendCooldown > 0 ? "#9CA3AF" : "#F43F5E" }}
            >
              {resendCooldown > 0
                ? `${resendCooldown}초 후 재발송 가능`
                : "인증번호 재발송"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="h-[56px] bg-pink rounded-full items-center justify-center"
            onPress={handleVerify}
            disabled={loading || otp.length < 6}
            activeOpacity={0.85}
            style={{ opacity: loading || otp.length < 6 ? 0.6 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">확인</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
