/**
 * 크리에이터 온보딩 - 신분증 업로드 (인증 뱃지 획득)
 * - "크리에이터 인증 뱃지" 포지셔닝 (신분증 제출이 아닌 혜택 중심)
 * - 혜택 안내: 검색 상단 노출 + 프리미엄(레드) 모드 활성화
 * - expo-image-picker 카메라/갤러리
 * - POST /api/creators/upload-id
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { uploadFormData } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { MODE_LABEL } from "@/constants/branding";

const BENEFITS = [
  { icon: "search", label: "피드 상단 노출 우선순위", color: "#4D9FFF" },
  { icon: "star", label: "인증 뱃지 ✅ 획득", color: "#FF9800" },
  { icon: "flame", label: `${MODE_LABEL.red} 모드 활성화`, color: "#FF5C7A" },
  { icon: "shield-checkmark", label: "신뢰도 향상 (소비자 신뢰)", color: "#22C55E" },
];

export default function IdCardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const { status } = await (useCamera
      ? ImagePicker.requestCameraPermissionsAsync()
      : ImagePicker.requestMediaLibraryPermissionsAsync());

    if (status !== "granted") {
      Toast.show({
        type: "error",
        text1: useCamera ? "카메라 권한이 필요합니다." : "갤러리 권한이 필요합니다.",
      });
      return;
    }

    const result = await (useCamera
      ? ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        })
      : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        }));

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const showImagePicker = () => {
    Alert.alert("사진 선택", "신분증 사진을 촬영하거나 갤러리에서 선택하세요.", [
      { text: "취소", style: "cancel" },
      { text: "카메라로 촬영", onPress: () => pickImage(true) },
      { text: "갤러리에서 선택", onPress: () => pickImage(false) },
    ]);
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      Toast.show({ type: "error", text1: "신분증 사진을 첨부해주세요." });
      return;
    }

    setIsLoading(true);
    try {
      // FormData로 이미지 업로드
      const formData = new FormData();
      formData.append("userId", user?.id ?? "");
      formData.append("file", {
        uri: imageUri,
        type: "image/jpeg",
        name: `id-card-${Date.now()}.jpg`,
      } as unknown as Blob);

      await uploadFormData<{ success: boolean }>("/api/creators/upload-id", formData);

      Toast.show({
        type: "success",
        text1: "신분증 제출 완료",
        text2: "관리자 검토 후 인증 뱃지가 부여됩니다.",
      });
      router.push("/(creator)/onboarding/account");
    } catch {
      Toast.show({ type: "error", text1: "업로드에 실패했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      "나중에 인증하기",
      `신분증 인증 없이도 ${MODE_LABEL.blue} 모드는 이용 가능합니다. ${MODE_LABEL.red} 모드와 인증 뱃지는 인증 후 활성화됩니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "나중에 하기",
          onPress: () => router.push("/(creator)/onboarding/account"),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
          </TouchableOpacity>
          <View>
            <Text className="text-navy text-lg font-bold">크리에이터 인증</Text>
            <Text className="text-gray-400 text-xs">크리에이터 등록 2/3</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-gray-400 text-sm">건너뛰기</Text>
        </TouchableOpacity>
      </View>

      {/* 진행 바 */}
      <View className="flex-row h-1 bg-gray-100">
        <View className="w-2/3 bg-pink" />
      </View>

      <View className="flex-1 px-5 py-6">
        {/* 타이틀 */}
        <Text className="text-navy text-2xl font-bold mb-2">
          ✅ 크리에이터 인증 뱃지
        </Text>
        <Text className="text-gray-500 text-sm mb-6">
          본인·연령 확인을 완료하면 아래 혜택을 받을 수 있습니다.
        </Text>

        {/* 혜택 카드 */}
        <View className="bg-gray-50 rounded-2xl p-4 mb-6 gap-3">
          {BENEFITS.map((benefit) => (
            <View key={benefit.label} className="flex-row items-center gap-3">
              <View
                className="w-8 h-8 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${benefit.color}20` }}
              >
                <Ionicons
                  name={benefit.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={benefit.color}
                />
              </View>
              <Text className="text-gray-900 text-sm font-medium">{benefit.label}</Text>
            </View>
          ))}
        </View>

        {/* 이미지 업로드 영역 */}
        <TouchableOpacity
          className="border-2 border-dashed border-gray-200 rounded-2xl h-48 items-center justify-center mb-4"
          style={imageUri ? { borderColor: "#FF6B9D", borderStyle: "solid" } : {}}
          onPress={showImagePicker}
          activeOpacity={0.7}
        >
          {imageUri ? (
            <>
              <Image
                source={{ uri: imageUri }}
                className="w-full h-full rounded-2xl"
                resizeMode="cover"
              />
              <View className="absolute bottom-3 right-3 bg-pink rounded-full w-8 h-8 items-center justify-center">
                <Ionicons name="pencil" size={14} color="white" />
              </View>
            </>
          ) : (
            <>
              <View className="w-14 h-14 bg-bluebell rounded-2xl items-center justify-center mb-3">
                <Ionicons name="id-card-outline" size={28} color="#4D9FFF" />
              </View>
              <Text className="text-navy font-semibold text-sm">
                신분증 사진 첨부
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                주민등록증 또는 운전면허증
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* 안내 */}
        <View className="bg-yellow-50 rounded-xl px-4 py-3 flex-row gap-2">
          <Ionicons name="lock-closed" size={16} color="#F59E0B" />
          <Text className="text-yellow-700 text-xs flex-1">
            신분증 정보는 암호화되어 안전하게 보관되며, 본인 확인 및 연령 확인 목적으로만 사용됩니다. 관리자만 열람 가능합니다.
          </Text>
        </View>
      </View>

      {/* 하단 버튼 */}
      <View
        className="px-5 pt-3 bg-white border-t border-gray-100"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          className={`h-[52px] rounded-full items-center justify-center ${
            imageUri ? "bg-pink" : "bg-gray-100"
          }`}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={imageUri ? "white" : "#8E8EA0"} />
          ) : (
            <Text
              className={`text-base font-semibold ${
                imageUri ? "text-white" : "text-gray-500"
              }`}
            >
              {imageUri ? "제출하고 다음 단계 →" : "사진을 첨부해주세요"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
