import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";

type Role = "consumer" | "creator" | "both";

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "consumer", label: "소비자", desc: "크리에이터와 영상통화를 즐기기" },
  { value: "creator", label: "크리에이터", desc: "영상통화로 수익 창출하기" },
  { value: "both", label: "둘 다", desc: "소비·제작 모두 하기" },
];

export default function RoleScreen() {
  const router = useRouter();
  const updateUser = useAuthStore((s) => s.updateUser);

  const select = (role: Role) => {
    updateUser({ role });
    if (role === "creator") {
      router.replace("/(creator)/onboarding/contract");
    } else {
      router.replace("/(auth)/mode");
    }
  };

  return (
    <View className="flex-1 bg-white px-6 pt-10">
      <Text className="text-navy text-2xl font-bold mb-2">역할을 선택해 주세요</Text>
      <Text className="text-gray-500 mb-8">나중에 설정에서 변경할 수 있어요</Text>

      {ROLES.map(({ value, label, desc }) => (
        <TouchableOpacity
          key={value}
          onPress={() => select(value)}
          className="border border-gray-200 rounded-2xl p-5 mb-3 active:opacity-80"
        >
          <Text className="text-navy text-lg font-semibold">{label}</Text>
          <Text className="text-gray-500 text-sm mt-1">{desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
