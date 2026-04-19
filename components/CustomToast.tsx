import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  text1?: string;
  text2?: string;
}

const COLORS: Record<ToastType, string> = {
  success: "#16A34A",
  error: "#E11D48",
  info: "#475569",
};

function TossToast({
  type,
  text1,
  text2,
}: {
  type: ToastType;
  text1?: string;
  text2?: string;
}) {
  const entrance = useRef(new Animated.Value(48)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useMemo(
    () => Animated.add(entrance, drag),
    [entrance, drag]
  );

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(entrance, {
        toValue: 72,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(drag, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      Toast.hide();
      entrance.setValue(48);
      drag.setValue(0);
      opacity.setValue(0);
    });
  }, [entrance, drag, opacity]);

  const hideRef = useRef(hideToast);
  hideRef.current = hideToast;

  useEffect(() => {
    entrance.setValue(48);
    drag.setValue(0);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(entrance, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 70,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      hideRef.current();
    }, 3000);
    return () => clearTimeout(timer);
  }, [text1, text2, entrance, drag, opacity]);

  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          const next = Math.max(0, g.dy);
          drag.setValue(next);
          opacity.setValue(Math.max(0.35, 1 - Math.min(next, 72) / 90));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 32 || g.vy > 0.45) {
            hideToast();
            return;
          }
          Animated.parallel([
            Animated.spring(drag, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
              friction: 8,
            }),
          ]).start();
        },
      }),
    [drag, opacity, hideToast]
  );

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toast}>
        <View style={styles.dragHit} {...handlePan.panHandlers}>
          <View style={styles.dragBar} />
        </View>
        <View style={styles.row}>
          <View style={[styles.indicator, { backgroundColor: COLORS[type] }]} />
          <View style={styles.textBlock}>
            {text1 ? (
              <Text style={styles.title} numberOfLines={2}>
                {text1}
              </Text>
            ) : null}
            {text2 ? (
              <Text style={styles.body} numberOfLines={3}>
                {text2}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={hideToast}
            hitSlop={14}
            style={styles.closeBtn}
            accessibilityLabel="닫기"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color="#64748B" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export const toastConfig = {
  success: ({ text1, text2 }: ToastProps) => (
    <TossToast type="success" text1={text1} text2={text2} />
  ),
  error: ({ text1, text2 }: ToastProps) => (
    <TossToast type="error" text1={text1} text2={text2} />
  ),
  info: ({ text1, text2 }: ToastProps) => (
    <TossToast type="info" text1={text1} text2={text2} />
  ),
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: 18,
  },
  toast: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.1)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  dragHit: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.55)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: 14,
    paddingRight: 10,
    paddingBottom: 14,
    gap: 10,
  },
  indicator: {
    width: 3,
    marginTop: 3,
    alignSelf: "stretch",
    minHeight: 32,
    borderRadius: 999,
  },
  textBlock: {
    flex: 1,
    gap: 4,
    paddingRight: 2,
  },
  title: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  body: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    marginTop: -2,
  },
});
