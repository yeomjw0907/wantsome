/**
 * 크리에이터 프로필 화면
 * - 프로필 사진 풀커버 (3:4) + 하단 그라데이션
 * - 닉네임 / 인증뱃지 / 등급 / 모드 뱃지
 * - 평점 / 평균 통화 시간 / 총 통화 수 지표
 * - 즉시 통화 버튼 (CallWaitingModal)
 * - 예약 통화 버튼
 * - 포스트 그리드 (3컬럼)
 * - 신고/차단 메뉴
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { MODE_LABEL } from "@/constants/branding";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";
import CallWaitingModal from "@/components/CallWaitingModal";
import ReportBottomSheet from "@/components/ReportBottomSheet";
import { PostGrid, type GridPost } from "@/components/posts/PostGrid";

interface Creator {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  bio: string | null;
  grade: "신규" | "일반" | "인기" | "탑";
  is_online: boolean;
  is_busy: boolean;
  mode_blue: boolean;
  mode_red: boolean;
  is_verified: boolean;
  rate_per_min: number;
  total_calls: number;
  monthly_minutes: number;
  avg_call_min: number;
  avg_rating: number;
  categories: string[];
  post_count: number;
  available_times: string | null;
}

interface CreatorProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
}

const GRADE_CONFIG = {
  신규: { icon: "leaf-outline"  as const, color: "#8E8EA0" },
  일반: { icon: "star-outline"  as const, color: "#4D9FFF" },
  인기: { icon: "flame-outline" as const, color: "#FF9800" },
  탑:  { icon: "trophy-outline" as const, color: "#FF6B9D" },
};

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: "row", gap: 1, marginTop: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={
            i <= full
              ? "star"
              : i === full + 1 && half
              ? "star-half"
              : "star-outline"
          }
          size={12}
          color="#FF6B9D"
        />
      ))}
    </View>
  );
}

export default function CreatorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { points } = usePointStore();

  const [creator, setCreator] = useState<Creator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [callMode, setCallMode] = useState<"blue" | "red">("blue");
  const [callModal, setCallModal] = useState<{
    sessionId: string;
    perMinRate: number;
  } | null>(null);

  // 포스트 그리드
  const [gridPosts, setGridPosts] = useState<GridPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // 리뷰
  type Review = { id: string; rating: number; comment: string; created_at: string; reviewer_nickname: string; reviewer_avatar: string | null };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // 예정 방송 일정
  type Schedule = { id: string; scheduled_at: string; note: string | null };
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // 크리에이터 상품
  const [creatorProducts, setCreatorProducts] = useState<CreatorProduct[]>([]);

  useEffect(() => {
    loadCreator();
    loadPosts();
    loadReviews();
    loadSchedules();
    loadCreatorProducts();
  }, [id]);

  const loadCreator = async () => {
    try {
      setIsLoading(true);
      const data = await apiCall<Creator>(`/api/creators/${id}`);
      setCreator(data);
      if (data.mode_blue) setCallMode("blue");
      else if (data.mode_red) setCallMode("red");
    } catch {
      Toast.show({ type: "error", text1: "프로필을 불러오지 못했습니다." });
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadReviews = async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await apiCall<{ reviews: Review[] }>(`/api/creators/${id}/reviews?page=1`);
      setReviews(res.reviews ?? []);
    } catch { /* 무시 */ } finally { setReviewsLoading(false); }
  };

  const loadSchedules = async () => {
    if (!id) return;
    try {
      const res = await apiCall<{ schedules: Schedule[] }>(`/api/creators/${id}/schedules`);
      setSchedules(res.schedules ?? []);
    } catch { /* 무시 */ }
  };

  const loadPosts = async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      const res = await apiCall<{ posts: GridPost[] }>(
        `/api/creators/${id}/posts?limit=18`
      );
      setGridPosts(res.posts ?? []);
    } catch {
      // 포스트 없음 처리
    } finally {
      setPostsLoading(false);
    }
  };

  const loadCreatorProducts = async () => {
    if (!id) return;
    try {
      const res = await apiCall<{ products: CreatorProduct[] }>(`/api/creators/${id}/products`);
      setCreatorProducts(res.products ?? []);
    } catch { /* ignore */ }
  };

  const handleCallPress = useCallback(async () => {
    if (!creator) return;
    if (!creator.is_online) {
      Toast.show({ type: "info", text1: "오프라인 상태입니다.", text2: "DM 또는 예약을 이용해 주세요." });
      return;
    }
    if (creator.is_busy) {
      Toast.show({ type: "info", text1: "통화 중입니다.", text2: "DM 또는 예약을 이용해 주세요." });
      return;
    }
    const perMinRate = callMode === "blue" ? 900 : 1300;
    if (points < perMinRate) {
      Toast.show({ type: "info", text1: "포인트 부족", text2: "충전 화면으로 이동합니다." });
      router.push("/charge");
      return;
    }
    try {
      const res = await apiCall<{ session_id: string }>("/api/calls/start", {
        method: "POST",
        body: JSON.stringify({ creator_id: creator.id, mode: callMode }),
      });
      setCallModal({ sessionId: res.session_id, perMinRate });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "통화 요청에 실패했습니다.";
      Toast.show({ type: "error", text1: "통화 요청 실패", text2: msg });
    }
  }, [creator, callMode, points]);

  const handleDMPress = useCallback(async () => {
    if (!creator) return;
    Alert.alert(
      "DM 보내기",
      "기존 채팅방이 있으면 무료로 이동합니다.\n없으면 500P가 차감되어 채팅방이 개설됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "확인",
          onPress: async () => {
            try {
              const res = await apiCall<{ conversation_id: string }>("/api/conversations", {
                method: "POST",
                body: JSON.stringify({ creator_id: creator.id, message: "안녕하세요! 👋" }),
              });
              router.push(`/messages/${res.conversation_id}` as any);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "DM 개설에 실패했습니다.";
              Toast.show({ type: "error", text1: msg });
            }
          },
        },
      ]
    );
  }, [creator]);

  const handleBlock = () => {
    if (!creator) return;
    Alert.alert(
      "차단하기",
      `${creator.display_name}님을 차단하시겠습니까?\n차단 후 피드에서 보이지 않습니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "차단",
          style: "destructive",
          onPress: async () => {
            try {
              await apiCall("/api/users/block", {
                method: "POST",
                body: JSON.stringify({ target_id: creator.id }),
              });
              Toast.show({ type: "success", text1: "차단됐습니다." });
              router.back();
            } catch {
              Toast.show({ type: "error", text1: "차단에 실패했습니다." });
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  if (!creator) return null;

  const gradeConfig = GRADE_CONFIG[creator.grade] ?? GRADE_CONFIG["신규"];

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── 프로필 사진 (3:4 비율) ── */}
        <View style={{ aspectRatio: 3 / 4 }} className="w-full relative">
          {creator.profile_image_url ? (
            <Image
              source={{ uri: creator.profile_image_url }}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="absolute inset-0 bg-gray-100 items-center justify-center">
              <Ionicons name="person" size={80} color="#C8C8D8" />
            </View>
          )}

          {/* 하단 그라데이션 */}
          <View
            className="absolute bottom-0 left-0 right-0 h-40"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            pointerEvents="none"
          />

          {/* 뒤로가기 버튼 */}
          <TouchableOpacity
            className="absolute bg-black/30 rounded-full w-10 h-10 items-center justify-center"
            style={{ top: insets.top + 8, left: 16 }}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="white" />
          </TouchableOpacity>

          {/* 더보기 메뉴 */}
          <TouchableOpacity
            className="absolute bg-black/30 rounded-full w-10 h-10 items-center justify-center"
            style={{ top: insets.top + 8, right: 16 }}
            onPress={() => setShowMenu((v) => !v)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="white" />
          </TouchableOpacity>

          {showMenu && (
            <View
              className="absolute bg-white rounded-2xl overflow-hidden shadow-lg"
              style={{ top: insets.top + 56, right: 16, minWidth: 140 }}
            >
              <TouchableOpacity
                className="flex-row items-center px-4 py-3 gap-3 border-b border-gray-100"
                onPress={() => { setShowMenu(false); setShowReport(true); }}
              >
                <Ionicons name="flag-outline" size={16} color="#FF5C7A" />
                <Text className="text-gray-900 text-sm">신고하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center px-4 py-3 gap-3"
                onPress={() => { setShowMenu(false); handleBlock(); }}
              >
                <Ionicons name="ban" size={16} color="#FF5C7A" />
                <Text className="text-red text-sm">차단하기</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 하단 정보 오버레이 */}
          <View className="absolute bottom-0 left-0 right-0 px-5 pb-5">
            <View className="flex-row items-center gap-1.5 mb-2">
              <View
                style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: !creator.is_online ? "#9CA3AF" : creator.is_busy ? "#F59E0B" : "#22C55E",
                }}
              />
              <Text className="text-white/80 text-xs">
                {!creator.is_online ? "오프라인" : creator.is_busy ? "통화 중" : "지금 통화 가능"}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Text className="text-white text-2xl font-bold">{creator.display_name}</Text>
              {creator.is_verified && (
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              )}
            </View>

            <View className="flex-row items-center gap-2 mt-1.5">
              <View className="bg-white/20 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                <Ionicons name={gradeConfig.icon} size={12} color="white" />
                <Text className="text-white text-xs font-medium">{creator.grade}</Text>
              </View>
              {creator.mode_blue && (
                <View className="bg-blue/30 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full bg-blue-300" />
                  <Text className="text-white text-xs font-medium">{MODE_LABEL.blue}</Text>
                </View>
              )}
              {creator.mode_red && (
                <View className="bg-red/30 rounded-full px-2.5 py-1 flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full bg-red-300" />
                  <Text className="text-white text-xs font-medium">{MODE_LABEL.red}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── 바디 ── */}
        <View className="px-5 pt-5">
          {/* 소개글 */}
          {creator.bio && (
            <Text className="text-gray-900 text-sm leading-5 mb-5">
              {creator.bio}
            </Text>
          )}

          {/* ★ 3가지 지표 카드 */}
          <View className="flex-row gap-3 mb-5">
            <View className="flex-1 bg-gray-50 rounded-2xl p-4 items-center">
              <Text className="text-navy text-xl font-bold">{creator.total_calls}</Text>
              <Text className="text-gray-500 text-xs mt-1">총 통화</Text>
            </View>
            <View className="flex-1 bg-gray-50 rounded-2xl p-4 items-center">
              <Text className="text-navy text-xl font-bold">{creator.avg_call_min}분</Text>
              <Text className="text-gray-500 text-xs mt-1">평균 통화</Text>
            </View>
            <View className="flex-1 bg-pink/10 rounded-2xl p-4 items-center">
              <Text className="text-pink text-xl font-bold">
                {creator.avg_rating > 0 ? Number(creator.avg_rating).toFixed(1) : "-"}
              </Text>
              {creator.avg_rating > 0
                ? <StarRating rating={creator.avg_rating} />
                : <Text className="text-gray-400 text-xs mt-1">평점없음</Text>}
            </View>
          </View>

          {/* 카테고리 태그 */}
          {creator.categories.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-5">
              {creator.categories.map((cat) => (
                <View key={cat} className="bg-gray-100 rounded-full px-3 py-1">
                  <Text className="text-gray-600 text-xs font-medium">#{cat}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 모드 선택 */}
          {creator.mode_blue && creator.mode_red && (
            <View className="flex-row gap-2 mb-5">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-2xl items-center border-[1.5px] ${
                  callMode === "blue"
                    ? "bg-bluebell border-blue"
                    : "bg-white border-gray-100"
                }`}
                onPress={() => setCallMode("blue")}
              >
                <View className="flex-row items-center gap-1.5">
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: callMode === "blue" ? "#4D9FFF" : "#9CA3AF" }}
                  />
                  <Text className={`text-sm font-semibold ${callMode === "blue" ? "text-blue" : "text-gray-500"}`}>
                    {MODE_LABEL.blue} · 900P/분
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-2xl items-center border-[1.5px] ${
                  callMode === "red"
                    ? "bg-red-light border-red"
                    : "bg-white border-gray-100"
                }`}
                onPress={() => setCallMode("red")}
              >
                <View className="flex-row items-center gap-1.5">
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: callMode === "red" ? "#FF5C7A" : "#9CA3AF" }}
                  />
                  <Text className={`text-sm font-semibold ${callMode === "red" ? "text-red" : "text-gray-500"}`}>
                    {MODE_LABEL.red} · 1,300P/분
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 통화 가능 시간 ── */}
        {creator.available_times && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              backgroundColor: creator.is_online ? "#F0FFF4" : "#F9FAFB",
              borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: creator.is_online ? "#86EFAC" : "#E5E7EB",
            }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: creator.is_online ? "#22C55E" : "#9CA3AF",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="time" size={18} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>통화 가능 시간</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#1B2A4A", lineHeight: 18 }}>
                  {creator.available_times}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── 예정 방송 일정 ── */}
        {schedules.length > 0 && (
          <View className="px-5 mb-5">
            <Text className="text-navy text-sm font-bold mb-3">📅 예정 방송</Text>
            {schedules.map((s) => {
              const dt = new Date(s.scheduled_at);
              const dateStr = `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours().toString().padStart(2,"0")}:${dt.getMinutes().toString().padStart(2,"0")}`;
              return (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F0F7FF", borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 }}>
                  <Ionicons name="time-outline" size={16} color="#4D9FFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#1B2A4A" }}>{dateStr}</Text>
                    {s.note && <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{s.note}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── 리뷰 목록 ── */}
        {(reviewsLoading || reviews.length > 0) && (
          <View className="px-5 mb-5">
            <Text className="text-navy text-sm font-bold mb-3">💬 리뷰</Text>
            {reviewsLoading ? (
              <ActivityIndicator size="small" color="#FF6B9D" />
            ) : reviews.map((r) => (
              <View key={r.id} style={{ backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#D1E4F8", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <Ionicons name="person" size={14} color="#4D9FFF" />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#1B2A4A" }}>{r.reviewer_nickname}</Text>
                  <View style={{ flexDirection: "row", marginLeft: "auto" }}>
                    {[1,2,3,4,5].map((i) => (
                      <Ionicons key={i} name={i <= r.rating ? "star" : "star-outline"} size={11} color="#FF6B9D" />
                    ))}
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: "#374151", lineHeight: 18 }}>{r.comment}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 크리에이터 상품 ── */}
        {creatorProducts.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#1B2A4A" }}>🛍️ 상품</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {creatorProducts.map((p) => (
                <View
                  key={p.id}
                  style={{
                    width: 120, backgroundColor: "#fff",
                    borderRadius: 14, overflow: "hidden",
                    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
                  }}
                >
                  <View style={{ width: 120, height: 120, backgroundColor: "#F5F5FA" }}>
                    {p.images[0] ? (
                      <Image source={{ uri: p.images[0] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="image-outline" size={28} color="#C8C8D8" />
                      </View>
                    )}
                  </View>
                  <View style={{ padding: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#1B2A4A" }} numberOfLines={2}>{p.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#FF6B9D", marginTop: 2 }}>{p.price.toLocaleString()}P</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── 포스트 그리드 ── */}
        <View className="mt-1">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-navy text-sm font-bold">
              게시물{creator.post_count > 0 ? ` ${creator.post_count}` : ""}
            </Text>
            {creator.post_count > 18 && (
              <Text className="text-gray-400 text-xs">최근 18개</Text>
            )}
          </View>
          <View className="h-px bg-gray-100 mb-1" />
          {postsLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color="#FF6B9D" />
            </View>
          ) : (
            <PostGrid posts={gridPosts} />
          )}
        </View>

        {/* CTA 버튼 공간 확보 */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── 하단 CTA ── */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12, gap: 10 }}
      >
        {/* 통화 버튼 — 3단계 */}
        {(() => {
          const available = creator.is_online && !creator.is_busy;
          const busy = creator.is_online && creator.is_busy;
          const bgColor = available ? "#FF6B9D" : "#F3F4F6";
          const textColor = available ? "#fff" : "#9CA3AF";
          const label = available ? "즉시 통화하기" : busy ? "통화 중 · 연결 불가" : "오프라인 · 통화 불가";
          return (
            <TouchableOpacity
              style={{
                height: 52, borderRadius: 28, alignItems: "center", justifyContent: "center",
                flexDirection: "row", gap: 8, backgroundColor: bgColor,
              }}
              onPress={available ? handleCallPress : undefined}
              activeOpacity={available ? 0.8 : 1}
            >
              <Ionicons name="videocam" size={20} color={textColor} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: textColor }}>{label}</Text>
            </TouchableOpacity>
          );
        })()}

        {/* DM + 예약 버튼 행 */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={{
              flex: 1, height: 44, borderRadius: 22,
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 6,
              borderWidth: 1.5, borderColor: "#4D9FFF",
            }}
            onPress={handleDMPress}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#4D9FFF" />
            <Text style={{ color: "#4D9FFF", fontSize: 13, fontWeight: "700" }}>DM 보내기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1, height: 44, borderRadius: 22,
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 6,
              borderWidth: 1.5, borderColor: "#FF6B9D",
            }}
            onPress={() =>
              router.push({
                pathname: "/(app)/reservation/new" as any,
                params: {
                  creatorId: creator.id,
                  creatorName: creator.display_name,
                  creatorAvatar: creator.profile_image_url ?? "",
                },
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={16} color="#FF6B9D" />
            <Text style={{ color: "#FF6B9D", fontSize: 13, fontWeight: "700" }}>예약 통화</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 통화 대기 모달 */}
      {callModal && (
        <CallWaitingModal
          visible={!!callModal}
          sessionId={callModal.sessionId}
          creatorId={creator.id}
          creatorName={creator.display_name}
          creatorAvatar={creator.profile_image_url}
          perMinRate={callModal.perMinRate}
          onClose={() => setCallModal(null)}
        />
      )}

      <ReportBottomSheet
        visible={showReport}
        targetId={creator.id}
        onClose={() => setShowReport(false)}
      />
    </View>
  );
}
