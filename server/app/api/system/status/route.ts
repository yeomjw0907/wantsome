import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("system_config")
      .select("key, value");

    if (error) {
      return NextResponse.json(
        {
          maintenance_mode: "false",
          maintenance_message: "서비스 점검 중입니다.",
          maintenance_eta: "",
          min_version_ios: "1.0.0",
          min_version_android: "1.0.0",
          force_update_message: "새 버전이 출시됐습니다. 업데이트 후 이용해주세요.",
          cs_url: "",
        },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
      );
    }

    const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
    return NextResponse.json(
      {
        maintenance_mode: map.get("maintenance_mode") ?? "false",
        maintenance_message: map.get("maintenance_message") ?? "서비스 점검 중입니다.",
        maintenance_eta: map.get("maintenance_eta") ?? "",
        min_version_ios: map.get("min_version_ios") ?? "1.0.0",
        min_version_android: map.get("min_version_android") ?? "1.0.0",
        force_update_message:
          map.get("force_update_message") ?? "새 버전이 출시됐습니다. 업데이트 후 이용해주세요.",
        cs_url: map.get("cs_url") ?? "",
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json(
      {
        maintenance_mode: "false",
        maintenance_message: "서비스 점검 중입니다.",
        maintenance_eta: "",
        min_version_ios: "1.0.0",
        min_version_android: "1.0.0",
        force_update_message: "새 버전이 출시됐습니다. 업데이트 후 이용해주세요.",
        cs_url: "",
      },
      { headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  }
}
