import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdminSession(req);
  if (!adminUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = 30;
  const status = searchParams.get("status") ?? "all";
  const q      = searchParams.get("q") ?? "";

  const admin = createSupabaseAdmin();

  let query = admin
    .from("orders")
    .select(`
      id, quantity, total_price, status, created_at,
      users!inner(id, nickname, profile_img),
      products(id, name, images, price, category)
    `);

  if (status !== "all") query = query.eq("status", status);
  if (q) {
    // 검색은 닉네임으로
    query = query.ilike("users.nickname", `%${q}%`);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [], hasMore: (data ?? []).length >= limit });
}
