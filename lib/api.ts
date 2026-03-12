/**
 * API 클라이언트 — docs/context/04_conventions.md
 * Supabase 세션 토큰을 Authorization 헤더에 자동 주입
 */
import { supabase } from "@/lib/supabase";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

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
