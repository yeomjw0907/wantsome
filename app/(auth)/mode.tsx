import { View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function ModeScreen() {
  const router = useRouter();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [blue, setBlue] = useState(true);
  const [red, setRed] = useState(false);
  const [showRedAgree, setShowRedAgree] = useState(false);
  const [redAgreed, setRedAgreed] = useState(false);

  const handleNext = () => {
    if (red && !redAgreed) {
      setShowRedAgree(true);
      return;
    }
    updateUser({ blue_mode: blue, red_mode: red });
    router.replace("/(auth)/profile");
  };

  const confirmRedAgree = () => {
    setRedAgreed(true);
    setShowRedAgree(false);
  };

  return (
    <View className="flex-1 bg-white px-6 pt-10">
      <Text className="text-navy text-2xl font-bold mb-2">이용 모드를 선택해 주세요</Text>
      <Text className="text-gray-500 mb-8">파란불(일반) / 빨간불(성인) 중 이용할 모드를 선택할 수 있어요</Text>

      <TouchableOpacity
        onPress={() => setBlue(!blue)}
        className={`flex-row items-center p-4 rounded-2xl mb-3 border-2 ${
          blue ? "border-blue bg-bluebell" : "border-gray-200 bg-gray-50"
        }`}
      >
        <View className={`w-5 h-5 rounded-full border-2 mr-3 ${blue ? "bg-blue border-blue" : "border-gray-300"}`} />
        <View>
          <Text className="text-gray-900 font-semibold">파란불 (일반)</Text>
          <Text className="text-gray-500 text-sm">900P/분 · 일반 콘텐츠</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setRed(!red)}
        className={`flex-row items-center p-4 rounded-2xl mb-8 border-2 ${
          red ? "border-red bg-red-light" : "border-gray-200 bg-gray-50"
        }`}
      >
        <View className={`w-5 h-5 rounded-full border-2 mr-3 ${red ? "bg-red border-red" : "border-gray-300"}`} />
        <View>
          <Text className="text-gray-900 font-semibold">빨간불 (성인)</Text>
          <Text className="text-gray-500 text-sm">1,300P/분 · 성인 콘텐츠 (만 19세+)</Text>
        </View>
      </TouchableOpacity>

      <PrimaryButton label="다음" onPress={handleNext} />

      {showRedAgree && (
        <View className="absolute inset-0 bg-navy/80 justify-center px-6">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-navy text-lg font-bold mb-2">성인 서비스 이용약관</Text>
            <Text className="text-gray-600 text-sm mb-4">
              만 19세 이상 성인만 이용 가능합니다. 성인 콘텐츠 이용에 자발적으로 동의합니다.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowRedAgree(false)}
                className="flex-1 bg-gray-100 h-12 rounded-full items-center justify-center"
              >
                <Text className="text-gray-900 font-semibold">취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmRedAgree}
                className="flex-1 bg-pink h-12 rounded-full items-center justify-center"
              >
                <Text className="text-white font-semibold">동의하고 활성화</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
