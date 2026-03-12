import { Stack } from "expo-router";
import { useCallSignal } from "@/hooks/useCallSignal";

export default function AppLayout() {
  useCallSignal();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F8F8FA" },
      }}
    />
  );
}
