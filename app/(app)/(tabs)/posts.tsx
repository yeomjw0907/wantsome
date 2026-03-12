/**
 * 피드 탭 — 인스타그램형 포스트 피드
 * - 전체 크리에이터 포스트 최신순
 * - 더블탭 좋아요, 이미지 캐러셀
 * - 크리에이터 전용: 우상단 + 버튼으로 포스트 작성
 */
import React, { useCallback, useEffect, useState } from "react";
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
import { PostCard, type PostItem } from "@/components/posts/PostCard";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import Toast from "react-native-toast-message";

const PAGE_SIZE = 15;

export default function PostsFeedScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { user } = useAuthStore();
  const isCreator = user?.role === "creator" || user?.role === "both";

  const [posts,      setPosts]      = useState<PostItem[]>([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [isLoading,  setIsLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async (nextPage: number, append: boolean) => {
    try {
      if (!append) setIsLoading(true);
      const data = await apiCall<{ posts: PostItem[]; hasMore: boolean }>(
        `/api/posts/feed?page=${nextPage}&limit=${PAGE_SIZE}`
      );
      if (append) {
        setPosts((prev) => [...prev, ...(data.posts ?? [])]);
      } else {
        setPosts(data.posts ?? []);
      }
      setHasMore(data.hasMore ?? false);
      setPage(nextPage);
    } catch {
      Toast.show({ type: "error", text1: "피드를 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPosts(1, false); }, [loadPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts(1, false);
  }, [loadPosts]);

  const onEndReached = useCallback(() => {
    if (isLoading || !hasMore) return;
    loadPosts(page + 1, true);
  }, [isLoading, hasMore, page, loadPosts]);

  const handleLikeToggle = useCallback(
    (postId: string, liked: boolean, newCount: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, is_liked: liked, like_count: newCount } : p
        )
      );
    },
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: PostItem }) => (
      <PostCard item={item} onLikeToggle={handleLikeToggle} />
    ),
    [handleLikeToggle]
  );

  const keyExtractor = useCallback((item: PostItem) => item.id, []);

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 상단 바 */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Text className="text-navy text-lg font-bold">피드</Text>
        {isCreator && (
          <TouchableOpacity
            onPress={() => router.push("/(app)/post/create" as any)}
            className="w-9 h-9 items-center justify-center rounded-full bg-pink"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* 피드 목록 */}
      {isLoading && posts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B9D"
            />
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: "#F0F0F5" }} />
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="images-outline" size={48} color="#C8C8D8" />
              <Text className="text-gray-400 text-base font-semibold mt-4 mb-2">
                아직 게시물이 없어요
              </Text>
              <Text className="text-gray-300 text-sm text-center px-8">
                크리에이터들이 일상을 공유하면 여기에 보입니다
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoading && posts.length > 0 ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#FF6B9D" />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </View>
  );
}
