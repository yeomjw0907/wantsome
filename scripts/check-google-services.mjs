#!/usr/bin/env node
/**
 * google-services.json placeholder 가드
 *
 * placeholder 파일로 EAS production 빌드 시 FCM/Firebase 동작 안 함.
 * pre-submit 단계에서 차단.
 *
 * 사용:
 *   npm run android:check-firebase
 *   eas build --platform android --profile production
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const targets = [
  path.join(__dirname, "..", "google-services.json"),
  path.join(__dirname, "..", "android", "app", "google-services.json"),
];

let failed = false;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error(`[firebase-check] ${file} 파싱 실패`);
    failed = true;
    continue;
  }
  const projectNumber = json?.project_info?.project_number ?? "";
  const projectId = json?.project_info?.project_id ?? "";
  const apiKey = json?.client?.[0]?.api_key?.[0]?.current_key ?? "";

  const isPlaceholder =
    projectNumber === "000000000000" ||
    projectId.includes("placeholder") ||
    apiKey === "placeholder";

  if (isPlaceholder) {
    console.error(`[firebase-check] ${file} 가 placeholder입니다`);
    console.error(`  project_number=${projectNumber} project_id=${projectId} api_key=${apiKey}`);
    failed = true;
  }
}

if (failed) {
  console.error("\nUSER-TODO 5번 (Google Cloud + Firebase + Play Console) 항목을 참조하여");
  console.error("실제 Firebase 프로젝트의 google-services.json으로 교체하거나");
  console.error("EAS Secret File로 GOOGLE_SERVICES_JSON 주입 후 빌드하세요.");
  process.exit(1);
}

console.log("[firebase-check] google-services.json 실제 값 확인 — OK");
