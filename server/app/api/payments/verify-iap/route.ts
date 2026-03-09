import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { getProduct } from "@/lib/products";

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
    receipt: string;
    platform: string;
    product_id: string;
    idempotency_key: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, receipt, platform, product_id, idempotency_key } = body;
  if (
    !user_id ||
    !idempotency_key ||
    !product_id ||
    typeof receipt !== "string" ||
    !VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])
  ) {
    return NextResponse.json(
      { message: "Missing or invalid: user_id, receipt, platform, product_id, idempotency_key" },
      { status: 400 }
    );
  }

  if (user_id !== authUser.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const product = getProduct(product_id);
  if (!product) {
    return NextResponse.json({ message: "Invalid product_id" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const { data: existingCharge } = await admin
    .from("point_charges")
    .select("id, points, user_id")
    .eq("idempotency_key", idempotency_key)
    .single();

  if (existingCharge) {
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

  const currentPoints = userRow.points ?? 0;
  const isFirstCharged = userRow.is_first_charged ?? false;
  const firstChargeDeadline = userRow.first_charge_deadline
    ? new Date(userRow.first_charge_deadline)
    : null;
  const isFirst =
    !isFirstCharged && firstChargeDeadline != null && firstChargeDeadline > new Date();

  const pointsToAdd = isFirst ? product.points * 2 : product.points;
  const bonusPoints = Math.floor(product.points * product.bonus);
  const newBalance = currentPoints + pointsToAdd;

  const { error: updateError } = await admin
    .from("users")
    .update({
      points: newBalance,
      ...(isFirst ? { is_first_charged: true } : {}),
    })
    .eq("id", user_id);

  if (updateError) {
    return NextResponse.json({ message: "Failed to update user points" }, { status: 500 });
  }

  const { error: insertError } = await admin.from("point_charges").insert({
    user_id,
    product_id: product.id,
    amount_krw: product.price,
    points: pointsToAdd,
    bonus: bonusPoints,
    is_first: isFirst,
    platform,
    iap_receipt: receipt || null,
    idempotency_key,
  });

  if (insertError) {
    return NextResponse.json(
      { message: "Failed to record charge (possible duplicate idempotency_key)" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    points_added: pointsToAdd,
    new_balance: newBalance,
    is_first_charged: isFirst,
  });
}
