/**
 * 인스타그램형 포스트 카드
 * - 크리에이터 헤더 (아바타 + 닉네임 + 시간)
 * - 이미지 캐러셀
 * - 좋아요 + 신고 버튼
 * - 캡션
 * - 더블탭 좋아요 (하트 애니메이션)
 */
import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PostCarousel } from "./PostCarousel";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";

const { width: SCREEN_W } = Dimensions.get("window");

export interface PostItem {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string | null;
  creator_verified: boolean;
  caption: string;
  images: string[];
  like_count: number;
  is_liked: boolean;
  created_at: string;
}

interface Props {
  item: PostItem;
  onLikeToggle?: (postId: string, liked: boolean, newCount: number) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return "방금";
  if (hours < 1) return `${mins}분 전`;
  if (days < 1)  return `${hours}시간 전`;
  if (days < 7)  return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function PostCard({ item, onLikeToggle }: Props) {
  const router = useRouter();
  const [liked, setLiked]         = useState(item.is_liked);
  const [likeCount, setLikeCount] = useState(item.like_count);
  const [loading, setLoading]     = useState(false);

  // 하트 애니메이션
  const heartAnim  = useRef(new Animated.Value(0)).current;
  const lastTap    = useRef(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // 더블탭
      if (!liked) triggerLike();
      showHeart();
    }
    lastTap.current = now;
  }, [liked]);

  const showHeart = () => {
    heartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.delay(500),
      Animated.timing(heartAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const triggerLike = async () => {
    if (loading) return;
    setLoading(true);
    const newLiked = !liked;
    const newCount = likeCount + (newLiked ? 1 : -1);
    setLiked(newLiked);
    setLikeCount(newCount);
    onLikeToggle?.(item.id, newLiked, newCount);
    try {
      await apiCall(`/api/posts/${item.id}/like`, { method: "POST" });
    } catch {
      // 실패 시 롤백
      setLiked(!newLiked);
      setLikeCount(likeCount);
    } finally {
      setLoading(false);
    }
  };

  const handleReport = () => {
    Alert.alert("포스트 신고", "신고 사유를 선택해주세요", [
      { text: "취소", style: "cancel" },
      { text: "음란물", onPress: () => doReport("OBSCENE") },
      { text: "불법 콘텐츠", onPress: () => doReport("ILLEGAL") },
      { text: "스팸", onPress: () => doReport("SPAM") },
      { text: "기타", onPress: () => doReport("OTHER") },
    ]);
  };

  const doReport = async (category: string) => {
    try {
      await apiCall(`/api/posts/${item.id}/report`, {
        method: "POST",
        body: JSON.stringify({ category }),
      });
      Toast.show({ type: "success", text1: "신고가 접수됐습니다." });
    } catch {
      Toast.show({ type: "error", text1: "신고에 실패했습니다." });
    }
  };

  return (
    <View style={{ backgroundColor: "#fff", marginBottom: 8 }}>
      {/* 헤더: 아바타 + 닉네임 + 시간 */}
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}
        onPress={() => router.push(`/(app)/creator/${item.creator_id}` as any)}
        activeOpacity={0.85}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#D1E4F8", overflow: "hidden" }}>
          {item.creator_avatar ? (
            <Image source={{ uri: item.creator_avatar }} style={{ width: 36, height: 36 }} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person" size={20} color="#4D9FFF" />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontWeight: "700", fontSize: 13, color: "#1B2A4A" }}>
              {item.creator_name}
            </Text>
            {item.creator_verified && (
              <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
            )}
          </View>
          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
        {/* 신고 */}
        <TouchableOpacity onPress={handleReport} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* 이미지 캐러셀 (더블탭 좋아요) */}
      <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
        <PostCarousel images={item.images} width={SCREEN_W} aspectRatio={1} />

        {/* 하트 애니메이션 오버레이 */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            opacity: heartAnim,
            transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1.4, 1] }) }],
          }}
        >
          <Ionicons name="heart" size={80} color="rgba(255,255,255,0.9)" />
        </Animated.View>
      </TouchableOpacity>

      {/* 하단: 좋아요 + 신고 */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 }}>
        <TouchableOpacity
          onPress={triggerLike}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, marginRight: 16 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={22}
            color={liked ? "#FF5C7A" : "#1B2A4A"}
          />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#1B2A4A" }}>
            {likeCount.toLocaleString()}
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* 프로필 바로가기 버튼 */}
        <TouchableOpacity
          onPress={() => router.push(`/(app)/creator/${item.creator_id}` as any)}
          style={{
            backgroundColor: "#FF6B9D",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="videocam-outline" size={13} color="white" />
          <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>통화하기</Text>
        </TouchableOpacity>
      </View>

      {/* 캡션 */}
      {!!item.caption && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <Text style={{ fontSize: 13, color: "#1B2A4A", lineHeight: 18 }}>
            <Text style={{ fontWeight: "700" }}>{item.creator_name}</Text>
            {"  "}
            {item.caption}
          </Text>
        </View>
      )}
    </View>
  );
}
