/**
 * POST /api/push/register — Expo 푸시 토큰 등록/갱신
 * DELETE /api/push/register — 로그아웃 시 토큰 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { push_token } = await req.json() as { push_token: string };
  if (!push_token) return NextResponse.json({ message: "push_token 필요" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("push_tokens").upsert(
    { user_id: user.id, token: push_token, platform: "expo" },
    { onConflict: "user_id,token" }
  );

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { push_token } = await req.json() as { push_token?: string };
  const admin = createSupabaseAdmin();

  if (push_token) {
    await admin.from("push_tokens").delete().eq("user_id", user.id).eq("token", push_token);
  } else {
    await admin.from("push_tokens").delete().eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
