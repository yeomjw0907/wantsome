import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

const ACTION_STATUS_MAP: Record<string, string> = {
  warn: "WARNED",
  suspend_7: "SUSPENDED_7",
  suspend_30: "SUSPENDED_30",
  permanently_ban: "PERMANENTLY_BANNED",
  dismiss: "DISMISSED",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { action: string };

  // permanently_ban은 superadmin만
  if (body.action === "permanently_ban" && adminRole !== "superadmin") {
    return NextResponse.json({ message: "superadmin만 가능합니다." }, { status: 403 });
  }

  const newStatus = ACTION_STATUS_MAP[body.action];
  if (!newStatus) {
    return NextResponse.json({ message: "잘못된 action" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 신고 조회
  const { data: report, error: repErr } = await admin
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (repErr || !report) {
    return NextResponse.json({ message: "신고를 찾을 수 없습니다." }, { status: 404 });
  }

  // reports 상태 업데이트
  await admin.from("reports").update({
    status: newStatus,
    resolved_at: new Date().toISOString(),
    admin_note: body.action,
  }).eq("id", id);

  // 대상 유저 정지 처리
  if (body.action !== "dismiss") {
    let suspendedUntil: string | null = null;
    if (body.action === "suspend_7") {
      suspendedUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    } else if (body.action === "suspend_30") {
      suspendedUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    } else if (body.action === "permanently_ban") {
      suspendedUntil = "9999-12-31T00:00:00Z";
    }

    if (suspendedUntil) {
      await admin.from("users").update({ suspended_until: suspendedUntil }).eq("id", report.target_id);

      const suspendMsg = body.action === "permanently_ban"
        ? "계정이 영구 정지됐습니다."
        : body.action === "suspend_7"
        ? "7일간 이용이 제한됩니다."
        : "30일간 이용이 제한됩니다.";

      await sendPushToUser(admin, report.target_id, {
        title: "계정 제한 안내",
        body: suspendMsg,
      });
    } else if (body.action === "warn") {
      await sendPushToUser(admin, report.target_id, {
        title: "이용 경고",
        body: "서비스 이용 규정 위반으로 경고 처리됐습니다.",
      });
    }
  }

  // 관리자 로그
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: `REPORT_${body.action.toUpperCase()}`,
    target_type: "report",
    target_id: id,
    detail: { action: body.action, target_id: report.target_id },
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
