import type { SupabaseClient } from "@supabase/supabase-js";

/** 양방향 차단 관계에 있는 사용자 ID 목록 반환.
 *
 * Apple App Review 2.1 (UGC) — 차단한 사용자가 매칭/탐색·라이브에 다시 노출되면 안 됨.
 * - 내가 차단한 사용자 (user_blocks.blocker_id = me)
 * - 나를 차단한 사용자 (user_blocks.blocked_id = me)
 *
 * 호출자가 unauth(token 없음)면 빈 배열 반환 — 비로그인 노출 시 차단 적용 불가.
 */
export async function getBlockedUserIds(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<string[]> {
  if (!userId) return [];

  const [outgoing, incoming] = await Promise.all([
    admin.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    admin.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
  ]);

  const ids = new Set<string>();
  for (const row of (outgoing.data ?? []) as { blocked_id: string }[]) {
    if (row.blocked_id) ids.add(row.blocked_id);
  }
  for (const row of (incoming.data ?? []) as { blocker_id: string }[]) {
    if (row.blocker_id) ids.add(row.blocker_id);
  }
  return Array.from(ids);
}

/** Bearer 토큰에서 user id를 안전하게 추출. 토큰 없거나 invalid면 null. */
export async function getOptionalUserId(
  admin: SupabaseClient,
  token: string | null,
): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
