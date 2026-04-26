#!/usr/bin/env node
/**
 * eas.json submit.production.ios placeholder guard.
 *
 * Apple ID/ASC App ID/Team ID가 placeholder인 채로 `eas submit --profile production`을
 * 실행하면 ASC 인증 단계에서야 실패하므로, 자동 파이프라인에서 가드하기 위해
 * pre-submit 단계에서 명시적으로 차단한다.
 *
 * 사용:
 *   npm run eas:check-submit
 *   eas submit --profile production --platform ios
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const easPath = path.join(__dirname, "..", "eas.json");

const raw = fs.readFileSync(easPath, "utf8");
const config = JSON.parse(raw);

const ios = config?.submit?.production?.ios;
if (!ios) {
  console.error("[eas-check] submit.production.ios 누락");
  process.exit(1);
}

const placeholders = [];
for (const [key, value] of Object.entries(ios)) {
  if (typeof value === "string" && value.startsWith("REPLACE_WITH_")) {
    placeholders.push(`${key}=${value}`);
  }
}

if (placeholders.length > 0) {
  console.error("[eas-check] eas.json submit.production.ios에 placeholder가 남아있습니다:");
  for (const p of placeholders) console.error("  - " + p);
  console.error("\nUSER-TODO 9번 (eas.json iOS submit 설정) 항목을 참조하여 실제 값으로 교체하세요.");
  process.exit(1);
}

console.log("[eas-check] eas.json submit.production.ios placeholder 없음 — OK");
