/**
 * GET /api/creators/[id]/orders — 크리에이터 상품 판매 내역 (본인만)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: creatorId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
  if (error || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  // 본인 또는 어드민만
  if (authUser.id !== creatorId) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data: orders } = await admin
    .from("orders")
    .select(`
      id, quantity, total_price, status, created_at,
      products!inner (id, name, images, price, creator_id),
      users:user_id (nickname, profile_img)
    `)
    .eq("products.creator_id", creatorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // 통계
  const { data: stats } = await admin
    .from("orders")
    .select("total_price, products!inner(creator_id)", { count: "exact" })
    .eq("products.creator_id", creatorId)
    .eq("status", "completed");

  const totalRevenue = (stats ?? []).reduce((sum: number, o: any) => sum + (o.total_price ?? 0), 0);

  return NextResponse.json({
    orders: orders ?? [],
    total_revenue: totalRevenue,
    hasMore: (orders ?? []).length === limit,
  });
}
