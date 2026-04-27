import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Creator } from "@/stores/useCreatorStore";
import { useFavoriteStore } from "@/stores/useFavoriteStore";
import type { FeedMode } from "./ModeTab";

interface CreatorCardProps {
  creator: Creator;
  mode: FeedMode;
  onCallPress: (creator: Creator) => void;
}

/** 초록 펄싱 온라인 점 */
function OnlinePulse() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 2.2, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,   duration: 0,   useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0,   useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.onlineWrap}>
      <Animated.View style={[styles.onlinePulse, { transform: [{ scale }], opacity }]} />
      <View style={styles.onlineCore} />
    </View>
  );
}

export function CreatorCard({ creator, mode, onCallPress }: CreatorCardProps) {
  const photoUri = creator.profile_image_url || undefined;
  const ratePerMin = creator.rate_per_min ?? (mode === "blue" ? 900 : 1300);
  const isBlue = mode === "blue";
  const { isFavorited, toggle } = useFavoriteStore();
  const favorited = isFavorited(creator.id);

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={{ color: "#9CA3AF", fontSize: 24 }}>👤</Text>
          </View>
        )}

        {/* 하단 그라데이션 */}
        <View style={styles.gradient} pointerEvents="none" />

        {/* 온라인 배지 — 펄싱 애니메이션 */}
        {creator.is_online && (
          <View style={styles.onlineBadge} pointerEvents="none">
            <OnlinePulse />
            <Text style={styles.onlineBadgeText}>ON</Text>
          </View>
        )}

        {/* 즐겨찾기 */}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => toggle(creator.id)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={favorited ? "heart" : "heart-outline"}
            size={18}
            color={favorited ? "#FF6B9D" : "rgba(255,255,255,0.85)"}
          />
        </TouchableOpacity>

        {/* 모드 뱃지 */}
        <View
          style={[styles.modeBadge, { backgroundColor: isBlue ? "#D1E4F8" : "#FFFBEB" }]}
          pointerEvents="none"
        >
          <Text style={[styles.modeBadgeText, { color: isBlue ? "#4D9FFF" : "#F59E0B" }]}>
            {isBlue ? "🔵" : "⭐"}
          </Text>
        </View>

        {/* 하단 정보 */}
        <View style={styles.bottomInfo} pointerEvents="box-none">
          <Text style={styles.nameText} numberOfLines={1}>
            {creator.display_name}{creator.is_verified ? " ✅" : ""}
          </Text>
          <View style={styles.bottomRow}>
            <Text style={styles.rateText}>{ratePerMin}P/분</Text>
            <TouchableOpacity
              onPress={() => onCallPress(creator)}
              style={[
                styles.callButton,
                { backgroundColor: creator.is_online ? "#FF6B9D" : "#9CA3AF" },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.callButtonIcon}>📹</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 4 },
  imageWrap: {
    aspectRatio: 1, borderRadius: 16, overflow: "hidden",
    backgroundColor: "#E5E7EB", position: "relative",
  },
  cover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  gradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  /* ── 온라인 배지 ── */
  onlineBadge: {
    position: "absolute", top: 8, left: 8,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.50)", borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  onlineBadgeText: { color: "#4ADE80", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  onlineWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  onlinePulse: {
    position: "absolute", width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  onlineCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  /* ── 즐겨찾기 ── */
  heartBtn: {
    position: "absolute", top: 8, right: 36,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  /* ── 모드 뱃지 ── */
  modeBadge: {
    position: "absolute", top: 8, right: 8,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  modeBadgeText: { fontSize: 11 },
  /* ── 하단 ── */
  bottomInfo: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 8, paddingBottom: 8, paddingTop: 32,
  },
  nameText: { color: "white", fontSize: 13, fontWeight: "600" },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  rateText: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  callButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  callButtonIcon: { fontSize: 15 },
});
