import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCreatorStore } from "@/stores/useCreatorStore";

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

interface Reservation {
  id: string;
  consumer_id: string;
  creator_id: string;
  reserved_at: string;
  duration_min: number;
  mode: "blue" | "red";
  type: string;
  deposit_points: number;
  status: "pending" | "confirmed" | "cancelled" | "noshow" | "completed";
  reject_reason: string | null;
  consumer_ready_at: string | null;
  creator_ready_at: string | null;
  consumer?: { nickname: string; profile_img: string | null };
  creator?: { display_name: string; profile_image_url: string | null };
}

const STATUS_LABELS: Record<
  Reservation["status"],
  { label: string; bg: string; color: string }
> = {
  pending: { label: "대기", bg: "#FEF3C7", color: "#92400E" },
  confirmed: { label: "확정", bg: "#DCFCE7", color: "#166534" },
  cancelled: { label: "취소", bg: "#F3F4F6", color: "#6B7280" },
  noshow: { label: "노쇼", bg: "#FEE2E2", color: "#991B1B" },
  completed: { label: "완료", bg: "#EFF6FF", color: "#1D4ED8" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConvItem({
  item,
  userId,
  onPress,
}: {
  item: Conversation;
  userId?: string;
  onPress: () => void;
}) {
  const isCreatorRole = userId === item.creator_id;
  const unread = isCreatorRole ? item.creator_unread : item.consumer_unread;
  const name = isCreatorRole
    ? (item.consumers?.nickname ?? "사용자")
    : (item.creators?.display_name ?? "크리에이터");
  const avatar = isCreatorRole
    ? item.consumers?.profile_img ?? null
    : item.creators?.users?.profile_img ?? null;

  const status = (() => {
    if (isCreatorRole) return null;
    const creator = item.creators;
    if (!creator?.is_online) return { color: "#9CA3AF" };
    if (creator.is_busy) return { color: "#F59E0B" };
    return { color: "#22C55E" };
  })();

  return (
    <TouchableOpacity style={styles.convItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={22} color="#C8C8D8" />
          </View>
        )}
        {status ? <View style={[styles.statusDot, { backgroundColor: status.color }]} /> : null}
      </View>
      <View style={styles.convBody}>
        <View style={styles.convRow}>
          <Text style={styles.convName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.convTime}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <View style={styles.convRow}>
          <Text style={styles.convPreview} numberOfLines={1}>
            {item.last_message ?? "채팅을 시작해보세요."}
          </Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ReservItem({
  item,
  isCreatorView,
  onRefresh,
  onCallNow,
}: {
  item: Reservation;
  isCreatorView: boolean;
  onRefresh: () => void;
  onCallNow: (creatorId: string) => void;
}) {
  const statusConf = STATUS_LABELS[item.status] ?? STATUS_LABELS.cancelled;
  const myReadyAt = isCreatorView ? item.creator_ready_at : item.consumer_ready_at;
  const otherReadyAt = isCreatorView ? item.consumer_ready_at : item.creator_ready_at;
  const bothReady = !!item.consumer_ready_at && !!item.creator_ready_at;
  const avatarUrl = isCreatorView
    ? item.consumer?.profile_img ?? null
    : item.creator?.profile_image_url ?? null;
  const displayName = isCreatorView
    ? item.consumer?.nickname ?? "사용자"
    : item.creator?.display_name ?? "크리에이터";

  const handleAccept = async () => {
    try {
      await apiCall(`/api/reservations/${item.id}/respond`, {
        method: "POST",
        body: JSON.stringify({ action: "accept" }),
      });
      Toast.show({ type: "success", text1: "예약을 수락했습니다." });
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "수락에 실패했습니다.";
      Toast.show({ type: "error", text1: message });
    }
  };

  const handleReject = () => {
    Alert.prompt(
      "예약 거절",
      "거절 사유를 입력해주세요. 비워도 됩니다.",
      async (reason) => {
        try {
          await apiCall(`/api/reservations/${item.id}/respond`, {
            method: "POST",
            body: JSON.stringify({ action: "reject", reject_reason: reason ?? null }),
          });
          Toast.show({ type: "success", text1: "예약을 거절했습니다." });
          onRefresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "거절에 실패했습니다.";
          Toast.show({ type: "error", text1: message });
        }
      },
      "plain-text",
      "",
    );
  };

  const canCancel =
    !isCreatorView &&
    (item.status === "pending" ||
      (item.status === "confirmed" &&
        new Date(item.reserved_at).getTime() - Date.now() > 60 * 60 * 1000));

  const handleCancel = () => {
    Alert.alert("예약 취소", "예약을 취소하시겠습니까?", [
      { text: "닫기", style: "cancel" },
      {
        text: "취소하기",
        style: "destructive",
        onPress: async () => {
          try {
            await apiCall(`/api/reservations/${item.id}`, { method: "DELETE" });
            Toast.show({ type: "success", text1: "예약을 취소했습니다." });
            onRefresh();
          } catch (error) {
            const message = error instanceof Error ? error.message : "취소에 실패했습니다.";
            Toast.show({ type: "error", text1: message });
          }
        },
      },
    ]);
  };

  const handleReady = async () => {
    try {
      const response = await apiCall<{ both_ready?: boolean }>(
        `/api/reservations/${item.id}/ready`,
        { method: "POST" }
      );
      onRefresh();
      Toast.show({
        type: response.both_ready ? "success" : "info",
        text1: response.both_ready ? "두 사람 모두 준비됐습니다." : "준비 완료를 전송했습니다.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "준비 상태를 업데이트하지 못했습니다.";
      Toast.show({ type: "error", text1: message });
    }
  };

  return (
    <View style={styles.reservItem}>
      <View style={styles.reservTop}>
        <View style={styles.reservLeft}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.reservAvatar} />
          ) : (
            <View style={[styles.reservAvatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={18} color="#C8C8D8" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.reservName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.reservTime}>
              {formatDateTime(item.reserved_at)} · {item.duration_min}분 ·{" "}
              {item.mode === "blue" ? "블루" : "레드"}
            </Text>
            <Text style={styles.reservDeposit}>{item.deposit_points.toLocaleString()}P</Text>
          </View>
        </View>
        <View style={[styles.reservBadge, { backgroundColor: statusConf.bg }]}>
          <Text style={[styles.reservBadgeText, { color: statusConf.color }]}>
            {statusConf.label}
          </Text>
        </View>
      </View>

      {item.status === "pending" && isCreatorView ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
            <Text style={styles.rejectBtnText}>거절</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptBtnText}>수락</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canCancel ? (
        <TouchableOpacity onPress={handleCancel} style={styles.cancelChip}>
          <Text style={styles.cancelChipText}>예약 취소</Text>
        </TouchableOpacity>
      ) : null}

      {item.status === "confirmed" ? (
        <View style={styles.actionRow}>
          {!myReadyAt ? (
            <TouchableOpacity style={styles.readyBtn} onPress={handleReady}>
              <Text style={styles.readyBtnText}>준비 완료</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.readyBtn, { backgroundColor: "#F0FFF4" }]}>
              <Text style={[styles.readyBtnText, { color: "#166534" }]}>
                {otherReadyAt ? "상대방도 준비 완료" : "준비 완료, 대기 중"}
              </Text>
            </View>
          )}
          {bothReady && !isCreatorView ? (
            <TouchableOpacity
              style={styles.callNowBtn}
              onPress={() => onCallNow(item.creator_id)}
            >
              <Ionicons name="videocam" size={14} color="#fff" />
              <Text style={styles.callNowBtnText}>지금 통화하기</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {item.reject_reason ? (
        <Text style={styles.rejectReason}>거절 사유: {item.reject_reason}</Text>
      ) : null}
    </View>
  );
}

function ReservationSubTab({
  userId,
  isCreatorView,
}: {
  userId?: string;
  isCreatorView: boolean;
}) {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReservations = useCallback(async () => {
    const role = isCreatorView ? "creator" : "consumer";
    try {
      const response = await apiCall<{ reservations: Reservation[] }>(
        `/api/reservations?role=${role}`
      );
      setReservations(response.reservations ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isCreatorView]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    if (!userId) return;
    const field = isCreatorView ? "creator_id" : "consumer_id";
    const channel = supabase
      .channel(`reservations-${userId}-${isCreatorView ? "creator" : "consumer"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `${field}=eq.${userId}`,
        },
        () => loadReservations(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isCreatorView, loadReservations, userId]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 48 }} color="#FF6B9D" />;
  }

  if (reservations.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={48} color="#C8C8D8" />
        <Text style={styles.emptyText}>
          {isCreatorView ? "받은 예약 요청이 없습니다." : "예약 내역이 없습니다."}
        </Text>
        <Text style={styles.emptySubText}>
          {isCreatorView
            ? "소비자가 예약을 요청하면 여기에 표시됩니다."
            : "크리에이터 프로필에서 예약 통화를 신청해보세요."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={reservations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ReservItem
          item={item}
          isCreatorView={isCreatorView}
          onRefresh={loadReservations}
          onCallNow={(creatorId) => router.push(`/creator/${creatorId}` as any)}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadReservations();
          }}
          tintColor="#FF6B9D"
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

export default function MessagesTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const myCreatorProfile = useCreatorStore((state) => state.myProfile);
  const isCreatorView = !!myCreatorProfile;

  const [subTab, setSubTab] = useState<SubTab>("dm");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const response = await apiCall<{ conversations: Conversation[] }>("/api/conversations");
      setConversations(response.conversations ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`conv-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `consumer_id=eq.${user.id}` },
        () => loadConversations(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `creator_id=eq.${user.id}` },
        () => loadConversations(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations, user?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>메시지</Text>
      </View>

      <View style={styles.subTabBar}>
        {(["dm", "reservation"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.subTab, subTab === tab && styles.subTabActive]}
            onPress={() => setSubTab(tab)}
          >
            <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
              {tab === "dm" ? "DM" : isCreatorView ? "받은 예약" : "예약"}
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
            <Text style={styles.emptyText}>아직 대화가 없습니다.</Text>
            <Text style={styles.emptySubText}>크리에이터 프로필에서 DM을 시작해보세요.</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConvItem
                item={item}
                userId={user?.id}
                onPress={() => router.push(`/messages/${item.id}` as any)}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadConversations();
                }}
                tintColor="#FF6B9D"
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )
      ) : (
        <ReservationSubTab userId={user?.id} isCreatorView={isCreatorView} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFF" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1B2A4A" },
  subTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F8",
    marginHorizontal: 20,
  },
  subTab: { paddingVertical: 10, paddingHorizontal: 20, marginBottom: -1 },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: "#FF6B9D" },
  subTabText: { fontSize: 14, fontWeight: "600", color: "#9CA3AF" },
  subTabTextActive: { color: "#FF6B9D" },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  avatarWrap: { position: "relative", marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    backgroundColor: "#F0F0F8",
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  convBody: { flex: 1 },
  convRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  convName: { fontSize: 15, fontWeight: "700", color: "#1B2A4A", flex: 1 },
  convTime: { fontSize: 12, color: "#9CA3AF", marginLeft: 8 },
  convPreview: { fontSize: 13, color: "#6B7280", flex: 1 },
  badge: {
    backgroundColor: "#FF6B9D",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  separator: { height: 1, backgroundColor: "#F5F5FA", marginLeft: 82 },
  reservItem: { backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 14 },
  reservTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  reservLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  reservAvatar: { width: 44, height: 44, borderRadius: 22, flexShrink: 0 },
  reservName: { fontSize: 14, fontWeight: "600", color: "#1B2A4A" },
  reservTime: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  reservDeposit: { fontSize: 12, color: "#FF6B9D", fontWeight: "600", marginTop: 2 },
  reservBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  reservBadgeText: { fontSize: 12, fontWeight: "600" },
  rejectReason: { fontSize: 11, color: "#9CA3AF", marginTop: 8 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  rejectBtnText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  acceptBtn: {
    flex: 1,
    backgroundColor: "#FF6B9D",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  acceptBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  readyBtn: {
    flex: 1,
    backgroundColor: "#FFF0F5",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  readyBtnText: { fontSize: 13, fontWeight: "600", color: "#FF6B9D" },
  callNowBtn: {
    flex: 1,
    backgroundColor: "#FF6B9D",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  callNowBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  cancelChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  cancelChipText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6B7280" },
  emptySubText: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
