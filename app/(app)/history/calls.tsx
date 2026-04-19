/**
 * 통화 기록 화면
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { formatModeLabel } from "@/constants/branding";

interface CallRecord {
  id: string;
  mode: "blue" | "red";
  status: string;
  duration_sec: number;
  total_cost: number;
  started_at: string;
  creator_id: string;
  creator: {
    display_name: string;
    profile_image_url: string | null;
  } | null;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}분 ${rem}초` : `${min}분`;
}

export default function CallsHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadCalls = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setPage(1);
    } else {
      setIsLoading(true);
    }

    try {
      const p = refresh ? 1 : page;
      const data = await apiCall<{
        calls: CallRecord[];
        total: number;
        hasMore: boolean;
      }>(`/api/users/me/calls?page=${p}`);

      if (refresh || p === 1) {
        setCalls(data.calls ?? []);
      } else {
        setCalls((prev) => [...prev, ...(data.calls ?? [])]);
      }
      setHasMore(data.hasMore);
    } catch {
      Toast.show({ type: "error", text1: "통화 기록을 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page]);

  useEffect(() => { loadCalls(); }, []);

  useEffect(() => {
    if (page > 1) loadCalls();
  }, [page]);

  const renderItem = ({ item }: { item: CallRecord }) => {
    const date = new Date(item.started_at);
    const creatorName = item.creator?.display_name ?? "크리에이터";
    const avatar = item.creator?.profile_image_url;

    return (
      <View className="bg-white rounded-2xl p-4 mb-2.5 flex-row items-center">
        {/* 프로필 이미지 */}
        <View className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 mr-3">
          {avatar ? (
            <Image source={{ uri: avatar }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Ionicons name="person" size={20} color="#C8C8D8" />
            </View>
          )}
        </View>

        {/* 정보 */}
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-navy text-sm font-semibold">{creatorName}</Text>
            <View
              className="rounded-full px-2 py-0.5 flex-row items-center gap-1"
              style={{ backgroundColor: item.mode === "blue" ? "#EFF6FF" : "#FFF1F3" }}
            >
              <View
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: item.mode === "blue" ? "#4D9FFF" : "#FF5C7A" }}
              />
              <Text
                className="text-xs"
                style={{ color: item.mode === "blue" ? "#4D9FFF" : "#FF5C7A" }}
              >
                {formatModeLabel(item.mode)}
              </Text>
            </View>
          </View>
          <Text className="text-gray-400 text-xs mt-0.5">
            {date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}{" "}
            {date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5">
            {formatDuration(item.duration_sec ?? 0)}
          </Text>
        </View>

        {/* 차감 포인트 */}
        <Text className="text-gray-700 text-base font-bold">
          -{(item.total_cost ?? 0).toLocaleString()}P
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold">통화 기록</Text>
      </View>

      {isLoading && calls.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="videocam-outline" size={40} color="#C8C8D8" />
              <Text className="text-gray-400 mt-4">통화 기록이 없습니다.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadCalls(true)}
              tintColor="#FF6B9D"
            />
          }
          onEndReached={() => {
            if (!hasMore || isLoading) return;
            setPage((p) => p + 1);
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            hasMore ? (
              <ActivityIndicator size="small" color="#FF6B9D" style={{ marginVertical: 16 }} />
            ) : null
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
}
