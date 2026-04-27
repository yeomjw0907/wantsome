import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ReportCategory =
  | "UNDERAGE"
  | "ILLEGAL_RECORD"
  | "PROSTITUTION"
  | "HARASSMENT"
  | "FRAUD"
  | "OTHER";

const CRITICAL_CATEGORIES: ReportCategory[] = [
  "UNDERAGE",
  "ILLEGAL_RECORD",
  "PROSTITUTION",
];

async function sendSlackAlert(
  message: string,
  channel: "urgent" | "daily"
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        username: "wantsome 신고 봇",
        icon_emoji: channel === "urgent" ? ":rotating_light:" : ":memo:",
      }),
    });
  } catch { /* 슬랙 전송 실패는 무시 */ }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as {
    target_id: string;
    call_session_id?: string | null;
    category: ReportCategory;
    description?: string | null;
  };

  const { target_id, call_session_id, category, description } = body;

  if (!target_id || !category) {
    return NextResponse.json({ message: "target_id, category 필수" }, { status: 400 });
  }

  const validCategories: ReportCategory[] = [
    "UNDERAGE", "ILLEGAL_RECORD", "PROSTITUTION", "HARASSMENT", "FRAUD", "OTHER",
  ];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ message: "유효하지 않은 신고 카테고리" }, { status: 400 });
  }

  // 본인 신고 방지
  if (target_id === authUser.id) {
    return NextResponse.json({ message: "본인을 신고할 수 없습니다" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 신고 INSERT
  const { data: report, error: reportErr } = await admin
    .from("reports")
    .insert({
      reporter_id: authUser.id,
      target_id,
      call_session_id: call_session_id ?? null,
      category,
      description: description ?? null,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (reportErr || !report) {
    console.error("[reports] insert error:", reportErr);
    return NextResponse.json({ message: "신고 접수 실패" }, { status: 500 });
  }

  // 피신고자 정보 조회
  const { data: targetUser } = await admin
    .from("users")
    .select("nickname, suspended_until")
    .eq("id", target_id)
    .single();

  // 신고자 정보 조회
  const { data: reporterUser } = await admin
    .from("users")
    .select("nickname")
    .eq("id", authUser.id)
    .single();

  // 심각 카테고리: 즉시 계정 정지
  if (CRITICAL_CATEGORIES.includes(category)) {
    await admin
      .from("users")
      .update({ suspended_until: "9999-12-31T23:59:59Z" })
      .eq("id", target_id);

    // 긴급 슬랙 알림
    await sendSlackAlert(
      `🚨 *긴급 신고 접수*\n카테고리: *${category}*\n신고자: ${reporterUser?.nickname ?? authUser.id}\n피신고자: ${targetUser?.nickname ?? target_id}\n신고 ID: ${report.id}\n→ 계정 즉시 정지 처리됨`,
      "urgent"
    );
  } else {
    // 일반 신고: 슬랙 일일 요약으로 전달
    await sendSlackAlert(
      `📝 *신고 접수*\n카테고리: ${category}\n신고자: ${reporterUser?.nickname ?? authUser.id}\n피신고자: ${targetUser?.nickname ?? target_id}\n사유: ${description ?? "(없음)"}\n신고 ID: ${report.id}`,
      "daily"
    );
  }

  return NextResponse.json({ success: true, report_id: report.id });
}
