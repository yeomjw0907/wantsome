/**
 * 즐겨찾기 화면 — 팔로우한 크리에이터 목록
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import { useFavoriteStore } from "@/stores/useFavoriteStore";
import Toast from "react-native-toast-message";

interface FavoriteCreator {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  grade: string;
  is_online: boolean;
  avg_rating: number;
  categories: string[];
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toggle, isFavorited } = useFavoriteStore();
  const [creators, setCreators] = useState<FavoriteCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiCall<{ favorites: FavoriteCreator[] }>("/api/favorites");
      setCreators(data.favorites ?? []);
    } catch {
      Toast.show({ type: "error", text1: "즐겨찾기를 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRemove = async (creatorId: string) => {
    await toggle(creatorId);
    setCreators((prev) => prev.filter((c) => c.id !== creatorId));
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold">즐겨찾기</Text>
        <Text className="ml-2 text-gray-400 text-sm">({creators.length})</Text>
      </View>

      <FlatList
        data={creators}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF6B9D" />
        }
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="heart-outline" size={48} color="#C8C8D8" />
            <Text className="text-gray-400 text-base font-semibold mt-4">
              아직 즐겨찾기가 없어요
            </Text>
            <Text className="text-gray-300 text-sm mt-1">
              마음에 드는 크리에이터를 저장해보세요
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white rounded-2xl p-4 flex-row items-center"
            onPress={() => router.push(`/creator/${item.id}` as any)}
            activeOpacity={0.8}
          >
            <View className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 mr-4">
              {item.profile_image_url ? (
                <Image source={{ uri: item.profile_image_url }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Ionicons name="person" size={24} color="#C8C8D8" />
                </View>
              )}
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-navy font-bold">{item.display_name}</Text>
                {item.is_online && (
                  <View className="w-2 h-2 rounded-full bg-green-400" />
                )}
              </View>
              {item.avg_rating > 0 && (
                <Text className="text-yellow-500 text-xs mt-0.5">
                  ★ {item.avg_rating.toFixed(1)}
                </Text>
              )}
              {item.categories.length > 0 && (
                <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
                  {item.categories.slice(0, 3).join(" · ")}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => handleRemove(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="heart" size={22} color="#FF6B9D" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
