import { View, Text, TouchableOpacity } from "react-native";

export type FeedMode = "blue" | "red";

interface ModeTabProps {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
  canAccessRed: boolean;
}

export function ModeTab({ mode, onModeChange, canAccessRed }: ModeTabProps) {
  return (
    <View className="flex-row bg-gray-100 rounded-full p-1">
      <TouchableOpacity
        onPress={() => onModeChange("blue")}
        className="flex-1 py-2.5 rounded-full items-center justify-center"
        style={
          mode === "blue"
            ? { backgroundColor: "#D1E4F8", borderBottomWidth: 2, borderBottomColor: "#4D9FFF" }
            : undefined
        }
      >
        <Text
          className="text-sm font-semibold"
          style={mode === "blue" ? { color: "#4D9FFF" } : { color: "#8E8EA0" }}
        >
          파란불
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => canAccessRed && onModeChange("red")}
        disabled={!canAccessRed}
        className="flex-1 py-2.5 rounded-full items-center justify-center"
        style={
          mode === "red"
            ? { backgroundColor: "#FFEEF1", borderBottomWidth: 2, borderBottomColor: "#FF5C7A" }
            : undefined
        }
      >
        <Text
          className="text-sm font-semibold"
          style={
            mode === "red"
              ? { color: "#FF5C7A" }
              : canAccessRed
                ? { color: "#8E8EA0" }
                : { color: "#C8C8D8" }
          }
        >
          빨간불
        </Text>
      </TouchableOpacity>
    </View>
  );
}
