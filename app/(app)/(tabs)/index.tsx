import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  LayoutAnimation,
  UIManager,
  Platform,
  Image,
  Dimensions,
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

const SCREEN_W = Dimensions.get("window").width;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// 배너 캐러셀
// ─────────────────────────────────────────────
interface Banner {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
}

function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiCall<{ banners: Banner[] }>("/api/banners")
      .then((r) => setBanners(r.banners ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
        return next;
      });
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners]);

  if (banners.length === 0) return null;

  return (
    <View style={{ height: 140, marginBottom: 4 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
        }}
        scrollEventThrottle={16}
      >
        {banners.map((b) => (
          <View key={b.id} style={{ width: SCREEN_W, height: 140, backgroundColor: "#F0F0F8" }}>
            {b.image_url ? (
              <Image source={{ uri: b.image_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#1B2A4A" }}>{b.title}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      {/* 인디케이터 도트 */}
      {banners.length > 1 && (
        <View style={{ position: "absolute", bottom: 8, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === activeIdx ? 16 : 6, height: 6, borderRadius: 3,
                backgroundColor: i === activeIdx ? "#FF6B9D" : "rgba(255,255,255,0.6)",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// 출석 체크인 카드
// ─────────────────────────────────────────────
interface CheckInStatus {
  checked_today: boolean;
  streak: number;
  next_points: number;
}

function CheckInCard() {
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    apiCall<CheckInStatus>("/api/check-in")
      .then((r) => setStatus(r))
      .catch(() => {});
  }, []);

  if (!status || status.checked_today) return null;

  const handleCheckIn = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await apiCall<{ streak: number; points_awarded: number }>("/api/check-in", { method: "POST" });
      setStatus((prev) => prev ? { ...prev, checked_today: true, streak: res.streak } : null);
      Toast.show({ type: "success", text1: `🎁 출석 체크인 완료!`, text2: `+${res.points_awarded}P 지급됐습니다.` });
    } catch (e) {
      Toast.show({ type: "error", text1: e instanceof Error ? e.message : "체크인 실패" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={{
      marginHorizontal: 12, marginBottom: 8,
      backgroundColor: "#fff", borderRadius: 16,
      borderWidth: 1.5, borderColor: "#FFD6E8",
      padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: "#FFF0F5",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 22 }}>🎁</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1B2A4A" }}>오늘의 출석 체크인</Text>
          {status.streak > 1 && (
            <View style={{ backgroundColor: "#FF6B9D20", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontSize: 11, color: "#FF6B9D", fontWeight: "700" }}>🔥 {status.streak}일 연속</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
          체크인하면 +{status.next_points}P 지급
        </Text>
      </View>
      <TouchableOpacity
        onPress={handleCheckIn}
        disabled={checking}
        style={{
          backgroundColor: checking ? "#F3F4F6" : "#FF6B9D",
          borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: checking ? "#9CA3AF" : "#fff" }}>
          {checking ? "처리중..." : "체크인"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// 랭킹 섹션
// ─────────────────────────────────────────────
type RankedCreator = {
  rank: number;
  id: string;
  display_name: string;
  profile_image_url: string | null;
  grade: string;
  is_online: boolean;
  is_verified: boolean;
  total_sec: number;
};

const MEDAL = ["🥇", "🥈", "🥉"] as const;
const MEDAL_BG = ["#FFF8E1", "#F5F5F5", "#FBF0E6"] as const;
const MEDAL_BORDER = ["#FFD700", "#B0B0B0", "#CD7F32"] as const;

function RankingSection({ mode }: { mode: FeedMode }) {
  const router = useRouter();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [ranking, setRanking] = useState<RankedCreator[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiCall<{ ranking: RankedCreator[] }>(
      `/api/creators/ranking?mode=${mode}&period=${period}&limit=10`
    )
      .then((res) => { if (!cancelled) setRanking(res.ranking ?? []); })
      .catch(() => { if (!cancelled) setRanking([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, period]);

  return (
    <View style={{ backgroundColor: "#fff", marginBottom: 8 }}>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 16 }}>🔥</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#1B2A4A" }}>인기 순위</Text>
        </View>
        <View style={{
          flexDirection: "row", backgroundColor: "#F3F4F6",
          borderRadius: 20, padding: 3, gap: 2,
        }}>
          {(["weekly", "monthly"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
                backgroundColor: period === p ? "#FF6B9D" : "transparent",
              }}
            >
              <Text style={{
                fontSize: 12, fontWeight: "600",
                color: period === p ? "#fff" : "#9CA3AF",
              }}>
                {p === "weekly" ? "주간" : "월간"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#FF6B9D" />
        </View>
      ) : ranking.length === 0 ? (
        <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#9CA3AF", fontSize: 13 }}>순위 데이터가 없습니다</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 14, gap: 10 }}
        >
          {ranking.map((creator) => {
            const isTop3 = creator.rank <= 3;
            const idx = creator.rank - 1;
            const sz = isTop3 ? 64 : 52;
            return (
              <TouchableOpacity
                key={creator.id}
                onPress={() => router.push(`/creator/${creator.id}`)}
                activeOpacity={0.85}
                style={{
                  alignItems: "center",
                  width: isTop3 ? 80 : 66,
                  backgroundColor: isTop3 ? MEDAL_BG[idx] : "#F9FAFB",
                  borderRadius: 16,
                  borderWidth: isTop3 ? 1.5 : 0,
                  borderColor: isTop3 ? MEDAL_BORDER[idx] : "transparent",
                  paddingTop: 10, paddingBottom: 8, paddingHorizontal: 4,
                }}
              >
                {isTop3 ? (
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>{MEDAL[idx]}</Text>
                ) : (
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: "#E5E7EB",
                    alignItems: "center", justifyContent: "center",
                    marginBottom: 4,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#6B7280" }}>
                      {creator.rank}
                    </Text>
                  </View>
                )}
                <View style={{
                  width: sz, height: sz, borderRadius: sz / 2,
                  overflow: "hidden", backgroundColor: "#D1E4F8",
                  borderWidth: isTop3 ? 2 : 0,
                  borderColor: isTop3 ? MEDAL_BORDER[idx] : "transparent",
                  marginBottom: 6,
                }}>
                  {creator.profile_image_url ? (
                    <Image source={{ uri: creator.profile_image_url }} style={{ width: sz, height: sz }} />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="person" size={sz * 0.5} color="#4D9FFF" />
                    </View>
                  )}
                  {creator.is_online && (
                    <View style={{
                      position: "absolute", bottom: 2, right: 2,
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: "#22C55E", borderWidth: 1.5, borderColor: "#fff",
                    }} />
                  )}
                </View>
                <Text
                  style={{ fontSize: isTop3 ? 12 : 11, fontWeight: isTop3 ? "700" : "500", color: "#1B2A4A", textAlign: "center" }}
                  numberOfLines={1}
                >
                  {creator.display_name}
                </Text>
                <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                  {creator.total_sec >= 3600
                    ? `${Math.floor(creator.total_sec / 3600)}시간`
                    : `${Math.floor(creator.total_sec / 60)}분`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const AGE_CATEGORIES = ["전체", "20대", "30대", "40대"];
const BLUE_VIBES = ["전체", "청순", "큐티", "활발", "지적", "섹시", "털털"];
const RED_VIBES = ["전체", "청순", "큐티", "섹시", "댄서", "연기", "리더", "큐레이터", "교복룩", "티처"];

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
};

function Chip({ label, active, onPress, color }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1.5,
        backgroundColor: active ? color : "#F5F5FA",
        borderColor: active ? color : "#E5E5F0",
        marginRight: 6,
        marginBottom: 6,
      }}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: 12, fontWeight: active ? "700" : "500", color: active ? "#fff" : "#666" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

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

  const [selectedAge, setSelectedAge] = useState("전체");
  const [selectedVibes, setSelectedVibes] = useState<string[]>(["전체"]);
  const [categoryOpen, setCategoryOpen] = useState(true);

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
  const vibeOptions = mode === "blue" ? BLUE_VIBES : RED_VIBES;
  const modeColor = mode === "blue" ? "#4D9FFF" : "#FF5C7A";

  const handleModeChange = (m: FeedMode) => {
    setMode(m);
    setSelectedAge("전체");
    setSelectedVibes(["전체"]);
    setSearchText("");
    setIsSearching(false);
  };

  const toggleCategoryOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategoryOpen((prev) => !prev);
  };

  const handleAgeSelect = (age: string) => {
    setSelectedAge(age);
    setPage(1);
  };

  const handleVibeToggle = (vibe: string) => {
    if (vibe === "전체") {
      setSelectedVibes(["전체"]);
    } else {
      setSelectedVibes((prev) => {
        const without = prev.filter((v) => v !== "전체");
        if (without.includes(vibe)) {
          const next = without.filter((v) => v !== vibe);
          return next.length === 0 ? ["전체"] : next;
        } else {
          return [...without, vibe];
        }
      });
    }
    setPage(1);
  };

  const buildCategoryParams = useCallback(() => {
    const parts: string[] = [];
    if (selectedAge !== "전체") parts.push(selectedAge);
    if (!selectedVibes.includes("전체")) parts.push(...selectedVibes);
    return parts.join(",");
  }, [selectedAge, selectedVibes]);

  const loadFeed = useCallback(
    async (nextPage: number, append: boolean) => {
      try {
        if (!append) setLoading(true);
        const cats = buildCategoryParams();
        const catParam = cats ? `&category=${encodeURIComponent(cats)}` : "";
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
    [mode, buildCategoryParams, setFeed, appendFeed, setLoading]
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
    loadFeed(1, false);
  }, [mode, selectedAge, selectedVibes]);

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

  const activeVibeCount = selectedVibes.includes("전체") ? 0 : selectedVibes.length;
  const hasActiveFilter = selectedAge !== "전체" || !selectedVibes.includes("전체");

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Text className="text-navy text-lg font-bold">wantsome</Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.push("/charge")} activeOpacity={0.8}>
            <PointBadge points={points} />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-9 h-9 items-center justify-center"
            onPress={() => router.push("/notifications" as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#1B2A4A" />
          </TouchableOpacity>
        </View>
      </View>

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

      <View className="px-4 pb-3 bg-white">
        <ModeTab
          mode={mode}
          onModeChange={handleModeChange}
          canAccessRed={canAccessRed}
        />
      </View>

      {!isSearching && (
        <View className="bg-white border-b border-gray-100">
          <TouchableOpacity
            onPress={toggleCategoryOpen}
            className="flex-row items-center justify-between px-4 pt-2 pb-1"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xs font-semibold text-gray-500">카테고리</Text>
              {hasActiveFilter && (
                <View
                  style={{
                    backgroundColor: modeColor,
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                    {(selectedAge !== "전체" ? 1 : 0) + activeVibeCount}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons
              name={categoryOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          {categoryOpen && (
            <View className="px-4 pb-3">
              <Text className="text-xs text-gray-400 font-medium mb-2">연령대</Text>
              <View className="flex-row flex-wrap mb-3">
                {AGE_CATEGORIES.map((age) => (
                  <Chip
                    key={age}
                    label={age === "전체" ? "# 전체" : `🎂 ${age}`}
                    active={selectedAge === age}
                    onPress={() => handleAgeSelect(age)}
                    color={modeColor}
                  />
                ))}
              </View>

              <Text className="text-xs text-gray-400 font-medium mb-2">
                분위기 <Text style={{ color: "#C8C8D8" }}>(중복 선택 가능)</Text>
              </Text>
              <View className="flex-row flex-wrap">
                {vibeOptions.map((vibe) => (
                  <Chip
                    key={vibe}
                    label={vibe === "전체" ? "# 전체" : `# ${vibe}`}
                    active={selectedVibes.includes(vibe)}
                    onPress={() => handleVibeToggle(vibe)}
                    color={modeColor}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {isSearching && (
        <View className="px-4 py-2 bg-gray-50">
          <Text className="text-gray-400 text-xs">
            "{searchText}" 검색 결과 {searchResults.length}명
          </Text>
        </View>
      )}

      {isSearching && searchLoading ? (
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
          ListHeaderComponent={!isSearching ? (
            <View>
              <BannerCarousel />
              <CheckInCard />
              <RankingSection mode={mode} />
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 14 }}>👥</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#1B2A4A" }}>크리에이터</Text>
              </View>
            </View>
          ) : null}
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
