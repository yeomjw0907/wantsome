import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePointStore } from "@/stores/usePointStore";

/** docs/context/05_app_init.md 기준 앱 시작 플로우 */
interface SystemStatus {
  maintenance_mode: string;
  maintenance_message: string;
  maintenance_eta: string;
  min_version_ios: string;
  min_version_android: string;
  force_update_message: string;
  cs_url: string;
}

interface MeResponse {
  id: string;
  nickname: string;
  profile_img: string | null;
  role: "consumer" | "creator" | "both";
  is_verified: boolean;
  blue_mode: boolean;
  red_mode: boolean;
  suspended_until: string | null;
  points: number;
  first_charge_deadline: string | null;
  is_first_charged: boolean;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type AppInitStatus =
  | "loading"
  | "maintenance"
  | "update-required"
  | "onboarding"
  | "age-check"
  | "login"
  | "suspended"
  | "ready";

export function useAppInit() {
  const router = useRouter();
  const { setUser, isOnboarded } = useAuthStore();
  const { setPoints, setFirstChargeInfo } = usePointStore();
  const [status, setStatus] = useState<AppInitStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) setStatus("onboarding");
    }, 5000);

    async function init() {
      try {
        // [1] 시스템 상태 체크 (API 서버 미준비 시 graceful 처리)
        let systemStatus: SystemStatus | null = null;
        try {
          systemStatus = await apiCall<SystemStatus>("/api/system/status");
        } catch {
          // API 서버 미준비 → 점검/버전 체크 건너뜀
        }

        if (systemStatus) {
          if (systemStatus.maintenance_mode === "true") {
            if (!cancelled) setStatus("maintenance");
            return;
          }

          // [2] 버전 체크
          const appVersion =
            (Constants.expoConfig?.version ?? "1.0.0");
          const minVersion =
            Platform.OS === "ios"
              ? systemStatus.min_version_ios
              : systemStatus.min_version_android;

          if (compareVersions(appVersion, minVersion) < 0) {
            if (!cancelled) setStatus("update-required");
            return;
          }
        }

        // [3] 온보딩 완료 여부
        const onboarded = await AsyncStorage.getItem("onboarding_completed");
        if (!onboarded) {
          if (!cancelled) setStatus("onboarding");
          return;
        }

        // [3.5] 연령 인증 여부 (18세 미만 차단 — 앱스토어 심사 필수)
        const ageVerified = await AsyncStorage.getItem("age_verified");
        if (!ageVerified) {
          if (!cancelled) setStatus("age-check");
          return;
        }

        // [4] Supabase 세션 확인
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) setStatus("login");
          return;
        }

        // [5] 유저 상태 조회
        try {
          const me = await apiCall<MeResponse>("/api/users/me");

          // 정지 체크
          if (
            me.suspended_until &&
            new Date(me.suspended_until) > new Date()
          ) {
            if (!cancelled) setStatus("suspended");
            return;
          }

          // Store 업데이트
          setUser({
            id: me.id,
            nickname: me.nickname,
            profile_img: me.profile_img,
            role: me.role,
            is_verified: me.is_verified,
            blue_mode: me.blue_mode,
            red_mode: me.red_mode,
            suspended_until: me.suspended_until,
          });
          setPoints(me.points);
          setFirstChargeInfo(me.first_charge_deadline, me.is_first_charged);
        } catch {
          // API 서버 미준비 시 세션만 있어도 메인 진입 허용
        }

        if (!cancelled) setStatus("ready");
      } catch {
        // 예상치 못한 오류 → 로그인 화면으로
        if (!cancelled) setStatus("login");
      }
    }

    init();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // 상태에 따라 라우팅
  useEffect(() => {
    switch (status) {
      case "maintenance":
        router.replace("/maintenance");
        break;
      case "update-required":
        router.replace("/update-required");
        break;
      case "onboarding":
        router.replace("/(auth)/splash");
        break;
      case "age-check":
        router.replace("/(auth)/age-check");
        break;
      case "login":
        router.replace("/(auth)/login");
        break;
      case "suspended":
        router.replace("/suspended");
        break;
      case "ready":
        router.replace("/(app)/(tabs)");
        break;
    }
  }, [status]);

  return { status };
}
