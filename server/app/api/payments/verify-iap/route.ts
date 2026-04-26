import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { getProduct } from "@/lib/products";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rateLimit";
import { verifyAppleTransaction } from "@/lib/iap/apple";
import { verifyGooglePurchase } from "@/lib/iap/google";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS = ["ios", "android"] as const;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authClient = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authError,
  } = await authClient.auth.getUser(token);
  if (authError || !authUser) {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }

  let body: {
    user_id: string;
    purchase_token: string;
    platform: string;
    product_id: string;
    idempotency_key: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, purchase_token, platform, product_id, idempotency_key } = body;
  if (
    !user_id ||
    !idempotency_key ||
    !product_id ||
    typeof purchase_token !== "string" ||
    !VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])
  ) {
    return NextResponse.json(
      { message: "Missing or invalid: user_id, purchase_token, platform, product_id, idempotency_key" },
      { status: 400 }
    );
  }

  if (user_id !== authUser.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // 레이트 리밋: 유저당 1시간에 5회
  const allowed = await checkRateLimit(`iap:${authUser.id}`, 5, 3600);
  if (!allowed) return rateLimitExceeded(3600);

  const product = getProduct(product_id);
  if (!product) {
    return NextResponse.json({ message: "Invalid product_id" }, { status: 400 });
  }

  // ────────────────────────────────────────────────────────────
  // IAP 영수증 서버 검증 (Apple App Store / Google Play API)
  // - purchase_token 위조 방어
  // - bundleId / productId / 환불 상태 검증
  // - 자격 증명 미설정 시 거절 (fail-closed)
  // ────────────────────────────────────────────────────────────
  if (platform === "ios") {
    const result = await verifyAppleTransaction(purchase_token, product.storeId);
    if (!result.ok) {
      return NextResponse.json(
        { message: "Apple IAP verification failed", detail: result.reason },
        { status: 400 },
      );
    }
  } else {
    const result = await verifyGooglePurchase(purchase_token, product.storeId);
    if (!result.ok) {
      return NextResponse.json(
        { message: "Google IAP verification failed", detail: result.reason },
        { status: 400 },
      );
    }
  }

  const admin = createSupabaseAdmin();

  const { data: existingCharge } = await admin
    .from("point_charges")
    .select("id, points, user_id")
    .eq("idempotency_key", idempotency_key)
    .single();

  if (existingCharge) {
    // 동일 idempotency_key를 다른 user가 재사용 → 다른 사람의 잔액·첫충전 상태 노출 방지
    if (existingCharge.user_id !== authUser.id) {
      return NextResponse.json(
        { message: "idempotency_key already used by another user" },
        { status: 409 },
      );
    }
    const { data: userRow } = await admin
      .from("users")
      .select("points, is_first_charged")
      .eq("id", existingCharge.user_id)
      .single();
    const currentPoints = userRow?.points ?? 0;
    return NextResponse.json({
      success: true,
      points_added: existingCharge.points,
      new_balance: currentPoints,
      is_first_charged: userRow?.is_first_charged ?? false,
    });
  }

  const { data: userRow, error: userError } = await admin
    .from("users")
    .select("points, is_first_charged, first_charge_deadline")
    .eq("id", user_id)
    .single();

  if (userError || !userRow) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  // 첫충전 보너스 이벤트 비활성 (정책 변경, 2026-04-26)
  // is_first_charged / first_charge_deadline 컬럼은 보존 — 향후 이벤트 재개 시 분기 복원
  const isFirst = false;
  const pointsToAdd = product.points;
  const bonusPoints = Math.floor(product.points * product.bonus);

  // point_charges 기록 + users.points 업데이트를 단일 DB 트랜잭션으로 처리
  const { data: rpcRows, error: rpcError } = await admin.rpc("verify_iap_charge", {
    p_user_id:         user_id,
    p_product_id:      product.id,
    p_amount_krw:      product.price,
    p_points_to_add:   pointsToAdd,
    p_bonus:           bonusPoints,
    p_is_first:        isFirst,
    p_platform:        platform,
    p_purchase_token:  purchase_token || null,
    p_idempotency_key: idempotency_key,
  });

  if (rpcError || !rpcRows || rpcRows.length === 0) {
    return NextResponse.json({ message: "포인트 지급에 실패했습니다" }, { status: 500 });
  }

  const result = rpcRows[0] as { is_duplicate: boolean; new_balance: number; points_added: number };

  return NextResponse.json({
    success: true,
    points_added: result.points_added,
    new_balance: result.new_balance,
    is_first_charged: isFirst,
  });
}
