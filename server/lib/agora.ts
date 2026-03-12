import { RtcTokenBuilder, RtcRole } from 'agora-token';

const APP_ID = process.env.AGORA_APP_ID!;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE!;

/** 소비자 Agora UID (채널 내 고정값) */
export const AGORA_CONSUMER_UID = 1;
/** 크리에이터 Agora UID (채널 내 고정값) */
export const AGORA_CREATOR_UID = 2;

/**
 * Agora RTC 토큰 생성 (서버사이드 전용)
 * @param channelName  Agora 채널명
 * @param uid          참가자 UID (소비자=1, 크리에이터=2)
 */
export function generateAgoraToken(channelName: string, uid: number): string {
  const expireSec = Math.floor(Date.now() / 1000) + 3600; // 1시간
  return RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireSec,
    expireSec,
  );
}
