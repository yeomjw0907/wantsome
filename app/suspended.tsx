import {
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
  Linking,
} from "react-native";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiCall } from "@/lib/api";

interface SystemStatus {
  cs_url: string;
}

export default function SuspendedScreen() {
  const user = useAuthStore((s) => s.user);

  const isBanned =
    user?.suspended_until?.startsWith("9999") ?? false;

  const banDate = user?.suspended_until
    ? new Date(user.suspended_until).toLocaleDateString("ko-KR")
    : "";

  // 뒤로가기 차단
  useEffect(() => {
    if (Platform.OS === "android") {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => handler.remove();
    }
  }, []);

  const handleCs = async () => {
    try {
      const res = await apiCall<SystemStatus>("/api/system/status");
      if (res.cs_url) await Linking.openURL(res.cs_url);
    } catch {
      // 무시
    }
  };

  return (
    <View className="flex-1 bg-navy items-center justify-center px-6">
      <Text className="text-4xl mb-4">🚫</Text>
      <Text className="text-white text-2xl font-bold mb-3">
        이용이 제한되었습니다
      </Text>
      <Text className="text-white/70 text-center text-sm mb-8">
        {isBanned
          ? "계정이 영구 정지되었습니다."
          : `계정이 ${banDate}까지 정지되었습니다.`}
      </Text>
      <TouchableOpacity
        onPress={handleCs}
        className="border border-white/40 h-[48px] rounded-full px-8 items-center justify-center"
      >
        <Text className="text-white/80 font-semibold">고객센터 문의</Text>
      </TouchableOpacity>
    </View>
  );
}
