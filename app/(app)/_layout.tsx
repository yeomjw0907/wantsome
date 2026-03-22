import { useEffect } from "react";
import { Stack } from "expo-router";
import { useCallSignal } from "@/hooks/useCallSignal";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useFavoriteStore } from "@/stores/useFavoriteStore";

export default function AppLayout() {
  useCallSignal();
  usePushNotifications();
  const { load, isLoaded } = useFavoriteStore();

  useEffect(() => {
    if (!isLoaded) void load().catch(() => {});
  }, [isLoaded, load]);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F8F8FA" },
      }}
    />
  );
}
