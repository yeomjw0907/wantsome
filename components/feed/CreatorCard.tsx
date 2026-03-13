import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Creator } from "@/stores/useCreatorStore";
import { useFavoriteStore } from "@/stores/useFavoriteStore";
import type { FeedMode } from "./ModeTab";

interface CreatorCardProps {
  creator: Creator;
  mode: FeedMode;
  onCallPress: (creator: Creator) => void;
}

export function CreatorCard({ creator, mode, onCallPress }: CreatorCardProps) {
  const photoUri = creator.profile_image_url || undefined;
  const ratePerMin = creator.rate_per_min ?? (mode === "blue" ? 900 : 1300);
  const isBlue = mode === "blue";
  const { isFavorited, toggle } = useFavoriteStore();
  const favorited = isFavorited(creator.id);

  return (
    <View style={styles.card}>
      <View className="aspect-square rounded-2xl overflow-hidden bg-gray-200">
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 bg-gray-300 items-center justify-center">
            <Text className="text-gray-500 text-2xl">👤</Text>
          </View>
        )}

        {/* 하단 그라데이션 오버레이 */}
        <View style={styles.gradient} pointerEvents="none" />

        {/* 온라인 점 */}
        {creator.is_online && (
          <View style={styles.onlineDot} pointerEvents="none" />
        )}

        {/* 즐겨찾기 버튼 */}
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
          style={[
            styles.modeBadge,
            { backgroundColor: isBlue ? "#D1E4F8" : "#FFEEF1" },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[
              styles.modeBadgeText,
              { color: isBlue ? "#4D9FFF" : "#FF5C7A" },
            ]}
          >
            {isBlue ? "🔵" : "🔴"}
          </Text>
        </View>

        {/* 하단 정보 */}
        <View style={styles.bottomInfo} pointerEvents="box-none">
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {creator.display_name}
            {creator.is_verified ? " ✅" : ""}
          </Text>
          <View className="flex-row items-center justify-between mt-0.5">
            <Text className="text-white text-xs opacity-80">
              {ratePerMin}P/분
            </Text>
            <TouchableOpacity
              onPress={() => onCallPress(creator)}
              style={styles.callButton}
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
  card: {
    flex: 1,
    margin: 4,
  },
  cover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "transparent",
  },
  onlineDot: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 36,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  modeBadgeText: {
    fontSize: 11,
  },
  bottomInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 32,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF6B9D",
    alignItems: "center",
    justifyContent: "center",
  },
  callButtonIcon: {
    fontSize: 16,
  },
});
