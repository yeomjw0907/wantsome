/**
 * 크리에이터 온보딩 - 용역계약서 전자서명
 * - 계약서 전문 ScrollView (끝까지 스크롤 시 서명란 활성)
 * - 서명 완료 → POST /api/creators/sign-contract
 */
import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

const CONTRACT_TEXT = `용역계약서

주식회사 98점7도(이하 "회사")와 크리에이터(이하 "크리에이터")는 아래와 같이 용역계약을 체결합니다.

제1조 (목적)
본 계약은 회사가 운영하는 원썸(wantsome) 서비스를 통해 크리에이터가 영상통화 서비스를 제공함에 있어 필요한 권리와 의무를 정함을 목적으로 합니다.

제2조 (계약의 성격)
1. 크리에이터는 회사의 소속 직원이 아닌 독립적인 용역 제공자입니다.
2. 크리에이터는 플랫폼을 통해 소비자와 영상통화 서비스를 제공합니다.

제3조 (수수료 및 정산)
1. 크리에이터의 기본 정산율은 통화 포인트의 50%입니다.
2. 활동 등급에 따라 정산율이 달라질 수 있습니다.
3. 정산은 매월 15일에 진행되며, 원천징수세 3.3%를 공제 후 지급합니다.
4. 정산 최저 금액 미달 시 다음 달로 이월됩니다.

제4조 (금지 행위)
크리에이터는 다음 행위를 엄격히 금지합니다.
1. 미성년자의 참여를 허용하는 행위
2. 성매매를 유도하거나 불법적인 성적 행위를 하는 행위
3. 불법 촬영 및 영상 유포 행위
4. 사기, 허위 정보 제공 행위
위반 시 즉시 계약 해지 및 법적 조치를 취합니다.

제5조 (책임)
1. 크리에이터는 자신의 활동에 대한 법적 책임을 집니다.
2. 플랫폼 정책 위반으로 인한 피해에 대해 회사는 책임지지 않습니다.

제6조 (계약 해지)
1. 회사는 약관 위반 시 사전 통보 없이 계약을 해지할 수 있습니다.
2. 크리에이터는 언제든 계약을 해지할 수 있으나, 미정산 금액은 정산 후 지급됩니다.

제7조 (기타)
1. 본 계약에 명시되지 않은 사항은 관련 법령 및 회사의 서비스 이용약관을 따릅니다.
2. 분쟁 발생 시 서울중앙지방법원을 관할 법원으로 합니다.

본 계약에 동의하고 서명합니다.`;

export default function ContractScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleScroll = useCallback(
    ({
      nativeEvent,
    }: {
      nativeEvent: {
        layoutMeasurement: { height: number };
        contentOffset: { y: number };
        contentSize: { height: number };
      };
    }) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const isBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
      if (isBottom && !hasScrolledToBottom) {
        setHasScrolledToBottom(true);
      }
    },
    [hasScrolledToBottom]
  );

  const handleSubmit = async () => {
    if (!isSigned) return;

    Alert.alert("계약서 서명 확인", "위 내용에 동의하고 서명하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "동의 및 서명",
        onPress: async () => {
          setIsLoading(true);
          try {
            await apiCall("/api/creators/sign-contract", {
              method: "POST",
              body: JSON.stringify({
                userId: user?.id,
                signatureData: `signed_${Date.now()}`,
              }),
            });
            Toast.show({
              type: "success",
              text1: "계약서 서명 완료",
              text2: "다음 단계로 이동합니다.",
            });
            router.push("/(creator)/onboarding/id-card");
          } catch {
            Toast.show({ type: "error", text1: "서명 처리에 실패했습니다." });
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#1B2A4A" />
        </TouchableOpacity>
        <View>
          <Text className="text-navy text-lg font-bold">용역계약서</Text>
          <Text className="text-gray-400 text-xs">크리에이터 등록 1/3</Text>
        </View>
      </View>

      {/* 진행 바 */}
      <View className="flex-row h-1 bg-gray-100">
        <View className="w-1/3 bg-pink" />
      </View>

      {/* 계약서 내용 */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-5 py-4"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
      >
        {!hasScrolledToBottom && (
          <View className="bg-bluebell rounded-xl px-4 py-3 mb-4 flex-row items-center gap-2">
            <Ionicons name="information-circle" size={18} color="#4D9FFF" />
            <Text className="text-blue text-xs flex-1">
              계약서를 끝까지 읽으면 서명이 활성화됩니다.
            </Text>
          </View>
        )}

        <View className="bg-gray-50 rounded-2xl p-4 mb-4">
          <Text className="text-gray-900 text-sm leading-7">{CONTRACT_TEXT}</Text>
        </View>

        {/* 서명 영역 */}
        {hasScrolledToBottom && !isSigned && (
          <View className="bg-bluebell rounded-2xl p-5 mb-4">
            <Text className="text-navy font-bold text-base mb-1">✍️ 서명하기</Text>
            <Text className="text-gray-500 text-sm mb-4">
              위 계약 내용을 충분히 읽고 이해했습니까?
            </Text>
            <TouchableOpacity
              className="bg-pink h-[52px] rounded-full items-center justify-center"
              onPress={() => setIsSigned(true)}
            >
              <Text className="text-white font-semibold text-base">
                동의하고 서명하기
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isSigned && (
          <View className="border-2 border-pink rounded-2xl p-5 mb-4 items-center">
            <Ionicons name="checkmark-circle" size={48} color="#FF6B9D" />
            <Text className="text-navy font-bold text-base mt-2">서명 완료</Text>
            <Text className="text-gray-500 text-sm text-center mt-1">
              {user?.nickname}님이 계약에 동의했습니다.
            </Text>
            <Text className="text-gray-400 text-xs mt-1">
              {new Date().toLocaleString("ko-KR")}
            </Text>
          </View>
        )}

        <View className="h-10" />
      </ScrollView>

      {/* 하단 버튼 */}
      <View
        className="px-5 pt-3 bg-white border-t border-gray-100"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {!hasScrolledToBottom && (
          <Text className="text-gray-400 text-sm text-center mb-3">
            ↓ 스크롤하여 계약서 전체를 읽어주세요
          </Text>
        )}
        <TouchableOpacity
          className={`h-[52px] rounded-full items-center justify-center ${
            isSigned ? "bg-pink" : hasScrolledToBottom ? "bg-navy" : "bg-gray-100"
          }`}
          onPress={
            isSigned
              ? handleSubmit
              : hasScrolledToBottom
              ? () => setIsSigned(true)
              : () => scrollRef.current?.scrollToEnd({ animated: true })
          }
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`text-base font-semibold ${
                hasScrolledToBottom ? "text-white" : "text-gray-500"
              }`}
            >
              {isSigned
                ? "다음 단계 →"
                : hasScrolledToBottom
                ? "서명하기"
                : "아래로 스크롤"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
