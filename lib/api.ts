/**
 * API 클라이언트 — docs/context/04_conventions.md
 * Supabase 세션 토큰을 Authorization 헤더에 자동 주입
 *
 * 개발 환경 URL 자동 감지:
 *  - EXPO_PUBLIC_API_BASE_URL이 localhost가 아닌 명시적 URL이면 그대로 사용
 *  - localhost인 경우 Expo hostUri에서 개발 머신 LAN IP를 자동 추출해 사용
 *    (물리 기기/Android 에뮬레이터에서 localhost:3000이 작동하지 않는 문제 해결)
 *  - tunnel 모드: hostUri가 *.exp.direct 등이라 LAN IP를 알 수 없음 → 로컬 API는 폰에서
 *    localhost로 접근 불가하므로, env가 localhost면 https://api.wantsome.kr 로 폴백
 *  - 로컬 server만 쓰려면 .env.local에 EXPO_PUBLIC_API_BASE_URL=http://<PC_LAN_IP>:3000
 */
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

function isLoopbackApiUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function looksLikeExpoTunnelHost(host: string): boolean {
  return (
    host.includes("exp.direct") ||
    host.includes("exp.host") ||
    host.includes("ngrok")
  );
}

function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const legacyManifest = (Constants as unknown as {
    manifest?: { debuggerHost?: string };
  }).manifest;

  // 프로덕션 빌드: env 값 그대로
  if (!__DEV__) return envUrl;

  // 개발 중, 루프백이 아닌 URL이면 그대로 (LAN IP·배포 API 등)
  if (envUrl && !isLoopbackApiUrl(envUrl)) return envUrl;

  // Expo 개발 서버 hostUri에서 머신 IP 추출
  // - Expo SDK 50+: Constants.expoConfig.hostUri
  // - 구버전: Constants.manifest.debuggerHost
  const hostUri: string =
    expoConfig?.hostUri ??
    legacyManifest?.debuggerHost ??
    "";

  const host = hostUri.split(":")[0] ?? "";

  if (host && /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return `http://${host}:3000`;
  }

  // 터널: 호스트명만 있고 PC LAN IP가 없음 → localhost:3000은 실제 기기에서 무조건 실패
  if (host && looksLikeExpoTunnelHost(host)) {
    console.warn(
      "[wantsome] Expo tunnel 감지: 로컬 API는 기기에서 localhost로 열 수 없습니다. https://api.wantsome.kr 로 요청합니다. 로컬 `server`만 쓰려면 .env.local에 EXPO_PUBLIC_API_BASE_URL=http://<PC_Wi-Fi_IP>:3000 을 설정하세요."
    );
    return "https://api.wantsome.kr";
  }

  // iOS 시뮬레이터·Android 에뮬(adb reverse) 등 localhost 동작 환경
  return envUrl || "http://localhost:3000";
}

const BASE_URL = resolveBaseUrl();

export async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  // 세션 조회 실패해도 공개 API(상품 목록 등)는 호출해야 함
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch {
    accessToken = undefined;
  }

  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
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
