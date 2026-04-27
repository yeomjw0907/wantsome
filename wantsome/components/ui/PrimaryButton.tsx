import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
} from "react-native";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  className = "",
  style,
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      className={`bg-pink h-[52px] rounded-full items-center justify-center mx-4 ${className}`}
      onPress={onPress}
      disabled={isLoading || disabled}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="text-white text-base font-semibold">{label}</Text>
      )}
    </TouchableOpacity>
  );
}
