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

  const { action, targetId, role, email } = await req.json() as {
    action: "change_role" | "deactivate" | "reactivate" | "add" | "remove";
    targetId?: string;
    role?: string;
    email?: string;
  };

  const admin = createSupabaseAdmin();

  // ── 관리자 추가 (이메일로 검색 후 role 부여) ──
  if (action === "add") {
    if (!email?.trim()) return NextResponse.json({ message: "이메일을 입력하세요." }, { status: 400 });
    const grantRole = role && ["admin", "superadmin"].includes(role) ? role : "admin";

    const { data: found, error: findErr } = await admin
      .from("users")
      .select("id, email, role, deleted_at")
      .ilike("email", email.trim())
      .maybeSingle();

    if (findErr || !found) {
      return NextResponse.json({ message: "해당 이메일의 유저를 찾을 수 없습니다." }, { status: 404 });
    }
    if (found.deleted_at) {
      return NextResponse.json({ message: "탈퇴한 계정입니다." }, { status: 400 });
    }
    if (["admin", "superadmin"].includes(found.role)) {
      return NextResponse.json({ message: "이미 관리자 권한을 가진 계정입니다." }, { status: 400 });
    }

    await admin.from("users").update({ role: grantRole }).eq("id", found.id);
    await admin.from("admin_logs").insert({
      admin_id: adminId,
      action: "ADMIN_ADD",
      target_type: "admin",
      target_id: found.id,
      detail: { email: found.email, role: grantRole },
    });
    return NextResponse.json({ ok: true });
  }

  if (!targetId) return NextResponse.json({ message: "targetId 필수" }, { status: 400 });

  // 본인 계정 수정 방지
  if (targetId === adminId) {
    return NextResponse.json({ message: "자신의 계정은 수정할 수 없습니다." }, { status: 400 });
  }

  // ── 관리자 권한 제거 (role → user) ──
  if (action === "remove") {
    const { data: target } = await admin.from("users").select("role").eq("id", targetId).maybeSingle();
    if (target?.role === "superadmin") {
      return NextResponse.json({ message: "superadmin 계정은 권한을 제거할 수 없습니다." }, { status: 400 });
    }
    await admin.from("users").update({ role: "user" }).eq("id", targetId);
    await admin.from("admin_logs").insert({
      admin_id: adminId,
      action: "ADMIN_REMOVE",
      target_type: "admin",
      target_id: targetId,
      detail: { note: "권한 제거" },
    });
    return NextResponse.json({ ok: true });
  }

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
