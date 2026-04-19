/**
 * 로컬 .env.local 의 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 로 DB 점검 (커밋 금지)
 * 실행: cd server && npx tsx scripts/audit-creators.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  const env = loadEnvFile(envPath);
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  console.log("=== creators 행 수 ===");
  const { count: nCreators, error: e1 } = await admin
    .from("creators")
    .select("*", { count: "exact", head: true });
  if (e1) console.error("creators count:", e1.message);
  else console.log("count:", nCreators ?? 0);

  console.log("\n=== creators 샘플 (최대 15행) ===");
  const { data: creators, error: e2 } = await admin
    .from("creators")
    .select("id, display_name, mode_blue, mode_red, is_online, categories")
    .order("created_at", { ascending: false })
    .limit(15);
  if (e2) console.error(e2.message);
  else console.log(JSON.stringify(creators, null, 2));

  console.log("\n=== users 행 수 ===");
  const { count: nUsers, error: e3 } = await admin
    .from("users")
    .select("*", { count: "exact", head: true });
  if (e3) console.error("users count:", e3.message);
  else console.log("count:", nUsers ?? 0);

  console.log("\n=== creators.id 가 users 에 없는 행 (프로필 조회 누락 후보) ===");
  const { data: cRows } = await admin.from("creators").select("id");
  const ids = (cRows ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) {
    console.log("(creators 비어 있음)");
  } else {
    const { data: uRows, error: e5 } = await admin
      .from("users")
      .select("id")
      .in("id", ids);
    if (e5) console.error(e5.message);
    else {
      const uSet = new Set((uRows ?? []).map((r: { id: string }) => r.id));
      const missing = ids.filter((id) => !uSet.has(id));
      console.log("creators 총", ids.length, "| users 매칭 누락 id 수:", missing.length);
      if (missing.length) console.log("누락 id 샘플:", missing.slice(0, 10));
    }
  }

  console.log("\n=== mode_blue NULL 인 creators 수 ===");
  const { count: nNullBlue, error: e6 } = await admin
    .from("creators")
    .select("*", { count: "exact", head: true })
    .is("mode_blue", null);
  if (e6) console.log("(mode_blue is null 필터 미지원 또는 0)", e6.message);
  else console.log("mode_blue IS NULL:", nNullBlue ?? 0);

  console.log("\n완료.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
