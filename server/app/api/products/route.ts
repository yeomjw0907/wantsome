/**
 * GET /api/products — 상품 목록 (카테고리/검색/판매자 필터)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit      = Math.min(40, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10));
  const category   = searchParams.get("category") ?? "all";
  const q          = searchParams.get("q") ?? "";
  const owner_type = searchParams.get("owner_type") ?? "all"; // "company" | "creator" | "all"

  const admin = createSupabaseAdmin();

  let query = admin
    .from("products")
    .select(`
      id, name, description, price, original_price, category, tags,
      images, stock, sold_count, owner_type, creator_id, created_at,
      creators:creator_id ( display_name )
    `)
    .eq("is_active", true);

  if (category !== "all") {
    query = query.eq("category", category);
  }
  if (q.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }
  if (owner_type !== "all") {
    query = query.eq("owner_type", owner_type);
  }

  const { data: rows, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // creator_display_name 평탄화
  const products = (rows ?? []).map((r: any) => ({
    ...r,
    creator_display_name: (r.creators as { display_name?: string } | null)?.display_name ?? null,
    creators: undefined,
  }));

  return NextResponse.json({
    products,
    hasMore: products.length >= limit,
  });
}
