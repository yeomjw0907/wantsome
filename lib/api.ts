/**
 * API 클라이언트 — docs/context/04_conventions.md
 * Supabase 세션 토큰을 Authorization 헤더에 자동 주입
 *
 * 개발 환경 URL 자동 감지:
 *  - EXPO_PUBLIC_API_BASE_URL이 localhost가 아닌 명시적 URL이면 그대로 사용
 *  - localhost인 경우 Expo hostUri에서 개발 머신 LAN IP를 자동 추출해 사용
 *    (물리 기기/Android 에뮬레이터에서 localhost:3000이 작동하지 않는 문제 해결)
 *  - tunnel 모드 + 다른 네트워크 사용 시 .env.local에 EXPO_PUBLIC_API_BASE_URL 수동 설정
 */
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const legacyManifest = (Constants as unknown as {
    manifest?: { debuggerHost?: string };
  }).manifest;

  // 프로덕션 빌드: env 값 그대로
  if (!__DEV__) return envUrl;

  // 개발 중, 명시적 URL(localhost 아님)이 설정된 경우 우선 사용
  if (envUrl && !envUrl.includes("localhost")) return envUrl;

  // Expo 개발 서버 hostUri에서 머신 IP 추출
  // - Expo SDK 50+: Constants.expoConfig.hostUri
  // - 구버전: Constants.manifest.debuggerHost
  const hostUri: string =
    expoConfig?.hostUri ??
    legacyManifest?.debuggerHost ??
    "";

  const ip = hostUri.split(":")[0];
  if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    // 물리 기기(같은 WiFi) or Android 에뮬레이터 → LAN IP:3000
    return `http://${ip}:3000`;
  }

  // iOS 시뮬레이터 등 localhost가 동작하는 환경 폴백
  return envUrl || "http://localhost:3000";
}

const BASE_URL = resolveBaseUrl();

export async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  // Supabase 세션에서 access_token 꺼내기
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message =
      (error as { message?: string }).message ?? "서버 오류가 발생했습니다.";
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
