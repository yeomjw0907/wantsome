import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { toastConfig } from "@/components/CustomToast";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      />
      <Toast config={toastConfig} position="bottom" bottomOffset={96} visibilityTime={2200} />
      <StatusBar style="auto" />
    </>
  );
}
