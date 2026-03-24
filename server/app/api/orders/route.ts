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

  if (product.stock !== -1 && product.stock < quantity) {
    return NextResponse.json({ message: "재고가 부족합니다." }, { status: 409 });
  }

  const totalPrice = product.price * quantity;

  const { data: userRow } = await admin.from("users").select("points").eq("id", authUser.id).single();
  if (!userRow || (userRow.points ?? 0) < totalPrice) {
    return NextResponse.json({ message: "포인트가 부족합니다." }, { status: 402 });
  }

  const { error: pointError } = await admin
    .from("users")
    .update({ points: (userRow.points ?? 0) - totalPrice })
    .eq("id", authUser.id);

  if (pointError) {
    return NextResponse.json({ message: "포인트 차감에 실패했습니다." }, { status: 500 });
  }

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
    await admin.from("users").update({ points: userRow.points }).eq("id", authUser.id);
    return NextResponse.json({ message: "주문 생성에 실패했습니다." }, { status: 500 });
  }

  const nextSoldCount = (product.sold_count ?? 0) + quantity;

  if (product.stock !== -1) {
    await admin
      .from("products")
      .update({
        stock: product.stock - quantity,
        sold_count: nextSoldCount,
      })
      .eq("id", product_id);
  } else {
    await admin.from("products").update({ sold_count: nextSoldCount }).eq("id", product_id);
  }

  return NextResponse.json(
    {
      order_id: order.id,
      points_used: totalPrice,
      remaining_points: Math.max(0, (userRow.points ?? 0) - totalPrice),
    },
    { status: 201 },
  );
}
