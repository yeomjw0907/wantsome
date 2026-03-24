import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { PostCard, type PostItem } from "@/components/posts/PostCard";

type SortKey = "newest" | "likes" | "views";

const PAGE_SIZE = 15;
const SORT_OPTIONS: { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "newest", label: "최신순", icon: "time-outline" },
  { key: "likes", label: "좋아요순", icon: "heart-outline" },
  { key: "views", label: "조회수순", icon: "eye-outline" },
];

export function PostsFeedPanel() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isCreator = user?.role === "creator" || user?.role === "both";

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");

  const loadPosts = useCallback(
    async (nextPage: number, append: boolean, sortKey: SortKey = sort) => {
      try {
        if (!append) {
          setIsLoading(true);
        }

        const data = await apiCall<{ posts: PostItem[]; hasMore: boolean }>(
          `/api/posts/feed?page=${nextPage}&limit=${PAGE_SIZE}&sort=${sortKey}`,
        );

        if (append) {
          setPosts((prev) => [...prev, ...(data.posts ?? [])]);
        } else {
          setPosts(data.posts ?? []);
        }

        setHasMore(data.hasMore ?? false);
        setPage(nextPage);
      } catch {
        Toast.show({ type: "error", text1: "피드", text2: "게시글을 불러오지 못했습니다." });
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [sort],
  );

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    loadPosts(1, false, sort);
  }, [loadPosts, sort]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts(1, false, sort);
  }, [loadPosts, sort]);

  const onEndReached = useCallback(() => {
    if (isLoading || !hasMore) {
      return;
    }

    loadPosts(page + 1, true, sort);
  }, [hasMore, isLoading, loadPosts, page, sort]);

  const handleLikeToggle = useCallback((postId: string, liked: boolean, newCount: number) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, is_liked: liked, like_count: newCount } : post,
      ),
    );
  }, []);

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PostCard item={item} onLikeToggle={handleLikeToggle} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" />}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#F0F0F5" }} />}
      ListHeaderComponent={
        <View style={{ backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>피드</Text>
            {isCreator ? (
              <TouchableOpacity
                onPress={() => router.push("/(app)/post/create" as any)}
                activeOpacity={0.85}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FF6B9D",
                }}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setSort(option.key)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    backgroundColor: active ? "#111827" : "#F3F4F6",
                  }}
                >
                  <Ionicons name={option.icon} size={13} color={active ? "#fff" : "#6B7280"} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: active ? "700" : "600",
                      color: active ? "#fff" : "#6B7280",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <View style={{ paddingVertical: 120, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#FF6B9D" />
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 120 }}>
            <Ionicons name="images-outline" size={44} color="#CBD5E1" />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: "700", color: "#94A3B8" }}>
              게시글이 아직 없습니다
            </Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#A8B0BE" }}>
              새 글이 올라오면 여기에서 바로 볼 수 있습니다.
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        isLoading && posts.length > 0 ? (
          <View style={{ paddingVertical: 18, alignItems: "center" }}>
            <ActivityIndicator size="small" color="#FF6B9D" />
          </View>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
