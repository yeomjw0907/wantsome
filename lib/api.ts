import Constants from "expo-constants";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

let authRedirectInFlight = false;

async function handleAuthExpired() {
  if (authRedirectInFlight) return;
  authRedirectInFlight = true;
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  try {
    router.replace("/(auth)/login");
  } catch {
    // ignore
  }
  setTimeout(() => {
    authRedirectInFlight = false;
  }, 1500);
}

function isLoopbackApiUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function looksLikeExpoTunnelHost(host: string): boolean {
  return host.includes("exp.direct") || host.includes("exp.host") || host.includes("ngrok");
}

function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const legacyManifest = (Constants as unknown as {
    manifest?: { debuggerHost?: string };
  }).manifest;

  if (!__DEV__) {
    return envUrl;
  }

  if (envUrl && !isLoopbackApiUrl(envUrl)) {
    return envUrl;
  }

  const hostUri = expoConfig?.hostUri ?? legacyManifest?.debuggerHost ?? "";
  const host = hostUri.split(":")[0] ?? "";

  if (host && /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return `http://${host}:3000`;
  }

  if (host && looksLikeExpoTunnelHost(host)) {
    console.warn(
      "[wantsome] Expo tunnel detected. Falling back to https://api.wantsome.kr. Set EXPO_PUBLIC_API_BASE_URL to your PC LAN IP if you want to use the local server on a real device.",
    );
    return "https://api.wantsome.kr";
  }

  // LAN IP 감지 실패 시: localhost는 물리 기기에서 접근 불가이므로 프로덕션 API로 폴백
  return envUrl && !isLoopbackApiUrl(envUrl) ? envUrl : "https://api.wantsome.kr";
}

export const BASE_URL = resolveBaseUrl();

let loggedBaseUrl = false;
if (__DEV__ && !loggedBaseUrl) {
  loggedBaseUrl = true;
  console.log("[wantsome api] BASE_URL =", BASE_URL);
}

export async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
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

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers,
      ...options,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn(`[apiCall] network ${path}`, e);
    }
    throw new Error("네트워크 연결을 확인해주세요.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const rawMessage = (error as { message?: string }).message;
    if (__DEV__) {
      const snippet =
        typeof error === "object" && error !== null
          ? JSON.stringify(error).slice(0, 280)
          : String(error);
      console.warn(`[apiCall] ${res.status} ${path}`, snippet);
    }
    const isAuthError =
      res.status === 401 &&
      (!rawMessage || /unauthorized|invalid token|expired token/i.test(rawMessage));

    if (isAuthError) {
      void handleAuthExpired();
    }

    throw new Error(
      isAuthError
        ? "로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해주세요."
        : rawMessage ?? "서버 오류가 발생했습니다.",
    );
  }

  return res.json() as Promise<T>;
}

/** multipart/form-data (이미지 등). Content-Type을 넣지 않아 RN이 boundary를 붙입니다. */
export async function uploadFormData<T>(path: string, formData: FormData): Promise<T> {
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch {
    accessToken = undefined;
  }

  const headers = new Headers();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn(`[uploadFormData] network ${path}`, e);
    }
    throw new Error("네트워크 연결을 확인해주세요.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const rawMessage = (error as { message?: string }).message;
    if (__DEV__) {
      console.warn(`[uploadFormData] ${res.status} ${path}`, rawMessage);
    }
    const isAuthError =
      res.status === 401 &&
      (!rawMessage || /unauthorized|invalid token|expired token/i.test(rawMessage));

    if (isAuthError) {
      void handleAuthExpired();
    }

    throw new Error(
      isAuthError
        ? "로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해주세요."
        : rawMessage ?? "서버 오류가 발생했습니다.",
    );
  }

  return res.json() as Promise<T>;
}
