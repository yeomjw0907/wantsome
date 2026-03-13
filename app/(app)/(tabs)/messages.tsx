import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, SafeAreaView, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/useAuthStore";
import { supabase } from "@/lib/supabase";

// ── 서브탭: DM / 예약 ──────────────────────────────────────────────────────
type SubTab = "dm" | "reservation";

interface Conversation {
  id: string;
  consumer_id: string;
  creator_id: string;
  consumer_unread: number;
  creator_unread: number;
  last_message: string | null;
  last_message_at: string | null;
  consumers?: { nickname: string; profile_img: string | null };
  creators?: {
    display_name: string;
    is_online: boolean;
    is_busy: boolean;
    users?: { nickname: string; profile_img: string | null };
  };
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function MessagesTab() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [subTab, setSubTab] = useState<SubTab>("dm");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime: 새 메시지 수신 시 목록 갱신
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`conv-list-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `consumer_id=eq.${user.id}`,
      }, () => loadConversations())
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `creator_id=eq.${user.id}`,
      }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadConversations]);

  const isCreator = (conv: Conversation) => user?.id === conv.creator_id;

  const getUnread = (conv: Conversation) =>
    isCreator(conv) ? conv.creator_unread : conv.consumer_unread;

  const getOtherName = (conv: Conversation) => {
    if (isCreator(conv)) {
      return conv.consumers?.nickname ?? "유저";
    }
    return conv.creators?.display_name ?? conv.creators?.users?.nickname ?? "크리에이터";
  };

  const getOtherAvatar = (conv: Conversation): string | null => {
    if (isCreator(conv)) return conv.consumers?.profile_img ?? null;
    return conv.creators?.users?.profile_img ?? null;
  };

  const getCreatorStatus = (conv: Conversation) => {
    if (isCreator(conv)) return null;
    const c = conv.creators;
    if (!c?.is_online) return { color: "#9CA3AF", label: "오프라인" };
    if (c.is_busy) return { color: "#F59E0B", label: "통화 중" };
    return { color: "#22C55E", label: "온라인" };
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const unread = getUnread(item);
    const name = getOtherName(item);
    const avatar = getOtherAvatar(item);
    const status = getCreatorStatus(item);

    return (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => router.push(`/messages/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: "#F0F0F8", alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="person" size={22} color="#C8C8D8" />
            </View>
          )}
          {status && (
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          )}
        </View>

        <View style={styles.convBody}>
          <View style={styles.convRow}>
            <Text style={styles.convName} numberOfLines={1}>{name}</Text>
            <Text style={styles.convTime}>
              {item.last_message_at ? timeAgo(item.last_message_at) : ""}
            </Text>
          </View>
          <View style={styles.convRow}>
            <Text style={styles.convPreview} numberOfLines={1}>
              {item.last_message ?? "채팅방이 열렸습니다"}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>메시지</Text>
      </View>

      {/* 서브탭 */}
      <View style={styles.subTabBar}>
        {(["dm", "reservation"] as SubTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.subTab, subTab === t && styles.subTabActive]}
            onPress={() => setSubTab(t)}
          >
            <Text style={[styles.subTabText, subTab === t && styles.subTabTextActive]}>
              {t === "dm" ? "DM" : "예약"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === "dm" ? (
        loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color="#FF6B9D" />
        ) : conversations.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color="#C8C8D8" />
            <Text style={styles.emptyText}>아직 대화가 없어요</Text>
            <Text style={styles.emptySubText}>크리에이터 프로필에서 DM을 보내보세요</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} tintColor="#FF6B9D" />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      ) : (
        <ReservationSubTab token={token} userId={user?.id} />
      )}
    </SafeAreaView>
  );
}

// ── 예약 서브탭 (기존 reservations 탭 내용 이관) ───────────────────────────
function ReservationSubTab({ token, userId }: { token: string | null; userId?: string }) {
  const router = useRouter();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : { reservations: [] })
      .then((d) => setReservations(d.reservations ?? []))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color="#FF6B9D" />;

  if (reservations.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={48} color="#C8C8D8" />
        <Text style={styles.emptyText}>예약된 통화가 없어요</Text>
        <Text style={styles.emptySubText}>크리에이터 프로필에서 예약 통화를 신청해보세요</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={reservations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.reservItem}>
          <View style={styles.reservLeft}>
            {item.creators?.users?.profile_img ? (
              <Image source={{ uri: item.creators.users.profile_img }} style={styles.reservAvatar} />
            ) : (
              <View style={[styles.reservAvatar, { backgroundColor: "#F0F0F8", alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="person" size={18} color="#C8C8D8" />
              </View>
            )}
            <View>
              <Text style={styles.reservName}>{item.creators?.display_name ?? "크리에이터"}</Text>
              <Text style={styles.reservTime}>
                {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
              </Text>
            </View>
          </View>
          <View style={[styles.reservBadge, { backgroundColor: item.status === "confirmed" ? "#DCFCE7" : "#FEF3C7" }]}>
            <Text style={[styles.reservBadgeText, { color: item.status === "confirmed" ? "#166534" : "#92400E" }]}>
              {item.status === "confirmed" ? "확정" : item.status === "pending" ? "대기" : item.status}
            </Text>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFF" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1B2A4A" },

  subTabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0F0F8", marginHorizontal: 20 },
  subTab: { paddingVertical: 10, paddingHorizontal: 20, marginBottom: -1 },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: "#FF6B9D" },
  subTabText: { fontSize: 14, fontWeight: "600", color: "#9CA3AF" },
  subTabTextActive: { color: "#FF6B9D" },

  convItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff" },
  avatarWrap: { position: "relative", marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  statusDot: { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#fff" },
  convBody: { flex: 1 },
  convRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  convName: { fontSize: 15, fontWeight: "700", color: "#1B2A4A", flex: 1 },
  convTime: { fontSize: 12, color: "#9CA3AF", marginLeft: 8 },
  convPreview: { fontSize: 13, color: "#6B7280", flex: 1 },
  badge: { backgroundColor: "#FF6B9D", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, marginLeft: 8 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  separator: { height: 1, backgroundColor: "#F5F5FA", marginLeft: 82 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6B7280" },
  emptySubText: { fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingHorizontal: 40 },

  reservItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff" },
  reservLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  reservAvatar: { width: 44, height: 44, borderRadius: 22 },
  reservName: { fontSize: 14, fontWeight: "600", color: "#1B2A4A" },
  reservTime: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  reservBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  reservBadgeText: { fontSize: 12, fontWeight: "600" },
});
