/**
 * 차단 목록 화면
 *
 * Apple App Review Guidelines 2.1 (UGC):
 *   "이용자가 다른 이용자를 차단·신고할 수 있는 기능 제공" 필수
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";

interface BlockedUser {
  user_id: string;
  blocked_at: string;
  nickname: string;
  profile_img: string | null;
}

export default function BlocksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiCall<{ blocks: BlockedUser[] }>("/api/users/block");
      setBlocks(res.blocks ?? []);
    } catch {
      Toast.show({ type: "error", text1: "차단 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = useCallback(
    (target: BlockedUser) => {
      Alert.alert(
        "차단 해제",
        `${target.nickname}님의 차단을 해제하시겠습니까?`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "해제",
            style: "destructive",
            onPress: async () => {
              try {
                await apiCall("/api/users/block", {
                  method: "DELETE",
                  body: JSON.stringify({ target_id: target.user_id }),
                });
                setBlocks((prev) => prev.filter((b) => b.user_id !== target.user_id));
                Toast.show({ type: "success", text1: "차단을 해제했습니다." });
              } catch {
                Toast.show({ type: "error", text1: "차단 해제에 실패했습니다." });
              }
            },
          },
        ],
      );
    },
    [],
  );

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-2 p-2">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-semibold">차단 목록</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6B9D" />
        </View>
      ) : blocks.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="shield-checkmark-outline" size={56} color="#D1D5DB" />
          <Text className="text-gray-400 text-base mt-4 text-center">
            차단한 사용자가 없습니다.
          </Text>
          <Text className="text-gray-300 text-sm mt-2 text-center leading-5">
            대화방·라이브·통화 중 사용자 프로필에서{"\n"}차단할 수 있습니다.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <View className="flex-row items-center bg-white rounded-2xl p-4">
              <View className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden items-center justify-center mr-3">
                {item.profile_img ? (
                  <Image source={{ uri: item.profile_img }} className="w-full h-full" />
                ) : (
                  <Ionicons name="person" size={24} color="#9CA3AF" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-navy text-base font-semibold">{item.nickname}</Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  {new Date(item.blocked_at).toLocaleDateString("ko-KR")} 차단
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleUnblock(item)}
                className="px-4 py-2 rounded-full bg-pink/10"
                activeOpacity={0.7}
              >
                <Text className="text-pink text-sm font-semibold">차단 해제</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
