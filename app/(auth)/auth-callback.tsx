import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

/**
 * wantsome://auth/callback — OAuth 리다이렉트 수신
 * URL에서 토큰 추출 및 세션 설정은 login.tsx의 WebBrowser.openAuthSessionAsync 결과로 처리됨.
 * 이 화면은 콜백으로 열렸을 때 로그인 화면으로 돌려보냄.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(auth)/login");
  }, [router]);

  return (
    <View className="flex-1 bg-navy items-center justify-center">
      <ActivityIndicator size="large" color="#FF6B9D" />
    </View>
  );
}
