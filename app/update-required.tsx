import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  BackHandler,
  Platform,
} from "react-native";
import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api";

interface SystemStatus {
  force_update_message: string;
}

export default function UpdateRequiredScreen() {
  const [message, setMessage] = useState(
    "새 버전이 출시됐습니다. 업데이트 후 이용해주세요."
  );

  useEffect(() => {
    apiCall<SystemStatus>("/api/system/status")
      .then((res) => {
        if (res.force_update_message) setMessage(res.force_update_message);
      })
      .catch(() => {});
  }, []);

  // 뒤로가기 차단
  useEffect(() => {
    if (Platform.OS === "android") {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => handler.remove();
    }
  }, []);

  const handleUpdate = () => {
    const url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/app/wantsome"
        : "https://play.google.com/store/apps/details?id=kr.wantsome.app";
    Linking.openURL(url);
  };

  return (
    <View className="flex-1 bg-navy items-center justify-center px-6">
      <Text className="text-4xl mb-4">⬆️</Text>
      <Text className="text-white text-2xl font-bold mb-3">업데이트가 필요합니다</Text>
      <Text className="text-white/70 text-center text-sm mb-8">{message}</Text>
      <TouchableOpacity
        onPress={handleUpdate}
        className="bg-pink h-[48px] rounded-full px-8 items-center justify-center"
      >
        <Text className="text-white font-semibold">지금 업데이트</Text>
      </TouchableOpacity>
    </View>
  );
}
