import { Stack } from "expo-router";
import { useCallSignal } from "@/hooks/useCallSignal";
import { CallWaitingModal } from "@/components/CallWaitingModal";

function CallHandlers() {
  useCallSignal();
  return <CallWaitingModal />;
}

export default function AppLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F8F8FA" },
        }}
      />
      <CallHandlers />
    </>
  );
}
