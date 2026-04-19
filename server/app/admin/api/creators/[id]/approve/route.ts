import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";
import { MODE_LABEL } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("creator_profiles")
    .update({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq("user_id", id);

  if (error) return NextResponse.json({ message: "승인 실패" }, { status: 500 });

  await admin.from("users").update({ role: "CREATOR", is_verified: true }).eq("id", id);

  await sendPushToUser(admin, id, {
    title: "크리에이터 심사가 완료됐습니다 🎉",
    body: `이제 ${MODE_LABEL.blue}/${MODE_LABEL.red} 모드로 통화를 시작하세요!`,
  });

  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "CREATOR_APPROVE",
    target_type: "creator",
    target_id: id,
    detail: { status: "APPROVED" },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  }).then(null, () => null);

  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `✅ 크리에이터 승인 처리\n• userId: ${id}\n• 처리자: ${adminId}`,
      }),
    }).then(null, () => null);
  }

  return NextResponse.json({ success: true });
}
