/**
 * 내 프로필 탭
 * - 프로필 사진 + 닉네임 + 포인트 잔액
 * - 충전 내역, 통화 기록, 설정, 고객센터
 * - 크리에이터인 경우 대시보드 버튼 추가
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";
import Toast from "react-native-toast-message";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  badge?: string;
}

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { points } = usePointStore();

  const isCreator = user?.role === "creator" || user?.role === "both";

  const handleLogout = () => {
    logout();
    router.replace("/(auth)/login");
  };

  const menuSections: { title?: string; items: MenuItem[] }[] = [
    {
      title: "활동 내역",
      items: [
        {
          icon: "heart-outline",
          label: "즐겨찾기",
          onPress: () => router.push("/favorites" as any),
        },
        {
          icon: "receipt-outline",
          label: "충전 내역",
          onPress: () => router.push("/history/charges"),
        },
        {
          icon: "call-outline",
          label: "통화 기록",
          onPress: () => router.push("/history/calls"),
        },
        {
          icon: "bag-handle-outline",
          label: "구매 내역",
          onPress: () => router.push("/history/purchases"),
        },
      ],
    },
    {
      title: "크리에이터",
      items: isCreator
        ? [
            {
              icon: "grid-outline",
              label: "크리에이터 대시보드",
              onPress: () => router.push("/(creator)/dashboard"),
              color: "#FF6B9D",
            },
          ]
        : [],
    },
    {
      title: "설정",
      items: [
        {
          icon: "settings-outline",
          label: "설정",
          onPress: () => router.push("/settings"),
        },
        {
          icon: "headset-outline",
          label: "고객센터",
          onPress: () =>
            Toast.show({ type: "info", text1: "고객센터는 곧 열립니다." }),
        },
      ],
    },
    {
      items: [
        {
          icon: "log-out-outline",
          label: "로그아웃",
          onPress: handleLogout,
          color: "#8E8EA0",
        },
      ],
    },
  ].filter((s) => s.items.length > 0);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
      showsVerticalScrollIndicator={false}
    >
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-navy text-lg font-bold">내 프로필</Text>
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="settings-outline" size={22} color="#1B2A4A" />
        </TouchableOpacity>
      </View>

      {/* 프로필 카드 */}
      <View className="bg-white mx-4 mt-4 rounded-3xl p-5 shadow-card">
        <View className="flex-row items-center gap-4">
          {/* 프로필 사진 */}
          <View className="w-16 h-16 rounded-full bg-bluebell items-center justify-center overflow-hidden">
            {user?.profile_img ? (
              <Image
                source={{ uri: user.profile_img }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={32} color="#4D9FFF" />
            )}
          </View>

          {/* 정보 */}
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-navy text-lg font-bold">
                {user?.nickname ?? "유저"}
              </Text>
              {user?.is_verified && (
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              )}
            </View>
            <Text className="text-gray-500 text-sm mt-0.5">
              {isCreator ? "크리에이터" : "일반 회원"}
            </Text>
          </View>

          {/* 프로필 편집 */}
          <TouchableOpacity
            className="bg-gray-100 rounded-full px-3 py-1.5"
            onPress={() => router.push("/settings/profile")}
          >
            <Text className="text-gray-900 text-xs font-semibold">편집</Text>
          </TouchableOpacity>
        </View>

        {/* 첫 충전 이벤트 배너 */}
        {!user?.is_first_charged && (
          <TouchableOpacity
            onPress={() => router.push("/charge")}
            style={{
              marginTop: 12,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#FFF0F5",
              borderWidth: 1,
              borderColor: "#FFD6E5",
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 8,
            }}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 20 }}>🎁</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#FF6B9D" }}>
                첫 충전 이벤트
              </Text>
              <Text style={{ fontSize: 11, color: "#FF8FB3", marginTop: 1 }}>
                지금 충전하면 포인트 50% 추가 증정!
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FF6B9D" />
          </TouchableOpacity>
        )}

        {/* 포인트 박스 */}
        <View className="mt-4 bg-navy rounded-2xl px-5 py-4 flex-row items-center justify-between">
          <View>
            <Text className="text-white/60 text-xs mb-1">보유 포인트</Text>
            <Text className="text-white text-2xl font-bold">
              {points.toLocaleString()}P
            </Text>
          </View>
          <TouchableOpacity
            className="bg-pink rounded-full px-4 py-2"
            onPress={() => router.push("/charge")}
          >
            <Text className="text-white text-sm font-bold">충전하기</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 메뉴 섹션들 */}
      {menuSections.map((section, sIdx) => (
        <View key={sIdx} className="mx-4 mt-4">
          {section.title && (
            <Text className="text-gray-500 text-xs font-semibold px-1 mb-2">
              {section.title}
            </Text>
          )}
          <View className="bg-white rounded-2xl overflow-hidden">
            {section.items.map((item, iIdx) => (
              <TouchableOpacity
                key={iIdx}
                className={`flex-row items-center px-5 py-4 ${
                  iIdx < section.items.length - 1 ? "border-b border-gray-50" : ""
                }`}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center mr-3">
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.color ?? "#1B2A4A"}
                  />
                </View>
                <Text
                  className="flex-1 text-sm font-medium"
                  style={{ color: item.color ?? "#1A1A2E" }}
                >
                  {item.label}
                </Text>
                {item.badge && (
                  <View className="bg-pink rounded-full px-2 py-0.5 mr-2">
                    <Text className="text-white text-xs font-bold">
                      {item.badge}
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color="#C8C8D8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* 버전 정보 */}
      <Text className="text-center text-gray-300 text-xs mt-8 mb-4">
        wantsome v1.0.0
      </Text>
    </ScrollView>
  );
}
