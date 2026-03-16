import {
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
} from "react-native";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";

export default function UnderageScreen() {
  // 뒤로가기 완전 차단
  useEffect(() => {
    if (Platform.OS === "android") {
      const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => handler.remove();
    }
  }, []);

  const handleExit = () => {
    if (Platform.OS === "android") BackHandler.exitApp();
  };

  return (
    <View className="flex-1 bg-navy items-center justify-center px-6">
      <Ionicons name="lock-closed-outline" size={52} color="rgba(255,255,255,0.7)" style={{ marginBottom: 16 }} />
      <Text className="text-white text-2xl font-bold mb-3">
        이용하실 수 없습니다
      </Text>
      <Text className="text-white/70 text-center text-sm mb-8">
        wantsome은 만 19세 이상만{"\n"}이용 가능한 서비스입니다.{"\n\n"}
        본인인증 결과 미성년자로 확인되어{"\n"}서비스 이용이 제한됩니다.
      </Text>
      {Platform.OS === "android" && (
        <TouchableOpacity
          onPress={handleExit}
          className="bg-white/10 h-[48px] rounded-full px-8 items-center justify-center"
        >
          <Text className="text-white/80 font-semibold">앱 종료</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
