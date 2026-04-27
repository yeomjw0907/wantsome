import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (adminRole !== "superadmin") return NextResponse.json({ message: "superadmin only" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const { data: logs } = await admin
    .from("admin_logs")
    .select("id, action, target_id, detail, created_at, admin_id, users!admin_id(nickname)")
    .eq("action", "POINT_ADJUST")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ logs: logs ?? [] });
}

export async function POST(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  const adminId = req.headers.get("x-admin-id");
  if (adminRole !== "superadmin" || !adminId) {
    return NextResponse.json({ message: "superadmin only" }, { status: 403 });
  }

  const { userId, amount, reason } = await req.json() as {
    userId: string;
    amount: number;
    reason: string;
  };

  if (!userId || !amount || !reason?.trim()) {
    return NextResponse.json({ message: "userId, amount, reason 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 현재 포인트 조회
  const { data: user } = await admin
    .from("users")
    .select("id, nickname, points")
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ message: "유저를 찾을 수 없습니다." }, { status: 404 });

  const newPoints = (user.points ?? 0) + amount;
  if (newPoints < 0) {
    return NextResponse.json({ message: `차감 불가: 현재 포인트(${user.points})보다 많습니다.` }, { status: 400 });
  }

  // 포인트 업데이트
  const { error } = await admin
    .from("users")
    .update({ points: newPoints })
    .eq("id", userId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // 관리자 로그 기록
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "POINT_ADJUST",
    target_type: "user",
    target_id: userId,
    detail: {
      nickname: user.nickname,
      before: user.points,
      after: newPoints,
      amount,
      reason,
    },
  });

  return NextResponse.json({
    ok: true,
    nickname: user.nickname,
    before: user.points,
    after: newPoints,
  });
}
