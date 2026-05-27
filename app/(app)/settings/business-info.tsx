import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BUSINESS_INFO } from "@/constants/businessInfo";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="px-5 py-4 border-b border-gray-100">
      <Text className="text-xs text-gray-400 mb-1">{label}</Text>
      <Text className="text-sm text-gray-900 font-medium">{value}</Text>
    </View>
  );
}

export default function BusinessInfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-lg font-bold">사업자 정보</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl mx-4 mt-5 overflow-hidden">
          <InfoRow label="상호(법인명)" value={BUSINESS_INFO.companyName} />
          <InfoRow label="대표자" value={BUSINESS_INFO.ceoName} />
          <InfoRow label="사업자등록번호" value={BUSINESS_INFO.businessNumber} />
          <InfoRow label="사업장 주소" value={BUSINESS_INFO.address} />
          <InfoRow label="고객센터 전화" value={BUSINESS_INFO.phone} />
          <InfoRow label="고객센터 이메일" value={BUSINESS_INFO.email} />
        </View>
        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}
