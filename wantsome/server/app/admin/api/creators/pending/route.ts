import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();

  const { data: creators, error } = await admin
    .from("creator_profiles")
    .select(`
      id,
      user_id,
      status,
      submitted_at,
      bank_name,
      account_holder,
      id_card_path,
      contract_signed_at,
      user:user_id (
        nickname,
        profile_img,
        created_at
      )
    `)
    .eq("status", "PENDING")
    .order("submitted_at", { ascending: true });

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // 이메일은 auth.users에서 조회
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailMap = new Map(authUsers?.users?.map((u) => [u.id, u.email]) ?? []);

  const result = (creators ?? []).map((c) => ({
    ...c,
    user: c.user ? { ...c.user, email: emailMap.get(c.user_id) ?? "" } : null,
  }));

  return NextResponse.json({ creators: result });
}
