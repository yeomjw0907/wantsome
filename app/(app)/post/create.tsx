/**
 * 포스트 작성 화면 (크리에이터 전용)
 * - expo-image-picker로 최대 3장 선택
 * - 캡션 입력
 * - Supabase Storage 업로드 후 포스트 생성
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";

const MAX_IMAGES = 3;
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

interface PickedImage {
  uri: string;
  type: string;
  name: string;
}

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
      return;
    }
    const remaining = MAX_IMAGES - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as any,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (!result.canceled) {
      const selected = result.assets.slice(0, remaining).map((a) => ({
        uri: a.uri,
        type: a.mimeType ?? "image/jpeg",
        name: `post-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
      }));
      setImages((prev) => [...prev, ...selected].slice(0, MAX_IMAGES));
    }
  }, [images.length]);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  /** FormData 업로드는 apiCall이 Content-Type을 application/json으로 강제하므로
   *  직접 fetch 사용 */
  const uploadImage = async (img: PickedImage, token: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", {
      uri: img.uri,
      type: img.type,
      name: img.name,
    } as any);

    const res = await fetch(`${BASE_URL}/api/posts/upload-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message ?? "이미지 업로드에 실패했습니다.");
    }
    const json = await res.json();
    return json.url as string;
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      Toast.show({ type: "error", text1: "이미지를 최소 1장 선택해주세요." });
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      // 1. 이미지 순차 업로드
      const imageUrls: string[] = [];
      for (const img of images) {
        const url = await uploadImage(img, token);
        imageUrls.push(url);
      }

      // 2. 포스트 생성
      await apiCall("/api/posts", {
        method: "POST",
        body: JSON.stringify({ caption: caption.trim(), images: imageUrls }),
      });

      Toast.show({ type: "success", text1: "포스트가 게시됐습니다! 🎉" });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "포스트 게시에 실패했습니다.";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 헤더 */}
      <View
        className="flex-row items-center justify-between px-4 bg-white border-b border-gray-100"
        style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="close" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <Text className="text-navy text-base font-bold">새 게시물</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || images.length === 0}
          className="bg-pink rounded-full px-4 py-2"
          style={{ opacity: images.length === 0 || loading ? 0.5 : 1 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-bold text-sm">공유</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 이미지 선택 영역 */}
        <Text className="text-gray-500 text-xs font-semibold mb-3">
          사진 선택 ({images.length}/{MAX_IMAGES})
        </Text>
        <View className="flex-row flex-wrap gap-3 mb-2">
          {images.map((img, idx) => (
            <View
              key={idx}
              style={{ position: "relative", width: 100, height: 100 }}
            >
              <Image
                source={{ uri: img.uri }}
                style={{ width: 100, height: 100, borderRadius: 12 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => removeImage(idx)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  backgroundColor: "#FF5C7A",
                  borderRadius: 10,
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={12} color="white" />
              </TouchableOpacity>
              {/* 순서 표시 */}
              <View
                style={{
                  position: "absolute",
                  bottom: 5,
                  left: 5,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  borderRadius: 8,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                  {idx + 1}
                </Text>
              </View>
            </View>
          ))}

          {images.length < MAX_IMAGES && (
            <TouchableOpacity
              onPress={pickImages}
              disabled={loading}
              style={{
                width: 100,
                height: 100,
                borderRadius: 12,
                backgroundColor: "#F5F5FA",
                borderWidth: 1.5,
                borderColor: "#E0E0EF",
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="add-circle-outline" size={28} color="#9CA3AF" />
              <Text
                style={{ color: "#9CA3AF", fontSize: 11, marginTop: 4 }}
              >
                {images.length === 0 ? "사진 선택" : "추가"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text className="text-xs text-gray-400 mb-6">
          최대 3장, 드래그로 순서 변경 불가 (선택 순서가 게시 순서입니다)
        </Text>

        {/* 캡션 입력 */}
        <Text className="text-gray-500 text-xs font-semibold mb-2">
          문구 (선택)
        </Text>
        <View className="bg-gray-50 rounded-2xl px-4 py-3 mb-2">
          <TextInput
            placeholder="팬들에게 전하고 싶은 말을 적어보세요..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={caption}
            onChangeText={setCaption}
            maxLength={500}
            style={{
              fontSize: 14,
              color: "#1B2A4A",
              lineHeight: 20,
              minHeight: 100,
            }}
            textAlignVertical="top"
          />
        </View>
        <Text className="text-xs text-gray-400 text-right mb-6">
          {caption.length}/500
        </Text>

        {/* 가이드라인 */}
        <View className="bg-pink/10 rounded-2xl px-4 py-4">
          <Text className="text-pink font-semibold text-sm mb-2">
            📸 게시물 가이드라인
          </Text>
          <Text className="text-pink/70 text-xs leading-5">
            {"• 불법 촬영물, 미성년자 관련 콘텐츠는 즉시 삭제됩니다\n"}
            {"• 개인정보(연락처, 주소 등)는 포함하지 마세요\n"}
            {"• 실제 얼굴 혹은 각도를 살린 매력적인 사진을 올려보세요 💕\n"}
            {"• 팬들과의 교류는 포인트 수익으로 이어집니다!"}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
