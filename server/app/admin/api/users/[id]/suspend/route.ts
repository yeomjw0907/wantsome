import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { days: number };
  const { days } = body;

  const admin = createSupabaseAdmin();

  let suspendedUntil: string;
  if (days === -1) {
    // 영구 정지 (superadmin만)
    if (adminRole !== "superadmin") {
      return NextResponse.json({ message: "superadmin만 가능합니다." }, { status: 403 });
    }
    suspendedUntil = "9999-12-31T00:00:00Z";
  } else {
    suspendedUntil = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
  }

  const { error } = await admin
    .from("users")
    .update({ suspended_until: suspendedUntil })
    .eq("id", id);

  if (error) return NextResponse.json({ message: "정지 실패" }, { status: 500 });

  // 관리자 로그
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: `USER_SUSPEND_${days === -1 ? "PERMANENT" : days + "D"}`,
    target_type: "user",
    target_id: id,
    detail: { days, suspended_until: suspendedUntil },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
