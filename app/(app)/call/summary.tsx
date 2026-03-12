/**
 * 통화 종료 요약 화면
 * - 통화 시간, 차감 포인트, 잔여 포인트 표시
 * - 뒤로가기 차단 (BackHandler)
 * - [메인으로] 버튼으로만 이동
 */
import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePointStore } from "@/stores/usePointStore";
import { useCallStore } from "@/stores/useCallStore";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

export default function CallSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { points } = usePointStore();
  const { reset } = useCallStore();

  const {
    sessionId,
    durationSec,
    pointsCharged,
    creatorId,
    creatorName,
    creatorAvatar,
    perMinRate,
  } = useLocalSearchParams<{
    sessionId: string;
    durationSec: string;
    pointsCharged: string;
    creatorId: string;
    creatorName: string;
    creatorAvatar: string;
    perMinRate: string;
  }>();

  const duration = Number(durationSec) || 0;
  const charged = Number(pointsCharged) || 0;
  const rate = Number(perMinRate) || 900;
  const showCharge = points < rate * 5;
  const showReserve = duration >= 180; // 3분 이상

  // 뒤로가기 차단
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  // 화면 진입 시 callStore 초기화
  useEffect(() => {
    reset();
  }, []);

  function handleHome() {
    router.replace("/(app)/(tabs)");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 상단 크리에이터 정보 */}
      <View style={styles.header}>
        {creatorAvatar ? (
          <Image source={{ uri: creatorAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
        )}
        <Text style={styles.creatorName}>{creatorName || "크리에이터"}</Text>
        <Text style={styles.endLabel}>통화가 종료됐습니다</Text>
      </View>

      {/* 통화 정보 카드 */}
      <View style={styles.card}>
        <Row label="통화 시간" value={formatDuration(duration)} />
        <View style={styles.divider} />
        <Row label="차감 포인트" value={`-${charged.toLocaleString()}P`} valueColor="#EF4444" />
        <View style={styles.divider} />
        <Row label="잔여 포인트" value={`${points.toLocaleString()}P`} />
      </View>

      {/* 예약 유도 (통화 3분 이상) */}
      {showReserve && creatorId ? (
        <TouchableOpacity
          style={styles.reserveCard}
          onPress={() => router.push(`/creator/${creatorId}` as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.reserveTitle}>또 만나고 싶으신가요?</Text>
          <Text style={styles.reserveBtn}>예약 통화하기 →</Text>
        </TouchableOpacity>
      ) : null}

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        {showCharge && (
          <TouchableOpacity
            style={[styles.btn, styles.chargeBtn]}
            onPress={() => router.push("/charge")}
            activeOpacity={0.85}
          >
            <Text style={styles.chargeBtnText}>충전하러 가기</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btn, styles.homeBtn]} onPress={handleHome} activeOpacity={0.85}>
          <Text style={styles.homeBtnText}>메인으로</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 32,
  },
  creatorName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  endLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#F8F8FA",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 15,
    color: "#6B7280",
  },
  rowValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  reserveCard: {
    marginTop: 20,
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  reserveTitle: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  reserveBtn: {
    fontSize: 14,
    color: "#4D9FFF",
    fontWeight: "500",
  },
  footer: {
    marginTop: "auto",
    gap: 12,
    paddingBottom: 8,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  homeBtn: {
    backgroundColor: "#FF6B9D",
  },
  homeBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  chargeBtn: {
    backgroundColor: "#F8F8FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chargeBtnText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
});
