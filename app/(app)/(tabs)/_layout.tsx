import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF6B9D",
        tabBarInactiveTintColor: "#8E8EA0",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "피드", tabBarLabel: "피드" }} />
      <Tabs.Screen name="reservations" options={{ title: "예약", tabBarLabel: "예약" }} />
      <Tabs.Screen name="profile" options={{ title: "프로필", tabBarLabel: "프로필" }} />
    </Tabs>
  );
}
