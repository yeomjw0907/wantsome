import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** 클라이언트 JWT 검증용 (Authorization 헤더 토큰으로 세팅) */
export function createSupabaseClient(accessToken: string | null) {
  return createClient(url, anonKey, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

/** 서버 전용 — RLS 우회 (users upsert, system_config 등) */
export function createSupabaseAdmin() {
  return createClient(url, serviceKey);
}
