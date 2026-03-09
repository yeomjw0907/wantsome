import { View, ActivityIndicator } from "react-native";
import { useAppInit } from "@/hooks/useAppInit";

/**
 * 앱 진입점 — docs/context/05_app_init.md
 * useAppInit이 상태에 따라 자동으로 라우팅합니다.
 */
export default function Index() {
  useAppInit();

  // 초기화 중 로딩 스피너 (인라인 스타일로 NativeWind 미적용 시에도 보이게)
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#1B2A4A",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator size="large" color="#FF6B9D" />
    </View>
  );
}
