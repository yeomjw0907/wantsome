import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

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
