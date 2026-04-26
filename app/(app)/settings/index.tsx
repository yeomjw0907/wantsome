/**
 * 설정 화면
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useAuthStore } from "@/stores/useAuthStore";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function MenuItem({ icon, iconColor = "#1B2A4A", label, value, danger, onPress, rightElement }: MenuItemProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-5 py-4 bg-white"
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="w-8 h-8 items-center justify-center mr-3">
        <Ionicons name={icon} size={20} color={danger ? "#FF5C7A" : iconColor} />
      </View>
      <Text className={`flex-1 text-sm font-medium ${danger ? "text-red" : "text-gray-900"}`}>
        {label}
      </Text>
      {value && <Text className="text-gray-400 text-sm mr-2">{value}</Text>}
      {rightElement ?? (
        onPress && !danger ? (
          <Ionicons name="chevron-forward" size={16} color="#C8C8D8" />
        ) : null
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-5 pt-5 pb-2">
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isCreator = user?.role === "creator" || user?.role === "both";

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login" as never);
        },
      },
    ]);
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (value) {
      Toast.show({ type: "info", text1: "알림이 활성화됐습니다." });
    } else {
      Toast.show({ type: "info", text1: "알림이 비활성화됐습니다." });
    }
  };

  const handleCustomerService = () => {
    Toast.show({ type: "info", text1: "고객센터는 준비 중입니다.", text2: "contact@wantsome.kr" });
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold">설정</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 알림 */}
        <SectionHeader title="알림" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden">
          <MenuItem
            icon="notifications-outline"
            iconColor="#4D9FFF"
            label="푸시 알림"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: "#E5E7EB", true: "#FF6B9D" }}
                thumbColor="white"
              />
            }
          />
        </View>

        {/* 계정 */}
        <SectionHeader title="계정" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden">
          <MenuItem
            icon="person-outline"
            iconColor="#22C55E"
            label="프로필 편집"
            onPress={() => router.push("/(app)/settings/profile" as never)}
          />
          <View className="h-px bg-gray-100 ml-16" />
          {isCreator && (
            <>
              <MenuItem
                icon="speedometer-outline"
                iconColor="#FF9800"
                label="크리에이터 대시보드"
                onPress={() => router.push("/(creator)/dashboard" as never)}
              />
              <View className="h-px bg-gray-100 ml-16" />
            </>
          )}
          <MenuItem
            icon="ban-outline"
            iconColor="#8E8EA0"
            label="차단 목록"
            onPress={() => router.push("/(app)/settings/blocks" as never)}
          />
        </View>

        {/* 지원 */}
        <SectionHeader title="지원" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden">
          <MenuItem
            icon="help-circle-outline"
            iconColor="#4D9FFF"
            label="고객센터"
            onPress={handleCustomerService}
          />
          <View className="h-px bg-gray-100 ml-16" />
          <MenuItem
            icon="document-text-outline"
            iconColor="#8E8EA0"
            label="이용약관"
            onPress={() => Toast.show({ type: "info", text1: "준비 중입니다." })}
          />
          <View className="h-px bg-gray-100 ml-16" />
          <MenuItem
            icon="shield-outline"
            iconColor="#8E8EA0"
            label="개인정보처리방침"
            onPress={() => Toast.show({ type: "info", text1: "준비 중입니다." })}
          />
          <View className="h-px bg-gray-100 ml-16" />
          <MenuItem
            icon="information-circle-outline"
            iconColor="#8E8EA0"
            label="앱 버전"
            value="1.0.0"
          />
        </View>

        {/* 계정 관리 */}
        <SectionHeader title="계정 관리" />
        <View className="bg-white rounded-2xl mx-4 overflow-hidden">
          <MenuItem
            icon="log-out-outline"
            iconColor="#8E8EA0"
            label="로그아웃"
            onPress={handleLogout}
          />
          <View className="h-px bg-gray-100 ml-16" />
          <MenuItem
            icon="trash-outline"
            label="회원 탈퇴"
            danger
            onPress={() => router.push("/(app)/settings/withdraw" as never)}
          />
        </View>

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}
