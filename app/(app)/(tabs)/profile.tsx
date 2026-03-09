import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";
import { PointBadge } from "@/components/ui/PointBadge";

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { points } = usePointStore();

  return (
    <View
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top, paddingHorizontal: 16 }}
    >
      <Text className="text-navy text-xl font-bold mt-4">내 프로필</Text>
      <View className="mt-4 bg-white rounded-2xl p-4 flex-row items-center justify-between">
        <Text className="text-gray-500">보유 포인트</Text>
        <PointBadge points={points} />
      </View>
      <TouchableOpacity
        onPress={() => router.push("/charge")}
        className="mt-3 bg-white rounded-2xl p-4 flex-row items-center justify-between"
        activeOpacity={0.85}
      >
        <Text className="text-navy font-semibold">포인트 충전</Text>
        <Text className="text-gray-400">→</Text>
      </TouchableOpacity>
      {user && (
        <View className="mt-4 bg-white rounded-2xl p-4">
          <Text className="text-gray-500 text-sm">닉네임</Text>
          <Text className="text-navy font-semibold mt-1">{user.nickname}</Text>
        </View>
      )}
    </View>
  );
}
