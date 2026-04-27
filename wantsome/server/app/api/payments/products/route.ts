import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { PRODUCTS } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

  const admin = createSupabaseAdmin();
  const { data: userRow } = await admin
    .from("users")
    .select("first_charge_deadline, is_first_charged")
    .eq("id", authUser.id)
    .single();

  const firstChargeDeadline = userRow?.first_charge_deadline ?? null;
  const isFirstCharged = userRow?.is_first_charged ?? false;
  const isFirstAvailable =
    !isFirstCharged &&
    firstChargeDeadline != null &&
    new Date(firstChargeDeadline) > new Date();

  const products = PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    price_krw: p.price,
    points: p.points,
    bonus_rate: p.bonus,
    first_charge_points: p.points * 2,
  }));

  return NextResponse.json({
    products,
    is_first_available: isFirstAvailable,
    first_charge_deadline: firstChargeDeadline,
  });
}
