/**
 * 연령 계산 헬퍼 — KST 기준
 *
 * 만 N세 계산 시 timezone 차이로 1일 어긋날 수 있어
 * KST(Asia/Seoul) 기준으로 정규화. verify-identity / age-verify 모두 사용.
 */

const KST_OFFSET_MIN = 9 * 60; // +09:00

/**
 * birth_date 문자열을 KST 기준으로 만 N세 계산.
 *
 * @param birthDateStr "YYYY-MM-DD" 형식 (또는 ISO 8601 일부)
 * @returns 만 나이 (NaN if invalid)
 */
export function calcAgeKST(birthDateStr: string): number {
  if (!/^\d{4}-\d{2}-\d{2}/.test(birthDateStr)) {
    return Number.NaN;
  }

  const [y, m, d] = birthDateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return Number.NaN;

  // 현재 시각의 KST 날짜 (year/month/day)
  const nowKstMs = Date.now() + KST_OFFSET_MIN * 60_000;
  const nowKst = new Date(nowKstMs);
  const ny = nowKst.getUTCFullYear();
  const nm = nowKst.getUTCMonth() + 1; // 1~12
  const nd = nowKst.getUTCDate();

  let age = ny - y;
  if (nm < m || (nm === m && nd < d)) {
    age -= 1;
  }
  return age;
}
