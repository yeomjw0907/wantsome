/**
 * Agora RTC 토큰 생성 유틸
 * 환경변수: AGORA_APP_ID, AGORA_APP_CERTIFICATE
 *
 * agora-token 패키지가 없을 때는 임시 토큰(null)을 반환합니다.
 * 실제 운영 전 반드시 Agora Console에서 App ID/Certificate를 발급하고
 * 서버 환경변수에 등록하세요.
 */

const AGORA_APP_ID = process.env.AGORA_APP_ID ?? "";
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE ?? "";

export type AgoraTokenRole = "publisher" | "subscriber";

/** Agora 채널명 생성: call_{sessionId 앞 8자리} */
export function makeChannelName(sessionId: string): string {
  return `call_${sessionId.replace(/-/g, "").slice(0, 12)}`;
}

/**
 * 서버사이드 Agora RTC 토큰 생성 (1시간 유효)
 * Certificate가 없으면 null 반환 (개발용 no-token 모드)
 */
export async function generateAgoraToken(
  channelName: string,
  uid: number,
  role: AgoraTokenRole = "publisher"
): Promise<string | null> {
  if (!AGORA_APP_CERTIFICATE) {
    // 개발 환경: App Certificate 없이 Agora 테스트 (보안 취약 — 운영 금지)
    console.warn("[Agora] AGORA_APP_CERTIFICATE 없음 → no-token 모드");
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RtcTokenBuilder, RtcRole } = require("agora-token");
    const expireTime = Math.floor(Date.now() / 1000) + 3600;
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      expireTime,
      expireTime
    ) as string;
    return token;
  } catch {
    console.error("[Agora] agora-token 패키지 오류. npm install agora-token 실행 필요");
    return null;
  }
}

export { AGORA_APP_ID };
