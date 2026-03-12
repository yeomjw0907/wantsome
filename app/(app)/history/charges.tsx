/**
 * 충전 내역 화면
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";

interface Charge {
  id: string;
  amount: number;
  points: number;
  product_name: string;
  status: "PAID" | "PENDING" | "FAILED";
  created_at: string;
  payment_method?: string;
}

const STATUS_CONFIG = {
  PAID: { label: "결제 완료", color: "#22C55E" },
  PENDING: { label: "처리 중", color: "#F59E0B" },
  FAILED: { label: "실패", color: "#FF5C7A" },
};

export default function ChargesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [charges, setCharges] = useState<Charge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);

  const loadCharges = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setPage(1);
    } else {
      setIsLoading(true);
    }

    try {
      const p = refresh ? 1 : page;
      const data = await apiCall<{
        charges: Charge[];
        total: number;
        hasMore: boolean;
      }>(`/api/users/me/charges?page=${p}`);

      if (refresh || p === 1) {
        setCharges(data.charges ?? []);
        // 총 충전 포인트 집계
        const total = (data.charges ?? []).reduce((sum, c) => {
          return c.status === "PAID" ? sum + c.points : sum;
        }, 0);
        setTotalPoints(total);
      } else {
        setCharges((prev) => [...prev, ...(data.charges ?? [])]);
      }
      setHasMore(data.hasMore);
    } catch {
      Toast.show({ type: "error", text1: "내역을 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page]);

  useEffect(() => { loadCharges(); }, []);

  const loadMore = () => {
    if (!hasMore || isLoading) return;
    setPage((p) => p + 1);
  };

  useEffect(() => {
    if (page > 1) loadCharges();
  }, [page]);

  const renderItem = ({ item }: { item: Charge }) => {
    const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PAID;
    const date = new Date(item.created_at);

    return (
      <View className="bg-white rounded-2xl px-4 py-3.5 mb-2.5 flex-row items-center">
        {/* 왼쪽 아이콘 */}
        <View className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: "#FF6B9D15" }}>
          <Ionicons name="card-outline" size={18} color="#FF6B9D" />
        </View>

        {/* 정보 */}
        <View className="flex-1">
          <Text className="text-navy text-sm font-semibold">{item.product_name}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">
            {date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: statusCfg.color }}>
            {statusCfg.label}
          </Text>
        </View>

        {/* 오른쪽: 포인트 */}
        <View className="items-end">
          <Text className="text-pink text-base font-bold">+{item.points.toLocaleString()}P</Text>
          <Text className="text-gray-400 text-xs">{item.amount.toLocaleString()}원</Text>
        </View>
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
        <Text className="text-navy text-lg font-bold">충전 내역</Text>
      </View>

      {isLoading && charges.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={charges}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            charges.length > 0 ? (
              <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center justify-between">
                <Text className="text-gray-500 text-sm">총 충전 포인트</Text>
                <Text className="text-pink text-xl font-bold">{totalPoints.toLocaleString()}P</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="card-outline" size={40} color="#C8C8D8" />
              <Text className="text-gray-400 mt-4">충전 내역이 없습니다.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadCharges(true)}
              tintColor="#FF6B9D"
            />
          }
          onEndReached={loadMore}
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
