import { View, Text } from "react-native";
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(auth)/login");
    }, 5000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View className="flex-1 bg-navy items-center justify-center">
      <Text className="text-pink text-4xl font-bold">wantsome</Text>
      <Text className="text-white/80 text-sm mt-3">MEET SOMEONE SPECIAL</Text>
    </View>
  );
}
