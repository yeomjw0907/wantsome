import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
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
    .eq("user_id", userId);

  await admin.from("users").update({ role: "consumer" }).eq("id", userId);

  // 앱 푸시
  const { data: pushToken } = await admin.from("push_tokens").select("token").eq("user_id", userId).single();
  if (pushToken?.token) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: pushToken.token,
        title: "크리에이터 심사 결과",
        body: `재제출 요청: ${body.reason}`,
        sound: "default",
      }),
    }).catch(() => null);
  }

  // 관리자 로그
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "CREATOR_REJECT",
    target_type: "creator",
    target_id: userId,
    detail: { status: "REJECTED", reason: body.reason },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
