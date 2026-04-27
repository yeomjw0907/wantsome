/**
 * 구매 내역 화면
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";

const PAGE_SIZE = 20;

interface Order {
  id: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  products: {
    id: string;
    name: string;
    images: string[];
    price: number;
    category: string;
  } | null;
}

function OrderItem({ order }: { order: Order }) {
  const date = new Date(order.created_at);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5FA",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#F5F5FA",
        }}
      >
        {order.products?.images?.[0] ? (
          <Image
            source={{ uri: order.products.images[0] }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="image-outline" size={24} color="#C8C8D8" />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B2A4A" }} numberOfLines={2}>
          {order.products?.name ?? "상품 정보 없음"}
        </Text>
        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
          수량 {order.quantity}개 · {dateStr}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#FF6B9D" }}>
          -{order.total_price.toLocaleString()}P
        </Text>
        <View
          style={{
            marginTop: 4,
            backgroundColor: "#F0FDF4",
            borderRadius: 8,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#22C55E" }}>완료</Text>
        </View>
      </View>
    </View>
  );
}

export default function PurchasesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [isLoading,  setIsLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async (nextPage: number, append: boolean) => {
    try {
      if (!append) setIsLoading(true);
      const data = await apiCall<{ orders: Order[]; hasMore: boolean }>(
        `/api/orders?page=${nextPage}&limit=${PAGE_SIZE}`
      );
      if (append) {
        setOrders((prev) => [...prev, ...(data.orders ?? [])]);
      } else {
        setOrders(data.orders ?? []);
      }
      setHasMore(data.hasMore ?? false);
      setPage(nextPage);
    } catch {
      Toast.show({ type: "error", text1: "구매 내역을 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadOrders(1, false); }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders(1, false);
  };

  const onEndReached = () => {
    if (isLoading || !hasMore) return;
    loadOrders(page + 1, true);
  };

  const keyExtractor = (item: Order) => item.id;
  const renderItem = ({ item }: { item: Order }) => <OrderItem order={item} />;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold">구매 내역</Text>
      </View>

      {isLoading && orders.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="bag-handle-outline" size={48} color="#C8C8D8" />
              <Text className="text-gray-400 text-base font-semibold mt-4">
                구매 내역이 없습니다
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoading && orders.length > 0 ? (
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
