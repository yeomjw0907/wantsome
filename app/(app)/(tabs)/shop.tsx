import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { usePointStore } from "@/stores/usePointStore";
import { ProductDetailSheet, type ProductDetail } from "@/components/shop/ProductDetailSheet";

const PAGE_SIZE = 20;

const CATEGORIES = [
  { key: "all", label: "전체", icon: "apps-outline" },
  { key: "general", label: "일반", icon: "gift-outline" },
  { key: "digital", label: "디지털", icon: "download-outline" },
  { key: "adult", label: "프리미엄", icon: "flame-outline" },
] as const;

const SELLER_FILTERS = [
  { key: "all", label: "전체" },
  { key: "company", label: "공식" },
  { key: "creator", label: "크리에이터" },
] as const;

interface ProductListItem {
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

function ProductCard({
  product,
  onPress,
}: {
  product: ProductListItem;
  onPress: () => void;
}) {
  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round((1 - product.price / product.original_price) * 100)
      : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={{
        flex: 1,
        margin: 4,
        overflow: "hidden",
        borderRadius: 18,
        backgroundColor: "#fff",
        shadowColor: "#0F172A",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: "#F8FAFC" }}>
        {product.images[0] ? (
          <Image source={{ uri: product.images[0] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="image-outline" size={36} color="#CBD5E1" />
          </View>
        )}

        {discount ? (
          <View
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              borderRadius: 999,
              backgroundColor: "#FF5C7A",
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>-{discount}%</Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: 12 }}>
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            backgroundColor: product.owner_type === "creator" ? "#FFF3F7" : "#F3F4F6",
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: product.owner_type === "creator" ? "#FF5C7A" : "#6B7280",
            }}
          >
            {product.owner_type === "creator"
              ? product.creator_display_name ?? "크리에이터 상품"
              : "공식 상품"}
          </Text>
        </View>

        <Text
          style={{
            marginTop: 10,
            fontSize: 14,
            fontWeight: "700",
            color: "#111827",
            lineHeight: 20,
          }}
          numberOfLines={2}
        >
          {product.name}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#FF5C7A" }}>
            {product.price.toLocaleString()}P
          </Text>
          {product.original_price && product.original_price > product.price ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: "#94A3B8",
                textDecorationLine: "line-through",
              }}
            >
              {product.original_price.toLocaleString()}P
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <Text style={{ fontSize: 11, color: "#94A3B8" }}>판매 {product.sold_count.toLocaleString()}건</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827" }}>상세보기</Text>
            <Ionicons name="chevron-forward" size={14} color="#111827" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { points, deductPoints } = usePointStore();

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [buying, setBuying] = useState(false);

  const loadProducts = useCallback(
    async (
      nextPage: number,
      append: boolean,
      nextCategory = category,
      nextQuery = searchQuery,
      nextSeller = sellerFilter,
    ) => {
      try {
        if (!append) {
          setIsLoading(true);
        }

        const categoryParam = nextCategory !== "all" ? `&category=${nextCategory}` : "";
        const queryParam = nextQuery ? `&q=${encodeURIComponent(nextQuery)}` : "";
        const sellerParam = nextSeller !== "all" ? `&owner_type=${nextSeller}` : "";

        const data = await apiCall<{ products: ProductListItem[]; hasMore: boolean }>(
          `/api/products?page=${nextPage}&limit=${PAGE_SIZE}${categoryParam}${queryParam}${sellerParam}`,
        );

        if (append) {
          setProducts((prev) => [...prev, ...(data.products ?? [])]);
        } else {
          setProducts(data.products ?? []);
        }

        setHasMore(data.hasMore ?? false);
        setPage(nextPage);
      } catch {
        Toast.show({ type: "error", text1: "샵", text2: "상품을 불러오지 못했습니다." });
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [category, searchQuery, sellerFilter],
  );

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    loadProducts(1, false, category, searchQuery, sellerFilter);
  }, [category, loadProducts, searchQuery, sellerFilter]);

