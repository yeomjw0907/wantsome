import { View, Text, TouchableOpacity, BackHandler, Platform } from "react-native";
import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { useRouter } from "expo-router";

interface SystemStatus {
  maintenance_mode: string;
  maintenance_message: string;
  maintenance_eta: string;
}

export default function MaintenanceScreen() {
  const router = useRouter();
  const [message, setMessage] = useState("서비스 점검 중입니다.");
  const [eta, setEta] = useState("");
  const [checking, setChecking] = useState(false);

  // 뒤로가기 차단
  useEffect(() => {
    if (Platform.OS === "android") {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => handler.remove();
    }
  }, []);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      const res = await apiCall<SystemStatus>("/api/system/status");
      if (res.maintenance_mode !== "true") {
        router.replace("/");
      } else {
        setMessage(res.maintenance_message);
        setEta(res.maintenance_eta);
      }
    } catch {
      // 재시도
    } finally {
      setChecking(false);
    }
  };

  return (
    <View className="flex-1 bg-navy items-center justify-center px-6">
      <Text className="text-4xl mb-4">🔧</Text>
      <Text className="text-white text-2xl font-bold mb-3">서비스 점검 중</Text>
      <Text className="text-white/70 text-center text-sm mb-2">{message}</Text>
      {!!eta && (
        <Text className="text-white/50 text-xs mb-8">완료 예정: {eta}</Text>
      )}
      <TouchableOpacity
        onPress={handleRefresh}
        disabled={checking}
        className="bg-pink h-[48px] rounded-full px-8 items-center justify-center mt-6"
        style={{ opacity: checking ? 0.5 : 1 }}
      >
        <Text className="text-white font-semibold">
          {checking ? "확인 중..." : "새로고침"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
