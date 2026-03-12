import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";
import { useCreatorStore } from "@/stores/useCreatorStore";
import { PointBadge } from "@/components/ui/PointBadge";
import { ModeTab, type FeedMode } from "@/components/feed/ModeTab";
import { CreatorCard } from "@/components/feed/CreatorCard";
import { FeedEmptyState } from "@/components/feed/FeedEmptyState";
import CallWaitingModal from "@/components/CallWaitingModal";
import { apiCall } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import Toast from "react-native-toast-message";

const PAGE_SIZE = 20;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { points } = usePointStore();
  const {
    feedBlue,
    feedRed,
    isLoading,
    hasMoreBlue,
    hasMoreRed,
    setFeed,
    appendFeed,
    updateOnlineStatus,
    setLoading,
  } = useCreatorStore();

  const [mode, setMode] = useState<FeedMode>("blue");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [callModal, setCallModal] = useState<{
    sessionId: string;
    creatorId: string;
    creatorName: string;
    creatorAvatar: string | null;
    perMinRate: number;
  } | null>(null);

  const canAccessRed = Boolean(user?.is_verified && user?.red_mode);
  const creators = mode === "blue" ? feedBlue : feedRed;
  const hasMore = mode === "blue" ? hasMoreBlue : hasMoreRed;

  const loadFeed = useCallback(
    async (nextPage: number, append: boolean) => {
      try {
        if (!append) setLoading(true);
        const res = await apiCall<{
          creators: typeof feedBlue;
          hasMore: boolean;
        }>(
          `/api/creators/feed?mode=${mode}&page=${nextPage}&limit=${PAGE_SIZE}`
        );
        if (append) {
          appendFeed(mode, res.creators, res.hasMore);
        } else {
          setFeed(mode, res.creators, res.hasMore);
        }
        setPage(nextPage);
      } catch (e) {
        if (!append) {
          setFeed(mode, [], false);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode, setFeed, appendFeed, setLoading]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadFeed(1, false);
  }, [loadFeed]);

  const onEndReached = useCallback(() => {
    if (isLoading || !hasMore) return;
    loadFeed(page + 1, true);
  }, [isLoading, hasMore, page, loadFeed]);

  useEffect(() => {
    setPage(1);
    loadFeed(1, false);
  }, [mode]);

  useEffect(() => {
    const channel = supabase
      .channel("creators-online")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "creators" },
        (payload) => {
          const newRow = payload.new as { id?: string; is_online?: boolean };
          if (newRow?.id != null && typeof newRow.is_online === "boolean") {
            updateOnlineStatus(newRow.id, newRow.is_online);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateOnlineStatus]);

  const handleCallPress = useCallback(
    async (creator: {
      id: string;
      display_name: string;
      profile_image_url: string | null;
      rate_per_min?: number;
    }) => {
      const perMinRate = creator.rate_per_min ?? (mode === "blue" ? 900 : 1300);
      try {
        const res = await apiCall<{ session_id: string }>("/api/calls/start", {
          method: "POST",
          body: JSON.stringify({
            creator_id: creator.id,
            mode,
          }),
        });
        setCallModal({
          sessionId: res.session_id,
          creatorId: creator.id,
          creatorName: creator.display_name,
          creatorAvatar: creator.profile_image_url ?? null,
          perMinRate,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "통화 요청에 실패했습니다.";
        Toast.show({ type: "error", text1: "통화 요청 실패", text2: message });
      }
    },
    [mode]
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof creators)[0] }) => (
      <CreatorCard
        creator={item}
        mode={mode}
        onCallPress={handleCallPress}
      />
    ),
    [mode, handleCallPress]
  );

  const keyExtractor = useCallback((item: { id: string }) => item.id, []);

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 상단 바: 로고 | 포인트 | 알림 */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Text className="text-navy text-lg font-bold">wantsome</Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.push("/charge")}
            activeOpacity={0.8}
          >
            <PointBadge points={points} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {}}
            className="w-9 h-9 items-center justify-center"
          >
            <Ionicons name="notifications-outline" size={22} color="#1B2A4A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 모드 탭 */}
      <View className="px-4 py-3 bg-white">
        <ModeTab
          mode={mode}
          onModeChange={setMode}
          canAccessRed={canAccessRed}
        />
      </View>

      {/* 2컬럼 피드 */}
      <FlatList
        data={creators}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 12, gap: 0 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B9D"
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#FF6B9D" />
            </View>
          ) : (
            <FeedEmptyState mode={mode} />
          )
        }
        ListFooterComponent={
          isLoading && creators.length > 0 ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#FF6B9D" />
            </View>
          ) : null
        }
      />

      {callModal && (
        <CallWaitingModal
          visible={!!callModal}
          sessionId={callModal.sessionId}
          creatorId={callModal.creatorId}
          creatorName={callModal.creatorName}
          creatorAvatar={callModal.creatorAvatar}
          perMinRate={callModal.perMinRate}
          onClose={() => setCallModal(null)}
        />
      )}
    </View>
  );
}
