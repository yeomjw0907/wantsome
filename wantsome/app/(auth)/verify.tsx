/**
 * 성인 인증 화면 — 이중 모드
 * - fallback 모드: 생년월일 직접 입력 (PORTONE_API_SECRET 미설정 시)
 * - portone 모드: PASS 본인인증 WebBrowser 플로우 (PORTONE_API_SECRET 설정 시)
 *
 * 마운트 시 GET /api/auth/identity-verification-status 로 모드 결정
 * is_already_verified=true 이면 이 화면 스킵 → /(auth)/role
 */
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiCall } from "@/lib/api";
import Toast from "react-native-toast-message";

interface VerificationStatusResponse {
  mode: "portone" | "fallback";
  is_already_verified: boolean;
}

interface VerifyResponse {
  success: boolean;
  is_adult: boolean;
  verified_name: string | null;
}

interface CreateVerificationResponse {
  identityVerificationId: string;
  url: string;
}

export default function VerifyScreen() {
  const router = useRouter();
  const updateUser = useAuthStore((s) => s.updateUser);

  const [status, setStatus] = useState<"loading" | "fallback" | "portone">("loading");
  const [submitting, setSubmitting] = useState(false);

  // Fallback 모드 — 생년월일 입력
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const monthRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await apiCall<VerificationStatusResponse>(
        "/api/auth/identity-verification-status"
      );
      if (res.is_already_verified) {
        updateUser({ is_verified: true });
        router.replace("/(auth)/role");
        return;
      }
      setStatus(res.mode);
    } catch {
      // 서버 미준비 시 fallback 기본값
      setStatus("fallback");
    }
  };

  /* ── Fallback: 생년월일 제출 ── */
  const handleFallbackSubmit = async () => {
    const y = year.trim();
    const m = month.trim();
    const d = day.trim();

    if (y.length !== 4 || !m || !d) {
      Toast.show({ type: "error", text1: "생년월일을 모두 입력해주세요." });
      return;
    }
    const yi = parseInt(y);
    const mi = parseInt(m);
    const di = parseInt(d);
    if (isNaN(yi) || isNaN(mi) || isNaN(di) || mi < 1 || mi > 12 || di < 1 || di > 31) {
      Toast.show({ type: "error", text1: "올바른 생년월일을 입력해주세요." });
      return;
    }

    const birth_date = `${y}-${String(mi).padStart(2, "0")}-${String(di).padStart(2, "0")}`;
    setSubmitting(true);
    try {
      await apiCall<VerifyResponse>("/api/auth/verify-identity", {
        method: "POST",
        body: JSON.stringify({ fallback: true, birth_date }),
      });
      Toast.show({ type: "success", text1: "연령이 확인되었습니다." });
      router.replace("/(auth)/role");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── PortOne PASS ── */
  const handlePassVerify = async () => {
    setSubmitting(true);
    try {
      const { identityVerificationId, url } =
        await apiCall<CreateVerificationResponse>(
          "/api/auth/create-identity-verification",
          { method: "POST" }
        );

      const result = await WebBrowser.openAuthSessionAsync(
        url,
        "wantsome://auth/verify-callback"
      );

      if (result.type === "cancel") return;
      if (result.type !== "success" || !result.url) {
        Toast.show({ type: "error", text1: "본인인증을 완료해주세요." });
        return;
      }

      await apiCall<VerifyResponse>("/api/auth/verify-identity", {
        method: "POST",
        body: JSON.stringify({ identityVerificationId }),
      });

      updateUser({ is_verified: true });
      Toast.show({ type: "success", text1: "본인인증이 완료되었습니다." });
      router.replace("/(auth)/role");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "인증에 실패했습니다.";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 로딩 ── */
  if (status === "loading") {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#F43F5E" size="large" />
      </View>
    );
  }

  /* ── 공통 헤더 ── */
  const Header = () => (
    <>
      <Text className="text-center text-5xl mb-4">🔒</Text>
      <Text className="text-navy text-2xl font-bold text-center mb-3">
        연령 확인
      </Text>
      <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-8">
        <Text className="text-rose-600 text-sm text-center leading-6">
          ⚠️ <Text className="font-bold">wantsome</Text>은{" "}
          <Text className="font-bold">만 19세 이상</Text>만 이용할 수 있습니다.{"\n"}
          미성년자의 이용은 법적으로 금지되어 있습니다.
        </Text>
      </View>
    </>
  );

  /* ── Fallback UI ── */
  if (status === "fallback") {
    const canSubmit =
      year.length === 4 && month.length >= 1 && day.length >= 1 && !submitting;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-white"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-20 pb-10 justify-center">
            <Header />

            <Text className="text-gray-600 text-center mb-1 text-sm leading-6">
              생년월일을 입력하여 연령을 확인합니다.
            </Text>
            <Text className="text-gray-400 text-xs text-center mb-8">
              사업자 등록 완료 후 PASS 본인인증으로 전환됩니다.
            </Text>

            <Text className="text-sm font-semibold text-gray-700 mb-3">
              생년월일
            </Text>
            <View className="flex-row gap-3 mb-8">
              {/* 년 */}
              <View className="flex-1">
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-4 text-navy text-center text-base font-semibold"
                  placeholder="1990"
                  placeholderTextColor="#C0C0C8"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, "");
                    setYear(v);
                    if (v.length === 4) monthRef.current?.focus();
                  }}
                  autoFocus
                />
                <Text className="text-xs text-gray-400 text-center mt-1">년</Text>
              </View>

              {/* 월 */}
              <View style={{ width: 72 }}>
                <TextInput
                  ref={monthRef}
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-4 text-navy text-center text-base font-semibold"
                  placeholder="01"
                  placeholderTextColor="#C0C0C8"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={month}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, "");
                    setMonth(v);
                    if (v.length === 2) dayRef.current?.focus();
                  }}
                />
                <Text className="text-xs text-gray-400 text-center mt-1">월</Text>
              </View>

              {/* 일 */}
              <View style={{ width: 72 }}>
                <TextInput
                  ref={dayRef}
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-4 text-navy text-center text-base font-semibold"
                  placeholder="01"
                  placeholderTextColor="#C0C0C8"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={day}
                  onChangeText={(t) => setDay(t.replace(/\D/g, ""))}
                  returnKeyType="done"
                  onSubmitEditing={handleFallbackSubmit}
                />
                <Text className="text-xs text-gray-400 text-center mt-1">일</Text>
              </View>
            </View>

            <TouchableOpacity
              className="h-[56px] bg-pink rounded-full items-center justify-center"
              onPress={handleFallbackSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={{ opacity: canSubmit ? 1 : 0.5 }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-bold">확인</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ── PortOne PASS UI ── */
  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Header />

      <Text className="text-gray-600 text-center mb-8 leading-6">
        PASS 본인인증으로{"\n"}만 19세 이상 여부를 확인합니다.
      </Text>

      <TouchableOpacity
        className="h-[56px] bg-pink rounded-full items-center justify-center mb-4"
        onPress={handlePassVerify}
        disabled={submitting}
        activeOpacity={0.85}
        style={{ opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white text-base font-bold">PASS로 본인인증</Text>
        )}
      </TouchableOpacity>

      <Text className="text-gray-400 text-xs text-center">
        SKT · KT · LG U+ PASS 앱을 통한 통신사 본인인증
      </Text>
    </View>
  );
}
