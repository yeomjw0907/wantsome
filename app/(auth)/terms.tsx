import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const TERMS_ITEMS = [
  { key: "terms", required: true, label: "서비스 이용약관 동의" },
  { key: "privacy", required: true, label: "개인정보처리방침 동의" },
  { key: "age18", required: true, label: "만 18세 이상임을 확인합니다" },
  { key: "marketing", required: false, label: "마케팅 정보 수신 동의" },
] as const;

type TermKey = (typeof TERMS_ITEMS)[number]["key"];

export default function TermsScreen() {
  const router = useRouter();
  const [agreed, setAgreed] = useState<Record<TermKey, boolean>>({
    terms: false,
    privacy: false,
    age18: false,
    marketing: false,
  });
  const [showDetail, setShowDetail] = useState<TermKey | null>(null);

  const allRequired =
    agreed.terms && agreed.privacy && agreed.age18;

  const toggle = useCallback((key: TermKey) => {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleAll = useCallback(() => {
    const next = !(agreed.terms && agreed.privacy && agreed.age18 && agreed.marketing);
    setAgreed({
      terms: next,
      privacy: next,
      age18: next,
      marketing: next,
    });
  }, [agreed]);

  const handleNext = () => {
    if (!allRequired) return;
    router.replace("/(auth)/verify");
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-6 pt-10"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-navy text-2xl font-bold mb-6">약관 동의</Text>

        <TouchableOpacity
          onPress={toggleAll}
          className="flex-row items-center pb-4 border-b border-gray-200 mb-4"
        >
          <View
            className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
              agreed.terms && agreed.privacy && agreed.age18 && agreed.marketing
                ? "bg-pink border-pink"
                : "border-gray-300"
            }`}
          >
            {(agreed.terms && agreed.privacy && agreed.age18 && agreed.marketing) && (
              <Text className="text-white text-xs">✓</Text>
            )}
          </View>
          <Text className="text-gray-900 font-semibold">전체 동의</Text>
        </TouchableOpacity>

        {TERMS_ITEMS.map(({ key, required, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => toggle(key)}
            className="flex-row items-center py-3"
          >
            <View
              className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                agreed[key] ? "bg-pink border-pink" : "border-gray-300"
              }`}
            >
              {agreed[key] && <Text className="text-white text-xs">✓</Text>}
            </View>
            <Text className="text-gray-900 flex-1">
              {required && "(필수) "}
              {label}
            </Text>
            <TouchableOpacity
              onPress={() => setShowDetail(showDetail === key ? null : key)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text className="text-pink text-sm">보기</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {showDetail && (
          <View className="mt-4 p-4 bg-gray-50 rounded-xl max-h-48">
            <ScrollView>
              <Text className="text-gray-600 text-sm">
                {showDetail === "terms" &&
                  "서비스 이용약관 전문 (제1조~제7조). 원썸 컴퍼니 wantsome 서비스 이용조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정합니다. 만 18세 이상 성인만 이용 가능합니다."}
                {showDetail === "privacy" &&
                  "개인정보처리방침. 수집 항목: 이름, 생년월일, 휴대폰번호(본인인증 시), 소셜 로그인 정보, 닉네임, 프로필 사진. 보유 기간: 탈퇴 시 삭제, CI 90일 보관."}
                {showDetail === "age18" &&
                  "본인은 만 18세 이상 성인임을 확인하며, 본인인증을 통해 연령 확인 후 서비스를 이용합니다."}
                {showDetail === "marketing" &&
                  "이벤트, 맞춤 혜택 등 마케팅 정보를 이메일/앱 푸시로 수신하는 것에 동의합니다. (선택)"}
              </Text>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View className="px-4 pb-8 pt-4">
        <PrimaryButton
          label="다음"
          onPress={handleNext}
          disabled={!allRequired}
        />
      </View>
    </View>
  );
}
