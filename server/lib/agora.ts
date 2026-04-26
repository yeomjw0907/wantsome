/**
 * Agora RTC 토큰 생성 유틸
 * 환경변수: AGORA_APP_ID, AGORA_APP_CERTIFICATE
 *
 * 보안 정책 (fail-closed):
 *  - AGORA_APP_ID 또는 AGORA_APP_CERTIFICATE 미설정 시 throw
 *  - 채널명을 sessionId/roomId 전체(32자) 사용 — 외부 추측 어려움
 *    + DB에 agora_channel 컬럼 저장된 값을 신뢰 (DB가 truth source)
 */

import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

const AGORA_APP_ID = process.env.AGORA_APP_ID ?? "";
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE ?? "";

export type AgoraTokenRole = "publisher" | "subscriber";

export function isAgoraConfigured() {
  return Boolean(AGORA_APP_ID && AGORA_APP_CERTIFICATE);
}

/**
 * Agora 채널명 생성 — sessionId 전체(32자) + 랜덤 salt(8자)
 * 결정적 부분은 DB 조회용, salt는 외부 추측 방어
 * 형식: call_<sessionId 32자>_<salt 8자> (총 47자, Agora 64자 한도 내)
 */
export function makeChannelName(sessionId: string): string {
  const id = sessionId.replace(/-/g, "");
  const salt = randomBytes(4).toString("hex"); // 8 hex chars
  return `call_${id}_${salt}`;
}

/**
 * 서버사이드 Agora RTC 토큰 생성 (1시간 유효)
 *
 * fail-closed: cert 미설정 시 throw — 호출처가 try/catch로 500 반환
 */
export async function generateAgoraToken(
  channelName: string,
  uid: number,
  role: AgoraTokenRole = "publisher"
): Promise<string> {
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    logger.error("Agora not configured: AGORA_APP_ID/AGORA_APP_CERTIFICATE missing");
    throw new Error("Agora not configured");
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
  } catch (err) {
    logger.error("Agora token build failed", { error: (err as Error).message });
    throw new Error("Agora token build failed");
  }
}

export { AGORA_APP_ID };
