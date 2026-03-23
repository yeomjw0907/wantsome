import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

function BadgeIcon({
  name,
  color,
  focused,
  badge,
}: {
  name: string;
  color: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={{ position: "relative" }}>
      <Ionicons name={(focused ? name : `${name}-outline`) as any} size={22} color={color} />
      {badge && badge > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -8,
            backgroundColor: "#FF6B9D",
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
            {badge > 99 ? "99+" : String(badge)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const load = async () => {
      try {
        const res = await apiCall<{
          conversations: Array<{
            consumer_id: string;
            consumer_unread: number;
            creator_unread: number;
          }>;
        }>("/api/conversations");

        const total = (res.conversations ?? []).reduce((sum, conversation) => {
          const isConsumer = conversation.consumer_id === user.id;
          return sum + (isConsumer ? conversation.consumer_unread : conversation.creator_unread);
        }, 0);
        setUnreadMessages(total);
      } catch {
        // ignore
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF6B9D",
        tabBarInactiveTintColor: "#8E8EA0",
        tabBarStyle: {
          borderTopColor: "#F0F0F8",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarLabel: "홈",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "라이브",
          tabBarLabel: "라이브",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "radio" : "radio-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "샵",
          tabBarLabel: "샵",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bag" : "bag-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "메시지",
          tabBarLabel: "메시지",
          tabBarIcon: ({ color, focused }) => (
            <BadgeIcon name="chatbubble-ellipses" color={color} focused={focused} badge={unreadMessages} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "프로필",
          tabBarLabel: "프로필",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="posts" options={{ href: null }} />
      <Tabs.Screen name="reservations" options={{ href: null }} />
    </Tabs>
  );
}
