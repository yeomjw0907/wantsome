import { View, Text } from "react-native";

interface PointBadgeProps {
  points: number;
  className?: string;
}

export function PointBadge({ points, className = "" }: PointBadgeProps) {
  return (
    <View
      className={`flex-row items-center rounded-full bg-gray-100 px-3 py-1.5 ${className}`}
    >
      <Text className="text-pink text-sm font-semibold">
        {points.toLocaleString()}P
      </Text>
    </View>
  );
}
