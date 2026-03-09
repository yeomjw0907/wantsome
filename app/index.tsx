import { View, ActivityIndicator } from "react-native";
import { useAppInit } from "@/hooks/useAppInit";

/**
 * 앱 진입점 — docs/context/05_app_init.md
 * useAppInit이 상태에 따라 자동으로 라우팅합니다.
 */
export default function Index() {
  const { status } = useAppInit();

  // 초기화 중에는 로딩 스피너
  return (
    <View className="flex-1 bg-navy items-center justify-center">
      <ActivityIndicator size="large" color="#FF6B9D" />
    </View>
  );
}
