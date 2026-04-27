/**
 * 앱 내 알림 센터
 * - 읽음/안읽음 구분
 * - 타입별 아이콘 (DM/통화/예약/포인트/출석/시스템)
 * - 전체 읽음 처리
 */
import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";

interface Notification {
  id: string;
  type: "dm" | "call_request" | "reservation" | "point" | "checkin" | "system";
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

const NOTIF_ICONS: Record<string, { name: string; color: string; bg: string }> = {
  dm:           { name: "chatbubble-ellipses", color: "#4D9FFF", bg: "#EFF6FF" },
  call_request: { name: "videocam",            color: "#FF6B9D", bg: "#FFF0F5" },
  reservation:  { name: "calendar",            color: "#22C55E", bg: "#F0FFF4" },
  point:        { name: "wallet",              color: "#F59E0B", bg: "#FFFBEB" },
  checkin:      { name: "gift",               color: "#8B5CF6", bg: "#F5F3FF" },
  system:       { name: "megaphone",           color: "#6B7280", bg: "#F3F4F6" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await apiCall<{ notifications: Notification[] }>("/api/notifications");
      setNotifications(res.notifications ?? []);
    } catch {
      Toast.show({ type: "error", text1: "알림을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAllRead = async () => {
    try {
      await apiCall("/api/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  const handleTap = async (item: Notification) => {
    // 읽음 처리 (낙관적 업데이트)
    setNotifications((prev) =>
      prev.map((n) => n.id === item.id ? { ...n, is_read: true } : n)
    );
    // 타입별 네비게이션
    if (item.type === "dm" && item.data?.conv_id) {
      router.push(`/messages/${item.data.conv_id}` as any);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderItem = ({ item }: { item: Notification }) => {
    const iconConf = NOTIF_ICONS[item.type] ?? NOTIF_ICONS.system;
    return (
      <TouchableOpacity
        onPress={() => handleTap(item)}
        style={{
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: item.is_read ? "#fff" : "#FFF8FB",
          borderBottomWidth: 1,
          borderBottomColor: "#F0F0F8",
        }}
        activeOpacity={0.7}
      >
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: iconConf.bg,
          alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Ionicons name={iconConf.name as any} size={20} color={iconConf.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text
              style={{ fontSize: 13, fontWeight: "700", color: "#1B2A4A", flex: 1 }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8, flexShrink: 0 }}>
              {timeAgo(item.created_at)}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 3, lineHeight: 18 }} numberOfLines={2}>
            {item.body}
          </Text>
        </View>

        {!item.is_read && (
          <View style={{
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: "#FF6B9D", marginTop: 4, flexShrink: 0,
          }} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAFF", paddingTop: insets.top }}>
      {/* 헤더 */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1, borderBottomColor: "#F0F0F8",
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: "#1B2A4A" }}>
          알림{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={{ padding: 4 }}>
            <Text style={{ fontSize: 13, color: "#FF6B9D", fontWeight: "600" }}>모두 읽음</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadNotifications(); }}
              tintColor="#FF6B9D"
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Ionicons name="notifications-off-outline" size={52} color="#C8C8D8" />
              <Text style={{ color: "#C8C8D8", fontSize: 15, fontWeight: "600", marginTop: 12 }}>
                알림이 없습니다
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
