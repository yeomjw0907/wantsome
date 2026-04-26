import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authClient = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(40, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10));

  const admin = createSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("orders")
    .select(
      `id, quantity, total_price, status, created_at,
       products(id, name, images, price, category)`,
    )
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    orders: rows ?? [],
    hasMore: (rows ?? []).length >= limit,
  });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authClient = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = (await req.json()) as { product_id: string; quantity?: number };
  const { product_id, quantity = 1 } = body;

  if (!product_id) {
    return NextResponse.json({ message: "product_id is required" }, { status: 400 });
  }

  if (quantity < 1) {
    return NextResponse.json({ message: "수량은 1 이상이어야 합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: product } = await admin
    .from("products")
    .select("id, name, price, stock, sold_count, is_active")
    .eq("id", product_id)
    .single();

  if (!product || !product.is_active) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  // 사전 검증 (UX용 — 실제 atomic 차감은 RPC가 보장)
  if (product.stock !== -1 && product.stock < quantity) {
    return NextResponse.json({ message: "재고가 부족합니다." }, { status: 409 });
  }

  const totalPrice = product.price * quantity;

  // ① atomic 재고 차감 (race 방어 — 음수 재고 방지)
  const { data: stockRows, error: stockErr } = await admin.rpc("try_decrement_stock", {
    p_product_id: product_id,
    p_quantity: quantity,
  });
  if (stockErr) {
    return NextResponse.json({ message: "재고 차감에 실패했습니다." }, { status: 500 });
  }
  if (!stockRows?.[0]?.success) {
    return NextResponse.json({ message: "재고가 부족합니다." }, { status: 409 });
  }

  // ② atomic 포인트 차감
  const { data: pointRows, error: pointError } = await admin.rpc("try_deduct_points", {
    p_user_id: authUser.id,
    p_amount: totalPrice,
  });
  if (pointError || !pointRows?.[0]?.success) {
    // 재고 롤백 (atomic — increment_stock RPC, 무제한 -1은 자동 무시)
    await admin.rpc("increment_stock", { p_product_id: product_id, p_quantity: quantity });
    return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
  }

  // ③ 주문 INSERT
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: authUser.id,
      product_id,
      quantity,
      total_price: totalPrice,
      status: "completed",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    // 포인트·재고 양쪽 atomic 롤백
    await admin.rpc("add_points", { p_user_id: authUser.id, p_amount: totalPrice });
    await admin.rpc("increment_stock", { p_product_id: product_id, p_quantity: quantity });
    return NextResponse.json({ message: "주문 생성에 실패했습니다." }, { status: 500 });
  }

  // ④ sold_count 갱신 (재고와 분리 — race 무관)
  const nextSoldCount = (product.sold_count ?? 0) + quantity;
  await admin.from("products").update({ sold_count: nextSoldCount }).eq("id", product_id);

  return NextResponse.json(
    {
      order_id: order.id,
      points_used: totalPrice,
      remaining_points: Math.max(0, (userRow.points ?? 0) - totalPrice),
    },
    { status: 201 },
  );
}
