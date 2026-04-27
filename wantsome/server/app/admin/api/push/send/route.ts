import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminId = req.headers.get("x-admin-id");
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole || !adminId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    target: "all" | "consumer" | "CREATOR" | string;
    title: string;
    body: string;
  };

  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ message: "title, body 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 대상 유저 토큰 조회 (users.push_token)
  let usersQuery = admin
    .from("users")
    .select("id, push_token")
    .not("push_token", "is", null)
    .is("deleted_at", null);

  if (body.target !== "all") {
    usersQuery = usersQuery.eq("role", body.target);
  }

  const { data: usersWithTokens } = await usersQuery;
  const validTokens = (usersWithTokens ?? [])
    .filter((u) => u.push_token)
    .map((u) => ({ token: u.push_token as string, user_id: u.id }));

  if (validTokens.length === 0) {
    return NextResponse.json({ success: true, sentCount: 0 });
  }

  // Expo 푸시 일괄 발송 (최대 100개씩)
  let successCount = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
    const batch = validTokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((t) => ({
      to: t.token,
      title: body.title,
      body: body.body,
      sound: "default",
    }));

    const expoToken = process.env.EXPO_ACCESS_TOKEN;
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(expoToken ? { "Authorization": `Bearer ${expoToken}` } : {}),
      },
      body: JSON.stringify(messages),
    }).then(null, () => null);

    if (res?.ok) successCount += batch.length;
  }

  // 발송 이력 저장
  await admin.from("push_logs").insert({
    sender_id: adminId,
    target: body.target,
    title: body.title,
    body: body.body,
    sent_count: validTokens.length,
  }).then(null, () => null);

  // 관리자 로그
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "PUSH_SEND",
    target_type: "push",
    detail: { target: body.target, title: body.title, sentCount: successCount },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  }).then(null, () => null);

  return NextResponse.json({ success: true, sentCount: successCount });
}
