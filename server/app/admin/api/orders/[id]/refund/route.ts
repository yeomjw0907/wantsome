import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await verifyAdminSession(req);
  if (!adminUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id: orderId } = await params;
  const admin = createSupabaseAdmin();

  // 주문 조회
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, total_price, status, product_id, quantity")
    .eq("id", orderId)
    .single();

  if (!order) return NextResponse.json({ message: "주문을 찾을 수 없습니다." }, { status: 404 });
  if (order.status === "refunded") {
    return NextResponse.json({ message: "이미 환불된 주문입니다." }, { status: 409 });
  }

  // 포인트 복구
  const { data: userRow } = await admin
    .from("users")
    .select("points")
    .eq("id", order.user_id)
    .single();

  if (userRow) {
    await admin
      .from("users")
      .update({ points: (userRow.points ?? 0) + order.total_price })
      .eq("id", order.user_id);
  }

  // 주문 상태 업데이트
  const { error } = await admin
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", orderId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // 재고 복구 (유한 재고인 경우)
  if (order.product_id && order.quantity) {
    const { data: product } = await admin
      .from("products")
      .select("stock, sold_count")
      .eq("id", order.product_id)
      .single();
    if (product && product.stock !== -1) {
      await admin
        .from("products")
        .update({
          stock: product.stock + order.quantity,
          sold_count: Math.max(0, (product.sold_count ?? 0) - order.quantity),
        })
        .eq("id", order.product_id);
    }
  }

  return NextResponse.json({ success: true, refunded_points: order.total_price });
}
