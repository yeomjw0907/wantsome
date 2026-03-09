import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function CallScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Text className="text-white text-lg">통화 화면</Text>
      <Text className="text-gray-500 text-sm mt-2">sessionId: {sessionId}</Text>
    </View>
  );
}
