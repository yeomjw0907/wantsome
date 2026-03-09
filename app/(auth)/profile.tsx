import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/stores/useAuthStore";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [profileUri, setProfileUri] = useState<string | null>(user?.profile_img ?? null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileUri(result.assets[0].uri);
      // Supabase Storage 업로드는 API 또는 직접 업로드 연동 시 추가
      // updateUser({ profile_img: uploadedUrl });
    }
  };

  const handleNext = () => {
    const name = nickname.trim() || "유저";
    updateUser({ nickname: name, profile_img: profileUri });
    router.replace("/(auth)/charge-promo");
  };

  return (
    <View className="flex-1 bg-white px-6 pt-10">
      <Text className="text-navy text-2xl font-bold mb-2">프로필 설정</Text>
      <Text className="text-gray-500 mb-8">닉네임과 사진을 설정해 주세요</Text>

      <TouchableOpacity
        onPress={pickImage}
        className="self-center w-24 h-24 rounded-full bg-gray-100 mb-6 overflow-hidden items-center justify-center"
      >
        {profileUri ? (
          <Image source={{ uri: profileUri }} className="w-full h-full" />
        ) : (
          <Text className="text-gray-500">사진</Text>
        )}
      </TouchableOpacity>

      <Text className="text-gray-900 font-medium mb-2">닉네임</Text>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        placeholder="닉네임 입력"
        placeholderTextColor="#8E8EA0"
        className="bg-gray-100 h-12 rounded-xl px-4 text-gray-900 mb-8"
        maxLength={20}
      />

      <PrimaryButton label="다음" onPress={handleNext} />
    </View>
  );
}
