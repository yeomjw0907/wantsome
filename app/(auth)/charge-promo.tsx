import { View, Text } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePointStore } from "@/stores/usePointStore";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function ChargePromoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const firstChargeDeadline = usePointStore((s) => s.firstChargeDeadline);
  const isFirstCharged = usePointStore((s) => s.isFirstCharged);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (isFirstCharged || !firstChargeDeadline) {
      setRemaining(0);
      return;
    }
    const deadline = new Date(firstChargeDeadline).getTime();
    const tick = () => {
      const now = Date.now();
      setRemaining(Math.max(0, deadline - now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [firstChargeDeadline, isFirstCharged]);

  const showPromo = !isFirstCharged && (firstChargeDeadline ? remaining > 0 : true);

  const handleEnterMain = async () => {
    await AsyncStorage.setItem("onboarding_completed", "true");
    router.replace("/(app)/(tabs)");
  };

  return (
    <View className="flex-1 bg-white px-6" style={{ paddingTop: insets.top + 16 }}>
      <Text className="text-navy text-2xl font-bold mb-2">첫충전 100% 보너스</Text>
      <Text className="text-gray-500 mb-6">
        가입 후 첫 충전 시 보너스 포인트를 드려요
      </Text>

      {showPromo && firstChargeDeadline && (
        <View className="bg-bluebell rounded-2xl p-5 mb-6">
          <Text className="text-blue font-semibold mb-1">첫충전 2배 이벤트</Text>
          <Text className="text-gray-700 text-sm mb-2">남은 시간</Text>
          <Text className="text-navy text-2xl font-bold font-mono">
            {formatCountdown(remaining)}
          </Text>
        </View>
      )}

      <PrimaryButton label="메인으로" onPress={handleEnterMain} />

      <Text
        className="text-pink text-center mt-6 text-sm"
        onPress={() => router.push("/(app)/charge")}
      >
        지금 충전하기
      </Text>
    </View>
  );
}
