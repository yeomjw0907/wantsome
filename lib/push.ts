import { apiCall } from "@/lib/api";

/**
 * 푸시 토큰 정리 유틸. useAuthStore.logout()에서 호출.
 *
 * 별도 파일로 분리한 이유:
 *  - useAuthStore가 lib/api를 import → 향후 apiCall이 401 시 store.logout()을 부르는
 *    패턴이 추가되면 cyclic dep으로 metro silent undefined 발생.
 *  - push 관련 endpoint를 한 곳에 모음.
 */
export async function deleteOwnPushToken(): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiCall("/api/push/register", { method: "DELETE" });
    return { ok: true };
  } catch (err) {
    // 네트워크 실패 등 — logout 흐름은 막지 않되 운영자가 인지하도록 stderr 로그
    const msg = err instanceof Error ? err.message : String(err);
    if (typeof console !== "undefined") {
      console.warn("[push] deleteOwnPushToken failed; token may persist server-side:", msg);
    }
    return { ok: false, error: msg };
  }
}
