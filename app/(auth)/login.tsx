import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";
import Toast from "react-native-toast-message";

type SocialProvider = "google" | "apple" | "kakao";

interface SocialLoginResponse {
  user: {
    id: string;
    nickname: string;
    profile_img: string | null;
    role: "consumer" | "creator" | "both";
    is_verified: boolean;
    blue_mode: boolean;
    red_mode: boolean;
    suspended_until: string | null;
  };
  is_new: boolean;
  points: number;
  first_charge_deadline: string | null;
  is_first_charged: boolean;
  access_token: string;
}

function parseSessionFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  try {
    const hash = url.includes("#") ? url.split("#")[1] : "";
    const params = new URLSearchParams(hash);
    return {
      access_token: params.get("access_token") ?? undefined,
      refresh_token: params.get("refresh_token") ?? undefined,
    };
  } catch {
    return {};
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const { setPoints, setFirstChargeInfo } = usePointStore();
  const [loading, setLoading] = useState<SocialProvider | null>(null);

  const handleSocialLogin = async (provider: SocialProvider) => {
    setLoading(provider);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider === "kakao" ? "kakao" : provider,
        options: {
          redirectTo: "wantsome://auth/callback",
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) {
        Toast.show({ type: "error", text1: "로그인 URL을 가져올 수 없습니다." });
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        "wantsome://auth/callback"
      );

      if (result.type !== "success" || !result.url) {
        if (result.type === "cancel") return;
        Toast.show({ type: "error", text1: "로그인에 실패했습니다." });
        return;
      }

      const { access_token, refresh_token } = parseSessionFromUrl(result.url);
      if (!access_token) {
        Toast.show({ type: "error", text1: "세션을 받지 못했습니다." });
        return;
      }

      await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token ?? "",
      });

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("세션 없음");

      try {
        const apiRes = await apiCall<SocialLoginResponse>("/api/auth/social-login", {
          method: "POST",
          body: JSON.stringify({
            provider,
            token: session.access_token,
          }),
        });
        setUser(apiRes.user);
        setPoints(apiRes.points ?? 0);
        setFirstChargeInfo(apiRes.first_charge_deadline, apiRes.is_first_charged);
        if (apiRes.is_new) {
          const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
          setFirstChargeInfo(deadline, false);
        }
      } catch {
        const email = session.user?.email ?? "";
        const name = session.user?.user_metadata?.name ?? session.user?.user_metadata?.full_name ?? "유저";
        setUser({
          id: session.user.id,
          nickname: name || email?.split("@")[0] || "유저",
          profile_img: session.user?.user_metadata?.avatar_url ?? null,
          role: "consumer",
          is_verified: false,
          blue_mode: true,
          red_mode: false,
          suspended_until: null,
        });
        const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        setFirstChargeInfo(deadline, false);
      }

      Toast.show({ type: "success", text1: "로그인되었습니다." });
      const ageOk = await AsyncStorage.getItem("age_verified");
      router.replace(ageOk ? "/(auth)/terms" : "/(auth)/age-check");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "로그인에 실패했습니다.";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setLoading(null);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-navy text-2xl font-bold text-center mb-2">로그인</Text>
      <Text className="text-gray-500 text-center mb-8">
        소셜 계정으로 간편하게 시작하세요
      </Text>

      <TouchableOpacity
        onPress={() => handleSocialLogin("google")}
        disabled={!!loading}
        className="bg-gray-100 h-[52px] rounded-full items-center justify-center mb-3 flex-row"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading === "google" ? (
          <ActivityIndicator color="#1A1A2E" />
        ) : (
          <Text className="text-gray-900 font-semibold">Google로 계속하기</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleSocialLogin("apple")}
        disabled={!!loading}
        className="bg-gray-900 h-[52px] rounded-full items-center justify-center mb-3"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading === "apple" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold">Apple로 계속하기</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleSocialLogin("kakao")}
        disabled={!!loading}
        className="bg-[#FEE500] h-[52px] rounded-full items-center justify-center"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading === "kakao" ? (
          <ActivityIndicator color="#1A1A2E" />
        ) : (
          <Text className="text-gray-900 font-semibold">카카오로 계속하기</Text>
        )}
      </TouchableOpacity>

      {/* 구분선 */}
      <View className="flex-row items-center my-5">
        <View className="flex-1 h-px bg-gray-200" />
        <Text className="text-gray-400 text-sm mx-3">또는</Text>
        <View className="flex-1 h-px bg-gray-200" />
      </View>

      {/* 전화번호 로그인 */}
      <TouchableOpacity
        onPress={() => router.push("/(auth)/phone-login")}
        disabled={!!loading}
        className="border border-gray-200 h-[52px] rounded-full items-center justify-center flex-row gap-2"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        <Text className="text-gray-600">📱</Text>
        <Text className="text-gray-700 font-semibold">전화번호로 계속하기</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <Text
          className="text-gray-500 text-center mt-8 text-sm"
          onPress={() => router.replace("/(app)/(tabs)")}
        >
          [테스트] 로그인 없이 메인으로
        </Text>
      )}
    </View>
  );
}
