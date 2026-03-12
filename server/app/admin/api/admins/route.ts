import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (adminRole !== "superadmin") return NextResponse.json({ message: "superadmin only" }, { status: 403 });

  const admin = createSupabaseAdmin();

  const { data: admins } = await admin
    .from("users")
    .select("id, nickname, email, role, created_at, suspended_until, deleted_at")
    .in("role", ["admin", "superadmin"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // 최근 활동 로그
  const { data: logs } = await admin
    .from("admin_logs")
    .select("id, admin_id, action, target_type, target_id, detail, created_at, users!admin_id(nickname)")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ admins: admins ?? [], logs: logs ?? [] });
}

export async function POST(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  const adminId = req.headers.get("x-admin-id");
  if (adminRole !== "superadmin" || !adminId) {
    return NextResponse.json({ message: "superadmin only" }, { status: 403 });
  }

  const { action, targetId, role } = await req.json() as {
    action: "change_role" | "deactivate" | "reactivate";
    targetId: string;
    role?: string;
  };

  if (!targetId) return NextResponse.json({ message: "targetId 필수" }, { status: 400 });

  // 본인 계정 수정 방지
  if (targetId === adminId) {
    return NextResponse.json({ message: "자신의 계정은 수정할 수 없습니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  if (action === "change_role") {
    if (!role || !["admin", "superadmin"].includes(role)) {
      return NextResponse.json({ message: "유효하지 않은 역할" }, { status: 400 });
    }
    await admin.from("users").update({ role }).eq("id", targetId);
  } else if (action === "deactivate") {
    await admin.from("users").update({ suspended_until: "9999-12-31T00:00:00.000Z" }).eq("id", targetId);
  } else if (action === "reactivate") {
    await admin.from("users").update({ suspended_until: null }).eq("id", targetId);
  }

  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: `ADMIN_${action.toUpperCase()}`,
    target_type: "admin",
    target_id: targetId,
    detail: { role },
  });

  return NextResponse.json({ ok: true });
}
