import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
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

/** 모드별 카테고리 목록 */
const BLUE_CATEGORIES = [
  "전체",
  "20대", "30대", "40대",
  "청순", "큐티", "활발", "지적", "섹시", "털털",
];
const RED_CATEGORIES = [
  "전체",
  "20대", "30대", "40대",
  "청순", "큐티", "농염", "섹시",
  "BDSM", "역할극", "리드형", "서브형", "교복", "조교",
];

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
  const [category, setCategory] = useState("전체");

  // 검색 상태
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<typeof feedBlue>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const categories = mode === "blue" ? BLUE_CATEGORIES : RED_CATEGORIES;

  // 모드 또는 카테고리 변경 시 카테고리 초기화 및 피드 재로드
  const handleModeChange = (m: FeedMode) => {
    setMode(m);
    setCategory("전체");
    setSearchText("");
    setIsSearching(false);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  const loadFeed = useCallback(
    async (nextPage: number, append: boolean, cat = category) => {
      try {
        if (!append) setLoading(true);
        const catParam = cat !== "전체" ? `&category=${encodeURIComponent(cat)}` : "";
        const res = await apiCall<{
          creators: typeof feedBlue;
          hasMore: boolean;
        }>(
          `/api/creators/feed?mode=${mode}&page=${nextPage}&limit=${PAGE_SIZE}${catParam}`
        );
        if (append) {
          appendFeed(mode, res.creators, res.hasMore);
        } else {
          setFeed(mode, res.creators, res.hasMore);
        }
        setPage(nextPage);
      } catch {
        if (!append) setFeed(mode, [], false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode, category, setFeed, appendFeed, setLoading]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadFeed(1, false);
  }, [loadFeed]);

  const onEndReached = useCallback(() => {
    if (isLoading || !hasMore || isSearching) return;
    loadFeed(page + 1, true);
  }, [isLoading, hasMore, page, loadFeed, isSearching]);

  useEffect(() => {
    setPage(1);
    loadFeed(1, false, category);
  }, [mode, category]);

  // 실시간 온라인 상태 구독
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
    return () => { supabase.removeChannel(channel); };
  }, [updateOnlineStatus]);

  // 검색 (디바운스 300ms)
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiCall<{ creators: typeof feedBlue }>(
          `/api/creators/search?q=${encodeURIComponent(text.trim())}&mode=${mode}`
        );
        setSearchResults(res.creators ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

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
          body: JSON.stringify({ creator_id: creator.id, mode }),
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

  const displayCreators = isSearching ? searchResults : creators;

  const renderItem = useCallback(
    ({ item }: { item: (typeof displayCreators)[0] }) => (
      <CreatorCard creator={item} mode={mode} onCallPress={handleCallPress} />
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

      {/* 검색바 */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <View className="flex-row items-center bg-gray-100 rounded-2xl px-3 py-2.5 gap-2">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="크리에이터 닉네임 검색..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{ flex: 1, fontSize: 14, color: "#1B2A4A" }}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText("");
                setIsSearching(false);
                setSearchResults([]);
              }}
            >
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 모드 탭 */}
      <View className="px-4 pb-3 bg-white">
        <ModeTab
          mode={mode}
          onModeChange={handleModeChange}
          canAccessRed={canAccessRed}
        />
      </View>

      {/* 카테고리 필터 (검색 중 아닐 때만 표시) */}
      {!isSearching && (
        <View className="bg-white border-b border-gray-100">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}
          >
            {categories.map((cat) => {
              const active = cat === category;
              const isAge = ["20대", "30대", "40대"].includes(cat);
              const isAll = cat === "전체";
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => handleCategoryChange(cat)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    backgroundColor: active
                      ? (mode === "blue" ? "#4D9FFF" : "#FF5C7A")
                      : "#F5F5FA",
                    borderColor: active
                      ? (mode === "blue" ? "#4D9FFF" : "#FF5C7A")
                      : "#E5E5F0",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: active ? "700" : "500",
                      color: active ? "#fff" : "#666",
                    }}
                  >
                    {isAll ? "# 전체" : isAge ? `🎂 ${cat}` : `# ${cat}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 검색 중 안내 */}
      {isSearching && (
        <View className="px-4 py-2 bg-gray-50">
          <Text className="text-gray-400 text-xs">
            "{searchText}" 검색 결과 {searchResults.length}명
          </Text>
        </View>
      )}

      {/* 2컬럼 피드 */}
      {(isSearching && searchLoading) ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={displayCreators}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 0 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            !isSearching ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF6B9D"
              />
            ) : undefined
          }
          ListEmptyComponent={
            isLoading && !isSearching ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#FF6B9D" />
              </View>
            ) : (
              <FeedEmptyState mode={mode} />
            )
          }
          ListFooterComponent={
            isLoading && creators.length > 0 && !isSearching ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#FF6B9D" />
              </View>
            ) : null
          }
        />
      )}

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
