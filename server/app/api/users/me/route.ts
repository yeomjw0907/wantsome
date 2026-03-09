import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("users")
    .select(
      "id, nickname, profile_img, role, is_verified, blue_mode, red_mode, suspended_until, points, first_charge_deadline, is_first_charged"
    )
    .eq("id", authUser.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    nickname: row.nickname,
    profile_img: row.profile_img,
    role: row.role ?? "consumer",
    is_verified: row.is_verified ?? false,
    blue_mode: row.blue_mode ?? true,
    red_mode: row.red_mode ?? false,
    suspended_until: row.suspended_until,
    points: row.points ?? 0,
    first_charge_deadline: row.first_charge_deadline,
    is_first_charged: row.is_first_charged ?? false,
  });
}
