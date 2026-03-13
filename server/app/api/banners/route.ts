/**
 * GET /api/banners — 앱 홈 배너 공개 조회 (인증 불필요)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: banners } = await admin
    .from("banners")
    .select("id, title, subtitle, image_url, link_url, type, sort_order")
    .eq("is_active", true)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .order("sort_order", { ascending: true })
    .limit(10);

  return NextResponse.json({ banners: banners ?? [] });
}
