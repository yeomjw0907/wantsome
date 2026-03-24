import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface ProductDetail {
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

interface ProductDetailSheetProps {
  visible: boolean;
  product: ProductDetail | null;
  loading: boolean;
  onClose: () => void;
  onBuy: (product: ProductDetail) => void;
  buying: boolean;
}

export function ProductDetailSheet({
  visible,
  product,
  loading,
  onClose,
  onBuy,
  buying,
}: ProductDetailSheetProps) {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
  }, [product?.id]);

  const discount = useMemo(() => {
    if (!product?.original_price || product.original_price <= product.price) {
      return null;
    }

    return Math.round((1 - product.price / product.original_price) * 100);
  }, [product]);

  const currentImage = product?.images?.[activeImage] ?? product?.images?.[0] ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(15, 23, 42, 0.42)",
        }}
      >
        <View
          style={{
            maxHeight: "88%",
            backgroundColor: "#fff",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 18,
                paddingBottom: 12,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>상품 상세</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.75}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={{ paddingVertical: 120, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#FF6B9D" />
              </View>
            ) : product ? (
              <>
                <View style={{ marginHorizontal: 20, borderRadius: 24, overflow: "hidden", backgroundColor: "#F8FAFC" }}>
                  <View style={{ aspectRatio: 1 }}>
                    {currentImage ? (
                      <Image source={{ uri: currentImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="image-outline" size={42} color="#CBD5E1" />
                      </View>
                    )}
                  </View>
                </View>

                {product.images.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, gap: 8 }}
                  >
                    {product.images.map((image, index) => (
                      <TouchableOpacity
                        key={`${product.id}-${index}`}
                        onPress={() => setActiveImage(index)}
                        activeOpacity={0.85}
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: 14,
                          overflow: "hidden",
                          borderWidth: activeImage === index ? 2 : 1,
                          borderColor: activeImage === index ? "#FF6B9D" : "#E5E7EB",
                        }}
                      >
                        <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {discount ? (
                      <View
                        style={{
                          borderRadius: 999,
                          backgroundColor: "#FFE3EA",
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#FF4D6D" }}>-{discount}%</Text>
                      </View>
                    ) : null}
                    <View
                      style={{
                        borderRadius: 999,
                        backgroundColor: product.owner_type === "creator" ? "#FFF3F7" : "#F3F4F6",
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: product.owner_type === "creator" ? "#FF5C7A" : "#6B7280",
                        }}
                      >
                        {product.owner_type === "creator"
                          ? product.creator_display_name ?? "크리에이터 상품"
                          : "공식 상품"}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ marginTop: 14, fontSize: 22, fontWeight: "800", color: "#111827" }}>{product.name}</Text>

                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 14 }}>
                    <Text style={{ fontSize: 24, fontWeight: "800", color: "#FF5C7A" }}>
                      {product.price.toLocaleString()}P
                    </Text>
                    {product.original_price && product.original_price > product.price ? (
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#94A3B8",
                          textDecorationLine: "line-through",
                        }}
                      >
                        {product.original_price.toLocaleString()}P
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 }}>
                    <Text style={{ fontSize: 13, color: "#64748B" }}>
                      판매 {product.sold_count.toLocaleString()}건
                    </Text>
                    <Text style={{ fontSize: 13, color: "#64748B" }}>
                      재고 {product.stock === -1 ? "무제한" : `${product.stock}개`}
                    </Text>
                  </View>

                  {product.tags.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                      {product.tags.map((tag) => (
                        <View
                          key={tag}
                          style={{
                            borderRadius: 999,
                            backgroundColor: "#F8FAFC",
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569" }}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View
                    style={{
                      marginTop: 20,
                      borderRadius: 20,
                      backgroundColor: "#F8FAFC",
                      padding: 16,
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>상품 설명</Text>
                    <Text style={{ fontSize: 14, lineHeight: 22, color: "#475569" }}>
                      {product.description?.trim() || "등록된 상품 설명이 없습니다."}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => onBuy(product)}
                    activeOpacity={0.88}
                    disabled={buying}
                    style={{
                      marginTop: 20,
                      borderRadius: 18,
                      backgroundColor: buying ? "#CBD5E1" : "#FF5C7A",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 16,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                      {buying ? "구매 처리 중..." : `${product.price.toLocaleString()}P로 구매하기`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ paddingVertical: 120, alignItems: "center" }}>
                <Ionicons name="alert-circle-outline" size={36} color="#CBD5E1" />
                <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "700", color: "#64748B" }}>
                  상품 정보를 불러오지 못했습니다.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
