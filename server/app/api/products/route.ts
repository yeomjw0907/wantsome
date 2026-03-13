/**
 * GET /api/products — 상품 목록 (카테고리/검색 필터)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit    = Math.min(40, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10));
  const category = searchParams.get("category") ?? "all";
  const q        = searchParams.get("q") ?? "";

  const admin = createSupabaseAdmin();

  let query = admin
    .from("products")
    .select("id, name, description, price, original_price, category, tags, images, stock, sold_count, creator_id, created_at")
    .eq("is_active", true);

  if (category !== "all") {
    query = query.eq("category", category);
  }
  if (q.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }

  const { data: rows, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    products: rows ?? [],
    hasMore: (rows ?? []).length >= limit,
  });
}
