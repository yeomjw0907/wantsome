import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();

  // creator_profiles 상태 변경
  const { error } = await admin
    .from("creator_profiles")
    .update({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq("user_id", userId);

  if (error) return NextResponse.json({ message: "승인 실패" }, { status: 500 });

  // users role 업데이트
  await admin.from("users").update({ role: "CREATOR", is_verified: true }).eq("id", userId);

  // 앱 푸시 알림
  await sendPushToUser(admin, userId, {
    title: "크리에이터 심사가 완료됐습니다 🎉",
    body: "이제 파란불/빨간불 모드로 통화를 시작하세요!",
  });

  // 관리자 로그
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "CREATOR_APPROVE",
    target_type: "creator",
    target_id: userId,
    detail: { status: "APPROVED" },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  }).catch(() => null);

  // Slack 알림
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `✅ 크리에이터 승인 처리\n• userId: ${userId}\n• 처리자: ${adminId}`,
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ success: true });
}
