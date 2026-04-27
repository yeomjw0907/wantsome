import { Stack } from "expo-router";

export default function CreatorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F8F8FA" },
      }}
    />
  );
}
