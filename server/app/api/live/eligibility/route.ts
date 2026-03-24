import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({
      eligible: false,
      live_enabled: false,
      is_live_now: false,
      reason: "로그인 후 라이브 권한을 확인할 수 있습니다.",
    });
  }

  const user = await getAuthenticatedUser(token);
  if (!user) {
    return NextResponse.json({
      eligible: false,
      live_enabled: false,
      is_live_now: false,
      reason: "세션이 만료되었습니다. 다시 로그인해주세요.",
    });
  }

  const admin = createSupabaseAdmin();
  const { data: creator } = await admin
    .from("creators")
    .select("id, live_enabled, is_live_now")
    .eq("id", user.id)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({
      eligible: false,
      live_enabled: false,
      is_live_now: false,
      reason: "크리에이터 승인 후 사용 가능합니다.",
    });
  }

  if (!creator.live_enabled) {
    return NextResponse.json({
      eligible: false,
      live_enabled: false,
      is_live_now: creator.is_live_now ?? false,
      reason: "관리자 승인 후 사용 가능합니다.",
    });
  }

  return NextResponse.json({
    eligible: true,
    live_enabled: true,
    is_live_now: creator.is_live_now ?? false,
    reason: null,
  });
}