  const openProduct = useCallback(async (productId: string) => {
    setDetailVisible(true);
    setDetailLoading(true);

    try {
      const data = await apiCall<{ product: ProductDetail }>(`/api/products/${productId}`);
      setSelectedProduct(data.product);
    } catch {
      setSelectedProduct(null);
      Toast.show({ type: "error", text1: "샵", text2: "상품 상세를 불러오지 못했습니다." });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeProduct = () => {
    setDetailVisible(false);
    setSelectedProduct(null);
    setDetailLoading(false);
    setBuying(false);
  };

  const handleSearch = () => {
    setSearchQuery(searchText.trim());
    setPage(1);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts(1, false);
  };

  const onEndReached = () => {
    if (isLoading || !hasMore) {
      return;
    }

    loadProducts(page + 1, true);
  };

  const handleBuy = async (product: ProductDetail) => {
    if (buying) {
      return;
    }

    if (points < product.price) {
      Alert.alert("포인트 부족", `${(product.price - points).toLocaleString()}P가 부족합니다.\n충전 후 다시 시도해주세요.`);
      return;
    }

    Alert.alert("구매 확인", `"${product.name}"\n${product.price.toLocaleString()}P를 사용합니다.`, [
      { text: "취소", style: "cancel" },
      {
        text: "구매",
        onPress: async () => {
          setBuying(true);
          try {
            await apiCall("/api/orders", {
              method: "POST",
              body: JSON.stringify({ product_id: product.id, quantity: 1 }),
            });

            deductPoints(product.price);
            setSelectedProduct((prev) =>
              prev ? { ...prev, sold_count: prev.sold_count + 1 } : prev,
            );
            setProducts((prev) =>
              prev.map((item) =>
                item.id === product.id ? { ...item, sold_count: item.sold_count + 1 } : item,
              ),
            );

            Toast.show({ type: "success", text1: "구매 완료", text2: "구매 내역에서 확인할 수 있습니다." });
            closeProduct();
          } catch (error) {
            const message = error instanceof Error ? error.message : "구매에 실패했습니다.";
            Toast.show({ type: "error", text1: "구매 실패", text2: message });
          } finally {
            setBuying(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC", paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827" }}>샵</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            backgroundColor: "#F8FAFC",
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <Ionicons name="wallet-outline" size={15} color="#FF5C7A" />
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#111827" }}>{points.toLocaleString()}P</Text>
        </View>
      </View>

      <View style={{ backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderRadius: 18,
            backgroundColor: "#F8FAFC",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            placeholder="상품을 검색해보세요"
            placeholderTextColor="#94A3B8"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={{ flex: 1, fontSize: 14, color: "#111827" }}
          />
          {searchText.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setSearchText("");
                setSearchQuery("");
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={{ backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}
        >
          {CATEGORIES.map((item) => {
            const active = category === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setCategory(item.key)}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  backgroundColor: active ? "#111827" : "#F3F4F6",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Ionicons name={item.icon} size={14} color={active ? "#fff" : "#6B7280"} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#fff" : "#6B7280" }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ backgroundColor: "#fff", paddingHorizontal: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {SELLER_FILTERS.map((item) => {
            const active = sellerFilter === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setSellerFilter(item.key)}
                activeOpacity={0.85}
                style={{
                  borderRadius: 999,
                  backgroundColor: active ? "#FF5C7A" : "#F8FAFC",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : "#64748B" }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoading && products.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#FF5C7A" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductCard product={item} onPress={() => openProduct(item.id)} />}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 8 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.45}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C7A" />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 120 }}>
              <Ionicons name="bag-outline" size={46} color="#CBD5E1" />
              <Text style={{ marginTop: 12, fontSize: 16, fontWeight: "700", color: "#94A3B8" }}>
                {searchQuery ? "검색 결과가 없습니다" : "등록된 상품이 없습니다"}
              </Text>
              <Text style={{ marginTop: 6, fontSize: 13, color: "#A8B0BE" }}>
                {searchQuery ? "다른 검색어로 다시 시도해보세요." : "새 상품이 등록되면 여기에 표시됩니다."}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoading && products.length > 0 ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#FF5C7A" />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <ProductDetailSheet
        visible={detailVisible}
        product={selectedProduct}
        loading={detailLoading}
        onClose={closeProduct}
        onBuy={handleBuy}
        buying={buying}
      />
    </View>
  );
}
