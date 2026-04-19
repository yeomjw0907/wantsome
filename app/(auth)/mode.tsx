import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";

/**
 * 온보딩 이용모드 선택은 제거됨. 딥링크·캐시 대비 리다이렉트만 유지.
 */
export default function ModeScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(auth)/profile");
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color="#F43F5E" />
    </View>
  );
}
