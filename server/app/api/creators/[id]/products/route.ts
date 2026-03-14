/**
 * GET /api/creators/[id]/products — 크리에이터 소유 상품 목록
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: creatorId } = await params;
  const admin = createSupabaseAdmin();

  const { data: products } = await admin
    .from("products")
    .select("id, name, description, price, original_price, images, sold_count, is_active, category, created_at")
    .eq("creator_id", creatorId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ products: products ?? [] });
}
