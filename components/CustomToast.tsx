import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  text1?: string;
  text2?: string;
}

const COLORS: Record<ToastType, string> = {
  success: "#2F9E6F",
  error: "#FF5C73",
  info: "#5B6576",
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
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    translateY.setValue(0);
    opacity.setValue(1);
  }, [opacity, text1, text2, translateY]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 28,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Toast.hide();
      translateY.setValue(0);
      opacity.setValue(1);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          translateY.setValue(Math.max(0, gestureState.dy));
          opacity.setValue(Math.max(0.4, 1 - Math.min(gestureState.dy, 60) / 120));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 30 || gestureState.vy > 0.8) {
            hideToast();
            return;
          }

          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 18,
              bounciness: 5,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
              speed: 18,
              bounciness: 5,
            }),
          ]).start();
        },
      }),
    [opacity, translateY],
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrapper,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toast}>
        <View style={[styles.indicator, { backgroundColor: COLORS[type] }]} />
        <View style={styles.textBlock}>
          {text1 ? (
            <Text style={styles.title} numberOfLines={1}>
              {text1}
            </Text>
          ) : null}
          {text2 ? (
            <Text style={styles.body} numberOfLines={2}>
              {text2}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

export const toastConfig = {
  success: ({ text1, text2 }: ToastProps) => <TossToast type="success" text1={text1} text2={text2} />,
  error: ({ text1, text2 }: ToastProps) => <TossToast type="error" text1={text1} text2={text2} />,
  info: ({ text1, text2 }: ToastProps) => <TossToast type="info" text1={text1} text2={text2} />,
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: 20,
  },
  toast: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "rgba(20, 23, 30, 0.96)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 14,
  },
  indicator: {
    width: 6,
    alignSelf: "stretch",
    borderRadius: 999,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  body: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    lineHeight: 18,
  },
});
