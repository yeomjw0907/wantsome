import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiCall } from "@/lib/api";

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { isLoggedIn } = useAuthStore();

  useEffect(() => {
    if (!isLoggedIn) return;

    let subscription: Notifications.Subscription | null = null;

    async function registerToken() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") return;

        // Android 채널 설정
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "기본 알림",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF6B9D",
          });
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const pushToken = tokenData.data;

        // push_tokens 테이블에 등록 (다중 기기 지원)
        await apiCall("/api/push/register", {
          method: "POST",
          body: JSON.stringify({ push_token: pushToken }),
        }).catch(() => null);

        // users.push_token 컬럼도 동기화 (어드민 일괄 발송용)
        await apiCall("/api/users/push-token", {
          method: "PATCH",
          body: JSON.stringify({ push_token: pushToken }),
        }).catch(() => null);
      } catch {
        // 권한 거부 또는 오류 시 무시
      }
    }

    registerToken();

    // 포그라운드 알림 수신 리스너
    subscription = Notifications.addNotificationReceivedListener(() => {
      // 필요 시 포그라운드 알림 처리 추가
    });

    return () => {
      subscription?.remove();
    };
  }, [isLoggedIn]);
}
