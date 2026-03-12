import { Stack } from "expo-router";
import { useCallSignal } from "@/hooks/useCallSignal";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function AppLayout() {
  useCallSignal();
  usePushNotifications();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F8F8FA" },
      }}
    />
  );
}
