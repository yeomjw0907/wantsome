import React from "react";
import { View, Text, StyleSheet } from "react-native";

type ToastType = "success" | "error" | "info";

interface ToastProps {
  text1?: string;
  text2?: string;
}

const COLORS: Record<ToastType, string> = {
  success: "#F43F5E", // rose-500 (브랜드 핑크)
  error: "#EF4444",   // red-500
  info: "#94A3B8",    // slate-400
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

function CustomToastView({
  type,
  text1,
  text2,
}: {
  type: ToastType;
  text1?: string;
  text2?: string;
}) {
  const color = COLORS[type];
  const icon = ICONS[type];

  return (
    <View style={styles.container}>
      <View style={[styles.stripe, { backgroundColor: color }]} />
      <View style={[styles.iconCircle, { backgroundColor: color }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.textContainer}>
        {text1 ? <Text style={styles.text1} numberOfLines={1}>{text1}</Text> : null}
        {text2 ? <Text style={styles.text2} numberOfLines={2}>{text2}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig = {
  success: ({ text1, text2 }: ToastProps) => (
    <CustomToastView type="success" text1={text1} text2={text2} />
  ),
  error: ({ text1, text2 }: ToastProps) => (
    <CustomToastView type="error" text1={text1} text2={text2} />
  ),
  info: ({ text1, text2 }: ToastProps) => (
    <CustomToastView type="info" text1={text1} text2={text2} />
  ),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingRight: 16,
    paddingVertical: 12,
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 56,
    maxWidth: 360,
    alignSelf: "center",
    width: "100%",
  },
  stripe: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: 12,
    marginVertical: 4,
    marginLeft: 6,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  text1: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  text2: {
    color: "#A1A1A1",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
