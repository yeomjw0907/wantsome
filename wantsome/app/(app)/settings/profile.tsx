/**
 * 프로필 편집 화면
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "갤러리 권한이 필요합니다." });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const hasChanges =
    nickname !== user?.nickname ||
    bio !== (user?.bio ?? "") ||
    imageUri !== null;

  const handleSave = async () => {
    if (!hasChanges) return;

    if (nickname.length < 2 || nickname.length > 20) {
      Toast.show({ type: "error", text1: "닉네임은 2~20자 이하여야 합니다." });
      return;
    }
    if (bio.length > 200) {
      Toast.show({ type: "error", text1: "자기소개는 200자 이하여야 합니다." });
      return;
    }

    setIsLoading(true);
    try {
      let profileImgUrl: string | undefined;

      if (imageUri) {
        const formData = new FormData();
        formData.append("file", {
          uri: imageUri,
          type: "image/jpeg",
          name: `profile-${Date.now()}.jpg`,
        } as unknown as Blob);

        const uploadRes = await apiCall<{ url: string }>("/api/users/me/avatar", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data" },
          body: formData as unknown as BodyInit,
        });
        profileImgUrl = uploadRes.url;
      }

      await apiCall("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          nickname,
          bio,
          ...(profileImgUrl ? { profile_img: profileImgUrl } : {}),
        }),
      });

      updateUser({
        nickname,
        bio,
        ...(profileImgUrl ? { profile_img: profileImgUrl } : {}),
      });

      Toast.show({ type: "success", text1: "프로필이 수정됐습니다." });
      router.back();
    } catch {
      Toast.show({ type: "error", text1: "저장에 실패했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  const currentAvatar = imageUri ?? user?.profile_img;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
        {/* 헤더 */}
        <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
            </TouchableOpacity>
            <Text className="text-navy text-lg font-bold">프로필 편집</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasChanges || isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FF6B9D" />
            ) : (
              <Text
                className={`text-sm font-semibold ${
                  hasChanges ? "text-pink" : "text-gray-300"
                }`}
              >
                저장
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-5 pt-8" showsVerticalScrollIndicator={false}>
          {/* 프로필 이미지 */}
          <View className="items-center mb-8">
            <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
              <View className="relative">
                <View className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                  {currentAvatar ? (
                    <Image
                      source={{ uri: currentAvatar }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Ionicons name="person" size={40} color="#C8C8D8" />
                    </View>
                  )}
                </View>
                <View className="absolute bottom-0 right-0 bg-pink w-7 h-7 rounded-full items-center justify-center border-2 border-white">
                  <Ionicons name="camera" size={12} color="white" />
                </View>
              </View>
            </TouchableOpacity>
            <Text className="text-gray-400 text-xs mt-2">탭하여 사진 변경</Text>
          </View>

          {/* 닉네임 */}
          <View className="bg-white rounded-2xl px-4 pt-3 pb-4 mb-4">
            <Text className="text-gray-400 text-xs font-medium mb-2">닉네임</Text>
            <TextInput
              className="text-navy text-base"
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임 입력"
              placeholderTextColor="#C8C8D8"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text className="text-gray-300 text-xs text-right mt-1">
              {nickname.length}/20
            </Text>
          </View>

          {/* 자기소개 */}
          <View className="bg-white rounded-2xl px-4 pt-3 pb-4 mb-4">
            <Text className="text-gray-400 text-xs font-medium mb-2">자기소개</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="나를 소개하는 한 마디를 입력하세요"
              placeholderTextColor="#C8C8D8"
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ fontSize: 14, color: "#1B2A4A", minHeight: 72 }}
            />
            <Text className="text-gray-300 text-xs text-right mt-1">
              {bio.length}/200
            </Text>
          </View>

          {/* 이메일 (수정 불가) */}
          <View className="bg-white rounded-2xl px-4 pt-3 pb-4 mb-8">
            <Text className="text-gray-400 text-xs font-medium mb-2">이메일</Text>
            <Text className="text-gray-400 text-base">{user?.id ? "이메일 계정" : "-"}</Text>
            <Text className="text-gray-300 text-xs mt-1">이메일은 변경할 수 없습니다.</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
