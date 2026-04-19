import { View, Text, TouchableOpacity } from "react-native";
import { MODE_LABEL } from "@/constants/branding";

export type FeedMode = "blue" | "red";

interface ModeTabProps {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
  canAccessRed: boolean;
}

/** 활성 탭: 솔리드 배경 + 흰 글자 / 비활성: 연한 회색 배경 — "선택이 더 진하게" 보이도록 */
export function ModeTab({ mode, onModeChange, canAccessRed }: ModeTabProps) {
  return (
    <View className="flex-row bg-gray-100 rounded-full p-1 gap-1">
      <TouchableOpacity
        onPress={() => onModeChange("blue")}
        className="flex-1 py-2.5 rounded-full items-center justify-center"
        style={
          mode === "blue"
            ? { backgroundColor: "#4D9FFF" }
            : { backgroundColor: "transparent" }
        }
        activeOpacity={0.85}
      >
        <Text
          className="text-sm font-semibold"
          style={mode === "blue" ? { color: "#FFFFFF" } : { color: "#8E8EA0" }}
        >
          {MODE_LABEL.blue}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => canAccessRed && onModeChange("red")}
        disabled={!canAccessRed}
        className="flex-1 py-2.5 rounded-full items-center justify-center"
        style={
          mode === "red"
            ? { backgroundColor: "#FF5C7A" }
            : { backgroundColor: "transparent" }
        }
        activeOpacity={0.85}
      >
        <Text
          className="text-sm font-semibold"
          style={
            mode === "red"
              ? { color: "#FFFFFF" }
              : canAccessRed
                ? { color: "#8E8EA0" }
                : { color: "#C8C8D8" }
          }
        >
          {MODE_LABEL.red}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
