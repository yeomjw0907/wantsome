import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function AccountScreen() {
  const router = useRouter();

  const handleComplete = async () => {
    await AsyncStorage.setItem("onboarding_completed", "true");
    router.replace("/(app)/(tabs)");
  };

  return (
    <View className="flex-1 bg-white px-6 pt-10">
      <Text className="text-navy text-xl font-bold">계좌 등록</Text>
      <Text className="text-gray-500 mt-2 mb-6">
        정산용 계좌를 등록해 주세요. (은행 선택 + 계좌번호 → API 연동 시 구현)
      </Text>
      <PrimaryButton label="완료 후 메인으로" onPress={handleComplete} />
    </View>
  );
}
