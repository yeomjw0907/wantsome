import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";
import { PRODUCTS, type ProductId } from "@/constants/products";
import { apiCall } from "@/lib/api";

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

type VerifyIapResponse = {
  success: boolean;
  points_added: number;
  new_balance: number;
  is_first_charged?: boolean;
};

export default function ChargeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  const { points, firstChargeDeadline, isFirstCharged, setPoints, setFirstChargeInfo } =
    usePointStore();

  const [countdown, setCountdown] = useState("");
  const [chargingProductId, setChargingProductId] = useState<ProductId | null>(null);
  const [pendingProductId, setPendingProductId] = useState<ProductId | null>(null);
  const showFirstChargeBanner =
    !isFirstCharged &&
    firstChargeDeadline &&
    new Date(firstChargeDeadline) > new Date();

  useEffect(() => {
    if (!showFirstChargeBanner || !firstChargeDeadline) return;
    const tick = () => {
      const left = new Date(firstChargeDeadline).getTime() - Date.now();
      setCountdown(formatCountdown(left));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showFirstChargeBanner, firstChargeDeadline]);

  const onProductPress = useCallback(
    (productId: ProductId) => {
      if (Platform.OS === "web") {
        Toast.show({ type: "info", text1: "앱에서만 충전할 수 있습니다." });
        return;
      }
      if (!user?.id) {
        Toast.show({ type: "error", text1: "로그인이 필요합니다." });
        return;
      }
      // 구매 동의 확인 모달 표시
      setPendingProductId(productId);
    },
    [user?.id]
  );

  const executePurchase = useCallback(
    async (productId: ProductId) => {
      const userId = user?.id;
      if (!userId) return;

      const idempotencyKey = `${userId}_${productId}_${Date.now()}`;
      const platform = Platform.OS as "ios" | "android";
      setPendingProductId(null);
      setChargingProductId(productId);

      try {
        const res = await apiCall<VerifyIapResponse>("/api/payments/verify-iap", {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            receipt: "dev_mock_receipt",
            platform,
            product_id: productId,
            idempotency_key: idempotencyKey,
          }),
        });

        setPoints(res.new_balance);
        if (res.is_first_charged) {
          setFirstChargeInfo(null, true);
        }
        Toast.show({
          type: "success",
          text1: "충전 완료",
          text2: `+${res.points_added.toLocaleString()}P`,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "충전에 실패했습니다.";
        Toast.show({ type: "error", text1: message });
      } finally {
        setChargingProductId(null);
      }
    },
    [user?.id, setPoints, setFirstChargeInfo]
  );

  const cardWidth = width - 32;

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold flex-1 text-center -mr-10">
          포인트 충전
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 잔여 포인트 */}
        <View className="px-4 pt-6 pb-4">
          <Text className="text-gray-500 text-sm">보유 포인트</Text>
          <Text className="text-navy text-3xl font-bold mt-1">
            {points.toLocaleString()}P
          </Text>
        </View>

        {/* 첫충전 배너 */}
        {showFirstChargeBanner && (
          <View className="mx-4 mb-4 rounded-2xl bg-bluebell px-4 py-3 flex-row items-center justify-between">
            <View>
              <Text className="text-navy font-semibold">첫충전 100% 보너스</Text>
              <Text className="text-gray-500 text-sm mt-0.5">
                {countdown} 내 충전 시 2배
              </Text>
            </View>
            <View className="bg-blue rounded-full px-3 py-1.5">
              <Text className="text-white text-sm font-semibold">2배</Text>
            </View>
          </View>
        )}

        {/* 상품 목록 */}
        <View className="px-4">
          <Text className="text-navy text-lg font-semibold mb-3">충전 상품</Text>
          {PRODUCTS.map((product) => {
            const showFirstBadge = showFirstChargeBanner;
            const displayPoints = showFirstBadge
              ? product.points * 2
              : product.points;
            const isCharging = chargingProductId === product.id;
            return (
              <TouchableOpacity
                key={product.id}
                onPress={() => onProductPress(product.id)}
                disabled={chargingProductId != null}
                activeOpacity={0.85}
                className="mb-3 rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden"
                style={{ width: cardWidth, opacity: chargingProductId != null ? 0.7 : 1 }}
              >
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-navy text-base font-semibold">
                        {product.name}
                      </Text>
                      <View className="bg-pink rounded-full px-2 py-0.5">
                        <Text className="text-white text-xs font-semibold">
                          +{(product.bonus * 100).toFixed(0)}%
                        </Text>
                      </View>
                      {showFirstBadge && (
                        <View
                          className="rounded-full px-2 py-0.5"
                          style={{ backgroundColor: "#FFEEF1" }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: "#FF5C7A" }}
                          >
                            첫충전 2배
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-baseline gap-2 mt-2">
                      <Text className="text-gray-900 text-xl font-bold">
                        {displayPoints.toLocaleString()}P
                      </Text>
                      {showFirstBadge && (
                        <Text className="text-gray-400 text-sm line-through">
                          {product.points.toLocaleString()}P
                        </Text>
                      )}
                    </View>
                    <Text className="text-gray-500 text-sm mt-0.5">
                      {product.price.toLocaleString()}원 결제
                    </Text>
                  </View>
                  <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
                    {isCharging ? (
                      <ActivityIndicator size="small" color="#1B2A4A" />
                    ) : (
                      <Text className="text-lg">→</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 구매 동의 확인 모달 (앱스토어 심사 필수 — 한국 2025년 법 개정) */}
      {pendingProductId && (() => {
        const product = PRODUCTS.find((p) => p.id === pendingProductId);
        if (!product) return null;
        const displayPoints = showFirstChargeBanner ? product.points * 2 : product.points;
        return (
          <Modal
            visible
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setPendingProductId(null)}
          >
            <View
              style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}
            >
              <View style={{ backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%" }}>
                {/* 타이틀 */}
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#1B2A4A", marginBottom: 4 }}>
                  구매 확인
                </Text>
                <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 20, lineHeight: 20 }}>
                  아래 내용을 확인하고 구매에 동의해주세요.
                </Text>

                {/* 상품 정보 */}
                <View style={{ backgroundColor: "#F9FAFB", borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#6B7280", fontSize: 13 }}>상품</Text>
                    <Text style={{ color: "#1B2A4A", fontWeight: "600", fontSize: 13 }}>{product.name}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#6B7280", fontSize: 13 }}>지급 포인트</Text>
                    <Text style={{ color: "#F43F5E", fontWeight: "700", fontSize: 13 }}>{displayPoints.toLocaleString()}P</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#6B7280", fontSize: 13 }}>결제 금액</Text>
                    <Text style={{ color: "#1B2A4A", fontWeight: "600", fontSize: 13 }}>{product.price.toLocaleString()}원</Text>
                  </View>
                </View>

                {/* 환불 안내 */}
                <View style={{ backgroundColor: "#FFF5F7", borderRadius: 12, padding: 12, marginBottom: 24 }}>
                  <Text style={{ color: "#BE123C", fontSize: 12, lineHeight: 18 }}>
                    ⚠️ 구매한 포인트는 관계 법령에 따라 환불되지 않습니다.{"\n"}
                    결제 전 상품 정보를 충분히 확인해주세요.
                  </Text>
                </View>

                {/* 버튼 */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setPendingProductId(null)}
                    style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: "#6B7280", fontWeight: "600", fontSize: 15 }}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => executePurchase(pendingProductId)}
                    style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: "#F43F5E", alignItems: "center", justifyContent: "center" }}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>동의하고 구매</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}
    </View>
  );
}
