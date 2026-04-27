import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { reason: string };
  if (!body.reason?.trim()) {
    return NextResponse.json({ message: "반려 사유 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  await admin
    .from("creator_profiles")
    .update({
      status: "REJECTED",
      reject_reason: body.reason,
      rejected_at: new Date().toISOString(),
      rejected_by: adminId,
    })
    .eq("user_id", id);

  await admin.from("users").update({ role: "consumer" }).eq("id", id);

  await sendPushToUser(admin, id, {
    title: "크리에이터 심사 결과",
    body: `재제출 요청: ${body.reason}`,
  });

  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "CREATOR_REJECT",
    target_type: "creator",
    target_id: id,
    detail: { status: "REJECTED", reason: body.reason },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  }).then(null, () => null);

  return NextResponse.json({ success: true });
}
