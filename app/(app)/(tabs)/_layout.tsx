import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

// 뱃지 아이콘 컴포넌트
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
      <Ionicons
        name={(focused ? name : `${name}-outline`) as any}
        size={22}
        color={color}
      />
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
    if (!user?.id) return;
    const load = async () => {
      try {
        const res = await apiCall<{ conversations: Array<{
          consumer_id: string;
          consumer_unread: number;
          creator_unread: number;
        }> }>("/api/conversations");
        const total = (res.conversations ?? []).reduce((sum, c) => {
          const isConsumer = c.consumer_id === user.id;
          return sum + (isConsumer ? c.consumer_unread : c.creator_unread);
        }, 0);
        setUnreadMessages(total);
      } catch { /* ignore */ }
    };
    load();
    // 30초마다 갱신
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
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: "피드",
          tabBarLabel: "피드",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "쇼핑",
          tabBarLabel: "쇼핑",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "bag" : "bag-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "메시지",
          tabBarLabel: "메시지",
          tabBarIcon: ({ color, focused }) => (
            <BadgeIcon
              name="chatbubble-ellipses"
              color={color}
              focused={focused}
              badge={unreadMessages}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "내 정보",
          tabBarLabel: "내 정보",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      {/* 예약 탭 숨김 — 메시지 탭 서브탭으로 통합 */}
      <Tabs.Screen name="reservations" options={{ href: null }} />
    </Tabs>
  );
}
