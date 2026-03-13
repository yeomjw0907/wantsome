/**
 * 쇼핑 탭 — 포인트로 구매하는 상품 목록
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiCall } from "@/lib/api";
import { usePointStore } from "@/stores/usePointStore";
import Toast from "react-native-toast-message";

const PAGE_SIZE = 20;

const CATEGORIES = [
  { key: "all",     label: "전체",   icon: "apps-outline" },
  { key: "general", label: "일반",   icon: "gift-outline" },
  { key: "digital", label: "디지털", icon: "download-outline" },
  { key: "adult",   label: "성인",   icon: "flame-outline" },
];

const SELLER_FILTERS = [
  { key: "all",     label: "전체" },
  { key: "company", label: "🌸 원썸" },
  { key: "creator", label: "⭐ 크리에이터" },
];

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price?: number;
  category: string;
  owner_type: "company" | "creator";
  creator_id: string | null;
  creator_display_name?: string | null;
  tags: string[];
  images: string[];
  stock: number;
  sold_count: number;
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        margin: 4,
        backgroundColor: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
      activeOpacity={0.85}
    >
      {/* 이미지 */}
      <View style={{ aspectRatio: 1, backgroundColor: "#F5F5FA" }}>
        {product.images[0] ? (
          <Image
            source={{ uri: product.images[0] }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="image-outline" size={36} color="#C8C8D8" />
          </View>
        )}
        {discount && (
          <View style={{
            position: "absolute", top: 8, left: 8,
            backgroundColor: "#FF5C7A", borderRadius: 8,
            paddingHorizontal: 6, paddingVertical: 2,
          }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>-{discount}%</Text>
          </View>
        )}
      </View>

      {/* 정보 */}
      <View style={{ padding: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#1B2A4A" }} numberOfLines={2}>
          {product.name}
        </Text>
        {product.original_price && product.original_price > product.price && (
          <Text style={{ fontSize: 11, color: "#C8C8D8", textDecorationLine: "line-through", marginTop: 2 }}>
            {product.original_price.toLocaleString()}P
          </Text>
        )}
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#FF6B9D", marginTop: 2 }}>
          {product.price.toLocaleString()}P
        </Text>
        {product.sold_count > 0 && (
          <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
            {product.sold_count.toLocaleString()}개 판매
          </Text>
        )}
        {/* 판매자 뱃지 */}
        <View style={{ marginTop: 6 }}>
          {product.owner_type === "creator" ? (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: "#FFF8FB", borderRadius: 8,
              paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start",
            }}>
              <Text style={{ fontSize: 9 }}>⭐</Text>
              <Text style={{ fontSize: 10, fontWeight: "600", color: "#FF6B9D" }} numberOfLines={1}>
                {product.creator_display_name ?? "크리에이터"}
              </Text>
            </View>
          ) : (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: "#F3F4F6", borderRadius: 8,
              paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start",
            }}>
              <Text style={{ fontSize: 9 }}>🌸</Text>
              <Text style={{ fontSize: 10, fontWeight: "600", color: "#6B7280" }}>원썸</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { points, setPoints } = usePointStore();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [isLoading,   setIsLoading]   = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [category,    setCategory]    = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [searchText,  setSearchText]  = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [buying,      setBuying]      = useState<string | null>(null);

  const loadProducts = useCallback(async (
    nextPage: number, append: boolean,
    cat = category, q = searchQuery, seller = sellerFilter
  ) => {
    try {
      if (!append) setIsLoading(true);
      const catParam    = cat !== "all"    ? `&category=${cat}` : "";
      const qParam      = q               ? `&q=${encodeURIComponent(q)}` : "";
      const sellerParam = seller !== "all" ? `&owner_type=${seller}` : "";
      const data = await apiCall<{ products: Product[]; hasMore: boolean }>(
        `/api/products?page=${nextPage}&limit=${PAGE_SIZE}${catParam}${qParam}${sellerParam}`
      );
      if (append) {
        setProducts((prev) => [...prev, ...(data.products ?? [])]);
      } else {
        setProducts(data.products ?? []);
      }
      setHasMore(data.hasMore ?? false);
      setPage(nextPage);
    } catch {
      Toast.show({ type: "error", text1: "상품을 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [category, searchQuery, sellerFilter]);

  useEffect(() => {
    setPage(1);
    setProducts([]);
    loadProducts(1, false, category, searchQuery, sellerFilter);
  }, [category, searchQuery, sellerFilter]);

  const handleSearch = () => {
    setSearchQuery(searchText.trim());
    setPage(1);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts(1, false);
  };

  const onEndReached = () => {
    if (isLoading || !hasMore) return;
    loadProducts(page + 1, true);
  };

  const handleBuy = async (product: Product) => {
    if (points < product.price) {
      Alert.alert("포인트 부족", `${(product.price - points).toLocaleString()}P가 부족합니다.\n충전 후 다시 시도해주세요.`);
      return;
    }
    Alert.alert(
      "구매 확인",
      `"${product.name}"\n${product.price.toLocaleString()}P를 사용합니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "구매",
          onPress: async () => {
            setBuying(product.id);
            try {
              await apiCall("/api/orders", {
                method: "POST",
                body: JSON.stringify({ product_id: product.id, quantity: 1 }),
              });
              setPoints(points - product.price);
              setProducts((prev) =>
                prev.map((p) => p.id === product.id ? { ...p, sold_count: p.sold_count + 1 } : p)
              );
              Toast.show({ type: "success", text1: "구매 완료!", text2: "구매 내역에서 확인하세요." });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "구매에 실패했습니다.";
              Toast.show({ type: "error", text1: "구매 실패", text2: msg });
            } finally {
              setBuying(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard product={item} onPress={() => handleBuy(item)} />
    ),
    [handleBuy]
  );

  const keyExtractor = (item: Product) => item.id;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Text className="text-navy text-lg font-bold">쇼핑</Text>
        <View className="flex-row items-center gap-1 bg-gray-100 rounded-full px-3 py-1.5">
          <Ionicons name="wallet-outline" size={14} color="#FF6B9D" />
          <Text className="text-sm font-bold text-navy">{points.toLocaleString()}P</Text>
        </View>
      </View>

      {/* 검색바 */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <View className="flex-row items-center bg-gray-100 rounded-2xl px-3 py-2 gap-2">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="상품 검색..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={{ flex: 1, fontSize: 14, color: "#1B2A4A" }}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(""); setSearchQuery(""); }}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 카테고리 탭 */}
      <View className="bg-white border-b border-gray-100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={{
                  flexDirection: "row", alignItems: "center",
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: active ? "#FF6B9D" : "#F5F5FA", gap: 5,
                }}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.icon as any} size={14} color={active ? "#fff" : "#9CA3AF"} />
                <Text style={{ fontSize: 13, fontWeight: active ? "700" : "500", color: active ? "#fff" : "#666" }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 판매자 필터 */}
      <View style={{ backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F8", paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {SELLER_FILTERS.map((sf) => {
            const active = sellerFilter === sf.key;
            return (
              <TouchableOpacity
                key={sf.key}
                onPress={() => setSellerFilter(sf.key)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
                  backgroundColor: active ? "#1B2A4A" : "#F3F4F6",
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12, fontWeight: active ? "700" : "500", color: active ? "#fff" : "#6B7280" }}>
                  {sf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoading && products.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 8 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="bag-outline" size={48} color="#C8C8D8" />
              <Text className="text-gray-400 text-base font-semibold mt-4">
                {searchQuery ? "검색 결과가 없습니다" : "등록된 상품이 없습니다"}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoading && products.length > 0 ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#FF6B9D" />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
