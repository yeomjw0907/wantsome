import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, Image, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/useAuthStore";
import { supabase } from "@/lib/supabase";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ConvInfo {
  id: string;
  consumer_id: string;
  creator_id: string;
  creators?: {
    display_name: string;
    is_online: boolean;
    is_busy: boolean;
    users?: { nickname: string; profile_img: string | null };
  };
  consumers?: { nickname: string; profile_img: string | null };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export default function ChatRoomScreen() {
  const { id: convId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuthStore();

  const [conv, setConv] = useState<ConvInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const API = process.env.EXPO_PUBLIC_API_URL;

  const loadConv = useCallback(async () => {
    if (!token || !convId) return;
    const res = await fetch(`${API}/api/conversations`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json();
      const found = (d.conversations ?? []).find((c: ConvInfo) => c.id === convId);
      if (found) setConv(found);
    }
  }, [token, convId, API]);

  const loadMessages = useCallback(async () => {
    if (!token || !convId) return;
    const res = await fetch(`${API}/api/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      setMessages(d.messages ?? []);
    }
    setLoading(false);
  }, [token, convId, API]);

  const markRead = useCallback(async () => {
    if (!token || !convId) return;
    await fetch(`${API}/api/conversations/${convId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
  }, [token, convId, API]);

  useEffect(() => {
    loadConv();
    loadMessages();
    markRead();
  }, [loadConv, loadMessages, markRead]);

  // Realtime 구독
  useEffect(() => {
    if (!convId) return;
    const channel = supabase
      .channel(`messages-${convId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
        if (msg.sender_id !== user?.id) markRead();
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convId, user?.id, markRead]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !token || !convId) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await fetch(`${API}/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
    } finally {
      setSending(false);
    }
  };

  const isCreatorRole = user?.id === conv?.creator_id;
  const otherName = isCreatorRole
    ? (conv?.consumers?.nickname ?? "유저")
    : (conv?.creators?.display_name ?? "크리에이터");
  const otherAvatar = isCreatorRole
    ? (conv?.consumers?.profile_img ?? null)
    : (conv?.creators?.users?.profile_img ?? null);

  const creatorStatus = (() => {
    if (isCreatorRole) return null;
    const c = conv?.creators;
    if (!c?.is_online) return { label: "오프라인", color: "#9CA3AF", active: false };
    if (c.is_busy) return { label: "통화 중", color: "#F59E0B", active: false };
    return { label: "통화하기", color: "#FF6B9D", active: true };
  })();

  const handleCallPress = () => {
    if (!conv?.creator_id) return;
    if (creatorStatus?.active) {
      router.push(`/creator/${conv.creator_id}` as any);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_id === user?.id;
    const prevItem = index > 0 ? messages[index - 1] : null;
    const showDate = !prevItem || formatDate(prevItem.created_at) !== formatDate(item.created_at);

    return (
      <>
        {showDate && (
          <View style={styles.dateSep}>
            <Text style={styles.dateSepText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
          {!isMine && (
            <View style={styles.msgBubble}>
              <Text style={styles.msgText}>{item.content}</Text>
              <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
            </View>
          )}
          {isMine && (
            <View style={[styles.msgBubble, styles.msgBubbleMine]}>
              <Text style={[styles.msgText, styles.msgTextMine]}>{item.content}</Text>
              <Text style={[styles.msgTime, { color: "rgba(255,255,255,0.7)" }]}>{formatTime(item.created_at)}</Text>
            </View>
          )}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: "#F0F0F8" }]} />
          )}
          <View>
            <Text style={styles.headerName}>{otherName}</Text>
            {creatorStatus && (
              <Text style={[styles.headerStatus, { color: creatorStatus.color }]}>
                ● {creatorStatus.label}
              </Text>
            )}
          </View>
        </View>
        {/* 통화 버튼 (소비자 → 크리에이터 방향만) */}
        {!isCreatorRole && creatorStatus && (
          <TouchableOpacity
            onPress={handleCallPress}
            disabled={!creatorStatus.active}
            style={[styles.callBtn, { backgroundColor: creatorStatus.active ? "#FF6B9D" : "#F3F4F6" }]}
          >
            <Ionicons name="videocam" size={18} color={creatorStatus.active ? "#fff" : "#9CA3AF"} />
            <Text style={[styles.callBtnText, { color: creatorStatus.active ? "#fff" : "#9CA3AF" }]}>
              {creatorStatus.active ? "통화" : creatorStatus.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 메시지 목록 */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#FF6B9D" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>첫 번째 메시지를 보내보세요 💌</Text>
            </View>
          }
        />
      )}

      {/* 입력창 */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력하세요..."
            placeholderTextColor="#C8C8D8"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          >
            <Ionicons name="send" size={18} color={input.trim() && !sending ? "#fff" : "#C8C8D8"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFF" },

  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F8",
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerName: { fontSize: 15, fontWeight: "700", color: "#1B2A4A" },
  headerStatus: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  callBtnText: { fontSize: 12, fontWeight: "700" },

  messageList: { padding: 16, paddingBottom: 8 },
  dateSep: { alignItems: "center", marginVertical: 16 },
  dateSepText: { fontSize: 12, color: "#9CA3AF", backgroundColor: "#F0F0F8", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },

  msgRow: { marginBottom: 8, alignItems: "flex-start" },
  msgRowMine: { alignItems: "flex-end" },
  msgBubble: {
    maxWidth: "75%", backgroundColor: "#fff", borderRadius: 18,
    borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  msgBubbleMine: { backgroundColor: "#FF6B9D", borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, color: "#1B2A4A", lineHeight: 20 },
  msgTextMine: { color: "#fff" },
  msgTime: { fontSize: 10, color: "#9CA3AF", marginTop: 4, alignSelf: "flex-end" },

  emptyChat: { alignItems: "center", paddingTop: 60 },
  emptyChatText: { color: "#C8C8D8", fontSize: 14 },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F8",
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: "#F5F5FA", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: "#1B2A4A",
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FF6B9D", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#F5F5FA" },
});
