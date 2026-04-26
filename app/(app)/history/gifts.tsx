/**
 * 선물 내역 화면
 * - 소비자: 내가 보낸 선물 목록 (?sent=1)
 * - 크리에이터: 내가 받은 선물 목록 (기본)
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
import { useAuthStore } from "@/stores/useAuthStore";
import { GIFTS } from "@/constants/gifts";

// constants/gifts.ts에서 자동 생성 — 단일 source of truth
const GIFT_TIERS: Record<number, { emoji: string; label: string }> = Object.fromEntries(
  GIFTS.map((g) => [g.amount, { emoji: g.emoji, label: g.label }]),
);

interface SentGift {
  id: string;
  amount: number;
  message: string | null;
  created_at: string;
  to_creator_id: string;
  creators: { display_name: string; profile_image_url: string | null } | null;
}

interface ReceivedGift {
  id: string;
  amount: number;
  message: string | null;
  created_at: string;
  from_user_id: string;
  users: { nickname: string; profile_img: string | null } | null;
}

type GiftItem = SentGift | ReceivedGift;

function isSentGift(item: GiftItem): item is SentGift {
  return "to_creator_id" in item;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function GiftRow({ item, isSent }: { item: GiftItem; isSent: boolean }) {
  const tier = GIFT_TIERS[item.amount] ?? { emoji: "🎁", label: "선물" };
  const name = isSentGift(item)
    ? (item.creators?.display_name ?? "크리에이터")
    : ((item as ReceivedGift).users?.nickname ?? "유저");
  const label = isSent ? `→ ${name}에게` : `← ${name}이(가)`;

  return (
    <View className="bg-white rounded-2xl p-4 mb-2.5 flex-row items-center">
      {/* 이모지 아이콘 */}
      <View
        className="w-11 h-11 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: "#FFF0F5" }}
      >
        <Text style={{ fontSize: 22 }}>{tier.emoji}</Text>
      </View>

      {/* 내용 */}
      <View className="flex-1">
        <Text className="text-navy text-sm font-semibold">
          {tier.label} ({item.amount.toLocaleString()}P)
        </Text>
        <Text className="text-gray-400 text-xs mt-0.5">{label}</Text>
        {item.message ? (
          <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
            "{item.message}"
          </Text>
        ) : null}
      </View>

      {/* 시간 + 금액 */}
      <View className="items-end">
        <Text className="text-pink text-sm font-bold">
          {isSent ? "-" : "+"}{item.amount.toLocaleString()}P
        </Text>
        <Text className="text-gray-300 text-xs mt-0.5">{timeAgo(item.created_at)}</Text>
      </View>
    </View>
  );
}

export default function GiftsHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const isCreator = user?.role === "creator" || user?.role === "both";
  const isSent = !isCreator; // 소비자는 보낸 선물, 크리에이터는 받은 선물

  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadGifts = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const path = isSent ? "/api/gifts?sent=1" : "/api/gifts";
      const data = await apiCall<{ gifts: GiftItem[] }>(path);
      setGifts(data.gifts ?? []);
    } catch {
      Toast.show({ type: "error", text1: "선물 내역을 불러오지 못했습니다." });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isSent]);

  useEffect(() => { loadGifts(); }, [loadGifts]);

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold">
          {isSent ? "보낸 선물" : "받은 선물"}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      ) : (
        <FlatList
          data={gifts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🎁</Text>
              <Text className="text-gray-400 text-sm">
                {isSent ? "보낸 선물이 없습니다." : "받은 선물이 없습니다."}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadGifts(true)}
              tintColor="#FF6B9D"
            />
          }
          renderItem={({ item }) => <GiftRow item={item} isSent={isSent} />}
        />
      )}
    </View>
  );
}
