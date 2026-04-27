/**
 * Supabase "Secret Key (for OAuth)" 에 넣을 Apple client_secret JWT 생성.
 *
 * 사용 전: npm install (jose는 devDependencies)
 *
 * PowerShell 예:
 *   $env:APPLE_P8_PATH="C:\Users\yeomj\Downloads\AuthKey_XXXXX.p8"
 *   $env:APPLE_TEAM_ID="HULDGG4S79"
 *   $env:APPLE_KEY_ID="WC5Y5XRK2S"
 *   $env:APPLE_SERVICE_ID="kr.wantsome.app.signin"
 *   npm run apple:oauth-secret
 *
 * 출력된 한 줄을 Supabase → Apple → Secret Key 에 붙여넣기.
 * Apple 정책상 만료 최대 ~6개월 → 만료 전 재생성 후 Supabase 갱신.
 */

import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

const p8Path = process.env.APPLE_P8_PATH;
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const serviceId = process.env.APPLE_SERVICE_ID;

if (!p8Path || !teamId || !keyId || !serviceId) {
  console.error(
    "환경 변수를 설정하세요: APPLE_P8_PATH, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICE_ID",
  );
  process.exit(1);
}

const pem = readFileSync(p8Path, "utf8");
const key = await importPKCS8(pem, "ES256");

const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: keyId })
  .setIssuer(teamId)
  .setSubject(serviceId)
  .setAudience("https://appleid.apple.com")
  .setIssuedAt()
  .setExpirationTime("180d")
  .sign(key);

console.log(jwt);
