import { View, Text } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface VerifyResponse {
  success: boolean;
  is_adult: boolean;
  verified_name: string;
}

export default function VerifyScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!user?.id) {
      Toast.show({ type: "error", text1: "로그인이 필요합니다." });
      return;
    }
    setLoading(true);
    try {
      // PortOne 본인인증은 Development Build + WebView에서 실행
      // API 연동: identityVerificationId는 PortOne SDK 완료 후 콜백으로 전달
      Toast.show({
        type: "info",
        text1: "본인인증",
        text2: "실기기 Development Build에서 PortOne 웹뷰가 열립니다.",
      });
      // 테스트용: API 호출 스킵하고 다음 단계로
      updateUser({ is_verified: true });
      router.replace("/(auth)/role");
    } catch {
      Toast.show({ type: "error", text1: "인증 처리에 실패했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSuccess = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await apiCall<VerifyResponse>("/api/auth/verify-identity", {
        method: "POST",
        body: JSON.stringify({
          identityVerificationId: "test-portone-id",
          userId: user.id,
        }),
      });
      if ((res as { error?: string }).error === "UNDERAGE") {
        router.replace("/underage");
        return;
      }
      if ((res as { error?: string }).error === "BANNED") {
        Toast.show({ type: "error", text1: "이용이 제한된 계정입니다." });
        return;
      }
      updateUser({ is_verified: true });
      router.replace("/(auth)/role");
    } catch {
      updateUser({ is_verified: true });
      router.replace("/(auth)/role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-navy text-2xl font-bold text-center mb-2">
        본인인증
      </Text>
      <Text className="text-gray-500 text-center mb-8">
        만 18세 이상만 이용 가능합니다.{"\n"}PASS 본인인증으로 확인해 주세요.
      </Text>

      <PrimaryButton
        label="본인인증 하기"
        onPress={handleVerify}
        isLoading={loading}
      />

      <Text
        className="text-gray-500 text-center mt-6 text-sm"
        onPress={handleTestSuccess}
      >
        [테스트] 인증 완료 후 다음
      </Text>
    </View>
  );
}
