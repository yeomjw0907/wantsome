import { View, Text } from "react-native";
import { formatModeLabel } from "@/constants/branding";

interface FeedEmptyStateProps {
  mode: "blue" | "red";
}

export function FeedEmptyState({ mode }: FeedEmptyStateProps) {
  const isBlue = mode === "blue";
  return (
    <View className="flex-1 min-h-[280px] justify-center items-center px-8 pt-8 pb-12">
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: isBlue ? "#D1E4F8" : "#FFFBEB" }}
      >
        <Text className="text-4xl">{isBlue ? "🔵" : "⭐"}</Text>
      </View>
      <Text className="text-navy text-lg font-semibold text-center mb-1">
        {formatModeLabel(isBlue ? "blue" : "red")} 크리에이터를 기다리는 중
      </Text>
      <Text className="text-gray-500 text-sm text-center leading-5">
        곧 다양한 크리에이터가 올라올 거예요.{"\n"}
        아래로 당겨 새로고침 해보세요.
      </Text>
    </View>
  );
}
