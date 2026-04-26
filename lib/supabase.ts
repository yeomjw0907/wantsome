import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "@/lib/secureStorage";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// PR-9: 세션 토큰(JWT access + refresh)을 expo-secure-store(iOS Keychain / Android EncryptedSharedPreferences)
// 에 저장. AsyncStorage 평문 저장 시 루팅/탈옥 기기에서 토큰 탈취 가능.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
